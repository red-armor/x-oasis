# @x-oasis/async-call-rpc-electron

## 0.14.0

### Minor Changes

- 1e0d6fd: fix: build issue
- 59b5375: feat: export orchestrator
- c852f4b: feat: update lock

### Patch Changes

- 42e6ab3: feat: update dep
- Updated dependencies [1e0d6fd]
- Updated dependencies [59b5375]
- Updated dependencies [c852f4b]
- Updated dependencies [42e6ab3]
  - @x-oasis/async-call-rpc@0.17.0
  - @x-oasis/async-call-rpc-web@0.13.0

## 0.13.0

### Minor Changes

- 58dde19: feat(orchestrator): cross-process-safe `ReconnectPolicySpec` for `ConnectionConfig`

  `ParticipantOrchestratorProxy.connect()` (utility / renderer worker) ships
  its `ConnectionConfig` to the main-process orchestrator over RPC. Live
  `ReconnectPolicy` class instances don't survive the serialisation
  boundary — their methods get stripped and the orchestrator silently fell
  back to a default policy, ignoring whatever strategy the worker asked for
  (telegraph D-007 G7).

  This change adds a declarative descriptor and reifies it on the receiving
  end:

  - New `ReconnectPolicySpec` discriminated union exported from
    `@x-oasis/async-call-rpc`:
    - `{ kind: 'exponential-backoff'; options?: ExponentialBackoffOptionsLike }`
    - `{ kind: 'fixed-delay'; delays?: number[] }`
    - `{ kind: 'never' }`
  - New `ConnectionConfigSpec` interface — the cross-process-safe subset of
    `ConnectionConfig` (heartbeat + reconnectPolicy spec; intentionally no
    `fromServices` / `toServices`, since RPC handlers are functions that
    can't survive serialisation either).
  - New `instantiateReconnectPolicy(spec)` factory + `isReconnectPolicySpec`
    type guard. Throws on unknown `kind` so a stale worker shipping a newer
    policy descriptor fails loud rather than silently degrading.
  - `BaseConnectionOrchestrator.registerProxyService`'s `requestConnect`
    handler now unmarshals incoming `ConnectionConfig` via
    `_unmarshalConnectionConfig` — specs become real instances, real
    instances pass through untouched.
  - `ParticipantOrchestratorProxy.connect(toId, config?, options?)` now
    types `config` as `ConnectionConfigSpec` (was `Record<string, unknown>`)
    and `options` as `ConnectOptions`.

  Backwards compatible: same-process callers passing real `ReconnectPolicy`
  instances are unaffected; cross-process callers gain the ability to
  configure their reconnect strategy for the first time.

### Patch Changes

- Updated dependencies [58dde19]
  - @x-oasis/async-call-rpc@0.16.0
  - @x-oasis/async-call-rpc-web@0.12.1

## 0.12.0

### Minor Changes

- 84e6aa6: feat: kill -> restart
- 1b59ab0: feat(UtilityProcessSupervisor): expose health-snapshot fields on InspectorSnapshot

  `InspectorSnapshot` (returned by `supervisor.getInspectorSnapshot()`)
  gains three new diagnostic fields aimed at detecting "zombie" utility
  processes — children that are nominally `running` but whose channel has
  silently stopped responding:

  - `lastChannelReadyAt: number | null` — epoch ms when
    `_fireChannelReady` last fired (i.e. when the supervisor's
    `ElectronUtilityProcessChannel` was constructed for the current
    child). Re-stamped on every spawn / restart, monotonically
    increasing for the supervisor's lifetime, `null` until the first
    successful `start()`.
  - `lastReadinessProbeAt: number | null` — epoch ms of the most recent
    readiness-probe outcome (success OR timeout). **Only populated when
    `readinessProbe.kind === 'firstMessage'`**; permanently `null` in
    `'spawn'` mode where there is no probe to time. Inspector dashboards
    should display "n/a" for `'spawn'`-mode supervisors.
  - `consecutiveProbeFailures: number` — number of consecutive
    readiness-probe timeouts since the last successful probe. Resets to
    `0` on every probe success (and is permanently `0` in `'spawn'`
    mode). High values combined with `'restarting'` / `'failed'` state
    indicate the worker entry script reaches `forkFn` but never sends
    the ready message — distinguishing it from outright crashes (which
    surface via the `exit` listener and bump `restartCount`).

  Implementation is purely additive: three private fields populated from
  the existing `_fireChannelReady` and `_awaitReadiness` methods, and
  three new entries on the snapshot return value. No existing field
  semantics change.

  Closes roadmap §3.D / D-006 Gap 4.

### Patch Changes

- Updated dependencies [84e6aa6]
  - @x-oasis/async-call-rpc@0.15.0
  - @x-oasis/async-call-rpc-web@0.12.0

## 0.11.3

### Patch Changes

- 8145f6b: fix: p2p
- Updated dependencies [25c7918]
- Updated dependencies [8145f6b]
  - @x-oasis/async-call-rpc@0.14.0
  - @x-oasis/async-call-rpc-web@0.11.3

## 0.11.2

### Patch Changes

- f819527: feat: trace
- Updated dependencies [f819527]
  - @x-oasis/async-call-rpc@0.13.2
  - @x-oasis/async-call-rpc-web@0.11.2

## 0.11.1

### Patch Changes

- 566278f: feat: add supervisor in utility process
- Updated dependencies [566278f]
  - @x-oasis/async-call-rpc@0.13.1
  - @x-oasis/async-call-rpc-web@0.11.1

## 0.11.0

### Minor Changes

- b7e4240: fix: build issue

### Patch Changes

- Updated dependencies [b7e4240]
  - @x-oasis/async-call-rpc@0.13.0
  - @x-oasis/async-call-rpc-web@0.11.0

## 0.10.0

### Minor Changes

- b0af3cc: feat: make di fit to orchestrator'

### Patch Changes

- Updated dependencies [b0af3cc]
  - @x-oasis/async-call-rpc@0.12.0
  - @x-oasis/async-call-rpc-web@0.10.0

## 0.9.0

### Minor Changes

- 021c2ec: feat: electron pagelet connection

### Patch Changes

- Updated dependencies [021c2ec]
  - @x-oasis/async-call-rpc@0.11.0
  - @x-oasis/async-call-rpc-web@0.9.0

## 0.8.0

### Minor Changes

- 86816b6: feat: update lock
- b29baa0: feat: more readable async call rpc client

### Patch Changes

- Updated dependencies [86816b6]
- Updated dependencies [b29baa0]
  - @x-oasis/async-call-rpc@0.10.0
  - @x-oasis/async-call-rpc-web@0.8.0

## 0.7.0

### Minor Changes

- f7ae61f: feat: add page / renderer channel

### Patch Changes

- 7385260: feat: update lock file
- Updated dependencies [f7ae61f]
- Updated dependencies [7385260]
  - @x-oasis/async-call-rpc@0.9.0
  - @x-oasis/async-call-rpc-web@0.7.0

## 0.6.1

### Patch Changes

- ec92705: feat: finish rpc electron gap
- Updated dependencies [ec92705]
  - @x-oasis/async-call-rpc@0.8.1

## 0.6.0

### Minor Changes

- d9de1de: fix: types dist issue

### Patch Changes

- 05cc74a: feat: rename to is-proxy-supported
- Updated dependencies [05cc74a]
- Updated dependencies [d9de1de]
  - @x-oasis/async-call-rpc@0.8.0

## 0.5.0

### Minor Changes

- be6411b: fix: build issue

### Patch Changes

- Updated dependencies [be6411b]
  - @x-oasis/async-call-rpc@0.7.0

## 0.4.0

### Minor Changes

- 2f8a0f2: feat: revert package.json
- 103b0fe: feat: update resume

### Patch Changes

- Updated dependencies [2f8a0f2]
- Updated dependencies [103b0fe]
  - @x-oasis/async-call-rpc@0.6.0

## 0.3.0

### Minor Changes

- 4c3dccd: feat: manage async call rpc port

### Patch Changes

- Updated dependencies [4c3dccd]
  - @x-oasis/async-call-rpc@0.5.0

## 0.2.0

### Minor Changes

- 6d79ee1: feat: bump version

### Patch Changes

- Updated dependencies [6d79ee1]
  - @x-oasis/async-call-rpc@0.4.0
