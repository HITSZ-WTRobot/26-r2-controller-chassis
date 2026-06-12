# State Management

> 前端状态的管理方式和数据流。

---

## No Global State Library

本项目**不使用** Redux、Zustand、Jotai 或 React Context 进行全局状态管理。状态管理完全基于：
- `useState` + `useEffect`
- Tauri 事件系统（`listen()` 订阅）
- Props 向下传递

---

## State Categories

| 类别 | 管理方式 | 示例 |
|------|----------|------|
| 服务端状态 (Robot) | `useRobotState()` hook → Tauri 事件推送 | `RobotState`, `ActionState`, `ConnectionState` |
| 连接状态 | `useSerial()` hook → `invoke()` 调用 | `connected`, `ports`, `error` |
| UI 本地状态 | 组件内 `useState` | 输入值、开关状态、选中的标签页 |
| 命令发送 | `useCommand()` hook → `invoke()` | 无状态，纯回调包装 |

---

## Data Flow

```
Rust Backend (Tauri)
  |
  |-- invoke() 调用:
  |     list_serial_ports     → useSerial.refreshPorts()
  |     connect_serial        → useSerial.connect()
  |     disconnect_serial     → useSerial.disconnect()
  |     send_command          → useCommand.send()
  |
  |-- Tauri 事件推送:
  |     robot_state_update    → useRobotState() → App → Layout → 所有子组件
  |     connection_status     → useRobotState() → App → Layout
  |     serial_tx             → SerialDebugger
  |     serial_rx             → SerialDebugger
```

### 关键数据流路径

1. **连接流程**：`ConnectionPanel` → `useSerial.connect()` → `invoke('connect_serial')` → Rust 打开串口 → 后台线程开始推送事件
2. **状态更新**：Rust reader 线程解析反馈帧 → emit `robot_state_update` 事件 → `useRobotState` hook 接收 → 更新 `state` → React 重渲染
3. **命令发送**：控制组件 → `useCommand.send(cmd)` → `invoke('send_command', { cmd })` → Rust 编码为二进制帧 → 写入串口

---

## Component State Ownership

```
App
  ├── useRobotState()           ← 拥有 robot_state (RobotState | null)
  │     └── Layout (接收 state prop)
  │           ├── ConnectionPanel   ← useSerial() (拥有 connected, ports, error)
  │           ├── StatusDisplay     ← 纯展示 (接收 state prop)
  │           ├── ActionStatePanel  ← 纯展示 (接收 state.action_state prop)
  │           ├── ConnectionMap     ← 纯展示 (接收 state.connection_state prop)
  │           ├── HeightControl     ← useCommand() + 本地 UI 状态
  │           ├── StepControl       ← useCommand()
  │           ├── GripControl       ← useCommand()
  │           ├── SystemControl     ← useCommand()
  │           ├── PostureControl    ← useCommand() + 本地 UI 状态
  │           └── WasdVelocityControl ← useCommand() + 本地 UI 状态
  └── SerialDebugger             ← 独立监听 serial_tx/serial_rx 事件
```

---

## When to Lift State

当前项目中，状态提升的规则很简单：
- **后端数据**（`RobotState`）在 `App` 级别通过 `useRobotState` 获取，通过 props 向下传递
- **连接状态**在 `ConnectionPanel` 中通过 `useSerial` 管理，因为只有它需要
- **本地 UI 状态**（输入框、开关）保持在相关组件内部

无需引入 Context 或全局状态库，除非出现以下情况：
- 3 层以上的 prop drilling
- 多个不相关的组件需要同一份状态

---

## Derived State

派生值直接在组件中通过计算获得，不使用 `useMemo`（当前数据量很小）：

```typescript
// 在 StatusDisplay 中，从 RobotState 派生展示值
const FIELDS = [
  { label: 'X', get: (s: RobotState) => s.x.toFixed(3), unit: 'm' },
  { label: 'Y', get: (s: RobotState) => s.y.toFixed(3), unit: 'm' },
  // ...
];
```

---

## Common Mistakes

1. **在多个位置重复订阅同一事件** — 确保每个 Tauri 事件只有一个 `listen()` 订阅者
2. **不处理 `null` 初始状态** — `RobotState` 在首次反馈帧到达前为 `null`，所有消费组件必须处理
3. **在 hooks 间隐式耦合** — `useSerial` 和 `useRobotState` 是独立 hook，但逻辑上耦合（连接后才会有状态推送），不要在组件间做出它们会同步的假设
