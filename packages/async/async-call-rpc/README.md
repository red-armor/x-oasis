# @x-oasis/async-call-rpc

## Installation

```bash
$ npm i @x-oasis/async-call-rpc
```

## How to use

```typescript
import { 
  serviceProvider,
  ProxyRPCClient,
  WorkerChannel,
} from '@x-oasis/async-call-rpc'

const workerChannel = new WorkerChannel()

// service 是跟channel绑定的；他们共享一个channel
const serviceHost = serviceHost.registerService(
  servicePath,
  channel
)

// service
serviceHost.registerServiceHandler(handlerPath, service)

// client
const rpcClient = new ProxyRPCClient(
  servicePath,
  channel
)

clientHost.registerClient(rpcClient)

const client = clientHost.getClient(servicePath)

```

## How to run test

```bash
$ pnpm test
```

- `IMessageChannel`: 是最基本的，需要外部进行实现的
- `AbstractChannelProtocol`: 这个是应用context消费的；它是所有Channel的一个抽象；里面包含了handleMessage, middlewares 等一系列能力。