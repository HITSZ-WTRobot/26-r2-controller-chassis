import { useState, useEffect, useRef, useCallback } from 'react';
import { useCommand } from '../hooks/useSerial';

interface KeyState {
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
  q: boolean;
  e: boolean;
}

const initialKeys: KeyState = { w: false, a: false, s: false, d: false, q: false, e: false };

const V_DEFAULT = 1.0;
const V_MAX_LIMIT = 8.0;
const A_DEFAULT = 1.2;
const A_MAX_LIMIT = 3.0;
const W_DEFAULT = 60;
const W_MAX_LIMIT = 460;
const AW_DEFAULT = 70;
const AW_MAX_LIMIT = 170;

export function WasdVelocityControl() {
  const { send } = useCommand();
  const [vMax, setVMax] = useState(V_DEFAULT);
  const [aMax, setAMax] = useState(A_DEFAULT);
  const [wMax, setWMax] = useState(W_DEFAULT);
  const [awMax, setAwMax] = useState(AW_DEFAULT);
  const [enabled, setEnabled] = useState(false);
  const keysRef = useRef<KeyState>({ ...initialKeys });
  const [keyDisplay, setKeyDisplay] = useState<KeyState>({ ...initialKeys });
  const lastSentRef = useRef<{ vx: number; vy: number; wz: number }>({ vx: 0, vy: 0, wz: 0 });

  const sendVelocity = useCallback(
    async (vx: number, vy: number, wz: number) => {
      const last = lastSentRef.current;
      const isZero = vx === 0 && vy === 0 && wz === 0;
      const lastZero = last.vx === 0 && last.vy === 0 && last.wz === 0;
      if (isZero && lastZero) return;
      lastSentRef.current = { vx, vy, wz };
      try {
        await send({ type: 'SetMasterChassisVelocity', vx, vy, wz });
      } catch (e) {
        console.error(e);
      }
    },
    [send]
  );

  useEffect(() => {
    if (!enabled) {
      keysRef.current = { ...initialKeys };
      setKeyDisplay({ ...initialKeys });
      sendVelocity(0, 0, 0);
      return;
    }

    const isInput = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInput(e.target)) return;
      const key = e.key.toLowerCase();
      if (key in keysRef.current) {
        e.preventDefault();
        keysRef.current[key as keyof KeyState] = true;
        setKeyDisplay({ ...keysRef.current });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keysRef.current) {
        e.preventDefault();
        keysRef.current[key as keyof KeyState] = false;
        setKeyDisplay({ ...keysRef.current });
      }
    };

    const handleBlur = () => {
      keysRef.current = { ...initialKeys };
      setKeyDisplay({ ...initialKeys });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled, sendVelocity]);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      const k = keysRef.current;
      let vx = 0;
      let vy = 0;
      let wz = 0;
      if (k.w) vx += vMax;
      if (k.s) vx -= vMax;
      if (k.a) vy += vMax;
      if (k.d) vy -= vMax;
      if (k.q) wz += wMax;
      if (k.e) wz -= wMax;
      sendVelocity(vx, vy, wz);
    }, 50);
    return () => clearInterval(interval);
  }, [enabled, vMax, wMax, sendVelocity]);

  const KeyBadge = ({ keyName, label, active }: { keyName: string; label: string; active: boolean }) => (
    <div
      className={`flex flex-col items-center justify-center rounded border-2 w-12 h-12 text-xs font-mono transition-colors ${
        active
          ? 'bg-primary text-white border-primary'
          : 'bg-bg text-text-secondary border-border'
      }`}
    >
      <span className="font-bold text-sm">{keyName}</span>
      <span className="text-[10px]">{label}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold text-text">WASD 速度控制</h3>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`px-3 py-1 rounded text-sm text-white transition-colors ${
            enabled ? 'bg-success' : 'bg-gray-500 hover:bg-gray-600'
          }`}
        >
          {enabled ? '已启用' : '点击启用'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 max-w-[12rem] mx-auto">
        <div />
        <KeyBadge keyName="W" label="前进" active={keyDisplay.w} />
        <div />
        <KeyBadge keyName="A" label="左移" active={keyDisplay.a} />
        <KeyBadge keyName="S" label="后退" active={keyDisplay.s} />
        <KeyBadge keyName="D" label="右移" active={keyDisplay.d} />
        <KeyBadge keyName="Q" label="左转" active={keyDisplay.q} />
        <div />
        <KeyBadge keyName="E" label="右转" active={keyDisplay.e} />
      </div>

      <div className="space-y-3">
        <SliderField
          label="平移 最大速度"
          unit="m/s"
          value={vMax}
          onChange={setVMax}
          min={0}
          max={V_MAX_LIMIT}
          step={0.05}
        />
        <SliderField
          label="平移 最大加速度"
          unit="m/s²"
          value={aMax}
          onChange={setAMax}
          min={0}
          max={A_MAX_LIMIT}
          step={0.05}
        />
        <SliderField
          label="旋转 最大速度"
          unit="°/s"
          value={wMax}
          onChange={setWMax}
          min={0}
          max={W_MAX_LIMIT}
          step={5}
        />
        <SliderField
          label="旋转 最大加速度"
          unit="°/s²"
          value={awMax}
          onChange={setAwMax}
          min={0}
          max={AW_MAX_LIMIT}
          step={5}
        />
      </div>

      <p className="text-xs text-text-secondary">
        启用后焦点在窗口时按键生效。按 W/A/S/D 平移，Q/E 旋转。松开按键自动停止。
      </p>
    </div>
  );
}

interface SliderFieldProps {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}

function SliderField({ label, unit, value, onChange, min, max, step }: SliderFieldProps) {
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
