# CSePS: Cryptographic Sealed E-Procurement System

A highly secure, zero-knowledge e-procurement platform designed to ensure fair, tamper-proof, and completely confidential bidding. It uses a Client-Orchestrated Proxy architecture to separate data storage from cryptographic processing.

## 🛠️ Technologies Used

**Frontend (Client-Orchestrator UI)**
* React (TypeScript)
* Vite
* Tailwind CSS & Lucide Icons

**Main Ledger (Zero-Knowledge Storage)**
* FastAPI (Python)
* SQLite & SQLAlchemy
* SlowAPI (Rate Limiting)

**Stateless TTP Vault (Cryptography Engine)**
* FastAPI (Python)
* Elliptic Curve Cryptography (ECDSA NIST P-256)
* AES-GCM Authenticated Encryption
* Shamir’s Secret Sharing (Custom Polynomial Logic)
* SHA-256 Hashing

---

## 🛡️ Cyber Threats Addressed

This architecture was specifically engineered to mitigate the following critical security threats:

* **Insider Threats (Corrupt Admins/Evaluators)**
  * *Mitigation:* **Shamir's Secret Sharing**. A single rogue admin cannot access the bids. The master decryption key is split into 5 pieces, and a strict threshold of at least 3 evaluators must provide their passphrases simultaneously to reconstruct the key.
* **Database Breaches & Data Exfiltration**
  * *Mitigation:* **Zero-Knowledge Ledger**. The main database server only stores pure ciphertext and encrypted shares. Even if the database is completely compromised by a hacker, the plaintext bid amounts remain mathematically unreadable.
* **Data Tampering & Modification**
  * *Mitigation:* **Tamper-Evident Hashing**. Bids are committed to an append-only ledger where each new entry includes a SHA-256 hash of the previous entry, functioning like a localized blockchain. Any alteration to a past bid invalidates the entire chain.
* **Eavesdropping & Man-in-the-Middle (MitM)**
  * *Mitigation:* **Client-Orchestrated Proxy Pattern**. Plaintext bids are routed directly from the frontend to the stateless Trusted Third Party (TTP) Vault for encryption, completely bypassing the memory of the main ledger. 
* **Denial of Service (DoS) & Payload Injections**
  * *Mitigation:* **Strict Edge Validation**. Enforced via SlowAPI rate limiting (e.g., max 5 bids per minute per IP) and strict Pydantic schemas that block maliciously massive payloads from crashing the encryption engine.

---

## 🚀 Quick Start Guide

Because this architecture relies on cryptographically separating the storage from the mathematical processing, **you must run three separate local servers simultaneously using three separate terminal windows.**

### Prerequisites
* Python 3.10+
* Node.js & npm

---

### 🪟 Terminal 1: Start the TTP Vault
This is the stateless cryptography engine. It must be running on **Port 8001** for encryption and decryption to occur.

```bash
# 1. Open your first terminal and navigate to the project backend directory
cd cseps_project

# 2. Activate your virtual environment (Windows example)
venv\Scripts\activate

# 3. Start the Vault server
uvicorn ttp_vault.main:app --reload --port 8001
```

### 🪟 Terminal 2: Start the Zero-Knowledge Ledger
This is the main backend and database. It stores the ciphertext and public keys on Port 8000.

```bash
# 1. Open a SECOND terminal and navigate to the project backend directory
cd cseps_project

# 2. Activate your virtual environment
venv\Scripts\activate

# 3. Start the Ledger server
uvicorn app.main:app --reload --port 8000
```

### 🪟 Terminal 3: Start the React Frontend
This is the Client-Orchestrator UI. It runs on Port 3000.

```bash
# 1. Open a THIRD terminal and navigate to the frontend directory
cd frontend

# 2. Install the necessary node modules (only needed the first time)
npm install

# 3. Start the development server
npm run dev
```
