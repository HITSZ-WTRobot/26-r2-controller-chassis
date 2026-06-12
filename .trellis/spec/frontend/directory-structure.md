# Directory Structure

> 前端代码的文件组织和命名规范。

---

## Directory Layout

```
src/
  main.tsx                  # ReactDOM 挂载入口
  App.tsx                   # 根组件（唯一的默认导出）
  index.css                 # Tailwind v4 入口 + @theme 变量 + 浅色/深色主题
  vite-env.d.ts             # Vite 类型引用
  assets/                   # 静态资源
    react.svg
  types/
    robot.ts                # 所有共享 TypeScript 类型和接口
  hooks/
    useSerial.ts            # useSerial, useRobotState, useCommand 三个 hook
  components/
    Layout.tsx              # 应用外壳，标签导航，组合所有面板
    Tabs.tsx                # 通用标签页容器
    ConnectionPanel.tsx     # 串口端口选择 + 连接/断开
    ConnectionMap.tsx       # 子设备连接状态指示灯网格
    StatusDisplay.tsx       # RobotState 只读字段展示
    ActionStatePanel.tsx    # ActionState 字段展示
    ControlPanel.tsx        # 主控制面板（5 个导出组件 + 4 个私有辅助组件）
    VerticalSlider.tsx      # 自定义垂直滑块（完全可访问）
    WasdVelocityControl.tsx # WASD 键盘速度控制
    SerialDebugger.tsx      # 十六进制串行帧调试器
```

---

## Module Organization

- **`src/types/`** — 所有跨组件共享的 TypeScript 类型。每个概念域一个文件（目前仅 `robot.ts`）。调试专用的本地类型（如 `FrameAnalysis`）定义在使用它们的组件文件中。
- **`src/hooks/`** — 自定义 React hooks。每个文件一个概念单元。当前所有 hook 在 `useSerial.ts` 中，应按功能拆分。
- **`src/components/`** — React 组件。每个文件一个组件或紧密相关的组件组。可复用的 UI 原语应放入 `src/components/ui/`。
- **`src/assets/`** — 静态资源（图片、图标等）。

---

## Naming Conventions

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 组件文件 | `PascalCase.tsx` | `ConnectionPanel.tsx` |
| Hook 文件 | `useCamelCase.ts` | `useSerial.ts` |
| 类型文件 | `camelCase.ts` | `robot.ts` |
| 组件导出 | 命名导出 `export function Xxx` | `export function Layout` |
| Hook 导出 | 命名导出 `export function useXxx` | `export function useSerial` |
| 类型/接口 | `PascalCase` | `RobotState`, `PortInfo` |
| Props 接口 | `{ComponentName}Props` | `LayoutProps` |
| 事件处理器 | `handleXxx` | `handleConnect`, `handleKeyDown` |
| 回调函数 | `doXxx` | `doSend` |

### 导出规范

- 所有组件使用**命名导出**（`export function ComponentName`）
- `App.tsx` 是唯一的默认导出（`export default App`），这是 Vite + React 的标准入口模式
- 所有 import 使用命名导入（`import { Layout } from './components/Layout'`）

---

## 文件大小限制

- 单个文件不超过 **300 行**
- 如超过，应拆分为多个文件
- 当前反例：`ControlPanel.tsx` (~745 行) 包含 9 个组件，应拆分为独立文件

---

## Import 顺序

```typescript
// 1. 外部/第三方包
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// 2. 本地组件/hooks（相对路径，不使用路径别名）
import { Layout } from './components/Layout';
import { useSerial } from './hooks/useSerial';

// 3. 仅类型导入（使用 import type）
import type { RobotState, Command } from './types/robot';
```

- 使用**相对路径**导入（项目未配置 `@/` 别名）
- 仅类型导入使用 `import type { ... }` 语法
