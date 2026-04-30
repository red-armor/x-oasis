---
name: type-validation
description: 使用 x-oasis 类型检查工具（is-empty、is-class、is-primitive 等）验证 JavaScript/TypeScript 中的值和类型。防御性编程和处理用户输入的必要条件。
---

# 类型验证技能

## 何时使用此技能

当你需要以下操作时使用此技能：
- **验证用户输入** 在处理前（表单提交、API 参数）
- **类型守卫** 在条件逻辑中（检查值是否为数组、对象、基本类型）
- **处理边界情况**（null、undefined、空值）
- **创建实用函数** 需要类型断言
- **提高代码安全** 在动态 JavaScript 环境中

## 快速入门

```typescript
import { isEmpty } from '@x-oasis/is-empty';
import { isPromise } from '@x-oasis/is-promise';
import { isClass } from '@x-oasis/is-class';

// 检查值是否为空
if (isEmpty(value)) {
  console.log('值为空');
}

// 检查值是否为 Promise
if (isPromise(result)) {
  result.then(data => console.log(data));
}

// 检查值是否为类（不是函数）
if (isClass(MyClass)) {
  const instance = new MyClass();
}
```

## 可用类型检查器

| 函数 | 目的 | 示例 |
|----------|---------|---------|
| `is(x, y)` | Object.is 多填充（处理 NaN、-0） | `is(NaN, NaN)` → true |
| `isEmpty(value)` | 检查值是否为空 | `isEmpty([])`, `isEmpty('')`, `isEmpty(null)` |
| `isClass(fn)` | 区分类和函数 | `isClass(class Foo {})` → true |
| `isObject(value)` | 检查是否为纯对象 | `isObject({})` → true, `isObject([])` → false |
| `isPrimitive(value)` | 检查是否为基本类型 | `isPrimitive(123)` → true |
| `isPrimitiveEmpty(value)` | 检查是否为空基本类型 | `isPrimitiveEmpty('')` → true |
| `isNaN(value)` | 正确的 NaN 检查 | `isNaN(NaN)` → true |
| `isPromise(value)` | 检查是否为 Promise 状 | `isPromise(Promise.resolve())` → true |
| `isRef(value)` | 检查是否为对象引用 | `isRef({})` → true |
| `isAscii(str)` | 检查是否为 ASCII 字符串 | `isAscii('hello')` → true |

## 常见模式

### 模式 1：输入验证

```typescript
import { isEmpty, isObject } from '@x-oasis/is-empty';

function processData(input) {
  // 验证输入存在
  if (isEmpty(input)) {
    throw new Error('输入不能为空');
  }

  // 验证输入是对象
  if (!isObject(input)) {
    throw new Error('输入必须是对象');
  }

  // 安全处理
  return Object.keys(input);
}
```

### 模式 2：类型守卫

```typescript
import { isPromise, isPrimitive } from '@x-oasis/is-promise';

function handleResult(result) {
  if (isPromise(result)) {
    return result.then(value => processValue(value));
  } else if (isPrimitive(result)) {
    return processValue(result);
  } else {
    // 它是对象
    return Object.values(result).map(processValue);
  }
}
```

### 模式 3：安全导航

```typescript
import { isEmpty } from '@x-oasis/is-empty';

// 安全地访问嵌套属性
function getValue(obj, path) {
  let current = obj;
  
  for (const key of path.split('.')) {
    if (isEmpty(current) || typeof current !== 'object') {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
}
```

### 模式 4：React 条件渲染

```typescript
import { isEmpty, isClass } from '@x-oasis/is-empty';

function MyComponent({ data, Component }) {
  // 如果数据为空不渲染
  if (isEmpty(data)) {
    return <p>无数据</p>;
  }

  // 仅当 Component 是类组件时才渲染
  if (isClass(Component)) {
    return <Component data={data} />;
  }

  return <Component data={data} />;
}
```

### 模式 5：API 响应验证

```typescript
import { isEmpty, isObject, isPrimitive } from '@x-oasis/is-empty';

async function fetchAndValidate(url) {
  const response = await fetch(url);
  const data = await response.json();

  // 验证响应结构
  if (isEmpty(data)) {
    throw new Error('响应为空');
  }

  if (!isObject(data) && !Array.isArray(data)) {
    throw new Error('期望对象或数组');
  }

  return data;
}
```

## 最佳实践

### ✅ 做法

```typescript
// 访问前检查
if (!isEmpty(user)) {
  console.log(user.name);
}

// 用于默认值
const value = isEmpty(input) ? defaultValue : input;

// 结合检查以清晰
if (isObject(config) && !isEmpty(config.options)) {
  applyConfig(config.options);
}
```

