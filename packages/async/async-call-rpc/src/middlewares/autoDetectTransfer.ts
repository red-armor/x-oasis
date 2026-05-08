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
