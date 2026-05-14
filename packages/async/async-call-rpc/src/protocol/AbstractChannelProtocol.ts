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
import { handleDisconnectedRequest } from '../middlewares/handleDisconnectedRequest';
import ReadBaseBuffer from '../buffer/ReadBaseBuffer';
import WriteBaseBuffer from '../buffer/WriteBaseBuffer';
import { BufferFactory } from '../buffer/BufferFactory';
import { SerializationFormat } from '../buffer/SerializationFormat';
import { resumeMiddlewares } from '../middlewares/utils';

import { deserialize, serialize } from '../middlewares/buffer';
import { handleResponse } from '../middlewares/handleResponse';
import RPCService from '../endpoint/RPCService';
import RPCServiceHost from '../endpoint/RPCServiceHost';
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
 *  │  1. prepareNormalData           │  ← build envelope, auto-detect Transferables
 *  │  2. updateSeqInfo               │  ← assign seqId
 *  │  3. handleDisconnectedRequest   │  ← check connection
 *  │  4. serialize                   │  ← encode via WriteBuffer
 *  │  5. sendRequest                 │  ← call this.send()
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
  private readonly _identifier: string;

  private readonly _metadata: Record<string, any>;

  private _key: string;

  private _service!: RPCService;

  private _serviceHost: RPCServiceHost | null = null;

  private _listenerAttached = false;

  readonly _description: string;

  private _seqId: RequestRawSequenceId = -1;

  protected _onMessageMiddleware: ClientMiddleware[] = [
    normalizeMessageChannelRawMessage,
    deserialize,
    handleRequest,
    handleResponse,
  ];

  private _senderMiddleware: SenderMiddleware[] = [
    prepareNormalData, // ✨ Structures RPC request message with auto-detect Transferables
    updateSeqInfo,
    handleDisconnectedRequest,
    serialize,
    sendRequest,
  ];

  private _readBuffer: ReadBaseBuffer | null = null;

  private _writeBuffer: WriteBaseBuffer | null = null;

  private _serializationFormat: string;

  protected _isConnected = true;

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
      identifier = '',
      metadata = {},
      connected = true,
      serializationFormat = SerializationFormat.JSON,
      readBuffer,
      writeBuffer,
      createContext,
    } = props || {};

    this._description = description;
    this._isConnected = connected;
    this._identifier = identifier;
    this._metadata = metadata;
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

  /**
   * Bind a single `RPCService` to this channel for single-service routing.
   * The `handleRequest` middleware will resolve incoming method calls via
   * `service.getHandler(methodName)` — the request's `requestPath` is
   * ignored in this mode.
   *
   * ⚠️ Priority caveat (see `handleRequest.ts:142-163`):
   * `serviceHost` ALWAYS wins over `service`. If you call `setServiceHost()`
   * on a channel that already has a `service` bound (e.g. via
   * `RPCService.setChannel(this)`), the `service` becomes unreachable —
   * requests targeting it will be silently dropped because the host's
   * `getHandler(requestPath, methodName)` will return `undefined` for the
   * unknown path. There is intentionally no fallback to `service`.
   *
   * Concrete trap: `ParticipantOrchestratorProxy` binds an `RPCService` for
   * `ORCHESTRATOR_SERVICE_PATH` to the control channel via
   * `service.setChannel(controlChannel)`. Calling
   * `controlChannel.setServiceHost(...)` later silently breaks orchestrator
   * handshakes. If you need both modes on the same transport, use a
   * separate channel for the host (see `MainCpServer` in
   * async-call-rpc-electron for the reference pattern).
   */
  setService(service: RPCService) {
    this._service = service;
  }

  get serviceHost(): RPCServiceHost | null {
    return this._serviceHost;
  }

  /**
   * Bind this channel to an `RPCServiceHost`, enabling multi-service routing.
   * The `handleRequest` middleware will look up handlers via
   * `host.getHandler(requestPath, methodName)`. When a request's
   * `requestPath` is not in the host, the request is silently ignored —
   * which is what makes it safe to share one transport across multiple
   * channels (each bound to a different host) without producing
   * "Method not found" cross-talk.
   *
   * Idempotent: calling twice with the same host is a no-op.
   *
   * ⚠️ Asymmetric priority over `setService` (see `handleRequest.ts:142-163`):
   * once a `serviceHost` is bound, the channel-bound `service` (if any) is
   * ignored — there is intentionally no fallback. This is by design: a
   * host is the multi-service registry, a service is single-service
   * convenience, and silent drops are preferred over "Method not found"
   * cross-talk when one transport is shared by many channels.
   *
   * Practical implication: do NOT call `setServiceHost()` on a channel
   * that already has a service bound via `RPCService.setChannel()` —
   * the service will become silently unreachable. Symptom: orchestrator
   * handshakes hang because `ORCHESTRATOR_SERVICE_PATH` requests hit a
   * host that doesn't know the path. The fix landed in commit `2d8648c`
   * by routing main↔daemon RPC through a dedicated control channel.
   */
  setServiceHost(host: RPCServiceHost) {
    if (this._serviceHost === host) return;
    this._serviceHost = host;
    this.ensureListenerAttached();
  }

  /**
   * Idempotently attach this channel's `onMessage` to the underlying
   * transport. Called by `setServiceHost`, `RPCService.setChannel`, and
   * `ProxyRPCClient.setChannel` so that a single channel shared between
   * a service host and one or more clients only ever has one listener
   * — preventing every incoming message from being processed twice.
   */
  ensureListenerAttached(): void {
    if (this._listenerAttached) return;
    this._listenerAttached = true;
    this.on(this.onMessage.bind(this));
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

  get identifier() {
    return this._identifier;
  }

  get metadata() {
    return this._metadata;
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
    const copy = Array.isArray(fns) ? fns : [fns];
    this._onMessageMiddleware = [];
    copy.forEach((fn) => {
      if (typeof fn === 'function') {
        this._onMessageMiddleware.push(fn(this));
      }
    });
  }

  applySendMiddleware(fns: Function | Function[]) {
    const copy = Array.isArray(fns) ? fns : [fns];
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

  send(_data: any, _transfer?: any[]): void;
  send(..._args: any[]): void;
  send(..._args: any[]): void {
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

  sendReply(data: any, transfer?: any[]): void;
  sendReply(...args: any[]): void;
  sendReply(...args: any[]): void {
    (this.send as (...a: any[]) => void)(...args);
  }

  onMessage(...args: any[]) {
    runMiddlewares(this._onMessageMiddleware, args);
  }
}

export default AbstractChannelProtocol;
