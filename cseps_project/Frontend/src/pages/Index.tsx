import { useState, useEffect } from "react";
import {
  submitSecureBid,
  simulateLocalEncryption,
  openLedger,
  createAuction,
  fetchAuctions,
  fetchAuctionShares,
  fetchAuctionKeys,
  generateVaultKeys
} from "@/services/api";
import type { BidPayload, Auction } from "@/services/api";
import {
  Shield,
  KeyRound,
  Gavel,
  Settings2,
  Lock,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  FileLock2,
  Users,
  Clock,
} from "lucide-react";

type View = "admin" | "bidder" | "evaluator";

interface Share { name: string; encrypted_share: string }
interface DecryptedBid { ledger_id: number; decrypted_id: string; decrypted_amount: string }

const Index = () => {
  const [view, setView] = useState<View>("bidder");
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // Admin
  const [newAuction, setNewAuction] = useState({ title: "", description: "", deadline: "" });
  const [evaluators, setEvaluators] = useState(
    Array.from({ length: 5 }, () => ({ name: "", password: "" }))
  );

  // Bidder
  const [bidAuctionId, setBidAuctionId] = useState<number | "">("");
  const [contractorId, setContractorId] = useState<number | "">("");
  const [bidAmount, setBidAmount] = useState<number | "">("");

  // Evaluator
  const [evalAuctionId, setEvalAuctionId] = useState<number | "">("");
  const [fetchedShares, setFetchedShares] = useState<Share[]>([]);
  const [passwords, setPasswords] = useState<string[]>(["", "", "", "", ""]);
  const [decryptedBids, setDecryptedBids] = useState<DecryptedBid[]>([]);

  useEffect(() => {
    document.title = "CSePS — Cryptographic Sealed E-Procurement";
    loadAuctions();
  }, []);

  const loadAuctions = async () => {
    try {
      const data = await fetchAuctions();
      setAuctions(data);
    } catch {
      console.error("Failed to load auctions");
    }
  };

  // ---- ADMIN ----
  const handleCreateAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    
    try {
      // 1. Extract just the passwords from the UI state
      const passwords = evaluators.map((ev) => ev.password);

      // 2. TTP Proxy: Send passwords straight to Vault to get the math done
      setStatusMsg("Vault generating keys & encrypting ...");
      const vaultData = await generateVaultKeys(passwords);

      // 3. Assemble the perfectly secure payload for the Ledger
      setStatusMsg("Committing encrypted data to the Ledger...");
      const ledgerPayload = {
        title: newAuction.title,
        description: newAuction.description,
        deadline: new Date(newAuction.deadline).toISOString(),
        master_pub_x: vaultData.master_pub_x,
        master_pub_y: vaultData.master_pub_y,
        evaluators: evaluators.map((ev, index) => ({
          name: ev.name,
          encrypted_share: vaultData.encrypted_shares[index],
        })),
      };

      // 4. Send the encrypted payload to the Ledger
      await createAuction(ledgerPayload);

      setStatusMsg("✅ Auction created. Ledger is completely blind to passwords and private keys.");
      setNewAuction({ title: "", description: "", deadline: "" });
      setEvaluators(Array.from({ length: 5 }, () => ({ name: "", password: "" })));
      loadAuctions();
    } catch (err: any) {
      setStatusMsg(`❌ Failed to create auction: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const updateEval = (index: number, field: "name" | "password", value: string) => {
    const updated = [...evaluators];
    updated[index] = { ...updated[index], [field]: value };
    setEvaluators(updated);
  };

  // ---- BIDDER ----
  const handleBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bidAuctionId || !contractorId || !bidAmount) return;
    setBusy(true);
    
    try {
      // Step 1: Get the Public Keys from the Ledger (Port 8000)
      setStatusMsg("Fetching Auction Public Keys from Ledger...");
      const keys = await fetchAuctionKeys(Number(bidAuctionId));

      // Step 2: Send Plaintext + Keys to the Vault (Port 8001)
      setStatusMsg("Vault encrypting bid using ECC Public Key...");
      const eccCoords = await simulateLocalEncryption(
        Number(bidAuctionId),
        Number(bidAmount),
        Number(contractorId),
        keys.master_pub_x,
        keys.master_pub_y
      );

      // Step 3: Submit pure ciphertext to the Ledger (Port 8000)
      setStatusMsg("Committing ciphertext to the immutable ledger...");
      const payload: BidPayload = {
        auction_id: Number(bidAuctionId),
        signature: "valid_ecdsa_signature",
        ...eccCoords,
      };
      await submitSecureBid(payload);
      
      setStatusMsg("✅ Bid securely submitted to the ledger.");
      setBidAmount("");
      setContractorId("");
    } catch (err: any) {
      setStatusMsg(`❌ Failed to submit bid: ${err.message || "Unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  // ---- EVALUATOR ----
  useEffect(() => {
    if (evalAuctionId) {
      fetchAuctionShares(Number(evalAuctionId)).then(setFetchedShares).catch(console.error);
      setDecryptedBids([]);
      setPasswords(["", "", "", "", ""]);
    } else {
      setFetchedShares([]);
    }
  }, [evalAuctionId]);

  const handleOpenBids = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalAuctionId) return;
    setBusy(true);
    setStatusMsg("Transmitting encrypted shares and passwords to the secure vault…");
    try {
      const selectedEncryptedShares: string[] = [];
      const selectedPasswords: string[] = [];
      for (let i = 0; i < 5; i++) {
        if (passwords[i].trim() !== "") {
          selectedEncryptedShares.push(fetchedShares[i].encrypted_share);
          selectedPasswords.push(passwords[i]);
        }
      }
      if (selectedPasswords.length < 3) {
        setStatusMsg("❌ Provide at least 3 valid passwords.");
        setBusy(false);
        return;
      }
      const payload = { shares: selectedEncryptedShares, passwords: selectedPasswords };
      const result = await openLedger(Number(evalAuctionId), payload);
      setStatusMsg(`✅ Ledger unlocked. Found ${result.bids_opened} bids.`);
      setDecryptedBids(result.results);
    } catch {
      setStatusMsg(`❌ Decryption failed.`);
    } finally {
      setBusy(false);
    }
  };

  const navItems: { id: View; label: string; icon: React.ReactNode; hint: string }[] = [
    { id: "bidder", label: "Bidder Portal", icon: <Gavel className="h-4 w-4" />, hint: "Submit sealed bids" },
    { id: "evaluator", label: "Evaluator Panel", icon: <KeyRound className="h-4 w-4" />, hint: "Reconstruct & open" },
    { id: "admin", label: "Admin Dashboard", icon: <Settings2 className="h-4 w-4" />, hint: "Create auctions" },
  ];

  const isOk = statusMsg.startsWith("✅");
  const isErr = statusMsg.startsWith("❌");

  return (
    <div className="min-h-screen text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-white text-primary-foreground shadow-[var(--shadow-elegant)] overflow-hidden">
              <img 
                src="/logo.png" 
                alt="CSePS Logo" 
                className="h-full w-full object-cover" 
              />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">
                CSePS <span className="text-muted-foreground font-normal">·</span>{" "}
                <span className="text-gradient-primary">E-Procurement</span>
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Cryptographic Sealed Bidding
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              Ledger online
            </span>
            
          </div>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 md:grid-cols-[260px_1fr]">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 grid-bg" />

        {/* Sidebar */}
        <aside className="md:sticky md:top-24 md:self-start">
          <nav className="glass-card rounded-xl p-2">
            {navItems.map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setView(item.id);
                    setStatusMsg("");
                  }}
                  className={[
                    "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-[var(--transition-base)]",
                    active
                      ? "bg-secondary text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "grid h-7 w-7 place-items-center rounded-md border",
                      active
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-background/40 text-muted-foreground group-hover:text-foreground",
                    ].join(" ")}
                  >
                    {item.icon}
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium">{item.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{item.hint}</span>
                  </span>
                  {active && <Sparkles className="h-3.5 w-3.5 text-primary" />}
                </button>
              );
            })}
          </nav>

          <div className="glass-card mt-4 rounded-xl p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Security guarantees
            </div>
            {/* Changed space-y-1.5 to space-y-3 for more vertical gap */}
            <ul className="space-y-3 text-xs text-muted-foreground">
              <li className="flex gap-2"><span className="text-accent">●</span> Locked instantly upon submission</li>
              <li className="flex gap-2"><span className="text-primary">●</span> Requires team consensus to open</li>
              <li className="flex gap-2"><span className="text-gold">●</span> Impossible to secretly alter</li>
            </ul>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0">
          {statusMsg && (
            <div
              className={[
                "mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm animate-slide-up",
                isOk
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : isErr
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-primary/30 bg-primary/10 text-primary",
              ].join(" ")}
            >
              {isOk ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : isErr ? (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              )}
              <p className="font-mono text-xs leading-5">{statusMsg}</p>
            </div>
          )}

          {/* ADMIN VIEW */}
          {view === "admin" && (
            <section className="animate-fade-in">
              <SectionHeader
                eyebrow="Admin"
                title="Create a new cryptographic auction"
                description="Initialize an auction."
                icon={<Settings2 className="h-5 w-5" />}
              />

              <form onSubmit={handleCreateAuction} className="glass-card rounded-2xl p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Auction title">
                    <input
                      className={inputCls}
                      placeholder="e.g. Highway Resurfacing — Sector 12"
                      value={newAuction.title}
                      onChange={(e) => setNewAuction({ ...newAuction, title: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Bid deadline">
                    <input
                      type="datetime-local"
                      className={inputCls}
                      value={newAuction.deadline}
                      onChange={(e) => setNewAuction({ ...newAuction, deadline: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Description" className="md:col-span-2">
                    <textarea
                      className={`${inputCls} min-h-[88px] resize-y`}
                      placeholder="Scope of work, eligibility, deliverables…"
                      value={newAuction.description}
                      onChange={(e) => setNewAuction({ ...newAuction, description: e.target.value })}
                      required
                    />
                  </Field>
                </div>

                <div className="my-6 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> Assign 5 evaluators
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                <div className="grid gap-3">
                  {evaluators.map((ev, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-1 items-center gap-3 rounded-xl border border-border bg-surface-1 p-3 md:grid-cols-[40px_1fr_1fr]"
                    >
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-xs font-mono text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <input
                        className={inputCls}
                        placeholder={`Evaluator ${i + 1} name`}
                        value={ev.name}
                        onChange={(e) => updateEval(i, "name", e.target.value)}
                        required
                      />
                      <input
                        className={inputCls}
                        type="password"
                        placeholder="Personal passphrase"
                        value={ev.password}
                        onChange={(e) => updateEval(i, "password", e.target.value)}
                        required
                      />
                    </div>
                  ))}
                </div>

                <SubmitButton busy={busy} variant="primary" icon={<KeyRound className="h-4 w-4" />}>
                  Initialize auction 
                </SubmitButton>
              </form>
            </section>
          )}

          {/* BIDDER VIEW */}
          {view === "bidder" && (
            <section className="animate-fade-in">
              <SectionHeader
                eyebrow="Bidder"
                title="Submit a sealed bid"
                description="Your bid amount and contractor identity are encrypted before being committed to the ledger."
                icon={<Gavel className="h-5 w-5" />}
              />

              <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <form onSubmit={handleBidSubmit} className="glass-card rounded-2xl p-6">
                  <Field label="Active auction">
                    <select
                      className={inputCls}
                      value={bidAuctionId}
                      onChange={(e) => setBidAuctionId(Number(e.target.value))}
                      required
                    >
                      <option value="">— Select active auction —</option>
                      {auctions.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title} (Deadline: {new Date(a.deadline).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Contractor identity">
                      <input
                        type="number"
                        className={inputCls}
                        placeholder="e.g. 1042"
                        value={contractorId}
                        onChange={(e) => setContractorId(e.target.value ? Number(e.target.value) : "")}
                        required
                      />
                    </Field>
                    <Field label="Bid amount">
                      <input
                        type="number"
                        className={inputCls}
                        placeholder="e.g. 4500000"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value ? Number(e.target.value) : "")}
                        required
                      />
                    </Field>
                  </div>

                  <SubmitButton busy={busy} variant="emerald" icon={<FileLock2 className="h-4 w-4" />}>
                    Submit bid
                  </SubmitButton>
                </form>

                <aside className="glass-card rounded-2xl p-6">
                  <h3 className="text-sm font-semibold">How sealing works</h3>
                  <ol className="mt-4 space-y-4 text-xs text-muted-foreground">
                    <Step n={1} title="Secure Sealing">
                      Your bid is locked inside a secure digital vault immediately.
                    </Step>
                    <Step n={2} title="Blind Storage">
                      Stored data are unreadable without the proper validations.
                    </Step>
                    <Step n={3} title="Team Unlocking">
                      Bids stay locked until the deadline. To open them, at least 3 out of the 5 judges must enter their passwords together.
                    </Step>
                  </ol>
                </aside>
              </div>
            </section>
          )}

          {/* EVALUATOR VIEW */}
          {view === "evaluator" && (
            <section className="animate-fade-in">
              <SectionHeader
                eyebrow="Evaluator"
                title="Unlock the sealed ledger"
                description="Provide passphrases for at least 3 of the 5 evaluators to decrypt all sealed bids."
                icon={<KeyRound className="h-5 w-5" />}
              />

              <form onSubmit={handleOpenBids} className="glass-card rounded-2xl p-6">
                <Field label="Auction to evaluate">
                  <select
                    className={inputCls}
                    value={evalAuctionId}
                    onChange={(e) => setEvalAuctionId(Number(e.target.value))}
                    required
                  >
                    <option value="">— Select auction to evaluate —</option>
                    {auctions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </Field>

                {fetchedShares.length > 0 && (
                  <>
                    <div className="my-2 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                      <Lock className="h-3.5 w-3.5" />
                      Enter passphrases for at least 3 evaluators.
                    </div>

                    <div className="mt-4 grid gap-3">
                      {fetchedShares.map((share, i) => {
                        const filled = passwords[i].trim() !== "";
                        return (
                          <div
                            key={i}
                            className={[
                              "grid grid-cols-1 items-center gap-3 rounded-xl border bg-surface-1 p-3 md:grid-cols-[40px_1fr_2fr] transition-[var(--transition-base)]",
                              filled ? "border-accent/40 shadow-[0_0_0_1px_hsl(var(--accent)/0.15)]" : "border-border",
                            ].join(" ")}
                          >
                            <div
                              className={[
                                "grid h-9 w-9 place-items-center rounded-lg text-xs font-mono",
                                filled ? "bg-accent/15 text-accent" : "bg-secondary text-muted-foreground",
                              ].join(" ")}
                            >
                              {String(i + 1).padStart(2, "0")}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">👤 {share.name}</div>
                              <div className="truncate font-mono text-[10px] text-muted-foreground">
                                share: {share.encrypted_share?.slice(0, 28)}…
                              </div>
                            </div>
                            <input
                              type="password"
                              className={inputCls}
                              placeholder="Evaluator passphrase"
                              value={passwords[i]}
                              onChange={(e) => {
                                const p = [...passwords];
                                p[i] = e.target.value;
                                setPasswords(p);
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-mono">
                        Threshold: {Math.min(passwords.filter((p) => p.trim()).length, 5)}/3
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> Reveal locked until deadline
                      </span>
                    </div>

                    <SubmitButton busy={busy} variant="gold" icon={<KeyRound className="h-4 w-4" />}>
                      Reveal Bids
                    </SubmitButton>
                  </>
                )}
              </form>

              {decryptedBids.length > 0 && (
                <div className="glass-card mt-6 rounded-2xl p-6 animate-slide-up">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-semibold">Decrypted bids</h3>
                    <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent">
                      {decryptedBids.length} bid{decryptedBids.length === 1 ? "" : "s"} revealed
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Ledger block</th>
                          <th className="px-4 py-3 font-medium">Contractor identity</th>
                          <th className="px-4 py-3 font-medium text-right">Decrypted bid amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {decryptedBids.map((b, i) => (
                          <tr
                            key={i}
                            className="border-t border-border transition-[var(--transition-base)] hover:bg-secondary/40"
                          >
                            <td className="px-4 py-3 font-mono text-xs text-primary">#{b.ledger_id}</td>
                            <td className="px-4 py-3 font-mono">{b.decrypted_id}</td>
                            <td className="px-4 py-3 text-right font-mono text-accent">
                              {b.decrypted_amount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

/* ---------- small presentational helpers ---------- */

const inputCls =
  "w-full rounded-lg border border-border bg-surface-1 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-[var(--transition-base)] focus:border-primary/60 focus:ring-2 focus:ring-primary/30";

const Field = ({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
    {children}
  </label>
);

const SectionHeader = ({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) => (
  <div className="mb-5">
    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      <span className="text-primary">{icon}</span>
      {eyebrow}
    </div>
    <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
  </div>
);

const SubmitButton = ({
  busy,
  variant,
  icon,
  children,
}: {
  busy: boolean;
  variant: "primary" | "emerald" | "gold";
  icon: React.ReactNode;
  children: React.ReactNode;
}) => {
  const variants: Record<string, string> = {
    primary:
      "bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)] hover:brightness-110",
    emerald:
      "bg-[image:var(--gradient-emerald)] text-accent-foreground shadow-[0_10px_30px_-10px_hsl(var(--accent)/0.45)] hover:brightness-110",
    gold:
      "bg-[image:var(--gradient-gold)] text-gold-foreground shadow-[0_10px_30px_-10px_hsl(var(--gold)/0.45)] hover:brightness-110",
  };
  return (
    <button
      type="submit"
      disabled={busy}
      className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-[var(--transition-base)] disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
};

const Step = ({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) => (
  <li className="flex gap-3">
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-secondary font-mono text-[10px] text-muted-foreground">
      {n}
    </span>
    <div>
      <div className="text-xs font-semibold text-foreground">{title}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{children}</div>
    </div>
  </li>
);

export default Index;
