import { decideOnFailure } from './retry-policy';

describe('decideOnFailure', () => {
  it('retries the first two failures with growing delays', () => {
    expect(decideOnFailure(1)).toEqual({ kind: 'retry', nextAttempt: 2, delayMs: 5_000 });
    expect(decideOnFailure(2)).toEqual({ kind: 'retry', nextAttempt: 3, delayMs: 15_000 });
  });

  it('gives up after the third try (FR-08)', () => {
    expect(decideOnFailure(3)).toEqual({ kind: 'dead' });
  });

  it('respects a custom maximum', () => {
    expect(decideOnFailure(1, 1)).toEqual({ kind: 'dead' });
  });
});
