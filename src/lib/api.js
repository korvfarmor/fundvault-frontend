import { supabase } from "../supabaseClient";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ── Core fetch wrapper ────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "API error");
  return json;
}

// ── Trades ────────────────────────────────────────────────────────────────────
export const tradesApi = {
  list:   (params = {}) => apiFetch(`/trades?${new URLSearchParams(params)}`),
  get:    (id)          => apiFetch(`/trades/${id}`),
  create: (body)        => apiFetch("/trades",        { method: "POST",   body: JSON.stringify(body) }),
  update: (id, body)    => apiFetch(`/trades/${id}`,  { method: "PATCH",  body: JSON.stringify(body) }),
  delete: (id)          => apiFetch(`/trades/${id}`,  { method: "DELETE" }),
  stats:  (params = {}) => apiFetch(`/trades/stats/summary?${new URLSearchParams(params)}`),
};

// ── Prop Accounts ─────────────────────────────────────────────────────────────
export const propApi = {
  list:         ()           => apiFetch("/prop-accounts"),
  create:       (body)       => apiFetch("/prop-accounts",            { method: "POST",   body: JSON.stringify(body) }),
  update:       (id, body)   => apiFetch(`/prop-accounts/${id}`,      { method: "PATCH",  body: JSON.stringify(body) }),
  remove:       (id)         => apiFetch(`/prop-accounts/${id}`,      { method: "DELETE" }),
  addRule:      (body)       => apiFetch("/prop-accounts/rules",       { method: "POST",   body: JSON.stringify(body) }),
  removeRule:   (ruleId)     => apiFetch(`/prop-accounts/rules/${ruleId}`, { method: "DELETE" }),
};

// ── Psychology ────────────────────────────────────────────────────────────────
export const psychApi = {
  checkins:    (params = {}) => apiFetch(`/psychology/checkins?${new URLSearchParams(params)}`),
  saveCheckin: (body)        => apiFetch("/psychology/checkins",       { method: "POST", body: JSON.stringify(body) }),
  habits:      ()            => apiFetch("/psychology/habits"),
  addHabit:    (body)        => apiFetch("/psychology/habits",         { method: "POST", body: JSON.stringify(body) }),
  removeHabit: (id)          => apiFetch(`/psychology/habits/${id}`,   { method: "DELETE" }),
  moodCorrelation: ()        => apiFetch("/psychology/mood-correlation"),
};

// ── Trading Rules ─────────────────────────────────────────────────────────────
export const rulesApi = {
  list:   ()         => apiFetch("/rules"),
  create: (body)     => apiFetch("/rules",       { method: "POST",   body: JSON.stringify(body) }),
  update: (id, body) => apiFetch(`/rules/${id}`, { method: "PATCH",  body: JSON.stringify(body) }),
  remove: (id)       => apiFetch(`/rules/${id}`, { method: "DELETE" }),
};

// ── Tradovate ─────────────────────────────────────────────────────────────────
export const tradovateApi = {
  status:  ()      => apiFetch("/tradovate/status"),
  connect: (body)  => apiFetch("/tradovate/connect", { method: "POST", body: JSON.stringify(body) }),
  sync:    ()      => apiFetch("/tradovate/sync",    { method: "POST" }),
};
