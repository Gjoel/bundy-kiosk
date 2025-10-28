// src/App.jsx
import React, { useState } from "react";
import "./styles.css";
import Kiosk from "./Kiosk.jsx";
import Admin from "./Admin.jsx";
import { exportCSVAllEmployees } from './lib/exportCSVAllEmployees';

async function handleExport() {
  const start = new Date(fromDate); start.setHours(0,0,0,0);
  const end   = new Date(toDate);   end.setHours(23,59,59,999);
  await exportCSVAllEmployees(start.toISOString(), end.toISOString(), 'Australia/Sydney');
}
// <button onClick={handleExport}>Export CSV (All Employees)</button>


export default function App() {
  const [tab, setTab] = useState("kiosk"); // 'kiosk' | 'admin'
  const switchTab = (t) => setTab(t);

  return tab === "kiosk" ? (
    <Kiosk onSwitchTab={switchTab} />
  ) : (
    <Admin onSwitchTab={switchTab} />
  );
}
