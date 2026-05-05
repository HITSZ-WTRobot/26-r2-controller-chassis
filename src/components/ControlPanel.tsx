import { useState } from 'react';
import { useCommand } from '../hooks/useSerial';

export function ChassisControl() {
  const { send } = useCommand();
  const [vx, setVx] = useState(0);
  const [vy, setVy] = useState(0);
  const [wz, setWz] = useState(0);

  const handleSendVelocity = async () => {
    await send({ type: 'SetMasterChassisVelocity', vx, vy, wz });
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-md font-semibold mb-3">Chassis Velocity Control</h3>
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <label className="w-20 text-sm">VX (m/s)</label>
          <input
            type="number"
            step="0.01"
            value={vx}
            onChange={(e) => setVx(parseFloat(e.target.value) || 0)}
            className="border rounded px-2 py-1 w-24"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-20 text-sm">VY (m/s)</label>
          <input
            type="number"
            step="0.01"
            value={vy}
            onChange={(e) => setVy(parseFloat(e.target.value) || 0)}
            className="border rounded px-2 py-1 w-24"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-20 text-sm">WZ (deg/s)</label>
          <input
            type="number"
            step="0.1"
            value={wz}
            onChange={(e) => setWz(parseFloat(e.target.value) || 0)}
            className="border rounded px-2 py-1 w-24"
          />
        </div>
      </div>
      <button
        onClick={handleSendVelocity}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Send Velocity
      </button>
    </div>
  );
}

export function HeightControl() {
  const { send } = useCommand();
  const [height, setHeight] = useState(0);
  const [vMax, setVMax] = useState(0);
  const [aMax, setAMax] = useState(0);

  const handleSetHeight = async () => {
    await send({
      type: 'SetChassisHeight',
      height,
      v_max: vMax,
      a_max: aMax,
      j_max: 0,
      link_mode: 1,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-md font-semibold mb-3">Chassis Height Control</h3>
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <label className="w-24 text-sm">Height (m)</label>
          <input
            type="number"
            step="0.01"
            value={height}
            onChange={(e) => setHeight(parseFloat(e.target.value) || 0)}
            className="border rounded px-2 py-1 w-24"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-24 text-sm">V-Max (m/s)</label>
          <input
            type="number"
            step="0.01"
            value={vMax}
            onChange={(e) => setVMax(parseFloat(e.target.value) || 0)}
            className="border rounded px-2 py-1 w-24"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-24 text-sm">A-Max (m/s²)</label>
          <input
            type="number"
            step="0.01"
            value={aMax}
            onChange={(e) => setAMax(parseFloat(e.target.value) || 0)}
            className="border rounded px-2 py-1 w-24"
          />
        </div>
      </div>
      <button
        onClick={handleSetHeight}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Set Height
      </button>
    </div>
  );
}

export function StepControl() {
  const { send } = useCommand();
  const [startDist, setStartDist] = useState(0.5);
  const [endDist, setEndDist] = useState(0.5);
  const [direction, setDirection] = useState(0);

  const handleStepUp = async () => {
    await send({ type: 'StepUp', start_distance: startDist, end_distance: endDist, direction, will_take: 0 });
  };

  const handleStepDown = async () => {
    await send({ type: 'StepDown', start_distance: startDist, end_distance: endDist, direction, should_reset: 1 });
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-md font-semibold mb-3">Step Control</h3>
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <label className="w-24 text-sm">Start Dist (m)</label>
          <input
            type="number"
            step="0.01"
            value={startDist}
            onChange={(e) => setStartDist(parseFloat(e.target.value) || 0)}
            className="border rounded px-2 py-1 w-24"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-24 text-sm">End Dist (m)</label>
          <input
            type="number"
            step="0.01"
            value={endDist}
            onChange={(e) => setEndDist(parseFloat(e.target.value) || 0)}
            className="border rounded px-2 py-1 w-24"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-24 text-sm">Direction</label>
          <select
            value={direction}
            onChange={(e) => setDirection(parseInt(e.target.value))}
            className="border rounded px-2 py-1 w-24"
          >
            <option value={0}>Forward</option>
            <option value={1}>Backward</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleStepUp}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Step Up
        </button>
        <button
          onClick={handleStepDown}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Step Down
        </button>
      </div>
    </div>
  );
}

export function GripControl() {
  const { send } = useCommand();

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-md font-semibold mb-3">Grip Control</h3>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => send({ type: 'StoreKFS' })}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Store KFS
        </button>
        <button
          onClick={() => send({ type: 'ReleaseKFS' })}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Release KFS
        </button>
        <button
          onClick={() => send({ type: 'StepUpResume' })}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Step Up Resume
        </button>
      </div>
    </div>
  );
}