import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { tradesApi, propApi, psychApi, rulesApi, tradovateApi } from "./src/lib/api";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Cell
} from "recharts";

// ── Design tokens ─────────────────────────────────────────────────────────────
const DARK = {
  bg:"#080c14", surface:"#0d1420", card:"#111827", border:"#1e2d40",
  accent:"#00e5ff", accentDim:"#00e5ff22",
  green:"#00d084", red:"#ff3d5a", amber:"#f59e0b",
  purple:"#a78bfa", muted:"#4a6080", text:"#c8d8e8", textDim:"#6b859e",
};
const LIGHT = {
  bg:"#f0f4f8", surface:"#ffffff", card:"#ffffff", border:"#d1dce8",
  accent:"#0070f3", accentDim:"#0070f322",
  green:"#00a86b", red:"#e53e3e", amber:"#d97706",
  purple:"#7c3aed", muted:"#8da0b3", text:"#1a2636", textDim:"#4a6080",
};
// C is set dynamically inside the component; this fallback is for module-level helpers
let C = DARK;

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
  {id:"calm",    label:"Felt calm & focused",             icon:"🧘",category:"Mindset"   },
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

// Each firm has accountTypes — selecting one loads that type's rules + payout config.
// ── Prop firm data (last verified March 2026) ─────────────────────────────
// Rules change frequently — always verify on the firm's official website.
const DEFAULT_PROP_FIRMS = [
  {
    id:"mffu", name:"MyFundedFutures", color:"#00e5ff",
    activeType:"core",
    lastVerified:"March 2026",
    website:"https://myfundedfutures.com",
    accountTypes:[
      {
        id:"core", label:"Core", badge:"Core",
        accountSize:50000, payoutSplit:80, payoutFreq:"Bi-weekly", minPayout:500,
        description:"EOD trailing drawdown. 40% consistency rule. $77/month. (July 2025 plan overhaul — old Starter/Expert plans discontinued.)",
        payout:{ cycleTarget:3000, minDays:5, minProfit:200, buffer:1600, consistency:40 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:1500,description:"3% EOD trailing on $50K = $1,500. Trails at end of day. Locks when MLL reaches starting balance."},
          {id:"pt",label:"Profit Target (Eval)",   type:"target",  value:3000,description:"$3,000 (6%) to pass evaluation and move to funded"},
          {id:"md",label:"Min Profitable Days",    type:"days",    value:5,   description:"5 days with $200+ profit per payout cycle"},
          {id:"cs",label:"Consistency Rule (40%)", type:"consist", value:40,  description:"No single day can exceed 40% of total payout cycle profits"},
          {id:"nd",label:"No Daily Loss Limit",    type:"info",    value:0,   description:"MFFU removed daily loss limits — no DLL on any plan"},
        ]
      },
      {
        id:"rapid", label:"Rapid", badge:"Rapid ★",
        accountSize:50000, payoutSplit:90, payoutFreq:"Daily eligible", minPayout:500,
        description:"Intraday trailing drawdown (stricter). 90/10 split (upgraded Jan 12, 2026). $129/month. Best split but harder drawdown.",
        payout:{ cycleTarget:3000, minDays:5, minProfit:200, buffer:1600, consistency:40 },
        rules:[
          {id:"dd",label:"Intraday Trailing Drawdown", type:"drawdown",value:1500,description:"⚠ Intraday trailing — trails unrealized equity in real-time, not just EOD. More difficult than Core/Pro."},
          {id:"pt",label:"Profit Target (Eval)",       type:"target",  value:3000,description:"$3,000 to pass evaluation"},
          {id:"md",label:"Min Profitable Days",        type:"days",    value:5,   description:"5 profitable days ($200+) per payout cycle"},
          {id:"cs",label:"Consistency Rule (40%)",     type:"consist", value:40,  description:"No single day > 40% of total cycle profits"},
          {id:"nd",label:"No Daily Loss Limit",        type:"info",    value:0,   description:"No DLL on Rapid — intraday trailing drawdown is the only limit"},
        ]
      },
      {
        id:"pro", label:"Pro", badge:"Pro",
        accountSize:50000, payoutSplit:80, payoutFreq:"Bi-weekly", minPayout:500,
        description:"EOD drawdown like Core but no consistency rule on funded stage. $229/month. Best for inconsistent P&L patterns.",
        payout:{ cycleTarget:3000, minDays:5, minProfit:200, buffer:1600, consistency:999 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:1500,description:"3% EOD trailing — same as Core. Locks at starting balance."},
          {id:"pt",label:"Profit Target (Eval)",   type:"target",  value:3000,description:"$3,000 to pass evaluation"},
          {id:"md",label:"Min Profitable Days",    type:"days",    value:5,   description:"5 profitable days per payout cycle"},
          {id:"nd",label:"No Consistency Rule",    type:"info",    value:0,   description:"No consistency rule on funded stage — best day can be any % of cycle"},
          {id:"na",label:"No Daily Loss Limit",    type:"info",    value:0,   description:"No DLL on any MFFU plan"},
        ]
      },
    ]
  },
  {
    id:"lucid", name:"Lucid Trading", color:"#a78bfa",
    activeType:"flex",
    lastVerified:"March 2026",
    website:"https://lucidtrading.com",
    accountTypes:[
      {
        id:"flex", label:"LucidFlex", badge:"Flex ★",
        accountSize:50000, payoutSplit:90, payoutFreq:"Daily eligible (5 days/cycle)", minPayout:500,
        description:"No DLL. No consistency rule. EOD trailing. One-time fee. Best Lucid plan for aggressive traders. (LucidBlack discontinued Feb 2026.)",
        payout:{ cycleTarget:3000, minDays:5, minProfit:0, buffer:100, consistency:999 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:2000,description:"$2,000 EOD trailing on $50K. Locks permanently at starting balance once reached."},
          {id:"pt",label:"Profit Target (Eval)",   type:"target",  value:3000,description:"$3,000 (6%) profit target on $50K. Min 5 trading days."},
          {id:"md",label:"Min Trading Days",       type:"days",    value:5,   description:"5 trading days minimum during evaluation"},
          {id:"nc",label:"No Consistency Rule",    type:"info",    value:0,   description:"Zero consistency rule on funded stage — one big day is fine"},
          {id:"nd",label:"No Daily Loss Limit",    type:"info",    value:0,   description:"No DLL on LucidFlex — only the EOD trailing drawdown"},
        ]
      },
      {
        id:"pro", label:"LucidPro", badge:"Pro",
        accountSize:50000, payoutSplit:90, payoutFreq:"Daily eligible (5 days/cycle)", minPayout:500,
        description:"40% consistency rule. 100% of first $10K then 90/10. One-time fee. EOD trailing.",
        payout:{ cycleTarget:3000, minDays:5, minProfit:0, buffer:100, consistency:40 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:2000,description:"$2,000 EOD trailing on $50K. Never adjusts intraday."},
          {id:"pt",label:"Profit Target (Eval)",   type:"target",  value:3000,description:"$3,000 profit target to pass"},
          {id:"md",label:"Min Trading Days",       type:"days",    value:5,   description:"5 trading days minimum in eval"},
          {id:"cs",label:"Consistency Rule (40%)", type:"consist", value:40,  description:"No single day > 40% of total payout cycle profits"},
          {id:"dl",label:"Daily Loss Limit",       type:"loss",    value:600, description:"20% of profit target = ~$600 DLL on $50K account"},
        ]
      },
      {
        id:"direct", label:"LucidDirect", badge:"Direct",
        accountSize:50000, payoutSplit:90, payoutFreq:"Daily eligible", minPayout:500,
        description:"Skip eval entirely — instant funded. Soft DLL (account paused, not failed). 100% of first $10K then 90/10.",
        payout:{ cycleTarget:3000, minDays:5, minProfit:0, buffer:100, consistency:40 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:2000,description:"$2,000 EOD trailing. No eval required."},
          {id:"md",label:"Min Trading Days",       type:"days",    value:5,   description:"5 trading days per payout cycle"},
          {id:"cs",label:"Consistency Rule (40%)", type:"consist", value:40,  description:"Max 40% of cycle profit from one day"},
          {id:"dl",label:"Soft Daily Loss Limit",  type:"loss",    value:600, description:"Soft DLL — account paused for the day if breached, not permanently failed"},
        ]
      },
    ]
  },
  {
    id:"apex", name:"Apex Trader Funding", color:"#f97316",
    activeType:"eod50",
    lastVerified:"March 2026",
    website:"https://apextraderfunding.com",
    accountTypes:[
      {
        id:"eod50", label:"EOD $50K", badge:"EOD",
        accountSize:50000, payoutSplit:100, payoutFreq:"Twice/month (8 trading days min)", minPayout:500,
        description:"100% of first $25K, then 90/10. EOD trailing. DLL only on EOD accounts. March 2026 overhaul: no min trading days in eval. 30-day eval time limit.",
        payout:{ cycleTarget:3000, minDays:5, minProfit:0, buffer:2600, consistency:50 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:2500,description:"$2,500 trailing on $50K. EOD — doesn't trail intraday. Stops at starting balance."},
          {id:"pt",label:"Profit Target (Eval)",   type:"target",  value:3000,description:"$3,000 to pass. No minimum trading days (removed March 2026). 30-day calendar limit."},
          {id:"dl",label:"Daily Loss Limit (EOD)", type:"loss",    value:1000,description:"$1,000 DLL on EOD accounts only. Pauses trading for the day — does not fail account."},
          {id:"cs",label:"Consistency Rule (50%)", type:"consist", value:50,  description:"No single day > 50% of total profits since last payout (funded phase only)"},
          {id:"bf",label:"Safety Net Buffer",      type:"target",  value:2600,description:"Balance must be $52,600 ($50K + $2,500 + $100) to submit payout request"},
        ]
      },
      {
        id:"intraday50", label:"Intraday $50K", badge:"Intraday",
        accountSize:50000, payoutSplit:100, payoutFreq:"Twice/month (8 trading days min)", minPayout:500,
        description:"Same as EOD but with intraday trailing drawdown (harder). No DLL. 100% of first $25K.",
        payout:{ cycleTarget:3000, minDays:5, minProfit:0, buffer:2600, consistency:50 },
        rules:[
          {id:"dd",label:"Intraday Trailing Drawdown", type:"drawdown",value:2500,description:"⚠ Trails unrealized equity tick-by-tick. Hardest drawdown type — even intraday highs move the floor."},
          {id:"pt",label:"Profit Target (Eval)",       type:"target",  value:3000,description:"$3,000 profit target. 30-day calendar limit."},
          {id:"nd",label:"No Daily Loss Limit",        type:"info",    value:0,   description:"No DLL on intraday accounts — trailing drawdown is the only limit"},
          {id:"cs",label:"Consistency Rule (50%)",     type:"consist", value:50,  description:"No single day > 50% of profits since last payout"},
        ]
      },
      {
        id:"eod100", label:"EOD $100K", badge:"$100K EOD",
        accountSize:100000, payoutSplit:100, payoutFreq:"Twice/month", minPayout:500,
        description:"$100K account. $6,000 profit target. 100% of first $25K per account.",
        payout:{ cycleTarget:6000, minDays:5, minProfit:0, buffer:3100, consistency:50 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:3000,description:"$3,000 trailing on $100K. EOD calculation."},
          {id:"pt",label:"Profit Target (Eval)",   type:"target",  value:6000,description:"$6,000 to pass. No minimum days."},
          {id:"dl",label:"Daily Loss Limit",       type:"loss",    value:1500,description:"$1,500 DLL on $100K EOD — pauses day, doesn't fail account"},
          {id:"cs",label:"Consistency Rule (50%)", type:"consist", value:50,  description:"No single day > 50% of profits since last payout"},
        ]
      },
    ]
  },
  {
    id:"topstep", name:"Topstep", color:"#3b82f6",
    activeType:"50k",
    lastVerified:"March 2026",
    website:"https://topstep.com",
    accountTypes:[
      {
        id:"50k", label:"$50K Combine", badge:"$50K",
        accountSize:50000, payoutSplit:90, payoutFreq:"Weekly (5 winning days)", minPayout:100,
        description:"Since Jan 2026: flat 90/10 from first payout (no longer 100% first $10K for new accounts). EOD trailing. 10 profitable days min to pass eval — highest in industry. TopstepX platform mandatory for new accounts.",
        payout:{ cycleTarget:3000, minDays:5, minProfit:150, buffer:0, consistency:40 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:2000,description:"$2,000 MLL on $50K. EOD — intraday dips don't count. Trails upward with profits."},
          {id:"dl",label:"Daily Loss Limit",       type:"loss",    value:1000,description:"$1,000 DLL. Breach = account failed (not just paused). Intraday — includes unrealized losses."},
          {id:"pt",label:"Profit Target (Eval)",   type:"target",  value:3000,description:"$3,000 to pass Trading Combine. Min 10 profitable days required (highest in industry)."},
          {id:"md",label:"Min 10 Profitable Days", type:"days",    value:10,  description:"Must have 10 profitable trading days to pass eval — stricter than most firms"},
          {id:"cs",label:"Consistency Rule (40%)", type:"consist", value:40,  description:"No single day > 40% of total payout cycle profits"},
          {id:"wk",label:"Weekend Close Required", type:"hold",    value:1,   description:"All positions must be flat by 4 PM ET Friday. No weekend holds."},
        ]
      },
      {
        id:"100k", label:"$100K Combine", badge:"$100K",
        accountSize:100000, payoutSplit:90, payoutFreq:"Weekly (5 winning days)", minPayout:100,
        description:"$100K account. Same rules scaled. $99/month.",
        payout:{ cycleTarget:6000, minDays:5, minProfit:150, buffer:0, consistency:40 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:3000,description:"$3,000 MLL on $100K. EOD calculation."},
          {id:"dl",label:"Daily Loss Limit",       type:"loss",    value:2000,description:"$2,000 DLL — breach fails account immediately"},
          {id:"pt",label:"Profit Target (Eval)",   type:"target",  value:6000,description:"$6,000 profit target. Min 10 profitable days."},
          {id:"md",label:"Min 10 Profitable Days", type:"days",    value:10,  description:"10 profitable days minimum to pass eval"},
          {id:"cs",label:"Consistency Rule (40%)", type:"consist", value:40,  description:"No single day > 40% of cycle profits"},
          {id:"wk",label:"Weekend Close Required", type:"hold",    value:1,   description:"All positions flat by 4 PM ET Friday"},
        ]
      },
      {
        id:"150k", label:"$150K Combine", badge:"$150K",
        accountSize:150000, payoutSplit:90, payoutFreq:"Weekly", minPayout:100,
        description:"Largest Topstep account. $149/month.",
        payout:{ cycleTarget:9000, minDays:5, minProfit:150, buffer:0, consistency:40 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:4500,description:"$4,500 MLL on $150K. EOD calculation."},
          {id:"dl",label:"Daily Loss Limit",       type:"loss",    value:3000,description:"$3,000 DLL — breach fails account"},
          {id:"pt",label:"Profit Target (Eval)",   type:"target",  value:9000,description:"$9,000 profit target. Min 10 profitable days."},
          {id:"md",label:"Min 10 Profitable Days", type:"days",    value:10,  description:"10 profitable days minimum"},
          {id:"cs",label:"Consistency Rule (40%)", type:"consist", value:40,  description:"No single day > 40% of cycle profits"},
          {id:"wk",label:"Weekend Close Required", type:"hold",    value:1,   description:"All positions flat by 4 PM ET Friday"},
        ]
      },
    ]
  },
  {
    id:"tradeify", name:"Tradeify", color:"#34d399",
    activeType:"selectflex",
    lastVerified:"March 2026",
    website:"https://tradeify.co",
    accountTypes:[
      {
        id:"selectflex", label:"Select Flex", badge:"Best ★",
        accountSize:50000, payoutSplit:90, payoutFreq:"Every 5 winning days", minPayout:500,
        description:"No DLL, no consistency rule funded. Drawdown locks permanently at $50,100 after first payout — can never fail from drawdown after that. Best Tradeify plan.",
        payout:{ cycleTarget:2000, minDays:5, minProfit:0, buffer:0, consistency:999 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:2000,description:"$2,000 trailing on $50K. Locks permanently at $50,100 after first payout — drawdown failure impossible afterwards."},
          {id:"pt",label:"Profit Target (Eval)",   type:"target",  value:2000,description:"$2,000 to pass. Min 3 trading days in eval."},
          {id:"md",label:"5 Winning Days",         type:"days",    value:5,   description:"5 profitable days per payout cycle (any $ amount counts)"},
          {id:"nc",label:"No Consistency Rule",    type:"info",    value:0,   description:"No consistency rule on funded stage"},
          {id:"nd",label:"No Daily Loss Limit",    type:"info",    value:0,   description:"No DLL on Select Flex"},
        ]
      },
      {
        id:"selectdaily", label:"Select Daily", badge:"Daily",
        accountSize:50000, payoutSplit:90, payoutFreq:"Daily (once conditions met)", minPayout:150,
        description:"Daily payouts but with DLL and 35% consistency rule. Good for high-frequency traders.",
        payout:{ cycleTarget:1500, minDays:5, minProfit:150, buffer:0, consistency:35 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:2000,description:"$2,000 EOD trailing. Same locking mechanism as Flex after first payout."},
          {id:"dl",label:"Daily Loss Limit",       type:"loss",    value:1000,description:"$1,000 hard DLL on $50K — pauses trading for the day"},
          {id:"pt",label:"Profit Target (Eval)",   type:"target",  value:2000,description:"$2,000 profit target in eval"},
          {id:"md",label:"5 Winning Days",         type:"days",    value:5,   description:"5 profitable days ($150+) per payout cycle"},
          {id:"cs",label:"Consistency Rule (35%)", type:"consist", value:35,  description:"No single day > 35% of total cycle profits"},
        ]
      },
      {
        id:"lightning", label:"Lightning Funded", badge:"Instant",
        accountSize:50000, payoutSplit:90, payoutFreq:"Bi-weekly", minPayout:1000,
        description:"Skip eval entirely. One-time fee. Progressive consistency rule. Cannot be reset if failed.",
        payout:{ cycleTarget:3000, minDays:7, minProfit:150, buffer:100, consistency:20 },
        rules:[
          {id:"dd",label:"EOD Trailing Drawdown",  type:"drawdown",value:2000,description:"$2,000 EOD trailing. Locks at $50,100 once sufficient buffer built."},
          {id:"md",label:"Min 7 Trading Days",     type:"days",    value:7,   description:"7 trading days min with 5 profitable ($150+) per payout cycle"},
          {id:"cs",label:"Consistency (20–35%)",   type:"consist", value:20,  description:"Progressive: starts 20% first payout, increases over time. No single day can dominate."},
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
  {id:5, date:"2024-03-13", time:"10:00",currency:"USD",impact:"low",   event:"UoM Consumer Sentiment",forecast:"77.1",previous:"76.9",actual:null},
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

// ── FlattenWidget — Floating position manager ──────────────────────────────
function FlattenWidget({ tvStatus, mobileMode = false, appIsDemo = false, C: theme }) {
  // Use passed theme or fall back to dark defaults
  const W = theme || {
    bg:"#080c14", surface:"#0d1420", card:"#111827", border:"#1e2d40",
    accent:"#00e5ff", accentDim:"#00e5ff22",
    green:"#00d084", red:"#ff3d5a", amber:"#f59e0b",
    purple:"#a78bfa", muted:"#4a6080", text:"#c8d8e8", textDim:"#6b859e",
  };
  const [positions,  setPositions ] = useState([]);
  const [selected,   setSelected  ] = useState({});
  const [loading,    setLoading   ] = useState(false);
  const [flattening, setFlattening] = useState(false);
  const [expanded,   setExpanded  ] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [error,      setError     ] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const demoModeRef = useRef(false);

  // Sync with app-level demo toggle
  useEffect(() => {
    demoModeRef.current = appIsDemo;
    setDemoMode(appIsDemo);
    setPositions([]);
    setSelected({});
    // Trigger immediate fetch with new mode
    setTimeout(() => fetchPositionsWithMode(appIsDemo), 50);
  }, [appIsDemo]);
  const [cancellingOrders, setCancellingOrders] = useState(false);

  const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const DEMO_POSITIONS = [
    { id: 1, symbol: "NQ", side: "Long",  size:  2, avgPrice: "19842.50", currentPrice: "19901.25", unrealized: 2350 },
    { id: 2, symbol: "ES", side: "Short", size: -1, avgPrice: "5621.00",  currentPrice: "5618.50",  unrealized: 125  },
    { id: 3, symbol: "MNQ",side: "Long",  size:  5, avgPrice: "19840.00", currentPrice: "19901.25", unrealized: 612  },
  ];

  const fetchPositionsWithMode = async (isDemo) => {
    setLoading(true); setError(null);
    if (isDemo) {
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
      // Map DB format to display format
      setPositions(Array.isArray(data) ? data.map(p => ({
        id:           p.id,
        symbol:       p.symbol,
        side:         p.side,
        size:         p.size,
        avgPrice:     p.avg_price?.toFixed(2) || "—",
        currentPrice: p.avg_price?.toFixed(2) || "—",
        unrealized:   p.unrealized_pnl || 0,
        openedAt:     p.opened_at,
      })) : []);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("[Positions]", err.message);
      setPositions([]);
    }
    setLoading(false);
  };

  // Hämta öppna positioner (demo-läge om Tradovate ej anslutet)
  const fetchPositions = async () => fetchPositionsWithMode(demoModeRef.current);

  // Poll positions every 10s — positions come from open_positions table
  // which is populated by real-time fill events from the stream
  useEffect(() => {
    if (demoMode) {
      fetchPositions();
      const interval = setInterval(fetchPositions, 3000);
      return () => clearInterval(interval);
    }
    if (!tvStatus?.connected) return;

    fetchPositions();
    const interval = setInterval(fetchPositions, 10000);
    return () => clearInterval(interval);
  }, [tvStatus?.connected, demoMode]);

  // Listen for real-time position updates from SSE stream (via window event)
  useEffect(() => {
    const handler = () => fetchPositions();
    window.addEventListener("fv:positions_updated", handler);
    return () => window.removeEventListener("fv:positions_updated", handler);
  }, []);

  const toggleSelect = (id) => setSelected(s => ({ ...s, [id]: !s[id] }));
  const selectedIds  = positions.filter(p => selected[p.id]).map(p => p.id);
  const totalUnrealized = positions.reduce((a, p) => a + (p.unrealized || 0), 0);

  // Stäng valda positioner
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
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ positionIds: selectedIds })
      });
      setSelected({});
      await fetchPositions();
    } catch (err) { setError("Flatten failed: " + err.message); }
    setFlattening(false);
  };

  // Stäng ALLA positioner
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
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ all: true })
      });
      setSelected({});
      await fetchPositions();
    } catch (err) { setError("Flatten failed: " + err.message); }
    setFlattening(false);
  };

  // Cancelera ALLA väntande orders
  const cancelAllOrders = async () => {
    setConfirmAll(false);
    setCancellingOrders(true); setError(null);
    if (demoMode) {
      await new Promise(r => setTimeout(r, 800));
      setCancellingOrders(false);
      setError(null);
      // Visa en bekräftelse i demo-läge
      setError("🎭 DEMO: All pending orders cancelled!");
      setTimeout(() => setError(null), 3000);
      return;
    }
    try {
      const token = await getToken();
      const res = await fetch(`${API}/tradovate/cancelorders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      setError(`✓ ${result.message}`);
      setTimeout(() => setError(null), 3000);
    } catch (err) { setError("Cancel failed: " + err.message); }
    setCancellingOrders(false);
  };

  // Visa alltid så demo-läge är tillgängligt

  const hasPositions = positions.length > 0;

  return (
    <div className={mobileMode ? "fv-flatten-widget-inline" : "fv-flatten-widget"} style={{
      position: mobileMode ? "relative" : "fixed",
      bottom: mobileMode ? undefined : 24,
      right: mobileMode ? undefined : 24,
      zIndex: mobileMode ? undefined : 9999,
      width: mobileMode ? "100%" : (expanded ? 340 : 200),
      background: W.surface,
      border: `2px solid ${demoMode ? W.purple+"66" : hasPositions ? W.red+"66" : W.border}`,
      borderRadius: 14,
      boxShadow: hasPositions ? `0 0 30px ${W.red}22` : "0 8px 32px #00000099",
      transition: "width 0.2s",
      overflow: "hidden",
      fontFamily: "'DM Sans', sans-serif",
    }}>

      {/* Header */}
      <div
        onClick={() => { if (!mobileMode) setExpanded(e => !e); }}
        style={{
          padding: "10px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: (expanded || mobileMode) ? `1px solid ${W.border}` : "none",
          cursor: mobileMode ? "default" : "pointer",
          background: hasPositions ? `${W.red}08` : "transparent",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: hasPositions ? W.red : W.green,
            boxShadow: `0 0 6px ${hasPositions ? W.red : W.green}`,
            animation: hasPositions ? "pulse 1.5s ease-in-out infinite" : "none",
          }}/>
          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: W.text, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {hasPositions ? `${positions.length} Open` : "No Positions"}
          </span>
          {hasPositions && (
            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: totalUnrealized >= 0 ? W.green : W.red }}>
              {totalUnrealized >= 0 ? "+" : ""}${Math.round(totalUnrealized)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {loading && <div style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${W.border}`, borderTop: `2px solid ${W.accent}`, animation: "spin 0.8s linear infinite" }}/>}
          {!mobileMode && <>
            <button
              onClick={e => { e.stopPropagation(); setDemoMode(d => !d); setPositions([]); setSelected({}); }}
              style={{ background: demoMode ? `${W.purple}22` : "transparent", border: `1px solid ${demoMode ? W.purple+"66" : W.border}`, borderRadius: 4, padding: "2px 7px", cursor: "pointer", fontFamily: "'Space Mono',monospace", fontSize: 8, color: demoMode ? W.purple : W.muted, letterSpacing: "0.05em" }}
              title="Test without Tradovate"
            >DEMO</button>
            <span style={{ color: W.muted, fontSize: 12 }}>{expanded ? "▼" : "▲"}</span>
          </>}
        </div>
      </div>

      {/* Body */}
      {(expanded || mobileMode) && (
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>

          {demoMode && (
            <div style={{ background: `${W.purple}15`, border: `1px solid ${W.purple}44`, borderRadius: 6, padding: "6px 10px", fontSize: 10, color: W.purple, fontFamily: "'Space Mono',monospace", textAlign: "center" }}>
              🎭 DEMO MODE — no real orders sent
            </div>
          )}

          {error && (
            <div style={{ background: `${W.red}15`, border: `1px solid ${W.red}44`, borderRadius: 6, padding: "6px 10px", fontSize: 11, color: W.red }}>
              ⚠ {error}
            </div>
          )}

          {hasPositions ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: mobileMode ? "none" : 200, overflowY: mobileMode ? "visible" : "auto" }}>
                {positions.map(p => (
                  <div key={p.id} onClick={() => toggleSelect(p.id)} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px", borderRadius: 8, cursor: "pointer",
                    background: selected[p.id] ? `${W.red}18` : W.card,
                    border: `1px solid ${selected[p.id] ? W.red+"55" : W.border}`,
                    transition: "all 0.12s",
                  }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                      border: `1.5px solid ${selected[p.id] ? W.red : W.muted}`,
                      background: selected[p.id] ? `${W.red}33` : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {selected[p.id] && <span style={{ color: W.red, fontSize: 9 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: W.text }}>{p.symbol}</span>
                        <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: (p.unrealized||0) >= 0 ? W.green : W.red }}>
                          {(p.unrealized||0) >= 0 ? "+" : ""}${Math.round(p.unrealized||0)}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: p.side === "Long" ? W.green : W.red }}>
                          {p.side} · {Math.abs(p.size)} contracts
                        </span>
                        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: W.muted }}>@ {p.avgPrice}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {lastUpdate && (
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: W.muted, textAlign: "center" }}>
                  Updated {lastUpdate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
                {selectedIds.length > 0 && (
                  <button onClick={flattenSelected} disabled={flattening || cancellingOrders} style={{
                    width: "100%", padding: "8px", borderRadius: 8, cursor: "pointer",
                    background: `${W.amber}22`, border: `1px solid ${W.amber}66`,
                    color: W.amber, fontFamily: "'Space Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                  }}>
                    {flattening ? "Closing..." : `✕ Close ${selectedIds.length} selected`}
                  </button>
                )}
                <button onClick={() => setConfirmAll("positions")} disabled={flattening || cancellingOrders} style={{
                  width: "100%", padding: "9px", borderRadius: 8, cursor: "pointer",
                  background: `${W.red}22`, border: `1px solid ${W.red}66`,
                  color: W.red, fontFamily: "'Space Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                }}>
                  {flattening ? "Closing positions..." : "🔴 Flatten ALL — Close all positions"}
                </button>
                <button onClick={() => setConfirmAll("orders")} disabled={flattening || cancellingOrders} style={{
                  width: "100%", padding: "9px", borderRadius: 8, cursor: "pointer",
                  background: `${W.amber}22`, border: `1px solid ${W.amber}66`,
                  color: W.amber, fontFamily: "'Space Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                }}>
                  {cancellingOrders ? "Cancelling orders..." : "⛔ Cancel ALL — Cancel all pending orders"}
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "12px 0", fontFamily: "'Space Mono',monospace", fontSize: 11, color: W.muted }}>
              No open positions
            </div>
          )}
        </div>
      )}

      {confirmAll && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 20000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: W.surface, border: `1px solid ${confirmAll === "positions" ? W.red+"66" : W.amber+"66"}`, borderRadius: 16, padding: 32, maxWidth: 340, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{confirmAll === "positions" ? "🔴" : "⛔"}</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20, color: confirmAll === "positions" ? W.red : W.amber, marginBottom: 8 }}>
              {confirmAll === "positions" ? "Flatten ALL?" : "Cancel ALL Orders?"}
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: W.textDim, marginBottom: 8 }}>
              {confirmAll === "positions"
                ? <>This will close <strong style={{ color: W.text }}>all {positions.length} open positions</strong> immediately with market orders.</>
                : <>This will cancel <strong style={{ color: W.text }}>all pending limit and stop orders</strong>. Open positions are not affected.</>
              }
            </div>
            {confirmAll === "positions" && (
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, color: totalUnrealized >= 0 ? W.green : W.red, marginBottom: 24, fontWeight: 700 }}>
                Unrealized: {totalUnrealized >= 0 ? "+" : ""}${Math.round(totalUnrealized)}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setConfirmAll(false)} style={{ flex: 1, padding: "12px", borderRadius: 10, cursor: "pointer", background: "transparent", border: `1px solid ${W.border}`, color: W.muted, fontFamily: "'Space Mono',monospace", fontSize: 11 }}>
                Cancel
              </button>
              <button onClick={() => { confirmAll === "positions" ? flattenAll() : cancelAllOrders(); }}
                style={{ flex: 1, padding: "12px", borderRadius: 10, cursor: "pointer", background: confirmAll === "positions" ? `${W.red}22` : `${W.amber}22`, border: `1px solid ${confirmAll === "positions" ? W.red : W.amber}`, color: confirmAll === "positions" ? W.red : W.amber, fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700 }}>
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
function NewsTab({ econFilter, setEconFilter, C, newsBlocker, saveNewsBlocker, onEventsLoaded }) {
  const [events,    setEvents  ] = useState([]);
  const [loading,   setLoading ] = useState(true);
  const [error,     setError   ] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [nowTime,   setNowTime ] = useState(new Date());

  // Refresh current time every minute for News Guard
  useEffect(() => {
    const t = setInterval(() => setNowTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const fetchCalendar = async () => {
    setLoading(true); setError(null);
    try {
      const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
      // Normalize any format (backend or FF JSON) to our internal format
      const normalize = (raw, source="ff") => raw.map(e => {
        // Backend format: date="2026-03-20", time="08:30", currency, impact (already lowercase), event
        // FF JSON format: date=ISO string, country, impact="High"/"Medium", title
        const isFF = source === "ff";
        const rawDate = isFF ? (e.date||"") : (e.date||"");
        const date = rawDate.length > 10 ? rawDate.slice(0,10) : rawDate;
        const time = isFF
          ? (e.date ? new Date(e.date).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",timeZone:"America/New_York"}) : "")
          : (e.time || "");
        return {
          date,
          time,
          currency: isFF ? e.country : e.currency,
          impact:   isFF ? (e.impact==="High"?"high":e.impact==="Medium"?"medium":"low") : (e.impact||"low"),
          event:    isFF ? e.title : (e.event||e.title||e.name||""),
          forecast: e.forecast || null,
          previous: e.previous || null,
          actual:   (e.actual && e.actual !== "") ? e.actual : null,
        };
      }).filter(e => e.date && e.event);

      // Try backend for this week + next week
      const [r1, r2] = await Promise.allSettled([
        fetch(`${API}/calendar/thisweek`, { cache:"no-store" }),
        fetch(`${API}/calendar/nextweek`,  { cache:"no-store" }),
      ]);
      const week1 = r1.status==="fulfilled" && r1.value.ok ? normalize(await r1.value.json(), "backend") : [];
      const week2 = r2.status==="fulfilled" && r2.value.ok ? normalize(await r2.value.json(), "backend") : [];

      if (week1.length > 0 || week2.length > 0) {
        const all = [...week1, ...week2];
        setEvents(all);
        if (onEventsLoaded) onEventsLoaded(all);
        setLastFetch(new Date());
        setLoading(false);
        return;
      }

      // Fallback: FF JSON via CORS proxy (allorigins)
      const proxy = url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const [p1, p2] = await Promise.allSettled([
        fetch(proxy("https://nfs.faireconomy.media/ff_calendar_thisweek.json"), { cache:"no-store" }),
        fetch(proxy("https://nfs.faireconomy.media/ff_calendar_nextweek.json"),  { cache:"no-store" }),
      ]);
      const parse = async r => {
        if (r.status !== "fulfilled" || !r.value.ok) return [];
        const json = await r.value.json();
        const raw = typeof json.contents === "string" ? JSON.parse(json.contents) : json;
        return normalize(Array.isArray(raw) ? raw : [], "ff");
      };
      const pw1 = await parse(p1);
      const pw2 = await parse(p2);
      const allProxy = [...pw1, ...pw2];
      setEvents(allProxy);
      if (onEventsLoaded) onEventsLoaded(allProxy);
      setLastFetch(new Date());
    } catch {
      setError("Could not load calendar. Check your connection.");
      setEvents([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCalendar(); }, []);

  const impactColor = i => i === "high" ? C.red : i === "medium" ? C.amber : C.muted;
  const impactDots  = i => i === "high" ? 3 : i === "medium" ? 2 : 1;
  const dayNames    = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const today       = new Date().toISOString().slice(0, 10);

  // Only today and future — filter out past days
  const futureEvents = events.filter(e => e.date >= today);
  const filtered = econFilter === "all" ? futureEvents : futureEvents.filter(e => e.impact === econFilter);
  const days = [...new Set(filtered.map(e => e.date))].sort();

  // ── News Guard: high-impact events within next 2 hours ──────────────────
  const parseEventMinutes = (ev) => {
    if (!ev.time || ev.date !== today) return null;
    try {
      const t = ev.time.trim();
      const [hm, ampm] = [t.replace(/ ?[AaPp][Mm]/,""), t.match(/[AaPp][Mm]/)?.[0]?.toUpperCase()];
      let [h, m] = hm.split(":").map(Number);
      if (ampm === "PM" && h < 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      return h * 60 + (m || 0);
    } catch { return null; }
  };
  const nowMinutes = nowTime.getHours() * 60 + nowTime.getMinutes();
  const upcomingHigh = futureEvents.filter(ev => {
    if (ev.impact !== "high" || ev.actual) return false;
    const evMin = parseEventMinutes(ev);
    if (evMin === null) return ev.date === today; // today but no parseable time → show
    return evMin >= nowMinutes && evMin <= nowMinutes + 120;
  });
  const guardBlocked = upcomingHigh.length > 0;
  const nextEv = upcomingHigh[0];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:22}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.textDim,letterSpacing:"0.1em",textTransform:"uppercase"}}>Economic Calendar</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,marginTop:4}}>News & Events</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          {lastFetch && <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>Updated {lastFetch.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</span>}
          <button onClick={fetchCalendar} disabled={loading} style={{background:"transparent",border:"1px solid #1e2d40",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>
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

      {/* ── News Guard ─────────────────────────────────────────────────────── */}
      <div style={{background:guardBlocked?`${C.red}0f`:`${C.green}0f`,border:`2px solid ${guardBlocked?`${C.red}55`:`${C.green}44`}`,borderRadius:14,padding:"18px 22px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <div style={{fontSize:38}}>{guardBlocked ? "🚨" : "✅"}</div>
        <div style={{flex:1,minWidth:180}}>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:guardBlocked?C.red:C.green,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3}}>
            News Guard — {guardBlocked ? "HIGH IMPACT EVENT INCOMING" : "CLEAR TO TRADE"}
          </div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:guardBlocked?C.red:C.green}}>
            {guardBlocked
              ? `${nextEv?.event || nextEv?.name || "High impact event"} — ${nextEv?.time || "today"}`
              : "No high-impact news in the next 2 hours"}
          </div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,marginTop:4}}>
            {guardBlocked
              ? "Most prop firms prohibit trading 2 min before and after high-impact releases. Stay flat."
              : "You're in a safe window. Check back before every session."}
          </div>
        </div>
        {guardBlocked && upcomingHigh.length > 1 && (
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.amber,background:`${C.amber}11`,border:"1px solid #f59e0b33",borderRadius:8,padding:"8px 14px",textAlign:"center",flexShrink:0}}>
            +{upcomingHigh.length-1} more<br/>high-impact today
          </div>
        )}
      </div>

      {/* ── News Blocker Guard ─────────────────────────────────────────────── */}
      {newsBlocker && saveNewsBlocker && (() => {
        const MINS = [2, 5, 10, 15, 30];
        // Compute blocking windows for today
        const blockingWindows = futureEvents.filter(ev => {
          if (ev.date !== today) return false;
          if (newsBlocker.impact === "high" && ev.impact !== "high") return false;
          if (newsBlocker.impact === "medium_high" && ev.impact === "low") return false;
          return true;
        }).map(ev => {
          const evMin = parseEventMinutes(ev);
          if (evMin === null) return null;
          const start = evMin - newsBlocker.before;
          const end   = evMin + newsBlocker.after;
          const fmt = m => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
          const nowMin = nowTime.getHours()*60 + nowTime.getMinutes();
          const active = nowMin >= start && nowMin <= end;
          return { name: ev.event||ev.name, time: ev.time, start, end, startFmt: fmt(Math.max(0,start)), endFmt: fmt(end), active };
        }).filter(Boolean);

        const isCurrentlyBlocked = newsBlocker.enabled && blockingWindows.some(w => w.active);

        return (
          <div style={{background:C.card,border:`1px solid ${isCurrentlyBlocked?C.red+"66":C.border}`,borderRadius:14,overflow:"hidden"}}>
            {isCurrentlyBlocked && <div style={{height:3,background:C.red}}/>}
            <div style={{padding:"16px 20px",display:"flex",alignItems:"center",gap:16}}>
              <div style={{fontSize:28}}>{isCurrentlyBlocked?"🚫":"🛡️"}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16}}>News Blocking Guard</div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,marginTop:2}}>
                  {newsBlocker.enabled
                    ? "Warns you when logging trades during news windows — requires confirmation to proceed"
                    : "Blocking is disabled — no warnings will be shown"}
                </div>
              </div>
              {/* Toggle */}
              <div onClick={()=>saveNewsBlocker({...newsBlocker,enabled:!newsBlocker.enabled})}
                style={{width:48,height:26,borderRadius:13,background:newsBlocker.enabled?`${C.green}44`:C.surface,border:`1px solid ${newsBlocker.enabled?C.green:C.border}`,cursor:"pointer",position:"relative",transition:"all 0.2s",flexShrink:0}}>
                <div style={{position:"absolute",top:3,left:newsBlocker.enabled?24:3,width:18,height:18,borderRadius:"50%",background:newsBlocker.enabled?C.green:C.muted,transition:"left 0.2s",boxShadow:newsBlocker.enabled?`0 0 8px ${C.green}`:"none"}}/>
              </div>
            </div>

            {newsBlocker.enabled && (
              <div style={{padding:"0 20px 18px",display:"flex",flexDirection:"column",gap:14}}>
                {/* Impact type */}
                <div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Impact Type to Block</div>
                  <div style={{display:"flex",gap:7}}>
                    {[{id:"high",label:"High Impact",color:C.red},{id:"medium_high",label:"Medium & High",color:C.amber}].map(opt=>(
                      <button key={opt.id} onClick={()=>saveNewsBlocker({...newsBlocker,impact:opt.id})}
                        style={{padding:"7px 16px",borderRadius:8,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:newsBlocker.impact===opt.id?700:400,background:newsBlocker.impact===opt.id?`${opt.color}22`:C.surface,border:`1px solid ${newsBlocker.impact===opt.id?opt.color+"66":C.border}`,color:newsBlocker.impact===opt.id?opt.color:C.muted,display:"flex",alignItems:"center",gap:6}}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:opt.color,display:"inline-block",flexShrink:0}}/>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Minutes before / after */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  {[{key:"before",label:"Minutes Before News"},{key:"after",label:"Minutes After News"}].map(({key,label})=>(
                    <div key={key}>
                      <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>{label}</div>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                        {MINS.map(m=>(
                          <button key={m} onClick={()=>saveNewsBlocker({...newsBlocker,[key]:m})}
                            style={{padding:"6px 12px",borderRadius:7,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:newsBlocker[key]===m?700:400,background:newsBlocker[key]===m?C.accentDim:C.surface,border:`1px solid ${newsBlocker[key]===m?C.accent+"66":C.border}`,color:newsBlocker[key]===m?C.accent:C.muted}}>
                            {m} min
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Today's blocking windows */}
                <div style={{background:C.surface,borderRadius:10,padding:"12px 16px"}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Today's Blocking Windows</div>
                  {blockingWindows.length === 0 ? (
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.green,display:"flex",alignItems:"center",gap:7}}>
                      <span>✓</span> No blocking events today
                    </div>
                  ) : (
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {blockingWindows.map((w,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 12px",borderRadius:7,background:w.active?`${C.red}11`:C.card,border:`1px solid ${w.active?C.red+"44":C.border}`}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:w.active?C.red:C.muted,boxShadow:w.active?`0 0 6px ${C.red}`:"none",flexShrink:0,animation:w.active?"pulse 1.5s ease-in-out infinite":"none"}}/>
                          <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:w.active?C.red:C.accent,fontWeight:700}}>{w.startFmt} – {w.endFmt}</span>
                          <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,flex:1}}>{w.name}</span>
                          {w.active && <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.red,background:`${C.red}18`,border:`1px solid ${C.red}33`,borderRadius:4,padding:"2px 7px",flexShrink:0}}>ACTIVE NOW</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {loading && (
        <div style={{display:"flex",alignItems:"center",gap:12,padding:20,color:C.textDim,fontFamily:"'Space Mono',monospace",fontSize:12}}>
          <div style={{width:16,height:16,borderRadius:"50%",border:"2px solid #1e2d40",borderTop:"2px solid #00e5ff",animation:"spin 0.8s linear infinite"}}/>
          Fetching live calendar...
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {error && <div style={{background:`${C.amber}11`,border:"1px solid #f59e0b44",borderRadius:8,padding:"12px 16px",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.amber}}>⚠ {error}</div>}

      {!loading && !error && days.length === 0 && (
        <div style={{background:C.card,border:"1px solid #1e2d40",borderRadius:12,padding:40,textAlign:"center",fontFamily:"'Space Mono',monospace",fontSize:12,color:C.muted}}>
          <div style={{fontSize:32,marginBottom:10}}>📅</div>
          No upcoming events this week
        </div>
      )}

      {/* Events grouped by day — today + future only */}
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {days.map(date => {
          const dayEvents = filtered.filter(e => e.date === date);
          if (!dayEvents.length) return null;
          const d = new Date(date + "T12:00:00");
          const hasHigh = dayEvents.some(e => e.impact === "high");
          const isToday = date === today;
          return (
            <div key={date} style={{background:C.card,border:`1px solid ${isToday?`${C.accent}44`:hasHigh?`${C.red}33`:C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"12px 20px",borderBottom:"1px solid #1e2d40",display:"flex",alignItems:"center",gap:12,background:isToday?`${C.accent}06`:hasHigh?`${C.red}08`:C.surface}}>
                <div style={{width:44,height:44,borderRadius:8,background:isToday?C.accentDim:hasHigh?`${C.red}22`:`${C.accent}11`,border:`1px solid ${isToday?`${C.accent}44`:hasHigh?`${C.red}44`:`${C.accent}33`}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:isToday?C.accent:hasHigh?C.red:C.accent,letterSpacing:"0.05em"}}>{dayNames[d.getDay()]}</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:isToday?C.accent:hasHigh?C.red:C.accent,lineHeight:1}}>{d.getDate()}</div>
                </div>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,display:"flex",alignItems:"center",gap:8}}>
                    {d.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
                    {isToday && <span style={{background:C.accentDim,color:C.accent,border:"1px solid #00e5ff44",borderRadius:4,padding:"1px 8px",fontFamily:"'Space Mono',monospace",fontSize:9}}>TODAY</span>}
                  </div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.textDim,marginTop:2}}>{dayEvents.length} event{dayEvents.length>1?"s":""} · {dayEvents.filter(e=>e.impact==="high").length} high impact</div>
                </div>
                {hasHigh && <span style={{marginLeft:"auto",background:`${C.red}22`,color:C.red,border:"1px solid #ff3d5a44",borderRadius:4,padding:"3px 10px",fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700}}>HIGH IMPACT</span>}
              </div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:"1px solid #1e2d40"}}>
                  {["Time","Currency","Impact","Event","Forecast","Previous","Actual"].map(h => (
                    <th key={h} style={{padding:"8px 18px",textAlign:"left",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.textDim,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:400}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {dayEvents.map((e, i) => (
                    <tr key={i} style={{borderBottom:i<dayEvents.length-1?"1px solid #1e2d40":"none",background:e.impact==="high"?`${C.red}06`:"transparent"}}
                      onMouseEnter={ev=>ev.currentTarget.style.background=C.surface} onMouseLeave={ev=>ev.currentTarget.style.background=e.impact==="high"?`${C.red}06`:"transparent"}>
                      <td style={{padding:"11px 18px",fontFamily:"'Space Mono',monospace",fontSize:12,color:C.accent}}>{e.time||"—"}</td>
                      <td style={{padding:"11px 18px"}}><span style={{background:`${C.accent}11`,color:C.accent,borderRadius:4,padding:"2px 8px",fontFamily:"'Space Mono',monospace",fontSize:10}}>{e.currency||"—"}</span></td>
                      <td style={{padding:"11px 18px"}}>
                        <div style={{display:"flex",gap:2}}>
                          {Array.from({length:3},(_,k) => <div key={k} style={{width:7,height:7,borderRadius:"50%",background:k<impactDots(e.impact)?impactColor(e.impact):C.border}}/>)}
                        </div>
                      </td>
                      <td style={{padding:"11px 18px",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.text,fontWeight:500}}>{e.event||e.name||"—"}</td>
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

// ── My Account Tab ───────────────────────────────────────────────────────────
const MyAccountTab = ({ C, plan, profile, user, userName, loadProfile, supabase, setTab }) => {
  const PLANS = {
    basic:    { label:"Basic",    color:"#6b859e", price:"$30/mo", features:["Trade logging + CSV import","Dashboard & Analytics","Calendar view","Prop firm tracker","Edge Library","Psychology check-in"] },
    advanced: { label:"Advanced", color:C.accent,  price:"$50/mo", features:["Everything in Basic","AI Coach (trade analysis)","Multi-account tracking","Discord daily reports","PDF export"] },
    pro:      { label:"Pro",      color:"#a78bfa",  price:"$90/mo", features:["Everything in Advanced","Trade Copier","NinjaTrader sync (coming)","Unlimited accounts","Priority support"] },
  };
  const currentPlan = PLANS[plan] || PLANS.basic;

  const [profileForm, setProfileForm] = useState({ full_name: profile?.full_name || "" });
  const [emailForm,   setEmailForm  ] = useState({ currentPassword: "", newEmail: "" });
  const [passForm,    setPassForm   ] = useState({ currentPassword: "", password: "", confirm: "" });
  const [saving,      setSaving     ] = useState({});
  const [msg,         setMsg        ] = useState({});
  const [invoices,    setInvoices   ] = useState(null);
  const [showDelete,  setShowDelete ] = useState(false);

  const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token;

  const reauthenticate = async (currentPassword) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: user?.email,
      password: currentPassword,
    });
    if (error) throw new Error("Incorrect current password");
  };

  const saveField = async (key, url, method, body, onSuccess) => {
    setSaving(s=>({...s,[key]:true})); setMsg(m=>({...m,[key]:""}));
    try {
      const res = await fetch(`${API}${url}`, {
        method, headers:{ Authorization:`Bearer ${await getToken()}`, "Content-Type":"application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(m=>({...m,[key]:"✓ "+data.message}));
      if (onSuccess) onSuccess();
      await loadProfile();
    } catch(e) { setMsg(m=>({...m,[key]:"⚠ "+e.message})); }
    setSaving(s=>({...s,[key]:false}));
  };

  const startCheckout = async (targetPlan) => {
    try {
      const res = await fetch(`${API}/stripe/create-checkout`, {
        method:"POST", headers:{Authorization:`Bearer ${await getToken()}`,"Content-Type":"application/json"},
        body: JSON.stringify({ plan: targetPlan }),
      });
      const { url, error } = await res.json();
      if (error) { alert("Stripe not configured yet: "+error); return; }
      if (url) window.location.href = url;
    } catch(e) { alert("Could not start checkout: "+e.message); }
  };

  const openPortal = async () => {
    try {
      const res = await fetch(`${API}/stripe/portal`, {
        method:"POST", headers:{Authorization:`Bearer ${await getToken()}`},
      });
      const { url, error } = await res.json();
      if (error) { alert("Stripe not configured yet: "+error); return; }
      if (url) window.location.href = url;
    } catch(e) { alert("Could not open billing portal: "+e.message); }
  };

  const loadInvoices = async () => {
    try {
      const res = await fetch(`${API}/stripe/invoices`, { headers:{Authorization:`Bearer ${await getToken()}`} });
      setInvoices(await res.json());
    } catch { setInvoices([]); }
  };

  const deleteAccount = async () => {
    try {
      await fetch(`${API}/profile`, { method:"DELETE", headers:{Authorization:`Bearer ${await getToken()}`} });
      await supabase.auth.signOut();
    } catch(e) { alert("Delete failed: "+e.message); }
  };

  const inputS = {width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"};
  const labelS = {fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:6,display:"block"};
  const btnS   = (col) => ({width:"100%",padding:"11px",borderRadius:8,cursor:"pointer",background:`${col}22`,border:`1px solid ${col}55`,color:col,fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,letterSpacing:"0.05em"});

  return <div style={{display:"flex",flexDirection:"column",gap:22,maxWidth:700,margin:"0 auto",width:"100%"}}>
    <div>
      <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Settings</div>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,marginTop:4}}>My Account</div>
    </div>

    {/* ── Current plan ── */}
    <div style={{background:C.card,border:`2px solid ${currentPlan.color}44`,borderRadius:14,padding:22,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:currentPlan.color}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:16}}>
        <div>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Current plan</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:24,color:currentPlan.color}}>{currentPlan.label}</div>
        </div>
        {plan!=="basic" && <button onClick={openPortal} style={{...btnS(C.muted),width:"auto",padding:"8px 16px"}}>Manage billing ↗</button>}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {currentPlan.features.map(f=><span key={f} style={{background:`${currentPlan.color}18`,border:`1px solid ${currentPlan.color}33`,color:currentPlan.color,borderRadius:20,padding:"3px 12px",fontFamily:"'Space Mono',monospace",fontSize:10}}>✓ {f}</span>)}
      </div>
      {plan!=="pro" && (
        <div style={{display:"grid",gridTemplateColumns:plan==="basic"?"1fr 1fr":"1fr",gap:10,marginTop:4}}>
          {plan==="basic" && (
            <div style={{background:C.surface,border:`1px solid ${C.accent}44`,borderRadius:10,padding:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:C.accent}}>Advanced</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:12,color:C.accent,fontWeight:700}}>$50/mo</div>
              </div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim,marginBottom:8,lineHeight:1.5}}>AI Coach · Multi-account · Discord · PDF export</div>
              <button onClick={()=>startCheckout("advanced")} style={btnS(C.accent)}>Upgrade to Advanced →</button>
            </div>
          )}
          <div style={{background:C.surface,border:`1px solid #a78bfa44`,borderRadius:10,padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:"#a78bfa"}}>Pro</div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:12,color:"#a78bfa",fontWeight:700}}>$90/mo</div>
            </div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim,marginBottom:8,lineHeight:1.5}}>Trade Copier · NinjaTrader sync · Unlimited accounts · Priority support</div>
            <button onClick={()=>startCheckout("pro")} style={btnS("#a78bfa")}>Upgrade to Pro →</button>
          </div>
        </div>
      )}
    </div>

    {/* ── Profile ── */}
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:22}}>
      <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:16}}>Profile</div>
      <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:20}}>
        <div style={{width:64,height:64,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent}33,#a78bfa33)`,border:`1px solid ${C.accent}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:700,color:C.accent,flexShrink:0}}>
          {(profile?.full_name||userName||"?").charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18}}>{profile?.full_name||userName}</div>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,marginTop:2}}>{user?.email}</div>
        </div>
      </div>
      <label style={labelS}>Display Name</label>
      <div style={{display:"flex",gap:8,marginBottom:4}}>
        <input value={profileForm.full_name} onChange={e=>setProfileForm(f=>({...f,full_name:e.target.value}))} placeholder="Your name" style={{...inputS,flex:1}}/>
        <button onClick={()=>saveField("name","/profile","PATCH",{full_name:profileForm.full_name})} disabled={saving.name}
          style={{...btnS(C.accent),width:"auto",padding:"10px 18px"}}>{saving.name?"...":"Save"}</button>
      </div>
      {msg.name && <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:msg.name.startsWith("✓")?C.green:C.red}}>{msg.name}</div>}
    </div>

    {/* ── Email ── */}
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:22}}>
      <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4}}>Change Email</div>
      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim,marginBottom:16}}>A confirmation link will be sent to your <strong style={{color:C.text}}>current email ({user?.email})</strong> before any change takes effect.</div>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
        <div>
          <label style={labelS}>Current password <span style={{color:C.red}}>*</span></label>
          <input type="password" value={emailForm.currentPassword} onChange={e=>setEmailForm(f=>({...f,currentPassword:e.target.value}))} placeholder="Confirm your identity" style={inputS}/>
        </div>
        <div>
          <label style={labelS}>New email address <span style={{color:C.red}}>*</span></label>
          <input type="email" value={emailForm.newEmail} onChange={e=>setEmailForm(f=>({...f,newEmail:e.target.value}))} placeholder="new@email.com" style={inputS}/>
        </div>
      </div>
      {msg.email && <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:msg.email.startsWith("✓")?C.green:C.red,marginBottom:8}}>{msg.email}</div>}
      <button onClick={async ()=>{
        if (!emailForm.currentPassword) { setMsg(m=>({...m,email:"⚠ Current password is required"})); return; }
        if (!emailForm.newEmail) { setMsg(m=>({...m,email:"⚠ New email is required"})); return; }
        setSaving(s=>({...s,email:true})); setMsg(m=>({...m,email:""}));
        try {
          await reauthenticate(emailForm.currentPassword);
          await saveField("email","/profile/change-email","POST",{email:emailForm.newEmail},()=>setEmailForm({currentPassword:"",newEmail:""}));
        } catch(e) { setMsg(m=>({...m,email:"⚠ "+e.message})); setSaving(s=>({...s,email:false})); }
      }} disabled={saving.email||!emailForm.currentPassword||!emailForm.newEmail}
        style={{...btnS(C.accent),opacity:(!emailForm.currentPassword||!emailForm.newEmail)?0.5:1}}>
        {saving.email?"Verifying...":"Send confirmation email"}
      </button>
    </div>

    {/* ── Password ── */}
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:22}}>
      <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4}}>Change Password</div>
      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim,marginBottom:16}}>You must confirm your current password before setting a new one.</div>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
        <div>
          <label style={labelS}>Current password <span style={{color:C.red}}>*</span></label>
          <input type="password" value={passForm.currentPassword} onChange={e=>setPassForm(f=>({...f,currentPassword:e.target.value}))} placeholder="Your current password" style={inputS}/>
        </div>
        <div>
          <label style={labelS}>New password <span style={{color:C.red}}>*</span></label>
          <input type="password" value={passForm.password} onChange={e=>setPassForm(f=>({...f,password:e.target.value}))} placeholder="Min. 8 characters" style={inputS}/>
        </div>
        <div>
          <label style={labelS}>Confirm new password <span style={{color:C.red}}>*</span></label>
          <input type="password" value={passForm.confirm} onChange={e=>setPassForm(f=>({...f,confirm:e.target.value}))} placeholder="Repeat new password" style={inputS}/>
        </div>
      </div>
      {msg.password && <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:msg.password.startsWith("✓")?C.green:C.red,marginBottom:8}}>{msg.password}</div>}
      <button onClick={async ()=>{
        if (!passForm.currentPassword) { setMsg(m=>({...m,password:"⚠ Current password is required"})); return; }
        if (passForm.password.length < 8) { setMsg(m=>({...m,password:"⚠ New password must be at least 8 characters"})); return; }
        if (passForm.password !== passForm.confirm) { setMsg(m=>({...m,password:"⚠ New passwords don't match"})); return; }
        setSaving(s=>({...s,password:true})); setMsg(m=>({...m,password:""}));
        try {
          await reauthenticate(passForm.currentPassword);
          await saveField("password","/profile/change-password","POST",{password:passForm.password},()=>setPassForm({currentPassword:"",password:"",confirm:""}));
        } catch(e) { setMsg(m=>({...m,password:"⚠ "+e.message})); setSaving(s=>({...s,password:false})); }
      }} disabled={saving.password||!passForm.currentPassword||passForm.password.length<8}
        style={{...btnS(C.accent),opacity:(!passForm.currentPassword||passForm.password.length<8)?0.5:1}}>
        {saving.password?"Verifying...":"Update Password"}
      </button>
    </div>

    {/* ── Invoice history ── */}
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:22}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Invoice History</div>
        {!invoices && <button onClick={loadInvoices} style={{...btnS(C.muted),width:"auto",padding:"6px 14px",fontSize:10}}>Load invoices</button>}
      </div>
      {!invoices && <div style={{color:C.muted,fontFamily:"'DM Sans',sans-serif",fontSize:13}}>Click "Load invoices" to view your billing history.</div>}
      {invoices?.length===0 && <div style={{color:C.muted,fontFamily:"'DM Sans',sans-serif",fontSize:13}}>No invoices yet.</div>}
      {invoices?.length>0 && (
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{["Date","Amount","Status",""].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.07em",textTransform:"uppercase",fontWeight:400}}>{h}</th>)}</tr></thead>
          <tbody>{invoices.map(inv=>(
            <tr key={inv.id} style={{borderBottom:`1px solid ${C.border}`}}>
              <td style={{padding:"10px 12px",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.textDim}}>{inv.date}</td>
              <td style={{padding:"10px 12px",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14}}>{inv.currency} {inv.amount.toFixed(2)}</td>
              <td style={{padding:"10px 12px"}}><span style={{background:inv.status==="paid"?`${C.green}18`:`${C.amber}18`,color:inv.status==="paid"?C.green:C.amber,borderRadius:4,padding:"2px 8px",fontFamily:"'Space Mono',monospace",fontSize:10}}>{inv.status}</span></td>
              <td style={{padding:"10px 12px"}}>{inv.pdf&&<a href={inv.pdf} target="_blank" rel="noreferrer" style={{color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:10}}>PDF ↗</a>}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>

    {/* ── Discord integration ── */}
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:22}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Discord Integration</div>
      </div>
      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim,marginBottom:16}}>
        Post your daily trade report automatically to a Discord channel. Paste your server's webhook URL below.
        <a href="https://support.discord.com/hc/en-us/articles/228383668" target="_blank" rel="noreferrer" style={{color:C.accent,marginLeft:6,fontFamily:"'Space Mono',monospace",fontSize:10}}>How to create a webhook ↗</a>
      </div>
      {profile?.discord_webhook ? (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{background:C.surface,border:`1px solid #5865F233`,borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#00d084",flexShrink:0}}/>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.text}}>Connected</span>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,marginLeft:4}}>{profile.discord_webhook.slice(0,50)}...</span>
          </div>
          <button onClick={async()=>{
            setSaving(s=>({...s,discord:true}));
            try {
              await fetch(`${API}/discord/disconnect`,{method:"DELETE",headers:{Authorization:`Bearer ${await getToken()}`}});
              setMsg(m=>({...m,discord:"✓ Discord disconnected"}));
              await loadProfile();
            } catch(e){setMsg(m=>({...m,discord:"⚠ "+e.message}));}
            setSaving(s=>({...s,discord:false}));
          }} disabled={saving.discord} style={{...btnS(C.red),maxWidth:200,fontSize:10}}>
            {saving.discord?"...":"Disconnect"}
          </button>
          {msg.discord && <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:msg.discord.startsWith("✓")?C.green:C.red}}>{msg.discord}</div>}
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div>
            <label style={labelS}>Webhook URL</label>
            <div style={{display:"flex",gap:8}}>
              <input
                id="discord-webhook-input"
                type="text"
                placeholder="https://discord.com/api/webhooks/..."
                style={{...inputS,flex:1,fontSize:12}}
              />
              <button onClick={async()=>{
                const url = document.getElementById("discord-webhook-input").value.trim();
                if(!url){setMsg(m=>({...m,discord:"⚠ Paste your webhook URL first"}));return;}
                setSaving(s=>({...s,discord:true})); setMsg(m=>({...m,discord:""}));
                try {
                  const res = await fetch(`${API}/discord/test`,{method:"POST",headers:{Authorization:`Bearer ${await getToken()}`,"Content-Type":"application/json"},body:JSON.stringify({webhookUrl:url})});
                  const data = await res.json();
                  if(!res.ok) throw new Error(data.error);
                  setMsg(m=>({...m,discord:"✓ "+data.message}));
                  await loadProfile();
                } catch(e){setMsg(m=>({...m,discord:"⚠ "+e.message}));}
                setSaving(s=>({...s,discord:false}));
              }} disabled={saving.discord} style={{...btnS("#5865F2"),width:"auto",padding:"10px 16px"}}>
                {saving.discord?"Testing...":"Connect"}
              </button>
            </div>
          </div>
          {msg.discord && <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:msg.discord.startsWith("✓")?C.green:C.red}}>{msg.discord}</div>}
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>A test message will be sent to verify the connection.</div>
        </div>
      )}
    </div>

    {/* ── Danger Zone ── */}
    <div style={{background:C.card,border:`1px solid ${C.red}33`,borderRadius:12,padding:22}}>
      <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.red,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>Danger Zone</div>
      {!showDelete ? (
        <button onClick={()=>setShowDelete(true)} style={{...btnS(C.red),maxWidth:240}}>Delete Account</button>
      ) : (
        <div style={{background:`${C.red}11`,border:`1px solid ${C.red}44`,borderRadius:10,padding:16}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:C.red,marginBottom:8}}>Are you absolutely sure?</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,marginBottom:16}}>This will permanently delete your account and all trade data. This cannot be undone.</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setShowDelete(false)} style={{...btnS(C.muted),flex:1}}>Cancel</button>
            <button onClick={deleteAccount} style={{...btnS(C.red),flex:1}}>Yes, delete everything</button>
          </div>
        </div>
      )}
    </div>
  </div>;
};

// ── Upgrade Gate ─────────────────────────────────────────────────────────────
const UpgradeGate = ({ plan, feature, desc, C, onUpgrade }) => {
  const planColor = plan === "pro" ? "#a78bfa" : "#00e5ff";
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:420,gap:24,textAlign:"center",padding:40}}>
      <div style={{fontSize:52}}>🔒</div>
      <div>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:26,marginBottom:8}}>{feature}</div>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:15,color:C.textDim,maxWidth:420}}>{desc}</div>
      </div>
      <div style={{background:C.card,border:`1px solid ${planColor}44`,borderRadius:14,padding:"20px 32px",display:"inline-flex",flexDirection:"column",alignItems:"center",gap:10}}>
        <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Required plan</span>
        <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:planColor,textTransform:"capitalize"}}>{plan}</span>
      </div>
      <button onClick={onUpgrade}
        style={{background:`linear-gradient(135deg,${planColor}33,${planColor}11)`,border:`1px solid ${planColor}55`,color:planColor,borderRadius:10,padding:"12px 28px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,letterSpacing:"0.08em"}}>
        View Upgrade Options →
      </button>
    </div>
  );
};

const StatCard = ({label,value,sub,color}) => (
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"20px 24px",flex:1,minWidth:130,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:color||C.accent,borderRadius:"12px 12px 0 0"}}/>
    <div style={{color:C.textDim,fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>{label}</div>
    <div style={{color:color||C.text,fontSize:26,fontWeight:700,fontFamily:"'Syne',sans-serif",lineHeight:1}}>{value}</div>
    {sub&&<div style={{color:C.muted,fontSize:11,marginTop:6,fontFamily:"'Space Mono',monospace"}}>{sub}</div>}
  </div>
);

const tagColor = t => ({
  "Kill Zone":C.green,"Displacement":C.accent,"FVG":C.purple,"OB":"#f59e0b",
  "BOS":"#34d399","FOMO":C.red,"Revenge":C.red,"Late entry":C.amber,"Oversize":C.red,
  "Liquidity Sweep":"#f472b6","CHoCH":"#60a5fa"
}[t]||C.muted);

const TagBadge = ({label,onRemove}) => (
  <span style={{display:"inline-flex",alignItems:"center",gap:4,background:`${tagColor(label)}22`,border:`1px solid ${tagColor(label)}66`,color:tagColor(label),borderRadius:20,padding:"2px 10px",fontSize:11,fontFamily:"'Space Mono',monospace",whiteSpace:"nowrap"}}>
    {label}{onRemove&&<span onClick={onRemove} style={{cursor:"pointer",opacity:.7,fontSize:10}}>✕</span>}
  </span>
);

const PnlTip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  const v=payload[0].value;
  return <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px"}}><div style={{color:C.textDim,fontSize:11,fontFamily:"'Space Mono',monospace"}}>{label}</div><div style={{color:v>=0?C.green:C.red,fontSize:16,fontWeight:700}}>{v>=0?"+":""}${v?.toLocaleString()}</div></div>;
};

// ── Trade Modal ───────────────────────────────────────────────────────────────
const TradeModal = ({trade,onClose,onSave,globalRules}) => {
  const [screenshot,setScreenshot] = useState(trade.screenshot||null);
  const [review,    setReview    ] = useState(trade.review||"");
  const [checks,    setChecks    ] = useState(trade.checks||globalRules.reduce((a,r)=>({...a,[r]:false}),{}));
  const [rating,    setRating    ] = useState(trade.rating||0);
  const [hover,     setHover     ] = useState(0);
  const [tags,      setTags      ] = useState(trade.tags||[]);
  const [tagInput,  setTagInput  ] = useState("");
  const [drag,      setDrag      ] = useState(false);
  const [saving,    setSaving    ] = useState(false);
  const [saveError, setSaveError ] = useState(null);
  const [chartTab,  setChartTab  ] = useState("replay"); // "replay" | "screenshot"
  const fileRef = useRef();
  const tvRef   = useRef();

  const ratingLabels=["","Terrible — broke all rules","Poor — mostly off-plan","Okay — some mistakes","Good — mostly on-plan","Perfect — textbook execution"];
  const handleFile=f=>{
    if(!f||!f.type.startsWith("image/"))return;
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const canvas=document.createElement("canvas");
        const MAX=800;
        const ratio=Math.min(MAX/img.width,MAX/img.height,1);
        canvas.width=Math.round(img.width*ratio);
        canvas.height=Math.round(img.height*ratio);
        canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
        setScreenshot(canvas.toDataURL("image/jpeg",0.6));
      };
      img.src=e.target.result;
    };
    reader.readAsDataURL(f);
  };
  const addTag=t=>{if(t&&!tags.includes(t))setTags([...tags,t]);setTagInput("");};
  const score=Object.values(checks).filter(Boolean).length;
  const total=globalRules.length;

  // Map FundVault symbols → TradingView free CFD proxies (CME futures require paid plan)
  const tvSymbol = (() => {
    const s = (trade.symbol||"NQ").toUpperCase();
    const map = {
      "NQ":"CAPITALCOM:US100",   // Nasdaq 100 — near-identical to NQ
      "MNQ":"CAPITALCOM:US100",
      "ES":"CAPITALCOM:US500",   // S&P 500 — near-identical to ES
      "MES":"CAPITALCOM:US500",
      "YM":"CAPITALCOM:US30",    // Dow Jones — near-identical to YM
      "MYM":"CAPITALCOM:US30",
      "RTY":"CAPITALCOM:US2000", // Russell 2000 — near-identical to RTY
      "M2K":"CAPITALCOM:US2000",
      "CL":"CAPITALCOM:OIL",     // Crude Oil
      "GC":"CAPITALCOM:GOLD",    // Gold
      "SI":"CAPITALCOM:SILVER",  // Silver
      "6E":"FX:EURUSD",          // Euro/USD
    };
    return map[s] || "CAPITALCOM:US100";
  })();

  // Build TradingView widget URL with trade date pre-set
  const tvDate   = trade.trade_date || (() => { const _n=new Date(); return `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}-${String(_n.getDate()).padStart(2,'0')}`; })();
  const isDark   = document.documentElement.style.background !== "rgb(240, 244, 248)";
  const tvTheme  = isDark ? "dark" : "light";

  // Detect dark mode from C colors
  const darkMode = C.bg === "#080c14";

  // Replay chart state
  const [chartBars,  setChartBars ] = useState(null); // null=loading, []=error, [...]= bars
  const [chartError, setChartError] = useState(null);
  const chartContainerRef = useRef();
  const lwChartRef        = useRef();

  // Yahoo Finance symbol map: FundVault symbol → Yahoo ticker
  const yahooSymbol = (() => {
    const s = (trade.symbol || "NQ").toUpperCase();
    const map = {
      "NQ":"NQ=F", "MNQ":"MNQ=F",
      "ES":"ES=F", "MES":"MES=F",
      "YM":"YM=F", "MYM":"MYM=F",
      "RTY":"RTY=F","M2K":"M2K=F",
      "CL":"CL=F", "GC":"GC=F",
      "SI":"SI=F", "ZB":"ZB=F",
    };
    return map[s] || (s + "=F");
  })();

  // Fetch historical 1-min bars via backend (Yahoo Finance, no CORS issues)
  useEffect(() => {
    if (chartTab !== "replay") return;
    if (!trade.trade_date) return;

    const load = async () => {
      setChartBars(null);
      setChartError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
        // Pass asset_type so backend knows whether to add =F suffix
        const r = await fetch(
          `${API}/tradovate/chart?symbol=${encodeURIComponent(trade.symbol || "NQ")}&date=${trade.trade_date}&asset_type=${encodeURIComponent(trade.asset_type || "Futures")}`,
          { headers: { Authorization: `Bearer ${session?.access_token}` } }
        );
        const data = await r.json();
        if (!data.bars?.length) {
          console.log("[Chart] no bars returned:", data.error || "empty");
          setChartBars([]);
          return;
        }
        console.log(`[Chart] got ${data.bars.length} bars for ${data.ticker}`);
        setChartBars(data.bars);
      } catch(e) {
        console.error("[Chart] fetch error:", e.message);
        setChartBars([]);
        setChartError(e.message);
      }
    };
    load();
  }, [chartTab, trade.trade_date, trade.symbol]);

  // Render Lightweight Chart when bars arrive
  useEffect(() => {
    if (!chartContainerRef.current || !Array.isArray(chartBars) || !chartBars.length) return;
    chartContainerRef.current.innerHTML = "";

    const renderChart = async () => {
      let createChart;
      try {
        const mod = await import("https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.mjs");
        createChart = mod.createChart;
      } catch {
        createChart = window.LightweightCharts?.createChart;
      }
      if (!createChart) return;

      const chart = createChart(chartContainerRef.current, {
        width:  chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight || 360,
        layout:  { background: { color: darkMode ? "#0d1420" : "#ffffff" }, textColor: darkMode ? "#c8d8e8" : "#333" },
        grid:    { vertLines: { color: darkMode ? "#1e2d4044" : "#eee" }, horzLines: { color: darkMode ? "#1e2d4044" : "#eee" } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: darkMode ? "#1e2d40" : "#ccc" },
        timeScale: { borderColor: darkMode ? "#1e2d40" : "#ccc", timeVisible: true, secondsVisible: false },
      });

      const candles = chart.addCandlestickSeries({
        upColor: "#00d084", downColor: "#ff3d5a",
        borderUpColor: "#00d084", borderDownColor: "#ff3d5a",
        wickUpColor: "#00d084", wickDownColor: "#ff3d5a",
      });

      candles.setData(chartBars);

      // Entry price line
      if (trade.entry_price) {
        candles.createPriceLine({
          price: parseFloat(trade.entry_price), color: "#00d084",
          lineWidth: 2, lineStyle: 2, axisLabelVisible: true,
          title: `▲ Entry ${trade.entry_price}`,
        });
      }
      // Exit price line
      if (trade.exit_price) {
        candles.createPriceLine({
          price: parseFloat(trade.exit_price), color: "#ff3d5a",
          lineWidth: 2, lineStyle: 2, axisLabelVisible: true,
          title: `▼ Exit ${trade.exit_price}`,
        });
      }

      // Zoom to trade window
      const entryTs = trade.entry_time
        ? Math.floor(new Date(trade.entry_time).getTime() / 1000)
        : chartBars[Math.floor(chartBars.length * 0.3)].time;
      const exitTs = trade.exit_time
        ? Math.floor(new Date(trade.exit_time).getTime() / 1000)
        : entryTs + 3600;
      chart.timeScale().setVisibleRange({ from: entryTs - 15*60, to: exitTs + 30*60 });

      const ro = new ResizeObserver(() => {
        if (chartContainerRef.current)
          chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      });
      if (chartContainerRef.current) ro.observe(chartContainerRef.current);
      lwChartRef.current = { chart, ro };
    };

    renderChart();
    return () => { lwChartRef.current?.chart?.remove(); lwChartRef.current?.ro?.disconnect(); };
  }, [chartBars, darkMode]);

  const mob = typeof window !== "undefined" && window.innerWidth <= 768;

  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(4px)",display:"flex",alignItems:mob?"flex-end":"center",justifyContent:"center",padding:mob?0:16}} onClick={onClose}>
      <style>{`
        @media(min-width:769px){
          .fv-review-cols{grid-template-columns:1fr 300px 300px!important}
          .fv-review-col2{border-left:1px solid var(--border)!important;border-top:none!important}
          .fv-review-col3{border-left:1px solid var(--border)!important;border-top:none!important}
        }
      `}</style>
      <div style={{background:C.card,border:mob?`1px solid ${C.border}`:`1px solid ${C.border}`,borderRadius:mob?"20px 20px 0 0":16,width:"100%",maxWidth:mob?"100%":1200,maxHeight:"94vh",overflowY:"auto",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,position:"sticky",top:0,background:C.card,zIndex:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:mob?18:22}}>{trade.symbol}</span>
            <span style={{background:trade.side==="Long"?`${C.green}18`:`${C.red}18`,color:trade.side==="Long"?C.green:C.red,borderRadius:4,padding:"3px 8px",fontFamily:"'Space Mono',monospace",fontSize:10}}>{trade.side}</span>
            <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:mob?16:18,color:trade.pnl>=0?C.green:C.red}}>{trade.pnl>=0?"+":""}${trade.pnl}</span>
            {!mob&&<span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted}}>{trade.entry} → {trade.exit} · {trade.holdMin}m · {tvDate}</span>}
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:22}}>✕</button>
        </div>

        {/* Body — 3 cols desktop, 1 col mobile */}
        <div className="fv-review-cols" style={{display:"grid",gridTemplateColumns:"1fr",flex:1,minHeight:0}}>

          {/* ── Col 1: Chart ──────────────────────────────────────────────────── */}
          <div style={{padding:"14px 16px",borderBottom:mob?`1px solid ${C.border}`:"none",display:"flex",flexDirection:"column",gap:10}}>

            {/* Tab toggle */}
            <div style={{display:"flex",background:C.surface,borderRadius:8,border:`1px solid ${C.border}`,padding:2,gap:2,alignSelf:"flex-start"}}>
              {[{id:"replay",label:"📈 Chart"},{id:"screenshot",label:"📷 Screenshot"}].map(({id,label})=>(
                <button key={id} onClick={()=>setChartTab(id)}
                  style={{padding:"5px 12px",borderRadius:6,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:chartTab===id?700:400,background:chartTab===id?C.accentDim:"transparent",border:`1px solid ${chartTab===id?C.accent+"44":"transparent"}`,color:chartTab===id?C.accent:C.muted,transition:"all 0.15s"}}>
                  {label}
                </button>
              ))}
            </div>

            {/* Replay/TradingView chart */}
            {chartTab==="replay" && (
              <div style={{borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}`,position:"relative",background:C.surface,height:mob?220:380}}>

                {/* Loading state */}
                {chartBars === null && (
                  <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,zIndex:5}}>
                    <div style={{width:28,height:28,border:`3px solid ${C.accent}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
                    <span style={{color:C.muted,fontSize:11,fontFamily:"'Space Mono',monospace"}}>Loading chart...</span>
                  </div>
                )}

                {/* Lightweight Chart with Yahoo Finance data */}
                {chartBars?.length > 0 && (
                  <div ref={chartContainerRef} style={{width:"100%",height:"100%"}}/>
                )}

                {/* No data fallback */}
                {Array.isArray(chartBars) && chartBars.length === 0 && (
                  <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}>
                    <span style={{fontSize:28}}>📉</span>
                    <span style={{color:C.muted,fontSize:12,fontFamily:"'Space Mono',monospace"}}>Chart data unavailable for this date</span>
                    {chartError && <span style={{color:C.red,fontSize:10}}>{chartError}</span>}
                  </div>
                )}

                {/* Entry/Exit time labels */}
                <div style={{position:"absolute",top:8,left:8,display:"flex",gap:6,pointerEvents:"none",zIndex:10}}>
                  {trade.entry && <span style={{background:`${C.green}ee`,color:"#000",borderRadius:4,padding:"2px 8px",fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700}}>▲ {trade.entry}</span>}
                  {trade.exit  && <span style={{background:`${C.red}ee`,color:"#fff",borderRadius:4,padding:"2px 8px",fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700}}>▼ {trade.exit}</span>}
                  {chartBars?.length > 0 && <span style={{background:`${C.accent}22`,color:C.accent,borderRadius:4,padding:"2px 8px",fontFamily:"'Space Mono',monospace",fontSize:9,border:`1px solid ${C.accent}44`}}>📊 Historical Chart</span>}
                </div>
              </div>
            )}

            {/* Screenshot */}
            {chartTab==="screenshot" && (
              <div style={{borderRadius:10,overflow:"hidden",height:mob?220:380}}>
                <div style={{border:`2px dashed ${drag?C.accent:C.border}`,borderRadius:10,height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",background:drag?C.accentDim:C.surface,position:"relative"}}
                  onClick={()=>fileRef.current.click()} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}>
                  {screenshot
                    ? <><img src={screenshot} alt="trade" style={{width:"100%",height:"100%",objectFit:"cover"}}/><button onClick={e=>{e.stopPropagation();setScreenshot(null);}} style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,.6)",border:"none",color:"#fff",borderRadius:4,padding:"2px 8px",cursor:"pointer",fontSize:11}}>Remove</button></>
                    : <><div style={{fontSize:28,marginBottom:6}}>📷</div><div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,textAlign:"center"}}>Tap to upload</div></>
                  }
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
              </div>
            )}

            {/* Trade stats row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
              {[["Entry",trade.entry||"—"],["Exit",trade.exit||"—"],["R:R",`${trade.rr}R`],["Hold",`${trade.holdMin}m`]].map(([l,v])=>(
                <div key={l} style={{background:C.surface,borderRadius:7,padding:"7px 10px",border:`1px solid ${C.border}`}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,textTransform:"uppercase"}}>{l}</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,marginTop:2}}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Col 2: Tags + Rating + Checklist ────────────────────────────── */}
          <div className="fv-review-col2" style={{padding:"14px 16px",borderTop:`1px solid ${C.border}`,display:"flex",flexDirection:"column",gap:12}}>

            {/* Tags */}
            <div>
              <div style={{fontSize:10,fontFamily:"'Space Mono',monospace",color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:7}}>Setup Tags</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>{tags.map(t=><TagBadge key={t} label={t} onRemove={()=>setTags(tags.filter(x=>x!==t))}/>)}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>{ALL_TAGS.filter(s=>!tags.includes(s)).slice(0,mob?4:8).map(s=><span key={s} onClick={()=>addTag(s)} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.muted,borderRadius:20,padding:"2px 9px",fontSize:10,fontFamily:"'Space Mono',monospace",cursor:"pointer"}}>+ {s}</span>)}</div>
              <div style={{display:"flex",gap:5}}><input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTag(tagInput)} placeholder="Custom tag..." style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"6px 10px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:12,outline:"none"}}/><button onClick={()=>addTag(tagInput)} style={{background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:7,padding:"6px 10px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10}}>Add</button></div>
            </div>

            {/* Rating */}
            <div>
              <div style={{fontSize:10,fontFamily:"'Space Mono',monospace",color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:7}}>Rating</div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {[1,2,3,4,5].map(s=><div key={s} onClick={()=>setRating(s)} onMouseEnter={()=>setHover(s)} onMouseLeave={()=>setHover(0)} style={{fontSize:mob?28:22,cursor:"pointer",transition:"transform 0.1s",transform:(hover||rating)>=s?"scale(1.2)":"scale(1)",filter:(hover||rating)>=s?"none":"grayscale(1) opacity(.25)"}}>⭐</div>)}
              </div>
              {(hover||rating)>0&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:C.textDim,marginTop:4}}>{ratingLabels[hover||rating]}</div>}
            </div>

            {/* Rule checklist */}
            <div style={{flex:mob?undefined:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                <div style={{fontSize:10,fontFamily:"'Space Mono',monospace",color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Rules</div>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,color:score===total?C.green:score>=total*.6?C.accent:C.red}}>{score}/{total}</span>
              </div>
              <div style={{height:3,background:C.border,borderRadius:4,marginBottom:8,overflow:"hidden"}}><div style={{height:"100%",borderRadius:4,width:`${total?((score/total)*100):0}%`,background:score===total?C.green:score>=total*.6?C.accent:C.red,transition:"width 0.3s"}}/></div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {globalRules.map((rule,i)=>(
                  <label key={i} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"7px 9px",borderRadius:7,background:checks[rule]?`${C.green}0a`:C.surface,border:`1px solid ${checks[rule]?C.green+"33":C.border}`,transition:"all 0.12s"}}>
                    <div onClick={()=>setChecks(c=>({...c,[rule]:!c[rule]}))} style={{width:17,height:17,borderRadius:4,flexShrink:0,border:`1.5px solid ${checks[rule]?C.green:C.border}`,background:checks[rule]?`${C.green}22`:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                      {checks[rule]&&<span style={{color:C.green,fontSize:10}}>✓</span>}
                    </div>
                    <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:checks[rule]?C.text:C.textDim}}>{rule}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ── Col 3: Review + Save ─────────────────────────────────────────── */}
          <div className="fv-review-col3" style={{padding:"14px 16px",borderTop:`1px solid ${C.border}`,display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:10,fontFamily:"'Space Mono',monospace",color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Trade Review</div>
            <textarea value={review} onChange={e=>setReview(e.target.value)}
              placeholder={"What went well?\nWhat could you improve?\nWere rules followed?"}
              style={{flex:1,minHeight:mob?100:220,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:12,resize:"none",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,lineHeight:1.7,outline:"none"}}/>
            <button
              onClick={async () => {
                if (saving) return;
                setSaving(true);
                setSaveError(null);
                try {
                  await onSave({...trade,screenshot,review,checks,rating,tags});
                } catch(err) {
                  setSaveError("Save failed — please try again");
                  setSaving(false);
                }
              }}
              disabled={saving}
              style={{width:"100%",padding:"13px",background:saving?`${C.accent}11`:`linear-gradient(135deg,${C.accent}22,${C.accent}11)`,border:`1px solid ${C.accent}${saving?"33":"66"}`,color:saving?C.muted:C.accent,borderRadius:8,cursor:saving?"not-allowed":"pointer",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:700,transition:"all 0.15s"}}>
              {saving ? "Saving..." : "Save Review"}
            </button>
            {saveError && <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.red,textAlign:"center"}}>{saveError}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Rule Manager ──────────────────────────────────────────────────────────────
const RuleManager = ({rules,onChange,onClose}) => {
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
const AIFeedback = ({trades, supabase}) => {
  const [loading,setLoading]=useState(false);
  const [feedback,setFeedback]=useState(null);
  const [error,setError]=useState(null);

  const generate = async () => {
    setLoading(true);setFeedback(null);setError(null);
    try {
      const tagStats={};
      trades.forEach(t=>(t.tags||[]).forEach(tag=>{
        if(!tagStats[tag])tagStats[tag]={wins:0,losses:0,totalPnl:0};
        tagStats[tag].totalPnl+=t.pnl;
        t.pnl>0?tagStats[tag].wins++:tagStats[tag].losses++;
      }));
      const prompt=`You are an elite prop firm trading coach for NQ/ES futures scalpers. Analyse this data and give brutally honest, specific, actionable feedback. Be direct. No generic advice.

STATS:
- Total trades: ${trades.length}
- Win rate: ${Math.round((trades.filter(t=>t.pnl>0).length/trades.length)*100)}%
- Total P&L: $${trades.reduce((a,b)=>a+b.pnl,0)}
- Avg self-rating: ${(trades.reduce((a,b)=>a+(b.rating||0),0)/trades.length).toFixed(1)}/5
- Lucky trades (low rating, winner): ${trades.filter(t=>t.rating<=2&&t.pnl>0).length}
- Good process, bad outcome: ${trades.filter(t=>t.rating>=4&&t.pnl<0).length}

BY SETUP TAG:
${Object.entries(tagStats).map(([tag,s])=>`- ${tag}: ${s.wins}W/${s.losses}L, P&L $${s.totalPnl}`).join("\n")}

Respond ONLY with this JSON (no markdown, no preamble):
{"headline":"one punchy sentence","strengths":["s1","s2"],"weaknesses":["w1","w2"],"patterns":["p1 with numbers","p2 with numbers"],"propFirmWarnings":["pf1"],"weekFocus":"one very specific thing to focus on with a concrete metric","verdict":8}`;

      const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API}/ai/coach`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const text = data.text || "";
      setFeedback(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch(e){setError("Analysis failed — " + e.message);}
    setLoading(false);
  };

  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
      <div style={{padding:"18px 22px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.purple,letterSpacing:"0.1em",textTransform:"uppercase"}}>AI Coach</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,marginTop:2}}>Weekly Performance Analysis</div>
        </div>
        <button onClick={generate} disabled={loading} style={{background:loading?"transparent":`linear-gradient(135deg,${C.purple}33,${C.purple}11)`,border:`1px solid ${C.purple}66`,color:C.purple,borderRadius:8,padding:"10px 20px",cursor:loading?"not-allowed":"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:700,opacity:loading?.6:1}}>
          {loading?"Analysing...":"✦ Generate Analysis"}
        </button>
      </div>
      {!feedback&&!loading&&<div style={{padding:40,textAlign:"center",color:C.muted,fontFamily:"'DM Sans',sans-serif",fontSize:14}}><div style={{fontSize:36,marginBottom:12}}>🧠</div>Click "Generate Analysis" to get AI-powered feedback on your trading patterns, best setups, worst habits, and prop firm risks.</div>}
      {loading&&<div style={{padding:40,textAlign:"center"}}><div style={{width:40,height:40,border:`3px solid ${C.border}`,borderTop:`3px solid ${C.purple}`,borderRadius:"50%",margin:"0 auto 16px",animation:"spin 1s linear infinite"}}/><div style={{fontFamily:"'Space Mono',monospace",fontSize:12,color:C.muted}}>Analysing your trades...</div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}
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
            <div style={{background:"#f59e0b11",borderRadius:10,padding:16,border:`1px solid ${C.amber}44`,marginBottom:16}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.amber,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>⚠ Prop Firm Risks</div>
              {feedback.propFirmWarnings.map((s,i)=><div key={i} style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.text,marginBottom:6,display:"flex",gap:8}}><span style={{color:C.amber,flexShrink:0}}>!</span>{s}</div>)}
            </div>
          )}
          <div style={{background:`linear-gradient(135deg,${C.purple}22,${C.purple}08)`,borderRadius:10,padding:16,border:`1px solid ${C.purple}44`}}>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.purple,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>🎯 Focus This Week</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:C.text}}>{feedback.weekFocus}</div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Prop Firm Wizard Modal ────────────────────────────────────────────────────
const PropFirmWizardModal = ({
  C, wizardStep, setWizardStep,
  wizardFirmId, setWizardFirmId,
  wizardTypeId, setWizardTypeId,
  wizardBalance, setWizardBalance,
  wizardNickname, setWizardNickname,
  editingPropAcc, addPropAccount,
  onClose,
}) => {
  const wizFirm = DEFAULT_PROP_FIRMS.find(f=>f.id===wizardFirmId);
  const wizType = wizFirm?.accountTypes.find(t=>t.id===wizardTypeId);
  const inputS  = {width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"11px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(4px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,width:"100%",maxWidth:560,overflow:"hidden"}}>
        {/* Header */}
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>
              Step {wizardStep} of 3 — {wizardStep===1?"Choose Firm":wizardStep===2?"Account Type":"Start Balance"}
            </div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,marginTop:2}}>
              {editingPropAcc ? "Edit Account" : "Add Prop Account"}
            </div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:22}}>✕</button>
        </div>

        {/* Step indicator */}
        <div style={{display:"flex",padding:"12px 24px 0",gap:6}}>
          {[1,2,3].map(s=>(
            <div key={s} style={{flex:1,height:3,borderRadius:2,background:s<=wizardStep?C.accent:C.border,transition:"background 0.2s"}}/>
          ))}
        </div>

        <div style={{padding:24}}>
          {/* Step 1 — Choose firm */}
          {wizardStep===1 && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,marginBottom:4}}>Which prop firm are you trading with?</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {DEFAULT_PROP_FIRMS.map(f=>(
                  <button key={f.id} onClick={()=>setWizardFirmId(f.id)}
                    style={{padding:"14px 16px",borderRadius:10,cursor:"pointer",textAlign:"left",background:wizardFirmId===f.id?`${f.color}18`:C.surface,border:`2px solid ${wizardFirmId===f.id?f.color:C.border}`,transition:"all 0.15s",position:"relative",overflow:"hidden"}}>
                    {wizardFirmId===f.id&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:f.color}}/>}
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:wizardFirmId===f.id?f.color:C.text}}>{f.name}</div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginTop:3}}>{f.accountTypes.length} account type{f.accountTypes.length>1?"s":""}</div>
                  </button>
                ))}
              </div>
              <button onClick={()=>wizardFirmId&&setWizardStep(2)} disabled={!wizardFirmId}
                style={{width:"100%",padding:"12px",borderRadius:10,cursor:wizardFirmId?"pointer":"not-allowed",background:wizardFirmId?C.accentDim:C.surface,border:`1px solid ${wizardFirmId?C.accent+"55":C.border}`,color:wizardFirmId?C.accent:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",opacity:wizardFirmId?1:0.5}}>
                Next →
              </button>
            </div>
          )}

          {/* Step 2 — Account type */}
          {wizardStep===2 && wizFirm && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,marginBottom:4}}>Which account type are you on at <strong style={{color:wizFirm.color}}>{wizFirm.name}</strong>?</div>
              <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:360,overflowY:"auto"}}>
                {wizFirm.accountTypes.map(t=>{
                  const cs = t.rules.find(r=>r.type==="consist");
                  const dd = t.rules.find(r=>r.type==="drawdown");
                  const isActive = wizardTypeId===t.id;
                  return (
                    <button key={t.id} onClick={()=>setWizardTypeId(t.id)}
                      style={{padding:"14px 16px",borderRadius:10,cursor:"pointer",textAlign:"left",background:isActive?`${wizFirm.color}15`:C.surface,border:`2px solid ${isActive?wizFirm.color:C.border}`,transition:"all 0.15s"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:isActive?wizFirm.color:C.text}}>{t.label}</span>
                        <span style={{background:isActive?`${wizFirm.color}22`:C.surface,color:isActive?wizFirm.color:C.muted,border:`1px solid ${isActive?wizFirm.color+"44":C.border}`,borderRadius:4,padding:"2px 8px",fontFamily:"'Space Mono',monospace",fontSize:9}}>{t.badge}</span>
                      </div>
                      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim,marginBottom:8}}>{t.description}</div>
                      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                        {[["Split",`${t.payoutSplit}%`],["Size",`$${(t.accountSize/1000).toFixed(0)}K`],["DD",dd?`$${dd.value.toLocaleString()}`:"—"],["Consistency",cs&&cs.value<900?`${cs.value}% max`:"None ✓"]].map(([l,v])=>(
                          <div key={l} style={{fontFamily:"'Space Mono',monospace",fontSize:10}}>
                            <span style={{color:C.muted}}>{l}: </span><span style={{color:C.text,fontWeight:700}}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{setWizardStep(1);setWizardTypeId(null);}} style={{flex:1,padding:"12px",borderRadius:10,cursor:"pointer",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>← Back</button>
                <button onClick={()=>wizardTypeId&&setWizardStep(3)} disabled={!wizardTypeId}
                  style={{flex:2,padding:"12px",borderRadius:10,cursor:wizardTypeId?"pointer":"not-allowed",background:wizardTypeId?C.accentDim:C.surface,border:`1px solid ${wizardTypeId?C.accent+"55":C.border}`,color:wizardTypeId?C.accent:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,opacity:wizardTypeId?1:0.5}}>
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Balance + nickname */}
          {wizardStep===3 && wizFirm && wizType && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{background:`${wizFirm.color}10`,border:`1px solid ${wizFirm.color}33`,borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:wizFirm.color}}>{wizFirm.name}</div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,marginTop:2}}>{wizType.label} · {wizType.payoutSplit}% split</div>
                </div>
                <button onClick={()=>setWizardStep(2)} style={{background:"transparent",border:"none",cursor:"pointer",color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:10}}>✏ Change</button>
              </div>
              <div>
                <label style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:6,display:"block"}}>Starting Account Balance</label>
                <input type="number" value={wizardBalance} onChange={e=>setWizardBalance(e.target.value)}
                  placeholder={`Default: $${wizType.accountSize.toLocaleString()}`} style={inputS}/>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.muted,marginTop:5}}>Your balance when you started tracking — usually the funded account size.</div>
              </div>
              <div>
                <label style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:6,display:"block"}}>Nickname (optional)</label>
                <input type="text" value={wizardNickname} onChange={e=>setWizardNickname(e.target.value)}
                  placeholder={`e.g. "My MFFU 50K"`} style={inputS}/>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setWizardStep(2)} style={{flex:1,padding:"12px",borderRadius:10,cursor:"pointer",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>← Back</button>
                <button onClick={addPropAccount}
                  style={{flex:2,padding:"12px",borderRadius:10,cursor:"pointer",background:C.accentDim,border:`1px solid ${C.accent}55`,color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>
                  {editingPropAcc ? "Save Changes" : "✓ Add Account"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Add Trade Modal ───────────────────────────────────────────────────────────
const DEFAULT_INSTRUMENTS = [
  {value:"NQ",  label:"NQ (Nasdaq-100)",   pts:{standard:20,  micro:2}},
  {value:"ES",  label:"ES (S&P 500)",      pts:{standard:50,  micro:5}},
  {value:"YM",  label:"YM (Dow Jones)",    pts:{standard:5,   micro:0.5}},
  {value:"RTY", label:"RTY (Russell 2000)",pts:{standard:50,  micro:5}},
  {value:"CL",  label:"CL (Crude Oil)",    pts:{standard:1000,micro:100}},
  {value:"GC",  label:"GC (Gold)",         pts:{standard:100, micro:10}},
  {value:"SI",  label:"SI (Silver)",       pts:{standard:50,  micro:1000}},
  {value:"6E",  label:"6E (Euro FX)",      pts:{standard:125000,micro:12500}},
];
// Merge with any custom tickers saved by the user
const getInstruments = () => {
  try {
    const custom = JSON.parse(localStorage.getItem("fv_custom_tickers")||"[]");
    return [...DEFAULT_INSTRUMENTS, ...custom];
  } catch { return DEFAULT_INSTRUMENTS; }
};
const INSTRUMENTS = getInstruments();
const ADD_TAGS = ["Kill Zone","Displacement","FVG","OB","BOS","CHoCH","Liquidity Sweep","FOMO","Revenge","Late entry","Oversize","News trade"];

const AddTradeModal = ({onClose, onSave, globalRules, C, newsBlocker, calendarEvents}) => {
  const [form, setForm] = useState({
    symbol:"NQ", contractType:"standard", side:"Long",
    asset_type:"Futures",
    trade_date: (() => { const _n=new Date(); return `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}-${String(_n.getDate()).padStart(2,'0')}`; })(),
    contracts:"1", entry:"", exit:"",
    entryPrice:"", exitPrice:"",
    pnl:"", rr:"", tags:[], review:"", rating:0, screenshot:null,
  });
  const [hover, setHover] = useState(0);
  const [tagInput, setTagInput] = useState("");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef();

  const inst = INSTRUMENTS.find(i=>i.value===form.symbol) || INSTRUMENTS[0];
  const ptVal = inst.pts[form.contractType] || inst.pts.standard;

  // Auto-calc P&L based on asset type
  const autoPnl = (() => {
    const ep = parseFloat(form.entryPrice), xp = parseFloat(form.exitPrice);
    const ct = parseInt(form.contracts) || 1;
    if (!ep || !xp) return null;
    const diff = form.side === "Long" ? xp - ep : ep - xp;
    if (form.asset_type === "Futures") return Math.round(diff * ptVal * ct);
    if (form.asset_type === "Options") return Math.round(diff * 100 * ct);  // 1 contract = 100 shares
    if (form.asset_type === "Stocks")  return Math.round(diff * ct * 100) / 100;  // ct = shares/100
    if (form.asset_type === "Crypto")  return Math.round(diff * ct * 100) / 100;
    return Math.round(diff * ct * 100) / 100; // generic
  })();

  // Hold time
  const holdMin = (() => {
    if (!form.entry || !form.exit) return null;
    const [eh,em] = form.entry.split(":").map(Number);
    const [xh,xm] = form.exit.split(":").map(Number);
    return (xh*60+xm) - (eh*60+em);
  })();

  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const toggleTag = t => set("tags", form.tags.includes(t) ? form.tags.filter(x=>x!==t) : [...form.tags,t]);
  const addCustomTag = () => { if(tagInput.trim()&&!form.tags.includes(tagInput.trim())) set("tags",[...form.tags,tagInput.trim()]); setTagInput(""); };
  const handleFile = f => {
    if(!f||!f.type.startsWith("image/")) return;
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const canvas=document.createElement("canvas");
        const MAX=800;
        const ratio=Math.min(MAX/img.width,MAX/img.height,1);
        canvas.width=Math.round(img.width*ratio);
        canvas.height=Math.round(img.height*ratio);
        canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
        set("screenshot", canvas.toDataURL("image/jpeg",0.6));
      };
      img.src=e.target.result;
    };
    reader.readAsDataURL(f);
  };

  const [newsOverride, setNewsOverride] = useState(false);

  // Check if current time is in a news blocking window
  const newsWarning = (() => {
    if (!newsBlocker?.enabled || !calendarEvents?.length) return null;
    const now = new Date();
    const today = (() => { const _n=now; return `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}-${String(_n.getDate()).padStart(2,'0')}`; })();
    const nowMin = now.getHours()*60 + now.getMinutes();
    for (const ev of calendarEvents) {
      if (ev.date !== today) continue;
      if (newsBlocker.impact === "high" && ev.impact !== "high") continue;
      if (newsBlocker.impact === "medium_high" && ev.impact === "low") continue;
      if (!ev.time) continue;
      try {
        const t = ev.time.trim();
        const [hm, ampm] = [t.replace(/ ?[AaPp][Mm]/,""), t.match(/[AaPp][Mm]/)?.[0]?.toUpperCase()];
        let [h, m] = hm.split(":").map(Number);
        if (ampm === "PM" && h < 12) h += 12;
        if (ampm === "AM" && h === 12) h = 0;
        const evMin = h*60 + (m||0);
        if (nowMin >= evMin - newsBlocker.before && nowMin <= evMin + newsBlocker.after) {
          return { event: ev.event||ev.name, time: ev.time };
        }
      } catch { continue; }
    }
    return null;
  })();

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(null);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true); setSaveErr(null);
    const finalPnl = parseFloat(form.pnl) || autoPnl || 0;
    const finalRr  = parseFloat(form.rr) || 0;
    try {
      await onSave({
        symbol:     form.symbol,
        asset_type: form.asset_type || "Futures",
        side:       form.side,
        entry:      form.entry,
        exit:       form.exit,
        pnl:        finalPnl,
        rr:         finalRr,
        holdMin:    holdMin || 0,
        tags:       form.tags,
        rating:     form.rating,
        review:     form.review,
        screenshot: form.screenshot,
        checks:     form.checks || {},
        trade_date: form.trade_date,
        status:     finalPnl >= 0 ? "win" : "loss",
      });
    } catch(err) {
      console.error("Save trade failed:", err);
      setSaveErr("Save failed — " + (err.message || "please try again"));
    }
    setSaving(false);
  };

  const canSave = form.symbol && form.side && form.trade_date && (form.pnl || autoPnl!==null);
  const blockedByNews = newsWarning && !newsOverride;

  const inputStyle = {width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"};
  const labelStyle = {fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:5,display:"block"};

  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(4px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} className="fv-modal-backdrop" onClick={onClose}>
      <style>{`
        @media(min-width:769px){
          .fv-modal-backdrop{align-items:center!important;padding:20px}
          .fv-modal-inner{max-width:860px!important;border-radius:16px!important;max-height:92vh!important}
          .fv-modal-cols{grid-template-columns:1fr 1fr!important}
          .fv-modal-col-right{border-left:1px solid var(--fv-border)!important;border-top:none!important}
        }
        @media(max-width:768px){
          .fv-modal-inner{border-radius:20px 20px 0 0!important;max-height:92vh!important;padding-bottom:env(safe-area-inset-bottom)}
          .fv-modal-cols{grid-template-columns:1fr!important}
        }
      `}</style>
      <div className="fv-modal-inner" style={{background:C.card,border:`1px solid ${C.border}`,width:"100%",maxHeight:"92vh",overflowY:"auto",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,position:"sticky",top:0,background:C.card,zIndex:10}}>
          <div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Manual Entry</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,marginTop:2}}>+ New Trade</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:22,lineHeight:1}}>✕</button>
        </div>

        <div className="fv-modal-cols" style={{display:"grid",gridTemplateColumns:"1fr",flex:1}}>

          {/* Left column */}
          <div style={{padding:"20px",borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",gap:14}}>

            {/* Asset Type selector */}
            <div>
              <label style={labelStyle}>Asset Type</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["Futures","Stocks","Options","Crypto","Forex","Other"].map(at=>(
                  <button key={at} onClick={()=>set("asset_type",at)}
                    style={{padding:"8px 14px",borderRadius:8,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,
                      background:form.asset_type===at?C.accentDim:C.surface,
                      border:`1px solid ${form.asset_type===at?C.accent+"66":C.border}`,
                      color:form.asset_type===at?C.accent:C.textDim}}>
                    {at}
                  </button>
                ))}
              </div>
            </div>

            {/* Instrument / Symbol */}
            <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"end"}}>
              <div>
                <label style={labelStyle}>
                  {form.asset_type==="Futures" ? "Instrument" : "Ticker Symbol"}
                </label>
                {form.asset_type === "Futures" ? (
                  <div style={{display:"flex",gap:6}}>
                    <select value={form.symbol} onChange={e=>set("symbol",e.target.value)} style={{...inputStyle,cursor:"pointer",flex:1}}>
                      {INSTRUMENTS.map(i=><option key={i.value} value={i.value}>{i.label}</option>)}
                    </select>
                    <button onClick={()=>{
                      const ticker = window.prompt("Custom futures symbol (e.g. NG, ZN):");
                      if (!ticker?.trim()) return;
                      const val = ticker.trim().toUpperCase();
                      if (!INSTRUMENTS.find(i=>i.value===val)) {
                        const n = {value:val,label:val,pts:{standard:1,micro:1}};
                        const custom = JSON.parse(localStorage.getItem("fv_custom_tickers")||"[]");
                        custom.push(n); localStorage.setItem("fv_custom_tickers",JSON.stringify(custom));
                        INSTRUMENTS.push(n);
                      }
                      set("symbol",val);
                    }} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",cursor:"pointer",color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:11,flexShrink:0}}>+ Custom</button>
                  </div>
                ) : (
                  <input
                    value={form.symbol}
                    onChange={e=>set("symbol",e.target.value.toUpperCase())}
                    placeholder={
                      form.asset_type==="Stocks"  ? "e.g. AAPL, TSLA, SPY" :
                      form.asset_type==="Options" ? "e.g. AAPL 180C, SPY 480P" :
                      form.asset_type==="Crypto"  ? "e.g. BTC, ETH, SOL" :
                      form.asset_type==="Forex"   ? "e.g. EURUSD, GBPJPY" : "Ticker symbol"
                    }
                    style={inputStyle}
                  />
                )}
              </div>
              {form.asset_type === "Futures" && (
                <div>
                  <label style={labelStyle}>Type <span style={{color:C.accent}}>${ptVal}/pt</span></label>
                  <div style={{display:"flex",gap:6}}>
                    {[{id:"standard",label:"Std"},{id:"micro",label:"Micro"}].map(ct=>(
                      <button key={ct.id} onClick={()=>set("contractType",ct.id)}
                        style={{padding:"10px 14px",borderRadius:8,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,
                          background:form.contractType===ct.id?C.accentDim:C.surface,
                          border:`1px solid ${form.contractType===ct.id?C.accent+"66":C.border}`,
                          color:form.contractType===ct.id?C.accent:C.textDim}}>
                        {ct.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>



            {/* Direction */}
            <div>
              <label style={labelStyle}>Direction</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {["Long","Short"].map(s=>(
                  <button key={s} onClick={()=>set("side",s)}
                    style={{padding:"11px",borderRadius:8,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700,background:form.side===s?(s==="Long"?`${C.green}22`:`${C.red}22`):C.surface,border:`1px solid ${form.side===s?(s==="Long"?C.green+"66":C.red+"66"):C.border}`,color:form.side===s?(s==="Long"?C.green:C.red):C.textDim}}>
                    {s==="Long"?"▲ Long":"▼ Short"}
                  </button>
                ))}
              </div>
            </div>

            {/* Date + Contracts */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label style={labelStyle}>Trade Date</label><input type="date" value={form.trade_date} onChange={e=>set("trade_date",e.target.value)} style={inputStyle}/></div>
              <div><label style={labelStyle}>Contracts</label><input type="number" min="1" value={form.contracts} onChange={e=>set("contracts",e.target.value)} placeholder="1" style={inputStyle}/></div>
            </div>

            {/* Entry / Exit time */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label style={labelStyle}>Entry Time</label><input type="time" value={form.entry} onChange={e=>set("entry",e.target.value)} style={inputStyle}/></div>
              <div><label style={labelStyle}>Exit Time</label><input type="time" value={form.exit} onChange={e=>set("exit",e.target.value)} style={inputStyle}/></div>
            </div>

            {/* Entry / Exit price */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label style={labelStyle}>Entry Price (auto P&L)</label><input type="number" step="0.25" value={form.entryPrice} onChange={e=>set("entryPrice",e.target.value)} placeholder="e.g. 21450.00" style={inputStyle}/></div>
              <div><label style={labelStyle}>Exit Price</label><input type="number" step="0.25" value={form.exitPrice} onChange={e=>set("exitPrice",e.target.value)} placeholder="e.g. 21475.00" style={inputStyle}/></div>
            </div>

            {/* Net P&L + R:R */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={labelStyle}>Net P&L ($) {autoPnl!==null&&<span style={{color:C.accent}}>auto-calc</span>}</label>
                <input type="number" value={form.pnl} onChange={e=>set("pnl",e.target.value)} placeholder={autoPnl!==null?String(autoPnl):"e.g. 500.00"} style={{...inputStyle,borderColor:autoPnl!==null?C.accent+"66":C.border}}/>
              </div>
              <div><label style={labelStyle}>R:R (optional)</label><input type="number" step="0.1" value={form.rr} onChange={e=>set("rr",e.target.value)} placeholder="e.g. 2.5" style={inputStyle}/></div>
            </div>

            {/* Summary row */}
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",display:"flex",gap:18,flexWrap:"wrap"}}>
              {[
                ["Hold", holdMin!=null ? `${holdMin}m` : "–"],
                ["P&L",  form.pnl ? `$${form.pnl}` : autoPnl!=null ? `$${autoPnl}` : "–"],
                [form.asset_type==="Stocks"?"Shares":form.asset_type==="Options"?"Contracts":form.asset_type==="Crypto"?"Units":"Contracts", `${form.contracts||1}× ${form.symbol}`],
                ["Value/pt", `$${ptVal}/pt`],
              ].map(([l,v])=>(
                <div key={l}><div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,textTransform:"uppercase"}}>{l}</div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,marginTop:2}}>{v}</div></div>
              ))}
            </div>

            {/* Tags */}
            <div>
              <label style={labelStyle}>Tags</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                {ADD_TAGS.map(t=>(
                  <button key={t} onClick={()=>toggleTag(t)}
                    style={{borderRadius:20,padding:"3px 11px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,background:form.tags.includes(t)?`${tagColor(t)}22`:C.surface,border:`1px solid ${form.tags.includes(t)?tagColor(t)+"66":C.border}`,color:form.tags.includes(t)?tagColor(t):C.muted}}>
                    {form.tags.includes(t)?"✓ ":""}{t}
                  </button>
                ))}
              </div>
              <div style={{display:"flex",gap:6}}>
                <input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCustomTag()} placeholder="Custom tag..." style={{...inputStyle,flex:1}}/>
                <button onClick={addCustomTag} style={{background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:8,padding:"10px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11}}>Add</button>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="fv-modal-col-right" style={{padding:"20px",borderTop:`1px solid ${C.border}`,display:"flex",flexDirection:"column",gap:14}}>

            {/* Screenshot */}
            <div>
              <label style={labelStyle}>Chart Screenshot</label>
              <div style={{border:`2px dashed ${drag?C.accent:C.border}`,borderRadius:10,minHeight:180,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",background:drag?C.accentDim:C.surface,position:"relative",transition:"all 0.15s"}}
                onClick={()=>fileRef.current.click()}
                onDragOver={e=>{e.preventDefault();setDrag(true);}}
                onDragLeave={()=>setDrag(false)}
                onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}>
                {form.screenshot
                  ? <><img src={form.screenshot} alt="trade" style={{width:"100%",objectFit:"cover",borderRadius:8}}/><button onClick={e=>{e.stopPropagation();set("screenshot",null);}} style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,.6)",border:"none",color:"#fff",borderRadius:4,padding:"2px 8px",cursor:"pointer",fontSize:11}}>Remove</button></>
                  : <><div style={{fontSize:32,marginBottom:8}}>📷</div><div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,textAlign:"center"}}>Drag & drop or click to upload</div></>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
            </div>

            {/* Rating */}
            <div>
              <label style={labelStyle}>Trade Rating</label>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {[1,2,3,4,5].map(s=>(
                  <div key={s} onClick={()=>set("rating",s)} onMouseEnter={()=>setHover(s)} onMouseLeave={()=>setHover(0)}
                    style={{fontSize:26,cursor:"pointer",transition:"transform 0.1s",transform:(hover||form.rating)>=s?"scale(1.2)":"scale(1)",filter:(hover||form.rating)>=s?"none":"grayscale(1) opacity(.25)"}}>⭐</div>
                ))}
                {(hover||form.rating)>0&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim}}>{["","Terrible","Poor","Okay","Good","Perfect"][(hover||form.rating)]}</span>}
              </div>
            </div>

            {/* Rule checklist */}
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <label style={{...labelStyle,marginBottom:0}}>Rule Checklist</label>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:Object.values(form.checks||{}).filter(Boolean).length===globalRules.length?C.green:C.muted}}>
                  {Object.values(form.checks||{}).filter(Boolean).length}/{globalRules.length}
                </span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {globalRules.map((rule,i)=>{
                  const checked = (form.checks||{})[rule];
                  return (
                    <label key={i} onClick={()=>set("checks",{...(form.checks||{}),[rule]:!checked})}
                      style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"6px 10px",borderRadius:7,
                        background:checked?`${C.green}0a`:C.surface,
                        border:`1px solid ${checked?C.green+"33":C.border}`,transition:"all 0.12s"}}>
                      <div style={{width:16,height:16,borderRadius:4,flexShrink:0,
                        border:`1.5px solid ${checked?C.green:C.border}`,
                        background:checked?`${C.green}22`:"transparent",
                        display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {checked&&<span style={{color:C.green,fontSize:10}}>✓</span>}
                      </div>
                      <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:checked?C.text:C.textDim}}>{rule}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div style={{flex:1,display:"flex",flexDirection:"column"}}>
              <label style={labelStyle}>Notes / Review</label>
              <textarea value={form.review} onChange={e=>set("review",e.target.value)} placeholder="Why did you take this trade? What went well? What could improve?" style={{...inputStyle,flex:1,minHeight:90,resize:"vertical",lineHeight:1.6,padding:12}}/>
            </div>

            {/* News Blocker Warning */}
            {newsWarning && (
              <div style={{background:`${C.red}11`,border:`2px solid ${C.red}44`,borderRadius:10,padding:"12px 14px",display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:18}}>🚨</span>
                  <div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.red,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:700}}>News Blocking Active</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim,marginTop:2}}>
                      <strong style={{color:C.text}}>{newsWarning.event}</strong> at {newsWarning.time} — most prop firms prohibit trading during this window.
                    </div>
                  </div>
                </div>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                  <input type="checkbox" checked={newsOverride} onChange={e=>setNewsOverride(e.target.checked)}
                    style={{width:14,height:14,accentColor:C.amber}}/>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.amber}}>I understand the risk — log this trade anyway</span>
                </label>
              </div>
            )}

            {/* Save */}
            <button onClick={handleSave} disabled={!canSave || blockedByNews || saving}
              style={{width:"100%",padding:"14px",borderRadius:10,cursor:canSave&&!blockedByNews&&!saving?"pointer":"not-allowed",background:canSave&&!blockedByNews?`linear-gradient(135deg,${C.accent}33,${C.accent}11)`:C.surface,border:`1px solid ${canSave&&!blockedByNews?C.accent+"55":C.border}`,color:canSave&&!blockedByNews?C.accent:C.muted,fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",opacity:canSave&&!blockedByNews?1:0.5,transition:"all 0.15s"}}>
              {saving ? "Saving..." : "+ SAVE TRADE"}
            </button>
            {saveErr && <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.red,textAlign:"center",marginTop:4}}>{saveErr}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── CSV Import Modal ──────────────────────────────────────────────────────────
const CSV_COLUMN_MAP = {
  // Tradovate format
  "symbol":      ["symbol","instrument","contract"],
  "side":        ["side","b/s","buysell","action","direction"],
  "pnl":         ["p&l","pnl","profit","net p&l","realized p&l","netprofit"],
  "entry":       ["entry time","entrytime","open time","time","datetime","date/time"],
  "exit":        ["exit time","exittime","close time","closetime"],
  "entryPrice":  ["entry price","entryprice","buy price","open price"],
  "exitPrice":   ["exit price","exitprice","sell price","close price"],
  "rr":          ["r:r","rr","risk reward","r/r"],
  "contracts":   ["qty","quantity","contracts","size","shares"],
};

const CSVImportModal = ({onClose, onImport, C}) => {
  const [step, setStep] = useState(1); // 1=upload, 2=map, 3=preview
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [preview, setPreview] = useState([]);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileRef = useRef();

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return setError("CSV must have at least a header row and one data row.");
    const hdrs = lines[0].split(',').map(h=>h.trim().replace(/"/g,'').toLowerCase());
    const rows = lines.slice(1).map(l=>{
      const vals = []; let cur='', inQ=false;
      for(const ch of l){ if(ch==='"'){inQ=!inQ;}else if(ch===','&&!inQ){vals.push(cur.trim());cur='';}else{cur+=ch;} }
      vals.push(cur.trim());
      return Object.fromEntries(hdrs.map((h,i)=>[h, vals[i]||'']));
    });
    setHeaders(hdrs);
    setRawRows(rows);
    // Auto-detect mapping
    const autoMap = {};
    for(const [field, aliases] of Object.entries(CSV_COLUMN_MAP)){
      const match = hdrs.find(h=>aliases.some(a=>h.includes(a)));
      if(match) autoMap[field] = match;
    }
    setMapping(autoMap);
    setStep(2);
  };

  const handleFile = (f) => {
    if(!f) return;
    setError("");
    const r = new FileReader();
    r.onload = e => parseCSV(e.target.result);
    r.readAsText(f);
  };

  const buildPreview = () => {
    const INSTRUMENTS = ["NQ","ES","MNQ","MES","YM","RTY","CL","GC","SI","6E"];
    const mapped = rawRows.slice(0,100).map((row,i)=>{
      const sym = (row[mapping.symbol]||"").toUpperCase().replace(/[^A-Z0-9]/g,'');
      const cleanSym = INSTRUMENTS.find(s=>sym.includes(s)) || sym || "NQ";
      const rawSide = (row[mapping.side]||"").toLowerCase();
      const side = rawSide.includes("b")||rawSide.includes("long")||rawSide==="buy" ? "Long" : "Short";
      const pnl = parseFloat((row[mapping.pnl]||"0").replace(/[$,()]/g,'').replace(/\((.+)\)/,'−$1')) || 0;
      const entryRaw = row[mapping.entry]||"";
      const exitRaw  = row[mapping.exit]||"";
      const entryDate = entryRaw.slice(0,10) || (() => { const _n=new Date(); return `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}-${String(_n.getDate()).padStart(2,'0')}`; })();
      const entryTime = entryRaw.slice(11,16) || "09:30";
      const exitTime  = exitRaw.slice(11,16)  || "09:45";
      const rr = parseFloat(row[mapping.rr]||"0") || 0;
      return {
        id: "csv-"+i,
        symbol: cleanSym, side, pnl, rr,
        entry: entryTime, exit: exitTime,
        trade_date: entryDate,
        tags: [], rating: 0, review: "", checks: {}, screenshot: null,
        holdMin: 0, status: pnl>=0?"win":"loss",
        _raw: row,
      };
    }).filter(t=>t.symbol && !isNaN(t.pnl));
    setPreview(mapped);
    setStep(3);
  };

  const inputS = {background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"};

  return (
    <div style={{position:"fixed",inset:0,zIndex:1100,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,width:"100%",maxWidth:720,maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>

        {/* Header */}
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Step {step} of 3 — {step===1?"Upload File":step===2?"Map Columns":"Preview & Import"}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,marginTop:2}}>⬆ Import CSV</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:22}}>✕</button>
        </div>

        <div style={{padding:24,overflowY:"auto",flex:1}}>

          {/* Step 1 — Upload */}
          {step===1 && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,lineHeight:1.6}}>
                Upload a CSV export from your broker. <strong style={{color:C.text}}>Tradovate</strong> format is auto-detected.
                Other brokers work too — you'll map columns manually in the next step.
              </div>
              <div
                onClick={()=>fileRef.current.click()}
                style={{border:`2px dashed ${C.border}`,borderRadius:12,padding:"48px 24px",textAlign:"center",cursor:"pointer",background:C.surface,transition:"all 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
              >
                <div style={{fontSize:40,marginBottom:12}}>📄</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,marginBottom:6}}>Click to upload CSV</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted}}>or drag and drop</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.txt" style={{display:"none"}}
                onChange={e=>handleFile(e.target.files[0])}/>
              {error && <div style={{background:`${C.red}15`,border:`1px solid ${C.red}33`,borderRadius:8,padding:"10px 14px",color:C.red,fontFamily:"'Space Mono',monospace",fontSize:11}}>⚠ {error}</div>}
              <div style={{background:C.surface,borderRadius:10,padding:14,fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,lineHeight:1.8}}>
                <div style={{color:C.text,marginBottom:6,fontWeight:700}}>TRADOVATE EXPORT:</div>
                <div>Account → Trade History → Export → CSV</div>
                <div style={{marginTop:8,color:C.text,fontWeight:700}}>COLUMNS DETECTED:</div>
                <div>Symbol, B/S, Qty, Entry Price, Exit Price, P&L, Date/Time</div>
              </div>
            </div>
          )}

          {/* Step 2 — Map columns */}
          {step===2 && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim}}>{rawRows.length} rows found. Map your CSV columns to FundVault fields:</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[
                  {field:"symbol",label:"Instrument/Symbol",required:true},
                  {field:"side",label:"Side (Buy/Sell)",required:true},
                  {field:"pnl",label:"Net P&L ($)",required:true},
                  {field:"entry",label:"Entry Date/Time"},
                  {field:"exit",label:"Exit Date/Time"},
                  {field:"entryPrice",label:"Entry Price"},
                  {field:"exitPrice",label:"Exit Price"},
                  {field:"rr",label:"R:R Ratio"},
                ].map(({field,label,required})=>(
                  <div key={field}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:required?C.accent:C.muted,marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase"}}>{label}{required?" *":""}</div>
                    <select value={mapping[field]||""} onChange={e=>setMapping(m=>({...m,[field]:e.target.value}))}
                      style={{...inputS,width:"100%",cursor:"pointer"}}>
                      <option value="">— not mapped —</option>
                      {headers.map(h=><option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <button onClick={()=>setStep(1)} style={{flex:1,padding:"11px",borderRadius:10,cursor:"pointer",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>← Back</button>
                <button onClick={buildPreview} disabled={!mapping.symbol||!mapping.pnl}
                  style={{flex:2,padding:"11px",borderRadius:10,cursor:"pointer",background:C.accentDim,border:`1px solid ${C.accent}55`,color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,opacity:!mapping.symbol||!mapping.pnl?0.5:1}}>
                  Preview Import →
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Preview */}
          {step===3 && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim}}>{preview.length} trades ready to import</div>
                <div style={{display:"flex",gap:8}}>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.green}}>{preview.filter(t=>t.pnl>=0).length} wins</span>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.red}}>{preview.filter(t=>t.pnl<0).length} losses</span>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:preview.reduce((a,t)=>a+t.pnl,0)>=0?C.green:C.red}}>
                    ${Math.round(preview.reduce((a,t)=>a+t.pnl,0)).toLocaleString()} total
                  </span>
                </div>
              </div>
              <div style={{maxHeight:340,overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:C.surface}}>{["Date","Symbol","Side","P&L","Entry","Exit"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.07em",textTransform:"uppercase",fontWeight:400}}>{h}</th>)}</tr></thead>
                  <tbody>{preview.slice(0,50).map((t,i)=>(
                    <tr key={i} style={{borderTop:`1px solid ${C.border}`}}>
                      <td style={{padding:"8px 12px",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted}}>{t.trade_date}</td>
                      <td style={{padding:"8px 12px",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13}}>{t.symbol}</td>
                      <td style={{padding:"8px 12px"}}><span style={{background:t.side==="Long"?`${C.green}18`:`${C.red}18`,color:t.side==="Long"?C.green:C.red,borderRadius:4,padding:"2px 7px",fontFamily:"'Space Mono',monospace",fontSize:9}}>{t.side}</span></td>
                      <td style={{padding:"8px 12px",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:t.pnl>=0?C.green:C.red}}>{t.pnl>=0?"+":""}${t.pnl}</td>
                      <td style={{padding:"8px 12px",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.textDim}}>{t.entry}</td>
                      <td style={{padding:"8px 12px",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.textDim}}>{t.exit}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {importing && (
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>Importing trades...</span>
                      <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.accent}}>{importProgress} / {preview.length}</span>
                    </div>
                    <div style={{height:4,background:C.border,borderRadius:2,overflow:"hidden"}}>
                      <div style={{height:"100%",background:C.green,borderRadius:2,width:`${(importProgress/preview.length)*100}%`,transition:"width 0.2s"}}/>
                    </div>
                  </div>
                )}
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setStep(2)} disabled={importing} style={{flex:1,padding:"11px",borderRadius:10,cursor:"pointer",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11,opacity:importing?0.4:1}}>← Back</button>
                  <button onClick={async ()=>{
                    setImporting(true); setImportProgress(0);
                    try { await onImport(preview, setImportProgress); } catch(e) { console.error("Import error:",e); }
                    setImporting(false);
                  }} disabled={importing}
                    style={{flex:2,padding:"11px",borderRadius:10,cursor:importing?"wait":"pointer",background:importing?C.surface:`linear-gradient(135deg,${C.green}33,${C.green}11)`,border:`1px solid ${C.green}55`,color:C.green,fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",opacity:importing?0.6:1}}>
                    {importing ? "Saving..." : `✓ Import ${preview.length} Trades`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


// ── Export Modal ─────────────────────────────────────────────────────────────
const ExportModal = ({ onClose, trades, C, userName }) => {
  const [step, setStep]             = useState(1);
  const [selected, setSelected]     = useState(() => new Set(trades.map(t => t.id)));
  const [format, setFormat]         = useState("full");
  const [generating, setGenerating] = useState(false);
  const [sections, setSections]     = useState({
    summary: true, perTrade: true, screenshots: true,
    tagBreakdown: true, psychology: false, propCompliance: false,
  });

  const selectedTrades = trades.filter(t => selected.has(t.id));
  const toggleTrade = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const totalPnl  = selectedTrades.reduce((a,t) => a+t.pnl, 0);
  const wins      = selectedTrades.filter(t => t.pnl > 0).length;
  const winRate   = selectedTrades.length ? Math.round(wins/selectedTrades.length*100) : 0;
  const avgRR     = selectedTrades.length ? (selectedTrades.reduce((a,t) => a+(t.rr||0),0)/selectedTrades.length).toFixed(1) : "–";
  const avgRating = selectedTrades.length ? (selectedTrades.reduce((a,t) => a+(t.rating||0),0)/selectedTrades.length).toFixed(1) : "–";

  const tagColor = tag => ({"Kill Zone":C.accent,"Displacement":C.accent,"FVG":C.purple,"OB":C.amber,"BOS":"#34d399","FOMO":C.red,"Revenge":C.red,"Late entry":C.amber}[tag] || C.muted);

  const loadJsPDF = () => new Promise((resolve, reject) => {
    if (window.jspdf) { resolve(window.jspdf.jsPDF); return; }
    const s1 = document.createElement("script");
    s1.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s1.onload = () => {
      const s2 = document.createElement("script");
      s2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
      s2.onload = () => resolve(window.jspdf.jsPDF);
      s2.onerror = reject;
      document.head.appendChild(s2);
    };
    s1.onerror = reject;
    document.head.appendChild(s1);
  });

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const PW = 210, M = 16;
      let y = 0;

      const cyan   = [0,229,255],   purple  = [167,139,250];
      const green  = [0,208,132],   red     = [255,61,90];
      const amber  = [245,158,11],  dark    = [13,20,32];
      const muted  = [74,96,128],   light   = [200,216,232];
      const white  = [255,255,255], bodyBg  = [248,250,252];
      const border = [226,232,240], textDark= [15,23,42];
      const textMid= [100,116,139], textLight=[148,163,184];

      // Safe number format - always en-US, no locale issues
      const fmt  = (n) => Math.abs(n).toLocaleString('en-US');
      const pnlStr = (n) => `${n>=0?"+":"-"}$${fmt(n)}`;
      const safeStr = (s) => String(s||"").replace(/[\u2013\u2014\u2022\u00B7\u2019\u2018]/g,"-").replace(/[^\x00-\x7F]/g,"?");

      // ── Render real FundVault SVG logo to canvas → base64 PNG ────────────────
      const renderLogo = () => new Promise((resolve) => {
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120" viewBox="0 0 400 120">
  <rect width="400" height="120" fill="#080c14" rx="12"/>
  <g transform="translate(24, 20)">
    <circle cx="40" cy="40" r="37" fill="#0d1420" stroke="#00e5ff" stroke-width="4"/>
    <circle cx="40" cy="40" r="29" fill="#111827"/>
    <rect x="36.4" y="2" width="7.2" height="10" rx="3.6" fill="#00e5ff"/>
    <rect x="36.4" y="68" width="7.2" height="10" rx="3.6" fill="#00e5ff"/>
    <rect x="2" y="36.4" width="10" height="7.2" rx="3.6" fill="#00e5ff"/>
    <rect x="68" y="36.4" width="10" height="7.2" rx="3.6" fill="#00e5ff"/>
    <text x="19" y="50" font-family="Arial Black,sans-serif" font-weight="900" font-size="30" fill="#00e5ff" letter-spacing="3">F</text>
    <text x="42" y="50" font-family="Arial Black,sans-serif" font-weight="900" font-size="30" fill="#a78bfa" letter-spacing="3">V</text>
  </g>
  <text x="130" y="58" font-family="Arial Black,sans-serif" font-weight="900" font-size="32" fill="#c8d8e8" letter-spacing="3">FUNDVAULT</text>
  <text x="132" y="80" font-family="Arial,monospace" font-size="10" fill="#00e5ff" letter-spacing="4">PROP TRADING JOURNAL</text>
</svg>`;
        const blob = new Blob([svgStr], {type:"image/svg+xml"});
        const url  = URL.createObjectURL(blob);
        const img  = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 400; canvas.height = 120;
          canvas.getContext("2d").drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      });

      const logoBase64 = await renderLogo();

      // ── Header band ─────────────────────────────────────────────────────────
      doc.setFillColor(...dark); doc.rect(0, 0, PW, 30, "F");

      // Real FundVault logo (SVG → PNG)
      if (logoBase64) {
        doc.addImage(logoBase64, "PNG", M, 3, 52, 15.6);  // 400:120 ratio → 52×15.6mm
      } else {
        // Fallback: plain text if canvas render failed
        doc.setFontSize(16); doc.setFont("helvetica","bold"); doc.setTextColor(...cyan);
        doc.text("FUNDVAULT", M, 13);
        doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(...light);
        doc.text("PROP TRADING JOURNAL", M, 19);
      }

      doc.setFontSize(7.5); doc.setTextColor(...muted);
      const dateStr = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
      doc.text(`Exported by ${safeStr(userName)}  |  ${dateStr}`, M + 16, 27);
      doc.text(`${selectedTrades.length} trade${selectedTrades.length!==1?"s":""}  |  ${format==="full"?"Full report":"Summary"}`, PW - M, 27, {align:"right"});
      y = 38;

      // ── Summary stats ────────────────────────────────────────────────────────
      if (sections.summary) {
        doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.setTextColor(...muted);
        doc.text("PERFORMANCE SUMMARY", M, y); y += 4;

        const stats = [
          ["NET P&L",     pnlStr(totalPnl),                    totalPnl>=0?green:red,   totalPnl>=0?green:red],
          ["WIN RATE",    `${winRate}%`,                        winRate>=50?green:red,   winRate>=50?green:red],
          ["AVG R:R",     `${avgRR}R`,                          cyan,                    cyan],
          ["AVG RATING",  `${avgRating} / 5`,                   amber,                   amber],
          ["TRADES",      String(selectedTrades.length),         textMid,                 border],
          ["WINNERS",     `${wins} of ${selectedTrades.length}`, green,                   green],
        ];
        const cw = (PW - M*2 - 10) / 3;
        stats.forEach((s, i) => {
          const col = i % 3, row = Math.floor(i / 3);
          const cx = M + col*(cw+5), cy = y + row*15;
          // White card with subtle border
          doc.setFillColor(...white); doc.roundedRect(cx, cy, cw, 12, 1, 1, "F");
          doc.setDrawColor(...border); doc.setLineWidth(0.3); doc.roundedRect(cx, cy, cw, 12, 1, 1, "S");
          // Colored top accent bar
          doc.setFillColor(...s[3]); doc.roundedRect(cx, cy, cw, 1.5, 0.5, 0.5, "F");
          // Label
          doc.setFontSize(6); doc.setFont("helvetica","normal"); doc.setTextColor(...textMid);
          doc.text(s[0], cx+3, cy+5.5);
          // Value
          doc.setFontSize(9.5); doc.setFont("helvetica","bold"); doc.setTextColor(...s[2]);
          doc.text(s[1], cx+3, cy+10.5);
        });
        y += 36;
      }

      // ── Tag breakdown ────────────────────────────────────────────────────────
      if (sections.tagBreakdown) {
        const allTags = [...new Set(selectedTrades.flatMap(t=>t.tags||[]))];
        if (allTags.length) {
          if (y > 230) { doc.addPage(); y = 18; }
          doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.setTextColor(...muted);
          doc.text("SETUP TAG PERFORMANCE", M, y); y += 4;
          const tagData = allTags.map(tag => {
            const tt = selectedTrades.filter(t=>(t.tags||[]).includes(tag));
            const tw = tt.filter(t=>t.pnl>0);
            const pnl = tt.reduce((a,t)=>a+t.pnl,0);
            const wr  = Math.round(tw.length/tt.length*100);
            return [tag, String(tt.length), `${wr}%`, pnlStr(pnl)];
          });
          doc.autoTable({
            startY: y, head:[["Setup","Trades","Win %","P&L"]], body: tagData,
            margin:{left:M,right:M},
            headStyles:{fillColor:[13,20,32],textColor:[0,229,255],fontSize:6.5,fontStyle:"bold"},
            bodyStyles:{fillColor:[255,255,255],textColor:[15,23,42],fontSize:8,cellPadding:2.5},
            alternateRowStyles:{fillColor:[248,250,252]},
            tableLineColor:[226,232,240], tableLineWidth:0.2,
            columnStyles:{0:{cellWidth:72},1:{cellWidth:20,halign:"center"},2:{cellWidth:22,halign:"center"},3:{halign:"right"}},
            didParseCell:(d) => {
              if (d.section==="body" && d.column.index===3) {
                d.cell.styles.textColor = String(d.cell.raw).startsWith("+") ? [0,168,107] : [220,50,70];
                d.cell.styles.fontStyle = "bold";
              }
            },
          });
          y = doc.lastAutoTable.finalY + 8;
        }
      }

      // ── Trade table ──────────────────────────────────────────────────────────
      if (y > 220) { doc.addPage(); y = 18; }
      doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.setTextColor(...muted);
      doc.text("TRADES", M, y); y += 4;

      const tableRows = selectedTrades.map(t => [
        String(t.symbol||""),
        String(t.side||""),
        String(t.trade_date||"-"),
        t.entry ? String(t.entry) : "-",
        (t.tags||[]).slice(0,2).join(", ") || "-",
        t.rating ? `${t.rating}/5` : "-",
        t.rr != null ? `${parseFloat(t.rr).toFixed(1)}R` : "-",
        pnlStr(t.pnl),
      ]);

      doc.autoTable({
        startY: y,
        head:[["Symbol","Side","Date","Entry","Tags","Rtg","R:R","P&L"]],
        body: tableRows,
        margin:{left:M,right:M},
        headStyles:{fillColor:[13,20,32],textColor:[0,229,255],fontSize:6.5,fontStyle:"bold"},
        bodyStyles:{fillColor:[255,255,255],textColor:[15,23,42],fontSize:8,cellPadding:2.5},
        alternateRowStyles:{fillColor:[248,250,252]},
        tableLineColor:[226,232,240], tableLineWidth:0.2,
        columnStyles:{
          0:{cellWidth:16},1:{cellWidth:14},2:{cellWidth:22},
          3:{cellWidth:16},4:{cellWidth:52},
          5:{cellWidth:13,halign:"center"},6:{cellWidth:16,halign:"center"},7:{halign:"right"},
        },
        didParseCell:(d) => {
          if (d.section==="body") {
            if (d.column.index===7) {
              d.cell.styles.textColor = String(d.cell.raw).startsWith("+") ? [0,168,107] : [220,50,70];
              d.cell.styles.fontStyle = "bold";
            }
            if (d.column.index===1)
              d.cell.styles.textColor = d.cell.raw==="Long" ? [0,168,107] : [220,50,70];
            if (d.column.index===5 && d.cell.raw !== "-") {
              const r = parseInt(d.cell.raw);
              d.cell.styles.textColor = r>=4?[0,168,107]:r>=3?[180,115,0]:[220,50,70];
            }
          }
        },
      });
      y = doc.lastAutoTable.finalY + 8;

      // ── Per-trade detail: review + screenshot combined ───────────────────────
      if (format==="full" && (sections.perTrade || sections.screenshots)) {
        const tradesWithContent = selectedTrades.filter(t => t.review || t.screenshot);
        if (tradesWithContent.length) {
          if (y > 200) { doc.addPage(); y = 18; }
          doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.setTextColor(...muted);
          doc.text("TRADE DETAIL", M, y); y += 5;

          for (const t of tradesWithContent) {
            const hasReview     = sections.perTrade && t.review;
            const hasScreenshot = sections.screenshots && t.screenshot;
            const reviewLines   = hasReview ? doc.splitTextToSize(safeStr(t.review), PW-M*2-6) : [];
            const reviewH       = hasReview ? Math.min(reviewLines.length, 4)*4.5 + 2 : 0;
            const headerH       = 16;
            const shotH         = hasScreenshot ? 74 : 0;
            const totalH        = headerH + reviewH + (hasScreenshot ? shotH + 4 : 0);

            if (y + totalH > 270) { doc.addPage(); y = 18; }

            // White card with subtle border
            doc.setFillColor(...white);
            doc.roundedRect(M, y, PW-M*2, totalH + 6, 1.5, 1.5, "F");
            doc.setDrawColor(...border); doc.setLineWidth(0.3);
            doc.roundedRect(M, y, PW-M*2, totalH + 6, 1.5, 1.5, "S");

            // Coloured left accent bar
            doc.setFillColor(...(t.pnl>=0 ? green : red));
            doc.roundedRect(M, y, 3, totalH + 6, 1, 1, "F");

            // Header row: symbol + side + P&L + date + rating + tags
            doc.setFontSize(10); doc.setFont("helvetica","bold");
            doc.setTextColor(...(t.pnl>=0 ? [0,168,107] : [220,50,70]));
            doc.text(pnlStr(t.pnl), PW-M-2, y+8, {align:"right"});

            doc.setTextColor(...textDark);
            doc.text(`${t.symbol}  ${t.side}`, M+7, y+8);

            doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(...textMid);
            const tagStr = (t.tags||[]).slice(0,3).join(", ") || "";
            const meta   = [
              t.trade_date||"",
              t.entry ? `${t.entry}` : "",
              t.rr != null ? `${parseFloat(t.rr).toFixed(1)}R` : "",
              t.rating ? `Rating: ${t.rating}/5` : "",
              tagStr,
            ].filter(Boolean).join("  |  ");
            doc.text(meta, M+7, y+13);

            let cardY = y + headerH;

            // Review notes
            if (hasReview) {
              doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(...textMid);
              doc.text(reviewLines.slice(0,4), M+7, cardY + 4);
              cardY += reviewH + 4;
            }

            // Screenshot
            if (hasScreenshot) {
              try {
                doc.addImage(t.screenshot, "JPEG", M+4, cardY + 2, PW-M*2-8, shotH);
                cardY += shotH + 4;
              } catch(e) {}
            }

            y += totalH + 10;
          }
        }
      }

      // ── AI analysis prompt ───────────────────────────────────────────────────
      if (y > 240) { doc.addPage(); y = 18; }
      doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.setTextColor(...purple);
      doc.text("AI ANALYSIS PROMPT", M, y); y += 4;
      doc.setFillColor(245,243,255);
      const prompt = `Analyse the ${selectedTrades.length} trade${selectedTrades.length!==1?"s":""} in this report. Please identify: 1) My strongest setup patterns and what they have in common. 2) My weakest areas and recurring mistakes. 3) Time-of-day patterns - when am I most and least profitable? 4) Any prop firm rule risks based on my trading behaviour. 5) One specific, measurable thing I should focus on to improve my edge. Be direct and data-driven.`;
      const pLines = doc.splitTextToSize(prompt, PW-M*2-6);
      const pH = Math.min(pLines.length,8)*4.5+10;
      doc.roundedRect(M, y, PW-M*2, pH, 1.5, 1.5, "F");
      doc.setDrawColor(167,139,250); doc.setLineWidth(0.4);
      doc.roundedRect(M, y, PW-M*2, pH, 1.5, 1.5, "S");
      doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(100,80,180);
      doc.text(pLines.slice(0,8), M+4, y+6);

      // ── Footer ───────────────────────────────────────────────────────────────
      const pages = doc.internal.getNumberOfPages();
      for (let i=1;i<=pages;i++) {
        doc.setPage(i);
        doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(...muted);
        doc.text(`FundVault  |  fundvault.app  |  Page ${i} of ${pages}`, PW/2, 293, {align:"center"});
      }

      doc.save(`FundVault-trades-${(() => { const _n=new Date(); return `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}-${String(_n.getDate()).padStart(2,'0')}`; })()}.pdf`);
    } catch(err) {
      console.error("PDF failed:", err);
      alert("PDF generation failed. See browser console for details.");
    }
    setGenerating(false);
  }

  const SECTION_LABELS = {summary:"Summary stats",perTrade:"Trade reviews",screenshots:"Screenshots",tagBreakdown:"Tag breakdown",psychology:"Psychology",propCompliance:"Prop compliance"};

  return (
    <div style={{position:"fixed",inset:0,zIndex:1200,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,width:"100%",maxWidth:700,maxHeight:"92vh",overflowY:"auto",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:"16px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,position:"sticky",top:0,background:C.card,zIndex:10}}>
          <div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>
              {step===1?"Select trades":step===2?"Export options":"Preview & download"}
            </div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,marginTop:2}}>Export to PDF</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{display:"flex",gap:6}}>
              {[1,2,3].map(s=><div key={s} style={{width:s===step?20:7,height:7,borderRadius:4,background:s===step?C.accent:s<step?`${C.accent}55`:C.border,transition:"all 0.3s"}}/>)}
            </div>
            <button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:20}}>✕</button>
          </div>
        </div>

        <div style={{padding:"20px 24px",flex:1}}>

          {/* Step 1 */}
          {step===1&&(<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim}}>{selected.size} of {trades.length} trades selected</div>
              <div style={{display:"flex",gap:7}}>
                <button onClick={()=>setSelected(new Set(trades.map(t=>t.id)))} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>Select all</button>
                <button onClick={()=>setSelected(new Set())} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>Clear</button>
              </div>
            </div>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",marginBottom:16}}>
              {trades.length===0
                ? <div style={{padding:40,textAlign:"center",color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:12}}>No trades to export</div>
                : trades.map((t,i)=>(
                  <div key={t.id} onClick={()=>toggleTrade(t.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:i<trades.length-1?`1px solid ${C.border}`:"none",cursor:"pointer",background:selected.has(t.id)?`${C.accent}08`:"transparent",transition:"background 0.1s"}}>
                    <div style={{width:16,height:16,borderRadius:4,flexShrink:0,border:`1.5px solid ${selected.has(t.id)?C.accent:C.border}`,background:selected.has(t.id)?C.accentDim:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {selected.has(t.id)&&<span style={{color:C.accent,fontSize:10}}>✓</span>}
                    </div>
                    <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,minWidth:36,color:C.text}}>{t.symbol}</span>
                    <span style={{background:t.side==="Long"?`${C.green}18`:`${C.red}18`,color:t.side==="Long"?C.green:C.red,borderRadius:4,padding:"2px 7px",fontFamily:"'Space Mono',monospace",fontSize:10}}>{t.side}</span>
                    <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted}}>{t.trade_date||""}</span>
                    <div style={{display:"flex",gap:4,flex:1}}>{(t.tags||[]).slice(0,2).map(tag=><span key={tag} style={{background:`${tagColor(tag)}18`,color:tagColor(tag),border:`1px solid ${tagColor(tag)}44`,borderRadius:20,padding:"1px 8px",fontSize:10,fontFamily:"'Space Mono',monospace"}}>{tag}</span>)}</div>
                    {t.rating>0&&<span style={{color:C.amber,fontSize:11}}>{"★".repeat(t.rating)}</span>}
                    <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:t.pnl>=0?C.green:C.red,marginLeft:"auto",minWidth:64,textAlign:"right"}}>{t.pnl>=0?"+":""}${t.pnl}</span>
                  </div>
                ))
              }
            </div>
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <button onClick={()=>{if(selected.size>0)setStep(2);}} disabled={selected.size===0}
                style={{background:selected.size>0?C.accentDim:"transparent",border:`1px solid ${selected.size>0?C.accent+"55":C.border}`,color:selected.size>0?C.accent:C.muted,borderRadius:8,padding:"10px 22px",cursor:selected.size>0?"pointer":"not-allowed",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700}}>
                Choose format →
              </button>
            </div>
          </>)}

          {/* Step 2 */}
          {step===2&&(<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
              {[
                {id:"full",    title:"Full report",  desc:"Stats, each trade with tags, rating, reviews and screenshots"},
                {id:"summary", title:"Summary only", desc:"Aggregated stats + trade table — ideal for AI analysis"},
              ].map(opt=>(
                <div key={opt.id} onClick={()=>setFormat(opt.id)} style={{border:`${format===opt.id?"2px":"1px"} solid ${format===opt.id?C.accent+"55":C.border}`,borderRadius:10,padding:"14px",cursor:"pointer",background:format===opt.id?C.accentDim:"transparent",transition:"all 0.15s"}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,marginBottom:4,color:C.text}}>{opt.title}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim}}>{opt.desc}</div>
                </div>
              ))}
            </div>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px",marginBottom:18}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>Include sections</div>
              {[
                {key:"summary",        label:"Performance summary",       desc:"Win rate, P&L, avg R:R, max drawdown"},
                {key:"tagBreakdown",   label:"Setup tag breakdown",        desc:"Win rate and P&L per setup tag"},
                {key:"perTrade",       label:"Per-trade reviews & notes",  desc:"Rating and review text per trade (full only)"},
                {key:"screenshots",    label:"Chart screenshots",          desc:"Attached chart images (full only)"},
                {key:"psychology",     label:"Psychology check-in data",   desc:"Mood and habit scores on trading days"},
                {key:"propCompliance", label:"Prop firm compliance",       desc:"Rule adherence summary"},
              ].map((s,i,arr)=>(
                <div key={s.key} onClick={()=>setSections(x=>({...x,[s.key]:!x[s.key]}))} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none",cursor:"pointer"}}>
                  <div style={{width:18,height:18,borderRadius:4,flexShrink:0,border:`1.5px solid ${sections[s.key]?C.green:C.border}`,background:sections[s.key]?`${C.green}22`:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {sections[s.key]&&<span style={{color:C.green,fontSize:11}}>✓</span>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.text}}>{s.label}</div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginTop:1}}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <button onClick={()=>setStep(1)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 20px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted}}>← Back</button>
              <button onClick={()=>setStep(3)} style={{background:C.accentDim,border:`1px solid ${C.accent}55`,color:C.accent,borderRadius:8,padding:"10px 22px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700}}>Preview →</button>
            </div>
          </>)}

          {/* Step 3 */}
          {step===3&&(<>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px",marginBottom:18}}>
              <div style={{background:"#0d1420",borderRadius:8,padding:"12px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700,color:"#00e5ff",letterSpacing:"0.1em"}}>FUNDVAULT</div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:"#6b859e",marginTop:1}}>PROP TRADING JOURNAL</div>
                </div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:"#6b859e",textAlign:"right"}}>
                  <div>{selectedTrades.length} trades · {format==="full"?"Full report":"Summary"}</div>
                  <div>{new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
                {[
                  {l:"Net P&L", v:`${totalPnl>=0?"+":""}$${Math.abs(totalPnl).toLocaleString()}`, c:totalPnl>=0?C.green:C.red},
                  {l:"Win Rate", v:`${winRate}%`, c:winRate>=50?C.green:C.red},
                  {l:"Avg R:R",  v:`${avgRR}R`, c:C.accent},
                  {l:"Avg Rating", v:`${avgRating}★`, c:C.amber},
                ].map(s=>(
                  <div key={s.l} style={{background:"#111827",borderRadius:6,padding:"10px"}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>{s.l}</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:s.c,marginTop:3}}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div style={{borderRadius:6,overflow:"hidden",border:`1px solid ${C.border}`,marginBottom:12}}>
                <div style={{display:"grid",gridTemplateColumns:"44px 44px 1fr 50px 50px",padding:"6px 10px",background:"#0d1420",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>
                  <span>Sym</span><span>Side</span><span>Tags</span><span>R:R</span><span style={{textAlign:"right"}}>P&L</span>
                </div>
                {selectedTrades.slice(0,4).map(t=>(
                  <div key={t.id} style={{display:"grid",gridTemplateColumns:"44px 44px 1fr 50px 50px",padding:"6px 10px",borderTop:`1px solid ${C.border}`,fontFamily:"'Space Mono',monospace",fontSize:10,alignItems:"center"}}>
                    <span style={{fontWeight:700,color:C.text}}>{t.symbol}</span>
                    <span style={{color:t.side==="Long"?C.green:C.red}}>{t.side}</span>
                    <span style={{color:C.muted,fontSize:9}}>{(t.tags||[]).slice(0,1).join(",")||"–"}</span>
                    <span style={{color:C.accent}}>{t.rr}R</span>
                    <span style={{textAlign:"right",color:t.pnl>=0?C.green:C.red,fontWeight:700}}>{t.pnl>=0?"+":""}${t.pnl}</span>
                  </div>
                ))}
                {selectedTrades.length>4&&<div style={{padding:"6px 10px",borderTop:`1px solid ${C.border}`,fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,textAlign:"center"}}>+ {selectedTrades.length-4} more trades</div>}
              </div>
              <div style={{background:`${C.purple}11`,border:`1px solid ${C.purple}33`,borderLeft:`3px solid ${C.purple}`,borderRadius:"0 6px 6px 0",padding:"10px 12px"}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.purple,marginBottom:4,letterSpacing:"0.05em"}}>AI ANALYSIS PROMPT (included in PDF)</div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim,lineHeight:1.5}}>
                  "Analyse the {selectedTrades.length} trades in this report. Identify my strongest setup patterns, weakest areas, time-of-day tendencies, and one specific measurable thing to improve..."
                </div>
              </div>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:18}}>
              {Object.entries(sections).filter(([,v])=>v).map(([k])=>(
                <span key={k} style={{background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:20,padding:"3px 10px",fontFamily:"'Space Mono',monospace",fontSize:10}}>
                  {SECTION_LABELS[k]}
                </span>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <button onClick={()=>setStep(2)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 20px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted}}>← Back</button>
              <button onClick={generatePDF} disabled={generating}
                style={{background:`linear-gradient(135deg,${C.accent}33,${C.accent}11)`,border:`1px solid ${C.accent}66`,color:C.accent,borderRadius:8,padding:"12px 28px",cursor:generating?"wait":"pointer",fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700,letterSpacing:"0.05em",opacity:generating?0.7:1}}>
                {generating?"Generating PDF...":"⬇ Download PDF"}
              </button>
            </div>
          </>)}

        </div>
      </div>
    </div>
  );
};

// ── Edge Modal (create/edit an Edge) ─────────────────────────────────────────
const EdgeModal = ({onClose, onSave, existing, C}) => {
  const [form, setForm] = useState(existing || {
    id:"", name:"", description:"", tags:[], rules:[""], color:"#00e5ff",
  });
  const [tagInput, setTagInput] = useState("");
  const COLORS = ["#00e5ff","#00d084","#a78bfa","#f59e0b","#ff3d5a","#f472b6","#34d399","#60a5fa"];
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const addRule = () => set("rules",[...form.rules,""]);
  const setRule = (i,v) => set("rules", form.rules.map((r,j)=>j===i?v:r));
  const removeRule = (i) => set("rules", form.rules.filter((_,j)=>j!==i));
  const addTag = () => { if(tagInput.trim()&&!form.tags.includes(tagInput.trim())) set("tags",[...form.tags,tagInput.trim()]); setTagInput(""); };
  const inputS = {background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"};

  return (
    <div style={{position:"fixed",inset:0,zIndex:1200,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,width:"100%",maxWidth:520,maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20}}>{existing?"Edit Edge":"New Edge"}</div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:22}}>✕</button>
        </div>
        <div style={{padding:24,overflowY:"auto",display:"flex",flexDirection:"column",gap:16}}>

          {/* Color */}
          <div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>Color</div>
            <div style={{display:"flex",gap:8}}>
              {COLORS.map(c=><div key={c} onClick={()=>set("color",c)} style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:`3px solid ${form.color===c?"white":"transparent"}`,boxShadow:form.color===c?`0 0 10px ${c}`:"none",transition:"all 0.15s"}}/>)}
            </div>
          </div>

          {/* Name */}
          <div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:6}}>Edge Name *</div>
            <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. AM Kill Zone FVG, OB Reversal..." style={{...inputS,width:"100%",boxSizing:"border-box"}}/>
          </div>

          {/* Description */}
          <div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:6}}>Description</div>
            <textarea value={form.description} onChange={e=>set("description",e.target.value)} placeholder="When do you take this trade? What does the setup look like?" rows={3}
              style={{...inputS,width:"100%",boxSizing:"border-box",resize:"vertical",lineHeight:1.6}}/>
          </div>

          {/* Tags to track */}
          <div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:6}}>Trade Tags (auto-link trades with these tags)</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
              {form.tags.map(t=><span key={t} style={{background:`${form.color}22`,border:`1px solid ${form.color}44`,color:form.color,borderRadius:20,padding:"2px 10px",fontFamily:"'Space Mono',monospace",fontSize:10,display:"flex",alignItems:"center",gap:4}}>
                {t}<span onClick={()=>set("tags",form.tags.filter(x=>x!==t))} style={{cursor:"pointer",opacity:.7,fontSize:10}}>✕</span>
              </span>)}
            </div>
            <div style={{display:"flex",gap:6}}>
              <input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTag()} placeholder="e.g. Kill Zone, FVG, OB..." style={{...inputS,flex:1}}/>
              <button onClick={addTag} style={{background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:8,padding:"10px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11}}>Add</button>
            </div>
          </div>

          {/* Rules */}
          <div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>Entry Rules (compliance checklist)</div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {form.rules.map((r,i)=>(
                <div key={i} style={{display:"flex",gap:7,alignItems:"center"}}>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:form.color,flexShrink:0}}>{i+1}.</span>
                  <input value={r} onChange={e=>setRule(i,e.target.value)} placeholder={`Rule ${i+1}...`} style={{...inputS,flex:1}}/>
                  {form.rules.length>1 && <button onClick={()=>removeRule(i)} style={{background:"transparent",border:"none",color:C.red,cursor:"pointer",fontSize:14,opacity:.6,flexShrink:0}}>✕</button>}
                </div>
              ))}
              <button onClick={addRule} style={{background:"transparent",border:`1px dashed ${C.border}`,borderRadius:8,padding:"8px",cursor:"pointer",color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>+ Add Rule</button>
            </div>
          </div>

          <button onClick={()=>form.name.trim()&&onSave(form)} disabled={!form.name.trim()}
            style={{width:"100%",padding:"13px",borderRadius:10,cursor:form.name.trim()?"pointer":"not-allowed",background:`${form.color}22`,border:`1px solid ${form.color}55`,color:form.color,fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",opacity:form.name.trim()?1:0.5}}>
            {existing?"Save Changes":"✓ Create Edge"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Lightweight Charts components ─────────────────────────────────────────────
const loadLW = () => new Promise((res,rej) => {
  if (window.LightweightCharts) { res(window.LightweightCharts); return; }
  const s = document.createElement("script");
  s.src = "https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js";
  s.onload = () => res(window.LightweightCharts);
  s.onerror = rej;
  document.head.appendChild(s);
});

const LWEquityChart = ({ data, darkMode, accentColor }) => {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current || !data?.length) return;
    let chart;
    loadLW().then(LW => {
      ref.current.innerHTML = "";
      chart = LW.createChart(ref.current, {
        width: ref.current.clientWidth,
        height: 180,
        layout: { background: { color: "transparent" }, textColor: darkMode ? "#4a6080" : "#94a3b8" },
        grid: { vertLines: { color: "transparent" }, horzLines: { color: darkMode ? "#1e2d3d" : "#f1f5f9" } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: "transparent", scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: "transparent", tickMarkFormatter: (t) => { const d = new Date(t*1000); return `${d.getMonth()+1}/${d.getDate()}`; } },
        handleScroll: true,
        handleScale: true,
      });
      const series = chart.addAreaSeries({
        lineColor: accentColor,
        topColor: accentColor + "40",
        bottomColor: accentColor + "00",
        lineWidth: 2,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: accentColor,
        crosshairMarkerBackgroundColor: accentColor,
        priceFormat: { type: "custom", formatter: v => `$${Math.round(v).toLocaleString()}` },
      });
      const sorted = [...data].sort((a,b)=>a.date.localeCompare(b.date));
      series.setData(sorted.map(d => ({ time: d.date, value: d.equity })));
      chart.timeScale().fitContent();
    }).catch(() => {});
    return () => { try { chart?.remove(); } catch {} };
  }, [data, darkMode, accentColor]);
  return <div ref={ref} style={{ width: "100%", height: 180 }}/>;
};

const LWPnlChart = ({ data, darkMode, green, red }) => {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current || !data?.length) return;
    let chart;
    loadLW().then(LW => {
      ref.current.innerHTML = "";
      chart = LW.createChart(ref.current, {
        width: ref.current.clientWidth,
        height: 180,
        layout: { background: { color: "transparent" }, textColor: darkMode ? "#4a6080" : "#94a3b8" },
        grid: { vertLines: { color: "transparent" }, horzLines: { color: darkMode ? "#1e2d3d" : "#f1f5f9" } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: "transparent", scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: "transparent", tickMarkFormatter: (t) => { const d = new Date(t*1000); return `${d.getMonth()+1}/${d.getDate()}`; } },
        handleScroll: true,
        handleScale: true,
      });
      const series = chart.addHistogramSeries({
        priceLineVisible: false,
        priceFormat: { type: "custom", formatter: v => `$${Math.round(v).toLocaleString()}` },
      });
      const sorted = [...data].sort((a,b)=>a.date.localeCompare(b.date));
      series.setData(sorted.map(d => ({ time: d.date, value: d.pnl, color: d.pnl >= 0 ? green : red })));
      chart.timeScale().fitContent();
    }).catch(() => {});
    return () => { try { chart?.remove(); } catch {} };
  }, [data, darkMode, green, red]);
  return <div ref={ref} style={{ width: "100%", height: 180 }}/>;
};

// ── App ───────────────────────────────────────────────────────────────────────
// ── CopierOnboarding ──────────────────────────────────────────────────────────
const CopierOnboarding = ({ onDismiss, onGoToAccounts, C }) => {
  const [step, setStep] = useState(0);
  const mob = typeof window !== "undefined" && window.innerWidth <= 768;

  const steps = [
    {
      icon: "📡",
      title: "How Trade Copier Works",
      body: (
        <>
          <p>FundVault polls Tradovate's REST API every <strong style={{color:C.accent}}>2 seconds</strong> for new fills on your master account. When a fill is detected, we immediately place the same trade on your slave accounts in parallel.</p>
          <p>Typical delay from master fill → slave order: <strong style={{color:C.text}}>2–4 seconds</strong>.</p>
          <div style={{background:`${C.green}11`,border:`1px solid ${C.green}44`,borderRadius:8,padding:"10px 14px",marginTop:12}}>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.green,fontWeight:700,marginBottom:4}}>✅ DIRECTION GUARANTEED</div>
            <div style={{fontSize:12,color:C.textDim}}>We read <code style={{background:C.bg,padding:"1px 5px",borderRadius:3,fontSize:11}}>side</code> directly from the fill. "Buy" stays Buy, "Sell" stays Sell. No inference, no TraderSync-style inversion bugs.</div>
          </div>
        </>
      ),
    },
    {
      icon: "🧪",
      title: "Dry Run Mode (Default)",
      body: (
        <>
          <p>Every new group starts with <strong style={{color:C.accent}}>Dry Run Mode enabled</strong>. In dry run, we:</p>
          <ul style={{margin:"10px 0 10px 20px",padding:0,lineHeight:1.7,color:C.textDim}}>
            <li>Detect fills on master (same as live)</li>
            <li>Log exactly what would be copied + detection delay</li>
            <li style={{color:C.red}}><strong>Do NOT place any real orders</strong></li>
          </ul>
          <p>Use it to verify timing, direction, symbol, and quantity before going live.</p>
          <div style={{background:`${C.amber}11`,border:`1px solid ${C.amber}44`,borderRadius:8,padding:"10px 14px",marginTop:12}}>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.amber,fontWeight:700,marginBottom:4}}>⚠ CAN'T TOGGLE WHILE ACTIVE</div>
            <div style={{fontSize:12,color:C.textDim}}>To switch from dry run to live, stop the group, then create a new one. This prevents accidental live trading.</div>
          </div>
        </>
      ),
    },
    {
      icon: "⚠️",
      title: "Important Limitations",
      body: (
        <>
          <p style={{marginBottom:10}}>Before you start, understand what the copier does <strong style={{color:C.red}}>NOT</strong> do:</p>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[
              {t:"Does NOT copy stops or targets", d:"Only executed fills are detected. A pending Stop Loss on master doesn't appear on slaves until it triggers and fills. Your slaves are unprotected during the trade — set stops manually per slave, or accept that stops only sync after they fire."},
              {t:"Does NOT validate prop firm rules", d:"If copying a trade would breach a slave's daily loss limit, the order still goes through. Monitor your accounts yourself."},
              {t:"Does NOT copy pending limit orders", d:"Resting limit orders aren't detected until they fill."},
              {t:"Does NOT copy historical trades", d:"Only trades after 'Start' are copied. Stopping resets the 'since' point."},
            ].map((item,i)=>(
              <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px"}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,color:C.red,marginBottom:4}}>✗ {item.t}</div>
                <div style={{fontSize:12,color:C.textDim,lineHeight:1.5}}>{item.d}</div>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      icon: "🚀",
      title: "Recommended Test Flow",
      body: (
        <>
          <ol style={{margin:"0 0 0 20px",padding:0,lineHeight:1.8,color:C.textDim}}>
            <li>Connect at least 2 Tradovate accounts in the <a onClick={()=>{onGoToAccounts();onDismiss();}} style={{color:C.accent,cursor:"pointer",textDecoration:"underline"}}>Accounts tab</a></li>
            <li>Return here and click "+ New Copy Group"</li>
            <li>Keep <strong style={{color:C.accent}}>Dry Run enabled</strong> (it's the default)</li>
            <li>Start the group, then place 3–5 trades on your master in Tradovate</li>
            <li>Check the activity log — each fill should show <code style={{background:C.bg,padding:"1px 5px",borderRadius:3,fontSize:11,color:C.accent}}>🧪 DRY</code> with the detection delay</li>
            <li>Verify side, quantity, and symbol match your actual trades</li>
            <li>When confident, stop the group, delete it, and create a new LIVE group with the same accounts</li>
          </ol>
          <div style={{background:`${C.accent}11`,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"12px 16px",marginTop:14}}>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.accent,fontWeight:700,marginBottom:4}}>💡 PRO TIP</div>
            <div style={{fontSize:12,color:C.textDim,lineHeight:1.5}}>Use a demo/eval account as your slave for the first real test. If something goes sideways, nothing real is at risk.</div>
          </div>
        </>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:mob?"flex-end":"center",justifyContent:"center",padding:mob?0:16}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:mob?"20px 20px 0 0":16,maxWidth:mob?"100%":600,width:"100%",maxHeight:mob?"95vh":"90vh",overflow:"auto",display:"flex",flexDirection:"column"}}>

        {/* Progress dots */}
        <div style={{display:"flex",gap:8,justifyContent:"center",padding:"20px 20px 0"}}>
          {steps.map((_,i)=>(
            <div key={i} style={{width:i===step?28:8,height:8,borderRadius:4,background:i<=step?C.accent:C.surface,transition:"all 0.2s"}}/>
          ))}
        </div>

        {/* Body */}
        <div style={{padding:mob?"20px 20px":"28px 32px",flex:1}}>
          <div style={{fontSize:mob?32:40,marginBottom:12}}>{current.icon}</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:mob?20:24,marginBottom:14}}>{current.title}</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:C.text,lineHeight:1.6}}>
            {current.body}
          </div>
        </div>

        {/* Actions */}
        <div style={{display:"flex",gap:mob?6:10,padding:mob?"14px 16px 18px":"16px 32px 24px",borderTop:`1px solid ${C.border}`,alignItems:"center"}}>
          {!mob && (
            <button onClick={onDismiss}
              style={{background:"transparent",border:"none",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,padding:"10px 14px"}}>
              Skip tour
            </button>
          )}
          <div style={{flex:1}}/>
          {step > 0 && (
            <button onClick={()=>setStep(s=>s-1)}
              style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:mob?"10px 14px":"10px 20px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:mob?10:11,color:C.muted}}>
              ← Back
            </button>
          )}
          <button onClick={()=>isLast ? onDismiss() : setStep(s=>s+1)}
            style={{background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:8,padding:mob?"10px 16px":"10px 24px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:mob?10:11,color:C.accent,fontWeight:700,flex:mob?1:"initial"}}>
            {isLast ? (mob?"Got it ✓":"Got it — let's go ✓") : (mob?`Next (${step+1}/${steps.length})`:`Next → (${step+1}/${steps.length})`)}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── CreateCopierGroupPanel ────────────────────────────────────────────────────
const CreateCopierGroupPanel = ({ tvAccounts, onCreate, C }) => {
  const mob = typeof window !== "undefined" && window.innerWidth <= 768;
  const [name,     setName   ] = useState("My Copy Group");
  const [masterId, setMasterId] = useState("");
  const [slaveIds, setSlaveIds] = useState([]);
  const [sizeMode, setSizeMode] = useState("mirror");
  const [fixedQty, setFixedQty] = useState(1);
  const [ratio,    setRatio   ] = useState(1.0);
  const [dryRun,   setDryRun  ] = useState(true);  // Default: safe test mode
  const [creating, setCreating] = useState(false);
  const [open,     setOpen    ] = useState(false);

  if (!open) return (
    <button onClick={()=>setOpen(true)}
      style={{background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:10,padding:"12px 20px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.accent,fontWeight:700,alignSelf:"flex-start"}}>
      + New Copy Group
    </button>
  );

  const inputS = {background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"};
  const labelS = {fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5,display:"block"};

  return (
    <div style={{background:C.card,border:`1px solid ${C.accent}44`,borderRadius:12,padding:mob?16:24,display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18}}>New Copy Group</div>
        <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:18}}>✕</button>
      </div>
      <div>
        <label style={labelS}>Group Name</label>
        <input value={name} onChange={e=>setName(e.target.value)} style={inputS} placeholder="My Copy Group"/>
      </div>
      <div>
        <label style={labelS}>Master Account (source)</label>
        <select value={masterId} onChange={e=>setMasterId(e.target.value)} style={{...inputS,cursor:"pointer"}}>
          <option value="">Select master account...</option>
          {tvAccounts.map(a=>(
            <option key={a.tradovate_account_id} value={String(a.tradovate_account_id)}>
              {a.display_name || a.account_spec} (ID: {a.tradovate_account_id})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelS}>Slave Accounts (destinations)</label>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {tvAccounts.filter(a=>String(a.tradovate_account_id)!==String(masterId)).map(a=>(
            <label key={a.tradovate_account_id} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"10px 14px",background:C.surface,borderRadius:8,border:`1px solid ${slaveIds.includes(String(a.tradovate_account_id))?C.accent+"44":C.border}`}}>
              <input type="checkbox"
                checked={slaveIds.includes(String(a.tradovate_account_id))}
                onChange={e=>{const id=String(a.tradovate_account_id);setSlaveIds(ids=>e.target.checked?[...ids,id]:ids.filter(x=>x!==id));}}
              />
              <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:13}}>{a.display_name || a.account_spec}</span>
              <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>ID: {a.tradovate_account_id}</span>
            </label>
          ))}
        </div>
      </div>
      {/* Dry run toggle */}
      <label style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:dryRun?C.accentDim:C.surface,border:`1px solid ${dryRun?C.accent+"66":C.border}`,borderRadius:8,cursor:"pointer"}}>
        <input type="checkbox" checked={dryRun} onChange={e=>setDryRun(e.target.checked)} style={{cursor:"pointer"}}/>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,color:dryRun?C.accent:C.text,textTransform:"uppercase"}}>
            🧪 Dry Run Mode
          </div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.muted,marginTop:2}}>
            Detect fills and log them with timing — but DO NOT place real orders. Safe for testing delay & accuracy.
          </div>
        </div>
      </label>

      <div>
        <label style={labelS}>Position Size</label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[{id:"mirror",label:"Mirror qty"},{id:"fixed",label:"Fixed qty"},{id:"ratio",label:"Ratio"}].map(m=>(
            <button key={m.id} onClick={()=>setSizeMode(m.id)}
              style={{padding:"8px 14px",borderRadius:8,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,
                background:sizeMode===m.id?C.accentDim:C.surface,border:`1px solid ${sizeMode===m.id?C.accent+"66":C.border}`,color:sizeMode===m.id?C.accent:C.textDim}}>
              {m.label}
            </button>
          ))}
        </div>
        {sizeMode==="fixed" && <input type="number" min="1" value={fixedQty} onChange={e=>setFixedQty(parseInt(e.target.value)||1)} style={{...inputS,marginTop:8,width:120}} placeholder="Contracts"/>}
        {sizeMode==="ratio" && <input type="number" min="0.1" step="0.1" value={ratio} onChange={e=>setRatio(parseFloat(e.target.value)||1)} style={{...inputS,marginTop:8,width:120}} placeholder="e.g. 0.5"/>}
      </div>
      <div style={{display:"flex",gap:10,flexDirection:mob?"column-reverse":"row"}}>
        <button onClick={()=>setOpen(false)} style={{flex:1,padding:"12px",borderRadius:10,cursor:"pointer",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>Cancel</button>
        <button disabled={!masterId||!slaveIds.length||creating}
          onClick={async()=>{
            setCreating(true);
            const master=tvAccounts.find(a=>String(a.tradovate_account_id)===String(masterId));
            const slaves=tvAccounts.filter(a=>slaveIds.includes(String(a.tradovate_account_id)));
            await onCreate(master,slaves,name,sizeMode,fixedQty,ratio,dryRun);
            setOpen(false);setMasterId("");setSlaveIds([]);setName("My Copy Group");setCreating(false);
          }}
          style={{flex:2,padding:"12px",borderRadius:10,cursor:"pointer",background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,opacity:!masterId||!slaveIds.length?0.4:1}}>
          {creating?"Creating...":"Create Group →"}
        </button>
      </div>
    </div>
  );
};

export default function TradingPlatform({ session }) {
  const user = session?.user;
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Trader";
  const userInitial = userName.charAt(0).toUpperCase();
  const handleSignOut = () => supabase.auth.signOut();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("fv_theme") !== "light");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [mobileMore, setMobileMore] = useState(false);
  const [showMobilePositions, setShowMobilePositions] = useState(false);

  // ── Plan / subscription state ─────────────────────────────────────────────
  const [profile, setProfile] = useState(null);
  const plan = profile?.plan || "basic"; // "basic" | "advanced" | "pro"
  const isPro      = plan === "pro";
  const isAdvanced = plan === "advanced" || isPro;
  const isBasic    = plan === "basic";
  // Feature gate helper — returns true if user has required plan
  const canAccess = (required) => {
    if (required === "basic")    return true;
    if (required === "advanced") return isAdvanced;
    if (required === "pro")      return isPro;
    return false;
  };

  const loadProfile = async () => {
    try {
      const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API}/profile`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (res.ok) setProfile(await res.json());
    } catch {}
  };

  const [discordPosting, setDiscordPosting] = useState(false);
  const [discordMsg,     setDiscordMsg    ] = useState("");

  const postDailyReportToDiscord = async (date) => {
    if (!profile?.discord_webhook) {
      alert("Connect Discord first in My Account → Discord Integration");
      setTab("myaccount"); return;
    }
    const dayTrades = trades.filter(t => t.trade_date === date);
    if (!dayTrades.length) { setDiscordMsg("No trades for this date"); return; }
    setDiscordPosting(true); setDiscordMsg("");
    try {
      const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const { data: { session } } = await supabase.auth.getSession();
      const acc = propAccounts.find(a=>a.id===activePropAccId) || propAccounts[0];
      const res = await fetch(`${API}/discord/report`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl: profile.discord_webhook,
          date,
          trades: dayTrades,
          propAccount: acc?.nickname || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDiscordMsg("✓ Posted to Discord!");
      setTimeout(() => setDiscordMsg(""), 4000);
    } catch(e) { setDiscordMsg("⚠ " + e.message); }
    setDiscordPosting(false);
  };
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("fv_onboarded"));
  const [onboardStep, setOnboardStep] = useState(0);
  // Alerts
  const [alerts, setAlerts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fv_alerts") || "[]"); }
    catch { return []; }
  });
  const [showAlerts, setShowAlerts] = useState(false);
  const saveAlerts = (data) => { setAlerts(data); localStorage.setItem("fv_alerts", JSON.stringify(data)); };
  const dismissAlert = (id) => saveAlerts(alerts.filter(a=>a.id!==id));
  const markAllRead = () => saveAlerts(alerts.map(a=>({...a,read:true})));
  const unreadCount = alerts.filter(a=>!a.read).length;
  const toggleTheme = () => {
    setDarkMode(d => {
      const next = !d;
      localStorage.setItem("fv_theme", next ? "dark" : "light");
      return next;
    });
  };
  C = darkMode ? DARK : LIGHT;
  // ── Tab state — persisted in URL hash ────────────────────────────────────────
  const VALID_TABS = ["dashboard","analytics","calendar","trades","edge","psychology","propfirm","news","accounts","copier","myaccount"];
  const hashTab = () => {
    const h = window.location.hash.replace("#","");
    return VALID_TABS.includes(h) ? h : "dashboard";
  };
  const [tab, setTabState] = useState(hashTab);
  const setTab = (t) => {
    setTabState(t);
    window.location.hash = t;
  };
  useEffect(() => {
    const onHash = () => setTabState(hashTab());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // ── Shared date range — used by Dashboard, Analytics, Calendar, Trades, Psychology
  // ── Timezone-safe local date helpers ─────────────────────────────────────
  // Never use .toISOString() for date strings — it converts to UTC which breaks
  // dates in UTC+ timezones (e.g. Stockholm). Always use local year/month/day.
  const localISO = (y, m, d) =>
    `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const lastDayOf = (y, m) => new Date(y, m, 0).getDate(); // m=1-12

  const getDefaultRange = () => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth()+1;
    return { from: localISO(y,m,1), to: localISO(y,m,lastDayOf(y,m)), preset:"month", year:y, month:m };
  };
  const [dateRange, setDateRange] = useState(getDefaultRange);

  // Navigate to a specific year+month
  const goToMonth = (y, m) => {
    // Wrap month overflow
    if (m < 1)  { y--; m = 12; }
    if (m > 12) { y++; m = 1; }
    setDateRange({ from: localISO(y,m,1), to: localISO(y,m,lastDayOf(y,m)), preset:"month", year:y, month:m });
  };

  const goLastMonth = () => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth(); // getMonth() = 0-based, so this is last month
    const lm = m === 0 ? 12 : m;
    const ly = m === 0 ? y-1 : y;
    setDateRange({ from: localISO(ly,lm,1), to: localISO(ly,lm,lastDayOf(ly,lm)), preset:"lastmonth", year:ly, month:lm });
  };

  const goThisMonth = () => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth()+1;
    setDateRange({ from: localISO(y,m,1), to: localISO(y,m,lastDayOf(y,m)), preset:"month", year:y, month:m });
  };

  const goAllTime = () => {
    setDateRange({ from: "2020-01-01", to: "2099-12-31", preset:"all", year:0, month:0 });
  };

  // Current display year/month (from dateRange)
  const drYear  = dateRange.year  || new Date(dateRange.from+"T12:00").getFullYear();
  const drMonth = dateRange.month || (new Date(dateRange.from+"T12:00").getMonth()+1);

  // Month label for display
  const monthDisplayLabel = dateRange.preset === "all"
    ? "All Time"
    : new Date(dateRange.from+"T12:00").toLocaleString("en-US",{month:"long",year:"numeric"});

  // Shared month navigation bar used on Dashboard, Analytics, Trades
  const renderMonthNav = () => (
    <div style={{display:"flex",alignItems:"center",gap:isMobile?4:6,flexWrap:"wrap",justifyContent:isMobile?"center":"flex-start"}}>
      <button onClick={()=>goToMonth(drYear, drMonth-1)}
        style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:isMobile?"5px 10px":"6px 14px",cursor:"pointer",color:C.textDim,fontFamily:"'Space Mono',monospace",fontSize:14,lineHeight:1}}>←</button>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:isMobile?"5px 10px":"6px 16px",fontFamily:"'Space Mono',monospace",fontSize:isMobile?10:11,color:C.text,minWidth:isMobile?100:130,textAlign:"center"}}>
        {monthDisplayLabel}
      </div>
      <button onClick={()=>goToMonth(drYear, drMonth+1)}
        style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:isMobile?"5px 10px":"6px 14px",cursor:"pointer",color:C.textDim,fontFamily:"'Space Mono',monospace",fontSize:14,lineHeight:1}}>→</button>
      {!isMobile && <>
        <button onClick={goThisMonth}
          style={{background:dateRange.preset==="month"&&drYear===new Date().getFullYear()&&drMonth===new Date().getMonth()+1?C.accentDim:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.textDim}}>
          This month
        </button>
        <button onClick={goLastMonth}
          style={{background:dateRange.preset==="lastmonth"?C.accentDim:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.textDim}}>
          Last month
        </button>
        <button onClick={goAllTime}
          style={{background:dateRange.preset==="all"?C.accentDim:C.card,border:`1px solid ${dateRange.preset==="all"?C.accent+"55":C.border}`,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:dateRange.preset==="all"?C.accent:C.textDim,fontWeight:dateRange.preset==="all"?700:400}}>
          All time
        </button>
      </>}
      {isMobile && (
        <button onClick={goAllTime}
          style={{background:dateRange.preset==="all"?C.accentDim:C.card,border:`1px solid ${dateRange.preset==="all"?C.accent+"55":C.border}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:dateRange.preset==="all"?C.accent:C.textDim,fontWeight:dateRange.preset==="all"?700:400}}>
          All
        </button>
      )}
    </div>
  );

  const [selTrade,   setSelTrade  ] = useState(null);
  const [showRules,  setShowRules ] = useState(false);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [showImportCSV, setShowImportCSV] = useState(false);
  const [showExport,    setShowExport   ] = useState(false);
  // Edge Library state
  const [edges, setEdges] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fv_edges") || "[]"); }
    catch { return []; }
  });
  const [showEdgeModal, setShowEdgeModal] = useState(false);
  const [editingEdge, setEditingEdge] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const saveEdges = (data) => { setEdges(data); localStorage.setItem("fv_edges", JSON.stringify(data)); };
  const [newTradeForm, setNewTradeForm] = useState({
    symbol:"NQ", contractType:"standard", side:"Long",
    trade_date: (() => { const _n=new Date(); return `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}-${String(_n.getDate()).padStart(2,'0')}`; })(),
    contracts:"1", entry:"", exit:"", entryPrice:"", exitPrice:"",
    pnl:"", rr:"", tags:[], review:"", rating:0, screenshot:null,
  });
  const [trades,     setTrades    ] = useState([]);
  const [rules, setRules] = useState(() => {
    try {
      const saved = localStorage.getItem("fv_rules");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_RULES;
  });
  const [habits,     setHabits    ] = useState(DEFAULT_HABITS);
  const [mood,       setMood      ] = useState(0);
  const [hChecks,    setHChecks   ] = useState({});
  const [note,       setNote      ] = useState("");
  const [newHabit,   setNewHabit  ] = useState("");
  const [firms,      setFirms     ] = useState(DEFAULT_PROP_FIRMS);
  const [activeFirm, setActiveFirm] = useState("mffu");
  // ── User's configured prop accounts ──────────────────────────────────────
  const [propAccounts, setPropAccounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fv_prop_accounts") || "[]"); }
    catch { return []; }
  });
  const [activePropAccId, setActivePropAccId] = useState(() =>
    localStorage.getItem("fv_active_prop_acc") || null
  );
  const [showPropWizard, setShowPropWizard] = useState(false);
  const [wizardStep,     setWizardStep    ] = useState(1); // 1=firm, 2=type, 3=balance
  const [wizardFirmId,   setWizardFirmId  ] = useState(null);
  const [wizardTypeId,   setWizardTypeId  ] = useState(null);
  const [wizardBalance,  setWizardBalance ] = useState("");
  const [wizardNickname, setWizardNickname] = useState("");
  const [editingPropAcc, setEditingPropAcc] = useState(null);

  const savePropAccounts = (data) => {
    setPropAccounts(data);
    localStorage.setItem("fv_prop_accounts", JSON.stringify(data));
  };
  const setActivePropAccount = (id) => {
    setActivePropAccId(id);
    localStorage.setItem("fv_active_prop_acc", id || "");
    const acc = propAccounts.find(a=>a.id===id);
    if (acc) { setActiveFirm(acc.firmId); setFirmAccountType(acc.firmId, acc.typeId); }
  };
  const addPropAccount = () => {
    if (!wizardFirmId || !wizardTypeId) return;
    const bal = parseFloat(wizardBalance) || DEFAULT_PROP_FIRMS.find(f=>f.id===wizardFirmId)?.accountTypes.find(t=>t.id===wizardTypeId)?.accountSize || 50000;
    const firm = DEFAULT_PROP_FIRMS.find(f=>f.id===wizardFirmId);
    const type = firm?.accountTypes.find(t=>t.id===wizardTypeId);
    const newAcc = {
      id: Date.now().toString(),
      firmId: wizardFirmId,
      typeId: wizardTypeId,
      startBalance: bal,
      nickname: wizardNickname.trim() || `${firm?.name} ${type?.label}`,
      addedAt: new Date().toISOString(),
    };
    const updated = editingPropAcc
      ? propAccounts.map(a => a.id===editingPropAcc ? {...newAcc, id:editingPropAcc} : a)
      : [...propAccounts, newAcc];
    savePropAccounts(updated);
    // Set active account directly — don't rely on setActivePropAccount which reads stale propAccounts
    const targetId = editingPropAcc || newAcc.id;
    setActivePropAccId(targetId);
    localStorage.setItem("fv_active_prop_acc", targetId);
    setActiveFirm(wizardFirmId);
    setFirmAccountType(wizardFirmId, wizardTypeId);
    setShowPropWizard(false);
    setWizardStep(1); setWizardFirmId(null); setWizardTypeId(null);
    setWizardBalance(""); setWizardNickname(""); setEditingPropAcc(null);
  };
  const [tagFilter,  setTagFilter ] = useState("All");
  const [symbolFilter, setSymbolFilter] = useState("All");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [newRule,    setNewRule   ] = useState({label:"",type:"loss",value:""});
  const [econFilter, setEconFilter] = useState("all");
  const [calendarEvents, setCalendarEvents] = useState([]); // shared with AddTradeModal for blocker
  const [newsBlocker, setNewsBlocker] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fv_newsblocker") || '{"enabled":true,"impact":"high","before":5,"after":5}'); }
    catch { return {enabled:true, impact:"high", before:5, after:5}; }
  });
  const saveNewsBlocker = (val) => {
    setNewsBlocker(val);
    localStorage.setItem("fv_newsblocker", JSON.stringify(val));
  };

  // ── Trade Copier state ─────────────────────────────────────────────────────
  const [copierGroups,  setCopierGroups  ] = useState([]);
  const [copierLoading, setCopierLoading ] = useState(false);
  const [activeGroupId, setActiveGroupId ] = useState(null);
  const [showCopierOnboarding, setShowCopierOnboarding] = useState(() => {
    try { return !localStorage.getItem("fv_copier_onboarded"); } catch { return true; }
  });
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddGroup,   setShowAddGroup  ] = useState(false);
  const [newAcctForm,    setNewAcctForm   ] = useState({ name:"", firm:"mffu", accountSize:"50000", username:"", password:"", accountId:"" });
  const [newGroupForm,   setNewGroupForm  ] = useState({ name:"", accountIds:[] });
  const [editGroupId,    setEditGroupId   ] = useState(null);
  const [copierEnabled,  setCopierEnabled ] = useState(false);
  // Tradovate-konton anslutna i Accounts-fliken
  const [tvAccounts,     setTvAccounts    ] = useState([]);
  const [showTvLogin,    setShowTvLogin   ] = useState(false);
  const [tvLoginForm,    setTvLoginForm   ] = useState({username:"",password:"",cid:"",secret:""});
  const [tvLoginLoading, setTvLoginLoading] = useState(false);
  const [tvLoginError,   setTvLoginError  ] = useState("");
  const [tvLoginStep,    setTvLoginStep   ] = useState("credentials"); // "credentials" | "select_account"
  const [tvLoginAccounts,setTvLoginAccounts]=useState([]); // konton att välja bland efter login
  const [copierStatus,   setCopierStatus  ] = useState(null); // live backend status
  const [copierLog,      setCopierLog     ] = useState([]);

  // ── Copier backend helpers ──────────────────────────────────────────────────
  const copierFetch = async (path, method = "GET", body = null) => {
    const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
    const { data: { session } } = await supabase.auth.getSession();
    const opts = { method, headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${API}${path}`, opts);
    if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error || r.status); }
    return r.json();
  };

  const loadCopierGroups = async () => {
    setCopierLoading(true);
    try {
      const groups = await copierFetch("/copier/groups");
      setCopierGroups(groups || []);
      // Set active group if any is running
      const active = (groups || []).find(g => g.running);
      if (active) setActiveGroupId(active.id);
    } catch(e) { console.error("[Copier] load error:", e.message); }
    setCopierLoading(false);
  };

  // Load copier groups when tab is opened
  useEffect(() => {
    if (tab === "copier") loadCopierGroups();
  }, [tab]);

  const startCopierBackend = async (group) => {
    try {
      const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${API}/copier/groups/${group.id}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActiveGroupId(group.id);
      setCopierEnabled(true);
      await loadCopierGroups();
    } catch (err) {
      alert("Could not start copier: " + err.message);
    }
  };

  const stopCopierBackend = async (groupId) => {
    try {
      await copierFetch(`/copier/groups/${groupId}/stop`, "POST");
      setActiveGroupId(null);
      setCopierEnabled(false);
      await loadCopierGroups();
    } catch(e) { alert("Could not stop copier: " + e.message); }
  };

  const createCopierGroup = async (masterAccount, slaveAccounts, name, sizeMode, fixedQty, ratio, dryRun) => {
    try {
      const group = await copierFetch("/copier/groups", "POST", {
        name,
        master_account_id:   masterAccount.tradovate_account_id,
        master_account_name: masterAccount.display_name || masterAccount.account_spec,
        slave_account_ids:   slaveAccounts.map(a => a.tradovate_account_id),
        slave_account_names: slaveAccounts.map(a => a.display_name || a.account_spec),
        size_mode: sizeMode || "mirror",
        fixed_qty: fixedQty || 1,
        ratio: ratio || 1.0,
        dry_run: dryRun === true,
      });
      await loadCopierGroups();
      return group;
    } catch(e) { alert("Could not create group: " + e.message); }
  };

  const deleteCopierGroup = async (groupId) => {
    if (!confirm("Delete this group?")) return;
    try {
      await copierFetch(`/copier/groups/${groupId}`, "DELETE");
      await loadCopierGroups();
    } catch(e) { alert("Could not delete group: " + e.message); }
  };

  const loadCopierLog = async (groupId) => {
    try {
      const log = await copierFetch(`/copier/groups/${groupId}/log?limit=30`);
      setCopierLog(Array.isArray(log) ? log : []);
    } catch(e) { console.error("[Copier] log error:", e.message); }
  };

  // Poll groups every 10s when copier is active to refresh stats
  useEffect(() => {
    if (!copierEnabled) return;
    const interval = setInterval(loadCopierGroups, 10000);
    return () => clearInterval(interval);
  }, [copierEnabled]);

  const setActiveGroup = (id) => setActiveGroupId(id);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [syncingTV,     setSyncingTV    ] = useState(false);
  const [tvStatus,         setTvStatus        ] = useState(null);
  const [appMode,          setAppMode         ] = useState(() =>
    localStorage.getItem("edgestat_mode") || "live"
  ); // "live" | "demo"

  const toggleMode = () => {
    const next = appMode === "demo" ? "live" : "demo";
    setAppMode(next);
    localStorage.setItem("edgestat_mode", next);
  };
  const isDemo = appMode === "demo";
  // startBalances: manuellt inmatad startbalans per firm (sparas i localStorage)
  const [startBalances,    setStartBalances   ] = useState(() => {
    try { return JSON.parse(localStorage.getItem("edgestat_startbal") || "{}"); }
    catch { return {}; }
  });
  const [editingBalance,   setEditingBalance  ] = useState(null); // firmId under redigering
  const [editBalVal,       setEditBalVal      ] = useState("");
  const [liveAcctData,     setLiveAcctData    ] = useState(null); // Tradovate live-data när anslutet

  // ── Load trades from API ───────────────────────────────────────────────────
  // ── Load trades from API ───────────────────────────────────────────────────
  const loadTrades = useCallback(async () => {
    setLoadingTrades(true);
    if (localStorage.getItem("edgestat_mode") === "demo") {
      const dates = Array.from({length:20},(_,i)=>{
        const d = new Date(); d.setDate(d.getDate()-Math.floor(i*1.4));
        while(d.getDay()===0||d.getDay()===6) d.setDate(d.getDate()-1);
        return d.toISOString().slice(0,10);
      });
      const demoTrades = [
        {id:1, symbol:"NQ",  side:"Long",  entry:"09:32",exit:"09:47",pnl:820,  rr:2.1,status:"win", tags:["Kill Zone","Displacement","mffu"],   rating:5,checks:{},review:"Perfect execution on AM kill zone.",screenshot:null,holdMin:15,trade_date:dates[0]},
        {id:2, symbol:"ES",  side:"Short", entry:"10:15",exit:"10:28",pnl:-180, rr:-0.9,status:"loss",tags:["FOMO","tradeify"],                   rating:2,checks:{},review:"Chased the move.",screenshot:null,holdMin:13,trade_date:dates[0]},
        {id:3, symbol:"NQ",  side:"Long",  entry:"11:02",exit:"11:19",pnl:1250, rr:3.2,status:"win", tags:["Kill Zone","FVG","mffu"],             rating:5,checks:{},review:"",screenshot:null,holdMin:17,trade_date:dates[1]},
        {id:4, symbol:"NQ",  side:"Short", entry:"13:45",exit:"14:01",pnl:610,  rr:1.5,status:"win", tags:["OB","Displacement","lucid"],          rating:4,checks:{},review:"",screenshot:null,holdMin:16,trade_date:dates[1]},
        {id:5, symbol:"ES",  side:"Long",  entry:"14:30",exit:"14:43",pnl:-90,  rr:-0.4,status:"loss",tags:["Revenge","tradeify"],               rating:1,checks:{},review:"",screenshot:null,holdMin:13,trade_date:dates[2]},
        {id:6, symbol:"NQ",  side:"Long",  entry:"09:15",exit:"09:38",pnl:1640, rr:4.1,status:"win", tags:["Kill Zone","Displacement","mffu"],   rating:5,checks:{},review:"",screenshot:null,holdMin:23,trade_date:dates[2]},
        {id:7, symbol:"NQ",  side:"Short", entry:"15:45",exit:"15:58",pnl:-320, rr:-1.6,status:"loss",tags:["FOMO","Late entry","lucid"],        rating:1,checks:{},review:"",screenshot:null,holdMin:13,trade_date:dates[3]},
        {id:8, symbol:"ES",  side:"Long",  entry:"09:48",exit:"10:05",pnl:1080, rr:2.7,status:"win", tags:["Kill Zone","FVG","tradeify"],        rating:4,checks:{},review:"",screenshot:null,holdMin:17,trade_date:dates[3]},
        {id:9, symbol:"NQ",  side:"Long",  entry:"10:30",exit:"10:44",pnl:760,  rr:1.9,status:"win", tags:["OB","mffu"],                        rating:4,checks:{},review:"",screenshot:null,holdMin:14,trade_date:dates[4]},
        {id:10,symbol:"ES",  side:"Short", entry:"13:00",exit:"13:12",pnl:-150, rr:-0.7,status:"loss",tags:["Revenge","Late entry","lucid"],     rating:2,checks:{},review:"",screenshot:null,holdMin:12,trade_date:dates[4]},
      ];
      setTrades(demoTrades);
      setLoadingTrades(false);
      return;
    }
    try {
      const data = await tradesApi.list();
      setTrades(data.map(t => {
        // Format ISO timestamp → "HH:MM" for display
        const fmtTime = (iso) => {
          if (!iso) return null;
          try {
            // Parse as UTC, display in local time
            const d = new Date(iso);
            if (isNaN(d)) return iso; // already "HH:MM" format
            return d.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", hour12:false });
          } catch { return iso; }
        };

        // Auto-calculate RR from entry/exit/stop if rr is 0 or missing
        // RR = pnl / (entry - stop) * contracts — but we don't store stop
        // Best estimate: RR = pnl / (avg_loss_for_symbol) — fallback: pnl / tickValue
        // Simple approach: if pnl & entry_price & exit_price exist, calc risk from move
        const calcRR = (t) => {
          if (t.rr && t.rr !== 0) return t.rr; // already set manually
          if (!t.entry_price || !t.exit_price || !t.pnl) return 0;
          const move = Math.abs(t.exit_price - t.entry_price);
          if (!move) return 0;
          // RR needs a stop — we can't know stop from fills alone
          // Store 0, let user fill it in manually in the review modal
          return 0;
        };

        const entryTime = fmtTime(t.entry_time);
        const exitTime  = fmtTime(t.exit_time);

        // Hold time from timestamps if hold_min is 0
        const holdMin = (() => {
          if (t.hold_min && t.hold_min > 0) return t.hold_min;
          if (t.entry_time && t.exit_time) {
            const diff = Math.abs(new Date(t.exit_time) - new Date(t.entry_time)) / 60000;
            return Math.round(diff);
          }
          return 0;
        })();

        return {
          id:           t.id,
          symbol:       t.symbol,
          side:         t.side,
          entry:        entryTime,
          exit:         exitTime,
          entry_time:   t.entry_time,   // keep raw ISO for chart/replay
          exit_time:    t.exit_time,
          entry_price:  t.entry_price,
          exit_price:   t.exit_price,
          pnl:          t.pnl,
          rr:           calcRR(t),
          holdMin,
          status:       t.pnl >= 0 ? "win" : "loss",
          tags:         t.tags || [],
          rating:       t.rating || 0,
          review:       t.review || "",
          screenshot:   t.screenshot || null,
          checks:       t.rule_checks || {},
          trade_date:   t.trade_date,
          source:       t.source,
          external_id:  t.external_id,
          asset_type:   t.asset_type || "Futures",
        };
      }));
    } catch (err) {
      console.error("Failed to load trades:", err);
      setTrades([]);
    }
    setLoadingTrades(false);
  }, []);

  // ── Auto-generate alerts ───────────────────────────────────────────────────
  useEffect(() => {
    if (!trades.length && !propAccounts.length) return;
    const newAlerts = [];
    const now = new Date();
    const today = (() => { const _n=now; return `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}-${String(_n.getDate()).padStart(2,'0')}`; })();
    const todayTrades = trades.filter(t=>t.trade_date===today);
    const todayPnl = todayTrades.reduce((a,t)=>a+t.pnl,0);

    propAccounts.forEach(pa => {
      const firm = firms.find(f=>f.id===pa.firmId);
      const type = firm?.accountTypes.find(t=>t.id===pa.typeId);
      if (!firm || !type) return;

      const dlRule = type.rules.find(r=>r.type==="loss");
      const ddRule = type.rules.find(r=>r.type==="drawdown");
      const csRule = type.rules.find(r=>r.type==="consist");
      const ptRule = type.rules.find(r=>r.type==="target");

      const firmTrades = trades.filter(t=>(t.tags||[]).includes(pa.firmId)||trades.every(x=>!(x.tags||[]).some(tag=>["mffu","lucid","alpha","tpt","tradeify","apex","topstep"].includes(tag))));
      const startBal = pa.startBalance || 50000;
      const cumPnl = firmTrades.reduce((a,t)=>a+t.pnl,0);
      const balance = startBal + cumPnl;
      const pnlByDay = {};
      firmTrades.forEach(t=>{pnlByDay[t.trade_date]=(pnlByDay[t.trade_date]||0)+t.pnl;});
      const cycleProfit = cumPnl;
      const winDays = Object.values(pnlByDay).filter(p=>p>0).length;
      const bestDay = Math.max(0,...Object.values(pnlByDay).filter(p=>p>0));
      const bestDayPct = cycleProfit>0 ? Math.round((bestDay/cycleProfit)*100) : 0;

      const makeId = (type) => `${pa.id}-${type}-${today}`;

      // Daily loss limit warning
      if (dlRule && todayPnl < 0) {
        const used = Math.abs(todayPnl);
        const pct = used/dlRule.value;
        if (pct >= 1 && !alerts.find(a=>a.id===makeId("dll-breach"))) {
          newAlerts.push({id:makeId("dll-breach"),type:"danger",icon:"🔴",title:`Daily loss limit breached — ${pa.nickname}`,body:`You've lost $${Math.abs(Math.round(todayPnl)).toLocaleString()} today, exceeding the $${dlRule.value.toLocaleString()} limit. Trading may be suspended.`,read:false,ts:Date.now()});
        } else if (pct >= 0.75 && pct < 1 && !alerts.find(a=>a.id===makeId("dll-warn"))) {
          newAlerts.push({id:makeId("dll-warn"),type:"warning",icon:"⚠️",title:`Approaching daily loss limit — ${pa.nickname}`,body:`$${Math.abs(Math.round(todayPnl)).toLocaleString()} of $${dlRule.value.toLocaleString()} daily limit used (${Math.round(pct*100)}%). Consider stopping for today.`,read:false,ts:Date.now()});
        }
      }

      // Payout ready
      if (ptRule && cycleProfit >= ptRule.value && winDays >= (type.payout?.minDays||5)) {
        const po = type.payout;
        const noConsist = po?.consistency>=900;
        const consistOk = noConsist || bestDayPct <= (po?.consistency||40);
        if (consistOk && !alerts.find(a=>a.id===makeId("payout-ready"))) {
          newAlerts.push({id:makeId("payout-ready"),type:"success",icon:"🎉",title:`Payout ready — ${pa.nickname}`,body:`All conditions met on your ${firm.name} account. Estimated payout: $${Math.round(cycleProfit*(type.payoutSplit/100)).toLocaleString()} after ${type.payoutSplit}% split.`,read:false,ts:Date.now()});
        }
      }

      // Consistency warning
      if (csRule && csRule.value<900 && bestDayPct >= csRule.value*0.85 && cycleProfit>0) {
        if (!alerts.find(a=>a.id===makeId("consist-warn"))) {
          newAlerts.push({id:makeId("consist-warn"),type:"warning",icon:"📊",title:`Consistency rule at risk — ${pa.nickname}`,body:`Your best day is ${bestDayPct}% of cycle profit. The limit is ${csRule.value}%. Avoid large single-day gains this cycle.`,read:false,ts:Date.now()});
        }
      }

      // Drawdown warning
      if (ddRule) {
        const sorted = [...firmTrades].sort((a,b)=>a.trade_date?.localeCompare(b.trade_date));
        let peak=startBal,cum=0;
        sorted.forEach(t=>{cum+=t.pnl;if(startBal+cum>peak)peak=startBal+cum;});
        const dd = peak - balance;
        const ddPct = dd/ddRule.value;
        if (ddPct>=1 && !alerts.find(a=>a.id===makeId("dd-breach"))) {
          newAlerts.push({id:makeId("dd-breach"),type:"danger",icon:"🔴",title:`Max drawdown reached — ${pa.nickname}`,body:`Your drawdown of $${Math.round(dd).toLocaleString()} has hit the $${ddRule.value.toLocaleString()} limit. Account may be at risk.`,read:false,ts:Date.now()});
        } else if (ddPct>=0.75 && ddPct<1 && !alerts.find(a=>a.id===makeId("dd-warn"))) {
          newAlerts.push({id:makeId("dd-warn"),type:"warning",icon:"⚠️",title:`Drawdown warning — ${pa.nickname}`,body:`$${Math.round(dd).toLocaleString()} of $${ddRule.value.toLocaleString()} max drawdown used (${Math.round(ddPct*100)}%).`,read:false,ts:Date.now()});
        }
      }
    });

    // Revenge trading detection
    const recentLosses = todayTrades.filter(t=>t.pnl<0).length;
    const recentTotal  = todayTrades.length;
    if (recentTotal >= 3 && recentLosses >= 3) {
      const rid = `revenge-${today}`;
      if (!alerts.find(a=>a.id===rid)) {
        newAlerts.push({id:rid,type:"warning",icon:"🧠",title:"Possible revenge trading detected",body:`You've taken ${recentTotal} trades today with ${recentLosses} losses. Consider stepping away and reviewing your psychology check-in.`,read:false,ts:Date.now()});
      }
    }

    // Psychology check-in reminder (after 9am if not checked in)
    if (now.getHours() >= 9 && !Object.values(hChecks).some(Boolean) && mood === 0) {
      const pid = `checkin-${today}`;
      if (!alerts.find(a=>a.id===pid)) {
        newAlerts.push({id:pid,type:"info",icon:"📋",title:"Daily check-in not completed",body:"You haven't completed your psychology check-in today. Head to the Psychology tab to log your mood and habits before trading.",read:false,ts:Date.now()});
      }
    }

    if (newAlerts.length > 0) {
      saveAlerts(prev => {
        const merged = [...(Array.isArray(prev) ? prev : []), ...newAlerts].slice(-50);
        localStorage.setItem("fv_alerts", JSON.stringify(merged));
        return merged;
      });
    }
  }, [trades, propAccounts, mood, hChecks]);
  // ── Load rules, habits, check-in, tradovate status on mount ───────────────
  useEffect(() => {
    loadTrades();
    loadProfile();
    rulesApi.list().then(data => {
      if (data?.length) {
        const r = data.map(r => r.label);
        setRules(r);
        localStorage.setItem("fv_rules", JSON.stringify(r));
      }
    }).catch(()=>{});
    psychApi.habits().then(data => { if (data?.length) setHabits(data); }).catch(()=>{});
    const today = (() => { const _n=new Date(); return `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}-${String(_n.getDate()).padStart(2,'0')}`; })();
    psychApi.checkins({from:today,to:today}).then(data => {
      if (data?.[0]) { setMood(data[0].mood||0); setHChecks(data[0].habits||{}); setNote(data[0].note||""); }
      else {
        // Fallback: load from localStorage
        try {
          const saved = JSON.parse(localStorage.getItem("fv_checkins")||"{}")[today];
          if (saved) { setMood(saved.mood||0); setHChecks(saved.habits||{}); setNote(saved.note||""); }
        } catch {}
      }
    }).catch(()=>{
      // API failed — load from localStorage
      try {
        const saved = JSON.parse(localStorage.getItem("fv_checkins")||"{}")[today];
        if (saved) { setMood(saved.mood||0); setHChecks(saved.habits||{}); setNote(saved.note||""); }
      } catch {}
    });
    // Hämta sparade Tradovate-konton
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
    if (localStorage.getItem("edgestat_mode") === "demo") {
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

  // ── Save trade (create or update) ─────────────────────────────────────────
  const saveTrade = async (updated) => {
    // Demo mode — update local state only, no API call
    if (isDemo) {
      setTrades(tt => {
        const exists = tt.find(t => t.id === updated.id);
        if (exists) return tt.map(t => t.id === updated.id ? {...t, ...updated} : t);
        return [{...updated, id: Date.now()}, ...tt];
      });
      setSelTrade(null);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) throw new Error("Not authenticated");

    const payload = {
      user_id:     userId,
      symbol:      updated.symbol,
      side:        updated.side,
      // Use raw ISO timestamps — not the formatted HH:MM display strings
      entry_time:  updated.entry_time || null,
      exit_time:   updated.exit_time  || null,
      entry_price: updated.entry_price || null,
      exit_price:  updated.exit_price  || null,
      pnl:         updated.pnl,
      rr:          updated.rr || 0,
      hold_min:    updated.holdMin || 0,
      tags:        updated.tags || [],
      rating:      updated.rating || 0,
      review:      updated.review || "",
      screenshot:  updated.screenshot || null,
      rule_checks: updated.checks || {},
      trade_date:  updated.trade_date || new Date().toISOString().slice(0,10),
      asset_type:  updated.asset_type || "Futures",
    };
    const isRealId = typeof updated.id === "string"
      && updated.id.includes("-")
      && !updated.id.startsWith("new-")
      && !updated.id.startsWith("csv-");
    if (isRealId) { await tradesApi.update(updated.id, payload); }
    else          { await tradesApi.create(payload); }
    await loadTrades();
    setSelTrade(null);
  };

  // ── Delete trade ──────────────────────────────────────────────────────────
  const deleteTrade = async (id) => {
    if (isDemo) {
      setTrades(tt => tt.filter(t => t.id !== id));
      return;
    }
    const isRealId = typeof id === "string" && id.includes("-") && !id.startsWith("new-") && !id.startsWith("csv-");
    if (isRealId) {
      try {
        // Try tradesApi first, fall back to direct fetch
        if (typeof tradesApi.delete === "function") {
          await tradesApi.delete(id);
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
          await fetch(`${API}/trades/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });
        }
      } catch(e) { console.error("Delete failed:", e); return; }
    }
    setTrades(tt => tt.filter(t => t.id !== id));
  };
  const syncTradovate = async () => {
    setSyncingTV(true);
    try {
      const result = await tradovateApi.sync();
      if (result?.synced > 0) {
        await loadTrades();
        alert(`✅ Synced ${result.synced} new trade${result.synced===1?"":"s"}!`);
      } else {
        await loadTrades(); // reload anyway in case data changed
        // Silent — no popup if nothing new
      }
    } catch (err) { alert("Sync failed: " + err.message); }
    setSyncingTV(false);
  };

  // Global SSE stream listener — forwards events to components via window events
  useEffect(() => {
    if (isDemo || !tvStatus?.connected) return;
    let es;
    let retryDelay = 5000;
    let retryTimer;

    const connect = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
        es = new EventSource(`${API}/tradovate/stream?token=${session.access_token}`);
        retryDelay = 5000; // reset backoff on success

        es.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.type === "positions" || msg.type === "fill") {
              window.dispatchEvent(new CustomEvent("fv:positions_updated"));
            }
            if (msg.type === "trade_saved") {
              loadTrades();
              window.dispatchEvent(new CustomEvent("fv:trade_saved", {
                detail: { pnl: msg.pnl, symbol: msg.symbol }
              }));
            }
          } catch {}
        };
        es.onerror = () => {
          es?.close();
          // Exponential backoff: 5s → 10s → 20s → max 60s
          retryDelay = Math.min(retryDelay * 2, 60000);
          retryTimer = setTimeout(connect, retryDelay);
        };
      } catch {}
    };

    connect();
    return () => { es?.close(); clearTimeout(retryTimer); };
  }, [isDemo, tvStatus?.connected]);

  // Listen for real-time trade_saved events from Tradovate stream
  useEffect(() => {
    const handler = (e) => {
      loadTrades();
      // Brief toast notification
      const pnl    = e.detail?.pnl;
      const symbol = e.detail?.symbol || "trade";
      const msg    = pnl != null
        ? `⚡ Live trade saved: ${symbol} ${pnl >= 0 ? "+" : ""}$${pnl}`
        : "⚡ New live trade saved";
      const toast = document.createElement("div");
      toast.textContent = msg;
      Object.assign(toast.style, {
        position:"fixed", bottom:"24px", left:"50%", transform:"translateX(-50%)",
        background: pnl >= 0 ? "#00d084" : "#ff3d5a", color:"#fff",
        padding:"10px 20px", borderRadius:"8px", fontSize:"14px",
        fontWeight:"600", zIndex:"99999", boxShadow:"0 4px 20px #0006",
        transition:"opacity .4s",
      });
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = "0"; setTimeout(() => toast.remove(), 400); }, 3000);
    };
    window.addEventListener("fv:trade_saved", handler);
    return () => window.removeEventListener("fv:trade_saved", handler);
  }, [loadTrades]);

  // ── Save check-in ──────────────────────────────────────────────────────────
  const [checkinSaved, setCheckinSaved] = useState(false);
  const saveCheckin = () => {
    const today = (() => { const _n=new Date(); return `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}-${String(_n.getDate()).padStart(2,'0')}`; })();
    // Always save to localStorage first — reliable regardless of API
    const checkins = JSON.parse(localStorage.getItem("fv_checkins")||"{}");
    checkins[today] = { mood, note, habits: hChecks, savedAt: new Date().toISOString() };
    localStorage.setItem("fv_checkins", JSON.stringify(checkins));
    // Also try API in background
    psychApi.saveCheckin({ check_date: today, mood, note, habits: hChecks }).catch(()=>{});
    setCheckinSaved(true);
    setTimeout(() => setCheckinSaved(false), 3000);
  };

  // Get active firm object and its currently selected account type
  const firm      = firms.find(f=>f.id===activeFirm);
  const acctType  = firm.accountTypes.find(t=>t.id===firm.activeType) || firm.accountTypes[0];
  // Active prop account from user's configured accounts
  const activePropAcc = propAccounts.find(a=>a.id===activePropAccId) || propAccounts[0] || null;
  // ── Beräkna prop firm-data från riktiga trades (Alt 1) ──────────────────────
  // Om Tradovate är anslutet och har live-data används den istället (Alt 2)
  const acct = (() => {
    // Alt 2: Tradovate live-data (när anslutet)
    if (liveAcctData?.[activeFirm]) return liveAcctData[activeFirm];

    // Alt 1: Beräkna från loggade trades
    const firmTrades = trades.filter(t => (t.tags||[]).includes(activeFirm) ||
      // fallback: alla trades om ingen firm-taggning finns
      trades.every(x => !(x.tags||[]).some(tag => ["mffu","lucid","alpha","tpt","tradeify"].includes(tag)))
    );

    const startBalance = startBalances[activeFirm] || 50000;
    const today = (() => { const _n=new Date(); return `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}-${String(_n.getDate()).padStart(2,'0')}`; })();
    const todayTrades = firmTrades.filter(t => t.trade_date === today);
    const todayPnl = todayTrades.reduce((a,t) => a+t.pnl, 0);

    // Bygg equity curve för att hitta peak
    const sorted = [...firmTrades].sort((a,b) => a.trade_date?.localeCompare(b.trade_date));
    let cumPnl = 0, peakPnl = 0;
    sorted.forEach(t => { cumPnl += t.pnl; if (cumPnl > peakPnl) peakPnl = cumPnl; });
    const balance = startBalance + cumPnl;
    const peakBalance = startBalance + peakPnl;

    // Trading days = unika dagar med trades
    const tradingDays = new Set(firmTrades.map(t => t.trade_date).filter(Boolean)).size;

    // Win days = dagar med positivt netto-P&L
    const pnlByDay = {};
    firmTrades.forEach(t => { pnlByDay[t.trade_date] = (pnlByDay[t.trade_date]||0) + t.pnl; });
    const cycleWinDays = Object.values(pnlByDay).filter(p => p > 0).length;

    // Cycle profit = total P&L
    const cycleProfit = Math.round(cumPnl);

    // Best day % av total cycle profit (för consistency-regeln)
    const bestDayPnl = cycleWinDays ? Math.max(...Object.values(pnlByDay).filter(p => p > 0)) : 0;
    const bestDayPct = cycleProfit > 0 ? Math.round((bestDayPnl / cycleProfit) * 100) : 0;

    return { balance, startBalance, peakBalance, todayPnl: Math.round(todayPnl),
             tradingDays, cycleProfit, cycleWinDays, bestDayPct };
  })();

  // Helper: switch account type for active firm
  const setFirmAccountType = (firmId, typeId) => {
    setFirms(ff => ff.map(f => f.id===firmId ? {...f, activeType:typeId} : f));
  };

  const rangedTrades = trades.filter(t =>
    (!t.trade_date || (t.trade_date >= dateRange.from && t.trade_date <= dateRange.to))
  );

  const rangeLabel = (() => {
    if (dateRange.preset === "week")      return "This week";
    if (dateRange.preset === "month")     return new Date(dateRange.from+"T12:00").toLocaleString("en-US",{month:"long",year:"numeric"});
    if (dateRange.preset === "lastmonth") return "Last month";
    if (dateRange.preset === "year")      return new Date(dateRange.from).getFullYear().toString();
    if (dateRange.preset === "all")       return "All time";
    const fmt = d => new Date(d+"T12:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
    return `${fmt(dateRange.from)} – ${fmt(dateRange.to)}`;
  })();

  const filteredTrades = rangedTrades.filter(t => {
    const tagOk = tagFilter === "All" || (t.tags||[]).includes(tagFilter);
    const symOk = symbolFilter === "All" || t.symbol === symbolFilter;
    return tagOk && symOk;
  });
  const allSymbols = [...new Set(rangedTrades.map(t=>t.symbol).filter(Boolean))].sort();

  // ── Stats computed from ranged trades (respects date range picker) ───────────
  const wins     = rangedTrades.filter(d=>d.pnl>0).length;
  const losses   = rangedTrades.filter(d=>d.pnl<0).length;
  const winRate  = rangedTrades.length ? Math.round((wins/rangedTrades.length)*100) : 0;

  const maxDD = (() => {
    if (!rangedTrades.length) return 0;
    const sorted = [...rangedTrades].sort((a,b) => a.trade_date?.localeCompare(b.trade_date));
    let peak = 0, cumPnl = 0, maxDrop = 0;
    sorted.forEach(t => {
      cumPnl += t.pnl;
      if (cumPnl > peak) peak = cumPnl;
      const drop = peak - cumPnl;
      if (drop > maxDrop) maxDrop = drop;
    });
    return Math.round(maxDrop);
  })();
  const totalPnl = rangedTrades.reduce((a,b)=>a+b.pnl,0);
  const avgWin   = wins   ? Math.round(rangedTrades.filter(d=>d.pnl>0).reduce((a,b)=>a+b.pnl,0)/wins)   : 0;
  const avgLoss  = losses ? Math.round(Math.abs(rangedTrades.filter(d=>d.pnl<0).reduce((a,b)=>a+b.pnl,0)/losses)) : 0;
  const avgRR    = rangedTrades.length ? (rangedTrades.reduce((a,b)=>a+(b.rr||0),0)/rangedTrades.length).toFixed(1) : null;

  const pnlByDate = {};
  rangedTrades.forEach(t => { pnlByDate[t.trade_date] = (pnlByDate[t.trade_date]||0) + t.pnl; });
  const LIVE_PNL_DATA = Object.entries(pnlByDate).sort(([a],[b])=>a.localeCompare(b)).map(([date,pnl])=>({date,pnl}));
  const LIVE_EQUITY   = LIVE_PNL_DATA.reduce((acc,d,i)=>{
    const prev = i===0 ? 50000 : acc[i-1].equity;
    return [...acc, {date:d.date, equity: Math.round(prev+d.pnl)}];
  }, []);

  // ── Advanced risk metrics ──────────────────────────────────────────────────
  const grossWin  = rangedTrades.filter(d=>d.pnl>0).reduce((a,b)=>a+b.pnl,0);
  const grossLoss = Math.abs(rangedTrades.filter(d=>d.pnl<0).reduce((a,b)=>a+b.pnl,0));
  const profitFactor = grossLoss > 0 ? (grossWin/grossLoss).toFixed(2) : wins > 0 ? "∞" : "–";
  const expectancy   = rangedTrades.length
    ? ((winRate/100 * avgWin) - ((1-winRate/100) * avgLoss)).toFixed(0)
    : null;
  const maxConsecLosses = (() => {
    const sorted = [...rangedTrades].sort((a,b)=>a.trade_date?.localeCompare(b.trade_date));
    let max=0, cur=0;
    sorted.forEach(t=>{ if(t.pnl<0){cur++;if(cur>max)max=cur;}else cur=0; });
    return max;
  })();
  const maxConsecWins = (() => {
    const sorted = [...rangedTrades].sort((a,b)=>a.trade_date?.localeCompare(b.trade_date));
    let max=0, cur=0;
    sorted.forEach(t=>{ if(t.pnl>0){cur++;if(cur>max)max=cur;}else cur=0; });
    return max;
  })();

  // ── Today's P&L vs daily limit ─────────────────────────────────────────────
  const todayStr = (() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })();
  const todayPnl = trades.filter(t=>t.trade_date===todayStr).reduce((a,t)=>a+t.pnl,0);
  const activeDailyLimit = (() => {
    const acc = propAccounts.find(a=>a.id===activePropAccId) || propAccounts[0];
    if (!acc) return null;
    const firm = firms?.find(f=>f.id===acc.firmId);
    if (!firm) return null;
    const plan = firm.accountTypes?.find(p=>p.id===acc.typeId);
    if (!plan) return null;
    const dlRule = plan.rules?.find(r=>r.id==="dl");
    return dlRule ? { limit: dlRule.value, nickname: acc.nickname } : null;
  })();

  // ── Heatmap data (day × hour) ──────────────────────────────────────────────
  const heatmapData = (() => {
    const DAYS = ["Mon","Tue","Wed","Thu","Fri"];
    const grid = {};
    DAYS.forEach(d => { grid[d] = {}; });
    rangedTrades.forEach(t => {
      if (!t.trade_date || !t.entry) return;
      const dow = new Date(t.trade_date+"T12:00").getDay();
      const dayName = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow];
      if (!DAYS.includes(dayName)) return;
      const hour = t.entry.slice(0,2)+":00";
      if (!grid[dayName][hour]) grid[dayName][hour] = {pnl:0,trades:0,wins:0};
      grid[dayName][hour].pnl    += t.pnl;
      grid[dayName][hour].trades += 1;
      if (t.pnl>0) grid[dayName][hour].wins += 1;
    });
    const hours = [...new Set(rangedTrades.filter(t=>t.entry).map(t=>t.entry.slice(0,2)+":00"))].sort();
    return { grid, days: DAYS, hours };
  })();

  // ── Session journal state ──────────────────────────────────────────────────
  const [sessionJournals, setSessionJournals] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fv_sessions")||"{}"); } catch { return {}; }
  });
  const saveSession = (date, data) => {
    const updated = {...sessionJournals, [date]: data};
    setSessionJournals(updated);
    localStorage.setItem("fv_sessions", JSON.stringify(updated));
  };
  const [sessionDate, setSessionDate] = useState(todayStr);
  const currentSession = sessionJournals[sessionDate] || {plan:"",recap:"",emotion:"",mistakes:"",score:0};

  const liveTimeData = (() => {
    const hourMap = {};
    rangedTrades.forEach(t => {
      const h = t.entry ? t.entry.slice(0,2)+":00" : null;
      if (!h) return;
      if (!hourMap[h]) hourMap[h] = {hour:h, pnl:0, trades:0, wins:0};
      hourMap[h].pnl    += t.pnl;
      hourMap[h].trades += 1;
      if (t.pnl > 0) hourMap[h].wins += 1;
    });
    return Object.values(hourMap).sort((a,b)=>a.hour.localeCompare(b.hour));
  })();

  const allTags = [...new Set(rangedTrades.flatMap(t=>t.tags||[]))];
  const allFilterTags = [...new Set([...allTags, ...rules])];
  const tagStats= allTags.map(tag=>{
    const tg=rangedTrades.filter(t=>(t.tags||[]).includes(tag));
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


  const getPropStatus = rule => {
    if(rule.type==="loss")    { const u=Math.abs(Math.min(0,acct.todayPnl));    return {used:u,    pct:u/rule.value,                           status:u>=rule.value?"breach":u>=rule.value*.75?"warning":"ok"}; }
    if(rule.type==="drawdown"){ const dd=acct.peakBalance-acct.balance;          return {used:dd,   pct:dd/rule.value,                          status:dd>=rule.value?"breach":dd>=rule.value*.75?"warning":"ok"}; }
    if(rule.type==="target")  { const p=acct.balance-acct.startBalance;          return {used:p,    pct:Math.min(1,p/rule.value),               status:p>=rule.value?"achieved":p>=rule.value*.75?"close":"ok"}; }
    if(rule.type==="days")    {                                                   return {used:acct.tradingDays,pct:Math.min(1,acct.tradingDays/rule.value),status:acct.tradingDays>=rule.value?"achieved":"ok"}; }
    if(rule.type==="hold")    { const v=trades.filter(t=>t.holdMin<rule.value).length; return {used:v,pct:v>0?1:0,status:v>0?"breach":"ok"}; }
    if(rule.type==="consist") { const pct=acct.bestDayPct||0; return {used:pct, pct:pct/Math.max(rule.value,1), status:pct>=rule.value?"breach":pct>=rule.value*.85?"warning":"ok", isPercent:true}; }
    return {used:0,pct:0,status:"ok"};
  };
  const sc = s => s==="breach"?C.red:s==="warning"?C.amber:s==="achieved"?C.green:s==="close"?C.accent:C.green;
  const sl = s => s==="breach"?"BREACH":s==="warning"?"WARNING":s==="achieved"?"✓ PASSED":s==="close"?"ALMOST":"ON TRACK";

  const cats=[...new Set(habits.map(h=>h.category))];

  const TABS = ["dashboard","analytics","calendar","trades","edge","psychology","propfirm","news","accounts","copier","myaccount"];


  // Re-load trades when mode changes
  useEffect(() => { loadTrades(); }, [appMode, loadTrades]);

  // Close filter menu when clicking outside
  useEffect(() => {
    if (!showFilterMenu) return;
    const close = (e) => { if (!e.target.closest('.fv-filter-menu')) setShowFilterMenu(false); };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, [showFilterMenu]);



  return (
    <div className="fv-root" style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
        * { box-sizing: border-box; }
        @media(max-width:768px){
          /* Hide desktop nav tabs and right side clutter */
          .fv-nav-tabs{display:none!important}
          .fv-nav-right{display:none!important}
          .fv-menu-btn{display:none!important}
          /* Compact mobile navbar */
          .fv-navbar{padding:0 14px!important;height:50px!important}
          /* Content padding + bottom nav space */
          .fv-content{padding:12px!important;padding-bottom:80px!important}
          /* Stack grids to single column */
          .fv-grid-2,.fv-grid-3{grid-template-columns:1fr!important}
          /* Stat cards: 2 per row */
          .fv-stat-cards{flex-wrap:wrap!important}
          .fv-stat-cards>*{min-width:calc(50% - 6px)!important;flex:1 1 calc(50% - 6px)!important}
          /* Hide non-essential columns in tables */
          .fv-hide-mobile{display:none!important}
          /* Flatten widget above bottom nav */
          .fv-flatten-widget{bottom:72px!important;right:12px!important}
          /* Hide flatten floating widget on mobile — accessible via bottom nav instead */
          .fv-flatten-widget{display:none!important}
          /* Onboarding above bottom nav */
          .fv-onboard-guide{bottom:80px!important;left:12px!important}
          /* Trade modal: stack columns */
          .fv-trade-modal-grid{grid-template-columns:1fr!important}
          /* Charts: shorter on mobile */
          .recharts-responsive-container{min-height:140px!important}
          /* Prevent horizontal overflow */
          body{overflow-x:hidden!important}
          .fv-root{overflow-x:hidden!important}
        }
        @media(min-width:769px){
          .fv-bottom-nav{display:none!important}
          .fv-more-sheet{display:none!important}
        }
      `}</style>

      {/* ── Onboarding Wizard ────────────────────────────────────────────────── */}
      {showOnboarding && (() => {
        const STEPS = [
          {
            icon:"🏢", title:"Add your prop account",
            body:"Start in Prop Firm → click '+ Add Account' to set up your firm and account type.",
            action:"Go to Prop Firm", tab:"propfirm",
          },
          {
            icon:"📥", title:"Import your trades",
            body:"Export a CSV from Tradovate and use '⬆ Import CSV', or add trades manually.",
            action:"Go to Trades", tab:"trades",
          },
          {
            icon:"⚡", title:"Define your edge",
            body:"Create a named setup in Edge Library. FundVault auto-tracks its win rate and compliance.",
            action:"Go to Edge Library", tab:"edge",
          },
          {
            icon:"🧠", title:"Set up psychology",
            body:"Log mood and habits before each session. Psychology Guard tells you if you're clear to trade.",
            action:"Go to Psychology", tab:"psychology",
          },
          {
            icon:"🎉", title:"You're all set!",
            body:"FundVault now auto-generates alerts for drawdown, payout readiness and revenge trading. Check the 🔔 bell.",
            action:"Get started", tab:null,
          },
        ];
        const step = STEPS[onboardStep];
        const isLast = onboardStep === STEPS.length - 1;

        return (
          <div className="fv-onboard-guide" style={{
          position:"fixed", bottom:32, left:28, zIndex:3000,
            width:300, background:C.card,
            border:`1px solid ${C.accent}55`,
            borderRadius:16, overflow:"hidden",
            boxShadow:`0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px ${C.accent}22`,
            animation:"slideIn 0.25s ease",
          }}>
            {/* Progress bar */}
            <div style={{height:3,background:C.border}}>
              <div style={{height:"100%",width:`${(onboardStep/(STEPS.length-1))*100}%`,background:`linear-gradient(90deg,${C.accent},${C.purple})`,transition:"width 0.4s ease"}}/>
            </div>

            <div style={{padding:"18px 20px"}}>
              {/* Step + close */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>
                  Step {onboardStep+1} of {STEPS.length}
                </div>
                <button onClick={()=>{localStorage.setItem("fv_onboarded","1");setShowOnboarding(false);}}
                  style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:16,lineHeight:1,padding:"0 2px"}}>✕</button>
              </div>

              {/* Icon + title */}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <span style={{fontSize:28}}>{step.icon}</span>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16}}>{step.title}</div>
              </div>

              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,lineHeight:1.6,marginBottom:16}}>{step.body}</div>

              {/* Step dots */}
              <div style={{display:"flex",gap:5,marginBottom:14,justifyContent:"center"}}>
                {STEPS.map((_,i)=><div key={i} style={{width:i===onboardStep?16:6,height:6,borderRadius:3,background:i===onboardStep?C.accent:i<onboardStep?C.accent+"55":C.border,transition:"all 0.3s"}}/>)}
              </div>

              {/* Buttons */}
              <div style={{display:"flex",gap:8}}>
                {!isLast && (
                  <button onClick={()=>{localStorage.setItem("fv_onboarded","1");setShowOnboarding(false);}}
                    style={{flex:1,padding:"8px",borderRadius:8,cursor:"pointer",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:10}}>
                    Skip
                  </button>
                )}
                <button onClick={()=>{
                  if(step.tab) setTab(step.tab);
                  if(isLast){ localStorage.setItem("fv_onboarded","1"); setShowOnboarding(false); }
                  else setOnboardStep(s=>s+1);
                }}
                  style={{flex:isLast?1:2,padding:"8px",borderRadius:8,cursor:"pointer",background:C.accentDim,border:`1px solid ${C.accent}55`,color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,letterSpacing:"0.05em"}}>
                  {isLast ? "🚀 Get started" : `${step.action} →`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Alert Panel ──────────────────────────────────────────────────────── */}
      {showAlerts && (
        <div style={{position:"fixed",top:64,right:16,zIndex:2000,width:360,maxHeight:"80vh",display:"flex",flexDirection:"column",background:C.card,border:`1px solid ${C.border}`,borderRadius:14,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",overflow:"hidden",animation:"slideIn 0.2s ease"}}>
          <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16}}>🔔 Alerts {unreadCount>0&&<span style={{background:C.red,color:"#fff",borderRadius:20,padding:"1px 7px",fontFamily:"'Space Mono',monospace",fontSize:10,marginLeft:6}}>{unreadCount}</span>}</div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {unreadCount>0&&<button onClick={markAllRead} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10}}>Mark all read</button>}
              <button onClick={()=>setShowAlerts(false)} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:18}}>✕</button>
            </div>
          </div>
          <div style={{overflowY:"auto",flex:1}}>
            {alerts.length===0 ? (
              <div style={{padding:"40px 20px",textAlign:"center",color:C.muted,fontFamily:"'DM Sans',sans-serif",fontSize:13}}>
                <div style={{fontSize:32,marginBottom:8}}>✅</div>
                No alerts — everything looks good!
              </div>
            ) : (
              [...alerts].sort((a,b)=>b.ts-a.ts).map(alert=>(
                <div key={alert.id} style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,background:alert.read?"transparent":alert.type==="danger"?`${C.red}08`:alert.type==="success"?`${C.green}08`:`${C.amber}06`,display:"flex",gap:12,alignItems:"flex-start"}}>
                  <span style={{fontSize:20,flexShrink:0,marginTop:1}}>{alert.icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:alert.type==="danger"?C.red:alert.type==="success"?C.green:alert.type==="warning"?C.amber:C.accent,marginBottom:3}}>{alert.title}</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim,lineHeight:1.5}}>{alert.body}</div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,marginTop:6}}>{new Date(alert.ts).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
                  </div>
                  <button onClick={()=>dismissAlert(alert.id)} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:14,flexShrink:0,opacity:.6,padding:"2px 4px"}}>✕</button>
                </div>
              ))
            )}
          </div>
          {alerts.length>0&&<div style={{padding:"10px 18px",borderTop:`1px solid ${C.border}`,flexShrink:0}}>
            <button onClick={()=>saveAlerts([])} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10}}>Clear all alerts</button>
          </div>}
        </div>
      )}
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
      {selTrade  && <TradeModal trade={selTrade} onClose={()=>setSelTrade(null)} onSave={saveTrade} globalRules={rules}/>}
      {showImportCSV && <CSVImportModal onClose={()=>setShowImportCSV(false)} onImport={async (importedTrades, onProgress)=>{
        let saved = 0;
        for(const t of importedTrades){
          try { await saveTrade({...t, id:"csv-"+Date.now()+"-"+Math.random()}); saved++; }
          catch(e) { console.error("Failed to import trade:", t.symbol, e); }
          if (onProgress) onProgress(saved);
        }
        setShowImportCSV(false);
        if (saved > 0) await loadTrades();
      }} C={C}/>}
      {showExport    && <ExportModal onClose={()=>setShowExport(false)} trades={trades} C={C} userName={userName}/>}
      {showEdgeModal && <EdgeModal onClose={()=>{setShowEdgeModal(false);setEditingEdge(null);}} onSave={(e)=>{ if(editingEdge){ saveEdges(edges.map(x=>x.id===editingEdge.id?e:x)); }else{ saveEdges([...edges,{...e,id:Date.now().toString()}]); } setShowEdgeModal(false);setEditingEdge(null); }} existing={editingEdge} C={C}/>}
      {showAddTrade && <AddTradeModal onClose={()=>setShowAddTrade(false)} onSave={async (t)=>{ await saveTrade({...t,id:"new-"+Date.now()}); setShowAddTrade(false); }} globalRules={rules} C={C} newsBlocker={newsBlocker} calendarEvents={calendarEvents}/>}
      <FlattenWidget tvStatus={tvStatus} appIsDemo={isDemo} C={C}/>
      {showRules && <RuleManager rules={rules} onChange={(newRules)=>{
        setRules(newRules);
        localStorage.setItem("fv_rules", JSON.stringify(newRules));
        rulesApi.save(newRules.map((label,i)=>({id:String(i+1),label}))).catch(()=>{});
      }} onClose={()=>setShowRules(false)}/>}

      {/* Nav */}
      <div className="fv-navbar" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 28px",height:58,borderBottom:`1px solid ${C.border}`,background:C.surface,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18.5" fill="#0d1420" stroke="#00e5ff" strokeWidth="2"/>
            <circle cx="20" cy="20" r="14.5" fill="#111827"/>
            <rect x="18.2" y="1" width="3.6" height="5" rx="1.8" fill="#00e5ff"/>
            <rect x="18.2" y="34" width="3.6" height="5" rx="1.8" fill="#00e5ff"/>
            <rect x="1" y="18.2" width="5" height="3.6" rx="1.8" fill="#00e5ff"/>
            <rect x="34" y="18.2" width="5" height="3.6" rx="1.8" fill="#00e5ff"/>
            <text x="9.5" y="25" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="15" fill="#00e5ff" letterSpacing="1.5">F</text>
            <text x="21" y="25" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="15" fill="#a78bfa" letterSpacing="1.5">V</text>
          </svg>
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,letterSpacing:"0.07em",color:C.text,lineHeight:1.1}}>FUNDVAULT</span>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:C.accent,letterSpacing:"0.12em"}}>PROP TRADING JOURNAL</span>
          </div>
          <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.amber,background:"#f59e0b18",border:"1px solid #f59e0b44",borderRadius:4,padding:"2px 8px"}}>PROP FOCUS</span>
        </div>
        <div style={{display:"flex",gap:3}} className={`fv-nav-tabs${mobileMenu?" open":""}`}>
          {TABS.filter(t=>t!=="myaccount").map(t=><button key={t} onClick={()=>{setTab(t);setMobileMenu(false);}} style={{background:tab===t?C.accentDim:"transparent",border:tab===t?`1px solid ${C.accent}44`:"1px solid transparent",color:tab===t?C.accent:C.textDim,borderRadius:6,padding:"5px 11px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:"0.05em",textTransform:"uppercase",transition:"all 0.15s"}}>{t==="propfirm"?"prop firm":t==="myaccount"?"account":t}</button>)}
        </div>
        <div className="fv-nav-right" style={{display:"flex",alignItems:"center",gap:10}}>
          {/* Tradovate Live indicator */}
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:C.green,boxShadow:`0 0 6px ${C.green}`}}/>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.textDim}}>Tradovate · Live</span>
          </div>
          {/* Notifications */}
          <button onClick={()=>setShowAlerts(s=>!s)} style={{position:"relative",background:unreadCount>0?`${C.red}18`:"transparent",border:`1px solid ${unreadCount>0?C.red+"44":C.border}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:14,color:unreadCount>0?C.red:C.muted}}>
            🔔
            {unreadCount>0&&<span style={{position:"absolute",top:-4,right:-4,background:C.red,color:"#fff",borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Space Mono',monospace",fontSize:9,fontWeight:700}}>{unreadCount>9?"9+":unreadCount}</span>}
          </button>
          {/* Hamburger menu */}
          <div style={{position:"relative"}}>
            <button onClick={()=>setMobileMenu(m=>!m)}
              style={{display:"flex",alignItems:"center",gap:8,background:mobileMenu?C.accentDim:C.surface,border:`1px solid ${mobileMenu?C.accent+"44":C.border}`,borderRadius:8,padding:"5px 10px",cursor:"pointer"}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent}33,${C.purple}33)`,border:`1px solid ${C.accent}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:C.accent,flexShrink:0,position:"relative"}}>
                {userInitial}
                <span style={{position:"absolute",bottom:-3,right:-3,background:plan==="pro"?C.purple:plan==="advanced"?C.accent:"#6b859e",color:"#fff",borderRadius:4,padding:"1px 3px",fontFamily:"'Space Mono',monospace",fontSize:6,fontWeight:700,lineHeight:1.4,textTransform:"uppercase"}}>{plan}</span>
              </div>
              <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.textDim,letterSpacing:"0.05em"}}>{mobileMenu?"✕":"☰"}</span>
            </button>
            {/* Dropdown menu */}
            {mobileMenu && (
              <div onClick={e=>e.stopPropagation()} style={{position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:500,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:8,width:220,boxShadow:"0 8px 32px #00000066"}}>
                {/* User info */}
                <div style={{padding:"10px 12px 12px",borderBottom:`1px solid ${C.border}`,marginBottom:6}}>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,color:C.text}}>{profile?.full_name||userName}</div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,marginTop:2}}>{user?.email}</div>
                  <span style={{marginTop:6,display:"inline-block",background:plan==="pro"?`${C.purple}22`:plan==="advanced"?`${C.accent}22`:"#6b859e22",color:plan==="pro"?C.purple:plan==="advanced"?C.accent:"#6b859e",borderRadius:4,padding:"2px 8px",fontFamily:"'Space Mono',monospace",fontSize:9,fontWeight:700,textTransform:"uppercase"}}>{plan}</span>
                </div>
                {/* My Account */}
                <button onClick={()=>{setTab("myaccount");setMobileMenu(false);}} style={{width:"100%",textAlign:"left",background:"transparent",border:"none",padding:"9px 12px",cursor:"pointer",borderRadius:8,fontFamily:"'Space Mono',monospace",fontSize:10,color:C.text,display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  👤 My Account
                </button>
                <div style={{height:1,background:C.border,margin:"6px 0"}}/>
                {/* TV Sync */}
                <button onClick={()=>{syncTradovate();setMobileMenu(false);}} disabled={syncingTV} style={{width:"100%",textAlign:"left",background:"transparent",border:"none",padding:"9px 12px",cursor:"pointer",borderRadius:8,fontFamily:"'Space Mono',monospace",fontSize:10,color:tvStatus?.connected?C.green:C.muted,display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  {syncingTV?"⏳ Syncing...":tvStatus?.connected?"↻ Sync Tradovate":"📡 TV: Not connected"}
                </button>
                {/* Demo/Live */}
                <button onClick={()=>{toggleMode();setMobileMenu(false);}} style={{width:"100%",textAlign:"left",background:"transparent",border:"none",padding:"9px 12px",cursor:"pointer",borderRadius:8,fontFamily:"'Space Mono',monospace",fontSize:10,color:isDemo?"#a78bfa":"#00e5ff",display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  {isDemo?"🎭 Demo mode":"⚡ Live mode"}
                </button>
                {/* Dark/Light */}
                <button onClick={()=>{toggleTheme();setMobileMenu(false);}} style={{width:"100%",textAlign:"left",background:"transparent",border:"none",padding:"9px 12px",cursor:"pointer",borderRadius:8,fontFamily:"'Space Mono',monospace",fontSize:10,color:C.textDim,display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  {darkMode?"☀️ Light mode":"🌙 Dark mode"}
                </button>
                <div style={{height:1,background:C.border,margin:"6px 0"}}/>
                {/* Sign out */}
                <button onClick={handleSignOut} style={{width:"100%",textAlign:"left",background:"transparent",border:"none",padding:"9px 12px",cursor:"pointer",borderRadius:8,fontFamily:"'Space Mono',monospace",fontSize:10,color:C.red,display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background=`${C.red}11`} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  🚪 Sign out
                </button>
                <div style={{height:1,background:C.border,margin:"6px 0"}}/>
                {/* Legal links */}
                <div style={{display:"flex",gap:4,padding:"6px 12px",flexWrap:"wrap"}}>
                  <a href="https://fundvault.app/terms.html" target="_blank" rel="noreferrer"
                    style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,textDecoration:"none",letterSpacing:"0.04em"}}
                    onMouseEnter={e=>e.currentTarget.style.color=C.accent} onMouseLeave={e=>e.currentTarget.style.color=C.muted}>
                    Terms
                  </a>
                  <span style={{color:C.border,fontSize:9}}>·</span>
                  <a href="https://fundvault.app/privacy.html" target="_blank" rel="noreferrer"
                    style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,textDecoration:"none",letterSpacing:"0.04em"}}
                    onMouseEnter={e=>e.currentTarget.style.color=C.accent} onMouseLeave={e=>e.currentTarget.style.color=C.muted}>
                    Privacy
                  </a>
                  <span style={{color:C.border,fontSize:9}}>·</span>
                  <a href="mailto:support@fundvault.app"
                    style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,textDecoration:"none",letterSpacing:"0.04em"}}
                    onMouseEnter={e=>e.currentTarget.style.color=C.accent} onMouseLeave={e=>e.currentTarget.style.color=C.muted}>
                    Support
                  </a>
                </div>
              </div>
            )}
          </div>
          {/* Close dropdown on outside click */}
          {mobileMenu && <div onClick={()=>setMobileMenu(false)} style={{position:"fixed",inset:0,zIndex:499}}/>}
        </div>
      </div>

      <div className="fv-content" style={{flex:1,padding:"26px 28px",maxWidth:1300,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>

        {/* ── DASHBOARD ───────────────────────────────────────────────────────── */}
        {tab==="dashboard"&&(
          <div style={{display:"flex",flexDirection:"column",gap:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap",gap:10}}>
              <div><div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Overview</div><div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,marginTop:4}}>Performance <span style={{color:C.accent}}>↗</span></div></div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                {renderMonthNav()}
                {/* Discord daily report button — Advanced+ only */}
                {canAccess("advanced") && (
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                  <button onClick={()=>postDailyReportToDiscord(todayStr)} disabled={discordPosting}
                    title={profile?.discord_webhook?"Post today's trades to Discord":"Connect Discord in My Account first"}
                    style={{background:profile?.discord_webhook?"#5865F222":"transparent",border:`1px solid ${profile?.discord_webhook?"#5865F244":C.border}`,borderRadius:8,padding:"6px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"'Space Mono',monospace",fontSize:10,color:profile?.discord_webhook?"#5865F2":C.muted,opacity:discordPosting?0.6:1}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={profile?.discord_webhook?"#5865F2":C.muted}><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                    {discordPosting ? "Posting..." : "Post daily report"}
                  </button>
                  {discordMsg && <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:discordMsg.startsWith("✓")?C.green:C.red}}>{discordMsg}</span>}
                </div>
                )}
              </div>
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}} className="fv-stat-cards">
              <StatCard label="Net P&L"       value={rangedTrades.length ? `${totalPnl>=0?"+":""}$${Math.abs(totalPnl).toLocaleString()}` : "$0"} sub={rangeLabel} color={C.green}/>
              <StatCard label="Win Rate"      value={rangedTrades.length ? `${winRate}%` : "–"} sub={`${wins}/${rangedTrades.length} trades`} color={C.accent}/>
              <StatCard label="Profit Factor" value={profitFactor} sub={grossLoss>0?`$${Math.round(grossWin)} / $${Math.round(grossLoss)}`:"No losses"} color={parseFloat(profitFactor)>=1.5?C.green:parseFloat(profitFactor)>=1?C.accent:C.red}/>
              <StatCard label="Expectancy"    value={expectancy!==null?`$${expectancy}`:"–"} sub="Per trade avg" color={expectancy>0?C.green:C.red}/>
              <StatCard label="Max DD"        value={maxDD ? `-$${maxDD.toLocaleString()}` : "–"} sub="Peak-to-trough" color={C.red}/>
              <StatCard label="Avg R:R"       value={avgRR ? `${avgRR}R` : "–"} sub="Risk/reward ratio" color={C.accent}/>
            </div>

            {/* Daily P&L bar vs prop firm limit */}
            {activeDailyLimit && (
              <div style={{background:C.card,border:`1px solid ${Math.abs(todayPnl)>activeDailyLimit.limit*0.8?C.red+"44":C.border}`,borderRadius:12,padding:"16px 20px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Today vs Daily Limit · {activeDailyLimit.nickname}</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,marginTop:3,color:todayPnl>=0?C.green:Math.abs(todayPnl)>activeDailyLimit.limit*0.8?C.red:C.text}}>
                      {todayPnl>=0?"+":""}${Math.round(todayPnl).toLocaleString()}
                      <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,fontWeight:400,marginLeft:8}}>of -${activeDailyLimit.limit.toLocaleString()} limit</span>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>Used</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:20,color:todayPnl<0?C.red:C.green}}>
                      {todayPnl<0?Math.round(Math.abs(todayPnl)/activeDailyLimit.limit*100):0}%
                    </div>
                  </div>
                </div>
                <div style={{height:8,background:C.border,borderRadius:4,overflow:"hidden",position:"relative"}}>
                  <div style={{
                    height:"100%",borderRadius:4,transition:"width 0.5s",
                    width:`${Math.min(todayPnl<0?Math.abs(todayPnl)/activeDailyLimit.limit*100:0,100)}%`,
                    background:Math.abs(todayPnl)>activeDailyLimit.limit*0.8?C.red:Math.abs(todayPnl)>activeDailyLimit.limit*0.5?C.amber:C.green,
                  }}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>$0</span>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>-${activeDailyLimit.limit.toLocaleString()}</span>
                </div>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
              {/* Equity Curve — Lightweight Charts */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>Equity Curve</div>
                {LIVE_EQUITY.length ? (
                  <LWEquityChart data={LIVE_EQUITY} darkMode={darkMode} accentColor={C.accent}/>
                ) : <div style={{height:180,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:C.muted,gap:8}}><div style={{fontSize:28}}>📈</div><div style={{fontFamily:"'Space Mono',monospace",fontSize:11}}>No trades yet</div></div>}
              </div>
              {/* Daily P&L — Lightweight Charts */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>Daily P&L</div>
                {LIVE_PNL_DATA.length ? (
                  <LWPnlChart data={LIVE_PNL_DATA} darkMode={darkMode} green={C.green} red={C.red}/>
                ) : <div style={{height:180,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:C.muted,gap:8}}><div style={{fontSize:28}}>📊</div><div style={{fontFamily:"'Space Mono',monospace",fontSize:11}}>No trades yet</div></div>}
              </div>
            </div>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Recent Trades</div><button onClick={()=>setTab("trades")} style={{background:"transparent",border:"none",color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer"}}>View all →</button></div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{["Symbol","Side","Entry","Exit","Tags","R:R","P&L"].map(h=><th key={h} style={{padding:"9px 18px",textAlign:"left",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:400}}>{h}</th>)}</tr></thead>
                <tbody>{rangedTrades.slice(0,5).map((t,i)=>(
                  <tr key={t.id} style={{borderBottom:i<4?`1px solid ${C.border}`:"none"}} onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"11px 18px",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14}}>{t.symbol}</td>
                    <td style={{padding:"11px 18px"}}><span style={{background:t.side==="Long"?"#00d08418":"#ff3d5a18",color:t.side==="Long"?C.green:C.red,borderRadius:4,padding:"2px 8px",fontFamily:"'Space Mono',monospace",fontSize:10}}>{t.side}</span></td>
                    <td style={{padding:"11px 18px",fontFamily:"'Space Mono',monospace",fontSize:12,color:C.textDim}}>{t.entry}</td>
                    <td style={{padding:"11px 18px",fontFamily:"'Space Mono',monospace",fontSize:12,color:C.textDim}}>{t.exit}</td>
                    <td style={{padding:"11px 18px"}}><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{(t.tags||[]).slice(0,2).map(tag=><TagBadge key={tag} label={tag}/>)}</div></td>
                    <td style={{padding:"11px 18px",fontFamily:"'Space Mono',monospace",fontSize:12,color:t.rr>=0?C.green:C.red,fontWeight:700}}>{t.rr}R</td>
                    <td style={{padding:"11px 18px",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:t.pnl>=0?C.green:C.red}}>{t.pnl>=0?"+":""}${t.pnl}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ANALYTICS ───────────────────────────────────────────────────────── */}
        {tab==="analytics"&&(
          <div style={{display:"flex",flexDirection:"column",gap:isMobile?14:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
              <div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Deep Dive</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:isMobile?22:28,fontWeight:800,marginTop:4}}>Analytics</div>
              </div>
              {renderMonthNav()}
            </div>

            {/* Tag performance */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:isMobile?14:22}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>Performance by Setup Tag</div>
              {tagStats.length===0 ? (
                <div style={{color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11,padding:"20px 0",textAlign:"center"}}>No tagged trades yet</div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {tagStats.map(s=>(
                    isMobile ? (
                      <div key={s.tag} style={{background:C.surface,borderRadius:10,padding:"12px 14px",border:`1px solid ${C.border}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                          <TagBadge label={s.tag}/>
                          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:s.pnl>=0?C.green:C.red}}>{s.pnl>=0?"+":""}${s.pnl}</span>
                        </div>
                        <div style={{display:"flex",gap:10,alignItems:"center"}}>
                          <div style={{flex:1,height:6,background:C.border,borderRadius:3,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${s.winRate}%`,background:s.winRate>=60?C.green:s.winRate>=40?C.accent:C.red,borderRadius:3}}/>
                          </div>
                          <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,flexShrink:0}}>{s.winRate}% · {s.count}t</span>
                        </div>
                      </div>
                    ) : (
                      <div key={s.tag} style={{display:"grid",gridTemplateColumns:"150px 1fr 80px 80px 80px",alignItems:"center",gap:12,padding:"11px 16px",background:C.surface,borderRadius:10,border:`1px solid ${C.border}`}}>
                        <TagBadge label={s.tag}/>
                        <div style={{position:"relative",height:7,background:C.border,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${s.winRate}%`,background:s.winRate>=60?C.green:s.winRate>=40?C.accent:C.red,borderRadius:4,transition:"width 0.5s"}}/></div>
                        <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.textDim,textAlign:"center"}}>{s.winRate}% WR</div>
                        <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.textDim,textAlign:"center"}}>{s.count} trades</div>
                        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:s.pnl>=0?C.green:C.red,textAlign:"right"}}>{s.pnl>=0?"+":""}${s.pnl}</div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>

            {/* Time analysis — full on desktop, simplified on mobile */}
            {isMobile ? (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:14}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>Win Rate by Hour</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {liveTimeData.length ? liveTimeData.map(d=>{
                    const wr=d.trades?Math.round((d.wins/d.trades)*100):0;
                    return (
                      <div key={d.hour} style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,width:46,flexShrink:0}}>{d.hour}</span>
                        <div style={{flex:1,height:8,background:C.border,borderRadius:4,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${wr}%`,background:wr>=60?C.green:wr>=40?C.accent:C.red,borderRadius:4}}/>
                        </div>
                        <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:wr>=60?C.green:wr>=40?C.accent:C.red,width:36,textAlign:"right",fontWeight:700}}>{wr}%</span>
                        <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:d.pnl>=0?C.green:C.red,width:60,textAlign:"right"}}>{d.pnl>=0?"+":""}${d.pnl}</span>
                      </div>
                    );
                  }) : <div style={{color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11,textAlign:"center",padding:16}}>No trades yet</div>}
                </div>
              </div>
            ) : (
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
                    {["London Kill Zone (08-10)","NY Kill Zone (14-16)"].map(z=><span key={z} style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.amber,background:"#f59e0b11",border:"1px solid #f59e0b33",borderRadius:20,padding:"3px 10px"}}>⚡ {z}</span>)}
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
            )}

            {trades.length >= 5 && canAccess("advanced") && <AIFeedback trades={rangedTrades.length ? rangedTrades : trades} supabase={supabase}/>}
            {trades.length >= 5 && !canAccess("advanced") && (
              <UpgradeGate plan="advanced" C={C} onUpgrade={()=>setTab("myaccount")} feature="AI Coach" desc="Get AI-powered trade analysis and actionable feedback on your patterns. Available on Advanced and Pro."/>
            )}

            {/* ── Advanced risk metrics ── */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:isMobile?14:22}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:16}}>Risk Metrics</div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}} className="fv-stat-cards">
                <StatCard label="Profit Factor" value={profitFactor} sub={grossLoss>0?`$${Math.round(grossWin).toLocaleString()} gross win`:"No losing trades"} color={parseFloat(profitFactor)>=1.5?C.green:parseFloat(profitFactor)>=1?C.accent:C.red}/>
                <StatCard label="Expectancy"    value={expectancy!==null?`$${expectancy}`:"–"} sub="Expected $ per trade" color={expectancy>0?C.green:C.red}/>
                <StatCard label="Avg Win"       value={avgWin?`$${avgWin}`:"–"} sub="Per winning trade" color={C.green}/>
                <StatCard label="Avg Loss"      value={avgLoss?`$${avgLoss}`:"–"} sub="Per losing trade" color={C.red}/>
                <StatCard label="Max Consec. L" value={maxConsecLosses||"–"} sub="Consecutive losses" color={C.red}/>
                <StatCard label="Max Consec. W" value={maxConsecWins||"–"} sub="Consecutive wins" color={C.green}/>
              </div>
            </div>

            {/* ── Heatmap: day × hour ── */}
            {!isMobile && heatmapData.hours.length > 0 && (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:22}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4}}>Performance Heatmap</div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim,marginBottom:16}}>P&L by day and time of entry — spot your best and worst windows</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{borderCollapse:"separate",borderSpacing:4,minWidth:400}}>
                    <thead>
                      <tr>
                        <th style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,padding:"0 8px",textAlign:"left",fontWeight:400}}></th>
                        {heatmapData.hours.map(h=>(
                          <th key={h} style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,padding:"0 4px",textAlign:"center",fontWeight:400,minWidth:52}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmapData.days.map(day=>(
                        <tr key={day}>
                          <td style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,padding:"4px 8px 4px 0",whiteSpace:"nowrap"}}>{day}</td>
                          {heatmapData.hours.map(hour=>{
                            const cell = heatmapData.grid[day]?.[hour];
                            const pnl = cell?.pnl || 0;
                            const trades = cell?.trades || 0;
                            const wr = cell ? Math.round(cell.wins/cell.trades*100) : 0;
                            const intensity = Math.min(Math.abs(pnl)/500, 1);
                            const bg = !cell ? C.surface
                              : pnl > 0 ? `rgba(0,208,132,${0.12+intensity*0.55})`
                              : `rgba(255,61,90,${0.12+intensity*0.55})`;
                            return (
                              <td key={hour} title={cell?`${day} ${hour}\n${trades} trade${trades!==1?"s":""}\nP&L: ${pnl>=0?"+":""}$${Math.round(pnl)}\nWR: ${wr}%`:""} style={{background:bg,borderRadius:6,padding:"10px 6px",textAlign:"center",cursor:cell?"default":"default",minWidth:52,border:`1px solid ${C.border}22`}}>
                                {cell ? <>
                                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:11,color:pnl>=0?C.green:C.red}}>{pnl>=0?"+":""}${Math.abs(Math.round(pnl))>=1000?Math.round(pnl/100)/10+"k":Math.round(pnl)}</div>
                                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,marginTop:2}}>{trades}t · {wr}%</div>
                                </> : <div style={{color:C.border,fontSize:10}}>–</div>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{display:"flex",gap:16,marginTop:12,flexWrap:"wrap"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:12,height:12,borderRadius:3,background:"rgba(0,208,132,0.6)"}}/>
                    <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>Profitable window</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:12,height:12,borderRadius:3,background:"rgba(255,61,90,0.6)"}}/>
                    <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>Losing window</span>
                  </div>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>Hover for details</span>
                </div>
              </div>
            )}
            {isMobile && heatmapData.hours.length > 0 && (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:14}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>Best Trading Hours</div>
                {heatmapData.hours.map(hour=>{
                  const totalPnlHour = heatmapData.days.reduce((a,d)=>a+(heatmapData.grid[d]?.[hour]?.pnl||0),0);
                  const totalTrades  = heatmapData.days.reduce((a,d)=>a+(heatmapData.grid[d]?.[hour]?.trades||0),0);
                  if(!totalTrades) return null;
                  return <div key={hour} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,width:46,flexShrink:0}}>{hour}</span>
                    <div style={{flex:1,height:7,background:C.border,borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${Math.min(Math.abs(totalPnlHour)/50,100)}%`,background:totalPnlHour>=0?C.green:C.red,borderRadius:3}}/>
                    </div>
                    <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:totalPnlHour>=0?C.green:C.red,width:64,textAlign:"right",fontWeight:700}}>{totalPnlHour>=0?"+":""}${Math.round(totalPnlHour)}</span>
                  </div>;
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CALENDAR ────────────────────────────────────────────────────────── */}
        {tab==="calendar"&&(()=>{
          const calDate    = new Date(dateRange.from+"T12:00");
          const year       = calDate.getFullYear();
          const month      = calDate.getMonth();
          const monthLabel = calDate.toLocaleString("en-US",{month:"long",year:"numeric"});
          const daysInMonth= new Date(year,month+1,0).getDate();
          const firstDay   = ((new Date(year,month,1).getDay()+6)%7);

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

          const prevMonth = () => goToMonth(drYear, drMonth-1);
          const nextMonth = () => goToMonth(drYear, drMonth+1);
          const isAllTime = dateRange.preset === "all";

          const shareCalendar = async () => {
            // Dynamically load html2canvas
            if (!window.html2canvas) {
              await new Promise((res, rej) => {
                const s = document.createElement("script");
                s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
                s.onload = res; s.onerror = rej;
                document.head.appendChild(s);
              });
            }
            const el = document.getElementById("fv-share-card");
            if (!el) return;
            el.style.display = "block";
            try {
              const canvas = await window.html2canvas(el, {
                backgroundColor: "#0d1420",
                scale: 2,
                useCORS: true,
                logging: false,
              });
              el.style.display = "none";
              const url = canvas.toDataURL("image/png");
              const a = document.createElement("a");
              a.href = url;
              a.download = `FundVault-${monthLabel.replace(" ","-")}.png`;
              a.click();
            } catch(e) {
              el.style.display = "none";
              alert("Could not generate image: " + e.message);
            }
          };

          return <div style={{display:"flex",flexDirection:"column",gap:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
              <div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Monthly View</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,marginTop:4,textTransform:"capitalize"}}>
                  {isAllTime ? "All Time" : monthLabel}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {/* All time toggle */}
                <button onClick={isAllTime ? goThisMonth : goAllTime} style={{
                  background:isAllTime?C.accentDim:C.card,
                  border:`1px solid ${isAllTime?C.accent+"55":C.border}`,
                  borderRadius:8,padding:"6px 14px",cursor:"pointer",
                  fontFamily:"'Space Mono',monospace",fontSize:10,
                  color:isAllTime?C.accent:C.muted,
                  fontWeight:isAllTime?700:400,
                }}>All time</button>
                {!isAllTime && <>
                  <button onClick={prevMonth} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 16px",cursor:"pointer",color:C.textDim,fontFamily:"'Space Mono',monospace",fontSize:15,lineHeight:1}}>←</button>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:12,color:C.text,minWidth:120,textAlign:"center"}}>{monthLabel}</span>
                  <button onClick={nextMonth} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 16px",cursor:"pointer",color:C.textDim,fontFamily:"'Space Mono',monospace",fontSize:15,lineHeight:1}}>→</button>
                </>}
                {!isAllTime && tradingDays > 0 && (
                  <button onClick={shareCalendar}
                    style={{background:`linear-gradient(135deg,${C.accent}22,${C.purple}22)`,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.accent,fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
                    ↗ Share
                  </button>
                )}
              </div>
            </div>
            {/* Stats — all-time shows totals, monthly shows month data */}
            <div style={{display:"flex",gap:12}}>
              {isAllTime ? <>
                <StatCard label="Total P&L"   value={`${trades.reduce((a,t)=>a+t.pnl,0)>=0?"+":""}$${Math.abs(trades.reduce((a,t)=>a+t.pnl,0)).toLocaleString()}`} sub={`${trades.length} trades`} color={trades.reduce((a,t)=>a+t.pnl,0)>=0?C.green:C.red}/>
                <StatCard label="Green Days"  value={String(Object.values(Object.fromEntries(trades.map(t=>[t.trade_date,(trades.filter(x=>x.trade_date===t.trade_date).reduce((a,x)=>a+x.pnl,0))]))).filter(p=>p>0).length)} sub="All time" color={C.green}/>
                <StatCard label="Red Days"    value={String(Object.values(Object.fromEntries(trades.map(t=>[t.trade_date,(trades.filter(x=>x.trade_date===t.trade_date).reduce((a,x)=>a+x.pnl,0))]))).filter(p=>p<0).length)} sub="All time" color={C.red}/>
                <StatCard label="Win Rate"    value={trades.length?`${Math.round(trades.filter(t=>t.pnl>0).length/trades.length*100)}%`:"–"} sub={`${trades.filter(t=>t.pnl>0).length}/${trades.length}`} color={C.accent}/>
                <StatCard label="Best Day"    value={(() => { const byDay={}; trades.forEach(t=>{byDay[t.trade_date]=(byDay[t.trade_date]||0)+t.pnl;}); const best=Math.max(0,...Object.values(byDay)); return best?`+$${Math.round(best).toLocaleString()}`:"–"; })()} sub="Single day" color={C.accent}/>
              </> : <>
                <StatCard label="Month P&L"  value={`${monthPnl>=0?"+":""}$${Math.abs(Math.round(monthPnl))}`} sub="Total" color={monthPnl>=0?C.green:C.red}/>
                <StatCard label="Green Days" value={String(greenDays)}   sub={`Out of ${tradingDays}`} color={C.green}/>
                <StatCard label="Red Days"   value={String(redDays)}     sub={`Out of ${tradingDays}`} color={C.red}/>
                <StatCard label="Best Day"   value={bestDay?`+$${Math.round(bestDay)}`:"–"} sub={bestDayNum?`Day ${bestDayNum}`:"No trades"} color={C.accent}/>
                <StatCard label="Worst Day"  value={worstDay?`-$${Math.abs(Math.round(worstDay))}`:"–"} sub={worstDayNum?`Day ${worstDayNum}`:"No trades"} color={C.red}/>
              </>}
            </div>

            {/* Calendar grid — monthly view only; all-time shows monthly summary list */}
            {isAllTime ? (() => {
              const byMonth = {};
              trades.forEach(t => {
                if (!t.trade_date) return;
                const m = t.trade_date.slice(0,7);
                if (!byMonth[m]) byMonth[m] = {pnl:0, wins:0, total:0};
                byMonth[m].pnl += t.pnl;
                byMonth[m].total++;
                if (t.pnl>0) byMonth[m].wins++;
              });
              const months = Object.entries(byMonth).sort(([a],[b])=>b.localeCompare(a));
              if (!months.length) return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:40,textAlign:"center",color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:12}}>No trades logged yet</div>;
              return (
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                      {["Month","Trades","Win Rate","P&L"].map(h=><th key={h} style={{padding:"10px 18px",textAlign:"left",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:400}}>{h}</th>)}
                    </tr></thead>
                    <tbody>{months.map(([m, s], i)=>{
                      const label = new Date(m+"-15").toLocaleString("en-US",{month:"long",year:"numeric"});
                      const wr = Math.round(s.wins/s.total*100);
                      return (
                        <tr key={m} style={{borderBottom:i<months.length-1?`1px solid ${C.border}`:"none",cursor:"pointer"}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.surface}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                          onClick={()=>setDateRange({from:`${m}-01`,to:new Date(...m.split("-").map((v,i)=>i===1?+v:+v),0).toISOString?.()?.slice(0,10)||`${m}-31`,preset:"custom"})}>
                          <td style={{padding:"12px 18px",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14}}>{label}</td>
                          <td style={{padding:"12px 18px",fontFamily:"'Space Mono',monospace",fontSize:12,color:C.muted}}>{s.total}</td>
                          <td style={{padding:"12px 18px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{width:60,height:5,background:C.border,borderRadius:3,overflow:"hidden"}}>
                                <div style={{height:"100%",width:`${wr}%`,background:wr>=60?C.green:wr>=40?C.accent:C.red,borderRadius:3}}/>
                              </div>
                              <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:wr>=60?C.green:wr>=40?C.accent:C.red,fontWeight:700}}>{wr}%</span>
                            </div>
                          </td>
                          <td style={{padding:"12px 18px",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:s.pnl>=0?C.green:C.red}}>{s.pnl>=0?"+":""}${Math.round(s.pnl).toLocaleString()}</td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              );
            })() : (
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8,marginBottom:8}}>{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><div key={d} style={{textAlign:"center",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,padding:"4px 0"}}>{d}</div>)}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8}}>
                {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
                {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
                  const pnl    = calPnl[day];
                  const dayOfWeek = (new Date(year,month,day).getDay());
                  const isWknd = dayOfWeek===0||dayOfWeek===6;
                  return <div key={day} style={{background:pnl!==undefined?pnl>=0?"#00d08414":"#ff3d5a14":isWknd?"transparent":C.surface,border:`1px solid ${pnl!==undefined?pnl>=0?C.green+"44":C.red+"44":C.border}`,borderRadius:8,padding:"9px 8px",minHeight:60,opacity:isWknd&&pnl===undefined?.3:1}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>{day}</div>
                    {pnl!==undefined&&<div style={{marginTop:5,fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:pnl>=0?C.green:C.red}}>{pnl>=0?"+":""}${Math.round(pnl)}</div>}
                  </div>;
                })}
              </div>
            </div>
            )}

            {/* ── Hidden Share Card — rendered off-screen by html2canvas ── */}
            <div id="fv-share-card" style={{
              display:"none", position:"fixed", left:-9999, top:-9999,
              background:"#0d1420", borderRadius:16, padding:28, width:520,
              fontFamily:"'Space Mono',monospace",
            }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
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
                    <div style={{color:"#c8d8e8",fontSize:12,fontWeight:700,letterSpacing:"0.1em"}}>FUNDVAULT</div>
                    <div style={{color:"#00e5ff",fontSize:8,letterSpacing:"0.12em"}}>PROP TRADING JOURNAL</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{color:"#4a6080",fontSize:9,letterSpacing:"0.08em",textTransform:"uppercase"}}>{monthLabel}</div>
                  <div style={{color:monthPnl>=0?"#00d084":"#ff3d5a",fontSize:20,fontWeight:700,marginTop:2}}>
                    {monthPnl>=0?"+":""}${Math.round(Math.abs(monthPnl)).toLocaleString()}
                  </div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5,marginBottom:6}}>
                {["MON","TUE","WED","THU","FRI","SAT","SUN"].map(d=>(
                  <div key={d} style={{textAlign:"center",fontSize:9,color:"#4a6080",padding:"3px 0"}}>{d}</div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5}}>
                {Array.from({length:firstDay}).map((_,i)=>(
                  <div key={`e${i}`} style={{minHeight:48}}/>
                ))}
                {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
                  const pnl2 = calPnl[day];
                  const dow = new Date(year,month,day).getDay();
                  const isWknd2 = dow===0||dow===6;
                  return (
                    <div key={day} style={{
                      background:pnl2!==undefined?pnl2>=0?"rgba(0,208,132,0.08)":"rgba(255,61,90,0.08)":isWknd2?"transparent":"#111827",
                      border:`1px solid ${pnl2!==undefined?pnl2>=0?"rgba(0,208,132,0.3)":"rgba(255,61,90,0.3)":"#1e2d3d"}`,
                      borderRadius:6,padding:"7px 5px",minHeight:48,
                      opacity:isWknd2&&pnl2===undefined?0.3:1,
                    }}>
                      <div style={{fontSize:9,color:"#4a6080"}}>{day}</div>
                      {pnl2!==undefined&&(
                        <div style={{marginTop:4,fontSize:11,fontWeight:700,color:pnl2>=0?"#00d084":"#ff3d5a"}}>
                          {pnl2>=0?"+":""}${Math.round(pnl2)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:18,paddingTop:14,borderTop:"1px solid #1e2d3d"}}>
                <div style={{display:"flex",gap:20}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:8,color:"#4a6080",letterSpacing:"0.08em",textTransform:"uppercase"}}>Win days</div>
                    <div style={{fontSize:16,color:"#00d084",fontWeight:700,marginTop:2}}>{greenDays}</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:8,color:"#4a6080",letterSpacing:"0.08em",textTransform:"uppercase"}}>Loss days</div>
                    <div style={{fontSize:16,color:"#ff3d5a",fontWeight:700,marginTop:2}}>{redDays}</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:8,color:"#4a6080",letterSpacing:"0.08em",textTransform:"uppercase"}}>Win rate</div>
                    <div style={{fontSize:16,color:"#00e5ff",fontWeight:700,marginTop:2}}>
                      {tradingDays?Math.round(greenDays/tradingDays*100):0}%
                    </div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:8,color:"#4a6080",letterSpacing:"0.08em",textTransform:"uppercase"}}>Best day</div>
                    <div style={{fontSize:16,color:"#00d084",fontWeight:700,marginTop:2}}>
                      {bestDay?`+$${Math.round(bestDay).toLocaleString()}`:"–"}
                    </div>
                  </div>
                </div>
                <div style={{fontSize:9,color:"#2a3d50",letterSpacing:"0.06em"}}>fundvault.app</div>
              </div>
            </div>
          </div>;
        })()}

        {/* ── TRADES ──────────────────────────────────────────────────────────── */}
        {tab==="trades"&&(
          <div style={{display:"flex",flexDirection:"column",gap:isMobile?14:22}}>

            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Trade Log</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:isMobile?22:28,fontWeight:800,marginTop:4}}>All Trades</div>
              </div>
              {isMobile ? (
                <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                  {renderMonthNav()}
                  <button onClick={()=>setShowAddTrade(true)} style={{background:`linear-gradient(135deg,${C.accent}33,${C.accent}11)`,border:`1px solid ${C.accent}55`,color:C.accent,borderRadius:8,padding:"8px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700}}>+ Add</button>
                  <button onClick={()=>setShowImportCSV(true)} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.textDim,borderRadius:8,padding:"8px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11}}>⬆ CSV</button>
                  <button onClick={()=>canAccess("advanced")?setShowExport(true):setTab("myaccount")} style={{background:C.surface,border:`1px solid ${C.border}`,color:canAccess("advanced")?C.textDim:C.muted,borderRadius:8,padding:"8px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,opacity:canAccess("advanced")?1:0.5}}>⬇ PDF {!canAccess("advanced")&&"🔒"}</button>
                  <button onClick={()=>setShowRules(true)} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.textDim,borderRadius:8,padding:"8px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11}}>⚙</button>
                </div>
              ) : (
                <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
                  {renderMonthNav()}
                  <button onClick={()=>setShowAddTrade(true)} style={{background:`linear-gradient(135deg,${C.accent}33,${C.accent}11)`,border:`1px solid ${C.accent}55`,color:C.accent,borderRadius:8,padding:"7px 16px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,letterSpacing:"0.05em"}}>+ Add Trade</button>
                  <button onClick={()=>setShowImportCSV(true)} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.textDim,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,display:"flex",alignItems:"center",gap:5}}>⬆ Import CSV</button>
                  <button onClick={()=>canAccess("advanced")?setShowExport(true):setTab("myaccount")} style={{background:C.surface,border:`1px solid ${C.border}`,color:canAccess("advanced")?C.textDim:C.muted,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,display:"flex",alignItems:"center",gap:5,opacity:canAccess("advanced")?1:0.5}} title={canAccess("advanced")?"":" Advanced plan required"}>⬇ Export PDF {!canAccess("advanced")&&"🔒"}</button>
                  {/* Filter dropdown */}
                  <div style={{position:"relative"}} className="fv-filter-menu">
                    <button onClick={()=>setShowFilterMenu(m=>!m)}
                      style={{background:(tagFilter!=="All"||symbolFilter!=="All")?C.accentDim:C.surface,border:`1px solid ${(tagFilter!=="All"||symbolFilter!=="All")?C.accent+"55":C.border}`,color:(tagFilter!=="All"||symbolFilter!=="All")?C.accent:C.textDim,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,display:"flex",alignItems:"center",gap:6}}>
                      ⚙ Filter {(tagFilter!=="All"||symbolFilter!=="All") && <span style={{background:C.accent,color:C.bg,borderRadius:10,padding:"1px 6px",fontSize:9,fontWeight:700}}>ON</span>}
                    </button>
                    {showFilterMenu && (
                      <div onClick={e=>e.stopPropagation()} style={{position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:500,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16,width:260,boxShadow:"0 8px 32px #00000066"}}>
                        {/* Symbol filter */}
                        <div style={{marginBottom:14}}>
                          <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Instrument</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                            {["All",...allSymbols].map(s=>(
                              <button key={s} onClick={()=>setSymbolFilter(s)}
                                style={{padding:"4px 10px",borderRadius:6,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,background:symbolFilter===s?C.accentDim:C.surface,border:`1px solid ${symbolFilter===s?C.accent+"55":C.border}`,color:symbolFilter===s?C.accent:C.textDim,fontWeight:symbolFilter===s?700:400}}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Tag filter — includes rules */}
                        <div style={{marginBottom:14}}>
                          <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Setup / Tag</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                            {["All",...allFilterTags].map(f=>(
                              <button key={f} onClick={()=>setTagFilter(f)}
                                style={{padding:"4px 10px",borderRadius:6,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,background:tagFilter===f?`${tagColor(f)}22`:C.surface,border:`1px solid ${tagFilter===f?tagColor(f)+"55":C.border}`,color:tagFilter===f?tagColor(f):C.textDim,fontWeight:tagFilter===f?700:400}}>
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Reset */}
                        {(tagFilter!=="All"||symbolFilter!=="All") && (
                          <button onClick={()=>{setTagFilter("All");setSymbolFilter("All");}}
                            style={{width:"100%",padding:"7px",borderRadius:7,cursor:"pointer",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:10}}>
                            ✕ Clear filters
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <button onClick={()=>setShowRules(true)} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.textDim,borderRadius:6,padding:"5px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11}}>⚙ My Rules</button>
                </div>
              )}
            </div>

            {/* Tag filter pills — mobile */}
            {isMobile && (
              <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
                <button onClick={()=>{setTagFilter("All");setSymbolFilter("All");}}
                  style={{flexShrink:0,background:(tagFilter==="All"&&symbolFilter==="All")?C.accentDim:C.surface,border:`1px solid ${(tagFilter==="All"&&symbolFilter==="All")?C.accent+"55":C.border}`,color:(tagFilter==="All"&&symbolFilter==="All")?C.accent:C.muted,borderRadius:20,padding:"4px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10}}>All</button>
                {allSymbols.map(s=>(
                  <button key={s} onClick={()=>setSymbolFilter(symbolFilter===s?"All":s)}
                    style={{flexShrink:0,background:symbolFilter===s?C.accentDim:C.surface,border:`1px solid ${symbolFilter===s?C.accent+"55":C.border}`,color:symbolFilter===s?C.accent:C.muted,borderRadius:20,padding:"4px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,whiteSpace:"nowrap"}}>{s}</button>
                ))}
                {allFilterTags.map(f=>(
                  <button key={f} onClick={()=>setTagFilter(tagFilter===f?"All":f)}
                    style={{flexShrink:0,background:tagFilter===f?`${tagColor(f)}22`:C.surface,border:`1px solid ${tagFilter===f?tagColor(f)+"66":C.border}`,color:tagFilter===f?tagColor(f):C.muted,borderRadius:20,padding:"4px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,whiteSpace:"nowrap"}}>{f}</button>
                ))}
              </div>
            )}

            {/* Summary bar — mobile */}
            {isMobile && filteredTrades.length > 0 && (
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {[
                  {label:"Trades", value:filteredTrades.length, color:C.accent},
                  {label:"Win Rate", value:`${Math.round(filteredTrades.filter(t=>t.pnl>0).length/filteredTrades.length*100)}%`, color:C.green},
                  {label:"Net P&L", value:`${filteredTrades.reduce((a,t)=>a+t.pnl,0)>=0?"+":""}$${Math.abs(filteredTrades.reduce((a,t)=>a+t.pnl,0)).toLocaleString()}`, color:filteredTrades.reduce((a,t)=>a+t.pnl,0)>=0?C.green:C.red},
                ].map(s=>(
                  <div key={s.label} style={{background:C.card,borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`,textAlign:"center"}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,textTransform:"uppercase",marginBottom:4}}>{s.label}</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:s.color}}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Mobile: card list */}
            {isMobile ? (
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {filteredTrades.length === 0 ? (
                  <div style={{background:C.card,borderRadius:12,padding:"40px 20px",textAlign:"center",color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>
                    No trades yet — tap ➕ to log your first trade
                  </div>
                ) : filteredTrades.map(t=>(
                  <div key={t.id} onClick={()=>setSelTrade(t)}
                    style={{background:C.card,border:`1px solid ${t.pnl>=0?C.green+"33":C.red+"33"}`,borderRadius:12,padding:"14px 16px",cursor:"pointer",position:"relative",overflow:"hidden"}}>
                    <button onClick={e=>{e.stopPropagation(); if(window.confirm(`Delete ${t.symbol} trade?`)) deleteTrade(t.id);}}
                      style={{position:"absolute",top:10,right:10,background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:14,opacity:0.5,padding:"2px 6px",zIndex:1}}
                      title="Delete">✕</button>
                    <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:t.pnl>=0?C.green:C.red,borderRadius:"12px 0 0 12px"}}/>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16}}>{t.symbol}</span>
                        <span style={{background:t.side==="Long"?`${C.green}18`:`${C.red}18`,color:t.side==="Long"?C.green:C.red,borderRadius:4,padding:"2px 7px",fontFamily:"'Space Mono',monospace",fontSize:10}}>{t.side}</span>
                        {t.rating>0&&<span style={{fontSize:11}}>{"⭐".repeat(Math.min(t.rating,3))}</span>}
                      </div>
                      <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:t.pnl>=0?C.green:C.red}}>{t.pnl>=0?"+":""}${t.pnl}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{display:"flex",gap:10}}>
                        <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>{t.trade_date}</span>
                        <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>{t.entry}→{t.exit}</span>
                        <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:t.rr>=0?C.green:C.red,fontWeight:700}}>{t.rr}R</span>
                      </div>
                      <div style={{display:"flex",gap:4}}>
                        {(t.tags||[]).slice(0,2).map(tag=><TagBadge key={tag} label={tag}/>)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Desktop: full table */
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                {filteredTrades.length===0 ? (
                  <div style={{padding:40,textAlign:"center",color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:12}}>No trades yet — they will appear here once logged</div>
                ) : (
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{["#","Symbol","Side","Entry","Exit","Tags","Rating","R:R","P&L","Review",""].map(h=><th key={h} style={{padding:"11px 14px",textAlign:"left",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:400}}>{h}</th>)}</tr></thead>
                    <tbody>{filteredTrades.map((t,i)=>{
                      const rs=t.checks?Object.values(t.checks).filter(Boolean).length:null;
                      return <tr key={t.id} style={{borderBottom:i<filteredTrades.length-1?`1px solid ${C.border}`:"none"}} onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <td style={{padding:"11px 14px",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted}}>#{i+1}</td>
                        <td style={{padding:"11px 14px",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15}}>{t.symbol}</td>
                        <td style={{padding:"11px 14px"}}><span style={{background:t.side==="Long"?"#00d08418":"#ff3d5a18",color:t.side==="Long"?C.green:C.red,borderRadius:4,padding:"3px 8px",fontFamily:"'Space Mono',monospace",fontSize:10}}>{t.side}</span></td>
                        <td style={{padding:"11px 14px",fontFamily:"'Space Mono',monospace",fontSize:12,color:C.textDim}}>{t.entry}</td>
                        <td style={{padding:"11px 14px",fontFamily:"'Space Mono',monospace",fontSize:12,color:C.textDim}}>{t.exit}</td>
                        <td style={{padding:"11px 14px"}}><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{(t.tags||[]).slice(0,2).map(tag=><TagBadge key={tag} label={tag}/>)}</div></td>
                        <td style={{padding:"11px 14px"}}>{t.rating?<span>{"⭐".repeat(t.rating)}</span>:<span style={{color:C.muted,fontSize:10}}>–</span>}</td>
                        <td style={{padding:"11px 14px",fontFamily:"'Space Mono',monospace",fontSize:12,color:t.rr>=0?C.green:C.red,fontWeight:700}}>{t.rr}R</td>
                        <td style={{padding:"11px 14px",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:t.pnl>=0?C.green:C.red}}>{t.pnl>=0?"+":""}${t.pnl}</td>
                        <td style={{padding:"11px 14px"}}>{rs!==null?<span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:rs===rules.length?C.green:C.accent}}>{rs}/{rules.length} ✓</span>:<span style={{color:C.muted,fontSize:10}}>–</span>}</td>
                        <td style={{padding:"11px 14px"}}><button onClick={()=>setSelTrade(t)} style={{background:C.accentDim,border:`1px solid ${C.accent}33`,color:C.accent,borderRadius:6,padding:"4px 11px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10}}>Review →</button></td>
                        <td style={{padding:"11px 14px"}}><button onClick={()=>{ if(window.confirm(`Delete ${t.symbol} trade?`)) deleteTrade(t.id); }} style={{background:"transparent",border:`1px solid ${C.red}33`,color:C.red,borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:12,opacity:0.6}} title="Delete trade">✕</button></td>
                      </tr>;
                    })}</tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── EDGE LIBRARY ────────────────────────────────────────────────────── */}
        {tab==="edge"&&(()=>{
          const getEdgeStats = (edge) => {
            const linked = trades.filter(t =>
              edge.tags.length > 0
                ? edge.tags.some(tag => (t.tags||[]).includes(tag))
                : false
            );
            if (!linked.length) return null;
            const wins = linked.filter(t=>t.pnl>0);
            const totalPnl = linked.reduce((a,t)=>a+t.pnl,0);
            const winRate = Math.round((wins.length/linked.length)*100);
            const avgPnl = Math.round(totalPnl/linked.length);
            const avgWin = wins.length ? Math.round(wins.reduce((a,t)=>a+t.pnl,0)/wins.length) : 0;
            const avgLoss = linked.filter(t=>t.pnl<0).length ? Math.round(Math.abs(linked.filter(t=>t.pnl<0).reduce((a,t)=>a+t.pnl,0)/linked.filter(t=>t.pnl<0).length)) : 0;
            // Compliance: how often did trader follow the rules (rating >= 4 = following rules)
            const compliance = linked.filter(t=>t.rating>=4).length;
            const compliancePct = Math.round((compliance/linked.length)*100);
            // Best instrument
            const bySymbol = {};
            linked.forEach(t=>{ if(!bySymbol[t.symbol]) bySymbol[t.symbol]={pnl:0,count:0}; bySymbol[t.symbol].pnl+=t.pnl; bySymbol[t.symbol].count++; });
            const bestSym = Object.entries(bySymbol).sort((a,b)=>b[1].pnl-a[1].pnl)[0]?.[0];
            // Best time
            const byHour = {};
            linked.forEach(t=>{ const h=t.entry?.slice(0,2); if(h){ if(!byHour[h]) byHour[h]={pnl:0,count:0}; byHour[h].pnl+=t.pnl; byHour[h].count++; }});
            const bestHour = Object.entries(byHour).sort((a,b)=>b[1].pnl-a[1].pnl)[0]?.[0];
            return { count:linked.length, winRate, totalPnl, avgPnl, avgWin, avgLoss, compliancePct, bestSym, bestHour, linked };
          };

          const activeEdge = selectedEdge ? edges.find(e=>e.id===selectedEdge) : null;
          const activeStats = activeEdge ? getEdgeStats(activeEdge) : null;

          return <div style={{display:"flex",flexDirection:"column",gap:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
              <div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Strategy Vault</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,marginTop:4}}>Edge Library</div>
              </div>
              <button onClick={()=>{setEditingEdge(null);setShowEdgeModal(true);}}
                style={{background:`linear-gradient(135deg,${C.accent}33,${C.accent}11)`,border:`1px solid ${C.accent}55`,color:C.accent,borderRadius:8,padding:"8px 18px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700}}>
                + New Edge
              </button>
            </div>

            {edges.length===0 && (
              <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:16,padding:"60px 40px",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
                <div style={{fontSize:48}}>⚡</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22}}>Define your trading edge</div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:C.textDim,maxWidth:460,lineHeight:1.7}}>
                  Every profitable trader has a specific edge — a repeatable setup with clear rules. Create your first Edge and FundVault will automatically track its win rate, compliance, and performance over time.
                </div>
                <button onClick={()=>{setEditingEdge(null);setShowEdgeModal(true);}}
                  style={{marginTop:8,padding:"14px 32px",borderRadius:10,cursor:"pointer",background:`linear-gradient(135deg,${C.accent}33,${C.accent}11)`,border:`1px solid ${C.accent}55`,color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>
                  + Create First Edge
                </button>
              </div>
            )}

            {edges.length > 0 && (
              <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:18,alignItems:"start"}}>

                {/* Sidebar — edge list */}
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {edges.map(e=>{
                    const s = getEdgeStats(e);
                    const isActive = selectedEdge===e.id;
                    return (
                      <div key={e.id} onClick={()=>setSelectedEdge(isActive?null:e.id)}
                        style={{background:isActive?`${e.color}12`:C.card,border:`2px solid ${isActive?e.color:C.border}`,borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s",position:"relative",overflow:"hidden"}}>
                        {isActive&&<div style={{position:"absolute",top:0,left:0,bottom:0,width:3,background:e.color}}/>}
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:isActive?e.color:C.text,paddingLeft:isActive?8:0}}>{e.name}</div>
                          <div style={{display:"flex",gap:4}}>
                            <button onClick={ev=>{ev.stopPropagation();setEditingEdge(e);setShowEdgeModal(true);}} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:12,padding:"2px 4px"}}>✏</button>
                            <button onClick={ev=>{ev.stopPropagation();saveEdges(edges.filter(x=>x.id!==e.id));if(selectedEdge===e.id)setSelectedEdge(null);}} style={{background:"transparent",border:"none",color:C.red,cursor:"pointer",fontSize:12,padding:"2px 4px",opacity:.6}}>✕</button>
                          </div>
                        </div>
                        {s ? (
                          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                            <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:s.winRate>=60?C.green:s.winRate>=40?C.accent:C.red,fontWeight:700}}>{s.winRate}% WR</span>
                            <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>{s.count} trades</span>
                            <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:s.totalPnl>=0?C.green:C.red}}>{s.totalPnl>=0?"+":""}${s.totalPnl.toLocaleString()}</span>
                          </div>
                        ) : (
                          <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>No trades yet</div>
                        )}
                        {e.tags.length>0 && (
                          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:7}}>
                            {e.tags.slice(0,3).map(t=><span key={t} style={{background:`${e.color}18`,border:`1px solid ${e.color}33`,color:e.color,borderRadius:20,padding:"1px 8px",fontFamily:"'Space Mono',monospace",fontSize:9}}>{t}</span>)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Detail panel */}
                <div>
                  {!activeEdge && (
                    <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:14,padding:"48px 24px",textAlign:"center",color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:12}}>
                      ← Select an edge to see detailed stats
                    </div>
                  )}

                  {activeEdge && (
                    <div style={{display:"flex",flexDirection:"column",gap:16}}>

                      {/* Edge header */}
                      <div style={{background:C.card,border:`2px solid ${activeEdge.color}44`,borderRadius:14,padding:"20px 24px",position:"relative",overflow:"hidden"}}>
                        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${activeEdge.color},${activeEdge.color}44)`}}/>
                        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:activeEdge.color,marginBottom:4}}>{activeEdge.name}</div>
                        {activeEdge.description && <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,lineHeight:1.6}}>{activeEdge.description}</div>}
                      </div>

                      {!activeStats && (
                        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:32,textAlign:"center",color:C.muted,fontFamily:"'DM Sans',sans-serif",fontSize:13}}>
                          No trades tagged with <strong style={{color:activeEdge.color}}>{activeEdge.tags.join(", ")||"this edge"}</strong> yet.<br/>
                          <span style={{fontSize:12,marginTop:6,display:"block"}}>Tag your trades with these tags and stats will appear automatically.</span>
                        </div>
                      )}

                      {activeStats && (<>
                        {/* Stats row */}
                        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                          {[
                            {label:"Win Rate",    value:`${activeStats.winRate}%`, color:activeStats.winRate>=60?C.green:activeStats.winRate>=40?C.accent:C.red},
                            {label:"Total P&L",   value:`${activeStats.totalPnl>=0?"+":""}$${activeStats.totalPnl.toLocaleString()}`, color:activeStats.totalPnl>=0?C.green:C.red},
                            {label:"Avg Win",     value:`+$${activeStats.avgWin}`, color:C.green},
                            {label:"Avg Loss",    value:`-$${activeStats.avgLoss}`, color:C.red},
                          ].map(({label,value,color})=>(
                            <div key={label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",position:"relative",overflow:"hidden"}}>
                              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:color}}/>
                              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>{label}</div>
                              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color}}>{value}</div>
                            </div>
                          ))}
                        </div>

                        {/* Compliance + insights */}
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                          {/* Compliance */}
                          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:18}}>
                            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>Rule Compliance</div>
                            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
                              <div style={{width:64,height:64,borderRadius:"50%",background:`conic-gradient(${activeStats.compliancePct>=70?C.green:activeStats.compliancePct>=50?C.amber:C.red} ${activeStats.compliancePct}%,${C.border} 0)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                <div style={{width:46,height:46,borderRadius:"50%",background:C.card,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,color:activeStats.compliancePct>=70?C.green:activeStats.compliancePct>=50?C.amber:C.red}}>{activeStats.compliancePct}%</span>
                                </div>
                              </div>
                              <div>
                                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.text,marginBottom:3}}>
                                  {activeStats.compliancePct>=70?"You follow this edge well 👌":activeStats.compliancePct>=50?"Inconsistent execution ⚠️":"Low compliance — review your rules 🔴"}
                                </div>
                                <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>{activeStats.linked.filter(t=>t.rating>=4).length} of {activeStats.count} trades rated 4★+</div>
                              </div>
                            </div>
                          </div>

                          {/* Insights */}
                          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:18}}>
                            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>Edge Insights</div>
                            <div style={{display:"flex",flexDirection:"column",gap:8}}>
                              {[
                                activeStats.bestSym && {icon:"🏆",label:"Best instrument",value:activeStats.bestSym},
                                activeStats.bestHour && {icon:"🕐",label:"Best time",value:`${activeStats.bestHour}:00`},
                                {icon:"📊",label:"Trades logged",value:String(activeStats.count)},
                                {icon:"💰",label:"Avg per trade",value:`${activeStats.avgPnl>=0?"+":""}$${activeStats.avgPnl}`},
                              ].filter(Boolean).map(({icon,label,value})=>(
                                <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim}}>{icon} {label}</span>
                                  <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:C.text}}>{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Entry Rules */}
                        {activeEdge.rules?.filter(r=>r.trim()).length>0 && (
                          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:18}}>
                            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>Entry Rules</div>
                            <div style={{display:"flex",flexDirection:"column",gap:7}}>
                              {activeEdge.rules.filter(r=>r.trim()).map((r,i)=>(
                                <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 12px",background:C.surface,borderRadius:8,border:`1px solid ${C.border}`}}>
                                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:activeEdge.color,flexShrink:0,fontWeight:700}}>{i+1}.</span>
                                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.text}}>{r}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recent trades */}
                        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                          <div style={{padding:"12px 18px",borderBottom:`1px solid ${C.border}`,fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Recent Trades</div>
                          <table style={{width:"100%",borderCollapse:"collapse"}}>
                            <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                              {["Date","Symbol","Side","R:R","P&L","Rating"].map(h=><th key={h} style={{padding:"8px 14px",textAlign:"left",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.07em",textTransform:"uppercase",fontWeight:400}}>{h}</th>)}
                            </tr></thead>
                            <tbody>{activeStats.linked.slice(0,8).map((t,i)=>(
                              <tr key={i} style={{borderBottom:i<Math.min(7,activeStats.linked.length-1)?`1px solid ${C.border}`:"none"}}
                                onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                                <td style={{padding:"9px 14px",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>{t.trade_date}</td>
                                <td style={{padding:"9px 14px",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13}}>{t.symbol}</td>
                                <td style={{padding:"9px 14px"}}><span style={{background:t.side==="Long"?`${C.green}18`:`${C.red}18`,color:t.side==="Long"?C.green:C.red,borderRadius:4,padding:"2px 7px",fontFamily:"'Space Mono',monospace",fontSize:9}}>{t.side}</span></td>
                                <td style={{padding:"9px 14px",fontFamily:"'Space Mono',monospace",fontSize:11,color:t.rr>=0?C.green:C.red,fontWeight:700}}>{t.rr}R</td>
                                <td style={{padding:"9px 14px",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:t.pnl>=0?C.green:C.red}}>{t.pnl>=0?"+":""}${t.pnl}</td>
                                <td style={{padding:"9px 14px"}}>{t.rating?<span style={{fontSize:11}}>{"⭐".repeat(t.rating)}</span>:<span style={{color:C.muted,fontSize:10}}>–</span>}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      </>)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>;
        })()}

        {/* ── PSYCHOLOGY ──────────────────────────────────────────────────────── */}
        {tab==="psychology"&&(()=>{
          const pnlByDate2 = {};
          trades.forEach(t => { pnlByDate2[t.trade_date] = (pnlByDate2[t.trade_date]||0) + t.pnl; });
          const livePsychData = Object.entries(pnlByDate2).sort(([a],[b])=>a.localeCompare(b)).slice(-14).map(([date,pnl])=>({day:date.slice(5),pnl,mood:3}));
          const hasPsychData = livePsychData.length > 0;
          const avgMood = hasPsychData ? (livePsychData.reduce((a,b)=>a+b.mood,0)/livePsychData.length).toFixed(1) : "–";
          const highPnl = hasPsychData ? livePsychData.filter(d=>d.mood>=4).reduce((a,b)=>a+b.pnl,0) : 0;
          const lowPnl  = hasPsychData ? livePsychData.filter(d=>d.mood<=2).reduce((a,b)=>a+b.pnl,0) : 0;
          const checked = Object.values(hChecks).filter(Boolean).length;
          const gHabitPct = habits.length ? Math.round((checked/habits.length)*100) : 0;
          const gCleared = mood>=3 && gHabitPct>=60;
          const gCaution = (mood===3 || gHabitPct>=40) && !gCleared;
          const gVerdict = gCleared ? "CLEAR TO TRADE" : gCaution ? "TRADE WITH CAUTION" : mood===0 ? "COMPLETE CHECK-IN FIRST" : "DO NOT TRADE";
          const gColor = gCleared ? C.green : gCaution ? C.amber : mood===0 ? C.muted : C.red;
          const gEmoji = gCleared ? "✅" : gCaution ? "⚠️" : mood===0 ? "📋" : "🛑";
          const gScore = mood>0 ? Math.round((mood/5*0.5 + gHabitPct/100*0.5)*100) : null;

          return <div style={{display:"flex",flexDirection:"column",gap:isMobile?14:22}}>
            <div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Mental Edge</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:isMobile?22:28,fontWeight:800,marginTop:4}}>Psychology</div>
            </div>

            {/* Guard verdict — compact on mobile */}
            <div style={{background:`${gColor}0f`,border:`2px solid ${gColor}44`,borderRadius:14,padding:isMobile?"14px 16px":"18px 24px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
              <div style={{fontSize:isMobile?28:38}}>{gEmoji}</div>
              <div style={{flex:1,minWidth:140}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:gColor,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:2}}>Today's Verdict</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:isMobile?16:22,color:gColor}}>{gVerdict}</div>
              </div>
              {gScore!==null && <div style={{textAlign:"center",flexShrink:0}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:isMobile?28:40,color:gColor,lineHeight:1}}>{gScore}</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,marginTop:2}}>/ 100</div>
              </div>}
            </div>

            {/* Stat cards */}
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <StatCard label="Avg Mood"      value={`${avgMood}/5`} sub="This month" color={C.accent}/>
              <StatCard label="Today Habits"  value={`${checked}/${habits.length}`} sub="Completed" color={checked>=habits.length*.7?C.green:C.accent}/>
              {!isMobile && <>
                <StatCard label="High Mood P&L" value={`$${Math.round(highPnl).toLocaleString()}`} sub="Mood ≥ 4 days" color={C.green}/>
                <StatCard label="Low Mood P&L"  value={`$${Math.round(lowPnl)}`} sub="Mood ≤ 2 days" color={C.red}/>
              </>}
            </div>

            {/* Chart — hide on mobile */}
            {!isMobile && (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>Mood vs P&L Correlation</div>
                {hasPsychData ? <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={livePsychData}><defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.purple} stopOpacity={.3}/><stop offset="95%" stopColor={C.purple} stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                    <XAxis dataKey="day" tick={{fill:C.muted,fontSize:10,fontFamily:"'Space Mono',monospace"}} axisLine={false} tickLine={false}/>
                    <YAxis yAxisId="mood" orientation="right" domain={[0,5]} tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}★`}/>
                    <YAxis yAxisId="pnl" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`}/>
                    <Tooltip contentStyle={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,fontFamily:"'Space Mono',monospace",fontSize:11}}/>
                    <ReferenceLine yAxisId="pnl" y={0} stroke={C.border}/>
                    <Bar yAxisId="pnl" dataKey="pnl" radius={[3,3,0,0]} opacity={.5}>{livePsychData.map((d,i)=><Cell key={i} fill={d.pnl>=0?C.green:C.red}/>)}</Bar>
                    <Area yAxisId="mood" type="monotone" dataKey="mood" stroke={C.purple} strokeWidth={2.5} fill="url(#mg)" dot={{fill:C.purple,r:4}}/>
                  </AreaChart>
                </ResponsiveContainer> : <div style={{height:180,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>No data yet — log trades and check-ins</div>}
              </div>
            )}

            {/* Check-in + habits — stacked on mobile, grid on desktop */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:isMobile?14:14}}>
              {/* Check-in */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:isMobile?16:22}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>Today's Check-In</div>
                <div style={{marginBottom:14}}>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,marginBottom:10}}>How are you feeling?</div>
                  <div style={{display:"flex",gap:isMobile?5:7}}>
                    {MOOD_OPTIONS.map(m=>(
                      <div key={m.val} onClick={()=>setMood(m.val)} style={{flex:1,padding:isMobile?"8px 2px":"9px 4px",borderRadius:8,cursor:"pointer",textAlign:"center",border:`1px solid ${mood===m.val?C.purple:C.border}`,background:mood===m.val?"#a78bfa22":C.surface,transition:"all 0.15s"}}>
                        <div style={{fontSize:isMobile?20:18}}>{m.emoji}</div>
                        {!isMobile && <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:mood===m.val?C.purple:C.muted,marginTop:3}}>{m.label}</div>}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
                  {habits.map(h=>(
                    <label key={h.id} onClick={()=>setHChecks(c=>({...c,[h.id]:!c[h.id]}))}
                      style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"8px 10px",borderRadius:8,background:hChecks[h.id]?C.accentDim:C.surface,border:`1px solid ${hChecks[h.id]?C.accent+"44":C.border}`,transition:"all 0.15s"}}>
                      <span style={{fontSize:14}}>{h.icon}</span>
                      <span style={{flex:1,fontFamily:"'DM Sans',sans-serif",fontSize:13,color:hChecks[h.id]?C.text:C.textDim}}>{h.label}</span>
                      <div style={{width:18,height:18,borderRadius:4,border:`1.5px solid ${hChecks[h.id]?C.green:C.border}`,background:hChecks[h.id]?`${C.green}22`:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {hChecks[h.id]&&<span style={{color:C.green,fontSize:11}}>✓</span>}
                      </div>
                    </label>
                  ))}
                </div>
                {!isMobile && <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="How's your mindset today?" style={{width:"100%",minHeight:60,boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:10,resize:"vertical",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",marginBottom:10}}/>}
                <button onClick={saveCheckin} style={{width:"100%",background:checkinSaved?"#00d08422":"#a78bfa22",border:`1px solid ${checkinSaved?"#00d08466":"#a78bfa66"}`,color:checkinSaved?C.green:C.purple,borderRadius:8,padding:"12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:700,transition:"all 0.2s"}}>
                  {checkinSaved ? "✓ Saved!" : "💾 Save Check-In"}
                </button>
              </div>

              {/* Manage habits */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:isMobile?16:22,display:"flex",flexDirection:"column",gap:10}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Manage Habits</div>
                {cats.map(cat=>(
                  <div key={cat}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.accent,letterSpacing:"0.1em",marginBottom:6}}>{cat.toUpperCase()}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:5}}>
                      {habits.filter(h=>h.category===cat).map(h=>(
                        <div key={h.id} style={{display:"flex",alignItems:"center",gap:10,background:C.surface,borderRadius:8,padding:"7px 12px",border:`1px solid ${C.border}`}}>
                          <span style={{fontSize:14}}>{h.icon}</span>
                          <span style={{flex:1,fontFamily:"'DM Sans',sans-serif",fontSize:13}}>{h.label}</span>
                          <button onClick={()=>setHabits(hh=>hh.filter(x=>x.id!==h.id))} style={{background:"transparent",border:"none",color:C.red,cursor:"pointer",fontSize:13,opacity:.6}}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div style={{display:"flex",gap:7,marginTop:4}}>
                  <input value={newHabit} onChange={e=>setNewHabit(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter"&&newHabit.trim()){setHabits(hh=>[...hh,{id:Date.now().toString(),label:newHabit.trim(),icon:"⚡",category:"Mindset"}]);setNewHabit("");}}}
                    placeholder="Add custom habit..." style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}/>
                  <button onClick={()=>{if(newHabit.trim()){setHabits(hh=>[...hh,{id:Date.now().toString(),label:newHabit.trim(),icon:"⚡",category:"Mindset"}]);setNewHabit("");}}}
                    style={{background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:8,padding:"9px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:12}}>+ Add</button>
                </div>
              </div>
            </div>

            {/* ── Session Journal ── */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:isMobile?14:22}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
                <div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Session Journal</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim,marginTop:2}}>Pre-market plan & post-market recap</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button onClick={()=>setSessionDate(prev=>{const d=new Date(prev+"T12:00");d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);})}
                    style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 12px",cursor:"pointer",color:C.textDim,fontFamily:"'Space Mono',monospace",fontSize:12}}>←</button>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.text,minWidth:100,textAlign:"center"}}>{sessionDate===todayStr?"Today":sessionDate}</span>
                  <button onClick={()=>setSessionDate(prev=>{const d=new Date(prev+"T12:00");d.setDate(d.getDate()+1);const t=new Date();const ts=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;return d.toISOString().slice(0,10)<=ts?d.toISOString().slice(0,10):prev;})}
                    style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 12px",cursor:"pointer",color:C.textDim,fontFamily:"'Space Mono',monospace",fontSize:12}}>→</button>
                  <button onClick={()=>setSessionDate(todayStr)}
                    style={{background:sessionDate===todayStr?C.accentDim:C.surface,border:`1px solid ${sessionDate===todayStr?C.accent+"44":C.border}`,borderRadius:6,padding:"5px 12px",cursor:"pointer",color:sessionDate===todayStr?C.accent:C.textDim,fontFamily:"'Space Mono',monospace",fontSize:10}}>Today</button>
                </div>
              </div>

              {/* Session day P&L */}
              {(() => {
                const dayPnl = trades.filter(t=>t.trade_date===sessionDate).reduce((a,t)=>a+t.pnl,0);
                const dayTrades = trades.filter(t=>t.trade_date===sessionDate).length;
                if (!dayTrades) return null;
                return (
                  <div style={{background:C.surface,borderRadius:8,padding:"10px 14px",marginBottom:14,display:"flex",gap:16,alignItems:"center"}}>
                    <div><div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,textTransform:"uppercase"}}>P&L</div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:dayPnl>=0?C.green:C.red}}>{dayPnl>=0?"+":""}${Math.round(dayPnl).toLocaleString()}</div></div>
                    <div><div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,textTransform:"uppercase"}}>Trades</div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16}}>{dayTrades}</div></div>
                  </div>
                );
              })()}

              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
                {/* Pre-market plan */}
                <div>
                  <label style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.accent,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:6,display:"block"}}>📋 Pre-market Plan</label>
                  <textarea
                    value={currentSession.plan}
                    onChange={e=>saveSession(sessionDate,{...currentSession,plan:e.target.value})}
                    placeholder={"What's your plan for today?\n• Key levels to watch\n• Setups you're looking for\n• Max loss / targets"}
                    style={{width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",resize:"vertical",minHeight:120,lineHeight:1.6}}/>
                </div>
                {/* Post-market recap */}
                <div>
                  <label style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.purple,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:6,display:"block"}}>🔍 Post-market Recap</label>
                  <textarea
                    value={currentSession.recap}
                    onChange={e=>saveSession(sessionDate,{...currentSession,recap:e.target.value})}
                    placeholder={"How did the session go?\n• Did you follow your plan?\n• Key mistakes made\n• What to improve tomorrow"}
                    style={{width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",resize:"vertical",minHeight:120,lineHeight:1.6}}/>
                </div>
              </div>

              {/* Emotion + mistakes */}
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginTop:14}}>
                <div>
                  <label style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8,display:"block"}}>Emotional State</label>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {[{e:"😤",l:"Frustrated"},{e:"😰",l:"Anxious"},{e:"😐",l:"Neutral"},{e:"😊",l:"Confident"},{e:"🔥",l:"In the zone"}].map(({e,l})=>(
                      <button key={l} onClick={()=>saveSession(sessionDate,{...currentSession,emotion:currentSession.emotion===l?"":l})}
                        style={{background:currentSession.emotion===l?C.accentDim:C.surface,border:`1px solid ${currentSession.emotion===l?C.accent+"55":C.border}`,borderRadius:8,padding:"6px 10px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                        <span style={{fontSize:18}}>{e}</span>
                        <span style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:currentSession.emotion===l?C.accent:C.muted}}>{l}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.red,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:6,display:"block"}}>⚠️ Mistakes / Lessons</label>
                  <textarea
                    value={currentSession.mistakes}
                    onChange={e=>saveSession(sessionDate,{...currentSession,mistakes:e.target.value})}
                    placeholder="What mistakes did you make? What's the lesson?"
                    style={{width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",resize:"vertical",minHeight:90,lineHeight:1.6}}/>
                </div>
              </div>

              {/* Session score */}
              <div style={{marginTop:14,padding:"12px 16px",background:C.surface,borderRadius:8,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,textTransform:"uppercase"}}>Session Score</div>
                <div style={{display:"flex",gap:6}}>
                  {[1,2,3,4,5].map(n=>(
                    <button key={n} onClick={()=>saveSession(sessionDate,{...currentSession,score:currentSession.score===n?0:n})}
                      style={{background:"transparent",border:"none",cursor:"pointer",fontSize:22,opacity:n<=currentSession.score?1:0.25,filter:n<=currentSession.score?"none":"grayscale(1)",transition:"all 0.1s"}}>
                      ⭐
                    </button>
                  ))}
                </div>
                {currentSession.score>0 && (
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim}}>
                    {currentSession.score===5?"Perfect execution":currentSession.score>=4?"Strong session":currentSession.score>=3?"Solid but room to improve":currentSession.score>=2?"Difficult session":"Tough day — keep going"}
                  </span>
                )}
                <span style={{marginLeft:"auto",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.green}}>✓ Auto-saved</span>
              </div>
            </div>
          </div>;
        })()}

        {/* ── PROP FIRM ───────────────────────────────────────────────────────── */}
        {tab==="propfirm"&&(()=>{

          // ── Disclaimer banner ─────────────────────────────────────────────────
          const RuleDisclaimer = () => (
            <div style={{background:`${C.amber}0d`,border:`1px solid ${C.amber}44`,borderRadius:10,padding:"12px 16px",display:"flex",gap:10,alignItems:"flex-start"}}>
              <span style={{fontSize:16,flexShrink:0}}>⚠️</span>
              <div>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.amber,fontWeight:700}}>RULES VERIFIED MARCH 2026 — </span>
                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim}}>Prop firm rules change frequently without notice. Always verify current rules on your firm's official website before trading. FundVault is not responsible for rule inaccuracies.</span>
                <div style={{display:"flex",gap:12,marginTop:6,flexWrap:"wrap"}}>
                  {DEFAULT_PROP_FIRMS.map(f=>(
                    <a key={f.id} href={f.website} target="_blank" rel="noreferrer"
                      style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.accent,letterSpacing:"0.04em"}}>
                      {f.name} ↗
                    </a>
                  ))}
                </div>
              </div>
            </div>
          );


          // ── Empty state ───────────────────────────────────────────────────────
          if (propAccounts.length === 0) return (
            <div style={{display:"flex",flexDirection:"column",gap:22}}>
              <RuleDisclaimer />
              {showPropWizard && <PropFirmWizardModal
            C={C}
            wizardStep={wizardStep} setWizardStep={setWizardStep}
            wizardFirmId={wizardFirmId} setWizardFirmId={setWizardFirmId}
            wizardTypeId={wizardTypeId} setWizardTypeId={setWizardTypeId}
            wizardBalance={wizardBalance} setWizardBalance={setWizardBalance}
            wizardNickname={wizardNickname} setWizardNickname={setWizardNickname}
            editingPropAcc={editingPropAcc}
            addPropAccount={addPropAccount}
            onClose={()=>{setShowPropWizard(false);setWizardStep(1);setWizardFirmId(null);setWizardTypeId(null);setWizardBalance("");setWizardNickname("");setEditingPropAcc(null);}}
          />}
              <div><div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.amber,letterSpacing:"0.1em",textTransform:"uppercase"}}>Live Tracking</div><div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,marginTop:4}}>Prop Firm Tracker</div></div>
              <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:16,padding:"60px 40px",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
                <div style={{fontSize:48}}>🏢</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22}}>No prop accounts yet</div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:C.textDim,maxWidth:420,lineHeight:1.6}}>
                  Add your prop firm account to start tracking drawdown, payout progress, consistency rules, and more — specific to your firm's exact rules.
                </div>
                <button onClick={()=>setShowPropWizard(true)}
                  style={{marginTop:8,padding:"14px 32px",borderRadius:10,cursor:"pointer",background:`linear-gradient(135deg,${C.accent}33,${C.accent}11)`,border:`1px solid ${C.accent}55`,color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>
                  + Add My First Account
                </button>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center",marginTop:4}}>
                  {DEFAULT_PROP_FIRMS.map(f=>(
                    <span key={f.id} style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:f.color,background:`${f.color}18`,border:`1px solid ${f.color}33`,borderRadius:20,padding:"3px 12px"}}>{f.name}</span>
                  ))}
                </div>
              </div>
            </div>
          );

          // ── Active account tracker ─────────────────────────────────────────────
          const curAcc  = propAccounts.find(a=>a.id===activePropAccId) || propAccounts[0];
          const curFirm = firms.find(f=>f.id===curAcc?.firmId) || firms[0];
          const curType = curFirm?.accountTypes.find(t=>t.id===curAcc?.typeId) || curFirm?.accountTypes[0];

          // Sync firm/type state with active account
          if (curFirm?.id !== activeFirm) setActiveFirm(curFirm?.id);
          if (curType?.id !== curFirm?.activeType) setFirmAccountType(curFirm?.id, curType?.id);

          const profit = acct.balance - acct.startBalance;
          const dd     = acct.peakBalance - acct.balance;
          const saveStartBalance = (firmId, val) => {
            const num = parseFloat(val.replace(/[^0-9.]/g,""));
            if (!num || isNaN(num)) return;
            const updated = { ...startBalances, [firmId]: num };
            setStartBalances(updated);
            localStorage.setItem("edgestat_startbal", JSON.stringify(updated));
            setEditingBalance(null);
            // Also update propAccount startBalance
            savePropAccounts(propAccounts.map(a => a.id===curAcc.id ? {...a, startBalance:num} : a));
          };
          const po     = curType?.payout || {cycleTarget:3000,minDays:5,minProfit:0,buffer:0,consistency:999};
          const dlRule = curType?.rules?.find(r=>r.type==="loss");
          const ddRule = curType?.rules?.find(r=>r.type==="drawdown");
          const ptRule = curType?.rules?.find(r=>r.type==="target");

          return <div style={{display:"flex",flexDirection:"column",gap:22}}>
            <RuleDisclaimer />
            {showPropWizard && <PropFirmWizardModal
            C={C}
            wizardStep={wizardStep} setWizardStep={setWizardStep}
            wizardFirmId={wizardFirmId} setWizardFirmId={setWizardFirmId}
            wizardTypeId={wizardTypeId} setWizardTypeId={setWizardTypeId}
            wizardBalance={wizardBalance} setWizardBalance={setWizardBalance}
            wizardNickname={wizardNickname} setWizardNickname={setWizardNickname}
            editingPropAcc={editingPropAcc}
            addPropAccount={addPropAccount}
            onClose={()=>{setShowPropWizard(false);setWizardStep(1);setWizardFirmId(null);setWizardTypeId(null);setWizardBalance("");setWizardNickname("");setEditingPropAcc(null);}}
          />}

            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
              <div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.amber,letterSpacing:"0.1em",textTransform:"uppercase"}}>Live Tracking</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,marginTop:4}}>Prop Firm Tracker</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {liveAcctData
                  ? <span style={{background:`${C.green}18`,border:`1px solid ${C.green}44`,borderRadius:6,padding:"3px 10px",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.green}}>⚡ LIVE — Tradovate</span>
                  : trades.length > 0 ? <span style={{background:`${C.accent}11`,border:`1px solid ${C.accent}33`,borderRadius:6,padding:"3px 10px",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.accent}}>📊 Calculated from logged trades</span> : null
                }
                <button onClick={()=>{setShowPropWizard(true);setWizardStep(1);setWizardFirmId(null);setWizardTypeId(null);setWizardBalance("");setWizardNickname("");setEditingPropAcc(null);}}
                  style={{background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.accent,fontWeight:700}}>
                  + Add Account
                </button>
              </div>
            </div>

            {/* Account switcher (if multiple) */}
            {propAccounts.length > 1 && (
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {propAccounts.map(a=>{
                  const af = firms.find(f=>f.id===a.firmId);
                  const isActive = a.id === (activePropAccId || propAccounts[0]?.id);
                  return (
                    <button key={a.id} onClick={()=>setActivePropAccount(a.id)}
                      style={{padding:"8px 16px",borderRadius:8,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:isActive?700:400,background:isActive?`${af?.color||C.accent}22`:C.surface,border:`2px solid ${isActive?af?.color||C.accent:C.border}`,color:isActive?af?.color||C.accent:C.textDim,transition:"all 0.15s"}}>
                      {a.nickname}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Active account card */}
            <div style={{background:C.card,border:`2px solid ${curFirm?.color||C.accent}44`,borderRadius:12,padding:"16px 20px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
              <div style={{width:44,height:44,borderRadius:10,background:`${curFirm?.color||C.accent}18`,border:`1px solid ${curFirm?.color||C.accent}33`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:curFirm?.color||C.accent,flexShrink:0}}>
                {curFirm?.name?.slice(0,2).toUpperCase()}
              </div>
              <div style={{flex:1,minWidth:160}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:17}}>{curAcc?.nickname}</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,marginTop:2}}>{curFirm?.name} · {curType?.label} · {curType?.payoutSplit}% split</div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>{
                  setEditingPropAcc(curAcc.id);
                  setWizardFirmId(curAcc.firmId);
                  setWizardTypeId(curAcc.typeId);
                  setWizardBalance(String(curAcc.startBalance));
                  setWizardNickname(curAcc.nickname);
                  setWizardStep(3);
                  setShowPropWizard(true);
                }} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>✏ Edit</button>
                <button onClick={()=>{
                  const updated = propAccounts.filter(a=>a.id!==curAcc.id);
                  savePropAccounts(updated);
                  setActivePropAccount(updated[0]?.id || null);
                }} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.red}}>✕ Remove</button>
              </div>
            </div>

            {/* Stat cards */}
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <StatCard label="Account Balance" value={`$${Math.round(acct.balance).toLocaleString()}`} sub={
                editingBalance === activeFirm
                  ? <span style={{display:"flex",alignItems:"center",gap:4}}>
                      <input autoFocus value={editBalVal} onChange={e=>setEditBalVal(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter")saveStartBalance(activeFirm,editBalVal);if(e.key==="Escape")setEditingBalance(null);}}
                        style={{width:80,background:C.bg,border:`1px solid ${C.accent}44`,borderRadius:4,padding:"2px 6px",color:C.text,fontFamily:"'Space Mono',monospace",fontSize:10,outline:"none"}}
                        placeholder={String(curAcc?.startBalance||50000)}/>
                      <button onClick={()=>saveStartBalance(activeFirm,editBalVal)} style={{background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:4,padding:"2px 8px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.accent}}>✓</button>
                      <button onClick={()=>setEditingBalance(null)} style={{background:"transparent",border:"none",cursor:"pointer",color:C.muted,fontSize:12}}>✕</button>
                    </span>
                  : <span style={{cursor:"pointer",color:C.muted,fontSize:10,fontFamily:"'Space Mono',monospace"}} onClick={()=>{setEditingBalance(activeFirm);setEditBalVal(String(acct.startBalance));}}>
                      Start: ${acct.startBalance.toLocaleString()} ✏
                    </span>
              } color={C.accent}/>
              <StatCard label="Total Profit"  value={`${profit>=0?"+":""}$${Math.abs(profit).toLocaleString()}`} sub={ptRule?`Target: $${ptRule.value.toLocaleString()}`:"Funded"} color={profit>=0?C.green:C.red}/>
              <StatCard label="Today P&L"     value={`${acct.todayPnl>=0?"+":""}$${Math.round(acct.todayPnl).toLocaleString()}`} sub={dlRule?`Limit: -$${dlRule.value.toLocaleString()}`:"No daily limit"} color={acct.todayPnl>=0?C.green:C.red}/>
              <StatCard label="Drawdown"       value={`$${dd.toLocaleString()}`} sub={ddRule?`Max: $${ddRule.value.toLocaleString()}`:"—"} color={ddRule&&dd>ddRule.value*.75?C.red:C.amber}/>
              <StatCard label="Payout Split"   value={`${curType?.payoutSplit||90}%`} sub={(curType?.payoutFreq||"").split("(")[0].trim()} color={curFirm?.color||C.accent}/>
            </div>

            {/* Rule cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:13}}>
              {(curType?.rules||[]).map(rule=>{
                const s=getPropStatus(rule); const sColor=sc(s.status);
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
                  setFirms(ff=>ff.map(f=>f.id!==activeFirm?f:{...f,accountTypes:f.accountTypes.map(t=>t.id!==f.activeType?t:{...t,rules:[...t.rules,nr]})}));
                  setNewRule({label:"",type:"loss",value:""});
                }} style={{width:"100%",background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:8,padding:"10px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase"}}>+ Add Rule</button>
              </div>
            </div>

            {/* Payout Tracker */}
            {(()=>{
              const cycPct      = Math.min(1,(acct.cycleProfit||0)/Math.max(po.cycleTarget,1));
              const daysPct     = Math.min(1,(acct.cycleWinDays||0)/Math.max(po.minDays,1));
              const noConsist   = po.consistency>=900;
              const consistOk   = noConsist || (acct.bestDayPct||0)<=po.consistency;
              const canPayout   = cycPct>=1 && (po.minDays===0||daysPct>=1) && consistOk;
              const consistRisk = !noConsist && (acct.bestDayPct||0)>po.consistency*0.8;
              const drawdownRisk= (acct.peakBalance-acct.balance)>(ddRule?.value||2000)*0.6;
              let payoutAdvice=""; let adviceColor=C.accent;
              if(canPayout){payoutAdvice="✓ All conditions met — request payout now";adviceColor=C.green;}
              else if(cycPct>=0.75&&(po.minDays===0||daysPct>=1)&&consistOk){payoutAdvice="Almost there — hold off 1–2 sessions to hit target";adviceColor=C.accent;}
              else if(consistRisk&&cycPct>=0.5){payoutAdvice="⚠ Consistency near limit — consider stopping to protect this cycle";adviceColor=C.amber;}
              else if(drawdownRisk&&cycPct>=0.5){payoutAdvice="⚠ Drawdown rising — consider banking profits now";adviceColor=C.amber;}
              else{payoutAdvice=`Still building — $${Math.round((1-cycPct)*po.cycleTarget).toLocaleString()} more needed`;adviceColor=C.textDim;}
              return <div style={{background:C.card,border:`1px solid ${canPayout?C.green+"55":C.border}`,borderRadius:12,padding:22,position:"relative",overflow:"hidden"}}>
                {canPayout&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.green},${C.accent})`}}/>}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
                  <div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:canPayout?C.green:C.amber,letterSpacing:"0.1em",textTransform:"uppercase"}}>Payout Tracker</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,marginTop:2}}>{curFirm?.name} · {curType?.label} · {curType?.payoutSplit}% Split</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,marginTop:3}}>{curType?.payoutFreq} · Min payout ${curType?.minPayout}</div>
                  </div>
                  {canPayout&&<div style={{background:C.green+"22",border:`1px solid ${C.green}55`,borderRadius:8,padding:"8px 16px",fontFamily:"'Space Mono',monospace",fontSize:12,color:C.green,fontWeight:700}}>🎉 READY</div>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:20}}>
                  <div style={{background:C.surface,borderRadius:10,padding:16,border:`1px solid ${cycPct>=1?C.green+"44":C.border}`}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Cycle Profit</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:cycPct>=1?C.green:C.text}}>${(acct.cycleProfit||0).toLocaleString()}</div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginTop:2}}>target ${po.cycleTarget.toLocaleString()} · your cut ~${Math.round((acct.cycleProfit||0)*(curType?.payoutSplit||90)/100).toLocaleString()}</div>
                    <div style={{height:4,background:C.border,borderRadius:2,marginTop:10,overflow:"hidden"}}><div style={{height:"100%",width:`${cycPct*100}%`,background:cycPct>=1?C.green:curFirm?.color||C.accent,borderRadius:2,transition:"width 0.5s"}}/></div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:cycPct>=1?C.green:C.textDim,marginTop:5}}>{Math.round(cycPct*100)}% of target</div>
                  </div>
                  <div style={{background:C.surface,borderRadius:10,padding:16,border:`1px solid ${daysPct>=1?C.green+"44":C.border}`}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Qualifying Days</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:daysPct>=1?C.green:C.text}}>{acct.cycleWinDays||0}<span style={{fontSize:14,color:C.muted,fontWeight:400}}> / {po.minDays}</span></div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginTop:2}}>{po.minProfit>0?`$${po.minProfit}+ profit each`:"profitable days"}</div>
                    <div style={{display:"flex",gap:4,marginTop:10}}>{Array.from({length:Math.max(po.minDays,1)},(_,i)=><div key={i} style={{flex:1,height:8,borderRadius:3,background:i<(acct.cycleWinDays||0)?C.green:C.border}}/>)}</div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:daysPct>=1?C.green:C.textDim,marginTop:5}}>{po.minDays-(acct.cycleWinDays||0)>0?`${po.minDays-(acct.cycleWinDays||0)} more needed`:"✓ Met"}</div>
                  </div>
                  <div style={{background:C.surface,borderRadius:10,padding:16,border:`1px solid ${noConsist?"#34d39933":consistOk?C.green+"44":C.red+"55"}`}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Consistency Rule</div>
                    {noConsist
                      ? <><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:"#34d399"}}>No Rule ✓</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim,marginTop:4}}>No consistency restriction on this plan</div></>
                      : <><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:consistOk?C.text:C.red}}>{acct.bestDayPct||0}<span style={{fontSize:14,color:C.muted,fontWeight:400}}>%</span></div>
                          <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginTop:2}}>best day · limit {po.consistency}%</div>
                          <div style={{height:4,background:C.border,borderRadius:2,marginTop:10,overflow:"hidden"}}><div style={{height:"100%",width:`${((acct.bestDayPct||0)/po.consistency)*100}%`,background:consistOk?(acct.bestDayPct||0)>po.consistency*.8?C.amber:C.green:C.red,borderRadius:2}}/></div>
                          <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:consistOk?C.green:C.red,marginTop:5}}>{consistOk?`${po.consistency-(acct.bestDayPct||0)}% headroom`:"⚠ Exceeded"}</div>
                        </>
                    }
                  </div>
                </div>
                <div style={{background:`${adviceColor}0d`,border:`1px solid ${adviceColor}44`,borderRadius:8,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:18}}>{canPayout?"💰":consistRisk||drawdownRisk?"⚠️":"🎯"}</span>
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:adviceColor}}>{payoutAdvice}</div>
                    {canPayout&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim,marginTop:3}}>Estimated payout: <span style={{color:C.green,fontWeight:700}}>${Math.round((acct.cycleProfit||0)*(curType?.payoutSplit||90)/100).toLocaleString()}</span> after {curType?.payoutSplit}% split</div>}
                  </div>
                </div>
              </div>;
            })()}
          </div>;
        })()}

        {/* ── NEWS / ECONOMIC CALENDAR ────────────────────────────────────────── */}
        {tab==="news"&&<NewsTab econFilter={econFilter} setEconFilter={setEconFilter} C={C} newsBlocker={newsBlocker} saveNewsBlocker={saveNewsBlocker} onEventsLoaded={setCalendarEvents}/>}

        {/* ── ACCOUNTS ────────────────────────────────────────────────────────── */}
        {tab==="accounts"&&(()=>{
          if (!canAccess("advanced")) return <UpgradeGate plan="advanced" C={C} onUpgrade={()=>setTab("myaccount")} feature="Tradovate & NinjaTrader sync" desc="Connect your broker accounts to automatically import trades and track live P&L." />;
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
              const res = await fetch(`${API}/tradovate/login`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(tvLoginForm),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Login failed");
              // Reload accounts from backend
              const accRes = await fetch(`${API}/tradovate/connected-accounts`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (accRes.ok) setTvAccounts(await accRes.json());
              setShowTvLogin(false); setTvLoginStep("credentials");
              setTvLoginForm({username:"",password:"",cid:"",secret:""});
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
                <button onClick={async () => {
                  try {
                    const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
                    const { data: { session } } = await supabase.auth.getSession();
                    const res = await fetch(`${API}/tradovate/connect`, {
                      headers: { Authorization: `Bearer ${session?.access_token}` }
                    });
                    const { url, error } = await res.json();
                    if (error) { alert(error); return; }
                    window.location.href = url;
                  } catch(e) { alert("Could not start Tradovate connection: " + e.message); }
                }}
                  style={{background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"8px 18px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.accent,fontWeight:700}}>
                  + Connect to Tradovate
                </button>

              </div>
            </div>

            {/* Info-banner */}
            <div style={{background:"#00e5ff08",border:"1px solid #00e5ff22",borderRadius:10,padding:"14px 18px",display:"flex",gap:14,alignItems:"flex-start"}}>
              <span style={{fontSize:20,flexShrink:0}}>🔐</span>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,lineHeight:1.6}}>
                Your Tradovate credentials are used <strong style={{color:C.text}}>only to obtain an access token</strong> stored encrypted in the database.
                Your password is never stored. Tokens are refreshed automatically.
                <br/>Every account you connect here is available in the <strong style={{color:C.text}}>Trade Copier</strong> tab.
              </div>
            </div>

            {/* Anslutna konton */}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {tvAccounts.length===0 ? (
                <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:12,padding:40,textAlign:"center"}}>
                  <div style={{fontSize:32,marginBottom:12}}>📡</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,marginBottom:6}}>No accounts connected</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.muted}}>Connect your Tradovate accounts to enable Trade Copier and live P&amp;L tracking</div>
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

            {/* ── Login modal ─────────────────────────────────────────────── */}
            {showTvLogin && (
              <div style={{position:"fixed",inset:0,background:"#00000088",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{background:"#0d1420",border:"1px solid #1e2d40",borderRadius:16,padding:32,width:440,maxWidth:"95vw"}}>

                  {tvLoginStep==="credentials" && <>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,marginBottom:4}}>Connect Tradovate</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.muted,marginBottom:24}}>Log in with your Tradovate credentials</div>

                    <div style={{display:"flex",flexDirection:"column",gap:12}}>
                      {[
                        {label:"Username",  key:"username", type:"text",     placeholder:"your.name@email.com"},
                        {label:"Password",  key:"password", type:"password", placeholder:"••••••••"},
                      ].map(f=>(
                        <div key={f.key}>
                          <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>{f.label}</div>
                          <input type={f.type} value={tvLoginForm[f.key]}
                            onChange={e=>setTvLoginForm(x=>({...x,[f.key]:e.target.value}))}
                            onKeyDown={e=>e.key==="Enter"&&doTvLogin()}
                            placeholder={f.placeholder}
                            autoComplete="new-password"
                            style={{width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"11px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}/>
                        </div>
                      ))}

                      {/* CID/Secret — behövs för Tradovate API-app */}
                      <details style={{marginTop:4}}>
                        <summary style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,cursor:"pointer",userSelect:"none",letterSpacing:"0.07em",textTransform:"uppercase"}}>
                          Advanced — API App credentials (optional)
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
                            💡 Only required if you have your own Tradovate API app. Otherwise FundVault's built-in credentials are used.
                          </div>
                        </div>
                      </details>

                      {tvLoginError && (
                        <div style={{background:C.red+"15",border:`1px solid ${C.red}44`,borderRadius:8,padding:"10px 14px",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.red}}>
                          ⚠ {tvLoginError}
                        </div>
                      )}

                      <div style={{background:"#f59e0b11",border:"1px solid #f59e0b33",borderRadius:8,padding:"10px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim}}>
                        🔒 Your password is sent directly to Tradovate and is <strong style={{color:C.text}}>never</strong> stored in our database. Only the access token is saved.
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
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,marginBottom:4}}>Select Account</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.muted,marginBottom:20}}>Multiple accounts found — choose which one to connect</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {tvLoginAccounts.map(acc=>(
                        <div key={acc.id} onClick={()=>selectTvAccount(acc)}
                          style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,cursor:"pointer"}}
                          onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                          <div>
                            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15}}>{acc.name}</div>
                            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginTop:2}}>ID: {acc.id} · {acc.accountType||"Futures"}</div>
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

        {tab==="myaccount" && <MyAccountTab C={C} plan={plan} profile={profile} user={user} userName={userName} loadProfile={loadProfile} supabase={supabase} setTab={setTab} />}

        {/* ── TRADE COPIER ────────────────────────────────────────────────────── */}
        {tab==="copier"&&(()=>{
          if (!canAccess("pro")) return <UpgradeGate plan="pro" C={C} onUpgrade={()=>setTab("myaccount")} feature="Trade Copier" desc="Mirror trades across multiple accounts automatically. Available on the Pro plan." />;

          const activeGroup = copierGroups.find(g => g.id === activeGroupId);
          const mob = typeof window !== "undefined" && window.innerWidth <= 768;
          const dismissOnboarding = () => {
            setShowCopierOnboarding(false);
            try { localStorage.setItem("fv_copier_onboarded", "1"); } catch {}
          };

          return <div style={{display:"flex",flexDirection:"column",gap:22}}>

            {/* Onboarding overlay */}
            {showCopierOnboarding && (
              <CopierOnboarding 
                onDismiss={dismissOnboarding}
                onGoToAccounts={()=>setTab("accounts")}
                C={C}
              />
            )}

            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
              <div style={{flex:mob?1:"initial",minWidth:0}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.amber,letterSpacing:"0.1em",textTransform:"uppercase"}}>Multi-Account</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:mob?22:28,fontWeight:800,marginTop:4}}>Trade Copier</div>
                {!mob && (
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.muted,marginTop:4}}>
                    Mirrors fills from a master account to slave accounts via REST polling every 2s. 
                    Side (Buy/Sell) copied directly — no inversion bugs.
                  </div>
                )}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setShowCopierOnboarding(true)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 16px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.accent}}>
                  ? How it works
                </button>
                <button onClick={loadCopierGroups} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 16px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>
                  ↻ Refresh
                </button>
              </div>
            </div>

            {/* Active group banner */}
            {activeGroup && activeGroup.running && (
              <div style={{background:"#00d08411",border:`1px solid ${C.green}44`,borderRadius:12,padding:"14px 20px",display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:C.green,boxShadow:`0 0 10px ${C.green}`,animation:"pulse 1.5s ease-in-out infinite"}}/>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.green,letterSpacing:"0.08em",textTransform:"uppercase"}}>
                    LIVE · Copying to {activeGroup.slave_account_ids?.length} account(s) · Poll 2s
                  </div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,marginTop:2}}>{activeGroup.name}</div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginTop:2}}>
                    Master: {activeGroup.master_account_name} · 
                    {activeGroup.dry_run 
                      ? `Dry runs: ${activeGroup.stats?.dryRun || 0}` 
                      : `Copied: ${activeGroup.stats?.copied || 0} · Failed: ${activeGroup.stats?.failed || 0}`}
                  </div>
                </div>
                <button onClick={()=>stopCopierBackend(activeGroup.id)}
                  style={{background:"#ff3d5a22",border:"1px solid #ff3d5a44",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.red,fontWeight:700}}>
                  ⏹ Stop
                </button>
              </div>
            )}

            {/* No Tradovate accounts warning */}
            {tvAccounts.length < 2 && (
              <div style={{background:`${C.amber}11`,border:`1px solid ${C.amber}44`,borderRadius:10,padding:"14px 18px",display:"flex",gap:12,alignItems:"center"}}>
                <span style={{fontSize:20}}>⚠️</span>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim}}>
                  You need at least <strong style={{color:C.text}}>2 connected Tradovate accounts</strong> to use the copier — one master, one or more slaves.
                  Go to the <button onClick={()=>setTab("accounts")} style={{background:"none",border:"none",cursor:"pointer",color:C.accent,fontFamily:"'DM Sans',sans-serif",fontSize:13,textDecoration:"underline",padding:0}}>Accounts tab</button> to connect more accounts.
                </div>
              </div>
            )}

            {/* Groups list */}
            {copierLoading ? (
              <div style={{display:"flex",alignItems:"center",gap:10,color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>
                <div style={{width:16,height:16,border:`2px solid ${C.accent}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
                Loading groups...
              </div>
            ) : copierGroups.length === 0 ? (
              <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:12,padding:40,textAlign:"center"}}>
                <div style={{fontSize:36,marginBottom:12}}>📡</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,marginBottom:8}}>No copy groups yet</div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.muted,marginBottom:20}}>Create a group to start mirroring trades between your Tradovate accounts</div>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {copierGroups.map(group => {
                  const isRunning = group.running || group.active;
                  return (
                    <div key={group.id} style={{background:C.card,border:`1px solid ${isRunning?C.green+"66":C.border}`,borderRadius:12,padding:mob?16:20,display:"flex",flexDirection:"column",gap:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:mob?"flex-start":"center",flexDirection:mob?"column":"row",gap:mob?12:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0,width:mob?"100%":"auto"}}>
                          {isRunning && <div style={{width:8,height:8,borderRadius:"50%",background:C.green,boxShadow:`0 0 8px ${C.green}`,animation:"pulse 1.5s ease-in-out infinite",flexShrink:0}}/>}
                          <div style={{minWidth:0,flex:1}}>
                            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16}}>{group.name}</div>
                            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:mob?"normal":"nowrap"}}>
                              Master: <span style={{color:C.text}}>{group.master_account_name}</span>
                              {" → "}
                              {(group.slave_account_names||[]).join(", ") || `${group.slave_account_ids?.length} slave(s)`}
                            </div>
                          </div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",width:mob?"100%":"auto",justifyContent:mob?"flex-start":"flex-end"}}>
                          {/* Stats */}
                          {(group.stats?.copied > 0 || group.stats?.failed > 0) && (
                            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>
                              <span style={{color:C.green}}>✓{group.stats.copied}</span>
                              {group.stats.failed > 0 && <span style={{color:C.red}}> ✗{group.stats.failed}</span>}
                            </div>
                          )}
                          {/* Dry run badge */}
                          {group.dry_run && (
                            <span style={{background:`${C.accent}22`,border:`1px solid ${C.accent}66`,borderRadius:4,padding:"2px 8px",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.accent,fontWeight:700}}>
                              🧪 DRY RUN
                            </span>
                          )}
                          {/* Size mode badge */}
                          <span style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:"2px 8px",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>
                            {group.size_mode === "mirror" ? "Mirror" : group.size_mode === "fixed" ? `Fixed ${group.fixed_qty}` : `Ratio ${group.ratio}x`}
                          </span>
                          {/* Start/Stop */}
                          {isRunning ? (
                            <button onClick={()=>stopCopierBackend(group.id)}
                              style={{background:"#ff3d5a22",border:"1px solid #ff3d5a44",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.red,fontWeight:700}}>
                              ⏹ Stop
                            </button>
                          ) : (
                            <button onClick={()=>{startCopierBackend(group);}}
                              disabled={tvAccounts.length < 2}
                              style={{background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.accent,fontWeight:700,opacity:tvAccounts.length<2?0.4:1}}>
                              ▶ Start
                            </button>
                          )}
                          {/* Log */}
                          <button onClick={()=>loadCopierLog(group.id)}
                            style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 10px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>
                            📋 Log
                          </button>
                          {/* Delete */}
                          <button onClick={()=>deleteCopierGroup(group.id)}
                            style={{background:"transparent",border:"none",cursor:"pointer",color:C.red,fontSize:14,opacity:0.5,padding:"4px 6px"}}>✕</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Copy log */}
            {copierLog.length > 0 && (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>Recent Activity</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {copierLog.slice(0,15).map(entry => (
                    <div key={entry.id} style={{display:"flex",alignItems:mob?"flex-start":"center",gap:mob?6:10,padding:"8px 10px",background:C.surface,borderRadius:6,flexWrap:"wrap",
                      borderLeft:`3px solid ${entry.event==="copied"?C.green:entry.event==="failed"?C.red:entry.event==="dry_run"?C.accent:C.amber}`}}>
                      <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,flexShrink:0}}>
                        {new Date(entry.ts).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
                      </span>
                      <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,
                        color:entry.event==="copied"?C.green:entry.event==="failed"?C.red:entry.event==="dry_run"?C.accent:C.amber,
                        fontWeight:700,flexShrink:0,textTransform:"uppercase"}}>
                        {entry.event==="dry_run"?"🧪 DRY":entry.event}
                      </span>
                      {entry.symbol && <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.text}}>{entry.side} {entry.qty}x {entry.symbol}</span>}
                      {entry.slave_account && <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>→ {entry.slave_account}</span>}
                      {entry.error && <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.red}}>({entry.error})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create group */}
            {tvAccounts.length >= 2 && (
              <CreateCopierGroupPanel
                tvAccounts={tvAccounts}
                onCreate={createCopierGroup}
                C={C}
              />
            )}

          </div>;
        })()}

      </div>

      {/* ── Mobile Bottom Navigation ─────────────────────────────────────────── */}
      <div className="fv-bottom-nav" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:200,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"stretch",height:64,paddingBottom:"env(safe-area-inset-bottom)"}}>
        {[
          {id:"dashboard", icon:"📊", label:"Today"},
          {id:"trades",    icon:"📋", label:"Trades"},
          {id:"__add__",   icon:"➕", label:"Log",    accent:true},
          {id:"__pos__",   icon:"⚡", label:"Positions"},
          {id:"__more__",  icon:"•••", label:"More"},
        ].map(item=>{
          if(item.id==="__add__") return (
            <button key="add" onClick={()=>setShowAddTrade(true)}
              style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"transparent",border:"none",cursor:"pointer",position:"relative"}}>
              <div style={{width:44,height:44,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},${C.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:`0 4px 16px ${C.accent}44`,marginTop:-20}}>➕</div>
              <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.accent,letterSpacing:"0.05em",marginTop:2}}>Log</span>
            </button>
          );
          if(item.id==="__pos__") {
            const isActive = showMobilePositions;
            return (
              <button key="pos" onClick={()=>setShowMobilePositions(m=>!m)}
                style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"transparent",border:"none",cursor:"pointer",position:"relative",borderTop:`2px solid ${isActive?C.red:"transparent"}`}}>
                <div style={{position:"relative",display:"inline-flex"}}>
                  <span style={{fontSize:18,filter:isActive?"none":"grayscale(0.3)"}}>⚡</span>
                </div>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:isActive?C.red:C.muted,letterSpacing:"0.05em"}}>Positions</span>
              </button>
            );
          }
          if(item.id==="__more__") return (
            <button key="more" onClick={()=>setMobileMore(m=>!m)}
              style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"transparent",border:"none",cursor:"pointer"}}>
              <div style={{fontSize:18,color:mobileMore?C.accent:C.muted,fontWeight:700,letterSpacing:2}}>•••</div>
              <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:mobileMore?C.accent:C.muted,letterSpacing:"0.05em"}}>More</span>
            </button>
          );
          const isActive = tab===item.id;
          return (
            <button key={item.id} onClick={()=>{setTab(item.id);setMobileMore(false);}}
              style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"transparent",border:"none",cursor:"pointer",borderTop:`2px solid ${isActive?C.accent:"transparent"}`,transition:"all 0.15s"}}>
              <div style={{fontSize:18,filter:isActive?"none":"grayscale(1) opacity(0.5)"}}>{item.icon}</div>
              <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:isActive?C.accent:C.muted,letterSpacing:"0.05em"}}>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Mobile Positions Sheet ───────────────────────────────────────────── */}
      {showMobilePositions && (
        <div className="fv-more-sheet" style={{position:"fixed",bottom:64,left:0,right:0,zIndex:199,background:C.card,borderTop:`1px solid ${C.red}44`,borderRadius:"16px 16px 0 0",padding:"16px 16px 8px",animation:"slideUp 0.2s ease",maxHeight:"60vh",overflowY:"auto"}}>
          <div style={{width:36,height:4,borderRadius:2,background:C.border,margin:"0 auto 14px"}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16}}>⚡ Open Positions</div>
            <button onClick={()=>setShowMobilePositions(false)} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:18}}>✕</button>
          </div>
          {/* Embed FlattenWidget content inline */}
          <FlattenWidget tvStatus={tvStatus} mobileMode={true} appIsDemo={isDemo} C={C}/>
        </div>
      )}
      {showMobilePositions && <div onClick={()=>setShowMobilePositions(false)} style={{position:"fixed",inset:0,zIndex:198}} className="fv-more-sheet"/>}

      {/* ── More Sheet ───────────────────────────────────────────────────────── */}
      {mobileMore && (
        <div className="fv-more-sheet" style={{position:"fixed",bottom:64,left:0,right:0,zIndex:199,background:C.card,borderTop:`1px solid ${C.border}`,borderRadius:"16px 16px 0 0",padding:"16px 16px 8px",animation:"slideUp 0.2s ease"}}>
          <div style={{width:36,height:4,borderRadius:2,background:C.border,margin:"0 auto 16px"}}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
            {[
              {id:"analytics", icon:"📈", label:"Analytics"},
              {id:"calendar",  icon:"📅", label:"Calendar"},
              {id:"edge",      icon:"⚡", label:"Edges"},
              {id:"psychology",icon:"💭", label:"Psych"},
              {id:"propfirm",  icon:"🏢", label:"Prop Firm"},
              {id:"news",      icon:"📰", label:"News"},
              {id:"accounts",  icon:"🔗", label:"Accounts"},
              {id:"copier",    icon:"📡", label:"Copier"},
              {id:"myaccount",icon:"👤", label:"Account"},
            ].map(item=>(
              <button key={item.id} onClick={()=>{setTab(item.id);setMobileMore(false);}}
                style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,padding:"12px 8px",borderRadius:10,background:tab===item.id?C.accentDim:C.surface,border:`1px solid ${tab===item.id?C.accent+"44":C.border}`,cursor:"pointer"}}>
                <div style={{fontSize:22}}>{item.icon}</div>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:tab===item.id?C.accent:C.muted,letterSpacing:"0.04em",textAlign:"center"}}>{item.label}</span>
              </button>
            ))}
          </div>
          {/* Settings row */}
          <div style={{display:"flex",gap:8,marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
            <button onClick={toggleMode} style={{flex:1,padding:"10px",borderRadius:8,background:isDemo?"#a78bfa22":"#00e5ff11",border:`1px solid ${isDemo?"#a78bfa44":"#00e5ff22"}`,color:isDemo?"#a78bfa":"#00e5ff",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer",fontWeight:700}}>
              {isDemo?"🎭 DEMO":"⚡ LIVE"}
            </button>
            <button onClick={()=>{setShowAlerts(s=>!s);setMobileMore(false);}} style={{flex:1,padding:"10px",borderRadius:8,background:unreadCount>0?`${C.red}18`:C.surface,border:`1px solid ${unreadCount>0?C.red+"44":C.border}`,color:unreadCount>0?C.red:C.muted,fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer",position:"relative"}}>
              🔔 Alerts{unreadCount>0?` (${unreadCount})`:""}
            </button>
            <button onClick={toggleTheme} style={{padding:"10px 14px",borderRadius:8,background:C.surface,border:`1px solid ${C.border}`,color:C.muted,fontSize:16,cursor:"pointer"}}>
              {darkMode?"☀️":"🌙"}
            </button>
            <button onClick={handleSignOut} style={{flex:1,padding:"10px",borderRadius:8,background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer"}}>
              Sign out
            </button>
          </div>
        </div>
      )}
      {mobileMore && <div onClick={()=>setMobileMore(false)} style={{position:"fixed",inset:0,zIndex:198}} className="fv-more-sheet"/>}

    </div>
  );
}
