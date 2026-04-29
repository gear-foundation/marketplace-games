// Wallet picker modal. Same brown-earth pixel-art language as the
// shop / inventory (#1d140b body, #4b2e15 borders, #c9a06a accents).
// Two-step flow:
//   1. Pick an extension (icon grid of installed wallets).
//   2. Pick an account from the chosen extension.
// On selection it persists via wallet.js and resolves the calling promise.

import {
  KNOWN_WALLETS,
  KNOWN_WALLET_SOURCES,
  detectWallets,
  connectWallet,
  selectAccount,
  disconnect,
  getState,
  shortAddress,
} from './wallet.js';

const ID = 'wallet-modal';

// Cute pixel-art SVG used for unknown extensions (fallback brand-color
// chip + tiny gem). Keeps the picker visually consistent.
function defaultIcon(color) {
  const c = color || '#c9a06a';
  return `
    <svg viewBox="0 0 32 32" width="36" height="36" style="display:block">
      <rect x="4"  y="6" width="24" height="20" rx="4"
        fill="${c}" stroke="#1a1a1a" stroke-width="1.6"/>
      <rect x="6"  y="8" width="20" height="3" fill="rgba(255,255,255,0.35)"/>
      <rect x="20" y="14" width="6" height="6" rx="1" fill="#241608" stroke="#1a1a1a" stroke-width="1"/>
      <rect x="22" y="16" width="2" height="2" fill="#ffd84a"/>
    </svg>`;
}

function ensureRoot() {
  let d = document.getElementById(ID);
  if (d) return d;
  d = document.createElement('div');
  d.id = ID;
  d.style.cssText = `
    position: fixed; inset: 0; z-index: 35; display: none;
    align-items: center; justify-content: center;
    background: rgba(0,0,0,0.55); padding: 20px;
    font-family: 'Courier New', monospace; color: #f1e6cf;
  `;
  document.body.appendChild(d);
  // Click-outside dismiss.
  d.addEventListener('click', (ev) => {
    if (ev.target === d) closeWalletModal();
  });
  return d;
}

let closeResolver = null;

function renderWalletGrid(card) {
  // List of installed extensions reported by extension-dapp.
  const installed = new Set(detectWallets());
  // Plus any custom extension we don't know about (rare — labelled by id).
  const unknownInstalled = [...installed].filter(s => !KNOWN_WALLETS[s]);

  // Render ALL known wallets, marking installed vs not. Installed ones
  // sit on top so they're easier to find.
  const sources = [
    ...KNOWN_WALLET_SOURCES.filter(s => installed.has(s)),
    ...KNOWN_WALLET_SOURCES.filter(s => !installed.has(s)),
    ...unknownInstalled,
  ];

  const cells = sources.map((src) => {
    const meta = KNOWN_WALLETS[src] || { label: src, color: '#888' };
    const isInstalled = installed.has(src);
    if (isInstalled) {
      return `
        <button data-source="${src}" style="
          font-family:inherit;cursor:pointer;
          background:#3a2614;color:#f1e6cf;
          border:3px solid #4b2e15;border-radius:12px;
          padding:12px 6px 10px;flex:1;min-width:0;
          display:flex;flex-direction:column;
          align-items:center;gap:6px;font-weight:bold;position:relative">
          <span style="position:absolute;top:4px;right:4px;
            background:#3a5a2e;color:#dfffdf;border:1px solid #7fdf7f;
            font-size:9px;border-radius:6px;padding:1px 5px;
            letter-spacing:.5px">READY</span>
          ${defaultIcon(meta.color)}
          <span style="font-size:11px;letter-spacing:0.5px;text-align:center;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%">${meta.label}</span>
        </button>
      `;
    }
    return `
      <a data-install="${meta.install || '#'}" href="${meta.install || '#'}" target="_blank" rel="noopener"
        style="font-family:inherit;cursor:pointer;text-decoration:none;
          background:#241608;color:#9b8b6a;
          border:3px dashed #4b2e15;border-radius:12px;
          padding:12px 6px 10px;flex:1;min-width:0;
          display:flex;flex-direction:column;
          align-items:center;gap:6px;font-weight:bold;position:relative">
        <span style="position:absolute;top:4px;right:4px;
          background:#3a2614;color:#c9a06a;border:1px solid #4b2e15;
          font-size:9px;border-radius:6px;padding:1px 5px;
          letter-spacing:.5px">INSTALL</span>
        <span style="opacity:.55">${defaultIcon(meta.color)}</span>
        <span style="font-size:11px;letter-spacing:0.5px;text-align:center;opacity:.85;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%">${meta.label}</span>
      </a>
    `;
  }).join('');

  card.innerHTML = `
    ${header('Choose Wallet')}
    <div style="padding:18px 20px">
      <div style="font-size:12px;opacity:.7;letter-spacing:1.5px;margin-bottom:10px">
        ${installed.size > 0 ? 'WALLETS' : 'INSTALL A WALLET'}
      </div>
      <div style="display:flex;flex-direction:row;gap:10px;justify-content:center;flex-wrap:nowrap">
        ${cells}
      </div>
      <div style="font-size:11px;opacity:.6;margin-top:14px;text-align:center;line-height:1.5">
        ${installed.size > 0
          ? "Tap a READY wallet — it'll ask for permission, approve in the popup."
          : "Click INSTALL on any wallet, set it up, refresh this page."}
      </div>
    </div>
  `;
  card.querySelectorAll('button[data-source]').forEach((btn) => {
    btn.onclick = async () => {
      btn.disabled = true;
      btn.style.opacity = '.6';
      try {
        await connectWallet(btn.dataset.source);
        renderAccountGrid(card, btn.dataset.source);
      } catch (err) {
        renderError(card, err);
      }
    };
  });
}

