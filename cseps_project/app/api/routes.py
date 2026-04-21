import hashlib
import datetime
import requests  # NEW: To communicate with the TTP Vault

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.models.bid import BidLedger, Auction, EvaluatorShare, Base
from app.schemas.bid_schema import BidSubmit, DecryptRequest, LocalEncryptRequest, AuctionCreate, AuctionResponse

from slowapi.util import get_remote_address
from slowapi import Limiter

limiter = Limiter(key_func=get_remote_address)
Base.metadata.create_all(bind=engine)
router = APIRouter()

def get_db():
    db = SessionLocal()
    try: 
        yield db
    finally: 
        db.close()

# The URL for your new secure vault!
TTP_VAULT_URL = "http://127.0.0.1:8001"


@router.post("/create_auction")
def create_auction(req: AuctionCreate, db: Session = Depends(get_db)):
    if len(req.evaluators) != 5:
        raise HTTPException(status_code=400, detail="Exactly 5 evaluators are required.")

    # 1. Ask the Vault to generate everything
    passwords = [e.password for e in req.evaluators]
    try:
        response = requests.post(f"{TTP_VAULT_URL}/generate_keys", json={"passwords": passwords})
        response.raise_for_status()
        vault_data = response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTP Vault offline or failed: {str(e)}")

    # 2. Save the safe data to the Database
    new_auction = Auction(
        title=req.title, description=req.description, deadline=req.deadline,
        master_pub_x=vault_data["master_pub_x"], master_pub_y=vault_data["master_pub_y"]
    )
    db.add(new_auction)
    db.commit()
    db.refresh(new_auction)
    
    for i, eval_data in enumerate(req.evaluators):
        new_share = EvaluatorShare(
            auction_id=new_auction.id, 
            evaluator_name=eval_data.name, 
            encrypted_share=vault_data["encrypted_shares"][i]
        )
        db.add(new_share)
        
    db.commit()
    return {"status": "success", "auction_id": new_auction.id}

@router.post("/open_bids/{auction_id}")
def open_bids(request: Request, auction_id: int, req: DecryptRequest, db: Session = Depends(get_db)):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction: raise HTTPException(status_code=404, detail="Auction not found")

    # Gather the raw ciphertext bids from the database
    auction_bids = db.query(BidLedger).filter(BidLedger.auction_id == auction_id).all()
    bids_payload = []
    for bid in auction_bids:
        bids_payload.append({
            "ledger_id": bid.id,
            "encrypted_c1_x": bid.encrypted_c1_x, "encrypted_c1_y": bid.encrypted_c1_y, 
            "encrypted_c2_x": bid.encrypted_c2_x, "encrypted_c2_y": bid.encrypted_c2_y,
            "id_c1_x": bid.id_c1_x, "id_c1_y": bid.id_c1_y,
            "id_c2_x": bid.id_c2_x, "id_c2_y": bid.id_c2_y,
        })

    # Ask the Vault to unlock and decrypt!
    try:
        response = requests.post(f"{TTP_VAULT_URL}/unlock_and_decrypt", json={
            "encrypted_shares": req.shares,
            "passwords": req.passwords,
            "encrypted_bids": bids_payload
        })
        response.raise_for_status()
        vault_response = response.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Format the results
    results = vault_response["decrypted_bids"]
    results.sort(key=lambda x: x["raw_amount"])
    for res in results:
        if res["raw_amount"] != float('inf'):
            res["decrypted_amount"] = f"${res['raw_amount']:,}"
        del res["raw_amount"]

    return {"status": "success", "bids_opened": len(results), "results": results}

@router.get("/auctions", response_model=list[AuctionResponse])
def get_auctions(db: Session = Depends(get_db)):
    # Returns the list of auctions to the React frontend
    return db.query(Auction).all()

@router.get("/auctions/{auction_id}/shares")
def get_auction_shares(auction_id: int, db: Session = Depends(get_db)):
    # Returns the AES-encrypted shares to the frontend for the evaluators
    shares = db.query(EvaluatorShare).filter(EvaluatorShare.auction_id == auction_id).all()
    return [{"name": s.evaluator_name, "encrypted_share": s.encrypted_share} for s in shares]


@router.post("/simulate_local_encryption")
def simulate_encryption(req: LocalEncryptRequest, db: Session = Depends(get_db)):
    # 1. Verify the auction exists
    auction = db.query(Auction).filter(Auction.id == req.auction_id).first()
    if not auction: raise HTTPException(status_code=404, detail="Auction not found")
    
    # 2. Ask the TTP Vault to do the heavy ECC math
    try:
        response = requests.post(f"{TTP_VAULT_URL}/simulate_encryption", json={
            "auction_pub_x": auction.master_pub_x,
            "auction_pub_y": auction.master_pub_y,
            "amount": req.amount,
            "bidder_id": req.bidder_id,
            "auction_id": req.auction_id
        })
        response.raise_for_status()
        vault_data = response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTP Vault Encryption Failed: {str(e)}")

    # 3. Return the encrypted coordinates to React
    return vault_data

@router.post("/submit_bid")
@limiter.limit("5/minute")
def submit_bid(req: BidSubmit, request: Request, db: Session = Depends(get_db)):
    # 1. Verify auction exists
    auction = db.query(Auction).filter(Auction.id == req.auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # 2. Tamper-Proof Blockchain Logic (Get previous hash)
    last_bid = db.query(BidLedger).order_by(BidLedger.id.desc()).first()
    prev_hash = last_bid.current_hash if last_bid else "GENESIS_BLOCK"

    # --- THE FIX: Generate the timestamp HERE on the server ---
    current_time = datetime.datetime.utcnow()

    # 3. Create the current block hash (using the current_time)
    block_data = f"{prev_hash}_{req.bidder_hash}_{req.encrypted_c1_x}_{current_time.timestamp()}"
    current_hash = hashlib.sha256(block_data.encode('utf-8')).hexdigest()

    # 4. Save the encrypted bid to the Ledger (Zero-Knowledge!)
    new_bid = BidLedger(
        auction_id=req.auction_id,
        bidder_hash=req.bidder_hash,
        encrypted_c1_x=req.encrypted_c1_x, encrypted_c1_y=req.encrypted_c1_y,
        encrypted_c2_x=req.encrypted_c2_x, encrypted_c2_y=req.encrypted_c2_y,
        id_c1_x=req.id_c1_x, id_c1_y=req.id_c1_y,
        id_c2_x=req.id_c2_x, id_c2_y=req.id_c2_y,
        signature=req.signature,
        previous_hash=prev_hash,
        current_hash=current_hash,
        timestamp=current_time # Use the exact same time we just hashed!
    )
    
    db.add(new_bid)
    db.commit()
    
    return {"status": "success", "message": "Bid securely added to the ledger."}