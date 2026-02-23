from pydantic import BaseModel

class BidSubmit(BaseModel):
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
    shares: list[str]

class LocalEncryptRequest(BaseModel):
    amount: int
    bidder_id: int  # Added the ID so the simulator can encrypt it