function renderAccountGrid(card, source) {
  const accounts = getState().accounts;
  if (!accounts.length) {
    card.innerHTML = `
      ${header('No accounts')}
      <div style="padding:24px 20px;text-align:center">
        <div style="font-size:13px;opacity:.85;margin-bottom:14px;line-height:1.5">
          The extension didn't return any accounts.<br>
          Open it and add / unlock at least one account.
        </div>
        <button id="wm-back" style="${primaryBtn()}">Back</button>
      </div>
    `;
    card.querySelector('#wm-back').onclick = () => renderWalletGrid(card);
    return;
  }
  const meta = KNOWN_WALLETS[source] || { label: source, color: '#888' };
  const rows = accounts.map((a) => `
    <button data-addr="${a.address}" style="
      font-family:inherit;cursor:pointer;width:100%;
      background:#3a2614;color:#f1e6cf;
      border:2px solid #4b2e15;border-radius:10px;
      padding:10px 12px;display:flex;align-items:center;gap:10px;
      font-weight:bold;text-align:left">
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;
        background:${meta.color};border:1px solid #1a1a1a"></span>
      <span style="flex:1;min-width:0">
        <div style="font-size:13px">${a.name || 'Account'}</div>
        <div style="font-size:11px;opacity:.7;font-family:monospace">${shortAddress(a.address)}</div>
      </span>
      <span style="font-size:14px;opacity:.6">→</span>
    </button>
  `).join('');
  card.innerHTML = `
    ${header('Pick an account')}
    <div style="padding:14px 20px;display:flex;flex-direction:column;gap:8px">
      <div style="font-size:11px;opacity:.7;letter-spacing:1px">
        FROM <strong style="color:${meta.color}">${meta.label}</strong>
      </div>
      ${rows}
      <button id="wm-back" style="${secondaryBtn()};margin-top:6px">← Back to wallets</button>
    </div>
  `;
  card.querySelectorAll('button[data-addr]').forEach((btn) => {
    btn.onclick = () => {
      const picked = selectAccount(btn.dataset.addr);
      closeWalletModal(picked);
    };
  });
  card.querySelector('#wm-back').onclick = () => renderWalletGrid(card);
}

function renderError(card, err) {
  const human = err?.message === 'NO_EXTENSION'      ? 'No extensions installed.'
              : err?.message === 'PERMISSION_DENIED' ? 'Permission denied. Approve in the wallet extension and try again.'
              : (err?.message || 'Connection failed.');
  card.innerHTML = `
    ${header('Connection failed')}
    <div style="padding:22px 20px;text-align:center">
      <div style="font-size:36px;margin-bottom:6px">⚠️</div>
      <div style="font-size:13px;opacity:.85;margin-bottom:14px">${human}</div>
      <button id="wm-retry" style="${primaryBtn()}">Try again</button>
    </div>
  `;
  card.querySelector('#wm-retry').onclick = () => renderWalletGrid(card);
}

