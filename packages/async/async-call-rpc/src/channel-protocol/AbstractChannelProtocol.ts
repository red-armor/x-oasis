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
import { runMiddlewares } from './middlewares';
import RPCServiceHost from '../rpc-service/RPCServiceHost';
import { WriteBuffer, ReadBuffer } from '../buffer';
import { Channel } from './Channel';
import { resumeMiddlewares } from './middlewares/utils';

abstract class AbstractChannelProtocol
  extends Disposable
  implements IMessageChannel
{
  private readonly _masterProcessName: string;

  private _key: string;

  public channel: Channel;

  private _serviceHost: RPCServiceHost;

  private readonly _description: string;

  private _seqId: RequestRawSequenceId = -1;

  // decoder should comes first !!!!
  protected _onMessageMiddleware: ClientMiddleware[] = [];

  private _senderMiddleware: SenderMiddleware[] = [];

  private _readBuffer: ReadBuffer;

  private _writeBuffer: WriteBuffer;

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
    const {
      description,
      masterProcessName,
      serviceHost,
      connected = true,
    } = props;
    this._readBuffer = new ReadBuffer();
    this._writeBuffer = new WriteBuffer();
    this._description = description;
    this._serviceHost = serviceHost;
    this._isConnected = connected;
    this._masterProcessName = masterProcessName;
    // 需要创建，否则创建'message'监听时，会出现混乱
    this._key = generateRandomKey();
    this.registerDisposable(this.onDidConnected(this.didConnected.bind(this)));
  }

  get serviceHost() {
    return this._serviceHost;
  }

  setServiceHost(serviceHost: RPCServiceHost) {
    this._serviceHost = serviceHost;
  }

  get senderMiddleware() {
    return this._senderMiddleware;
  }

  get readBuffer() {
    return this._readBuffer;
  }

  get writeBuffer() {
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

  resumePendingEntry() {
    this.pendingSendEntries.forEach((entry) => {
      this.pendingSendEntries.delete(entry);
      resumeMiddlewares(this.senderMiddleware, entry);
    });
  }

  didConnected() {
    this.resumePendingEntry();
  }

  protected bindChannel(channel: Channel) {
    this.channel = channel;
  }

  connect(channel: Channel) {
    this.channel = channel;
    this.onDidConnectedEvent.fire();
  }

  // 已经绑定了channel，这个时候需要直接触发
  activate() {
    this._isConnected = true;
    this.onDidConnectedEvent.fire();
  }

  disconnect() {
    this.channel = null;
    this._isConnected = false;
    this.onDidDisconnectedEvent.fire();
  }

  send(props: SendingProps, transfer?: MessagePort[]): Deferred | void;

  send(requestPath: string, fnName: string, ...args: any[]): Deferred | void;

  send(...args: any[]) {
    const { returnValue } = runMiddlewares(this.senderMiddleware, args);
    if (returnValue) return returnValue;
  }

  sendReply(...args: any[]) {
    // TODO: this.channel may be null when disconnect
    this.channel?.send(...args);
  }

  onMessage(...args: any[]) {
    runMiddlewares(this._onMessageMiddleware, args);
  }

  runWithMiddlewares(middlewares: ClientMiddleware[], ...args: any[]) {
    runMiddlewares(
      middlewares.map((m) => m(this)),
      args
    );
  }
}

export default AbstractChannelProtocol;
