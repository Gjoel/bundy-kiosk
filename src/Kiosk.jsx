// src/Kiosk.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

/** ====== SCHEMA MAPPING ====== */
const SCHEMA = {
  employeesTable: "employees",
  employeeId: "id",
  employeeName: "name",
  employeeActive: "active",

  eventsTable: "events",
  eventEmployeeId: "employee_id",
  eventDirection: "direction",
  eventCreatedAt: "created_at",

  dirIn: ["in", "clock_in", "clocked_in"],
  dirOut: ["out", "clock_out", "clocked_out"],
};
/** ============================ */

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(URL, KEY);

function normalizeDir(raw) {
  const s = String(raw || "").toLowerCase();
  if (SCHEMA.dirIn.includes(s)) return "in";
  if (SCHEMA.dirOut.includes(s)) return "out";
  return undefined;
}

/** Hard kill-switch for any “Add Employee” control injected by other components */
function hideAddEmployeeButtons(root) {
  if (!root) return;
  const isAdd = (el) => /(^|\+?\s*)add\s+employee/i.test((el.textContent || "").trim());
  const markHide = (el) => { if (isAdd(el)) el.style.setProperty("display", "none", "important"); };

  root.querySelectorAll('button, a, [role="button"]').forEach(markHide);

  // Catch future renders
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches?.('button, a, [role="button"]')) markHide(node);
        node.querySelectorAll?.('button, a, [role="button"]').forEach(markHide);
      }
    }
  });
  mo.observe(root, { childList: true, subtree: true });
  return () => mo.disconnect();
}

export default function Kiosk({ onSwitchTab }) {
  const [employees, setEmployees] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [diag, setDiag] = useState("");
  const inputRef = useRef(null);

  // Hide “Add Employee” anywhere inside the kiosk page container
  useEffect(() => {
    const root = document.querySelector('[data-page="kiosk"]') || document.body;
    const stop = hideAddEmployeeButtons(root);
    return () => stop?.();
  }, []);

  // Load employees + latest status
  async function load() {
    setLoading(true);
    setDiag("");
    try {
      const { data: emps, error: e1 } = await supabase
        .from(SCHEMA.employeesTable)
        .select([SCHEMA.employeeId, SCHEMA.employeeName, SCHEMA.employeeActive].join(","))
        .order(SCHEMA.employeeName, { ascending: true });

      if (e1) throw new Error(`employees/select: ${e1.message}`);

      const activeEmps = (emps || []).filter((e) => e[SCHEMA.employeeActive] !== false);
      setEmployees(activeEmps);

      if (activeEmps.length) {
        const ids = activeEmps.map((e) => e[SCHEMA.employeeId]);
        const { data: evs, error: e2 } = await supabase
          .from(SCHEMA.eventsTable)
          .select([SCHEMA.eventEmployeeId, SCHEMA.eventDirection, SCHEMA.eventCreatedAt].join(","))
          .in(SCHEMA.eventEmployeeId, ids)
          .order(SCHEMA.eventCreatedAt, { ascending: false });

        if (e2) {
          setDiag(`events/select error: ${e2.message}`);
          setStatusMap({});
        } else {
          const map = {};
          for (const ev of evs || []) {
            const id = ev[SCHEMA.eventEmployeeId];
            if (!map[id]) map[id] = normalizeDir(ev[SCHEMA.eventDirection]) || "out";
          }
          setStatusMap(map);
        }
      } else {
        setStatusMap({});
      }
    } catch (err) {
      console.error("Kiosk load error:", err);
      setDiag(String(err.message || err));
      setEmployees([]);
      setStatusMap({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { inputRef.current?.focus(); }, [loading]);

  const filtered = useMemo(() => {
    const s = (q || "").toLowerCase().trim();
    if (!s) return employees;
    return employees.filter((e) => (e[SCHEMA.employeeName] || "").toLowerCase().includes(s));
  }, [employees, q]);

  async function handleClock(emp) {
    const empId = emp[SCHEMA.employeeId];
    const last = statusMap[empId];
    const nextDir = last === "in" ? (SCHEMA.dirOut[0] || "out") : (SCHEMA.dirIn[0] || "in");

    try {
      const payload = {
        [SCHEMA.eventEmployeeId]: empId,
        [SCHEMA.eventDirection]: nextDir,
      };
      const { error } = await supabase.from(SCHEMA.eventsTable).insert([payload]);
      if (error) throw new Error(`events/insert: ${error.message}`);
      setStatusMap((prev) => ({ ...prev, [empId]: last === "in" ? "out" : "in" }));
    } catch (err) {
      console.error("Clock error:", err);
      alert(`Clock action failed: ${err.message || err}`);
    }
  }

  return (
    <div className="container" data-page="kiosk">
      <div className="header">
        <>Bundy Clock – Kiosk123</h1>
        <div className="tabs" aria-label="mode tabs">
          <button className="tab active" onClick={() => onSwitchTab?.("kiosk")}>Kiosk</button>
          <button className="tab" onClick={() => onSwitchTab?.("admin")}>Admin</button>
        </div>
      </div>

      {diag && <div className="pill" style={{ marginBottom: 10 }}>{diag}</div>}

      <div className="toolbar" role="group" aria-label="Kiosk controls">
        <div className="search-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10.5 3a7.5 7.5 0 1 1-5.304 12.804l-3.1 3.1a1 1 0 0 1-1.414-1.414l3.1-3.1A7.5 7.5 0 0 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11a5.5 5.5 0 0 0 0-11Z"/>
          </svg>

          <input
            ref={inputRef}
            type="text"
            className="search-input input search-bubble"
            placeholder="Search your name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search employees"
            aria-controls="emp-list"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
          />

          {q ? (
            <button
              type="button"
              className="clear-btn"
              aria-label="Clear search"
              onClick={() => setQ("")}
              title="Clear"
            >
              ×
            </button>
          ) : null}
        </div>

        <ClockBubble />
      </div>

      {loading ? (
        <div className="pill" style={{ display: "inline-block" }}>Loading…</div>
      ) : (
        <div id="emp-list" className="emp-grid">
          {filtered.map((emp) => {
            const id = emp[SCHEMA.employeeId];
            const name = emp[SCHEMA.employeeName];
            const dir = statusMap[id] || "out";
            const label = dir === "in" ? "Clock Out" : "Clock In";
            const statusTxt = dir === "in" ? "Clocked In" : "Clocked Out";
            const btnClass = dir === "in" ? "btn btn-danger" : "btn btn-primary";
            return (
              <div key={id} className="emp-card">
                <div className="emp-top">
                  <div className="emp-name">{name}</div>
                  <span className="status-pill">{statusTxt}</span>
                </div>
                <button className={btnClass} onClick={() => handleClock(emp)}>
                  {label}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClockBubble() {
  const [text, setText] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const fmt = now.toLocaleString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      setText(fmt.replace(",", ""));
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);
  return <div className="clock-bubble" aria-live="polite">{text}</div>;
}
