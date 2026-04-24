// API service stubs — perfectly synced with FastAPI Ledger and TTP Vault
const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:8000";
const VAULT_BASE = "http://localhost:8001"; // Added the Vault URL

export interface BidPayload {
  auction_id: number;
  signature: string;
  [k: string]: any; // Allows all the ECC coordinates to pass through
}

export interface Auction {
  id: number;
  title: string;
  description: string;
  deadline: string;
}

// Default request helper for the Main Ledger (Port 8000)
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API Error ${res.status}: ${errText}`);
  }
  return res.json() as Promise<T>;
}

// 1. GET requests (Ledger)
export const fetchAuctions = () => request<Auction[]>("/auctions");
export const fetchAuctionShares = (id: number) =>
  request<Array<{ name: string; encrypted_share: string }>>(`/auctions/${id}/shares`);

// 2. POST /create_auction (Ledger)
export const createAuction = (payload: unknown) =>
  request("/create_auction", { method: "POST", body: JSON.stringify(payload) });

// 3. POST /submit_bid (Ledger)
export const submitSecureBid = (payload: BidPayload) =>
  request("/submit_bid", { method: "POST", body: JSON.stringify(payload) });

// 4. POST /open_bids/{id} (Ledger)
export const openLedger = (
  id: number,
  payload: { shares: string[]; passwords: string[] }
) =>
  request<{ bids_opened: number; results: Array<{ ledger_id: number; decrypted_id: string; decrypted_amount: string }> }>(
    `/open_bids/${id}`,
    { method: "POST", body: JSON.stringify(payload) }
  );

// Add this right under your other GET requests
export const fetchAuctionKeys = (id: number) =>
  request<{ master_pub_x: string; master_pub_y: string }>(`/auctions/${id}/keys`);

// Update the Vault Proxy function to accept and forward the keys
export const simulateLocalEncryption = async (
  auction_id: number,
  amount: number,
  bidder_id: number,
  pub_x: string,
  pub_y: string
) => {
  const res = await fetch(`${VAULT_BASE}/simulate_encryption`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auction_id: auction_id,
      amount: amount,
      bidder_id: bidder_id,
      auction_pub_x: pub_x,   // Handing the Vault the keys!
      auction_pub_y: pub_y
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Vault API Error ${res.status}: ${errText}`);
  }
  
  return res.json();
};

// Sends passwords directly to the Vault (Port 8001) so the Ledger never sees them!
export const generateVaultKeys = async (passwords: string[]) => {
  const res = await fetch(`${VAULT_BASE}/generate_auction_keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passwords })
  });
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Vault Key Gen Error: ${errText}`);
  }
  return res.json();
};