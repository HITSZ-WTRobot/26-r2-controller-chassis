use serde::{Deserialize, Serialize};
use crate::protocol::{CommandFrame, scale_x, scale_y, scale_yaw, scale_vx, scale_vy, scale_wz, scale_height};

/// Command types matching firmware protocol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Command {
    Ping,
    StopChassis,
    SetChassisHeight { height: f32, v_max: f32, a_max: f32, j_max: f32, link_mode: u16 },
    SetMasterChassisTargetCurrentState { x: f32, y: f32, yaw: f32, xy_vmax: f32, xy_amax: f32, yaw_vmax: f32, yaw_amax: f32 },
    SetMasterChassisTargetPreviousCurve { x: f32, y: f32, yaw: f32, xy_vmax: f32, xy_amax: f32, yaw_vmax: f32, yaw_amax: f32 },
    SetMasterChassisVelocity { vx: f32, vy: f32, wz: f32 },
    SetGripPose { arm_pos: f32, turn_pos: f32, claw_mode: u16 },
    SetGripPresetPose { preset_id: u16 },
    LidarPosture { x: f32, y: f32, yaw: f32, lidar_timestamp: u32 },
    StepUp200 { start_distance: f32, end_distance: f32, direction: u16, end_height: u16 },
    StepUpResume,
    StepDown200 { start_distance: f32, end_distance: f32, direction: u16, end_height: u16 },
    StepUp400 { start_distance: f32, end_distance: f32, direction: u16, end_height: u16 },
    StepDown400 { start_distance: f32, end_distance: f32, direction: u16, end_height: u16 },
    StartOfflineTrajectory { traj_id: u16, mirror: u16 },
    StepUpR1 { step_target_x: f32, step_target_y: f32, step_target_yaw: f32, direction: u16 },
    StepUpR1Direct { direction: u16 },
    TakeSpear { target_x: f32, target_y: f32, target_yaw: f32, end_x: f32, end_y: f32, end_yaw: f32 },
    TakeSpearById { spear_id: u16, end_x: f32, end_y: f32, end_yaw: f32 },
    StepPose { step_type: u8, direction: u8, step_height: u8, final_height: u8, step_target_x: f32, step_target_y: f32, step_target_yaw: f32, end_x: f32, end_y: f32, end_yaw: f32 },
    StoreKFS,
    ReleaseKFS,
    SetGripSuction { on: u16 },
    SetAbdomenSuction { on: u16 },
    SetGripClaw { claw_mode: u16 },
}

