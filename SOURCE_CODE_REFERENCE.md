# x-oasis async-call-rpc 源代码完整引用

## 1. autoDetectTransfer.ts - 完整文件内容

**文件路径**: `/packages/async/async-call-rpc/src/middlewares/autoDetectTransfer.ts`

```typescript
/**
 * List of Transferable object types that can be transferred via postMessage.
 * These objects must be explicitly transferred and cannot be cloned.
 *
 * Includes both Web API types and Electron-specific types:
 * - MessagePort: Web standard
 * - MessagePortMain: Electron main-process equivalent of MessagePort
 */
const TRANSFERABLE_TYPES = [
  'MessagePort',
  'MessagePortMain',
  'ArrayBuffer',
  'OffscreenCanvas',
  'ImageBitmap',
  'ReadableStream',
  'WritableStream',
  'TransformStream',
];

/**
 * Check if a value is a Transferable object.
 *
 * Transferable objects must be transferred via the transfer list in postMessage,
 * not serialized. They include MessagePort, MessagePortMain, ArrayBuffer, etc.
 *
 * Detection strategy:
 * 1. First checks against the known TRANSFERABLE_TYPES list via toString tag.
 * 2. Falls back to duck-typing for port-like objects (any object with a
 *    `postMessage` method), consistent with handleRequest.ts's `isPortLike`.
 *    This ensures forward-compatibility with custom or future port types.
 *
 * @param value - The value to check
 * @returns true if the value is a Transferable object
 */
function isTransferable(value: any): boolean {
  if (value == null) return false;

  const typeName = Object.prototype.toString.call(value).slice(8, -1);
  if (TRANSFERABLE_TYPES.includes(typeName)) return true;

  // Duck-typing fallback: any object with postMessage is port-like and transferable
  if (typeof value === 'object' && typeof value.postMessage === 'function') {
    return true;
  }

  return false;
}

/**
 * Validate and detect if args contain Transferable objects.
 *
 * Rules:
 * - All args must be Transferable OR all must be non-Transferable
 * - Cannot mix Transferable and non-Transferable args
 * - If any arg is Transferable, returns true and extracts them
 *
 * @param args - The function arguments to validate
 * @returns Object with hasTransferable flag and extractedTransferables array
 */
function validateAndDetectArgType(args: any[]): {
  hasTransferable: boolean;
  transferables: any[];
} {
  if (!args || args.length === 0) {
    return { hasTransferable: false, transferables: [] };
  }

  const transferables: any[] = [];
  let hasTransferable = false;
  let hasNonTransferable = false;

  for (const arg of args) {
    if (isTransferable(arg)) {
      hasTransferable = true;
      transferables.push(arg);
    } else {
      hasNonTransferable = true;
    }
  }

  // Validate: cannot mix Transferable and non-Transferable
  if (hasTransferable && hasNonTransferable) {
    throw new Error(
      `Invalid args: Cannot mix Transferable objects (MessagePort, ArrayBuffer, etc.) ` +
        `with regular serializable data. All args must be either all Transferable or all serializable. ` +
        `Received mixed args.`
    );
  }

  return {
    hasTransferable,
    transferables,
  };
}

/**
 * Find all Transferable objects in the arguments.
 *
 * @param args - The function arguments
 * @returns Array of Transferable objects found in args
 */
function findTransferables(args: any[]): any[] {
  if (!args || args.length === 0) return [];

  const transferables: any[] = [];

  for (const arg of args) {
    if (isTransferable(arg)) {
      transferables.push(arg);
    }
  }

  return transferables;
}

export { isTransferable, validateAndDetectArgType, findTransferables };
```

---

## 2. types/rpc.ts - RequestType 和 ResponseType 定义

**文件路径**: `/packages/async/async-call-rpc/src/types/rpc.ts`

