export { default as NodeProcessChannel } from './NodeProcessChannel';
export type { NodeProcessChannelProps } from './NodeProcessChannel';

// MessagePort channel (worker_threads)
export { NodeMessagePortChannel } from './NodeMessagePortChannel';
export type { NodeMessagePortChannelProps } from './NodeMessagePortChannel';

// Orchestrator
export {
  NodeConnectionOrchestrator,
  registerOrchestratorHandler,
} from './NodeConnectionOrchestrator';
