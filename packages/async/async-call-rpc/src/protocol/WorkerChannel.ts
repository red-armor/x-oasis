import AbstractChannelProtocol from './AbstractChannelProtocol';

export default class WorkerChannel extends AbstractChannelProtocol {
  // constructor(options: {
  //   worker: Worker;
  // }) {
  //   super();
  //   const { worker } = options;
  //   this.worker = worker;
  // }

  // on(listener: (event: MessageEvent) => void) {
  //   this.worker.onmessage = listener;
  // }

  // send(message: any) {
  //   this.worker.postMessage(message);
  // }

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
    console.log('[WorkerChannel] constructor', this.worker);
  }

  on(listener: (data: unknown) => void): void | (() => void) {
    const f = (ev: MessageEvent): void => {
      console.log('on message', this.name, ev);
      console.log('on message', this.name, ev.data);
      listener(ev);
    };
    console.log('[WorkerChannel] on', this.worker);
    this.worker.addEventListener('message', f);

    return () => this.worker.removeEventListener('message', f);
  }
  send(data: unknown): void {
    console.log('send data', data);
    this.worker.postMessage(data);
  }
}
