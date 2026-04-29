// Vara Network on-chain integration. Voucher-friendly: the player
// never pays VARA value, and gas is intended to come from a sponsor
// voucher issued by the Vara Arcade voucher backend. Wraps the
// auto-generated SailsProgram client behind a tiny stateful service so
// scenes can call helpers without thinking about API connection
// lifecycle.
//
// Configuration follows the Vara Arcade conventions:
//   VITE_NODE_ADDRESS         — Vara RPC, default mainnet
//   VITE_PROGRAM_ID           — deployed RoboMinerProfile program id
//   VITE_VOUCHER_BACKEND_URL  — voucher backend, default arcade prod
// Defaults below match the deployed mainnet contract.

import { GearApi } from '@gear-js/api';
import { web3FromAddress } from '@polkadot/extension-dapp';
import { SailsProgram } from './contracts/lib.ts';

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
const RPC = env.VITE_NODE_ADDRESS || 'wss://rpc.vara.network';
const PROGRAM_ID = (env.VITE_PROGRAM_ID
  || '0xacc90a11efbb848c75cfd166b00c4bf3d702fd767f0930e9d2840bf091614f1b');
const NETWORK = env.VITE_NETWORK || 'vara-mainnet';

let _apiPromise = null;
let _program = null;

// Lazy singleton — connects on the first awaited call. Reusing the
// same WS connection across the session keeps things snappy.
async function getApi() {
  if (_apiPromise) return _apiPromise;
  _apiPromise = (async () => {
    const api = await GearApi.create({ providerAddress: RPC });
    return api;
  })();
  return _apiPromise;
}

async function getProgram() {
  if (_program) return _program;
  const api = await getApi();
  _program = new SailsProgram(api, PROGRAM_ID);
  return _program;
}

// ---- Queries (free, no signing) --------------------------------------------

export async function queryProfile(playerSs58) {
  const program = await getProgram();
  return program.roboMinerProfile.profile(playerSs58);
}

export async function queryTotalPlayers() {
  const program = await getProgram();
  const n = await program.roboMinerProfile.totalPlayers();
  return Number(n);
}

export async function queryTopPlayers(limit = 10) {
  const program = await getProgram();
  return program.roboMinerProfile.topPlayers(limit);
}

// ---- Voucher backend (Vara Arcade) -----------------------------------------

// Default to the Vara Arcade production voucher backend. Overridable
// per-environment via VITE_VOUCHER_BACKEND_URL.
const VOUCHER_BACKEND_URL = (
  (import.meta.env && import.meta.env.VITE_VOUCHER_BACKEND_URL)
  || 'https://arcade-vara-production.up.railway.app'
).replace(/\/+$/, '');

async function readJson(response) {
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const msg = typeof json?.message === 'string'
      ? json.message
      : Array.isArray(json?.message)
        ? json.message.join(', ')
        : `voucher_backend_${response.status}`;
    throw new Error(msg);
  }
  return json;
}

/// Read-only voucher state for `account`. Returns shape:
///   { voucherId, programs, varaBalance, balanceKnown, validUpTo, fundedToday }
/// where any field can be missing / null. Used by the menu to gate
/// "Start Digging" and to show the voucher chip.
export async function getVoucherState(account) {
  const res = await fetch(
    `${VOUCHER_BACKEND_URL}/voucher/${encodeURIComponent(account)}`,
  );
  return readJson(res);
}

/// Issue or top-up a voucher for `account` against our `PROGRAM_ID`.
/// No wallet signature required — the backend rate-limits per-IP and
/// per-account.
export async function issueVoucher(account) {
  const res = await fetch(`${VOUCHER_BACKEND_URL}/voucher`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account, program: PROGRAM_ID }),
  });
  return readJson(res);
}

/// One-shot: returns a usable voucherId for (account, PROGRAM_ID),
/// asking the backend to issue one if none exists. Throws on backend
/// failure.
export async function ensureVoucher(account) {
  const state = await getVoucherState(account);
  const id = state?.voucherId;
  const programs = state?.programs || [];
  const idLooksValid = typeof id === 'string' && /^0x[0-9a-f]{64}$/i.test(id);
  const programReady = programs.some(
    (p) => String(p).toLowerCase() === PROGRAM_ID.toLowerCase(),
  );
  if (idLooksValid && programReady) {
    return { voucherId: id, source: 'existing', state };
  }
  const created = await issueVoucher(account);
  const newId = String(created?.voucherId || '');
  if (!/^0x[0-9a-f]{64}$/i.test(newId)) {
    throw new Error('voucher_backend_returned_invalid_id');
  }
  const refreshed = await getVoucherState(account).catch(() => null);
  return { voucherId: newId, source: 'issued', state: refreshed || created };
}

/// Returns the voucherId for (account, PROGRAM_ID) if one is already
/// usable, or null. Doesn't trigger issuance.
export async function queryVoucherFor(account) {
  try {
    const s = await getVoucherState(account);
    const id = s?.voucherId;
    const programs = s?.programs || [];
    if (
      typeof id === 'string'
      && /^0x[0-9a-f]{64}$/i.test(id)
      && programs.some((p) => String(p).toLowerCase() === PROGRAM_ID.toLowerCase())
    ) {
      return id;
    }
    return null;
  } catch {
    return null;
  }
}

// ---- Commands (signed by player; gas paid by voucher) ----------------------

// Helper: prep a TransactionBuilder against the player's wallet, attach
// the player's voucher (asking the backend to issue one if needed),
// send, and resolve when the on-chain block is finalized.
async function signAndSend(tx, ss58) {
  const injector = await web3FromAddress(ss58);
  tx.withAccount(ss58, { signer: injector.signer });
  const { voucherId } = await ensureVoucher(ss58);
  tx.withVoucher(voucherId);
  await tx.calculateGas();
  const { msgId, blockHash, response } = await tx.signAndSend();
  await response();
  return { msgId, blockHash, voucherId };
}

/// Submit a finished run. Score = money + (50_000 if diamond).
/// Player pays no value; gas comes from the voucher.
export async function submitRun(score, ss58) {
  const program = await getProgram();
  const tx = program.roboMinerProfile.submitRun(BigInt(score));
  return signAndSend(tx, ss58);
}

/// Wipe the caller's profile (mainly for dev / fresh restart).
export async function resetSelf(ss58) {
  const program = await getProgram();
  const tx = program.roboMinerProfile.resetSelf();
  return signAndSend(tx, ss58);
}

// ---- Balance helpers --------------------------------------------------------

/// Free, returns raw chain units (12-decimal: 1 VARA = 1e12).
export async function getVaraBalanceRaw(ss58) {
  const api = await getApi();
  const { data } = await api.query.system.account(ss58);
  return BigInt(data.free.toString());
}

/// Convert raw → human VARA float (rounded to 4 decimals).
export function rawToVara(raw) {
  const r = typeof raw === 'bigint' ? raw : BigInt(raw);
  const whole = r / 1_000_000_000_000n;
  const frac = Number(r % 1_000_000_000_000n) / 1_000_000_000_000;
  return Number(whole) + frac;
}

/// Format raw chain units as a short "1.234 VARA" string.
export function formatVara(raw, digits = 3) {
  if (raw == null) return '— VARA';
  try {
    const v = rawToVara(raw);
    return `${v.toFixed(digits)} VARA`;
  } catch {
    return '— VARA';
  }
}

// ---- Public deployment info -------------------------------------------------

export const PROGRAM_INFO = {
  programId: PROGRAM_ID,
  network: NETWORK,
  voucherBackend: VOUCHER_BACKEND_URL,
};