```typescript
export enum RequestType {
  /**
   * Normal request — waits for a single return value.
   */
  PromiseRequest = 'pr',
  PromiseAbort = 'pa',

  /**
   * Fire-and-forget command — no return value expected.
   */
  SignalRequest = 'sr',
  SignalAbort = 'sa',

  /**
   * Subscription request — expects a stream of values.
   * The server should keep sending `ReturnSuccess` until the
   * client sends a `SubscriptionStop`.
   */
  SubscriptionRequest = 'sub',

  /**
   * Stop an active subscription.
   */
  SubscriptionStop = 'unsub',

  /**
   * Stop an active ping-pong event method (on* method).
   * Similar to SubscriptionStop but for the simpler event method pattern.
   */
  EventMethodStop = 'evt-stop',

  /**
   * Promise request with all args as Transferable objects.
   *
   * When args contain ONLY Transferable objects (MessagePort, ArrayBuffer, etc.)
   * and NO serializable data, use this request type. This allows the receiver to
   * reconstruct args from message.ports without any data deserialization.
   *
   * Constraint: args must be ALL Transferables or ALL serializable data.
   * Mixing Transferables with serializable data is NOT allowed and will raise an error.
   *
   * Example:
   *   // ✅ Valid: args = [port1, port2]
   *   await endpoint.service.methodName(port1, port2); // auto-detected as TransferableArgsRequest
   *
   *   // ❌ Invalid: args = [{port: port1}, callback]  (mixing Transferable and serializable)
   *   // This will raise an error during validation in prepareNormalData middleware
   */
  TransferableArgsRequest = 'tar',
}

export type RequestRawSequenceId = number;

export type RequestSequenceId = string;
export type RequestServicePath = string;
export type RequestFnName = string;

export type RequestEntryHeader = [
  RequestType,
  RequestSequenceId,
  RequestServicePath,
  RequestFnName
];
export type RequestEntryBody = any;
export type RequestEntry = [RequestEntryHeader, RequestEntryBody];

export enum ResponseType {
  ReturnSuccess = 'rs',
  ReturnFail = 'rf',

  PortSuccess = 'ps',
  PortFail = 'pf',

  /**
   * Indicates the subscription has been stopped by the server.
   */
  SubscriptionStopped = 'ss',

  /**
   * Indicates the event method (ping-pong) has been stopped.
   */
  EventMethodStopped = 'evt-stopped',
}
export type ResponseEntryHeader = [ResponseType, RequestSequenceId];
export type ResponseEntryBody = any;

export type HostName = string;

/**
 * 0 RequestType: PromiseRequest, PromiseAbort, SignalRequest, SignalAbort, SubscriptionRequest, SubscriptionStop, EventMethodStop
 * 1 RequestSequenceId: string
 */
export type HostRequestEntryHeader = [
  RequestType,
  RequestSequenceId,
  RequestServicePath,
  RequestFnName,
  HostName
];
export type HostRequestEntryBody = any;
export type HostRequestEntry = [HostRequestEntryHeader, HostRequestEntryBody];

/**
 * An object that can be unsubscribed.
 * Returned by subscription-style calls.
 */
export interface Unsubscribable {
  unsubscribe(): void;
}
```

---

## 3. types/protocol.ts - SendingProps 定义

**文件路径**: `/packages/async/async-call-rpc/src/types/protocol.ts`

```typescript
export type SendingProps = {
  requestPath: string;
  methodName: string;
  args?: any[];
  isOptionsRequest?: boolean;
  /**
   * List of Transferable objects to transfer ownership across realm boundaries.
   *
   * Supported Transferable types:
   * - MessagePort: bidirectional communication channels
   * - ArrayBuffer: binary data buffers
   * - ImageBitmap: image data (browser only)
   * - OffscreenCanvas: GPU-backed canvas (browser only)
   * - ReadableStream, WritableStream, TransformStream: streams (browser only)
   *
   * Note: This field is usually populated automatically by the prepareNormalData middleware,
   * but you can specify transfers manually here if needed.
   *
   * Example with explicit transfer:
   *
   * await endpoint.service.methodName({
   *   requestPath: 'Service',
   *   methodName: 'processPort',
   *   args: [{port: myMessagePort}],
   *   transfer: [myMessagePort], // explicitly specify
   * });
   *
   * Example with auto-detection (preferred):
   *
   * // No need to specify transfer, prepareNormalData middleware handles it
   * await endpoint.service.methodName({port: myMessagePort});
   */
  transfer?: any[];
  /**
   * Override the request type (default: `PromiseRequest`).
   * Set to `SubscriptionRequest` or `SubscriptionStop` for streaming subscriptions.
   */
  requestType?: string;
};
```

---

## 4. prepareRequestData.ts - 完整文件

**文件路径**: `/packages/async/async-call-rpc/src/middlewares/prepareRequestData.ts`

