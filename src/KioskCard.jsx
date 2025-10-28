// src/KioskCard.jsx
import { useEffect, useState } from "react";
import { getOpenShift, clockIn, clockOut } from "./api";

export default function KioskCard({ emp }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");

  async function refreshOpen() {
    try {
      const s = await getOpenShift(emp.id);
      setOpen(Boolean(s));
    } catch (e) {
      setErr(e.message || String(e));
    }
  }

  useEffect(() => {
    refreshOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emp.id]);

  async function toggle() {
    try {
      setBusy(true); setErr("");
      if (open) await clockOut(emp.id);
      else await clockIn(emp.id);
      await refreshOpen();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kiosk-card">
      <div className="kiosk-card-top">
        <div className="kiosk-name">{emp.name}</div>
        <span className={`status-pill ${open ? "in" : "out"}`}>
          {open ? "Clocked In" : "Clocked Out"}
        </span>
      </div>
      <button
        className={`kiosk-btn ${open ? "out" : "in"}`}
        onClick={toggle}
        disabled={busy}
      >
        {open ? "Clock Out" : "Clock In"}
      </button>
      {err && <div className="error" style={{marginTop:8}}>{err}</div>}
    </div>
  );
}
