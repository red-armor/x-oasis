# Examples

Practical examples of using async-call-rpc with different transports and patterns.

## Basic MessagePort Example

```typescript
import { RPCService } from '@x-oasis/async-call-rpc/core';
import { MessageChannel } from '@x-oasis/async-call-rpc-web/core';

// Define your service
class MathService {
  add(a: number, b: number): number {
    return a + b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }
}

// Create MessageChannel and RPC
const { port1, port2 } = new MessageChannel();
const channel = new MessageChannel({ port: port1 });
const rpc = new RPCService(MathService, { channel });

// Use the RPC
const result = await rpc.add(5, 3);
console.log(result); // 8
```

## Node.js Child Process Example

```typescript
// parent.ts
import { fork } from 'child_process';
import { NodeProcessChannel } from '@x-oasis/async-call-rpc-node/core';
import { RPCService } from '@x-oasis/async-call-rpc/core';

class DataService {
  async fetchData(id: number) {
    // Simulate async work
    return { id, data: 'result' };
  }
}

const child = fork('./worker.js');
const channel = new NodeProcessChannel({
  process: child,
  identifier: 'parent',
  description: 'parent→child',
});

const rpc = new RPCService(DataService, { channel });

// Call worker methods
const data = await rpc.fetchData(42);
console.log(data);

// Clean up
child.kill();
```

```typescript
// worker.js (child process)
import { NodeProcessChannel } from '@x-oasis/async-call-rpc-node/core';
import { RPCService } from '@x-oasis/async-call-rpc/core';

class DataService {
  async fetchData(id: number) {
    // Some async work
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { id, data: `result for ${id}` };
  }
}

const channel = new NodeProcessChannel({
  process: process,
  identifier: 'worker',
  description: 'child→parent',
});

const service = new DataService();
const rpc = new RPCService(service, { channel });
```

## WebSocket Example

```typescript
import { WebSocketChannel } from '@x-oasis/async-call-rpc-web/core';
import { RPCService } from '@x-oasis/async-call-rpc/core';

class ChatService {
  async sendMessage(message: string) {
    console.log('Message received:', message);
    return { status: 'ok' };
  }
}

// Client side
const ws = new WebSocket('ws://localhost:8080');
const channel = new WebSocketChannel(ws, {
  identifier: 'client-1',
  description: 'client→server',
});

const chatRpc = new RPCService(ChatService, { channel });

// Server side (using ws library)
import WebSocket from 'ws';

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  const channel = new WebSocketChannel(ws as any, {
    identifier: 'server',
    description: 'server→client',
  });

  const service = new ChatService();
  const rpc = new RPCService(service, { channel });
});
```

## Electron IPC Example

```typescript
// Main process
import { app, BrowserWindow, ipcMain } from 'electron';
import { IPCMainChannel } from '@x-oasis/async-call-rpc-electron/electron-main/core';
import { RPCService } from '@x-oasis/async-call-rpc/core';

class FileService {
  async readFile(path: string) {
    const fs = require('fs').promises;
    return fs.readFile(path, 'utf-8');
  }

  async writeFile(path: string, content: string) {
    const fs = require('fs').promises;
    return fs.writeFile(path, content);
  }
}

app.on('ready', () => {
  const win = new BrowserWindow({
    webPreferences: { preload: './preload.js' },
  });

  const channel = new IPCMainChannel({
    channelName: 'main-channel',
    webContents: win.webContents,
    identifier: 'main',
    description: 'main→renderer',
  });

  const service = new FileService();
  const rpc = new RPCService(service, { channel });
});
```

```typescript
// Renderer process (preload.js)
import { IPCRendererChannel } from '@x-oasis/async-call-rpc-electron/electron-browser/core';
import { RPCService } from '@x-oasis/async-call-rpc/core';

class FileService {
  async readFile(path: string): Promise<string> {
    throw new Error('Not implemented');
  }
  async writeFile(path: string, content: string): Promise<void> {
    throw new Error('Not implemented');
  }
}

const channel = new IPCRendererChannel({
  channelName: 'main-channel',
  identifier: 'renderer',
  description: 'renderer→main',
});

const fileRpc = new RPCService(FileService, { channel });

// Use in renderer
const content = await fileRpc.readFile('/path/to/file.txt');
await fileRpc.writeFile('/path/to/file.txt', 'new content');
```

## Subscription/Streaming Example

```typescript
import { Event } from '@x-oasis/emitter';
import { RequestType } from '@x-oasis/async-call-rpc/core';

class DataStreamService {
  subscribeToUpdates() {
    const event = new Event<{value: number}>();

    // Simulate streaming data
    let count = 0;
    const interval = setInterval(() => {
      event.fire({ value: count++ });
      if (count >= 5) clearInterval(interval);
    }, 1000);

    return event;
  }
}

// Client
const channel = new MessageChannel(...);
const rpc = new RPCService(DataStreamService, { channel });

const stream = await rpc.subscribeToUpdates({
  requestType: RequestType.SubscriptionRequest,
});

stream.on('value', (data) => {
  console.log('Got update:', data.value);
});

// Clean up when done
stream.unsubscribe();
```

## Context Injection Example

```typescript
import { AbstractChannelProtocol } from '@x-oasis/async-call-rpc/core';

class UserService {
  // Handler receives context as 'this'
  async getUserInfo(this: any) {
    console.log('User ID:', this.userId);
    console.log('Is Admin:', this.isAdmin);
    return { id: this.userId, name: 'John' };
  }
}

const channel = new MessageChannel({
  createContext: ({ event, requestPath, methodName }) => ({
    userId: 42,
    isAdmin: event?.sender?.role === 'admin',
    timestamp: Date.now(),
  }),
});

const rpc = new RPCService(UserService, { channel });

const user = await rpc.getUserInfo();
```

## Error Handling Example

```typescript
class CalculatorService {
  divide(a: number, b: number) {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  }
}

const channel = new MessageChannel(...);
const rpc = new RPCService(CalculatorService, { channel });

try {
  const result = await rpc.divide(10, 0);
} catch (error) {
  console.error('RPC Error:', error.message);
  // "RPC Error: Division by zero"
}
```

## Custom Middleware Example

```typescript
import { AbstractChannelProtocol } from '@x-oasis/async-call-rpc/core';

// Custom logging middleware
const loggingMiddleware = (channel: AbstractChannelProtocol) => (data: any) => {
  console.log(`[${channel.identifier}]`, data);
  return data;
};

class MyChannel extends MessageChannel {
  decorateOnMessageMiddleware(middlewares) {
    return [loggingMiddleware, ...middlewares];
  }
}

// Use the custom channel
const channel = new MyChannel({ port: port1 });
const rpc = new RPCService(Service, { channel });
```

## See Also

- [Middleware Documentation](/packages/async/async-call-rpc/middleware/overview)
- [API Reference](/packages/async/async-call-rpc/api)
