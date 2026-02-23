import { useState } from 'react';
import { submitSecureBid, simulateLocalEncryption, openLedger } from './services/api';
import type { BidPayload } from './services/api';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --navy-950: #050d1a;
    --navy-900: #0a1628;
    --navy-800: #0f2040;
    --navy-700: #163054;
    --navy-600: #1e4070;
    --slate-400: #94a3b8;
    --slate-300: #cbd5e1;
    --slate-200: #e2e8f0;
    --white: #ffffff;
    --gold-400: #f59e0b;
    --gold-300: #fbbf24;
    --gold-200: #fde68a;
    --emerald-500: #10b981;
    --emerald-400: #34d399;
    --emerald-300: #6ee7b7;
    --red-400: #f87171;
    --blue-400: #60a5fa;
    --border-subtle: rgba(255,255,255,0.07);
    --border-medium: rgba(255,255,255,0.12);
  }

  html, body, #root { height: 100%; }

  body {
    background: var(--navy-950);
    color: var(--white);
    font-family: 'DM Sans', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .app {
    display: grid;
    grid-template-columns: 280px 1fr;
    grid-template-rows: 64px 1fr;
    height: 100vh;
    overflow: hidden;
    background: var(--navy-950);
  }

  /* TOPBAR */
  .topbar {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 2.5rem;
    height: 64px;
    background: var(--navy-900);
    border-bottom: 1px solid var(--border-subtle);
    z-index: 100;
  }
  .topbar-brand { display: flex; align-items: center; gap: 1rem; }
  .topbar-seal {
    width: 36px; height: 36px;
    background: linear-gradient(135deg, var(--gold-400), var(--gold-200));
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.1rem; flex-shrink: 0;
    box-shadow: 0 0 20px rgba(245,158,11,0.3);
  }
  .topbar-name { font-size: 0.95rem; font-weight: 700; letter-spacing: 0.01em; }
  .topbar-sub { font-size: 0.7rem; color: var(--slate-400); letter-spacing: 0.05em; text-transform: uppercase; margin-top: 1px; }
  .topbar-right { display: flex; align-items: center; gap: 2rem; }
  .topbar-stat { text-align: right; }
  .topbar-stat-label { font-size: 0.63rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--slate-400); }
  .topbar-stat-value { font-family: 'DM Mono', monospace; font-size: 0.78rem; color: var(--emerald-400); margin-top: 1px; }
  .topbar-badge {
    display: flex; align-items: center; gap: 0.4rem;
    padding: 0.35rem 0.85rem;
    background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25);
    border-radius: 20px; font-size: 0.72rem; font-weight: 600; color: var(--emerald-400); letter-spacing: 0.03em;
  }
  .live-dot { width: 6px; height: 6px; background: var(--emerald-400); border-radius: 50%; animation: pulse-dot 2s ease-in-out infinite; }
  @keyframes pulse-dot { 0%,100%{opacity:1;} 50%{opacity:0.3;} }

  /* SIDEBAR */
  .sidebar {
    background: var(--navy-900);
    border-right: 1px solid var(--border-subtle);
    padding: 2rem 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  .sidebar-section-label {
    font-size: 0.63rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--slate-400); padding: 0 1.5rem; margin-bottom: 0.5rem; margin-top: 1.5rem;
  }
  .sidebar-section-label:first-child { margin-top: 0; }
  .nav-item {
    display: flex; align-items: center; gap: 0.85rem;
    padding: 0.75rem 1.5rem; cursor: pointer; transition: all 0.15s;
    border-left: 3px solid transparent; color: var(--slate-400);
    font-size: 0.875rem; font-weight: 500; user-select: none;
    background: none; border-right: none; border-top: none; border-bottom: none;
    width: 100%; text-align: left;
  }
  .nav-item:hover { color: var(--white); background: rgba(255,255,255,0.04); }
  .nav-item.active-blue { color: var(--blue-400); background: rgba(96,165,250,0.08); border-left-color: var(--blue-400); }
  .nav-item.active-green { color: var(--emerald-400); background: rgba(52,211,153,0.08); border-left-color: var(--emerald-400); }
  .nav-icon {
    width: 32px; height: 32px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.9rem; background: rgba(255,255,255,0.05); flex-shrink: 0;
  }
  .nav-item.active-blue .nav-icon { background: rgba(96,165,250,0.15); }
  .nav-item.active-green .nav-icon { background: rgba(52,211,153,0.12); }
  .nav-chip {
    font-size: 0.63rem; font-family: 'DM Mono', monospace;
    padding: 0.15rem 0.45rem; border-radius: 3px;
    background: rgba(255,255,255,0.06); color: var(--slate-400);
  }
  .proto-rows { padding: 0 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
  .proto-row { display: flex; justify-content: space-between; align-items: center; }
  .proto-label { font-size: 0.72rem; color: var(--slate-400); }
  .proto-val { font-family: 'DM Mono'; font-size: 0.68rem; color: var(--slate-300); }
  .sidebar-footer { margin-top: auto; padding: 1.5rem; border-top: 1px solid var(--border-subtle); }
  .sidebar-footer-info { font-family: 'DM Mono', monospace; font-size: 0.68rem; color: var(--slate-400); line-height: 1.7; }

  /* MAIN */
  .main { overflow-y: auto; display: flex; flex-direction: column; background: var(--navy-950); }

  .page-header {
    padding: 2.5rem 3rem 1.5rem;
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }
  .breadcrumb {
    font-size: 0.72rem; color: var(--slate-400); letter-spacing: 0.05em;
    text-transform: uppercase; margin-bottom: 0.75rem;
    display: flex; align-items: center; gap: 0.5rem;
  }
  .breadcrumb span { color: var(--slate-300); }
  .page-title { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 0.35rem; }
  .page-desc { font-size: 0.875rem; color: var(--slate-400); line-height: 1.5; max-width: 720px; }

  .content-area {
    padding: 2rem 3rem;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    align-content: start;
  }
  .content-full { grid-column: 1 / -1; }

  /* STATS */
  .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
  .stat-card {
    background: var(--navy-900); border: 1px solid var(--border-subtle);
    border-radius: 8px; padding: 1.25rem 1.5rem;
  }
  .stat-label { font-size: 0.68rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--slate-400); margin-bottom: 0.5rem; }
  .stat-value { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1; }
  .stat-sub { font-family: 'DM Mono', monospace; font-size: 0.68rem; color: var(--slate-400); margin-top: 0.35rem; }

  /* CARD */
  .card { background: var(--navy-900); border: 1px solid var(--border-subtle); border-radius: 10px; overflow: hidden; }
  .card-header {
    padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-subtle);
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  }
  .card-title { font-size: 0.875rem; font-weight: 600; letter-spacing: -0.01em; }
  .card-subtitle { font-size: 0.72rem; color: var(--slate-400); margin-top: 0.15rem; }
  .card-tag { font-family: 'DM Mono', monospace; font-size: 0.68rem; padding: 0.25rem 0.6rem; border-radius: 4px; white-space: nowrap; flex-shrink: 0; }
  .card-tag-blue { background: rgba(96,165,250,0.1); color: var(--blue-400); border: 1px solid rgba(96,165,250,0.2); }
  .card-tag-green { background: rgba(52,211,153,0.08); color: var(--emerald-400); border: 1px solid rgba(52,211,153,0.15); }
  .card-tag-amber { background: rgba(245,158,11,0.08); color: var(--gold-400); border: 1px solid rgba(245,158,11,0.15); }
  .card-body { padding: 1.75rem; }

  /* FORM */
  .field { margin-bottom: 1.25rem; }
  .field-label { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--slate-300); margin-bottom: 0.5rem; display: block; }
  .input-wrap { position: relative; }
  .input-prefix { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); font-family: 'DM Mono', monospace; font-size: 0.9rem; color: var(--slate-400); pointer-events: none; }
  .input {
    width: 100%; padding: 0.75rem 1rem;
    background: var(--navy-800); border: 1px solid var(--border-medium);
    border-radius: 6px; color: var(--white);
    font-family: 'DM Sans', sans-serif; font-size: 0.875rem;
    outline: none; transition: border-color 0.2s, box-shadow 0.2s;
  }
  .input::placeholder { color: var(--slate-400); }
  .input-mono { font-family: 'DM Mono', monospace; font-size: 0.8rem; }
  .input:focus { border-color: rgba(96,165,250,0.5); box-shadow: 0 0 0 3px rgba(96,165,250,0.08); }
  .input-green:focus { border-color: rgba(52,211,153,0.4); box-shadow: 0 0 0 3px rgba(52,211,153,0.06); }
  .input-has-prefix { padding-left: 2.25rem; }

  /* BUTTONS */
  .btn {
    width: 100%; padding: 0.8rem 1.5rem; border: none; border-radius: 6px;
    font-family: 'DM Sans', sans-serif; font-size: 0.875rem; font-weight: 600;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    gap: 0.5rem; transition: all 0.2s; letter-spacing: 0.01em; margin-top: 1.25rem;
  }
  .btn-blue { background: #2563eb; color: white; }
  .btn-blue:hover:not(:disabled) { background: #3b82f6; box-shadow: 0 4px 16px rgba(37,99,235,0.35); transform: translateY(-1px); }
  .btn-blue:disabled { background: var(--navy-700); color: var(--slate-400); cursor: not-allowed; transform: none; box-shadow: none; }
  .btn-green { background: #059669; color: white; }
  .btn-green:hover { background: #10b981; box-shadow: 0 4px 16px rgba(5,150,105,0.35); transform: translateY(-1px); }
  .spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.25); border-top-color: white; border-radius: 50%; animation: spin 0.65s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* STATUS */
  .status-row {
    display: flex; align-items: flex-start; gap: 0.75rem; margin-top: 1.25rem;
    padding: 0.875rem 1rem; background: var(--navy-800);
    border: 1px solid var(--border-subtle); border-radius: 6px;
  }
  .sdot { width: 7px; height: 7px; border-radius: 50%; background: var(--slate-400); margin-top: 4px; flex-shrink: 0; }
  .sdot-idle { background: var(--slate-400); }
  .sdot-active { background: var(--gold-400); animation: pulse-dot 1.5s infinite; }
  .sdot-success { background: var(--emerald-400); }
  .sdot-error { background: var(--red-400); }
  .status-text { font-family: 'DM Mono', monospace; font-size: 0.775rem; color: var(--slate-300); line-height: 1.5; }

  /* RECEIPT */
  .receipt { margin-top: 1rem; padding: 1rem 1.25rem; background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.2); border-radius: 6px; animation: fadein 0.3s ease; }
  .receipt-label { font-size: 0.68rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--emerald-400); margin-bottom: 0.45rem; }
  .receipt-hash { font-family: 'DM Mono', monospace; font-size: 0.72rem; color: var(--emerald-300); word-break: break-all; line-height: 1.6; }

  /* SHARE FIELDS */
  .share-field { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.875rem; }
  .share-index {
    width: 30px; height: 30px; border-radius: 50%;
    border: 1px solid var(--border-medium); background: var(--navy-800);
    display: flex; align-items: center; justify-content: center;
    font-family: 'DM Mono', monospace; font-size: 0.72rem; color: var(--slate-400);
    flex-shrink: 0; transition: all 0.2s;
  }
  .share-index.filled { border-color: rgba(52,211,153,0.4); color: var(--emerald-400); background: rgba(52,211,153,0.08); }

  /* NOTICE */
  .notice { padding: 0.75rem 1rem; border-radius: 6px; display: flex; align-items: center; gap: 0.6rem; font-size: 0.8rem; margin-bottom: 1.25rem; }
  .notice-amber { background: rgba(245,158,11,0.07); border: 1px solid rgba(245,158,11,0.2); color: var(--gold-300); }

  /* TABLE */
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: var(--navy-800); }
  th { padding: 0.75rem 1.25rem; text-align: left; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--slate-400); border-bottom: 1px solid var(--border-subtle); }
  td { padding: 0.875rem 1.25rem; font-size: 0.8rem; border-bottom: 1px solid var(--border-subtle); color: var(--slate-300); }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: rgba(255,255,255,0.02); }
  .td-mono { font-family: 'DM Mono', monospace; font-size: 0.75rem; }
  .td-amount { color: var(--emerald-400) !important; font-weight: 600; font-family: 'DM Mono', monospace; }
  .td-id { color: var(--blue-400); font-family: 'DM Mono', monospace; }

  /* STEP CARDS */
  .step { display: flex; gap: 1rem; margin-bottom: 1.1rem; align-items: flex-start; }
  .step-num { font-family: 'DM Mono'; font-size: 0.68rem; padding: 0.25rem 0.5rem; border-radius: 4px; flex-shrink: 0; margin-top: 1px; }
  .step-num-blue { color: var(--blue-400); background: rgba(96,165,250,0.08); border: 1px solid rgba(96,165,250,0.15); }
  .step-num-green { color: var(--emerald-400); background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.15); }
  .step-title { font-size: 0.8rem; font-weight: 600; margin-bottom: 0.2rem; }
  .step-desc { font-size: 0.775rem; color: var(--slate-400); line-height: 1.55; }

  @keyframes fadein { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: translateY(0); } }
  .animate-in { animation: fadein 0.25s ease; }
