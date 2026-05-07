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
