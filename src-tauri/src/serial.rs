use std::sync::{Arc, Mutex};
use serialport::{SerialPort, SerialPortType, available_ports};

pub struct SerialManager {
    port: Option<Arc<Mutex<Box<dyn SerialPort>>>>,
}

impl SerialManager {
    pub fn new() -> Self {
        Self { port: None }
    }

    pub fn connect(&mut self, port_name: &str, baud_rate: u32) -> Result<(), String> {
        let port = serialport::new(port_name, baud_rate)
            .timeout(std::time::Duration::from_millis(5)) // short timeout so writer isn't stalled
            .open()
            .map_err(|e| e.to_string())?;
        self.port = Some(Arc::new(Mutex::new(port)));
        Ok(())
    }

    pub fn disconnect(&mut self) {
        self.port = None;
    }

    pub fn handle(&self) -> Result<Arc<Mutex<Box<dyn SerialPort>>>, String> {
        self.port.clone().ok_or_else(|| "Not connected".to_string())
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
