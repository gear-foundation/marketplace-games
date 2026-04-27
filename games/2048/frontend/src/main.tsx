import React from "react";
import { createRoot } from "react-dom/client";
import { AccountProvider, AlertProvider, ApiProvider } from "@gear-js/react-hooks";
import { Alert, alertStyles } from "@gear-js/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@gear-js/ui/dist/index.css";
import "@gear-js/vara-ui/dist/style.css";
import "@gear-js/wallet-connect/dist/style.css";
import { Game2048 } from "./components/Game2048";
import "./styles.css";

const APP_NAME = "2048";
const VARA_NODE_ADDRESS = import.meta.env.VITE_NODE_ADDRESS || "wss://rpc.vara.network";
const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ApiProvider initialArgs={{ endpoint: VARA_NODE_ADDRESS }}>
        <AccountProvider appName={APP_NAME}>
          <AlertProvider template={Alert} containerClassName={alertStyles.root}>
            <Game2048 />
          </AlertProvider>
        </AccountProvider>
      </ApiProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
