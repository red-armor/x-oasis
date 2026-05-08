import {
  AbstractChannelProtocol,
  ORCHESTRATOR_SERVICE_PATH,
  RPCService,
} from '@x-oasis/async-call-rpc';

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
 * // renderer preload.ts
 * registerOrchestratorHandler(ipcChannel, (port) => {
 *   directChannel.bindPort(port);
 * });
 *
 * // utility-worker.ts
 * registerOrchestratorHandler(mainChannel, (port) => {
 *   directChannel.bindPort(port);
 * });
 * ```
 *
 * @param channel  The control-plane channel already connected to main.
 * @param onPort   Called with the transferred `MessagePort` once the
 *                 orchestrator activates this participant.
 */
export function registerOrchestratorHandler(
  channel: AbstractChannelProtocol,
  onPort: (port: any) => void
): void {
  const service = new RPCService(ORCHESTRATOR_SERVICE_PATH, {
    handlers: {
      activateConnection: onPort,
    },
  });
  service.setChannel(channel);
}
