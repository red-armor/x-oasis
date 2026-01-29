import { ipcMain } from 'electron';
import { IPCMainGlobalChannelProtocolProps } from '../types';
import {
  serialize,
  deserialize,
  preparePortData,
  updateSeqInfo,
  handlePortRequest,
  sendRequest,
  handleDisconnectedRequest,
  normalizeIPCChannelRawMessage,
} from './middlewares';
import AbstractChannelProtocol from './AbstractChannelProtocol';
import { Channel } from './Channel';

/**
 * mainly send through sender to renderer
 */
export default class IPCMainGlobalChannelProtocol extends AbstractChannelProtocol {
  private channelName: string;

  constructor(props: IPCMainGlobalChannelProtocolProps) {
    super(props);
    const {
      clientMiddlewares = [],
      senderMiddlewares = [],
      channelName,
    } = props;
    this.channelName = channelName;
    this.channel = new Channel({
      send: () => {
        // do nothing...
      },
      initListener: (emitter) => {
        emitter.register(this.channelName);
        ipcMain.on(this.channelName, (...args: any[]) => {
          this.onMessage(...args);
          emitter.getEvent(this.channelName).fire(...args);
        });
      },
    });
    this.applyOnMessageMiddleware(
      [].concat(
        normalizeIPCChannelRawMessage,
        deserialize,
        clientMiddlewares,
        handlePortRequest
      )
    );
    this.applySendMiddleware(
      [].concat(
        preparePortData,
        updateSeqInfo,
        handleDisconnectedRequest,
        serialize,
        senderMiddlewares,
        sendRequest
      )
    );
  }

  disconnect() {
    this.dispose();
    super.disconnect();
  }
}
