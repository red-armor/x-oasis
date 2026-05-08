import { ReconnectPolicy, RetryContext } from '../types';

/**
 * Reconnects according to a fixed sequence of delays.
 *
 * When the sequence is exhausted the policy returns `null`, causing the
 * Orchestrator to give up and transition to CLOSED.
 *
 * Modelled after SignalR's default reconnect policy:
 * ```
 * new FixedDelayPolicy([0, 2000, 10000, 30000])
 * ```
 */
export class FixedDelayPolicy implements ReconnectPolicy {
  private readonly delays: readonly number[];

  constructor(delays: number[] = [0, 2_000, 10_000, 30_000]) {
    this.delays = delays;
  }

  nextRetryDelayMs(context: RetryContext): number | null {
    if (context.previousRetryCount >= this.delays.length) return null;
    return this.delays[context.previousRetryCount];
  }
}
