import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { RobotState, ConnectionStatus, PortInfo, Command } from '../types/robot';

export function useSerial() {
  const [connected, setConnected] = useState(false);
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshPorts = useCallback(async () => {
    try {
      const portList = await invoke<PortInfo[]>('list_serial_ports');
      setPorts(portList);
    } catch (e) {
      console.error('Failed to list ports:', e);
    }
  }, []);

  useEffect(() => {
    refreshPorts();
    const interval = setInterval(refreshPorts, 5000);
    return () => clearInterval(interval);
  }, [refreshPorts]);

  const connect = useCallback(async (port: string, baud: number = 230400) => {
    try {
      setError(null);
      await invoke('connect_serial', { port, baud });
      setConnected(true);
    } catch (e) {
      setError(String(e));
      throw e;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await invoke('disconnect_serial');
      setConnected(false);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  return { connected, ports, error, connect, disconnect, refreshPorts };
}

export function useRobotState() {
  const [state, setState] = useState<RobotState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('Disconnected');

  useEffect(() => {
    let unlistenState: UnlistenFn | null = null;
    let unlistenConnection: UnlistenFn | null = null;

    const setup = async () => {
      unlistenState = await listen<RobotState>('robot_state_update', (event) => {
        setState(event.payload);
      });

      unlistenConnection = await listen<ConnectionStatus>('connection_status', (event) => {
        setConnectionStatus(event.payload);
      });
    };

    setup();

    return () => {
      unlistenState?.();
      unlistenConnection?.();
    };
  }, []);

  return { state, connectionStatus };
}

export function useCommand() {
  const send = useCallback(async (cmd: Command) => {
    const cmdName = cmd.type.charAt(0).toLowerCase() + cmd.type.slice(1);
    const args: Record<string, unknown> = {};

    switch (cmd.type) {
      case 'Ping':
      case 'StopChassis':
      case 'StepUpResume':
      case 'StoreKFS':
      case 'ReleaseKFS':
        break;
      case 'SetChassisHeight':
        args.height = cmd.height;
        args.v_max = cmd.v_max;
        args.a_max = cmd.a_max;
        args.j_max = cmd.j_max;
        args.link_mode = cmd.link_mode;
        break;
      case 'SetMasterChassisTargetCurrentState':
        args.x = cmd.x;
        args.y = cmd.y;
        args.yaw = cmd.yaw;
        args.xy_vmax = cmd.xy_vmax;
        args.xy_amax = cmd.xy_amax;
        args.yaw_vmax = cmd.yaw_vmax;
        args.yaw_amax = cmd.yaw_amax;
        break;
      case 'SetMasterChassisVelocity':
        args.vx = cmd.vx;
        args.vy = cmd.vy;
        args.wz = cmd.wz;
        break;
      case 'LidarPosture':
        args.x = cmd.x;
        args.y = cmd.y;
        args.yaw = cmd.yaw;
        args.lidar_timestamp = cmd.lidar_timestamp;
        break;
      case 'StepUp':
        args.start_distance = cmd.start_distance;
        args.end_distance = cmd.end_distance;
        args.direction = cmd.direction;
        args.will_take = cmd.will_take;
        break;
      case 'StepDown':
        args.start_distance = cmd.start_distance;
        args.end_distance = cmd.end_distance;
        args.direction = cmd.direction;
        args.should_reset = cmd.should_reset;
        break;
      case 'TakeSpear':
        args.target_x = cmd.target_x;
        args.target_y = cmd.target_y;
        args.target_yaw = cmd.target_yaw;
        args.end_x = cmd.end_x;
        args.end_y = cmd.end_y;
        args.end_yaw = cmd.end_yaw;
        break;
      case 'TakeSpearById':
        args.spear_id = cmd.spear_id;
        args.end_x = cmd.end_x;
        args.end_y = cmd.end_y;
        args.end_yaw = cmd.end_yaw;
        break;
    }

    try {
      await invoke(cmdName, args);
    } catch (e) {
      console.error(`Failed to send ${cmdName}:`, e);
      throw e;
    }
  }, []);

  return { send };
}