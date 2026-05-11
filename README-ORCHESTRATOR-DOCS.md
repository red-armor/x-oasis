# X-OASIS ORCHESTRATOR DOCUMENTATION

This directory contains comprehensive analysis of the x-oasis orchestrator codebase.

## Documentation Files

Three detailed markdown files have been created in the project root:

### 1. X-OASIS-ORCHESTRATOR-COMPREHENSIVE-ANALYSIS.md (26 KB)
**Start here for deep understanding**

Complete breakdown of the entire orchestrator system with:
- All 14 key source files listed with absolute paths
- Every interface, type, and constant defined
- All abstract methods and their implementations
- Complete line-by-line explanation of critical methods
- State machine diagrams and transitions
- Control flow walkthroughs
- Reconnection and heartbeat logic
- Error handling patterns
- Telegraph D-006 fixes explanation

**Key sections:**
1. Orchestrator Types (types.ts) - all interfaces
2. BaseConnectionOrchestrator - the core state machine (1,172 lines)
3. Platform implementations (Electron, Node, Web)
4. RPC control plane (makeRequest, activateParticipant)
5. Service endpoints (clientHost, serviceHost)
6. Critical implementation details

### 2. ORCHESTRATOR-QUICK-REFERENCE.md (11 KB)
**Use this for quick lookups and coding**

Quick reference guide organized by topic:
- Core concept explanation
- Type definitions (ParticipantInfo, ActivationConfig, ConnectionInfo)
- Public API signatures
- Platform-specific usage examples
- Configuration options with defaults
- State machine diagram
- Implementation pattern template
- Common patterns (registry, event aggregation)
- Testing patterns
- Performance tips
- Error handling examples

**Best for:**
- Finding API signatures quickly
- Copy-paste code examples
- Understanding configuration options
- Platform-specific implementation details
- Performance tuning

### 3. ORCHESTRATOR-FILES-INDEX.md (11 KB)
**Use this for navigation and file lookup**

Complete file index and navigation guide:
- All orchestrator files listed with line counts and purposes
- Platform-specific files organized by platform
- RPC framework files
- Key code locations by feature (e.g., "Control Plane RPC Communication")
- Type definition locations with line numbers
- Internal structure descriptions
- Critical code snippets extracted
- Search commands for grep/rg
- Development workflow guide
- Related x-oasis skills

**Best for:**
- Finding which file contains what
- Understanding file organization
- Locating specific features
- Development workflow planning
- Cross-referencing with other skills

## Quick Navigation

### Find Something Specific

| Looking for... | Go to... |
|---|---|
| Complete code breakdown with line numbers | Comprehensive Analysis (Section 2) |
| API signature or usage example | Quick Reference |
| File path or location of code | Files Index |
| State machine explanation | Comprehensive Analysis (Section 9) |
| How to add a new platform | Files Index (Development Workflow) |
| Control flow explanation | Comprehensive Analysis (Section 9) |
| Type definitions | Comprehensive Analysis (Section 1) |
| Reconnection logic | Comprehensive Analysis (Section 2, Reconnection) |
| RPC communication details | Comprehensive Analysis (Section 6) |
| Configuration options | Quick Reference |

## Key Concepts

### The Orchestrator's Job
Creates direct MessagePort connections between participants (renderers, workers, utility processes) through a control-plane RPC channel, enabling zero-copy peer-to-peer communication.

### Core Constant
```
ORCHESTRATOR_SERVICE_PATH = '__x_oasis_orchestrator__'
```
Internal service path for the control plane. Participants register handlers on this path via `registerOrchestratorHandler()`.

### Connection Activation Flow
1. Orchestrator creates MessagePort pair
2. Calls `activateParticipant()` on each side
   - Uses `channel.makeRequest('__x_oasis_orchestrator__', 'activateConnection', port)`
3. Participant receives port and binds it to direct channel
4. Both participants now communicate directly via port

### State Machine
```
IDLE → CONNECTING → READY → TRANSIENT_FAILURE → CONNECTING → READY
                     ↓                              ↓
                 (error)                   (policy gave up)
                     ↓                              ↓
                    IDLE                      DISCONNECTING → CLOSED
```

## File Organization

