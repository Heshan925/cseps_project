import axios from 'axios';

// Configure Axios to point to your FastAPI server
const api = axios.create({
    baseURL: 'http://127.0.0.1:8000',
    headers: {
        'Content-Type': 'application/json',
    },
});

// --- INTERFACES ---
export interface BidPayload {
    signature: string;
    id_c1_x: string;
    id_c1_y: string;
    id_c2_x: string;
    id_c2_y: string;
    encrypted_c1_x: string;
    encrypted_c1_y: string;
    encrypted_c2_x: string;
    encrypted_c2_y: string;
}

export interface DecryptPayload {
    shares: string[];
}

// --- API CALLS ---
export const submitSecureBid = async (payload: BidPayload) => {
    const response = await api.post('/submit_bid', payload);
    return response.data;
};

export const simulateLocalEncryption = async (amount: number, bidder_id: number) => {
    const response = await api.post('/simulate_local_encryption', { amount, bidder_id });
    return response.data;
};

export const openLedger = async (payload: DecryptPayload) => {
    const response = await api.post('/open_bids', payload);
    return response.data;
};