import { useState, useRef, useCallback } from 'react';
import { useCommand } from '../hooks/useSerial';
import { VerticalSlider } from './VerticalSlider';

const HEIGHT_MIN = 0.195;
const HEIGHT_MAX = 0.595;
const HEIGHT_STEP = 0.005;
const LINK_MODE_PREVIOUS_CURVE = 2;
const SEND_THROTTLE_MS = 40;

const LIFT_V_DEFAULT = 1.0;
const LIFT_V_MAX_LIMIT = 1.178;
const LIFT_A_DEFAULT = 5.0;
const LIFT_A_MAX_LIMIT = 5.0;

export function HeightControl() {
  const { send } = useCommand();
  const [height, setHeight] = useState(HEIGHT_MIN);
  const [vMax, setVMax] = useState(LIFT_V_DEFAULT);
  const [aMax, setAMax] = useState(LIFT_A_DEFAULT);

  const lastSendTs = useRef(0);
  const pendingTimer = useRef<number | null>(null);
  const latestParams = useRef({ height: HEIGHT_MIN, vMax: LIFT_V_DEFAULT, aMax: LIFT_A_DEFAULT });

  const clamp = (v: number) => Math.min(HEIGHT_MAX, Math.max(HEIGHT_MIN, v));
  const clampRange = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  const doSend = useCallback(async () => {
    lastSendTs.current = Date.now();
    const { height, vMax, aMax } = latestParams.current;
    try {
      await send({
        type: 'SetChassisHeight',
        height,
        v_max: vMax,
        a_max: aMax,
        j_max: 0,
        link_mode: LINK_MODE_PREVIOUS_CURVE,
      });
    } catch (e) {
      console.error(e);
    }
  }, [send]);

  const scheduleSend = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastSendTs.current;
    if (pendingTimer.current !== null) {
      window.clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    }
    if (elapsed >= SEND_THROTTLE_MS) {
      doSend();
    } else {
      pendingTimer.current = window.setTimeout(() => {
        pendingTimer.current = null;
        doSend();
      }, SEND_THROTTLE_MS - elapsed);
    }
  }, [doSend]);

  const handleHeightChange = (v: number) => {
    const c = clamp(v);
    setHeight(c);
    latestParams.current.height = c;
    scheduleSend();
  };

  const handleVMaxChange = (v: number) => {
    const c = clampRange(v, 0, LIFT_V_MAX_LIMIT);
    setVMax(c);
    latestParams.current.vMax = c;
  };

  const handleAMaxChange = (v: number) => {
    const c = clampRange(v, 0, LIFT_A_MAX_LIMIT);
    setAMax(c);
    latestParams.current.aMax = c;
  };

  const pct = ((height - HEIGHT_MIN) / (HEIGHT_MAX - HEIGHT_MIN)) * 100;

  return (
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-text">底盘高度控制 (即时生效)</h3>
      <div className="flex gap-4 items-stretch">
        <div className="flex flex-col items-center gap-2 shrink-0 py-1">
          <span className="text-xs text-text-secondary font-mono">{HEIGHT_MAX.toFixed(3)}</span>
          <VerticalSlider
            value={height}
            min={HEIGHT_MIN}
            max={HEIGHT_MAX}
            step={HEIGHT_STEP}
            onChange={handleHeightChange}
            height={224}
          />
          <span className="text-xs text-text-secondary font-mono">{HEIGHT_MIN.toFixed(3)}</span>
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <label className="text-sm text-text-secondary block mb-1">
              当前高度 <span className="font-mono text-text">{height.toFixed(3)} m</span>
              <span className="ml-2 text-text-secondary">({pct.toFixed(0)}%)</span>
            </label>
            <input
              type="number"
              step={HEIGHT_STEP}
              min={HEIGHT_MIN}
              max={HEIGHT_MAX}
              value={height}
              onChange={(e) => handleHeightChange(parseFloat(e.target.value) || HEIGHT_MIN)}
              className="w-full border border-border rounded px-2 py-1 bg-surface text-text"
            />
          </div>
          <SliderRow
            label="最大速度"
            unit="m/s"
            value={vMax}
            onChange={handleVMaxChange}
            min={0}
            max={LIFT_V_MAX_LIMIT}
            step={0.01}
          />
          <SliderRow
            label="最大加速度"
            unit="m/s²"
            value={aMax}
            onChange={handleAMaxChange}
            min={0}
            max={LIFT_A_MAX_LIMIT}
            step={0.05}
          />
        </div>
      </div>
      <p className="text-xs text-text-secondary">
        高度 {HEIGHT_MIN}–{HEIGHT_MAX} m · 速度上限 {LIFT_V_MAX_LIMIT} m/s · 加速度上限 {LIFT_A_MAX_LIMIT} m/s² · link_mode = PreviousCurve
      </p>
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

  const handleStepUpResume = async () => {
    await send({ type: 'StepUpResume' });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-text">台阶控制</h3>
      <div className="space-y-3">
        <InputRow label="起始距离 (m)" value={startDist} onChange={setStartDist} step={0.01} />
        <InputRow label="结束距离 (m)" value={endDist} onChange={setEndDist} step={0.01} />
        <div>
          <label className="text-sm text-text-secondary block mb-1">方向</label>
          <RadioGroup
            value={direction}
            onChange={setDirection}
            options={[
              { value: 0, label: '前进' },
              { value: 1, label: '后退' },
            ]}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={handleStepUp}
          className="bg-primary text-white px-3 py-2 rounded hover:bg-primary-hover text-sm"
        >
          登上
        </button>
        <button
          onClick={handleStepDown}
          className="bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600 text-sm"
        >
          走下
        </button>
        <button
          onClick={handleStepUpResume}
          className="bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600 text-sm"
        >
          继续登
        </button>
      </div>
    </div>
  );
}

