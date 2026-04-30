export const PLANCK_PER_VARA = 1_000_000_000_000n;

export function toDisplayNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value.replaceAll(",", "")) || 0;
  if (value && typeof value === "object" && "toString" in value) {
    return Number((value as { toString: () => string }).toString().replaceAll(",", "")) || 0;
  }
  return 0;
}

export function parsePlanck(value: string | null | undefined) {
  try {
    return value ? BigInt(value) : null;
  } catch {
    return null;
  }
}

export function formatVaraAmount(planck: bigint) {
  const whole = planck / PLANCK_PER_VARA;
  const fractional = (planck % PLANCK_PER_VARA).toString().padStart(12, "0").slice(0, 2);
  return `${whole.toString()}.${fractional}`;
}

export function formatPlanckVara(value: string | null | undefined) {
  const planck = parsePlanck(value);
  if (planck === null) return "balance unknown";
  return `${formatVaraAmount(planck)} VARA left`;
}

export function formatNextVoucherWait() {
  const now = new Date();
  const nextUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const msLeft = Math.max(0, nextUtcMidnight - now.getTime());
  const hoursLeft = Math.ceil(msLeft / 3_600_000);
  if (hoursLeft <= 1) return "less than 1 hour";
  return `about ${hoursLeft} hours`;
}

export function shortAddress(address: string) {
  if (!address) return "UNKNOWN";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    const parts = [
      value.message,
      value.name,
      value.section && value.method ? `${String(value.section)}.${String(value.method)}` : null,
      value.docs,
      value.type,
    ]
      .flatMap((part) => (Array.isArray(part) ? part : [part]))
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0);

    if (parts.length > 0) {
      return parts.join(" · ");
    }

    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }

  return String(error);
}

export function isSignatureRejection(error: unknown) {
  const message = formatError(error).toLowerCase();
  return (
    message.includes("reject") ||
    message.includes("denied") ||
    message.includes("user cancelled") ||
    message.includes("cancelled by user") ||
    message.includes("user rejected") ||
    message.includes("closed")
  );
}

export function unwrapOption<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    const option = value as Record<string, unknown>;
    if ("None" in option || "none" in option) return null;
    if ("Some" in option) return option.Some as T;
    if ("some" in option) return option.some as T;
  }
  return value as T;
}
