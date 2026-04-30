# x-oasis 技能索引

按用例和问题域组织的所有可用技能完整指南。

## 📚 可用技能

### 核心技能（7 个技能）

#### 1. **类型验证** - `type-validation`
在处理前检查和验证类型

- 何时使用：表单验证、API 输入检查、边界情况处理
- 包：`@x-oasis/is-*`（is-empty、is-class、is-promise、is-object 等）
- 关键概念：类型守卫、防御性编程
- [阅读完整技能 →](./type-validation/SKILL.md)

#### 2. **请求限流** - `request-throttling`
控制昂贵操作的频率

- 何时使用：搜索输入、滚动处理器、调整大小事件、API 速率限制
- 包：`@x-oasis/debounce`、`@x-oasis/throttle`、`@x-oasis/batchinator`
- 关键概念：防抖 vs 节流 vs 批处理、性能优化
- [阅读完整技能 →](./request-throttling/SKILL.md)

#### 3. **事件管理** - `event-management`
构建发布-订阅系统并管理订阅

- 何时使用：自定义事件、组件通信、生命周期管理
- 包：`@x-oasis/emitter`、`@x-oasis/disposable`
- 关键概念：内存泄漏防止、事件链、清理模式
- [阅读完整技能 →](./event-management/SKILL.md)

#### 4. **流处理** - `stream-processing`
处理异步数据流和服务器发送事件

- 何时使用：大文件上传、实时数据、SSE API、数据管道
- 包：`@x-oasis/web-stream`、`@x-oasis/push-stream`、`@x-oasis/event-stream`
- 关键概念：异步迭代、背压、流处理模式
- [阅读完整技能 →](./stream-processing/SKILL.md)

#### 5. **变化检测** - `change-detection`
追踪状态之间的变化

- 何时使用：撤销/重做、文档同步、视觉回归、变化跟踪
- 包：`@x-oasis/diff-match-patch`、`@x-oasis/html-fragment-diff`、`@x-oasis/map-diff-range`
- 关键概念：差异、补丁、范围映射、协作编辑
- [阅读完整技能 →](./change-detection/SKILL.md)

#### 6. **对象比较** - `object-comparison`
高效比较对象和数组

- 何时使用：记忆化、条件渲染、变化检测、测试
- 包：`@x-oasis/shallow-equal`、`@x-oasis/shallow-array-equal`、`@x-oasis/is-clamped`
- 关键概念：浅相等 vs 深相等、性能优化
- [阅读完整技能 →](./object-comparison/SKILL.md)

#### 7. **函数式编程** - `functional-programming`
使用纯函数转换数据

- 何时使用：数据管道、过滤、映射、聚合、去重
- 包：`@x-oasis/group-by`、`@x-oasis/omit`、`@x-oasis/unique-array-object`、`@x-oasis/each`
- 关键概念：不可变性、函数组合、数据转换
- [阅读完整技能 →](./functional-programming/SKILL.md)

---

## 🎯 按问题快速导航

### "我的组件重新渲染太多了"
→ **对象比较** - 使用浅相等检查  
→ **请求限流** - 防抖昂贵的更新

### "用户输入产生太多 API 调用"
→ **请求限流** - 防抖搜索、节流滚动  
→ **类型验证** - 发送前验证

### "我需要追踪编辑以实现撤销/重做"
→ **变化检测** - 差异和补丁  
→ **事件管理** - 发出变化事件

### "处理大文件/流"
→ **流处理** - 使用异步迭代  
→ **请求限流** - 批处理分块

### "构建发布-订阅/事件系统"
→ **事件管理** - 发射器和一次性订阅  
→ **函数式编程** - 映射和过滤事件

### "需要报告数据"
→ **函数式编程** - 按分组、聚合  
→ **对象比较** - 去重

### "处理实时更新（WebSocket、SSE）"
→ **流处理** - 解析事件  
→ **事件管理** - 发出给订阅者  
→ **变化检测** - 追踪变化

### "数据验证和错误处理"
→ **类型验证** - 提前检查类型  
→ **流处理** - 在流中处理错误

---

## 📊 按包覆盖的技能

### 断言包（10 个包）
- `is-empty` - isEmpty 检查
- `is-class` - 类检测
- `is-promise` - Promise 检测
- `is-object` - 对象类型检查
- `is-primitive` - 基本类型检测
- `is-primitive-empty` - 空基本类型
- `is-nan` - NaN 处理
- `is-ref` - 引用检查
- `is-ascii` - ASCII 字符串验证
- `is` - Object.is 多填充

**使用者：** 类型验证技能

### 异步包（2 个包）
- `async-call-rpc` - 跨进程通信
- `async-call-rpc-react` - React 集成

**使用者：** 事件管理、流处理

### 比较包（5 个包）
- `shallow-equal` - 对象相等性
- `shallow-array-equal` - 数组相等性
- `is-clamped` - 范围检查
- `clamp` - 值约束
- `resolve-changed` - 变化检测

**使用者：** 对象比较、变化检测

### 调度包（4 个包）
- `debounce` - 等待暂停
- `throttle` - 定期执行
- `batchinator` - 批处理操作
- `batchinate-last` - 最后项目批处理

**使用者：** 请求限流

### 流包（3 个包）
- `web-stream` - Web 流工具
- `push-stream` - 手动流控制
- `event-stream` - 事件聚合

**使用者：** 流处理

### 事件包（2 个包）
- `emitter` - 事件发射器
- `disposable` - 资源清理

**使用者：** 事件管理

### 差异包（3 个包）
- `diff-match-patch` - 文本差异
- `html-fragment-diff` - HTML 差异
- `map-diff-range` - 范围映射

