// src/Admin.jsx
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { isAdminUnlocked, checkPinAndUnlock, lockAdmin } from "./adminPin.js";
import { exportCSVAllEmployees } from './lib/exportCSVAllEmployees'; // adjust path if needed


async function handleExport() {
  // assume you already have fromDate/toDate (Date objects) in state
  const start = new Date(fromDate); start.setHours(0,0,0,0);
  const end = new Date(toDate);     end.setHours(23,59,59,999);
  await exportCSVAllEmployees(start.toISOString(), end.toISOString(), 'Australia/Sydney');
}

// in your JSX:
<button onClick={handleExport}>Export CSV (All Employees)</button>


/** ====== SCHEMA MAPPING ====== */
const SCHEMA = {
  employeesTable: "employees",
  employeeId: "id",
  employeeName: "name",
  employeeActive: "active",
  employeeOrgId: "org_id",

  eventsTable: "events",
  eventEmployeeId: "employee_id",
  eventDirection: "direction",
  eventCreatedAt: "created_at",

  dirIn: ["in", "clock_in", "clocked_in"],
  dirOut: ["out", "clock_out", "clocked_out"],
};
/** ============================ */

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function pad2(n) { return String(n).padStart(2, "0"); }
function toLocalParts(ts) {
  const d = new Date(ts);
  return {
    y: d.getFullYear(),
    m: pad2(d.getMonth() + 1),
    d: pad2(d.getDate()),
    hh: pad2(d.getHours()),
    mm: pad2(d.getMinutes()),
  };
}
function hhmmNoLeading(hh, mm) { return String(parseInt(`${hh}${mm}`, 10)); }

