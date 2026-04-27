import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { NebulaApp } from "./App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NebulaApp />
  </React.StrictMode>,
);
