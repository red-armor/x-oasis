import AbstractChannelProtocol from './AbstractChannelProtocol';

export default class WorkerChannel extends AbstractChannelProtocol {
  private worker: any;
  readonly name: string;

  /**
   * @param worker Pass the Worker in the main thread.
   */
  constructor(
    worker: any,
    options?: {
      name?: string;
    }
  ) {
    super();
    this.worker = worker;
    this.name = options?.name || 'worker';
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
