use std::sync::Mutex;
use std::io::{Read, Write};
use tokio::sync::mpsc;
use serialport::{SerialPort, SerialPortType,available_ports};
use tauri::{AppHandle, Emitter};
use crate::protocol::{FeedbackFrame, ParseError};

pub struct SerialManager {
    port: Option<Box<dyn SerialPort>>,
    write_lock: Mutex<()>,
}

impl SerialManager {
    pub fn new() -> Self {
        Self {
            port: None,
            write_lock: Mutex::new(()),
        }
    }

    pub fn connect(&mut self, port_name: &str, baud_rate: u32) -> Result<(), String> {
        let port = serialport::new(port_name, baud_rate)
            .timeout(std::time::Duration::from_millis(100))
            .open()
            .map_err(|e| e.to_string())?;
        self.port = Some(port);
        Ok(())
    }

    pub fn disconnect(&mut self) {
        self.port = None;
    }

    pub fn is_connected(&self) -> bool {
        self.port.is_some()
    }

    pub fn write_frame(&mut self, data: &[u8]) -> Result<(), String> {
        let _lock = self.write_lock.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut port) = self.port {
            port.write(data).map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err("Not connected".to_string())
        }
    }

    pub fn read_bytes(&mut self, buf: &mut [u8]) -> Result<usize, String> {
        if let Some(ref mut port) = self.port {
            port.read(buf).map_err(|e| e.to_string())
        } else {
            Err("Not connected".to_string())
        }
    }
}

impl Default for SerialManager {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct PortInfo {
    pub name: String,
    pub port_type: String,
}

pub fn list_ports() -> Vec<PortInfo> {
    available_ports()
        .unwrap_or_default()
        .into_iter()
        .map(|p| {
            let port_type = match p.port_type {
                SerialPortType::UsbPort(_) => "USB".to_string(),
                SerialPortType::PciPort => "PCI".to_string(),
                SerialPortType::BluetoothPort => "Bluetooth".to_string(),
                SerialPortType::Unknown => "Unknown".to_string(),
            };
            PortInfo {
                name: p.port_name,
                port_type,
            }
        })
        .collect()
}

pub async fn run_serial_loop(
    mut serial: SerialManager,
    app_handle: AppHandle,
    mut rx: tokio::sync::mpsc::Receiver<Vec<u8>>,
) {
    let mut buf = vec![0u8; 256];
    let mut pos = 0;

    loop {
        tokio::select! {
            // Send commands
            Some(data) = rx.recv() => {
                if let Err(e) = serial.write_frame(&data) {
                    let _ = app_handle.emit("serial_error", e);
                }
            }
            // Read feedback
            result = tokio::task::spawn_blocking(|| {
                serial.read_bytes(&mut buf[pos..])
            }) => {
                match result {
                    Ok(n) if n > 0 => {
                        pos += n;
                        // Try to parse frames
                        let mut start = 0;
                        while start + 22 <= pos {
                            if buf[start] == 0xAA && buf[start + 1] == 0xBB {
                                let frame_data = &buf[start..start + 22];
                                match FeedbackFrame::parse(frame_data) {
                                    Ok(frame) => {
                                        let _ = app_handle.emit("robot_state_update", &frame);
                                        start += 22;
                                        continue;
                                    }
                                    Err(ParseError::Incomplete) => break,
                                    Err(_) => start += 1,
                                }
                            } else {
                                start += 1;
                            }
                        }
                        // Shift remaining
                        if start > 0 && start < pos {
                            buf.copy_from_slice(&buf[start..pos]);
                        }
                        pos -= start;
                    }
                    Ok(0) => {}
                    Err(e) => {
                        let _ = app_handle.emit("serial_error", e.to_string());
                    }
                }
            }
        }
    }
}