```typescript
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';
import {
  SendingProps,
  RequestEntryHeader,
  RequestType,
  SendMiddlewareLifecycle,
} from '../types';
import { validateAndDetectArgType } from './autoDetectTransfer';

/**
 * Parse the overloaded arguments of a middleware function into a normalised structure.
 *
 * Supports two calling conventions:
 *   1. Direct call: (requestPath, methodName, ...params)
 *   2. SendingProps call: (SendingProps, transfer?)
 *
 * This allows both simple function-like calls and advanced control via SendingProps options.
 */
function parseRequestArgs(
  props: string | SendingProps,
  args: any[]
): {
  requestPath: string;
  methodName: string;
  params: any[];
  transfer: any[];
  isOptionsRequest: boolean;
  requestType: RequestType;
} {
  if (typeof props === 'string') {
    // CASE 1: Direct call convention
    // props is the requestPath, args[0] is methodName, args.slice(1) are params
    return {
      requestPath: props,
      methodName: args[0],
      params: args.slice(1),
      transfer: [], // No transfer list in direct call
      isOptionsRequest: false,
      requestType: RequestType.PromiseRequest,
    };
  }

  // CASE 2: SendingProps call convention
  // props is an object containing requestPath, methodName, args, transfer, etc.
  return {
    requestPath: props.requestPath,
    methodName: props.methodName,
    params: [].concat(props.args),
    // IMPORTANT: If transfer was specified in SendingProps, use it
    // Otherwise use args[0] if provided (legacy support)
    // Otherwise empty array
    transfer: props.transfer || args[0] || [],
    isOptionsRequest: !!props.isOptionsRequest,
    requestType:
      (props.requestType as RequestType) || RequestType.PromiseRequest,
  };
}

/**
 * Prepare middleware for generic data requests.
 *
 * This is the primary prepare middleware used in the sending pipeline.
 * It structures RPC requests with proper headers and initializes the transfer list.
 *
 * ## Auto-detect Transferable objects:
 *
 * This middleware integrates auto-detection of Transferable objects (MessagePort, ArrayBuffer, etc.):
 * - If all args are Transferable: requestType is set to TransferableArgsRequest
 * - Transferables are extracted and stored in the transfer list
 * - Validates that args don't mix Transferable and non-Transferable objects
 *
 * Example:
 *   await service.processPort(port1, port2);  // Service methods
 *   // Auto-detected as TransferableArgsRequest with [port1, port2] in transfer list
 */
export const prepareNormalData = (channel: AbstractChannelProtocol) => {
  const fn = (props: string | SendingProps, ...args: any[]) => {
    const seqId = channel.seqId;
    const parsed = parseRequestArgs(props, args);
    const { requestPath, methodName, params, isOptionsRequest } = parsed;
    let { transfer, requestType } = parsed;

    // If the caller already provided an explicit transfer list (via SendingProps),
    // respect it and skip auto-detection.
    // Otherwise, auto-detect Transferable objects in params.
    const hasExplicitTransfer = transfer && transfer.length > 0;

    if (
      !hasExplicitTransfer &&
      (!requestType || requestType === RequestType.PromiseRequest)
    ) {
      const { hasTransferable, transferables } =
        validateAndDetectArgType(params);

      if (hasTransferable) {
        requestType = RequestType.TransferableArgsRequest;
        transfer = transferables;
      }
    }

    const header: RequestEntryHeader = [
      requestType, // Can be PromiseRequest, TransferableArgsRequest, SubscriptionRequest, etc.
      seqId,
      requestPath,
      methodName,
    ];

    return {
      seqId,
      isOptionsRequest,
      data: [header, params],
      transfer, // Transfer list for Transferable objects (if any)
    };
  };

  fn.lifecycle = SendMiddlewareLifecycle.Prepare;

  return fn;
};
```

---

## 5. handleResponse.ts - PortSuccess 处理部分

**文件路径**: `/packages/async/async-call-rpc/src/middlewares/handleResponse.ts`（关键部分）

