// src/lib/exportCSVAllEmployees.js
import { createClient } from "@supabase/supabase-js";

// Use distinct names to avoid clashing with window.URL in createObjectURL.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Export ALL employees (names + ids, optionally active flag) to CSV.
 * Defaults assume columns: id, name, active on table: employees
 */
export async function exportCSVAllEmployees({
  table = "employees",
  idCol = "id",
  nameCol = "name",
  activeCol = "active",
  includeActive = true,
  filenamePrefix = "employees_all",
} = {}) {
  // Build select list (include active if present)
  const selectCols = includeActive ? `${idCol}, ${nameCol}, ${activeCol}` : `${idCol}, ${nameCol}`;

  const { data, error } = await supabase
    .from(table)
    .select(selectCols)
    .neq(activeCol, false)      // Exclude deactivated employees
    .is("deleted_at", null)     // Exclude soft-deleted employees
    .order(nameCol, { ascending: true });

  if (error) {
    console.error("exportCSVAllEmployees/select error:", error);
    throw new Error(error.message || "Failed to fetch employees");
  }

  const rows = data || [];

  // CSV helpers
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const headers = includeActive
    ? ["employee_id", "employee_name", "active"]
    : ["employee_id", "employee_name"];

  const csv = [
    headers.join(","),
    ...rows.map((r) => {
      const id = r[idCol];
      const nm = r[nameCol] ?? "";
      if (includeActive) {
        const act = r[activeCol] !== false; // treat null as true/active
        return [esc(id), esc(nm), esc(act)].join(",");
      }
      return [esc(id), esc(nm)].join(",");
    }),
  ].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const ts = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  const filename = `${filenamePrefix}_${ts}.csv`;

  const a = document.createElement("a");
  const blobUrl = window.URL.createObjectURL(blob);
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}
