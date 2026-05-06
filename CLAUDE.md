# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Tauri 2.x desktop application with a React 19 + TypeScript frontend and Rust backend. The project is named "r2-controller" and appears to be a controller application for the Robocon 2026 competition.

## Git Workflow

Commit in logical batches at reasonable checkpoints — don't wait for the whole task to finish, and don't commit every tiny edit. A good commit boundary is a coherent feature/fix/refactor that builds and passes type-check on its own. Split a session's work into multiple commits when it touches unrelated concerns (e.g., backend changes + separate frontend feature). Always verify `bun run build` passes before committing frontend changes; `cargo check` for backend changes.

## Build Commands

```bash
bun run tauri dev     # Start Tauri app in development mode (runs frontend + backend)
bun run tauri build   # Build release version
bun run dev           # Start frontend only (Vite dev server on port 1420)
bun run build         # Build frontend only
bun run preview        # Preview the built frontend
```

## Architecture

### Tauri 2.x Multi-Process Model
- **Frontend** (src/): React 19 + TypeScript + Vite, runs in a WebView
- **Backend** (src-tauri/): Rust, runs as a separate process
- **IPC**: Frontend calls Rust functions via `invoke()` from `@tauri-apps/api/core`
- Commands are registered in `src-tauri/src/lib.rs` using the `#[tauri::command]` attribute

### Key Files
- `src-tauri/src/lib.rs` - Rust entry point; register commands here
- `src-tauri/src/main.rs` - Binary entry point that calls `lib::run()`
- `src-tauri/tauri.conf.json` - Tauri configuration (app name, window size, build settings)
- `src-tauri/capabilities/default.json` - Permission grants for Tauri plugins and APIs
- `src/App.tsx` - Main React component

### Tauri 2.x Capabilities
Permissions are declared in `src-tauri/capabilities/*.json`. When adding new Tauri plugins or APIs, you must grant corresponding permissions in the capabilities file.

### Frontend Architecture (React + Tailwind CSS v4)
- **Styling**: Tailwind CSS v4 with `@tailwindcss/vite` plugin
- **CSS entry**: `src/index.css` with `@import "tailwindcss"`
- **Component location**: `src/components/` - custom components
- **Custom components**: ConnectionPanel, StatusDisplay, ActionStatePanel, ConnectionMap, ControlPanel, Layout
- **Hooks**: `src/hooks/useSerial.ts` - serial connection and command hooks
- **Types**: `src/types/robot.ts` - TypeScript types matching Rust backend

### Frontend State
React state management is handled within components using `useState` and similar hooks. No external state library is currently configured.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite 7, Tailwind CSS v4
- **Backend**: Rust, Tauri 2, tokio, serialport
- **Package Manager**: bun
- **Build Tool**: Vite

## Robot Communication Protocol

This application controls the Robocon 2026 independent lift mecanum chassis (STM32F407) via UART3 at 230400 baud.

### Protocol Specification

| Item | Value |
|------|-------|
| Frame header | `0xAA 0xBB` |
| Control frame | 21 bytes (header2 + cmd1 + data12 + timestamp4 + crc2) |
| Feedback frame | 22 bytes (header2 + timestamp4 + x2 + y2 + yaw2 + frontH2 + rearH2 + action2 + conn2 + crc2) |
| CRC | CRC16-Modbus (poly=0x8005, reflected=0xA001, init=0xFFFF, refin=true, refout=true, xorout=0x0000) — LSB-first processing uses reflected poly 0xA001, no final reversal needed |
| Timestamp sync | First 49 frames only sync, no control execution |

### Scaling Rules

| Physical | Encoding |
|----------|----------|
| Position x/y | `int16 = value_m * 2000` |
| Yaw | `int16 = value_deg * 100` |
| Velocity vx/vy | `int16 = value_mps * 2000` |
| Angular velocity wz | `int16 = value_degps * 100` |
| Chassis height | `int16 = height_m * 2000` |

