# Direct Channel Management in async-call-rpc-electron

## Overview

This document details how `createParticipantProxy` creates and manages direct channels between participants, specifically addressing channel binding, serviceHost setup, and request routing.

---

## 1. What Channel is Returned by `proxy.getChannelFor(peerId)`

### Location
**File:** `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-main/ParticipantOrchestratorProxy.ts`

**Lines:** 193-195

```typescript
getChannelFor(peerId: string): ElectronMessagePortMainChannel | undefined {
  return this._peerChannels.get(peerId);
}
```

### What is Returned

`getChannelFor(peerId)` returns an `ElectronMessagePortMainChannel` instance that represents a **direct communication channel** between the caller and a specific peer participant.

### Channel Creation Flow

**Location:** Lines 109-115

```typescript
let channel = this._peerChannels.get(peerId);
if (!channel) {
  channel = this._channelFactory(`↔${peerId} direct port`);
  this._peerChannels.set(peerId, channel);
}
channel.bindPort(port, { rebind: true });
```

**Key Points:**
- Each peer gets a **single, cached** `ElectronMessagePortMainChannel` instance
- Channels are created lazily on first use (via `this._channelFactory`)
- The default factory creates new `ElectronMessagePortMainChannel` instances with descriptions like `↔{peerId} direct port`
- When a port arrives from the orchestrator, it's bound to this channel via `bindPort(port, { rebind: true })`

---

## 2. Does `setServiceHost` Get Called on Direct Channels?

### Status: **NO** — setServiceHost is NOT called on direct channels from the proxy

### Why

Looking at `ParticipantOrchestratorProxy` (Lines 1-206), there is **no call to `setServiceHost`** on the channels returned by `_peerChannels`. The proxy manages channels purely for **client-side communication** (making RPC requests), not for receiving/dispatching service requests.

### Where setServiceHost IS Called (Control Channel Only)

**Location:** `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-main/MainOrchestratorSetup.ts`

**Lines:** 93-95 and 107-111

```typescript
// For main process participation (control channel)
const mainParticipantChannel = createMainParticipantChannel(mainDirectChannel);
orchestrator.registerParticipant('main', mainParticipantChannel, 'process');

// For orchestrator control service registration
serviceHost.registerService('orchestrator', {
  channel: ipcChannel,
  serviceHost,
  handlers: mergedHandlers,
});
```

### Utility Process Example

**Location:** `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-main/UtilityOrchestratorParticipant.ts`

**Lines:** 47-56

```typescript
this._mainServiceHost = new RPCServiceHost();
this._mainChannel.setServiceHost(this._mainServiceHost);  // ← Control channel only

this._mainServiceHost.registerServiceHandler(ORCHESTRATOR_SERVICE_PATH, {
  activateConnection: (port: any) => {
    this._directChannel.bindPort(port, { rebind: this._rebind });
  },
  activateConnectionContext: (_ctx: any) => {},
  ping: () => 'pong',
});
```

**Key Point:** `setServiceHost()` is called on the **main/control channel**, NOT on `_directChannel`. The direct channel only receives incoming ports via `bindPort()`.

---

## 3. How Are Incoming Messages Routed — Through serviceHost or service?

### Answer: It Depends on the Setup

Direct channels created by the proxy **do not have a serviceHost set**. If they receive incoming RPC requests, the routing depends on whether a `service` was explicitly set on the channel.

### Request Routing Logic

**Location:** `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/middlewares/handleRequest.ts`

**Lines:** 65-163

