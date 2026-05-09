/**
 * Connection lifecycle states — modelled after gRPC connectivity state machine
 * with additions from SignalR (DISCONNECTING).
 *
 * State transition diagram:
 *
 * ```
 *                         connect() called
 *  ┌──────────┐ ─────────────────────────────► ┌──────────────┐
 *  │          │                                │              │
 *  │   IDLE   │                                │  CONNECTING  │
 *  │          │ ◄────── connection failed ───── │              │
 *  └──────────┘   (no auto-retry on 1st try)   └──────┬───────┘
 *       ▲                                             │
 *       │                                      both sides activated
 *       │                                             │
 *  ┌────┴─────────┐                           ┌──────▼───────┐
 *  │              │                           │              │
 *  │   CLOSED     │                           │    READY     │
 *  │              │                           │              │
 *  └──────────────┘                           └──────┬───────┘
 *       ▲                                            │
 *       │                                     port closed /
 *       │                                     process exit /
 *  gave up /                                  heartbeat timeout
 *  disconnect()                                      │
 *       │                                            ▼
 *  ┌────┴─────────┐    retry timer expired   ┌──────────────────┐
 *  │              │ ◄───────────────────────  │                  │
 *  │DISCONNECTING │                           │TRANSIENT_FAILURE │
 *  │              │    reconnect succeeded    │                  │
 *  └──────────────┘ ───────────── ▲ ───────── └──────────────────┘
 *                                 │                    │
 *                                 └────────────────────┘
 *                                    via CONNECTING → READY
 * ```
 */
export enum ConnectionState {
  /** Participants registered but no connection attempt has been made. */
  IDLE = 'IDLE',

  /** Port pair created; waiting for both sides to activate. */
  CONNECTING = 'CONNECTING',

  /** Both sides activated — RPC calls are usable. */
  READY = 'READY',

  /** Connection lost; Orchestrator is scheduling reconnect attempts. */
  TRANSIENT_FAILURE = 'TRANSIENT_FAILURE',

  /** Graceful teardown in progress. */
  DISCONNECTING = 'DISCONNECTING',

  /**
   * Terminal state reached after either:
   *  - user called `disconnect()`, or
   *  - reconnect policy returned `null` (gave up).
   *
   * NOT permanently terminal: the user may call `connect()` again to
   * transition back to CONNECTING.
   */
  CLOSED = 'CLOSED',
}

/**
 * All valid state transitions.
 *
 * Each entry is [from, to].
 */
const VALID_TRANSITIONS: ReadonlyArray<
  readonly [ConnectionState, ConnectionState]
> = [
  // connect() called
  [ConnectionState.IDLE, ConnectionState.CONNECTING],
  // connection failed on first attempt → back to IDLE (no auto-retry)
  [ConnectionState.CONNECTING, ConnectionState.IDLE],
  // both sides activated successfully
  [ConnectionState.CONNECTING, ConnectionState.READY],
  // port closed / process exit / heartbeat timeout
  [ConnectionState.READY, ConnectionState.TRANSIENT_FAILURE],
  // participant lost during CONNECTING (handshake in progress)
  [ConnectionState.CONNECTING, ConnectionState.TRANSIENT_FAILURE],
  // user calls disconnect() while READY
  [ConnectionState.READY, ConnectionState.DISCONNECTING],
  // retry timer fires → attempt reconnect
  [ConnectionState.TRANSIENT_FAILURE, ConnectionState.CONNECTING],
  // reconnect policy returned null → give up
  [ConnectionState.TRANSIENT_FAILURE, ConnectionState.DISCONNECTING],
  // first-attempt failed with retryOnInitialFailure: IDLE → TRANSIENT_FAILURE
  [ConnectionState.IDLE, ConnectionState.TRANSIENT_FAILURE],
  // graceful teardown complete
  [ConnectionState.DISCONNECTING, ConnectionState.CLOSED],
  // user calls connect() again after CLOSED
  [ConnectionState.CLOSED, ConnectionState.CONNECTING],
];

/**
 * Returns `true` if transitioning `from → to` is a valid state change.
 */
export function isValidTransition(
  from: ConnectionState,
  to: ConnectionState
): boolean {
  return VALID_TRANSITIONS.some(([f, t]) => f === from && t === to);
}