impl Command {
    pub fn encode(&self, timestamp: u32) -> Vec<u8> {
        match self {
            Command::Ping => {
                let frame = CommandFrame {
                    cmd: 0x01,
                    data: [0; 12],
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::StopChassis => {
                let frame = CommandFrame {
                    cmd: 0x10,
                    data: [0; 12],
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::SetChassisHeight { height, v_max, a_max, j_max, link_mode } => {
                let mut data = [0u8; 12];
                let h = scale_height(*height);
                data[0..2].copy_from_slice(&h.to_be_bytes());
                let v = (*v_max * 1000.0) as u16;
                data[2..4].copy_from_slice(&v.to_be_bytes());
                let a = (*a_max * 100.0) as u16;
                data[4..6].copy_from_slice(&a.to_be_bytes());
                data[6..8].copy_from_slice(&(*j_max as u16).to_be_bytes());
                data[8..10].copy_from_slice(&link_mode.to_be_bytes());
                let frame = CommandFrame {
                    cmd: 0x11,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::SetMasterChassisTargetCurrentState { x, y, yaw, xy_vmax, xy_amax, yaw_vmax, yaw_amax } |
            Command::SetMasterChassisTargetPreviousCurve { x, y, yaw, xy_vmax, xy_amax, yaw_vmax, yaw_amax } => {
                let cmd = if matches!(self, Command::SetMasterChassisTargetCurrentState {..}) { 0x13 } else { 0x14 };
                let mut data = [0u8; 12];
                data[0..2].copy_from_slice(&scale_x(*x).to_be_bytes());
                data[2..4].copy_from_slice(&scale_y(*y).to_be_bytes());
                data[4..6].copy_from_slice(&scale_yaw(*yaw).to_be_bytes());
                // Pack 4x uint12: xy_vmax*200, xy_amax*200, yaw_vmax, yaw_amax
                let xy_v = (*xy_vmax * 200.0) as u16;
                let xy_a = (*xy_amax * 200.0) as u16;
                let yaw_v = *yaw_vmax as u16;
                let yaw_a = *yaw_amax as u16;
                // uint12 packing: [a11:a4][a3:a0|b11:b8][b7:b0][c11:c4][c3:c0|d11:d8][d7:d0]
                data[6] = ((xy_v >> 4) & 0xFF) as u8;
                data[7] = (((xy_v & 0x0F) << 4) | ((xy_a >> 8) & 0x0F)) as u8;
                data[8] = (xy_a & 0xFF) as u8;
                data[9] = ((yaw_v >> 4) & 0xFF) as u8;
                data[10] = (((yaw_v & 0x0F) << 4) | ((yaw_a >> 8) & 0x0F)) as u8;
                data[11] = (yaw_a & 0xFF) as u8;
                let frame = CommandFrame {
                    cmd,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::SetMasterChassisVelocity { vx, vy, wz } => {
                let mut data = [0u8; 12];
                data[0..2].copy_from_slice(&scale_vx(*vx).to_be_bytes());
                data[2..4].copy_from_slice(&scale_vy(*vy).to_be_bytes());
                data[4..6].copy_from_slice(&scale_wz(*wz).to_be_bytes());
                // reserve0, reserve1, reserve2 stay zero
                let frame = CommandFrame {
                    cmd: 0x15,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::SetGripPose { arm_pos, turn_pos, claw_mode } => {
                let mut data = [0u8; 12];
                data[0..2].copy_from_slice(&scale_yaw(*arm_pos).to_be_bytes());
                data[2..4].copy_from_slice(&scale_yaw(*turn_pos).to_be_bytes());
                data[4..6].copy_from_slice(&claw_mode.to_be_bytes());
                // reserve0, reserve1, reserve2 stay zero
                let frame = CommandFrame {
                    cmd: 0x16,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::SetGripPresetPose { preset_id } => {
                let mut data = [0u8; 12];
                data[0..2].copy_from_slice(&preset_id.to_be_bytes());
                // reserve0..reserve4 stay zero
                let frame = CommandFrame {
                    cmd: 0x17,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::StartOfflineTrajectory { traj_id, mirror } => {
                let mut data = [0u8; 12];
                data[0..2].copy_from_slice(&traj_id.to_be_bytes());
                data[2..4].copy_from_slice(&mirror.to_be_bytes());
                // reserve0..reserve3 stay zero
                let frame = CommandFrame {
                    cmd: 0x18,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::LidarPosture { x, y, yaw, lidar_timestamp } => {
                let mut data = [0u8; 12];
                data[0..2].copy_from_slice(&scale_x(*x).to_be_bytes());
                data[2..4].copy_from_slice(&scale_y(*y).to_be_bytes());
                data[4..6].copy_from_slice(&scale_yaw(*yaw).to_be_bytes());
                data[6..10].copy_from_slice(&lidar_timestamp.to_be_bytes());
                let frame = CommandFrame {
                    cmd: 0x21,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::StepUp200 { start_distance, end_distance, direction, end_height } => {
                let mut data = [0u8; 12];
                let sd = (start_distance * 2000.0) as i16;
                let ed = (end_distance * 2000.0) as i16;
                data[0..2].copy_from_slice(&sd.to_be_bytes());
                data[2..4].copy_from_slice(&ed.to_be_bytes());
                data[4..6].copy_from_slice(&direction.to_be_bytes());
                data[6..8].copy_from_slice(&end_height.to_be_bytes());
                let frame = CommandFrame {
                    cmd: 0x30,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::StepUp400 { start_distance, end_distance, direction, end_height } => {
                let mut data = [0u8; 12];
                let sd = (start_distance * 2000.0) as i16;
                let ed = (end_distance * 2000.0) as i16;
                data[0..2].copy_from_slice(&sd.to_be_bytes());
                data[2..4].copy_from_slice(&ed.to_be_bytes());
                data[4..6].copy_from_slice(&direction.to_be_bytes());
                data[6..8].copy_from_slice(&end_height.to_be_bytes());
                let frame = CommandFrame {
                    cmd: 0x33,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::StepUpResume => {
                let frame = CommandFrame {
                    cmd: 0x31,
                    data: [0; 12],
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::StepDown200 { start_distance, end_distance, direction, end_height } => {
                let mut data = [0u8; 12];
                let sd = (start_distance * 2000.0) as i16;
                let ed = (end_distance * 2000.0) as i16;
                data[0..2].copy_from_slice(&sd.to_be_bytes());
                data[2..4].copy_from_slice(&ed.to_be_bytes());
                data[4..6].copy_from_slice(&direction.to_be_bytes());
                data[6..8].copy_from_slice(&end_height.to_be_bytes());
                let frame = CommandFrame {
                    cmd: 0x32,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::StepDown400 { start_distance, end_distance, direction, end_height } => {
                let mut data = [0u8; 12];
                let sd = (start_distance * 2000.0) as i16;
                let ed = (end_distance * 2000.0) as i16;
                data[0..2].copy_from_slice(&sd.to_be_bytes());
                data[2..4].copy_from_slice(&ed.to_be_bytes());
                data[4..6].copy_from_slice(&direction.to_be_bytes());
                data[6..8].copy_from_slice(&end_height.to_be_bytes());
                let frame = CommandFrame {
                    cmd: 0x34,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::StepUpR1 { step_target_x, step_target_y, step_target_yaw, direction } => {
                let mut data = [0u8; 12];
                data[0..2].copy_from_slice(&scale_x(*step_target_x).to_be_bytes());
                data[2..4].copy_from_slice(&scale_y(*step_target_y).to_be_bytes());
                data[4..6].copy_from_slice(&scale_yaw(*step_target_yaw).to_be_bytes());
                data[6..8].copy_from_slice(&direction.to_be_bytes());
                let frame = CommandFrame {
                    cmd: 0x35,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::StepUpR1Direct { direction } => {
                let mut data = [0u8; 12];
                data[0..2].copy_from_slice(&direction.to_be_bytes());
                // reserve0..reserve4 stay zero
                let frame = CommandFrame {
                    cmd: 0x36,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::TakeSpear { target_x, target_y, target_yaw, end_x, end_y, end_yaw } => {
                let mut data = [0u8; 12];
                data[0..2].copy_from_slice(&scale_x(*target_x).to_be_bytes());
                data[2..4].copy_from_slice(&scale_y(*target_y).to_be_bytes());
                data[4..6].copy_from_slice(&scale_yaw(*target_yaw).to_be_bytes());
                data[6..8].copy_from_slice(&scale_x(*end_x).to_be_bytes());
                data[8..10].copy_from_slice(&scale_y(*end_y).to_be_bytes());
                data[10..12].copy_from_slice(&scale_yaw(*end_yaw).to_be_bytes());
                let frame = CommandFrame {
                    cmd: 0x40,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::TakeSpearById { spear_id, end_x, end_y, end_yaw } => {
                let mut data = [0u8; 12];
                data[0..2].copy_from_slice(&spear_id.to_be_bytes());
                data[2..4].copy_from_slice(&scale_x(*end_x).to_be_bytes());
                data[4..6].copy_from_slice(&scale_y(*end_y).to_be_bytes());
                data[6..8].copy_from_slice(&scale_yaw(*end_yaw).to_be_bytes());
                // reserve0, reserve1 stay zero
                let frame = CommandFrame {
                    cmd: 0x41,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::StepPose { step_type, direction, step_height, final_height, step_target_x, step_target_y, step_target_yaw, end_x, end_y, end_yaw } => {
                let cmd = 0x50 | (step_type << 3) | (direction << 2) | (step_height << 1) | final_height;
                let mut data = [0u8; 12];
                data[0..2].copy_from_slice(&scale_x(*step_target_x).to_be_bytes());
                data[2..4].copy_from_slice(&scale_y(*step_target_y).to_be_bytes());
                data[4..6].copy_from_slice(&scale_yaw(*step_target_yaw).to_be_bytes());
                data[6..8].copy_from_slice(&scale_x(*end_x).to_be_bytes());
                data[8..10].copy_from_slice(&scale_y(*end_y).to_be_bytes());
                data[10..12].copy_from_slice(&scale_yaw(*end_yaw).to_be_bytes());
                let frame = CommandFrame {
                    cmd,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::StoreKFS => {
                let frame = CommandFrame {
                    cmd: 0x42,
                    data: [0; 12],
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::ReleaseKFS => {
                let frame = CommandFrame {
                    cmd: 0x43,
                    data: [0; 12],
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::SetGripSuction { on } => {
                let mut data = [0u8; 12];
                data[0..2].copy_from_slice(&on.to_be_bytes());
                let frame = CommandFrame {
                    cmd: 0x44,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::SetAbdomenSuction { on } => {
                let mut data = [0u8; 12];
                data[0..2].copy_from_slice(&on.to_be_bytes());
                let frame = CommandFrame {
                    cmd: 0x45,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
            Command::SetGripClaw { claw_mode } => {
                let mut data = [0u8; 12];
                data[0..2].copy_from_slice(&claw_mode.to_be_bytes());
                let frame = CommandFrame {
                    cmd: 0x46,
                    data,
                    tx_timestamp: timestamp,
                };
                frame.encode()
            }
        }
    }
}