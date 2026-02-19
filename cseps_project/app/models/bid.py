import datetime
from sqlalchemy import Column, Integer, String, DateTime
from app.core.database import Base

class BidLedger(Base):
    """
    Represents the public, tamper-proof ledger for the CSePS system.
    """
    __tablename__ = "bids"

    id = Column(Integer, primary_key=True, index=True)
    
    # 1. Identity & Verification
    bidder_public_key = Column(String, nullable=False)
    signature = Column(String, nullable=False) # Guarantees non-repudiation
    
    # 2. Pure ECC Encrypted Payload (The X-coordinates of the mapped points)
    encrypted_c1_x = Column(String, nullable=False) 
    encrypted_c2_x = Column(String, nullable=False) 
    
    # 3. Timestamping (Project Requirement)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    # 4. Hash-Chain (Tamper-Proofing Requirement)
    previous_hash = Column(String, nullable=False, index=True) 
    current_hash = Column(String, unique=True, nullable=False, index=True)