import { ipcMain } from 'electron';
import { IPCMainChannelProtocolProps } from '../types';
import {
  serialize,
  deserialize,
  handleRequest,
  handleResponse,
  preparePortData,
  updateSeqInfo,
  sendRequest,
  handleDisconnectedRequest,
  normalizeIPCChannelRawMessage,
} from './middlewares';
import AbstractChannelProtocol from './AbstractChannelProtocol';
import { Channel } from './Channel';

export default class IPCMainChannelProtocol extends AbstractChannelProtocol {
  private channelName: string;

  constructor(props: IPCMainChannelProtocolProps) {
    super(props);
    const {
      channelName,
      webContents,
      clientMiddlewares = [],
      senderMiddlewares = [],
    } = props;
    this.channelName = channelName;
    this.channel = new Channel({
      send: (...args: any[]) =>
        webContents.postMessage(this.channelName, ...args),
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
        handleRequest,
        handleResponse
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
