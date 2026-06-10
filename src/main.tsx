import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initThemeFromStorage } from "@/lib/theme";
import "@xterm/xterm/css/xterm.css";
import "./index.css";

initThemeFromStorage();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
