# Module Organization

> Rust 后端模块的依赖关系和文件组织。

---

## Module Tree

```
r2_controller_lib (lib.rs)
  |
  +-- main.rs          → 调用 lib::run()
  |
  +-- lib.rs           → AppState, Tauri 命令注册, cmd! 宏, run()
  |     依赖: serial, protocol, commands, state
  |
  +-- commands.rs      → Command 枚举, encode() 方法
  |     依赖: protocol (CommandFrame, 缩放函数)
  |
  +-- protocol.rs      → CommandFrame, FeedbackFrame, CRC16, 缩放函数
  |     独立 (无 crate 内部依赖)
  |
  +-- serial.rs        → SerialConnection, PortInfo, list_ports()
  |     依赖: protocol (FeedbackFrame), state (RobotState)
  |
  +-- state.rs         → RobotState, ActionState, ConnectionState, ConnectionStatus
        依赖: protocol (FeedbackFrame, 缩放逆函数)
```

---

## Dependency Graph

```
protocol.rs  ← 叶子模块，无内部依赖
    ↑
    ├── state.rs       (使用 FeedbackFrame, 缩放逆函数)
    ├── commands.rs    (使用 CommandFrame, 缩放函数)
    └── serial.rs      (使用 FeedbackFrame 解析, RobotState 构造)
            ↑
          lib.rs       (组合所有模块)
```

**规则**：`protocol.rs` 是最底层模块，不应依赖其他本地模块。新模块只能在 `protocol.rs` 之上构建。

---

## File Responsibilities

### `main.rs` (7 行)
- 仅包含 `fn main()`，调用 `r2_controller_lib::run()`
- Windows 构建时抑制控制台窗口：`#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`
- **不在此文件中添加任何逻辑**

### `lib.rs` (185 行)
- 声明所有模块：`mod serial; mod protocol; mod commands; mod state;`
- 定义 `AppState` 结构体（Tauri 管理状态）
- 注册所有 `#[tauri::command]` 函数
- `cmd!` 宏：生成命令包装函数
- `run()` 函数：构建 Tauri app，注册事件监听器
- 导出供前端使用的关键类型

### `commands.rs` (250 行)
- `Command` 枚举（16 个变体），每个映射到固件命令 ID（0x01-0x43）
- `Command::encode(timestamp: u32) -> Vec<u8>` — 将命令编码为 21 字节二进制帧
- 使用 `protocol.rs` 中的缩放函数和 `CommandFrame`

### `protocol.rs` (152 行)
- 帧常量：`FRAME_HEADER = [0xAA, 0xBB]`
- `CommandFrame`（21 字节）和 `FeedbackFrame`（22 字节）结构体
- CRC16-Modbus 计算和验证
- 缩放/逆缩放函数
- `ParseError` 枚举

### `serial.rs` (176 行)
- `SerialConnection` — `Arc` 包装的串口连接，分离读写半部
- 异步后台 reader 任务：持续读取、解析帧、emit 事件
- `write_frame()` — 线程安全的串口写入
- `disconnect()` / `handle_disconnect()` — 安全断开
- `PortInfo` 和 `list_ports()` — 跨平台端口枚举

### `state.rs` (226 行)
- `RobotState` — 主要域状态（时间戳、位置、高度、动作/连接状态）
- `ActionState` — 7 个子字段，从 `u16` 位域解码（13 位已用）
- `ConnectionState` — 13 个布尔子字段，从 `u16` 位掩码解码
- `ConnectionStatus` 枚举：`Disconnected` / `Connecting` / `Connected`

---

## Adding a New Module

1. 在 `src-tauri/src/` 下创建新 `.rs` 文件
2. 在 `lib.rs` 顶部添加 `mod new_module;`
3. 在 `lib.rs` 中添加必要的 `use` 导入
4. 确保新模块不创建循环依赖（protocol ← new_module 关系图必须保持无环）

---

## Module Size Limits

- 单文件不超过 **300 行**
- 如超过，考虑拆分为子模块
- 当前状态：所有文件在此限制内
