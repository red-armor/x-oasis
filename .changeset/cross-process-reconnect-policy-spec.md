---
'@x-oasis/async-call-rpc': minor
'@x-oasis/async-call-rpc-electron': minor
---

feat(orchestrator): cross-process-safe `ReconnectPolicySpec` for `ConnectionConfig`

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
