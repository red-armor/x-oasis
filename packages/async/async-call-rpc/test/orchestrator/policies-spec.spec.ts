/**
 * Tests for the cross-process-safe `ReconnectPolicySpec` descriptor and the
 * `ConnectionConfigSpec` unmarshalling path on `BaseConnectionOrchestrator`.
 *
 * Why this exists (telegraph D-007 G7):
 *   `ParticipantOrchestratorProxy` (utility process) has to ship a
 *   `ConnectionConfig` over RPC to the main-process orchestrator. Live
 *   class instances don't survive serialisation — `ReconnectPolicy`
 *   methods get stripped and the orchestrator silently falls back to a
 *   default policy. The fix:
 *     1. Workers send a declarative `{ kind, options }` spec.
 *     2. The orchestrator detects specs via `isReconnectPolicySpec()` and
 *        reifies them via `instantiateReconnectPolicy()` inside the
 *        `requestConnect` proxy handler.
 *     3. Same-process callers passing real instances are passed through
 *        untouched so the existing `connect()` API doesn't break.
 *
 * Coverage:
 *   - `isReconnectPolicySpec`: positive / negative / instance-not-spec
 *   - `instantiateReconnectPolicy`: each kind + defaults + unknown kind
 *   - `ExponentialBackoffOptionsLike` ↔ `ExponentialBackoffOptions`
 *     structural compatibility (compile-time)
 *   - end-to-end through `registerProxyService` → `requestConnect`:
 *       a) caller sends a spec → orchestrator stores a real instance
 *       b) caller sends a real instance → orchestrator stores it as-is
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { BaseConnectionOrchestrator } from '../../src/orchestrator/BaseConnectionOrchestrator';
import {
  ParticipantInfo,
  ActivationConfig,
  PortPair,
  ReconnectPolicy,
  ReconnectPolicySpec,
  ExponentialBackoffOptionsLike,
  ORCHESTRATOR_PROXY_SERVICE_PATH,
} from '../../src/orchestrator/types';
// Keep ParticipantInfo / ActivationConfig imports — they are referenced by
// the abstract activateParticipant() signature on TestOrchestrator below.
import {
  ExponentialBackoffPolicy,
  ExponentialBackoffOptions,
  FixedDelayPolicy,
  NeverReconnectPolicy,
  instantiateReconnectPolicy,
  isReconnectPolicySpec,
} from '../../src/orchestrator/policies';
import RPCServiceHost from '../../src/endpoint/RPCServiceHost';
import AbstractChannelProtocol from '../../src/protocol/AbstractChannelProtocol';

// ── Stubs (mirror of BaseConnectionOrchestrator.spec.ts) ──────────────────────

class StubChannel extends AbstractChannelProtocol {
  send() {}
  on() {}
}

class TestOrchestrator extends BaseConnectionOrchestrator {
  portPairCounter = 0;

  createPortPair(): PortPair {
    this.portPairCounter++;
    return {
      port1: `port${this.portPairCounter}a`,
      port2: `port${this.portPairCounter}b`,
    };
  }

  activateParticipant(
    _info: ParticipantInfo,
    _config: ActivationConfig
  ): Promise<void> {
    // Resolve immediately so connect() reaches READY without needing real
    // ports. The handshake is otherwise irrelevant to G7 unmarshalling.
    return Promise.resolve();
  }

  /** Test-only: peek at the per-connection ConnectionConfig as stored. */
  getStoredReconnectPolicy(connectionId: string): ReconnectPolicy | undefined {
    return this.connections.get(connectionId)?.lastConfig?.reconnectPolicy;
  }
}

function registerTwoParticipants(orch: BaseConnectionOrchestrator): {
  fromId: string;
  toId: string;
  connectionId: string;
} {
  // IDs chosen so the canonical (`a < b`) ordering puts `from` first,
  // making the resulting connectionId predictable: `from-A--to-B`.
  const fromId = 'from-A';
  const toId = 'to-B';
  orch.registerParticipant(fromId, new StubChannel(), 'worker');
  orch.registerParticipant(toId, new StubChannel(), 'process');
  return { fromId, toId, connectionId: `${fromId}--${toId}` };
}

// ── isReconnectPolicySpec ─────────────────────────────────────────────────────

