# @x-oasis/async-call-rpc-react

React Query integration for [`@x-oasis/async-call-rpc`](../async-call-rpc/).

Provides `createRPCReact()` — a factory that generates type-safe React hooks (`useQuery`, `useMutation`, `useSubscription`) backed by an RPC proxy client.

## 安装

```bash
pnpm add @x-oasis/async-call-rpc-react @x-oasis/async-call-rpc @tanstack/react-query react
```

## 快速开始

```tsx
import { WebSocketChannel, clientHost } from '@x-oasis/async-call-rpc';
import { createRPCReact } from '@x-oasis/async-call-rpc-react';

// 定义远程服务接口
type FileService = {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(dir: string): Promise<string[]>;
};

// 创建 RPC 客户端
const ws = new WebSocket('ws://localhost:3456');
const channel = new WebSocketChannel(ws, { name: 'client' });
const fileClient = clientHost.registerClient('file-service', { channel });

// 创建类型安全的 hooks
const fileRPC = createRPCReact<FileService>(fileClient);

function FileViewer({ path }: { path: string }) {
  // useQuery — 自动缓存、去重、刷新
  const { data, isLoading, error } = fileRPC.useQuery('readFile', [path]);

  // useMutation — 写操作
  const writeMutation = fileRPC.useMutation('writeFile', {
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: fileRPC.getQueryKey('readFile', path),
      });
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <pre>{data}</pre>
      <button
        onClick={() => writeMutation.mutate([path, 'new content'])}
        disabled={writeMutation.isPending}
      >
        Save
      </button>
    </div>
  );
}
```

## API

| Hook / 方法                               | 说明                                            |
| ----------------------------------------- | ----------------------------------------------- |
| `useQuery(method, args, options?)`        | 查询，queryKey 自动为 `[path, method, ...args]` |
| `useMutation(method, options?)`           | 写操作                                          |
| `useSubscription(method, args, options?)` | 订阅流式数据，数据推入 query cache              |
| `getQueryKey(method, ...args)`            | 生成 queryKey，用于手动 `invalidateQueries`     |
| `proxy`                                   | 底层的 RPC 代理对象                             |

## Peer Dependencies

| 包                        | 版本      |
| ------------------------- | --------- |
| `@x-oasis/async-call-rpc` | workspace |
| `@tanstack/react-query`   | >= 5.0.0  |
| `react`                   | >= 17.0.0 |

## License

ISC
