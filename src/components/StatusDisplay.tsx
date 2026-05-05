import type { RobotState } from '../types/robot';

interface StatusDisplayProps {
  state: RobotState | null;
}

export function StatusDisplay({ state }: StatusDisplayProps) {
  if (!state) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4">Robot Status</h2>
        <p className="text-gray-500">Waiting for data...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-4">Robot Status</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 p-3 rounded">
          <span className="text-sm text-gray-500 block">X</span>
          <span className="font-mono font-semibold">{state.x.toFixed(3)} m</span>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <span className="text-sm text-gray-500 block">Y</span>
          <span className="font-mono font-semibold">{state.y.toFixed(3)} m</span>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <span className="text-sm text-gray-500 block">Yaw</span>
          <span className="font-mono font-semibold">{state.yaw.toFixed(2)}°</span>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <span className="text-sm text-gray-500 block">Front Height</span>
          <span className="font-mono font-semibold">{state.front_height.toFixed(3)} m</span>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <span className="text-sm text-gray-500 block">Rear Height</span>
          <span className="font-mono font-semibold">{state.rear_height.toFixed(3)} m</span>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <span className="text-sm text-gray-500 block">Timestamp</span>
          <span className="font-mono font-semibold">{state.timestamp}</span>
        </div>
      </div>
    </div>
  );
}