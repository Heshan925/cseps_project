from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import hashlib
from fastapi.middleware.cors import CORSMiddleware

# Import from your local vault files
from crypto_service import generate_ecc_keypair, decrypt_bid_ecc, encrypt_bid_ecc, curve, ec
from threshold_service import split_private_key, encrypt_share_aes, reconstruct_private_key

app = FastAPI(title="CSePS Custom Hardware Security Module (HSM)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Schemas ---
class KeyGenRequest(BaseModel):
    passwords: List[str]

class EncryptBidRequest(BaseModel):
    auction_pub_x: str
    auction_pub_y: str
    amount: float
    bidder_id: int
    auction_id: int

class DecryptBidsRequest(BaseModel):
    encrypted_shares: List[str]
    passwords: List[str]
    encrypted_bids: List[Dict[str, Any]]


# --- Endpoints ---

# 1. ORCHESTRATOR PHASE 1: Key Generation
@app.post("/generate_auction_keys")
def generate_auction_keys(req: KeyGenRequest):
    if len(req.passwords) != 5:
        raise HTTPException(status_code=400, detail="Exactly 5 passwords required.")
    
    # Generate Master Key & Split
    master_priv, master_pub = generate_ecc_keypair()
    raw_shares = split_private_key(master_priv, threshold=3, total_shares=5)
    
    # AES Encrypt the shares
    encrypted_shares = []
    for i in range(5):
        enc_share = encrypt_share_aes(raw_shares[i], req.passwords[i])
        encrypted_shares.append(enc_share)
        
    return {
        "master_pub_x": str(master_pub.x),
        "master_pub_y": str(master_pub.y),
        "encrypted_shares": encrypted_shares
    }

# 2. ORCHESTRATOR PHASE 2: Bidding (Stateless Encryption)
@app.post("/simulate_encryption")
def simulate_encryption(req: EncryptBidRequest):
    if req.amount <= 0 or req.bidder_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid bid parameters.")

    # Reconstruct the specific auction's public key passed from React
    auction_pub_key = ec.Point(curve, int(req.auction_pub_x), int(req.auction_pub_y))
    
    C1_amt, C2_amt = encrypt_bid_ecc(auction_pub_key, int(req.amount))
    C1_id, C2_id = encrypt_bid_ecc(auction_pub_key, req.bidder_id)
    
    # Mocking secure signatures for the ledger commit
    b_hash = hashlib.sha256(f"{req.auction_id}_{req.bidder_id}".encode('utf-8')).hexdigest()
    raw_signature_data = f"BIDDER:{req.bidder_id}_AMOUNT:{int(req.amount)}_AUCTION:{req.auction_id}"
    simulated_private_key = f"SECRET_KEY_FOR_BIDDER_{req.bidder_id}"
    raw_signature = hashlib.sha256(f"{simulated_private_key}_{raw_signature_data}".encode('utf-8')).hexdigest()
    encrypted_inner_signature = encrypt_share_aes(raw_signature, req.auction_pub_x)

    return {
        "bidder_hash": b_hash,
        "signature": encrypted_inner_signature, 
        "id_c1_x": str(C1_id.x), "id_c1_y": str(C1_id.y),
        "id_c2_x": str(C2_id.x), "id_c2_y": str(C2_id.y),
        "encrypted_c1_x": str(C1_amt.x), "encrypted_c1_y": str(C1_amt.y),
        "encrypted_c2_x": str(C2_amt.x), "encrypted_c2_y": str(C2_amt.y)
    }

# 3. ORCHESTRATOR PHASE 3: Decryption
@app.post("/unlock_and_decrypt")
def unlock_and_decrypt(req: DecryptBidsRequest):
    if len(req.encrypted_shares) < 3 or len(req.passwords) < 3:
        raise HTTPException(status_code=400, detail="Minimum 3 shares/passwords required.")
        
    try:
        # Prevent math overflow by explicitly grabbing exactly 3 shares
        shares_to_use = req.encrypted_shares[:3]
        passwords_to_use = req.passwords[:3]
        
        # Reconstruct Private Key
        master_priv = reconstruct_private_key(shares_to_use, passwords_to_use)
        
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
                    "decrypted_amount": f"${amt:,}" # Formatted nicely
                })
            except Exception:
                decrypted_results.append({
                    "ledger_id": bid["ledger_id"], "error": "Decryption failed.", "decrypted_amount": "N/A"
                })
                
        return {"decrypted_bids": decrypted_results}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Vault Crash Reason: {str(e)}")