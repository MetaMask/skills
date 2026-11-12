// Phase-2 runtime measurement for metamask-extension#40684 (extract patch store substream):
// does the pending-request Map it introduced retain across N request cycles?
// Drives the REAL PatchStoreSubstreamConnection over N cycles, measures retained V8
// heap. A flat head arm is meaningful only beside a control that grows: ARM B drains
// the request stream but withholds responses, so entries accumulate.
// metamask-extension#43142 (revert: "refactor: Extract patch store substream") removed this
// module from `main`, so the imports resolve only from `ui/store/` in a checkout of the
// #40684 merge commit 9ac832b3cbca068110a04d68a65925a6c1c8a725.
// The output is the measurement. Each arm prints the direction it is expected to move
// beside the delta it measured, and the script draws no conclusion from them.
import v8 from 'node:v8';
import ObjectMultiplex from '@metamask/object-multiplex';
import { PATCH_STORE_SUBSTREAM_METHODS } from '../../shared/constants/patch-store-substream-methods';
import { PatchStoreSubstreamConnection } from './patch-store-substream-connection';

function pair() {
  const uiMux = new ObjectMultiplex(); const bgMux = new ObjectMultiplex();
  uiMux.pipe(bgMux).pipe(uiMux);
  return { uiStream: uiMux.createStream('patch-store'), bgStream: bgMux.createStream('patch-store') };
}
const flush = () => new Promise((r) => setImmediate(r));
function usedMB() { global.gc!(); global.gc!(); return v8.getHeapStatistics().used_heap_size / 1048576; }
const signed = (mb: number) => (mb >= 0 ? '+' : '') + mb.toFixed(1);
const N = 100000;

async function main() {
  console.log(`metamask-extension#40684 · PatchStoreSubstreamConnection · pending-request Map · ${N} request cycles`);
  console.log('='.repeat(74));

  // ARM A — head code: every request answered → entry .delete on response
  let deltaA: number;
  { const { uiStream, bgStream } = pair();
    bgStream.on('data', (m: any) => { if (m?.method === PATCH_STORE_SUBSTREAM_METHODS.GetStatePatches) bgStream.write({ id: m.id, jsonrpc: '2.0', result: [] }); });
    const conn = new PatchStoreSubstreamConnection(uiStream, { handleSendUpdate: () => undefined });
    let got = 0; await conn.getStatePatches();
    const before = usedMB();
    for (let i = 0; i < N; i++) { const r = await conn.getStatePatches(); got += r.length === 0 ? 1 : 0; }
    await flush();
    const after = usedMB();
    deltaA = after - before;
    console.log(`\nARM A  head code — all ${N} requests answered  (${got} responses consumed)`);
    console.log(`       retained heap   ${before.toFixed(1)} -> ${after.toFixed(1)} MB      Δ ${signed(deltaA)} MB   expected: flat`);
  }

  // ARM B — control: requests consumed but never answered → Map accumulates N entries
  let deltaB: number;
  { const { uiStream, bgStream } = pair();
    bgStream.on('data', () => { /* consume the request, send no response */ });
    const conn = new PatchStoreSubstreamConnection(uiStream, { handleSendUpdate: () => undefined });
    const held: Promise<unknown>[] = [];
    const before = usedMB();
    for (let i = 0; i < N; i++) held.push(conn.getStatePatches().catch(() => {}));
    await flush();
    const after = usedMB();
    deltaB = after - before;
    console.log(`\nARM B  control — same code, ${N} requests, none answered (${held.length} promises pending)`);
    console.log(`       retained heap   ${before.toFixed(1)} -> ${after.toFixed(1)} MB      Δ ${signed(deltaB)} MB   expected: grows`);
  }

  const perCycle = (mb: number) => ((mb * 1048576) / N).toFixed(1);
  console.log(`\nretained bytes per cycle   ARM A ${perCycle(deltaA)}   ARM B ${perCycle(deltaB)}`);
}
main().then(() => process.exit(0));
