import hashlib
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.models.bid import BidLedger, Auction, EvaluatorShare, Base
from app.schemas.bid_schema import BidSubmit, DecryptRequest, LocalEncryptRequest, AuctionCreate, AuctionResponse
from app.services.threshold_service import reconstruct_private_key, split_private_key, encrypt_share_aes
from app.services.crypto_service import decrypt_bid_ecc, encrypt_bid_ecc, generate_ecc_keypair, curve, ec

Base.metadata.create_all(bind=engine)
router = APIRouter()

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

def generate_tamper_proof_hash(prev: str, payload: dict, ts: str) -> str:
    return hashlib.sha256(f"{prev}{payload}{ts}".encode('utf-8')).hexdigest()

# --- NEW: AUCTION MANAGEMENT ENDPOINTS ---

@router.post("/create_auction")
def create_auction(req: AuctionCreate, db: Session = Depends(get_db)):
    if len(req.evaluators) != 5:
        raise HTTPException(status_code=400, detail="Exactly 5 evaluators are required.")

    # 1. Generate a brand new Master Keypair for this specific auction
    master_priv, master_pub = generate_ecc_keypair()

    # 2. Save the Auction with the new Public Key
    new_auction = Auction(
        title=req.title, description=req.description, deadline=req.deadline,
        master_pub_x=str(master_pub.x), master_pub_y=str(master_pub.y)
    )
    db.add(new_auction)
    db.commit()
    db.refresh(new_auction)

    # 3. Split the private key and encrypt shares for each evaluator
    raw_shares = split_private_key(master_priv, threshold=3, total_shares=5)
    
    for i, eval_data in enumerate(req.evaluators):
        encrypted_str = encrypt_share_aes(raw_shares[i], eval_data.password)
        new_share = EvaluatorShare(
            auction_id=new_auction.id, evaluator_name=eval_data.name, encrypted_share=encrypted_str
        )
        db.add(new_share)
        
    db.commit()
    return {"status": "success", "auction_id": new_auction.id}

@router.get("/auctions", response_model=list[AuctionResponse])
def get_auctions(db: Session = Depends(get_db)):
    return db.query(Auction).all()

@router.get("/auctions/{auction_id}/shares")
def get_auction_shares(auction_id: int, db: Session = Depends(get_db)):
    shares = db.query(EvaluatorShare).filter(EvaluatorShare.auction_id == auction_id).all()
    return [{"name": s.evaluator_name, "encrypted_share": s.encrypted_share} for s in shares]

# --- UPDATED: BIDDING ENDPOINTS ---

@router.post("/simulate_local_encryption")
def simulate_encryption(req: LocalEncryptRequest, db: Session = Depends(get_db)):
    auction = db.query(Auction).filter(Auction.id == req.auction_id).first()
    if not auction: raise HTTPException(status_code=404, detail="Auction not found")
    
    # Reconstruct the specific auction's public key
    auction_pub_key = ec.Point(curve, int(auction.master_pub_x), int(auction.master_pub_y))
    
    C1_amt, C2_amt = encrypt_bid_ecc(auction_pub_key, req.amount)
    C1_id, C2_id = encrypt_bid_ecc(auction_pub_key, req.bidder_id)
    
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
        auction_id=bid.auction_id, signature=bid.signature,
        id_c1_x=bid.id_c1_x, id_c1_y=bid.id_c1_y, id_c2_x=bid.id_c2_x, id_c2_y=bid.id_c2_y,
        encrypted_c1_x=bid.encrypted_c1_x, encrypted_c1_y=bid.encrypted_c1_y,
        encrypted_c2_x=bid.encrypted_c2_x, encrypted_c2_y=bid.encrypted_c2_y,
        timestamp=now, previous_hash=prev_hash, current_hash=current_hash
    )
    db.add(new_bid)
    db.commit()
    db.refresh(new_bid)
    return {"status": "success", "ledger_id": new_bid.id, "hash_receipt": new_bid.current_hash}

@router.post("/open_bids/{auction_id}")
def open_bids(auction_id: int, req: DecryptRequest, db: Session = Depends(get_db)):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction: raise HTTPException(status_code=404, detail="Auction not found")
    
    # Check Deadline
    if datetime.datetime.utcnow() < auction.deadline:
        raise HTTPException(status_code=403, detail=f"Bidding active until {auction.deadline} UTC.")

    try:
        master_priv = reconstruct_private_key(req.shares)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid shares.")

    # Only fetch bids for THIS specific auction
    auction_bids = db.query(BidLedger).filter(BidLedger.auction_id == auction_id).all()
    results = []

    for bid in auction_bids:
        try:
            C1_amt = ec.Point(curve, int(bid.encrypted_c1_x), int(bid.encrypted_c1_y))
            C2_amt = ec.Point(curve, int(bid.encrypted_c2_x), int(bid.encrypted_c2_y))
            amt = decrypt_bid_ecc(master_priv, C1_amt, C2_amt)
            
            C1_id = ec.Point(curve, int(bid.id_c1_x), int(bid.id_c1_y))
            C2_id = ec.Point(curve, int(bid.id_c2_x), int(bid.id_c2_y))
            bidder_id = decrypt_bid_ecc(master_priv, C1_id, C2_id)
            
            results.append({"ledger_id": bid.id, "decrypted_id": f"Contractor-{bidder_id}", "raw_amount": amt})
        except Exception:
            results.append({"ledger_id": bid.id, "error": "Decryption failed.", "raw_amount": float('inf')})

    results.sort(key=lambda x: x["raw_amount"])
    for res in results:
        if res["raw_amount"] != float('inf'):
            res["decrypted_amount"] = f"${res['raw_amount']:,}"
        del res["raw_amount"]

    return {"status": "success", "bids_opened": len(results), "results": results}