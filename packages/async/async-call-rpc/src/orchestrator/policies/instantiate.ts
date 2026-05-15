import { ReconnectPolicy, ReconnectPolicySpec } from '../types';
import { ExponentialBackoffPolicy } from './ExponentialBackoffPolicy';
import { FixedDelayPolicy } from './FixedDelayPolicy';
import { NeverReconnectPolicy } from './NeverReconnectPolicy';

/**
 * Type guard: does `value` look like a {@link ReconnectPolicySpec}?
 *
 * Used by `BaseConnectionOrchestrator`'s `requestConnect` proxy handler to
 * decide whether to unmarshal a value back into a {@link ReconnectPolicy}
 * class. Same-process callers pass real class instances (which have a
 * `nextRetryDelayMs` method) and are passed through untouched; cross-process
 * callers pass plain JSON objects with a `kind` discriminant.
 */
export function isReconnectPolicySpec(
  value: unknown
): value is ReconnectPolicySpec {
  if (typeof value !== 'object' || value === null) return false;
  if (
    typeof (value as { nextRetryDelayMs?: unknown }).nextRetryDelayMs ===
    'function'
  ) {
    // Already a live ReconnectPolicy instance — not a spec.
    return false;
  }
  const kind = (value as { kind?: unknown }).kind;
  return (
    kind === 'exponential-backoff' || kind === 'fixed-delay' || kind === 'never'
  );
}

/**
 * Realise a {@link ReconnectPolicySpec} into the corresponding
 * {@link ReconnectPolicy} class instance.
 *
 * Defaults follow each policy class's own constructor defaults — see
 * `ExponentialBackoffPolicy.constructor` and `FixedDelayPolicy.constructor`.
 *
 * Throws on unknown `kind` so a stale worker cannot silently fall back to
 * a different reconnect strategy than it asked for.
 */
export function instantiateReconnectPolicy(
  spec: ReconnectPolicySpec
): ReconnectPolicy {
  switch (spec.kind) {
    case 'exponential-backoff':
      return new ExponentialBackoffPolicy(spec.options);
    case 'fixed-delay':
      return new FixedDelayPolicy(spec.delays);
    case 'never':
      return new NeverReconnectPolicy();
    default: {
      const exhaustive: never = spec;
      throw new Error(
        `[instantiateReconnectPolicy] unknown ReconnectPolicySpec.kind: ` +
          `${JSON.stringify(exhaustive)}`
      );
    }
  }
}