export default function Admin({ onSwitchTab }) {
  // ORG
  const [orgId, setOrgId] = useState((import.meta.env.VITE_ORG_ID || "").trim());
  const [orgDiag, setOrgDiag] = useState("");
  async function resolveOrgId() {
    try {
      if (orgId) return;
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "org_id")
        .maybeSingle();
      if (error) throw error;
      if (data?.value) setOrgId(String(data.value).trim());
      else setOrgDiag("Missing org_id: set VITE_ORG_ID in .env or add settings('org_id').");
    } catch (e) {
      console.error(e);
      setOrgDiag("Could not read org_id from settings. Set VITE_ORG_ID in .env.");
    }
  }

  // PIN
  const [admin, setAdmin] = useState(isAdminUnlocked());
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  // Data
  const [employees, setEmployees] = useState([]);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);

  // Inline rename
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  // Export
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Add single
  const [newName, setNewName] = useState("");

  // Import
  const [importInfo, setImportInfo] = useState({ total: 0, inserted: 0, updated: 0, skipped: 0, errors: 0, lastError: "" });
  const [importBusy, setImportBusy] = useState(false);

  // Load employees
  async function load() {
    setLoading(true);
    try {
      let q = supabase
        .from(SCHEMA.employeesTable)
        .select([SCHEMA.employeeId, SCHEMA.employeeName, SCHEMA.employeeActive, SCHEMA.employeeOrgId].join(","))
        .order(SCHEMA.employeeName, { ascending: true });
      if (orgId) q = q.eq(SCHEMA.employeeOrgId, orgId);
      const { data, error } = await q;
      if (error) throw error;
      setEmployees(data || []);
    } catch (e) {
      console.error(e);
      setEmployees([]);
      alert("Failed to load employees");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { resolveOrgId(); }, []);
  useEffect(() => { load(); }, [orgId]);

  const visible = useMemo(
    () => showInactive ? employees : employees.filter((e) => e[SCHEMA.employeeActive] !== false),
    [employees, showInactive]
  );

  // PIN handlers
  async function submitPin(e) {
    e.preventDefault();
    setPinError("");
    const ok = await checkPinAndUnlock(pin);
    if (!ok) { setPinError("Incorrect PIN"); return; }
    setAdmin(true); setPin("");
  }
  function doLock() { lockAdmin(); setAdmin(false); setPinError(""); }

  // Rename
  function startRename(emp) { setEditingId(emp[SCHEMA.employeeId]); setEditingName(emp[SCHEMA.employeeName] || ""); }
  function cancelRename() { setEditingId(null); setEditingName(""); }
  async function saveRename(emp) {
    const newVal = (editingName || "").trim();
    if (!newVal || newVal === emp[SCHEMA.employeeName]) { cancelRename(); return; }
    try {
      const { error } = await supabase.from(SCHEMA.employeesTable)
        .update({ [SCHEMA.employeeName]: newVal })
        .eq(SCHEMA.employeeId, emp[SCHEMA.employeeId]);
      if (error) throw error;
      await load();
    } catch (e) { console.error(e); alert("Rename failed"); }
    finally { cancelRename(); }
  }

  // Deactivate / Delete
  async function onDeactivate(emp) {
    if (!admin) return;
    if (!window.confirm(`Deactivate ${emp[SCHEMA.employeeName]}?`)) return;
    try {
      const { error } = await supabase.from(SCHEMA.employeesTable)
        .update({ [SCHEMA.employeeActive]: false })
        .eq(SCHEMA.employeeId, emp[SCHEMA.employeeId]);
      if (error) throw error;
      await load();
    } catch (e) { console.error(e); alert("Deactivate failed"); }
  }
  async function onDelete(emp) {
    if (!admin) return;
    if (!window.confirm(`Permanently delete ${emp[SCHEMA.employeeName]}?`)) return;
    try {
      const { error } = await supabase.from(SCHEMA.employeesTable)
        .delete().eq(SCHEMA.employeeId, emp[SCHEMA.employeeId]);
      if (error) throw error;
      await load();
    } catch (e) { console.error(e); alert("Delete failed"); }
  }

  // Add single
  async function addSingle(e) {
    e.preventDefault();
    if (!admin) { alert("Unlock with PIN first"); return; }
    if (!orgId) { alert("Missing org_id. Set VITE_ORG_ID in .env or add settings('org_id')."); return; }
    const name = (newName || "").trim();
    if (!name) { alert("Name required"); return; }
    try {
      const { error } = await supabase.from(SCHEMA.employeesTable)
        .insert([{ [SCHEMA.employeeName]: name, [SCHEMA.employeeActive]: true, [SCHEMA.employeeOrgId]: orgId }]);
      if (error) throw error;
      setNewName(""); await load();
    } catch (e) { console.error(e); alert("Add failed"); }
  }

  // ===== CSV IMPORT (fixed quotes) =====
  function resetImportInfo() { setImportInfo({ total: 0, inserted: 0, updated: 0, skipped: 0, errors: 0, lastError: "" }); }

  function parseCSV(text) {
    const rows = [];
    let i = 0, field = "", row = [], inQuotes = false;
    while (i < text.length) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      } else {
        if (c === '"') { inQuotes = true; i++; continue; }
        if (c === ",") { row.push(field); field = ""; i++; continue; }
        if (c === "\n" || c === "\r") {
          if (c === "\r" && text[i + 1] === "\n") i++;
          row.push(field); field = "";
          if (row.some((x) => x !== "")) rows.push(row);
          row = []; i++; continue;
        }
        field += c; i++; continue;
      }
    }
    row.push(field);
    if (row.some((x) => x !== "")) rows.push(row);
    return rows;
  }

  async function handleImportFile(e) {
    if (!admin) { alert("Unlock with PIN first"); e.target.value = ""; return; }
    if (!orgId) { alert("Missing org_id. Set VITE_ORG_ID in .env or add settings('org_id')."); e.target.value = ""; return; }
    const file = e.target.files?.[0]; if (!file) return;

    resetImportInfo(); setImportBusy(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows.length) throw new Error("Empty CSV");

      // accept single-column (header or no header)
      const first = (rows[0][0] || "").toLowerCase();
      const hasHeader = rows[0].length > 1 || first === "name" || first === "employee_name";
      const start = hasHeader ? 1 : 0;

      const records = [];
      for (let r = start; r < rows.length; r++) {
        const name = (rows[r][0] || "").trim();
        if (!name) continue;
        records.push({
          [SCHEMA.employeeName]: name,
          [SCHEMA.employeeActive]: true,
          [SCHEMA.employeeOrgId]: orgId,
        });
      }
      if (!records.length) { alert("No valid names found."); return; }

      const CHUNK = 200; let inserted = 0, errors = 0, lastError = "";
      for (let i = 0; i < records.length; i += CHUNK) {
        const chunk = records.slice(i, i + CHUNK);
        const res = await supabase.from(SCHEMA.employeesTable).insert(chunk);
        if (res.error) { console.error(res.error); errors += chunk.length; lastError = res.error.message; }
        else { inserted += chunk.length; }
        setImportInfo(prev => ({ ...prev, total: records.length, inserted, skipped: records.length - inserted, errors, lastError }));
      }
      await load();
    } catch (err) {
      console.error(err);
      setImportInfo(prev => ({ ...prev, errors: prev.errors + 1, lastError: String(err.message || err) }));
      alert(`Import failed: ${err.message || err}`);
    } finally { setImportBusy(false); e.target.value = ""; }
  }

  // ===== Export (pivot) =====
  function download(filename, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.style.display = "none";
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function buildCsvPivot(rowsByEmpDate, uniqueDates) {
    const row1 = ["employee_name"]; for (const d of uniqueDates) row1.push(d, d, d, d);
    const row2 = [""]; for (let i = 0; i < uniqueDates.length; i++) row2.push("In", "Out", "In", "Out");
    const lines = [row1, row2];
    for (const [empName, byDate] of rowsByEmpDate) {
      const line = [empName];
      for (const d of uniqueDates) {
        const pairs = byDate.get(d) || [];
        const p1 = pairs[0] || ["", ""], p2 = pairs[1] || ["", ""];
        line.push(p1[0] || "", p1[1] || "", p2[0] || "", p2[1] || "");
      }
      lines.push(line);
    }
    return lines.map(arr => arr.join(",")).join("\n") + "\n";
  }
  function toCSV_Pivot(employees, evs) {
    const nameById = new Map(employees.map(e => [e[SCHEMA.employeeId], e[SCHEMA.employeeName]]));
    const uniqueDatesSet = new Set(); const tempByKey = new Map();
    const isIn  = (s) => SCHEMA.dirIn.includes(String(s).toLowerCase());
    const isOut = (s) => SCHEMA.dirOut.includes(String(s).toLowerCase());

    for (const ev of evs || []) {
      const p = toLocalParts(ev[SCHEMA.eventCreatedAt]);
      const dateIso = `${p.y}-${p.m}-${p.d}`; const dateHdr = `${p.d}/${p.m}/${p.y}`;
      uniqueDatesSet.add(dateHdr);
      const id = ev[SCHEMA.eventEmployeeId]; const key = `${id}|${dateIso}`;
      if (!tempByKey.has(key)) tempByKey.set(key, []);
      tempByKey.get(key).push({ dir: ev[SCHEMA.eventDirection], hh: p.hh, mm: p.mm });
    }

    const rowsByEmpDate = new Map();
    for (const [key, arr] of tempByKey) {
      const [id, dateIso] = key.split("|"); const [y, m, d] = dateIso.split("-");
      const dateHdr = `${d}/${m}/${y}`; const empName = nameById.get(id) || "";
      let openIn = null; const pairs = [];
      for (const item of arr) {
        if (isIn(item.dir)) openIn = hhmmNoLeading(item.hh, item.mm);
        else if (isOut(item.dir) && openIn != null) {
          pairs.push([openIn, hhmmNoLeading(item.hh, item.mm)]); openIn = null;
          if (pairs.length === 2) break;
        }
      }
      if (!rowsByEmpDate.has(empName)) rowsByEmpDate.set(empName, new Map());
      rowsByEmpDate.get(empName).set(dateHdr, pairs);
    }

    const uniqueDates = Array.from(uniqueDatesSet)
      .sort((a, b) => a.split("/").reverse().join("").localeCompare(b.split("/").reverse().join("")));
    return buildCsvPivot(rowsByEmpDate, uniqueDates);
  }
  async function exportCSV() {
    if (!admin) { alert("Unlock admin to export"); return; }
    if (!from || !to) { alert("Select From and To dates"); return; }
    try {
      const fromIso = new Date(from).toISOString();
      const toEnd = new Date(to); toEnd.setDate(toEnd.getDate() + 1);
      const toIso = toEnd.toISOString();
      const { data: evs, error } = await supabase
        .from(SCHEMA.eventsTable)
        .select([SCHEMA.eventEmployeeId, SCHEMA.eventDirection, SCHEMA.eventCreatedAt].join(","))
        .gte(SCHEMA.eventCreatedAt, fromIso)
        .lt(SCHEMA.eventCreatedAt, toIso)
        .order(SCHEMA.eventCreatedAt, { ascending: true });
      if (error) throw error;

      const csv = toCSV_Pivot(employees, evs);
      download(`bundy_export_${from}_to_${to}.csv`, csv);
    } catch (e) { console.error("Export failed:", e); alert("Export failed. Check schema & date range."); }
  }

  return (
    <div className="container admin-page">
      <div className="header">
        <h1>Bundy Clock – Admin</h1>
        <div className="tabs" aria-label="mode tabs">
          <button className="tab" onClick={() => onSwitchTab?.("kiosk")}>Kiosk</button>
          <button className="tab active" onClick={() => onSwitchTab?.("admin")}>Admin</button>
        </div>
      </div>

      {/* Sticky toolbar */}
      <div className="toolbar">
        {!orgId && (
          <div className="pill" style={{ marginBottom: 12, borderColor: "#fca5a5", color: "#b91c1c" }}>
            {orgDiag || "org_id is required for inserts. Set VITE_ORG_ID in .env or add settings('org_id')."}
          </div>
        )}

        {!admin ? (
          <form onSubmit={submitPin} className="toolbar-row">
            <input className="input-lg" type="password" placeholder="Enter PIN (1234)" value={pin}
                   onChange={(e) => setPin(e.target.value)} style={{ width: 220 }} />
            <button className="tab-lg" type="submit">Unlock Admin</button>
            {pinError && <span style={{ color: "#b91c1c", fontSize: "18px" }}>{pinError}</span>}
          </form>
        ) : (
          <div className="toolbar-row">
            <button className="tab-lg" onClick={doLock}>Lock Admin</button>
            <label style={{ display: "inline-flex", gap: 10, alignItems: "center", fontSize: "18px" }}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Show inactive / deleted
            </label>
            <button className="tab-lg" onClick={load}>Refresh</button>
          </div>
        )}
      </div>

      {/* Add single + Import */}
      {admin && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="toolbar-row" style={{ marginBottom: 10 }}>
            <form onSubmit={addSingle} className="toolbar-row" style={{ flex: 1 }}>
              <input className="input-lg" placeholder="New employee name"
                     value={newName} onChange={(e) => setNewName(e.target.value)}
                     style={{ maxWidth: 420 }} />
              <button className="tab-lg" type="submit" disabled={!orgId}>Add Person</button>
            </form>
          </div>
          <div className="toolbar-row">
            <input type="file" accept=".csv" onChange={handleImportFile} disabled={importBusy || !orgId} />
            <button className="tab" type="button" onClick={() => {
              const sample = "name\nAlice\nBob\n";
              const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "employees_template.csv"; a.style.display = "none";
              document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            }}>Download Template</button>
            <span className="input-hint">Upload a single-column CSV with header <b>name</b> (or no header). All imported as active = true.</span>
          </div>
          <div className="input-hint" style={{ marginTop: 6 }}>
            Imported: total {importInfo.total}, errors {importInfo.errors}
            {importInfo.lastError ? ` (last error: ${importInfo.lastError})` : ""}
          </div>
        </div>
      )}

      {/* Employees table */}
      <div className="card">
        <table className="table">
          <colgroup>
            <col className="col-name" />
            <col className="col-status" />
            <col className="col-acts" />
          </colgroup>
        <thead>
          <tr><th>Name</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={3} style={{ padding: 22 }}>Loading…</td></tr>
          ) : visible.length === 0 ? (
            <tr><td colSpan={3} style={{ padding: 22, color: "#64748b" }}>No employees</td></tr>
          ) : (
            visible.map((emp) => {
              const id = emp[SCHEMA.employeeId];
              const name = emp[SCHEMA.employeeName];
              const inactive = emp[SCHEMA.employeeActive] === false;
              const isEditing = editingId === id;

              return (
                <tr key={id} className={inactive ? "row-muted" : ""}>
                  <td>
                    {!isEditing ? (
                      <span style={{ display: "inline-block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {name}
                      </span>
                    ) : (
                      <div style={{ display: "flex", gap: 10 }}>
                        <input className="input-sm" value={editingName} onChange={(e) => setEditingName(e.target.value)}
                               style={{ width: 360, fontSize: "18px", padding: "10px 12px" }} />
                        <button className="btn-chip" onClick={() => saveRename(emp)}>Save</button>
                        <button className="btn-chip" onClick={cancelRename}>Cancel</button>
                      </div>
                    )}
                  </td>
                  <td>{inactive ? "Inactive" : "Active"}</td>
                  <td>
                    {admin ? (
                      !isEditing ? (
                        <>
                          <button className="btn-chip" onClick={() => startRename(emp)}>Rename</button>
                          <button className="btn-chip warn" onClick={() => onDeactivate(emp)}>Deactivate</button>
                          <button className="btn-chip danger" onClick={() => onDelete(emp)}>Delete</button>
                        </>
                      ) : (
                        <span style={{ color: "#64748b" }}>Editing…</span>
                      )
                    ) : (
                      <span style={{ color: "#64748b" }}>Unlock to manage</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        </table>

        {/* Export panel */}
        <div className="export-panel">
          <label>From: <input className="input-sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>To: <input className="input-sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button className="tab" onClick={exportCSV}>Export CSV</button>
          <span className="input-hint">Exports to your requested layout (employee row, dates with In/Out pairs, HHMM).</span>
        </div>
      </div>
    </div>
  );
}
