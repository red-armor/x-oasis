# Direct Channel Architecture Diagrams

## 1. Overall System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Electron Main Process                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ElectronConnectionOrchestrator                          │  │
│  │  • Creates MessagePortMain pairs                         │  │
│  │  • Activates participants with ports                     │  │
│  └────────────┬────────────────────────────────────────────┘  │
│               │ via ORCHESTRATOR_SERVICE_PATH                   │
│               │                                                 │
│  ┌────────────▼────────────────────────────────────────────┐  │
│  │  Control Channel (IPCMainChannel)                       │  │
│  │  • setServiceHost(orchestratorHost) ✓                   │  │
│  │  • Routes ORCHESTRATOR_SERVICE_PATH requests            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
         │                              │
         │ Port delivery                │ Port delivery
         │ over IPC                      │ over IPC
         ▼                              ▼
    ┌─────────────┐              ┌──────────────┐
    │  Renderer A │              │  Utility Box │
    └─────────────┘              └──────────────┘
```

---

## 2. Participant Proxy Channel Management

```
┌────────────────────────────────────────────────────────────┐
│     ParticipantOrchestratorProxy (Main Process)            │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  _peerChannels: Map<peerId, ElectronMessagePortMainChannel> │
│  │                                                        │ │
│  │  ┌─────────────────┐   ┌─────────────────┐           │ │
│  │  │  renderer-a     │   │  utility-box    │           │ │
│  │  │  (cached)       │   │  (cached)       │           │ │
│  │  └─────────────────┘   └─────────────────┘           │ │
│  │    Direct Channel       Direct Channel                │ │
│  │    - NO serviceHost    - NO serviceHost              │ │
│  │    - NO service        - NO service                  │ │
│  │    (user-configured)   (user-configured)             │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  proxy.getChannelFor('renderer-a')  ──► returns cached     │
│                                         ElectronMessagePort │
│                                         MainChannel        │
└────────────────────────────────────────────────────────────┘
```

---

## 3. Channel Binding Lifecycle

```
TIME 0: Channel Created (lazy)
┌──────────────────────────────────┐
│ ElectronMessagePortMainChannel   │
├──────────────────────────────────┤
│ _port: null                      │
│ _isConnected: false              │
│ _onMessageListener: null         │
└──────────────────────────────────┘


TIME 1: orchestrator sends port
┌──────────────────────────────────┐
│ activateConnection handler       │
│ called with MessagePortMain      │
└──────────────────────────────────┘
        │
        └─► channel.bindPort(port, { rebind: true })
                │
                ├─► _attachPort(port)
                │    ├─► port.start()
                │    ├─► port.on('message', listener)
                │    └─► port.on('close', disconnect)
                │
                └─► activate()
                     └─► fires onDidConnected
                          └─► resumePendingEntry()


TIME 2: Port Active
┌──────────────────────────────────┐
│ ElectronMessagePortMainChannel   │
├──────────────────────────────────┤
│ _port: MessagePortMain           │
│ _isConnected: true               │
│ _onMessageListener: attached      │
│ _detachListener: active          │
└──────────────────────────────────┘
        │
        └─► Requests can flow both directions
            - makeRequest() sends
            - on('message') receives
```

---

## 4. Handler Lookup in handleRequest Middleware

```
                    handleRequest Middleware
                            │
                ┌───────────┴───────────┐
                │                       │
        Check serviceHost           Check service
                │                       │
        ┌───────▼────────┐    ┌───────▼────────┐
        │ serviceHost     │    │ service        │
        │ exists?         │    │ exists?        │
        └───────┬────────┘    └────────┬───────┘
                │                      │
         YES┌───▼──┐             YES┌──▼───┐
           │       │                │      │
           ▼       ▼                ▼      ▼
        MULTI    SINGLE           SINGLE  NONE
        SERVICE  SERVICE          SERVICE  
        ROUTING  ROUTING          ROUTING  

    MULTI-SERVICE (via serviceHost)
    ┌─────────────────────────────────────┐
    │ handler = serviceHost.getHandler(   │
    │   requestPath,                      │
    │   methodName                        │
    │ )                                   │
    ├─────────────────────────────────────┤
    │ if NOT found:                       │
    │   ► SILENT NO-OP (pass through)    │
    │   ► NO ERROR                        │
    └─────────────────────────────────────┘
        (Safe for shared transports!)


    SINGLE-SERVICE (via service)
    ┌─────────────────────────────────────┐
    │ handler = service.getHandler(       │
    │   methodName                        │
    │ )                                   │
    ├─────────────────────────────────────┤
    │ if NOT found:                       │
    │   ► SEND ERROR RESPONSE             │
    │   ► "Method not found"              │
    └─────────────────────────────────────┘
        (Traditional single-service pattern)


    NO HANDLERS (default for proxy channels)
    ┌─────────────────────────────────────┐
    │ handler = undefined                 │
    │ NO serviceHost                      │
    │ NO service                          │
    ├─────────────────────────────────────┤
    │ Request passes through to next      │
    │ middleware (likely ignored)         │
    └─────────────────────────────────────┘
