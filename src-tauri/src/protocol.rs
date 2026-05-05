use serde::{Deserialize, Serialize};

/// Frame header
pub const FRAME_HEADER: [u8; 2] = [0xAA, 0xBB];

/// Control frame: 21 bytes
/// [AA, BB, cmd, data[12], tx_timestamp[4], crc16[2]]
pub struct CommandFrame {
    pub cmd: u8,
    pub data: [u8; 12],
    pub tx_timestamp: u32,
}

/// Feedback frame: 22 bytes
/// [AA, BB, timestamp[4], x, y, yaw, frontHeight, rearHeight, action_state, connection_state, crc16[2]]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeedbackFrame {
    pub timestamp: u32,
    pub x: i16,
    pub y: i16,
    pub yaw: i16,
    pub front_height: i16,
    pub rear_height: i16,
    pub action_state: u16,
    pub connection_state: u16,
}

/// CRC16-Modbus parameters
const CRC16_POLY: u16 = 0x8005;
const CRC16_INIT: u16 = 0xFFFF;

pub fn crc16_modbus(data: &[u8]) -> u16 {
    let mut crc = CRC16_INIT;
    for &byte in data {
        crc ^= byte as u16;
        for _ in 0..8 {
            if crc & 0x0001 != 0 {
                crc = (crc >> 1) ^ CRC16_POLY;
            } else {
                crc >>= 1;
            }
        }
    }
    // Reverse bits
    crc = crc.reverse_bits();
    crc
}

pub fn verify_crc(data: &[u8], expected_crc: u16) -> bool {
    crc16_modbus(data) == expected_crc
}

#[derive(Debug, PartialEq)]
pub enum ParseError {
    InvalidHeader,
    InvalidLength,
    InvalidCrc,
    Incomplete,
}

impl CommandFrame {
    pub fn encode(&self) -> Vec<u8> {
        let mut frame = Vec::with_capacity(21);
        frame.push(FRAME_HEADER[0]);
        frame.push(FRAME_HEADER[1]);
        frame.push(self.cmd);
        frame.extend_from_slice(&self.data);
        frame.extend_from_slice(&self.tx_timestamp.to_be_bytes());
        let crc_data = &frame[2..19]; // cmd + data + timestamp
        let crc = crc16_modbus(crc_data);
        frame.extend_from_slice(&crc.to_be_bytes());
        frame
    }
}

impl FeedbackFrame {
    pub fn parse(data: &[u8]) -> Result<Self, ParseError> {
        if data.len() < 22 {
            return Err(ParseError::Incomplete);
        }
        if data[0] != 0xAA || data[1] != 0xBB {
            return Err(ParseError::InvalidHeader);
        }

        let crc_data = &data[2..20];
        let expected_crc = u16::from_be_bytes([data[20], data[21]]);
        if crc16_modbus(crc_data) != expected_crc {
            return Err(ParseError::InvalidCrc);
        }

        let timestamp = u32::from_be_bytes([data[2], data[3], data[4], data[5]]);
        let x = i16::from_be_bytes([data[6], data[7]]);
        let y = i16::from_be_bytes([data[8], data[9]]);
        let yaw = i16::from_be_bytes([data[10], data[11]]);
        let front_height = i16::from_be_bytes([data[12], data[13]]);
        let rear_height = i16::from_be_bytes([data[14], data[15]]);
        let action_state = u16::from_be_bytes([data[16], data[17]]);
        let connection_state = u16::from_be_bytes([data[18], data[19]]);

        Ok(FeedbackFrame {
            timestamp,
            x,
            y,
            yaw,
            front_height,
            rear_height,
            action_state,
            connection_state,
        })
    }
}

// Scaling helpers
pub fn scale_x(value: f32) -> i16 { (value * 2000.0) as i16 }
pub fn scale_y(value: f32) -> i16 { (value * 2000.0) as i16 }
pub fn scale_yaw(value: f32) -> i16 { (value * 100.0) as i16 }
pub fn scale_vx(value: f32) -> i16 { (value * 2000.0) as i16 }
pub fn scale_vy(value: f32) -> i16 { (value * 2000.0) as i16 }
pub fn scale_wz(value: f32) -> i16 { (value * 100.0) as i16 }
pub fn scale_height(value: f32) -> i16 { (value * 2000.0) as i16 }

pub fn unscale_x(raw: i16) -> f32 { raw as f32 / 2000.0 }
pub fn unscale_y(raw: i16) -> f32 { raw as f32 / 2000.0 }
pub fn unscale_yaw(raw: i16) -> f32 { raw as f32 / 100.0 }
pub fn unscale_front_height(raw: i16) -> f32 { raw as f32 / 2000.0 }
pub fn unscale_rear_height(raw: i16) -> f32 { raw as f32 / 2000.0 }