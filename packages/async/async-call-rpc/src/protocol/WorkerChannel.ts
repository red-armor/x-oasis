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

  /**
   * @param worker Pass the Worker in the main thread.
   */
  constructor(public worker: Worker = self as any) {
    super();
  }
  on(listener: (data: unknown) => void): void | (() => void) {
    const f = (ev: MessageEvent): void => listener(ev.data);
    this.worker.addEventListener('message', f);

    return () => this.worker.removeEventListener('message', f);
  }
  send(data: unknown): void {
    this.worker.postMessage(data);
  }
}
