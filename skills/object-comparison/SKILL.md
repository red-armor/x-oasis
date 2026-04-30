---
name: object-comparison
description: 使用浅相等和深相等检查高效比较对象和数组。对于记忆化、变化检测和条件渲染至关重要。
---

# 对象比较技能

## 何时使用此技能

当你需要以下操作时使用此技能：
- **优化渲染**（React：shouldComponentUpdate、useMemo）
- **检测数据变化** 而无需深入检查
- **在变化检测中比较状态之前/之后**
- **基于参数变化记忆函数结果**
- **在反应系统中防止不必要的更新**
- **在测试中验证数据相等**

## 快速入门

```typescript
import { shallowEqual } from '@x-oasis/shallow-equal';
import { shallowArrayEqual } from '@x-oasis/shallow-array-equal';
import { isClamped } from '@x-oasis/is-clamped';

// 浅对象比较
const obj1 = { a: 1, b: { c: 2 } };
const obj2 = { a: 1, b: { c: 2 } };

shallowEqual(obj1, obj2); // false（b 引用不同对象）

// 浅数组比较
const arr1 = [1, 2, { x: 3 }];
const arr2 = [1, 2, { x: 3 }];

shallowArrayEqual(arr1, arr2); // false（同样的原因）

// 值范围检查
isClamped(5, 0, 10); // true
isClamped(15, 0, 10); // false
```

## 可用工具

| 函数 | 目的 | 速度 | 深? |
|----------|---------|-------|-------|
| `shallowEqual` | 比较对象 | ⚡⚡ | 否 |
| `shallowArrayEqual` | 比较数组 | ⚡⚡ | 否 |
| `isClamped` | 检查范围 | ⚡⚡⚡ | 不适用 |
| `layoutEqual` | 比较布局 | ⚡ | 否 |

## 模式 1：浅相等

```typescript
import { shallowEqual } from '@x-oasis/shallow-equal';

// 如果所有顶级值是 === 则对象相等
const user1 = { id: 1, name: 'John', tags: ['admin'] };
const user2 = { id: 1, name: 'John', tags: ['admin'] };

shallowEqual(user1, user2);
// false（tags 数组是不同引用）

// 但这是相等的：
const tagsArray = ['admin'];
const user3 = { id: 1, name: 'John', tags: tagsArray };
const user4 = { id: 1, name: 'John', tags: tagsArray };

shallowEqual(user3, user4); // true（相同 tags 引用）
```

**真实例子：React 优化**

```typescript
import { memo } from 'react';
import { shallowEqual } from '@x-oasis/shallow-equal';

const UserCard = memo(
  ({ user }) => <div>{user.name}</div>,
  (prevProps, nextProps) => {
    // 如果道具相等返回 true（跳过重新渲染）
    return shallowEqual(prevProps, nextProps);
  }
);
```

## 模式 2：数组相等

```typescript
import { shallowArrayEqual } from '@x-oasis/shallow-array-equal';

// 如果长度相同且所有元素是 === 则数组相等
const arr1 = [1, 2, 3];
const arr2 = [1, 2, 3];

shallowArrayEqual(arr1, arr2); // false（不同数组实例）

// 但：
const arr = [1, 2, 3];
const arr3 = arr;
const arr4 = arr;

shallowArrayEqual(arr3, arr4); // true（相同引用）
```

**真实例子：React 中的依赖数组**

```typescript
import { useMemo } from 'react';
import { shallowArrayEqual } from '@x-oasis/shallow-array-equal';

function MyComponent({ items }) {
  const memoizedItems = useMemo(() => {
    return items.filter(item => item.active);
  }, [items]);

  // 如果 items 数组浅相等则跳过重新计算
  // 即使使用相同的值重新创建 items
}
```

## 模式 3：范围检查

```typescript
import { isClamped, clamp } from '@x-oasis/is-clamped';

// 检查值是否在范围 [min, max]
isClamped(50, 0, 100); // true
isClamped(150, 0, 100); // false
isClamped(-10, 0, 100); // false

// 或将值限制到范围
clamp(150, 0, 100); // 100
clamp(-10, 0, 100); // 0
clamp(50, 0, 100); // 50
```

**真实例子：滑块/输入验证**

```typescript
import { isClamped, clamp } from '@x-oasis/is-clamped';

function handleSliderChange(value: number) {
  const valid = isClamped(value, MIN_VALUE, MAX_VALUE);

  if (!valid) {
    // 限制到有效范围
    value = clamp(value, MIN_VALUE, MAX_VALUE);
  }

  setValue(value);
}
```

## 模式 4：记忆化与相等

```typescript
import { shallowEqual } from '@x-oasis/shallow-equal';

class MemoCache<T, R> {
  private cache: { args: T; result: R } | null = null;

  compute(args: T, fn: (args: T) => R): R {
    // 如果参数未改变（浅）则跳过
    if (this.cache && shallowEqual(this.cache.args, args)) {
      return this.cache.result;
    }

    const result = fn(args);
    this.cache = { args, result };
    return result;
  }
}

// 使用
const cache = new MemoCache();

const selector = (state) => state.user.name;

const result1 = cache.compute(
  { user: { name: 'John' } },
  selector
); // 已计算

const result2 = cache.compute(
  { user: { name: 'John' } }, // 相同值
  selector
); // 已缓存！（因为浅相等）
```

## 模式 5：变化检测

