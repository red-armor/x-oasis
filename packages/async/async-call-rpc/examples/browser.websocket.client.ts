/**
 * Browser WebSocket Client Example
 *
 * Connects to the Node.js WebSocket server and demonstrates:
 * - RPC calls (query-style)
 * - Error handling with RPCError
 * - Bidirectional communication
 *
 * Usage:
 *   1. Start the server:  npx tsx examples/node.websocket.server.ts
 *   2. Serve this dir:    npx serve examples
 *   3. Open test-websocket.html in a browser
 */

import {
  WebSocketChannel,
  serviceHost,
  clientHost,
  RPCError,
} from '../src/index';

// ---- Define the server-side interface (for documentation) ----

type ServerMethods = {
  now(): Promise<number>;
  echo(x: unknown): Promise<unknown>;
  add(a: number, b: number): Promise<number>;
  greet(name: string): Promise<string>;
};

// ---- Connect ----

const ws = new WebSocket('ws://localhost:3456');

const channel = new WebSocketChannel(ws as any, {
  name: 'ws-client',
});

ws.addEventListener('open', () => {
  console.log('[Client] Connected');

  // Register a local service for bidirectional RPC
  const service = serviceHost.registerService('client', {
    clientInfo: () => ({
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    }),
  });
  service.setChannel(channel);

  // Create a typed RPC proxy
  const client = clientHost
    .registerClient('server', { channel })
    .createProxy<ServerMethods>();

  // Expose to console for manual testing
  (window as any).server = client;

  runTests(client);
});

ws.addEventListener('error', () => {
  console.error('[Client] Connection failed. Is the server running?');
});

ws.addEventListener('close', (e) => {
  console.log('[Client] Disconnected', { code: e.code, wasClean: e.wasClean });
});

// ---- Tests ----

async function runTests(client: ServerMethods) {
  console.log('=== RPC Tests ===');

  try {
    const echo = await client.echo('Hello!');
    console.log('echo:', echo);

    const time = await client.now();
    console.log('now:', new Date(time).toLocaleString());

    const sum = await client.add(17, 25);
    console.log('add(17, 25):', sum);

    const greeting = await client.greet('World');
    console.log('greet:', greeting);

    console.log('All tests passed');
  } catch (err) {
    if (err instanceof RPCError) {
      console.error(`RPC Error [${err.code}]: ${err.message}`, err.data);
    } else {
      console.error('Unexpected error:', err);
    }
  }
}
