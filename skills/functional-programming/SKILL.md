---
name: functional-programming
description: 使用函数式编程工具（map、filter、reduce、group、omit、unique）进行数据转换和操作。构建可组合的、不可变的数据操作。
---

# 函数式编程技能

## 何时使用此技能

当你需要以下操作时使用此技能：
- **转换数据**（map、filter、reduce）
- **按属性或条件分组** 项目
- **从对象中移除属性**
- **在数组中找到唯一项**
- **将操作组合** 成管道
- **使用不可变数据** 模式

## 快速入门

```typescript
import { groupBy } from '@x-oasis/group-by';
import { omit } from '@x-oasis/omit';
import { uniqueArrayObject } from '@x-oasis/unique-array-object';
import { eachArray } from '@x-oasis/each';

// 分组项目
const users = [
  { id: 1, role: 'admin', name: 'John' },
  { id: 2, role: 'user', name: 'Jane' },
  { id: 3, role: 'admin', name: 'Bob' },
];

const byRole = groupBy(users, 'role');
// { admin: [{id: 1, ...}, {id: 3, ...}], user: [{id: 2, ...}] }

// 移除属性
const userWithoutId = omit(users[0], ['id']);
// { role: 'admin', name: 'John' }

// 获取唯一项
const uniqueRoles = uniqueArrayObject(
  users.map(u => ({ role: u.role }))
);
// [{ role: 'admin' }, { role: 'user' }]

// 使用索引迭代
eachArray(users, (user, index) => {
  console.log(`${index}: ${user.name}`);
});
```

## 可用工具

| 函数 | 目的 | 用例 |
|----------|---------|----------|
| `groupBy(array, key)` | 按属性分组项目 | 分析、报告 |
| `omit(object, keys)` | 移除属性 | 隐私、过滤 |
| `uniqueArrayObject(array)` | 对象去重 | 去重 |
| `eachArray(array, fn)` | 带索引迭代 | 处理 |
| `findLastIndex(array, fn)` | 从末尾查找 | 反向搜索 |

## 模式 1：按分组

```typescript
import { groupBy } from '@x-oasis/group-by';

// 按用户分组交易
const transactions = [
  { user: 'alice', amount: 100 },
  { user: 'bob', amount: 50 },
  { user: 'alice', amount: 75 },
];

const byUser = groupBy(transactions, 'user');
// {
//   alice: [{ user: 'alice', amount: 100 }, ...],
//   bob: [{ user: 'bob', amount: 50 }]
// }
```

**真实例子：汇总数据**

```typescript
import { groupBy } from '@x-oasis/group-by';

function summarizeSales(sales: Sale[]) {
  const byProduct = groupBy(sales, 'product');

  return Object.entries(byProduct).map(([product, items]) => ({
    product,
    total: items.reduce((sum, item) => sum + item.price, 0),
    count: items.length,
    average: items.reduce((sum, item) => sum + item.price, 0) / items.length,
  }));
}
```

## 模式 2：对象属性过滤

```typescript
import { omit } from '@x-oasis/omit';

// 在发送到客户端前移除敏感字段
const user = {
  id: 1,
  name: 'John',
  email: 'john@example.com',
  passwordHash: 'xxx', // 敏感！
  apiKey: 'secret', // 敏感！
};

const safeUser = omit(user, ['passwordHash', 'apiKey']);
// { id: 1, name: 'John', email: 'john@example.com' }
```

**真实例子：API 响应清理**

```typescript
import { omit } from '@x-oasis/omit';

async function getUserData(userId: string) {
  const user = await db.users.findById(userId);

  // 返回前移除内部字段
  return omit(user, [
    'passwordHash',
    'internalId',
    'createdAt',
    'lastModified'
  ]);
}
```

## 模式 3：唯一项

```typescript
import { uniqueArrayObject } from '@x-oasis/unique-array-object';

// 移除重复对象
const tags = [
  { name: 'javascript', count: 10 },
  { name: 'typescript', count: 5 },
  { name: 'javascript', count: 10 }, // 重复
];

const uniqueTags = uniqueArrayObject(tags);
// [
//   { name: 'javascript', count: 10 },
//   { name: 'typescript', count: 5 }
// ]
```

**真实例子：搜索建议**

```typescript
import { uniqueArrayObject } from '@x-oasis/unique-array-object';

function getSuggestions(searchHistory: SearchEntry[]) {
  // 用户搜索相同的东西多次
  // 仅返回唯一建议
  const queries = searchHistory.map(entry => ({
    query: entry.query,
    timestamp: entry.timestamp
  }));

  return uniqueArrayObject(queries).slice(0, 10);
}
```

## 模式 4：函数管道

```typescript
import { groupBy } from '@x-oasis/group-by';
import { omit } from '@x-oasis/omit';

// 链接操作
function processUserData(users: User[]) {
  // 1. 过滤
  const active = users.filter(u => u.isActive);

  // 2. 映射
  const mapped = active.map(u => ({
    id: u.id,
    displayName: u.name.toUpperCase(),
  }));

  // 3. 分组
  const grouped = groupBy(mapped, 'displayName');

  // 4. 移除内部字段
  return Object.entries(grouped).map(([name, items]) => ({
    displayName: name,
    count: items.length,
    users: items.map(u => omit(u, ['temp', 'debug'])),
  }));
}
```

## 模式 5：使用分组的 Reduce

```typescript
import { groupBy } from '@x-oasis/group-by';

// 计算每组的统计
const orders = [
  { customer: 'alice', amount: 100 },
  { customer: 'bob', amount: 50 },
  { customer: 'alice', amount: 75 },
  { customer: 'bob', amount: 200 },
];

const byCustomer = groupBy(orders, 'customer');

const stats = Object.entries(byCustomer).map(([customer, items]) => ({
  customer,
  total: items.reduce((sum, o) => sum + o.amount, 0),
  average: items.reduce((sum, o) => sum + o.amount, 0) / items.length,
  max: Math.max(...items.map(o => o.amount)),
  min: Math.min(...items.map(o => o.amount)),
}));
```

