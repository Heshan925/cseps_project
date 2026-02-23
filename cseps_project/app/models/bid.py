import datetime
from sqlalchemy import Column, Integer, String, DateTime
from app.core.database import Base

class BidLedger(Base):
    __tablename__ = "bids"

    id = Column(Integer, primary_key=True, index=True)
    signature = Column(String, nullable=False) 
    
    # 1. Encrypted IDENTITY (The mapped EC points for the Bidder ID)
    id_c1_x = Column(String, nullable=False)
    id_c1_y = Column(String, nullable=False)
    id_c2_x = Column(String, nullable=False)
    id_c2_y = Column(String, nullable=False)
    
    # 2. Encrypted AMOUNT (The mapped EC points for the Dollar Amount)
    encrypted_c1_x = Column(String, nullable=False) 
    encrypted_c1_y = Column(String, nullable=False) 
    encrypted_c2_x = Column(String, nullable=False) 
    encrypted_c2_y = Column(String, nullable=False) 
    
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    previous_hash = Column(String, nullable=False, index=True) 
    current_hash = Column(String, unique=True, nullable=False, index=True)