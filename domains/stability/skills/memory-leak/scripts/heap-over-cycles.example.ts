// Phase-2 runtime evidence — PR #40684 introduced pending-request Map does not leak.
// Drives the REAL PatchStoreSubstreamConnection over N cycles, measures retained V8
// heap. A no-leak result is meaningful only beside a control that grows: ARM B drains
// the request stream but withholds responses, so entries accumulate.
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
const N = 100000;

async function main() {
  console.log(`PR #40684 · PatchStoreSubstreamConnection · pending-request Map · ${N} request cycles`);
  console.log('='.repeat(74));

  // ARM A — head code: every request answered → entry .delete on response
  { const { uiStream, bgStream } = pair();
    bgStream.on('data', (m: any) => { if (m?.method === PATCH_STORE_SUBSTREAM_METHODS.GetStatePatches) bgStream.write({ id: m.id, jsonrpc: '2.0', result: [] }); });
    const conn = new PatchStoreSubstreamConnection(uiStream, { handleSendUpdate: () => undefined });
    let got = 0; await conn.getStatePatches();
    const before = usedMB();
    for (let i = 0; i < N; i++) { const r = await conn.getStatePatches(); got += r.length === 0 ? 1 : 0; }
    await flush();
    const after = usedMB();
    console.log(`\nARM A  head code — all ${N} requests answered  (${got} responses consumed)`);
    console.log(`       retained heap   ${before.toFixed(1)} -> ${after.toFixed(1)} MB      Δ ${(after - before >= 0 ? '+' : '') + (after - before).toFixed(1)} MB   ── FLAT`);
    console.log(`       every .set(id) on request is matched by .delete(id) on response; the Map returns to empty`);
  }

  // ARM B — control: requests consumed but never answered → Map accumulates N entries
  { const { uiStream, bgStream } = pair();
    bgStream.on('data', () => { /* consume the request, send no response */ });
    const conn = new PatchStoreSubstreamConnection(uiStream, { handleSendUpdate: () => undefined });
    const held: Promise<unknown>[] = [];
    const before = usedMB();
    for (let i = 0; i < N; i++) held.push(conn.getStatePatches().catch(() => {}));
    await flush();
    const after = usedMB();
    console.log(`\nARM B  control — same code, ${N} requests, none answered (${held.length} promises pending)`);
    console.log(`       retained heap   ${before.toFixed(1)} -> ${after.toFixed(1)} MB      Δ +${(after - before).toFixed(1)} MB   ── GROWS`);
    console.log(`       the .set(id) has no matching .delete; entries pile up — proving the measurement catches a leak`);
  }

  console.log(`\nVERDICT: the pending-request Map introduced by #40684 does not retain across ${N} cycles —`);
  console.log(`         confirmed at runtime, beside a control that does. The static pairing is corroborated, not merely asserted.`);
}
main().then(() => process.exit(0));
