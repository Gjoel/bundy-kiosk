// src/EmployeeRow.jsx
import { useState } from "react";
import { getOpenShift, clockIn, clockOut, renameEmployee, deactivateEmployee, softDeleteEmployee } from "./api";

export default function EmployeeRow({ emp, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(emp.name);

  async function toggleClock() {
    try {
      setBusy(true); setErr("");
      const open = await getOpenShift(emp.id);
      if (open) await clockOut(emp.id);
      else await clockIn(emp.id);
      onChanged?.();
    } catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  async function saveName(e) {
    e.preventDefault();
    const trimmed = (name || "").trim();
    if (!trimmed) { setErr("Name cannot be empty."); return; }
    if (trimmed === emp.name) { setEditing(false); return; }
    try {
      setBusy(true); setErr("");
      await renameEmployee(emp.id, trimmed);
      setEditing(false);
      onChanged?.();
    } catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  async function setActive(on) {
    try {
      setBusy(true); setErr("");
      await deactivateEmployee(emp.id, on);
      onChanged?.();
    } catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  async function softDelete() {
    if (!confirm(`Delete "${emp.name}"? (This is a soft delete; use Deactivate to simply hide)`)) return;
    try { setBusy(true); setErr(""); await softDeleteEmployee(emp.id); onChanged?.(); }
    catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  return (
    <>
      <tr className={emp.active && !emp.deleted_at ? "" : "row-inactive"}>
        <td className="col-name">
          {editing ? (
            <form onSubmit={saveName} className="inline">
              <input value={name} onChange={e => setName(e.target.value)} className="input" />
              <button className="btn solid" type="submit" disabled={busy}>Save</button>
              <button className="btn ghost" type="button" onClick={() => { setEditing(false); setName(emp.name); }}>Cancel</button>
            </form>
          ) : (
            <>
              <strong>{emp.name}</strong>
              <span className="muted">#{emp.employee_code}</span>
            </>
          )}
        </td>
        <td className="col-status">{emp.deleted_at ? "Deleted" : emp.active ? "Active" : "Inactive"}</td>
        <td className="col-actions">
          <div className="actions">
            <button className="pill" onClick={toggleClock} disabled={busy}>Clock In/Out</button>
            <button className="pill" onClick={() => setEditing(true)} disabled={busy}>Rename</button>
            {emp.active ? (
              <button className="pill warn" onClick={() => setActive(false)} disabled={busy}>Deactivate</button>
            ) : (
              <button className="pill" onClick={() => setActive(true)} disabled={busy}>Activate</button>
            )}
            <button className="pill danger" onClick={softDelete} disabled={busy}>Delete</button>
          </div>
          {err && <div className="error">{err}</div>}
        </td>
      </tr>
    </>
  );
}
