---
name: event-management
description: 使用发射器和一次性订阅管理事件和订阅。处理事件清理、内存泄漏和复杂事件流。
---

# 事件管理技能

## 何时使用此技能

当你需要以下操作时使用此技能：
- **创建可观察事件系统**（发布-订阅模式）
- **管理订阅生命周期**（订阅、取消订阅）
- **防止内存泄漏** 来自忘记的监听器
- **处理清理** 当组件卸载时
- **链接事件** 在复杂流中
- **使用 DOM 或自定义事件** 以结构化方式

## 快速入门

```typescript
import { Emitter } from '@x-oasis/emitter';
import { DisposableStore } from '@x-oasis/disposable';

// 创建发射器
const emitter = new Emitter<string>();

// 订阅事件
const listener = (data: string) => console.log(data);
const dispose = emitter.subscribe(listener);

// 发出事件
emitter.emit('Hello');

// 完成时清理
dispose();

// 或使用 DisposableStore 管理多个订阅
const store = new DisposableStore();

store.add(emitter.subscribe(() => console.log('事件 1')));
store.add(emitter.subscribe(() => console.log('事件 2')));
store.add(emitter.subscribe(() => console.log('事件 3')));

// 一次性清理所有
store.dispose();
```

## 可用工具

| 类 | 目的 | 用例 |
|-------|---------|----------|
| `Emitter<T>` | 事件发射器 | 发布-订阅 |
| `DisposableStore` | 管理一次性订阅 | 清理多个订阅 |
| `Disposable` | 资源清理 | 追踪单个资源 |

## 模式 1：基础发射器

```typescript
import { Emitter } from '@x-oasis/emitter';

// 为用户事件创建发射器
const userEvents = new Emitter<{ id: string; action: string }>();

// 订阅
const unsubscribe = userEvents.subscribe((event) => {
  console.log(`用户 ${event.id} 做了 ${event.action}`);
});

// 发出
userEvents.emit({ id: '123', action: 'login' });
userEvents.emit({ id: '123', action: 'logout' });

// 清理
unsubscribe();
```

## 模式 2：用于清理的 DisposableStore

```typescript
import { Emitter } from '@x-oasis/emitter';
import { DisposableStore } from '@x-oasis/disposable';

class ChatComponent {
  private disposables = new DisposableStore();
  private messages = new Emitter<string>();

  constructor() {
    // 订阅多个事件
    this.disposables.add(
      this.messages.subscribe((msg) => {
        this.displayMessage(msg);
      })
    );

    this.disposables.add(
      window.addEventListener('beforeunload', () => {
        // 页面卸载时清理
        this.disposables.dispose();
      })
    );
  }

  sendMessage(text: string) {
    this.messages.emit(text);
  }

  // 在组件卸载时调用
  cleanup() {
    this.disposables.dispose();
  }
}
```

## 模式 3：事件链

```typescript
import { Emitter } from '@x-oasis/emitter';

// 创建事件链：输入 → 验证 → 转换 → 输出
const input = new Emitter<string>();
const validated = new Emitter<string>();
const transformed = new Emitter<{ original: string; upper: string }>();

// 链 1：验证
input.subscribe((value) => {
  if (value.length > 0) {
    validated.emit(value);
  }
});

// 链 2：转换
validated.subscribe((value) => {
  transformed.emit({
    original: value,
    upper: value.toUpperCase(),
  });
});

// 订阅最终事件
transformed.subscribe((result) => {
  console.log('最终：', result);
});

// 使用
input.emit('hello'); // → 最终：{ original: 'hello', upper: 'HELLO' }
input.emit(''); // 无输出（验证失败）
```

## 模式 4：DOM 事件包装

```typescript
import { Emitter, fromDomEvent } from '@x-oasis/emitter';

// 在发射器中包装 DOM 事件
const clickEvent = fromDomEvent(button, 'click');
const scrollEvent = fromDomEvent(window, 'scroll');

clickEvent.subscribe(() => {
  console.log('按钮被点击');
});

scrollEvent.subscribe((event) => {
  console.log('滚动：', (event as any).target.scrollY);
});
```

