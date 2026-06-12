# Protocol Conventions

> 二进制帧协议、CRC16、缩放规则和帧常量。

---

## Frame Format

### Control Frame (TX, 21 bytes)

```
Offset  Size  Field
0       2     Header (0xAA 0xBB, big-endian)
2       1     Command ID
3       12    Data payload
15      4     TX Timestamp (big-endian u32, ms from start_time)
19      2     CRC16-Modbus
```

CRC 覆盖范围：bytes [2..19]（cmd + data + timestamp，不含 header 和 CRC）

### Feedback Frame (RX, 22 bytes)

```
Offset  Size  Field
0       2     Header (0xAA 0xBB, big-endian)
2       4     Timestamp (big-endian u32, HAL_GetTick)
6       2     X position (big-endian i16)
8       2     Y position
10      2     Yaw
12      2     Front height
14      2     Rear height
16      2     Action state bitfield (u16)
18      2     Connection state bitfield (u16)
20      2     CRC16-Modbus
```

CRC 覆盖范围：bytes [2..20]（timestamp 到 connection_state，不含 header 和 CRC）

所有多字节字段使用**大端序**（big-endian）。

---

## CRC16

参数：
- 多项式：0x8005
- 反射多项式：0xA001
- 初始值：0xFFFF
- refin=true, refout=true, xorout=0x0000

实现：表驱动查找（`protocol.rs:31-77`）

```rust
pub fn crc16_modbus(data: &[u8]) -> u16 { /* ... */ }
pub fn verify_crc(data: &[u8], expected: u16) -> bool { crc16_modbus(data) == expected }
```

---

## Scaling Rules

### 编码（物理量 → 整数）

| 函数 | 公式 | 用途 |
|------|------|------|
| `scale_x` / `scale_y` | `(value * 2000.0) as i16` | 位置 (m → 0.5mm 精度) |
| `scale_yaw` | `(value * 100.0) as i16` | 角度 (deg → 0.01deg 精度) |
| `scale_vx` / `scale_vy` | `(value * 2000.0) as i16` | 线速度 (m/s) |
| `scale_wz` | `(value * 100.0) as i16` | 角速度 (deg/s) |
| `scale_height` | `(value * 2000.0) as i16` | 高度 (m) |

### 解码（整数 → 物理量）

| 函数 | 公式 | 用途 |
|------|------|------|
| `unscale_x` / `unscale_y` | `raw as f32 / 2000.0` | 位置 |
| `unscale_yaw` | `raw as f32 / 100.0` | 角度 |
| `unscale_front_height` / `unscale_rear_height` | `raw as f32 / 2000.0` | 高度 |

### uint12 打包

`SetMasterChassisTargetCurrentState` 和 `SetMasterChassisTargetPreviousCurve` 将 4 个 uint12 值打包到 6 个字节中：

```rust
// commands.rs:76-81
let packed = (xy_vmax as u64) | ((xy_amax as u64) << 12) | ((yaw_vmax as u64) << 24) | ((yaw_amax as u64) << 36);
data[0..6].copy_from_slice(&packed.to_le_bytes()[0..6]);
```

---

## Frame-Level Invariants

以下常量**不可修改**（与固件协议绑定）：

- `FRAME_HEADER = [0xAA, 0xBB]`
- 控制帧长度 = 21 字节
- 反馈帧长度 = 22 字节
- CRC 覆盖范围：TX = bytes[2..19]，RX = bytes[2..20]
- 所有多字节字段大端序
- CRC 算法参数（多项式、初始值、反射）

---

## Adding a New Scaling Function

当添加新的缩放物理量时：

1. 在 `protocol.rs` 中添加配对的 `scale_*` 和 `unscale_*` 函数
2. 两个方向使用相同的除数/比率
3. 线性量使用 2000.0，角度量使用 100.0

```rust
pub fn scale_new_quantity(value: f32) -> i16 { (value * 2000.0) as i16 }
pub fn unscale_new_quantity(raw: i16) -> f32 { raw as f32 / 2000.0 }
```

---

## ParseError Handling

```rust
pub enum ParseError {
    InvalidHeader,   // 前 2 字节 ≠ 0xAA 0xBB
    InvalidLength,   // 数据长度不足
    InvalidCrc,      // CRC 校验失败
    Incomplete,      // 帧不完整（等待更多数据）
}
```

- `Incomplete` → 停止扫描当前缓冲区，等待更多字节到达
- 其他错误 → 前进 1 字节并重试（逐字节重同步）

---

## Common Mistakes

1. **修改帧长度或偏移量** — 这些与固件协议绑定，修改会导致通信失败
2. **添加缩放函数但缺少逆函数** — 始终成对添加
3. **CRC 覆盖范围错误** — TX 和 RX 的 CRC 覆盖范围不同
4. **字节序不一致** — 所有多字节字段必须使用大端序