```typescript
// 第 188-216 行: ONE-SHOT REQUEST RESPONSE HANDLING
} else {
  // ONE-SHOT REQUEST RESPONSE HANDLING:
  // For normal requests, delete the deferred when response arrives
  protocol.ongoingRequests.delete(`${seqId}`);

  // CRITICAL: Handle PortSuccess (Transferable object response)
  // When return value is a MessagePort, it comes in message.ports[0]
  // NOT in body (body is typically null for PortSuccess)
  //
  // This is the key difference:
  // - PortSuccess: resolve with message.ports[0]
  // - ReturnSuccess: resolve with body[0]
  if (type === ResponseType.PortSuccess) {
    // ✓ IMPORTANT: Use message.ports[0], not body[0]
    // The actual MessagePort was transferred via Transferable mechanism
    // and is available in the ports array from the normalize middleware
    findDefer.resolve(ports && ports[0]);
  } else if (type === ResponseType.ReturnFail) {
    // Handle error response
    const rawError = body[0];
    const rpcError = new RPCError({
      code: rawError?.code ?? JSONRPCErrorCode.InternalError,
      message: rawError?.message ?? 'Remote procedure call failed',
      data: rawError?.data,
    });
    findDefer.reject(rpcError);
  } else {
    // Normal success response: resolve with the returned value
    findDefer.resolve(body[0]);
  }
}
```

---

## 6. handleRequest.ts - TransferableArgsRequest 和 PortSuccess 部分

**文件路径**: `/packages/async/async-call-rpc/src/middlewares/handleRequest.ts`（关键部分）

```typescript
// 第 86-103 行: TransferableArgsRequest 处理
// ✨ SPECIAL HANDLING: TransferableArgsRequest
// When all args are Transferable objects (MessagePort, ArrayBuffer, etc.),
// they are passed via the transfer list (message.ports) instead of data.
// Here we reconstruct args from message.ports.
//
// Example: client sends { requestPath: 'Service', methodName: 'method', args: [port1, port2] }
// - Message.ports will contain [port1, port2]
// - body[0] (args) will be empty or minimal
// - We need to convert message.ports into args for the handler
if (type === RequestType.TransferableArgsRequest) {
  // Reconstruct args from message.ports
  // Each port in message.ports becomes an element in args
  args = ports || [];

  console.debug(
    `[handleRequest] TransferableArgsRequest: reconstructed ${args.length} args from message.ports`
  );
}

// 第 364-379 行: PortSuccess 响应
// Port return value: encode as PortSuccess and pass the port as a
// transferable. The receiving side's `handleResponse` resolves the
// deferred with `message.ports[0]`.
if (isPortLike(response)) {
  const portHeader = [ResponseType.PortSuccess, seqId];
  const sendData = protocol.writeBuffer.encode([portHeader, []]);
  if (protocol.isConnected()) {
    (protocol.sendReply as (d: any, t?: any[]) => void)(
      sendData,
      [].concat(response)
    );
  }
  return;
}
```

---

## 7. sendRequest.ts - 发送 transfer list

**文件路径**: `/packages/async/async-call-rpc/src/middlewares/sendRequest.ts`（完整文件）

```typescript
import { SenderMiddlewareOutput, SendMiddlewareLifecycle } from '../types';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';

/**
 * Send middleware: Transmits the prepared RPC message to the receiver.
 *
 * This is the final step in the sending pipeline that actually sends the message
 * through the channel protocol to the other realm.
 *
 * ## What this middleware does:
 *
 * 1. Extracts the encoded data from middleware output
 * 2. Checks if there's a transfer list to send along
 * 3. Calls channel.send() with appropriate parameters:
 *    - channel.send(data) if no transfers
 *    - channel.send(data, transfer) if transfers exist
 *
 * ## The transfer list:
 *
 * Transferable objects (MessagePort, ArrayBuffer, etc.) require special handling
 * when crossing realm boundaries. The transfer list tells the transport layer
 * which objects should be moved (not copied) to the other realm.
 *
 * Auto-populated by: prepareNormalData middleware (via validateAndDetectArgType)
 * Can be manually specified via: SendingProps.transfer field
 *
 * ## Relationship with other middleware:
 *
 * Middleware order (simplified):
 * 1. prepareNormalData - Structures RPC message and auto-detects Transferable objects
 * 2. serialize - Encodes data for transmission (STEP 2)
 * 3. sendRequest - Sends via channel protocol (STEP 3) ← YOU ARE HERE
 *
 * ## Important: When to use transfer:
 *
 * After sending a Transferable object, it becomes unusable in the sender realm.
 * Example:
 * ```ts
 * const port = new MessagePort();
 * await service.method({port});  // port is transferred
 * // port is now unusable here - it's been moved to the other realm!
 * port.postMessage('hello');      // Error: port is detached
 * ```
 *
 * This is why Transferable objects are efficient - they avoid serialization overhead
 * by moving ownership instead of copying.
 *
 * ## Error handling:
 *
 * If channel.send() throws, the error will bubble up through the middleware chain.
 * The endpoint will catch and handle it appropriately.
 */
export const sendRequest = (channelProtocol: AbstractChannelProtocol) => {
  const fn = (value: SenderMiddlewareOutput) => {
    const { data, transfer } = value;

    // STEP 1: Check if there are Transferable objects to send
    // These were either:
    // - Auto-detected by prepareNormalData middleware
    // - Manually specified in SendingProps.transfer
    if (transfer && transfer.length > 0) {
      // CASE 1: We have Transferable objects
      // Call send() with transfer list for efficient cross-realm communication
      // The transport layer will move these objects to the receiver realm
      channelProtocol.send(data, transfer);
    } else {
      // CASE 2: No Transferable objects
      // Call send() without transfer list (simpler path)
      channelProtocol.send(data);
    }

    // Return the value unchanged - this middleware doesn't modify data
    return value;
  };

  // Metadata: This is the final step in the Send lifecycle phase
  fn.lifecycle = SendMiddlewareLifecycle.Send;

  return fn;
};
```

