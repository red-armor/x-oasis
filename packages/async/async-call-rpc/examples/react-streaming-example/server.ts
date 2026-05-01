/**
 * Subscription Streaming Server
 *
 * Demonstrates the observable/subscribe pattern for high-frequency data streams.
 * Handlers return an observable-like object with a subscribe() method.
 *
 * Usage:
 *   npx tsx server.ts
 */

import { WebSocketServer } from 'ws';
import { WebSocketChannel, serviceHost } from '@x-oasis/async-call-rpc';

const PORT = 3457;

const wss = new WebSocketServer({ port: PORT });

wss.on('listening', () => {
  console.log(`Streaming RPC server listening on ws://localhost:${PORT}`);
});

wss.on('connection', (ws) => {
  console.log('[Server] Client connected');

  const channel = new WebSocketChannel(ws as any, {
    name: 'streaming-server',
    connected: true,
  });

  channel.activate();

  serviceHost.registerService('stream', {
    channel,
    serviceHost,
    handlers: {
      /**
       * Stock ticker — pushes simulated price updates at high frequency.
       * Demonstrates continuous streaming with onData/onError/onComplete.
       */
      watchStockPrice(args: [string]) {
        const symbol = args[0] || 'ACME';
        let basePrice = 100 + Math.random() * 50;

        return {
          subscribe: (observer: {
            next?: (value: unknown) => void;
            error?: (err: Error) => void;
            complete?: () => void;
          }) => {
            console.log(
              `[Server] Subscription started: watchStockPrice(${symbol})`
            );

            const interval = setInterval(() => {
              // Random walk
              const change = (Math.random() - 0.5) * 2;
              basePrice = Math.max(1, basePrice + change);

              observer.next?.({
                symbol,
                price: Math.round(basePrice * 100) / 100,
                change: Math.round(change * 100) / 100,
                timestamp: Date.now(),
              });
            }, 500);

            return {
              unsubscribe: () => {
                console.log(
                  `[Server] Subscription stopped: watchStockPrice(${symbol})`
                );
                clearInterval(interval);
              },
            };
          },
        };
      },

      /**
       * Server log stream — pushes log entries. Demonstrates a stream that
       * eventually completes after N entries.
       */
      tailLogs(args: [number]) {
        const maxEntries = args[0] || 20;
        const levels = ['INFO', 'WARN', 'DEBUG', 'ERROR'] as const;
        const messages = [
          'Request processed',
          'Cache hit',
          'Database query executed',
          'Connection pool resized',
          'GC completed',
          'Health check passed',
          'Config reloaded',
          'Rate limit applied',
        ];

        return {
          subscribe: (observer: {
            next?: (value: unknown) => void;
            error?: (err: Error) => void;
            complete?: () => void;
          }) => {
            console.log(
              `[Server] Subscription started: tailLogs(${maxEntries})`
            );
            let count = 0;

            const interval = setInterval(() => {
              count++;
              const level = levels[Math.floor(Math.random() * levels.length)];
              const message =
                messages[Math.floor(Math.random() * messages.length)];

              observer.next?.({
                id: count,
                level,
                message,
                timestamp: new Date().toISOString(),
              });

              if (count >= maxEntries) {
                clearInterval(interval);
                observer.complete?.();
                console.log(
                  `[Server] Subscription completed: tailLogs (${count} entries)`
                );
              }
            }, 800);

            return {
              unsubscribe: () => {
                console.log(`[Server] Subscription stopped: tailLogs`);
                clearInterval(interval);
              },
            };
          },
        };
      },

      /**
       * Timer stream — counts up every second. Can be used to test
       * long-lived subscriptions and unsubscribe behavior.
       */
      timer() {
        return {
          subscribe: (observer: {
            next?: (value: unknown) => void;
            error?: (err: Error) => void;
            complete?: () => void;
          }) => {
            console.log('[Server] Subscription started: timer');
            let tick = 0;
            const interval = setInterval(() => {
              tick++;
              observer.next?.({ tick, elapsed: tick * 1000 });
            }, 1000);

            return {
              unsubscribe: () => {
                console.log('[Server] Subscription stopped: timer');
                clearInterval(interval);
              },
            };
          },
        };
      },
    },
  });

  ws.on('close', () => {
    console.log('[Server] Client disconnected');
    channel.disconnect();
  });
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  wss.close(() => process.exit(0));
});
