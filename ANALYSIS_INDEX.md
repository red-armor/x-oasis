# CreateParticipantProxy Analysis - Complete Index

## Quick Navigation

This analysis covers the `createParticipantProxy` function implementation in x-oasis and answers your three specific questions about the orchestrator architecture.

### Your Three Questions - Quick Answers

1. **How does `getChannelFor(peerId)` work?**
   - Returns the MessagePort-based direct channel
   - Simple Map lookup from `_peerChannels`
   - See: Line 193-195 of ParticipantOrchestratorProxy.ts

2. **How is `onConnection` callback triggered?**
   - Two-part RPC mechanism: `activateConnectionContext` then `activateConnection`
   - Triggered at lines 116-132 in ParticipantOrchestratorProxy.ts
   - Initiator path: resolves promise; Receiver path: calls callback

3. **How does `connect(peerId)` work on utility process side?**
   - Two approaches: ParticipantOrchestratorProxy or UtilityOrchestratorParticipant
   - Utility version uses shared `_directChannel` instead of per-peer channels
   - See: UtilityOrchestratorParticipant.ts (107 lines)

---

## Document Files

### Primary Analysis Document
**File:** `/Users/ryu/Documents/code/red/x-oasis/CREATEPARTICIPANTPROXY_ANALYSIS.md` (879 lines)

Complete analysis including:
- Full source code for all 6 related files
- Detailed explanations for each question
- Architecture diagrams
- Flow sequences
- Context management system explanation
- Supporting code references

### Source Files Referenced

All located in: `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/`

1. **electron-main/ParticipantOrchestratorProxy.ts** (206 lines)
   - Main factory: `createParticipantProxy()`
   - Class: `ParticipantOrchestratorProxy`
   - Key method: `getChannelFor(peerId)` - line 193-195
   - Key method: `connect(toId)` - line 148-179
   - Key handler: `activateConnection()` - line 80-133

2. **electron-main/UtilityOrchestratorParticipant.ts** (107 lines)
   - Utility-process-specific participant
   - Factory: `createUtilityParticipant()`
   - Key methods: `getService()`, `registerService()`, `registerControlService()`

3. **electron-main/ElectronMessagePortMainChannel.ts** (180 lines)
   - Wrapper for Electron's MessagePortMain
   - Key method: `bindPort()` - line 84-94
   - Key method: `send()` - line 138-150

4. **electron-main/ElectronConnectionOrchestrator.ts** (196 lines)
   - Orchestrator that creates connections
   - Key method: `activateParticipant()` - line 102-127

5. **electron-browser/registerOrchestratorHandler.ts** (114 lines)
   - Handler registration for renderer processes
   - Key function: `registerOrchestratorHandler()` - line 50-114

6. **electron-main/MainOrchestratorSetup.ts** (246 lines)
   - Orchestrator setup utilities
   - Key function: `setupMainOrchestrator()`

---

## Understanding the System

### Core Concept
The orchestrator is a broker in the main process that:
1. Accepts connection requests from two participants
2. Creates an entangled MessagePortMain pair
3. Delivers each port to its respective participant via RPC
4. Participants then communicate directly via those ports

### Connection Flow

```
Initiator                Main Process              Receiver
   (A)                  Orchestrator               (B)
    |                        |                      |
    |--connect('B')--------->|                      |
    |                        | create MessageChannelMain()
    |                        | port1, port2
    |                        |
    |    activateConnectionContext(ctx)            |
    |<-----------------------|                      |
    | stores ctx in queue    |                      |
    |                        |                      |
    |      activateConnection(port1)               |
    |<-----------------------|                      |
    | retrieves ctx          |                      |
    | binds port1            |                      |
    | resolves promise       |                      |
    |                        |                      |
    |                        | activateConnectionContext(ctx)
    |                        |--------------------->|
    |                        |                 stores ctx in queue
    |                        |
    |                        | activateConnection(port2)
    |                        |--------------------->|
    |                        |              retrieves ctx
    |                        |              binds port2
    |                        |
    | getChannelFor('B')     |         participant.directChannel
    | -> ElectronMessagePortMainChannel (wrapping port1)
    |
    |------ point-to-point direct RPC over MessagePort ----->|
    |<------- (orchestrator no longer involved) --------------|
```

### Context Queuing System

The system uses three fallback strategies to match contexts with ports:

1. **Explicit matching** (modern, explicit connectionId)
   ```
   _pendingContexts.get(connectionId)
   ```

2. **Queue-based matching** (FIFO)
   ```
   _contextQueue.shift()
   ```

3. **Last context fallback** (single-connection scenario)
   ```
   _lastContext
   ```

---

## Key Data Structures

### ParticipantOrchestratorProxy Private Members

- `_selfId`: string - This participant's identifier
- `_controlChannel`: AbstractChannelProtocol - Control plane to orchestrator
- `_peerChannels`: Map<string, ElectronMessagePortMainChannel> - Direct channels cache
- `_pendingConnects`: Map<string, {peerId, resolve, reject}> - Pending connection promises
- `_pendingContexts`: Map<string, {connectionId, role}> - Metadata waiting for ports
- `_contextQueue`: Array<{connectionId, role}> - FIFO queue of contexts
- `_lastContext`: Last received context for fallback
- `_orchestratorClient`: RPC proxy to orchestrator

### ElectronMessagePortMainChannel

