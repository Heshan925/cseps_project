from pydantic import BaseModel, Field
from datetime import datetime
from typing import List

class EvaluatorCreate(BaseModel):
    name: str = Field(..., max_length=100)
    password: str = Field(..., min_length=8, max_length=100)

class AuctionCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: str = Field(..., max_length=1000)
    deadline: datetime
    # DOS DEFENSE: Prevent an attacker from creating an auction with 100,000 evaluators
    evaluators: List[EvaluatorCreate] = Field(..., min_length=5, max_length=5)

class AuctionResponse(BaseModel):
    id: int
    title: str
    description: str
    deadline: datetime
    master_pub_x: str
    master_pub_y: str

class BidSubmit(BaseModel):
    auction_id: int = Field(..., gt=0)
    # A SHA-256 hash is ALWAYS exactly 64 characters. Reject anything else immediately.
    bidder_hash: str = Field(..., min_length=64, max_length=64)
    signature: str = Field(..., max_length=1000)
    
    # Cap ECC Coordinates to 100 chars to block massive string injections
    id_c1_x: str = Field(..., max_length=100)
    id_c1_y: str = Field(..., max_length=100)
    id_c2_x: str = Field(..., max_length=100)
    id_c2_y: str = Field(..., max_length=100)
    encrypted_c1_x: str = Field(..., max_length=100)
    encrypted_c1_y: str = Field(..., max_length=100)
    encrypted_c2_x: str = Field(..., max_length=100)
    encrypted_c2_y: str = Field(..., max_length=100)

class DecryptRequest(BaseModel):
    shares: List[str]
    passwords: List[str]

class LocalEncryptRequest(BaseModel):
    auction_id: int = Field(..., gt=0)
    amount: int = Field(..., gt=0, le=100000000000) 
    bidder_id: int = Field(..., gt=0, le=10000000)