```

---

## 5. Service Configuration: Control vs Direct Channels

```
┌──────────────────────────────────────────────────────────────────┐
│                         Main Process Setup                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────┐                            │
│  │ CONTROL CHANNEL (IPCMainChannel)│                            │
│  ├─────────────────────────────────┤                            │
│  │ setServiceHost(orchestratorHost)│ ◄─── ORCHESTRATOR SERVICE │
│  │      │                           │      (multiple paths)     │
│  │      └─► Multi-service routing   │                            │
│  │          via requestPath         │                            │
│  │                                  │                            │
│  │ Service: ORCHESTRATOR_SERVICE_PATH                           │
│  └─────────────────────────────────┘                            │
│                                                                  │
│  ┌─────────────────────────────────┐                            │
│  │ DIRECT CHANNEL (for each peer)  │                            │
│  ├─────────────────────────────────┤                            │
│  │ NO serviceHost  ❌               │                            │
│  │ NO service      ❌               │                            │
│  │                                  │                            │
│  │ (Empty - for client use or      │                            │
│  │  user to set service on)         │                            │
│  └─────────────────────────────────┘                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Utility Process Setup

```
┌────────────────────────────────────────────┐
│      UtilityOrchestratorParticipant        │
├────────────────────────────────────────────┤
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │ MAIN CHANNEL (to Main Process)       │ │
│  ├──────────────────────────────────────┤ │
│  │ setServiceHost(_mainServiceHost) ✓   │ │
│  │      │                               │ │
│  │      ├─► ORCHESTRATOR handlers       │ │
│  │      │   (activateConnection, ping) │ │
│  │      │                               │ │
│  │      └─► Multi-service routing       │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │ DIRECT CHANNEL (Peer-to-Peer)        │ │
│  ├──────────────────────────────────────┤ │
│  │ NO serviceHost  ❌                    │ │
│  │                                      │ │
│  │ CAN register services via:           │ │
│  │ registerService(serviceId, handlers) │ │
│  │      │                               │ │
│  │      └─► creates RPCService with     │ │
│  │          handlers, bound to channel  │ │
│  └──────────────────────────────────────┘ │
│                                            │
└────────────────────────────────────────────┘
```

---

## 7. Full Request Flow Example

