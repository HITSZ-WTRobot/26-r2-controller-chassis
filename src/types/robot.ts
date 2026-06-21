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
  infrared_receiver_state: InfraredReceiverState;
}

export type StepStatus = 'Idle' | 'Done' | 'Running' | 'WaitingTake';
export type ChassisMode = 'Stop' | 'Velocity' | 'Position' | 'Slave';
export type LiftStatus = 'Calibrating' | 'Running' | 'Ready' | 'NotEnabled';
export type GripStatus = 'Calibrating' | 'TakingSpear' | 'KfsStore' | 'KfsRelease' | 'Idle' | 'Done';
export type InfraredReceiverState = 'KeepAlive' | 'DockingComplete' | 'NoAction' | 'Reserved';

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
  grip_suction_pressure: boolean;
  abdomen_suction_pressure: boolean;
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
  | { type: 'StepUp200'; start_distance: number; end_distance: number; direction: number; end_height: number }
  | { type: 'StepUpResume' }
  | { type: 'StepDown200'; start_distance: number; end_distance: number; direction: number; end_height: number }
  | { type: 'StepUp400'; start_distance: number; end_distance: number; direction: number; end_height: number }
  | { type: 'StepDown400'; start_distance: number; end_distance: number; direction: number; end_height: number }
  | { type: 'StepUpR1'; step_target_x: number; step_target_y: number; step_target_yaw: number; direction: number }
  | { type: 'TakeSpear'; target_x: number; target_y: number; target_yaw: number; end_x: number; end_y: number; end_yaw: number }
  | { type: 'TakeSpearById'; spear_id: number; end_x: number; end_y: number; end_yaw: number }
  | { type: 'StoreKFS' }
  | { type: 'ReleaseKFS' }
  | { type: 'SetGripSuction'; on: number }
  | { type: 'SetAbdomenSuction'; on: number }
  | { type: 'SetGripClaw'; claw_mode: number }
  | { type: 'SetGripPose'; arm_pos: number; turn_pos: number; claw_mode: number }
  | { type: 'SetGripPresetPose'; preset_id: number }
  | { type: 'StepPose'; step_type: number; direction: number; step_height: number; final_height: number; step_target_x: number; step_target_y: number; step_target_yaw: number; end_x: number; end_y: number; end_yaw: number };