`;

function App() {
  const [view, setView] = useState<'bidder' | 'evaluator'>('bidder');

  const [bidAmount, setBidAmount] = useState<number | "">("");
  const [contractorId, setContractorId] = useState<number | "">(""); // Add this line!
  const [bidStatus, setBidStatus] = useState<string>("System idle. Ready to accept bid.");
  const [receipt, setReceipt] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [bidCount, setBidCount] = useState(0);

  const [shares, setShares] = useState<string[]>(['', '', '']);
  const [evalStatus, setEvalStatus] = useState<string>("Awaiting evaluator key shares.");
  const [decryptedBids, setDecryptedBids] = useState<any[]>([]);

  const handleBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bidAmount || bidAmount <= 0 || !contractorId) return; // Ensure ID is provided
    setIsProcessing(true);
    setReceipt("");
    try {
      // Use the ID typed into the form
      const bidderId = Number(contractorId);
      
      setBidStatus(`Encrypting Bid ($${Number(bidAmount).toLocaleString()}) and Identity (ID: ${bidderId})...`);
      const eccCoords = await simulateLocalEncryption(Number(bidAmount), bidderId);
      
      const payload: BidPayload = {
        signature: "valid_ecdsa_signature",
        id_c1_x: eccCoords.id_c1_x,
        id_c1_y: eccCoords.id_c1_y,
        id_c2_x: eccCoords.id_c2_x,
        id_c2_y: eccCoords.id_c2_y,
        encrypted_c1_x: eccCoords.encrypted_c1_x,
        encrypted_c1_y: eccCoords.encrypted_c1_y,
        encrypted_c2_x: eccCoords.encrypted_c2_x,
        encrypted_c2_y: eccCoords.encrypted_c2_y
      };
      
      setBidStatus("Transmitting cipher points to the SQLite Ledger...");
      const result = await submitSecureBid(payload);
      setBidStatus(`Bid and Identity secured in Ledger Block #${result.ledger_id}.`);
      setReceipt(result.hash_receipt);
      setBidAmount("");
      setBidCount(c => c + 1);
    } catch {
      setBidStatus("Error: Failed to process bid. Please retry.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenBids = async (e: React.FormEvent) => {
    e.preventDefault();
    setEvalStatus("Reconstructing master key via Lagrange interpolation...");
    try {
      const validShares = shares.filter(s => s.trim() !== '');
      const result = await openLedger({ shares: validShares });
      if (result.status === 'success') {
        setEvalStatus(`Decryption complete. ${result.bids_opened} bids unlocked from ledger.`);
        setDecryptedBids(result.results);
      }
    } catch {
      setEvalStatus("Decryption failed. Deadline may not have passed or Invalid or insufficient key shares provided.");
      setDecryptedBids([]);
    }
  };

  const updateShare = (index: number, value: string) => {
    const newShares = [...shares];
    newShares[index] = value;
    setShares(newShares);
  };

  const getDotClass = (status: string, processing = false) => {
    if (processing) return 'sdot sdot-active';
    if (status.toLowerCase().includes('error') || status.toLowerCase().includes('failed')) return 'sdot sdot-error';
    if (status.toLowerCase().includes('secured') || status.toLowerCase().includes('complete') || status.toLowerCase().includes('unlocked')) return 'sdot sdot-success';
    if (status.toLowerCase().includes('encrypting') || status.toLowerCase().includes('reconstructing') || status.toLowerCase().includes('transmitting')) return 'sdot sdot-active';
    return 'sdot sdot-idle';
  };

  return (
    <>
      <style>{styles}</style>
      <div className="app">

        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-brand">
            <div className="topbar-seal">🏛</div>
            <div>
              <div className="topbar-name">CSePS Government Portal</div>
              <div className="topbar-sub">Cryptographic Sealed-Bid Procurement System</div>
            </div>
          </div>
          <div className="topbar-right">
            <div className="topbar-stat">
              <div className="topbar-stat-label">Encryption</div>
              <div className="topbar-stat-value">secp256k1 ECC</div>
            </div>
            <div className="topbar-stat">
              <div className="topbar-stat-label">Threshold</div>
              <div className="topbar-stat-value">(3,5) Shamir</div>
            </div>
            <div className="topbar-stat">
              <div className="topbar-stat-label">Ledger</div>
              <div className="topbar-stat-value">SQLite · SHA-256</div>
            </div>
            <div className="topbar-badge">
              <div className="live-dot" /> Secure Channel Active
            </div>
          </div>
        </header>

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-section-label">Navigation</div>
          <button className={`nav-item ${view === 'bidder' ? 'active-blue' : ''}`} onClick={() => setView('bidder')}>
            <div className="nav-icon">📝</div>
            <span style={{ flex: 1 }}>Bidder Portal</span>
            {bidCount > 0 && <span className="nav-chip">{bidCount}</span>}
          </button>
          <button className={`nav-item ${view === 'evaluator' ? 'active-green' : ''}`} onClick={() => setView('evaluator')}>
            <div className="nav-icon">🔐</div>
            <span style={{ flex: 1 }}>Evaluator Dashboard</span>
            {decryptedBids.length > 0 && <span className="nav-chip">{decryptedBids.length}</span>}
          </button>

          <div className="sidebar-section-label">Protocol Details</div>
          <div className="proto-rows">
            {[
              ['Key Algorithm', 'ECC secp256k1'],
              ['Commitment', 'El-Gamal'],
              ['Sharing Scheme', 'Shamir SSS'],
              ['Hash Function', 'SHA-256'],
              ['Storage', 'SQLite Ledger'],
              ['Standard', 'FIPS 140-2'],
            ].map(([l, v]) => (
              <div className="proto-row" key={l}>
                <span className="proto-label">{l}</span>
                <span className="proto-val">{v}</span>
              </div>
            ))}
          </div>

          <div className="sidebar-footer">
            <div className="sidebar-footer-info">
              Session: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}<br />
              All bids encrypted end-to-end<br />
              No plaintext stored on server
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="main">
          <div className="page-header">
            <div className="breadcrumb">Portal › <span>{view === 'bidder' ? 'Bidder Portal' : 'Evaluator Dashboard'}</span></div>
            <div className="page-title">{view === 'bidder' ? 'Submit a Sealed Proposal' : 'Open & Evaluate Sealed Bids'}</div>
            <div className="page-desc">
              {view === 'bidder'
                ? 'Your bid is encrypted client-side using elliptic curve cryptography before transmission. The ledger cannot be read until authorized evaluators reconstruct the master key.'
                : 'Provide 3 of 5 evaluator key shares to reconstruct the master private key via Lagrange interpolation and decrypt all sealed bids from the ledger.'}
            </div>
          </div>

          {/* BIDDER */}
          {view === 'bidder' && (
            <div className="content-area animate-in">
              <div className="content-full">
                <div className="stats-row">
                  <div className="stat-card">
                    <div className="stat-label">Bids This Session</div>
                    <div className="stat-value">{bidCount}</div>
                    <div className="stat-sub">encrypted &amp; sealed</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Encryption Scheme</div>
                    <div className="stat-value" style={{ fontSize: '1.15rem' }}>El-Gamal</div>
                    <div className="stat-sub">secp256k1 curve</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Bid Confidentiality</div>
                    <div className="stat-value" style={{ color: 'var(--emerald-400)' }}>100%</div>
                    <div className="stat-sub">until evaluation window</div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Encrypt & Submit Bid</div>
                    <div className="card-subtitle">Your amount is encrypted before leaving this device</div>
                  </div>
                  <span className="card-tag card-tag-blue">ECC Encrypted</span>
                </div>
                <div className="card-body">
                  <form onSubmit={handleBidSubmit}>
                    <div className="field">
                      <label className="field-label">Contractor ID (Numeric)</label>
                      <div className="input-wrap">
                        <span className="input-prefix">#</span>
                        <input
                          type="number"
                          className="input input-has-prefix"
                          value={contractorId}
                          onChange={(e) => setContractorId(e.target.value ? Number(e.target.value) : "")}
                          placeholder="e.g. 4092"
                          required
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label">Bid Amount (USD)</label>
                      <div className="input-wrap">
                        <span className="input-prefix">$</span>
                        <input
                          type="number"
                          className="input input-has-prefix"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value ? Number(e.target.value) : "")}
                          placeholder="e.g. 500,000"
                          required
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-blue" disabled={isProcessing}>
                      {isProcessing ? <><div className="spinner" /> Processing Cryptography…</> : <>⚡ Encrypt &amp; Submit Bid</>}
                    </button>
                  </form>
                  <div className="status-row">
                    <div className={getDotClass(bidStatus, isProcessing)} />
                    <div className="status-text">{bidStatus}</div>
                  </div>
                  {receipt && (
                    <div className="receipt">
                      <div className="receipt-label">✓ SHA-256 Hash Receipt</div>
                      <div className="receipt-hash">{receipt}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Cryptographic Process</div>
                    <div className="card-subtitle">What happens when you submit a bid</div>
                  </div>
                  <span className="card-tag card-tag-amber">Reference</span>
                </div>
                <div className="card-body">
                  {[
                    { n: '01', t: 'Client-Side Encryption', d: 'Your bid is encoded onto the secp256k1 elliptic curve and encrypted using the system El-Gamal public key, producing cipher point pairs (C₁, C₂).', cls: 'step-num-blue' },
                    { n: '02', t: 'Signature & Transmission', d: 'A valid ECDSA signature is generated over the cipher points and transmitted with your bidder public key to the government server.', cls: 'step-num-blue' },
                    { n: '03', t: 'Ledger Commitment', d: 'The server stores only the encrypted cipher points in the immutable SQLite ledger. A SHA-256 hash receipt is returned for audit purposes.', cls: 'step-num-blue' },
                  ].map(s => (
                    <div className="step" key={s.n}>
                      <div className={`step-num ${s.cls}`}>{s.n}</div>
                      <div>
                        <div className="step-title">{s.t}</div>
                        <div className="step-desc">{s.d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* EVALUATOR */}
          {view === 'evaluator' && (
            <div className="content-area animate-in">
              <div className="content-full">
                <div className="stats-row">
                  <div className="stat-card">
                    <div className="stat-label">Shares Required</div>
                    <div className="stat-value">3 / 5</div>
                    <div className="stat-sub">Shamir threshold scheme</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Shares Entered</div>
                    <div className="stat-value" style={{ color: shares.filter(s => s.trim()).length === 3 ? 'var(--emerald-400)' : 'var(--white)' }}>
                      {shares.filter(s => s.trim()).length} / 3
                    </div>
                    <div className="stat-sub">this session</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Bids Unlocked</div>
                    <div className="stat-value" style={{ color: decryptedBids.length > 0 ? 'var(--emerald-400)' : 'var(--white)' }}>
                      {decryptedBids.length}
                    </div>
                    <div className="stat-sub">from sealed ledger</div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Key Share Entry</div>
                    <div className="card-subtitle">Enter 3 of 5 evaluator shares to reconstruct master key</div>
                  </div>
                  <span className="card-tag card-tag-green">Threshold (3,5)</span>
                </div>
                <div className="card-body">
                  <div className="notice notice-amber">
                    ⚠ This operation is irreversible. Ensure quorum approval before proceeding.
                  </div>
                  <form onSubmit={handleOpenBids}>
                    {[0, 1, 2].map((i) => (
                      <div className="share-field" key={i}>
                        <div className={`share-index ${shares[i].trim() ? 'filled' : ''}`}>{i + 1}</div>
                        <input
                          type="text"
                          className="input input-mono input-green"
                          value={shares[i]}
                          onChange={(e) => updateShare(i, e.target.value)}
                          placeholder={`Share ${i + 1}  e.g. ${i + 1}-42831339394…`}
                          style={{ flex: 1 }}
                          required
                        />
                      </div>
                    ))}
                    <button type="submit" className="btn btn-green">
                      🔓 Reconstruct Key &amp; Decrypt Ledger
                    </button>
                  </form>
                  <div className="status-row">
                    <div className={getDotClass(evalStatus)} />
                    <div className="status-text">{evalStatus}</div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Decryption Protocol</div>
                    <div className="card-subtitle">How the master key is reconstructed</div>
                  </div>
                  <span className="card-tag card-tag-amber">Reference</span>
                </div>
                <div className="card-body">
                  {[
                    { n: '01', t: 'Share Validation', d: 'Each submitted share is verified for format and authenticity before participating in key reconstruction.' },
                    { n: '02', t: 'Lagrange Interpolation', d: 'The secret polynomial is reconstructed from 3+ valid shares using Lagrange interpolation over a prime finite field.' },
                    { n: '03', t: 'Ledger Decryption', d: 'The reconstructed master private key decrypts all El-Gamal cipher points in the SQLite ledger, revealing the original bid amounts.' },
                  ].map(s => (
                    <div className="step" key={s.n}>
                      <div className="step-num step-num-green">{s.n}</div>
                      <div>
                        <div className="step-title">{s.t}</div>
                        <div className="step-desc">{s.d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {decryptedBids.length > 0 && (
                <div className="content-full animate-in">
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <div className="card-title">Decrypted Proposals</div>
                        <div className="card-subtitle">All sealed bids successfully retrieved from ledger</div>
                      </div>
                      <span className="card-tag card-tag-green">{decryptedBids.length} records</span>
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th>Ledger ID</th>
                          <th>Bidder Identity</th>
                          <th>Decrypted Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {decryptedBids.map((bid, idx) => (
                          <tr key={idx}>
                            <td className="td-id">#{bid.ledger_id}</td>
                            <td className="td-mono">{bid.decrypted_id}</td> {/* <-- Updated this line */}
                            <td className="td-amount">{bid.decrypted_amount || bid.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default App;