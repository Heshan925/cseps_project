from pydantic import BaseModel

class BidSubmit(BaseModel):
    """Payload for bidders submitting a pure ECC encrypted bid."""
    bidder_public_key: str
    signature: str
    encrypted_c1_x: str
    encrypted_c1_y: str
    encrypted_c2_x: str
    encrypted_c2_y: str

class DecryptRequest(BaseModel):
    """Payload for evaluators opening the bids using Shamir shares."""
    shares: list[str]