describe('isReconnectPolicySpec', () => {
  it('returns true for each known kind', () => {
    expect(isReconnectPolicySpec({ kind: 'exponential-backoff' })).toBe(true);
    expect(
      isReconnectPolicySpec({
        kind: 'exponential-backoff',
        options: { initialDelayMs: 100 },
      })
    ).toBe(true);
    expect(isReconnectPolicySpec({ kind: 'fixed-delay' })).toBe(true);
    expect(
      isReconnectPolicySpec({ kind: 'fixed-delay', delays: [0, 1000] })
    ).toBe(true);
    expect(isReconnectPolicySpec({ kind: 'never' })).toBe(true);
  });

  it('returns false for live ReconnectPolicy instances', () => {
    // Same-process callers pass real classes — they must NOT be mistaken
    // for specs, otherwise the orchestrator would try to discriminate on
    // a non-existent `.kind` property and throw at unknown-kind.
    expect(isReconnectPolicySpec(new ExponentialBackoffPolicy())).toBe(false);
    expect(isReconnectPolicySpec(new FixedDelayPolicy())).toBe(false);
    expect(isReconnectPolicySpec(new NeverReconnectPolicy())).toBe(false);
  });

  it('returns false for plain objects without a known kind', () => {
    expect(isReconnectPolicySpec({})).toBe(false);
    expect(isReconnectPolicySpec({ kind: 'made-up' })).toBe(false);
    expect(isReconnectPolicySpec({ kind: 42 })).toBe(false);
  });

  it('returns false for non-objects', () => {
    expect(isReconnectPolicySpec(null)).toBe(false);
    expect(isReconnectPolicySpec(undefined)).toBe(false);
    expect(isReconnectPolicySpec('exponential-backoff')).toBe(false);
    expect(isReconnectPolicySpec(123)).toBe(false);
  });
});

// ── instantiateReconnectPolicy ────────────────────────────────────────────────

describe('instantiateReconnectPolicy', () => {
  it('builds an ExponentialBackoffPolicy with caller-supplied options', () => {
    const policy = instantiateReconnectPolicy({
      kind: 'exponential-backoff',
      options: {
        initialDelayMs: 50,
        maxDelayMs: 200,
        multiplier: 4,
        jitterFactor: 0,
        maxRetries: 2,
        maxElapsedMs: 10_000,
      },
    });
    expect(policy).toBeInstanceOf(ExponentialBackoffPolicy);
    // First retry uses initialDelayMs verbatim because jitterFactor=0.
    expect(
      policy.nextRetryDelayMs({
        previousRetryCount: 0,
        elapsedMs: 0,
        retryReason: 'test',
        connectionId: 'a--b',
        fromId: 'a',
        toId: 'b',
      })
    ).toBe(50);
    // After maxRetries (2) the policy gives up.
    expect(
      policy.nextRetryDelayMs({
        previousRetryCount: 2,
        elapsedMs: 0,
        retryReason: 'test',
        connectionId: 'a--b',
        fromId: 'a',
        toId: 'b',
      })
    ).toBeNull();
  });

  it('builds an ExponentialBackoffPolicy with class-default options when none given', () => {
    const policy = instantiateReconnectPolicy({ kind: 'exponential-backoff' });
    expect(policy).toBeInstanceOf(ExponentialBackoffPolicy);
    // No options given → ctor defaults apply (initialDelayMs=1000, jitterFactor=0.3).
    // We can't assert an exact number because of jitter, but the value must
    // sit within ±jitter of initialDelayMs on the first retry.
    const delay = policy.nextRetryDelayMs({
      previousRetryCount: 0,
      elapsedMs: 0,
      retryReason: 'test',
      connectionId: 'a--b',
      fromId: 'a',
      toId: 'b',
    });
    expect(delay).not.toBeNull();
    expect(delay!).toBeGreaterThanOrEqual(700); // 1000 - 30%
    expect(delay!).toBeLessThanOrEqual(1300); // 1000 + 30%
  });

  it('builds a FixedDelayPolicy with caller-supplied delays', () => {
    const policy = instantiateReconnectPolicy({
      kind: 'fixed-delay',
      delays: [10, 20, 30],
    });
    expect(policy).toBeInstanceOf(FixedDelayPolicy);
    const ctx = (n: number) => ({
      previousRetryCount: n,
      elapsedMs: 0,
      retryReason: 'test',
      connectionId: 'a--b',
      fromId: 'a',
      toId: 'b',
    });
    expect(policy.nextRetryDelayMs(ctx(0))).toBe(10);
    expect(policy.nextRetryDelayMs(ctx(1))).toBe(20);
    expect(policy.nextRetryDelayMs(ctx(2))).toBe(30);
    expect(policy.nextRetryDelayMs(ctx(3))).toBeNull(); // exhausted
  });

  it('builds a FixedDelayPolicy with the class default sequence when no delays given', () => {
    const policy = instantiateReconnectPolicy({ kind: 'fixed-delay' });
    expect(policy).toBeInstanceOf(FixedDelayPolicy);
    // Class default: [0, 2_000, 10_000, 30_000].
    const ctx = (n: number) => ({
      previousRetryCount: n,
      elapsedMs: 0,
      retryReason: 'test',
      connectionId: 'a--b',
      fromId: 'a',
      toId: 'b',
    });
    expect(policy.nextRetryDelayMs(ctx(0))).toBe(0);
    expect(policy.nextRetryDelayMs(ctx(3))).toBe(30_000);
    expect(policy.nextRetryDelayMs(ctx(4))).toBeNull();
  });

  it('builds a NeverReconnectPolicy that always returns null', () => {
    const policy = instantiateReconnectPolicy({ kind: 'never' });
    expect(policy).toBeInstanceOf(NeverReconnectPolicy);
    expect(
      policy.nextRetryDelayMs({
        previousRetryCount: 0,
        elapsedMs: 0,
        retryReason: 'test',
        connectionId: 'a--b',
        fromId: 'a',
        toId: 'b',
      })
    ).toBeNull();
  });

  it('throws on an unknown kind so stale workers fail loud', () => {
    // Cast through unknown — the public type union forbids this at compile
    // time; we're emulating a forwards/backwards compatibility break where
    // an older orchestrator receives a newer kind it doesn't know about.
    expect(() =>
      instantiateReconnectPolicy({
        kind: 'mystery',
      } as unknown as ReconnectPolicySpec)
    ).toThrowError(/unknown ReconnectPolicySpec\.kind/);
  });
});

