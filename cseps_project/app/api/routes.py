import hashlib
import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.models.bid import BidLedger, Base
from app.schemas.bid_schema import BidSubmit

# Initialize the database tables (creates the SQLite file if it doesn't exist)
Base.metadata.create_all(bind=engine)

router = APIRouter()

# Dependency to open and close the database connection per request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def generate_tamper_proof_hash(previous_hash: str, payload: dict, timestamp: str) -> str:
    """Combines the previous hash with current data to create an unbreakable chain."""
    data_string = f"{previous_hash}{payload}{timestamp}"
    return hashlib.sha256(data_string.encode('utf-8')).hexdigest()

@router.post("/submit_bid")
def submit_bid(bid: BidSubmit, db: Session = Depends(get_db)):
    # 1. Retrieve the hash of the last bid in the database
    last_bid = db.query(BidLedger).order_by(BidLedger.id.desc()).first()
    
    # If there are no bids yet, we create a "Genesis Block" hash
    prev_hash = last_bid.current_hash if last_bid else "GENESIS_BLOCK_0000000000000000"

    # 2. Generate a secure Timestamp
    now = datetime.datetime.utcnow()

    # 3. Calculate the new hash for this specific submission
    current_hash = generate_tamper_proof_hash(
        previous_hash=prev_hash,
        payload=bid.dict(),
        timestamp=str(now)
    )

    # 4. Save everything to the SQLite Ledger
    new_bid = BidLedger(
        bidder_public_key=bid.bidder_public_key,
        signature=bid.signature,
        encrypted_c1_x=bid.encrypted_c1_x,
        encrypted_c2_x=bid.encrypted_c2_x,
        timestamp=now,
        previous_hash=prev_hash,
        current_hash=current_hash
    )
    db.add(new_bid)
    db.commit()
    db.refresh(new_bid)

    return {
        "status": "success",
        "ledger_id": new_bid.id,
        "timestamp": new_bid.timestamp,
        "hash_receipt": new_bid.current_hash,
        "message": "Bid securely encrypted and added to the tamper-proof ledger."
    }