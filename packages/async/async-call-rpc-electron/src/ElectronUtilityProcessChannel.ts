import { AbstractChannelProtocol } from '@x-oasis/async-call-rpc';
import {
  UtilityProcessChannelProps,
  UtilityProcessParentPortChannelProps,
  ParentPort,
  UtilityProcess,
} from './types';

/**
 * RPC channel protocol for Electron's `utilityProcess`.
 *
 * Electron's `utilityProcess.fork()` creates a process with a
 * `MessagePort`-like IPC channel. This class adapts both sides:
 *
 * - **Main process side**: wraps the `UtilityProcess` instance
 *   returned by `utilityProcess.fork()`.
 * - **Utility process side**: wraps `process.parentPort`.
 *
 * ## Usage
 *
 * **Main process:**
 * ```ts
 * import { utilityProcess } from 'electron';
 * import { ElectronUtilityProcessChannel } from '@x-oasis/async-call-rpc-electron';
 *
 * const child = utilityProcess.fork('./utility.js');
 * const channel = new ElectronUtilityProcessChannel({
 *   process: child,
 *   description: 'main→utility',
 * });
 * ```
 *
 * **Utility process (`utility.js`):**
 * ```ts
 * import { ElectronUtilityProcessChannel } from '@x-oasis/async-call-rpc-electron';
 *
 * const channel = new ElectronUtilityProcessChannel({
 *   parentPort: process.parentPort,
 *   description: 'utility→main',
 * });
 * ```
 *
 * @remarks
 * - The `UtilityProcess` API is only available in the main process.
 * - `parentPort` is only available inside a utility process.
 * - Auto-disconnects when the utility process exits (main side).
 *
 * @see https://www.electronjs.org/docs/latest/api/utility-process
 */
export default class ElectronUtilityProcessChannel extends AbstractChannelProtocol {
  private _target: UtilityProcess | ParentPort;

  constructor(
    props: UtilityProcessChannelProps | UtilityProcessParentPortChannelProps
  ) {
    const { ...rest } = props;

    let target: UtilityProcess | ParentPort;
    if ('process' in props) {
      target = props.process;
      delete (rest as any).process;
    } else {
      target = (props as UtilityProcessParentPortChannelProps).parentPort;
      delete (rest as any).parentPort;
    }

    super(rest);
    this._target = target;

    // Auto-disconnect when the utility process exits (main side only)
    if (this.isUtilityProcess(this._target)) {
      this._target.on('exit', () => {
        this.disconnect();
      });
    }
  }

  on(listener: (data: unknown) => void): void | (() => void) {
    const isMainSide = this.isUtilityProcess(this._target);

    // https://www.electronjs.org/docs/latest/api/utility-process#childpostmessagemessage-transfer
    const handler = (messageEventOrValue: MessageEvent | unknown): void => {
      if (isMainSide) {
        // Main process side: UtilityProcess.on('message', (value) => ...)
        // The callback receives the raw message value directly.
        listener({ data: messageEventOrValue });
      } else {
        // Utility process side: parentPort.on('message', (messageEvent) => ...)
        // The callback receives a MessageEvent with a .data property.
        listener(messageEventOrValue);
      }
    };

    this._target.on('message', handler);
    return () => {
      this._target.removeListener('message', handler);
    };
  }

  send(data: unknown, transfer?: any[]): void {
    if (typeof this._target.postMessage === 'function') {
      if (transfer && transfer.length) {
        (this._target.postMessage as (d: unknown, t?: any[]) => void)(
          data,
          transfer
        );
      } else {
        this._target.postMessage(data);
      }
    } else {
      console.warn(
        '[ElectronUtilityProcessChannel] Cannot send: postMessage is not available.'
      );
    }
  }

  disconnect(): void {
    if (this.isUtilityProcess(this._target)) {
      this._target.kill();
    }
    super.disconnect();
  }

  private isUtilityProcess(
    target: UtilityProcess | ParentPort
  ): target is UtilityProcess {
    return (
      'kill' in target && typeof (target as UtilityProcess).kill === 'function'
    );
  }
}
