import { RequestType, ResponseType, DeserializedMessageOutput } from '../types';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';
import { RPCError, JSONRPCErrorCode } from '../error';

/**
 * Handle Response middleware: Routes and processes RPC responses.
 *
 * This middleware is a critical part of the client-side receiving pipeline.
 * It handles:
 *
 * 1. **Request/Response Detection**: Distinguishes responses from requests
 * 2. **Deferred Resolution**: Matches responses to pending requests using seqId
 * 3. **Response Type Handling**: Different handling for success, failure, subscriptions
 * 4. **Transferable Object Handling**: Special case for MessagePort responses
 * 5. **Subscription Management**: Ongoing streams vs one-shot requests
 * 6. **Event Listener Routing**: Callback-style event methods
 *
 * ## Middleware chain context:
 *
 * normalize → deserialize → handleResponse ← YOU ARE HERE
 *                             ↓
 *                         Business logic
 *
 * At this point, the message is fully deserialized and ready for routing.
 *
 * ## Critical: Handling Transferable Objects (MessagePort)
 *
 * When a remote method returns a MessagePort:
 *
 * 1. Sender calls endpoint.acquirePort() expecting MessagePort return
 * 2. Server returns MessagePort with ResponseType.PortSuccess
 * 3. Server sends with transfer: [messagePort]
 * 4. Receiver gets message.ports = [messagePort]
 * 5. handleResponse must use message.ports[0] as the resolved value
 *
 * Example:
 * ```typescript
 * // Server side (main process)
 * interface Service {
 *   acquirePort(): MessagePort;
 * }
 *
 * // Client side (renderer process)
 * const port = await endpoint.service.acquirePort();
 * // handleResponse receives:
 * // - message.data = [["ps", "123"], null] (PortSuccess type)
 * // - message.ports = [messagePort] (transferred object)
 * // - handleResponse resolves with: message.ports[0]
 * ```
 *
 * ## Response Type Categories:
 *
 * 1. **PortSuccess** ("ps")
 *    - Return value is a single Transferable object
 *    - Resolve with: message.ports[0]
 *
 * 1b. **PortArraySuccess** ("pas")
 *    - Return value is an array of Transferable objects
 *    - Resolve with: message.ports (full array)
 *
 * 2. **ReturnSuccess** ("rs")
 *    - Normal return value (not Transferable)
 *    - Resolve with: body[0]
 *    - May contain nested Transferables (handled by deserialize)
 *
 * 3. **ReturnFail** ("rf")
 *    - Remote method threw an error
 *    - Reject with: RPCError
 *    - Body contains error details
 *
 * 4. **SubscriptionStopped** ("ss")
 *    - Server ended a subscription
 *    - Clean up listener
 *    - No data to process
 *
 * 5. **EventMethodStopped** ("evt-stopped")
 *    - Server ended an event method
 *    - Clean up listener
 *    - No data to process
 *
 * ## Error Handling Pattern:
 *
 * ```
 * ResponseType.PortSuccess:
 *   ✓ Resolve with message.ports[0]
 *   ✓ This is a single Transferable object (MessagePort)
 *
 * ResponseType.PortArraySuccess:
 *   ✓ Resolve with message.ports
 *   ✓ This is an array of Transferable objects
 *
 * ResponseType.ReturnSuccess:
 *   ✓ Resolve with body[0]
 *   ✓ This is the regular return value
 *
 * ResponseType.ReturnFail:
 *   ✓ Reject with RPCError wrapping error details
 *   ✓ Error code, message, and data from remote exception
 * ```
 *
 * ## Subscription vs One-Shot Request:
 *
 * The deferred object may have an _isSubscription flag:
 *
 * - **One-Shot Request**: Delete deferred when response arrives
 * - **Subscription**: Keep deferred, route data via event listener
 *
 * ## Critical Implementation Notes:
 *
 * 1. **message.ports** comes from the normalize middleware
 *    - DO NOT assume it exists if something goes wrong upstream
 *    - Check if message && message.ports before accessing
 *
 * 2. **PortSuccess / PortArraySuccess use message.ports**
 *    - PortSuccess → ports[0] (single Transferable)
 *    - PortArraySuccess → ports (array of Transferables)
 *    - This is the key difference from ReturnSuccess
 *
 * 3. **Preserve error handling chain**
 *    - Subscription errors reject the deferred
 *    - One-shot errors reject the deferred
 *    - Always clean up tracking structures
 *
 * 4. **Handle missing deferred gracefully**
 *    - Response might arrive after request timeout
 *    - Check if deferred exists before using
 *    - Look for event listeners as fallback
 */
