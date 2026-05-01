import { useEffect } from "react";
import { AccountProvider, ApiProvider, useAccount } from "@gear-js/react-hooks";
import { Wallet } from "@gear-js/wallet-connect";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@gear-js/ui/dist/index.css";
import "@gear-js/vara-ui/dist/style.css";
import "@gear-js/wallet-connect/dist/style.css";

const queryClient = new QueryClient();

type WalletRuntimeProps = {
  appName: string;
  nodeAddress: string;
  onAccountChange: (accountIdentity: string) => void;
};

function WalletAccountBridge({
  onAccountChange,
}: {
  onAccountChange: (accountIdentity: string) => void;
}) {
  const { account } = useAccount();
  const accountIdentity = account?.decodedAddress || account?.address || "";

  useEffect(() => {
    onAccountChange(accountIdentity);
  }, [accountIdentity, onAccountChange]);

  return <Wallet theme="vara" displayBalance={false} />;
}

export default function WalletRuntime({
  appName,
  nodeAddress,
  onAccountChange,
}: WalletRuntimeProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider initialArgs={{ endpoint: nodeAddress }}>
        <AccountProvider appName={appName}>
          <WalletAccountBridge onAccountChange={onAccountChange} />
        </AccountProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
