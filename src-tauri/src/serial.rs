use crate::protocol;
use crate::state::RobotState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::task::JoinHandle;
use tokio_serial::{SerialPortBuilderExt, SerialStream};

pub struct SerialConnection {
    reader: tokio::sync::Mutex<Option<tokio::io::ReadHalf<SerialStream>>>,
    writer: tokio::sync::Mutex<Option<tokio::io::WriteHalf<SerialStream>>>,
    pub connected: AtomicBool,
    read_handle: tokio::sync::Mutex<Option<JoinHandle<()>>>,
}

impl SerialConnection {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            reader: tokio::sync::Mutex::new(None),
            writer: tokio::sync::Mutex::new(None),
            connected: AtomicBool::new(false),
            read_handle: tokio::sync::Mutex::new(None),
        })
    }

    pub async fn connect(
        self: &Arc<Self>,
        port_name: &str,
        baud_rate: u32,
        app: AppHandle,
    ) -> Result<(), String> {
        let stream = tokio_serial::new(port_name, baud_rate)
            .open_native_async()
            .map_err(|e| e.to_string())?;
        let (reader, writer) = tokio::io::split(stream);

        *self.reader.lock().await = Some(reader);
        *self.writer.lock().await = Some(writer);
        self.connected.store(true, Ordering::Relaxed);

        let this = Arc::clone(self);
        let handle = tokio::spawn(async move {
            this.read_loop(app).await;
        });
        *self.read_handle.lock().await = Some(handle);

        Ok(())
    }

    async fn read_loop(self: Arc<Self>, app: AppHandle) {
        let _ = app.emit("connection_status", "connected");

        let mut buf = vec![0u8; 256];
        let mut pos = 0;
        let mut temp_buf = [0u8; 64];

        loop {
            let mut guard = self.reader.lock().await;
            let port = match guard.as_mut() {
                Some(p) => p,
                None => {
                    // Reader cleared — disconnecting
                    drop(guard);
                    let _ = app.emit("connection_status", "disconnected");
                    return;
                }
            };

            match port.read(&mut temp_buf).await {
                Ok(0) => {
                    drop(guard);
                    continue;
                }
                Ok(n) => {
                    drop(guard);
                    let _ = app.emit("serial_rx", &temp_buf[..n]);

                    if pos + n > buf.len() {
                        pos = 0;
                        continue;
                    }
                    buf[pos..pos + n].copy_from_slice(&temp_buf[..n]);
                    pos += n;

                    let mut start = 0;
                    while start + 22 <= pos {
                        if buf[start] == 0xAA && buf[start + 1] == 0xBB {
                            let frame_data = &buf[start..start + 22];
                            match protocol::FeedbackFrame::parse(frame_data) {
                                Ok(frame) => {
                                    let rs = RobotState::from_feedback(&frame);
                                    let _ = app.emit("robot_state_update", &rs);
                                    start += 22;
                                    continue;
                                }
                                Err(protocol::ParseError::Incomplete) => break,
                                Err(_) => start += 1,
                            }
                        } else {
                            start += 1;
                        }
                    }

                    if start > 0 && start < pos {
                        let remaining = pos - start;
                        buf.copy_within(start..pos, 0);
                        pos = remaining;
                    } else if start > 0 {
                        pos = 0;
                    }
                }
                Err(e) => {
                    drop(guard);
                    let _ = app.emit("serial_error", e.to_string());
                    self.handle_disconnect().await;
                    let _ = app.emit("connection_status", "disconnected");
                    return;
                }
            }
        }
    }

    pub async fn write_frame(&self, data: &[u8]) -> Result<(), String> {
        let mut writer = self.writer.lock().await;
        if let Some(ref mut w) = *writer {
            w.write_all(data).await.map_err(|e| e.to_string())
        } else {
            Err("Not connected".into())
        }
    }

    pub async fn disconnect(self: &Arc<Self>) {
        self.handle_disconnect().await;
    }

    async fn handle_disconnect(&self) {
        self.connected.store(false, Ordering::Relaxed);
        // Clear writer first so any pending writes fail immediately
        *self.writer.lock().await = None;
        // Clear reader — this causes the read loop to exit
        *self.reader.lock().await = None;
        // Wait for read loop to finish
        if let Some(handle) = self.read_handle.lock().await.take() {
            let _ = handle.await;
        }
    }
}

use serialport::{SerialPortType, available_ports};

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
