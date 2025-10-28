// src/Kiosk.jsx
import React, { useEffect, useMemo, useState } from "react";
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

function formatNow() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hm = `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  return `${m}/${day}/${y} - ${hm}`;
}

export default function Kiosk({ onSwitchTab }) {
  const [employees, setEmployees] = useState([]);
  const [statusMap, setStatusMap] = useState({}); // { [empId]: 'in' | 'out' }
  const [q, setQ] = useState("");
  const [nowStr, setNowStr] = useState(formatNow());
  const [loading, setLoading] = useState(true);
  const [diag, setDiag] = useState("");

  function normalizeDir(raw) {
    const s = String(raw || "").toLowerCase();
    if (SCHEMA.dirIn.includes(s)) return "in";
    if (SCHEMA.dirOut.includes(s)) return "out";
    return undefined;
  }

  useEffect(() => {
    const t = setInterval(() => setNowStr(formatNow()), 30_000);
    return () => clearInterval(t);
  }, []);

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

  const filtered = useMemo(() => {
    const s = (q || "").toLowerCase().trim();
    if (!s) return employees;
    return employees.filter((e) => (e[SCHEMA.employeeName] || "").toLowerCase().includes(s));
  }, [employees, q]);

  async function handleClock(emp) {
    const empId = emp[SCHEMA.employeeId];
    const last = statusMap[empId]; // 'in' | 'out' | undefined
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
    <div className="container">
      <div className="header">
        <h1>Bundy Clock – Kiosk</h1>
        <div className="tabs" aria-label="mode tabs">
          <button className="tab active" onClick={() => onSwitchTab?.("kiosk")}>Kiosk</button>
          <button className="tab" onClick={() => onSwitchTab?.("admin")}>Admin</button>
        </div>
      </div>

      {diag && (
        <div className="pill" style={{ marginBottom: 10 }}>
          {diag}
        </div>
      )}

      <div className="controls">
        <input
          className="input"
          placeholder="Search your name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="pill">{nowStr}</div>
      </div>

      {loading ? (
        <div className="pill" style={{ display: "inline-block" }}>Loading…</div>
      ) : (
        <div className="emp-grid">
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
