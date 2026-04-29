// Deploy the RoboMinerProfile program to Vara mainnet.
//
// Usage:
//   cd games/robo-miner/contract
//   DEPLOY_SEED='twelve word mnemonic OR //Alice' node deploy.mjs
//
// Reads `target/wasm32-gear/release/robo_miner_profile.opt.wasm`, uploads
// it via @gear-js/api, calls the Sails `Create` constructor with no args,
// then writes the new programId/codeId/blockNumber to `deployment.json`.
//
// After it succeeds you still need to:
//   1) Bump frontend/.env  VITE_PROGRAM_ID=<new id>
//   2) Bump voucher-backend/src/catalog/games.json robo-miner.contractAddress
//   3) Redeploy / restart the voucher backend so vouchers target the new
//      program. The current contract on chain stays addressable but no
//      new vouchers will work for it once the catalog flips.

import { GearApi, GearKeyring } from '@gear-js/api';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { TypeRegistry } from '@polkadot/types';
import { u8aToHex } from '@polkadot/util';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RPC = process.env.VARA_RPC || 'wss://rpc.vara.network';
const SEED = process.env.DEPLOY_SEED;
if (!SEED) {
  console.error('Set DEPLOY_SEED to the deployer mnemonic (or //Alice for dev).');
  process.exit(1);
}

const wasmPath = resolve(
  __dirname,
  'target/wasm32-gear/release/robo_miner_profile.opt.wasm',
);
const code = readFileSync(wasmPath);
console.log(`📦 wasm  ${wasmPath} (${code.length} bytes)`);

console.log(`🌐 connecting ${RPC}…`);
const api = await GearApi.create({ providerAddress: RPC });
const account = await GearKeyring.fromSuri(SEED);
console.log(`🔑 deployer ${account.address}`);

// Sails ctor invocation = String("Create") + tuple of args. The Create
// constructor in lib.rs takes no args, so the payload is just the tag.
// Sails uses parity-scale-codec String which prefix-encodes the length.
const registry = new TypeRegistry();
const ctorPayload = u8aToHex(registry.createType('String', 'Create').toU8a());

const salt = '0x' + Date.now().toString(16);

const { programId, codeId, extrinsic } = api.program.upload({
  code,
  initPayload: ctorPayload,
  gasLimit: 250_000_000_000n, // generous; Sails ctors are tiny
  value: 0n,
  salt,
});
console.log(`   programId   ${programId}`);
console.log(`   codeId      ${codeId}`);

console.log('🚀 uploading program…');
let blockHash = null;
let blockNumber = null;
let msgId = null;
await new Promise((res, rej) => {
  extrinsic.signAndSend(account, ({ events, status, txHash }) => {
    if (status.isInBlock) {
      msgId = txHash.toHex();
      blockHash = status.asInBlock.toHex();
      console.log(`   inBlock     ${blockHash}`);
    }
    if (status.isFinalized) {
      console.log(`   finalized   ${status.asFinalized.toHex()}`);
      // Decode any ExtrinsicFailed event for a useful error string.
      for (const { event } of events) {
        if (api.events.system.ExtrinsicFailed.is(event)) {
          const [dispatchError] = event.data;
          let reason = 'ExtrinsicFailed';
          if (dispatchError.isModule) {
            const meta = api.registry.findMetaError(dispatchError.asModule);
            reason = `${meta.section}.${meta.name}: ${meta.docs.join(' ')}`;
          }
          return rej(new Error(reason));
        }
      }
      res();
    }
    if (status.isInvalid || status.isDropped || status.isUsurped) {
      rej(new Error(`tx status ${status.type}`));
    }
  }).catch(rej);
});

const blockHeader = await api.rpc.chain.getHeader(blockHash);
blockNumber = blockHeader.number.toNumber();

console.log('✅ deployed');
console.log(`   programId   ${programId}`);
console.log(`   codeId      ${codeId}`);
console.log(`   blockNumber ${blockNumber}`);
console.log(`   deployTx    ${msgId}`);

const deploymentPath = resolve(__dirname, 'deployment.json');
const prev = JSON.parse(readFileSync(deploymentPath, 'utf-8'));
const next = {
  network: 'vara-mainnet',
  rpc: RPC,
  deployedAt: new Date().toISOString(),
  blockNumber,
  deployer: account.address,
  programId,
  codeId,
  deployTx: msgId,
  idlPath: prev.idlPath,
  wasmPath: prev.wasmPath,
  interface:
    'v4 — added submit_checkpoint + checkpoints counter; submit_run is now final-only.',
  previousVersions: [
    {
      programId: prev.programId,
      deployedAt: prev.deployedAt,
      note: prev.interface || 'previous',
    },
    ...(prev.previousVersions || []),
  ],
};
writeFileSync(deploymentPath, JSON.stringify(next, null, 2) + '\n');
console.log(`📝 wrote ${deploymentPath}`);

await api.disconnect();
console.log('done.');
