import { useState, useRef, useEffect, useCallback, useContext, createContext } from "react";
import { supabase } from "./supabaseClient";
import { tradesApi, propApi, psychApi, rulesApi, tradovateApi } from "./lib/api";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Cell
} from "recharts";

// ── Design tokens ─────────────────────────────────────────────────────────────
// Read theme from localStorage for auth screens (no React state ofailable yet)
const getStoredTheme = () => {
  try { return localStorage.getItem("fv_theme") || "dark"; } catch { return "dark"; }
};

const THEMES = {
  dark: {
    bg:"#080c14", surface:"#0d1420", card:"#111827", border:"#1e2d40",
    accent:"#00e5ff", accentDim:"#00e5ff18",
    green:"#00d084", red:"#ff3d5a", amber:"#f59e0b",
    purple:"#a78bfa", muted:"#4a6080", text:"#c8d8e8", textDim:"#6b859e",
  },
  light: {
    bg:"#f0f4f8", surface:"#ffffff", card:"#ffffff", border:"#dde3ec",
    accent:"#0062cc", accentDim:"#0062cc14",
    green:"#00935c", red:"#dc2626", amber:"#d97706",
    purple:"#7c3aed", muted:"#94a3b8", text:"#0f1923", textDim:"#4a6080",
  },
};
// C is module-level fallback — components get live C via ThemeCtx
const C = THEMES.dark;
const ThemeCtx = createContext(THEMES.dark);

// ── Sample data ───────────────────────────────────────────────────────────────
const INITIAL_TRADES = [
  { id:1,  symbol:"NQ", side:"Long",  entry:"09:32", exit:"09:47", pnl:420,  rr:2.1,  status:"win",  tags:["Kill Zone","Displacement"], rating:5, checks:{}, review:"", screenshot:null, holdMin:15 },
  { id:2,  symbol:"ES", side:"Short", entry:"10:15", exit:"10:28", pnl:-180, rr:-0.9, status:"loss", tags:["FOMO"],                      rating:2, checks:{}, review:"", screenshot:null, holdMin:13 },
  { id:3,  symbol:"NQ", side:"Long",  entry:"11:02", exit:"11:19", pnl:650,  rr:3.2,  status:"win",  tags:["Kill Zone","FVG"],           rating:5, checks:{}, review:"", screenshot:null, holdMin:17 },
  { id:4,  symbol:"NQ", side:"Short", entry:"13:45", exit:"14:01", pnl:310,  rr:1.5,  status:"win",  tags:["OB","Displacement"],         rating:4, checks:{}, review:"", screenshot:null, holdMin:16 },
  { id:5,  symbol:"ES", side:"Long",  entry:"14:30", exit:"14:43", pnl:-90,  rr:-0.4, status:"loss", tags:["Revenge"],                    rating:1, checks:{}, review:"", screenshot:null, holdMin:13 },
  { id:6,  symbol:"NQ", side:"Long",  entry:"09:15", exit:"09:38", pnl:820,  rr:4.1,  status:"win",  tags:["Kill Zone","Displacement"],  rating:5, checks:{}, review:"", screenshot:null, holdMin:23 },
  { id:7,  symbol:"NQ", side:"Short", entry:"15:45", exit:"15:58", pnl:-320, rr:-1.6, status:"loss", tags:["FOMO","Late entry"],          rating:1, checks:{}, review:"", screenshot:null, holdMin:13 },
  { id:8,  symbol:"ES", side:"Long",  entry:"09:48", exit:"10:05", pnl:540,  rr:2.7,  status:"win",  tags:["Kill Zone","FVG"],           rating:4, checks:{}, review:"", screenshot:null, holdMin:17 },
  { id:9,  symbol:"NQ", side:"Long",  entry:"10:30", exit:"10:44", pnl:380,  rr:1.9,  status:"win",  tags:["OB"],                        rating:4, checks:{}, review:"", screenshot:null, holdMin:14 },
  { id:10, symbol:"ES", side:"Short", entry:"13:00", exit:"13:12", pnl:-150, rr:-0.7, status:"loss", tags:["Revenge","Late entry"],       rating:2, checks:{}, review:"", screenshot:null, holdMin:12 },
];

const PNL_DATA = [
  {day:"Mon",pnl:420},{day:"Tue",pnl:-180},{day:"Wed",pnl:650},
  {day:"Thu",pnl:310},{day:"Fri",pnl:-90 },{day:"Mon",pnl:780},
  {day:"Tue",pnl:520},{day:"Wed",pnl:-240},{day:"Thu",pnl:900},
  {day:"Fri",pnl:430},
];
const EQUITY_DATA = PNL_DATA.reduce((acc,d,i)=>{
  acc.push({day:d.day, equity:(i===0?10000:acc[i-1].equity)+d.pnl});
  return acc;
},[]);
const CAL_DATA = {
  "2024-03":{
    "1":420,"2":-180,"3":650,"4":310,"5":-90,
    "8":780,"9":520,"10":-240,"11":900,"12":430,
    "15":-320,"16":210,"17":580,"18":100,"19":-50,
    "22":740,"23":390,"24":-110,"25":860,"26":230,
  }
};
const TIME_DATA = [
  {hour:"08:00",pnl:-60, trades:2,wins:0},
  {hour:"09:00",pnl:1780,trades:4,wins:4},
  {hour:"10:00",pnl:920, trades:3,wins:2},
  {hour:"11:00",pnl:650, trades:2,wins:2},
  {hour:"12:00",pnl:-180,trades:2,wins:0},
  {hour:"13:00",pnl:160, trades:2,wins:1},
  {hour:"14:00",pnl:-410,trades:3,wins:1},
  {hour:"15:00",pnl:-320,trades:2,wins:0},
  {hour:"16:00",pnl:-90, trades:1,wins:0},
];
const PSYCH_DATA = [
  {day:"Mar 1", mood:4,habits:6,pnl:420 },{day:"Mar 4", mood:2,habits:3,pnl:-180},
  {day:"Mar 5", mood:5,habits:7,pnl:650 },{day:"Mar 6", mood:4,habits:6,pnl:310 },
  {day:"Mar 7", mood:2,habits:2,pnl:-90 },{day:"Mar 8", mood:5,habits:8,pnl:780 },
  {day:"Mar 11",mood:4,habits:7,pnl:520 },{day:"Mar 12",mood:1,habits:1,pnl:-240},
  {day:"Mar 13",mood:5,habits:8,pnl:900 },{day:"Mar 14",mood:4,habits:6,pnl:430 },
];
const DEFAULT_RULES = [
  "Waited for displacement confirmation",
  "Entry was within FVG / OB",
  "Stop loss placed correctly",
  "Minimum 1 min trade duration (prop rule)",
  "Traded during kill zone",
];
const DEFAULT_HABITS = [
  {id:"sleep",   label:"Slept 7+ hours",                 icon:"😴",category:"Physical"  },
  {id:"exercise",label:"Exercised today",                 icon:"🏃",category:"Physical"  },
  {id:"journal", label:"Wrote in journal before trading", icon:"📝",category:"Mindset"   },
  {id:"plan",    label:"Reviewed trading plan",           icon:"🎯",category:"Mindset"   },
  {id:"calm",    label:"Errort calm & focused",             icon:"🧘",category:"Mindset"   },
  {id:"revenge", label:"No revenge trading urges",        icon:"🚫",category:"Discipline"},
  {id:"fomo",    label:"No FOMO on missed moves",         icon:"👁️",category:"Discipline"},
  {id:"rules",   label:"Respected daily loss limit",      icon:"🛡️",category:"Discipline"},
];
const MOOD_OPTIONS = [
  {val:1,emoji:"😤",label:"Frustrated"},{val:2,emoji:"😟",label:"Anxious"},
  {val:3,emoji:"😐",label:"Neutral"},   {val:4,emoji:"😊",label:"Confident"},
  {val:5,emoji:"🔥",label:"In the zone"},
];
const ALL_TAGS = ["Kill Zone","Displacement","FVG","OB","BOS","CHoCH","Liquidity Sweep","FOMO","Revenge","Late entry","Oversize","News trade"];

// Each firm has accountTypees — selecting one loads that type's rules + payout config.
const DEFAULT_PROP_FIRMS = [
  {
    id:"mffu", name:"MyFundedFutures", color:C.accent,
    activeTypee:"standard",
    accountTypees:[
      {
        id:"standard", label:"Standard", badge:"$50K",
        accountSize:50000, payoutSplit:90, payoutFreq:"Bi-weekly (every 14 days)", minPayout:500,
        description:"Classic eval + funded. EOD trailing drawdown. 40% consistency rule.",
        payout:{ cycleTarget:3000, minDays:5, minProfit:200, buffer:2100, consistency:40 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:1600,description:"3% of $50K = $1,500 + $100 buffer. Stops trailing at starting balance."},
          {id:"pt",label:"Profit Target (Eval)",   type:"target",  value:3000,description:"Must reach $3,000 profit to pass evaluation"},
          {id:"md",label:"Min Profitable Days",    type:"days",    value:5,   description:"5 days with $200+ profit per payout cycle"},
          {id:"cs",label:"Consistency Rule (40%)", type:"consist", value:40,  description:"No single day can exceed 40% of total cycle profits"},
          {id:"mh",label:"Min Hold Time",          type:"hold",    value:1,   description:"No scalping under 4 ticks (effectively ~1 min)"},
        ]
      },
      {
        id:"plus", label:"Standard+", badge:"$50K+",
        accountSize:50000, payoutSplit:90, payoutFreq:"Bi-weekly", minPayout:500,
        description:"Same as Standard but with Express pass option. 1-step eval.",
        payout:{ cycleTarget:3000, minDays:5, minProfit:200, buffer:2100, consistency:40 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:1600,description:"3% trailing — same as Standard"},
          {id:"pt",label:"Profit Target (Eval)",   type:"target",  value:3000,description:"6% target — 1-step evaluation"},
          {id:"md",label:"Min Profitable Days",    type:"days",    value:5,   description:"5 qualifying days per payout cycle"},
          {id:"cs",label:"Consistency Rule (40%)", type:"consist", value:40,  description:"Max 40% of cycle profits from one day"},
          {id:"mh",label:"Min Hold Time",          type:"hold",    value:1,   description:"No sub-minute scalping"},
        ]
      },
      {
        id:"instant", label:"Instant Funding", badge:"Instant",
        accountSize:50000, payoutSplit:80, payoutFreq:"Bi-weekly", minPayout:500,
        description:"Skip the eval — go straight to funded. Lower 80% split.",
        payout:{ cycleTarget:2500, minDays:5, minProfit:200, buffer:2100, consistency:40 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:1600,description:"3% trailing drawdown — no eval required"},
          {id:"md",label:"Min Profitable Days",    type:"days",    value:5,   description:"5 days $200+ per payout cycle"},
          {id:"cs",label:"Consistency Rule (40%)", type:"consist", value:40,  description:"No single day exceeds 40% of cycle profits"},
          {id:"mh",label:"Min Hold Time",          type:"hold",    value:1,   description:"Min ~1 min hold time"},
        ]
      },
    ]
  },
  {
    id:"lucid", name:"Lucid Trading", color:C.purple,
    activeTypee:"pro",
    accountTypees:[
      {
        id:"pro", label:"LucidPro", badge:"Pro",
        accountSize:50000, payoutSplit:90, payoutFreq:"Daily eligible (5 days/cycle)", minPayout:500,
        description:"Standard funded plan. 35% consistency rule applies. Best for disciplined traders.",
        payout:{ cycleTarget:2000, minDays:5, minProfit:0, buffer:100, consistency:35 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:2000,description:"4% trailing from starting balance. EOD only — intraday moves don't update MLL."},
          {id:"pt",label:"Profit Target (Eval)",   type:"target",  value:2000,description:"Pass by hitting 4% profit target"},
          {id:"md",label:"Min Profitable Days",    type:"days",    value:5,   description:"5 profitable days per payout cycle"},
          {id:"cs",label:"Consistency Rule (35%)", type:"consist", value:35,  description:"Largest single day ≤ 35% of total cycle profit"},
          {id:"cl",label:"Close by 4:45 PM EST",   type:"hold",    value:1,   description:"All positions must be flat by 4:45 PM EST"},
        ]
      },
      {
        id:"flex", label:"LucidFlex", badge:"Flex",
        accountSize:50000, payoutSplit:90, payoutFreq:"Daily eligible (5 days/cycle)", minPayout:500,
        description:"More flexible — no consistency rule once funded. Great for aggressive scalpers.",
        payout:{ cycleTarget:2000, minDays:5, minProfit:0, buffer:100, consistency:999 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:2000,description:"4% trailing from starting balance. EOD only."},
          {id:"pt",label:"Profit Target (Eval)",   type:"target",  value:2000,description:"Pass by hitting 4% profit target"},
          {id:"md",label:"Min Profitable Days",    type:"days",    value:5,   description:"5 profitable days per payout cycle"},
          {id:"cl",label:"Close by 4:45 PM EST",   type:"hold",    value:1,   description:"All positions must be flat by 4:45 PM EST"},
          // No consistency rule in Flex
        ]
      },
      {
        id:"black", label:"LucidBlack", badge:"Black ★",
        accountSize:100000, payoutSplit:95, payoutFreq:"Daily eligible (3 days/cycle)", minPayout:1000,
        description:"Elite tier. $100K account, 95% split, only 3 qualifying days needed.",
        payout:{ cycleTarget:4000, minDays:3, minProfit:0, buffer:100, consistency:999 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:4000,description:"4% trailing on $100K = $4,000 MLL"},
          {id:"pt",label:"Profit Target (Eval)",   type:"target",  value:4000,description:"4% profit target on $100K account"},
          {id:"md",label:"Min Profitable Days",    type:"days",    value:3,   description:"Only 3 qualifying days per payout cycle"},
          {id:"cl",label:"Close by 4:45 PM EST",   type:"hold",    value:1,   description:"All positions flat by 4:45 PM EST"},
        ]
      },
      {
        id:"zero", label:"LucidZero", badge:"Zero",
        accountSize:50000, payoutSplit:90, payoutFreq:"Bi-weekly", minPayout:500,
        description:"No evaluation needed — skip straight to funded. 90% split.",
        payout:{ cycleTarget:2000, minDays:5, minProfit:0, buffer:100, consistency:999 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:2000,description:"4% trailing drawdown — no eval step"},
          {id:"md",label:"Min Profitable Days",    type:"days",    value:5,   description:"5 profitable days per payout cycle"},
          {id:"cl",label:"Close by 4:45 PM EST",   type:"hold",    value:1,   description:"Positions flat by 4:45 PM EST"},
        ]
      },
    ]
  },
  {
    id:"alpha", name:"Alpha Futures", color:C.amber,
    activeTypee:"standard",
    accountTypees:[
      {
        id:"standard", label:"Standard", badge:"Standard",
        accountSize:50000, payoutSplit:90, payoutFreq:"Bi-weekly", minPayout:200,
        description:"Classic plan. 40% consistency rule. Bi-weekly payouts.",
        payout:{ cycleTarget:3000, minDays:5, minProfit:200, buffer:0, consistency:40 },
        rules:[
          {id:"dd", label:"EOD Trailing Drawdown",  type:"drawdown",value:2000,description:"4% trailing from daily balance. EOD — not intraday."},
          {id:"dlg",label:"Daily Loss Guard (2%)",  type:"loss",    value:1000,description:"Soft lock at 2% loss ($1,000). Account paused for the day — not a full breach."},
          {id:"pt", label:"Profit Target (Eval)",   type:"target",  value:3000,description:"6% target on Standard ($3,000 on $50K)"},
          {id:"md", label:"Min Winning Days",       type:"days",    value:5,   description:"5 winning days of $200+ per payout cycle"},
          {id:"cs", label:"Consistency Rule (40%)", type:"consist", value:40,  description:"No single day > 40% of total cycle profit"},
        ]
      },
      {
        id:"zero", label:"Zero", badge:"Zero",
        accountSize:50000, payoutSplit:90, payoutFreq:"Bi-weekly", minPayout:200,
        description:"No evaluation step — instant funded. 40% consistency rule applies.",
        payout:{ cycleTarget:3000, minDays:5, minProfit:200, buffer:0, consistency:40 },
        rules:[
          {id:"dd", label:"EOD Trailing Drawdown",  type:"drawdown",value:2000,description:"4% trailing drawdown — instant funded"},
          {id:"dlg",label:"Daily Loss Guard (2%)",  type:"loss",    value:1000,description:"2% soft lock — account paused not breached"},
          {id:"md", label:"Min Winning Days",       type:"days",    value:5,   description:"5 winning days of $200+ per payout cycle"},
          {id:"cs", label:"Consistency Rule (40%)", type:"consist", value:40,  description:"Max 40% of cycle profit from one day"},
        ]
      },
      {
        id:"advanced", label:"Advanced", badge:"Advanced ★",
        accountSize:50000, payoutSplit:90, payoutFreq:"Weekly", minPayout:200,
        description:"No consistency rule. Weekly payouts. Best for high-variance traders.",
        payout:{ cycleTarget:3000, minDays:5, minProfit:200, buffer:0, consistency:999 },
        rules:[
          {id:"dd", label:"EOD Trailing Drawdown",  type:"drawdown",value:2000,description:"4% trailing — same as Standard"},
          {id:"dlg",label:"Daily Loss Guard (2%)",  type:"loss",    value:1000,description:"2% soft daily lock — not a hard breach"},
          {id:"pt", label:"Profit Target (Eval)",   type:"target",  value:3000,description:"6% profit target to pass eval"},
          {id:"md", label:"Min Winning Days",       type:"days",    value:5,   description:"5 winning days of $200+ per cycle"},
          // No consistency rule in Advanced
        ]
      },
    ]
  },
  {
    id:"tpt", name:"TakeProfitTrader", color:"#22d3ee",
    activeTypee:"pro",
    accountTypees:[
      {
        id:"test", label:"Test (Eval)", badge:"Eval",
        accountSize:50000, payoutSplit:0, payoutFreq:"N/A — evaluation phase", minPayout:0,
        description:"One-step evaluation. EOD trailing drawdown. No daily loss limit. 50% consistency rule. Monthly subscription.",
        payout:{ cycleTarget:3000, minDays:5, minProfit:0, buffer:0, consistency:50 },
        rules:[
          {id:"dd", label:"EOD Trailing Drawdown", type:"drawdown", value:2000, description:"$2,000 max drawdown on $50K. Calculated at EOD — intraday dips don't count. Stops trailing at starting balance."},
          {id:"pt", label:"Profit Target (6%)",    type:"target",   value:3000, description:"Hit $3,000 profit (6%) to pass and move to PRO account"},
          {id:"md", label:"Min Trading Days",       type:"days",     value:5,   description:"Must trade minimum 5 days before passing"},
          {id:"cs", label:"Consistency Rule (50%)", type:"consist",  value:50,  description:"No single day can be > 50% of total profits. E.g. targeting $3K — no day over $1,500."},
          {id:"ps", label:"Max Position Size",      type:"hold",     value:1,   description:"$50K account: max 6 mini contracts or 60 micro contracts"},
          {id:"cl", label:"Close by 4:10 PM EST",   type:"hold",     value:1,   description:"All positions must be closed by 4:10 PM EST. No overnight holds."},
        ]
      },
      {
        id:"pro", label:"PRO", badge:"PRO",
        accountSize:50000, payoutSplit:80, payoutFreq:"Daily (once above buffer)", minPayout:0,
        description:"Funded account. Intraday trailing drawdown (more strict than eval). 80% split. Buffer zone = max drawdown. No consistency rule.",
        payout:{ cycleTarget:2000, minDays:1, minProfit:0, buffer:2000, consistency:999 },
        rules:[
          {id:"dd", label:"Intraday Trailing Drawdown", type:"drawdown", value:2000, description:"⚠ Intraday — trails unrealized profit in real-time. Buffer zone = $2,000. Need $52,000 balance before first withdrawal."},
          {id:"bf", label:"Buffer Zone ($2,000)",       type:"target",   value:2000, description:"Must reach balance + drawdown ($52,000 on $50K) before any payout. Buffer releases 50–80% at account close."},
          {id:"ps", label:"Max Position Size",          type:"hold",     value:1,   description:"$50K: max 6 minis / 60 micros. Same as eval."},
          {id:"cl", label:"Close by 4:10 PM EST",       type:"hold",     value:1,   description:"All positions flat by 4:10 PM EST. No overnight."},
          // No daily loss limit (removed Jan 2025)
          // No consistency rule in PRO
        ]
      },
      {
        id:"proplus", label:"PRO+", badge:"PRO+ ★",
        accountSize:50000, payoutSplit:90, payoutFreq:"Daily (no buffer required)", minPayout:0,
        description:"Live-market elite tier. EOD drawdown (back to eval rules). 90% split. No buffer. Upgrade requires $10K profit in a single PRO day.",
        payout:{ cycleTarget:0, minDays:1, minProfit:0, buffer:0, consistency:999 },
        rules:[
          {id:"dd", label:"EOD Trailing Drawdown", type:"drawdown", value:2000, description:"Back to EOD calculation — much more forgiving than PRO intraday. Stops trailing at starting balance."},
          {id:"ps", label:"Max Position Size",      type:"hold",     value:1,   description:"$50K: max 6 minis / 60 micros"},
          {id:"cl", label:"Close by 4:10 PM EST",   type:"hold",     value:1,   description:"Positions flat by 4:10 PM EST"},
          // No daily loss limit, no buffer, no consistency rule
        ]
      },
    ]
  },
  {
    id:"tradeify", name:"Tradeify", color:"#34d399",
    activeTypee:"selectflex",
    accountTypees:[
      {
        id:"selectflex", label:"Select Flex", badge:"Best ★",
        accountSize:50000, payoutSplit:90, payoutFreq:"Every 5 winning days", minPayout:500,
        description:"Best Tradeify option. No DLL, no consistency rule once funded. Drawdown locks at $50,100 after first payout — account can never fail from drawdown again.",
        payout:{ cycleTarget:2000, minDays:5, minProfit:0, buffer:0, consistency:999 },
        rules:[
          {id:"dd", label:"EOD Trailing Drawdown",  type:"drawdown", value:2000, description:"$2,000 trailing on $50K. Locks at $50,100 permanently after first payout — you can't fail from drawdown after that."},
          {id:"pt", label:"Profit Target (Eval)",   type:"target",   value:2000, description:"Pass 3-day minimum eval with $2,000 profit target on $50K"},
          {id:"md", label:"5 Winning Days",         type:"days",     value:5,   description:"5 profitable days required per payout cycle (any $ amount)"},
          {id:"np", label:"Net Positive Between",   type:"consist",  value:999, description:"Must hofe net positive profit between payout cycles (even $1). Not a hard rule but required for payout approval."},
          // No DLL, no consistency rule
        ]
      },
      {
        id:"selectdaily", label:"Select Daily", badge:"Daily",
        accountSize:50000, payoutSplit:90, payoutFreq:"Daily (once conditions met)", minPayout:150,
        description:"Daily payouts but with Daily Loss Limit and stricter consistency. Good for scalpers who want fast access but can manage the tighter rules.",
        payout:{ cycleTarget:1500, minDays:5, minProfit:150, buffer:0, consistency:35 },
        rules:[
          {id:"dd", label:"EOD Trailing Drawdown",  type:"drawdown", value:2000, description:"$2,000 EOD trailing. Same locking mechanism as Flex after first payout."},
          {id:"dl", label:"Daily Loss Limit",       type:"loss",     value:1000, description:"Hard daily loss limit of $1,000 on $50K. Pauses trading for the day if hit."},
          {id:"pt", label:"Profit Target (Eval)",   type:"target",   value:2000, description:"$2,000 profit target on $50K eval"},
          {id:"md", label:"5 Winning Days",         type:"days",     value:5,   description:"5 profitable days ($150+) per payout cycle"},
          {id:"cs", label:"Consistency Rule (35%)", type:"consist",  value:35,  description:"No single day > 35% of total cycle profits. Starts at 20% first payout, scales to 35%."},
        ]
      },
      {
        id:"lightning", label:"Lightning Funded", badge:"Instant",
        accountSize:50000, payoutSplit:90, payoutFreq:"Bi-weekly", minPayout:1000,
        description:"Skip the eval entirely — instant sim-funded account. One-time fee. Progressive consistency rule (20–35%). Cannot be reset if failed.",
        payout:{ cycleTarget:3000, minDays:7, minProfit:150, buffer:100, consistency:20 },
        rules:[
          {id:"dd", label:"EOD Trailing Drawdown",  type:"drawdown", value:2000, description:"$2,000 EOD trailing. Locks at $50,100 once you build sufficient profit buffer."},
          {id:"md", label:"Min 7 Trading Days",     type:"days",     value:7,   description:"7 trading days min, with 5 profitable days ($150+) per payout cycle"},
          {id:"cs", label:"Consistency (20–35%)",   type:"consist",  value:20,  description:"Progressive: starts at 20% for first payout, gradually increases. No single day can dominate."},
          {id:"np", label:"Net Positive Balance",   type:"consist",  value:999, description:"Account must be $100 above drawdown floor at time of payout request"},
        ]
      },
      {
        id:"growth", label:"Growth", badge:"Eval",
        accountSize:50000, payoutSplit:90, payoutFreq:"Bi-weekly", minPayout:1000,
        description:"Monthly eval subscription with EOD drawdown. Good for traders who want a lower-cost way in. Large buffer before first payout.",
        payout:{ cycleTarget:3000, minDays:7, minProfit:150, buffer:2100, consistency:35 },
        rules:[
          {id:"dd", label:"EOD Trailing Drawdown",  type:"drawdown", value:2000, description:"EOD trailing — same as Select. Locks at $50,100 once funded."},
          {id:"pt", label:"Profit Target (Eval)",   type:"target",   value:2000, description:"Pass $2,000 profit target to unlock funded status"},
          {id:"md", label:"Min 7 Trading Days",     type:"days",     value:7,   description:"7 days min with 5 profitable ($150+) to qualify for payout"},
          {id:"cs", label:"Consistency Rule (35%)", type:"consist",  value:35,  description:"Max 35% of total cycle profits from one day"},
          {id:"bf", label:"Buffer Before Payout",   type:"target",   value:2100, description:"Must reach $52,100 balance (= starting + drawdown + $100) before any payout is eligible"},
        ]
      },
    ]
  },
];

const PROP_ACCT = {
  mffu:     {balance:51840,startBalance:50000,peakBalance:52100,todayPnl:420, tradingDays:8,  cycleProfit:1840, cycleWinDays:4, bestDayPct:28},
  lucid:    {balance:51200,startBalance:50000,peakBalance:51400,todayPnl:310, tradingDays:6,  cycleProfit:1200, cycleWinDays:4, bestDayPct:31},
  alpha:    {balance:50920,startBalance:50000,peakBalance:51100,todayPnl:-180,tradingDays:5,  cycleProfit:920,  cycleWinDays:3, bestDayPct:35},
  tpt:      {balance:52180,startBalance:50000,peakBalance:52400,todayPnl:310, tradingDays:9,  cycleProfit:2180, cycleWinDays:5, bestDayPct:38},
  tradeify: {balance:51640,startBalance:50000,peakBalance:51900,todayPnl:520, tradingDays:7,  cycleProfit:1640, cycleWinDays:5, bestDayPct:29},
};

// Economic calendar events (mock — in production: connect to TradingView widget or JBlanked API)
const ECON_EVENTS = [
  {id:1, date:"2024-03-11", time:"08:30",currency:"USD",impact:"high",  event:"CPI m/m",          forecast:"0.4%", previous:"0.3%", actual:"0.4%"},
  {id:2, date:"2024-03-11", time:"08:30",currency:"USD",impact:"high",  event:"Core CPI m/m",     forecast:"0.3%", previous:"0.4%", actual:"0.3%"},
  {id:3, date:"2024-03-12", time:"08:30",currency:"USD",impact:"medium",event:"PPI m/m",           forecast:"0.3%", previous:"0.2%", actual:null},
  {id:4, date:"2024-03-13", time:"08:30",currency:"USD",impact:"medium",event:"Retail Sales m/m",  forecast:"0.8%", previous:"-0.8%",actual:null},
  {id:5, date:"2024-03-13", time:"10:00",currency:"USD",impact:"low",   event:"UoM Consumer Latetiment",forecast:"77.1",previous:"76.9",actual:null},
  {id:6, date:"2024-03-14", time:"08:30",currency:"USD",impact:"high",  event:"Initial Jobless Claims",forecast:"218K",previous:"215K",actual:null},
  {id:7, date:"2024-03-14", time:"14:00",currency:"USD",impact:"high",  event:"FOMC Meeting Minutes",forecast:null,  previous:null,    actual:null},
  {id:8, date:"2024-03-15", time:"08:30",currency:"USD",impact:"high",  event:"NFP",               forecast:"200K", previous:"353K", actual:null},
  {id:9, date:"2024-03-15", time:"08:30",currency:"USD",impact:"high",  event:"Unemployment Rate", forecast:"3.7%", previous:"3.7%", actual:null},
  {id:10,date:"2024-03-18", time:"14:00",currency:"USD",impact:"high",  event:"FOMC Rate Decision",forecast:"5.50%",previous:"5.50%",actual:null},
  {id:11,date:"2024-03-18", time:"14:30",currency:"USD",impact:"high",  event:"FOMC Press Conference",forecast:null, previous:null,   actual:null},
  {id:12,date:"2024-03-19", time:"08:30",currency:"USD",impact:"medium",event:"Building Permits",  forecast:"1.48M",previous:"1.49M",actual:null},
  {id:13,date:"2024-03-20", time:"08:30",currency:"USD",impact:"medium",event:"Philly Fed Index",  forecast:"5.5",  previous:"5.2",  actual:null},
  {id:14,date:"2024-03-21", time:"08:30",currency:"USD",impact:"medium",event:"Durable Goods m/m", forecast:"-1.0%",previous:"0.0%", actual:null},
];

// ── Shared UI ─────────────────────────────────────────────────────────────────