```typescript
export const handleRequest =
  (protocol: AbstractChannelProtocol) =>
  (message: DeserializedMessageOutput) => {
    const service = protocol.service;        // Line 68
    const serviceHost = protocol.serviceHost; // Line 69

    // ... message validation ...

    let handler: ((...a: any[]) => any) | undefined;
    
    if (serviceHost) {
      // Multi-service routing: look up by requestPath + methodName
      handler = serviceHost.getHandler(requestPath, methodName);
      if (!handler) return message;  // ← Silently ignore if not found
    } else {
      // Single-service routing: look up by methodName only
      handler = service?.getHandler(methodName);
      if (!handler) {
        // Send "Method not found" error
        const errorResponse = ErrorResponseMethodNotFound(seqId);
        const responseHeader = [ResponseType.ReturnFail, seqId];
        const responseBody = [errorResponse.error];
        
        safeSendReply(
          protocol,
          protocol.writeBuffer.encode([responseHeader, responseBody])
        );
        return message;
      }
    }

    // Handle the request (subscription, event method, or regular call)
    // ...
  };
```

### Routing Behavior for Proxy Channels

**By default, direct channels returned by `proxy.getChannelFor(peerId)` have:**
- `serviceHost = null`
- `service = undefined` (unless explicitly set)

**Therefore:**
1. If a `service` is set via `channel.setService()`, incoming requests route through that service
2. If no `service` is set, incoming requests are handled by the next middleware in the chain
3. **No "Method not found" error is sent** if both are null — the message passes through unchanged

### Where Direct Channels Typically Receive Messages

**Client-side routing in browsers/renderers:**

**Location:** `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-browser/registerOrchestratorHandler.ts`

**Lines:** 50-113

When a renderer registers a handler and receives a direct port from the orchestrator:

```typescript
export function registerOrchestratorHandler(
  channel: AbstractChannelProtocol,
  onPort: ((port: any) => void) | ((ctx: ActivationContext) => void)
): void {
  // ... context management ...
  
  const service = new RPCService(ORCHESTRATOR_SERVICE_PATH, {
    handlers: {
      activateConnection: (port: any, connectionId?: string) => {
        // When a port arrives, invoke the user's callback
        if (ctx) {
          onPort({
            port,
            connectionId: ctx.connectionId,
            role: ctx.role,
          });
        } else {
          onPort(port);  // Legacy: raw port only
        }
      },
      // ...
    },
  });
  service.setChannel(channel);  // ← Set service on control channel
}
```

The **direct channel is obtained by the user's callback** and bound to their own service via `channel.setService()` if they want to handle incoming requests.

---

## 4. AbstractChannelProtocol: setServiceHost vs setService Interaction

### Location
**File:** `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/protocol/AbstractChannelProtocol.ts`

### Property Definitions

**Lines:** 159-162 and 275-302

```typescript
private _service!: RPCService;
private _serviceHost: RPCServiceHost | null = null;

get service() {
  return this._service;
}

setService(service: RPCService) {
  this._service = service;
}

get serviceHost(): RPCServiceHost | null {
  return this._serviceHost;
}

/**
 * Bind this channel to an `RPCServiceHost`, enabling multi-service routing.
 * The `handleRequest` middleware will look up handlers via
 * `host.getHandler(requestPath, methodName)`. When a request's
 * `requestPath` is not in the host, the request is silently ignored —
 * which is what makes it safe to share one transport across multiple
 * channels (each bound to a different host) without producing
 * "Method not found" cross-talk.
 *
 * Idempotent: calling twice with the same host is a no-op.
 */
setServiceHost(host: RPCServiceHost) {
  if (this._serviceHost === host) return;
  this._serviceHost = host;
  this.ensureListenerAttached();
}
```

### How They Interact in handleRequest Middleware

**Key Behavior:**

1. **serviceHost takes precedence** (Lines 147-149):
   ```typescript
   if (serviceHost) {
     handler = serviceHost.getHandler(requestPath, methodName);
     if (!handler) return message;  // ← Silent no-op if not found
   }
   ```

2. **service is consulted only if serviceHost is null** (Lines 150-162):
   ```typescript
   else {
     handler = service?.getHandler(methodName);
     if (!handler) {
       // Send "Method not found" error
       const errorResponse = ErrorResponseMethodNotFound(seqId);
       // ...
     }
   }
   ```

### Why This Design

