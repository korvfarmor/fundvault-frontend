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

    // Handle Tradovate OAuth callback params
    const params = new URLSearchParams(window.location.search);
    if (params.get("tradovate") === "connected") {
      setMsg("✓ Tradovate connected successfully!");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("tradovate") === "error") {
      setMsg("⚠ Tradovate connection failed: " + (params.get("msg") || "Unknown error"));
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Mentor invite via URL — capture code, persist through login
    const invite = params.get("invite");
    if (invite) {
      sessionStorage.setItem("fv_pending_invite", invite.toUpperCase());
      setMsg(`✓ Mentor invite detected: ${invite.toUpperCase()}. Log in or sign up to join.`);
      window.history.replaceState({}, "", window.location.pathname);
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
          <img src="/fundvault-dark.svg" alt="FundVault" style={{ height: 56, width: "auto", display: "block" }} />
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
