import { AbstractChannelProtocol } from '@x-oasis/async-call-rpc/core';
import {
  UtilityProcessChannelProps,
  UtilityProcessParentPortChannelProps,
  ParentPort,
  UtilityProcess,
  MessagePortMain,
} from '../types';

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

  /**
   * When true, `disconnect()` will call `target.kill()` (main side only).
   * Set to false when you want to detach from the process without killing it,
   * e.g. when replacing the channel after a process respawn.
   */
  private _killOnDisconnect: boolean;

  constructor(
    props: UtilityProcessChannelProps | UtilityProcessParentPortChannelProps
  ) {
    const { ...rest } = props;

    let target: UtilityProcess | ParentPort;
    let killOnDisconnect = false;
    if ('process' in props) {
      target = props.process;
      killOnDisconnect = true;
      const { process: _, ...restWithoutProcess } =
        rest as UtilityProcessChannelProps;
      super(restWithoutProcess);
    } else {
      target = (props as UtilityProcessParentPortChannelProps).parentPort;
      const { parentPort: _, ...restWithoutParentPort } =
        rest as UtilityProcessParentPortChannelProps;
      super(restWithoutParentPort);
    }

    this._target = target;
    this._killOnDisconnect = killOnDisconnect;

    if (this.isUtilityProcess(this._target)) {
      this._target.on('exit', () => {
        this.disconnect();
      });
    }
  }

  /**
   * Set whether disconnect() should also kill the UtilityProcess.
   * Default: true on main side, false on parentPort side.
   * Set to false before calling disconnect() if you want to keep the
   * child process alive (e.g. channel replacement scenario).
   */
  setKillOnDisconnect(kill: boolean): void {
    this._killOnDisconnect = kill;
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

  send(data: unknown, transfer?: MessagePortMain[]): void {
    if (typeof this._target.postMessage === 'function') {
      if (transfer && transfer.length) {
        (
          this._target.postMessage as (
            d: unknown,
            t?: MessagePortMain[]
          ) => void
        )(data, transfer);
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
    if (this._killOnDisconnect && this.isUtilityProcess(this._target)) {
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
