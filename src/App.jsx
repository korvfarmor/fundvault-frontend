import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import TradingPlatform from "./trading-platform";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

const inputS = {
  width: "100%", boxSizing: "border-box",
  background: "#111827", border: "1px solid #1e2d3d",
  borderRadius: 8, padding: "11px 14px",
  color: "#c8d8e8", fontFamily: "'DM Sans', sans-serif",
  fontSize: 14, outline: "none",
};

const PLANS = [
  {
    id: "basic", label: "Basic", price: "$30", color: "#6b859e",
    features: ["Trade logging + CSV import", "Dashboard & Analytics", "Calendar", "Prop firm tracker", "Edge Library", "Psychology check-in"],
  },
  {
    id: "advanced", label: "Advanced", price: "$50", color: "#00e5ff", popular: true,
    features: ["Everything in Basic", "AI Coach", "Multi-account tracking", "Discord daily reports", "PDF export"],
  },
  {
    id: "pro", label: "Pro", price: "$90", color: "#a78bfa",
    features: ["Everything in Advanced", "Trade Copier", "NinjaTrader sync (coming)", "Unlimited accounts", "Priority support"],
  },
];

export default function App() {
  const [session,     setSession    ] = useState(null);
  const [loading,     setLoading    ] = useState(true);
  const [authMode,    setAuthMode   ] = useState("login");
  const [email,       setEmail      ] = useState("");
  const [password,    setPassword   ] = useState("");
  const [error,       setError      ] = useState("");
  const [msg,         setMsg        ] = useState("");
  const [submitting,  setSubmitting ] = useState(false);
  // Signup steps: "plan" → "details"
  const [signupStep,  setSignupStep ] = useState("plan");
  const [selectedPlan,setSelectedPlan]= useState("basic");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));

    // Handle Tradovate OAuth callback — Tradovate redirects here with ?code=
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code && window.location.pathname === "/oauth/callback") {
      document.title = "Connecting to Tradovate...";
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        try {
          const res = await fetch(`${API}/tradovate/callback?code=${encodeURIComponent(code)}`, {
            headers: { Authorization: `Bearer ${session?.access_token}` }
          });
          if (res.ok) {
            document.title = "✓ Connected!";
            // Reload the parent window and close popup
            if (window.opener && !window.opener.closed) {
              window.opener.location.reload();
            }
            // Try to close popup — works in most browsers
            window.close();
            // Fallback: if close fails, redirect popup to main app
            setTimeout(() => {
              if (!window.closed) window.location.href = "/";
            }, 500);
          } else {
            document.title = "Connection failed";
            setTimeout(() => {
              window.location.href = "/";
            }, 2000);
          }
        } catch {
          setTimeout(() => { window.location.href = "/"; }, 2000);
        }
      });
    }

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0f1a" }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#4a6080", letterSpacing: "0.1em" }}>LOADING...</div>
    </div>
  );

  if (session) return <TradingPlatform session={session} />;

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password) return setError("Email and password required");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    setSubmitting(true); setError("");
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setMsg(`Account created on ${PLANS.find(p=>p.id===selectedPlan)?.label} plan! Check your email to confirm, then log in.`);
      setAuthMode("login"); setSignupStep("plan");
    } catch(e) { setError(e.message); }
    setSubmitting(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setSubmitting(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: signupStep === "plan" && authMode === "signup" ? 860 : 400 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36, justifyContent: "center" }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18.5" fill="#0d1420" stroke="#00e5ff" strokeWidth="2"/>
            <circle cx="20" cy="20" r="14.5" fill="#111827"/>
            <rect x="18.2" y="1" width="3.6" height="5" rx="1.8" fill="#00e5ff"/>
            <rect x="18.2" y="34" width="3.6" height="5" rx="1.8" fill="#00e5ff"/>
            <rect x="1" y="18.2" width="5" height="3.6" rx="1.8" fill="#00e5ff"/>
            <rect x="34" y="18.2" width="5" height="3.6" rx="1.8" fill="#00e5ff"/>
            <text x="9.5" y="25" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="15" fill="#00e5ff" letterSpacing="1.5">F</text>
            <text x="21" y="25" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="15" fill="#a78bfa" letterSpacing="1.5">V</text>
          </svg>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: "0.07em", color: "#c8d8e8" }}>FUNDVAULT</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#00e5ff", letterSpacing: "0.12em" }}>PROP TRADING JOURNAL</div>
          </div>
        </div>

        {/* Plan selection step */}
        {authMode === "signup" && signupStep === "plan" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 24, color: "#e8f0f8", marginBottom: 8 }}>Choose your plan</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#6b859e" }}>You can upgrade or downgrade at any time</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              {PLANS.map(plan => (
                <div key={plan.id} onClick={() => setSelectedPlan(plan.id)}
                  style={{ background: selectedPlan === plan.id ? `${plan.color}14` : "#111827", border: `2px solid ${selectedPlan === plan.id ? plan.color : "#1e2d3d"}`, borderRadius: 14, padding: 20, cursor: "pointer", position: "relative", transition: "all 0.15s" }}>
                  {plan.popular && (
                    <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: plan.color, color: "#000", borderRadius: 10, padding: "2px 12px", fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 700, whiteSpace: "nowrap" }}>MOST POPULAR</div>
                  )}
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: plan.color, marginBottom: 4 }}>{plan.label}</div>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: "#e8f0f8", marginBottom: 16 }}>{plan.price}<span style={{ fontSize: 12, color: "#4a6080", fontWeight: 400 }}>/mo</span></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {plan.features.map(f => (
                      <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#8aa4bc" }}>
                        <span style={{ color: plan.color, flexShrink: 0, marginTop: 1 }}>✓</span>{f}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setAuthMode("login"); setError(""); setMsg(""); }}
                style={{ flex: 1, padding: "12px", borderRadius: 10, cursor: "pointer", background: "transparent", border: "1px solid #1e2d3d", color: "#4a6080", fontFamily: "'Space Mono', monospace", fontSize: 11 }}>
                Back to login
              </button>
              <button onClick={() => setSignupStep("details")}
                style={{ flex: 2, padding: "12px", borderRadius: 10, cursor: "pointer", background: `linear-gradient(135deg,${PLANS.find(p=>p.id===selectedPlan)?.color}22,${PLANS.find(p=>p.id===selectedPlan)?.color}11)`, border: `1px solid ${PLANS.find(p=>p.id===selectedPlan)?.color}55`, color: PLANS.find(p=>p.id===selectedPlan)?.color, fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em" }}>
                Continue with {PLANS.find(p=>p.id===selectedPlan)?.label} →
              </button>
            </div>
          </div>
        )}

        {/* Login or signup details */}
        {(authMode === "login" || signupStep === "details") && (
          <div style={{ background: "#111827", border: "1px solid #1e2d3d", borderRadius: 16, padding: "32px 28px" }}>

            {authMode === "signup" && signupStep === "details" && (
              <div style={{ background: `${PLANS.find(p=>p.id===selectedPlan)?.color}18`, border: `1px solid ${PLANS.find(p=>p.id===selectedPlan)?.color}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: PLANS.find(p=>p.id===selectedPlan)?.color, fontWeight: 700 }}>
                  {PLANS.find(p=>p.id===selectedPlan)?.label} — {PLANS.find(p=>p.id===selectedPlan)?.price}/mo
                </span>
                <button onClick={() => setSignupStep("plan")} style={{ background: "transparent", border: "none", color: "#4a6080", fontFamily: "'Space Mono', monospace", fontSize: 10, cursor: "pointer" }}>Change</button>
              </div>
            )}

            {authMode === "login" && (
              <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "#0d1420", borderRadius: 10, padding: 4 }}>
                {["login", "signup"].map(m => (
                  <button key={m} onClick={() => { setAuthMode(m); setError(""); setMsg(""); setSignupStep("plan"); }}
                    style={{ flex: 1, padding: "9px", borderRadius: 7, cursor: "pointer", fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", background: authMode === m ? "#1e2d3d" : "transparent", border: "none", color: authMode === m ? "#00e5ff" : "#4a6080", transition: "all 0.15s" }}>
                    {m === "login" ? "Log In" : "Sign Up"}
                  </button>
                ))}
              </div>
            )}

            {msg && (
              <div style={{ background: "#00d08418", border: "1px solid #00d08444", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#00d084" }}>{msg}</div>
            )}

            <form onSubmit={authMode === "login" ? handleLogin : handleSignUp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#4a6080", letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" style={inputS} required />
              </div>
              <div>
                <label style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#4a6080", letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={authMode === "signup" ? "Min. 8 characters" : "••••••••"} style={inputS} required />
              </div>
              {error && <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#ff3d5a" }}>{error}</div>}
              <button type="submit" disabled={submitting}
                style={{ marginTop: 4, padding: "13px", borderRadius: 10, cursor: submitting ? "wait" : "pointer", background: "linear-gradient(135deg,#00e5ff22,#00e5ff11)", border: "1px solid #00e5ff44", color: "#00e5ff", fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>
                {submitting ? (authMode === "login" ? "Logging in..." : "Creating account...") : (authMode === "login" ? "Log In →" : "Create Account →")}
              </button>
              {authMode === "login" && (
                <div style={{ textAlign: "center", fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#4a6080" }}>
                  No account? <button type="button" onClick={() => { setAuthMode("signup"); setSignupStep("plan"); setError(""); }} style={{ background: "transparent", border: "none", color: "#00e5ff", cursor: "pointer", fontFamily: "'Space Mono', monospace", fontSize: 10 }}>Sign up →</button>
                </div>
              )}
            </form>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 20, fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#2a3d50" }}>
          © 2026 FundVault · fundvault.app
        </div>
      </div>
    </div>
  );
}


export default function App() {
  const [session,    setSession   ] = useState(null);
  const [loading,    setLoading   ] = useState(true);
  const [authMode,   setAuthMode  ] = useState("login"); // "login" | "signup"
  const [email,      setEmail     ] = useState("");
  const [password,   setPassword  ] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error,      setError     ] = useState("");
  const [msg,        setMsg       ] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Signup steps: "code" → "details"
  const [signupStep, setSignupStep] = useState("code");
  const [codeValid,  setCodeValid ] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0f1a" }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#4a6080", letterSpacing: "0.1em" }}>LOADING...</div>
    </div>
  );

  if (session) return <TradingPlatform session={session} />;

  // ── Validate invite code ────────────────────────────────────────────────────
  const handleValidateCode = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return setError("Enter your invite code");
    setSubmitting(true); setError("");
    try {
      const res = await fetch(`${API}/access/validate-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inviteCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCodeValid(true);
      setSignupStep("details");
    } catch(e) { setError(e.message); }
    setSubmitting(false);
  };

  // ── Sign up ─────────────────────────────────────────────────────────────────
  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password) return setError("Email and password required");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    setSubmitting(true); setError("");
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      // Mark invite code as used
      if (data?.user?.id) {
        await fetch(`${API}/access/mark-used`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: inviteCode.trim(), userId: data.user.id }),
        });
      }
      setMsg("Account created! Check your email to confirm, then log in.");
      setAuthMode("login");
      setSignupStep("code");
    } catch(e) { setError(e.message); }
    setSubmitting(false);
  };

  // ── Log in ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setSubmitting(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40, justifyContent: "center" }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18.5" fill="#0d1420" stroke="#00e5ff" strokeWidth="2"/>
            <circle cx="20" cy="20" r="14.5" fill="#111827"/>
            <rect x="18.2" y="1" width="3.6" height="5" rx="1.8" fill="#00e5ff"/>
            <rect x="18.2" y="34" width="3.6" height="5" rx="1.8" fill="#00e5ff"/>
            <rect x="1" y="18.2" width="5" height="3.6" rx="1.8" fill="#00e5ff"/>
            <rect x="34" y="18.2" width="5" height="3.6" rx="1.8" fill="#00e5ff"/>
            <text x="9.5" y="25" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="15" fill="#00e5ff" letterSpacing="1.5">F</text>
            <text x="21" y="25" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="15" fill="#a78bfa" letterSpacing="1.5">V</text>
          </svg>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: "0.07em", color: "#c8d8e8" }}>FUNDVAULT</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#00e5ff", letterSpacing: "0.12em" }}>PROP TRADING JOURNAL</div>
          </div>
        </div>

        {/* Card */}
        <div style={{ background: "#111827", border: "1px solid #1e2d3d", borderRadius: 16, padding: "32px 28px" }}>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 28, background: "#0d1420", borderRadius: 10, padding: 4 }}>
            {["login", "signup"].map(m => (
              <button key={m} onClick={() => { setAuthMode(m); setError(""); setMsg(""); setSignupStep("code"); setCodeValid(false); }}
                style={{ flex: 1, padding: "9px", borderRadius: 7, cursor: "pointer", fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", background: authMode === m ? "#1e2d3d" : "transparent", border: "none", color: authMode === m ? "#00e5ff" : "#4a6080", transition: "all 0.15s" }}>
                {m === "login" ? "Log In" : "Sign Up"}
              </button>
            ))}
          </div>

          {msg && (
            <div style={{ background: "#00d08418", border: "1px solid #00d08444", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#00d084" }}>
              {msg}
            </div>
          )}

          {/* LOGIN */}
          {authMode === "login" && (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#4a6080", letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" style={inputS} required />
              </div>
              <div>
                <label style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#4a6080", letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputS} required />
              </div>
              {error && <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#ff3d5a" }}>{error}</div>}
              <button type="submit" disabled={submitting}
                style={{ marginTop: 4, padding: "13px", borderRadius: 10, cursor: submitting ? "wait" : "pointer", background: "linear-gradient(135deg,#00e5ff22,#00e5ff11)", border: "1px solid #00e5ff44", color: "#00e5ff", fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>
                {submitting ? "Logging in..." : "Log In →"}
              </button>
            </form>
          )}

          {/* SIGNUP — Step 1: Invite code */}
          {authMode === "signup" && signupStep === "code" && (
            <form onSubmit={handleValidateCode} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#a78bfa18", border: "1px solid #a78bfa33", borderRadius: 10, padding: "14px 16px", marginBottom: 4 }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#a78bfa", fontWeight: 700, marginBottom: 4 }}>Invite Only</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#6b859e", lineHeight: 1.5 }}>
                  FundVault is currently in early access. You need an invite code to create an account.
                </div>
              </div>
              <div>
                <label style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#4a6080", letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Invite Code</label>
                <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} placeholder="Enter your code" style={{ ...inputS, letterSpacing: "0.1em", fontFamily: "'Space Mono', monospace" }} required />
              </div>
              {error && <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#ff3d5a" }}>{error}</div>}
              <button type="submit" disabled={submitting}
                style={{ marginTop: 4, padding: "13px", borderRadius: 10, cursor: submitting ? "wait" : "pointer", background: "linear-gradient(135deg,#a78bfa22,#a78bfa11)", border: "1px solid #a78bfa44", color: "#a78bfa", fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>
                {submitting ? "Checking..." : "Verify Code →"}
              </button>
              <div style={{ textAlign: "center", fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#4a6080" }}>
                No code?{" "}
                <a href="https://fundvault.app" style={{ color: "#00e5ff", textDecoration: "none" }}>Join the waitlist ↗</a>
              </div>
            </form>
          )}

          {/* SIGNUP — Step 2: Email + password */}
          {authMode === "signup" && signupStep === "details" && (
            <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#00d08418", border: "1px solid #00d08444", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#00d084" }}>✓ Code verified: {inviteCode}</div>
              </div>
              <div>
                <label style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#4a6080", letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" style={inputS} required />
              </div>
              <div>
                <label style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#4a6080", letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" style={inputS} required />
              </div>
              {error && <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#ff3d5a" }}>{error}</div>}
              <button type="submit" disabled={submitting}
                style={{ marginTop: 4, padding: "13px", borderRadius: 10, cursor: submitting ? "wait" : "pointer", background: "linear-gradient(135deg,#00e5ff22,#00e5ff11)", border: "1px solid #00e5ff44", color: "#00e5ff", fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>
                {submitting ? "Creating account..." : "Create Account →"}
              </button>
              <button type="button" onClick={() => { setSignupStep("code"); setError(""); }}
                style={{ background: "transparent", border: "none", color: "#4a6080", fontFamily: "'Space Mono', monospace", fontSize: 10, cursor: "pointer" }}>
                ← Use a different code
              </button>
            </form>
          )}

        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#2a3d50" }}>
          © 2026 FundVault · fundvault.app
        </div>
      </div>
    </div>
  );
}
