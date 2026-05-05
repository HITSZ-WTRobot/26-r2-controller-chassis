use std::io::{Read, Write};
use serialport::{SerialPort, SerialPortType, available_ports};

pub struct SerialManager {
    port: Option<Box<dyn SerialPort>>,
}

pub struct SerialReader {
    port: Box<dyn SerialPort>,
}

impl SerialReader {
    pub fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        self.port.read(buf)
    }
}

pub struct SerialWriter {
    port: Box<dyn SerialPort>,
}

impl SerialWriter {
    pub fn write_all(&mut self, data: &[u8]) -> std::io::Result<()> {
        self.port.write_all(data)
    }
}

impl SerialManager {
    pub fn new() -> Self {
        Self { port: None }
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

    /// Produce independent reader/writer handles backed by OS-level clones of
    /// the port. Reader and writer can run on separate threads without stalling
    /// each other.
    pub fn split(&self) -> Result<(SerialReader, SerialWriter), String> {
        let port = self.port.as_ref().ok_or_else(|| "Not connected".to_string())?;
        let reader_port = port.try_clone().map_err(|e| e.to_string())?;
        let writer_port = port.try_clone().map_err(|e| e.to_string())?;
        Ok((
            SerialReader { port: reader_port },
            SerialWriter { port: writer_port },
        ))
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