// ── FlattenWidget — Flytande widget för öppna positioner ─────────────────────
function FlattenWidget({ tvStatus, theme }) {
  const C = useContext(ThemeCtx);
  const [positions,  setPositions ] = useState([]);
  const [selected,   setSelected  ] = useState({});
  const [loading,    setLoading   ] = useState(false);
  const [flattening, setFlattening] = useState(false);
  const [expanded,   setExpanded  ] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [error,      setError     ] = useState(null);
  const [demoMode,        setDemoMode       ] = useState(false);
  const [cancellingOrders, setCancellingOrders] = useState(false);

  const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const DEMO_POSITIONS = [
    { id: 1, symbol: "NQ", side: "Long",  size:  2, ofgPrice: "19842.50", currentPrice: "19901.25", unrealized: 2350 },
    { id: 2, symbol: "ES", side: "Short", size: -1, ofgPrice: "5621.00",  currentPrice: "5618.50",  unrealized: 125  },
    { id: 3, symbol: "MNQ",side: "Long",  size:  5, ofgPrice: "19840.00", currentPrice: "19901.25", unrealized: 612  },
  ];

  // Fetch open positions (demo mode if Tradovate ej anslutet)
  const fetchPositions = async () => {
    setLoading(true); setError(null);
    if (demoMode) {
      // Simulera liten prisrörelse i demo
      setPositions(DEMO_POSITIONS.map(p => ({
        ...p,
        unrealized: p.unrealized + Math.round((Math.random() - 0.5) * 100),
      })));
      setLastUpdate(new Date());
      setLoading(false);
      return;
    }
    if (!tvStatus?.connected) { setLoading(false); return; }
    try {
      const token = await getToken();
      const res = await fetch(`${API}/tradovate/positions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPositions(data);
      setLastUpdate(new Date());
    } catch (err) {
      setError("Could not fetch positions");
      // Silent error — Tradovate not connected yet
    }
    setLoading(false);
  };

  // Update var 5:e sekund (eller i demo: var 3:e sekund med prisrörelse)
  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, demoMode ? 3000 : 5000);
    return () => clearInterval(interval);
  }, [tvStatus?.connected, demoMode]);

  const toggleSelect = (id) => setSelected(s => ({ ...s, [id]: !s[id] }));
  const selectedIds  = positions.filter(p => selected[p.id]).map(p => p.id);
  const totalUnrealized = positions.reduce((a, p) => a + (p.unrealized || 0), 0);

  // Close selected positioner
  const flattenSelected = async () => {
    if (!selectedIds.length) return;
    setFlattening(true); setError(null);
    if (demoMode) {
      await new Promise(r => setTimeout(r, 800)); // simulera fördröjning
      setPositions(p => p.filter(pos => !selectedIds.includes(pos.id)));
      setSelected({});
      setFlattening(false);
      return;
    }
    try {
      const token = await getToken();
      await fetch(`${API}/tradovate/flatten`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Typee": "application/json" },
        body: JSON.stringify({ positionIds: selectedIds })
      });
      setSelected({});
      await fetchPositions();
    } catch (err) { setError("Flatten misslyckades: " + err.message); }
    setFlattening(false);
  };

  // Close ALLA positioner
  const flattenAll = async () => {
    setConfirmAll(false);
    setFlattening(true); setError(null);
    if (demoMode) {
      await new Promise(r => setTimeout(r, 1000));
      setPositions([]);
      setSelected({});
      setFlattening(false);
      return;
    }
    try {
      const token = await getToken();
      await fetch(`${API}/tradovate/flatten`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Typee": "application/json" },
        body: JSON.stringify({ all: true })
      });
      setSelected({});
      await fetchPositions();
    } catch (err) { setError("Flatten misslyckades: " + err.message); }
    setFlattening(false);
  };

  // Cancelera ALLA pending orders
  const cancelAllOrders = async () => {
    setConfirmAll(false);
    setCancellingOrders(true); setError(null);
    if (demoMode) {
      await new Promise(r => setTimeout(r, 800));
      setCancellingOrders(false);
      setError(null);
      // Show en bekräftelse i demo mode
      setError("🎭 DEMO: All pending orders cancelerade!");
      setTimeout(() => setError(null), 3000);
      return;
    }
    try {
      const token = await getToken();
      const res = await fetch(`${API}/tradovate/cancelorders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Typee": "application/json" },
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      setError(`✓ ${result.message}`);
      setTimeout(() => setError(null), 3000);
    } catch (err) { setError("Cancel misslyckades: " + err.message); }
    setCancellingOrders(false);
  };

  // Show alltid så demo mode är tillgängligt

  const hasPositions = positions.length > 0;

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      width: expanded ? 340 : 200,
      background: C.surface || C.surface,
      border: `2px solid ${demoMode ? "#a78bfa66" : hasPositions ? "#ff3d5a66" : C.border}`,
      borderRadius: 14,
      boxShadow: hasPositions ? "0 0 30px #ff3d5a22" : "0 8px 32px #00000099",
      transition: "width 0.2s",
      overflow: "hidden",
      fontFamily: "'DM Sans', sans-serif",
    }}>

      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: "10px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: expanded ? `1px solid ${C.border}` : "none",
          cursor: "pointer",
          background: hasPositions ? `${C.red}08` : "transparent",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: hasPositions ? C.red : C.green,
            boxShadow: `0 0 6px ${hasPositions ? C.red : C.green}`,
            animation: hasPositions ? "pulse 1.5s ease-in-out infinite" : "none",
          }}/>
          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: C.text, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {hasPositions ? `${positions.length} Open` : "No Positions"}
          </span>
          {hasPositions && (
            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: totalUnrealized >= 0 ? C.green : C.red }}>
              {totalUnrealized >= 0 ? "+" : ""}${Math.round(totalUnrealized)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {loading && <div style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, animation: "spin 0.8s linear infinite" }}/>}
          <button
            onClick={e => { e.stopPropagation(); setDemoMode(d => !d); setPositions([]); setSelected({}); }}
            style={{ background: demoMode ? `${C.purple}22` : "transparent", border: `1px solid ${demoMode ? "#a78bfa66" : C.border}`, borderRadius: 4, padding: "2px 7px", cursor: "pointer", fontFamily: "'Space Mono',monospace", fontSize: 8, color: demoMode ? C.purple : C.muted, letterSpacing: "0.05em" }}
            title="Test without Tradovate"
          >DEMO</button>
          <span style={{ color: C.muted, fontSize: 12 }}>{expanded ? "▼" : "▲"}</span>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>

          {/* Demo banner */}
          {demoMode && (
            <div style={{ background: `${C.purple}15`, border: `1px solid ${C.purple}44`, borderRadius: 6, padding: "6px 10px", fontSize: 10, color: C.purple, fontFamily: "'Space Mono',monospace", textAlign: "center" }}>
              🎭 DEMO MODE — no real orders are sent
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}44`, borderRadius: 6, padding: "6px 10px", fontSize: 11, color: C.red }}>
              ⚠ {error}
            </div>
          )}

          {/* Positions list */}
          {hasPositions ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 200, overflowY: "auto" }}>
                {positions.map(p => (
                  <div
                    key={p.id}
                    onClick={() => toggleSelect(p.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 10px", borderRadius: 8, cursor: "pointer",
                      background: selected[p.id] ? `${C.red}18` : C.card,
                      border: `1px solid ${selected[p.id] ? "#ff3d5a55" : C.border}`,
                      transition: "all 0.12s",
                    }}
                  >
                    {/* Checkbox */}
                    <div style={{
                      width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                      border: `1.5px solid ${selected[p.id] ? C.red : C.muted}`,
                      background: selected[p.id] ? `${C.red}33` : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {selected[p.id] && <span style={{ color: C.red, fontSize: 9 }}>✓</span>}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13 }}>{p.symbol}</span>
                        <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: (p.unrealized || 0) >= 0 ? C.green : C.red }}>
                          {(p.unrealized || 0) >= 0 ? "+" : ""}${Math.round(p.unrealized || 0)}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: p.side === "Long" ? C.green : C.red }}>
                          {p.side} · {Math.abs(p.size)} contracts
                        </span>
                        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: C.muted }}>
                          @ {p.ofgPrice}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Last update */}
              {lastUpdate && (
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: C.muted, textAlign: "center" }}>
                  Updated {lastUpdate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
                {/* Close selected */}
                {selectedIds.length > 0 && (
                  <button
                    onClick={flattenSelected}
                    disabled={flattening || cancellingOrders}
                    style={{
                      width: "100%", padding: "8px", borderRadius: 8, cursor: "pointer",
                      background: `${C.amber}22`, border: `1px solid ${C.amber}66`,
                      color: C.amber, fontFamily: "'Space Mono',monospace",
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                    }}
                  >
                    {flattening ? "Closeer..." : `✕ Close ${selectedIds.length} vald${selectedIds.length > 1 ? "a" : ""}`}
                  </button>
                )}
                {/* Flatten ALL positions */}
                <button
                  onClick={() => setConfirmAll("positions")}
                  disabled={flattening || cancellingOrders}
                  style={{
                    width: "100%", padding: "9px", borderRadius: 8, cursor: "pointer",
                    background: `${C.red}22`, border: `1px solid ${C.red}66`,
                    color: C.red, fontFamily: "'Space Mono',monospace",
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                  }}
                >
                  {flattening ? "Closing positions..." : "🔴 Flatten ALL — Close all positions"}
                </button>
                {/* Cancel alla pending orders */}
                <button
                  onClick={() => setConfirmAll("orders")}
                  disabled={flattening || cancellingOrders}
                  style={{
                    width: "100%", padding: "9px", borderRadius: 8, cursor: "pointer",
                    background: `${C.amber}22`, border: `1px solid ${C.amber}66`,
                    color: C.amber, fontFamily: "'Space Mono',monospace",
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                  }}
                >
                  {cancellingOrders ? "Cancelling orders..." : "⛔ Cancel ALL — Delete all pending orders"}
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "12px 0", fontFamily: "'Space Mono',monospace", fontSize: 11, color: C.muted }}>
              No open positions
            </div>
          )}
        </div>
      )}

      {/* Bekräftelsedialog */}
      {confirmAll && (
        <div style={{
          position: "fixed", inset: 0, background: "#00000088", zIndex: 20000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: C.surface || C.surface,
            border: `1px solid ${confirmAll === "positions" ? "#ff3d5a66" : "#f59e0b66"}`,
            borderRadius: 16, padding: 32, maxWidth: 340, width: "90%", textAlign: "center",
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>
              {confirmAll === "positions" ? "🔴" : "⛔"}
            </div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20, color: confirmAll === "positions" ? C.red : C.amber, marginBottom: 8 }}>
              {confirmAll === "positions" ? "Flatten ALL?" : "Cancel ALL Orders?"}
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: C.textDim, marginBottom: 8 }}>
              {confirmAll === "positions"
                ? <>This closes <strong style={{ color: C.text }}>all {positions.length} open positioner</strong> immediately with market orders.</>
                : <>This cancels <strong style={{ color: C.text }}>all pending limit and stop orderss</strong>. Open positions are not affected.</>
              }
            </div>
            {confirmAll === "positions" && (
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, color: totalUnrealized >= 0 ? C.green : C.red, marginBottom: 24, fontWeight: 700 }}>
                Orealiserat: {totalUnrealized >= 0 ? "+" : ""}${Math.round(totalUnrealized)}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setConfirmAll(false)}
                style={{ flex: 1, padding: "12px", borderRadius: 10, cursor: "pointer", background: "transparent", border: `1px solid ${C.border}`, color: C.textDim, fontFamily: "'Space Mono',monospace", fontSize: 11 }}
              >
                Cancel
              </button>
              <button
                onClick={() => { confirmAll === "positions" ? flattenAll() : cancelAllOrders(); }}
                style={{ flex: 1, padding: "12px", borderRadius: 10, cursor: "pointer", background: confirmAll === "positions" ? `${C.red}22` : `${C.amber}22`, border: `1px solid ${confirmAll === "positions" ? C.red : C.amber}`, color: confirmAll === "positions" ? C.red : C.amber, fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700 }}
              >
                {confirmAll === "positions" ? "Yes, close all" : "Yes, cancel all"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>
    </div>
    
  );
}

// ── NewsTab — Live Economic Calendar (ForexFactory feed) ─────────────────────
function NewsTab({ econFilter, setEconFilter }) {
  const C = useContext(ThemeCtx);
  const [events,  setEvents ] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError  ] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  const fetchCalendar = async () => {
    setLoading(true); setError(null);
    try {
      // Loading via vår backend som proxar ForexFactory (undviker CORS)
      const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const res = await fetch(`${API}/calendar/thisweek`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Backend svarade ${res.status}`);
      const data = await res.json();
      setEvents(data);
      setLastFetch(new Date());
    } catch (err) {
      setError("Could not hämta kalender: " + err.message);
      setEvents([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCalendar(); }, []);

  const impactColor = i => i === "high" ? C.red : i === "medium" ? C.amber : C.muted;
  const impactDots  = i => i === "high" ? 3 : i === "medium" ? 2 : 1;
  const dayNames    = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const today       = new Date().toISOString().slice(0, 10);

  const filtered = econFilter === "all" ? events : events.filter(e => e.impact === econFilter);
  const days     = [...new Set(filtered.map(e => e.date))].sort();
  const upcoming = events.filter(e => e.impact === "high" && e.date >= today && !e.actual).slice(0, 3);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:22}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.textDim,letterSpacing:"0.1em",textTransform:"uppercase"}}>Economic Calendar</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,marginTop:4}}>News & Events</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          {lastFetch && <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>Updated {lastFetch.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</span>}
          <button onClick={fetchCalendar} disabled={loading} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>
            {loading ? "..." : "↻ Refresh"}
          </button>
          <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>Filter:</span>
          {["all","high","medium","low"].map(f => (
            <button key={f} onClick={() => setEconFilter(f)} style={{background:econFilter===f?`${impactColor(f)}22`:C.surface,border:`1px solid ${econFilter===f?impactColor(f)+"66":C.border}`,color:econFilter===f?impactColor(f):C.textDim,borderRadius:6,padding:"4px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,textTransform:"uppercase"}}>
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{display:"flex",alignItems:"center",gap:12,padding:20,color:C.textDim,fontFamily:"'Space Mono',monospace",fontSize:12}}>
          <div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${C.border}`,borderTop:`2px solid ${C.accent}`,animation:"spin 0.8s linear infinite"}}/>
          Loading live calendar from ForexFactory...
        </div>
      )}

      {/* Error */}
      {error && <div style={{background:`${C.amber}11`,border:`1px solid ${C.amber}44`,borderRadius:8,padding:"12px 16px",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.amber}}>⚠ {error}</div>}

      {/* Upcoming high-impact banner */}
      {!loading && upcoming.length > 0 && (
        <div style={{background:`${C.amber}11`,border:`1px solid ${C.amber}44`,borderRadius:10,padding:"14px 18px",display:"flex",alignItems:"center",gap:14}}>
          <span style={{fontSize:22}}>⚡</span>
          <div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.amber,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4}}>Kommande High-Impact Events</div>
            <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
              {upcoming.map(e => (
                <span key={e.id} style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.text}}>
                  <span style={{color:C.amber}}>{e.date.slice(5)} {e.time}</span> — {e.event}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* No events */}
      {!loading && !error && days.length === 0 && (
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:40,textAlign:"center",fontFamily:"'Space Mono',monospace",fontSize:12,color:C.muted}}>
          No USD events this week
        </div>
      )}

      {/* Calendar grouped by day */}
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {days.map(date => {
          const dayEvents = filtered.filter(e => e.date === date);
          if (!dayEvents.length) return null;
          const d = new Date(date + "T12:00:00");
          const hasHigh = dayEvents.some(e => e.impact === "high");
          const isToday = date === today;
          return (
            <div key={date} style={{background:C.card,border:`1px solid ${isToday?`${C.accent}44`:hasHigh?`${C.red}33`:C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"12px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12,background:isToday?`${C.accent}06`:hasHigh?`${C.red}08`:C.surface}}>
                <div style={{width:44,height:44,borderRadius:8,background:isToday?`${C.accent}22`:hasHigh?`${C.red}22`:`${C.accent}11`,border:`1px solid ${isToday?`${C.accent}44`:hasHigh?`${C.red}44`:`${C.accent}33`}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:isToday?C.accent:hasHigh?C.red:C.accent,letterSpacing:"0.05em"}}>{dayNames[d.getDay()]}</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:isToday?C.accent:hasHigh?C.red:C.accent,lineHeight:1}}>{d.getDate()}</div>
                </div>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,display:"flex",alignItems:"center",gap:8}}>
                    {d.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
                    {isToday && <span style={{background:`${C.accent}22`,color:C.accent,border:`1px solid ${C.accent}44`,borderRadius:4,padding:"1px 8px",fontFamily:"'Space Mono',monospace",fontSize:9}}>TODAY</span>}
                  </div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.textDim,marginTop:2}}>{dayEvents.length} event{dayEvents.length>1?"s":""} · {dayEvents.filter(e=>e.impact==="high").length} high impact</div>
                </div>
                {hasHigh && <span style={{marginLeft:"auto",background:`${C.red}22`,color:C.red,border:`1px solid ${C.red}44`,borderRadius:4,padding:"3px 10px",fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700}}>HIGH IMPACT</span>}
              </div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                  {["Time","Currency","Impact","Event","Forecast","Previous","Actual"].map(h => (
                    <th key={h} style={{padding:"8px 18px",textAlign:"left",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.textDim,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:400}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {dayEvents.map((e, i) => (
                    <tr key={e.id} style={{borderBottom:i<dayEvents.length-1?`1px solid ${C.border}`:"none",background:e.impact==="high"?`${C.red}06`:"transparent"}} onMouseEnter={ev=>ev.currentTarget.style.background=C.surface} onMouseLeave={ev=>ev.currentTarget.style.background=e.impact==="high"?`${C.red}06`:"transparent"}>
                      <td style={{padding:"11px 18px",fontFamily:"'Space Mono',monospace",fontSize:12,color:C.accent}}>{e.time}</td>
                      <td style={{padding:"11px 18px"}}><span style={{background:`${C.accent}11`,color:C.accent,borderRadius:4,padding:"2px 8px",fontFamily:"'Space Mono',monospace",fontSize:10}}>{e.currency}</span></td>
                      <td style={{padding:"11px 18px"}}>
                        <div style={{display:"flex",gap:2}}>
                          {Array.from({length:3},(_,k) => <div key={k} style={{width:7,height:7,borderRadius:"50%",background:k<impactDots(e.impact)?impactColor(e.impact):C.border}}/>)}
                        </div>
                      </td>
                      <td style={{padding:"11px 18px",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.text,fontWeight:500}}>{e.event}</td>
                      <td style={{padding:"11px 18px",fontFamily:"'Space Mono',monospace",fontSize:12,color:C.textDim}}>{e.forecast||"—"}</td>
                      <td style={{padding:"11px 18px",fontFamily:"'Space Mono',monospace",fontSize:12,color:C.textDim}}>{e.previous||"—"}</td>
                      <td style={{padding:"11px 18px"}}>
                        {e.actual != null
                          ? <span style={{fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700,color:parseFloat(e.actual)>parseFloat(e.forecast)?C.green:parseFloat(e.actual)<parseFloat(e.forecast)?C.red:C.text}}>{e.actual}</span>
                          : <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>Pending</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const StatCard = ({label,value,sub,color}) => {
  const C = useContext(ThemeCtx);
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"20px 24px",flex:1,minWidth:130,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:color||C.accent,borderRadius:"12px 12px 0 0"}}/>
      <div style={{color:C.textDim,fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>{label}</div>
      <div style={{color:color||C.text,fontSize:26,fontWeight:700,fontFamily:"'Syne',sans-serif",lineHeight:1}}>{value}</div>
      {sub&&<div style={{color:C.muted,fontSize:11,marginTop:6,fontFamily:"'Space Mono',monospace"}}>{sub}</div>}
    </div>
  );
};

const tagColor = t => {
  const C = THEMES.dark; // tagColor uses dark theme colors (not theme-latesitive)
  return ({
    "Kill Zone":C.green,"Displacement":C.accent,"FVG":C.purple,"OB":C.amber,
    "BOS":"#34d399","FOMO":C.red,"Revenge":C.red,"Late entry":C.amber,"Oversize":C.red,
    "Liquidity Sweep":"#f472b6","CHoCH":"#60a5fa"
  }[t]||C.muted);
};

const TagBadge = ({label,onRemove}) => (
  <span style={{display:"inline-flex",alignItems:"center",gap:4,background:`${tagColor(label)}22`,border:`1px solid ${tagColor(label)}66`,color:tagColor(label),borderRadius:20,padding:"2px 10px",fontSize:11,fontFamily:"'Space Mono',monospace",whiteSpace:"nowrap"}}>
    {label}{onRemove&&<span onClick={onRemove} style={{cursor:"pointer",opacity:.7,fontSize:10}}>✕</span>}
  </span>
);

const PnlTip = ({active,payload,label}) => {
  const C = useContext(ThemeCtx);
  if(!active||!payload?.length) return null;
  const v=payload[0].value;
  return <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px"}}><div style={{color:C.textDim,fontSize:11,fontFamily:"'Space Mono',monospace"}}>{label}</div><div style={{color:v>=0?C.green:C.red,fontSize:16,fontWeight:700}}>{v>=0?"+":""}${v?.toLocaleString()}</div></div>;
};

// ── Trade Modal ───────────────────────────────────────────────────────────────
const TradeModal = ({trade,onClose,onSave,globalRules,newsBlockStatus,psychWarning}) => {
  const C = useContext(ThemeCtx);
  const [screenshot,setScreenshot] = useState(trade.screenshot||null);
  const [review,    setReview    ] = useState(trade.review||"");
  const [checks,    setChecks    ] = useState(trade.checks||globalRules.reduce((a,r)=>({...a,[r]:false}),{}));
  const [rating,    setRating    ] = useState(trade.rating||0);
  const [hover,     setHover     ] = useState(0);
  const [tags,      setTags      ] = useState(trade.tags||[]);
  const [tagInput,  setTagInput  ] = useState("");
  const [drag,      setDrag      ] = useState(false);
  const fileRef = useRef();
  const ratingLabels=["","Terrible — broke all rules","Poor — mostly off-plan","Okay — some mistakes","Good — mostly on-plan","Perfect — textbook execution"];
  const handleFile=f=>{if(!f||!f.type.startsWith("image/"))return;const r=new FileReader();r.onload=e=>setScreenshot(e.target.result);r.readAsDataURL(f);};
  const addTag=t=>{if(t&&!tags.includes(t))setTags([...tags,t]);setTagInput("");};
  const score=Object.values(checks).filter(Boolean).length;
  const total=globalRules.length;
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={onClose}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,width:"100%",maxWidth:900,maxHeight:"92vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22}}>{trade.symbol}</span>
            <span style={{background:trade.side==="Long"?`${C.green}18`:`${C.red}18`,color:trade.side==="Long"?C.green:C.red,borderRadius:4,padding:"3px 10px",fontFamily:"'Space Mono',monospace",fontSize:11}}>{trade.side}</span>
            <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,color:trade.pnl>=0?C.green:C.red}}>{trade.pnl>=0?"+":""}${trade.pnl}</span>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted}}>{trade.entry} → {trade.exit} · {trade.holdMin}m hold</span>
            {trade.holdMin<1&&<span style={{background:`${C.red}22`,color:C.red,border:`1px solid ${C.red}44`,borderRadius:4,padding:"2px 10px",fontFamily:"'Space Mono',monospace",fontSize:10}}>⚠ PROP VIOLATION</span>}
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:22}}>✕</button>
        </div>
        {/* News block warning in modal — reads from window.__newsBlockStatus */}
        {newsBlockStatus?.blocked && (
          <div style={{background:C.red+"18",border:`1px solid ${C.red}44`,padding:"10px 24px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:16}}>🚫</span>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.red,fontWeight:700}}>
              NEWS BLOCK GUARD ACTIVE — {newsBlockStatus.reason}
            </span>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr"}}>
          <div style={{padding:24,borderRight:`1px solid ${C.border}`}}>
            <div style={{fontSize:10,fontFamily:"'Space Mono',monospace",color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>Chart Screenshot</div>
            <div style={{border:`2px dashed ${drag?C.accent:C.border}`,borderRadius:10,minHeight:200,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",background:drag?C.accentDim:C.surface,position:"relative"}}
              onClick={()=>fileRef.current.click()} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}>
              {screenshot?<><img src={screenshot} alt="trade" style={{width:"100%",objectFit:"cover",borderRadius:8}}/><button onClick={e=>{e.stopPropagation();setScreenshot(null);}} style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,.6)",border:"none",color:"#fff",borderRadius:4,padding:"2px 8px",cursor:"pointer",fontSize:11}}>Remove</button></>:<><div style={{fontSize:32,marginBottom:8}}>📷</div><div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,textAlign:"center"}}>Drag & drop or click to upload</div></>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
            <div style={{marginTop:16}}>
              <div style={{fontSize:10,fontFamily:"'Space Mono',monospace",color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Setup Tags</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>{tags.map(t=><TagBadge key={t} label={t} onRemove={()=>setTags(tags.filter(x=>x!==t))}/>)}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>{ALL_TAGS.filter(s=>!tags.includes(s)).slice(0,6).map(s=><span key={s} onClick={()=>addTag(s)} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.muted,borderRadius:20,padding:"2px 10px",fontSize:11,fontFamily:"'Space Mono',monospace",cursor:"pointer"}} onMouseEnter={e=>{e.target.style.color=C.text;}} onMouseLeave={e=>{e.target.style.color=C.muted;}}>+ {s}</span>)}</div>
              <div style={{display:"flex",gap:6}}><input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTag(tagInput)} placeholder="Custom tag..." style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:12,outline:"none"}}/><button onClick={()=>addTag(tagInput)} style={{background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11}}>Add</button></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:14}}>
              {[["Entry",trade.entry],["Exit",trade.exit],["R:R",`${trade.rr}R`],["Hold",`${trade.holdMin}m`]].map(([l,v])=>(
                <div key={l} style={{background:C.bg,borderRadius:8,padding:"9px 12px",border:`1px solid ${C.border}`}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>{l}</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,marginTop:3}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{padding:24,display:"flex",flexDirection:"column",gap:18}}>
            <div>
              <div style={{fontSize:10,fontFamily:"'Space Mono',monospace",color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>Trade Rating</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {[1,2,3,4,5].map(s=><div key={s} onClick={()=>setRating(s)} onMouseEnter={()=>setHover(s)} onMouseLeave={()=>setHover(0)} style={{fontSize:26,cursor:"pointer",transition:"transform 0.1s",transform:(hover||rating)>=s?"scale(1.2)":"scale(1)",filter:(hover||rating)>=s?"none":"grayscale(1) opacity(.25)"}}>⭐</div>)}
                {(hover||rating)>0&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim}}>{ratingLabels[hover||rating]}</span>}
              </div>
            </div>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:10,fontFamily:"'Space Mono',monospace",color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Rule Checklist</div>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,color:score===total?C.green:score>=total*.6?C.accent:C.red}}>{score}/{total}</span>
              </div>
              <div style={{height:3,background:C.border,borderRadius:4,marginBottom:12,overflow:"hidden"}}><div style={{height:"100%",borderRadius:4,width:`${(score/total)*100}%`,background:score===total?C.green:score>=total*.6?C.accent:C.red,transition:"width 0.3s"}}/></div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {globalRules.map((rule,i)=>(
                  <label key={i} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
                    <div onClick={()=>setChecks(c=>({...c,[rule]:!c[rule]}))} style={{width:17,height:17,borderRadius:4,flexShrink:0,border:`1.5px solid ${checks[rule]?C.green:C.border}`,background:checks[rule]?C.green+"22":"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",cursor:"pointer"}}>
                      {checks[rule]&&<span style={{color:C.green,fontSize:10}}>✓</span>}
                    </div>
                    <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:checks[rule]?C.text:C.textDim}}>{rule}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{flex:1,display:"flex",flexDirection:"column"}}>
              <div style={{fontSize:10,fontFamily:"'Space Mono',monospace",color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Trade Review</div>
              <textarea value={review} onChange={e=>setReview(e.target.value)} placeholder="What did you do well? What could you improve?" style={{flex:1,minHeight:100,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:12,resize:"vertical",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,lineHeight:1.6,outline:"none"}}/>
            </div>
            <button onClick={()=>onSave({...trade,screenshot,review,checks,rating,tags})} style={{background:`linear-gradient(135deg,${C.accent}22,${C.accent}11)`,border:`1px solid ${C.accent}66`,color:C.accent,borderRadius:8,padding:"12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:700}}>Save Review</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── New Trade Modal — manual entry form ──────────────────────────────────────
const INSTRUMENTS = ["NQ","ES","MNQ","MES","CL","GC","SI","RTY","YM"];

// Contract spec: [pointValue_standard, pointValue_mini, pointValue_micro, tickSize]
const CONTRACT_SPECS = {
  NQ:  { standard: 20,   mini: null, micro: 2,    tick: 0.25, label: "NQ (Nasdaq-100)" },
  MNQ: { standard: null, mini: null, micro: 2,    tick: 0.25, label: "MNQ (Micro NQ)"  },
  ES:  { standard: 50,   mini: null, micro: 5,    tick: 0.25, label: "ES (S&P 500)"    },
  MES: { standard: null, mini: null, micro: 5,    tick: 0.25, label: "MES (Micro ES)"  },
  RTY: { standard: 50,   mini: null, micro: 5,    tick: 0.10, label: "RTY (Russell)"   },
  YM:  { standard: 5,    mini: null, micro: 0.5,  tick: 1,    label: "YM (Dow)"        },
  CL:  { standard: 1000, mini: null, micro: 100,  tick: 0.01, label: "CL (Crude Oil)"  },
  GC:  { standard: 100,  mini: null, micro: 10,   tick: 0.10, label: "GC (Gold)"       },
  SI:  { standard: 5000, mini: null, micro: 1000, tick: 0.005,label: "SI (Silver)"     },
};

const NewTradeModal = ({onClose, onSave, globalRules}) => {
  const C = useContext(ThemeCtx);
  const today = new Date().toISOString().slice(0,10);
  const now   = new Date().toTimeString().slice(0,5);

  const [form, setForm] = useState({
    symbol:       "NQ",
    contractType: "standard", // standard | micro
    side:         "Long",
    trade_date:   today,
    entry_time:   "09:30",
    exit_time:    now,
    entry_price:  "",
    exit_price:   "",
    contracts:    1,
    pnl:          "",
    rr:           "",
    notes:        "",
  });
  const [tags,     setTags]     = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [rating,   setRating]   = useState(0);
  const [hover,    setHover]    = useState(0);
  const [saving,   setSaving]   = useState(false);
  const [checks,   setChecks]   = useState(
    globalRules.reduce((a,r) => ({...a,[r]:false}), {})
  );
  const [error, setError] = useState("");

  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const getPointValue = () => {
    const spec = CONTRACT_SPECS[form.symbol];
    if (!spec) return 20;
    if (form.contractType === "micro" && spec.micro)    return spec.micro;
    if (form.contractType === "standard" && spec.standard) return spec.standard;
    return spec.micro || spec.standard || 20;
  };

  const calcPnl = (ep, xp, ct, side) => {
    if (!ep || !xp || isNaN(ep) || isNaN(xp)) return null;
    const diff = side === "Long" ? xp - ep : ep - xp;
    return Math.round(diff * getPointValue() * ct * 100) / 100;
  };

  const handlePriceChange = (field, val) => {
    const updated = {...form, [field]: val};
    const ep = parseFloat(field === "entry_price" ? val : form.entry_price);
    const xp = parseFloat(field === "exit_price"  ? val : form.exit_price);
    const ct = parseInt(form.contracts) || 1;
    const pnl = calcPnl(ep, xp, ct, form.side);
    setForm(f => ({...f, [field]: val, ...(pnl !== null ? {pnl: pnl.toFixed(2)} : {})}));
  };

  // Recalc P&L when side, contracts or contractType changes
  const recalcPnl = (newForm) => {
    const ep = parseFloat(newForm.entry_price);
    const xp = parseFloat(newForm.exit_price);
    const ct = parseInt(newForm.contracts) || 1;
    const spec = CONTRACT_SPECS[newForm.symbol];
    if (!spec) return newForm;
    const pv = newForm.contractType === "micro" && spec.micro ? spec.micro : (spec.standard || spec.micro || 20);
    if (!isNaN(ep) && !isNaN(xp)) {
      const diff = newForm.side === "Long" ? xp - ep : ep - xp;
      return {...newForm, pnl: (Math.round(diff * pv * ct * 100)/100).toFixed(2)};
    }
    return newForm;
  };

  const calcHoldMin = () => {
    try {
      const [eh,em] = form.entry_time.split(":").map(Number);
      const [xh,xm] = form.exit_time.split(":").map(Number);
      return Math.max(0, (xh*60+xm) - (eh*60+em));
    } catch { return 0; }
  };

  const addTag = t => { if(t && !tags.includes(t)) setTags([...tags,t]); setTagInput(""); };

  const handleSave = async () => {
    if (!form.symbol)           return setError("Symbol is required");
    if (form.pnl === "" || form.pnl === null) return setError("P&L is required — enter prices or type P&L directly");
    setError("");
    setSaving(true);
    try {
      await onSave({
        symbol:       form.symbol,
        contractType: form.contractType,
        side:         form.side,
        trade_date:   form.trade_date,
        entry:        form.entry_time,
        exit:         form.exit_time,
        entry_price:  parseFloat(form.entry_price) || null,
        exit_price:   parseFloat(form.exit_price)  || null,
        contracts:    parseInt(form.contracts) || 1,
        pnl:          parseFloat(form.pnl) || 0,
        rr:           parseFloat(form.rr)  || 0,
        holdMin:      calcHoldMin(),
        tags,
        rating,
        checks,
        review: form.notes,
        screenshot: null,
      });
    } finally {
      setSaving(false);
    }
  };

  const spec     = CONTRACT_SPECS[form.symbol] || {};
  const hasMicro = !!spec.micro;
  const pvLabel  = `$${getPointValue()}/pt`;
  const holdMin  = calcHoldMin();
  const pnlNum   = parseFloat(form.pnl);

  const inp = {
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "8px 12px", color: C.text, fontFamily:"'DM Sans',sans-serif",
    fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box",
  };
  const lbl = {
    fontFamily:"'Space Mono',monospace", fontSize: 9, color: C.muted,
    letterSpacing:"0.1em", textTransform:"uppercase", marginBottom: 5, display:"block"
  };
  const ratingLabels = ["","Terrible","Poor","Okay","Good","Perfect"];

  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={onClose}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,width:"100%",maxWidth:880,maxHeight:"94vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:"16px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:C.text}}>＋ New Trade</div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.1em",marginTop:2}}>MANUAL ENTRY</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:22,padding:"4px 8px"}}>✕</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr"}}>
          {/* LEFT */}
          <div style={{padding:22,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",gap:14}}>

            {/* Symbol + Contract type */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={lbl}>Instrument</label>
                <select value={form.symbol} onChange={e=>{const s=e.target.value;setForm(f=>recalcPnl({...f,symbol:s,contractType:"standard"}));}} style={{...inp,cursor:"pointer"}}>
                  {INSTRUMENTS.map(s=><option key={s} value={s}>{CONTRACT_SPECS[s]?.label||s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Contract type <span style={{color:C.accent}}>{pvLabel}</span></label>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>setForm(f=>recalcPnl({...f,contractType:"standard"}))}
                    style={{flex:1,padding:"8px 4px",borderRadius:8,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,
                      border:`1px solid ${form.contractType==="standard"?C.accent+"66":C.border}`,
                      background:form.contractType==="standard"?C.accentDim:"transparent",
                      color:form.contractType==="standard"?C.accent:C.textDim}}>
                    Standard
                  </button>
                  <button onClick={()=>setForm(f=>recalcPnl({...f,contractType:"micro"}))}
                    disabled={!hasMicro}
                    style={{flex:1,padding:"8px 4px",borderRadius:8,cursor:hasMicro?"pointer":"not-allowed",fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,
                      border:`1px solid ${form.contractType==="micro"?C.purple+"66":C.border}`,
                      background:form.contractType==="micro"?`${C.purple}22`:"transparent",
                      color:form.contractType==="micro"?C.purple:C.textDim,
                      opacity:hasMicro?1:0.4}}>
                    Micro
                  </button>
                </div>
              </div>
            </div>

            {/* Side */}
            <div>
              <label style={lbl}>Direction</label>
              <div style={{display:"flex",gap:8}}>
                {["Long","Short"].map(s=>(
                  <button key={s} onClick={()=>setForm(f=>recalcPnl({...f,side:s}))} style={{
                    flex:1,padding:"10px",borderRadius:8,cursor:"pointer",
                    fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700,
                    border:`1px solid ${form.side===s?(s==="Long"?C.green:C.red)+"66":C.border}`,
                    background:form.side===s?(s==="Long"?C.green:C.red)+"18":"transparent",
                    color:form.side===s?(s==="Long"?C.green:C.red):C.textDim,
                  }}>{s==="Long"?"▲ Long":"▼ Short"}</button>
                ))}
              </div>
            </div>

            {/* Date + Contracts */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={lbl}>Trade Date</label>
                <input type="date" value={form.trade_date} onChange={e=>set("trade_date",e.target.value)} style={inp}/>
              </div>
              <div>
                <label style={lbl}>Contracts</label>
                <input type="number" min="1" step="1" value={form.contracts}
                  onChange={e=>setForm(f=>recalcPnl({...f,contracts:e.target.value}))} style={inp}/>
              </div>
            </div>

            {/* Times */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={lbl}>Entry Time</label>
                <input type="time" value={form.entry_time} onChange={e=>set("entry_time",e.target.value)} style={inp}/>
              </div>
              <div>
                <label style={lbl}>Exit Time</label>
                <input type="time" value={form.exit_time} onChange={e=>set("exit_time",e.target.value)} style={inp}/>
              </div>
            </div>

            {/* Prices — auto-calc P&L */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={lbl}>Entry Price <span style={{color:C.textDim}}>(auto P&L)</span></label>
                <input type="number" step="0.25" placeholder="e.g. 21450.00"
                  value={form.entry_price} onChange={e=>handlePriceChange("entry_price",e.target.value)} style={inp}/>
              </div>
              <div>
                <label style={lbl}>Exit Price</label>
                <input type="number" step="0.25" placeholder="e.g. 21475.00"
                  value={form.exit_price} onChange={e=>handlePriceChange("exit_price",e.target.value)} style={inp}/>
              </div>
            </div>

            {/* P&L + R:R */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={lbl}>Net P&L ($) <span style={{color:C.red}}>*</span></label>
                <input type="number" step="0.01" placeholder="e.g. 500.00"
                  value={form.pnl} onChange={e=>set("pnl",e.target.value)}
                  style={{...inp,
                    borderColor: error && (form.pnl===""||form.pnl===null) ? C.red : C.border,
                    color: form.pnl !== "" ? (pnlNum>=0?C.green:C.red) : C.text,
                    fontWeight: form.pnl !== "" ? 700 : 400,
                  }}/>
              </div>
              <div>
                <label style={lbl}>R:R (optional)</label>
                <input type="number" step="0.1" placeholder="e.g. 2.5"
                  value={form.rr} onChange={e=>set("rr",e.target.value)} style={inp}/>
              </div>
            </div>

            {/* Live summary bar */}
            <div style={{background:C.bg,borderRadius:8,padding:"10px 14px",border:`1px solid ${C.border}`,display:"flex",gap:20,flexWrap:"wrap"}}>
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:C.muted,letterSpacing:"0.08em"}}>HOLD</span>
                <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,
                  color:holdMin<1?C.red:C.text}}>
                  {holdMin}m {holdMin<1&&<span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.red}}>⚠ MIN HOLD</span>}
                </span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:C.muted,letterSpacing:"0.08em"}}>P&L</span>
                <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,
                  color:form.pnl!==""?(pnlNum>=0?C.green:C.red):C.muted}}>
                  {form.pnl!==""?(pnlNum>=0?"+":"")+pnlNum+"$":"–"}
                </span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:C.muted,letterSpacing:"0.08em"}}>CONTRACT</span>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:form.contractType==="micro"?C.purple:C.accent}}>
                  {form.contracts}× {form.symbol} {form.contractType==="micro"?"(Micro)":""}
                </span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:C.muted,letterSpacing:"0.08em"}}>VALUE/PT</span>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.text}}>{pvLabel}</span>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label style={lbl}>Tags</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
                {tags.map(t=><TagBadge key={t} label={t} onRemove={()=>setTags(tags.filter(x=>x!==t))}/>)}
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:7}}>
                {ALL_TAGS.filter(s=>!tags.includes(s)).slice(0,8).map(s=>(
                  <span key={s} onClick={()=>addTag(s)}
                    style={{background:C.surface,border:`1px solid ${C.border}`,color:C.muted,
                      borderRadius:20,padding:"2px 10px",fontSize:11,fontFamily:"'Space Mono',monospace",cursor:"pointer"}}>
                    + {s}
                  </span>
                ))}
              </div>
              <div style={{display:"flex",gap:6}}>
                <input value={tagInput} onChange={e=>setTagInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&addTag(tagInput)}
                  placeholder="Custom tag..." style={{...inp,flex:1}}/>
                <button onClick={()=>addTag(tagInput)}
                  style={{background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:8,padding:"8px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11}}>
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT — rating + rules + notes */}
          <div style={{padding:22,display:"flex",flexDirection:"column",gap:14}}>

            {/* Rating */}
            <div>
              <label style={lbl}>Trade Rating</label>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {[1,2,3,4,5].map(s=>(
                  <div key={s} onClick={()=>setRating(s)} onMouseEnter={()=>setHover(s)} onMouseLeave={()=>setHover(0)}
                    style={{fontSize:26,cursor:"pointer",transition:"transform 0.1s",
                      transform:(hover||rating)>=s?"scale(1.2)":"scale(1)",
                      filter:(hover||rating)>=s?"none":"grayscale(1) opacity(.25)"}}>⭐</div>
                ))}
                {(hover||rating)>0&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim}}>{ratingLabels[hover||rating]}</span>}
              </div>
            </div>

            {/* Rule checklist */}
            {globalRules.length > 0 && (
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <label style={{...lbl,marginBottom:0}}>Rule Checklist</label>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,
                    color:Object.values(checks).filter(Boolean).length===globalRules.length?C.green:C.accent}}>
                    {Object.values(checks).filter(Boolean).length}/{globalRules.length}
                  </span>
                </div>
                <div style={{height:3,background:C.border,borderRadius:4,marginBottom:10,overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:4,background:C.accent,transition:"width 0.3s",
                    width:`${(Object.values(checks).filter(Boolean).length/Math.max(1,globalRules.length))*100}%`}}/>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {globalRules.map((rule,i)=>(
                    <label key={i} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}
                      onClick={()=>setChecks(c=>({...c,[rule]:!c[rule]}))}>
                      <div style={{width:17,height:17,borderRadius:4,flexShrink:0,
                        border:`1.5px solid ${checks[rule]?C.green:C.border}`,
                        background:checks[rule]?C.green+"22":"transparent",
                        display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>
                        {checks[rule]&&<span style={{color:C.green,fontSize:10}}>✓</span>}
                      </div>
                      <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:checks[rule]?C.text:C.textDim}}>{rule}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div style={{flex:1,display:"flex",flexDirection:"column"}}>
              <label style={lbl}>Notes / Review</label>
              <textarea value={form.notes} onChange={e=>set("notes",e.target.value)}
                placeholder="Why did you take this trade? What went well? What could improve?"
                style={{...inp,flex:1,minHeight:120,resize:"vertical",lineHeight:1.6,padding:12}}/>
            </div>

            {/* Error */}
            {error && (
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.red,
                background:C.red+"11",border:`1px solid ${C.red}33`,borderRadius:6,padding:"8px 12px"}}>
                ⚠ {error}
              </div>
            )}

            {/* Save */}
            <button onClick={handleSave} disabled={saving} style={{
              background: saving ? C.border : `linear-gradient(135deg,${C.accent}22,${C.accent}11)`,
              border:`1px solid ${saving?C.border:C.accent+"66"}`,
              color:saving?C.muted:C.accent,borderRadius:8,padding:"13px",
              cursor:saving?"not-allowed":"pointer",fontFamily:"'Space Mono',monospace",
              fontSize:12,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:700,
              transition:"all 0.2s"}}>
              {saving ? "Saving…" : "＋ Save Trade"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


// ── Rule Manager ──────────────────────────────────────────────────────────────
const RuleManager = ({rules,onChange,onClose}) => {
  const C = useContext(ThemeCtx);
  const [nr,setNr]=useState("");
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,.75)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={onClose}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,width:"100%",maxWidth:480,padding:28}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20}}>My Trading Rules</div><button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:20}}>✕</button></div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>{rules.map((r,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,background:C.surface,borderRadius:8,padding:"10px 14px",border:`1px solid ${C.border}`}}><span style={{flex:1,fontFamily:"'DM Sans',sans-serif",fontSize:13}}>{r}</span><button onClick={()=>onChange(rules.filter((_,j)=>j!==i))} style={{background:"transparent",border:"none",color:C.red,cursor:"pointer",fontSize:14,opacity:.7}}>✕</button></div>)}</div>
        <div style={{display:"flex",gap:10}}><input value={nr} onChange={e=>setNr(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&nr.trim()){onChange([...rules,nr.trim()]);setNr("");}}} placeholder="Add a new rule..." style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}/><button onClick={()=>{if(nr.trim()){onChange([...rules,nr.trim()]);setNr("");}}} style={{background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:8,padding:"10px 18px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:12}}>Add</button></div>
      </div>
    </div>
  );
};

// ── AI Feedback ───────────────────────────────────────────────────────────────
const AIFeedback = ({trades, moodScore, habitScore, checkedHabits, allHabits, psychBlocked, todayNote}) => {
  const C = useContext(ThemeCtx);
  const [loading,setLoading]=useState(false);
  const [feedback,setFeedback]=useState(null);
  const [error,setError]=useState(null);

  const [dailyTip,  setDailyTip ] = useState(null);
  const [tipLoading,setTipLoading] = useState(false);

  const getDailyTip = async () => {
    setTipLoading(true);
    try {
      const moodLabels = ["","Frustrated","Anxious","Neutral","Confident","In the zone"];
      const habitList  = allHabits.filter(h=>checkedHabits[h.id]).map(h=>h.label).join(", ") || "None";
      const prompt = `You are a sharp trading psychologist. The trader has:
- Mood today: ${moodScore ? moodLabels[moodScore] + " ("+moodScore+"/5)" : "Not checked in yet"}
- Habits done: ${habitList}
- Journal note: "${todayNote || "None"}"
- Psych guard: ${psychBlocked ? "BLOCKED — below minimum requirements" : "OK — cleared to trade"}
- Recent win rate: ${trades.length ? Math.round((trades.filter(t=>t.pnl>0).length/trades.length)*100)+"%" : "No trades yet"}

Give ONE specific, direct piece of advice for TODAY. Be personal and concrete. ${psychBlocked ? "Include a clear recommendation about whether they should trade today." : ""}
Respond ONLY with JSON: {"tip":"your advice","shouldTrade":true,"reason":"one latetence why","color":"green|amber|red"}`;

      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Typee":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:300,messages:[{role:"user",content:prompt}]})});
      const data = await res.json();
      const text = data.content.map(i=>i.text||"").join("");
      setDailyTip(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch(e) { setDailyTip({tip:"Could not load tip. Try again.",shouldTrade:true,reason:"",color:"amber"}); }
    setTipLoading(false);
  };

  const generate = async () => {
    setLoading(true);setFeedback(null);setError(null);
    try {
      const tagStats={};
      trades.forEach(t=>(t.tags||[]).forEach(tag=>{
        if(!tagStats[tag])tagStats[tag]={wins:0,losses:0,totalPnl:0};
        tagStats[tag].totalPnl+=t.pnl;
        t.pnl>0?tagStats[tag].wins++:tagStats[tag].losses++;
      }));
      const moodLabels = ["","Frustrated","Anxious","Neutral","Confident","In the zone"];
      const prompt=`You are an elite prop firm trading coach for NQ/ES futures scalpers. Analyticse this data and give brutally honest, specific, actionable feedback. Be direct. No generic advice.

TRADING STATS:
- Total trades: ${trades.length}
- Win rate: ${trades.length?Math.round((trades.filter(t=>t.pnl>0).length/trades.length)*100):0}%
- Total P&L: $${trades.reduce((a,b)=>a+b.pnl,0)}
- Avg self-rating: ${trades.length?(trades.reduce((a,b)=>a+(b.rating||0),0)/trades.length).toFixed(1):0}/5
- Lucky trades (low rating, winner): ${trades.filter(t=>t.rating<=2&&t.pnl>0).length}
- Good process, bad outcome: ${trades.filter(t=>t.rating>=4&&t.pnl<0).length}

PSYCHOLOGY:
- Today's mood: ${moodScore ? moodLabels[moodScore]+" ("+moodScore+"/5)" : "No check-in"}
- Habits completed: ${Math.round(habitScore*100)}%
- Psych guard status: ${psychBlocked ? "BLOCKED — trader below minimum mental requirements" : "Cleared"}
- Today's note: "${todayNote || "None"}"

BY SETUP TAG:
${Object.entries(tagStats).map(([tag,s])=>`- ${tag}: ${s.wins}W/${s.losses}L, P&L $${s.totalPnl}`).join("\n")}

Respond ONLY with this JSON (no markdown, no preamble):
{"headline":"one punchy latetence","strengths":["s1","s2"],"weaknesses":["w1","w2"],"patterns":["p1 with numbers","p2 with numbers"],"propFirmWarnings":["pf1","pf2"],"psychInsight":"one latetence linking their psychology to their trading results","weekFocus":"one very specific thing to focus on with a concrete metric","verdict":8}`;

      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Typee":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      const text=data.content.map(i=>i.text||"").join("");
      setFeedback(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch(e){setError("Analytics failed — please try again.");}
    setLoading(false);
  };

  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"18px 22px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.purple,letterSpacing:"0.1em",textTransform:"uppercase"}}>AI Coach</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,marginTop:2}}>Performance Analytics</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={getDailyTip} disabled={tipLoading} style={{background:tipLoading?"transparent":`${C.accent}11`,border:`1px solid ${C.accent}33`,color:C.accent,borderRadius:8,padding:"10px 16px",cursor:tipLoading?"not-allowed":"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,opacity:tipLoading?.6:1}}>
            {tipLoading?"...":"🧠 Today's advice"}
          </button>
          <button onClick={generate} disabled={loading} style={{background:loading?"transparent":`linear-gradient(135deg,${C.purple}33,${C.purple}11)`,border:`1px solid ${C.purple}66`,color:C.purple,borderRadius:8,padding:"10px 16px",cursor:loading?"not-allowed":"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:700,opacity:loading?.6:1}}>
            {loading?"Analyzing...":"✦ Weekly analysis"}
          </button>
        </div>
      </div>

      {/* Daily tip */}
      {dailyTip && (() => {
        const tipColor = dailyTip.color==="green" ? C.green : dailyTip.color==="red" ? C.red : C.amber;
        const tradeBg  = dailyTip.shouldTrade ? `${C.green}11` : `${C.red}11`;
        const tradeBorder = dailyTip.shouldTrade ? `${C.green}44` : `${C.red}44`;
        const tradeColor  = dailyTip.shouldTrade ? C.green : C.red;
        return (
          <div style={{margin:"16px 20px",background:`${tipColor}11`,border:`1px solid ${tipColor}33`,borderRadius:10,padding:"16px 20px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16}}>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:tipColor,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>🧠 Today's advice</div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:C.text,lineHeight:1.6}}>{dailyTip.tip}</div>
                {dailyTip.reason && <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.muted,marginTop:6}}>{dailyTip.reason}</div>}
              </div>
              <div style={{background:tradeBg,border:`1px solid ${tradeBorder}`,borderRadius:8,padding:"8px 14px",textAlign:"center",flexShrink:0}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:tradeColor,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Status</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:13,color:tradeColor}}>{dailyTip.shouldTrade?"✓ TRADE":"✗ WAIT"}</div>
              </div>
            </div>
          </div>
        );
      })()}

      {!feedback&&!loading&&!dailyTip&&<div style={{padding:40,textAlign:"center",color:C.muted,fontFamily:"'DM Sans',sans-serif",fontSize:14}}><div style={{fontSize:36,marginBottom:12}}>🧠</div><div style={{marginBottom:8}}>Get personal AI coaching based on your trades and mental state.</div><div style={{fontSize:12,color:C.muted}}>← <strong style={{color:C.text}}>Today's advice</strong> for quick daily input · <strong style={{color:C.text}}>Weekly analysis</strong> for in-depth feedback</div></div>}
      {loading&&<div style={{padding:40,textAlign:"center"}}><div style={{width:40,height:40,border:`3px solid ${C.border}`,borderTop:`3px solid ${C.purple}`,borderRadius:"50%",margin:"0 auto 16px",animation:"spin 1s linear infinite"}}/><div style={{fontFamily:"'Space Mono',monospace",fontSize:12,color:C.muted}}>Analyticsing your trades...</div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}
      {error&&<div style={{padding:20,color:C.red,fontFamily:"'DM Sans',sans-serif",fontSize:13}}>{error}</div>}
      {feedback&&(
        <div style={{padding:24}}>
          <div style={{display:"flex",alignItems:"center",gap:20,marginBottom:24,padding:20,background:C.surface,borderRadius:12,border:`1px solid ${C.border}`}}>
            <div style={{width:72,height:72,borderRadius:"50%",background:`conic-gradient(${C.purple} ${feedback.verdict*10}%, ${C.border} 0)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative"}}>
              <div style={{width:54,height:54,borderRadius:"50%",background:C.card,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:C.purple}}>{feedback.verdict}</span></div>
            </div>
            <div><div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Overall Score /10</div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:17}}>{feedback.headline}</div></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <div style={{background:C.surface,borderRadius:10,padding:16,border:`1px solid ${C.green}33`}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.green,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>✓ Strengths</div>
              {feedback.strengths?.map((s,i)=><div key={i} style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.text,marginBottom:6,paddingLeft:10,borderLeft:`2px solid ${C.green}`}}>{s}</div>)}
            </div>
            <div style={{background:C.surface,borderRadius:10,padding:16,border:`1px solid ${C.red}33`}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.red,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>✗ Weaknesses</div>
              {feedback.weaknesses?.map((s,i)=><div key={i} style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.text,marginBottom:6,paddingLeft:10,borderLeft:`2px solid ${C.red}`}}>{s}</div>)}
            </div>
          </div>
          <div style={{background:C.surface,borderRadius:10,padding:16,border:`1px solid ${C.accent}22`,marginBottom:16}}>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.accent,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>📊 Key Patterns</div>
            {feedback.patterns?.map((s,i)=><div key={i} style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.text,marginBottom:6,display:"flex",gap:8}}><span style={{color:C.accent,flexShrink:0}}>→</span>{s}</div>)}
          </div>
          {feedback.propFirmWarnings?.length>0&&(
            <div style={{background:`${C.amber}11`,borderRadius:10,padding:16,border:`1px solid ${C.amber}44`,marginBottom:16}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.amber,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>⚠ Prop Firm Risks</div>
              {feedback.propFirmWarnings.map((s,i)=><div key={i} style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.text,marginBottom:6,display:"flex",gap:8}}><span style={{color:C.amber,flexShrink:0}}>!</span>{s}</div>)}
            </div>
          )}
          {feedback.psychInsight && (
            <div style={{background:`${C.purple}11`,borderRadius:10,padding:16,border:`1px solid ${C.purple}33`,marginBottom:16}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.purple,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>🧠 Psychology Insight</div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.text,lineHeight:1.6}}>{feedback.psychInsight}</div>
            </div>
          )}
          <div style={{background:`linear-gradient(135deg,${C.purple}22,${C.purple}08)`,borderRadius:10,padding:16,border:`1px solid ${C.purple}44`}}>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.purple,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>🎯 Focus this week</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:C.text}}>{feedback.weekFocus}</div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── App ───────────────────────────────────────────────────────────────────────

