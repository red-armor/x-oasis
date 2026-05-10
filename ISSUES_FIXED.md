# Fixed Issues

## Issue: Heartbeat ping fails with "Method not found" error causing frequent reconnection

**Status:** ✅ FIXED

**Date:** May 10, 2026

**Package:** `@x-oasis/async-call-rpc-electron`

### Problem Description

When using the `page-acquire-renderer-port-orchestrator-example`, the orchestrator connection between renderer and utility process would frequently disconnect and reconnect approximately 10 seconds after establishing a connection.

**Symptoms:**

- Connection established successfully (state: READY)
- ~10 seconds later: heartbeat timeout
- Error log: `[heartbeat] ping rejected from renderer: RPCError: Method not found`
- Connection transitions: `READY → TRANSIENT_FAILURE → reconnects`
- Cycle repeats every ~10 seconds (heartbeat interval)

**Impact:** The connection is unstable and unusable for real-time communication between renderer and utility processes.

### Root Cause Analysis

The bug was in `createPageBridge.ts`'s `getServicePath()` function used to filter IPC messages:

**Location:** `/packages/async/async-call-rpc-electron/src/electron-browser/createPageBridge.ts`

**Buggy Code:**

```typescript
function getServicePath(data: unknown): string | undefined {
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(data) || !Array.isArray(data[0])) return undefined;
  const entry = data[0];
  if (!Array.isArray(entry[0])) return undefined; // ❌ WRONG: entry[0] is a number, not an array!
  return entry[0][2]; // ❌ This line never reaches
}
```

**Why It Failed:**

- RPC message wire format: `[[type, seqId, requestPath, methodName], body]`
- `data[0]` = `[type, seqId, requestPath, methodName]` ✓ (is an array)
- `entry = data[0]` = `[type, seqId, requestPath, methodName]` ✓
- `entry[0]` = `type` ✗ (is a **number**, not an array!)
- The condition `!Array.isArray(entry[0])` always evaluates to `true`
- Function always returns `undefined` instead of the `requestPath`

**Cascade Effect:**

1. Main process sends ping: `makeRequest(ORCHESTRATOR_SERVICE_PATH, 'ping')`
2. Preload receives ping via `ipcRenderer.on('app-rpc')`
3. `bridgeCallback` in `createPageBridge` calls `getServicePath(pingRequest)` → returns `undefined`
4. Ping is NOT filtered out and gets forwarded to renderer process
5. Renderer process's `ipcPageChannel` receives the ping request
6. No handler for ping exists on `ipcPageChannel` → replies with "Method not found"
7. Main process receives error response → `ping` Deferred is rejected
8. Heartbeat timeout triggered → connection marked as `TRANSIENT_FAILURE`
9. Reconnect cycle begins, and the issue repeats

### Solution

Fix the `getServicePath()` function to correctly extract the `requestPath` from the message header:

**Fixed Code:**

```typescript
function getServicePath(data: unknown): string | undefined {
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return undefined;
    }
  }
  // Wire format: [[type, seqId, requestPath, methodName], body]
  // header = data[0] = [type, seqId, requestPath, methodName]
  // requestPath is at index 2 of the header array
  if (!Array.isArray(data) || !Array.isArray(data[0])) return undefined;
  const header = data[0]; // [type, seqId, requestPath, methodName]
  return typeof header[2] === 'string' ? header[2] : undefined;
}
```

**Key Changes:**

- Correctly access `header[2]` (the `requestPath` element) instead of trying to access `entry[0][2]`
- Added clarifying comments about the wire format
- Added type check `typeof header[2] === 'string'` to validate the extracted value

### Verification

**Before Fix:**

```
[main] initial connection state: READY
[utility] direct RPC to renderer: greeting from page: hello from utility via direct port
[heartbeat] sending ping to renderer, channel connected=true
[heartbeat] sending ping to utility, channel connected=true
[heartbeat] ping rejected from renderer: RPCError: Method not found  ❌
[heartbeat] pong received from utility: pong  ✓
[orchestrator:warn] [Orchestrator] heartbeat timeout: renderer--utility
[orchestrator:debug] [Orchestrator] [renderer--utility] READY → TRANSIENT_FAILURE
```

**After Fix:**

```
[main] initial connection state: READY
[utility] direct RPC to renderer: greeting from page: hello from utility via direct port
[heartbeat] sending ping to renderer, channel connected=true
[heartbeat] sending ping to utility, channel connected=true
[heartbeat] pong received from renderer: pong  ✓
[heartbeat] pong received from utility: pong  ✓
(no disconnects, stable operation)
```

Tested for 30+ seconds across multiple heartbeat cycles (10-second intervals) with consistent success.

### Files Changed

1. **`/packages/async/async-call-rpc-electron/src/electron-browser/createPageBridge.ts`**
   - Fixed `getServicePath()` function to correctly parse RPC message header

2. **`/packages/async/async-call-rpc/src/protocol/AbstractChannelProtocol.ts`**
   - Changed `_stopHeartbeat` from `private` to `protected` to allow subclass override in `ElectronConnectionOrchestrator`

### Related Components

- **Affected Package:** `@x-oasis/async-call-rpc-electron`
- **Affected Example:** `page-acquire-renderer-port-orchestrator-example`
- **Heartbeat System:** `BaseConnectionOrchestrator._sendHeartbeat()`
- **IPC Message Filtering:** `createPageBridge()` bridge callback

### Additional Notes

During investigation, a false positive "second bug" was identified where `READY → TRANSIENT_FAILURE (channel disconnected)` occurred shortly after connection establishment. This was determined to be an artifact of the test harness (the monitoring script was force-killing the Electron process after 15 seconds), not an actual bug in the code. 30+ second runs without external termination show stable operation.

### Commit Message

```
fix: correct message format parsing in createPageBridge getServicePath

The getServicePath() function in createPageBridge.ts incorrectly
attempted to access entry[0][2] where entry[0] is a numeric type value,
not an array. This caused the function to always return undefined,
preventing proper filtering of orchestrator service messages.

As a result, ping heartbeat requests were incorrectly forwarded to the
renderer process, which had no handler for them, causing "Method not found"
errors and triggering unnecessary reconnections every 10 seconds.

Fixed by correctly extracting header[2] as the requestPath from the
message header array [[type, seqId, requestPath, methodName], body].

Verified with 30+ second stable operation across multiple heartbeat cycles.

Fixes: Heartbeat ping fails with "Method not found" error
```

---

## Investigation Methodology

The investigation followed a systematic debugging approach:

1. **Symptom Analysis:** Identified that ping was being rejected while utility heartbeat succeeded
2. **Log Instrumentation:** Added debug logs to `ElectronConnectionOrchestrator._sendHeartbeat()` to track ping/pong results
3. **Static Code Analysis:** Examined the full RPC pipeline and message routing
4. **Message Tracing:** Used `handleRequest.ts` debug logs to identify WHERE the "Method not found" error originated (main process, not preload)
5. **Reverse Engineering:** Traced message flow backwards through the IPC stack to `createPageBridge`'s bridge callback
6. **Root Cause Identification:** Analyzed `getServicePath()` function logic and discovered the array access bug
7. **Verification:** Confirmed fix by running extended tests (30+ seconds) without reconnections

**Key Insight:** The error came from the main process's `handleRequest`, not the preload's, revealing that the ping was being looped back to the main process instead of being filtered at the preload level.