```typescript
import { shallowEqual } from '@x-oasis/shallow-equal';

class StateManager<T> {
  private state: T;
  private listeners: ((state: T) => void)[] = [];

  constructor(initial: T) {
    this.state = initial;
  }

  setState(newState: T) {
    // 仅在实际改变时通知（浅检查）
    if (!shallowEqual(this.state, newState)) {
      this.state = newState;

      // 通知所有监听器
      this.listeners.forEach(listener => listener(this.state));
    }
  }

  subscribe(listener: (state: T) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getState() {
    return this.state;
  }
}

// 使用
const store = new StateManager({ count: 0 });

store.subscribe(state => {
  console.log('状态改变：', state);
});

store.setState({ count: 0 }); // 无通知（浅相等）
store.setState({ count: 1 }); // 通知触发
```

## 模式 6：条件渲染

```typescript
import { shallowEqual } from '@x-oasis/shallow-equal';

function UserProfile({ previousUser, currentUser }) {
  if (shallowEqual(previousUser, currentUser)) {
    return <p>无改变</p>;
  }

  return (
    <div>
      <h2>用户已改变！</h2>
      {currentUser.name !== previousUser.name && (
        <p>名称：{previousUser.name} → {currentUser.name}</p>
      )}
      {currentUser.email !== previousUser.email && (
        <p>邮箱：{previousUser.email} → {currentUser.email}</p>
      )}
    </div>
  );
}
```

## 模式 7：深相等（手动）

```typescript
import { shallowEqual } from '@x-oasis/shallow-equal';

// 对于需要深相等的情况
function deepEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;

  if (typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }

  if (a === null || b === null) {
    return false;
  }

  // 先检查浅（快速路径）
  if (!shallowEqual(a, b)) {
    return false;
  }

  // 如果浅相等，检查嵌套对象
  for (const key in a) {
    if (!deepEqual(a[key], b[key])) {
      return false;
    }
  }

  return true;
}

// 使用
deepEqual(
  { a: 1, b: { c: 2 } },
  { a: 1, b: { c: 2 } }
); // true（深相等）
```

## 模式 8：不重新渲染时选择

```typescript
import { selectValue } from '@x-oasis/select-value';
import { shallowEqual } from '@x-oasis/shallow-equal';

function useSelectorOptimized<T, S>(
  state: T,
  selector: (state: T) => S
) {
  const [selected, setSelected] = useState<S | undefined>();

  useEffect(() => {
    const newSelected = selector(state);

    // 仅在选中值改变时更新
    if (!shallowEqual(selected, newSelected)) {
      setSelected(newSelected);
    }
  }, [state, selector]);

  return selected;
}

// 使用：仅当 user.name 改变时组件重新渲染
function UserName({ userId }) {
  const user = useSelectorOptimized(
    store.getState(),
    state => ({ name: state.users[userId]?.name })
  );

  return <div>{user?.name}</div>;
}
```

## 最佳实践

### ✅ 做法

```typescript
// 为性能关键代码使用浅相等
if (shallowEqual(prevData, newData)) {
  return; // 跳过重新渲染
}

// 与实际值组合以获得精确改变
if (shallowEqual(props, prevProps)) {
  // 道具未改变（浅）
  return prevResult;
}

// 使用 clamp 进行 UI 约束
const value = clamp(userInput, MIN, MAX);

// 创建记忆化选择器
const getActiveUsers = (state) => {
  return state.users.filter(u => u.active);
};
```

### ❌ 不做法

```typescript
// 不要对深嵌套对象使用浅相等
const equal = shallowEqual(
  { a: { b: { c: 1 } } },
  { a: { b: { c: 1 } } }
); // false！（嵌套对象不同）

// 不要用对象比较数组
shallowEqual([1, 2], [1, 2]); // 可能失败

// 不要假设浅相等处理所有情况
// 有时你需要深相等
```

## 常见陷阱

### 陷阱 1：混淆浅 vs 深

```typescript
// ❌ 浅不检查嵌套值
const obj1 = { user: { id: 1 } };
const obj2 = { user: { id: 2 } }; // 不同 id！

shallowEqual(obj1, obj2); // false（相同对象引用）
// 但如果 user.id 不同！

// ✅ 使用深相等或检查特定属性
if (obj1.user.id !== obj2.user.id) {
  // 处理改变
}
```

### 陷阱 2：数组 vs 对象比较

```typescript
// ❌ 混合比较
const result = shallowEqual(
  [1, 2, 3],
  { 0: 1, 1: 2, 2: 3 }
); // 可能给出意外结果

// ✅ 使用适当的函数
const arrayResult = shallowArrayEqual([1, 2], [1, 2]);
const objectResult = shallowEqual({ a: 1 }, { a: 1 });
```

### 陷阱 3：记忆化失效

```typescript
// ❌ 每次渲染创建新对象
function MyComponent(props) {
  const config = { timeout: 1000 }; // 每次新对象！

  return (
    <Child
      config={config}
      onChange={handleChange}
    />
  );
}
// 子看到 config 总是改变

// ✅ 记忆化 config
const DEFAULT_CONFIG = { timeout: 1000 };

function MyComponent(props) {
  return (
    <Child
      config={DEFAULT_CONFIG}
      onChange={handleChange}
    />
  );
}
```

## 参考资料

- [浅相等算法](../../references/shallow-equal-impl.md)
- [深相等比较](../../references/deep-equal.md)
- [React 记忆化指南](../../references/react-memoization.md)
- [性能含义](../../references/comparison-perf.md)
