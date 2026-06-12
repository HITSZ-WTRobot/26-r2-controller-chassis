# State Management

> Rust 后端的状态管理、数据流和同步。

---

## AppState

Tauri 管理状态的中央结构体：

```rust
// lib.rs
struct AppState {
    serial: Mutex<Option<Arc<SerialConnection>>>,  // 可选串口连接
    robot_state: Mutex<RobotState>,                 // 最新机器人状态
    connection_status: Mutex<ConnectionStatus>,     // 连接状态
    start_time: Instant,                            // 命令时间戳基准
}
```

使用 `std::sync::Mutex`（不是 `tokio::sync::Mutex`），因为状态访问是瞬时同步操作，无需 `.await`。

---

## Data Flow

### TX（命令发送）

```
Frontend invoke()
  → Tauri command handler (lib.rs)
    → do_send_command()
      → Command::encode(timestamp) → 21 字节帧
      → emit serial_tx 事件
      → SerialConnection::write_frame()
        → tokio_serial 写入
```

### RX（状态接收）

```
STM32F407 固件
  → UART3 @ 230400 baud
    → tokio_serial reader 任务
      → 缓冲区累加 + FeedbackFrame::parse()
        → RobotState::from_feedback()
          → emit robot_state_update 事件
            → setup() 监听器 (lib.rs)
              → AppState.robot_state 更新
                → get_robot_state() → 前端轮询/事件推送
```

---

## State Types

### RobotState

```rust
pub struct RobotState {
    pub timestamp: u32,
    pub x: f32, pub y: f32, pub yaw: f32,
    pub front_height: f32, pub rear_height: f32,
    pub action_state: ActionState,
    pub connection_state: ConnectionState,
}
```

参考：`src-tauri/src/state.rs`

### ActionState（从 u16 位域解码）

| 位 | 字段 | 值 |
|----|------|-----|
| 0-1 | step_status | Idle(0), Done(1), Running(2), WaitingTake(3) |
| 2-3 | chassis_mode | Stop(0), Velocity(1), Position(2), Slave(3) |
| 4 | chassis_curve_finished | bool |
| 5-6 | lift_status | Calibrating(0), Running(1), Ready(2), NotEnabled(3) |
| 7-9 | grip_status | Calibrating(0), TakingSpear(1), KfsStore(2), KfsRelease(3), Idle(4), Done(5) |
| 10 | grip_suction_has_object | bool |
| 11-12 | infrared_receiver_state | KeepAlive(0), DockingComplete(1), NoAction(2), Reserved(3) |

已用 13/16 位。位 13-15 未使用。

### ConnectionState（从 u16 位掩码解码）

位 0-8：wheel0-3, lift0-3, grip_arm, grip_turn
位 9：gyro_yaw
位 10：保留
位 11-13：保留
位 14：localization_stream
位 15：upper_host_link

参考：`src-tauri/src/state.rs`

---

## State Mutation Discipline

- **仅 serial reader 任务**可以发出 `robot_state_update` 事件
- `setup()` 监听器仅反序列化并存储事件负载到 `AppState.robot_state`
- **不要**从其他来源写入 `AppState.robot_state`，除非经过验证
- 前端无法通过事件系统注入伪造的 `robot_state_update`（事件类型在 Tauri 中是受信任的）

---

## Bitfield Backwards Compatibility

`ActionState::from_table()` 和 `ConnectionState::from_table()` 必须保持向后兼容：

- **新位**只能分配到当前未使用的位置
- **已有位**不得重新分配
- 修改位域布局需要固件同步更新

```rust
// state.rs — 位域解码模式
pub fn from_table(value: u16) -> Self {
    let step_status = match (value & 0b11) {
        0 => StepStatus::Idle,
        1 => StepStatus::Done,
        2 => StepStatus::Running,
        3 => StepStatus::WaitingTake,
        _ => unreachable!(),
    };
    // ...
}
```

---

## Adding a New State Field

1. 在 `state.rs` 的相关结构体（`RobotState`, `ActionState`, `ConnectionState`）中添加字段
2. 如果是位域字段，更新对应 `from_table()` 方法，使用未占用的位
3. 在 `RobotState::from_feedback()` 中添加解码逻辑（如需要）
4. 同步更新前端 `src/types/robot.ts` 中的类型定义
5. 在 `CLAUDE.md` 协议文档中记录新字段

---

## Common Mistakes

1. **在 `setup()` 中未验证事件来源** — 不要盲目信任所有 `robot_state_update` 事件
2. **Mutex 争用** — `AppState` 访问应瞬时完成，不要持有锁跨 `.await` 边界
3. **克隆整个 RobotState** — `get_robot_state()` 克隆状态以安全返回给前端，这是正确的
4. **忘记同步更新前端类型** — Rust 和 TypeScript 类型必须保持一致
