# Frontend Development Guidelines

> React 19 + TypeScript + Tailwind CSS v4 前端的具体编码规范。

---

## Overview

前端是一个 Tauri 2.x WebView 应用，通过 `invoke()` 和 Tauri 事件系统与 Rust 后端通信。没有使用路由库或全局状态管理库。

---

## Guidelines Index

| Guide | Description |
|-------|-------------|
| [Directory Structure](./directory-structure.md) | 文件组织与命名规范 |
| [Component Guidelines](./component-guidelines.md) | 组件模式、Props、组合 |
| [Hook Guidelines](./hook-guidelines.md) | 自定义 Hooks 与数据获取模式 |
| [State Management](./state-management.md) | 状态分类与数据流 |
| [Type Safety](./type-safety.md) | 类型定义与判别联合模式 |
| [Quality Guidelines](./quality-guidelines.md) | 禁止模式、代码标准 |

---

## Quick Reference

- **入口**: `src/main.tsx` → `src/App.tsx`
- **类型**: `src/types/robot.ts`（所有共享 TS 类型）
- **Hooks**: `src/hooks/useSerial.ts`（三个导出 hook）
- **组件**: `src/components/`（每个文件一个组件或紧密相关的一组组件）
- **样式**: Tailwind CSS v4，通过 CSS 变量的主题系统，不使用原生 Tailwind 颜色类
- **后端通信**: `invoke()` (请求-响应) 和 `listen()` (事件推送) 来自 `@tauri-apps/api/core`