- **serviceHost** enables **multi-service routing**: one channel can route requests to different services based on `requestPath`
- **service** enables **single-service mode**: one service per channel, backward compatible
- **Mutual exclusion by design**: If you need multi-service routing, don't use `setService()` — only use `setServiceHost()`
- **Safety**: When `serviceHost` doesn't recognize a `requestPath`, the request is silently ignored (no error), making it safe for multiple channels to share one transport without cross-talk

### ensureListenerAttached

**Lines:** 311-315

```typescript
/**
 * Idempotently attach this channel's `onMessage` to the underlying
 * transport. Called by `setServiceHost`, `RPCService.setChannel`, and
 * `ProxyRPCClient.setChannel` so that a single channel shared between
 * a service host and one or more clients only ever has one listener
 * — preventing every incoming message from being processed twice.
 */
ensureListenerAttached(): void {
  if (this._listenerAttached) return;
  this._listenerAttached = true;
  this.on(this.onMessage.bind(this));
}
```

**Important:** 
- Both `setServiceHost()` (Line 301) and `RPCService.setChannel()` (not shown but calls `ensureListenerAttached()`) call `ensureListenerAttached()`
- This ensures the listener is attached exactly once, even if both a service and a host are set (which shouldn't happen, but idempotency prevents bugs)

---

## 5. Complete Flow Example: Participant-to-Participant Communication

### Setup Phase

**Main Process Setup:**

1. **Location:** `MainOrchestratorSetup.ts` (Line 77-83)
   - Orchestrator initializes with logging and stats
   
2. **Location:** `MainOrchestratorSetup.ts` (Line 88-92)
   - Main process creates a direct channel (cached per peer)
   
3. **Location:** `MainOrchestratorSetup.ts` (Line 107-111)
   - Orchestrator service registered on **control channel** with `serviceHost`
   
### Connection Request Phase

**Participant A requests connection to Participant B:**

1. **Location:** `ParticipantOrchestratorProxy.ts` (Lines 148-179)
   - `proxy.connect(toId)` calls orchestrator's `requestConnect(fromId, toId)`
   
2. **Location:** `ElectronConnectionOrchestrator.ts` (Lines 102-127)
   - Orchestrator creates port pair via `MessageChannelMain`
   - Sends each port to participants via `activateConnection` RPC
   
### Activation Phase

**Each participant receives its port:**

1. **Location:** `registerOrchestratorHandler.ts` (Lines 50-113)
   - Handler receives port (and context) on control channel
   - User binds port to direct channel: `directChannel.bindPort(port, { rebind: true })`
   
2. **Location:** `ElectronMessagePortMainChannel.ts` (Lines 84-94)
   - `bindPort()` attaches the port, wires up listeners, calls `activate()`
   
### Direct Communication Phase

**Once direct channels are bound:**

1. **Location:** `AbstractChannelProtocol.ts` (Lines 509-518)
   - `channel.makeRequest()` sends requests via bound port
   - Requests queued if port not yet attached
   
2. **Location:** `handleRequest.ts` (Lines 65-447)
   - Incoming messages on direct channel routed based on `serviceHost` or `service`
   - User's service handler (if set) processes requests
   
---

## Summary Table

| Aspect | Details |
|--------|---------|
| **What is returned by `getChannelFor(peerId)`** | `ElectronMessagePortMainChannel` instance, cached per peer |
| **Is setServiceHost called on direct channels** | **NO** — only on control channels. Direct channels are client-side or user-configured |
| **Incoming message routing** | 1. If `serviceHost` set → `serviceHost.getHandler(requestPath, methodName)` (silent no-op if not found) <br> 2. If only `service` set → `service.getHandler(methodName)` (error if not found) <br> 3. If neither → message passes through unchanged |
| **When to use serviceHost** | Multi-service routing per channel (one host, many services) |
| **When to use service** | Single-service mode (one service per channel) |
| **ensureListenerAttached behavior** | Idempotent; called by both `setServiceHost()` and `RPCService.setChannel()` to prevent double-listening |

