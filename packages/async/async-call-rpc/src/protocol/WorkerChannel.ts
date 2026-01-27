import AbstractChannelProtocol from './AbstractChannelProtocol';
import { AbstractChannelProtocolProps } from '../types/channel';

export default class WorkerChannel extends AbstractChannelProtocol {
  private worker: any;
  readonly name: string;

  /**
   * @param worker Pass the Worker in the main thread.
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
