import { useEffect, useMemo, useState } from "react";
import { useApi } from "@gear-js/react-hooks";
import type { Sails } from "sails-js";
import contractIdl from "../idl/contract.idl?raw";
import { createSailsClient, getConfiguredProgramId } from "../shared/chain";
import { formatError } from "../shared/format";

const VARA_PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || "";

export function useNebulaProgram() {
  const { api, isApiReady } = useApi();
  const [sailsClient, setSailsClient] = useState<Sails | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  const programId = useMemo(() => getConfiguredProgramId(VARA_PROGRAM_ID), []);

  useEffect(() => {
    let cancelled = false;
    setSailsClient(null);
    if (!isApiReady || !programId) return undefined;

    createSailsClient(api, programId, contractIdl)
      .then((client) => {
        if (cancelled) return;
        setSailsClient(client);
        setStatusMsg("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatusMsg(`Contract client error: ${formatError(err)}`);
      });

    return () => {
      cancelled = true;
    };
  }, [api, isApiReady, programId]);

  return { sailsClient, programId, statusMsg };
}
