import { Disposable } from '@x-oasis/disposable';
import { Event } from '@x-oasis/emitter';
import { Deferred } from '@x-oasis/deferred';
import { generateRandomKey } from '@x-oasis/id';

import {
  SendingProps,
  IMessageChannel,
  ClientMiddleware,
  SenderMiddleware,
  RequestRawSequenceId,
  AbstractChannelProtocolProps,
  PendingSendEntry,
} from '../types';
import { runMiddlewares } from '../middlewares';
import ReadBuffer from '../buffer/ReadBuffer';
import WriteBuffer from '../buffer/WriteBuffer';
import ReadBaseBuffer from '../buffer/ReadBaseBuffer';
import WriteBaseBuffer from '../buffer/WriteBaseBuffer';
import { resumeMiddlewares } from '../middlewares/utils';

import { deserialize, serialize } from '../middlewares/buffer';
import { handleResponse } from '../middlewares/handleResponse';
import { handleRequest } from '../middlewares/handleRequest';
import RPCService from '../endpoint/RPCService';

abstract class AbstractChannelProtocol
  extends Disposable
  implements IMessageChannel
{
  private readonly _masterProcessName: string;

  private _key: string;

  private _service: RPCService;

  private readonly _description: string;

  private _seqId: RequestRawSequenceId = -1;

  // decoder should comes first !!!!
  protected _onMessageMiddleware: ClientMiddleware[] = [
    deserialize,
    handleResponse,
  ];

  private _senderMiddleware: SenderMiddleware[] = [serialize, handleRequest];

  private _readBuffer: ReadBaseBuffer;

  private _writeBuffer: WriteBaseBuffer;

  private _isConnected = true;

  /**
   * 如果说channel存在的话，那么就是ongoing request
   */
  public ongoingRequests: Map<string, Deferred> = new Map();

  /**
   * 如果说channel不存在，那么请求就会暂时放到这个里面
   */
  public pendingSendEntries = new Set<PendingSendEntry>();

  public requestEvents: Map<string, any> = new Map();

  private onDidConnectedEvent = new Event({ name: 'on-did-connected' });

  onDidConnected = this.onDidConnectedEvent.subscribe;

  private onDidDisconnectedEvent = new Event({ name: 'on-did-disconnect' });

  onDidDisconnected = this.onDidDisconnectedEvent.subscribe;

  constructor(props: AbstractChannelProtocolProps) {
    super();
    const { description, masterProcessName, connected = true } = props;
    this._description = description;
    this._isConnected = connected;
    this._masterProcessName = masterProcessName;
    // 需要创建，否则创建'message'监听时，会出现混乱
    this._key = generateRandomKey();
    this.registerDisposable(this.onDidConnected(this.didConnected.bind(this)));

    this._onMessageMiddleware = this.decorateOnMessageMiddleware(
      this._onMessageMiddleware
    );
    this._senderMiddleware = this.decorateSendMiddleware(
      this._senderMiddleware
    );

    this.applyOnMessageMiddleware(this._onMessageMiddleware);
    this.applySendMiddleware(this._senderMiddleware);
    this.on(this.onMessage.bind(this));
  }

  get service() {
    return this._service;
  }

  setService(service: RPCService) {
    this._service = service;
  }

  get senderMiddleware() {
    return this._senderMiddleware;
  }

  /**
   * 如果已经存在，那么直接返回；否则创建一个；假如说继承了AbstractChannelProtocol，那么需要重写这个方法
   */
  get readBuffer() {
    if (this._readBuffer) return this._readBuffer;
    this._readBuffer = new ReadBuffer();
    return this._readBuffer;
  }

  get writeBuffer() {
    if (this._writeBuffer) return this._writeBuffer;
    this._writeBuffer = new WriteBuffer();
    return this._writeBuffer;
  }

  // start from 1
  get seqId() {
    this._seqId += 1;
    return `${this._key}_${this._seqId}`;
  }

  get description() {
    return this._description;
  }

  get masterProcessName() {
    return this._masterProcessName;
  }

  addPendingSendEntry(entry: PendingSendEntry) {
    this.pendingSendEntries.add(entry);
  }

  decorateSendMiddleware(middlewares: SenderMiddleware[]) {
    return middlewares;
  }

  decorateOnMessageMiddleware(middlewares: ClientMiddleware[]) {
    return middlewares;
  }

  applyOnMessageMiddleware(fns: Function | Function[]) {
    [].concat(fns).forEach((fn) => {
      if (typeof fn === 'function') {
        this._onMessageMiddleware.push(fn(this));
      }
    });
  }

  applySendMiddleware(fns: Function | Function[]) {
    [].concat(fns).forEach((fn) => {
      if (typeof fn === 'function') {
        this._senderMiddleware.push(fn(this));
      }
    });
  }

  isConnected() {
    return this._isConnected;
  }

  send(...args: any[]) {
    throw new Error('send method is not implemented');
  }

  on(...args: any[]) {
    throw new Error('onMessage method is not implemented');
  }

  resumePendingEntry() {
    this.pendingSendEntries.forEach((entry) => {
      this.pendingSendEntries.delete(entry);
      resumeMiddlewares(this.senderMiddleware, entry);
    });
  }

  didConnected() {
    this.resumePendingEntry();
  }

  // protected bindChannel(channel: Channel) {
  //   this.channel = channel;
  // }

  connect() {
    // this.channel = channel;
    this.onDidConnectedEvent.fire();
  }

  // 已经绑定了channel，这个时候需要直接触发
  activate() {
    this._isConnected = true;
    this.onDidConnectedEvent.fire();
  }

  disconnect() {
    // this.channel = null;
    this._isConnected = false;
    this.onDidDisconnectedEvent.fire();
  }

  makeRequest(props: SendingProps, transfer?: MessagePort[]): Deferred | void;

  makeRequest(
    requestPath: string,
    fnName: string,
    ...args: any[]
  ): Deferred | void;

  makeRequest(...args: any[]) {
    const { returnValue } = runMiddlewares(this.senderMiddleware, args);
    if (returnValue) return returnValue;
    this.send(args);
  }

  // sendReply(...args: any[]) {
  //   // TODO: this.channel may be null when disconnect
  //   this.channel?.send(...args);
  // }

  onMessage(...args: any[]) {
    runMiddlewares(this._onMessageMiddleware, args);
  }

  runWithMiddlewares(middlewares: ClientMiddleware[], ...args: any[]) {
    runMiddlewares(
      // @ts-ignore
      middlewares.map((m) => m(this)),
      args
    );
  }
}

export default AbstractChannelProtocol;
