import {
  AbstractChannelProtocol,
  AbstractChannelProtocolProps,
} from '@x-oasis/async-call-rpc';
import { ChildProcess } from 'child_process';

/**
 * Props for {@link NodeProcessChannel}.
 */
export type NodeProcessChannelProps = {
  /**
   * The child process instance (from `child_process.fork()`).
   *
   * - **Parent side**: pass the `ChildProcess` returned by `fork()`.
   * - **Child side**: pass `process` (the global `NodeJS.Process`).
   */
  process: ChildProcess | NodeJS.Process;
} & AbstractChannelProtocolProps;

/**
 * RPC channel protocol for Node.js `child_process.fork()` IPC.
 *
 * Uses the built-in IPC channel that `fork()` establishes between
 * parent and child processes (`process.send` / `process.on('message')`).
 *
 * ## Usage
 *
 * **Parent process:**
 * ```ts
 * import { fork } from 'child_process';
 * import { NodeProcessChannel } from '@x-oasis/async-call-rpc-node';
 *
 * const child = fork('./worker.js');
 * const channel = new NodeProcessChannel({
 *   process: child,
 *   description: 'parent→child',
 * });
 * ```
 *
 * **Child process (`worker.js`):**
 * ```ts
 * import { NodeProcessChannel } from '@x-oasis/async-call-rpc-node';
 *
 * const channel = new NodeProcessChannel({
 *   process,
 *   description: 'child→parent',
 * });
 * ```
 *
 * @remarks
 * - The IPC channel created by `fork()` uses structured clone
 *   serialization internally, so JSON serialization format is
 *   typically sufficient (and is the default).
 * - When the child process exits, the channel disconnects automatically.
 * - `send()` is a no-op if the IPC channel is already closed.
 */
export default class NodeProcessChannel extends AbstractChannelProtocol {
  private _process: ChildProcess | NodeJS.Process;

  constructor(props: NodeProcessChannelProps) {
    const { process: proc, ...protocolOptions } = props;
    super(protocolOptions);
    this._process = proc;

    // Listen for process exit to auto-disconnect
    if (this.isChildProcess(this._process)) {
      this._process.on('exit', () => {
        this.disconnect();
      });
    }
  }

  on(listener: (data: unknown) => void): void | (() => void) {
    const handler = (message: unknown): void => {
      // Wrap in a MessageEvent-like shape for normalize middleware
      listener({ data: message } as any);
    };

    this._process.on('message', handler);
    return () => {
      this._process.removeListener('message', handler);
    };
  }

  send(data: unknown): void {
    const proc = this._process as any;
    if (typeof proc.send === 'function') {
      proc.send(data);
    } else {
      console.warn(
        '[NodeProcessChannel] Cannot send: process.send is not available. ' +
          'Ensure the process was created with child_process.fork().'
      );
    }
  }

  disconnect(): void {
    if (this.isChildProcess(this._process)) {
      if (this._process.connected) {
        this._process.disconnect();
      }
    }
    super.disconnect();
  }

  /**
   * Type guard: is this a ChildProcess (parent side) or NodeJS.Process (child side)?
   */
  private isChildProcess(
    proc: ChildProcess | NodeJS.Process
  ): proc is ChildProcess {
    return 'kill' in proc && typeof (proc as ChildProcess).kill === 'function';
  }
}
