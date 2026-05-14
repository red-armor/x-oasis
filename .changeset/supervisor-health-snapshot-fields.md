---
'@x-oasis/async-call-rpc-electron': minor
---

feat(UtilityProcessSupervisor): expose health-snapshot fields on InspectorSnapshot

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