---

## 8. normalize.ts - ports 提取

**文件路径**: `/packages/async/async-call-rpc/src/middlewares/normalize.ts`（关键部分）

```typescript
/**
 * Normalize middleware for MessageChannel (WebSocket/Worker) raw messages.
 *
 * This middleware extracts event.data and event.ports from MessageEvent,
 * providing a normalized interface for the rest of the middleware chain.
 *
 * ## The ports field:
 *
 * When sender calls channel.send(data, transfer),
 * Transferable objects are moved to receiver side and appear in event.ports.
 *
 * This middleware MUST extract event.ports and include it in output:
 * - event.ports becomes message.ports for downstream middleware
 * - deserialize middleware keeps ports unchanged
 * - handleResponse middleware uses ports[0] for PortSuccess
 *
 * If event.ports is not extracted here, it will be lost forever!
 */
export const normalizeMessageChannelRawMessage =
  () =>
  (event: MessageEvent): NormalizedRawMessageOutput => {
    // STEP 1: Extract data and ports from MessageEvent
    // MessageEvent has both data (the main message) and ports (transferred objects)
    const data = event.data;

    // STEP 2: Extract ports from MessageEvent
    // event.ports contains Transferable objects that were transferred via transfer list
    // If no ports were transferred, event.ports is undefined or empty array
    const ports = event.ports ? [...event.ports] : [];

    // STEP 3: Return normalized message with both data and ports
    // ⭐ CRITICAL: ports must be included in output for handleResponse to work!
    return {
      event,
      data,
      ports, // ← Do NOT forget this! handleResponse needs it
    };
  };

/**
 * Normalize middleware for Electron IPC raw messages.
 *
 * For Electron's ipcRenderer/ipcMain, messages come as (event, ...data) arguments.
 * This middleware reconstructs a MessageEvent-like structure.
 *
 * ## Electron IPC specifics:
 *
 * ipcRenderer.on/ipcMain.on callbacks receive: (event, ...data)
 * - event.ports contains transferred MessagePorts
 * - data is the actual message content
 *
 * This must be normalized to match MessageEvent structure
 * so downstream middleware can access event.ports consistently.
 */
export const normalizeIPCChannelRawMessage =
  () => (event: MessageEvent, data: string) => {
    // STEP 1: Extract ports from Electron IPC event
    // Just like MessageChannel, Electron's event.ports contains transferred objects
    const ports = event.ports ? [...event.ports] : [];

    // STEP 2: Return normalized structure
    // data parameter contains the main message
    // ports extracted from event for downstream middleware
    return {
      event,
      data,
      ports, // ← Include ports from Electron IPC event
    };
  };
```

---

## 9. buffer.ts - deserialize 保留 ports

**文件路径**: `/packages/async/async-call-rpc/src/middlewares/buffer.ts`（关键部分）

