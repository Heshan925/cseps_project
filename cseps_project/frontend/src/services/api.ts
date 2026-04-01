import axios from 'axios';

const api = axios.create({
    baseURL: 'http://127.0.0.1:8000',
    headers: { 'Content-Type': 'application/json' },
});

// --- INTERFACES ---
export interface EvaluatorCreate {
    name: string;
    password: string;
}

export interface AuctionCreate {
    title: string;
    description: string;
    deadline: string;
    evaluators: EvaluatorCreate[];
}

export interface Auction {
    id: number;
    title: string;
    description: string;
    deadline: string;
    master_pub_x: string;
    master_pub_y: string;
}

export interface BidPayload {
    auction_id: number;
    signature: string;
    id_c1_x: string; id_c1_y: string;
    id_c2_x: string; id_c2_y: string;
    encrypted_c1_x: string; encrypted_c1_y: string;
    encrypted_c2_x: string; encrypted_c2_y: string;
}

export interface DecryptPayload {
    shares: string[];
}

// --- API CALLS ---
export const createAuction = async (payload: AuctionCreate) => {
    const response = await api.post('/create_auction', payload);
    return response.data;
};

export const fetchAuctions = async (): Promise<Auction[]> => {
    const response = await api.get('/auctions');
    return response.data;
};

export const fetchAuctionShares = async (auctionId: number) => {
    const response = await api.get(`/auctions/${auctionId}/shares`);
    return response.data;
};

export const simulateLocalEncryption = async (auction_id: number, amount: number, bidder_id: number) => {
    const response = await api.post('/simulate_local_encryption', { auction_id, amount, bidder_id });
    return response.data;
};

export const submitSecureBid = async (payload: BidPayload) => {
    const response = await api.post('/submit_bid', payload);
    return response.data;
};

export const openLedger = async (auction_id: number, payload: DecryptPayload) => {
    const response = await api.post(`/open_bids/${auction_id}`, payload);
    return response.data;
};