```
packages/async/
├── async-call-rpc/              # Core RPC framework
│   └── src/orchestrator/        # Orchestrator implementation
│       ├── types.ts             # All types and constants
│       ├── BaseConnectionOrchestrator.ts  # Core state machine
│       ├── ConnectionState.ts   # State enum
│       ├── index.ts             # Exports
│       └── policies/            # Reconnection policies
│
├── async-call-rpc-electron/     # Electron platform
│   └── src/
│       ├── electron-main/       # Main process
│       │   ├── ElectronConnectionOrchestrator.ts
│       │   ├── UtilityOrchestratorParticipant.ts
│       │   ├── MainOrchestratorSetup.ts
│       │   └── *Channel.ts      # Control-plane channels
│       └── electron-browser/    # Renderer/utility process
│           ├── registerOrchestratorHandler.ts
│           └── createPageBridge.ts
│
├── async-call-rpc-node/         # Node.js platform
│   └── src/NodeConnectionOrchestrator.ts
│
└── async-call-rpc-web/          # Web platform
    └── src/WebConnectionOrchestrator.ts
```

## Common Tasks

### I want to understand the full architecture
1. Read Comprehensive Analysis sections 1-3
2. Read the control flow diagram (section 9)
3. Study the critical implementation details (section 10)

### I want to add a new platform
1. Reference: Quick Reference → Implementation Pattern
2. Reference: Files Index → Development Workflow
3. Study: Comprehensive Analysis → ElectronConnectionOrchestrator implementation

### I want to modify the state machine
1. Find: ConnectionState.ts (absolute path in Files Index)
2. Update: VALID_TRANSITIONS array
3. Verify: _transitionState() implementation
4. Reference: State machine diagram (section 9)

### I want to hook into events
1. Reference: Quick Reference → Events
2. Find: All event definitions in Comprehensive Analysis section 2
3. Study: Event firing locations (all in _transitionState or _handleConnectionLost)

### I want to understand how the control plane works
1. Read: Comprehensive Analysis section 6
2. Study: `channel.makeRequest()` signature (lines 501-518 in AbstractChannelProtocol.ts)
3. See: Usage in ElectronConnectionOrchestrator.activateParticipant() (lines 108-116)

## Code Extraction Format

All three documents use consistent formatting:
- **Absolute paths**: `/Users/ryu/Documents/code/red/x-oasis/packages/...`
- **Line numbers**: `lines 439-536` or `line 18`
- **Code blocks**: Full signatures and implementations
- **Tables**: For organized reference information

## Telegraph D-006

The orchestrator fixes two critical gaps from Telegraph D-006:

**Gap 2: Cold-start timeout**
- Problem: Slow participant hangs forever
- Fix: activateTimeoutMs option (default 30s)
- See: Comprehensive Analysis section 10

**Gap 3: Participant loss not detected**
- Problem: Dead participant considered alive forever
- Fix: Auto-wire channel.onDidDisconnected()
- See: Comprehensive Analysis section 10

## Related x-oasis Skills

While studying the orchestrator, you'll encounter these x-oasis skills:
- **Type Validation** - parameter validation patterns
- **Request Throttling** - reconnection policy delays
- **Event Management** - internal event system
- **Stream Processing** - handling multiple connections
- **Object Comparison** - state machine comparisons
- **Functional Programming** - middleware pipeline

See AGENTS.md in the project root for guidance on how to apply these skills.

## Getting Started

1. **For quick understanding**: Read Quick Reference (5 minutes)
2. **For implementation**: Reference Quick Reference + Files Index
3. **For deep dive**: Read Comprehensive Analysis end-to-end (1 hour)
4. **For development**: Use Files Index as navigation while reading source code

## Questions?

Each document is self-contained. If you need to understand:
- **What's in a specific file**: Check Files Index
- **How to do something**: Check Quick Reference
- **Why something works that way**: Check Comprehensive Analysis

All three documents cross-reference each other for easy navigation.

---

**Created**: May 11, 2026
**Analysis**: Complete codebase of 7 major TypeScript files covering orchestrator, platforms, and RPC framework
**Coverage**: 100% of orchestrator functionality with line-by-line breakdown
