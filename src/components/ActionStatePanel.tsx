import type { ActionState } from '../types/robot';

interface ActionStatePanelProps {
  actionState: ActionState | null;
}

export function ActionStatePanel({ actionState }: ActionStatePanelProps) {
  if (!actionState) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4">Action State</h2>
        <p className="text-gray-500">Waiting for data...</p>
      </div>
    );
  }

  const items = [
    { label: 'Step Status', value: actionState.step_status },
    { label: 'Chassis Mode', value: actionState.chassis_mode },
    { label: 'Curve Finished', value: actionState.chassis_curve_finished ? 'Yes' : 'No', highlight: actionState.chassis_curve_finished ? 'text-green-600' : 'text-red-600' },
    { label: 'Lift Status', value: actionState.lift_status },
    { label: 'Grip Status', value: actionState.grip_status },
    { label: 'Suction Has Object', value: actionState.grip_suction_has_object ? 'Yes' : 'No', highlight: actionState.grip_suction_has_object ? 'text-green-600' : 'text-gray-400' },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-4">Action State</h2>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between py-1 border-b border-gray-100 last:border-0">
            <span className="text-gray-600">{item.label}</span>
            <span className={`font-mono ${item.highlight || ''}`}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}