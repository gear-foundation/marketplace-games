import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Game } from "./app/app";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Game />
  </React.StrictMode>
);
