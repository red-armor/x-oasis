import { ReconnectPolicy } from '../types';

/**
 * A policy that never attempts to reconnect.
 *
 * Use this for connections that should fail permanently on the first
 * disconnect (e.g., one-shot tasks or background imports).
 */
export class NeverReconnectPolicy implements ReconnectPolicy {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nextRetryDelayMs(_context: any): null {
    return null;
  }
}
