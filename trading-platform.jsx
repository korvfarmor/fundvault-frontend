import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { tradesApi, propApi, psychApi, rulesApi, tradovateApi } from "./lib/api";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Cell
} from "recharts";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:"#080c14", surface:"#0d1420", card:"#111827", border:"#1e2d40",
  accent:"#00e5ff", accentDim:"#00e5ff22",
  green:"#00d084", red:"#ff3d5a", amber:"#f59e0b",
  purple:"#a78bfa", muted:"#4a6080", text:"#c8d8e8", textDim:"#6b859e",
};

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
const DEFAULT_PROP_FIRMS = [
  {
    id:"mffu", name:"MyFundedFutures", color:"#00e5ff",
    activeType:"standard",
    accountTypes:[
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
    id:"lucid", name:"Lucid Trading", color:"#a78bfa",
    activeType:"pro",
    accountTypes:[
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
    id:"alpha", name:"Alpha Futures", color:"#f59e0b",
    activeType:"standard",
    accountTypes:[
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
    activeType:"pro",
    accountTypes:[
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
    activeType:"selectflex",
    accountTypes:[
      {
        id:"selectflex", label:"Select Flex", badge:"Best ★",
        accountSize:50000, payoutSplit:90, payoutFreq:"Every 5 winning days", minPayout:500,
        description:"Best Tradeify option. No DLL, no consistency rule once funded. Drawdown locks at $50,100 after first payout — account can never fail from drawdown again.",
        payout:{ cycleTarget:2000, minDays:5, minProfit:0, buffer:0, consistency:999 },
        rules:[
          {id:"dd", label:"EOD Trailing Drawdown",  type:"drawdown", value:2000, description:"$2,000 trailing on $50K. Locks at $50,100 permanently after first payout — you can't fail from drawdown after that."},
          {id:"pt", label:"Profit Target (Eval)",   type:"target",   value:2000, description:"Pass 3-day minimum eval with $2,000 profit target on $50K"},
          {id:"md", label:"5 Winning Days",         type:"days",     value:5,   description:"5 profitable days required per payout cycle (any $ amount)"},
          {id:"np", label:"Net Positive Between",   type:"consist",  value:999, description:"Must have net positive profit between payout cycles (even $1). Not a hard rule but required for payout approval."},
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

// ── FlattenWidget — Flytande widget för öppna positioner ─────────────────────
function FlattenWidget({ tvStatus }) {
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
    { id: 1, symbol: "NQ", side: "Long",  size:  2, avgPrice: "19842.50", currentPrice: "19901.25", unrealized: 2350 },
    { id: 2, symbol: "ES", side: "Short", size: -1, avgPrice: "5621.00",  currentPrice: "5618.50",  unrealized: 125  },
    { id: 3, symbol: "MNQ",side: "Long",  size:  5, avgPrice: "19840.00", currentPrice: "19901.25", unrealized: 612  },
  ];

  // Hämta öppna positioner (demo-läge om Tradovate ej anslutet)
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
      setError("Kunde inte hämta positioner");
      console.error(err);
    }
    setLoading(false);
  };

  // Uppdatera var 5:e sekund (eller i demo: var 3:e sekund med prisrörelse)
  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, demoMode ? 3000 : 5000);
    return () => clearInterval(interval);
  }, [tvStatus?.connected, demoMode]);

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
    } catch (err) { setError("Flatten misslyckades: " + err.message); }
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
    } catch (err) { setError("Flatten misslyckades: " + err.message); }
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
      setError("🎭 DEMO: Alla väntande orders cancelerade!");
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
    } catch (err) { setError("Cancel misslyckades: " + err.message); }
    setCancellingOrders(false);
  };

  // Visa alltid så demo-läge är tillgängligt

  const hasPositions = positions.length > 0;

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      width: expanded ? 340 : 200,
      background: "#0d1420",
      border: `2px solid ${demoMode ? "#a78bfa66" : hasPositions ? "#ff3d5a66" : "#1e2d40"}`,
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
          borderBottom: expanded ? "1px solid #1e2d40" : "none",
          cursor: "pointer",
          background: hasPositions ? "#ff3d5a08" : "transparent",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: hasPositions ? "#ff3d5a" : "#00d084",
            boxShadow: `0 0 6px ${hasPositions ? "#ff3d5a" : "#00d084"}`,
            animation: hasPositions ? "pulse 1.5s ease-in-out infinite" : "none",
          }}/>
          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: "#c8d8e8", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {hasPositions ? `${positions.length} Open` : "No Positions"}
          </span>
          {hasPositions && (
            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: totalUnrealized >= 0 ? "#00d084" : "#ff3d5a" }}>
              {totalUnrealized >= 0 ? "+" : ""}${Math.round(totalUnrealized)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {loading && <div style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid #1e2d40", borderTop: "2px solid #00e5ff", animation: "spin 0.8s linear infinite" }}/>}
          <button
            onClick={e => { e.stopPropagation(); setDemoMode(d => !d); setPositions([]); setSelected({}); }}
            style={{ background: demoMode ? "#a78bfa22" : "transparent", border: `1px solid ${demoMode ? "#a78bfa66" : "#1e2d40"}`, borderRadius: 4, padding: "2px 7px", cursor: "pointer", fontFamily: "'Space Mono',monospace", fontSize: 8, color: demoMode ? "#a78bfa" : "#4a6080", letterSpacing: "0.05em" }}
            title="Testa utan Tradovate"
          >DEMO</button>
          <span style={{ color: "#4a6080", fontSize: 12 }}>{expanded ? "▼" : "▲"}</span>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>

          {/* Demo banner */}
          {demoMode && (
            <div style={{ background: "#a78bfa15", border: "1px solid #a78bfa44", borderRadius: 6, padding: "6px 10px", fontSize: 10, color: "#a78bfa", fontFamily: "'Space Mono',monospace", textAlign: "center" }}>
              🎭 DEMO-LÄGE — ingen riktig order skickas
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: "#ff3d5a15", border: "1px solid #ff3d5a44", borderRadius: 6, padding: "6px 10px", fontSize: 11, color: "#ff3d5a" }}>
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
                      background: selected[p.id] ? "#ff3d5a18" : "#111827",
                      border: `1px solid ${selected[p.id] ? "#ff3d5a55" : "#1e2d40"}`,
                      transition: "all 0.12s",
                    }}
                  >
                    {/* Checkbox */}
                    <div style={{
                      width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                      border: `1.5px solid ${selected[p.id] ? "#ff3d5a" : "#4a6080"}`,
                      background: selected[p.id] ? "#ff3d5a33" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {selected[p.id] && <span style={{ color: "#ff3d5a", fontSize: 9 }}>✓</span>}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13 }}>{p.symbol}</span>
                        <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: (p.unrealized || 0) >= 0 ? "#00d084" : "#ff3d5a" }}>
                          {(p.unrealized || 0) >= 0 ? "+" : ""}${Math.round(p.unrealized || 0)}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: p.side === "Long" ? "#00d084" : "#ff3d5a" }}>
                          {p.side} · {Math.abs(p.size)} contracts
                        </span>
                        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: "#4a6080" }}>
                          @ {p.avgPrice}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Last update */}
              {lastUpdate && (
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: "#4a6080", textAlign: "center" }}>
                  Uppdaterad {lastUpdate.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
                {/* Stäng valda */}
                {selectedIds.length > 0 && (
                  <button
                    onClick={flattenSelected}
                    disabled={flattening || cancellingOrders}
                    style={{
                      width: "100%", padding: "8px", borderRadius: 8, cursor: "pointer",
                      background: "#f59e0b22", border: "1px solid #f59e0b66",
                      color: "#f59e0b", fontFamily: "'Space Mono',monospace",
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                    }}
                  >
                    {flattening ? "Stänger..." : `✕ Stäng ${selectedIds.length} vald${selectedIds.length > 1 ? "a" : ""}`}
                  </button>
                )}
                {/* Flatten ALL positioner */}
                <button
                  onClick={() => setConfirmAll("positions")}
                  disabled={flattening || cancellingOrders}
                  style={{
                    width: "100%", padding: "9px", borderRadius: 8, cursor: "pointer",
                    background: "#ff3d5a22", border: "1px solid #ff3d5a66",
                    color: "#ff3d5a", fontFamily: "'Space Mono',monospace",
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                  }}
                >
                  {flattening ? "Stänger positioner..." : "🔴 Flatten ALL — Stäng alla positioner"}
                </button>
                {/* Cancel alla väntande orders */}
                <button
                  onClick={() => setConfirmAll("orders")}
                  disabled={flattening || cancellingOrders}
                  style={{
                    width: "100%", padding: "9px", borderRadius: 8, cursor: "pointer",
                    background: "#f59e0b22", border: "1px solid #f59e0b66",
                    color: "#f59e0b", fontFamily: "'Space Mono',monospace",
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                  }}
                >
                  {cancellingOrders ? "Cancelerar orders..." : "⛔ Cancel ALL — Ta bort alla väntande orders"}
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "12px 0", fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#4a6080" }}>
              Inga öppna positioner
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
            background: "#0d1420",
            border: `1px solid ${confirmAll === "positions" ? "#ff3d5a66" : "#f59e0b66"}`,
            borderRadius: 16, padding: 32, maxWidth: 340, width: "90%", textAlign: "center",
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>
              {confirmAll === "positions" ? "🔴" : "⛔"}
            </div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20, color: confirmAll === "positions" ? "#ff3d5a" : "#f59e0b", marginBottom: 8 }}>
              {confirmAll === "positions" ? "Flatten ALL?" : "Cancel ALL Orders?"}
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "#6b859e", marginBottom: 8 }}>
              {confirmAll === "positions"
                ? <>Detta stänger <strong style={{ color: "#c8d8e8" }}>alla {positions.length} öppna positioner</strong> omedelbart med market orders.</>
                : <>Detta cancelerar <strong style={{ color: "#c8d8e8" }}>alla väntande limit- och stop-orders</strong>. Öppna positioner påverkas inte.</>
              }
            </div>
            {confirmAll === "positions" && (
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, color: totalUnrealized >= 0 ? "#00d084" : "#ff3d5a", marginBottom: 24, fontWeight: 700 }}>
                Orealiserat: {totalUnrealized >= 0 ? "+" : ""}${Math.round(totalUnrealized)}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setConfirmAll(false)}
                style={{ flex: 1, padding: "12px", borderRadius: 10, cursor: "pointer", background: "transparent", border: "1px solid #1e2d40", color: "#6b859e", fontFamily: "'Space Mono',monospace", fontSize: 11 }}
              >
                Avbryt
              </button>
              <button
                onClick={() => { confirmAll === "positions" ? flattenAll() : cancelAllOrders(); }}
                style={{ flex: 1, padding: "12px", borderRadius: 10, cursor: "pointer", background: confirmAll === "positions" ? "#ff3d5a22" : "#f59e0b22", border: `1px solid ${confirmAll === "positions" ? "#ff3d5a" : "#f59e0b"}`, color: confirmAll === "positions" ? "#ff3d5a" : "#f59e0b", fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700 }}
              >
                {confirmAll === "positions" ? "Ja, stäng allt" : "Ja, cancelera allt"}
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
  const [events,  setEvents ] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError  ] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  const fetchCalendar = async () => {
    setLoading(true); setError(null);
    try {
      // Hämtar via vår backend som proxar ForexFactory (undviker CORS)
      const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const res = await fetch(`${API}/calendar/thisweek`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Backend svarade ${res.status}`);
      const data = await res.json();
      setEvents(data);
      setLastFetch(new Date());
    } catch (err) {
      setError("Kunde inte hämta kalender: " + err.message);
      setEvents([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCalendar(); }, []);

  const impactColor = i => i === "high" ? "#ff3d5a" : i === "medium" ? "#f59e0b" : "#4a6080";
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
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:"#6b859e",letterSpacing:"0.1em",textTransform:"uppercase"}}>Economic Calendar</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,marginTop:4}}>News & Events</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          {lastFetch && <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:"#4a6080"}}>Updated {lastFetch.toLocaleTimeString("sv-SE",{hour:"2-digit",minute:"2-digit"})}</span>}
          <button onClick={fetchCalendar} disabled={loading} style={{background:"transparent",border:"1px solid #1e2d40",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:"#4a6080"}}>
            {loading ? "..." : "↻ Refresh"}
          </button>
          <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#4a6080"}}>Filter:</span>
          {["all","high","medium","low"].map(f => (
            <button key={f} onClick={() => setEconFilter(f)} style={{background:econFilter===f?`${impactColor(f)}22`:"#0d1420",border:`1px solid ${econFilter===f?impactColor(f)+"66":"#1e2d40"}`,color:econFilter===f?impactColor(f):"#6b859e",borderRadius:6,padding:"4px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,textTransform:"uppercase"}}>
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{display:"flex",alignItems:"center",gap:12,padding:20,color:"#6b859e",fontFamily:"'Space Mono',monospace",fontSize:12}}>
          <div style={{width:16,height:16,borderRadius:"50%",border:"2px solid #1e2d40",borderTop:"2px solid #00e5ff",animation:"spin 0.8s linear infinite"}}/>
          Hämtar live kalender från ForexFactory...
        </div>
      )}

      {/* Error */}
      {error && <div style={{background:"#f59e0b11",border:"1px solid #f59e0b44",borderRadius:8,padding:"12px 16px",fontFamily:"'Space Mono',monospace",fontSize:11,color:"#f59e0b"}}>⚠ {error}</div>}

      {/* Upcoming high-impact banner */}
      {!loading && upcoming.length > 0 && (
        <div style={{background:"#f59e0b11",border:"1px solid #f59e0b44",borderRadius:10,padding:"14px 18px",display:"flex",alignItems:"center",gap:14}}>
          <span style={{fontSize:22}}>⚡</span>
          <div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:"#f59e0b",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4}}>Kommande High-Impact Events</div>
            <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
              {upcoming.map(e => (
                <span key={e.id} style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#c8d8e8"}}>
                  <span style={{color:"#f59e0b"}}>{e.date.slice(5)} {e.time}</span> — {e.event}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* No events */}
      {!loading && !error && days.length === 0 && (
        <div style={{background:"#111827",border:"1px solid #1e2d40",borderRadius:12,padding:40,textAlign:"center",fontFamily:"'Space Mono',monospace",fontSize:12,color:"#4a6080"}}>
          Inga USD-händelser denna vecka
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
            <div key={date} style={{background:"#111827",border:`1px solid ${isToday?"#00e5ff44":hasHigh?"#ff3d5a33":"#1e2d40"}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"12px 20px",borderBottom:"1px solid #1e2d40",display:"flex",alignItems:"center",gap:12,background:isToday?"#00e5ff06":hasHigh?"#ff3d5a08":"#0d1420"}}>
                <div style={{width:44,height:44,borderRadius:8,background:isToday?"#00e5ff22":hasHigh?"#ff3d5a22":"#00e5ff11",border:`1px solid ${isToday?"#00e5ff44":hasHigh?"#ff3d5a44":"#00e5ff33"}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:isToday?"#00e5ff":hasHigh?"#ff3d5a":"#00e5ff",letterSpacing:"0.05em"}}>{dayNames[d.getDay()]}</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:isToday?"#00e5ff":hasHigh?"#ff3d5a":"#00e5ff",lineHeight:1}}>{d.getDate()}</div>
                </div>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,display:"flex",alignItems:"center",gap:8}}>
                    {d.toLocaleDateString("sv-SE",{month:"long",day:"numeric",year:"numeric"})}
                    {isToday && <span style={{background:"#00e5ff22",color:"#00e5ff",border:"1px solid #00e5ff44",borderRadius:4,padding:"1px 8px",fontFamily:"'Space Mono',monospace",fontSize:9}}>IDAG</span>}
                  </div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#6b859e",marginTop:2}}>{dayEvents.length} event{dayEvents.length>1?"s":""} · {dayEvents.filter(e=>e.impact==="high").length} high impact</div>
                </div>
                {hasHigh && <span style={{marginLeft:"auto",background:"#ff3d5a22",color:"#ff3d5a",border:"1px solid #ff3d5a44",borderRadius:4,padding:"3px 10px",fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700}}>HIGH IMPACT</span>}
              </div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:"1px solid #1e2d40"}}>
                  {["Time","Currency","Impact","Event","Forecast","Previous","Actual"].map(h => (
                    <th key={h} style={{padding:"8px 18px",textAlign:"left",fontFamily:"'Space Mono',monospace",fontSize:9,color:"#6b859e",letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:400}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {dayEvents.map((e, i) => (
                    <tr key={e.id} style={{borderBottom:i<dayEvents.length-1?"1px solid #1e2d40":"none",background:e.impact==="high"?"#ff3d5a06":"transparent"}} onMouseEnter={ev=>ev.currentTarget.style.background="#0d1420"} onMouseLeave={ev=>ev.currentTarget.style.background=e.impact==="high"?"#ff3d5a06":"transparent"}>
                      <td style={{padding:"11px 18px",fontFamily:"'Space Mono',monospace",fontSize:12,color:"#00e5ff"}}>{e.time}</td>
                      <td style={{padding:"11px 18px"}}><span style={{background:"#00e5ff11",color:"#00e5ff",borderRadius:4,padding:"2px 8px",fontFamily:"'Space Mono',monospace",fontSize:10}}>{e.currency}</span></td>
                      <td style={{padding:"11px 18px"}}>
                        <div style={{display:"flex",gap:2}}>
                          {Array.from({length:3},(_,k) => <div key={k} style={{width:7,height:7,borderRadius:"50%",background:k<impactDots(e.impact)?impactColor(e.impact):"#1e2d40"}}/>)}
                        </div>
                      </td>
                      <td style={{padding:"11px 18px",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#c8d8e8",fontWeight:500}}>{e.event}</td>
                      <td style={{padding:"11px 18px",fontFamily:"'Space Mono',monospace",fontSize:12,color:"#6b859e"}}>{e.forecast||"—"}</td>
                      <td style={{padding:"11px 18px",fontFamily:"'Space Mono',monospace",fontSize:12,color:"#6b859e"}}>{e.previous||"—"}</td>
                      <td style={{padding:"11px 18px"}}>
                        {e.actual != null
                          ? <span style={{fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700,color:parseFloat(e.actual)>parseFloat(e.forecast)?"#00d084":parseFloat(e.actual)<parseFloat(e.forecast)?"#ff3d5a":"#c8d8e8"}}>{e.actual}</span>
                          : <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#4a6080"}}>Pending</span>
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
            <span style={{background:trade.side==="Long"?"#00d08418":"#ff3d5a18",color:trade.side==="Long"?C.green:C.red,borderRadius:4,padding:"3px 10px",fontFamily:"'Space Mono',monospace",fontSize:11}}>{trade.side}</span>
            <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,color:trade.pnl>=0?C.green:C.red}}>{trade.pnl>=0?"+":""}${trade.pnl}</span>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted}}>{trade.entry} → {trade.exit} · {trade.holdMin}m hold</span>
            {trade.holdMin<1&&<span style={{background:`${C.red}22`,color:C.red,border:`1px solid ${C.red}44`,borderRadius:4,padding:"2px 10px",fontFamily:"'Space Mono',monospace",fontSize:10}}>⚠ PROP VIOLATION</span>}
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:22}}>✕</button>
        </div>
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
const AIFeedback = ({trades}) => {
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

BY TIME OF DAY:
${liveTimeData.map(t=>`- ${t.hour}: P&L $${t.pnl}, Win rate ${t.trades?Math.round((t.wins/t.trades)*100):0}%`).join("\n")}

Respond ONLY with this JSON (no markdown, no preamble):
{"headline":"one punchy sentence","strengths":["s1","s2"],"weaknesses":["w1","w2"],"patterns":["p1 with numbers","p2 with numbers"],"propFirmWarnings":["pf1","pf2"],"weekFocus":"one very specific thing to focus on with a concrete metric","verdict":8}`;

      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      const text=data.content.map(i=>i.text||"").join("");
      setFeedback(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch(e){setError("Analysis failed — please try again.");}
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

// ── App ───────────────────────────────────────────────────────────────────────
export default function TradingPlatform({ session }) {
  const user = session?.user;
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Trader";
  const userInitial = userName.charAt(0).toUpperCase();
  const handleSignOut = () => supabase.auth.signOut();
  const [tab,        setTab       ] = useState("dashboard");
  const [selTrade,   setSelTrade  ] = useState(null);
  const [showRules,  setShowRules ] = useState(false);
  const [trades,     setTrades    ] = useState([]);
  const [rules,      setRules     ] = useState(DEFAULT_RULES);
  const [habits,     setHabits    ] = useState(DEFAULT_HABITS);
  const [mood,       setMood      ] = useState(0);
  const [hChecks,    setHChecks   ] = useState({});
  const [note,       setNote      ] = useState("");
  const [newHabit,   setNewHabit  ] = useState("");
  const [firms,      setFirms     ] = useState(DEFAULT_PROP_FIRMS);
  const [activeFirm, setActiveFirm] = useState("mffu");
  const [tagFilter,  setTagFilter ] = useState("All");
  const [newRule,    setNewRule   ] = useState({label:"",type:"loss",value:""});
  const [econFilter, setEconFilter] = useState("all");

  // ── Trade Copier state ─────────────────────────────────────────────────────
  const [copierAccounts, setCopierAccounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("edgestat_copier_accounts") || "[]"); }
    catch { return []; }
  });
  const [copierGroups, setCopierGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem("edgestat_copier_groups") || "[]"); }
    catch { return []; }
  });
  const [activeGroupId, setActiveGroupId] = useState(() =>
    localStorage.getItem("edgestat_active_group") || null
  );
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

  // Kopiera API-anrop mot backend
  const startCopierBackend = async (group) => {
    const masterAcc = copierAccounts.find(a => a.isMaster && group.accountIds.includes(a.id));
    const slaveAccs = copierAccounts.filter(a => !a.isMaster && group.accountIds.includes(a.id));
    if (!masterAcc || !slaveAccs.length) return;
    try {
      const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${API}/copier/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          masterAccountId: masterAcc.accountId,
          slaveAccountIds: slaveAccs.map(a => a.accountId),
          groupName: group.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCopierEnabled(true);
      pollCopierStatus();
    } catch (err) {
      alert("Kunde inte starta copier: " + err.message);
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

  const saveCopierAccounts = (data) => {
    setCopierAccounts(data);
    localStorage.setItem("edgestat_copier_accounts", JSON.stringify(data));
  };
  const saveCopierGroups = (data) => {
    setCopierGroups(data);
    localStorage.setItem("edgestat_copier_groups", JSON.stringify(data));
  };
  const setActiveGroup = (id) => {
    setActiveGroupId(id);
    localStorage.setItem("edgestat_active_group", id || "");
  };
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
  const loadTrades = useCallback(async () => {
    setLoadingTrades(true);
    // Demo-läge: använd INITIAL_TRADES direkt
    if (localStorage.getItem("edgestat_mode") === "demo") {
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
      setTrades([]); // Visa tom lista istället för mock-data
    }
    setLoadingTrades(false);
  }, []);

  // ── Load rules, habits, check-in, tradovate status on mount ───────────────
  useEffect(() => {
    loadTrades();
    rulesApi.list().then(data => { if (data?.length) setRules(data.map(r => r.label)); }).catch(()=>{});
    psychApi.habits().then(data => { if (data?.length) setHabits(data); }).catch(()=>{});
    const today = new Date().toISOString().slice(0,10);
    psychApi.checkins({from:today,to:today}).then(data => {
      if (data?.[0]) { setMood(data[0].mood||0); setHChecks(data[0].habits||{}); setNote(data[0].note||""); }
    }).catch(()=>{});
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
    const payload = {
      symbol:      updated.symbol,
      side:        updated.side,
      entry_time:  updated.entry,
      exit_time:   updated.exit,
      pnl:         updated.pnl,
      rr:          updated.rr,
      hold_min:    updated.holdMin || 0,
      tags:        updated.tags || [],
      rating:      updated.rating || 0,
      review:      updated.review || "",
      screenshot:  updated.screenshot || null,
      rule_checks: updated.checks || {},
      trade_date:  updated.trade_date || new Date().toISOString().slice(0,10),
    };
    try {
      const isRealId = typeof updated.id === "string" && updated.id.includes("-");
      if (isRealId) { await tradesApi.update(updated.id, payload); }
      else          { await tradesApi.create(payload); }
      await loadTrades();
    } catch (err) {
      console.error("Save trade failed:", err);
      setTrades(tt => tt.map(t => t.id===updated.id ? updated : t));
    }
    setSelTrade(null);
  };

  // ── Sync Tradovate ─────────────────────────────────────────────────────────
  const syncTradovate = async () => {
    setSyncingTV(true);
    try {
      const result = await tradovateApi.sync();
      if (result?.synced > 0) { await loadTrades(); alert(`✅ Synced ${result.synced} new trades!`); }
      else alert("Inga nya trades hittades i Tradovate.");
    } catch (err) { alert("Sync misslyckades: " + err.message); }
    setSyncingTV(false);
  };

  // ── Save check-in ──────────────────────────────────────────────────────────
  const saveCheckin = () => {
    psychApi.saveCheckin({ check_date: new Date().toISOString().slice(0,10), mood, note, habits: hChecks }).catch(()=>{});
  };

  // Get active firm object and its currently selected account type
  const firm      = firms.find(f=>f.id===activeFirm);
  const acctType  = firm.accountTypes.find(t=>t.id===firm.activeType) || firm.accountTypes[0];
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
    const today = new Date().toISOString().slice(0,10);
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

  // ── Stats beräknade från riktiga trades ──────────────────────────────────────
  const wins     = trades.filter(d=>d.pnl>0).length;
  const losses   = trades.filter(d=>d.pnl<0).length;
  const winRate  = trades.length ? Math.round((wins/trades.length)*100) : 0;

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
  const totalPnl = trades.reduce((a,b)=>a+b.pnl,0);
  const avgWin   = wins   ? Math.round(trades.filter(d=>d.pnl>0).reduce((a,b)=>a+b.pnl,0)/wins)   : 0;
  const avgLoss  = losses ? Math.round(Math.abs(trades.filter(d=>d.pnl<0).reduce((a,b)=>a+b.pnl,0)/losses)) : 0;

  // Equity curve och daily PnL byggd från riktiga trades
  const pnlByDate = {};
  trades.forEach(t => { pnlByDate[t.trade_date] = (pnlByDate[t.trade_date]||0) + t.pnl; });
  const LIVE_PNL_DATA = Object.entries(pnlByDate).sort(([a],[b])=>a.localeCompare(b)).map(([date,pnl])=>({date,pnl}));
  const LIVE_EQUITY   = LIVE_PNL_DATA.reduce((acc,d,i)=>{
    const prev = i===0 ? 50000 : acc[i-1].equity;
    return [...acc, {date:d.date, equity: Math.round(prev+d.pnl)}];
  }, []);

  // ── Live hourly data computed from real trades ────────────────────────────
  const liveTimeData = (() => {
    const hourMap = {};
    trades.forEach(t => {
      const h = t.entry ? t.entry.slice(0,2)+":00" : null;
      if (!h) return;
      if (!hourMap[h]) hourMap[h] = {hour:h, pnl:0, trades:0, wins:0};
      hourMap[h].pnl    += t.pnl;
      hourMap[h].trades += 1;
      if (t.pnl > 0) hourMap[h].wins += 1;
    });
    return Object.values(hourMap).sort((a,b)=>a.hour.localeCompare(b.hour));
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

  const filteredTrades = tagFilter==="All"?trades:trades.filter(t=>(t.tags||[]).includes(tagFilter));

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

  const TABS = ["dashboard","analytics","calendar","trades","psychology","propfirm","news","accounts","copier"];

  // Re-load trades when mode changes
  useEffect(() => { loadTrades(); }, [appMode, loadTrades]);

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
      {selTrade  && <TradeModal trade={selTrade} onClose={()=>setSelTrade(null)} onSave={saveTrade} globalRules={rules}/>}
      <FlattenWidget tvStatus={tvStatus}/>
      {showRules && <RuleManager rules={rules} onChange={setRules} onClose={()=>setShowRules(false)}/>}

      {/* Nav */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 28px",height:58,borderBottom:`1px solid ${C.border}`,background:C.surface,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:28,height:28,borderRadius:6,background:`linear-gradient(135deg,${C.accent},#0070f3)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#000",fontFamily:"'Syne',sans-serif"}}>E</div>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,letterSpacing:"0.05em"}}>EDGESTAT</span>
          <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.amber,background:"#f59e0b18",border:"1px solid #f59e0b44",borderRadius:4,padding:"2px 8px"}}>PROP FOCUS</span>
        </div>
        <div style={{display:"flex",gap:3}}>
          {TABS.map(t=><button key={t} onClick={()=>setTab(t)} style={{background:tab===t?C.accentDim:"transparent",border:tab===t?`1px solid ${C.accent}44`:"1px solid transparent",color:tab===t?C.accent:C.textDim,borderRadius:6,padding:"5px 11px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:"0.05em",textTransform:"uppercase",transition:"all 0.15s"}}>{t==="propfirm"?"prop firm":t}</button>)}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:C.green,boxShadow:`0 0 8px ${C.green}`}}/>
          <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.textDim}}>Tradovate · Live</span>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.text,fontWeight:500}}>{userName}</div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>{user?.email}</div>
            </div>
            <div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent}33,${C.purple}33)`,border:`1px solid ${C.accent}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:C.accent}}>{userInitial}</div>
            <button onClick={syncTradovate} disabled={syncingTV} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 10px",cursor:syncingTV?"not-allowed":"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:tvStatus?.connected?C.green:C.muted,letterSpacing:"0.05em",textTransform:"uppercase"}} title={tvStatus?.connected?"Sync trades from Tradovate":"Connect Tradovate first"}>{syncingTV?"Syncing...":tvStatus?.connected?"↻ Sync TV":"TV: Off"}</button>
            <button onClick={toggleMode} style={{background:isDemo?"#a78bfa22":"#00e5ff11",border:`1px solid ${isDemo?"#a78bfa44":"#00e5ff22"}`,borderRadius:6,padding:"4px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:isDemo?"#a78bfa":"#00e5ff",fontWeight:700,letterSpacing:"0.05em"}}>
              {isDemo?"🎭 DEMO":"⚡ LIVE"}
            </button>
            <button onClick={handleSignOut} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.05em",textTransform:"uppercase"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.red;e.currentTarget.style.color=C.red;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}>Sign out</button>
          </div>
        </div>
      </div>

      <div style={{flex:1,padding:"26px 28px",maxWidth:1300,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>

        {/* ── DASHBOARD ───────────────────────────────────────────────────────── */}
        {tab==="dashboard"&&(
          <div style={{display:"flex",flexDirection:"column",gap:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
              <div><div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Weekly Overview</div><div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,marginTop:4}}>Performance <span style={{color:C.accent}}>↗</span></div></div>
              {(()=>{
                const now=new Date();
                const firstDay=new Date(now.getFullYear(),now.getMonth(),1);
                const lastDay=new Date(now.getFullYear(),now.getMonth()+1,0);
                const fmt=d=>d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
                return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 14px",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.textDim}}>{fmt(firstDay)} – {fmt(lastDay)}, {now.getFullYear()}</div>;
              })()}
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <StatCard label="Net P&L"  value={trades.length ? `${totalPnl>=0?"+":""}$${Math.abs(totalPnl).toLocaleString()}` : "$0"} sub="This period"         color={C.green}/>
              <StatCard label="Win Rate" value={trades.length ? `${winRate}%` : "–"}                   sub={`${wins}/${trades.length} trades`} color={C.accent}/>
              <StatCard label="Avg Win"  value={`$${avgWin}`}                    sub="Per winning trade"   color={C.green}/>
              <StatCard label="Avg Loss" value={`$${avgLoss}`}                   sub="Per losing trade"    color={C.red}/>
              <StatCard label="Max DD"   value={maxDD ? `$${maxDD.toLocaleString()}` : "–"}  sub="Peak-to-trough"  color={C.red}/>
              <StatCard label="Avg R:R"  value="1.8R"                            sub="Risk/reward ratio"   color={C.accent}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>Equity Curve</div>
                <ResponsiveContainer width="100%" height={180}>
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
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={LIVE_PNL_DATA.length ? LIVE_PNL_DATA : PNL_DATA}><CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                    <XAxis dataKey="day" tick={{fill:C.muted,fontSize:10,fontFamily:"'Space Mono',monospace"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:C.muted,fontSize:10,fontFamily:"'Space Mono',monospace"}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`}/>
                    <Tooltip content={<PnlTip/>}/><ReferenceLine y={0} stroke={C.border}/>
                    <Bar dataKey="pnl" radius={[4,4,0,0]}>{(LIVE_PNL_DATA.length ? LIVE_PNL_DATA : PNL_DATA).map((d,i)=><Cell key={i} fill={d.pnl>=0?C.green:C.red}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Recent Trades</div><button onClick={()=>setTab("trades")} style={{background:"transparent",border:"none",color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer"}}>View all →</button></div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{["Symbol","Side","Entry","Exit","Tags","R:R","P&L"].map(h=><th key={h} style={{padding:"9px 18px",textAlign:"left",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:400}}>{h}</th>)}</tr></thead>
                <tbody>{trades.slice(0,5).map((t,i)=>(
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

            {/* AI Feedback */}
            <AIFeedback trades={trades}/>
          </div>
        )}

        {/* ── CALENDAR ────────────────────────────────────────────────────────── */}
        {tab==="calendar"&&(()=>{
          const now        = new Date();
          const year       = now.getFullYear();
          const month      = now.getMonth();
          const monthLabel = now.toLocaleString("sv-SE",{month:"long",year:"numeric"});
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
            <div><div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Monthly View</div><div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,marginTop:4,textTransform:"capitalize"}}>{monthLabel}</div></div>
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
                  return <div key={day} style={{background:pnl!==undefined?pnl>=0?"#00d08414":"#ff3d5a14":isWknd?"transparent":C.surface,border:`1px solid ${pnl!==undefined?pnl>=0?C.green+"44":C.red+"44":C.border}`,borderRadius:8,padding:"9px 8px",minHeight:60,opacity:isWknd&&pnl===undefined?.3:1}}>
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
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
              <div><div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Trade Log</div><div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,marginTop:4}}>All Trades</div></div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                <button onClick={()=>setShowRules(true)} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.textDim,borderRadius:6,padding:"5px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11}}>⚙ My Rules</button>
                {["All",...allTags].map(f=><button key={f} onClick={()=>setTagFilter(f)} style={{background:tagFilter===f?`${tagColor(f)}22`:C.surface,border:`1px solid ${tagFilter===f?tagColor(f)+"66":C.border}`,color:tagFilter===f?tagColor(f):C.textDim,borderRadius:6,padding:"5px 11px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11}}>{f}</button>)}
              </div>
            </div>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{["#","Symbol","Side","Entry","Exit","Tags","Rating","R:R","P&L","Review",""].map(h=><th key={h} style={{padding:"11px 14px",textAlign:"left",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:400}}>{h}</th>)}</tr></thead>
                <tbody>{filteredTrades.map((t,i)=>{
                  const rs=t.checks?Object.values(t.checks).filter(Boolean).length:null;
                  return <tr key={t.id} style={{borderBottom:i<filteredTrades.length-1?`1px solid ${C.border}`:"none"}} onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"11px 14px",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted}}>#{t.id}</td>
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
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── PSYCHOLOGY ──────────────────────────────────────────────────────── */}
        {tab==="psychology"&&(()=>{
          // Build live psych data: join trades pnl per day with mood from hChecks
          const pnlByDate2 = {};
          trades.forEach(t => { pnlByDate2[t.trade_date] = (pnlByDate2[t.trade_date]||0) + t.pnl; });
          // livePsychData uses trades — mood will be added when checkin API is fully wired
          const livePsychData = Object.entries(pnlByDate2)
            .sort(([a],[b])=>a.localeCompare(b))
            .slice(-14) // last 14 trading days
            .map(([date, pnl]) => ({
              day:  date.slice(5),  // "03-11"
              pnl,
              mood: 3, // will be populated from checkin data when available
            }));

          const hasPsychData = livePsychData.length > 0;
          const avgMood = hasPsychData ? (livePsychData.reduce((a,b)=>a+b.mood,0)/livePsychData.length).toFixed(1) : "–";
          const highPnl = hasPsychData ? livePsychData.filter(d=>d.mood>=4).reduce((a,b)=>a+b.pnl,0) : 0;
          const lowPnl  = hasPsychData ? livePsychData.filter(d=>d.mood<=2).reduce((a,b)=>a+b.pnl,0) : 0;
          const checked = Object.values(hChecks).filter(Boolean).length;

          return <div style={{display:"flex",flexDirection:"column",gap:22}}>
            <div><div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Mental Edge</div><div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,marginTop:4}}>Psychology Tracker</div></div>
            <div style={{display:"flex",gap:12}}>
              <StatCard label="Avg Mood"       value={`${avgMood}/5`}                          sub="This month"   color={C.accent}/>
              <StatCard label="High Mood P&L"  value={`$${Math.round(highPnl).toLocaleString()}`} sub="Mood ≥ 4 days" color={C.green}/>
              <StatCard label="Low Mood P&L"   value={`$${Math.round(lowPnl)}`}                sub="Mood ≤ 2 days" color={C.red}/>
              <StatCard label="Today's Habits" value={`${checked}/${habits.length}`}           sub="Completed"    color={checked>=habits.length*.7?C.green:C.accent}/>
            </div>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>Mood Score vs P&L Correlation</div>
              {hasPsychData ? <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={livePsychData}><defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.purple} stopOpacity={.3}/><stop offset="95%" stopColor={C.purple} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="day" tick={{fill:C.muted,fontSize:10,fontFamily:"'Space Mono',monospace"}} axisLine={false} tickLine={false}/>
                  <YAxis yAxisId="mood" orientation="right" domain={[0,5]} tick={{fill:C.muted,fontSize:10,fontFamily:"'Space Mono',monospace"}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}★`}/>
                  <YAxis yAxisId="pnl" tick={{fill:C.muted,fontSize:10,fontFamily:"'Space Mono',monospace"}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`}/>
                  <Tooltip contentStyle={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,fontFamily:"'Space Mono',monospace",fontSize:11}}/>
                  <ReferenceLine yAxisId="pnl" y={0} stroke={C.border}/>
                  <Bar yAxisId="pnl" dataKey="pnl" radius={[3,3,0,0]} opacity={.5}>{livePsychData.map((d,i)=><Cell key={i} fill={d.pnl>=0?C.green:C.red}/>)}</Bar>
                  <Area yAxisId="mood" type="monotone" dataKey="mood" stroke={C.purple} strokeWidth={2.5} fill="url(#mg)" dot={{fill:C.purple,r:4}}/>
                </AreaChart>
              </ResponsiveContainer> : <div style={{height:180,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>Ingen data ännu — logga trades och check-ins</div>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:22}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>Today's Check-In</div>
                <div style={{marginBottom:16}}><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,marginBottom:10}}>How are you feeling before the session?</div>
                  <div style={{display:"flex",gap:7}}>{MOOD_OPTIONS.map(m=><div key={m.val} onClick={()=>setMood(m.val)} style={{flex:1,padding:"9px 4px",borderRadius:8,cursor:"pointer",textAlign:"center",border:`1px solid ${mood===m.val?C.purple:C.border}`,background:mood===m.val?"#a78bfa22":C.surface,transition:"all 0.15s"}}><div style={{fontSize:18}}>{m.emoji}</div><div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:mood===m.val?C.purple:C.muted,marginTop:3}}>{m.label}</div></div>)}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>
                  {habits.map(h=><label key={h.id} onClick={()=>setHChecks(c=>({...c,[h.id]:!c[h.id]}))} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"7px 10px",borderRadius:8,background:hChecks[h.id]?C.accentDim:C.surface,border:`1px solid ${hChecks[h.id]?C.accent+"44":C.border}`,transition:"all 0.15s"}}>
                    <span style={{fontSize:14}}>{h.icon}</span><span style={{flex:1,fontFamily:"'DM Sans',sans-serif",fontSize:13,color:hChecks[h.id]?C.text:C.textDim}}>{h.label}</span>
                    <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${hChecks[h.id]?C.green:C.border}`,background:hChecks[h.id]?C.green+"22":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>{hChecks[h.id]&&<span style={{color:C.green,fontSize:10}}>✓</span>}</div>
                  </label>)}
                </div>
                <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="How's your mindset today?" style={{width:"100%",minHeight:70,boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:12,resize:"vertical",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}/>
                <button onClick={saveCheckin} style={{marginTop:10,width:"100%",background:"#a78bfa22",border:"1px solid #a78bfa66",color:C.purple,borderRadius:8,padding:"11px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:700}}>💾 Save Check-In</button>
              </div>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:22,display:"flex",flexDirection:"column",gap:12}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Manage Habits</div>
                {cats.map(cat=><div key={cat}><div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.accent,letterSpacing:"0.1em",marginBottom:7}}>{cat.toUpperCase()}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>{habits.filter(h=>h.category===cat).map(h=><div key={h.id} style={{display:"flex",alignItems:"center",gap:10,background:C.surface,borderRadius:8,padding:"7px 12px",border:`1px solid ${C.border}`}}><span style={{fontSize:14}}>{h.icon}</span><span style={{flex:1,fontFamily:"'DM Sans',sans-serif",fontSize:13}}>{h.label}</span><button onClick={()=>setHabits(hh=>hh.filter(x=>x.id!==h.id))} style={{background:"transparent",border:"none",color:C.red,cursor:"pointer",fontSize:13,opacity:.6}}>✕</button></div>)}</div>
                </div>)}
                <div style={{display:"flex",gap:7,marginTop:4}}>
                  <input value={newHabit} onChange={e=>setNewHabit(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newHabit.trim()){setHabits(hh=>[...hh,{id:Date.now().toString(),label:newHabit.trim(),icon:"⚡",category:"Mindset"}]);setNewHabit("");}}} placeholder="Add custom habit..." style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}/>
                  <button onClick={()=>{if(newHabit.trim()){setHabits(hh=>[...hh,{id:Date.now().toString(),label:newHabit.trim(),icon:"⚡",category:"Mindset"}]);setNewHabit("");}}} style={{background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:8,padding:"9px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:12}}>+ Add</button>
                </div>
              </div>
            </div>
          </div>;
        })()}

        {/* ── PROP FIRM ───────────────────────────────────────────────────────── */}
        {tab==="propfirm"&&(()=>{
          const profit  = acct.balance - acct.startBalance;
          const dd      = acct.peakBalance - acct.balance;

          // Start balance editor
          const saveStartBalance = (firmId, val) => {
            const num = parseFloat(val.replace(/[^0-9.]/g,""));
            if (!num || isNaN(num)) return;
            const updated = { ...startBalances, [firmId]: num };
            setStartBalances(updated);
            localStorage.setItem("edgestat_startbal", JSON.stringify(updated));
            setEditingBalance(null);
          };
          const po      = acctType.payout;
          const dlRule  = acctType.rules.find(r=>r.type==="loss");
          const ddRule  = acctType.rules.find(r=>r.type==="drawdown");
          const ptRule  = acctType.rules.find(r=>r.type==="target");
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
                  ? <span style={{background:"#00d08418",border:"1px solid #00d08444",borderRadius:6,padding:"3px 10px",fontFamily:"'Space Mono',monospace",fontSize:9,color:"#00d084"}}>⚡ LIVE — Tradovate</span>
                  : <span style={{background:"#00e5ff11",border:"1px solid #00e5ff33",borderRadius:6,padding:"3px 10px",fontFamily:"'Space Mono',monospace",fontSize:9,color:"#00e5ff"}}>📊 Beräknat från loggade trades</span>
                }
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {firms.map(f=>{
                  const shortNames={"mffu":"MFFU","lucid":"Lucid","alpha":"Alpha","tpt":"TPT","tradeify":"Tradeify"};
                  return <button key={f.id} onClick={()=>setActiveFirm(f.id)} style={{background:activeFirm===f.id?`${f.color}22`:C.surface,border:`1px solid ${activeFirm===f.id?f.color+"55":C.border}`,color:activeFirm===f.id?f.color:C.textDim,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:activeFirm===f.id?700:400,whiteSpace:"nowrap"}}>{shortNames[f.id]||f.name}</button>;
                })}
              </div>
            </div>

            {/* Account Type Selector */}
            <div style={{background:C.card,border:`1px solid ${firm.color}33`,borderRadius:12,padding:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                <div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:firm.color,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Account Type — {firm.name}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim}}>{acctType.description}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"4px 5px"}}>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,paddingLeft:6,paddingRight:2}}>TYPE:</span>
                  {firm.accountTypes.map(t=>{
                    const isActive=t.id===firm.activeType;
                    return <button key={t.id} onClick={()=>setFirmAccountType(firm.id,t.id)}
                      style={{background:isActive?`${firm.color}22`:"transparent",border:`1px solid ${isActive?firm.color+"55":"transparent"}`,color:isActive?firm.color:C.muted,borderRadius:6,padding:"5px 11px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:isActive?700:400,transition:"all 0.15s",whiteSpace:"nowrap"}}>
                      {t.label}
                    </button>;
                  })}
                </div>
              </div>

              {/* Comparison grid */}
              <div style={{display:"grid",gridTemplateColumns:`repeat(${firm.accountTypes.length},1fr)`,gap:8}}>
                {firm.accountTypes.map(t=>{
                  const isActive=t.id===firm.activeType;
                  const cs=t.rules.find(r=>r.type==="consist");
                  const hasConsist=cs&&cs.value<900;
                  return <div key={t.id} onClick={()=>setFirmAccountType(firm.id,t.id)}
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
                        onKeyDown={e=>{if(e.key==="Enter")saveStartBalance(activeFirm,editBalVal);if(e.key==="Escape")setEditingBalance(null);}}
                        style={{width:80,background:"#0d1420",border:"1px solid #00e5ff44",borderRadius:4,padding:"2px 6px",color:"#c8d8e8",fontFamily:"'Space Mono',monospace",fontSize:10,outline:"none"}}
                        placeholder="50000"/>
                      <button onClick={()=>saveStartBalance(activeFirm,editBalVal)} style={{background:"#00e5ff22",border:"1px solid #00e5ff44",borderRadius:4,padding:"2px 8px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:"#00e5ff"}}>✓</button>
                      <button onClick={()=>setEditingBalance(null)} style={{background:"transparent",border:"none",cursor:"pointer",color:"#4a6080",fontSize:12}}>✕</button>
                    </span>
                  : <span style={{cursor:"pointer",color:"#4a6080",fontSize:10,fontFamily:"'Space Mono',monospace"}}
                      onClick={()=>{setEditingBalance(activeFirm);setEditBalVal(String(acct.startBalance));}}>
                      Start: ${acct.startBalance.toLocaleString()} ✏
                    </span>
              } color={C.accent}/>
              <StatCard label="Total Profit"    value={`$${profit.toLocaleString()}`}                  sub={ptRule?`Target: $${ptRule.value.toLocaleString()}`:"Funded"} color={profit>=0?C.green:C.red}/>
              <StatCard label="Today P&L" value={`${acct.todayPnl>=0?"+":""}$${Math.round(acct.todayPnl).toLocaleString()}`} sub={dlRule?`Limit: -$${dlRule.value.toLocaleString()}`:"No daily limit"} color={acct.todayPnl>=0?C.green:C.red}/>
              <StatCard label="Drawdown"        value={`$${dd.toLocaleString()}`}                      sub={ddRule?`Max: $${ddRule.value.toLocaleString()}`:"—"}          color={ddRule&&dd>ddRule.value*.75?C.red:C.amber}/>
              <StatCard label="Payout Split"    value={`${acctType.payoutSplit}%`}                     sub={acctType.payoutFreq.split("(")[0].trim()}                    color={firm.color}/>
            </div>

            {/* Rule cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:13}}>
              {acctType.rules.map(rule=>{
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
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,marginTop:2}}>{firm.name} · {acctType.label} · {acctType.payoutSplit}% Split</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,marginTop:3}}>{acctType.payoutFreq} · Min payout ${acctType.minPayout}</div>
                  </div>
                  {canPayout&&<div style={{background:C.green+"22",border:`1px solid ${C.green}55`,borderRadius:8,padding:"8px 16px",fontFamily:"'Space Mono',monospace",fontSize:12,color:C.green,fontWeight:700}}>🎉 READY</div>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:20}}>
                  <div style={{background:C.surface,borderRadius:10,padding:16,border:`1px solid ${cycPct>=1?C.green+"44":C.border}`}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Cycle Profit</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:cycPct>=1?C.green:C.text}}>${acct.cycleProfit.toLocaleString()}</div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginTop:2}}>target ${po.cycleTarget.toLocaleString()} · your cut ~${Math.round(acct.cycleProfit*acctType.payoutSplit/100).toLocaleString()}</div>
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
                    {canPayout&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim,marginTop:3}}>Estimated payout: <span style={{color:C.green,fontWeight:700}}>${Math.round(acct.cycleProfit*acctType.payoutSplit/100).toLocaleString()}</span> after {acctType.payoutSplit}% split</div>}
                  </div>
                </div>
              </div>;
            })()}

            {/* Firm overview */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>Your Prop Firms</div>
              <div style={{display:"flex",gap:11,flexWrap:"wrap"}}>
                {firms.map(f=>{
                  const at=f.accountTypes.find(t=>t.id===f.activeType)||f.accountTypes[0];
                  const brs=at.rules.filter(r=>getPropStatus(r).status==="breach").length;
                  const wrn=at.rules.filter(r=>getPropStatus(r).status==="warning").length;
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
                <div style={{background:C.surface,border:`1px dashed ${C.border}`,borderRadius:10,padding:"14px 18px",cursor:"pointer",minWidth:150,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:12}}>+ Add Firm</div>
              </div>
            </div>
          </div>;
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
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(tvLoginForm),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Inloggning misslyckades");
              // Om flera konton — låt användaren välja vilket
              if (data.accounts?.length > 1) {
                setTvLoginAccounts(data.accounts);
                setTvLoginStep("select_account");
              } else {
                // Spara direkt om bara ett konto
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
              <button onClick={()=>{setShowTvLogin(true);setTvLoginStep("credentials");setTvLoginError("");}}
                style={{background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"8px 18px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.accent,fontWeight:700}}>
                + Anslut Tradovate-konto
              </button>
            </div>

            {/* Info-banner */}
            <div style={{background:"#00e5ff08",border:"1px solid #00e5ff22",borderRadius:10,padding:"14px 18px",display:"flex",gap:14,alignItems:"flex-start"}}>
              <span style={{fontSize:20,flexShrink:0}}>🔐</span>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.textDim,lineHeight:1.6}}>
                Dina Tradovate-credentials används <strong style={{color:C.text}}>bara för att hämta en access token</strong> som sparas krypterat i databasen.
                Lösenordet lagras aldrig. Tokens förnyas automatiskt vid behov.
                <br/>Varje konto du ansluter här blir tillgängligt i <strong style={{color:C.text}}>Trade Copier</strong>-fliken.
              </div>
            </div>

            {/* Anslutna konton */}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {tvAccounts.length===0 ? (
                <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:12,padding:40,textAlign:"center"}}>
                  <div style={{fontSize:32,marginBottom:12}}>📡</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,marginBottom:6}}>Inga konton anslutna</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.muted}}>Anslut dina Tradovate-konton för att aktivera Trade Copier och live P&L-tracking</div>
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
                      <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.green}}>Ansluten</span>
                    </div>
                    <button onClick={()=>disconnectAccount(acc.tradovate_account_id)}
                      style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>
                      Koppla från
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
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,marginBottom:4}}>Anslut Tradovate</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.muted,marginBottom:24}}>Logga in med dina Tradovate-uppgifter</div>

                    <div style={{display:"flex",flexDirection:"column",gap:12}}>
                      {[
                        {label:"Användarnamn",  key:"username", type:"text",     placeholder:"ditt.namn@email.com"},
                        {label:"Lösenord",       key:"password", type:"password", placeholder:"••••••••"},
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

                      {/* CID/Secret — behövs för Tradovate API-app */}
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
                            💡 Krävs bara om du har en egen Tradovate API-app. Annars används EdgeStats inbyggda app-credentials.
                          </div>
                        </div>
                      </details>

                      {tvLoginError && (
                        <div style={{background:C.red+"15",border:`1px solid ${C.red}44`,borderRadius:8,padding:"10px 14px",fontFamily:"'Space Mono',monospace",fontSize:11,color:C.red}}>
                          ⚠ {tvLoginError}
                        </div>
                      )}

                      <div style={{background:"#f59e0b11",border:"1px solid #f59e0b33",borderRadius:8,padding:"10px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:C.textDim}}>
                        🔒 Ditt lösenord skickas direkt till Tradovate och lagras <strong style={{color:C.text}}>aldrig</strong> i vår databas. Bara access token sparas.
                      </div>
                    </div>

                    <div style={{display:"flex",gap:10,marginTop:20}}>
                      <button onClick={()=>{setShowTvLogin(false);setTvLoginError("");}}
                        style={{flex:1,padding:"12px",borderRadius:10,cursor:"pointer",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>
                        Avbryt
                      </button>
                      <button onClick={doTvLogin} disabled={tvLoginLoading||!tvLoginForm.username||!tvLoginForm.password}
                        style={{flex:2,padding:"12px",borderRadius:10,cursor:tvLoginLoading?"wait":"pointer",background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,opacity:!tvLoginForm.username||!tvLoginForm.password?.5:1}}>
                        {tvLoginLoading ? "Ansluter…" : "Anslut konto →"}
                      </button>
                    </div>
                  </>}

                  {tvLoginStep==="select_account" && <>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,marginBottom:4}}>Välj konto</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:C.muted,marginBottom:20}}>Flera konton hittades — välj vilket du vill ansluta</div>
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
                            <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:acc.active?C.green:C.muted,marginTop:2}}>{acc.active?"Aktiv":"Inaktiv"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={()=>setTvLoginStep("credentials")} style={{marginTop:16,background:"transparent",border:"none",cursor:"pointer",color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>← Tillbaka</button>
                  </>}

                </div>
              </div>
            )}
          </div>;
        })()}

        {/* ── TRADE COPIER ────────────────────────────────────────────────────── */}
        {tab==="copier"&&(()=>{
          const FIRM_LABELS = {"mffu":"MFFU","lucid":"Lucid","alpha":"Alpha","tpt":"TPT","tradeify":"Tradeify"};
          const FIRM_COLORS = {"mffu":C.accent,"lucid":"#a78bfa","alpha":"#34d399","tpt":C.amber,"tradeify":"#f472b6"};
          const activeGroup = copierGroups.find(g=>g.id===activeGroupId);

          // Smart warnings: konton nära breach baserat på prop firm-regler
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
            const acctTypeObj = firmObj?.accountTypes?.[0];
            const ddRule = acctTypeObj?.rules?.find(r=>r.type==="drawdown");
            const balance = startBal + totalPnl;
            const peak = startBal + Math.max(0,totalPnl);
            const dd = peak - balance;
            if (ddRule && dd >= ddRule.value*0.75) warnings.push({level:"danger", msg:`DD ${Math.round(dd/ddRule.value*100)}% av max`});
            else if (ddRule && dd >= ddRule.value*0.5) warnings.push({level:"warning", msg:`DD ${Math.round(dd/ddRule.value*100)}% av max`});
            const csRule = acctTypeObj?.rules?.find(r=>r.type==="consist");
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
                <div onClick={()=>setCopierEnabled(e=>!e)} style={{width:48,height:26,borderRadius:13,background:copierEnabled?"#00d08444":C.surface,border:`1px solid ${copierEnabled?C.green:C.border}`,cursor:"pointer",position:"relative",transition:"all 0.2s"}}>
                  <div style={{position:"absolute",top:3,left:copierEnabled?24:3,width:18,height:18,borderRadius:"50%",background:copierEnabled?C.green:C.muted,transition:"left 0.2s",boxShadow:copierEnabled?`0 0 8px ${C.green}`:"none"}}/>
                </div>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:copierEnabled?C.green:C.muted,fontWeight:700}}>{copierEnabled?"ACTIVE":"OFF"}</span>
              </div>
            </div>

            {/* Active group banner */}
            {activeGroup && copierEnabled && (
              <div style={{background:"#00d08411",border:`1px solid ${C.green}44`,borderRadius:12,padding:"14px 20px",display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:C.green,boxShadow:`0 0 10px ${C.green}`,animation:"pulse 1.5s ease-in-out infinite"}}/>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.green,letterSpacing:"0.08em",textTransform:"uppercase"}}>Aktiv grupp — kopierar till {activeGroup.accountIds.length} konton</div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,marginTop:2}}>{activeGroup.name}</div>
                </div>
                <button onClick={()=>{setActiveGroup(null);setCopierEnabled(false);}} style={{background:"#ff3d5a22",border:"1px solid #ff3d5a44",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.red}}>Stoppa</button>
              </div>
            )}

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>

              {/* ── Konton ─────────────────────────────────────────────────── */}
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Mina konton ({copierAccounts.length})</div>
                  <button onClick={()=>setShowAddAccount(true)} style={{background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:6,padding:"4px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.accent}}>+ Lägg till</button>
                </div>

                {copierAccounts.length===0 && (
                  <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:12,padding:32,textAlign:"center",color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>
                    Inga konton tillagda ännu<br/><span style={{fontSize:9,marginTop:6,display:"block"}}>Lägg till dina Tradovate-konton för att börja</span>
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
                        <button onClick={()=>saveCopierAccounts(copierAccounts.map(a=>a.id===acc.id?{...a,isMaster:!a.isMaster}:a.isMaster?{...a,isMaster:false}:a))} style={{background:"transparent",border:"none",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:acc.isMaster?C.amber:C.muted,padding:"4px 6px"}} title="Sätt som master">★</button>
                        <button onClick={()=>saveCopierAccounts(copierAccounts.filter(a=>a.id!==acc.id))} style={{background:"transparent",border:"none",cursor:"pointer",color:C.red,fontSize:13,opacity:.5,padding:"4px 6px"}}>✕</button>
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
                  <button onClick={()=>{setNewGroupForm({name:"",accountIds:[]});setShowAddGroup(true);setEditGroupId(null);}} style={{background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:6,padding:"4px 12px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.accent}}>+ Ny grupp</button>
                </div>

                {copierGroups.length===0 && (
                  <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:12,padding:32,textAlign:"center",color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>
                    Inga grupper skapade<br/><span style={{fontSize:9,marginTop:6,display:"block"}}>Skapa grupper för att välja vilka konton som kopierar varje trade</span>
                  </div>
                )}

                {copierGroups.map(grp=>{
                  const isActive = grp.id===activeGroupId;
                  const grpAccounts = copierAccounts.filter(a=>grp.accountIds.includes(a.id));
                  const masterAcc = grpAccounts.find(a=>a.isMaster);
                  const slaveAccs = grpAccounts.filter(a=>!a.isMaster);
                  const anyDanger = grpAccounts.some(a=>getAccountWarnings(a.id).some(w=>w.level==="danger"));
                  return (
                    <div key={grp.id} style={{background:C.card,border:`2px solid ${isActive?C.green+"88":anyDanger?C.red+"44":C.border}`,borderRadius:12,padding:16,transition:"border 0.2s"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                        <div>
                          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16}}>{grp.name}</div>
                          <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,marginTop:2}}>{grpAccounts.length} konton · {slaveAccs.length} slaves</div>
                        </div>
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>{setEditGroupId(grp.id);setNewGroupForm({name:grp.name,accountIds:[...grp.accountIds]});setShowAddGroup(true);}} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.textDim}}>✏ Redigera</button>
                          <button onClick={()=>saveCopierGroups(copierGroups.filter(g=>g.id!==grp.id))} style={{background:"transparent",border:"none",cursor:"pointer",color:C.red,fontSize:13,opacity:.5,padding:"4px 6px"}}>✕</button>
                        </div>
                      </div>

                      {/* Konto-chips */}
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
                        {grpAccounts.length===0&&<span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted}}>Inga konton tillagda</span>}
                      </div>

                      {/* Aktivera knapp */}
                      {anyDanger && (
                        <div style={{background:C.red+"11",border:`1px solid ${C.red}33`,borderRadius:6,padding:"5px 10px",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.red,marginBottom:8}}>
                          ⚠ Ett eller flera konton är nära breach — överväg att ta bort dem från gruppen
                        </div>
                      )}
                      <button
                        onClick={()=>{ if(isActive){setActiveGroup(null);stopCopierBackend();}else{setActiveGroup(grp.id);startCopierBackend(grp);} }}
                        disabled={grpAccounts.length<2||!masterAcc}
                        style={{width:"100%",padding:"9px",borderRadius:8,cursor:grpAccounts.length<2||!masterAcc?"not-allowed":"pointer",background:isActive?"#00d08422":grpAccounts.length<2||!masterAcc?"#1e2d40":C.accentDim,border:`1px solid ${isActive?C.green:grpAccounts.length<2||!masterAcc?C.border:C.accent+"44"}`,color:isActive?C.green:grpAccounts.length<2||!masterAcc?C.muted:C.accent,fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,letterSpacing:"0.05em",transition:"all 0.15s"}}
                      >
                        {isActive?"⏹ Stoppa kopiering":grpAccounts.length<2?"Lägg till minst 2 konton":!masterAcc?"Sätt ett master-konto":"▶ Aktivera grupp"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Lägg till konto modal ───────────────────────────────────── */}
            {showAddAccount&&(
              <div style={{position:"fixed",inset:0,background:"#00000088",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{background:"#0d1420",border:"1px solid #1e2d40",borderRadius:16,padding:32,width:440,maxWidth:"95vw"}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,marginBottom:20}}>Lägg till konto</div>
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {[
                      {label:"Kontonamn",key:"name",placeholder:"t.ex. 50k Flex · MFFU #1"},
                      {label:"Tradovate konto-ID",key:"accountId",placeholder:"t.ex. 12345678"},
                      {label:"Kontobalans (startbalans)",key:"accountSize",placeholder:"50000"},
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
                      Kopieringen sker via Tradovates egna API med dina befintliga inloggade konton.
                    </div>
                  </div>
                  <div style={{display:"flex",gap:10,marginTop:20}}>
                    <button onClick={()=>setShowAddAccount(false)} style={{flex:1,padding:"11px",borderRadius:10,cursor:"pointer",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>Avbryt</button>
                    <button onClick={()=>{
                      if(!newAcctForm.name.trim()||!newAcctForm.accountId.trim()) return;
                      saveCopierAccounts([...copierAccounts,{...newAcctForm,id:Date.now().toString(),isMaster:copierAccounts.length===0}]);
                      setShowAddAccount(false);
                      setNewAcctForm({name:"",firm:"mffu",accountSize:"50000",username:"",password:"",accountId:""});
                    }} style={{flex:2,padding:"11px",borderRadius:10,cursor:"pointer",background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700}}>
                      + Lägg till konto
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Skapa/redigera grupp modal ──────────────────────────────── */}
            {showAddGroup&&(
              <div style={{position:"fixed",inset:0,background:"#00000088",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{background:"#0d1420",border:"1px solid #1e2d40",borderRadius:16,padding:32,width:460,maxWidth:"95vw"}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,marginBottom:20}}>{editGroupId?"Redigera grupp":"Skapa grupp"}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:14}}>
                    <div>
                      <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>Gruppnamn</div>
                      <input value={newGroupForm.name} onChange={e=>setNewGroupForm(x=>({...x,name:e.target.value}))} placeholder="t.ex. Alla konton · Bara Tradeify · Safe mode"
                        style={{width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}/>
                    </div>
                    <div>
                      <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.07em"}}>Välj konton</div>
                      {copierAccounts.length===0
                        ? <div style={{color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11,padding:"12px 0"}}>Lägg till konton först</div>
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
                      {newGroupForm.accountIds.length} konton valda · {newGroupForm.accountIds.length>=2?"Redo att spara":"Välj minst 2 konton"}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:10,marginTop:20}}>
                    <button onClick={()=>{setShowAddGroup(false);setEditGroupId(null);}} style={{flex:1,padding:"11px",borderRadius:10,cursor:"pointer",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontFamily:"'Space Mono',monospace",fontSize:11}}>Avbryt</button>
                    <button onClick={()=>{
                      if(!newGroupForm.name.trim()||newGroupForm.accountIds.length<2) return;
                      if(editGroupId) {
                        saveCopierGroups(copierGroups.map(g=>g.id===editGroupId?{...g,...newGroupForm}:g));
                      } else {
                        saveCopierGroups([...copierGroups,{...newGroupForm,id:Date.now().toString()}]);
                      }
                      setShowAddGroup(false); setEditGroupId(null);
                    }} disabled={!newGroupForm.name.trim()||newGroupForm.accountIds.length<2}
                      style={{flex:2,padding:"11px",borderRadius:10,cursor:!newGroupForm.name.trim()||newGroupForm.accountIds.length<2?"not-allowed":"pointer",background:C.accentDim,border:`1px solid ${C.accent}44`,color:C.accent,fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,opacity:!newGroupForm.name.trim()||newGroupForm.accountIds.length<2?.5:1}}>
                      {editGroupId?"Spara ändringar":"Skapa grupp"}
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
                  <StatCard label="Kopierade trades" value={String(copierStatus.stats?.copiedTrades||0)} sub="Denna session" color={C.green}/>
                  <StatCard label="Misslyckade"       value={String(copierStatus.stats?.failedTrades||0)} sub="Kontrollera log" color={copierStatus.stats?.failedTrades>0?C.red:C.muted}/>
                  <StatCard label="WebSocket"         value={copierStatus.connected?"✓ Live":"⚠ Reconnecting"} sub={copierStatus.wsState} color={copierStatus.connected?C.green:C.amber}/>
                  <StatCard label="Slaves"            value={String(copierStatus.slaveCount||0)} sub="Aktiva konton" color={C.accent}/>
                </div>

                {/* Kopieringslogg */}
                {copierLog.length>0 && (
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                    <div style={{padding:"12px 18px",borderBottom:`1px solid ${C.border}`,fontFamily:"'Space Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Kopieringslogg</div>
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                        {["Tid","Action","Qty","Pris","Lyckade","Misslyckade"].map(h=><th key={h} style={{padding:"8px 16px",textAlign:"left",fontFamily:"'Space Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.07em",textTransform:"uppercase",fontWeight:400}}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {copierLog.map((entry,i)=>(
                          <tr key={entry.id||i} style={{borderBottom:i<copierLog.length-1?`1px solid ${C.border}`:"none"}}
                            onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <td style={{padding:"9px 16px",fontFamily:"'Space Mono',monospace",fontSize:10,color:C.muted}}>{new Date(entry.timestamp).toLocaleTimeString("sv-SE",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</td>
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

      </div>
    </div>
  );
}