- Wraps a Electron `MessagePortMain` object
- Implements `AbstractChannelProtocol`
- Supports late binding: can be created before port arrives
- `bindPort()` activates a previously unbound channel
- `send()` posts messages to the port

---

## Architecture Patterns

### Pattern 1: Dual-Channel Participant
Each participant maintains:
- **Control channel**: Persistent connection to orchestrator (for requests and port delivery)
- **Direct channels**: Per-peer MessagePort-based channels (for high-performance RPC)

### Pattern 2: Promise-Based Connection
```typescript
const conn = await proxy.connect('peer-id');
// Returns when orchestrator delivers the port and binds it
const channel = conn.getChannel();
```

### Pattern 3: Event-Based Connection (Inbound)
```typescript
proxy.onConnection((conn) => {
  // Called when remote peer connects to this participant
  const channel = conn.getChannel();
});
```

### Pattern 4: Two-Phase Port Activation
1. Metadata sent first (connectionId, role)
2. Port sent second (MessagePortMain)
3. Context queuing handles timing issues

---

## Testing & Verification

To understand the flow, trace through:

1. **Initiator path** (calling `connect()`):
   - `connect()` stores promise resolver in `_pendingConnects`
   - `orchestratorClient.requestConnect()` sends request
   - Later, when `activateConnection()` is called, lookup resolver and call it

2. **Receiver path** (not calling `connect()`):
   - `activateConnection()` is called by orchestrator
   - No entry in `_pendingConnects`
   - `_onConnection` callback is invoked instead

3. **Port binding flow**:
   - Extract peerId from canonical connectionId (format: "id1--id2")
   - Get or create channel from `_peerChannels`
   - Call `channel.bindPort(port, { rebind: true })`
   - Channel activates and fires `onDidConnected` event

---

## Utility Process Specifics

### UtilityOrchestratorParticipant Differences

| Aspect | Standard Proxy | Utility Participant |
|--------|---|---|
| Creation | `createParticipantProxy()` | `createUtilityParticipant()` |
| Control Channel Type | Generic `AbstractChannelProtocol` | `ElectronUtilityProcessChannel` |
| Direct Channel Count | One per peer | Single shared channel |
| Port Reception | Per-peer handler | Shared handler |
| Service Usage | Via `connect()` promise | Via `getService()` getter |

### Utility Process Channel Architecture
```
Utility Process
├── _mainChannel: ElectronUtilityProcessChannel (→ parentPort → Main)
│   └─ Used for: orchestrator control, service registration
├── _directChannel: ElectronMessagePortMainChannel (unbound initially)
│   └─ Bound by orchestrator when peer connects
│   └─ Reused for all direct peer communication
└── _mainServiceHost: RPCServiceHost
    └─ Registers handlers: activateConnection, activateConnectionContext, ping
```

---

## Related Concepts

### AbstractChannelProtocol
Base class for all channels in the RPC framework. Key methods:
- `activate()` - Mark as connected
- `send(data, transfer)` - Send data over channel
- `on(listener)` - Listen for messages
- `disconnect()` - Close channel

### RPCService vs RPCClient
- **RPCService**: Registers handlers for incoming RPC calls
- **RPCClient**: Creates proxy to call remote handlers
- Both use the same underlying channel

### MessageChannelMain (Electron)
Native Electron API for creating entangled message ports:
```typescript
const { port1, port2 } = new MessageChannelMain();
// port1 sent to process A, port2 sent to process B
// A and B can now communicate via port1/port2 without main process involvement
```

---

## Common Questions Answered

**Q: Can `getChannelFor()` be called before connection is established?**
A: Yes, but it returns `undefined`. The channel is only created when the orchestrator delivers the port.

**Q: What happens if `activateConnection()` is called without prior `activateConnectionContext()`?**
A: The context falls back to `_lastContext`. If that's null too, the handler returns early (line 101).

**Q: Why send context before port?**
A: To decouple timing. The context is queued and ready before the port arrives, preventing race conditions.

**Q: Can multiple connections exist to the same peer?**
A: Yes, but they'll overwrite the same entry in `_peerChannels`. The shared entry is the last one bound via `rebind: true`.

**Q: Does the orchestrator stay involved after port delivery?**
A: No. Once both participants have their ports, they communicate directly. The orchestrator is out of the loop (except for heartbeats).

---

## Performance Characteristics

- **Connection setup**: 2 RPC round trips (context + port)
- **Direct communication**: Zero orchestrator overhead
- **Message delivery**: Direct MessagePort posting (OS level)
- **Memory**: One channel per peer in `_peerChannels` Map
- **Scalability**: Linear with number of active peers

---

## Files in This Analysis

- **This file**: Index and quick reference
- **CREATEPARTICIPANTPROXY_ANALYSIS.md**: Complete 879-line analysis with full source code

---

## Source Code Locations

All source code in the x-oasis repository:
```
/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/
├── electron-main/
│   ├── ParticipantOrchestratorProxy.ts
│   ├── UtilityOrchestratorParticipant.ts
│   ├── ElectronMessagePortMainChannel.ts
│   ├── ElectronConnectionOrchestrator.ts
│   └── MainOrchestratorSetup.ts
└── electron-browser/
    └── registerOrchestratorHandler.ts
```

---

## Document Generation Info

- Created: 2026-05-13
- Repository: x-oasis (async-call-rpc-electron package)
- Analysis Depth: Complete source code + detailed explanations
- Document Size: 879 lines (CREATEPARTICIPANTPROXY_ANALYSIS.md)