export const handleResponse =
  (protocol: AbstractChannelProtocol) =>
  (message: DeserializedMessageOutput) => {
    if (!message) return message;
    const { data, ports } = message;
    const header = data[0];
    const body = data[1];
    const type = header[0] as any;

    // STEP 1: Check if this is a request (not a response)
    // Requests come from the remote side, responses are replies to our requests
    // If this is a request, pass it through unchanged (other middleware will handle it)
    if (Object.values(RequestType).includes(type)) {
      return message;
    }

    // STEP 2: Extract sequence ID for matching with pending requests
    // seqId is how we know which request this response belongs to
    const seqId = header[1];

    // STEP 3: Handle SubscriptionStopped — the server ended a subscription
    if (type === ResponseType.SubscriptionStopped) {
      const sub = protocol.subscriptions.get(`${seqId}`);
      if (sub) {
        // The server-side subscription is done; clean up client-side tracking
        protocol.subscriptions.delete(`${seqId}`);
      }
      // Also notify any subscription listener
      const listener = protocol.requestEvents.get(`${seqId}`);
      if (listener && typeof listener._onComplete === 'function') {
        listener._onComplete();
      }
      protocol.requestEvents.delete(`${seqId}`);
      return null;
    }

    // STEP 4: Try to find the deferred that's waiting for this response
    // If we sent a request, we stored a Deferred in ongoingRequests
    const findDefer = protocol.ongoingRequests.get(`${seqId}`);

    if (findDefer) {
      // Check if this deferred is for a subscription (has _isSubscription flag)
      const isSubscription = (findDefer as any)._isSubscription;

      if (isSubscription) {
        // SUBSCRIPTION RESPONSE HANDLING:
        // For subscriptions, we don't delete the deferred — the stream continues
        // Route data to the subscription listener instead

        if (type === ResponseType.ReturnFail) {
          // Subscription error — clean up and reject
          const rawError = body[0];
          const rpcError = new RPCError({
            code: rawError?.code ?? JSONRPCErrorCode.InternalError,
            message: rawError?.message ?? 'Remote procedure call failed',
            data: rawError?.data,
          });
          protocol.ongoingRequests.delete(`${seqId}`);
          findDefer.reject(rpcError);
        } else if (type === ResponseType.ReturnSuccess) {
          // Subscription data — notify via the event listener
          const listener = protocol.requestEvents.get(`${seqId}`);
          if (listener && typeof listener === 'function') {
            listener(body[0]);
          }
        }
      } else {
        // ONE-SHOT REQUEST RESPONSE HANDLING:
        // For normal requests, delete the deferred when response arrives
        protocol.ongoingRequests.delete(`${seqId}`);

        // CRITICAL: Handle Transferable return values.
        // The ResponseType distinguishes the original return shape:
        //   - PortSuccess      → single Transferable:  resolve(ports[0])
        //   - PortArraySuccess → array of Transferables: resolve(ports)
        if (type === ResponseType.PortSuccess) {
          findDefer.resolve(ports && ports[0]);
        } else if (type === ResponseType.PortArraySuccess) {
          findDefer.resolve(ports || []);
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
    } else {
      // STEP 5: No deferred found, try to route to event listener
      // This happens for callback-style event methods (e.g., onSomething callbacks)
      const findListener = protocol.requestEvents.get(`${seqId}`);

      if (findListener) {
        if (typeof findListener === 'function') {
          // Simple callback function: call with body data
          findListener(...body);
        } else if (typeof findListener._onData === 'function') {
          // Structured subscription listener with _onData callback
          if (type === ResponseType.ReturnFail) {
            // Error in event method
            const rawError = body[0];
            const rpcError = new RPCError({
              code: rawError?.code ?? JSONRPCErrorCode.InternalError,
              message: rawError?.message ?? 'Remote procedure call failed',
              data: rawError?.data,
            });
            findListener._onError?.(rpcError);
          } else {
            // Data event: call the _onData callback
            findListener._onData(body[0]);
          }
        }
      }
    }
    return null;
  };
