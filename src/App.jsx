// src/App.jsx
import React, { useState } from "react";
import "./styles.css";
import Kiosk from "./Kiosk.jsx";
import Admin from "./Admin.jsx";

export default function App() {
  const [tab, setTab] = useState("kiosk"); // 'kiosk' | 'admin'
  const switchTab = (t) => setTab(t);

  return tab === "kiosk" ? (
    <Kiosk onSwitchTab={switchTab} />
  ) : (
    <Admin onSwitchTab={switchTab} />
  );
}
