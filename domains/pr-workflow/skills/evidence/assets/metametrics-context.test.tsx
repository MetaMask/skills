// Probe — MetaMetrics context value identity.
//
// PLACEMENT: copy to `ui/contexts/__render_probe__.test.tsx` in a metamask-extension tree.
// The imports below are relative to `ui/contexts/`, so a different destination resolves
// nothing and the suite fails to run with "Cannot find module" — which is a failed probe,
// not a measurement. `probe_dest` in the evidence workflow must match this path.
//
// The claim under test is about breadth: "all N consumers avoid unnecessary re-renders".
// `useContext` re-renders a consumer when the value's IDENTITY changes, and that is not a
// per-consumer property — so one distinct value across N parent renders means every
// consumer is spared, and N distinct values means none is. Counting distinct values is
// therefore the measurement the claim actually rests on; counting one consumer's renders
// would only ever describe that consumer.
//
// Resolves against both `metametrics.js` and `metametrics.tsx`, so the same file measures a
// base commit and a head commit that renamed it — the comparison is the point.
import React, { useContext, useRef, useState } from 'react';
import { act } from '@testing-library/react';
import configureStore from '../store/store';
import { renderWithProvider } from '../../test/lib/render-helpers-navigate';
import mockState from '../../test/data/mock-state.json';
import { MetaMetricsContext, MetaMetricsProvider } from './metametrics';

let consumerRenders = 0;
let distinctValues = 0;
let bump: (() => void) | undefined;

function Consumer() {
  const value = useContext(MetaMetricsContext);
  const last = useRef<unknown>(null);
  if (last.current !== value) {
    last.current = value;
    distinctValues += 1;
  }
  consumerRenders += 1;
  return null;
}

function Parent() {
  const [, setN] = useState(0);
  bump = () => setN((n) => n + 1);
  return (
    <MetaMetricsProvider>
      <Consumer />
    </MetaMetricsProvider>
  );
}

describe('MetaMetrics context value identity', () => {
  it('counts distinct context values across parent re-renders', () => {
    const PARENT_RENDERS = 5;
    consumerRenders = 0;
    distinctValues = 0;

    renderWithProvider(<Parent />, configureStore(mockState));
    for (let i = 0; i < PARENT_RENDERS; i++) {
      act(() => {
        bump?.();
      });
    }

    // eslint-disable-next-line no-console
    console.log(
      `RENDER_COUNT consumer=${distinctValues} parentRenders=${PARENT_RENDERS + 1} consumerRenders=${consumerRenders}`,
    );
    expect(consumerRenders).toBeGreaterThan(0);
  });
});
