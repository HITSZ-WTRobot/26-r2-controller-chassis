import { ConnectionPanel } from './ConnectionPanel';
import { StatusDisplay } from './StatusDisplay';
import { ActionStatePanel } from './ActionStatePanel';
import { ConnectionMap } from './ConnectionMap';
import { ChassisControl, HeightControl, StepControl, GripControl } from './ControlPanel';
import type { RobotState } from '../types/robot';

interface LayoutProps {
  state: RobotState | null;
}

export function Layout({ state }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">R2 Controller</h1>
        <p className="text-gray-600">Robocon 2026 Independent Lift Mecanum Chassis</p>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* Left column - Connection */}
        <div className="col-span-3">
          <ConnectionPanel />
        </div>

        {/* Middle column - Status */}
        <div className="col-span-5">
          <StatusDisplay state={state} />
          <div className="mt-4">
            <ActionStatePanel actionState={state?.action_state ?? null} />
          </div>
        </div>

        {/* Right column - Connection Map */}
        <div className="col-span-4">
          <ConnectionMap connectionState={state?.connection_state ?? null} />
        </div>

        {/* Bottom - Control Panels */}
        <div className="col-span-12 grid grid-cols-4 gap-4 mt-4">
          <ChassisControl />
          <HeightControl />
          <StepControl />
          <GripControl />
        </div>
      </div>
    </div>
  );
}