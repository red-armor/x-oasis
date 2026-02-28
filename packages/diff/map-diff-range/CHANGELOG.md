# @x-oasis/map-diff-range

## 0.2.5

### Patch Changes

- 680fc8f: fix lint issue
- 56f3afd: fix lint
- 0d5e07c: update di

## 0.2.4

### Patch Changes

- 9280368: fix [...newSet(list)] issue

## 0.2.3

### Patch Changes

- ef364cf: fix html diff

## 0.2.2

### Patch Changes

- fbf782d: fix html diff

## 0.2.1

### Patch Changes

- cfaacab: bump version diff html

## 0.2.0

### Minor Changes

- c16e063: bump version

### Patch Changes

- f7a393b: bump diff range
- b666c87: bump next
- a33ef8e: bump version
- 8256c76: bump version
- 33888cc: permission

## 0.1.0

### Initial Release

- 实现基于 diff-match-patch 的 range 映射功能
- 提供 `mapNewerRangeToOlder` 和 `mapOlderRangeToNewer` 函数用于双向 range 映射
- 提供 `analyzeFragmentChange` 函数用于片段级变更分析
- 提供 `resolveGroupChangeFragments` 函数用于三路变更解析（originalContent → currentContent → finalContent）
- 支持变更类型检测（equal、onlyDeletion、onlyInsertion、replacement）
- 自动生成语义化变更摘要
- 提供完整的交互式示例（React + Vite）
- 支持 GitHub Pages 部署
