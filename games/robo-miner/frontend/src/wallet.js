// Browser wallet integration for Vara Network. Wraps the
// @polkadot/extension-dapp helpers behind a tiny stateful service so
// scenes can:
//   - enumerate installed Substrate-compatible browser extensions
//     (Polkadot.js, Talisman, SubWallet, Enkrypt, ...);
//   - ask one of them for accounts;
//   - remember the picked address across reloads;
//   - expose a subscriber API the HUD can use to live-update the chip.

import { web3Enable, web3Accounts, web3FromAddress } from '@polkadot/extension-dapp';
import { encodeAddress, decodeAddress } from '@polkadot/util-crypto';

// Vara mainnet ss58 prefix.
const VARA_SS58_PREFIX = 137;

// Re-encode a Polkadot-format ss58 (5... prefix 0) into Vara (kG...
// prefix 137). The underlying 32-byte public key is identical — only
// the displayed prefix changes — so signatures stay valid against
// either form.
export function toVaraAddress(addr) {
  if (!addr) return addr;
  try {
    return encodeAddress(decodeAddress(addr), VARA_SS58_PREFIX);
  } catch {
    return addr;
  }
}

// Re-export the injector lookup so chain.js can grab the `signer`
// without importing extension-dapp twice. Returns the InjectedExtension
// for the given address (signer + metadata).
export { web3FromAddress };

const APP_NAME = 'Robo Miner';
const STORAGE_KEY = 'roboMiner.wallet';

// Lookup table — maps the `source` reported by extension-dapp into the
// pretty name, brand color and install link. The picker shows ALL of
// these, marking which ones are installed; uninstalled ones turn into
// a one-click "Install" tile.
export const KNOWN_WALLETS = {
  'polkadot-js':  { label: 'Polkadot.js',  color: '#e6007a', install: 'https://polkadot.js.org/extension/' },
  'talisman':     { label: 'Talisman',     color: '#fd4848', install: 'https://talisman.xyz/' },
  'subwallet-js': { label: 'SubWallet',    color: '#4cd9ac', install: 'https://subwallet.app/' },
  'enkrypt':      { label: 'Enkrypt',      color: '#7c3aed', install: 'https://www.enkrypt.com/' },
};
export const KNOWN_WALLET_SOURCES = Object.keys(KNOWN_WALLETS);

// In-memory state shared across scenes. Cleaner than a global because
// the subscribers list lets the HUD repaint when state changes.
const state = {
  source: null,        // extension id (e.g. 'polkadot-js')
  address: null,       // ss58 address
  accounts: [],        // [{ address, name, source }]
  available: [],       // ['polkadot-js', 'talisman', ...] — extensions present in browser
  enabled: false,      // true once web3Enable returned ≥1 ext
};

const subs = new Set();
function emit() { for (const fn of subs) fn(getState()); }

export function subscribe(fn) {
  subs.add(fn);
  fn(getState());
  return () => subs.delete(fn);
}

export function getState() {
  return { ...state, accounts: state.accounts.slice(), available: state.available.slice() };
}

// Read previously saved choice. Doesn't auto-connect — that requires
// the user to grant permission again, which we trigger on the chip click.
export function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function persist(source, address) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ source, address }));
  } catch { /* noop */ }
}

// Enumerate browser extensions that injected themselves into
// `window.injectedWeb3`. Doesn't ask for accounts yet — that's a
// permission step the user has to confirm once.
export function detectWallets() {
  const inj = (typeof window !== 'undefined' && window.injectedWeb3) || {};
  state.available = Object.keys(inj);
  emit();
  return state.available;
}

// Calls `web3Enable` to ask permission, then `web3Accounts` to fetch
// the address list. The user picks one in the modal; selecting it sets
// state.address and persists. If `preferredSource` is passed, only that
// wallet's accounts are returned (avoids leaking accounts from others).
export async function connectWallet(preferredSource) {
  detectWallets();
  if (state.available.length === 0) {
    throw new Error('NO_EXTENSION');
  }
  const exts = await web3Enable(APP_NAME);
  if (!exts.length) throw new Error('PERMISSION_DENIED');
  state.enabled = true;

  let accounts = await web3Accounts();
  if (preferredSource) {
    accounts = accounts.filter(a => a?.meta?.source === preferredSource);
  }
  state.accounts = accounts.map(a => ({
    // Re-encode every address to Vara (prefix 137) so the UI is
    // consistent regardless of which network the user has selected
    // in their browser extension. signRaw / verify still work — the
    // underlying public key is what gets signed against.
    address: toVaraAddress(a.address),
    name: a?.meta?.name || '',
    source: a?.meta?.source || preferredSource || 'unknown',
  }));
  emit();
  return state.accounts;
}

// Mark one of the listed accounts as the active one.
export function selectAccount(address) {
  const found = state.accounts.find(a => a.address === address);
  if (!found) return null;
  state.address = found.address;
  state.source  = found.source;
  persist(state.source, state.address);
  emit();
  return found;
}

// Forget the saved address + clear in-memory state. The browser
// extensions' grants stay (they're managed by the extension), but our
// app no longer treats any wallet as connected.
export function disconnect() {
  state.source = null;
  state.address = null;
  state.accounts = [];
  state.enabled = false;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  emit();
}

// 6 + … + 4 trimmed display, e.g. `kGHabc…wxyz` — short enough for the
// HUD chip but recognisable.
export function shortAddress(addr) {
  if (!addr || addr.length < 12) return addr || '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Restore state on module load (no permission prompt, no network) so
// the HUD can paint a "previously connected" chip immediately. The
// real account list is fetched only on first user click. Addresses
// stored from older sessions might be in Polkadot format — normalise
// them to Vara on the way in.
const stored = loadStored();
if (stored) {
  state.source = stored.source;
  state.address = toVaraAddress(stored.address);
}
detectWallets();