```typescript
/**
 * Deserialize middleware: Decodes RPC message data after reception.
 *
 * This middleware performs the counterpart of serialize middleware on the sender side.
 *
 * ## What this middleware does:
 *
 * 1. Takes the encoded data string from normalize middleware
 * 2. Calls channel.readBuffer.decode() to convert back to RPC message object
 * 3. Returns the decoded data while preserving all other fields (CRITICAL: ports!)
 *
 * ## The ports field (CRITICAL):
 *
 * This middleware MUST preserve the ports field because:
 *
 * 1. normalize middleware extracts ports from event.ports
 * 2. deserialize needs to keep it intact (should never be modified)
 * 3. handleResponse middleware uses ports[0] for PortSuccess response type
 *
 * If ports is lost here, PortSuccess handling will crash with:
 * "Cannot read property '0' of undefined" when trying to access message.ports[0]
 *
 * ## Data flow example:
 *
 * Sender sends with port: endpoint.service.acquirePort()
 *   ↓ (with transfer: [messagePort])
 *
 * Receiver normalize extracts:
 *   {data: "[["ps", "123"], ...]", ports: [messagePort]}
 *
 * Receiver deserialize must preserve ports:
 *   {data: [["ps", "123"], ...], ports: [messagePort]}  ✓ CORRECT
 *   {data: [["ps", "123"], ...]}                        ✗ WRONG (ports lost!)
 *
 * handleResponse uses ports[0]:
 *   if (type === ResponseType.PortSuccess) {
 *     findDefer.resolve(message.ports[0]);  // ← Must have ports!
 *   }
 *
 * ## Error scenarios if ports is lost:
 *
 * Error: "Cannot read property '0' of undefined"
 * Where: handleResponse.ts:68 → message.ports[0]
 * Why: deserialize removed the ports field
 * Fix: Always return {...value, data: decoded} to preserve ports
 *
 * @see {@link serialize} for full explanation of why encoding/decoding is necessary
 */
export const deserialize =
  (channel: AbstractChannelProtocol) => (value: NormalizedRawMessageOutput) => {
    const { data } = value;
    let decoded = data;

    try {
      // STEP 1: Decode the data string back to RPC message object
      // This converts "[["rs", "123"], ...body]" → [["rs", "123"], ...body]
      decoded = channel.readBuffer.decode(data);
    } catch (err) {
      console.error('[decode error]', data, err);
    }

    // STEP 2: Return with all fields preserved
    // CRITICAL: Use {...value, ...} spread to keep ports field intact!
    // This ensures handleResponse can access message.ports[0] for PortSuccess
    return {
      ...value,
      data: decoded,
      // ports from value is automatically preserved in the spread operator
    };
  };
```

---

## 10. Electron 示例 - main.ts

**文件路径**: `/packages/async/async-call-rpc-electron/examples/renderer-acquire-main-port-example/main.ts`

```typescript
import { app, BrowserWindow, MessageChannelMain } from 'electron';
import { IPCMainChannel } from '@x-oasis/async-call-rpc-electron';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';
import { join } from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const channel = new IPCMainChannel({
    channelName: 'app-rpc',
    webContents: mainWindow.webContents,
    description: 'main→renderer RPC channel',
  });

  const client = clientHost
    .registerClient('renderer-api', { channel })
    .createProxy();

  let count = 0;

  serviceHost.registerService('api', {
    channel,
    serviceHost,
    handlers: {
      acquirePort(): [Electron.MessagePortMain] {
        const { port1, port2 } = new MessageChannelMain();
        if (!count) {
          console.log('trigger assign');
          client.assignPort(port2);  // ← 发送 port2 给 renderer!
          count = count + 1;
        }
        return [port1];  // ← 返回 port1 给 renderer!
      },
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

---

## 11. Electron 示例 - preload.ts

**文件路径**: `/packages/async/async-call-rpc-electron/examples/renderer-acquire-main-port-example/preload.ts`

```typescript
import { ipcRenderer } from 'electron';
import { IPCRendererChannel } from '@x-oasis/async-call-rpc-electron';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

const channel = new IPCRendererChannel({
  channelName: 'app-rpc',
  ipcRenderer,
  projectName: 'my-electron-app',
  description: 'renderer→main RPC channel',
});

const api = clientHost.registerClient('api', { channel }).createProxy();

serviceHost.registerService('renderer-api', {
  channel,
  serviceHost,
  handlers: {
    assignPort(port: Electron.MessagePortMain) {  // ← 接收 port2!
      console.log('assign port', port);
    },
  },
});

// contextBridge.exposeInMainWorld('api', {
//   acquirePort: (...args: unknown[]) => api.acquirePort(...args),
// });

