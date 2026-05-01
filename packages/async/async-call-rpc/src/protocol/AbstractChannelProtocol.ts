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
  Unsubscribable,
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

/**
 * Context factory function, similar to tRPC's `createContext`.
 * Called for each incoming request, allowing injection of per-request data
 * (e.g. sender identity, auth info) into handlers.
 */
export type CreateContextFn<TContext = Record<string, unknown>> = (opts: {
  /** The raw message event (may be null for non-browser transports) */
  event: any;
  /** The request path (service path) */
  requestPath: string;
  /** The method being called */
  methodName: string;
}) => TContext | Promise<TContext>;

/**
 * Abstract base class for all RPC channel protocols.
 *
 * `AbstractChannelProtocol` provides the core framework for bidirectional
 * RPC communication over any transport layer. Subclasses only need to
 * implement two methods — {@link send} and {@link on} — to adapt a
 * specific transport (MessagePort, WebSocket, IPC, process, etc.).
 *
 * ## Architecture
 *
 * ```
 *  Caller                                              Callee
 *  ──────                                              ──────
 *  makeRequest(path, method, ...args)
 *       │
 *       ▼
 *  ┌─────────────────────────────────┐
 *  │  Sender Middleware Pipeline     │
 *  │  1. prepareNormalData           │  ← build request envelope
 *  │  2. updateSeqInfo               │  ← assign seqId
 *  │  3. serialize                   │  ← encode via WriteBuffer
 *  │  4. sendRequest                 │  ← call this.send()
 *  └─────────────────────────────────┘
 *       │                                    │
 *       │  ← transport (send/on) →           │
 *       │                                    ▼
 *                                  ┌─────────────────────────────────┐
 *                                  │  Receive Middleware Pipeline    │
 *                                  │  1. normalizeRawMessage        │  ← extract data
 *                                  │  2. deserialize                │  ← decode via ReadBuffer
 *                                  │  3. handleRequest              │  ← dispatch to service
 *                                  │  4. handleResponse             │  ← resolve Deferred
 *                                  └─────────────────────────────────┘
 * ```
 *
 * ## Subclass Contract
 *
 * Every concrete protocol **must** override:
 *
 * - **`send(data, transfer?)`** — Transmit serialized data over the transport.
 * - **`on(listener)`** — Register a listener for incoming messages and return
 *   a cleanup function (or `void`).
 *
 * Optionally override:
 *
 * - **`decorateSendMiddleware(middlewares)`** — Prepend/append custom sender
 *   middleware (e.g. compression, encryption).
 * - **`decorateOnMessageMiddleware(middlewares)`** — Swap or extend receive
 *   middleware (e.g. replace the normalizer for a different raw format).
 * - **`disconnect()`** — Perform transport-specific teardown (close socket,
 *   port, etc.) then call `super.disconnect()`.
 *
 * ## Built-in Transports
 *
 * | Class                         | Transport                              | Environment           |
 * |-------------------------------|----------------------------------------|-----------------------|
 * | `RPCMessageChannel`           | `MessagePort` (Web API)                | Browser / Worker      |
 * | `WebSocketChannel`            | `WebSocket`                            | Browser / Node.js     |
 * | `WorkerChannel`               | `Worker.postMessage`                   | Browser               |
 * | `NodeProcessChannel`          | `child_process.fork` IPC               | Node.js               |
 * | `ElectronUtilityProcessChannel` | Electron `UtilityProcess`            | Electron (main)       |
 * | `IPCMainChannel`              | Electron `ipcMain` / `WebContents`     | Electron (main)       |
 * | `IPCRendererChannel`          | Electron `ipcRenderer`                 | Electron (renderer)   |
 * | `ElectronMessagePortMainChannel` | Electron `MessagePortMain`          | Electron (main)       |
 *
 * ## Key Features
 *
 * - **Middleware pipeline** — Pluggable send/receive pipelines (similar to
 *   Express/Koa middleware).
 * - **Offline queueing** — Requests made while disconnected are queued in
 *   {@link pendingSendEntries} and automatically replayed on reconnection.
 * - **Subscription lifecycle** — Server-side subscriptions are tracked in
 *   {@link subscriptions} and cleaned up on disconnect.
 * - **Context injection** — Per-request context via {@link createContext},
 *   inspired by tRPC's `createContext`.
 * - **Serialization** — Configurable via `serializationFormat`; defaults to
 *   JSON with lazy-initialized {@link ReadBaseBuffer}/{@link WriteBaseBuffer}.
 *
 * @example
 * ```ts
 * // Implementing a custom transport
 * class MyCustomChannel extends AbstractChannelProtocol {
 *   constructor(private transport: MyTransport, opts?: AbstractChannelProtocolProps) {
 *     super(opts);
 *   }
 *
 *   send(data: unknown): void {
 *     this.transport.write(data);
 *   }
 *
 *   on(listener: (data: unknown) => void): () => void {
 *     this.transport.onData(listener);
 *     return () => this.transport.offData(listener);
 *   }
 * }
 * ```
 *
 * @see {@link RPCService} for registering service handlers
 * @see {@link SendingProps} for the request envelope shape
 * @see {@link CreateContextFn} for per-request context injection
 */
