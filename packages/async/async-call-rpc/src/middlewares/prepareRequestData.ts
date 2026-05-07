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