**使用者：** 变化检测

### 函数式包（6 个包）
- `group-by` - 分组
- `omit` - 属性移除
- `unique-array-object` - 去重
- `each` - 迭代
- `find-last-index` - 反向搜索
- 更多...

**使用者：** 函数式编程

---

## 🚀 快速入门

### 选择你的路径

**路径 1：我在构建 React 应用**
1. 从 **对象比较** 开始（记忆化）
2. 添加 **请求限流**（优化）
3. 使用 **类型验证**（安全）

**路径 2：我需要实时功能**
1. 从 **流处理** 开始（数据管道）
2. 添加 **事件管理**（发布-订阅）
3. 使用 **变化检测**（追踪）

**路径 3：我在构建数据工具**
1. 从 **函数式编程** 开始（转换）
2. 添加 **变化检测**（差异）
3. 使用 **对象比较**（去重）

**路径 4：通用 JavaScript/TypeScript 开发**
1. 从 **类型验证** 开始（安全编码）
2. 添加 **请求限流**（性能）
3. 使用 **对象比较**（状态管理）

---

## 💡 常见模式

### 模式：变化跟踪系统
```typescript
// 类型验证（输入安全）
// + 事件管理（通知订阅者）  
// + 变化检测（追踪差异）
// = 完整变化跟踪
```

### 模式：高性能 UI
```typescript
// 对象比较（记忆化）
// + 请求限流（防抖更新）
// + 流处理（大数据）
// = 优化渲染
```

### 模式：实时协作
```typescript
// 流处理（数据管道）
// + 变化检测（差异/补丁）
// + 事件管理（同步事件）
// = 协作编辑
```

### 模式：数据管道
```typescript
// 函数式编程（转换）
// + 请求限流（批处理）
// + 流处理（异步）
// = 可扩展数据处理
```

---

## 📖 学习路径

**初级：**
1. 类型验证 - 理解类型安全
2. 对象比较 - 了解浅相等 vs 深相等
3. 请求限流 - 处理高频事件

**中级：**
1. 事件管理 - 构建事件系统
2. 函数式编程 - 数据转换
3. 变化检测 - 追踪修改

**高级：**
1. 流处理 - 处理异步数据
2. 复杂事件链 - 多技能集成
3. 性能优化 - 组合技术

---

## 🔗 跨技能集成示例

### 示例 1：自动保存表单
```typescript
// 类型验证 - 验证表单输入
// 请求限流 - 防抖 API 调用
// 对象比较 - 检测是否改变
// = 自动保存功能
```

### 示例 2：实时搜索
```typescript
// 类型验证 - 验证查询
// 请求限流 - 防抖 API 调用
// 流处理 - 处理结果流
// = 实时搜索
```

### 示例 3：协作编辑器
```typescript
// 事件管理 - 同步事件
// 变化检测 - 追踪差异
// 流处理 - 处理更新流
// 函数式编程 - 转换数据
// = 协作编辑
```

---

## 📚 API 快速参考

### 类型验证
```typescript
isEmpty(value)
isClass(fn)
isPromise(value)
isObject(value)
isPrimitive(value)
is(a, b) // Object.is 多填充
```

### 请求限流
```typescript
debounce(fn, delay)
throttle(fn, interval)
batchinator(fn, {maxSize, timeout})
```

### 事件管理
```typescript
new Emitter<T>()
emitter.subscribe(listener)
new DisposableStore()
store.add(subscription)
store.dispose()
```

### 流处理
```typescript
toAsyncIterable(readableStream)
new PushStream<T>()
parseJsonEventStream(body)
async for (const item of stream) { }
```

### 变化检测
```typescript
new DiffMatchPatch()
dmp.diff_main(a, b)
dmp.patch_make(a, b)
diffHtmlFragment(html1, html2)
mapDiffRange(oldText, newText, range)
```

### 对象比较
```typescript
shallowEqual(obj1, obj2)
shallowArrayEqual(arr1, arr2)
isClamped(value, min, max)
clamp(value, min, max)
```

### 函数式编程
```typescript
groupBy(array, key)
omit(object, keys)
uniqueArrayObject(array)
eachArray(array, fn)
findLastIndex(array, predicate)
```

---

## ✅ 技能检查清单

- [ ] 阅读所有 7 个技能
- [ ] 理解每个技能 2-3 个模式
- [ ] 尝试整合 2 个技能
- [ ] 使用 3+ 个技能构建迷你项目
- [ ] 按需参考技能

---

## 🤔 常见问题

**问：我如何选择使用哪个技能？**
答：看你的问题域。如果是验证输入 → 类型验证。频繁事件 → 请求限流。管理状态改变 → 变化检测。

**问：我可以组合技能吗？**
答：是的！大多数实际应用程序使用 2-3+ 个技能组合。查看上面的跨技能集成示例。

**问：我应该先学哪个技能？**
答：从类型验证或请求限流开始 - 它们立即有用且有明确好处。

**问：如果某个技能没有覆盖我的用例怎么办？**
答：技能可以组合。大多数复杂功能使用 3-4 个技能协同工作。

**问：这些技能是独立的吗？**
答：基本上是，但它们结合使用效果更好。它们遵循类似的模式并相互使用工具。

---

## 📖 资源

- 每个技能在其 SKILL.md 文件中都有详细文档
- 参考 SKILL.md 获取：模式、示例、最佳实践、陷阱
- 参考 references/ 子目录获取技术细节
- 查看 examples/ 文件夹获取完整代码示例

---

**后续步骤：**
1. 选择你正在解决的问题
2. 在「问题导航」部分找到它
3. 阅读推荐的技能
4. 将模式应用到你的代码
5. 按需参考
