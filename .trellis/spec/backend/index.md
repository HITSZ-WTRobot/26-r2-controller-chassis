# Backend Development Guidelines

> Rust + Tauri 2.x 后端的具体编码规范。

---

## Overview

后端是一个 Tauri 2.x Rust 应用，通过 `tokio-serial` 与 STM32F407 固件进行串口通信。使用二进制帧协议（CRC16-Modbus），通过 Tauri 事件系统和 `invoke()` 命令与前端交互。

---

## Guidelines Index

| Guide | Description |
|-------|-------------|
| [Module Organization](./module-organization.md) | 模块依赖图和文件组织 |
| [Command Registration](./command-registration.md) | Tauri 命令注册和 `cmd!` 宏模式 |
| [Protocol Conventions](./protocol-conventions.md) | 二进制帧协议、CRC、缩放规则 |
| [Serial Communication](./serial-communication.md) | 串口 I/O、读写线程、帧解析 |
| [State Management](./state-management.md) | AppState、事件流、数据同步 |
| [Error Handling](./error-handling.md) | 错误类型、错误传播、日志 |

---

## Quick Reference

- **入口**: `src-tauri/src/main.rs` → `src-tauri/src/lib.rs::run()`
- **命令**: `src-tauri/src/lib.rs`（`#[tauri::command]` + `cmd!` 宏）
- **协议**: `src-tauri/src/protocol.rs`（帧编解码、CRC16、缩放函数）
- **命令枚举**: `src-tauri/src/commands.rs`（`Command::encode()`）
- **串口**: `src-tauri/src/serial.rs`（`SerialConnection`、`PortInfo`）
- **状态**: `src-tauri/src/state.rs`（`RobotState`、`ActionState`、`ConnectionState`）
- **依赖**: tokio (full), tokio-serial 5, serde + serde_json, tauri 2