### Command List (0x01-0x43)

| Cmd | Name | Data |
|-----|------|------|
| `0x01` | Ping | - |
| `0x10` | StopChassis | - |
| `0x11` | SetChassisHeight | height, v_max, a_max, j_max, link_mode |
| `0x13` | SetMasterChassisTargetCurrentState | x, y, yaw, xy_vmax, xy_amax, yaw_vmax, yaw_amax |
| `0x14` | SetMasterChassisTargetPreviousCurve | same as 0x13 |
| `0x15` | SetMasterChassisVelocity | vx, vy, wz |
| `0x21` | LidarPosture | x, y, yaw, lidar_timestamp |
| `0x30` | StepUp | startDist, endDist, direction, willTake |
| `0x31` | StepUpResume | - |
| `0x32` | StepDown | startDist, endDist, direction, shouldReset |
| `0x40` | TakeSpear | target(x,y,yaw), end(x,y,yaw) |
| `0x41` | TakeSpearById | spearId(0-5), end(x,y,yaw) |
| `0x42` | StoreKFS | - |
| `0x43` | ReleaseKFS | - |

### Feedback Fields

- `timestamp`: u32, HAL_GetTick()
- `x, y`: int16 / 2000 → meters
- `yaw`: int16 / 100 → degrees
- `frontHeight, rearHeight`: int16 / 2000 → meters
- `action_state`: bitfield (StepStatus bit0-1, ChassisMode bit2-3, ChassisCurveFinished bit4, LiftStatus bit5-6, GripStatus bit7-9, GripSuctionHasObject bit10)
- `connection_state`: bitfield (wheel0-3, lift0-3, grip_arm, grip_turn, gyro_yaw, bit14=localization stream, bit15=upper_host link)

### Key Behavior Constraints

1. First 49 frames only timestamp sync, control execution starts from frame 50
2. bit14 (localization stream) requires valid LidarPosture within 200 watchdog ticks
3. bit15 (upper_host) indicates UART link status
4. TakeSpear requires end_pos x-distance > 0.20m from target

### Backend Modules

- `src-tauri/src/serial.rs` - Serial port manager, cross-platform enumeration
- `src-tauri/src/protocol.rs` - Frame encode/decode, CRC16, scaling helpers
- `src-tauri/src/commands.rs` - Command enum and encoding
- `src-tauri/src/state.rs` - RobotState, ActionState, ConnectionState parsing
- `src-tauri/src/lib.rs` - Tauri command handlers

### Event & Thread Architecture

- **Reader/writer threads**: Use `Weak<Mutex<Box<dyn SerialPort>>>` so threads auto-exit when `disconnect()` drops the last strong `Arc` reference. Without this, the threads' `Arc` clones keep the port alive even after disconnect.
- **`serial_rx` event**: Carries **raw byte chunks** (variable-length `number[]` from each `read()` call). The frontend `SerialDebugger` buffers these and extracts complete frames via `drainRxBuffer()`. This ensures all incoming data is visible even when CRC/header checks fail.
- **`serial_tx` event**: Carries complete 21-byte control frames emitted from `send_command()`.
- **`robot_state_update` event**: Carries parsed `RobotState` from successfully decoded 22-byte feedback frames. Used by `StatusDisplay` via `useRobotState()`.
- **Frontend frame drain**: `drainRxBuffer` only tries 21-byte (CTL) frames when fewer than 22 bytes are available at a header. When 22+ bytes are available, it only tries 22-byte (FDB) and advances by 1 on CRC failure — this prevents the 1/65536 CRC collision that would otherwise desync the scanner with real frame boundaries.

## Cross-Platform Requirements

- Windows: COM ports (e.g., COM3)
- Linux: /dev/ttyUSB*, /dev/ttyACM*
- macOS: /dev/tty.usbserial*, /dev/tty.usbmodem*
