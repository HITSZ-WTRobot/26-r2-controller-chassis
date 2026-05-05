mod serial;
mod protocol;
mod commands;
mod state;

use std::sync::Mutex;
use tokio::sync::mpsc;
use tauri::{AppHandle, Emitter, State, Manager, Listener};
use commands::Command;
use state::{RobotState, ConnectionStatus};
use serial::{SerialManager, PortInfo};

struct AppState {
    serial: Mutex<SerialManager>,
    tx: Mutex<Option<mpsc::Sender<Vec<u8>>>>,
    robot_state: Mutex<RobotState>,
    connection_status: Mutex<ConnectionStatus>,
    timestamp_counter: Mutex<u32>,
}

#[tauri::command]
fn connect_serial(
    port: String,
    baud: u32,
    state: State<AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    {
        let mut serial = state.serial.lock().map_err(|e| e.to_string())?;
        serial.connect(&port, baud)?;
    }

    let (tx, mut rx) = mpsc::channel::<Vec<u8>>(100);
    {
        let mut tx_slot = state.tx.lock().map_err(|e| e.to_string())?;
        *tx_slot = Some(tx);
    }

    let port_clone = port.clone();
    let baud_clone = baud;

    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let mut s = SerialManager::new();
            if s.connect(&port_clone, baud_clone).is_ok() {
                let _ = app_handle.emit("connection_status", "connected");

                let mut buf = vec![0u8; 256];
                let mut pos = 0;

                loop {
                    tokio::select! {
                        msg = rx.recv() => {
                            match msg {
                                Some(data) => {
                                    if let Err(e) = s.write_frame(&data) {
                                        let _ = app_handle.emit("serial_error", e);
                                    }
                                }
                                None => break,
                            }
                        }
                        _ = tokio::time::sleep(tokio::time::Duration::from_millis(1)) => {
                            let mut temp_buf = [0u8; 64];
                            match s.read_bytes(&mut temp_buf) {
                                Ok(n) if n > 0 => {
                                    buf[pos..pos+n].copy_from_slice(&temp_buf[..n]);
                                    pos += n;

                                    let mut start = 0;
                                    while start + 22 <= pos {
                                        if buf[start] == 0xAA && buf[start+1] == 0xBB {
                                            let frame_data = &buf[start..start+22];
                                            match protocol::FeedbackFrame::parse(frame_data) {
                                                Ok(frame) => {
                                                    let _ = app_handle.emit("serial_rx", frame_data);
                                                    let rs = RobotState::from_feedback(&frame);
                                                    let _ = app_handle.emit("robot_state_update", &rs);
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
                                        // Copy remaining bytes to beginning of buffer
                                        let remaining = pos - start;
                                        buf.copy_within(start..pos, 0);
                                        pos = remaining;
                                    } else if start > 0 {
                                        pos = 0;
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }
        });
    });

    let mut status = state.connection_status.lock().map_err(|e| e.to_string())?;
    *status = ConnectionStatus::Connected;
    Ok(())
}

#[tauri::command]
fn disconnect_serial(state: State<AppState>) -> Result<(), String> {
    let mut serial = state.serial.lock().map_err(|e| e.to_string())?;
    serial.disconnect();
    let mut tx = state.tx.lock().map_err(|e| e.to_string())?;
    *tx = None;
    let mut status = state.connection_status.lock().map_err(|e| e.to_string())?;
    *status = ConnectionStatus::Disconnected;
    Ok(())
}

#[tauri::command]
fn send_command(cmd: Command, state: State<AppState>, app_handle: AppHandle) -> Result<(), String> {
    let timestamp = {
        let mut counter = state.timestamp_counter.lock().map_err(|e| e.to_string())?;
        let ts = *counter;
        *counter += 1;
        ts
    };

    let data = cmd.encode(timestamp);

    let _ = app_handle.emit("serial_tx", &data);

    let tx = state.tx.lock().map_err(|e| e.to_string())?;
    if let Some(ref sender) = *tx {
        sender.blocking_send(data).map_err(|e| e.to_string())?;
    } else {
        return Err("Not connected".to_string());
    }
    Ok(())
}

#[tauri::command]
fn get_robot_state(state: State<AppState>) -> Result<RobotState, String> {
    let s = state.robot_state.lock().map_err(|e| e.to_string())?;
    Ok(s.clone())
}

#[tauri::command]
fn get_connection_status(state: State<AppState>) -> Result<ConnectionStatus, String> {
    let s = state.connection_status.lock().map_err(|e| e.to_string())?;
    Ok(*s)
}

#[tauri::command]
fn list_serial_ports() -> Vec<PortInfo> {
    serial::list_ports()
}

#[tauri::command]
fn ping(state: State<AppState>, app_handle: AppHandle) -> Result<(), String> {
    send_command(Command::Ping, state, app_handle)
}

#[tauri::command]
fn stop_chassis(state: State<AppState>, app_handle: AppHandle) -> Result<(), String> {
    send_command(Command::StopChassis, state, app_handle)
}

#[tauri::command]
fn set_chassis_height(
    height: f32,
    v_max: f32,
    a_max: f32,
    j_max: f32,
    link_mode: u16,
    state: State<AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    send_command(Command::SetChassisHeight { height, v_max, a_max, j_max, link_mode }, state, app_handle)
}

#[tauri::command]
fn set_master_chassis_target_current_state(
    x: f32, y: f32, yaw: f32,
    xy_vmax: f32, xy_amax: f32, yaw_vmax: f32, yaw_amax: f32,
    state: State<AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    send_command(Command::SetMasterChassisTargetCurrentState { x, y, yaw, xy_vmax, xy_amax, yaw_vmax, yaw_amax }, state, app_handle)
}

#[tauri::command]
fn set_master_chassis_velocity(
    vx: f32, vy: f32, wz: f32,
    state: State<AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    send_command(Command::SetMasterChassisVelocity { vx, vy, wz }, state, app_handle)
}

#[tauri::command]
fn send_lidar_posture(
    x: f32, y: f32, yaw: f32, lidar_timestamp: u32,
    state: State<AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    send_command(Command::LidarPosture { x, y, yaw, lidar_timestamp }, state, app_handle)
}

#[tauri::command]
fn step_up(
    start_distance: f32, end_distance: f32, direction: u16, will_take: u16,
    state: State<AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    send_command(Command::StepUp { start_distance, end_distance, direction, will_take }, state, app_handle)
}

#[tauri::command]
fn step_up_resume(state: State<AppState>, app_handle: AppHandle) -> Result<(), String> {
    send_command(Command::StepUpResume, state, app_handle)
}

#[tauri::command]
fn step_down(
    start_distance: f32, end_distance: f32, direction: u16, should_reset: u16,
    state: State<AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    send_command(Command::StepDown { start_distance, end_distance, direction, should_reset }, state, app_handle)
}

#[tauri::command]
fn take_spear(
    target_x: f32, target_y: f32, target_yaw: f32,
    end_x: f32, end_y: f32, end_yaw: f32,
    state: State<AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    send_command(Command::TakeSpear { target_x, target_y, target_yaw, end_x, end_y, end_yaw }, state, app_handle)
}

#[tauri::command]
fn take_spear_by_id(
    spear_id: u16, end_x: f32, end_y: f32, end_yaw: f32,
    state: State<AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    send_command(Command::TakeSpearById { spear_id, end_x, end_y, end_yaw }, state, app_handle)
}

#[tauri::command]
fn store_kfs(state: State<AppState>, app_handle: AppHandle) -> Result<(), String> {
    send_command(Command::StoreKFS, state, app_handle)
}

#[tauri::command]
fn release_kfs(state: State<AppState>, app_handle: AppHandle) -> Result<(), String> {
    send_command(Command::ReleaseKFS, state, app_handle)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        serial: Mutex::new(SerialManager::new()),
        tx: Mutex::new(None),
        robot_state: Mutex::new(RobotState::default()),
        connection_status: Mutex::new(ConnectionStatus::Disconnected),
        timestamp_counter: Mutex::new(0),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            connect_serial,
            disconnect_serial,
            send_command,
            get_robot_state,
            get_connection_status,
            list_serial_ports,
            ping,
            stop_chassis,
            set_chassis_height,
            set_master_chassis_target_current_state,
            set_master_chassis_velocity,
            send_lidar_posture,
            step_up,
            step_up_resume,
            step_down,
            take_spear,
            take_spear_by_id,
            store_kfs,
            release_kfs,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            app.listen("robot_state_update", move |event| {
                let payload = event.payload();
                if let Ok(rs) = serde_json::from_str::<RobotState>(payload) {
                    if let Some(s) = handle.try_state::<AppState>() {
                        let mut robot_state = s.robot_state.lock().unwrap();
                        *robot_state = rs;
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}