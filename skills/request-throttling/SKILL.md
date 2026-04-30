---
name: request-throttling
description: 使用防抖、节流和批处理工具控制请求频率。处理高频事件（滚动、输入、窗口调整大小）和 API 速率限制的必要条件。
---

# 请求限流技能

## 何时使用此技能

当你需要以下操作时使用此技能：
- **减少 API 调用** 来自频繁用户事件（搜索输入、调整大小）
- **批处理操作** 以获得更好性能（数据库写入、文件上传）
- **速率限制** 昂贵的计算（调整大小计算、重新渲染）
- **改进 UX** 通过延迟工作直到用户完成交互
- **高效处理高频事件**

## 三种模式

| 模式 | 用例 | 时机 |
|---------|----------|--------|
| **防抖** | 等待用户停止 | 在 300ms 无活动后 |
| **节流** | 定期执行 | 每 100ms 无论如何 |
| **批处理** | 累积并处理 | 当批量大小达到时 |

## 快速入门

```typescript
import { debounce } from '@x-oasis/debounce';
import { throttle } from '@x-oasis/throttle';
import { batchinator } from '@x-oasis/batchinator';

// 防抖：等待用户停止输入（300ms）
const searchAPI = debounce(async (query) => {
  const results = await fetch(`/api/search?q=${query}`);
  return results.json();
}, 300);

// 当用户输入时
input.addEventListener('input', (e) => {
  searchAPI(e.target.value);
});

// 节流：最多每 100ms 执行一次
const handleScroll = throttle(() => {
  updateScrollPosition();
}, 100);

window.addEventListener('scroll', handleScroll);

// 批处理：收集项目，当批量达到大小时处理
const batch = batchinator(async (items) => {
  await database.insertMany(items);
}, { maxSize: 10, timeout: 1000 });

// 随时添加项目
batch.push(item1);
batch.push(item2);
// ... 当收集到 10 个项目或 1 秒后，调用 database.insertMany
```

## 模式 1：防抖

**何时使用**：你想等待直到用户停止做某事

```typescript
import { debounce } from '@x-oasis/debounce';

// 防抖搜索
const debouncedSearch = debounce(async (query: string) => {
  const results = await api.search(query);
  displayResults(results);
}, 300);

// 每次击键都会触发这个
input.addEventListener('input', (e) => {
  debouncedSearch(e.target.value);
});
// API 在用户停止输入 300ms 后调用一次
```

**真实例子：自动保存**

```typescript
const autoSave = debounce(async (content: string) => {
  await api.saveDraft({ content });
  showNotification('草稿已保存');
}, 1000);

editor.addEventListener('input', (e) => {
  autoSave(e.target.value);
});
// 在用户停止输入 1 秒后保存
```

## 模式 2：节流

**何时使用**：你想定期执行但不太频繁

```typescript
import { throttle } from '@x-oasis/throttle';

// 节流滚动处理
const handleScroll = throttle(() => {
  const { scrollY } = window;
  updateScrollIndicator(scrollY);
  
  // 检查是否接近底部
  if (scrollY > documentHeight - viewportHeight - 500) {
    loadMoreItems();
  }
}, 100); // 最多每 100ms

window.addEventListener('scroll', handleScroll);
// 即使滚动每秒触发 60 次，处理器最多每秒运行 10 次
```

**真实例子：调整大小跟踪**

```typescript
const trackWindowResize = throttle(() => {
  const { width, height } = window.innerWidth;
  updateLayout(width, height);
}, 200);

window.addEventListener('resize', trackWindowResize);
// 最多每 200ms 更新一次布局
```

## 模式 3：批处理

**何时使用**：你想累积项目并批量处理

```typescript
import { batchinator } from '@x-oasis/batchinator';

// 批量数据库插入
const insertBatch = batchinator(
  async (items: Item[]) => {
    await database.insertMany(items);
    console.log(`插入了 ${items.length} 项`);
  },
  {
    maxSize: 100,      // 收集 100 个项目时处理
    timeout: 5000,     // 或 5 秒，以先发生者为准
  }
);

// 随时添加项目
async function processDataStream(stream) {
  for await (const item of stream) {
    insertBatch.push(item);
    // 当批量达到 100 个或 5 秒后自动插入
  }
}
```

**真实例子：分析事件跟踪**

```typescript
const trackEvents = batchinator(
  async (events: Event[]) => {
    await analytics.send(events);
  },
  { maxSize: 50, timeout: 10000 }
);

// 追踪各种用户操作
document.addEventListener('click', (e) => {
  trackEvents.push({
    type: 'click',
    target: e.target.id,
    timestamp: Date.now(),
  });
});

document.addEventListener('change', (e) => {
  trackEvents.push({
    type: 'change',
    field: e.target.name,
    value: e.target.value,
    timestamp: Date.now(),
  });
});
// 当收集到 50 个或 10 秒后发送事件
```

## 比较防抖 vs 节流

```typescript
import { debounce } from '@x-oasis/debounce';
import { throttle } from '@x-oasis/throttle';

// 相同处理器
const logCall = () => console.log('called');

const debouncedLog = debounce(logCall, 300);
const throttledLog = throttle(logCall, 300);

// 场景：用户在 500ms 内触发事件 10 次

// 防抖结果：在 300ms 无活动后调用一次
debouncedLog(); // 1
debouncedLog(); // 排队
debouncedLog(); // 排队
// ... 在最后一次调用后等待 300ms ...
// → 大约在 500ms 时调用一次日志

// 节流结果：大约每 300ms 调用一次
throttledLog(); // 立即调用 → 日志
throttledLog(); // 排队
throttledLog(); // 排队
// ... 在 300ms 时 ...
// → 再次调用日志
// ... 在 600ms 时 ...
// → 再调用一次
// 总计：大约 3 次调用
```

