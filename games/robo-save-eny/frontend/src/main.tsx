import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { RoboSaveEnyApp } from "./App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RoboSaveEnyApp />
  </React.StrictMode>,
);
