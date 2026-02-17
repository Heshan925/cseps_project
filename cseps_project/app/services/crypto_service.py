from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization, hashes

def generate_ecc_keypair():
    """Generates an ECC private and public key pair."""
    private_key = ec.generate_private_key(ec.SECP384R1())
    public_key = private_key.public_key()

    pem_private_key = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    pem_public_key = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return pem_private_key, pem_public_key


def sign_bid(pem_private_key: bytes, bid_data: str) -> bytes:
    """
    Signs the bid document using the bidder's private key.
    This guarantees non-repudiation.
    """
    # 1. Load the private key from the PEM format
    private_key = serialization.load_pem_private_key(
        pem_private_key, 
        password=None
    )
    
    # 2. Generate the signature using ECDSA and SHA256 hashing
    signature = private_key.sign(
        bid_data.encode('utf-8'),
        ec.ECDSA(hashes.SHA256())
    )
    return signature


def verify_signature(pem_public_key: bytes, bid_data: str, signature: bytes) -> bool:
    """
    Verifies that the bid was signed by the owner of the public key 
    and hasn't been tampered with.
    """
    # 1. Load the public key from the PEM format
    public_key = serialization.load_pem_public_key(pem_public_key)
    
    try:
        # 2. Attempt to verify. If the data or signature is bad, this throws an error.
        public_key.verify(
            signature,
            bid_data.encode('utf-8'),
            ec.ECDSA(hashes.SHA256())
        )
        return True # Signature is valid!
    except Exception:
        return False # Signature is invalid/tampered!


# --- Testing the Digital Signatures ---
if __name__ == "__main__":
    print("1. Generating Bidder Keys...")
    bidder_priv, bidder_pub = generate_ecc_keypair()
    
    # The proposal the bidder wants to submit
    proposal = "I bid $50,000 to build the government database."
    print(f"2. Original Proposal: '{proposal}'")
    
    print("3. Bidder signs the proposal...")
    digital_signature = sign_bid(bidder_priv, proposal)
    print(f"   Signature generated: {digital_signature[:15]}... (truncated)")
    
    print("4. Server verifies the signature...")
    is_valid = verify_signature(bidder_pub, proposal, digital_signature)
    print(f"   Is the signature valid? -> {is_valid}")
    
    print("5. Hacker attempts to tamper with the bid...")
    tampered_proposal = "I bid $999,000 to build the government database."
    is_valid_tampered = verify_signature(bidder_pub, tampered_proposal, digital_signature)
    print(f"   Is the tampered signature valid? -> {is_valid_tampered}")