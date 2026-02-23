import secrets

# The group order (n) of the SECP256R1 curve.
# ECC private keys operate inside this specific finite field.
CURVE_ORDER = 115792089210356248762697446949407573529996955224135760342422259061068512044369

def split_private_key(private_key_int: int, threshold: int, total_shares: int) -> list:
    """
    Splits the key into polynomial shares over the curve's finite field.
    """
    # 1. Generate random polynomial coefficients
    # The secret key is the y-intercept (coefficient for x^0)
    coeffs = [private_key_int] + [secrets.randbelow(CURVE_ORDER) for _ in range(threshold - 1)]
    shares = []
    
    # 2. Evaluate the polynomial at points x = 1, 2, ..., total_shares
    for x in range(1, total_shares + 1):
        y = sum(c * pow(x, i, CURVE_ORDER) for i, c in enumerate(coeffs)) % CURVE_ORDER
        shares.append(f"{x}-{y}") 
        
    return shares

def reconstruct_private_key(provided_shares: list) -> int:
    """
    Reconstructs the key using Lagrange Interpolation over the finite field.
    """
    shares = []
    for share in provided_shares:
        x_str, y_str = share.split('-')
        shares.append((int(x_str), int(y_str)))
        
    secret = 0
    
    # Perform Lagrange interpolation mathematically at x = 0 to find the secret intercept
    for i, (x_i, y_i) in enumerate(shares):
        numerator = 1
        denominator = 1
        for j, (x_j, _) in enumerate(shares):
            if i != j:
                numerator = (numerator * (-x_j)) % CURVE_ORDER
                denominator = (denominator * (x_i - x_j)) % CURVE_ORDER
        
        # Modular inverse using Fermat's Little Theorem
        inv_denominator = pow(denominator, CURVE_ORDER - 2, CURVE_ORDER)
        lagrange_poly = (y_i * numerator * inv_denominator) % CURVE_ORDER
        secret = (secret + lagrange_poly) % CURVE_ORDER
        
    return secret

# --- Testing the Pure Math Threshold Decryption ---
if __name__ == "__main__":
    print("1. Generating a dummy Evaluator Master Private Key...")
    # A valid key that is strictly less than the CURVE_ORDER
    original_master_key = 115792089210356248762697446949407573529996955224135760342422259061068512040000
    print(f"   Original Key: {str(original_master_key)[:15]}... (truncated)")

    print("\n2. Splitting the key for 5 Evaluators (Minimum 3 needed to open bids)...")
    all_shares = split_private_key(original_master_key, threshold=3, total_shares=5)
    
    for i, share in enumerate(all_shares, 1):
        print(f"   Evaluator {i} receives share: {share[:15]}...")

    print("\n3. Bidding Deadline Passes! Evaluators 1, 3, and 5 gather to open the bids.")
    gathered_shares = [all_shares[0], all_shares[2], all_shares[4]]
    
    print("4. Reconstructing the Master Key using Lagrange Interpolation...")
    reconstructed_key = reconstruct_private_key(gathered_shares)
    
    if original_master_key == reconstructed_key:
        print(f"   Reconstructed Key: {str(reconstructed_key)[:15]}... (truncated)")
        print("\n✅ SUCCESS: The custom mathematical threshold decryption works perfectly!")
    else:
        print("\n❌ FAILURE: Keys do not match.")