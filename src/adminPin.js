// src/adminPin.js

const STORAGE_KEY = "bundy_admin_unlocked";
const DEFAULT_PIN = "1234";

function getExpectedPin() {
  const envPin = (import.meta?.env?.VITE_ADMIN_PIN ?? "").toString().trim();
  return envPin || DEFAULT_PIN;
}

function hasStorage() {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function isAdminUnlocked() {
  if (!hasStorage()) return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function lockAdmin() {
  if (!hasStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export async function checkPinAndUnlock(inputPin) {
  const expected = getExpectedPin();
  const ok = String(inputPin ?? "").trim() === expected;
  if (ok && hasStorage()) {
    window.localStorage.setItem(STORAGE_KEY, "1");
  }
  return ok;
}
