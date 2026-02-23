import hashlib
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.models.bid import BidLedger, Base
from app.schemas.bid_schema import BidSubmit, DecryptRequest, LocalEncryptRequest
from app.services.threshold_service import reconstruct_private_key
from app.services.crypto_service import decrypt_bid_ecc, encrypt_bid_ecc, DEMO_MASTER_PUBLIC_KEY, curve, ec

Base.metadata.create_all(bind=engine)
router = APIRouter()

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

def generate_tamper_proof_hash(prev: str, payload: dict, ts: str) -> str:
    return hashlib.sha256(f"{prev}{payload}{ts}".encode('utf-8')).hexdigest()

@router.post("/simulate_local_encryption")
def simulate_encryption(req: LocalEncryptRequest):
    # Mathematically encrypt both the Dollar Amount AND the Bidder Identity
    C1_amt, C2_amt = encrypt_bid_ecc(DEMO_MASTER_PUBLIC_KEY, req.amount)
    C1_id, C2_id = encrypt_bid_ecc(DEMO_MASTER_PUBLIC_KEY, req.bidder_id)
    
    return {
        "id_c1_x": str(C1_id.x), "id_c1_y": str(C1_id.y),
        "id_c2_x": str(C2_id.x), "id_c2_y": str(C2_id.y),
        "encrypted_c1_x": str(C1_amt.x), "encrypted_c1_y": str(C1_amt.y),
        "encrypted_c2_x": str(C2_amt.x), "encrypted_c2_y": str(C2_amt.y)
    }

@router.post("/submit_bid")
def submit_bid(bid: BidSubmit, db: Session = Depends(get_db)):
    last = db.query(BidLedger).order_by(BidLedger.id.desc()).first()
    prev_hash = last.current_hash if last else "GENESIS_BLOCK_0000000000000000"
    now = datetime.datetime.utcnow()
    current_hash = generate_tamper_proof_hash(prev_hash, bid.dict(), str(now))

    new_bid = BidLedger(
        signature=bid.signature,
        id_c1_x=bid.id_c1_x, id_c1_y=bid.id_c1_y,
        id_c2_x=bid.id_c2_x, id_c2_y=bid.id_c2_y,
        encrypted_c1_x=bid.encrypted_c1_x, encrypted_c1_y=bid.encrypted_c1_y,
        encrypted_c2_x=bid.encrypted_c2_x, encrypted_c2_y=bid.encrypted_c2_y,
        timestamp=now, previous_hash=prev_hash, current_hash=current_hash
    )
    db.add(new_bid)
    db.commit()
    db.refresh(new_bid)
    return {"status": "success", "ledger_id": new_bid.id, "hash_receipt": new_bid.current_hash}

@router.post("/open_bids")
def open_bids(req: DecryptRequest, db: Session = Depends(get_db)):
    BIDDING_DEADLINE = datetime.datetime(2026, 1, 31, 23, 59, 59) 
    
    if datetime.datetime.utcnow() < BIDDING_DEADLINE:
        raise HTTPException(
            status_code=403, 
            detail=f"Access Denied. Bidding phase is still active until {BIDDING_DEADLINE} UTC."
        )
    
    try:
        master_priv = reconstruct_private_key(req.shares)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid shares.")

    all_bids = db.query(BidLedger).all()
    results = []

    for bid in all_bids:
        try:
            # 1. Decrypt Amount
            C1_amt = ec.Point(curve, int(bid.encrypted_c1_x), int(bid.encrypted_c1_y))
            C2_amt = ec.Point(curve, int(bid.encrypted_c2_x), int(bid.encrypted_c2_y))
            amt = decrypt_bid_ecc(master_priv, C1_amt, C2_amt)
            
            # 2. Decrypt Identity
            C1_id = ec.Point(curve, int(bid.id_c1_x), int(bid.id_c1_y))
            C2_id = ec.Point(curve, int(bid.id_c2_x), int(bid.id_c2_y))
            bidder_id = decrypt_bid_ecc(master_priv, C1_id, C2_id)
            
            results.append({
                "ledger_id": bid.id,
                "decrypted_id": f"Contractor-{bidder_id}",
                "raw_amount": amt 
            })
        except Exception:
            results.append({"ledger_id": bid.id, "error": "Decryption failed.", "raw_amount": float('inf')})

    # Sort mathematically by lowest bid ascending
    results.sort(key=lambda x: x["raw_amount"])
    
    for res in results:
        if res["raw_amount"] != float('inf'):
            res["decrypted_amount"] = f"${res['raw_amount']:,}"
        del res["raw_amount"]

    return {"status": "success", "bids_opened": len(results), "results": results}