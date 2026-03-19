import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import TradingPlatform from "./trading-platform";

const C = {
  bg:"#080c14", surface:"#0d1420", card:"#111827", border:"#1e2d40",
  accent:"#00e5ff", green:"#00d084", red:"#ff3d5a", amber:"#f59e0b",
  purple:"#a78bfa", muted:"#4a6080", text:"#c8d8e8", textDim:"#6b859e",
};

function AuthScreen() {
  const [mode,     setMode    ] = useState("login");
  const [email,    setEmail   ] = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName    ] = useState("");
  const [loading,  setLoading ] = useState(false);
  const [error,    setError   ] = useState("");
  const [success,  setSuccess ] = useState("");

  const clearMessages = () => { setError(""); setSuccess(""); };

  const handleLogin = async () => {
    if (!email || !password) return setError("Fill in email and password");
    setLoading(true); clearMessages();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!email || !password || !name) return setError("Fill in all fields");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    setLoading(true); clearMessages();
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name } },
    });
    if (error) setError(error.message);
    else setSuccess("Account created! Check your email to confirm, then sign in.");
    setLoading(false);
  };

  const handleForgot = async () => {
    if (!email) return setError("Enter your email address");
    setLoading(true); clearMessages();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) setError(error.message);
    else setSuccess("Password reset link sent — check your email.");
    setLoading(false);
  };

  const handleSubmit = () => {
    if (mode === "login")    handleLogin();
    if (mode === "register") handleRegister();
    if (mode === "forgot")   handleForgot();
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",padding:24}}>
      {/* Background glow */}
      <div style={{position:"fixed",top:"20%",left:"50%",transform:"translateX(-50%)",width:600,height:600,borderRadius:"50%",background:`radial-gradient(circle,${C.accent}08 0%,transparent 70%)`,pointerEvents:"none"}}/>

      <div style={{width:"100%",maxWidth:420,position:"relative",zIndex:1}}>

        {/* ── FundVault Logo ── */}
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:12,marginBottom:8}}>
            <svg width="42" height="42" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="18.5" fill="#0d1420" stroke="#00e5ff" strokeWidth="2"/>
              <circle cx="20" cy="20" r="14.5" fill="#111827"/>
              <rect x="18.2" y="1"    width="3.6" height="5"   rx="1.8" fill="#00e5ff"/>
              <rect x="18.2" y="34"   width="3.6" height="5"   rx="1.8" fill="#00e5ff"/>
              <rect x="1"    y="18.2" width="5"   height="3.6" rx="1.8" fill="#00e5ff"/>
              <rect x="34"   y="18.2" width="5"   height="3.6" rx="1.8" fill="#00e5ff"/>
              <text x="9.5" y="25" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="15" fill="#00e5ff" letterSpacing="1.5">F</text>
              <text x="21"  y="25" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="15" fill="#a78bfa" letterSpacing="1.5">V</text>
            </svg>
            <div style={{display:"flex",flexDirection:"column",gap:2,textAlign:"left"}}>
              <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:24,color:C.text,letterSpacing:"0.06em",lineHeight:1}}>FUNDVAULT</span>
              <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.accent,letterSpacing:"0.14em"}}>PROP TRADING JOURNAL</span>
            </div>
          </div>
        </div>

        {/* Card */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:32,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${C.accent},${C.purple})`}}/>

          {/* Tab switcher */}
          {mode !== "forgot" && (
            <div style={{display:"flex",background:C.surface,borderRadius:8,border:`1px solid ${C.border}`,padding:3,marginBottom:28}}>
              {["login","register"].map(m=>(
                <button key={m} onClick={()=>{setMode(m);clearMessages();}} style={{
                  flex:1,padding:"8px 0",borderRadius:6,border:"none",
                  background:mode===m?`${C.accent}22`:"transparent",
                  color:mode===m?C.accent:C.muted,
                  fontFamily:"'Space Mono',monospace",fontSize:11,
                  letterSpacing:"0.08em",textTransform:"uppercase",
                  cursor:"pointer",fontWeight:mode===m?700:400,transition:"all 0.15s",
                }}>
                  {m==="login"?"Sign In":"Register"}
                </button>
              ))}
            </div>
          )}

          {/* Forgot password header */}
          {mode==="forgot"&&(
            <div style={{marginBottom:24}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:C.text,marginBottom:6}}>Reset password</div>
              <div style={{fontSize:13,color:C.textDim}}>Enter your email and we'll send a reset link.</div>
            </div>
          )}

          {/* Name field */}
          {mode==="register"&&(
            <div style={{marginBottom:14}}>
              <label style={labelStyle}>Full Name</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={inputStyle}/>
            </div>
          )}

          {/* Email */}
          <div style={{marginBottom:14}}>
            <label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" onKeyDown={e=>e.key==="Enter"&&handleSubmit()} style={inputStyle}/>
          </div>

          {/* Password */}
          {mode!=="forgot"&&(
            <div style={{marginBottom:22}}>
              <label style={labelStyle}>Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==="register"?"Min. 8 characters":"••••••••"} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} style={inputStyle}/>
            </div>
          )}

          {/* Messages */}
          {error&&<div style={{background:`${C.red}15`,border:`1px solid ${C.red}44`,borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:C.red}}>⚠ {error}</div>}
          {success&&<div style={{background:`${C.green}15`,border:`1px solid ${C.green}44`,borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:C.green}}>✓ {success}</div>}

          {/* Submit */}
          <button onClick={handleSubmit} disabled={loading} style={{
            width:"100%",padding:"13px",
            background:loading?C.surface:`linear-gradient(135deg,${C.accent}22,${C.accent}11)`,
            border:`1px solid ${C.accent}${loading?"33":"88"}`,
            color:loading?C.muted:C.accent,
            borderRadius:10,cursor:loading?"not-allowed":"pointer",
            fontFamily:"'Space Mono',monospace",fontSize:12,
            letterSpacing:"0.1em",textTransform:"uppercase",
            fontWeight:700,transition:"all 0.15s",
          }}>
            {loading?"Please wait...":mode==="login"?"Sign In →":mode==="register"?"Create Account →":"Send Reset Link →"}
          </button>

          {/* Links */}
          <div style={{marginTop:18,textAlign:"center"}}>
            {mode==="login"&&<button onClick={()=>{setMode("forgot");clearMessages();}} style={linkStyle}>Forgot password?</button>}
            {mode==="forgot"&&<button onClick={()=>{setMode("login");clearMessages();}} style={linkStyle}>← Back to sign in</button>}
          </div>
        </div>

        {/* Footer */}
        <div style={{textAlign:"center",marginTop:24,fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.05em"}}>
          NQ · ES · Futures · Prop Firm Focused
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:${C.bg}; }
        input::placeholder { color:${C.muted}; }
        input:focus { outline:none; border-color:${C.accent}88 !important; }
      `}</style>
    </div>
  );
}

const inputStyle = {
  width:"100%",padding:"11px 14px",background:"#080c14",
  border:"1px solid #1e2d40",borderRadius:8,color:"#c8d8e8",
  fontFamily:"'DM Sans',sans-serif",fontSize:14,transition:"border-color 0.15s",
};
const labelStyle = {
  display:"block",fontFamily:"'Space Mono',monospace",fontSize:10,
  color:"#6b859e",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6,
};
const linkStyle = {
  background:"none",border:"none",color:"#4a6080",
  fontFamily:"'Space Mono',monospace",fontSize:10,
  cursor:"pointer",letterSpacing:"0.05em",textDecoration:"underline",
};

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}}) => setSession(session));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{minHeight:"100vh",background:"#080c14",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{width:36,height:36,borderRadius:"50%",border:"3px solid #1e2d40",borderTop:"3px solid #00e5ff",animation:"spin 0.8s linear infinite"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      </div>
    );
  }

  if (!session) return <AuthScreen/>;
  return <TradingPlatform session={session}/>;
}
