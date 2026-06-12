# Serial Communication

> 串口 I/O、读写线程架构和帧解析逻辑。

---

## Connection Architecture

使用 `tokio-serial` v5 进行异步串口通信。

### SerialConnection 结构体

```rust
pub struct SerialConnection {
    reader: tokio::sync::Mutex<Option<tokio::io::ReadHalf<SerialStream>>>,
    writer: tokio::sync::Mutex<Option<tokio::io::WriteHalf<SerialStream>>>,
    pub connected: AtomicBool,
    read_handle: tokio::sync::Mutex<Option<JoinHandle<()>>>,
}
```

**设计要点**：
- 读写半部分离，允许并发读写
- `Arc<SerialConnection>` 在 `AppState` 和 reader 任务间共享
- `connected: AtomicBool` 提供无锁连接状态检查
- `read_handle` 存储后台 reader 任务的 join handle

参考：`src-tauri/src/serial.rs:10-16`

---

## Connection Lifecycle

### 连接流程

```rust
// serial.rs:27-49
pub async fn connect(&self, port_name: &str, baud_rate: u32, app: AppHandle)
```

1. 打开串口：`tokio_serial::new(port_name, baud_rate).open_native_async()`
2. 分为读写半部：`tokio::io::split(port)`
3. 存储 reader/writer
4. 设置 `connected = true`
5. 生成 reader 任务：`tokio::spawn(async move { self.read_loop(app).await })`
6. 存储 join handle

### 断开流程

```rust
// serial.rs:137-147
fn handle_disconnect(&self)
```

1. 设置 `connected = false`
2. 清除 writer（`*writer = None`）— 待处理写入立即失败
3. 清除 reader（`*reader = None`）— reader 循环下一次迭代退出
4. 等待 reader 任务：`handle.await`

---

## Reader Thread

后台 `tokio::spawn` 任务持续从串口读取并解析帧。

### 缓冲区管理

```rust
// serial.rs:55-58
let mut buf = vec![0u8; 256];  // 累积缓冲区
let mut pos = 0;                // 当前写入位置
let mut tmp = vec![0u8; 64];    // 临时读取缓冲区
```

### 读取循环

```
1. 获取 reader 锁
2. 读取最多 64 字节到 tmp
3. Emit serial_rx 事件（原始字节）
4. 追加到 buf[pos..]
5. 扫描 buf 中的有效帧：
   - 查找 0xAA 0xBB header
   - 尝试 FeedbackFrame::parse(&buf[start..start+22])
   - 成功 → 转换为 RobotState，emit robot_state_update，前进 22
   - Incomplete → 退出内循环（等待更多数据）
   - 其他错误 → 前进 1（逐字节重同步）
6. 保留剩余部分数据到 buf 开头
```

参考：`src-tauri/src/serial.rs:51-122`

### 重同步策略

CRC/header 失败时前进 1 字节，确保不会永久不同步。仅当帧不完整（等待更多数据）时才等待。

---

## Frame Writing

```rust
// serial.rs:124-131
pub async fn write_frame(&self, data: &[u8]) -> Result<(), String> {
    let mut guard = self.writer.lock().await;
    if let Some(writer) = guard.as_mut() {
        writer.write_all(data).await.map_err(|e| e.to_string())
    } else {
        Err("串口未连接".into())
    }
}
```

- 通过 `tokio::sync::Mutex` 串行化写入
- 断开时 writer 为 `None`，返回错误

---

## Port Enumeration

```rust
pub struct PortInfo {
    pub name: String,       // e.g., "/dev/ttyUSB0", "COM3"
    pub port_type: String,  // "USB", "PCI", "Bluetooth", "Unknown"
}

pub fn list_ports() -> Vec<PortInfo> { /* ... */ }
```

使用 `tokio_serial::available_ports()`。失败时返回空列表（`unwrap_or_default`）。

---

## Thread Safety Rules

1. `SerialConnection` 必须始终包装在 `Arc` 中
2. 读写半部必须分别在 `tokio::sync::Mutex` 后面
3. 连接状态变更（`connected` + 半部清除）仅在 `handle_disconnect()` 中执行
4. Reader 任务的 `Weak<Mutex<...>>` 引用模式确保线程在 `disconnect()` 丢弃最后一个强 `Arc` 引用时自动退出

---

## Event Emission

Reader 线程通过 `AppHandle` 发出事件：

| 事件 | 负载 | 触发条件 |
|------|------|----------|
| `serial_rx` | `Vec<u8>` | 每次成功读取原始字节 |
| `robot_state_update` | `RobotState` (JSON) | 成功解析反馈帧 |
| `connection_status` | `"connected"` / `"disconnected"` | 线程启动/退出 |
| `serial_error` | `String` | 读取错误 |

---

## Common Mistakes

1. **忘记在断开时清除 reader** — writer 和 reader 都必须设置为 `None`，缺一不可
2. **不使用 `Arc`** — `SerialConnection` 在多个任务间共享，必须使用 `Arc`
3. **在 reader 锁内进行阻塞操作** — reader 锁应短时间持有
4. **修改帧解析缓冲区大小但不同步调整解析逻辑** — 256 字节缓冲区应远大于最大帧长度