type TakeSpearMode = 'byId' | 'byPos';

export function GripControl() {
  const { send } = useCommand();
  const [mode, setMode] = useState<TakeSpearMode>('byId');

  const [spearId, setSpearId] = useState(0);
  const [targetX, setTargetX] = useState(0);
  const [targetY, setTargetY] = useState(0);
  const [targetYaw, setTargetYaw] = useState(0);
  const [endX, setEndX] = useState(0);
  const [endY, setEndY] = useState(0);
  const [endYaw, setEndYaw] = useState(0);

  // GripPose state
  const [armPos, setArmPos] = useState(0);
  const [turnPos, setTurnPos] = useState(0);
  const [clawMode, setClawMode] = useState(0);

  // GripPresetPose state
  const [presetId, setPresetId] = useState(0);

  const handleTake = async () => {
    if (mode === 'byId') {
      await send({
        type: 'TakeSpearById',
        spear_id: spearId,
        end_x: endX,
        end_y: endY,
        end_yaw: endYaw,
      });
    } else {
      await send({
        type: 'TakeSpear',
        target_x: targetX,
        target_y: targetY,
        target_yaw: targetYaw,
        end_x: endX,
        end_y: endY,
        end_yaw: endYaw,
      });
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-text">夹爪控制</h3>

      <div>
        <label className="text-sm text-text-secondary block mb-1">取矛协议</label>
        <RadioGroup
          value={mode}
          onChange={(v) => setMode(v)}
          options={[
            { value: 'byId', label: '按编号 (0x41)' },
            { value: 'byPos', label: '按坐标 (0x40)' },
          ]}
        />
      </div>

      {mode === 'byId' ? (
        <div>
          <label className="text-sm text-text-secondary block mb-1">矛编号</label>
          <RadioGroup
            value={spearId}
            onChange={setSpearId}
            options={[0, 1, 2, 3, 4, 5].map((id) => ({ value: id, label: String(id) }))}
          />
        </div>
      ) : (
        <div>
          <label className="text-sm text-text-secondary block mb-1">目标位姿</label>
          <div className="grid grid-cols-3 gap-2">
            <NumField label="X (m)" step={0.01} value={targetX} onChange={setTargetX} />
            <NumField label="Y (m)" step={0.01} value={targetY} onChange={setTargetY} />
            <NumField label="Yaw (°)" step={0.1} value={targetYaw} onChange={setTargetYaw} />
          </div>
        </div>
      )}

      <div>
        <label className="text-sm text-text-secondary block mb-1">终点位姿</label>
        <div className="grid grid-cols-3 gap-2">
          <NumField label="X (m)" step={0.01} value={endX} onChange={setEndX} />
          <NumField label="Y (m)" step={0.01} value={endY} onChange={setEndY} />
          <NumField label="Yaw (°)" step={0.1} value={endYaw} onChange={setEndYaw} />
        </div>
      </div>

      <button
        onClick={handleTake}
        className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-hover w-full"
      >
        取矛
      </button>

      <div className="border-t border-border pt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => send({ type: 'StoreKFS' })}
          className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-hover"
        >
          存储 KFS
        </button>
        <button
          onClick={() => send({ type: 'ReleaseKFS' })}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          释放 KFS
        </button>
      </div>

      {/* SetGripPose (0x16) */}
      <div className="border-t border-border pt-3 space-y-3">
        <h4 className="text-sm font-semibold text-text">Grip 关节姿态 (0x16)</h4>
        <InputRow label="大臂角 arm_pos (°)" value={armPos} onChange={setArmPos} step={0.1} />
        <InputRow label="转向角 turn_pos (°)" value={turnPos} onChange={setTurnPos} step={0.1} />
        <div>
          <label className="text-sm text-text-secondary block mb-1">夹爪模式</label>
          <RadioGroup
            value={clawMode}
            onChange={setClawMode}
            options={[
              { value: 0, label: '保持' },
              { value: 1, label: '张开' },
              { value: 2, label: '闭合' },
            ]}
          />
        </div>
        <button
          onClick={() => send({ type: 'SetGripPose', arm_pos: armPos, turn_pos: turnPos, claw_mode: clawMode })}
          className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-hover w-full"
        >
          发送关节姿态
        </button>
      </div>

      {/* SetGripPresetPose (0x17) */}
      <div className="border-t border-border pt-3 space-y-3">
        <h4 className="text-sm font-semibold text-text">Grip 预设姿态 (0x17)</h4>
        <div>
          <label className="text-sm text-text-secondary block mb-1">预设</label>
          <div className="flex flex-wrap gap-1">
            {[
              { id: 0, label: 'Standby' },
              { id: 1, label: 'PrepareGrab' },
              { id: 2, label: 'Grab' },
              { id: 3, label: 'Docking' },
              { id: 4, label: 'KfsPickup' },
              { id: 5, label: 'KfsStore' },
              { id: 6, label: 'KfsRelease' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPresetId(p.id)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  presetId === p.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface text-text border-border hover:bg-bg'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => send({ type: 'SetGripPresetPose', preset_id: presetId })}
          className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-hover w-full"
        >
          发送预设 ({presetId})
        </button>
      </div>
    </div>
  );
}

export function SystemControl() {
  const { send } = useCommand();

  return (
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-text">系统控制</h3>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => send({ type: 'Ping' })}
          className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-hover"
        >
          Ping
        </button>
        <button
          onClick={() => send({ type: 'StopChassis' })}
          className="bg-danger text-white px-4 py-2 rounded hover:opacity-90"
        >
          紧急停止
        </button>
      </div>
    </div>
  );
}

interface InputRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
}

function InputRow({ label, value, onChange, step }: InputRowProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex-1 text-sm text-text-secondary">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="border border-border rounded px-2 py-1 w-28 bg-surface text-text"
      />
    </div>
  );
}

interface NumFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
}

function NumField({ label, value, onChange, step }: NumFieldProps) {
  return (
    <div>
      <label className="text-xs text-text-secondary block mb-1">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full border border-border rounded px-2 py-1 bg-surface text-text"
      />
    </div>
  );
}

interface SliderRowProps {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}

function SliderRow({ label, unit, value, onChange, min, max, step }: SliderRowProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-sm text-text-secondary">
          {label} ({unit})
        </label>
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(clamp(parseFloat(e.target.value) || 0))}
          className="w-20 border border-border rounded px-2 py-0.5 text-sm bg-surface text-text text-right"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

interface RadioGroupProps<T extends string | number> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}

function RadioGroup<T extends string | number>({ value, onChange, options }: RadioGroupProps<T>) {
  return (
    <div className="inline-flex flex-wrap rounded border border-border overflow-hidden">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 text-sm transition-colors border-r border-border last:border-r-0 ${
            value === opt.value
              ? 'bg-primary text-white'
              : 'bg-surface text-text hover:bg-bg'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
