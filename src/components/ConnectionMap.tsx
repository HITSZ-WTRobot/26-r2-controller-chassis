import type { ConnectionState } from '../types/robot';

interface ConnectionMapProps {
  connectionState: ConnectionState | null;
}

export function ConnectionMap({ connectionState }: ConnectionMapProps) {
  if (!connectionState) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4">Connection Map</h2>
        <p className="text-gray-500">Waiting for data...</p>
      </div>
    );
  }

  const items = [
    { label: 'Wheel 0', online: connectionState.wheel_0 },
    { label: 'Wheel 1', online: connectionState.wheel_1 },
    { label: 'Wheel 2', online: connectionState.wheel_2 },
    { label: 'Wheel 3', online: connectionState.wheel_3 },
    { label: 'Lift 0', online: connectionState.lift_0 },
    { label: 'Lift 1', online: connectionState.lift_1 },
    { label: 'Lift 2', online: connectionState.lift_2 },
    { label: 'Lift 3', online: connectionState.lift_3 },
    { label: 'Grip Arm', online: connectionState.grip_arm },
    { label: 'Grip Turn', online: connectionState.grip_turn },
    { label: 'Gyro Yaw', online: connectionState.gyro_yaw },
    { label: 'Localization', online: connectionState.upper_host_localization },
    { label: 'Upper Host', online: connectionState.upper_host },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-4">Connection Map</h2>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${item.online ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}