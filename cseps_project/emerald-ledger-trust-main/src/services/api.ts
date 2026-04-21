// API service stubs — perfectly synced with FastAPI Ledger
const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:8000";

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

// 1. GET requests (These were already correct)
export const fetchAuctions = () => request<Auction[]>("/auctions");
export const fetchAuctionShares = (id: number) =>
  request<Array<{ name: string; encrypted_share: string }>>(`/auctions/${id}/shares`);

// 2. POST /create_auction (Fixed URL route)
export const createAuction = (payload: unknown) =>
  request("/create_auction", { method: "POST", body: JSON.stringify(payload) });

// 3. POST /submit_bid (This was already correct)
export const submitSecureBid = (payload: BidPayload) =>
  request("/submit_bid", { method: "POST", body: JSON.stringify(payload) });

// 4. POST /open_bids/{id} (Fixed URL route)
export const openLedger = (
  id: number,
  payload: { shares: string[]; passwords: string[] }
) =>
  request<{ bids_opened: number; results: Array<{ ledger_id: number; decrypted_id: string; decrypted_amount: string }> }>(
    `/open_bids/${id}`,
    { method: "POST", body: JSON.stringify(payload) }
  );

// 5. THE MAIN FIX: Ask the backend to do the heavy lifting!
export const simulateLocalEncryption = (
  auction_id: number,
  amount: number,
  bidder_id: number
) => {
  return request<any>("/simulate_local_encryption", {
    method: "POST",
    body: JSON.stringify({
      auction_id: auction_id,
      amount: amount,
      bidder_id: bidder_id
    })
  });
};