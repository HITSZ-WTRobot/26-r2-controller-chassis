# Hook Guidelines

> 自定义 React Hooks 的编写和使用规范。

---

## Available Hooks

所有 hooks 定义在 `src/hooks/useSerial.ts` 中，导出以下三个：

### `useSerial()`

管理串口连接生命周期：

```typescript
const { connected, ports, error, connect, disconnect, refreshPorts } = useSerial();
```

- `connected: boolean` — 当前连接状态
- `ports: PortInfo[]` — 可用串口列表
- `error: string | null` — 最近错误信息
- `connect(port: string, baud: number): Promise<void>` — 连接串口
- `disconnect(): Promise<void>` — 断开连接
- `refreshPorts(): Promise<void>` — 刷新端口列表（也会被每 5 秒自动轮询）

### `useRobotState()`

订阅后端状态推送：

```typescript
const { state, connectionStatus } = useRobotState();
```

- `state: RobotState | null` — 最新机器人状态（初始为 null）
- `connectionStatus: ConnectionStatus` — 连接状态（`'Disconnected' | 'Connecting' | 'Connected'`）

通过 `listen()` 订阅两个 Tauri 事件：
- `robot_state_update` → 更新 `state`
- `connection_status` → 更新 `connectionStatus`

### `useCommand()`

发送命令到机器人：

```typescript
const { send } = useCommand();
send({ type: 'Ping' });
send({ type: 'SetChassisHeight', height: 0.3, v_max: 1.0, a_max: 0.5, j_max: 0, linkMode: 0 });
```

将 `Command` 判别联合转换为后端期望的格式后调用 `invoke('send_command', ...)`。

---

## Hook File Organization

**当前状态**：三个 hook 都在 `src/hooks/useSerial.ts` 中。

**应拆分**为：
- `src/hooks/useSerial.ts` — `useSerial`（连接管理）
- `src/hooks/useRobotState.ts` — `useRobotState`（状态订阅）
- `src/hooks/useCommand.ts` — `useCommand`（命令发送）

---

## Effect Cleanup Pattern

使用 `useRef` 跟踪组件卸载状态，防止在已卸载组件上 setState：

```typescript
// 正确：使用 useRef
const cancelled = useRef(false);

useEffect(() => {
  const unlisten = await listen<RobotState>('robot_state_update', (event) => {
    if (!cancelled.current) {
      setState(event.payload);
    }
  });
  return () => {
    cancelled.current = true;
    unlisten();
  };
}, []);
```

当前代码中使用普通 `let cancelled = false` 变量在闭包中捕获也能工作，但 `useRef` 是更符合习惯的做法。

参考：`src/hooks/useSerial.ts` 中的 `useRobotState` 实现

---

## Polling Patterns

轮询应在不再需要时停止：

```typescript
// 当前问题：即使已连接仍每 5 秒轮询端口
useEffect(() => {
  refreshPorts();
  const id = setInterval(refreshPorts, 5000);
  return () => clearInterval(id);
}, []);
```

**改进方向**：连接建立后停止轮询，断开后恢复。

参考：`src/hooks/useSerial.ts` 中的 `useSerial` 实现

---

## Naming Conventions

- Hook 函数名必须以 `use` 开头：`useSerial`、`useRobotState`、`useCommand`
- Hook 文件名与主导出函数名匹配：`useSerial.ts` 导出 `useSerial`
- 返回对象使用解构友好的命名

---

## Tauri Communication Rules

### `invoke()` 调用

所有 `invoke()` 调用**必须**在 hooks 中封装：

```typescript
// 正确：通过 hook
const { send } = useCommand();
send({ type: 'Ping' });

// 错误：直接在组件中调用
await invoke('send_command', { cmd: 'Ping' });
```

当前例外：`SerialDebugger.tsx` 中直接调用 `invoke('ping')` — 应改为通过 `useCommand`。

### 事件订阅

使用 `listen()` 订阅 Tauri 事件，在 `useEffect` cleanup 中取消订阅：

```typescript
useEffect(() => {
  const unlisten = await listen<RobotState>('robot_state_update', handler);
  return () => { unlisten(); };
}, []);
```

---

## Common Mistakes

1. **在多个组件中实例化 `useCommand`** — 每个控制面板组件都调用 `useCommand()`，创建多个 `send` 函数引用。虽然功能上无害（无状态），但可通过 Context 共享单一实例
2. **`App.tsx` 调用 `useSerial()` 但不使用返回值** — 仅为了副作用，令人困惑。`ConnectionPanel` 已经管理自己的 `useSerial` 实例
3. **已连接时仍轮询端口** — 浪费资源
4. **使用 `let cancelled` 而非 `useRef`** — 在大多数情况下工作，但不是最佳实践
