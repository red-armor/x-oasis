import AbstractChannelProtocol from './AbstractChannelProtocol';
import { MainPort, MessageChannelProtocolProps } from '../types';
import {
  serialize,
  deserialize,
  handleRequest,
  handleResponse,
  updateSeqInfo,
  sendRequest,
  prepareNormalData,
  handleDisconnectedRequest,
  normalizeMessageChannelRawMessage,
} from './middlewares';
import { Channel } from './Channel';

export default class IPCRendererMessageChannelProtocol extends AbstractChannelProtocol {
  private readonly port: MainPort;

  constructor(props: MessageChannelProtocolProps) {
    super({
      connected: false,
      ...props,
    });
    const { clientMiddlewares, senderMiddlewares, port } = props;

    this.applySendMiddleware(
      [].concat(
        prepareNormalData,
        updateSeqInfo,
        handleDisconnectedRequest,
        serialize,
        senderMiddlewares,
        sendRequest
      )
    );
    this.applyOnMessageMiddleware(
      [].concat(
        normalizeMessageChannelRawMessage,
        deserialize,
        clientMiddlewares,
        handleRequest,
        handleResponse
      )
    );
    if (port) this.bindPort(port);
  }

  bindPort(port: MainPort) {
    if (!port) return;
    if (this.port) {
      if (this.port === port) return;
      this.port.close();
    }

    this.port = port;

    const channel = new Channel({
      send: (...args) => {
        this.port.postMessage(...args);
      },
      initListener: (emitter) => {
        emitter.register('onmessage');
        this.port.onmessage = (...args: any[]) => {
          this.onMessage(...args);
          emitter.getEvent('onmessage').fire(...args);
        };
      },
    });
    this.port.start();

    this.bindChannel(channel);
  }

  disconnect() {
    this.dispose();
    this.port.close();
    super.disconnect();
  }
}
