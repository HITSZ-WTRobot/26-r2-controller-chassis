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
    const { type, ...rest } = cmd;
    const hasFields = Object.keys(rest).length > 0;
    const payload = hasFields ? { [type]: rest } : type;
    try {
      await invoke('send_command', { cmd: payload });
    } catch (e) {
      console.error(`Failed to send ${cmd.type}:`, e);
      throw e;
    }
  }, []);

  return { send };
}