## 模式 5：事件过滤

```typescript
import { Emitter } from '@x-oasis/emitter';

class EventBus {
  private emitter = new Emitter<{ type: string; payload: any }>();

  // 监听特定事件类型
  on<T = any>(type: string, listener: (payload: T) => void) {
    return this.emitter.subscribe((event) => {
      if (event.type === type) {
        listener(event.payload);
      }
    });
  }

  emit<T = any>(type: string, payload: T) {
    this.emitter.emit({ type, payload });
  }
}

// 使用
const bus = new EventBus();

bus.on('user:login', (user) => {
  console.log('登录：', user.name);
});

bus.on('user:logout', () => {
  console.log('退出');
});

bus.emit('user:login', { name: 'John', id: 1 });
bus.emit('user:logout', {});
```

## 模式 6：一次性监听器

```typescript
import { Emitter } from '@x-oasis/emitter';

class EventEmitter<T> {
  private emitter = new Emitter<T>();

  subscribe(listener: (event: T) => void) {
    return this.emitter.subscribe(listener);
  }

  // 监听一次然后自动取消订阅
  once(listener: (event: T) => void) {
    const disposable = this.emitter.subscribe((event) => {
      listener(event);
      disposable(); // 第一次调用后取消订阅
    });
    return disposable;
  }

  emit(event: T) {
    this.emitter.emit(event);
  }
}

// 使用
const emitter = new EventEmitter<string>();

emitter.once((msg) => {
  console.log('第一条消息：', msg); // 仅一次
});

emitter.emit('Hello'); // 日志
emitter.emit('Hello again'); // 无日志
```

## 模式 7：React 集成

```typescript
import { useEffect, useState } from 'react';
import { Emitter } from '@x-oasis/emitter';

// 在组件外创建发射器
const notificationEmitter = new Emitter<{ type: string; message: string }>();

function useNotifications() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const dispose = notificationEmitter.subscribe((notif) => {
      setNotifications((prev) => [...prev, notif]);
      
      // 3 秒后自动移除
      setTimeout(() => {
        setNotifications((prev) =>
          prev.filter((n) => n !== notif)
        );
      }, 3000);
    });

    return dispose; // 卸载时清理
  }, []);

  return notifications;
}

function MyApp() {
  const notifications = useNotifications();

  return (
    <div>
      {notifications.map((notif, i) => (
        <div key={i} className={`notif notif-${notif.type}`}>
          {notif.message}
        </div>
      ))}
      <button
        onClick={() =>
          notificationEmitter.emit({
            type: 'success',
            message: '已保存！',
          })
        }
      >
        保存
      </button>
    </div>
  );
}
```

## 模式 8：错误处理

```typescript
import { Emitter } from '@x-oasis/emitter';

class SafeEmitter<T> {
  private emitter = new Emitter<T>();

  subscribe(
    listener: (event: T) => void,
    errorHandler?: (error: Error) => void
  ) {
    return this.emitter.subscribe((event) => {
      try {
        listener(event);
      } catch (error) {
        if (errorHandler) {
          errorHandler(error as Error);
        } else {
          console.error('事件监听器错误：', error);
        }
      }
    });
  }

  emit(event: T) {
    this.emitter.emit(event);
  }
}

// 使用
const emitter = new SafeEmitter<string>();

emitter.subscribe(
  (msg) => {
    throw new Error('哎呀');
  },
  (error) => {
    console.error('捕获：', error.message);
  }
);

emitter.emit('test');
```

## 最佳实践

### ✅ 做法

```typescript
// 始终处理订阅
const dispose = emitter.subscribe(handler);
// ... 稍后 ...
dispose();

// 使用 DisposableStore 处理多个订阅
const store = new DisposableStore();
store.add(emitter1.subscribe(handler1));
store.add(emitter2.subscribe(handler2));
store.dispose(); // 清理所有

// 在组件清理中处理
useEffect(() => {
  const dispose = emitter.subscribe(handler);
  return () => dispose(); // 清理
}, []);
```

