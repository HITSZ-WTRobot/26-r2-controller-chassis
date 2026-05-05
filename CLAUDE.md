# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Tauri 2.x desktop application with a React 19 + TypeScript frontend and Rust backend. The project is named "r2-controller" and appears to be a controller application for the Robocon 2026 competition.

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

### Frontend Architecture (React + Shadcn UI)
- **Styling**: Tailwind CSS + CSS variables for theming
- **Components**: Shadcn UI (installed via `bunx shadcn@latest add <component>`)
- **Component location**: `src/components/ui/` - Shadcn components, `src/components/` - custom components
- **Shadcn structure**: Each component has its own folder (e.g., `button.tsx`, `button.css`)

### Frontend State
React state management is handled within components using `useState` and similar hooks. No external state library is currently configured.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite 7, Tailwind CSS, Shadcn UI
- **Backend**: Rust, Tauri 2
- **Package Manager**: bun
- **Build Tool**: Vite
