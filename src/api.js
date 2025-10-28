// src/api.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ORG = import.meta.env.VITE_ORG_ID || "wslr";

export const sb = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { "x-org-id": ORG } },
});

// ---------- Helpers ----------
export function hhmm(d) {
  const dt = new Date(d);
  const H = String(dt.getHours()).padStart(2, "0");
  const M = String(dt.getMinutes()).padStart(2, "0");
  return `${H}${M}`; // 24h compact
}
export function isoLocal(d) {
  return new Date(d).toISOString();
}

// ---------- Employees ----------
export async function listEmployees({ includeInactive = false } = {}) {
  // RPC returns columns without a 'name' conflict (emp_name)
  const { data, error } = await sb.rpc("get_employees", {
    p_include_inactive: includeInactive,
  });
  if (error) throw error;

  // Map emp_name -> name for the UI and sort on the client
  const rows = (data || []).map(r => ({ ...r, name: r.emp_name }));
  rows.sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "en", { sensitivity: "base" })
  );
  return rows;
}


export async function renameEmployee(id, newName) {
  const { error } = await sb
    .from("employees")
    .update({ name: newName, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", ORG);
  if (error) throw error;
}

export async function deactivateEmployee(id, onOff) {
  const { error } = await sb
    .from("employees")
    .update({ active: onOff, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", ORG);
  if (error) throw error;
}

export async function softDeleteEmployee(id) {
  const now = new Date().toISOString();
  const { error } = await sb
    .from("employees")
    .update({ active: false, deleted_at: now, updated_at: now })
    .eq("id", id)
    .eq("org_id", ORG);
  if (error) throw error;
}

export async function addEmployee(name) {
  const clean = (name || "").trim();
  if (!clean) return null;
  const { data, error } = await sb.rpc("upsert_employees_from_names", {
    names: [clean],
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

// Robust CSV upsert (UI prepares names; this RPC does the work)
export async function upsertNames(names) {
  const clean = [...new Set(names.map(n => (n ?? "").toString().trim()).filter(Boolean))];
  if (!clean.length) return [];
  const { data, error } = await sb.rpc("upsert_employees_from_names", {
    names: clean,
  });
  if (error) throw error;
  return data || [];
}


// ---------- Shifts ----------
export async function getOpenShift(employeeId) {
  const { data, error } = await sb
    .from("shifts")
    .select("id,clock_in")
    .eq("org_id", ORG)
    .eq("employee_id", employeeId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function clockIn(employeeId) {
  const { data, error } = await sb.rpc("clock_in", {
    p_employee_id: employeeId,
    p_source: "kiosk",
  });
  if (error) throw error;
  return data;
}

export async function clockOut(employeeId) {
  const { data, error } = await sb.rpc("clock_out", {
    p_employee_id: employeeId,
    p_source: "kiosk",
  });
  if (error) throw error;
  return data;
}

export async function fetchShiftsBetween(startISO, endISO) {
  const { data, error } = await sb
    .from("shifts")
    .select("id,employee_id,clock_in,clock_out,auto_clocked_out,source")
    .eq("org_id", ORG)
    .gte("clock_in", startISO)
    .lt("clock_in", endISO)
    .order("clock_in", { ascending: true });
  if (error) throw error;
  return data || [];
}
