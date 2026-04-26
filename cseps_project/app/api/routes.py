import hashlib
from datetime import datetime, timezone
import requests 
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.models.bid import BidLedger, Auction, EvaluatorShare, Base

# Make sure your AuctionCreate schema matches the new format with master_pub_x/y and encrypted_shares!
from app.schemas.bid_schema import BidSubmit, DecryptRequest, AuctionCreate, AuctionResponse

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

# The URL for your secure vault (still needed for opening bids)
TTP_VAULT_URL = "http://127.0.0.1:8001"

# --- 1. AUCTION CREATION (Zero-Knowledge: Ledger just saves the pre-encrypted data) ---
@router.post("/create_auction")
def create_auction(req: AuctionCreate, db: Session = Depends(get_db)):
    if len(req.evaluators) != 5:
        raise HTTPException(status_code=400, detail="Exactly 5 evaluators are required.")

    # 1. Save the Auction and its Public Keys
    new_auction = Auction(
        title=req.title, description=req.description, deadline=req.deadline,
        master_pub_x=req.master_pub_x, master_pub_y=req.master_pub_y
    )
    db.add(new_auction)
    db.commit()
    db.refresh(new_auction)
    
    # 2. Save the completely encrypted shares (Ledger has no idea what is inside)
    for ev in req.evaluators:
        new_share = EvaluatorShare(
            auction_id=new_auction.id, 
            evaluator_name=ev.name, 
            encrypted_share=ev.encrypted_share
        )
        db.add(new_share)
        
    db.commit()
    return {"status": "success", "auction_id": new_auction.id}


# --- 2. BID SUBMISSION (Zero-Knowledge: Ledger just saves the ciphertext block) ---
@router.post("/submit_bid")
@limiter.limit("5/minute")
def submit_bid(req: BidSubmit, request: Request, db: Session = Depends(get_db)):
    auction = db.query(Auction).filter(Auction.id == req.auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Tamper-Proof Blockchain Logic
    last_bid = db.query(BidLedger).order_by(BidLedger.id.desc()).first()
    prev_hash = last_bid.current_hash if last_bid else "GENESIS_BLOCK"

    current_time = datetime.now(timezone.utc)
    block_data = f"{prev_hash}_{req.bidder_hash}_{req.encrypted_c1_x}_{current_time.timestamp()}"
    current_hash = hashlib.sha256(block_data.encode('utf-8')).hexdigest()

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
        timestamp=current_time 
    )
    
    db.add(new_bid)
    db.commit()
    return {"status": "success", "message": "Bid securely added to the ledger."}


# --- 3. OPEN BIDS (Ledger bundles the ciphertexts and asks Vault to decrypt) ---
@router.post("/open_bids/{auction_id}")
def open_bids(request: Request, auction_id: int, req: DecryptRequest, db: Session = Depends(get_db)):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction: raise HTTPException(status_code=404, detail="Auction not found")

    current_time = datetime.now(timezone.utc)
    
    auction_deadline = auction.deadline
    if auction_deadline.tzinfo is None:
        auction_deadline = auction_deadline.replace(tzinfo=timezone.utc)
        
    if current_time < auction_deadline:
        # Convert the raw UTC database time back to local time for the UI message
        local_deadline = auction_deadline.astimezone(ZoneInfo("Asia/Colombo"))
        
        # Format it nicely (e.g., "2026-06-30 at 10:00 AM")
        friendly_time = local_deadline.strftime("%Y-%m-%d at %I:%M %p")
        raise HTTPException(
            status_code=403, 
            detail=f"Auction is still active. Bids cannot be revealed until {friendly_time}"
        )
     
    # Gather the raw ciphertext bids from the database
    auction_bids = db.query(BidLedger).filter(BidLedger.auction_id == auction_id).all()
    bids_payload = [
        {
            "ledger_id": bid.id,
            "encrypted_c1_x": bid.encrypted_c1_x, "encrypted_c1_y": bid.encrypted_c1_y, 
            "encrypted_c2_x": bid.encrypted_c2_x, "encrypted_c2_y": bid.encrypted_c2_y,
            "id_c1_x": bid.id_c1_x, "id_c1_y": bid.id_c1_y,
            "id_c2_x": bid.id_c2_x, "id_c2_y": bid.id_c2_y,
        } for bid in auction_bids
    ]

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

    # --- THE FIX: Handle the pre-formatted strings! ---
    results = vault_response["decrypted_bids"]
    
    # Helper to sort the string "$4,500,000" numerically
    def sort_by_amount(x):
        val = x.get("decrypted_amount", "N/A")
        if val == "N/A":
            return float('inf') # Push errors to the bottom
        return float(val.replace('$', '').replace(',', ''))

    results.sort(key=sort_by_amount)

    return {"status": "success", "bids_opened": len(results), "results": results}


# --- 4. DATA RETRIEVAL (GET endpoints for React) ---
@router.get("/auctions", response_model=list[AuctionResponse])
def get_auctions(db: Session = Depends(get_db)):
    return db.query(Auction).all()

@router.get("/auctions/{auction_id}/shares")
def get_auction_shares(auction_id: int, db: Session = Depends(get_db)):
    shares = db.query(EvaluatorShare).filter(EvaluatorShare.auction_id == auction_id).all()
    return [{"name": s.evaluator_name, "encrypted_share": s.encrypted_share} for s in shares]

@router.get("/auctions/{auction_id}/keys")
def get_auction_keys(auction_id: int, db: Session = Depends(get_db)):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction: 
        raise HTTPException(status_code=404, detail="Auction not found")
    return {
        "master_pub_x": auction.master_pub_x, 
        "master_pub_y": auction.master_pub_y
    }