import requests
import json
from app.services.crypto_service import generate_ecc_keypair, encrypt_bid_ecc
from app.services.threshold_service import split_private_key

BASE_URL = "http://127.0.0.1:8000"

def run_test():
    print("=== 1. SYSTEM SETUP ===")
    # Generate the System's Master Evaluator Keys
    master_priv, master_pub = generate_ecc_keypair()
    print("✅ Master Keys generated.")
    
    # Split the Master Private Key into 5 shares (need 3 to decrypt)
    shares = split_private_key(master_priv, threshold=3, total_shares=5)
    print("✅ Master Private Key split into 5 Shamir shares.")

    print("\n=== 2. BIDDER SUBMITS A BID ===")
    bid_amount = 2500000
    print(f"🔒 Bidder is mathematically encrypting proposal: ${bid_amount:,}")
    
    # Encrypt the bid amount using pure EC-ElGamal and the Master Public Key
    C1, C2 = encrypt_bid_ecc(master_pub, bid_amount)
    
    # Prepare the exact JSON payload the API expects
    submit_payload = {
        "bidder_public_key": "mock_bidder_key_8f7a9b",
        "signature": "mock_ecdsa_signature_string",
        "encrypted_c1_x": str(C1.x),
        "encrypted_c1_y": str(C1.y),
        "encrypted_c2_x": str(C2.x),
        "encrypted_c2_y": str(C2.y)
    }
    
    # Send the encrypted bid to the FastAPI server
    submit_response = requests.post(f"{BASE_URL}/submit_bid", json=submit_payload)
    print(f"📡 Server Response (Submit): {submit_response.json()}")

    print("\n=== 3. EVALUATORS OPEN THE BIDS ===")
    print("⏳ The bidding deadline has passed...")
    
    # Evaluators gather 3 out of their 5 shares to unlock the system
    gathered_shares = [shares[0], shares[2], shares[4]]
    print(f"🔑 Evaluators combined 3 shares to reconstruct the Master Key.")
    
    # Send the shares to the server to unlock the ledger
    unlock_payload = {
        "shares": gathered_shares
    }
    open_response = requests.post(f"{BASE_URL}/open_bids", json=unlock_payload)
    
    print("\n🎉 Server Response (Open Bids):")
    print(json.dumps(open_response.json(), indent=2))

if __name__ == "__main__":
    run_test()