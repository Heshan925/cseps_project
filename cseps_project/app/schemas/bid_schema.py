from pydantic import BaseModel

class BidSubmit(BaseModel):
    """The exact JSON payload a bidder sends to the server."""
    bidder_public_key: str
    signature: str
    encrypted_c1_x: str
    encrypted_c2_x: str