import { UtilityProcess } from 'electron';

import AbstractChannelProtocol from './AbstractChannelProtocol';
import { ProcessChannelProtocolProps } from '../types';
import {
  serialize,
  deserialize,
  handleRequest,
  handleResponse,
  updateSeqInfo,
  sendRequest,
  prepareHostPortData,
  processClientRawMessage,
  handleDisconnectedRequest,
} from './middlewares';
import { Channel } from './Channel';

export default class ProcessChannelProtocol extends AbstractChannelProtocol {
  private readonly process: UtilityProcess;

  constructor(props: ProcessChannelProtocolProps) {
    super(props);
    const { clientMiddlewares, senderMiddlewares, process } = props;
    this.process = process;

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
    this.applyOnMessageMiddleware(
      [].concat(
        processClientRawMessage,
        deserialize,
        clientMiddlewares,
        handleRequest,
        handleResponse
      )
    );

    this.channel = new Channel({
      send: (...args) => this.process.postMessage(...args),
      initListener: (emitter) => {
        this.process.on('message', (...args: any[]) => {
          this.onMessage(...args);
        });
      },
    });
  }

  disconnect() {
    this.dispose();
    super.disconnect();
  }
}
