import hashlib
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.models.bid import BidLedger, Base
from app.schemas.bid_schema import BidSubmit, DecryptRequest
from app.services.threshold_service import reconstruct_private_key
from app.services.crypto_service import decrypt_bid_ecc, curve, ec

# Initializes the fresh database
Base.metadata.create_all(bind=engine)
router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def generate_tamper_proof_hash(previous_hash: str, payload: dict, timestamp: str) -> str:
    data_string = f"{previous_hash}{payload}{timestamp}"
    return hashlib.sha256(data_string.encode('utf-8')).hexdigest()

@router.post("/submit_bid")
def submit_bid(bid: BidSubmit, db: Session = Depends(get_db)):
    """Receives a mathematically encrypted bid and adds it to the hash chain."""
    last_bid = db.query(BidLedger).order_by(BidLedger.id.desc()).first()
    prev_hash = last_bid.current_hash if last_bid else "GENESIS_BLOCK_0000000000000000"
    now = datetime.datetime.utcnow()

    current_hash = generate_tamper_proof_hash(
        previous_hash=prev_hash, payload=bid.dict(), timestamp=str(now)
    )

    new_bid = BidLedger(
        bidder_public_key=bid.bidder_public_key,
        signature=bid.signature,
        encrypted_c1_x=bid.encrypted_c1_x,
        encrypted_c1_y=bid.encrypted_c1_y,
        encrypted_c2_x=bid.encrypted_c2_x,
        encrypted_c2_y=bid.encrypted_c2_y,
        timestamp=now,
        previous_hash=prev_hash,
        current_hash=current_hash
    )
    db.add(new_bid)
    db.commit()
    db.refresh(new_bid)

    return {"status": "success", "ledger_id": new_bid.id, "hash_receipt": new_bid.current_hash}

@router.post("/open_bids")
def open_bids(req: DecryptRequest, db: Session = Depends(get_db)):
    """Evaluators submit shares to reconstruct the key and open the ledger."""
    # 1. Reconstruct the Master Private Key
    try:
        master_private_key = reconstruct_private_key(req.shares)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid shares. Cannot reconstruct master key.")

    # 2. Fetch all sealed bids from the database
    all_bids = db.query(BidLedger).all()
    decrypted_results = []

    # 3. Mathematically decrypt each bid
    for bid in all_bids:
        try:
            # Rebuild the EC Points from the database strings
            C1 = ec.Point(curve, int(bid.encrypted_c1_x), int(bid.encrypted_c1_y))
            C2 = ec.Point(curve, int(bid.encrypted_c2_x), int(bid.encrypted_c2_y))
            
            # Decrypt back to the numeric amount
            decrypted_amount = decrypt_bid_ecc(master_private_key, C1, C2)
            
            decrypted_results.append({
                "ledger_id": bid.id,
                "bidder_public_key": bid.bidder_public_key[:20] + "...",
                "decrypted_amount": f"${decrypted_amount:,}"
            })
        except Exception:
            decrypted_results.append({"ledger_id": bid.id, "error": "Decryption failed. Data corrupted."})

    return {"status": "success", "bids_opened": len(decrypted_results), "results": decrypted_results}