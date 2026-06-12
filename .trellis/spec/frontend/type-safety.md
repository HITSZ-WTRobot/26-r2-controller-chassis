# Type Safety

> TypeScript 类型定义和使用规范。

---

## Type Organization

所有共享类型定义在 `src/types/robot.ts`。调试专用的本地类型（如 `FrameAnalysis`、`LogEntry`）定义在使用它们的组件文件中。

---

## Type Categories

### 数据接口

直接映射 Rust 后端的序列化形状：

```typescript
// src/types/robot.ts
export interface RobotState {
  timestamp: number;
  x: number; y: number; yaw: number;
  front_height: number; rear_height: number;
  action_state: ActionState;
  connection_state: ConnectionState;
}

export interface PortInfo {
  name: string;
  port_type: string;
}
```

### 字符串字面量联合（枚举字段）

```typescript
export type StepStatus = 'Idle' | 'Done' | 'Running' | 'WaitingTake';
export type ChassisMode = 'Stop' | 'Velocity' | 'Position' | 'Slave';
export type LiftStatus = 'Calibrating' | 'Running' | 'Ready' | 'NotEnabled';
export type GripStatus = 'Calibrating' | 'TakingSpear' | 'KfsStore' | 'KfsRelease' | 'Idle' | 'Done';
export type InfraredReceiverState = 'KeepAlive' | 'DockingComplete' | 'NoAction' | 'Reserved';
export type ConnectionStatus = 'Disconnected' | 'Connecting' | 'Connected';
```

### 判别联合（Tagged Union）

命令类型使用 `type` 字段作为判别器：

```typescript
// src/types/robot.ts
export type Command =
  | { type: 'Ping' }
  | { type: 'StopChassis' }
  | { type: 'SetChassisHeight'; height: number; v_max: number; a_max: number; j_max: number; linkMode: number }
  | { type: 'SetMasterChassisTargetCurrentState'; x: number; y: number; yaw: number; xy_vmax: number; xy_amax: number; yaw_vmax: number; yaw_amax: number }
  | { type: 'SetMasterChassisVelocity'; vx: number; vy: number; wz: number }
  | { type: 'SetGripPose'; arm_pos: number; turn_pos: number; clawMode: number }
  | { type: 'SetGripPresetPose'; presetId: number }
  | { type: 'LidarPosture'; x: number; y: number; yaw: number; lidar_timestamp: number }
  | { type: 'StepUp200'; startDist: number; endDist: number; direction: number; willTake: number }
  | { type: 'StepUpResume' }
  | { type: 'StepDown200'; startDist: number; endDist: number; direction: number; shouldReset: number }
  | { type: 'StepUp400'; startDist: number; endDist: number; direction: number; willTake: number }
  | { type: 'StepDown400'; startDist: number; endDist: number; direction: number; shouldReset: number }
  | { type: 'TakeSpear'; target: { x: number; y: number; yaw: number }; end: { x: number; y: number; yaw: number } }
  | { type: 'TakeSpearById'; spearId: number; end: { x: number; y: number; yaw: number } }
  | { type: 'StoreKFS' }
  | { type: 'ReleaseKFS' };
```

**关键规则**：每个命令变体有一个 `type: 'LiteralString'` 字段。`useCommand` hook 使用此字段构造 `invoke()` 参数。

---

## Import Type Pattern

仅类型导入使用 `import type`：

```typescript
import type { RobotState, Command, PortInfo } from '../types/robot';
// 值导入
import { useState } from 'react';
```

可混合同一导入行中的类型和值（TypeScript 5.0+）：

```typescript
import { useState, type ReactNode } from 'react';
```

---

## Adding New Types

1. 新类型添加到 `src/types/robot.ts`（如果跨组件共享）或组件文件内（如果仅本地使用）
2. 新命令变体添加到 `Command` 判别联合
3. 后端新增位域字段时，同步更新 `ActionState` 或 `ConnectionState` 接口
4. 新字符串字面量联合成员按固件协议位定义顺序排列

---

## Forbidden Patterns

1. **不要使用 `any`** — 所有类型应明确
2. **不要使用类型断言（`as`）绕过类型检查** — 除非在 `useCommand` 序列化等有明确边界的适配层中
3. **不要在组件 props 中使用 `object` 或 `{}` 类型** — 始终使用明确的接口
4. **不要在 `RobotState`/`ActionState` 中添加可选字段** — 后端总是发送完整结构，字段应为必填
5. **不要从组件文件导出类型** — 共享类型应统一在 `src/types/` 中管理
