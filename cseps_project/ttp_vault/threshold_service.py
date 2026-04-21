import secrets
import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

CURVE_ORDER = 115792089210356248762697446949407573529996955224135760342422259061068512044369

def encrypt_share_aes(raw_share: str, password: str) -> str:
    """Derives a key using PBKDF2 and encrypts the share using AES-256-GCM."""
    salt = os.urandom(16)
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=100000)
    key = kdf.derive(password.encode())
    
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, raw_share.encode(), None)
    
    # Pack the components together so the frontend can unpack them
    return f"{base64.b64encode(salt).decode()}.{base64.b64encode(nonce).decode()}.{base64.b64encode(ciphertext).decode()}"

# --- NEW FUNCTION: To unlock the AES strings before the math ---
def decrypt_share_aes(encrypted_share_str: str, password: str) -> str:
    parts = encrypted_share_str.split('.')
    if len(parts) != 3:
        raise ValueError("Share is not formatted as salt.nonce.ciphertext")
        
    salt = base64.b64decode(parts[0])
    nonce = base64.b64decode(parts[1])  
    ciphertext = base64.b64decode(parts[2])

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(), 
        length=32, 
        salt=salt, 
        iterations=100000, 
        backend=default_backend()
    )
    key = kdf.derive(password.encode('utf-8'))

    aesgcm = AESGCM(key)
    decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
    return decrypted_bytes.decode('utf-8')

def split_private_key(private_key_int: int, threshold: int, total_shares: int) -> list:
    coeffs = [private_key_int] + [secrets.randbelow(CURVE_ORDER) for _ in range(threshold - 1)]
    shares = []
    
    for x in range(1, total_shares + 1):
        y = sum(c * pow(x, i, CURVE_ORDER) for i, c in enumerate(coeffs)) % CURVE_ORDER
        y_bytes = y.to_bytes(32, byteorder='big')
        encoded_y = base64.urlsafe_b64encode(y_bytes).decode('utf-8').rstrip('=')
        shares.append(f"{x}-{encoded_y}") 
    return shares

# --- UPDATED FUNCTION: Accepts passwords and decrypts first! ---
def reconstruct_private_key(encrypted_shares: list, passwords: list) -> int:
    shares = []
    
    # 1. Decrypt AES wrapper to get back the "1-base64..." strings
    for i in range(len(encrypted_shares)):
        raw_share = decrypt_share_aes(encrypted_shares[i], passwords[i])
        
        x_str, encoded_y = raw_share.split('-', 1)
        padding = '=' * (4 - (len(encoded_y) % 4))
        y_bytes = base64.urlsafe_b64decode(encoded_y + padding)
        y_int = int.from_bytes(y_bytes, byteorder='big')
        shares.append((int(x_str), y_int))
        
    # 2. Your original Lagrange Math
    secret = 0
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