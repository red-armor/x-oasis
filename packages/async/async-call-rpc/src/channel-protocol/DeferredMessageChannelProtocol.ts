import AbstractChannelProtocol from './AbstractChannelProtocol';
import { MainPort, DeferredMessageChannelProtocolProps } from '../types';
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

/**
 * Basically it is the same with `MessageChannelProtocol`, but for this function
 * `port` is not required on initlization.
 */
export default class DeferredMessageChannelProtocol extends AbstractChannelProtocol {
  private port: MainPort;

  constructor(props: DeferredMessageChannelProtocolProps) {
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
        emitter.register('message');
        this.port.on('message', (...args: any[]) => {
          this.onMessage(...args);
          emitter.getEvent('message').fire(...args);
        });
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
