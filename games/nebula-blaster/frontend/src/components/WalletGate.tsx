import { useEffect } from "react";
import { useAccount } from "@gear-js/react-hooks";
import { Wallet } from "@gear-js/wallet-connect";
import "@gear-js/ui/dist/index.css";
import "@gear-js/vara-ui/dist/style.css";
import "@gear-js/wallet-connect/dist/style.css";

type WalletGateProps = {
  onConnectionChange: (connected: boolean) => void;
};

export function WalletGate({ onConnectionChange }: WalletGateProps) {
  const { account } = useAccount();
  const connected = Boolean(account?.decodedAddress || account?.address);

  useEffect(() => {
    onConnectionChange(connected);
  }, [connected, onConnectionChange]);

  return (
    <div className="wallet-widget" aria-label="Wallet connection">
      <Wallet theme="vara" displayBalance={false} />
    </div>
  );
}