```
Renderer A wants to call method on Utility Box
┌──────────────────────────────────────────────────────┐
│ Renderer A                                           │
├──────────────────────────────────────────────────────┤
│                                                      │
│ 1. proxy = createParticipantProxy(...)             │
│    orchestratorProxy.registerOrchestratorHandler(   │
│      ipcChannel,                                   │
│      (ctx) => {                                    │
│        channel = ...get or create direct channel   │
│        channel.bindPort(ctx.port)  ◄─ KEY         │
│      }                                              │
│    )                                                │
│                                                      │
│ 2. orchestrator.connect('renderer-a', 'utility')  │
│    ─ Orchestrator creates port pair               │
│    ─ Sends port to both participants              │
│    ─ Each receives on CONTROL CHANNEL             │
│                                                      │
│ 3. registerOrchestratorHandler callback fires     │
│    ─ Binds port to DIRECT CHANNEL                 │
│    ─ Channel now connected                        │
│                                                      │
│ 4. User calls:                                     │
│    const service = clientHost.registerClient(     │
│      'my-service',                                │
│      { channel: directChannel }                   │
│    ).createProxy()                                │
│                                                      │
│ 5. service.doWork() ────┐                         │
│                         └─► makeRequest()         │
│                              │                     │
│                              └─► send on port    │
└──────────────────────────────────────────────────────┘
                                │
                    Port (Electron MessagePort)
                                │
┌──────────────────────────────▼──────────────────────┐
│ Utility Box                                         │
├──────────────────────────────────────────────────────┤
│                                                      │
│ 1. registerOrchestratorHandler(                    │
│      mainChannel,  (ctx) => {                      │
│        directChannel.bindPort(ctx.port)            │
│      }                                              │
│    )                                                │
│                                                      │
│ 2. registerService('my-service', {                 │
│      doWork: (args) => {...}                       │
│    })  ─┐                                           │
│         └─► Binds to directChannel                │
│              via setService()                      │
│                                                      │
│ 3. directChannel receives message ────────┐       │
│                                            └─► onMessage()
│                                                │
│                                        ┌──────▼──────┐
│                                        │handleRequest │
│                                        │ middleware  │
│                                        └──────┬──────┘
│                                               │
│                                    Check: handler = 
│                                    service.getHandler(
│                                      'doWork'
│                                    )
│                                               │
│                                    ┌──────────▼─────────┐
│                                    │Found! Call handler│
│                                    └──────────┬─────────┘
│                                               │
│                                    ┌──────────▼─────────┐
│                                    │sendReply with result
│                                    │back to Renderer A
│                                    └────────────────────┘
│                                                      │
└──────────────────────────────────────────────────────┘
                                │
                    Port (Electron MessagePort)
                                │
┌──────────────────────────────▼──────────────────────┐
│ Renderer A                                          │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Result received, promise resolves ✓                │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 8. Key Design Decisions

```
Design Decision: serviceHost vs service

┌─────────────────────────────────────────────────────┐
│ PROBLEM: How to route requests on shared channels? │
└─────────────────────────────────────────────────────┘

SOLUTION A: serviceHost (Multi-service routing)
┌──────────────────────────────┐
│ if (serviceHost exists)      │
│   handler = host.getHandler( │
│     requestPath,             │
│     methodName               │
│   )                          │
│   if (!handler)              │
│     ► SILENT NO-OP           │  ← Safe for shared transports!
│     ► Return (don't error)   │     Multiple channels can share
└──────────────────────────────┘     one transport without 
                                      "Method not found" spam


SOLUTION B: service (Single-service mode)
┌──────────────────────────────┐
│ else if (service exists)     │
│   handler = service.getHandler(
│     methodName               │
│   )                          │
│   if (!handler)              │
│     ► SEND ERROR RESPONSE    │  ← Traditional fallback
│     ► "Method not found"     │
└──────────────────────────────┘


Application:
- Control channels → use serviceHost
  (orchestrator routes many service paths)
- Direct channels → NO serviceHost
  (peer-to-peer, point-to-point)
- User service on direct → use setService()
  (explicit, no multi-path routing)
```

---

## 9. Critical Points Summary

```
┌────────────────────────────────────────────────────────────┐
│                    Critical Points                          │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. getChannelFor(peerId) Returns                           │
│    └─► ElectronMessagePortMainChannel (cached)            │
│        • Lazy-created on first connection                  │
│        • One per peer, reused for all data                 │
│        • NO serviceHost or service by default             │
│                                                             │
│ 2. setServiceHost NOT Called on Direct Channels           │
│    └─► Only used for control/routing channels             │
│        • UtilityOrchestratorParticipant._mainChannel ✓    │
│        • ParticipantOrchestratorProxy channels ❌          │
│        • registerOrchestratorHandler control channel ✓    │
│                                                             │
│ 3. Incoming Message Routing                               │
│    └─► Three paths checked in order:                      │
│        a) serviceHost.getHandler() → if found, use it      │
│        b) service.getHandler() → if found, use it          │
│        c) Neither → message passes through                 │
│                                                             │
│ 4. serviceHost vs service Interaction                      │
│    └─► Mutual exclusion in handleRequest:                 │
│        if (serviceHost)      ◄─ Precedence!               │
│          handler = host.getHandler(...)                    │
│        else if (service)     ◄─ Fallback                  │
│          handler = service.getHandler(...)                 │
│                                                             │
│ 5. ensureListenerAttached Safety                          │
│    └─► Called by both setServiceHost() and                │
│        RPCService.setChannel()                            │
│        ► Idempotent: only attaches once                   │
│        ► Prevents double-listening bugs                   │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

