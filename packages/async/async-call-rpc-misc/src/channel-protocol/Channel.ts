import { Emitter } from '@x-oasis/emitter';
import { Disposable, toDisposable } from '@x-oasis/disposable';

type ChannelSend = (...args: any[]) => void;
type ChannelInitListener = (emitter: Emitter) => void;

type ChannelProps = {
  send: ChannelSend;
  initListener: ChannelInitListener;
};

export class Channel extends Disposable {
  private _send: (...args: any[]) => void;

  emitter = new Emitter({ name: 'channel' });

  constructor(props: ChannelProps) {
    super();
    const { send, initListener } = props;
    this._send = send;
    initListener(this.emitter);

    this.registerDisposable(
      toDisposable(() => {
        this.emitter.dispose();
      })
    );
  }

  send(...args: any[]) {
    this._send(...args);
  }

  on(eventName: string, listener: Function) {
    this.emitter.getEvent(eventName).subscribe(listener);
  }
}