### ❌ 不做法

```typescript
// 不要忘记处理
emitter.subscribe(handler); // 内存泄漏！

// 不要在无清理的情况下持有引用
listeners.push(emitter.subscribe(handler));
// 如果 listeners 数组无限增长呢？

// 不要在循环中订阅而无清理
for (const item of items) {
  emitter.subscribe(handler); // 多个订阅！
}
```

## 常见陷阱

### 陷阱 1：内存泄漏

```typescript
// ❌ 忘记取消订阅
useEffect(() => {
  emitter.subscribe((event) => {
    setState(event);
  });
  // 缺少清理函数！
}, []);

// ✅ 始终返回清理函数
useEffect(() => {
  const dispose = emitter.subscribe((event) => {
    setState(event);
  });
  return () => dispose();
}, []);
```

### 陷阱 2：卸载后订阅

```typescript
// ❌ 竞态条件
useEffect(() => {
  setTimeout(() => {
    emitter.subscribe(handler); // 在组件卸载后订阅！
  }, 100);
}, []);

// ✅ 也清理计时器
useEffect(() => {
  const timeoutId = setTimeout(() => {
    emitter.subscribe(handler);
  }, 100);
  return () => clearTimeout(timeoutId);
}, []);
```

### 陷阱 3：监听器上下文丢失

```typescript
// ❌ 监听器中 'this' 未定义
class Component {
  private count = 0;

  constructor() {
    emitter.subscribe(this.handleEvent); // this 丢失！
  }

  private handleEvent(event: any) {
    this.count++; // 错误：undefined
  }
}

// ✅ 绑定或使用箭头函数
class Component {
  private count = 0;

  constructor() {
    // 选项 1：绑定
    emitter.subscribe(this.handleEvent.bind(this));
    
    // 选项 2：箭头函数
    emitter.subscribe((event) => this.handleEvent(event));
  }

  private handleEvent(event: any) {
    this.count++;
  }
}
```

## 高级模式

### 高级 1：类型安全事件总线

```typescript
import { Emitter } from '@x-oasis/emitter';

interface EventMap {
  'user:login': { userId: string };
  'user:logout': { userId: string };
  'message:new': { text: string; from: string };
}

class TypedEventBus {
  private emitters = new Map<string, Emitter<any>>();

  on<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void
  ) {
    if (!this.emitters.has(event as string)) {
      this.emitters.set(event as string, new Emitter<EventMap[K]>());
    }
    return this.emitters.get(event as string)!.subscribe(listener);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]) {
    this.emitters.get(event as string)?.emit(payload);
  }
}

// 使用 - 类型安全！
const bus = new TypedEventBus();

bus.on('user:login', (payload) => {
  console.log(payload.userId); // ✅ TypeScript 知道 userId 存在
});

bus.emit('user:login', { userId: '123' }); // ✅ 类型检查
// bus.emit('user:login', { wrongField: '123' }); // ❌ 错误
```

### 高级 2：事件防抖

```typescript
import { Emitter } from '@x-oasis/emitter';
import { debounce } from '@x-oasis/debounce';

class DebouncedEmitter<T> {
  private emitter = new Emitter<T>();

  private debouncedEmit = debounce((event: T) => {
    this.emitter.emit(event);
  }, 300);

  subscribe(listener: (event: T) => void) {
    return this.emitter.subscribe(listener);
  }

  emit(event: T) {
    this.debouncedEmit(event);
  }
}

// 使用
const emitter = new DebouncedEmitter<string>();
emitter.subscribe((msg) => console.log('发出：', msg));

emitter.emit('fast');
emitter.emit('fast');
emitter.emit('fast');
// 输出一次：「发出：fast」（在 300ms 无活动后）
```

## 参考资料

- [发射器实现](../../references/emitter-reference.md)
- [一次性订阅模式](../../references/disposable-patterns.md)
- [内存泄漏防止](../../references/memory-leaks.md)
- [事件总线模式](../../references/event-bus.md)
