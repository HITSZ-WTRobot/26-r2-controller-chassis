use serde::{Deserialize, Serialize};
use crate::protocol::{FeedbackFrame, unscale_x, unscale_y, unscale_yaw, unscale_front_height, unscale_rear_height};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RobotState {
    pub timestamp: u32,
    pub x: f32,
    pub y: f32,
    pub yaw: f32,
    pub front_height: f32,
    pub rear_height: f32,
    pub action_state: ActionState,
    pub connection_state: ConnectionState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionState {
    pub step_status: StepStatus,
    pub chassis_mode: ChassisMode,
    pub chassis_curve_finished: bool,
    pub lift_status: LiftStatus,
    pub grip_status: GripStatus,
    pub grip_suction_has_object: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StepStatus {
    Idle,
    Done,
    Running,
    WaitingTake,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChassisMode {
    Stop,
    Velocity,
    Position,
    Slave,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LiftStatus {
    Calibrating,
    Running,
    Ready,
    NotEnabled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GripStatus {
    Calibrating,
    TakingSpear,
    KfsStore,
    KfsRelease,
    Idle,
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionState {
    pub wheel_0: bool,
    pub wheel_1: bool,
    pub wheel_2: bool,
    pub wheel_3: bool,
    pub lift_0: bool,
    pub lift_1: bool,
    pub lift_2: bool,
    pub lift_3: bool,
    pub grip_arm: bool,
    pub grip_turn: bool,
    pub gyro_yaw: bool,
    pub upper_host_localization: bool,
    pub upper_host: bool,
}

impl RobotState {
    pub fn from_feedback(frame: &FeedbackFrame) -> Self {
        RobotState {
            timestamp: frame.timestamp,
            x: unscale_x(frame.x),
            y: unscale_y(frame.y),
            yaw: unscale_yaw(frame.yaw),
            front_height: unscale_front_height(frame.front_height),
            rear_height: unscale_rear_height(frame.rear_height),
            action_state: ActionState::from_table(frame.action_state),
            connection_state: ConnectionState::from_table(frame.connection_state),
        }
    }

    pub fn default() -> Self {
        RobotState {
            timestamp: 0,
            x: 0.0,
            y: 0.0,
            yaw: 0.0,
            front_height: 0.0,
            rear_height: 0.0,
            action_state: ActionState::default(),
            connection_state: ConnectionState::default(),
        }
    }
}

impl Default for ActionState {
    fn default() -> Self {
        ActionState {
            step_status: StepStatus::Idle,
            chassis_mode: ChassisMode::Stop,
            chassis_curve_finished: false,
            lift_status: LiftStatus::Calibrating,
            grip_status: GripStatus::Calibrating,
            grip_suction_has_object: false,
        }
    }
}

impl Default for ConnectionState {
    fn default() -> Self {
        ConnectionState {
            wheel_0: false,
            wheel_1: false,
            wheel_2: false,
            wheel_3: false,
            lift_0: false,
            lift_1: false,
            lift_2: false,
            lift_3: false,
            grip_arm: false,
            grip_turn: false,
            gyro_yaw: false,
            upper_host_localization: false,
            upper_host: false,
        }
    }
}

impl ActionState {
    pub fn from_table(table: u16) -> Self {
        let step_status = match (table >> 0) & 0x3 {
            0 => StepStatus::Idle,
            1 => StepStatus::Done,
            2 => StepStatus::Running,
            3 => StepStatus::WaitingTake,
            _ => StepStatus::Idle,
        };
        let chassis_mode = match (table >> 2) & 0x3 {
            0 => ChassisMode::Stop,
            1 => ChassisMode::Velocity,
            2 => ChassisMode::Position,
            3 => ChassisMode::Slave,
            _ => ChassisMode::Stop,
        };
        let chassis_curve_finished = ((table >> 4) & 0x1) != 0;
        let lift_status = match (table >> 5) & 0x3 {
            0 => LiftStatus::Calibrating,
            1 => LiftStatus::Running,
            2 => LiftStatus::Ready,
            3 => LiftStatus::NotEnabled,
            _ => LiftStatus::Calibrating,
        };
        let grip_status = match (table >> 7) & 0x7 {
            0 => GripStatus::Calibrating,
            1 => GripStatus::TakingSpear,
            2 => GripStatus::KfsStore,
            3 => GripStatus::KfsRelease,
            4 => GripStatus::Idle,
            5 => GripStatus::Done,
            _ => GripStatus::Calibrating,
        };
        let grip_suction_has_object = ((table >> 10) & 0x1) != 0;
        ActionState {
            step_status,
            chassis_mode,
            chassis_curve_finished,
            lift_status,
            grip_status,
            grip_suction_has_object,
        }
    }
}

impl ConnectionState {
    pub fn from_table(table: u16) -> Self {
        ConnectionState {
            wheel_0: (table & 0x0001) != 0,
            wheel_1: (table & 0x0002) != 0,
            wheel_2: (table & 0x0004) != 0,
            wheel_3: (table & 0x0008) != 0,
            lift_0: (table & 0x0010) != 0,
            lift_1: (table & 0x0020) != 0,
            lift_2: (table & 0x0040) != 0,
            lift_3: (table & 0x0080) != 0,
            grip_arm: (table & 0x0100) != 0,
            grip_turn: (table & 0x0200) != 0,
            gyro_yaw: (table & 0x0400) != 0,
            upper_host_localization: (table & 0x4000) != 0,
            upper_host: (table & 0x8000) != 0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
}