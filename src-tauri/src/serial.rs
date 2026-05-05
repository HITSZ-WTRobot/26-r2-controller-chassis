use std::sync::Mutex;
use std::io::{Read, Write};
use serialport::{SerialPort, SerialPortType, available_ports};

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