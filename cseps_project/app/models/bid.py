import datetime
from sqlalchemy import Column, Integer, String, DateTime
from app.core.database import Base

class BidLedger(Base):
    __tablename__ = "bids"

    id = Column(Integer, primary_key=True, index=True)
    bidder_public_key = Column(String, nullable=False)
    signature = Column(String, nullable=False) 
    
    # Store BOTH X and Y coordinates for the pure ECC points
    encrypted_c1_x = Column(String, nullable=False) 
    encrypted_c1_y = Column(String, nullable=False) 
    encrypted_c2_x = Column(String, nullable=False) 
    encrypted_c2_y = Column(String, nullable=False) 
    
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    previous_hash = Column(String, nullable=False, index=True) 
    current_hash = Column(String, unique=True, nullable=False, index=True)