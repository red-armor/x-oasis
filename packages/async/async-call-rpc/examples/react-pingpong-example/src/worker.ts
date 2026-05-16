/**
 * Ping-Pong Worker — demonstrates event methods (on* pattern)
 *
 * Event methods start with "on" + uppercase letter.
 * They accept a callback and can fire it multiple times.
 * The client receives an { unsubscribe } handle to stop listening.
 */

import { serviceHost } from '@x-oasis/async-call-rpc/core';
import { WorkerChannel } from '@x-oasis/async-call-rpc-web/core';

const channel = new WorkerChannel(self, { name: 'pingpong-worker' });

// Track active intervals so we can clean up
const activeIntervals = new Map<number, ReturnType<typeof setInterval>>();
let intervalCounter = 0;

serviceHost.registerService('pingpong', {
  channel,
  serviceHost,
  handlers: {
    /**
     * Simple request/response — "ping" returns "pong"
     */
    ping(): string {
      return 'pong';
    },

    /**
     * Event method: onPing
     * Sends periodic ping events to the client.
     * The callback fires every `intervalMs` with increasing sequence numbers.
     */
    onPing(callback: (data: { seq: number; timestamp: number }) => void) {
      let seq = 0;
      const id = ++intervalCounter;
      const interval = setInterval(() => {
        seq++;
        callback({ seq, timestamp: Date.now() });
      }, 1000);
      activeIntervals.set(id, interval);
    },

    /**
     * Event method: onHeartbeat
     * Lightweight heartbeat — fires a simple "alive" signal.
     */
    onHeartbeat(callback: (beat: { alive: boolean; uptime: number }) => void) {
      const startTime = Date.now();
      const id = ++intervalCounter;
      const interval = setInterval(() => {
        callback({ alive: true, uptime: Date.now() - startTime });
      }, 2000);
      activeIntervals.set(id, interval);
    },

    /**
     * Event method: onCountdown
     * Counts down from a given number, then stops.
     * Demonstrates a finite event stream.
     */
    onCountdown(
      callback: (data: { remaining: number; done: boolean }) => void
    ) {
      let remaining = 10;
      const id = ++intervalCounter;
      const interval = setInterval(() => {
        remaining--;
        callback({ remaining, done: remaining <= 0 });
        if (remaining <= 0) {
          clearInterval(interval);
          activeIntervals.delete(id);
        }
      }, 500);
      activeIntervals.set(id, interval);
    },
  },
});
