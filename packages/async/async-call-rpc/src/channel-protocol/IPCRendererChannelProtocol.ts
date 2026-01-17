import { IPCRendererChannelProtocolProps } from '../types';
import {
  serialize,
  deserialize,
  handleRequest,
  handleResponse,
  updateSeqInfo,
  prepareHostPortData,
  sendRequest,
  handleDisconnectedRequest,
  normalizeIPCChannelRawMessage,
} from './middlewares';
import AbstractChannelProtocol from './AbstractChannelProtocol';
import { Channel } from './Channel';
import { fromDomEvent } from '@x-oasis/emitter';

class IPCRendererChannelProtocol extends AbstractChannelProtocol {
  private channelName: string;

  constructor(props: IPCRendererChannelProtocolProps) {
    super(props);
    this.projectName = props.projectName;
    const {
      channelName,
      clientMiddlewares = [],
      senderMiddlewares = [],
      ipcRenderer,
    } = props;
    this.channelName = channelName;
    this.applyOnMessageMiddleware(
      [].concat(
        normalizeIPCChannelRawMessage,
        deserialize,
        clientMiddlewares,
        handleRequest,
        handleResponse
      )
    );
    this.applySendMiddleware(
      [].concat(
        prepareHostPortData,
        updateSeqInfo,
        handleDisconnectedRequest,
        serialize,
        senderMiddlewares,
        sendRequest
      )
    );

    this.channel = new Channel({
      send: (...args) => ipcRenderer.send(this.channelName, ...args),
      initListener: (emitter) => {
        emitter.register(this.channelName);
        ipcRenderer.on(this.channelName, (...args: any[]) => {
          this.onMessage(...args);
          emitter.getEvent(this.channelName).fire(...args);
        });

        fromDomEvent(
          window,
          'message'
        )((event: MessageEvent) => {
          if (event.data?.channel === this.channelName) {
            this.runWithMiddlewares([deserialize, handleResponse], {
              event,
              ports: event.ports,
              data: event.data?.data,
            });
          }
        });
      },
    });
  }

  disconnect() {
    this.dispose();
    super.disconnect();
  }
}

export default IPCRendererChannelProtocol;