// ── FundVault Logo ────────────────────────────────────────────────────────────
const FundVaultLogo = ({ size = 38, theme = "dark" }) => {
  const isDark  = theme !== "light";
  const bgOuter = isDark ? "#0d1420" : "#0e2a30";
  const bgInner = isDark ? "#111827" : "#102530";
  const ring    = isDark ? "#00e5ff" : "#00c8e0";
  const fColor  = isDark ? "#00e5ff" : "#00c8e0";
  const vColor  = isDark ? "#a78bfa" : "#c4b5fd";
  const bolt    = isDark ? "#00e5ff" : "#00c8e0";
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18.5" fill={bgOuter} stroke={ring} strokeWidth="2"/>
      <circle cx="20" cy="20" r="14.5" fill={bgInner}/>
      <rect x="18.2" y="1"    width="3.6" height="5"   rx="1.8" fill={bolt}/>
      <rect x="18.2" y="34"   width="3.6" height="5"   rx="1.8" fill={bolt}/>
      <rect x="1"    y="18.2" width="5"   height="3.6" rx="1.8" fill={bolt}/>
      <rect x="34"   y="18.2" width="5"   height="3.6" rx="1.8" fill={bolt}/>
      <text x="9.5" y="25" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="15" fill={fColor} letterSpacing="1.5">F</text>
      <text x="21"  y="25" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="15" fill={vColor} letterSpacing="1.5">V</text>
      <line x1="9.5" y1="27.5" x2="30.5" y2="27.5" stroke={vColor} strokeWidth="0.8" opacity="0.45"/>
    </svg>
  );
};