## 高级模式

### 高级 1：级联防抖

```typescript
import { debounce } from '@x-oasis/debounce';

// 第一防抖：等待用户停止输入（300ms）
const updateSearchQuery = debounce(async (query: string) => {
  // 第二防抖：批处理显示结果
  const results = await api.search(query);
  updateDisplay(results);
}, 300);

// 如果需要可以取消
const cancel = updateSearchQuery.cancel?.();
```

### 高级 2：自适应节流

```typescript
import { throttle } from '@x-oasis/throttle';

function createAdaptiveThrottle(handler, minInterval) {
  let lastCall = Date.now();
  
  return throttle(() => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;
    
    // 根据设备能力调整间隔
    const isSlowDevice = navigator.deviceMemory < 4;
    const interval = isSlowDevice ? minInterval * 2 : minInterval;
    
    if (timeSinceLastCall >= interval) {
      handler();
      lastCall = now;
    }
  }, minInterval);
}

const scroll = createAdaptiveThrottle(() => {
  updateLayout();
}, 100);
```

### 高级 3：带优先级的批处理

```typescript
import { batchinator } from '@x-oasis/batchinator';

const batch = batchinator(
  async (items) => {
    // 在处理前按优先级排序
    const sorted = items.sort((a, b) => b.priority - a.priority);
    await database.insertMany(sorted);
  },
  { maxSize: 100, timeout: 5000 }
);

// 高优先级项目
batch.push({ ...item, priority: 10 });

// 普通优先级项目
batch.push({ ...item, priority: 1 });
```

## 最佳实践

### ✅ 做法

```typescript
// 为需要即时反馈的搜索防抖
const search = debounce(async (query) => {
  const results = await api.search(query);
  render(results);
}, 300);

// 节流滚动以获得平滑 60fps 体验
const handleScroll = throttle(() => {
  updateScrollIndicator();
}, Math.round(1000 / 60)); // 大约 16ms 为 60fps

// 批处理数据库操作以提高效率
const batch = batchinator(
  (items) => db.insertMany(items),
  { maxSize: 100, timeout: 5000 }
);
```

### ❌ 不做法

```typescript
// 不要防抖关键操作
const debounceDelete = debounce(() => deleteData(), 500); // 错！

// 不要节流动画（改用 requestAnimationFrame）
const throttle = throttle(() => updateAnimation(), 16);

// 不要在顺序重要时批处理
batch.push(item1);
batch.push(item2);
// 如果 item2 必须在 item1 之前处理，不要批处理
```

## 常见陷阱

### 陷阱 1：忘记后边调用

```typescript
import { debounce } from '@x-oasis/debounce';

// ❌ 默认防抖可能不在后边缘调用
const search = debounce(async (q) => {
  results = await api.search(q);
}, 300, { trailing: true }); // ✅ 确保设置后边缘

input.addEventListener('input', (e) => {
  search(e.target.value);
});
// 第一次击键停止会触发调用
```

### 陷阱 2：闭包的内存泄漏

```typescript
// ❌ 在循环中的防抖创建多个实例
for (const element of elements) {
  element.addEventListener('input', debounce((e) => {
    process(e.target.value);
  }, 300)); // 每次创建新防抖！
}

// ✅ 在外部创建防抖
const debouncedProcess = debounce((value) => process(value), 300);
for (const element of elements) {
  element.addEventListener('input', (e) => {
    debouncedProcess(e.target.value);
  });
}
```

### 陷阱 3：错误的时间参数

```typescript
// ❌ 太短 - 违反目的
const search = debounce(api.search, 50); // 用户仍在输入！

// ✅ 正确的持续时间取决于用例
// 输入：300ms
// 滚动：100ms
// 调整大小：200ms
// API 调用：500-1000ms
```

## 集成示例

### 使用 React

```typescript
import { useEffect, useRef, useState } from 'react';
import { debounce } from '@x-oasis/debounce';

function SearchComponent() {
  const [results, setResults] = useState([]);
  const searchRef = useRef(
    debounce(async (query) => {
      const data = await api.search(query);
      setResults(data);
    }, 300)
  );

  return (
    <input
      onChange={(e) => searchRef.current(e.target.value)}
      placeholder="搜索..."
    />
  );
}
```

### 使用 Vue

```typescript
import { debounce } from '@x-oasis/debounce';

export default {
  data() {
    return {
      query: '',
      results: [],
    };
  },
  methods: {
    handleSearch: debounce(function(query) {
      this.api.search(query).then(results => {
        this.results = results;
      });
    }, 300),
  },
};
```

### 使用 Svelte

```typescript
<script>
  import { debounce } from '@x-oasis/debounce';
  
  let query = '';
  let results = [];
  
  const handleSearch = debounce(async (q) => {
    results = await api.search(q);
  }, 300);
</script>

<input bind:value={query} on:input={() => handleSearch(query)} />
```

## 参考资料

- [防抖实现详情](../../references/debounce-reference.md)
- [节流 vs 防抖比较](../../references/throttle-comparison.md)
- [批处理器配置](../../references/batchinator-config.md)
- [性能考虑](../../references/throttling-perf.md)
