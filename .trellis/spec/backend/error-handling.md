# Error Handling

> Rust 后端的错误处理约定和模式。

---

## Error Type Convention

所有 Tauri 命令必须返回 `Result<_, String>`：

```rust
#[tauri::command]
async fn some_command(state: State<'_, AppState>) -> Result<(), String> {
    // ...
}
```

不使用 `thiserror`、`anyhow` 或自定义错误类型。全线使用 `String` 通过 Tauri IPC 边界传播错误。

---

## Error Conversion

使用 `.map_err(|e| e.to_string())` 将各类错误转为 `String`：

```rust
// Mutex 错误
state.serial.lock().map_err(|e| e.to_string())?;

// I/O 错误
conn.write_frame(&data).await.map_err(|e| e.to_string())?;

// 串口错误
tokio_serial::new(port_name, baud_rate)
    .open_native_async()
    .map_err(|e| format!("打开串口失败: {}", e))?;
```

---

## Error Handling Patterns

### 无声失败（Silent Failure）

某些错误被有意无声忽略：

**事件发出失败** — `app.emit()` 使用 `let _ =` 丢弃结果：
```rust
let _ = app_handle.emit("serial_tx", &data);
let _ = app_handle.emit("serial_error", &e.to_string());
```
原因：事件发出失败不应使命令失败（日志/调试辅助功能）。

**端口枚举失败** — 返回空列表：
```rust
tokio_serial::available_ports().unwrap_or_default()
```

**Reader 任务 join 失败** — 结果被丢弃：
```rust
let _ = handle.await;
```

### 帧解析错误

反馈帧解析错误**不传递到前端**：
- `InvalidHeader` → 前进 1 字节重同步
- `InvalidCrc` → 前进 1 字节重同步
- `Incomplete` → 等待更多数据
- 损坏的帧被无声丢弃

---

## ParseError Enum

```rust
// protocol.rs
pub enum ParseError {
    InvalidHeader,   // 前 2 字节 ≠ 0xAA 0xBB
    InvalidLength,   // 数据长度不足
    InvalidCrc,      // CRC16 校验失败
    Incomplete,      // 帧不完整，等待更多数据到达
}
```

仅在帧解析内部使用，不暴露到 Tauri IPC 边界。

---

## Disconnect Safety

`handle_disconnect()` 中的错误处理：

```rust
fn handle_disconnect(&self) {
    self.connected.store(false, Ordering::Release);
    // 清除 writer — 待处理写入会收到 "串口未连接" 错误
    if let Ok(mut writer) = self.writer.try_lock() {
        *writer = None;
    }
    // 清除 reader — 导致 reader 循环在下一次迭代退出
    if let Ok(mut reader) = self.reader.try_lock() {
        *reader = None;
    }
}
```

使用 `try_lock()` 而非 `lock().await` 以避免在断开路径中阻塞。

---

## Error Messages

错误消息使用**中文**，面向前端用户：

```rust
Err("串口未连接".into())
Err(format!("打开串口失败: {}", e))
Err(format!("发送数据失败: {}", e))
```

---

## When to Add a New Error Type

**不要**引入 `thiserror` 或 `anyhow`，除非满足以下所有条件：
- 前端需要根据错误类型做不同处理（而不仅仅展示消息）
- 至少有 3+ 种不同的错误变体
- `String` 匹配 / 解析方案被证明过于脆弱

在此之前，坚持使用 `Result<_, String>`。

---

## Common Mistakes

1. **使用 `?` 而不是 `.map_err(|e| e.to_string())?`** — 在 Tauri 命令中，直接 `?` 仅在错误类型已经是 `String` 时有效。对于库错误（`std::io::Error`、`tokio_serial::Error`），必须转换
2. **在 `app.emit()` 上使用 `?`** — 事件发出失败不应导致命令失败，使用 `let _ =`
3. **在 Mutex 锁内执行 `.await`** — 不要持有 `std::sync::Mutex` 锁跨越 await 点
4. **忘记在 `handle_disconnect` 中同时清除 reader 和 writer** — 两个半部都必须设为 `None` 才能完全断开连接
