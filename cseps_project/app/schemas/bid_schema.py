from pydantic import BaseModel
from datetime import datetime
from typing import List

class EvaluatorCreate(BaseModel):
    name: str
    password: str

class AuctionCreate(BaseModel):
    title: str
    description: str
    deadline: datetime
    evaluators: List[EvaluatorCreate] # We will require exactly 5

class AuctionResponse(BaseModel):
    id: int
    title: str
    description: str
    deadline: datetime
    master_pub_x: str
    master_pub_y: str

class BidSubmit(BaseModel):
    auction_id: int
    signature: str
    id_c1_x: str
    id_c1_y: str
    id_c2_x: str
    id_c2_y: str
    encrypted_c1_x: str
    encrypted_c1_y: str
    encrypted_c2_x: str
    encrypted_c2_y: str

class DecryptRequest(BaseModel):
    shares: List[str]

class LocalEncryptRequest(BaseModel):
    auction_id: int
    amount: int
    bidder_id: int