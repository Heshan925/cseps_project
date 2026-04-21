from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
# Import from your local vault files!
from crypto_service import generate_ecc_keypair, decrypt_bid_ecc, encrypt_bid_ecc, curve, ec
from threshold_service import split_private_key, encrypt_share_aes, reconstruct_private_key
import hashlib

app = FastAPI(title="CSePS Custom Hardware Security Module (HSM)")

# --- Schemas ---
class KeyGenRequest(BaseModel):
    passwords: List[str]

class DecryptBidsRequest(BaseModel):
    encrypted_shares: List[str]
    passwords: List[str]
    encrypted_bids: List[Dict[str, Any]] # List of dicts containing C1/C2 coordinates

# --- Endpoints ---
@app.post("/generate_keys")
def generate_keys(req: KeyGenRequest):
    if len(req.passwords) != 5:
        raise HTTPException(status_code=400, detail="Exactly 5 passwords required.")
    
    # 1. Generate the Master ECC Key
    master_priv, master_pub = generate_ecc_keypair()
    
    # 2. Split with Shamir's Secret Sharing
    raw_shares = split_private_key(master_priv, threshold=3, total_shares=5)
    
    # 3. AES Encrypt the shares
    encrypted_shares = []
    for i in range(5):
        enc_share = encrypt_share_aes(raw_shares[i], req.passwords[i])
        encrypted_shares.append(enc_share)
        
    # The Private Key is now destroyed from RAM. Return only safe data!
    return {
        "master_pub_x": str(master_pub.x),
        "master_pub_y": str(master_pub.y),
        "encrypted_shares": encrypted_shares
    }

@app.post("/unlock_and_decrypt")
def unlock_and_decrypt(req: DecryptBidsRequest):
    if len(req.encrypted_shares) < 3 or len(req.passwords) < 3:
        raise HTTPException(status_code=400, detail="Exactly 3 shares/passwords required.")
        
    try:
        # 1. Reconstruct Private Key
        # Note: You will need to slightly adjust your reconstruct_private_key function 
        # to accept the raw string list and password list we are sending it.
        master_priv = reconstruct_private_key(req.encrypted_shares, req.passwords)
        
        # 2. Decrypt all bids locally in the vault
        decrypted_results = []
        for bid in req.encrypted_bids:
            try:
                C1_amt = ec.Point(curve, int(bid["encrypted_c1_x"]), int(bid["encrypted_c1_y"]))
                C2_amt = ec.Point(curve, int(bid["encrypted_c2_x"]), int(bid["encrypted_c2_y"]))
                amt = decrypt_bid_ecc(master_priv, C1_amt, C2_amt)
                
                C1_id = ec.Point(curve, int(bid["id_c1_x"]), int(bid["id_c1_y"]))
                C2_id = ec.Point(curve, int(bid["id_c2_x"]), int(bid["id_c2_y"]))
                bidder_id = decrypt_bid_ecc(master_priv, C1_id, C2_id)
                
                decrypted_results.append({
                    "ledger_id": bid["ledger_id"],
                    "decrypted_id": f"Contractor-{bidder_id}", 
                    "raw_amount": amt
                })
            except Exception:
                decrypted_results.append({
                    "ledger_id": bid["ledger_id"], "error": "Decryption failed.", "raw_amount": float('inf')
                })
                
        return {"decrypted_bids": decrypted_results}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Vault Crash Reason: {str(e)}")    


# --- Add this new schema to your Schemas section ---
class EncryptBidRequest(BaseModel):
    auction_pub_x: str
    auction_pub_y: str
    amount: float
    bidder_id: int
    auction_id: int

# --- Add this endpoint to the bottom of the file ---
@app.post("/simulate_encryption")
def simulate_encryption(req: EncryptBidRequest):
    if req.amount <= 0 or req.bidder_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid bid parameters.")

    # Reconstruct the specific auction's public key
    auction_pub_key = ec.Point(curve, int(req.auction_pub_x), int(req.auction_pub_y))
    
    # --- ADD int() AROUND req.amount HERE ---
    C1_amt, C2_amt = encrypt_bid_ecc(auction_pub_key, int(req.amount))
    C1_id, C2_id = encrypt_bid_ecc(auction_pub_key, req.bidder_id)
    
    b_hash = hashlib.sha256(f"{req.auction_id}_{req.bidder_id}".encode('utf-8')).hexdigest()

    # --- ADD int() AROUND req.amount HERE TOO ---
    raw_signature_data = f"BIDDER:{req.bidder_id}_AMOUNT:{int(req.amount)}_AUCTION:{req.auction_id}"
    
    simulated_private_key = f"SECRET_KEY_FOR_BIDDER_{req.bidder_id}"
    raw_signature = hashlib.sha256(f"{simulated_private_key}_{raw_signature_data}".encode('utf-8')).hexdigest()

    # Encrypt the signature using the Auction's Master Public Key X-coordinate
    encrypted_inner_signature = encrypt_share_aes(raw_signature, req.auction_pub_x)

    return {
        "bidder_hash": b_hash,
        "signature": encrypted_inner_signature, 
        "id_c1_x": str(C1_id.x), "id_c1_y": str(C1_id.y),
        "id_c2_x": str(C2_id.x), "id_c2_y": str(C2_id.y),
        "encrypted_c1_x": str(C1_amt.x), "encrypted_c1_y": str(C1_amt.y),
        "encrypted_c2_x": str(C2_amt.x), "encrypted_c2_y": str(C2_amt.y)
    }