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
  PendingSendEntry,
  AbstractChannelProtocolProps,
} from '../types';
import { runMiddlewares, sendRequest } from '../middlewares';
import ReadBaseBuffer from '../buffer/ReadBaseBuffer';
import WriteBaseBuffer from '../buffer/WriteBaseBuffer';
import { BufferFactory } from '../buffer/BufferFactory';
import { SerializationFormat } from '../buffer/SerializationFormat';
import { resumeMiddlewares } from '../middlewares/utils';

import { deserialize, serialize } from '../middlewares/buffer';
import { handleResponse } from '../middlewares/handleResponse';
import RPCService from '../endpoint/RPCService';
import { prepareNormalData } from '../middlewares/prepareRequestData';
import { updateSeqInfo } from '../middlewares/updateSeqInfo';
import { normalizeMessageChannelRawMessage } from '../middlewares/normalize';
import { handleRequest } from '../middlewares/handleRequest';

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
    normalizeMessageChannelRawMessage,
    deserialize,
    handleRequest,
    handleResponse,
  ];

  private _senderMiddleware: SenderMiddleware[] = [
    prepareNormalData,
    updateSeqInfo,
    serialize,
    sendRequest,
  ];

  private _readBuffer: ReadBaseBuffer | null = null;

  private _writeBuffer: WriteBaseBuffer | null = null;

  private _serializationFormat: string;

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

  constructor(props?: AbstractChannelProtocolProps) {
    super();
    const {
      description,
      masterProcessName,
      connected = true,
      serializationFormat = SerializationFormat.JSON,
      readBuffer,
      writeBuffer,
    } = props || {};

    this._description = description;
    this._isConnected = connected;
    this._masterProcessName = masterProcessName;
    this._serializationFormat = serializationFormat;

    // 如果提供了自定义 buffer，直接使用
    if (readBuffer) {
      this._readBuffer = readBuffer;
    }
    if (writeBuffer) {
      this._writeBuffer = writeBuffer;
    }

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
   * Get or create read buffer instance
   * Uses lazy initialization with caching for performance
   *
   * Priority:
   * 1. Custom buffer provided in constructor
   * 2. Cached instance
   * 3. Create new instance using BufferFactory with configured format
   *
   * Subclasses can override this method to provide custom buffer logic
   */
  get readBuffer(): ReadBaseBuffer {
    if (this._readBuffer) {
      return this._readBuffer;
    }

    // Try to create using BufferFactory
    try {
      this._readBuffer = BufferFactory.createReadBuffer(
        this._serializationFormat
      );
    } catch (error) {
      // Fallback to JSON if configured format is not available
      console.warn(
        `[AbstractChannelProtocol] Failed to create read buffer with format "${this._serializationFormat}", falling back to JSON.`,
        error
      );
      this._readBuffer = BufferFactory.createReadBuffer(
        SerializationFormat.JSON
      );
    }

    return this._readBuffer;
  }

  /**
   * Get or create write buffer instance
   * Uses lazy initialization with caching for performance
   *
   * Priority:
   * 1. Custom buffer provided in constructor
   * 2. Cached instance
   * 3. Create new instance using BufferFactory with configured format
   *
   * Subclasses can override this method to provide custom buffer logic
   */
  get writeBuffer(): WriteBaseBuffer {
    if (this._writeBuffer) {
      return this._writeBuffer;
    }

    // Try to create using BufferFactory
    try {
      this._writeBuffer = BufferFactory.createWriteBuffer(
        this._serializationFormat
      );
    } catch (error) {
      // Fallback to JSON if configured format is not available
      console.warn(
        `[AbstractChannelProtocol] Failed to create write buffer with format "${this._serializationFormat}", falling back to JSON.`,
        error
      );
      this._writeBuffer = BufferFactory.createWriteBuffer(
        SerializationFormat.JSON
      );
    }

    return this._writeBuffer;
  }

  /**
   * Get the configured serialization format
   */
  get serializationFormat(): string {
    return this._serializationFormat;
  }

  /**
   * Set serialization format (will recreate buffers on next access)
   * Note: This will clear cached buffers, new instances will be created on next access
   */
  setSerializationFormat(format: string): void {
    if (this._serializationFormat !== format) {
      this._serializationFormat = format;
      // Clear cached buffers to force recreation with new format
      this._readBuffer = null;
      this._writeBuffer = null;
    }
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

  /**
   *
   * @param middlewares
   * @returns
   *
   * 增加自定义的middleware，需要重写这个方法
   */
  decorateSendMiddleware(middlewares: SenderMiddleware[]) {
    return middlewares;
  }

  decorateOnMessageMiddleware(middlewares: ClientMiddleware[]) {
    return middlewares;
  }

  applyOnMessageMiddleware(fns: Function | Function[]) {
    const copy = [].concat(fns);
    this._onMessageMiddleware = [];
    copy.forEach((fn) => {
      if (typeof fn === 'function') {
        this._onMessageMiddleware.push(fn(this));
      }
    });
  }

  applySendMiddleware(fns: Function | Function[]) {
    const copy = [].concat(fns);
    this._senderMiddleware = [];

    copy.forEach((fn) => {
      if (typeof fn === 'function') {
        this._senderMiddleware.push(fn(this));
      }
    });
  }

  isConnected() {
    return this._isConnected;
  }

  send(..._args: any[]) {
    throw new Error('send method is not implemented');
  }

  on(..._args: any[]) {
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

  connect() {
    this.onDidConnectedEvent.fire();
  }

  // 已经绑定了channel，这个时候需要直接触发
  activate() {
    this._isConnected = true;
    this.onDidConnectedEvent.fire();
  }

  disconnect() {
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
    //
    const { returnValue } = runMiddlewares(this.senderMiddleware, args);
    if (returnValue) return returnValue;
  }

  sendReply(...args: any[]) {
    this.send(...args);
  }

  onMessage(...args: any[]) {
    runMiddlewares(this._onMessageMiddleware, args);
  }
}

export default AbstractChannelProtocol;
