import { MAX_SEND_ATTEMPTS, retryDelayMs } from '@otp/shared';

export type FailureAction =
  { kind: 'retry'; nextAttempt: number; delayMs: number } | { kind: 'dead' };

/** After a failed try: wait and retry, or give up and send the job to the DLQ (FR-08). */
export function decideOnFailure(
  failedAttempt: number,
  maxAttempts: number = MAX_SEND_ATTEMPTS,
): FailureAction {
  if (failedAttempt < maxAttempts) {
    return {
      kind: 'retry',
      nextAttempt: failedAttempt + 1,
      delayMs: retryDelayMs(failedAttempt),
    };
  }
  return { kind: 'dead' };
}
