import secrets
import base64

CURVE_ORDER = 115792089210356248762697446949407573529996955224135760342422259061068512044369

def split_private_key(private_key_int: int, threshold: int, total_shares: int) -> list:
    """
    Splits the key into polynomial shares and encodes them into tight Base64 strings.
    """
    coeffs = [private_key_int] + [secrets.randbelow(CURVE_ORDER) for _ in range(threshold - 1)]
    shares = []
    
    for x in range(1, total_shares + 1):
        y = sum(c * pow(x, i, CURVE_ORDER) for i, c in enumerate(coeffs)) % CURVE_ORDER
        
        # 1. Convert the massive 256-bit integer (y) into exactly 32 raw bytes
        y_bytes = y.to_bytes(32, byteorder='big')
        
        # 2. Encode the 32 bytes to URL-safe Base64 and strip the trailing '=' padding for a cleaner look
        encoded_y = base64.urlsafe_b64encode(y_bytes).decode('utf-8').rstrip('=')
        
        # 3. Format as "Index-Base64String" (e.g., "1-A8f9Cb...")
        shares.append(f"{x}-{encoded_y}") 
        
    return shares

def reconstruct_private_key(provided_shares: list) -> int:
    """
    Decodes the Base64 strings back into integers and reconstructs the key via Lagrange Interpolation.
    """
    shares = []
    for share in provided_shares:
        x_str, encoded_y = share.split('-', 1)
        
        # 1. Add back the necessary Base64 padding ('=')
        padding = '=' * (4 - (len(encoded_y) % 4))
        
        # 2. Decode the Base64 string back into raw bytes
        y_bytes = base64.urlsafe_b64decode(encoded_y + padding)
        
        # 3. Convert the bytes back into our massive ECC integer
        y_int = int.from_bytes(y_bytes, byteorder='big')
        
        shares.append((int(x_str), y_int))
        
    secret = 0
    
    # Perform Lagrange interpolation
    for i, (x_i, y_i) in enumerate(shares):
        numerator = 1
        denominator = 1
        for j, (x_j, _) in enumerate(shares):
            if i != j:
                numerator = (numerator * (-x_j)) % CURVE_ORDER
                denominator = (denominator * (x_i - x_j)) % CURVE_ORDER
        
        inv_denominator = pow(denominator, CURVE_ORDER - 2, CURVE_ORDER)
        lagrange_poly = (y_i * numerator * inv_denominator) % CURVE_ORDER
        secret = (secret + lagrange_poly) % CURVE_ORDER
        
    return secret

# --- Testing the Base64 Threshold Decryption ---
if __name__ == "__main__":
    print("1. Generating Evaluator Master Private Key...")
    original_master_key = 115792089210356248762697446949407573529996955224135760342422259061068512040000
    
    print("\n2. Splitting the key into Base64 Shares...")
    all_shares = split_private_key(original_master_key, threshold=3, total_shares=5)
    
    for share in all_shares:
        print(f"   Share: {share}")

    print("\n3. Reconstructing the Master Key...")
    gathered_shares = [all_shares[0], all_shares[2], all_shares[4]]
    reconstructed_key = reconstruct_private_key(gathered_shares)
    
    if original_master_key == reconstructed_key:
        print("\n✅ SUCCESS: Base64 mathematical threshold decryption works perfectly!")
    else:
        print("\n❌ FAILURE: Keys do not match.")