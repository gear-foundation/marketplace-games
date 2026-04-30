import React from "react";
import { createRoot } from "react-dom/client";
import "@gear-js/ui/dist/index.css";
import "@gear-js/vara-ui/dist/style.css";
import "@gear-js/wallet-connect/dist/style.css";
import "./styles.css";
import { ZombieApocalypseApp } from "./App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ZombieApocalypseApp />
  </React.StrictMode>,
);