function renderConnected(card) {
  const s = getState();
  if (!s.address) {
    renderWalletGrid(card);
    return;
  }
  const meta = KNOWN_WALLETS[s.source] || { label: s.source || 'Wallet', color: '#888' };
  card.innerHTML = `
    ${header('Wallet connected')}
    <div style="padding:18px 20px;display:flex;flex-direction:column;gap:10px">
      <div style="background:#3a2614;border:2px solid #4b2e15;border-radius:10px;
        padding:14px;display:flex;align-items:center;gap:12px">
        ${defaultIcon(meta.color)}
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;opacity:.7;letter-spacing:1px;margin-bottom:2px">
            ${meta.label.toUpperCase()}
          </div>
          <div style="font-family:monospace;font-size:14px;font-weight:bold">
            ${shortAddress(s.address)}
          </div>
        </div>
      </div>
      <button id="wm-switch" style="${secondaryBtn()}">↻ Switch wallet</button>
      <button id="wm-disconnect" style="${dangerBtn()}">Disconnect</button>
    </div>
  `;
  card.querySelector('#wm-switch').onclick = () => renderWalletGrid(card);
  card.querySelector('#wm-disconnect').onclick = () => {
    disconnect();
    renderWalletGrid(card);
  };
}

// Reusable header with the title + close button. Same gradient as
// the shop / inventory headers so the modal feels in-family.
function header(title) {
  return `
    <div style="padding:14px 18px;
      background:linear-gradient(180deg,#3a2614,#241608);
      border-bottom:3px solid #4b2e15;
      display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:18px;font-weight:bold;letter-spacing:1px">🔌 ${title}</div>
      <button id="wm-close" style="font-family:inherit;background:#c9a06a;color:#241608;
        border:2px solid #4b2e15;border-radius:8px;padding:6px 14px;font-weight:bold;cursor:pointer">
        Close
      </button>
    </div>
  `;
}

function primaryBtn() {
  return `font-family:inherit;cursor:pointer;background:#7fc99c;color:#0e2e1e;
    border:3px solid #0e2e1e;border-radius:10px;padding:12px 24px;
    font-weight:bold;font-size:14px;letter-spacing:1px`;
}
function secondaryBtn() {
  return `font-family:inherit;cursor:pointer;background:#c9a06a;color:#241608;
    border:2px solid #4b2e15;border-radius:10px;padding:10px 16px;
    font-weight:bold;font-size:13px`;
}
function dangerBtn() {
  return `font-family:inherit;cursor:pointer;background:#5a1a1a;color:#ffb0b0;
    border:2px solid #2a0a0a;border-radius:10px;padding:10px 16px;
    font-weight:bold;font-size:13px`;
}

// Public API.
export function openWalletModal() {
  const d = ensureRoot();
  const s = getState();
  // Build a fresh card every open so layout always reflects current state.
  d.innerHTML = `
    <div id="wallet-modal-card" style="
      background:#1d140b; border:4px solid #4b2e15; border-radius:14px;
      box-shadow:0 8px 30px rgba(0,0,0,0.6);
      width:440px; max-width:92vw; max-height:92vh;
      overflow-y:auto;"></div>
  `;
  const card = d.querySelector('#wallet-modal-card');
  if (s.address) renderConnected(card);
  else renderWalletGrid(card);
  // Bind close button on EVERY paint (innerHTML wipes nodes).
  d.addEventListener('click', closeButtonHandler);
  d.style.display = 'flex';
  return new Promise((resolve) => {
    closeResolver = resolve;
  });
}

function closeButtonHandler(ev) {
  if (ev.target.id === 'wm-close') closeWalletModal();
}

export function closeWalletModal(result = null) {
  const d = document.getElementById(ID);
  if (d) {
    d.style.display = 'none';
    d.removeEventListener('click', closeButtonHandler);
  }
  if (closeResolver) {
    closeResolver(result);
    closeResolver = null;
  }
}
