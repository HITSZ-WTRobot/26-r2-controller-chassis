# Component Guidelines

> React 组件的构建方式和编码规范。

---

## Component Structure

每个组件文件的标准结构：

```typescript
import { useState } from 'react';
import type { RobotState } from '../types/robot';

interface ComponentNameProps {
  state: RobotState | null;
  onAction?: () => void;
}

export function ComponentName({ state, onAction }: ComponentNameProps) {
  // 1. hooks (useState, useEffect, 自定义 hooks)
  // 2. 派生值 (useMemo, useCallback)
  // 3. 事件处理器 (handleXxx)
  // 4. 条件渲染逻辑
  // 5. return JSX
}
```

参考文件：
- `src/components/ConnectionPanel.tsx` — 典型模式示例
- `src/components/StatusDisplay.tsx` — 纯展示组件示例
- `src/components/VerticalSlider.tsx` — 复杂交互组件示例

---

## Props Conventions

### Props 接口定义

在每个组件文件顶部定义内联 `interface`：

```typescript
// 模式：组件名 + Props 后缀
interface StatusDisplayProps {
  state: RobotState | null;
}
```

### 可空 Props

接收来自后端数据的组件必须接受 `null` 并渲染骨架/占位状态：

```typescript
// 正确：接受 null 并处理空状态
export function StatusDisplay({ state }: { state: RobotState | null }) {
  if (!state) {
    return <div className="animate-pulse ...">加载中...</div>;
  }
  // 正常渲染
}
```

参考：`src/components/StatusDisplay.tsx`、`src/components/ActionStatePanel.tsx`、`src/components/ConnectionMap.tsx`

### 无 Props 组件

当组件通过 hooks 直接获取所有数据时，不接收 props：

参考：`src/components/ControlPanel.tsx` 中的 `StepControl`、`GripControl`、`SystemControl`

---

## Component Categories

### 容器组件

- 管理状态、处理副作用、调用 hooks
- 将数据向下传递给展示组件
- 参考：`src/components/Layout.tsx`、`src/App.tsx`

### 展示组件

- 纯渲染，无副作用
- 通过 props 接收所有数据
- 使用 `ITEMS`/`FIELDS`/`ROWS` 静态数组声明配置
- 参考：`src/components/ConnectionMap.tsx`（`ITEMS` 静态数组）、`src/components/StatusDisplay.tsx`（`FIELDS` 静态数组）、`src/components/ActionStatePanel.tsx`（`ROWS` 静态数组）

### 交互组件

- 管理本地 UI 状态（输入值、开关状态）
- 通过回调或 hooks 触发操作
- 参考：`src/components/VerticalSlider.tsx`、`src/components/WasdVelocityControl.tsx`

---

## Styling Patterns

### 主题颜色

**必须**使用 CSS 变量，不得使用原生 Tailwind 颜色类：

```typescript
// 正确：使用语义化 CSS 变量类
<div className="bg-surface text-text border border-border rounded-lg shadow p-4">

// 错误：不要使用原生颜色类
<div className="bg-white text-gray-900 border border-gray-200">
```

可用的语义颜色类（定义在 `src/index.css`）：
- `bg-surface` / `text-text` / `text-text-secondary`
- `bg-primary` / `text-white` / `hover:bg-primary-hover`
- `border-border`
- `accent-primary`（用于原生表单控件）

### 面板容器

一致的卡片式面板样式：

```typescript
<div className="bg-surface rounded-lg shadow p-4 border border-border">
  <h2 className="text-lg font-semibold text-text mb-3">标题</h2>
  {/* 内容 */}
</div>
```

### 输入控件

```typescript
<input className="border border-border rounded px-2 py-1 bg-surface text-text w-20 font-mono" />
```

### 深色模式

主题切换通过 `src/index.css` 中的 `prefers-color-scheme: dark` 媒体查询实现。不直接在组件中使用 `dark:` 变体。

---

## Reusable UI Primitives

可复用的 UI 辅助组件应放在 `src/components/ui/` 目录下：

| 组件 | 用途 | 当前位置 |
|------|------|----------|
| `InputRow` | 标签 + 数字输入 | `ControlPanel.tsx` (私有) |
| `NumField` | 小标签数字输入（网格布局） | `ControlPanel.tsx` (私有) |
| `SliderRow` | 标签 + 范围滑块 + 数字输入 | `ControlPanel.tsx` (私有) |
| `RadioGroup<T>` | 泛型按钮式单选组 | `ControlPanel.tsx` (私有) |

**规则**：如果同一个 UI 模式在多个文件中使用（如 `SliderRow` 模式同时出现在 `ControlPanel.tsx` 和 `WasdVelocityControl.tsx`），必须提取为 `src/components/ui/` 下的共享组件。

---

## Common Mistakes

1. **在文件中放置过多组件** — `ControlPanel.tsx` 包含 9 个组件（5 个导出 + 4 个私有），应拆分
2. **重复实现 UI 原语** — `WasdVelocityControl.tsx` 重新实现了 `SliderField`，而 `ControlPanel.tsx` 中已有 `SliderRow`
3. **省略空状态处理** — 所有接收后端数据的组件必须处理 `null` 初始状态
4. **直接调用 `invoke()` 而非通过 hooks** — `SerialDebugger.tsx` 中直接调用 `invoke('ping')` 是唯一例外，所有其他通信应通过 hooks
