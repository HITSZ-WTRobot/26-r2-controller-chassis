# Command Registration

> Tauri 命令的注册模式和 `cmd!` 宏使用规范。

---

## Registration Patterns

项目使用三种命令注册模式：

### Pattern 1: 宏生成的命名包装（`cmd!`）

用于 16 个有直接前端绑定的命令类型。`cmd!` 宏（`lib.rs:83-96`）生成：

```rust
macro_rules! cmd {
    ($name:ident, $variant:ident) => {
        #[tauri::command]
        async fn $name(state: State<'_, AppState>, app_handle: AppHandle) -> Result<(), String> {
            do_send_command(Command::$variant, &state, &app_handle).await
        }
    };
    ($name:ident, $variant:ident, $($field:ident: $ftype:ty),+) => {
        #[tauri::command]
        async fn $name($($field: $ftype),+, state: State<'_, AppState>, app_handle: AppHandle) -> Result<(), String> {
            do_send_command(Command::$variant { $($field),+ }, &state, &app_handle).await
        }
    };
}
```

调用方式：

```rust
cmd!(ping, Ping);
cmd!(stop_chassis, StopChassis);
cmd!(set_chassis_height, SetChassisHeight, height: f32, v_max: f32, a_max: f32, j_max: f32, link_mode: u8);
cmd!(set_master_chassis_target_current_state, SetMasterChassisTargetCurrentState,
     x: f32, y: f32, yaw: f32, xy_vmax: u16, xy_amax: u16, yaw_vmax: u16, yaw_amax: u16);
// ... 等等
```

### Pattern 2: 通用命令发送器

`send_command` 接受任意 `Command` 值，作为没有命名包装的命令的备用通道：

```rust
#[tauri::command]
async fn send_command(cmd: Command, state: State<'_, AppState>, app_handle: AppHandle) -> Result<(), String> {
    do_send_command(cmd, &state, &app_handle).await
}
```

### Pattern 3: 同步查询

读取状态快照，无需 async：

```rust
#[tauri::command]
fn get_robot_state(state: State<'_, AppState>) -> Result<RobotState, String> {
    state.robot_state.lock().map_err(|e| e.to_string()).map(|s| s.clone())
}
```

### Pattern 4: 副作用查询

纯函数，无状态依赖：

```rust
#[tauri::command]
fn list_serial_ports() -> Vec<PortInfo> {
    serial::list_ports()
}
```

---

## Shared Code Path

所有命令包装器都调用 `do_send_command()`（`lib.rs:53-72`）：

```rust
async fn do_send_command(cmd: Command, state: &AppState, app_handle: &AppHandle) -> Result<(), String> {
    let timestamp = state.start_time.elapsed().as_millis() as u32;
    let data = cmd.encode(timestamp);
    let _ = app_handle.emit("serial_tx", &data);
    let serial = state.serial.lock().map_err(|e| e.to_string())?;
    if let Some(conn) = serial.as_ref() {
        conn.write_frame(&data).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

**步骤**：
1. 从 `start_time` 计算单调时间戳
2. 调用 `cmd.encode(timestamp)` → 21 字节帧
3. Emit `serial_tx` 事件（调试/监控用）
4. 获取串口连接，写入帧

---

## Adding a New Command

完整流程：

1. **`commands.rs`** — 添加枚举变体：
   ```rust
   pub enum Command {
       // 现有变体...
       NewCommand { field1: f32, field2: u8 },
   }
   ```

2. **`commands.rs`** — 在 `encode()` 中添加 match arm：
   ```rust
   Command::NewCommand { field1, field2 } => {
       let mut data = [0u8; 12];
       data[0..2].copy_from_slice(&scale_x(field1).to_be_bytes());
       data[2] = field2;
       CommandFrame::new(0x44, data, timestamp).encode()  // 0x44 = 新命令 ID
   }
   ```

3. **`lib.rs`** — 添加 `cmd!` 宏调用：
   ```rust
   cmd!(new_command, NewCommand, field1: f32, field2: u8);
   ```

4. **`lib.rs`** — 在 `generate_handler![]` 中添加：
   ```rust
   tauri::generate_handler![
       // 现有...
       new_command,
   ]
   ```

---

## Command ID Allocation

命令 ID 按功能组分配：

| 范围 | 功能 |
|------|------|
| `0x01` | 系统（Ping） |
| `0x10-0x1F` | 底盘（Stop, Height, Target, Velocity） |
| `0x20-0x2F` | 激光雷达（LidarPosture） |
| `0x30-0x3F` | 台阶（StepUp200/400, StepDown200/400, Resume） |
| `0x40-0x4F` | 矛头/夹爪（TakeSpear, Grip, StoreKFS, ReleaseKFS） |

新命令 ID 应在对应功能组内按顺序分配。

---

## Common Mistakes

1. **添加枚举变体但忘记 `encode()` match arm** — 编译器会报错（非穷举 match），但需确保编码逻辑正确
2. **添加命令但未在 `generate_handler![]` 中注册** — 前端 `invoke()` 会返回 "command not found" 错误
3. **`SetMasterChassisTargetPreviousCurve` (0x14) 已定义但未注册** — 死代码，仅通过 `send_command` 可达
4. **字段类型不匹配** — `cmd!` 宏参数类型必须与 `Command` 枚举变体字段类型一致
