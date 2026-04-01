import secrets
from tinyec import registry, ec

# Load the standard SECP256R1 curve
curve = registry.get_curve('secp256r1')

# ==========================================
# 1. KEY GENERATION
# ==========================================
def generate_ecc_keypair():
    """Generates a private integer and a public curve point."""
    private_key = secrets.randbelow(curve.field.n)
    public_key = private_key * curve.g
    return private_key, public_key

# ==========================================
# 2. KOBLITZ ENCODING (Map Bid to Curve)
# ==========================================
def modular_sqrt(a, p):
    """Finds the square root of a number in a finite field."""
    # Since secp256r1 prime p % 4 == 3, we can use Fermat's Little Theorem
    return pow(a, (p + 1) // 4, p)

def map_bid_to_point(bid_amount: int) -> ec.Point:
    """Embeds the numeric bid amount into an (X, Y) coordinate on the curve."""
    K = 1000  # Scaling factor
    p = curve.field.p
    
    # Try different offsets until we find a valid X coordinate that sits on the curve
    for j in range(K):
        x = (bid_amount * K + j) % p
        # Curve equation: y^2 = x^3 + a*x + b
        y_sq = (pow(x, 3, p) + curve.a * x + curve.b) % p
        
        # Check if y_sq has a valid square root (Euler's criterion)
        if pow(y_sq, (p - 1) // 2, p) == 1:
            y = modular_sqrt(y_sq, p)
            return ec.Point(curve, x, y)
            
    raise ValueError("Could not map the bid to a curve point.")

def unmap_point_to_bid(point: ec.Point) -> int:
    """Extracts the numeric bid from the curve coordinate."""
    K = 1000
    return point.x // K

# ==========================================
# 3. PURE ECC ENCRYPTION (EC-ElGamal)
# ==========================================
def encrypt_bid_ecc(public_key: ec.Point, bid_amount: int):
    """Encrypts the bid directly using pure EC-ElGamal."""
    # 1. Map the bid integer to a Point (Pm)
    Pm = map_bid_to_point(bid_amount)
    
    # 2. Choose a random ephemeral integer 'k'
    k = secrets.randbelow(curve.field.n)
    
    # 3. Calculate Ciphertext 1: C1 = k * Generator
    C1 = k * curve.g
    
    # 4. Calculate Ciphertext 2: C2 = Pm + (k * Public_Key)
    C2 = Pm + (k * public_key)
    
    return C1, C2

def decrypt_bid_ecc(private_key: int, C1: ec.Point, C2: ec.Point) -> int:
    """Decrypts the cipher points back to the original bid amount."""
    # 1. Calculate the shared mask: S = private_key * C1
    S = private_key * C1
    
    # 2. Negate the Y coordinate of S to allow subtraction
    S_neg = ec.Point(curve, S.x, -S.y % curve.field.p)
    
    # 3. Retrieve the mapped point: Pm = C2 - S
    Pm = C2 + S_neg
    
    # 4. Extract the integer bid from the point
    return unmap_point_to_bid(Pm)

# --- DEMO PROTOTYPE KEYS ---
# A static keypair so our web server doesn't lose the keys when it restarts
DEMO_MASTER_PRIVATE_KEY = 115792089210356248762697446949407573529996955224135760342422259061068512040000
DEMO_MASTER_PUBLIC_KEY = DEMO_MASTER_PRIVATE_KEY * curve.g

# --- Testing Pure ECC ---
if __name__ == "__main__":
    print("1. Generating Master Evaluator Keys...")
    master_priv, master_pub = generate_ecc_keypair()
    
    # The pure numeric bid
    original_bid = 1500000 
    print(f"\n2. Original Bid Amount: ${original_bid:,}")
    
    print("\n3. Bidders submits pure ECC Encrypted bid...")
    C1, C2 = encrypt_bid_ecc(master_pub, original_bid)
    
    print(f"   Encrypted C1 (X-coord): {C1.x}")
    print(f"   Encrypted C2 (X-coord): {C2.x}")
    
    print("\n4. Evaluators decrypt after deadline...")
    decrypted_bid = decrypt_bid_ecc(master_priv, C1, C2)
    print(f"   Decrypted Bid Amount: ${decrypted_bid:,}")
    
    assert original_bid == decrypted_bid
    print("\n✅ SUCCESS: Pure Direct ECC Encryption works perfectly!")