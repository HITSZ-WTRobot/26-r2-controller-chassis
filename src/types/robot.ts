// Robot state types matching Rust backend
export interface RobotState {
  timestamp: number;
  x: number;
  y: number;
  yaw: number;
  front_height: number;
  rear_height: number;
  action_state: ActionState;
  connection_state: ConnectionState;
}

export interface ActionState {
  step_status: StepStatus;
  chassis_mode: ChassisMode;
  chassis_curve_finished: boolean;
  lift_status: LiftStatus;
  grip_status: GripStatus;
  grip_suction_has_object: boolean;
}

export type StepStatus = 'Idle' | 'Done' | 'Running' | 'WaitingTake';
export type ChassisMode = 'Stop' | 'Velocity' | 'Position' | 'Slave';
export type LiftStatus = 'Calibrating' | 'Running' | 'Ready' | 'NotEnabled';
export type GripStatus = 'Calibrating' | 'TakingSpear' | 'KfsStore' | 'KfsRelease' | 'Idle' | 'Done';

export interface ConnectionState {
  wheel_0: boolean;
  wheel_1: boolean;
  wheel_2: boolean;
  wheel_3: boolean;
  lift_0: boolean;
  lift_1: boolean;
  lift_2: boolean;
  lift_3: boolean;
  grip_arm: boolean;
  grip_turn: boolean;
  gyro_yaw: boolean;
  upper_host_localization: boolean;
  upper_host: boolean;
}

export type ConnectionStatus = 'Disconnected' | 'Connecting' | 'Connected';

export interface PortInfo {
  name: string;
  port_type: string;
}

// Command types
export type Command =
  | { type: 'Ping' }
  | { type: 'StopChassis' }
  | { type: 'SetChassisHeight'; height: number; v_max: number; a_max: number; j_max: number; link_mode: number }
  | { type: 'SetMasterChassisTargetCurrentState'; x: number; y: number; yaw: number; xy_vmax: number; xy_amax: number; yaw_vmax: number; yaw_amax: number }
  | { type: 'SetMasterChassisVelocity'; vx: number; vy: number; wz: number }
  | { type: 'LidarPosture'; x: number; y: number; yaw: number; lidar_timestamp: number }
  | { type: 'StepUp'; start_distance: number; end_distance: number; direction: number; will_take: number }
  | { type: 'StepUpResume' }
  | { type: 'StepDown'; start_distance: number; end_distance: number; direction: number; should_reset: number }
  | { type: 'TakeSpear'; target_x: number; target_y: number; target_yaw: number; end_x: number; end_y: number; end_yaw: number }
  | { type: 'TakeSpearById'; spear_id: number; end_x: number; end_y: number; end_yaw: number }
  | { type: 'StoreKFS' }
  | { type: 'ReleaseKFS' };