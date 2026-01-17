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

export default class ProcessClientChannelProtocol extends AbstractChannelProtocol {
  private readonly port: MainPort;

  constructor(props: MessageChannelProtocolProps) {
    super(props);
    const { clientMiddlewares, senderMiddlewares, port } = props;
    this.port = port;
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

    this.channel = new Channel({
      send: (...args) => this.port.postMessage(...args),
      initListener: (emitter) => {
        emitter.register('message');
        this.port.on('message', (...args: any[]) => {
          this.onMessage(...args);
          emitter.getEvent('message').fire(...args);
        });
      },
    });
  }

  disconnect() {
    this.dispose();
    super.disconnect();
  }
}