## 模式 6：数据迁移/转换

```typescript
import { omit } from '@x-oasis/omit';
import { groupBy } from '@x-oasis/group-by';

// 旧格式 → 新格式
interface OldUser {
  id: number;
  firstName: string;
  lastName: string;
  internalRef?: string;
}

interface NewUser {
  userId: number;
  fullName: string;
}

function migrateUsers(oldUsers: OldUser[]): NewUser[] {
  return oldUsers
    .map(user => ({
      userId: user.id,
      fullName: `${user.firstName} ${user.lastName}`,
    }))
    .filter(user => user.fullName.length > 0);
}

// 移除已弃用的字段
function cleanupLegacyData(data: any) {
  const legacyFields = ['deprecated_field', 'old_format', 'temp_data'];
  return data.map(item => omit(item, legacyFields));
}
```

## 模式 7：带上下文迭代

```typescript
import { eachArray } from '@x-oasis/each';

// 带索引和父上下文迭代
const items = ['apple', 'banana', 'cherry'];

eachArray(items, (item, index) => {
  console.log(`${index + 1}. ${item}`);
});
// 输出：
// 1. apple
// 2. banana
// 3. cherry
```

**真实例子：位置感知处理**

```typescript
import { eachArray } from '@x-oasis/each';

function formatList(items: string[], maxPerLine = 3) {
  let line = '';

  eachArray(items, (item, index) => {
    line += item;

    if ((index + 1) % maxPerLine === 0) {
      console.log(line);
      line = '';
    } else {
      line += ', ';
    }
  });

  if (line) console.log(line);
}
```

## 模式 8：反向搜索

```typescript
import { findLastIndex } from '@x-oasis/find-last-index';

// 从末尾查找
const logs = [
  { level: 'info', msg: '已启动' },
  { level: 'info', msg: '处理中' },
  { level: 'error', msg: '失败' },
  { level: 'info', msg: '重试中' },
];

const lastError = findLastIndex(
  logs,
  log => log.level === 'error'
);

console.log(`最后错误在索引：${lastError}`); // 2
```

## 模式 9：组合转换

```typescript
import { groupBy } from '@x-oasis/group-by';
import { omit } from '@x-oasis/omit';
import { uniqueArrayObject } from '@x-oasis/unique-array-object';

// 创建可重用的转换管道
class DataProcessor {
  private transformations: Array<(data: any) => any> = [];

  filter(predicate: (item: any) => boolean) {
    this.transformations.push(data => data.filter(predicate));
    return this;
  }

  map(fn: (item: any) => any) {
    this.transformations.push(data => data.map(fn));
    return this;
  }

  groupBy(key: string) {
    this.transformations.push(data => groupBy(data, key));
    return this;
  }

  omitFields(keys: string[]) {
    this.transformations.push(data =>
      Array.isArray(data)
        ? data.map(item => omit(item, keys))
        : omit(data, keys)
    );
    return this;
  }

  execute(data: any) {
    return this.transformations.reduce((acc, fn) => fn(acc), data);
  }
}

// 使用
const result = new DataProcessor()
  .filter(user => user.isActive)
  .map(user => ({ ...user, name: user.name.toUpperCase() }))
  .omitFields(['password', 'secret'])
  .execute(users);
```

## 最佳实践

### ✅ 做法

```typescript
// 有效地组合操作
const result = groupBy(
  users.filter(u => u.active).map(u => omit(u, ['temp'])),
  'role'
);

// 使用 groupBy 进行聚合
const summary = Object.entries(groupBy(sales, 'region')).map(
  ([region, items]) => ({
    region,
    total: items.sum(s => s.amount),
  })
);

// 在传输前移除敏感数据
const safe = omit(user, ['passwordHash', 'apiKey', 'internalId']);
```

### ❌ 不做法

```typescript
// 不要改变原始数据
users.forEach(u => u.id = null); // 错！

// 做法：
const updated = users.map(u => omit(u, ['id']));

// 不要创建不必要的中间数组
const all = [];
for (const item of items) {
  all.push(item);
}
// 改用 groupBy 直接
```

## 常见陷阱

### 陷阱 1：忘记不可变性

```typescript
// ❌ 改变原始对象
const user = { id: 1, name: 'John', secret: 'xxx' };
delete user.secret;
return user; // 原始被改变！

// ✅ 创建新对象
import { omit } from '@x-oasis/omit';
return omit(user, ['secret']); // 原始未改变
```

### 陷阱 2：groupBy 缺失键

```typescript
// ❌ 如果某些项没有分组键怎么办？
const items = [
  { type: 'A', value: 1 },
  { value: 2 }, // 缺少 'type'
];
groupBy(items, 'type');
// 'undefined' 成为分组键！

// ✅ 过滤或提供默认值
const filtered = items.filter(i => i.type);
groupBy(filtered, 'type');
```

### 陷阱 3：唯一比较

```typescript
// ❌ 具有相同值的对象不被去重
const items = [
  { id: 1, name: 'A' },
  { id: 1, name: 'A' }, // 看起来相同但不同引用
];
uniqueArrayObject(items); // 可能不去重！

// ✅ 确保一致的对象创建
const items = items.map(i => ({ id: i.id, name: i.name }));
// 现在一致的引用被去重
```

## 参考资料

- [groupBy 实现](../../references/group-by-impl.md)
- [对象不可变性模式](../../references/immutability.md)
- [函数组合](../../references/function-composition.md)
- [性能考虑](../../references/fp-performance.md)
