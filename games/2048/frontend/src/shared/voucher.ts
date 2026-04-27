import { formatPlanckVara, parsePlanck, shortAddress } from "./format";

export type VoucherState = {
  voucherId: string | null;
  programs?: string[];
  varaBalance?: string | null;
  balanceKnown?: boolean;
  validUpTo?: string | null;
  fundedToday?: boolean;
  revokedToday?: boolean;
};

export type VoucherCreateResponse = {
  voucherId?: unknown;
};

export type VoucherRevokeResponse = {
  revoked?: boolean;
  voucherId?: unknown;
  reason?: unknown;
};

export type VoucherResult = {
  voucherId: `0x${string}`;
  balanceText: string;
  balancePlanck: bigint | null;
  source: "existing" | "issued";
};

export function getConfiguredBackendUrl(url: string) {
  return /^https?:\/\/.+/.test(url) ? url : "";
}

export async function readVoucherJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message =
      typeof json?.message === "string"
        ? json.message
        : Array.isArray(json?.message)
          ? json.message.join(", ")
          : `Voucher backend returned ${response.status}`;
    throw new Error(message);
  }

  return json as T;
}

export async function getVoucherState(backendUrl: string, account: string) {
  const response = await fetch(`${backendUrl}/voucher/${encodeURIComponent(account)}`);
  return readVoucherJson<VoucherState>(response);
}

export async function revokeVoucher(backendUrl: string, account: string, voucherId: `0x${string}`) {
  const response = await fetch(`${backendUrl}/voucher/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account, voucherId }),
  });
  return readVoucherJson<VoucherRevokeResponse>(response);
}

export function describeVoucher(state: VoucherState, programId: `0x${string}`) {
  if (!state.voucherId || !/^0x[0-9a-fA-F]{64}$/.test(state.voucherId)) {
    return "";
  }

  const hasGameAccess = state.programs?.some((program) => program.toLowerCase() === programId.toLowerCase());
  const accessText = hasGameAccess ? "Voucher ready" : "Voucher found";
  const balanceText = state.balanceKnown === false ? "balance unknown" : formatPlanckVara(state.varaBalance);
  return `${accessText} · ${balanceText} · ${shortAddress(state.voucherId)}`;
}

export async function ensureVoucher(
  backendUrl: string,
  account: string,
  programId: `0x${string}`,
): Promise<VoucherResult> {
  const state = await getVoucherState(backendUrl, account);
  const normalizedProgram = programId.toLowerCase();

  if (
    state.voucherId &&
    /^0x[0-9a-fA-F]{64}$/.test(state.voucherId) &&
    state.programs?.some((program) => program.toLowerCase() === normalizedProgram)
  ) {
    return {
      voucherId: state.voucherId as `0x${string}`,
      balanceText: state.balanceKnown === false ? "balance unknown" : formatPlanckVara(state.varaBalance),
      balancePlanck: state.balanceKnown === false ? null : parsePlanck(state.varaBalance),
      source: "existing",
    };
  }

  const createResponse = await fetch(`${backendUrl}/voucher`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account, program: programId }),
  });
  const created = await readVoucherJson<VoucherCreateResponse>(createResponse);
  const voucherId = String(created.voucherId || "");

  if (!/^0x[0-9a-fA-F]{64}$/.test(voucherId)) {
    throw new Error("Voucher backend returned an invalid voucher id.");
  }

  const refreshedState = await getVoucherState(backendUrl, account).catch(() => null);

  return {
    voucherId: voucherId as `0x${string}`,
    balanceText:
      refreshedState?.balanceKnown === false ? "balance unknown" : formatPlanckVara(refreshedState?.varaBalance),
    balancePlanck: refreshedState?.balanceKnown === false ? null : parsePlanck(refreshedState?.varaBalance),
    source: "issued",
  };
}
