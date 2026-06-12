# Code Reuse Thinking Guide

> **Purpose**: Stop and think before creating new code - does it already exist?

---

## The Problem

**Duplicated code is the #1 source of inconsistency bugs.**

When you copy-paste or rewrite existing logic:
- Bug fixes don't propagate
- Behavior diverges over time
- Codebase becomes harder to understand

---

## Before Writing New Code

### Step 1: Search First

```bash
# Search for similar function names
grep -r "functionName" .

# Search for similar logic
grep -r "keyword" .
```

### Step 2: Ask These Questions

| Question | If Yes... |
|----------|-----------|
| Does a similar function exist? | Use or extend it |
| Is this pattern used elsewhere? | Follow the existing pattern |
| Could this be a shared utility? | Create it in the right place |
| Am I copying code from another file? | **STOP** - extract to shared |

---

## Common Duplication Patterns

### Pattern 1: Copy-Paste Functions

**Bad**: Copying a validation function to another file

**Good**: Extract to shared utilities, import where needed

### Pattern 2: Similar Components

**Bad**: Creating a new component that's 80% similar to existing

**Good**: Extend existing component with props/variants

### Pattern 3: Repeated Constants

**Bad**: Defining the same constant in multiple files

**Good**: Single source of truth, import everywhere

---

## When to Abstract

**Abstract when**:
- Same code appears 3+ times
- Logic is complex enough to have bugs
- Multiple people might need this

**Don't abstract when**:
- Only used once
- Trivial one-liner
- Abstraction would be more complex than duplication

---

## After Batch Modifications

When you've made similar changes to multiple files:

1. **Review**: Did you catch all instances?
2. **Search**: Run grep to find any missed
3. **Consider**: Should this be abstracted?

---

## Gotcha: Asymmetric Mechanisms Producing Same Output

**Problem**: When two different mechanisms must produce the same file set (e.g., recursive directory copy for init vs. manual `files.set()` for update), structural changes (renaming, moving, adding subdirectories) only propagate through the automatic mechanism. The manual one silently drifts.

**Symptom**: Init works perfectly, but update creates files at wrong paths or misses files entirely.

**Prevention checklist**:
- [ ] When migrating directory structures, search for ALL code paths that reference the old structure
- [ ] If one path is auto-derived (glob/copy) and another is manually listed, the manual one needs updating
- [ ] Add a regression test that compares outputs from both mechanisms

---

## Checklist Before Commit

- [ ] Searched for existing similar code
- [ ] No copy-pasted logic that should be shared
- [ ] Constants defined in one place
- [ ] Similar patterns follow same structure

---

## Project-Specific Duplication Patterns

### Frontend: UI 辅助组件重复

**已知重复**：
- `ControlPanel.tsx` 中的 `SliderRow` ≈ `WasdVelocityControl.tsx` 中的 `SliderField`
- `ControlPanel.tsx` 中的 `NumField` ≈ `WasdVelocityControl.tsx` 中的内联数字输入

**规则**：提取到 `src/components/ui/` 作为共享组件。在添加新 UI 辅助组件前，先检查 `src/components/ui/` 目录。

### Frontend: Hook 实例化重复

**已知问题**：`useCommand()` 在每个控制面板组件中被调用，创建多个 `send` 函数引用。功能上无害（无状态），但表明缺少共享抽象。

### Backend: 命令编码重复

**已知模式**：`cmd!` 宏已消除命令包装器的重复。新命令应使用宏而非手动编写包装器。

### Backend: 缩放函数对

**规则**：`scale_*` 和 `unscale_*` 函数必须成对存在。不要只写一个方向。

### 跨层: 协议常量

**已知位置**：
- `FRAME_HEADER`、帧长度在 `src-tauri/src/protocol.rs` 中
- 命令 ID 在 `src-tauri/src/commands.rs` 中
- 位域布局在 `src-tauri/src/state.rs` 中
- 前端 `src/types/robot.ts` 中的类型反映所有这些

**规则**：修改协议常量时，grep 所有 4 个文件以查找受影响的位置。
