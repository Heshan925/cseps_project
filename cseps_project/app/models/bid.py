import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Auction(Base):
    __tablename__ = "auctions"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String)
    deadline = Column(DateTime, nullable=False)
    
    # The unique Master Public Key for THIS specific auction
    master_pub_x = Column(String, nullable=False)
    master_pub_y = Column(String, nullable=False)
    
    bids = relationship("BidLedger", back_populates="auction")
    shares = relationship("EvaluatorShare", back_populates="auction")

class EvaluatorShare(Base):
    __tablename__ = "evaluator_shares"
    id = Column(Integer, primary_key=True, index=True)
    auction_id = Column(Integer, ForeignKey("auctions.id"))
    evaluator_name = Column(String, nullable=False)
    encrypted_share = Column(String, nullable=False) # The AES-encrypted Shamir share
    
    auction = relationship("Auction", back_populates="shares")

class BidLedger(Base):
    __tablename__ = "bids"
    id = Column(Integer, primary_key=True, index=True)
    auction_id = Column(Integer, ForeignKey("auctions.id"))
    signature = Column(String, nullable=False) 
    
    id_c1_x = Column(String, nullable=False)
    id_c1_y = Column(String, nullable=False)
    id_c2_x = Column(String, nullable=False)
    id_c2_y = Column(String, nullable=False)
    
    encrypted_c1_x = Column(String, nullable=False) 
    encrypted_c1_y = Column(String, nullable=False) 
    encrypted_c2_x = Column(String, nullable=False) 
    encrypted_c2_y = Column(String, nullable=False) 
    
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    previous_hash = Column(String, nullable=False, index=True) 
    current_hash = Column(String, unique=True, nullable=False, index=True)
    
    auction = relationship("Auction", back_populates="bids")