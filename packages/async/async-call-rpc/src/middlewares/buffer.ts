import {
  NormalizedRawMessageOutput,
  SenderMiddlewareOutput,
  SendMiddlewareLifecycle,
} from '../types';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';

/**
 * Serialize middleware: Encodes RPC message data before transmission.
 *
 * ## Why this is necessary:
 *
 * 1. **Channel-specific serialization constraints**:
 *    - Different transport layers (Electron IPC, WebSocket, MessagePort, etc.)
 *    - have different serialization restrictions
 *    - Electron's `webContents.send()` only serializes basic types
 *    - (string, number, boolean, null, undefined, Date, Array, Object)
 *    - Custom objects and MessagePort instances require special encoding
 *
 * 2. **Complex data handling**:
 *    - When responses contain MessagePort (for port transfer scenarios),
 *    - they cannot be directly serialized by Electron
 *    - `writeBuffer.encode()` prepares these for safe transmission
 *    - Failure to encode results in: "Error: Failed to serialize arguments"
 *
 * 3. **RPC protocol structure**:
 *    - RPC messages use a [header, body] structure where body can contain:
 *    - Call arguments, response values, or port references
 *    - encode() transforms complex types into transmissible format
 *
 * 4. **Integration with handleRequest middleware**:
 *    - handleRequest.ts extensively uses `protocol.writeBuffer.encode()`
 *    - in lines: 98, 109, 117, 125, 154, 165, 182, 187, 195, etc.
 *    - These encodes prepare response data (with potential MessagePorts)
 *    - Without serialize middleware decoding on receive, data remains encoded
 *    - Leading to "Assignment to constant variable" and type errors
 *
 * ## What happens when encode/decode is commented out:
 *
 * - Data sent by `handleRequest` via `writeBuffer.encode()` arrives intact (encoded)
 * - Receiver's `deserialize` middleware should decode it back
 * - If commented out, receiver gets raw encoded bytes, not decoded objects
 * - Subsequent code tries to use encoded data as plain objects → failures
 *
 * ## Example scenario:
 *
 * In renderer-acquire-main-port-example:
 * - Main process calls `acquirePort()` which returns a MessagePort
 * - handleRequest encodes: `protocol.writeBuffer.encode([portHeader, [messagePort]])`
 * - serialize should decode on receiver side
 * - Without decode: receiver gets bytes instead of MessagePort reference
 * - Code tries to assign to port variable → "Assignment to constant variable"
 *
 * ## Possible error scenarios when disabled (see full list below):
 *
 * ### Error 1: Electron Serialization Failure (Most Direct)
 * Error: "Failed to serialize arguments"
 * When: Sending MessagePort or complex objects through Electron IPC
 * Why: Electron.send() cannot serialize encoded objects directly
 *
 * ### Error 2: Data Deserialization Failure (Receiver Side)
 * Error: "Cannot read property 'xxx' of undefined", "Cannot destructure"
 * When: Receiving end tries to use encoded data as plain objects
 * Why: deserialize middleware not calling decode(), data stays encoded
 *
 * ### Error 3: MessagePort Assignment Failure
 * Error: "Assignment to constant variable"
 * When: Trying to use returned MessagePort from acquirePort()
 * Why: Received encoded object instead of actual MessagePort instance
 *
 * ### Error 4: Type Mismatch & Property Access
 * Error: "Cannot read property", "response.method is not a function"
 * When: Accessing properties on encoded data objects
 * Why: Encoded data has different structure than expected
 *
 * ### Error 5: Event Method Callback Failures
 * Error: "Cannot read property 'length' of undefined"
 * When: Using onXxx() event listener methods
 * Why: Callback arguments received in encoded format
 *
 * ### Error 6: Subscription Stop/Cleanup Failures
 * Error: "Cannot read property '1' of undefined"
 * When: Canceling subscriptions (seqId extraction fails)
 * Why: Response header cannot be destructured from encoded data
 *
 * ### Error 7: Error Response Handling Failures
 * Error: "Cannot read property 'code' of undefined"
 * When: Server returns error responses
 * Why: Error details remain encoded, parsing fails
 *
 * ### Error 8: Multi-Service Routing Failures
 * Error: "SyntaxError: Unexpected token in JSON"
 * When: Using serviceHost with complex return values
 * Why: Encoded data cannot be JSON-serialized by Electron
 *
 * ### Error 9: Port Transfer Complete Failure
 * Error: "Failed to serialize arguments", "port.postMessage is not a function"
 * When: Port transfer operations (port.addEventListener, acquirePort)
 * Why: Encoded port reference cannot be used as MessagePort
 *
 * ### Error 10 (Worst): Silent Failures + Data Corruption
 * Error: Delayed errors, data inconsistency, wrong values used downstream
 * When: Encoded data is accidentally transmitted and processed as plain data
 * Why: Code continues running with corrupted/misformatted data
 * Impact: Silent data corruption is hardest to debug
 *
 * ## Minimum requirements:
 *
 * Even if your use case doesn't need encoding, these middleware MUST exist:
 * - serialize: pass-through at minimum (identity function)
 * - deserialize: pass-through at minimum (identity function)
 * Because handleRequest relies on encode() for complex type handling
 */
export const serialize = (channel: AbstractChannelProtocol) => {
  const fn = (value: SenderMiddlewareOutput) => {
    const { data } = value;
    let encoded = data;

    try {
      encoded = channel.writeBuffer.encode(data);
    } catch (err) {
      console.error('[encode error]', data, err);
    }

    return {
      ...value,
      data: encoded,
    };
  };

  fn.lifecycle = SendMiddlewareLifecycle.DataOperation;
  return fn;
};

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
