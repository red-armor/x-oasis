import {
  AbstractChannelProtocol,
  AbstractChannelProtocolProps,
} from '@x-oasis/async-call-rpc';

/**
 * RPC channel protocol for Web Workers.
 *
 * Wraps a `Worker` instance for bidirectional RPC communication
 * between the main thread and a web worker.
 *
 * @example
 * ```ts
 * // Main thread
 * const worker = new Worker('./worker.js');
 * const channel = new WorkerChannel(worker, { name: 'my-worker' });
 * ```
 *
 * @example
 * ```ts
 * // Inside the worker (worker.js)
 * const channel = new WorkerChannel(self, { name: 'worker-self' });
 * ```
 */
export default class WorkerChannel extends AbstractChannelProtocol {
  private worker: any;
  readonly name: string;

  /**
   * @param worker Pass the Worker in the main thread, or `self` inside the worker.
   * @param options Configuration options including serialization format
   */
  constructor(
    worker: any,
    options?: {
      name?: string;
    } & AbstractChannelProtocolProps
  ) {
    // Extract Worker-specific options and pass the rest to parent
    const { name, ...protocolOptions } = options || {};
    super(protocolOptions);
    this.worker = worker;
    this.name = name || 'worker';
  }

  on(listener: (data: unknown) => void): void | (() => void) {
    const f = (ev: MessageEvent): void => {
      listener(ev);
    };
    this.worker.addEventListener('message', f);
    return () => this.worker.removeEventListener('message', f);
  }

  send(data: unknown): void {
    this.worker.postMessage(data);
  }
}