abstract class AbstractChannelProtocol
  extends Disposable
  implements IMessageChannel
{
  private readonly _masterProcessName: string;

  private _key: string;

  private _service: RPCService;

  readonly _description: string;

  private _seqId: RequestRawSequenceId = -1;

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
   * Tracks pending RPC requests awaiting responses (keyed by seqId).
   */
  public ongoingRequests: Map<string, Deferred> = new Map();

  /**
   * Requests queued while the channel is disconnected.
   * Automatically replayed on reconnection.
   */
  public pendingSendEntries = new Set<PendingSendEntry>();

  /**
   * Event method callbacks (for `on*` style subscriptions), keyed by seqId.
   */
  public requestEvents: Map<string, any> = new Map();

  /**
   * Active subscriptions on the server side, keyed by seqId.
   * Used for lifecycle cleanup (e.g. window close, navigation).
   * Mirrors electron-trpc's `subscriptions: Map<string, Unsubscribable>`.
   */
  public subscriptions: Map<string, Unsubscribable> = new Map();

  /**
   * Tracks active event method (ping-pong) listeners on the server side, keyed by seqId.
   * Used to prevent sending responses after the client has unsubscribed.
   */
  public activeEventMethods: Set<string> = new Set();

  /**
   * Optional context factory for injecting per-request data into handlers.
   */
  private _createContext: CreateContextFn | null = null;

  private onDidConnectedEvent = new Event({ name: 'on-did-connected' });

  onDidConnected = this.onDidConnectedEvent.subscribe;

  private onDidDisconnectedEvent = new Event({ name: 'on-did-disconnect' });

  onDidDisconnected = this.onDidDisconnectedEvent.subscribe;

  constructor(props?: AbstractChannelProtocolProps) {
    super();
    const {
      description = '',
      masterProcessName,
      connected = true,
      serializationFormat = SerializationFormat.JSON,
      readBuffer,
      writeBuffer,
      createContext,
    } = props || {};

    this._description = description;
    this._isConnected = connected;
    this._masterProcessName = masterProcessName;
    this._serializationFormat = serializationFormat;
    this._createContext = createContext || null;

    if (readBuffer) {
      this._readBuffer = readBuffer;
    }
    if (writeBuffer) {
      this._writeBuffer = writeBuffer;
    }

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

  get createContext() {
    return this._createContext;
  }

  /**
   * Get or create read buffer instance.
   * Uses lazy initialization with caching for performance.
   */
  get readBuffer(): ReadBaseBuffer {
    if (this._readBuffer) {
      return this._readBuffer;
    }

    try {
      this._readBuffer = BufferFactory.createReadBuffer(
        this._serializationFormat
      );
    } catch (error) {
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
   * Get or create write buffer instance.
   * Uses lazy initialization with caching for performance.
   */
  get writeBuffer(): WriteBaseBuffer {
    if (this._writeBuffer) {
      return this._writeBuffer;
    }

    try {
      this._writeBuffer = BufferFactory.createWriteBuffer(
        this._serializationFormat
      );
    } catch (error) {
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

  get serializationFormat(): string {
    return this._serializationFormat;
  }

  setSerializationFormat(format: string): void {
    if (this._serializationFormat !== format) {
      this._serializationFormat = format;
      this._readBuffer = null;
      this._writeBuffer = null;
    }
  }

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
   * Override to add custom send middleware.
   */
  decorateSendMiddleware(middlewares: SenderMiddleware[]) {
    return middlewares;
  }

  /**
   * Override to add custom receive middleware.
   */
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

  activate() {
    this._isConnected = true;
    this.onDidConnectedEvent.fire();
  }

  disconnect() {
    this._isConnected = false;
    // Clean up all active subscriptions on disconnect
    this.cleanUpSubscriptions();
    this.onDidDisconnectedEvent.fire();
  }

  /**
   * Cancel and clean up all active subscriptions.
   * Mirrors electron-trpc's subscription cleanup on window close/navigation.
   */
  cleanUpSubscriptions() {
    this.subscriptions.forEach((sub) => {
      try {
        sub.unsubscribe();
      } catch {
        // Ignore errors during cleanup
      }
    });
    this.subscriptions.clear();
  }

  makeRequest(props: SendingProps, transfer?: MessagePort[]): Deferred | void;

  makeRequest(
    requestPath: string,
    fnName: string,
    ...args: any[]
  ): Deferred | void;

  makeRequest(...args: any[]) {
    const result = runMiddlewares(this.senderMiddleware, args);
    if (result?.returnValue) return result.returnValue;
    // For event methods (on*), no Deferred is created but the caller
    // may still need the seqId.  Return a lightweight object so the
    // caller can identify the request.
    if (result?.seqId !== undefined) {
      return { seqId: result.seqId } as any;
    }
  }

  sendReply(...args: any[]) {
    this.send(...args);
  }

  onMessage(...args: any[]) {
    runMiddlewares(this._onMessageMiddleware, args);
  }
}

export default AbstractChannelProtocol;
