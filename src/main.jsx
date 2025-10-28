// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css"; // ensure global styles load


const el = document.getElementById("app");
createRoot(el).render(<App />);
