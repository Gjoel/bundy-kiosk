// src/adminPin.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Hard default (works even if .env/DB not set)
const DEFAULT_PIN = "1234";
const LS_KEY = "bundy_admin_until";
const DEFAULT_HOURS = 12;

const now = () => Date.now();
const hours = (h) => h * 60 * 60 * 1000;

export function isAdminUnlocked() {
  const until = Number(localStorage.getItem(LS_KEY) || 0);
  return until > now();
}
export function lockAdmin() {
  localStorage.removeItem(LS_KEY);
}
function unlockFor(hoursCount = DEFAULT_HOURS) {
  localStorage.setItem(LS_KEY, String(now() + hours(hoursCount)));
}

async function fetchPinFromDB() {
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "admin_pin")
      .maybeSingle();
    if (error) return null;
    return data?.value?.toString() ?? null;
  } catch {
    return null;
  }
}

/** Inline check — returns true/false (no prompt). Also unlocks on success. */
export async function checkPinAndUnlock(inputPin) {
  const envPin = (import.meta.env.VITE_ADMIN_PIN || "").trim();
  const dbPin = envPin ? null : await fetchPinFromDB();
  const required = (envPin || dbPin || DEFAULT_PIN).trim();
  const ok = inputPin && inputPin.trim() === required;
  if (ok) unlockFor(DEFAULT_HOURS);
  return ok;
}