export default function TradingPlatform({ session }) {
  // ── Theme ────────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(() => localStorage.getItem("fv_theme") || "dark");
  const C = THEMES[theme] || THEMES.dark;
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("fv_theme", next);
  };
  const user = session?.user;
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Trader";
  const userInitial = userName.charAt(0).toUpperCase();
  const handleSignOut = () => supabase.auth.signOut();
  // ── Extension gate ─────────────────────────────────────────────────────────
  const [extStatus,  setExtStatus ] = useState("checking"); // checking | installed | missing
  const [tvToken,    setTvToken   ] = useState(null);

  useEffect(() => {
    let resolved = false;

    // Ge extensionen 1.5s på sig att svara
    const timeout = setTimeout(() => {
      if (!resolved) setExtStatus("missing");
    }, 3000);

    const resolve = () => {
      if (resolved) return;   // ← förhindrar infinite loop
      resolved = true;
      setExtStatus("installed");
      clearTimeout(timeout);
    };

    const onReady = () => { resolve(); }; // do NOT re-dispatch (causes infinite loop)

    const onToken = (e) => {
      if (e.detail?.token) {
        resolve();
        setTvToken(e.detail.token);
      }
    };

    window.addEventListener("fundvault-extension-ready", onReady);
    window.addEventListener("fundvault-token", onToken);

    // Send initial request — if extension is already ready it responds immediately den direkt
    window.dispatchEvent(new CustomEvent("fundvault-request-token"));

    return () => {
      window.removeEventListener("fundvault-extension-ready", onReady);
      window.removeEventListener("fundvault-token", onToken);
      clearTimeout(timeout);
    };
  }, []);

  const [tab,        setTab       ] = useState("dashboard");
  const [selTrade,   setSelTrade  ] = useState(null);
  const [showNewTrade, setShowNewTrade] = useState(false);
  const [showRules,  setShowRules ] = useState(false);
  const [trades,     setTrades    ] = useState([]);
  const [rules,      setRules     ] = useState(DEFAULT_RULES);
  const [habits,     setHabits    ] = useState(DEFAULT_HABITS);
  const [mood,       setMood      ] = useState(0);
  const [hChecks,    setHChecks   ] = useState({});
  const [allCheckins,setAllCheckins] = useState({});   // { "2025-03-01": {mood,note,habits} }
  const [psychDate,  setPsychDate  ] = useState(() => new Date().toISOString().slice(0,10));
  const [saveStatus, setSaveStatus ] = useState(null); // null | "saving" | "saved" | "error"
  const isToday = psychDate === new Date().toISOString().slice(0,10);
  const [note,       setNote      ] = useState("");
  const [newHabit,   setNewHabit  ] = useState("");
  const [firms,      setFirms     ] = useState([]);
  const [activeFirm, setActiveFirm] = useState("mffu");
  // ── News blocking settings ───────────────────────────────────────────────
  // ── Psychology guard ────────────────────────────────────────────────────────
  const [psychGuard, setPsychGuard] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fv_psychguard") || "null") || {
      enabled: false, minMood: 3, minHabits: 0.5
    }; } catch { return { enabled:false, minMood:3, minHabits:0.5 }; }
  });
  const sofePsychGuard = (val) => { setPsychGuard(val); localStorage.setItem("fv_psychguard", JSON.stringify(val)); };

  const getPsychReadiness = () => {
    const moodScore   = mood || 0;
    const habitScore  = habits.length ? Object.values(hChecks).filter(Boolean).length / habits.length : 1;
    const blocked     = psychGuard.enabled && (moodScore < psychGuard.minMood || habitScore < psychGuard.minHabits);
    const reasons     = [];
    if (psychGuard.enabled && moodScore < psychGuard.minMood && moodScore > 0)
      reasons.push(`Sinnesstämning ${moodScore}/5 (kräver ${psychGuard.minMood}+)`);
    if (psychGuard.enabled && habitScore < psychGuard.minHabits)
      reasons.push(`Habits ${Math.round(habitScore*100)}% (kräver ${Math.round(psychGuard.minHabits*100)}%+)`);
    if (psychGuard.enabled && moodScore === 0)
      reasons.push("No mood check-in done today");
    return { blocked, moodScore, habitScore, reasons };
  };

  const [newsBlock, setNewsBlock] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fv_newsblock") || "null") || {
      enabled: false, impactLevel: "high", minsBefore: 5, minsAfter: 5
    }; } catch { return { enabled:false, impactLevel:"high", minsBefore:5, minsAfter:5 }; }
  });
  const sofeNewsBlock = (val) => { setNewsBlock(val); localStorage.setItem("fv_newsblock", JSON.stringify(val)); };

  const [showFirmWizard, setShowFirmWizard] = useState(false);
  const [wizardStep,     setWizardStep    ] = useState(1); // 1=firm 2=type 3=size 4=confirm
  const [wizardFirmId,   setWizardFirmId  ] = useState(null);
  const [wizardTypeeId,   setWizardTypeeId  ] = useState(null);
  const [wizardSize,     setWizardSize    ] = useState(50000);
  const [wizardName,     setWizardName    ] = useState("");
  // Returns {blocked:bool, reason:string} based on current time vs red nyheter
  const getNewsBlockStatus = (timeStr) => {
    if (!newsBlock.enabled || !timeStr) return { blocked: false };
    const [h, m] = timeStr.split(":").map(Number);
    const tradeMin = h * 60 + m;
    const today = new Date().toISOString().slice(0,10);
    const highEvents = ECON_EVENTS.filter(e =>
      e.date === today &&
      (newsBlock.impactLevel === "medium"
        ? e.impact === "high" || e.impact === "medium"
        : e.impact === "high")
    );
    for (const ev of highEvents) {
      const [eh, em] = ev.time.split(":").map(Number);
      const evMin = eh * 60 + em;
      if (tradeMin >= evMin - newsBlock.minsBefore && tradeMin <= evMin + newsBlock.minsAfter) {
        return { blocked: true, reason: `${ev.event} kl ${ev.time} (±${newsBlock.minsBefore}/${newsBlock.minsAfter} min)` };
      }
    }
    return { blocked: false };
  };

  const openFirmWizard = () => { setWizardStep(1); setWizardFirmId(null); setWizardTypeeId(null); setWizardSize(50000); setWizardName(""); setShowFirmWizard(true); };
  const [tagFilter,  setTagFilter ] = useState("All");
  const [newRule,    setNewRule   ] = useState({label:"",type:"loss",value:""});
  const [econFilter, setEconFilter] = useState("all");

  // ── Trade Copier state ─────────────────────────────────────────────────────
  const [copierAccounts, setCopierAccounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fv_copier_accounts") || "[]"); }
    catch { return []; }
  });
  const [copierGroups, setCopierGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fv_copier_groups") || "[]"); }
    catch { return []; }
  });
  const [activeGroupId, setActiveGroupId] = useState(() =>
    localStorage.getItem("fv_active_group") || null
  );
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddGroup,   setShowAddGroup  ] = useState(false);
  const [newAcctForm,    setNewAcctForm   ] = useState({ name:"", firm:"mffu", accountSize:"50000", username:"", password:"", accountId:"" });
  const [newGroupForm,   setNewGroupForm  ] = useState({ name:"", accountIds:[] });
  const [editGroupId,    setEditGroupId   ] = useState(null);
  const [copierEnabled,  setCopierEnabled ] = useState(false);
  // Tradovate accounts connected i Accounts tab
  const [tvAccounts,     setTvAccounts    ] = useState([]);
  const [showTvLogin,    setShowTvLogin   ] = useState(false);
  const [tvLoginForm,    setTvLoginForm   ] = useState({username:"",password:"",cid:"",secret:""});
  const [tvLoginLoading, setTvLoginLoading] = useState(false);
  const [tvLoginError,   setTvLoginError  ] = useState("");
  const [tvLoginStep,    setTvLoginStep   ] = useState("credentials"); // "credentials" | "select_account"
  const [tvLoginAccounts,setTvLoginAccounts]=useState([]); // accounts to choose from bland efter login
  const [copierStatus,   setCopierStatus  ] = useState(null); // live backend status
  const [copierLog,      setCopierLog     ] = useState([]);

  // Kopiera API-anrop mot backend
  const startCopierBackend = async (group) => {
    const masterAcc = copierAccounts.find(a => a.isMaster && group.accountIds.includes(a.id));
    const slofeAccs = copierAccounts.filter(a => !a.isMaster && group.accountIds.includes(a.id));
    if (!masterAcc || !slofeAccs.length) return;
    try {
      const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${API}/copier/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Typee": "application/json" },
        body: JSON.stringify({
          masterAccountId: masterAcc.accountId,
          slofeAccountIds: slofeAccs.map(a => a.accountId),
          groupName: group.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCopierEnabled(true);
      pollCopierStatus();
    } catch (err) {
      alert("Failed to start copier: " + err.message);
    }
  };

  const stopCopierBackend = async () => {
    try {
      const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      await fetch(`${API}/copier/stop`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      setCopierEnabled(false);
      setCopierStatus(null);
    } catch {}
  };

  const pollCopierStatus = async () => {
    try {
      const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${API}/copier/status`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setCopierStatus(data);
      setCopierEnabled(data.active && data.connected);
      // Hämta log
      const logRes = await fetch(`${API}/copier/log?limit=20`, { headers: { Authorization: `Bearer ${token}` } });
      const logData = await logRes.json();
      setCopierLog(Array.isArray(logData) ? logData : []);
    } catch {}
  };

  // Polla status var 5s när copier är aktiv
  useEffect(() => {
    if (!copierEnabled) return;
    const interval = setInterval(pollCopierStatus, 5000);
    return () => clearInterval(interval);
  }, [copierEnabled]);

  const sofeCopierAccounts = (data) => {
    setCopierAccounts(data);
    localStorage.setItem("fv_copier_accounts", JSON.stringify(data));
  };
  const sofeCopierGroups = (data) => {
    setCopierGroups(data);
    localStorage.setItem("fv_copier_groups", JSON.stringify(data));
  };
  const setActiveGroup = (id) => {
    setActiveGroupId(id);
    localStorage.setItem("fv_active_group", id || "");
  };
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [syncingTV,     setSyncingTV    ] = useState(false);
  const [tvStatus,         setTvStatus        ] = useState(null);
  const [appMode,          setAppMode         ] = useState(() =>
    localStorage.getItem("fv_mode") || "live"
  ); // "live" | "demo"

  const toggleMode = () => {
    const next = appMode === "demo" ? "live" : "demo";
    setAppMode(next);
    localStorage.setItem("fv_mode", next);
  };
  const isDemo = appMode === "demo";
  // startBalances: manuellt inmatad startbalans per firm (sparas i localStorage)
  const [startBalances,    setStartBalances   ] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fv_startbal") || "{}"); }
    catch { return {}; }
  });
  const [editingBalance,   setEditingBalance  ] = useState(null); // firmId under redigering
  const [editBalVal,       setEditBalVal      ] = useState("");
  const [liveAcctData,     setLiveAcctData    ] = useState(null); // Tradovate live-data när anslutet

  // ── Load trades from API ───────────────────────────────────────────────────
  const loadTrades = useCallback(async () => {
    setLoadingTrades(true);
    // Demo-läge: använd INITIAL_TRADES direkt
    if (localStorage.getItem("fv_mode") === "demo") {
      const today = new Date().toISOString().slice(0,10);
      const dates = Array.from({length:20},(_,i)=>{
        const d = new Date(); d.setDate(d.getDate()-i*1.4|0);
        // Skip weekends
        while(d.getDay()===0||d.getDay()===6) d.setDate(d.getDate()-1);
        return d.toISOString().slice(0,10);
      });
      const demoTrades = [
        {id:1, symbol:"NQ",  side:"Long",  entry:"09:32",exit:"09:47",pnl:820,  rr:2.1,status:"win", tags:["Kill Zone","Displacement","mffu"],   rating:5,checks:{},review:"Perfect execution on AM kill zone. FVG respected.",screenshot:null,holdMin:15,trade_date:dates[0]},
        {id:2, symbol:"ES",  side:"Short", entry:"10:15",exit:"10:28",pnl:-180, rr:-0.9,status:"loss",tags:["FOMO","tradeify"],                   rating:2,checks:{},review:"Chased the move. No confirmation.",screenshot:null,holdMin:13,trade_date:dates[0]},
        {id:3, symbol:"NQ",  side:"Long",  entry:"11:02",exit:"11:19",pnl:1250, rr:3.2,status:"win", tags:["Kill Zone","FVG","mffu"],             rating:5,checks:{},review:"",screenshot:null,holdMin:17,trade_date:dates[1]},
        {id:4, symbol:"NQ",  side:"Short", entry:"13:45",exit:"14:01",pnl:610,  rr:1.5,status:"win", tags:["OB","Displacement","lucid"],          rating:4,checks:{},review:"",screenshot:null,holdMin:16,trade_date:dates[1]},
        {id:5, symbol:"ES",  side:"Long",  entry:"14:30",exit:"14:43",pnl:-90,  rr:-0.4,status:"loss",tags:["Revenge","tradeify"],               rating:1,checks:{},review:"",screenshot:null,holdMin:13,trade_date:dates[2]},
        {id:6, symbol:"NQ",  side:"Long",  entry:"09:15",exit:"09:38",pnl:1640, rr:4.1,status:"win", tags:["Kill Zone","Displacement","mffu"],   rating:5,checks:{},review:"",screenshot:null,holdMin:23,trade_date:dates[2]},
        {id:7, symbol:"NQ",  side:"Short", entry:"15:45",exit:"15:58",pnl:-320, rr:-1.6,status:"loss",tags:["FOMO","Late entry","lucid"],        rating:1,checks:{},review:"",screenshot:null,holdMin:13,trade_date:dates[3]},
        {id:8, symbol:"ES",  side:"Long",  entry:"09:48",exit:"10:05",pnl:1080, rr:2.7,status:"win", tags:["Kill Zone","FVG","tradeify"],        rating:4,checks:{},review:"",screenshot:null,holdMin:17,trade_date:dates[3]},
        {id:9, symbol:"NQ",  side:"Long",  entry:"10:30",exit:"10:44",pnl:760,  rr:1.9,status:"win", tags:["OB","mffu"],                        rating:4,checks:{},review:"",screenshot:null,holdMin:14,trade_date:dates[4]},
        {id:10,symbol:"ES",  side:"Short", entry:"13:00",exit:"13:12",pnl:-150, rr:-0.7,status:"loss",tags:["Revenge","Late entry","lucid"],     rating:2,checks:{},review:"",screenshot:null,holdMin:12,trade_date:dates[4]},
        {id:11,symbol:"MNQ", side:"Long",  entry:"09:05",exit:"09:22",pnl:380,  rr:2.4,status:"win", tags:["Kill Zone","BOS","tradeify"],       rating:4,checks:{},review:"",screenshot:null,holdMin:17,trade_date:dates[5]},
        {id:12,symbol:"NQ",  side:"Long",  entry:"10:45",exit:"11:02",pnl:920,  rr:2.8,status:"win", tags:["FVG","Displacement","mffu"],        rating:5,checks:{},review:"",screenshot:null,holdMin:17,trade_date:dates[5]},
        {id:13,symbol:"ES",  side:"Short", entry:"14:15",exit:"14:29",pnl:-210, rr:-0.8,status:"loss",tags:["FOMO","lucid"],                    rating:2,checks:{},review:"",screenshot:null,holdMin:14,trade_date:dates[6]},
        {id:14,symbol:"NQ",  side:"Long",  entry:"09:35",exit:"09:58",pnl:1420, rr:3.6,status:"win", tags:["Kill Zone","OB","mffu"],            rating:5,checks:{},review:"",screenshot:null,holdMin:23,trade_date:dates[6]},
        {id:15,symbol:"NQ",  side:"Short", entry:"11:30",exit:"11:44",pnl:540,  rr:1.7,status:"win", tags:["CHoCH","Displacement","tradeify"],  rating:4,checks:{},review:"",screenshot:null,holdMin:14,trade_date:dates[7]},
        {id:16,symbol:"ES",  side:"Long",  entry:"15:00",exit:"15:08",pnl:-80,  rr:-0.3,status:"loss",tags:["Late entry","lucid"],             rating:2,checks:{},review:"",screenshot:null,holdMin:8, trade_date:dates[7]},
        {id:17,symbol:"NQ",  side:"Long",  entry:"09:20",exit:"09:41",pnl:1820, rr:4.4,status:"win", tags:["Kill Zone","Liquidity Sweep","mffu"],rating:5,checks:{},review:"",screenshot:null,holdMin:21,trade_date:dates[8]},
        {id:18,symbol:"MNQ", side:"Short", entry:"13:20",exit:"13:35",pnl:290,  rr:1.4,status:"win", tags:["FVG","tradeify"],                  rating:3,checks:{},review:"",screenshot:null,holdMin:15,trade_date:dates[8]},
        {id:19,symbol:"NQ",  side:"Long",  entry:"10:05",exit:"10:19",pnl:680,  rr:2.1,status:"win", tags:["OB","Kill Zone","lucid"],           rating:4,checks:{},review:"",screenshot:null,holdMin:14,trade_date:dates[9]},
        {id:20,symbol:"ES",  side:"Short", entry:"14:50",exit:"15:03",pnl:-130, rr:-0.5,status:"loss",tags:["FOMO","mffu"],                    rating:2,checks:{},review:"",screenshot:null,holdMin:13,trade_date:dates[9]},
      ];
      setTrades(demoTrades);
      setLoadingTrades(false);
      return;
    }
    try {
      const data = await tradesApi.list();
      setTrades(data.map(t => ({
        id:         t.id,
        symbol:     t.symbol,
        side:       t.side,
        entry:      t.entry_time,
        exit:       t.exit_time,
        pnl:        t.pnl,
        rr:         t.rr,
        holdMin:    t.hold_min,
        status:     t.pnl >= 0 ? "win" : "loss",
        tags:       t.tags || [],
        rating:     t.rating || 0,
        review:     t.review || "",
        screenshot: t.screenshot || null,
        checks:     t.rule_checks || {},
        trade_date: t.trade_date,
      })));
    } catch (err) {
      console.error("Failed to load trades:", err);
      setTrades([]); // Show empty list instead of mock data
    }
    setLoadingTrades(false);
  }, []);

  // ── Load rules, habits, check-in, tradovate status on mount ───────────────
  useEffect(() => {
    loadTrades();
    rulesApi.list().then(data => { if (data?.length) setRules(data.map(r => r.label)); }).catch(()=>{});
    psychApi.habits().then(data => { if (data?.length) setHabits(data); }).catch(()=>{});
    const today = new Date().toISOString().slice(0,10);
    // Load last 30 days of check-ins
    const from30 = new Date(); from30.setDate(from30.getDate()-30);
    const fromStr = from30.toISOString().slice(0,10);
    psychApi.checkins({from:fromStr, to:today}).then(data => {
      if (!data?.length) return;
      const map = {};
      data.forEach(d => { map[d.check_date] = {mood:d.mood||0, note:d.note||"", habits:d.habits||{}}; });
      setAllCheckins(map);
      // Load today if existsists
      const todayData = map[today];
      if (todayData) { setMood(todayData.mood); setHChecks(todayData.habits); setNote(todayData.note); }
    }).catch(()=>{});
    // Hämta saved Tradovate accounts
    (async () => {
      try {
        const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const res = await fetch(`${API}/tradovate/connected-accounts`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) setTvAccounts(await res.json());
      } catch {}
    })();

    // Demo-läge: simulera ansluten Tradovate
    if (localStorage.getItem("fv_mode") === "demo") {
      setTvStatus({ connected: true, accountCount: 3, demo: true });
      setLiveAcctData({
        mffu:     {balance:52840,startBalance:50000,peakBalance:53100,todayPnl:820, tradingDays:12,cycleProfit:2840,cycleWinDays:8, bestDayPct:22},
        lucid:    {balance:51180,startBalance:50000,peakBalance:51400,todayPnl:310, tradingDays:9, cycleProfit:1180,cycleWinDays:6, bestDayPct:28},
        tradeify: {balance:51640,startBalance:50000,peakBalance:51900,todayPnl:520, tradingDays:11,cycleProfit:1640,cycleWinDays:7, bestDayPct:31},
      });
    }
    tradovateApi.status().then(async status => {
      setTvStatus(status);
      // Om Tradovate är anslutet — försök hämta live account data
      if (status?.connected) {
        try {
          const token = (await supabase.auth.getSession()).data.session?.access_token;
          const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
          const res = await fetch(`${API}/tradovate/accounts`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setLiveAcctData(data); // data = { mffu: {...}, lucid: {...}, ... }
          }
        } catch { /* faller tillbaka på beräknad data */ }
      }
    }).catch(()=>{});
  }, [loadTrades]);

  // ── Sofe trade (create or update) ─────────────────────────────────────────
  const saveTrade = async (updated) => {
    const payload = {
      symbol:      updated.symbol,
      side:        updated.side,
      entry_time:  updated.entry,
      exit_time:   updated.exit,
      pnl:         Number(updated.pnl) || 0,
      rr:          Number(updated.rr)  || 0,
      hold_min:    updated.holdMin || 0,
      tags:        updated.tags || [],
      rating:      updated.rating || 0,
      review:      updated.review || "",
      screenshot:  updated.screenshot || null,
      rule_checks: updated.checks || {},
      trade_date:  updated.trade_date || new Date().toISOString().slice(0,10),
      contracts:   updated.contracts || 1,
      contract_type: updated.contractType || "standard",
    };
    // In demo mode — add locally without hitting backend
    if (appMode === "demo") {
      const newTrade = {
        ...updated,
        id:         Date.now(),
        pnl:        Number(updated.pnl) || 0,
        rr:         Number(updated.rr) || 0,
        status:     (Number(updated.pnl) || 0) >= 0 ? "win" : "loss",
        trade_date: updated.trade_date || new Date().toISOString().slice(0,10),
      };
      setTrades(tt => [newTrade, ...tt]);
      setSelTrade(null);
      setShowNewTrade(false);
      return;
    }
    try {
      const isRealId = typeof updated.id === "string" && updated.id.includes("-");
      if (isRealId) { await tradesApi.update(updated.id, payload); }
      else          { await tradesApi.create(payload); }
      await loadTrades();
    } catch (err) {
      console.error("Save trade failed:", err);
      // Optimistic fallback — add to list even if backend failed
      if (!updated.id) {
        const fallback = {
          ...updated,
          id:     Date.now(),
          pnl:    Number(updated.pnl) || 0,
          rr:     Number(updated.rr) || 0,
          status: (Number(updated.pnl) || 0) >= 0 ? "win" : "loss",
        };
        setTrades(tt => [fallback, ...tt]);
      }
    }
    setSelTrade(null);
    setShowNewTrade(false);
  };

  // ── Sync Tradovate ─────────────────────────────────────────────────────────
  const syncTradovate = async () => {
    setSyncingTV(true);
    try {
      const result = await tradovateApi.sync();
      if (result?.sync,d > 0) { await loadTrades(); alert(`✅ Synced ${result.synced} new trades!`); }
      else alert("No new trades found in Tradovate.");
    } catch (err) { alert("Sync failed: " + err.message); }
    setSyncingTV(false);
  };

  // ── Save check-in ──────────────────────────────────────────────────────────
  const saveCheckin = async () => {
    setSaveStatus("saving");
    const dateToSofe = psychDate;
    const payload = { check_date: dateToSofe, mood, note, habits: hChecks };
    try {
      await psychApi.saveCheckin(payload);
      setAllCheckins(prev => ({...prev, [dateToSofe]: {mood, note, habits: hChecks}}));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2500);
    } catch(e) {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // Load a specific date's check-in data
  const loadCheckinForDate = (date) => {
    setPsychDate(date);
    const existing = allCheckins[date];
    if (existing) {
      setMood(existing.mood || 0);
      setNote(existing.note || "");
      setHChecks(existing.habits || {});
    } else {
      setMood(0);
      setNote("");
      setHChecks({});
    }
  };

  // Helper: switch account type for active firm
  const setFirmAccountTypee = (firmId, typeId) => {
    setFirms(ff => ff.map(f => f.id===firmId ? {...f, activeTypee:typeId} : f));
  };

  // ── Stats beräknade från riktiga trades ──────────────────────────────────────
  // ── Global filter + display unit ─────────────────────────────────────────
  const [globalFilter, setGlobalFilter] = useState("all"); // "all"|"wins"|"losses"|tag
  const [displayUnit,  setDisplayUnit ] = useState("$");   // "$"|"R"|"ticks"
  const TICK_VALUE = 5; // NQ tick = $5

  const filteredTrades = (() => {
    if (globalFilter === "all")    return trades;
    if (globalFilter === "wins")   return trades.filter(t => t.pnl > 0);
    if (globalFilter === "losses") return trades.filter(t => t.pnl < 0);
    return trades.filter(t => (t.tags||[]).includes(globalFilter));
  })();

  const fmt = (val) => {
    if (displayUnit === "R")     return `${(val/200).toFixed(1)}R`;
    if (displayUnit === "ticks") return `${Math.round(val/TICK_VALUE)}t`;
    return `${val>=0?"+":""}$${Math.abs(Math.round(val)).toLocaleString()}`;
  };
  const fmtAbs = (val) => {
    if (displayUnit === "R")     return `${(val/200).toFixed(1)}R`;
    if (displayUnit === "ticks") return `${Math.round(val/TICK_VALUE)}t`;
    return `$${Math.abs(Math.round(val)).toLocaleString()}`;
  };

  const wins     = filteredTrades.filter(d=>d.pnl>0).length;
  const losses   = filteredTrades.filter(d=>d.pnl<0).length;
  const winRate  = filteredTrades.length ? Math.round((wins/filteredTrades.length)*100) : 0;

  // Max Drawdown — beräknas från equity curve (peak-to-trough)
  const maxDD = (() => {
    if (!trades.length) return 0;
    const sorted = [...trades].sort((a,b) => a.trade_date?.localeCompare(b.trade_date));
    let peak = 0, cumPnl = 0, maxDrop = 0;
    sorted.forEach(t => {
      cumPnl += t.pnl;
      if (cumPnl > peak) peak = cumPnl;
      const drop = peak - cumPnl;
      if (drop > maxDrop) maxDrop = drop;
    });
    return Math.round(maxDrop);
  })();
  const totalPnl = filteredTrades.reduce((a,b)=>a+b.pnl,0);
  const ofgWin   = wins   ? Math.round(filteredTrades.filter(d=>d.pnl>0).reduce((a,b)=>a+b.pnl,0)/wins)   : 0;
  const ofgLoss  = losses ? Math.round(Math.abs(filteredTrades.filter(d=>d.pnl<0).reduce((a,b)=>a+b.pnl,0)/losses)) : 0;

  // ── Streak beräkning ───────────────────────────────────────────────────────
  const streakData = (() => {
    const sorted = [...filteredTrades].sort((a,b)=>
      (a.trade_date||"").localeCompare(b.trade_date||"") || (a.entry||"").localeCompare(b.entry||"")
    );
    let curStreak=0, curTypee=null, bestWin=0, bestLoss=0, maxCurLoss=0;
    sorted.forEach(t => {
      const isWin = t.pnl > 0;
      if (curTypee===null) { curTypee=isWin; curStreak=1; }
      else if (isWin===curTypee) curStreak++;
      else { curTypee=isWin; curStreak=1; }
      if (isWin  && curStreak>bestWin)  bestWin=curStreak;
      if (!isWin && curStreak>bestLoss) bestLoss=curStreak;
      if (!isWin && curStreak>maxCurLoss) maxCurLoss=curStreak;
    });
    const lastIsWin = sorted.length ? sorted[sorted.length-1].pnl>0 : null;
    return { current:curStreak, isWin:lastIsWin, bestWin, bestLoss };
  })();

  // Equity curve och daily PnL byggd från riktiga trades
  const pnlByDate = {};
  filteredTrades.forEach(t => { pnlByDate[t.trade_date] = (pnlByDate[t.trade_date]||0) + t.pnl; });
  const LIVE_PNL_DATA = Object.entries(pnlByDate).sort(([a],[b])=>a.localeCompare(b)).map(([date,pnl])=>({date,pnl}));
  const LIVE_EQUITY   = LIVE_PNL_DATA.reduce((acc,d,i)=>{
    const prev = i===0 ? 50000 : acc[i-1].equity;
    return [...acc, {date:d.date, equity: Math.round(prev+d.pnl)}];
  }, []);

  // ── Live hourly data computed from real trades ────────────────────────────
  const liveTimeData = (() => {
    const hourMap = {};
    filteredTrades.forEach(t => {
      const h = t.entry ? t.entry.slice(0,2)+":00" : null;
      if (!h) return;
      if (!hourMap[h]) hourMap[h] = {hour:h, pnl:0, trades:0, wins:0};
      hourMap[h].pnl    += t.pnl;
      hourMap[h].trades += 1;
      if (t.pnl > 0) hourMap[h].wins += 1;
    });
    return Object.values(hourMap).sort((a,b)=>a.hour.localeCompare(b.hour));
  })();

  const ofgRR = filteredTrades.length
    ? (filteredTrades.reduce((a,b)=>a+(b.rr||0),0)/filteredTrades.length).toFixed(1)
    : "0.0";

  // FundVault Score (0-100)
  const edgeScore = (() => {
    if (!filteredTrades.length) return 0;
    const wr  = winRate;
    const rr  = parseFloat(ofgRR);
    const vol = filteredTrades.length >= 10 ? 20 : filteredTrades.length*2;
    const dd  = maxDD > 0 ? Math.max(0, 20 - (maxDD/totalPnl||0)*20) : 20;
    const score = Math.min(100, Math.round(wr*0.4 + Math.min(rr*10,20) + vol + dd));
    return score;
  })();

  const allTags = [...new Set(trades.flatMap(t=>t.tags||[]))];
  const tagStats= allTags.map(tag=>{
    const tg=trades.filter(t=>(t.tags||[]).includes(tag));
    const tw=tg.filter(t=>t.pnl>0);
    return {tag,count:tg.length,wins:tw.length,pnl:tg.reduce((a,b)=>a+b.pnl,0),winRate:Math.round((tw.length/tg.length)*100)};
  }).sort((a,b)=>b.pnl-a.pnl);

  // Loading spinner for trades
  const TradesLoader = () => loadingTrades ? (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,gap:12,color:C.textDim}}>
      <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${C.border}`,borderTop:`2px solid ${C.accent}`,animation:"spin 0.8s linear infinite"}}/>
      Loading trades...
    </div>
  ) : null;

  const propFilteredTrades = tagFilter==="All"?trades:trades.filter(t=>(t.tags||[]).includes(tagFilter));

  const getPropStatus = (rule, acctData) => {
    const a = acctData || {todayPnl:0,peakBalance:50000,balance:50000,startBalance:50000,tradingDays:0,bestDayPct:0};
    if(rule.type==="loss")    { const u=Math.abs(Math.min(0,a.todayPnl));    return {used:u,    pct:u/rule.value,                        status:u>=rule.value?"breach":u>=rule.value*.75?"warning":"ok"}; }
    if(rule.type==="drawdown"){ const dd=a.peakBalance-a.balance;             return {used:dd,   pct:dd/rule.value,                       status:dd>=rule.value?"breach":dd>=rule.value*.75?"warning":"ok"}; }
    if(rule.type==="target")  { const p=a.balance-a.startBalance;             return {used:p,    pct:Math.min(1,p/rule.value),            status:p>=rule.value?"achieved":p>=rule.value*.75?"close":"ok"}; }
    if(rule.type==="days")    {                                                return {used:a.tradingDays,pct:Math.min(1,a.tradingDays/rule.value),status:a.tradingDays>=rule.value?"achieved":"ok"}; }
    if(rule.type==="hold")    { const v=trades.filter(t=>t.holdMin<rule.value).length; return {used:v,pct:v>0?1:0,status:v>0?"breach":"ok"}; }
    if(rule.type==="consist") { const pct=a.bestDayPct||0; return {used:pct, pct:pct/Math.max(rule.value,1), status:pct>=rule.value?"breach":pct>=rule.value*.85?"warning":"ok", isPercent:true}; }
    return {used:0,pct:0,status:"ok"};
  };
  const sc = s => s==="breach"?C.red:s==="warning"?C.amber:s==="achieved"?C.green:s==="close"?C.accent:C.green;
  const sl = s => s==="breach"?"BREACH":s==="warning"?"WARNING":s==="achieved"?"✓ PASSED":s==="close"?"ALMOST":"ON TRACK";

  const cats=[...new Set(habits.map(h=>h.category))];

  const TABS = ["dashboard","analytics","calendar","trades","psychology","propfirm","news","accounts","copier","guide"];
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem("fv_welcomed"));
  const dismissWelcome = () => { setShowWelcome(false); localStorage.setItem("fv_welcomed","1"); };

  // Re-load trades when mode changes
  useEffect(() => { loadTrades(); }, [appMode, loadTrades]);

  return (
    <ThemeCtx.Provider value={C}>
      <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column",transition:"background 0.25s,color 0.25s"}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
      {showNewTrade && <NewTradeModal onClose={()=>setShowNewTrade(false)} onSave={saveTrade} globalRules={rules}/>}
      {selTrade  && <TradeModal trade={selTrade} onClose={()=>setSelTrade(null)} onSave={saveTrade} globalRules={rules} newsBlockStatus={getNewsBlockStatus(selTrade.entry)} psychWarning={getPsychReadiness().blocked ? getPsychReadiness().reasons.join(' · ') : null}/>}

      {/* ── Welcome / Onboarding modal ─────────────────────────────────── */}
      {showWelcome && (
        <div style={{position:"fixed",inset:0,background:"#000000bb",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={dismissWelcome}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:"36px 40px",maxWidth:520,width:"100%",display:"flex",flexDirection:"column",gap:20}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <FundVaultLogo size={48} theme={theme}/>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:C.text}}>Welcome to FundVault!</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.accent,letterSpacing:"0.12em"}}>PROP TRADING JOURNAL</div>
              </div>
            </div>
            <p style={{fontSize:14,color:C.textDim,lineHeight:1.7}}>
              FundVault helps you track your prop firm accounts, manage psychology and follow your rules — all in one place.
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[
                ["📝","Log trades manually","Go to the Trades tab and click + New trade"],
                ["🏢","Add prop firm account","Go to Accounts → Add account"],
                ["🧠","Start your psychology check-in","Go to Psychology and log your mood"],
                ["📖","Read the guide","Click the Guide tab for step-by-step instructions"],
              ].map(([icon,title,desc])=>(
                <div key={title} style={{display:"flex",gap:12,alignItems:"flex-start",background:C.card,borderRadius:10,padding:"10px 14px"}}>
                  <span style={{fontSize:18,lineHeight:1}}>{icon}</span>
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:C.text}}>{title}</div>
                    <div style={{fontSize:12,color:C.textDim}}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{dismissWelcome();setTab("guide");}} style={{flex:1,padding:"11px",borderRadius:10,background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,cursor:"pointer",letterSpacing:"0.05em"}}>
                📖 Show guide
              </button>
              <button onClick={dismissWelcome} style={{flex:1,padding:"11px",borderRadius:10,background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer"}}>
                Get started →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tradovate sync banner ─────────────────────────────────────────── */}
      {!tvStatus?.connected && (
        <div style={{background:`${C.amber}11`,borderBottom:`1px solid ${C.amber}33`,padding:"7px 48px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:13}}>⚡</span>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.amber,letterSpacing:"0.04em"}}>
              Tradovate sync not active — log trades manually for now.
            </span>
          </div>
          <button onClick={()=>setTab("guide")} style={{background:"transparent",border:`1px solid ${C.amber}44`,borderRadius:6,padding:"3px 10px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.amber,letterSpacing:"0.05em",whiteSpace:"nowrap"}}>
            Read guide →
          </button>
        </div>
      )}
      <FlattenWidget tvStatus={tvStatus} theme={theme} C={C}/>
      {showRules && <RuleManager rules={rules} onChange={setRules} onClose={()=>setShowRules(false)}/>}

      {/* Nof */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 48px",height:64,borderBottom:`1px solid ${C.border}`,background:C.surface,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:11}}>
          <FundVaultLogo size={38} theme={theme}/>
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,letterSpacing:"0.06em",color:C.text,lineHeight:1.1}}>FUNDVAULT</span>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:C.accent,letterSpacing:"0.14em",lineHeight:1}}>PROP TRADING JOURNAL</span>
          </div>
        </div>
        <div style={{display:"flex",gap:3}}>
          {TABS.map(t=><button key={t} onClick={()=>setTab(t)} style={{background:tab===t?C.accentDim:"transparent",border:tab===t?`1px solid ${C.accent}44`:"1px solid transparent",color:tab===t?C.accent:C.textDim,borderRadius:6,padding:"5px 11px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:"0.05em",textTransform:"uppercase",transition:"all 0.15s"}}>{t==="propfirm"?"prop firm":t==="guide"?"📖 guide":t}</button>)}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:tvStatus?.connected?C.green:C.muted,boxShadow:tvStatus?.connected?`0 0 8px ${C.green}`:"none"}}/>
          <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.textDim}}>{tvStatus?.connected?"Tradovate · Live":"Manual mode"}</span>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.text,fontWeight:500}}>{userName}</div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>{user?.email}</div>
            </div>
            <div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent}33,${C.purple}33)`,border:`1px solid ${C.accent}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:C.accent}}>{userInitial}</div>
            <button onClick={syncTradovate} disabled={syncingTV} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 10px",cursor:syncingTV?"not-allowed":"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:tvStatus?.connected?C.green:C.muted,letterSpacing:"0.05em",textTransform:"uppercase"}} title={tvStatus?.connected?"Sync trades from Tradovate":"Connect Tradovate first"}>{syncingTV?"Syncing...":tvStatus?.connected?"↻ Sync TV":"TV: Off"}</button>
            <button onClick={toggleTheme}
              style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:13,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center"}}
              title={theme==="dark"?"Switch to light theme":"Switch to dark theme"}>
              {theme==="dark" ? "☀️" : "🌙"}
            </button>
            <button onClick={toggleMode} style={{background:isDemo?`${C.purple}22`:`${C.accent}11`,border:`1px solid ${isDemo?`${C.purple}44`:`${C.accent}22`}`,borderRadius:6,padding:"4px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:isDemo?C.purple:C.accent,fontWeight:700,letterSpacing:"0.05em"}}>
              {isDemo?"🎭 DEMO":"⚡ LIVE"}
            </button>
            <button onClick={handleSignOut} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.05em",textTransform:"uppercase"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.red;e.currentTarget.style.color=C.red;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}>Sign out</button>
          </div>
        </div>
      </div>

      <div style={{flex:1,padding:"32px 48px",maxWidth:1680,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>

        {/* ── DASHBOARD ───────────────────────────────────────────────────────── */}
        {tab==="dashboard"&&(
          <div style={{display:"flex",flexDirection:"column",gap:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
              <div><div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Weekly Overview</div><div style={{fontFamily:"'Syne',sans-serif",fontSize:32,fontWeight:800,marginTop:4}}>Performance <span style={{color:C.accent}}>↗</span></div></div>
              {(()=>{
                const now=new Date();
                const firstDay=new Date(now.getFullYear(),now.getMonth(),1);
                const lastDay=new Date(now.getFullYear(),now.getMonth()+1,0);
                const fmt=d=>d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
                return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 14px",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.textDim}}>{fmt(firstDay)} – {fmt(lastDay)}, {now.getFullYear()}</div>;
              })()}
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <StatCard label="Net P&L"   value={filteredTrades.length ? fmt(totalPnl) : "–"}           sub={globalFilter!=="all"?`Filter: ${globalFilter}`:"This period"}  color={totalPnl>=0?C.green:C.red}/>
              <StatCard label="Win Rate"  value={filteredTrades.length ? `${winRate}%` : "–"}         sub={`${wins}W · ${losses}L`}         color={C.accent}/>
              <StatCard label="Avg Win"   value={ofgWin ? fmtAbs(ofgWin) : "–"}                       sub="Per winning trade"                color={C.green}/>
              <StatCard label="Avg Loss"  value={ofgLoss ? fmtAbs(ofgLoss) : "–"}                     sub="Per losing trade"                 color={C.red}/>
              <StatCard label="Max DD"    value={maxDD ? fmtAbs(maxDD) : "–"}                         sub="Peak-to-trough"                   color={C.red}/>
              <StatCard label="Avg R:R"   value={`${ofgRR}R`}                                         sub="Risk/reward ratio"                color={C.accent}/>
              {/* Streak card */}
              <div style={{background:C.card,border:`1px solid ${streakData.isWin===null?C.border:streakData.isWin?`${C.green}44`:`${C.red}44`}`,borderRadius:14,padding:"20px 24px",minWidth:150,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:streakData.isWin===null?C.border:streakData.isWin?C.green:C.red}}/>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Current Streak</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:28,color:streakData.isWin===null?C.text:streakData.isWin?C.green:C.red,lineHeight:1}}>
                  {streakData.isWin===null?"–":`${streakData.isWin?"🔥":"❄️"} ${streakData.current}`}
                </div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,marginTop:6}}>
                  {streakData.isWin===null?"No trades yet":streakData.isWin?"Win streak":"Loss streak"}
                </div>
                <div style={{display:"flex",gap:10,marginTop:8}}>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.green}}>Best 🔥{streakData.bestWin}</span>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.red}}>Worst ❄️{streakData.bestLoss}</span>
                </div>
              </div>
              {/* EdgeStat Score */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"20px 24px",minWidth:150,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:edgeScore>=70?C.green:edgeScore>=40?C.accent:C.red}}/>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>EdgeStat Score</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:28,color:edgeScore>=70?C.green:edgeScore>=40?C.accent:C.red,lineHeight:1}}>{filteredTrades.length?edgeScore:"–"}</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,marginTop:6}}>{edgeScore>=70?"Elite trader":edgeScore>=50?"Developing":"Needs work"}</div>
                <div style={{height:4,background:C.border,borderRadius:2,marginTop:8,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${edgeScore}%`,background:edgeScore>=70?C.green:edgeScore>=40?C.accent:C.red,borderRadius:2,transition:"width 0.8s ease"}}/>
                </div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>Equity Curve</div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={LIVE_EQUITY.length ? LIVE_EQUITY : EQUITY_DATA}><defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.accent} stopOpacity={.25}/><stop offset="95%" stopColor={C.accent} stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                    <XAxis dataKey="day" tick={{fill:C.muted,fontSize:10,fontFamily:"'Space Mono',monospace"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:C.muted,fontSize:10,fontFamily:"'Space Mono',monospace"}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(1)}k`}/>
                    <Tooltip content={<PnlTip/>}/>
                    <Area type="monotone" dataKey="equity" stroke={C.accent} strokeWidth={2} fill="url(#eg)" dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>Daily P&L</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={LIVE_PNL_DATA.length ? LIVE_PNL_DATA : PNL_DATA}><CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                    <XAxis dataKey="day" tick={{fill:C.muted,fontSize:10,fontFamily:"'Space Mono',monospace"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:C.muted,fontSize:10,fontFamily:"'Space Mono',monospace"}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`}/>
                    <Tooltip content={<PnlTip/>}/><ReferenceLine y={0} stroke={C.border}/>
                    <Bar dataKey="pnl" radius={[4,4,0,0]}>{(LIVE_PNL_DATA.length ? LIVE_PNL_DATA : PNL_DATA).map((d,i)=><Cell key={i} fill={d.pnl>=0?C.green:C.red}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Trade Time Scatter */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Trade Distribution by Time</div>
                <div style={{display:"flex",gap:12}}>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.green,display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:C.green,display:"inline-block"}}/>Win</span>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.red,display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:C.red,display:"inline-block"}}/>Loss</span>
                </div>
              </div>
              <div style={{position:"relative",height:120,background:C.surface,borderRadius:8,overflow:"hidden",padding:"8px 0"}}>
                {/* Kill zone overlays */}
                {[{left:"15%",width:"12%",label:"London KZ"},{left:"58%",width:"12%",label:"NY KZ"}].map(kz=>(
                  <div key={kz.label} style={{position:"absolute",top:0,bottom:0,left:kz.left,width:kz.width,background:"#f59e0b08",borderLeft:"1px dashed #f59e0b33",borderRight:"1px dashed #f59e0b33"}}>
                    <span style={{position:"absolute",top:4,left:2,fontFamily:"'Space Mono',monospace",fontSize:7,color:"#f59e0b88",whiteSpace:"nowrap"}}>{kz.label}</span>
                  </div>
                ))}
                {/* Trade dots */}
                {filteredTrades.filter(t=>t.entry).map((t,i)=>{
                  const [h,m] = (t.entry||"09:00").split(":").map(Number);
                  const totalMin = h*60+m;
                  const leftPct = Math.max(0,Math.min(100,((totalMin-480)/(960-480))*100));
                  const topPct  = 15+((i*37)%70);
                  const size    = Math.max(6,Math.min(18,Math.abs(t.pnl)/100));
                  return (
                    <div key={t.id} title={`${t.symbol} ${t.side} ${t.entry} ${t.pnl>=0?"+":""}$${t.pnl}`}
                      style={{position:"absolute",left:`${leftPct}%`,top:`${topPct}%`,width:size,height:size,borderRadius:"50%",
                        background:t.pnl>=0?C.green:C.red,opacity:0.75,transform:"translate(-50%,-50%)",cursor:"pointer",
                        boxShadow:t.pnl>=0?`0 0 ${size/2}px ${C.green}66`:`0 0 ${size/2}px ${C.red}66`,
                        border:`1px solid ${t.pnl>=0?C.green:C.red}`}}/>
                  );
                })}
                {/* Time axis */}
                <div style={{position:"absolute",bottom:0,left:0,right:0,display:"flex",justifyContent:"space-between",padding:"0 8px"}}>
                  {["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00"].map(t=>(
                    <span key={t} style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:C.muted}}>{t}</span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>
                  Recent Trades {globalFilter!=="all"&&<span style={{color:C.accent,marginLeft:8}}>· {globalFilter}</span>}
                </div>
                <button onClick={()=>setTab("trades")} style={{background:"transparent",border:"none",color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer"}}>View all →</button>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{["Symbol","Side","Entry","Exit","Tags","R:R","P&L"].map(h=><th key={h} style={{padding:"9px 18px",textAlign:"left",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:400}}>{h}</th>)}</tr></thead>
                <tbody>{filteredTrades.slice(0,5).map((t,i)=>(
                  <tr key={t.id} style={{borderBottom:i<4?`1px solid ${C.border}`:"none"}} onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"13px 22px",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15}}>{t.symbol}</td>
                    <td style={{padding:"11px 18px"}}><span style={{background:t.side==="Long"?`${C.green}18`:`${C.red}18`,color:t.side==="Long"?C.green:C.red,borderRadius:4,padding:"2px 8px",fontFamily:"'Space Mono',monospace",fontSize:10}}>{t.side}</span></td>
                    <td style={{padding:"11px 18px",fontFamily:"'Space Mono',monospace",fontSize:12,color:C.textDim}}>{t.entry}</td>
                    <td style={{padding:"11px 18px",fontFamily:"'Space Mono',monospace",fontSize:12,color:C.textDim}}>{t.exit}</td>
                    <td style={{padding:"11px 18px"}}><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{(t.tags||[]).slice(0,2).map(tag=><TagBadge key={tag} label={tag}/>)}</div></td>
                    <td style={{padding:"11px 18px",fontFamily:"'Space Mono',monospace",fontSize:12,color:t.rr>=0?C.green:C.red,fontWeight:700}}>{t.rr}R</td>
                    <td style={{padding:"11px 18px",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:t.pnl>=0?C.green:C.red}}>{fmt(t.pnl)}</td>
                  </tr>
                ))}</tbody>
              </table>
              {propFilteredTrades.length === 0 && (
                <div style={{textAlign:"center",padding:"60px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
                  <div style={{fontSize:40}}>📋</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,color:C.text}}>No trades yet</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:C.muted,maxWidth:300}}>Log your first trade to start tracking your performance.</div>
                  <button onClick={()=>setShowNewTrade(true)} style={{background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:8,padding:"10px 22px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,marginTop:8}}>＋ Log First Trade</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ANALYTICS ───────────────────────────────────────────────────────── */}
        {tab==="analytics"&&(
          <div style={{display:"flex",flexDirection:"column",gap:22}}>
            <div><div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Deep Dive</div><div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,marginTop:4}}>Analytics</div></div>

            {/* Tag performance */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:22}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:16}}>Performance by Setup Tag</div>
              <div style={{display:"flex",flexDirection:"column",gap:9}}>
                {tagStats.map(s=>(
                  <div key={s.tag} style={{display:"grid",gridTemplateColumns:"150px 1fr 80px 80px 80px",alignItems:"center",gap:12,padding:"11px 16px",background:C.surface,borderRadius:10,border:`1px solid ${C.border}`}}>
                    <TagBadge label={s.tag}/>
                    <div style={{position:"relative",height:7,background:C.border,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${s.winRate}%`,background:s.winRate>=60?C.green:s.winRate>=40?C.accent:C.red,borderRadius:4,transition:"width 0.5s"}}/></div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.textDim,textAlign:"center"}}>{s.winRate}% WR</div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.textDim,textAlign:"center"}}>{s.count} trades</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:s.pnl>=0?C.green:C.red,textAlign:"right"}}>{s.pnl>=0?"+":""}${s.pnl}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Time of day */}
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14}}>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>P&L by Time of Day</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={liveTimeData}><CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                    <XAxis dataKey="hour" tick={{fill:C.muted,fontSize:10,fontFamily:"'Space Mono',monospace"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:C.muted,fontSize:10,fontFamily:"'Space Mono',monospace"}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`}/>
                    <Tooltip content={<PnlTip/>}/><ReferenceLine y={0} stroke={C.border}/>
                    <Bar dataKey="pnl" radius={[4,4,0,0]}>{liveTimeData.map((d,i)=><Cell key={i} fill={d.pnl>=0?C.green:C.red}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:10,flexWrap:"wrap"}}>
                  {["London Kill Zone (08-10)","NY Kill Zone (14-16)"].map(z=><span key={z} style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.amber,background:`${C.amber}11`,border:"1px solid #f59e0b33",borderRadius:20,padding:"3px 10px"}}>⚡ {z}</span>)}
                </div>
              </div>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>Win Rate by Hour</div>
                <div style={{display:"flex",flexDirection:"column",gap:9}}>
                  {liveTimeData.length ? liveTimeData.map(d=>{
                    const wr=d.trades?Math.round((d.wins/d.trades)*100):0;
                    return <div key={d.hour} style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,width:42,flexShrink:0}}>{d.hour}</span>
                      <div style={{flex:1,height:6,background:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${wr}%`,background:wr>=60?C.green:wr>=40?C.accent:C.red,borderRadius:3}}/></div>
                      <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:wr>=60?C.green:wr>=40?C.accent:C.red,width:32,textAlign:"right"}}>{wr}%</span>
                    </div>;
                  }) : <div style={{color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11,textAlign:"center",padding:20}}>No trades yet</div>}
                </div>
              </div>
            </div>

            {/* AI Feedback */}
            <AIFeedback trades={filteredTrades} moodScore={mood} habitScore={habits.length?Object.values(hChecks).filter(Boolean).length/habits.length:1} checkedHabits={hChecks} allHabits={habits} psychBlocked={getPsychReadiness().blocked} todayNote={note}/>
          </div>
        )}

        {/* ── CALENDAR ────────────────────────────────────────────────────────── */}
        {tab==="calendar"&&(()=>{
          const now        = new Date();
          const year       = now.getFullYear();
          const month      = now.getMonth();
          const monthLabel = now.toLocaleString("en-US",{month:"long",year:"numeric"});
          const daysInMonth= new Date(year,month+1,0).getDate();
          // firstDay: 0=Sun → remap to Mon-first (0=Mon)
          const firstDay   = ((new Date(year,month,1).getDay()+6)%7);

          // Build pnlByDay from real trades for this month
          const monthStr = `${year}-${String(month+1).padStart(2,"0")}`;
          const calPnl   = {};
          trades.forEach(t => {
            if(t.trade_date?.startsWith(monthStr)) {
              const day = parseInt(t.trade_date.split("-")[2]);
              calPnl[day] = (calPnl[day]||0) + t.pnl;
            }
          });

          const tradingDays = Object.keys(calPnl).length;
          const greenDays   = Object.values(calPnl).filter(p=>p>0).length;
          const redDays     = Object.values(calPnl).filter(p=>p<0).length;
          const monthPnl    = Object.values(calPnl).reduce((a,b)=>a+b,0);
          const bestDay     = tradingDays ? Math.max(...Object.values(calPnl)) : 0;
          const worstDay    = tradingDays ? Math.min(...Object.values(calPnl)) : 0;
          const bestDayNum  = Object.entries(calPnl).find(([,v])=>v===bestDay)?.[0];
          const worstDayNum = Object.entries(calPnl).find(([,v])=>v===worstDay)?.[0];

          return <div style={{display:"flex",flexDirection:"column",gap:22}}>
            <div><div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Monthly View</div><div style={{fontFamily:"'Syne',sans-serif",fontSize:32,fontWeight:800,marginTop:4,textTransform:"capitalize"}}>{monthLabel}</div></div>
            <div style={{display:"flex",gap:12}}>
              <StatCard label="Month P&L"  value={`${monthPnl>=0?"+":""}$${Math.abs(Math.round(monthPnl))}`} sub="Total"                                 color={monthPnl>=0?C.green:C.red}/>
              <StatCard label="Green Days" value={String(greenDays)}   sub={`Out of ${tradingDays}`}          color={C.green}/>
              <StatCard label="Red Days"   value={String(redDays)}     sub={`Out of ${tradingDays}`}          color={C.red}/>
              <StatCard label="Best Day"   value={bestDay?`+$${Math.round(bestDay)}`:"–"}   sub={bestDayNum?`Day ${bestDayNum}`:"No trades"}  color={C.accent}/>
              <StatCard label="Worst Day"  value={worstDay?`-$${Math.abs(Math.round(worstDay))}`:"–"} sub={worstDayNum?`Day ${worstDayNum}`:"No trades"} color={C.red}/>
            </div>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8,marginBottom:8}}>{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><div key={d} style={{textAlign:"center",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,padding:"4px 0"}}>{d}</div>)}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8}}>
                {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
                {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
                  const pnl    = calPnl[day];
                  const dayOfWeek = (new Date(year,month,day).getDay());
                  const isWknd = dayOfWeek===0||dayOfWeek===6;
                  return <div key={day} style={{background:pnl!==undefined?pnl>=0?`${C.green}14`:"#ff3d5a14":isWknd?"transparent":C.surface,border:`1px solid ${pnl!==undefined?pnl>=0?C.green+"44":C.red+"44":C.border}`,borderRadius:8,padding:"9px 8px",minHeight:60,opacity:isWknd&&pnl===undefined?.3:1}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>{day}</div>
                    {pnl!==undefined&&<div style={{marginTop:5,fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:pnl>=0?C.green:C.red}}>{pnl>=0?"+":""}${Math.round(pnl)}</div>}
                  </div>;
                })}
              </div>
            </div>
          </div>;
        })()}

        {/* ── TRADES ──────────────────────────────────────────────────────────── */}
        {tab==="trades"&&(
          <div style={{display:"flex",flexDirection:"column",gap:22}}>
            {newsBlock.enabled && (() => {
              const now = new Date();
              const ts = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
              const st = getNewsBlockStatus(ts);
              if (!st.blocked) return null;
              return <div style={{background:`${C.red}18`,border:`1px solid ${C.red}44`,borderRadius:10,padding:"12px 18px",display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:20}}>🚫</span>
                <div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:12,color:C.red,fontWeight:700}}>NEWS BLOCK GUARD ACTIVE</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,marginTop:2}}>{st.reason}</div>
                </div>
              </div>;
            })()}
            {(() => {
              const ps = getPsychReadiness();
              if (!ps.blocked) return null;
              return <div style={{background:`${C.purple}18`,border:`1px solid ${C.purple}44`,borderRadius:10,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:20}}>🧠</span>
                  <div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:12,color:C.purple,fontWeight:700}}>PSYCHOLOGY GUARD ACTIVE</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,marginTop:2}}>{ps.reasons.join(" · ")}</div>
                  </div>
                </div>
                <button onClick={()=>setTab("psychology")} style={{background:`${C.purple}22`,border:`1px solid ${C.purple}44`,borderRadius:6,padding:"5px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.purple,whiteSpace:"nowrap"}}>
                  → Check-in
                </button>
              </div>;
            })()}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
              <div><div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Trade Log</div><div style={{fontFamily:"'Syne',sans-serif",fontSize:32,fontWeight:800,marginTop:4}}>All Trades</div></div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                <button onClick={()=>setShowNewTrade(true)} style={{background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:7,padding:"7px 16px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,letterSpacing:"0.04em"}}>＋ New Trade</button>
              <button onClick={()=>setShowRules(true)} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.textDim,borderRadius:6,padding:"5px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11}}>⚙ My Rules</button>
                {["All",...allTags].map(f=><button key={f} onClick={()=>setTagFilter(f)} style={{background:tagFilter===f?`${tagColor(f)}22`:C.surface,border:`1px solid ${tagFilter===f?tagColor(f)+"66":C.border}`,color:tagFilter===f?tagColor(f):C.textDim,borderRadius:6,padding:"5px 11px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11}}>{f}</button>)}
              </div>
            </div>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{["#","Symbol","Side","Entry","Exit","Tags","Rating","R:R","P&L","Review",""].map(h=><th key={h} style={{padding:"11px 14px",textAlign:"left",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:400}}>{h}</th>)}</tr></thead>
                <tbody>{propFilteredTrades.map((t,i)=>{
                  const rs=t.checks?Object.values(t.checks).filter(Boolean).length:null;
                  return <tr key={t.id} style={{borderBottom:i<propFilteredTrades.length-1?`1px solid ${C.border}`:"none"}} onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"11px 14px",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted}}>#{t.id}</td>
                    <td style={{padding:"11px 14px",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15}}>{t.symbol}</td>
                    <td style={{padding:"11px 14px"}}><span style={{background:t.side==="Long"?`${C.green}18`:`${C.red}18`,color:t.side==="Long"?C.green:C.red,borderRadius:4,padding:"3px 8px",fontFamily:"'Space Mono',monospace",fontSize:10}}>{t.side}</span></td>
                    <td style={{padding:"11px 14px",fontFamily:"'Space Mono',monospace",fontSize:12,color:C.textDim}}>{t.entry}</td>
                    <td style={{padding:"11px 14px",fontFamily:"'Space Mono',monospace",fontSize:12,color:C.textDim}}>{t.exit}</td>
                    <td style={{padding:"11px 14px"}}><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{(t.tags||[]).slice(0,2).map(tag=><TagBadge key={tag} label={tag}/>)}</div></td>
                    <td style={{padding:"11px 14px"}}>{t.rating?<span>{"⭐".repeat(t.rating)}</span>:<span style={{color:C.muted,fontSize:10}}>–</span>}</td>
                    <td style={{padding:"11px 14px",fontFamily:"'Space Mono',monospace",fontSize:12,color:t.rr>=0?C.green:C.red,fontWeight:700}}>{t.rr}R</td>
                    <td style={{padding:"11px 14px",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:t.pnl>=0?C.green:C.red}}>{t.pnl>=0?"+":""}${t.pnl}</td>
                    <td style={{padding:"11px 14px"}}>{rs!==null?<span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:rs===rules.length?C.green:C.accent}}>{rs}/{rules.length} ✓</span>:<span style={{color:C.muted,fontSize:10}}>–</span>}</td>
                    <td style={{padding:"11px 14px"}}><button onClick={()=>setSelTrade(t)} style={{background:C.accentDim,border:`1px solid ${C.accent}33`,color:C.accent,borderRadius:6,padding:"4px 11px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10}}>Review →</button></td>
                  </tr>;
                })}</tbody>
              </table>
              {propFilteredTrades.length === 0 && (
                <div style={{textAlign:"center",padding:"60px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
                  <div style={{fontSize:40}}>📋</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,color:C.text}}>No trades yet</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:C.muted,maxWidth:300}}>Log your first trade to start tracking your performance.</div>
                  <button onClick={()=>setShowNewTrade(true)} style={{background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:8,padding:"10px 22px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,marginTop:8}}>＋ Log First Trade</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PSYCHOLOGY ──────────────────────────────────────────────────────── */}
        {tab==="psychology"&&(()=>{
          // ── Data prep ────────────────────────────────────────────────────────
          const pnlByDate2 = {};
          trades.forEach(t => { pnlByDate2[t.trade_date] = (pnlByDate2[t.trade_date]||0) + t.pnl; });
          const livePsychData = Object.entries(pnlByDate2)
            .sort(([a],[b])=>a.localeCompare(b)).slice(-14)
            .map(([date, pnl]) => ({
              day:   date.slice(5),
              pnl,
              mood:  allCheckins[date]?.mood || (date===new Date().toISOString().slice(0,10) ? (mood||0) : 0),
              hasCheckin: !!(allCheckins[date] || (date===new Date().toISOString().slice(0,10)&&mood>0)),
            }));

          const moodDays  = livePsychData.filter(d=>d.hasCheckin&&d.mood>0);
          const ofgMood   = moodDays.length ? (moodDays.reduce((a,b)=>a+b.mood,0)/moodDays.length).toFixed(1) : "–";
          const highPnl   = livePsychData.filter(d=>d.mood>=4).reduce((a,b)=>a+b.pnl,0);
          const lowPnl    = livePsychData.filter(d=>d.mood>0&&d.mood<=2).reduce((a,b)=>a+b.pnl,0);
          const checked   = Object.values(hChecks).filter(Boolean).length;

          // Mood streak
          const moodStreak = (() => {
            const recent = [...moodDays].sort((a,b)=>b.day.localeCompare(a.day));
            if (!recent.length) return {count:0,good:true};
            const isGood = recent[0].mood >= 3;
            let count = 0;
            for (const d of recent) { if ((d.mood>=3)===isGood) count++; else break; }
            return {count, good:isGood};
          })();

          // Monthly mood calendar
          const now2       = new Date();
          const year2      = now2.getFullYear();
          const month2     = now2.getMonth();
          const monthStr2  = `${year2}-${String(month2+1).padStart(2,"0")}`;
          const daysInMo   = new Date(year2, month2+1, 0).getDate();
          const firstDay2  = (new Date(year2, month2, 1).getDay()+6)%7;
          const monthLabel2= now2.toLocaleString("en-US",{month:"long",year:"numeric"});

          const moodEmojis  = ["","😤","😟","😐","😊","🔥"];
          const moodLabels2 = ["","Frustr.","Anxious","Neutral","Confident","Zone"];
          const moodColors2 = ["",C.red,C.amber,"#4466aa",C.green,C.purple];

          const hasPsychData = livePsychData.length > 0;

          return <div style={{display:"flex",flexDirection:"column",gap:22}}>

            {/* ── Header ───────────────────────────────────────────────────── */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
              <div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Mental Edge</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:32,fontWeight:800,marginTop:4}}>Psychology <span style={{color:C.purple}}>🧠</span></div>
              </div>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 14px",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.textDim,textTransform:"capitalize"}}>{monthLabel2}</div>
            </div>

            {/* ── Readiness banner (if guard enabled) ──────────────────────── */}
            {psychGuard.enabled && (() => {
              const ps = getPsychReadiness();
              return (
                <div style={{background:ps.blocked?`${C.purple}11`:`${C.green}11`,border:`1px solid ${ps.blocked?`${C.purple}44`:`${C.green}44`}`,borderRadius:12,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:14}}>
                    <div style={{fontSize:28}}>{ps.blocked?"🚫":"✅"}</div>
                    <div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,color:ps.blocked?C.purple:C.green}}>{ps.blocked?"Not ready to trade":"Ready to trade"}</div>
                      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.muted,marginTop:2}}>{ps.blocked ? ps.reasons.join(" · ") : `Mood ${mood?moodEmojis[mood]:"–"} · Habits ${Math.round(ps.habitScore*100)}% ofklarade`}</div>
                    </div>
                  </div>
                  {ps.blocked && <button onClick={()=>setTab("accounts")} style={{background:`${C.purple}22`,border:`1px solid ${C.purple}44`,borderRadius:6,padding:"6px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.purple,whiteSpace:"nowrap"}}>Ändra gräns →</button>}
                </div>
              );
            })()}

            {/* ── Stat cards ───────────────────────────────────────────────── */}
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <StatCard label="Avg Mood"      value={ofgMood!=="–"?`${ofgMood}/5`:"–"}         sub={`${moodDays.length} days logged`}   color={C.purple}/>
              <StatCard label="High Mood P&L" value={highPnl?`${highPnl>=0?"+":""}$${Math.abs(Math.round(highPnl))}`:"–"} sub="Mood ≥ 4 dagar" color={C.green}/>
              <StatCard label="Low Mood P&L"  value={lowPnl?`${lowPnl>=0?"+":""}$${Math.abs(Math.round(lowPnl))}`:"–"}  sub="Mood ≤ 2 dagar" color={C.red}/>
              <StatCard label="Dagens Habits" value={`${checked}/${habits.length}`} sub="Completed today" color={checked>=habits.length*.7?C.green:C.accent}/>
              {/* Mood streak card */}
              <div style={{background:C.card,border:`1px solid ${moodStreak.count>0?(moodStreak.good?`${C.green}44`:`${C.red}44`):C.border}`,borderRadius:14,padding:"20px 24px",minWidth:150,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:moodStreak.count>0?(moodStreak.good?C.green:C.red):C.border}}/>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Mood Streak</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:28,color:moodStreak.count>0?(moodStreak.good?C.green:C.red):C.text,lineHeight:1}}>
                  {moodStreak.count>0?(moodStreak.good?"😊":"😟"):"–"} {moodStreak.count>0?moodStreak.count:""}
                </div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,marginTop:6}}>
                  {moodStreak.count>0?(moodStreak.good?"Positiva dagar i rad":"Bad days in a row"):"No logged check-ins"}
                </div>
              </div>
            </div>

            {/* ── Mood × P&L chart (full width, tall) ─────────────────────── */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Sinnesstämning vs P&L — lateaste 14 dagar</div>
                <div style={{display:"flex",gap:16}}>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.purple,display:"flex",alignItems:"center",gap:5}}><span style={{width:16,height:3,background:C.purple,borderRadius:2,display:"inline-block"}}/>Mood</span>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.green,display:"flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,background:C.green+"44",borderRadius:2,display:"inline-block"}}/>P&L</span>
                </div>
              </div>
              {hasPsychData ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={livePsychData} margin={{top:10,right:20,left:0,bottom:0}}>
                    <defs>
                      <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.purple} stopOpacity={0.25}/>
                        <stop offset="95%" stopColor={C.purple} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                    <XAxis dataKey="day" tick={{fill:C.muted,fontSize:10,fontFamily:"'Space Mono',monospace"}} axisLine={false} tickLine={false}/>
                    <YAxis yAxisId="pnl" tick={{fill:C.muted,fontSize:10,fontFamily:"'Space Mono',monospace"}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`}/>
                    <YAxis yAxisId="mood" orientation="right" domain={[0,5]} tick={{fill:C.muted,fontSize:10,fontFamily:"'Space Mono',monospace"}} axisLine={false} tickLine={false} tickFormatter={v=>v>0?["","😤","😟","😐","😊","🔥"][v]:""}/>
                    <Tooltip contentStyle={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,fontFamily:"'Space Mono',monospace",fontSize:11}}
                      formatter={(val,name)=>name==="mood"?[val>0?["","😤 Frustrated","😟 Anxious","😐 Neutral","😊 Confident","🔥 Zone"][val]:"–","Mood"]:[`$${val}`,"P&L"]}/>
                    <ReferenceLine yAxisId="pnl" y={0} stroke={C.border}/>
                    <Bar yAxisId="pnl" dataKey="pnl" radius={[4,4,0,0]} opacity={0.6} maxBarSize={40}>
                      {livePsychData.map((d,i)=><Cell key={i} fill={d.pnl>=0?C.green:C.red}/>)}
                    </Bar>
                    <Area yAxisId="mood" type="monotone" dataKey="mood" stroke={C.purple} strokeWidth={2.5} fill="url(#moodGrad)"
                      dot={(props)=>{
                        const {cx,cy,payload}=props;
                        if(!payload.hasCheckin||!payload.mood) return null;
                        return <circle cx={cx} cy={cy} r={5} fill={C.purple} stroke={C.bg} strokeWidth={2}/>;
                      }}/>
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{height:220,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11,flexDirection:"column",gap:10}}>
                  <div style={{fontSize:36}}>📈</div>
                  No data yet — log trades and complete check-ins
                </div>
              )}
            </div>

            {/* ── Monthly mood calendar + Check-in grid ────────────────────── */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>

              {/* Mood calendar */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>Mood Calendar</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5,marginBottom:6}}>
                  {["M","T","O","T","F","L","S"].map((d,i)=>(
                    <div key={i} style={{textAlign:"center",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,padding:"2px 0"}}>{d}</div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5}}>
                  {Array.from({length:firstDay2}).map((_,i)=><div key={`e${i}`}/>)}
                  {Array.from({length:daysInMo},(_,i)=>i+1).map(day=>{
                    const dateStr = `${monthStr2}-${String(day).padStart(2,"0")}`;
                    const ci      = allCheckins[dateStr] || (dateStr===new Date().toISOString().slice(0,10)&&mood>0?{mood}:null);
                    const pnl     = pnlByDate2[dateStr];
                    const isToday2= dateStr===new Date().toISOString().slice(0,10);
                    const dow     = new Date(year2,month2,day).getDay();
                    const isWknd  = dow===0||dow===6;
                    const mColor  = ci?.mood ? moodColors2[ci.mood] : null;
                    return (
                      <div key={day}
                        onClick={()=>loadCheckinForDate(dateStr)}
                        title={ci?.mood ? `${moodEmojis[ci.mood]} ${moodLabels2[ci.mood]}${pnl!==undefined?` · $${Math.round(pnl)}`:""}` : dateStr}
                        style={{
                          background: mColor ? mColor+"22" : isWknd?"transparent":C.surface,
                          border:`1px solid ${isToday2?"#a78bfa99":mColor?mColor+"55":C.border}`,
                          borderRadius:6, padding:"5px 4px", minHeight:44,
                          cursor:"pointer", opacity:isWknd&&!ci?.mood?.5:1,
                          transition:"all 0.15s",
                          boxShadow: isToday2?"0 0 0 1px #a78bfa44":"none"
                        }}
                        onMouseEnter={e=>e.currentTarget.style.opacity="1"}
                        onMouseLeave={e=>e.currentTarget.style.opacity=isWknd&&!ci?.mood?"0.5":"1"}>
                        <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:isToday2?C.purple:C.muted}}>{day}</div>
                        {ci?.mood && <div style={{textAlign:"center",fontSize:14,marginTop:1}}>{moodEmojis[ci.mood]}</div>}
                        {pnl!==undefined && <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:pnl>=0?C.green:C.red,marginTop:1,textAlign:"center"}}>{pnl>=0?"+":""}${Math.abs(Math.round(pnl))}</div>}
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
                  {moodColors2.slice(1).map((col,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{fontSize:11}}>{moodEmojis[i+1]}</span>
                      <span style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:C.muted}}>{moodLabels2[i+1]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Today's check-in panel */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                <div style={{padding:"12px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.06em",textTransform:"uppercase"}}>
                    {isToday ? "Dagens Check-In" : <span>📅 {psychDate}</span>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <button onClick={()=>{const d=new Date(psychDate);d.setDate(d.getDate()-1);loadCheckinForDate(d.toISOString().slice(0,10));}}
                      style={{background:C.surface,border:`1px solid ${C.border}`,color:C.textDim,borderRadius:5,padding:"3px 9px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:12}}>‹</button>
                    <input type="date" value={psychDate} max={new Date().toISOString().slice(0,10)}
                      onChange={e=>loadCheckinForDate(e.target.value)}
                      style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,borderRadius:5,padding:"3px 7px",fontFamily:"'Space Mono',monospace",fontSize:10,outline:"none",cursor:"pointer"}}/>
                    <button onClick={()=>{const d=new Date(psychDate);d.setDate(d.getDate()+1);const n=d.toISOString().slice(0,10);if(n<=new Date().toISOString().slice(0,10))loadCheckinForDate(n);}}
                      style={{background:C.surface,border:`1px solid ${C.border}`,color:isToday?C.muted:C.textDim,borderRadius:5,padding:"3px 9px",cursor:isToday?"default":"pointer",fontFamily:"'Space Mono',monospace",fontSize:12,opacity:isToday?.4:1}}>›</button>
                    {!isToday && <button onClick={()=>loadCheckinForDate(new Date().toISOString().slice(0,10))}
                      style={{background:`${C.accent}11`,border:`1px solid ${C.accent}33`,color:C.accent,borderRadius:5,padding:"3px 8px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9}}>Today</button>}
                  </div>
                </div>
                {allCheckins[psychDate] && (
                  <div style={{padding:"6px 18px",background:`${C.green}08`,borderBottom:`1px solid ${C.border}`,fontFamily:"'Space Mono',monospace",fontSize:9,color:C.green}}>✓ Check-in saved — uppdatera nedan</div>
                )}
                <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
                  {/* Mood selector */}
                  <div style={{display:"flex",gap:6}}>
                    {MOOD_OPTIONS.map(m=>(
                      <div key={m.val} onClick={()=>setMood(m.val)}
                        style={{flex:1,padding:"8px 4px",borderRadius:8,cursor:"pointer",textAlign:"center",border:`1px solid ${mood===m.val?"#a78bfa99":C.border}`,background:mood===m.val?`${C.purple}22`:C.surface,transition:"all 0.15s"}}>
                        <div style={{fontSize:20}}>{m.emoji}</div>
                        <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:mood===m.val?C.purple:C.muted,marginTop:3}}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Habits */}
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>
                    {habits.slice(0,5).map(h=>(
                      <label key={h.id} onClick={()=>setHChecks(c=>({...c,[h.id]:!c[h.id]}))}
                        style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer",padding:"6px 10px",borderRadius:7,background:hChecks[h.id]?C.accentDim:C.surface,border:`1px solid ${hChecks[h.id]?C.accent+"44":C.border}`,transition:"all 0.15s"}}>
                        <span style={{fontSize:13}}>{h.icon}</span>
                        <span style={{flex:1,fontFamily:"'DM Sans',sans-serif",fontSize:12,color:hChecks[h.id]?C.text:C.textDim}}>{h.label}</span>
                        <div style={{width:15,height:15,borderRadius:3,border:`1.5px solid ${hChecks[h.id]?C.green:C.border}`,background:hChecks[h.id]?C.green+"22":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>{hChecks[h.id]&&<span style={{color:C.green,fontSize:9}}>✓</span>}</div>
                      </label>
                    ))}
                  </div>
                  {/* Note */}
                  <textarea value={note} onChange={e=>setNote(e.target.value)}
                    placeholder={isToday?"Mindset inför sessionen...":"Notes from today..."}
                    style={{width:"100%",minHeight:60,boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:10,resize:"none",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:12,outline:"none"}}/>
                  {/* Sofe */}
                  <button onClick={saveCheckin} disabled={saveStatus==="saving"||mood===0}
                    style={{width:"100%",background:saveStatus==="saved"?`${C.green}22`:saveStatus==="error"?`${C.red}22`:`${C.purple}22`,border:`1px solid ${saveStatus==="saved"?"#00d08466":saveStatus==="error"?"#ff3d5a66":"#a78bfa66"}`,color:saveStatus==="saved"?C.green:saveStatus==="error"?C.red:C.purple,borderRadius:8,padding:"10px",cursor:mood===0||saveStatus==="saving"?"not-allowed":"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",transition:"all 0.3s",opacity:mood===0?.5:1}}>
                    {saveStatus==="saving"?"💾 Sofer...":saveStatus==="saved"?"✓ Sofet!":saveStatus==="error"?"✗ Error — försök igen":`💾 ${isToday?"Sofe Check-In":"Sofe Historisk"}`}
                  </button>
                  {mood===0&&<div style={{textAlign:"center",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,marginTop:-6}}>Select a mood to save</div>}
                </div>
              </div>
            </div>

            {/* ── Habits manager + History ──────────────────────────────────── */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>

              {/* Habits manager */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20,display:"flex",flexDirection:"column",gap:12}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Hantera Habits</div>
                {cats.map(cat=>(
                  <div key={cat}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.accent,letterSpacing:"0.1em",marginBottom:6}}>{cat.toUpperCase()}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {habits.filter(h=>h.category===cat).map(h=>(
                        <div key={h.id} style={{display:"flex",alignItems:"center",gap:9,background:C.surface,borderRadius:7,padding:"6px 12px",border:`1px solid ${C.border}`}}>
                          <span style={{fontSize:13}}>{h.icon}</span>
                          <span style={{flex:1,fontFamily:"'DM Sans',sans-serif",fontSize:12}}>{h.label}</span>
                          <button onClick={()=>setHabits(hh=>hh.filter(x=>x.id!==h.id))} style={{background:"transparent",border:"none",color:C.red,cursor:"pointer",fontSize:12,opacity:.6}}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div style={{display:"flex",gap:7,marginTop:4}}>
                  <input value={newHabit} onChange={e=>setNewHabit(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter"&&newHabit.trim()){setHabits(hh=>[...hh,{id:Date.now().toString(),label:newHabit.trim(),icon:"⚡",category:"Mindset"}]);setNewHabit("");}}}
                    placeholder="Add rutin..."
                    style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:12,outline:"none"}}/>
                  <button onClick={()=>{if(newHabit.trim()){setHabits(hh=>[...hh,{id:Date.now().toString(),label:newHabit.trim(),icon:"⚡",category:"Mindset"}]);setNewHabit("");}}}
                    style={{background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:7,padding:"8px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:12}}>+ Add</button>
                </div>
              </div>

              {/* Check-in history */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",display:"flex",flexDirection:"column"}}>
                <div style={{padding:"12px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>📋 History</div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>{Object.keys(allCheckins).length} days logged</div>
                </div>
                {Object.keys(allCheckins).length === 0 ? (
                  <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:30,textAlign:"center",color:C.muted,fontFamily:"'DM Sans',sans-serif",fontSize:13}}>
                    <div><div style={{fontSize:28,marginBottom:8}}>🗒</div>No check-ins saved yet</div>
                  </div>
                ) : (
                  <div style={{overflowY:"auto",maxHeight:320}}>
                    {Object.entries(allCheckins).sort(([a],[b])=>b.localeCompare(a)).map(([date,ci])=>{
                      const mColor2   = moodColors2[ci.mood] || C.muted;
                      const habitsChk = Object.values(ci.habits||{}).filter(Boolean).length;
                      const dayTrades = trades.filter(t=>t.trade_date===date);
                      const dayPnl    = dayTrades.reduce((a,t)=>a+t.pnl,0);
                      const isSelected= psychDate===date;
                      const weekday   = new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"});
                      return (
                        <div key={date} onClick={()=>loadCheckinForDate(date)}
                          style={{padding:"10px 18px",borderBottom:`1px solid ${C.border}`,cursor:"pointer",background:isSelected?`${C.purple}08`:"transparent",transition:"background 0.15s"}}
                          onMouseEnter={e=>e.currentTarget.style.background=isSelected?`${C.purple}0c`:C.surface}
                          onMouseLeave={e=>e.currentTarget.style.background=isSelected?`${C.purple}08`:"transparent"}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{minWidth:36,textAlign:"center"}}>
                              <div style={{fontSize:18}}>{moodEmojis[ci.mood]||"–"}</div>
                            </div>
                            <div style={{flex:1}}>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.text,fontWeight:700}}>{date.slice(5)}</span>
                                <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>{weekday}</span>
                                <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:mColor2,background:mColor2+"22",borderRadius:10,padding:"1px 7px"}}>{moodLabels2[ci.mood]||"–"}</span>
                                {habits.length>0&&<span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:habitsChk>=habits.length*.7?C.green:C.muted}}>{habitsChk}/{habits.length}</span>}
                              </div>
                              {ci.note && <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:C.muted,marginTop:3,fontStyle:"italic",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>&quot;{ci.note}&quot;</div>}
                            </div>
                            {dayTrades.length>0 && <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:dayPnl>=0?C.green:C.red,flexShrink:0}}>{dayPnl>=0?"+":""}${Math.abs(Math.round(dayPnl))}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── AI Coach ─────────────────────────────────────────────────── */}
            <AIFeedback trades={filteredTrades} moodScore={mood} habitScore={habits.length?Object.values(hChecks).filter(Boolean).length/habits.length:1} checkedHabits={hChecks} allHabits={habits} psychBlocked={getPsychReadiness().blocked} todayNote={note}/>

          </div>;
        })()}

        {/* ── PROP FIRM ───────────────────────────────────────────────────────── */}
        {tab==="propfirm"&&(()=>{
          // Empty state if no accounts added
          if (!firms.length) return (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:400,gap:20,textAlign:"center"}}>
              <div style={{fontSize:52}}>🏢</div>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:24,marginBottom:8}}>No prop firm accounts</div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:C.muted,maxWidth:380,lineHeight:1.6}}>
                  Add your prop firm account via <strong style={{color:C.text}}>Accounts</strong> tab to to start tracking your rules, drawdown and payouts.
                </div>
              </div>
              <button onClick={()=>setTab("accounts")} style={{background:C.accent,color:"#000",border:"none",borderRadius:10,padding:"12px 28px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700}}>
                → Go to Accounts
              </button>
            </div>
          );

          // Beräkna firm/acctTypee/acct säkert inuti propfirm-tab
          const firm = firms.find(f=>f.id===activeFirm) || firms[0];
          if (!firm) return null;
          const acctTypee = firm.accountTypees.find(t=>t.id===firm.activeTypee) || firm.accountTypees[0];

          const acct = (() => {
            if (liveAcctData?.[activeFirm]) return liveAcctData[activeFirm];
            const firmTrades = trades.filter(t => (t.tags||[]).includes(firm.id) ||
              trades.every(x => !(x.tags||[]).some(tag => ["mffu","lucid","alpha","tpt","tradeify"].includes(tag)))
            );
            const startBalance = startBalances[firm.id] || 50000;
            const today = new Date().toISOString().slice(0,10);
            const todayPnl = firmTrades.filter(t=>t.trade_date===today).reduce((a,t)=>a+t.pnl,0);
            const sorted = [...firmTrades].sort((a,b)=>a.trade_date?.localeCompare(b.trade_date));
            let cumPnl=0, peakPnl=0;
            sorted.forEach(t=>{cumPnl+=t.pnl; if(cumPnl>peakPnl) peakPnl=cumPnl;});
            const balance=startBalance+cumPnl, peakBalance=startBalance+peakPnl;
            const tradingDays=new Set(firmTrades.map(t=>t.trade_date).filter(Boolean)).size;
            const pnlByDay={};
            firmTrades.forEach(t=>{pnlByDay[t.trade_date]=(pnlByDay[t.trade_date]||0)+t.pnl;});
            const cycleWinDays=Object.values(pnlByDay).filter(p=>p>0).length;
            const cycleProfit=Math.round(cumPnl);
            const bestDayPnl=cycleWinDays?Math.max(...Object.values(pnlByDay).filter(p=>p>0)):0;
            const bestDayPct=cycleProfit>0?Math.round((bestDayPnl/cycleProfit)*100):0;
            return {balance,startBalance,peakBalance,todayPnl:Math.round(todayPnl),tradingDays,cycleProfit,cycleWinDays,bestDayPct};
          })();

          const profit  = acct.balance - acct.startBalance;
          const dd      = acct.peakBalance - acct.balance;

          // Start balance editor
          const sofeStartBalance = (firmId, val) => {
            const num = parseFloat(val.replace(/[^0-9.]/g,""));
            if (!num || isNaN(num)) return;
            const updated = { ...startBalances, [firmId]: num };
            setStartBalances(updated);
            localStorage.setItem("fv_startbal", JSON.stringify(updated));
            setEditingBalance(null);
          };
          const po      = acctTypee.payout;
          const dlRule  = acctTypee.rules.find(r=>r.type==="loss");
          const ddRule  = acctTypee.rules.find(r=>r.type==="drawdown");
          const ptRule  = acctTypee.rules.find(r=>r.type==="target");
          return <div style={{display:"flex",flexDirection:"column",gap:22}}>

            {/* Firm selector */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
              <div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.amber,letterSpacing:"0.1em",textTransform:"uppercase"}}>Live Tracking</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,marginTop:4}}>Prop Firm Tracker</div>
              </div>
              {/* Data source badge */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                {liveAcctData
                  ? <span style={{background:`${C.green}18`,border:"1px solid #00d08444",borderRadius:6,padding:"3px 10px",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.green}}>⚡ LIVE — Tradovate</span>
                  : <span style={{background:`${C.accent}11`,border:`1px solid ${C.accent}33`,borderRadius:6,padding:"3px 10px",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.accent}}>📊 Calculated from logged trades</span>
                }
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {firms.map(f=>{
                  const shortNames={"mffu":"MFFU","lucid":"Lucid","alpha":"Alpha","tpt":"TPT","tradeify":"Tradeify"};
                  return <button key={f.id} onClick={()=>setActiveFirm(f.id)} style={{background:activeFirm===f.id?`${f.color}22`:C.surface,border:`1px solid ${activeFirm===f.id?f.color+"55":C.border}`,color:activeFirm===f.id?f.color:C.textDim,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:activeFirm===f.id?700:400,whiteSpace:"nowrap"}}>{shortNames[f.id]||f.name}</button>;
                })}
              </div>
            </div>

            {/* Account Typee Selector */}
            <div style={{background:C.card,border:`1px solid ${firm.color}33`,borderRadius:12,padding:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                <div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:firm.color,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Account Typee — {firm.name}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim}}>{acctTypee.description}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"4px 5px"}}>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,paddingLeft:6,paddingRight:2}}>TYPE:</span>
                  {firm.accountTypees.map(t=>{
                    const isActive=t.id===firm.activeTypee;
                    return <button key={t.id} onClick={()=>setFirmAccountTypee(firm.id,t.id)}
                      style={{background:isActive?`${firm.color}22`:"transparent",border:`1px solid ${isActive?firm.color+"55":"transparent"}`,color:isActive?firm.color:C.muted,borderRadius:6,padding:"5px 11px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:isActive?700:400,transition:"all 0.15s",whiteSpace:"nowrap"}}>
                      {t.label}
                    </button>;
                  })}
                </div>
              </div>

              {/* Comparison grid */}
              <div style={{display:"grid",gridTemplateColumns:`repeat(${firm.accountTypees.length},1fr)`,gap:8}}>
                {firm.accountTypees.map(t=>{
                  const isActive=t.id===firm.activeTypee;
                  const cs=t.rules.find(r=>r.type==="consist");
                  const hasConsist=cs&&cs.value<900;
                  return <div key={t.id} onClick={()=>setFirmAccountTypee(firm.id,t.id)}
                    style={{background:isActive?`${firm.color}0f`:C.surface,border:`1px solid ${isActive?firm.color+"44":C.border}`,borderRadius:10,padding:"13px 14px",cursor:"pointer",transition:"all 0.2s",position:"relative",overflow:"hidden"}}>
                    {isActive&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:firm.color}}/>}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
                      <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:isActive?firm.color:C.text}}>{t.label}</span>
                      <span style={{background:isActive?`${firm.color}22`:"#ffffff0a",color:isActive?firm.color:C.muted,borderRadius:4,padding:"2px 7px",fontFamily:"'Space Mono',monospace",fontSize:9}}>{t.badge}</span>
                    </div>
                    {[["Split",`${t.payoutSplit}%`],["Size",`$${(t.accountSize/1000).toFixed(0)}K`],["Payouts",t.payoutFreq.split(" ")[0]],["Consistency",hasConsist?`${cs.value}% max`:"None ✓"]].map(([lbl,val])=>(
                      <div key={lbl} style={{display:"flex",justifyContent:"space-between",fontFamily:"'Space Mono',monospace",fontSize:10,marginBottom:3}}>
                        <span style={{color:C.muted}}>{lbl}</span>
                        <span style={{color:lbl==="Consistency"?hasConsist?C.amber:C.green:C.text}}>{val}</span>
                      </div>
                    ))}
                  </div>;
                })}
              </div>
            </div>

            {/* Stat cards */}
            <div style={{display:"flex",gap:12}}>
              <StatCard label="Account Balance" value={`$${Math.round(acct.balance).toLocaleString()}`} sub={
                editingBalance === activeFirm
                  ? <span style={{display:"flex",alignItems:"center",gap:4}}>
                      <input autoFocus value={editBalVal} onChange={e=>setEditBalVal(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter")sofeStartBalance(activeFirm,editBalVal);if(e.key==="Escape")setEditingBalance(null);}}
                        style={{width:80,background:C.surface,border:`1px solid ${C.accent}44`,borderRadius:4,padding:"2px 6px",color:C.text,fontFamily:"'Space Mono',monospace",fontSize:10,outline:"none"}}
                        placeholder="50000"/>
                      <button onClick={()=>sofeStartBalance(activeFirm,editBalVal)} style={{background:`${C.accent}22`,border:`1px solid ${C.accent}44`,borderRadius:4,padding:"2px 8px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.accent}}>✓</button>
                      <button onClick={()=>setEditingBalance(null)} style={{background:"transparent",border:"none",cursor:"pointer",color:C.muted,fontSize:12}}>✕</button>
                    </span>
                  : <span style={{cursor:"pointer",color:C.muted,fontSize:10,fontFamily:"'Space Mono',monospace"}}
                      onClick={()=>{setEditingBalance(activeFirm);setEditBalVal(String(acct.startBalance));}}>
                      Start: ${acct.startBalance.toLocaleString()} ✏
                    </span>
              } color={C.accent}/>
              <StatCard label="Total Profit"    value={`$${profit.toLocaleString()}`}                  sub={ptRule?`Target: $${ptRule.value.toLocaleString()}`:"Funded"} color={profit>=0?C.green:C.red}/>
              <StatCard label="Today P&L" value={`${acct.todayPnl>=0?"+":""}$${Math.round(acct.todayPnl).toLocaleString()}`} sub={dlRule?`Limit: -$${dlRule.value.toLocaleString()}`:"No daily limit"} color={acct.todayPnl>=0?C.green:C.red}/>
              <StatCard label="Drawdown"        value={`$${dd.toLocaleString()}`}                      sub={ddRule?`Max: $${ddRule.value.toLocaleString()}`:"—"}          color={ddRule&&dd>ddRule.value*.75?C.red:C.amber}/>
              <StatCard label="Payout Split"    value={`${acctTypee.payoutSplit}%`}                     sub={acctTypee.payoutFreq.split("(")[0].trim()}                    color={firm.color}/>
            </div>

            {/* Rule cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:13}}>
              {acctTypee.rules.map(rule=>{
                const s=getPropStatus(rule, acct); const sColor=sc(s.status);
                return <div key={rule.id} style={{background:C.card,border:`1px solid ${s.status==="breach"?C.red+"66":s.status==="warning"?C.amber+"44":C.border}`,borderRadius:12,padding:20,position:"relative",overflow:"hidden"}}>
                  {(s.status==="breach"||s.status==="warning")&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:sColor}}/>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:11}}>
                    <div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15}}>{rule.label}</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim,marginTop:2}}>{rule.description}</div></div>
                    <span style={{background:`${sColor}22`,border:`1px solid ${sColor}44`,color:sColor,borderRadius:6,padding:"3px 9px",fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,flexShrink:0,marginLeft:8}}>{sl(s.status)}</span>
                  </div>
                  {rule.type!=="hold"&&<>
                    <div style={{height:6,background:C.border,borderRadius:4,marginBottom:7,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,s.pct*100)}%`,background:sColor,borderRadius:4,transition:"width 0.5s"}}/></div>
                    <div style={{display:"flex",justifyContent:"space-between",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted}}>
                      <span>{rule.type==="days"?`${s.used} / ${rule.value} days`:rule.type==="consist"?`${s.used}% best day / ${rule.value}% limit`:`$${(s.used||0).toLocaleString()} / $${rule.value.toLocaleString()}`}</span>
                      <span style={{color:sColor}}>{Math.round(Math.min(s.pct||0,1)*100)}%</span>
                    </div>
                  </>}
                  {rule.type==="hold"&&<div style={{fontFamily:"'Space Mono',monospace",fontSize:12,color:s.status==="breach"?C.red:C.green}}>{s.used===0?"✓ No violations this period":`⚠ ${s.used} trade${s.used>1?"s":""} under minimum hold time`}</div>}
                </div>;
              })}
              {/* Add custom rule */}
              <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:12,padding:20}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>Add Custom Rule</div>
                <input value={newRule.label} onChange={e=>setNewRule(r=>({...r,label:e.target.value}))} placeholder="Rule name..." style={{width:"100%",marginBottom:8,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <select value={newRule.type} onChange={e=>setNewRule(r=>({...r,type:e.target.value}))} style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}>
                    <option value="loss">Daily Loss Limit</option><option value="drawdown">Drawdown</option><option value="target">Profit Target</option><option value="hold">Min Hold Time</option><option value="days">Min Days</option><option value="consist">Consistency %</option>
                  </select>
                  <input type="number" value={newRule.value} onChange={e=>setNewRule(r=>({...r,value:e.target.value}))} placeholder="Value" style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}/>
                </div>
                <button onClick={()=>{
                  if(!newRule.label||!newRule.value)return;
                  const nr={id:Date.now().toString(),label:newRule.label,type:newRule.type,value:Number(newRule.value),description:`Custom: ${newRule.label}`};
                  setFirms(ff=>ff.map(f=>f.id!==activeFirm?f:{...f,accountTypees:f.accountTypees.map(t=>t.id!==f.activeTypee?t:{...t,rules:[...t.rules,nr]})}));
                  setNewRule({label:"",type:"loss",value:""});
                }} style={{width:"100%",background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:8,padding:"10px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase"}}>+ Add Rule</button>
              </div>
            </div>

            {/* ── PAYOUT TRACKER ── */}
            {(()=>{
              const cycPct    = Math.min(1,acct.cycleProfit/po.cycleTarget);
              const daysPct   = Math.min(1,acct.cycleWinDays/po.minDays);
              const noConsist = po.consistency>=900;
              const consistOk = noConsist || acct.bestDayPct<=po.consistency;
              const canPayout = cycPct>=1&&daysPct>=1&&consistOk;
              const consistRisk = !noConsist && acct.bestDayPct>po.consistency*0.8;
              const drawdownRisk= (acct.peakBalance-acct.balance)>(ddRule?.value||2000)*0.6;
              let payoutAdvice=""; let adviceColor=C.accent;
              if(canPayout){payoutAdvice="✓ All conditions met — request payout now";adviceColor=C.green;}
              else if(cycPct>=0.75&&daysPct>=1&&consistOk){payoutAdvice="Almost there — hold off 1–2 sessions to hit target";adviceColor=C.accent;}
              else if(consistRisk&&cycPct>=0.5){payoutAdvice="⚠ Consistency near limit — consider stopping to protect this cycle";adviceColor=C.amber;}
              else if(drawdownRisk&&cycPct>=0.5){payoutAdvice="⚠ Drawdown rising — consider banking profits now";adviceColor=C.amber;}
              else{payoutAdvice=`Still building — $${Math.round((1-cycPct)*po.cycleTarget).toLocaleString()} more needed`;adviceColor=C.textDim;}
              return <div style={{background:C.card,border:`1px solid ${canPayout?C.green+"55":C.border}`,borderRadius:12,padding:22,position:"relative",overflow:"hidden"}}>
                {canPayout&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.green},${C.accent})`}}/>}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
                  <div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:canPayout?C.green:C.amber,letterSpacing:"0.1em",textTransform:"uppercase"}}>Payout Tracker</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,marginTop:2}}>{firm.name} · {acctTypee.label} · {acctTypee.payoutSplit}% Split</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,marginTop:3}}>{acctTypee.payoutFreq} · Min payout ${acctTypee.minPayout}</div>
                  </div>
                  {canPayout&&<div style={{background:C.green+"22",border:`1px solid ${C.green}55`,borderRadius:8,padding:"8px 16px",fontFamily:"'Space Mono',monospace",fontSize:12,color:C.green,fontWeight:700}}>🎉 READY</div>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:20}}>
                  <div style={{background:C.surface,borderRadius:10,padding:16,border:`1px solid ${cycPct>=1?C.green+"44":C.border}`}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Cycle Profit</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:cycPct>=1?C.green:C.text}}>${acct.cycleProfit.toLocaleString()}</div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginTop:2}}>target ${po.cycleTarget.toLocaleString()} · your cut ~${Math.round(acct.cycleProfit*acctTypee.payoutSplit/100).toLocaleString()}</div>
                    <div style={{height:4,background:C.border,borderRadius:2,marginTop:10,overflow:"hidden"}}><div style={{height:"100%",width:`${cycPct*100}%`,background:cycPct>=1?C.green:firm.color,borderRadius:2,transition:"width 0.5s"}}/></div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:cycPct>=1?C.green:C.textDim,marginTop:5}}>{Math.round(cycPct*100)}% of target</div>
                  </div>
                  <div style={{background:C.surface,borderRadius:10,padding:16,border:`1px solid ${daysPct>=1?C.green+"44":C.border}`}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Qualifying Days</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:daysPct>=1?C.green:C.text}}>{acct.cycleWinDays}<span style={{fontSize:14,color:C.muted,fontWeight:400}}> / {po.minDays}</span></div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginTop:2}}>{po.minProfit>0?`$${po.minProfit}+ profit each`:"profitable days"}</div>
                    <div style={{display:"flex",gap:4,marginTop:10}}>{Array.from({length:po.minDays},(_,i)=><div key={i} style={{flex:1,height:8,borderRadius:3,background:i<acct.cycleWinDays?C.green:C.border}}/>)}</div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:daysPct>=1?C.green:C.textDim,marginTop:5}}>{po.minDays-acct.cycleWinDays>0?`${po.minDays-acct.cycleWinDays} more needed`:"✓ Met"}</div>
                  </div>
                  <div style={{background:C.surface,borderRadius:10,padding:16,border:`1px solid ${noConsist?"#34d39933":consistOk?C.green+"44":C.red+"55"}`}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Consistency Rule</div>
                    {noConsist
                      ? <><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:"#34d399"}}>No Rule ✓</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim,marginTop:4}}>This account type has no consistency restriction</div></>
                      : <><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:consistOk?C.text:C.red}}>{acct.bestDayPct}<span style={{fontSize:14,color:C.muted,fontWeight:400}}>%</span></div>
                          <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginTop:2}}>best day · limit {po.consistency}%</div>
                          <div style={{height:4,background:C.border,borderRadius:2,marginTop:10,overflow:"hidden"}}><div style={{height:"100%",width:`${(acct.bestDayPct/po.consistency)*100}%`,background:consistOk?acct.bestDayPct>po.consistency*.8?C.amber:C.green:C.red,borderRadius:2}}/></div>
                          <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:consistOk?C.green:C.red,marginTop:5}}>{consistOk?`${po.consistency-acct.bestDayPct}% headroom`:"⚠ Exceeded"}</div>
                        </>
                    }
                  </div>
                </div>
                <div style={{background:`${adviceColor}0d`,border:`1px solid ${adviceColor}44`,borderRadius:8,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:18}}>{canPayout?"💰":consistRisk||drawdownRisk?"⚠️":"🎯"}</span>
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:adviceColor}}>{payoutAdvice}</div>
                    {canPayout&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim,marginTop:3}}>Estimated payout: <span style={{color:C.green,fontWeight:700}}>${Math.round(acct.cycleProfit*acctTypee.payoutSplit/100).toLocaleString()}</span> after {acctTypee.payoutSplit}% split</div>}
                  </div>
                </div>
              </div>;
            })()}

            {/* Firm overview */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>Your Prop Firms</div>
              <div style={{display:"flex",gap:11,flexWrap:"wrap"}}>
                {firms.map(f=>{
                  const at=f.accountTypees.find(t=>t.id===f.activeTypee)||f.accountTypees[0];
                  const brs=at.rules.filter(r=>getPropStatus(r, acct).status==="breach").length;
                  const wrn=at.rules.filter(r=>getPropStatus(r, acct).status==="warning").length;
                  return <div key={f.id} onClick={()=>setActiveFirm(f.id)} style={{background:activeFirm===f.id?`${f.color}0f`:C.surface,border:`1px solid ${activeFirm===f.id?f.color+"44":C.border}`,borderRadius:10,padding:"14px 18px",cursor:"pointer",minWidth:170,position:"relative",overflow:"hidden"}}>
                    {activeFirm===f.id&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:f.color}}/>}
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16}}>{f.name}</div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:f.color,marginTop:3}}>{at.label} · {at.payoutSplit}% split</div>
                    <div style={{marginTop:9,display:"flex",gap:5}}>
                      {brs>0&&<span style={{background:C.red+"22",color:C.red,border:`1px solid ${C.red}44`,borderRadius:4,padding:"2px 7px",fontFamily:"'Space Mono',monospace",fontSize:10}}>{brs} breach</span>}
                      {wrn>0&&<span style={{background:C.amber+"22",color:C.amber,border:`1px solid ${C.amber}44`,borderRadius:4,padding:"2px 7px",fontFamily:"'Space Mono',monospace",fontSize:10}}>{wrn} warning</span>}
                      {brs===0&&wrn===0&&<span style={{background:C.green+"22",color:C.green,border:`1px solid ${C.green}44`,borderRadius:4,padding:"2px 7px",fontFamily:"'Space Mono',monospace",fontSize:10}}>✓ OK</span>}
                    </div>
                  </div>;
                })}

              </div>
            </div>
          </div>;
        })()}

        {/* ── ADD FIRM WIZARD MODAL ────────────────────────────────────────────── */}
        {showFirmWizard && (() => {
          const FIRM_OPTIONS = [
            ...DEFAULT_PROP_FIRMS.map(f => ({id:f.id, name:f.name, color:f.color, desc:f.accountTypees.map(t=>t.label).join(" · ")})),
            {id:"custom", name:"Annan / Custom", color:C.muted, desc:"Enter your own rules manually"},
          ];
          const selectedFirm    = DEFAULT_PROP_FIRMS.find(f=>f.id===wizardFirmId);
          const selectedTypee    = selectedFirm?.accountTypees.find(t=>t.id===wizardTypeeId);
          const SIZES = [25000,50000,100000,150000,200000];

          const handleConfirm = () => {
            if (!wizardFirmId) return;
            const firmDef = DEFAULT_PROP_FIRMS.find(f=>f.id===wizardFirmId);
            if (!firmDef) return;
            const typeDef = firmDef.accountTypees.find(t=>t.id===wizardTypeeId) || firmDef.accountTypees[0];
            const ratio   = wizardSize / typeDef.accountSize;
            const scaledRules = typeDef.rules.map(r => ({
              ...r,
              value: ["drawdown","loss","target"].includes(r.type) ? Math.round(r.value * ratio) : r.value,
              description: r.description,
            }));
            const newFirm = {
              ...firmDef,
              id:          `${firmDef.id}_${Date.now()}`,
              name:        wizardName || `${firmDef.name} $${(wizardSize/1000).toFixed(0)}K`,
              accountTypees:[{ ...typeDef, accountSize:wizardSize, rules:scaledRules, badge:`$${(wizardSize/1000).toFixed(0)}K` }],
              activeTypee:  typeDef.id,
            };
            setFirms(prev => [...prev, newFirm]);
            setActiveFirm(newFirm.id);
            setShowFirmWizard(false);
          };

          const stepLabels = ["1. Firm","2. Accounttyp","3. Accountstorlek","4. Confirm"];
          return (
            <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,width:"100%",maxWidth:560,maxHeight:"90vh",overflow:"auto",padding:32,position:"relative"}}>
                <button onClick={()=>setShowFirmWizard(false)} style={{position:"absolute",top:16,right:16,background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:20}}>✕</button>
                
                {/* Progress bar */}
                <div style={{display:"flex",gap:4,marginBottom:28}}>
                  {stepLabels.map((l,i)=>(
                    <div key={l} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                      <div style={{height:3,width:"100%",borderRadius:2,background:i+1<=wizardStep?C.accent:C.border,transition:"background 0.3s"}}/>
                      <span style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:i+1<=wizardStep?C.accent:C.muted}}>{l}</span>
                    </div>
                  ))}
                </div>

                {/* ── Step 1: Select firm ── */}
                {wizardStep===1&&(
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,marginBottom:6}}>Vilken prop firm?</div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,marginBottom:20}}>Select your prop firm — regler laddas automatically</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {FIRM_OPTIONS.map(f=>(
                        <div key={f.id} onClick={()=>setWizardFirmId(f.id)} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderRadius:10,border:`1px solid ${wizardFirmId===f.id?f.color+"88":C.border}`,background:wizardFirmId===f.id?`${f.color}11`:C.surface,cursor:"pointer",transition:"all 0.15s"}}>
                          <div style={{width:10,height:10,borderRadius:"50%",background:f.color,flexShrink:0,boxShadow:`0 0 8px ${f.color}88`}}/>
                          <div style={{flex:1}}>
                            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:wizardFirmId===f.id?f.color:C.text}}>{f.name}</div>
                            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginTop:2}}>{f.desc}</div>
                          </div>
                          {wizardFirmId===f.id&&<span style={{color:f.color,fontSize:18}}>✓</span>}
                        </div>
                      ))}
                    </div>
                    <button disabled={!wizardFirmId} onClick={()=>setWizardStep(2)} style={{marginTop:20,width:"100%",padding:"12px",borderRadius:8,background:wizardFirmId?C.accent:C.border,color:wizardFirmId?"#000":C.muted,border:"none",cursor:wizardFirmId?"pointer":"not-allowed",fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700}}>Next →</button>
                  </div>
                )}

                {/* ── Step 2: Select account type ── */}
                {wizardStep===2&&selectedFirm&&(
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,marginBottom:6}}>Vilken kontotyp?</div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,marginBottom:20}}>{selectedFirm.name} — välj din kontotyp</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {selectedFirm.accountTypees.map(t=>(
                        <div key={t.id} onClick={()=>setWizardTypeeId(t.id)} style={{padding:"16px",borderRadius:10,border:`1px solid ${wizardTypeeId===t.id?selectedFirm.color+"88":C.border}`,background:wizardTypeeId===t.id?`${selectedFirm.color}11`:C.surface,cursor:"pointer",transition:"all 0.15s"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{background:`${selectedFirm.color}22`,color:selectedFirm.color,border:`1px solid ${selectedFirm.color}44`,borderRadius:4,padding:"2px 8px",fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700}}>{t.badge}</span>
                              <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15}}>{t.label}</span>
                            </div>
                            <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.green}}>{t.payoutSplit}% split</span>
                          </div>
                          <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.textDim,marginBottom:10}}>{t.description}</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                            {t.rules.slice(0,4).map(r=>(
                              <span key={r.id} style={{background:r.type==="drawdown"?C.red+"11":r.type==="consist"?C.amber+"11":C.surface,color:r.type==="drawdown"?C.red:r.type==="consist"?C.amber:C.textDim,border:`1px solid ${r.type==="drawdown"?C.red+"33":r.type==="consist"?C.amber+"33":C.border}`,borderRadius:4,padding:"2px 8px",fontFamily:"'Space Mono',monospace",fontSize:9}}>
                                {r.label}
                                {["drawdown","loss","target"].includes(r.type)&&r.value<9990?` $${r.value.toLocaleString()}`:""}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:20}}>
                      <button onClick={()=>setWizardStep(1)} style={{padding:"12px",borderRadius:8,background:"transparent",color:C.muted,border:`1px solid ${C.border}`,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11}}>← Back</button>
                      <button disabled={!wizardTypeeId} onClick={()=>setWizardStep(3)} style={{flex:1,padding:"12px",borderRadius:8,background:wizardTypeeId?C.accent:C.border,color:wizardTypeeId?"#000":C.muted,border:"none",cursor:wizardTypeeId?"pointer":"not-allowed",fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700}}>Next →</button>
                    </div>
                  </div>
                )}

                {/* ── Step 3: Accountstorlek ── */}
                {wizardStep===3&&(
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,marginBottom:6}}>Accountstorlek</div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,marginBottom:20}}>Select your account size — rules scale automatically</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>
                      {SIZES.map(s=>(
                        <div key={s} onClick={()=>setWizardSize(s)} style={{padding:"14px",borderRadius:10,border:`1px solid ${wizardSize===s?C.accent+"88":C.border}`,background:wizardSize===s?C.accentDim:C.surface,cursor:"pointer",textAlign:"center"}}>
                          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:wizardSize===s?C.accent:C.text}}>${(s/1000).toFixed(0)}K</div>
                          {selectedTypee&&["drawdown","loss"].map(type=>{
                            const r=selectedTypee.rules.find(r=>r.type===type);
                            if(!r) return null;
                            const scaled=Math.round(r.value*(s/selectedTypee.accountSize));
                            return <div key={type} style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.red,marginTop:2}}>DD: ${scaled.toLocaleString()}</div>;
                          })}
                        </div>
                      ))}
                    </div>
                    <div style={{marginBottom:16}}>
                      <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginBottom:6}}>ACCOUNT NAME (optional)</div>
                      <input value={wizardName} onChange={e=>setWizardName(e.target.value)} placeholder={selectedFirm?`${selectedFirm.name} $${(wizardSize/1000).toFixed(0)}K`:""} style={{width:"100%",padding:"10px 14px",borderRadius:8,background:C.surface,border:`1px solid ${C.border}`,color:C.text,fontFamily:"'Space Mono',monospace",fontSize:12,boxSizing:"border-box"}}/>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setWizardStep(2)} style={{padding:"12px",borderRadius:8,background:"transparent",color:C.muted,border:`1px solid ${C.border}`,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11}}>← Back</button>
                      <button onClick={()=>setWizardStep(4)} style={{flex:1,padding:"12px",borderRadius:8,background:C.accent,color:"#000",border:"none",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700}}>Next →</button>
                    </div>
                  </div>
                )}

                {/* ── Step 4: Bekräftelse ── */}
                {wizardStep===4&&selectedFirm&&selectedTypee&&(
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,marginBottom:6}}>Confirm</div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,marginBottom:20}}>Verify that everything is correct</div>
                    <div style={{background:C.surface,borderRadius:12,padding:20,border:`1px solid ${selectedFirm.color}44`,marginBottom:20}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
                        <div>
                          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:selectedFirm.color}}>{wizardName||`${selectedFirm.name} $${(wizardSize/1000).toFixed(0)}K`}</div>
                          <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,marginTop:2}}>{selectedTypee.label} · {selectedTypee.payoutSplit}% split</div>
                        </div>
                        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:24,color:selectedFirm.color}}>${(wizardSize/1000).toFixed(0)}K</div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {selectedTypee.rules.map(r=>{
                          const scaled=["drawdown","loss","target"].includes(r.type)?Math.round(r.value*(wizardSize/selectedTypee.accountSize)):r.value;
                          return (
                            <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"10px 12px",background:C.card,borderRadius:8,border:`1px solid ${C.border}`}}>
                              <div>
                                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:r.type==="drawdown"?C.red:r.type==="consist"?C.amber:C.text,fontWeight:700}}>{r.label}</div>
                                <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,marginTop:3,maxWidth:300}}>{r.description}</div>
                              </div>
                              {["drawdown","loss","target"].includes(r.type)&&r.value<9990&&(
                                <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:r.type==="drawdown"||r.type==="loss"?C.red:C.green,flexShrink:0,marginLeft:12}}>${scaled.toLocaleString()}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setWizardStep(3)} style={{padding:"12px",borderRadius:8,background:"transparent",color:C.muted,border:`1px solid ${C.border}`,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11}}>← Back</button>
                      <button onClick={handleConfirm} style={{flex:1,padding:"14px",borderRadius:8,background:C.accent,color:"#000",border:"none",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:800}}>✓ Add account</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── NEWS / ECONOMIC CALENDAR ────────────────────────────────────────── */}
        {tab==="news"&&<NewsTab econFilter={econFilter} setEconFilter={setEconFilter}/>}

        {/* ── ACCOUNTS ────────────────────────────────────────────────────────── */}
        {tab==="accounts"&&(()=>{
          const disconnectAccount = async (accountId) => {
            try {
              const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
              const token = (await supabase.auth.getSession()).data.session?.access_token;
              await fetch(`${API}/tradovate/connected-accounts/${accountId}`, {
                method: "DELETE", headers: { Authorization: `Bearer ${token}` }
              });
              setTvAccounts(a => a.filter(x => x.tradovate_account_id !== accountId));
            } catch {}
          };

          const doTvLogin = async () => {
            setTvLoginLoading(true); setTvLoginError("");
            try {
              const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
              const token = (await supabase.auth.getSession()).data.session?.access_token;
              const res = await fetch(`${API}/tradovate/auth`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Typee": "application/json" },
                body: JSON.stringify(tvLoginForm),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Inloggning misslyckades");
              // Om flera konton — låt användaren välja vilket
              if (data.accounts?.length > 1) {
                setTvLoginAccounts(data.accounts);
                setTvLoginStep("select_account");
              } else {
                // Sofe direkt om bara ett konto
                setTvAccounts(a => [...a.filter(x=>x.tradovate_account_id!==data.accounts[0].id), {
                  tradovate_account_id: String(data.accounts[0].id),
                  account_spec: data.accounts[0].name,
                  display_name: data.accounts[0].name,
                  balance: data.accounts[0].cashBalance,
                  active: true,
                }]);
                setShowTvLogin(false); setTvLoginStep("credentials");
                setTvLoginForm({username:"",password:"",cid:"",secret:""});
              }
            } catch (err) { setTvLoginError(err.message); }
            setTvLoginLoading(false);
          };

          const selectTvAccount = async (acc) => {
            setTvAccounts(a => [...a.filter(x=>x.tradovate_account_id!==String(acc.id)), {
              tradovate_account_id: String(acc.id),
              account_spec: acc.name,
              display_name: acc.name,
              balance: acc.cashBalance,
              active: true,
            }]);
            setShowTvLogin(false); setTvLoginStep("credentials");
            setTvLoginAccounts([]);
          };

          return <div style={{display:"flex",flexDirection:"column",gap:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
              <div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Connected Accounts</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,marginTop:4}}>Accounts</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                {isDemo && (
                  <button onClick={()=>{
                    const demoAccounts = [
                      {tradovate_account_id:"DEMO-001",account_spec:"MFFU-50K-DEMO",display_name:"MyFundedFutures $50K (Demo)",balance:52840,active:true},
                      {tradovate_account_id:"DEMO-002",account_spec:"LUCID-50K-DEMO",display_name:"Lucid LucidFlex $50K (Demo)",balance:51180,active:true},
                      {tradovate_account_id:"DEMO-003",account_spec:"TFY-50K-DEMO",  display_name:"Tradeify Select Flex $50K (Demo)",balance:51640,active:true},
                    ];
                    setTvAccounts(demoAccounts);
                    // Also auto-add demo prop firms
                    const demoFirms = DEFAULT_PROP_FIRMS.filter(f=>["mffu","lucid","tradeify"].includes(f.id)).map(f=>({
                      ...f, id:`${f.id}_demo`,
                      name:`${f.name} (Demo)`,
                    }));
                    setFirms(demoFirms);
                  }} style={{background:`${C.purple}22`,border:`1px solid ${C.purple}44`,borderRadius:8,padding:"8px 18px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.purple,fontWeight:700}}>
                    🎭 Add demo-konton
                  </button>
                )}
                <button onClick={()=>{setShowTvLogin(true);setTvLoginStep("credentials");setTvLoginError("");}}
                  style={{background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"8px 18px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.accent,fontWeight:700}}>
                  + Connect Tradovate account
                </button>
              </div>
            </div>

            {/* Info-banner */}
            <div style={{background:"#00e5ff08",border:"1px solid #00e5ff22",borderRadius:10,padding:"14px 18px",display:"flex",gap:14,alignItems:"flex-start"}}>
              <span style={{fontSize:20,flexShrink:0}}>🔐</span>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,lineHeight:1.6}}>
                Your Tradovate credentials are used <strong style={{color:C.text}}>only to fetch an access token</strong> which is stored encrypted.
                Your password is never stored. Tokens are refreshed automatically as needed.
                <br/>Each account you connect here is available in <strong style={{color:C.text}}>Trade Copier</strong>-tab.
              </div>
            </div>

            {/* Connected accounts */}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {tvAccounts.length===0 ? (
                <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:12,padding:40,textAlign:"center"}}>
                  <div style={{fontSize:32,marginBottom:12}}>📡</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,marginBottom:6}}>No accounts connected</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.muted}}>Connect your Tradovate accounts to enable live sync, Copier and positionsive P&L-tracking</div>
                </div>
              ) : tvAccounts.map(acc => (
                <div key={acc.tradovate_account_id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:22,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:14}}>
                    <div style={{width:44,height:44,borderRadius:10,background:C.accentDim,border:`1px solid ${C.accent}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📈</div>
                    <div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16}}>{acc.display_name || acc.account_spec}</div>
                      <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,marginTop:3}}>ID: {acc.tradovate_account_id} · {acc.account_spec}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:16}}>
                    {acc.balance!=null && <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:20,color:C.green}}>${Math.round(acc.balance).toLocaleString()}</div>}
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:6,height:6,borderRadius:"50%",background:C.green,boxShadow:`0 0 6px ${C.green}`}}/>
                      <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.green}}>Connected</span>
                    </div>
                    <button onClick={()=>disconnectAccount(acc.tradovate_account_id)}
                      style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>
                      Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Prop firm account section ──────────────────────────────────── */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24,marginTop:4}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16}}>Prop Firm Accounts</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.muted,marginTop:3}}>
                    {firms.length ? `${firms.length} konto${firms.length>1?"n":""} tillagd${firms.length>1?"a":""}` : "No accounts added yet"}
                  </div>
                </div>
                <button onClick={openFirmWizard} style={{background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"8px 18px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.accent,fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:14}}>＋</span> Add account
                </button>
              </div>
              {firms.length===0 ? (
                <div style={{padding:"24px",background:C.surface,borderRadius:10,textAlign:"center",border:`1px dashed ${C.border}`}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted}}>Click "Add account" to configure your first prop firm account</div>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {firms.map(f=>{
                    const at=f.accountTypees.find(t=>t.id===f.activeTypee)||f.accountTypees[0];
                    return (
                      <div key={f.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:C.surface,borderRadius:10,border:`1px solid ${f.color}33`}}>
                        <div style={{display:"flex",alignItems:"center",gap:12}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:f.color,boxShadow:`0 0 6px ${f.color}88`}}/>
                          <div>
                            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:f.color}}>{f.name}</div>
                            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginTop:2}}>{at.label} · ${(at.accountSize/1000).toFixed(0)}K · {at.payoutSplit}% split</div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <button onClick={()=>{setActiveFirm(f.id);setTab("propfirm");}} style={{background:"transparent",border:`1px solid ${f.color}44`,borderRadius:6,padding:"4px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:f.color}}>Show →</button>
                          <button onClick={()=>setFirms(prev=>prev.filter(x=>x.id!==f.id))} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Psychology-guard ─────────────────────────────────────────── */}
            <div style={{background:C.card,border:`1px solid ${psychGuard.enabled?`${C.purple}44`:C.border}`,borderRadius:12,padding:24,marginTop:4}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:psychGuard.enabled?20:0}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:20}}>🧠</span>
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16}}>Psychology-guard</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.muted,marginTop:2}}>
                      Warns when your mood or habits are below your minimum threshold
                    </div>
                  </div>
                </div>
                <div onClick={()=>sofePsychGuard({...psychGuard,enabled:!psychGuard.enabled})}
                  style={{width:48,height:26,borderRadius:13,background:psychGuard.enabled?C.purple:C.border,cursor:"pointer",position:"relative",transition:"background 0.2s",border:`1px solid ${psychGuard.enabled?"#a78bfa88":C.border}`}}>
                  <div style={{position:"absolute",top:3,left:psychGuard.enabled?25:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px #0006"}}/>
                </div>
              </div>
              {psychGuard.enabled && (
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  <div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Lägsta godkänd sinnesstämning</div>
                    <div style={{display:"flex",gap:6}}>
                      {[{val:2,emoji:"😟",label:"Anxious+"},{val:3,emoji:"😐",label:"Neutral+"},{val:4,emoji:"😊",label:"Confident+"},{val:5,emoji:"🔥",label:"Zone only"}].map(opt=>(
                        <button key={opt.val} onClick={()=>sofePsychGuard({...psychGuard,minMood:opt.val})}
                          style={{flex:1,padding:"10px 6px",borderRadius:8,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,border:`1px solid ${psychGuard.minMood===opt.val?"#a78bfa88":C.border}`,background:psychGuard.minMood===opt.val?`${C.purple}18`:C.surface,color:psychGuard.minMood===opt.val?C.purple:C.textDim,textAlign:"center"}}>
                          <div style={{fontSize:18,marginBottom:4}}>{opt.emoji}</div>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Minimum habit completion rate</div>
                    <div style={{display:"flex",gap:6}}>
                      {[{val:0.25,label:"25%+"},{val:0.5,label:"50%+"},{val:0.75,label:"75%+"},{val:1.0,label:"100%"}].map(opt=>(
                        <button key={opt.val} onClick={()=>sofePsychGuard({...psychGuard,minHabits:opt.val})}
                          style={{flex:1,padding:"10px 6px",borderRadius:8,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,border:`1px solid ${psychGuard.minHabits===opt.val?"#a78bfa88":C.border}`,background:psychGuard.minHabits===opt.val?`${C.purple}18`:C.surface,color:psychGuard.minHabits===opt.val?C.purple:C.textDim,textAlign:"center"}}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Live readiness-meter */}
                  {(() => {
                    const ps = getPsychReadiness();
                    const moodPct = Math.round((ps.moodScore/5)*100);
                    const habitPct = Math.round(ps.habitScore*100);
                    return (
                      <div style={{background:ps.blocked?`${C.purple}11`:C.green+"11",border:`1px solid ${ps.blocked?`${C.purple}33`:C.green+"33"}`,borderRadius:8,padding:"14px 16px"}}>
                        <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:ps.blocked?C.purple:C.green,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>
                          {ps.blocked?"⚠ Not ready to trade":"✓ Ready to trade"}
                        </div>
                        <div style={{display:"flex",gap:16}}>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                              <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>Mood</span>
                              <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:ps.moodScore>=psychGuard.minMood?C.green:C.red}}>{ps.moodScore||"–"}/5</span>
                            </div>
                            <div style={{height:6,background:C.border,borderRadius:3,overflow:"hidden"}}>
                              <div style={{height:"100%",width:`${moodPct}%`,background:ps.moodScore>=psychGuard.minMood?C.green:C.red,borderRadius:3,transition:"width 0.5s"}}/>
                            </div>
                          </div>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                              <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>Habits</span>
                              <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:ps.habitScore>=psychGuard.minHabits?C.green:C.red}}>{habitPct}%</span>
                            </div>
                            <div style={{height:6,background:C.border,borderRadius:3,overflow:"hidden"}}>
                              <div style={{height:"100%",width:`${habitPct}%`,background:ps.habitScore>=psychGuard.minHabits?C.green:C.red,borderRadius:3,transition:"width 0.5s"}}/>
                            </div>
                          </div>
                        </div>
                        {ps.blocked&&<button onClick={()=>setTab("psychology")} style={{marginTop:10,background:`${C.purple}22`,border:`1px solid ${C.purple}44`,borderRadius:6,padding:"6px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.purple}}>→ Go to Psychology and log check-in</button>}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* ── News blocker settings ───────────────────────────── */}
            <div style={{background:C.card,border:`1px solid ${newsBlock.enabled?C.red+"44":C.border}`,borderRadius:12,padding:24,marginTop:4}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:newsBlock.enabled?20:0}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:20}}>🚫</span>
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16}}>News Block Guard</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.muted,marginTop:2}}>
                      Automatically blocks trades during high-impact news
                    </div>
                  </div>
                </div>
                {/* Toggle switch */}
                <div onClick={()=>sofeNewsBlock({...newsBlock,enabled:!newsBlock.enabled})}
                  style={{width:48,height:26,borderRadius:13,background:newsBlock.enabled?C.red:C.border,cursor:"pointer",position:"relative",transition:"background 0.2s",border:`1px solid ${newsBlock.enabled?C.red+"88":C.border}`}}>
                  <div style={{position:"absolute",top:3,left:newsBlock.enabled?25:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px #0006"}}/>
                </div>
              </div>
              {newsBlock.enabled && (
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  {/* Impact level */}
                  <div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>News type to block</div>
                    <div style={{display:"flex",gap:6}}>
                      {[{val:"high",label:"🔴 High impact",color:C.red},{val:"medium",label:"🟡 Medium & High",color:C.amber}].map(opt=>(
                        <button key={opt.val} onClick={()=>sofeNewsBlock({...newsBlock,impactLevel:opt.val})}
                          style={{padding:"8px 16px",borderRadius:8,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,border:`1px solid ${newsBlock.impactLevel===opt.val?opt.color+"88":C.border}`,background:newsBlock.impactLevel===opt.val?`${opt.color}18`:C.surface,color:newsBlock.impactLevel===opt.val?opt.color:C.textDim,fontWeight:newsBlock.impactLevel===opt.val?700:400}}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Time windows */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                    <div>
                      <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>minutes before news</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {[2,5,10,15,30].map(m=>(
                          <button key={m} onClick={()=>sofeNewsBlock({...newsBlock,minsBefore:m})}
                            style={{padding:"6px 12px",borderRadius:6,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,border:`1px solid ${newsBlock.minsBefore===m?C.accent+"88":C.border}`,background:newsBlock.minsBefore===m?C.accentDim:C.surface,color:newsBlock.minsBefore===m?C.accent:C.textDim,fontWeight:newsBlock.minsBefore===m?700:400}}>
                            {m} min
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>minutes AFTER news</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {[2,5,10,15,30].map(m=>(
                          <button key={m} onClick={()=>sofeNewsBlock({...newsBlock,minsAfter:m})}
                            style={{padding:"6px 12px",borderRadius:6,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,border:`1px solid ${newsBlock.minsAfter===m?C.accent+"88":C.border}`,background:newsBlock.minsAfter===m?C.accentDim:C.surface,color:newsBlock.minsAfter===m?C.accent:C.textDim,fontWeight:newsBlock.minsAfter===m?700:400}}>
                            {m} min
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Preview of nästa blockeringstillfälle */}
                  <div style={{background:C.red+"11",border:`1px solid ${C.red}33`,borderRadius:8,padding:"12px 16px"}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.red,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>Active block windows today</div>
                    {(() => {
                      const today = new Date().toISOString().slice(0,10);
                      const todayHigh = ECON_EVENTS.filter(e=>e.date===today&&(newsBlock.impactLevel==="medium"?e.impact!=="low":e.impact==="high"));
                      if (!todayHigh.length) return <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted}}>No blocking news today ✓</div>;
                      return todayHigh.map(ev=>{
                        const [eh,em]  = ev.time.split(":").map(Number);
                        const blockFrom = `${String(eh*60+em-newsBlock.minsBefore).padStart(0,'0')}`;
                        const fromH = Math.floor((eh*60+em-newsBlock.minsBefore)/60);
                        const fromM = (eh*60+em-newsBlock.minsBefore)%60;
                        const toH   = Math.floor((eh*60+em+newsBlock.minsAfter)/60);
                        const toM   = (eh*60+em+newsBlock.minsAfter)%60;
                        const fmt = (h,m) => `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
                        return (
                          <div key={ev.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${C.red}22`}}>
                            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.text}}>{ev.event}</span>
                            <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.red,fontWeight:700}}>
                              {fmt(fromH,fromM)} – {fmt(toH,toM)}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* ── Login modal ─────────────────────────────────────────────── */}
            {showTvLogin && (
              <div style={{position:"fixed",inset:0,background:"#00000088",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{background:theme==="dark"?C.surface:C.card,border:`1px solid ${theme==="dark"?C.border:"#dde3ec"}`,borderRadius:16,padding:32,width:440,maxWidth:"95vw"}}>

                  {tvLoginStep==="credentials" && <>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,marginBottom:4}}>Connect Tradovate</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.muted,marginBottom:24}}>Log in with your Tradovate credentialser</div>

                    <div style={{display:"flex",flexDirection:"column",gap:12}}>
                      {[
                        {label:"Username",  key:"username", type:"text",     placeholder:"your.name@email.com"},
                        {label:"Password",       key:"password", type:"password", placeholder:"••••••••"},
                      ].map(f=>(
                        <div key={f.key}>
                          <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>{f.label}</div>
                          <input type={f.type} value={tvLoginForm[f.key]}
                            onChange={e=>setTvLoginForm(x=>({...x,[f.key]:e.target.value}))}
                            onKeyDown={e=>e.key==="Enter"&&doTvLogin()}
                            placeholder={f.placeholder}
                            style={{width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"11px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}/>
                        </div>
                      ))}

                      {/* CID/Secret — is needed för Tradovate API-app */}
                      <details style={{marginTop:4}}>
                        <summary style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,cursor:"pointer",userSelect:"none",letterSpacing:"0.07em",textTransform:"uppercase"}}>
                          Avancerat — API App credentials (valfritt)
                        </summary>
                        <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:10}}>
                          {[
                            {label:"CID",    key:"cid",    placeholder:"Tradovate App CID"},
                            {label:"Secret", key:"secret", placeholder:"Tradovate App Secret"},
                          ].map(f=>(
                            <div key={f.key}>
                              <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>{f.label}</div>
                              <input value={tvLoginForm[f.key]}
                                onChange={e=>setTvLoginForm(x=>({...x,[f.key]:e.target.value}))}
                                placeholder={f.placeholder}
                                style={{width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}/>
                            </div>
                          ))}
                          <div style={{background:"#00e5ff08",border:"1px solid #00e5ff22",borderRadius:8,padding:"10px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim}}>
                            💡 Only required if you have multiple Tradovate accountsar en egen Tradovate API-app. Annars används FundVaults inbyggda app-credentials.
                          </div>
                        </div>
                      </details>

                      {tvLoginError && (
                        <div style={{background:C.red+"15",border:`1px solid ${C.red}44`,borderRadius:8,padding:"10px 14px",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.red}}>
                          ⚠ {tvLoginError}
                        </div>
                      )}

                      <div style={{background:`${C.amber}11`,border:"1px solid #f59e0b33",borderRadius:8,padding:"10px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim}}>
                        🔒 Your password goes directly to Tradovate and is <strong style={{color:C.text}}>never stored</strong>. Only your access token is saved.
                      </div>
                    </div>

                    <div style={{display:"flex",gap:10,marginTop:20}}>
                      <button onClick={()=>{setShowTvLogin(false);setTvLoginError("");}}
                        style={{flex:1,padding:"12px",borderRadius:10,cursor:"pointer",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>
                        Cancel
                      </button>
                      <button onClick={doTvLogin} disabled={tvLoginLoading||!tvLoginForm.username||!tvLoginForm.password}
                        style={{flex:2,padding:"12px",borderRadius:10,cursor:tvLoginLoading?"wait":"pointer",background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,opacity:!tvLoginForm.username||!tvLoginForm.password?.5:1}}>
                        {tvLoginLoading ? "Connecting…" : "Connect account →"}
                      </button>
                    </div>
                  </>}

                  {tvLoginStep==="select_account" && <>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,marginBottom:4}}>Select account</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.muted,marginBottom:20}}>Multiple accounts found — select which one to connect</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {tvLoginAccounts.map(acc=>(
                        <div key={acc.id} onClick={()=>selectTvAccount(acc)}
                          style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,cursor:"pointer"}}
                          onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                          <div>
                            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15}}>{acc.name}</div>
                            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginTop:2}}>ID: {acc.id} · {acc.accountTypee||"Futures"}</div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:C.green}}>${Math.round(acc.cashBalance||0).toLocaleString()}</div>
                            <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:acc.active?C.green:C.muted,marginTop:2}}>{acc.active?"Active":"Inactive"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={()=>setTvLoginStep("credentials")} style={{marginTop:16,background:"transparent",border:"none",cursor:"pointer",color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>← Back</button>
                  </>}

                </div>
              </div>
            )}
          </div>;
        })()}

        {/* ── TRADE COPIER ────────────────────────────────────────────────────── */}
        {tab==="copier"&&(()=>{
          const FIRM_LABELS = {"mffu":"MFFU","lucid":"Lucid","alpha":"Alpha","tpt":"TPT","tradeify":"Tradeify"};
          const FIRM_COLORS = {"mffu":C.accent,"lucid":C.purple,"alpha":"#34d399","tpt":C.amber,"tradeify":"#f472b6"};
          const activeGroup = copierGroups.find(g=>g.id===activeGroupId);

          // Smart warnings: konton nära breach based on prop firm-regler
          const getAccountWarnings = (acctId) => {
            const acc = copierAccounts.find(a=>a.id===acctId);
            if (!acc) return [];
            const warnings = [];
            const firmTrades = trades.filter(t=>(t.tags||[]).includes(acc.firm)||trades.length<5);
            const startBal = startBalances[acc.firm] || parseFloat(acc.accountSize)||50000;
            const totalPnl = firmTrades.reduce((a,t)=>a+t.pnl,0);
            const pnlByDay = {};
            firmTrades.forEach(t=>{pnlByDay[t.trade_date]=(pnlByDay[t.trade_date]||0)+t.pnl;});
            const dayPnls = Object.values(pnlByDay);
            const cycleProfit = totalPnl;
            const bestDay = dayPnls.length ? Math.max(...dayPnls.filter(p=>p>0),0) : 0;
            const bestDayPct = cycleProfit>0 ? (bestDay/cycleProfit)*100 : 0;
            const firmObj = firms.find(f=>f.id===acc.firm);
            const acctTypeeObj = firmObj?.accountTypees?.[0];
            const ddRule = acctTypeeObj?.rules?.find(r=>r.type==="drawdown");
            const balance = startBal + totalPnl;
            const peak = startBal + Math.max(0,totalPnl);
            const dd = peak - balance;
            if (ddRule && dd >= ddRule.value*0.75) warnings.push({level:"danger", msg:`DD ${Math.round(dd/ddRule.value*100)}% of max`});
            else if (ddRule && dd >= ddRule.value*0.5) warnings.push({level:"warning", msg:`DD ${Math.round(dd/ddRule.value*100)}% of max`});
            const csRule = acctTypeeObj?.rules?.find(r=>r.type==="consist");
            if (csRule && bestDayPct >= csRule.value*0.85) warnings.push({level:"warning", msg:`Consistency ${Math.round(bestDayPct)}% / ${csRule.value}%`});
            return warnings;
          };

          return <div style={{display:"flex",flexDirection:"column",gap:22}}>

            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
              <div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.amber,letterSpacing:"0.1em",textTransform:"uppercase"}}>Multi-Account</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,marginTop:4}}>Trade Copier</div>
              </div>
              {/* Master toggle */}
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted}}>COPIER</span>
                <div onClick={()=>setCopierEnabled(e=>!e)} style={{width:48,height:26,borderRadius:13,background:copierEnabled?`${C.green}44`:C.surface,border:`1px solid ${copierEnabled?C.green:C.border}`,cursor:"pointer",position:"relative",transition:"all 0.2s"}}>
                  <div style={{position:"absolute",top:3,left:copierEnabled?24:3,width:18,height:18,borderRadius:"50%",background:copierEnabled?C.green:C.muted,transition:"left 0.2s",boxShadow:copierEnabled?`0 0 8px ${C.green}`:"none"}}/>
                </div>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:copierEnabled?C.green:C.muted,fontWeight:700}}>{copierEnabled?"ACTIVE":"OFF"}</span>
              </div>
            </div>

            {/* Active group banner */}
            {activeGroup && copierEnabled && (
              <div style={{background:`${C.green}11`,border:`1px solid ${C.green}44`,borderRadius:12,padding:"14px 20px",display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:C.green,boxShadow:`0 0 10px ${C.green}`,animation:"pulse 1.5s ease-in-out infinite"}}/>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.green,letterSpacing:"0.08em",textTransform:"uppercase"}}>Active grupp — kopierar till {activeGroup.accountIds.length} konton</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,marginTop:2}}>{activeGroup.name}</div>
                </div>
                <button onClick={()=>{setActiveGroup(null);setCopierEnabled(false);}} style={{background:`${C.red}22`,border:`1px solid ${C.red}44`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.red}}>Stoppa</button>
              </div>
            )}

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>

              {/* ── Accountn ─────────────────────────────────────────────────── */}
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Mina konton ({copierAccounts.length})</div>
                  <button onClick={()=>setShowAddAccount(true)} style={{background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:6,padding:"4px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.accent}}>+ Add</button>
                </div>

                {copierAccounts.length===0 && (
                  <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:12,padding:32,textAlign:"center",color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>
                    No accounts added yet<br/><span style={{fontSize:9,marginTop:6,display:"block"}}>Add your Tradovate accounts to get started</span>
                  </div>
                )}

                {copierAccounts.map(acc=>{
                  const warnings = getAccountWarnings(acc.id);
                  const hasWarning = warnings.some(w=>w.level==="warning");
                  const hasDanger  = warnings.some(w=>w.level==="danger");
                  const borderCol  = hasDanger?C.red:hasWarning?C.amber:C.border;
                  const inActiveGroup = activeGroup?.accountIds.includes(acc.id);
                  return (
                    <div key={acc.id} style={{background:C.card,border:`1px solid ${inActiveGroup?C.green+"55":borderCol}`,borderRadius:12,padding:16,position:"relative"}}>
                      {acc.isMaster && <span style={{position:"absolute",top:10,right:12,background:C.amber+"22",border:`1px solid ${C.amber}44`,borderRadius:4,padding:"2px 8px",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.amber}}>MASTER</span>}
                      {inActiveGroup && !acc.isMaster && <span style={{position:"absolute",top:10,right:12,background:C.green+"22",border:`1px solid ${C.green}44`,borderRadius:4,padding:"2px 8px",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.green}}>AKTIV</span>}
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:warnings.length?8:0}}>
                        <div style={{width:36,height:36,borderRadius:8,background:FIRM_COLORS[acc.firm]+"22",border:`1px solid ${FIRM_COLORS[acc.firm]}44`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:12,color:FIRM_COLORS[acc.firm],flexShrink:0}}>
                          {FIRM_LABELS[acc.firm]?.slice(0,2).toUpperCase()}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{acc.name}</div>
                          <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,marginTop:1}}>{FIRM_LABELS[acc.firm]} · ${parseInt(acc.accountSize).toLocaleString()} · ID: {acc.accountId||"—"}</div>
                        </div>
                        <button onClick={()=>sofeCopierAccounts(copierAccounts.map(a=>a.id===acc.id?{...a,isMaster:!a.isMaster}:a.isMaster?{...a,isMaster:false}:a))} style={{background:"transparent",border:"none",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:acc.isMaster?C.amber:C.muted,padding:"4px 6px"}} title="Set as master">★</button>
                        <button onClick={()=>sofeCopierAccounts(copierAccounts.filter(a=>a.id!==acc.id))} style={{background:"transparent",border:"none",cursor:"pointer",color:C.red,fontSize:13,opacity:.5,padding:"4px 6px"}}>✕</button>
                      </div>
                      {warnings.length>0 && (
                        <div style={{display:"flex",flexDirection:"column",gap:3}}>
                          {warnings.map((w,i)=>(
                            <div key={i} style={{display:"flex",alignItems:"center",gap:6,background:w.level==="danger"?C.red+"11":C.amber+"11",borderRadius:6,padding:"4px 8px"}}>
                              <span style={{fontSize:10}}>{w.level==="danger"?"🔴":"⚠️"}</span>
                              <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:w.level==="danger"?C.red:C.amber}}>{w.msg}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── Grupper ────────────────────────────────────────────────── */}
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Grupper ({copierGroups.length})</div>
                  <button onClick={()=>{setNewGroupForm({name:"",accountIds:[]});setShowAddGroup(true);setEditGroupId(null);}} style={{background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:6,padding:"4px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.accent}}>+ New group</button>
                </div>

                {copierGroups.length===0 && (
                  <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:12,padding:32,textAlign:"center",color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>
                    No groups created<br/><span style={{fontSize:9,marginTop:6,display:"block"}}>Create groups to select which accounts copy each trade</span>
                  </div>
                )}

                {copierGroups.map(grp=>{
                  const isActive = grp.id===activeGroupId;
                  const grpAccounts = copierAccounts.filter(a=>grp.accountIds.includes(a.id));
                  const masterAcc = grpAccounts.find(a=>a.isMaster);
                  const slofeAccs = grpAccounts.filter(a=>!a.isMaster);
                  const anyDanger = grpAccounts.some(a=>getAccountWarnings(a.id).some(w=>w.level==="danger"));
                  return (
                    <div key={grp.id} style={{background:C.card,border:`2px solid ${isActive?C.green+"88":anyDanger?C.red+"44":C.border}`,borderRadius:12,padding:16,transition:"border 0.2s"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                        <div>
                          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16}}>{grp.name}</div>
                          <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,marginTop:2}}>{grpAccounts.length} konton · {slofeAccs.length} slofes</div>
                        </div>
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>{setEditGroupId(grp.id);setNewGroupForm({name:grp.name,accountIds:[...grp.accountIds]});setShowAddGroup(true);}} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.textDim}}>✏ Edit</button>
                          <button onClick={()=>sofeCopierGroups(copierGroups.filter(g=>g.id!==grp.id))} style={{background:"transparent",border:"none",cursor:"pointer",color:C.red,fontSize:13,opacity:.5,padding:"4px 6px"}}>✕</button>
                        </div>
                      </div>

                      {/* Account-chips */}
                      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
                        {grpAccounts.map(a=>{
                          const w = getAccountWarnings(a.id);
                          const danger = w.some(x=>x.level==="danger");
                          const warn   = w.some(x=>x.level==="warning");
                          return (
                            <span key={a.id} style={{fontFamily:"'Space Mono',monospace",fontSize:9,borderRadius:6,padding:"3px 9px",background:a.isMaster?C.amber+"22":danger?C.red+"22":warn?C.amber+"11":FIRM_COLORS[a.firm]+"18",border:`1px solid ${a.isMaster?C.amber+"55":danger?C.red+"55":warn?C.amber+"44":FIRM_COLORS[a.firm]+"44"}`,color:a.isMaster?C.amber:danger?C.red:warn?C.amber:FIRM_COLORS[a.firm]}}>
                              {a.isMaster?"★ ":danger?"🔴 ":warn?"⚠ ":""}{a.name}
                            </span>
                          );
                        })}
                        {grpAccounts.length===0&&<span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>No accounts added</span>}
                      </div>

                      {/* Enable knapp */}
                      {anyDanger && (
                        <div style={{background:C.red+"11",border:`1px solid ${C.red}33`,borderRadius:6,padding:"5px 10px",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.red,marginBottom:8}}>
                          ⚠ One or more accounts are near breach — consider removing them from the group
                        </div>
                      )}
                      <button
                        onClick={()=>{ if(isActive){setActiveGroup(null);stopCopierBackend();}else{setActiveGroup(grp.id);startCopierBackend(grp);} }}
                        disabled={grpAccounts.length<2||!masterAcc}
                        style={{width:"100%",padding:"9px",borderRadius:8,cursor:grpAccounts.length<2||!masterAcc?"not-allowed":"pointer",background:isActive?`${C.green}22`:grpAccounts.length<2||!masterAcc?C.border:C.accentDim,border:`1px solid ${isActive?C.green:grpAccounts.length<2||!masterAcc?C.border:C.accent+"44"}`,color:isActive?C.green:grpAccounts.length<2||!masterAcc?C.muted:C.accent,fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,letterSpacing:"0.05em",transition:"all 0.15s"}}
                      >
                        {isActive?"⏹ Stop copying":grpAccounts.length<2?"Add at least 2 accounts":!masterAcc?"Set a master account":"▶ Enable grupp"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Add account modal ───────────────────────────────────── */}
            {showAddAccount&&(
              <div style={{position:"fixed",inset:0,background:"#00000088",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{background:theme==="dark"?C.surface:C.card,border:`1px solid ${theme==="dark"?C.border:"#dde3ec"}`,borderRadius:16,padding:32,width:440,maxWidth:"95vw"}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,marginBottom:20}}>Add account</div>
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {[
                      {label:"Accountnamn",key:"name",placeholder:"t.ex. 50k Flex · MFFU #1"},
                      {label:"Tradovate konto-ID",key:"accountId",placeholder:"t.ex. 12345678"},
                      {label:"Accountbalans (startbalans)",key:"accountSize",placeholder:"50000"},
                    ].map(f=>(
                      <div key={f.key}>
                        <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>{f.label}</div>
                        <input value={newAcctForm[f.key]} onChange={e=>setNewAcctForm(x=>({...x,[f.key]:e.target.value}))} placeholder={f.placeholder}
                          style={{width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}/>
                      </div>
                    ))}
                    <div>
                      <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>Prop Firm</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {Object.entries(FIRM_LABELS).map(([id,label])=>(
                          <button key={id} onClick={()=>setNewAcctForm(x=>({...x,firm:id}))}
                            style={{padding:"6px 14px",borderRadius:6,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,background:newAcctForm.firm===id?FIRM_COLORS[id]+"22":C.surface,border:`1px solid ${newAcctForm.firm===id?FIRM_COLORS[id]+"66":C.border}`,color:newAcctForm.firm===id?FIRM_COLORS[id]:C.textDim}}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{background:"#00e5ff08",border:"1px solid #00e5ff22",borderRadius:8,padding:"10px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim,lineHeight:1.5}}>
                      💡 Tradovate konto-ID hittar du under <strong style={{color:C.text}}>Account → Account Info</strong> i Tradovate-appen.
                      Copying happens via Tradovate's own API using your connected accounts.
                    </div>
                  </div>
                  <div style={{display:"flex",gap:10,marginTop:20}}>
                    <button onClick={()=>setShowAddAccount(false)} style={{flex:1,padding:"11px",borderRadius:10,cursor:"pointer",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>Cancel</button>
                    <button onClick={()=>{
                      if(!newAcctForm.name.trim()||!newAcctForm.accountId.trim()) return;
                      sofeCopierAccounts([...copierAccounts,{...newAcctForm,id:Date.now().toString(),isMaster:copierAccounts.length===0}]);
                      setShowAddAccount(false);
                      setNewAcctForm({name:"",firm:"mffu",accountSize:"50000",username:"",password:"",accountId:""});
                    }} style={{flex:2,padding:"11px",borderRadius:10,cursor:"pointer",background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700}}>
                      + Add account
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Skapa/redigera grupp modal ──────────────────────────────── */}
            {showAddGroup&&(
              <div style={{position:"fixed",inset:0,background:"#00000088",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{background:theme==="dark"?C.surface:C.card,border:`1px solid ${theme==="dark"?C.border:"#dde3ec"}`,borderRadius:16,padding:32,width:460,maxWidth:"95vw"}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,marginBottom:20}}>{editGroupId?"Edit grupp":"Create a groupp"}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:14}}>
                    <div>
                      <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>Gruppnamn</div>
                      <input value={newGroupForm.name} onChange={e=>setNewGroupForm(x=>({...x,name:e.target.value}))} placeholder="e.g. All accounts · Tradeify only · Safe mode"
                        style={{width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}/>
                    </div>
                    <div>
                      <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.07em"}}>Select accountn</div>
                      {copierAccounts.length===0
                        ? <div style={{color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11,padding:"12px 0"}}>Add accountn först</div>
                        : <div style={{display:"flex",flexDirection:"column",gap:7}}>
                            {copierAccounts.map(acc=>{
                              const checked = newGroupForm.accountIds.includes(acc.id);
                              const warnings = getAccountWarnings(acc.id);
                              const danger = warnings.some(w=>w.level==="danger");
                              const warn   = warnings.some(w=>w.level==="warning");
                              return (
                                <div key={acc.id} onClick={()=>setNewGroupForm(x=>({...x,accountIds:checked?x.accountIds.filter(i=>i!==acc.id):[...x.accountIds,acc.id]}))}
                                  style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,cursor:"pointer",background:checked?C.accentDim:C.surface,border:`1px solid ${checked?C.accent+"44":C.border}`,transition:"all 0.12s"}}>
                                  <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${checked?C.accent:C.border}`,background:checked?C.accentDim:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                    {checked&&<span style={{color:C.accent,fontSize:10}}>✓</span>}
                                  </div>
                                  <div style={{flex:1}}>
                                    <span style={{fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:13}}>{acc.name}</span>
                                    {acc.isMaster&&<span style={{marginLeft:6,fontFamily:"'Space Mono',monospace",fontSize:8,color:C.amber}}>★ MASTER</span>}
                                  </div>
                                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:FIRM_COLORS[acc.firm]}}>{FIRM_LABELS[acc.firm]}</span>
                                  {(danger||warn)&&<span style={{fontSize:10}}>{danger?"🔴":"⚠️"}</span>}
                                </div>
                              );
                            })}
                          </div>
                      }
                    </div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,padding:"6px 0"}}>
                      {newGroupForm.accountIds.length} accounts selected · {newGroupForm.accountIds.length>=2?"Ready to spara":"Select at least 2 accounts"}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:10,marginTop:20}}>
                    <button onClick={()=>{setShowAddGroup(false);setEditGroupId(null);}} style={{flex:1,padding:"11px",borderRadius:10,cursor:"pointer",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>Cancel</button>
                    <button onClick={()=>{
                      if(!newGroupForm.name.trim()||newGroupForm.accountIds.length<2) return;
                      if(editGroupId) {
                        sofeCopierGroups(copierGroups.map(g=>g.id===editGroupId?{...g,...newGroupForm}:g));
                      } else {
                        sofeCopierGroups([...copierGroups,{...newGroupForm,id:Date.now().toString()}]);
                      }
                      setShowAddGroup(false); setEditGroupId(null);
                    }} disabled={!newGroupForm.name.trim()||newGroupForm.accountIds.length<2}
                      style={{flex:2,padding:"11px",borderRadius:10,cursor:!newGroupForm.name.trim()||newGroupForm.accountIds.length<2?"not-allowed":"pointer",background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,opacity:!newGroupForm.name.trim()||newGroupForm.accountIds.length<2?.5:1}}>
                      {editGroupId?"Sofe ändringar":"Create a groupp"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Live stats + log ──────────────────────────────────────── */}
            {copierEnabled && copierStatus && (
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Live Statistik</div>
                <div style={{display:"flex",gap:12}}>
                  <StatCard label="Copied trades" value={String(copierStatus.stats?.copiedTrades||0)} sub="Denna session" color={C.green}/>
                  <StatCard label="Failed"       value={String(copierStatus.stats?.failedTrades||0)} sub="Kontrollera log" color={copierStatus.stats?.failedTrades>0?C.red:C.muted}/>
                  <StatCard label="WebSocket"         value={copierStatus.connected?"✓ Live":"⚠ Reconnecting"} sub={copierStatus.wsState} color={copierStatus.connected?C.green:C.amber}/>
                  <StatCard label="Slots"            value={String(copierStatus.slofeCount||0)} sub="Add accounts" color={C.accent}/>
                </div>

                {/* Kopieringslogg */}
                {copierLog.length>0 && (
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                    <div style={{padding:"12px 18px",borderBottom:`1px solid ${C.border}`,fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Kopieringslogg</div>
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                        {["Time","Action","Qty","Price","Succeeded","Failed"].map(h=><th key={h} style={{padding:"8px 16px",textAlign:"left",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.07em",textTransform:"uppercase",fontWeight:400}}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {copierLog.map((entry,i)=>(
                          <tr key={entry.id||i} style={{borderBottom:i<copierLog.length-1?`1px solid ${C.border}`:"none"}}
                            onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <td style={{padding:"9px 16px",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>{new Date(entry.timestamp).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</td>
                            <td style={{padding:"9px 16px"}}><span style={{background:entry.action==="Buy"?C.green+"18":C.red+"18",color:entry.action==="Buy"?C.green:C.red,borderRadius:4,padding:"2px 8px",fontFamily:"'Space Mono',monospace",fontSize:10}}>{entry.action}</span></td>
                            <td style={{padding:"9px 16px",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.text}}>{entry.qty}</td>
                            <td style={{padding:"9px 16px",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.textDim}}>{entry.price}</td>
                            <td style={{padding:"9px 16px",fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,color:C.green}}>{entry.succeeded}</td>
                            <td style={{padding:"9px 16px",fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,color:entry.failed>0?C.red:C.muted}}>{entry.failed}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>;
        })()}

        {tab==="guide"&&(()=>{
          const Section = ({icon, title, children}) => (
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"24px 28px",display:"flex",flexDirection:"column",gap:16}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:22}}>{icon}</span>
                <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:17,color:C.text}}>{title}</span>
              </div>
              {children}
            </div>
          );
          const Step = ({n, title, desc, code}) => (
            <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:C.accentDim,border:`1px solid ${C.accent}44`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"'Space Mono',monospace",fontSize:11,color:C.accent,fontWeight:700,marginTop:1}}>{n}</div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                <span style={{fontSize:14,fontWeight:600,color:C.text}}>{title}</span>
                {desc&&<span style={{fontSize:13,color:C.textDim,lineHeight:1.6}}>{desc}</span>}
                {code&&<code style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.accent,background:C.accentDim,border:`1px solid ${C.accent}22`,borderRadius:6,padding:"4px 10px",display:"inline-block",marginTop:2}}>{code}</code>}
              </div>
            </div>
          );
          const Chip = ({label, color}) => (
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,padding:"3px 10px",borderRadius:6,background:`${color}18`,border:`1px solid ${color}44`,color:color}}>{label}</span>
          );
          return (
            <div style={{padding:"32px 48px",display:"flex",flexDirection:"column",gap:28,maxWidth:860,margin:"0 auto",width:"100%"}}>

              {/* Header */}
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:26,color:C.text,margin:0}}>📖 Guide & Instructions</h1>
                <p style={{fontSize:14,color:C.textDim,margin:0,lineHeight:1.6}}>
                  Everything you need to know to get started with FundVault — from manual entry to automatic Tradovate sync.
                </p>
              </div>

              {/* Status badges */}
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <Chip label="✓ MANUAL ENTRY — AVAILABLE NOW" color={C.green}/>
                <Chip label="⏳ TRADOVATE SYNC — COMING SOON" color={C.amber}/>
              </div>

              {/* SEKTION 1 — Manuell inmatning */}
              <Section icon="📝" title="Manual trade entry">
                <p style={{fontSize:13,color:C.textDim,lineHeight:1.7,margin:0}}>
                  Log all your trades manually directly in FundVault. Perfect until automatic Tradovate sync is in place.
                </p>
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <Step n="1" title="Create account" desc="Go to the Accounts tab → click Add account → select your prop firm and fill in your account credentials."/>
                  <Step n="2" title="Log a trade" desc="Go to the Trades tab → click + New trade. Fill in instrument, direction, entry/exit, P&L and any tags."/>
                  <Step n="3" title="Add tags" desc="Use tags like 'revenge trade', 'FOMO', 'A-setup' to identify patterns in your trading."/>
                  <Step n="4" title="Check the dashboard" desc="The dashboard updates automatically with your statistics — win rate, average R, streak and more."/>
                </div>
                <div style={{background:C.accentDim,border:`1px solid ${C.accent}22`,borderRadius:10,padding:"12px 16px"}}>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.accent,letterSpacing:"0.05em"}}>💡 TIP</span>
                  <p style={{fontSize:13,color:C.textDim,margin:"6px 0 0",lineHeight:1.6}}>
                    Log trades right after you close them — the fresher the memory, the better the quality of your journal.
                  </p>
                </div>
              </Section>

              {/* SEKTION 2 — Psychology */}
              <Section icon="🧠" title="Psychology & mental preparation">
                <p style={{fontSize:13,color:C.textDim,lineHeight:1.7,margin:0}}>
                  FundVault's psychology feature helps you track your mental state and connects it to your results.
                </p>
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <Step n="1" title="Daily check-in" desc="Go to Psychology → log your mood (1–5) and check off your morning routines before trading."/>
                  <Step n="2" title="Enable Psychology Guard" desc="Under Settings in Psychology — enable Psychology Guard. Set minimum thresholds for mood and habits. FundVault warns you if you try to trade below your threshold."/>
                  <Step n="3" title="AI Coach" desc="Click the AI Coach button for a personal analysis based on your recent trades and psychology data. Get ✓ TRADE or ✗ WAIT?"/>
                  <Step n="4" title="Mood Calendar" desc="The mood calendar shows your mood over time — identify which weekdays or periods you trade worst."/>
                </div>
              </Section>

              {/* SEKTION 3 — Prop Firm */}
              <Section icon="🏢" title="Prop Firm Accounts & Rules">
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <Step n="1" title="Add prop firm account" desc="Accounts tab → Add account → select firm (MFFU, Lucid, Alpha Futures, TPT, Tradeify) → configure account size."/>
                  <Step n="2" title="Understand the rules" desc="Each firm has its own drawdown rules, daily loss limits and payout conditions. FundVault shows these visually with progress bars."/>
                  <Step n="3" title="News Blocking" desc="Enable news blocking under Accounts → Settings. You'll be automatically warned if you try to open trades near important news (NFP, FOMC etc)."/>
                  <Step n="4" title="Prop Firm-tab" desc="The Prop Firm tab gives a detailed view of each account — daily P&L, drawdown status, cycle progress and payout calculations."/>
                </div>
                <div style={{background:`${C.amber}11`,border:`1px solid ${C.amber}33`,borderRadius:10,padding:"12px 16px"}}>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.amber,letterSpacing:"0.05em"}}>⚠ IMPORTANT REMINDER</span>
                  <p style={{fontSize:13,color:C.textDim,margin:"6px 0 0",lineHeight:1.6}}>
                    FundVault tracks your rules based on entered trades. Always make sure your data matches what your prop firm reports.
                  </p>
                </div>
              </Section>

              {/* SEKTION 4 — Tradovate Sync (kommande) */}
              <Section icon="⚡" title="Automatic Tradovate sync — coming soon">
                <div style={{display:"flex",gap:10,marginBottom:4}}>
                  <Chip label="STATUS: IN DEVELOPMENT" color={C.amber}/>
                </div>
                <p style={{fontSize:13,color:C.textDim,lineHeight:1.7,margin:0}}>
                  We're working on an official integration with Tradovate's API. When complete, all your trades will sync automatically — no manual entry needed.
                </p>
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <Step n="1" title="Install FundVault Connector (Chrome)" desc="A small browser extension that securely connects your Tradovate session to FundVault. Your password is never shared."/>
                  <Step n="2" title="Log in to Tradovate" desc="Go to trader.tradovate.com and log in as usual. The extension fetches your session automatically."/>
                  <Step n="3" title="Trades sync automatically" desc="All your closed trades import automatically to FundVault — with P&L, time, instrument and account info."/>
                  <Step n="4" title="Live positions" desc="See your open positions in real time directly in FundVault, including unrealized P&L."/>
                </div>
                <div style={{background:`${C.accent}08`,border:`1px solid ${C.accent}22`,borderRadius:10,padding:"14px 16px",display:"flex",flexDirection:"column",gap:8}}>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.accent,letterSpacing:"0.05em"}}>🔔 GET NOTIFIED AT LAUNCH</span>
                  <p style={{fontSize:13,color:C.textDim,margin:0,lineHeight:1.6}}>
                    Follow us on social media or contact us via support to get notified when Tradovate sync goes live.
                  </p>
                </div>
              </Section>

              {/* SEKTION 5 — FAQ */}
              <Section icon="❓" title="FAQ">
                {[
                  ["Is FundVault connected to my prop firm?", "No — FundVault is an independent journaling tool. Your data is stored securely in our database and is not shared with your prop firm."],
                  ["Can I use FundVault with multiple accounts?", "Yes! You can add as many prop firm accounts as you want and see them all together in the dashboard."],
                  ["What if I enter incorrect data?", "You can edit and delete trades at any time. Go to the Trades tab, click on a trade to open and edit it."],
                  ["Does FundVault only work with Tradovate?", "Manual entry works for all brokers and prop firms. Automatic sync is primarily for Tradovate accounts."],
                  ["Is my data secure?", "All data is encrypted and stored in Supabase (PostgreSQL). We never sell your data to third parties."],
                ].map(([q,a])=>(
                  <div key={q} style={{borderBottom:`1px solid ${C.border}`,paddingBottom:14,display:"flex",flexDirection:"column",gap:6}}>
                    <span style={{fontSize:14,fontWeight:600,color:C.text}}>{q}</span>
                    <span style={{fontSize:13,color:C.textDim,lineHeight:1.6}}>{a}</span>
                  </div>
                ))}
              </Section>

              {/* Support */}
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"20px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:C.text}}>Need help?</div>
                  <div style={{fontSize:13,color:C.textDim,marginTop:4}}>Contact us at support@fundvault.app</div>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={()=>setTab("dashboard")} style={{padding:"9px 18px",borderRadius:8,background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer",fontWeight:700,letterSpacing:"0.04em"}}>
                    ← Back to dashboard
                  </button>
                </div>
              </div>

            </div>
          );
        })()}

      </div>
    </div>
    </ThemeCtx.Provider>
  );
}