// ── Compile-time structural identity ──────────────────────────────────────────

describe('ExponentialBackoffOptionsLike ↔ ExponentialBackoffOptions', () => {
  it('is mutually structurally assignable', () => {
    // If either interface drifts (e.g. a new option added to one but not
    // the other), this file fails to compile — guarding the invariant
    // documented in `types.ts`.
    const a: ExponentialBackoffOptions = {
      initialDelayMs: 1,
      maxDelayMs: 2,
      multiplier: 3,
      jitterFactor: 4,
      maxRetries: 5,
      maxElapsedMs: 6,
    };
    const b: ExponentialBackoffOptionsLike = a;
    const c: ExponentialBackoffOptions = b;
    expect(c).toEqual(a);
  });
});

// ── End-to-end through registerProxyService ───────────────────────────────────

describe('BaseConnectionOrchestrator.registerProxyService — config unmarshal', () => {
  let orch: TestOrchestrator;
  let host: RPCServiceHost;

  beforeEach(() => {
    orch = new TestOrchestrator();
    host = new RPCServiceHost();
    orch.registerProxyService(host);
  });

  it('unmarshals a ReconnectPolicySpec into a real class instance on requestConnect', async () => {
    const { fromId, toId, connectionId } = registerTwoParticipants(orch);

    const requestConnect = host.getHandler(
      ORCHESTRATOR_PROXY_SERVICE_PATH,
      'requestConnect'
    ) as (
      fromId: string,
      toId: string,
      config?: unknown,
      options?: unknown
    ) => Promise<unknown>;
    expect(requestConnect).toBeTypeOf('function');

    await requestConnect(fromId, toId, {
      reconnectPolicy: {
        kind: 'fixed-delay',
        delays: [123, 456],
      },
    });

    // Inspect the connection's stored reconnect policy: it must be a real
    // FixedDelayPolicy (callable nextRetryDelayMs), not the plain spec
    // object that arrived over the wire.
    const stored = orch.getStoredReconnectPolicy(connectionId);
    expect(stored).toBeInstanceOf(FixedDelayPolicy);
    expect(
      stored!.nextRetryDelayMs({
        previousRetryCount: 0,
        elapsedMs: 0,
        retryReason: 'test',
        connectionId,
        fromId,
        toId,
      })
    ).toBe(123);
  });

  it('passes a real ReconnectPolicy instance through untouched', async () => {
    const { fromId, toId, connectionId } = registerTwoParticipants(orch);
    const livePolicy = new NeverReconnectPolicy();

    const requestConnect = host.getHandler(
      ORCHESTRATOR_PROXY_SERVICE_PATH,
      'requestConnect'
    ) as (
      fromId: string,
      toId: string,
      config?: unknown,
      options?: unknown
    ) => Promise<unknown>;

    // Same-process call: the caller already constructed a class instance
    // and shouldn't see it replaced.
    await requestConnect(fromId, toId, { reconnectPolicy: livePolicy });

    const stored = orch.getStoredReconnectPolicy(connectionId);
    expect(stored).toBe(livePolicy);
  });

  it('handles requestConnect with no config at all (worker not configuring)', async () => {
    const { fromId, toId } = registerTwoParticipants(orch);

    const requestConnect = host.getHandler(
      ORCHESTRATOR_PROXY_SERVICE_PATH,
      'requestConnect'
    ) as (
      fromId: string,
      toId: string,
      config?: unknown,
      options?: unknown
    ) => Promise<unknown>;

    // Telegraph workers today don't pass any config — must not throw.
    await expect(requestConnect(fromId, toId)).resolves.toBeDefined();
  });
});