api.acquirePort().then((port) => {
  console.log('port ', port);  // ← 接收 port1!
});
```

---

## 12. 测试文件 - transferable-args.spec.ts（关键测试）

**文件路径**: `/packages/async/async-call-rpc/test/transferable-args.spec.ts`

```typescript
test('TransferableArgsRequest with single port', async () => {
  const fakePort = {
    postMessage: vi.fn(),
    start: vi.fn(),
    on: vi.fn(),
  };

  const handler = vi.fn((port) => {
    expect(port).toBe(fakePort);
    return 'got-port';
  });

  serviceHost.registerServiceHandler('/service', {
    assignPort: handler,
  });

  const run = handleRequest(mockProtocol as AbstractChannelProtocol);

  run({
    event: null,
    data: [
      [
        RequestType.TransferableArgsRequest,
        'seq-single',
        '/service',
        'assignPort',
      ],
      [[]],  // ← body 是空数组!
    ],
    ports: [fakePort],  // ← 实际的 port 在这里!
  } as any);

  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  // Handler 应该被调用时传入 fakePort
  expect(handler).toHaveBeenCalledWith(fakePort);
  expect(sendReply).toHaveBeenCalledTimes(1);
  const [data] = sendReply.mock.calls[0];
  expect(data[0][0]).toBe(ResponseType.ReturnSuccess);
  expect(data[1]).toEqual(['got-port']);
});
```

---

## 中间件管道流程总结

### Sender Pipeline (5 个中间件)
```
1. prepareNormalData
   - 输入: requestPath, methodName, args (可能非数组)
   - 自动检测: validateAndDetectArgType(params)
   - 输出: {data: [header, params], transfer: [...], requestType: 'tar'|'pr'}

2. updateSeqInfo
   - 分配 seqId
   - 创建 Deferred 并保存到 ongoingRequests

3. handleDisconnectedRequest
   - 检查连接状态
   - 可能放入 pendingSendEntries 队列

4. serialize
   - 编码 data 为 JSON 字符串
   - transfer 保持不变

5. sendRequest
   - 调用 channel.send(data, transfer)
   - 通过 IPC/WebSocket/MessagePort 发送
```

### Receiver Pipeline (4 个中间件)
```
1. normalizeMessageChannelRawMessage / normalizeIPCChannelRawMessage
   - 提取 event.data → data
   - 提取 event.ports → ports ⭐ CRITICAL
   - 输出: {event, data, ports}

2. deserialize
   - 解码 data 字符串 → 对象
   - 保留 ports ⭐ CRITICAL
   - 输出: {event, data: [...], ports}

3. handleRequest
   - 检查 type 是否为 TransferableArgsRequest
   - 如是，从 ports 重建 args: args = ports || []
   - 调用 handler(args)
   - 创建响应 (ReturnSuccess 或 PortSuccess)

4. handleResponse
   - 查找 deferred via seqId
   - 如果 PortSuccess: resolve(ports[0]) ⭐ CRITICAL
   - 如果 ReturnSuccess: resolve(body[0])
   - 如果 ReturnFail: reject(error)
```

---

## 关键数据转换示例

### 示例 1: assignPort(port2)

```
SENDER:
  client.assignPort(port2)
  ↓
  props.args = port2
  ↓
  params = [].concat(port2) = [port2]
  ↓
  validateAndDetectArgType([port2]) → {hasTransferable: true, transferables: [port2]}
  ↓
  requestType = 'tar'
  transfer = [port2]
  ↓
  data = [['tar', 'seq-123', 'renderer-api', 'assignPort'], [port2]]
  ↓
  channel.send(encoded_data, [port2])

RECEIVER:
  event.ports = [port2]
  ↓
  ports = [port2]
  ↓
  type = 'tar'
  ↓
  args = ports || [] = [port2]
  ↓
  handler(port2)
  ↓
  return ReturnSuccess
  ↓
  resolve(undefined)
```

### 示例 2: acquirePort() → port1

```
SERVER:
  handler 返回 port1
  ↓
  isPortLike(port1) = true
  ↓
  responseType = PortSuccess = 'ps'
  body = []  (空!)
  transfer = [port1]
  ↓
  sendReply(encoded, [port1])

CLIENT:
  event.ports = [port1]
  ↓
  ports = [port1]
  ↓
  type = 'ps' (PortSuccess)
  ↓
  resolve(ports[0]) = resolve(port1)
  ↓
  api.acquirePort().then(port => {
    console.log(port);  // port1!
  })
```

