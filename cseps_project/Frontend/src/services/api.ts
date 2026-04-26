// API service stubs — perfectly synced with FastAPI Ledger and TTP Vault
const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:8000";
const VAULT_BASE = "http://localhost:8001"; // Added the Vault URL

// ---------------------------------------------------------
// 1. CUSTOM ERROR HANDLING
// ---------------------------------------------------------

// Custom error class so we can pass the HTTP status code to the UI
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// The UI translator function you will import into your React components
export const getFriendlyErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    
    // 1. Try to extract the exact error message from FastAPI's JSON response
    try {
      const parsedError = JSON.parse(error.message);
      if (parsedError.detail) {
        // If it's a simple string (like your custom 403 deadline error)
        if (typeof parsedError.detail === 'string') {
          return parsedError.detail; 
        } 
        // If it's an array (like Pydantic form validation errors)
        else if (Array.isArray(parsedError.detail)) {
          return "Form error: " + parsedError.detail[0].msg;
        }
      }
    } catch (e) {
      // If the error message isn't JSON, we just ignore this and fall back to the defaults below
    }

    // 2. Fallback default messages if the backend didn't provide a custom "detail" string
    switch (error.status) {
      case 429:
        return "You are submitting requests too quickly. For security, please wait a moment.";
      case 422:
        return "There is an issue with your form data. Please double-check your entries.";
      case 403:
        return "Action forbidden. You do not have permission.";
      case 400:
        return "Vault Error: Action failed. Please ensure passphrases or data are correct.";
      default:
        return `An unexpected server error occurred (Code: ${error.status}).`;
    }
  }
  
  // If it's a network error (server is down, CORS, etc.)
  return "Our secure server is temporarily unreachable. Please check your connection.";
};

// ---------------------------------------------------------
// 2. INTERFACES
// ---------------------------------------------------------

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

// ---------------------------------------------------------
// 3. MAIN LEDGER REQUESTS (PORT 8000)
// ---------------------------------------------------------

// Default request helper for the Main Ledger
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  
  if (!res.ok) {
    const errText = await res.text();
    // Use our custom error class here!
    throw new ApiError(res.status, errText);
  }
  return res.json() as Promise<T>;
}

export const fetchAuctions = () => request<Auction[]>("/auctions");

export const fetchAuctionShares = (id: number) =>
  request<Array<{ name: string; encrypted_share: string }>>(`/auctions/${id}/shares`);

export const createAuction = (payload: unknown) =>
  request("/create_auction", { method: "POST", body: JSON.stringify(payload) });

export const submitSecureBid = (payload: BidPayload) =>
  request("/submit_bid", { method: "POST", body: JSON.stringify(payload) });

export const openLedger = (
  id: number,
  payload: { shares: string[]; passwords: string[] }
) =>
  request<{ bids_opened: number; results: Array<{ ledger_id: number; decrypted_id: string; decrypted_amount: string }> }>(
    `/open_bids/${id}`,
    { method: "POST", body: JSON.stringify(payload) }
  );

export const fetchAuctionKeys = (id: number) =>
  request<{ master_pub_x: string; master_pub_y: string }>(`/auctions/${id}/keys`);


// ---------------------------------------------------------
// 4. VAULT PROXY REQUESTS (PORT 8001)
// ---------------------------------------------------------

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
    // Use our custom error class here too!
    throw new ApiError(res.status, errText);
  }
  
  return res.json();
};

export const generateVaultKeys = async (passwords: string[]) => {
  const res = await fetch(`${VAULT_BASE}/generate_auction_keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passwords })
  });
  
  if (!res.ok) {
    const errText = await res.text();
    // Use our custom error class here too!
    throw new ApiError(res.status, errText);
  }
  return res.json();
};