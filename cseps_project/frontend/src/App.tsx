import { useState, useEffect } from 'react';
import { 
  submitSecureBid, simulateLocalEncryption, openLedger, 
  createAuction, fetchAuctions, fetchAuctionShares 
} from './services/api';
import type { BidPayload, Auction } from './services/api';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --navy-950: #050d1a; --navy-900: #0a1628; --navy-800: #0f2040;
    --slate-400: #94a3b8; --slate-300: #cbd5e1; --white: #ffffff;
    --emerald-400: #34d399; --blue-400: #60a5fa; --gold-400: #f59e0b;
    --border-subtle: rgba(255,255,255,0.07);
  }
  body { background: var(--navy-950); color: var(--white); font-family: 'DM Sans', sans-serif; }
  .app { display: grid; grid-template-columns: 280px 1fr; grid-template-rows: 64px 1fr; height: 100vh; overflow: hidden; }
  .topbar { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; padding: 0 2.5rem; background: var(--navy-900); border-bottom: 1px solid var(--border-subtle); }
  .sidebar { background: var(--navy-900); border-right: 1px solid var(--border-subtle); padding: 2rem 0; }
  .nav-item { display: flex; align-items: center; gap: 0.85rem; padding: 0.75rem 1.5rem; cursor: pointer; color: var(--slate-400); font-weight: 500; background: none; border: none; width: 100%; text-align: left; }
  .nav-item:hover { color: var(--white); background: rgba(255,255,255,0.04); }
  .nav-item.active { color: var(--white); background: rgba(255,255,255,0.08); border-left: 3px solid var(--blue-400); }
  .main { overflow-y: auto; padding: 2.5rem 3rem; }
  .card { background: var(--navy-900); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
  .input { width: 100%; padding: 0.75rem; background: var(--navy-800); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: white; font-family: inherit; margin-bottom: 1rem; }
  .btn { width: 100%; padding: 0.75rem; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; margin-top: 1rem; }
  .btn-blue { background: #2563eb; color: white; }
  .btn-green { background: #059669; color: white; }
  .btn-gold { background: #d97706; color: white; }
  select.input { appearance: none; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid var(--border-subtle); }
  th { color: var(--slate-400); font-size: 0.8rem; text-transform: uppercase; }
  .eval-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
`;

function App() {
  const [view, setView] = useState<'admin' | 'bidder' | 'evaluator'>('bidder');
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [statusMsg, setStatusMsg] = useState<string>("");

  // Admin State
  const [newAuction, setNewAuction] = useState({ title: '', description: '', deadline: '' });
  const [evaluators, setEvaluators] = useState(Array(5).fill({ name: '', password: '' }));

  // Bidder State
  const [bidAuctionId, setBidAuctionId] = useState<number | "">("");
  const [contractorId, setContractorId] = useState<number | "">("");
  const [bidAmount, setBidAmount] = useState<number | "">("");

  // Evaluator State
  const [evalAuctionId, setEvalAuctionId] = useState<number | "">("");
  const [fetchedShares, setFetchedShares] = useState<any[]>([]);
  const [passwords, setPasswords] = useState<string[]>(['', '', '', '', '']);
  const [decryptedBids, setDecryptedBids] = useState<any[]>([]);

  // Initialize
  useEffect(() => {
    loadAuctions();
  }, []);

  const loadAuctions = async () => {
    try { const data = await fetchAuctions(); setAuctions(data); } catch (e) { console.error("Failed to load auctions"); }
  };

  // --- ADMIN: Create Auction ---
  const handleCreateAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg("Generating ECC Keys and splitting Shamir Shares...");
    try {
      // Ensure the datetime is formatted as ISO for Python
      const payload = {
        ...newAuction,
        deadline: new Date(newAuction.deadline).toISOString(),
        evaluators: evaluators
      };
      await createAuction(payload);
      setStatusMsg("✅ Auction created successfully! ECC keys generated and encrypted.");
      setNewAuction({ title: '', description: '', deadline: '' });
      setEvaluators(Array(5).fill({ name: '', password: '' }));
      loadAuctions();
    } catch (err: any) {
      setStatusMsg("❌ Failed to create auction.");
    }
  };

  const updateEval = (index: number, field: string, value: string) => {
    const updated = [...evaluators];
    updated[index] = { ...updated[index], [field]: value };
    setEvaluators(updated);
  };

  // --- BIDDER: Submit Bid ---
  const handleBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bidAuctionId || !contractorId || !bidAmount) return;
    setStatusMsg("Encrypting Bid & Identity to selected Auction's Public Key...");
    try {
      const eccCoords = await simulateLocalEncryption(Number(bidAuctionId), Number(bidAmount), Number(contractorId));
      const payload: BidPayload = {
        auction_id: Number(bidAuctionId),
        signature: "valid_ecdsa_signature",
        ...eccCoords
      };
      await submitSecureBid(payload);
      setStatusMsg("✅ Bid securely submitted to ledger!");
      setBidAmount(""); setContractorId("");
    } catch { setStatusMsg("❌ Failed to submit bid."); }
  };

  // --- EVALUATOR: Fetch Shares & Decrypt ---
  useEffect(() => {
    if (evalAuctionId) {
      fetchAuctionShares(Number(evalAuctionId)).then(setFetchedShares).catch(console.error);
      setDecryptedBids([]);
      setPasswords(['', '', '', '', '']);
    } else { setFetchedShares([]); }
  }, [evalAuctionId]);

  const decryptShareAES = async (packedString: string, password: string): Promise<string> => {
    const [saltB64, nonceB64, cipherB64] = packedString.split('.');
    const b64ToUint8 = (str: string) => Uint8Array.from(atob(str), c => c.charCodeAt(0));
    const salt = b64ToUint8(saltB64); const nonce = b64ToUint8(nonceB64); const ciphertext = b64ToUint8(cipherB64);
    
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
    );
    const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ciphertext);
    return new TextDecoder().decode(decryptedBuffer);
  };

  const handleOpenBids = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalAuctionId) return;
    setStatusMsg("Transmitting encrypted shares and passwords to Secure Vault...");
    
    try {
      const selectedEncryptedShares: string[] = [];
      const selectedPasswords: string[] = [];

      // Gather the encrypted shares and passwords ONLY for the ones the user typed in
      for (let i = 0; i < 5; i++) {
        if (passwords[i].trim() !== '') {
          selectedEncryptedShares.push(fetchedShares[i].encrypted_share);
          selectedPasswords.push(passwords[i]);
        }
      }

      if (selectedPasswords.length < 3) {
        setStatusMsg("❌ Threshold not met. Provide at least 3 valid passwords.");
        return;
      }

      // Send EXACTLY what FastAPI is asking for!
      const payload = {
        shares: selectedEncryptedShares,
        passwords: selectedPasswords
      };

      const result = await openLedger(Number(evalAuctionId), payload);
      
      setStatusMsg(`✅ Ledger unlocked! Found ${result.bids_opened} bids.`);
      setDecryptedBids(result.results);
    } catch (error: any) {
      setStatusMsg(`❌ Server Error: ${error.response?.data?.detail || "Decryption failed"}`);
    }
  };

  return (
    <>
      <style>{styles}</style>
      
      <div className="app">
        <header className="topbar">
          <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>🏛️ CSePS E-Procurement Platform</div>
        </header>

        <aside className="sidebar">
          <button className={`nav-item ${view === 'bidder' ? 'active' : ''}`} onClick={() => {setView('bidder'); setStatusMsg("");}}>📝 Bidder Portal</button>
          <button className={`nav-item ${view === 'evaluator' ? 'active' : ''}`} onClick={() => {setView('evaluator'); setStatusMsg("");}}>🔐 Evaluator Panel</button>
          <button className={`nav-item ${view === 'admin' ? 'active' : ''}`} onClick={() => {setView('admin'); setStatusMsg("");}}>⚙️ Admin Dashboard</button>
        </aside>

        <main className="main">
          {statusMsg && <div style={{ padding: '1rem', background: 'var(--navy-800)', border: '1px solid var(--blue-400)', borderRadius: '4px', marginBottom: '1.5rem', color: 'var(--emerald-400)' }}>{statusMsg}</div>}

          {/* ADMIN VIEW */}
          {view === 'admin' && (
            <div className="card">
              <h2>Create New Cryptographic Auction</h2>
              <form onSubmit={handleCreateAuction} style={{ marginTop: '1.5rem' }}>
                <input type="text" className="input" placeholder="Auction Title (e.g. Highway Construction)" value={newAuction.title} onChange={e => setNewAuction({...newAuction, title: e.target.value})} required />
                <input type="text" className="input" placeholder="Description" value={newAuction.description} onChange={e => setNewAuction({...newAuction, description: e.target.value})} required />
                <input type="datetime-local" className="input" value={newAuction.deadline} onChange={e => setNewAuction({...newAuction, deadline: e.target.value})} required />
                
                <h3 style={{ marginTop: '1rem', marginBottom: '1rem' }}>Assign 5 Evaluators</h3>
                {evaluators.map((ev, i) => (
                  <div key={i} className="eval-row">
                    <input type="text" className="input" placeholder={`Evaluator ${i+1} Name`} value={ev.name} onChange={e => updateEval(i, 'name', e.target.value)} required />
                    <input type="password" className="input" placeholder="Set Password" value={ev.password} onChange={e => updateEval(i, 'password', e.target.value)} required />
                  </div>
                ))}
                <button type="submit" className="btn btn-gold">Initialize Auction & Generate Keys</button>
              </form>
            </div>
            
          )}
          
          
          

          {/* BIDDER VIEW */}
          {view === 'bidder' && (
            <div className="card">
              <h2>Submit a Sealed Bid</h2>
              <form onSubmit={handleBidSubmit} style={{ marginTop: '1.5rem' }}>
                <select className="input" value={bidAuctionId} onChange={e => setBidAuctionId(Number(e.target.value))} required>
                  <option value="">-- Select Active Auction --</option>
                  {auctions.map(a => <option key={a.id} value={a.id}>{a.title} (Deadline: {new Date(a.deadline).toLocaleString()})</option>)}
                </select>
                <input type="number" className="input" placeholder="Contractor ID" value={contractorId} onChange={e => setContractorId(e.target.value ? Number(e.target.value) : "")} required />
                <input type="number" className="input" placeholder="Bid Amount (USD)" value={bidAmount} onChange={e => setBidAmount(e.target.value ? Number(e.target.value) : "")} required />
                <button type="submit" className="btn btn-blue">Encrypt & Submit to Ledger</button>
              </form>
            </div>
          )}

          {/* EVALUATOR VIEW */}
          {view === 'evaluator' && (
            <div className="card">
              <h2>Unlock Sealed Ledger</h2>
              <select className="input" style={{ marginTop: '1.5rem' }} value={evalAuctionId} onChange={e => setEvalAuctionId(Number(e.target.value))} required>
                <option value="">-- Select Auction to Evaluate --</option>
                {auctions.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>

              {fetchedShares.length > 0 && (
                <form onSubmit={handleOpenBids} style={{ marginTop: '1.5rem' }}>
                  <p style={{ marginBottom: '1rem', color: 'var(--slate-400)' }}>Enter passwords for at least 3 evaluators to reconstruct the Master Key.</p>
                  {fetchedShares.map((share, i) => (
                    <div key={i} className="eval-row">
                      <div style={{ padding: '0.75rem', background: 'var(--navy-800)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>👤 {share.name}</div>
                      <input type="password" className="input" style={{ marginBottom: 0 }} placeholder="Password" value={passwords[i]} onChange={e => { const p = [...passwords]; p[i] = e.target.value; setPasswords(p); }} />
                    </div>
                  ))}
                  <button type="submit" className="btn btn-green">Reconstruct Key & Decrypt</button>
                </form>
              )}

              {decryptedBids.length > 0 && (
                <table style={{ marginTop: '2rem' }}>
                  <thead><tr><th>Ledger Block</th><th>Contractor Identity</th><th>Decrypted Bid Amount</th></tr></thead>
                  <tbody>
                    {decryptedBids.map((b, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--slate-400)' }}>#{b.ledger_id}</td>
                        <td style={{ fontFamily: 'monospace' }}>{b.decrypted_id}</td>
                        <td style={{ color: 'var(--emerald-400)', fontWeight: 'bold' }}>{b.decrypted_amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}


export default App;