### ❌ 不做法

```typescript
// 不要在未检查的情况下假设类型
console.log(value.length); // 如果值为 null 可能崩溃

// 不要在 isEmpty 中使用 ==
if (value == null) { } // 改用 isEmpty(value)

// 不要混合不同的验证方法
if (Array.isArray(arr) && isEmpty(arr)) { } // 不一致
```

## 常见陷阱

### 陷阱 1：NaN 比较

```typescript
// ❌ 错：NaN !== NaN
if (value === NaN) { }

// ✅ 对：使用 isNaN 或 is()
import { isNaN, is } from '@x-oasis/is-nan';
if (isNaN(value)) { }
if (is(value, NaN)) { }
```

### 陷阱 2：空字符串 vs 假值

```typescript
// ❌ 这些不同
const empty1 = value === ''; // 字符串特定
const empty2 = !value; // 任何假值（包括 0、false）

// ✅ 使用 isEmpty 以明确意图
import { isEmpty } from '@x-oasis/is-empty';
const empty3 = isEmpty(value); // 更清晰的意图
```

### 陷阱 3：对象类型混淆

```typescript
// ❌ 数组也是 typeof 'object'
if (typeof value === 'object') {
  // 可能是数组、null 或对象！
}

// ✅ 使用 isObject 获得纯对象
import { isObject } from '@x-oasis/is-empty';
if (isObject(value)) {
  // 现在保证是纯对象
}
```

### 陷阱 4：类 vs 函数

```typescript
// ❌ 无法区分类和函数
function MyClass() {}
class ActualClass {}
// typeof 显示两者都为 'function'

// ✅ 使用 isClass
import { isClass } from '@x-oasis/is-class';
isClass(MyClass); // false（构造函数）
isClass(ActualClass); // true（ES6 类）
```

## 高级用法

### 高级 1：自定义验证链

```typescript
import { isEmpty, isObject, isPrimitive } from '@x-oasis/is-empty';

class Validator {
  constructor(value) {
    this.value = value;
  }

  notEmpty() {
    if (isEmpty(this.value)) {
      throw new Error('值为空');
    }
    return this;
  }

  isObject() {
    if (!isObject(this.value)) {
      throw new Error('值不是对象');
    }
    return this;
  }

  validate() {
    return this.value;
  }
}

// 使用
const data = new Validator(userInput)
  .notEmpty()
  .isObject()
  .validate();
```

### 高级 2：类型判别器

```typescript
import { isPromise, isPrimitive, isObject } from '@x-oasis/is-empty';

type Result<T> = T | Promise<T> | { error: string };

function discriminate<T>(result: Result<T>) {
  if (isPromise(result)) {
    return 'async';
  } else if (isObject(result) && 'error' in result) {
    return 'error';
  } else if (isPrimitive(result)) {
    return 'primitive';
  } else {
    return 'object';
  }
}
```

### 高级 3：条件类型强制

```typescript
import { isEmpty, isPrimitive, isObject } from '@x-oasis/is-empty';

function coerceToArray(value) {
  if (isEmpty(value)) {
    return [];
  }

  if (isPrimitive(value)) {
    return [value];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (isObject(value)) {
    return Object.values(value);
  }

  return [];
}

// 使用
coerceToArray(null); // []
coerceToArray(42); // [42]
coerceToArray({ a: 1, b: 2 }); // [1, 2]
```

## 性能注意事项

- 所有类型检查都是 **O(1) 操作**（瞬间）
- 可安全在紧密循环中使用
- `isEmpty` 检查多个条件，但仍然非常快
- 没有外部依赖

## 集成示例

### 使用 React

```typescript
import { isEmpty } from '@x-oasis/is-empty';

function UserProfile({ user }) {
  if (isEmpty(user)) return <LoadingSpinner />;

  return <div>{user.name}</div>;
}
```

### 使用 Express.js

```typescript
import { isObject } from '@x-oasis/is-empty';

app.post('/api/data', (req, res) => {
  if (!isObject(req.body)) {
    return res.status(400).json({ error: '无效负载' });
  }
  // 处理
});
```

### 使用表单验证

```typescript
import { isEmpty } from '@x-oasis/is-empty';

function validateForm(data) {
  const errors = {};

  if (isEmpty(data.email)) {
    errors.email = '电子邮件必填';
  }

  if (isEmpty(data.password)) {
    errors.password = '密码必填';
  }

  return Object.keys(errors).length === 0 ? null : errors;
}
```

## 参考资料

- [is-empty 实现](../../references/type-validation-reference.md)
- [isClass 边界情况](../../references/class-detection.md)
- [NaN 处理指南](../../references/nan-handling.md)
