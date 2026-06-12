# Quality Guidelines

> 前端代码质量标准、禁止模式和审查清单。

---

## Forbidden Patterns

### 1. 超大文件

单文件不得超过 **300 行**。当前违规：
- `src/components/ControlPanel.tsx`（~745 行）— 包含 9 个组件，需要拆分

### 2. 直接调用 `invoke()`

所有后端通信**必须**通过 hooks 封装：

```typescript
// 禁止
await invoke('send_command', { cmd: 'Ping' });

// 正确
const { send } = useCommand();
send({ type: 'Ping' });
```

当前违规：`src/components/SerialDebugger.tsx` 中直接调用 `invoke('ping')`

### 3. 重复实现已有 UI 组件

在创建新 UI 辅助组件之前，先检查是否已存在：
- `InputRow`、`NumField`、`SliderRow`、`RadioGroup` 在 `ControlPanel.tsx` 中定义
- `SliderField` 在 `WasdVelocityControl.tsx` 中重新实现 — 应使用 `SliderRow`

### 4. 原生 Tailwind 颜色类

不得使用 `text-gray-500`、`bg-white` 等原生颜色类：

```typescript
// 禁止
<div className="bg-white text-gray-900">

// 正确
<div className="bg-surface text-text">
```

所有颜色必须通过 `src/index.css` 中定义的 CSS 变量。

### 5. 默认导出

除了 `App.tsx`（入口组件），所有组件必须使用命名导出：

```typescript
// 禁止
export default function MyComponent() {}

// 正确
export function MyComponent() {}
```

### 6. 缺失空状态处理

接收后端数据的组件必须处理 `null` 初始状态。每个 `RobotState | null` 或 `ActionState | null` prop 在渲染前必须进行 null 检查。

---

## Required Patterns

### 1. Props 接口命名

```typescript
interface ComponentNameProps {
  // ...
}
```

### 2. Import 排序

外部包 → 本地模块 → 类型导入

### 3. 事件清理

所有 `listen()` 订阅和 `setInterval` 必须在 `useEffect` cleanup 中取消：

```typescript
useEffect(() => {
  const unlisten = await listen<RobotState>('robot_state_update', handler);
  return () => { unlisten(); };
}, []);
```

### 4. 类型导入

共享类型使用 `import type` 导入：

```typescript
import type { RobotState, Command } from '../types/robot';
```

---

## Testing Requirements

当前项目无自动化测试。在添加测试时：
- 组件测试：使用 React Testing Library
- Hook 测试：使用 `@testing-library/react-hooks`
- 至少覆盖关键用户交互路径

---

## Build Verification

提交前端更改前必须通过：

```bash
bun run build    # TypeScript 编译 + Vite 构建
```

构建失败 = 不能提交。

---

## Code Review Checklist

- [ ] 所有 `invoke()` 调用通过 hooks 封装
- [ ] 无原生 Tailwind 颜色类（`text-gray-*`、`bg-white` 等）
- [ ] 新 UI 组件无重复实现
- [ ] 后端数据消费组件处理了 `null` 初始状态
- [ ] 所有 `listen()` 在 cleanup 中取消订阅
- [ ] 单文件不超过 300 行
- [ ] 导出为命名导出（`App.tsx` 除外）
- [ ] Props 接口命名为 `{ComponentName}Props`
- [ ] Import 类型使用 `import type`
- [ ] `bun run build` 通过
