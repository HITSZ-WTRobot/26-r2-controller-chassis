mod serial;
mod protocol;
mod commands;
mod state;

use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter, State, Manager, Listener};
use commands::Command;
use state::{RobotState, ConnectionStatus};
use serial::{SerialConnection, PortInfo};

struct AppState {
    serial: Mutex<Option<Arc<SerialConnection>>>,
    robot_state: Mutex<RobotState>,
    connection_status: Mutex<ConnectionStatus>,
    start_time: Instant,
}

#[tauri::command]
async fn connect_serial(
    port: String,
    baud: u32,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let conn = SerialConnection::new();
    conn.connect(&port, baud, app_handle).await?;

    let mut serial = state.serial.lock().map_err(|e| e.to_string())?;
    *serial = Some(conn);

    let mut status = state.connection_status.lock().map_err(|e| e.to_string())?;
    *status = ConnectionStatus::Connected;
    Ok(())
}

#[tauri::command]
async fn disconnect_serial(state: State<'_, AppState>) -> Result<(), String> {
    let conn = {
        let mut serial = state.serial.lock().map_err(|e| e.to_string())?;
        serial.take()
    };
    if let Some(conn) = conn {
        conn.disconnect().await;
    }

    let mut status = state.connection_status.lock().map_err(|e| e.to_string())?;
    *status = ConnectionStatus::Disconnected;
    Ok(())
}

async fn do_send_command(
    cmd: Command,
    state: &AppState,
    app_handle: &AppHandle,
) -> Result<(), String> {
    let timestamp = state.start_time.elapsed().as_millis() as u32;
    let data = cmd.encode(timestamp);

    let _ = app_handle.emit("serial_tx", &data);

    let conn = {
        let serial = state.serial.lock().map_err(|e| e.to_string())?;
        serial.clone()
    };
    if let Some(conn) = conn {
        conn.write_frame(&data).await.map_err(|e| e.to_string())
    } else {
        Err("Not connected".into())
    }
}

#[tauri::command]
async fn send_command(
    cmd: Command,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    do_send_command(cmd, &state, &app_handle).await
}

macro_rules! cmd {
    ($name:ident, $variant:ident) => {
        #[tauri::command]
        async fn $name(state: State<'_, AppState>, app_handle: AppHandle) -> Result<(), String> {
            do_send_command(Command::$variant, &state, &app_handle).await
        }
    };
    ($name:ident, $variant:ident, $($field:ident: $ty:ty),+) => {
        #[tauri::command]
        async fn $name($($field: $ty,)* state: State<'_, AppState>, app_handle: AppHandle) -> Result<(), String> {
            do_send_command(Command::$variant { $($field,)* }, &state, &app_handle).await
        }
    };
}

cmd!(ping, Ping);
cmd!(stop_chassis, StopChassis);
cmd!(set_chassis_height, SetChassisHeight, height: f32, v_max: f32, a_max: f32, j_max: f32, link_mode: u16);
cmd!(set_master_chassis_target_current_state, SetMasterChassisTargetCurrentState, x: f32, y: f32, yaw: f32, xy_vmax: f32, xy_amax: f32, yaw_vmax: f32, yaw_amax: f32);
cmd!(set_master_chassis_velocity, SetMasterChassisVelocity, vx: f32, vy: f32, wz: f32);
cmd!(send_lidar_posture, LidarPosture, x: f32, y: f32, yaw: f32, lidar_timestamp: u32);
cmd!(step_up200, StepUp200, start_distance: f32, end_distance: f32, direction: u16, will_take: u16);
cmd!(step_up_resume, StepUpResume);
cmd!(step_down200, StepDown200, start_distance: f32, end_distance: f32, direction: u16, should_reset: u16);
cmd!(step_up400, StepUp400, start_distance: f32, end_distance: f32, direction: u16, will_take: u16);
cmd!(step_down400, StepDown400, start_distance: f32, end_distance: f32, direction: u16, should_reset: u16);
cmd!(take_spear, TakeSpear, target_x: f32, target_y: f32, target_yaw: f32, end_x: f32, end_y: f32, end_yaw: f32);
cmd!(take_spear_by_id, TakeSpearById, spear_id: u16, end_x: f32, end_y: f32, end_yaw: f32);
cmd!(set_grip_pose, SetGripPose, arm_pos: f32, turn_pos: f32, claw_mode: u16);
cmd!(set_grip_preset_pose, SetGripPresetPose, preset_id: u16);
cmd!(store_kfs, StoreKFS);
cmd!(release_kfs, ReleaseKFS);
cmd!(step_pose, StepPose, step_type: u8, direction: u8, step_height: u8, param: u8, step_target_x: f32, step_target_y: f32, step_target_yaw: f32, end_x: f32, end_y: f32, end_yaw: f32);

#[tauri::command]
fn get_robot_state(state: State<'_, AppState>) -> Result<RobotState, String> {
    let s = state.robot_state.lock().map_err(|e| e.to_string())?;
    Ok(s.clone())
}

#[tauri::command]
fn get_connection_status(state: State<'_, AppState>) -> Result<ConnectionStatus, String> {
    let s = state.connection_status.lock().map_err(|e| e.to_string())?;
    Ok(*s)
}

#[tauri::command]
fn list_serial_ports() -> Vec<PortInfo> {
    serial::list_ports()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        serial: Mutex::new(None),
        robot_state: Mutex::new(RobotState::default()),
        connection_status: Mutex::new(ConnectionStatus::Disconnected),
        start_time: Instant::now(),
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
            step_up200,
            step_up_resume,
            step_down200,
            step_up400,
            step_down400,
            take_spear,
            take_spear_by_id,
            store_kfs,
            release_kfs,
            set_grip_pose,
            set_grip_preset_pose,
            step_pose,
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
