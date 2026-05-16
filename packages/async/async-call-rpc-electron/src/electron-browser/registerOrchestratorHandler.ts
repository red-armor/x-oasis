import {
  AbstractChannelProtocol,
  ORCHESTRATOR_SERVICE_PATH,
  RPCService,
  ActivationContext,
} from '@x-oasis/async-call-rpc/core';
import { ActivationConnectionContext } from '../types';

/**
 * Register a handler on `channel` that receives the direct `MessagePort`
 * delivered by the orchestrator when `connect()` is called.
 *
 * This is the **only** thing participants need to do to integrate with the
 * orchestrator — no magic strings, no raw IPC listeners.
 *
 * ## Why this lives in `electron-browser/`
 *
 * Despite the name, this helper is consumed by *participants* (renderer
 * processes and utility processes), not by the orchestrator (main process)
 * itself. It contains zero `electron`-runtime imports — only the
 * transport-agnostic `RPCService` from `@x-oasis/async-call-rpc`. Putting
 * it in the `electron-browser` sub-path keeps the main-process barrel
 * (`electron-main/index.ts`) free of code that renderers need too. Renderer
 * bundles can import only `@x-oasis/async-call-rpc-electron/electron-browser`
 * and never pick up `ipcMain`, `MessageChannelMain`, `utilityProcess`, etc.
 *
 * ```ts
 * // Legacy: receives raw port only
 * registerOrchestratorHandler(ipcChannel, (port) => {
 *   directChannel.bindPort(port);
 * });
 *
 * // New: receives ActivationContext with peer identity
 * registerOrchestratorHandler(ipcChannel, (ctx) => {
 *   const { port, connectionId, role } = ctx;
 *   const peerId = role === 'initiator'
 *     ? connectionId.split('--')[1]
 *     : connectionId.split('--')[0];
 *   getChannelFor(peerId).bindPort(port, { rebind: true });
 * });
 * ```
 *
 * @param channel  The control-plane channel already connected to main.
 * @param onPort   Called with either the raw `MessagePort` (legacy) or an
 *                 `ActivationContext` object (new) once the orchestrator
 *                 activates this participant. The callback signature is
 *                 inferred: if it declares exactly one parameter whose type
 *                 is `ActivationContext`, the context form is used; otherwise
 *                 the raw port is passed for backward compatibility.
 */
export function registerOrchestratorHandler(
  channel: AbstractChannelProtocol,
  onPort: ((ctx: ActivationContext) => void) | ((port: MessagePort) => void)
): void {
  let lastContext: ActivationConnectionContext | null = null;

  const pendingContexts = new Map<string, ActivationConnectionContext>();

  const contextQueue: ActivationConnectionContext[] = [];

  const service = new RPCService(ORCHESTRATOR_SERVICE_PATH, {
    handlers: {
      activateConnection: (port: MessagePort, connectionId?: string) => {
        let ctx: ActivationConnectionContext | null = null;

        if (connectionId) {
          ctx = pendingContexts.get(connectionId) ?? null;
          pendingContexts.delete(connectionId);
          const qIdx = contextQueue.findIndex(
            (c) => c.connectionId === connectionId
          );
          if (qIdx !== -1) contextQueue.splice(qIdx, 1);
        } else if (contextQueue.length > 0) {
          ctx = contextQueue.shift()!;
          pendingContexts.delete(ctx.connectionId);
        } else {
          ctx = lastContext;
          lastContext = null;
        }

        if (ctx) {
          (onPort as (ctx: ActivationContext) => void)({
            port,
            connectionId: ctx.connectionId,
            role: ctx.role,
          } as ActivationContext);
        } else {
          (onPort as (port: MessagePort) => void)(port);
        }
      },
      activateConnectionContext: (ctx: ActivationConnectionContext) => {
        pendingContexts.set(ctx.connectionId, ctx);
        contextQueue.push(ctx);
        lastContext = ctx;
      },
      ping: () => 'pong',
    },
  });
  service.setChannel(channel);
}
