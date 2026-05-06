import { useEffect, useRef, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

type Direction = 'tx' | 'rx';

interface LogEntry {
  id: number;
  time: string;
  direction: Direction;
  bytes: number[];
}

const MAX_ENTRIES = 200;
const CONTROL_FRAME_LEN = 21;
const FEEDBACK_FRAME_LEN = 22;

// CRC16-Modbus: poly=0x8005, init=0xFFFF, refin=true, refout=true, xorout=0x0000
// LSB-first processing with reflected polynomial 0xA001 (bit-reverse of 0x8005)
function crc16modbus(data: number[]): number {
  let crc = 0xffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x0001) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

function bigEndianU16(bytes: number[], offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function bigEndianU32(bytes: number[], offset: number): number {
  return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
}

function bigEndianI16(bytes: number[], offset: number): number {
  const u = bigEndianU16(bytes, offset);
  return u > 0x7fff ? u - 0x10000 : u;
}

const CMD_NAMES: Record<number, string> = {
  0x01: 'Ping',
  0x10: 'StopChassis',
  0x11: 'SetChassisHeight',
  0x13: 'SetMasterChassisTargetCurrentState',
  0x14: 'SetMasterChassisTargetPreviousCurve',
  0x15: 'SetMasterChassisVelocity',
  0x21: 'LidarPosture',
  0x30: 'StepUp',
  0x31: 'StepUpResume',
  0x32: 'StepDown',
  0x40: 'TakeSpear',
  0x41: 'TakeSpearById',
  0x42: 'StoreKFS',
  0x43: 'ReleaseKFS',
};

interface FieldSegment {
  label: string;
  start: number;
  end: number;
  bgClass: string;
  textClass: string;
  decoded?: string;
}

interface FrameAnalysis {
  valid: boolean;
  errorMsg?: string;
  frameType?: 'control' | 'feedback';
  fields: FieldSegment[];
}

function analyzeFrame(bytes: number[]): FrameAnalysis {
  const len = bytes.length;

  if (len === CONTROL_FRAME_LEN) {
    if (bytes[0] !== 0xaa || bytes[1] !== 0xbb) {
      return { valid: false, errorMsg: '帧头错误(期望AA BB)', fields: [] };
    }
    const crcData = bytes.slice(2, 19);
    const expectedCrc = bigEndianU16(bytes, 19);
    const actualCrc = crc16modbus(crcData);
    const crcOk = actualCrc === expectedCrc;
    const cmd = bytes[2];
    const cmdName = CMD_NAMES[cmd];
    const ts = bigEndianU32(bytes, 15);

    const fields: FieldSegment[] = [
      { label: '帧头', start: 0, end: 2, bgClass: 'bg-blue-500/20', textClass: 'text-blue-300' },
      { label: cmdName ? `Cmd ${cmdName}` : `Cmd 0x${cmd.toString(16).toUpperCase().padStart(2, '0')}`, start: 2, end: 3, bgClass: 'bg-amber-500/20', textClass: 'text-amber-300' },
      { label: '数据(12B)', start: 3, end: 15, bgClass: 'bg-gray-500/15', textClass: 'text-gray-300' },
      { label: `TS=${ts}`, start: 15, end: 19, bgClass: 'bg-emerald-500/20', textClass: 'text-emerald-300' },
      {
        label: crcOk ? 'CRC ✓' : `CRC ✗(期望${expectedCrc.toString(16).toUpperCase()})`,
        start: 19, end: 21,
        bgClass: crcOk ? 'bg-purple-500/20' : 'bg-red-500/50',
        textClass: crcOk ? 'text-purple-300' : 'text-red-200',
      },
    ];

    if (!crcOk) {
      return { valid: false, errorMsg: 'CRC校验失败', fields };
    }
    return { valid: true, frameType: 'control', fields };
  }

  if (len === FEEDBACK_FRAME_LEN) {
    if (bytes[0] !== 0xaa || bytes[1] !== 0xbb) {
      return { valid: false, errorMsg: '帧头错误(期望AA BB)', fields: [] };
    }
    const crcData = bytes.slice(2, 20);
    const expectedCrc = bigEndianU16(bytes, 20);
    const actualCrc = crc16modbus(crcData);
    const crcOk = actualCrc === expectedCrc;

    const ts = bigEndianU32(bytes, 2);
    const x = bigEndianI16(bytes, 6) / 2000;
    const y = bigEndianI16(bytes, 8) / 2000;
    const yaw = bigEndianI16(bytes, 10) / 100;
    const fh = bigEndianI16(bytes, 12) / 2000;
    const rh = bigEndianI16(bytes, 14) / 2000;
    const action = bigEndianU16(bytes, 16);
    const conn = bigEndianU16(bytes, 18);

    const fields: FieldSegment[] = [
      { label: '帧头', start: 0, end: 2, bgClass: 'bg-blue-500/20', textClass: 'text-blue-300' },
      { label: `TS=${ts}`, start: 2, end: 6, bgClass: 'bg-emerald-500/20', textClass: 'text-emerald-300' },
      { label: `X=${x.toFixed(3)}`, start: 6, end: 8, bgClass: 'bg-cyan-500/20', textClass: 'text-cyan-300' },
      { label: `Y=${y.toFixed(3)}`, start: 8, end: 10, bgClass: 'bg-sky-500/20', textClass: 'text-sky-300' },
      { label: `Yaw=${yaw.toFixed(1)}°`, start: 10, end: 12, bgClass: 'bg-indigo-500/20', textClass: 'text-indigo-300' },
      { label: `FH=${fh.toFixed(3)}`, start: 12, end: 14, bgClass: 'bg-yellow-500/20', textClass: 'text-yellow-300' },
      { label: `RH=${rh.toFixed(3)}`, start: 14, end: 16, bgClass: 'bg-orange-500/20', textClass: 'text-orange-300' },
      { label: `Act=0x${action.toString(16).toUpperCase().padStart(4, '0')}`, start: 16, end: 18, bgClass: 'bg-rose-500/20', textClass: 'text-rose-300' },
      { label: `Conn=0x${conn.toString(16).toUpperCase().padStart(4, '0')}`, start: 18, end: 20, bgClass: 'bg-fuchsia-500/20', textClass: 'text-fuchsia-300' },
      {
        label: crcOk ? 'CRC ✓' : `CRC ✗`,
        start: 20, end: 22,
        bgClass: crcOk ? 'bg-purple-500/20' : 'bg-red-500/50',
        textClass: crcOk ? 'text-purple-300' : 'text-red-200',
      },
    ];

    if (!crcOk) {
      return { valid: false, errorMsg: 'CRC校验失败', fields };
    }
    return { valid: true, frameType: 'feedback', fields };
  }

  return { valid: false, errorMsg: `长度错误(${len}B, 期望21或22)`, fields: [] };
}

function byteToHex(b: number): string {
  return b.toString(16).padStart(2, '0').toUpperCase();
}

function formatTime(d: Date): string {
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function FrameHexDisplay({ bytes }: { bytes: number[] }) {
  const analysis = analyzeFrame(bytes);
  const typeLabel = analysis.frameType === 'control' ? 'CTL' : analysis.frameType === 'feedback' ? 'FDB' : '???';
  const typeBg = analysis.frameType === 'control' ? 'bg-primary/60' : analysis.frameType === 'feedback' ? 'bg-success/60' : 'bg-gray-500/60';

  if (!analysis.valid) {
    // Parse failure: render entire frame in red
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`shrink-0 text-[10px] px-1 rounded font-bold text-white ${typeBg}`}>{typeLabel}</span>
          <span className="px-1.5 py-0.5 rounded bg-red-500/25 text-red-300 font-mono break-all">
            {bytes.map((b) => byteToHex(b)).join(' ')}
          </span>
        </div>
        <span className="text-[10px] text-red-400 pl-7">{analysis.errorMsg}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-x-1 gap-y-0.5 flex-wrap">
        <span className={`shrink-0 text-[10px] px-1 rounded font-bold text-white ${typeBg}`}>{typeLabel}</span>
        {analysis.fields.map((f, i) => (
          <span
            key={i}
            className={`px-0.5 rounded font-mono text-xs ${f.bgClass} ${f.textClass}`}
            title={f.label}
          >
            {bytes.slice(f.start, f.end).map((b) => byteToHex(b)).join(' ')}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-x-1 gap-y-0.5 flex-wrap pl-7 text-[10px] text-text-secondary">
        {analysis.fields.map((f, i) => (
          <span key={i} className={`${f.textClass} truncate max-w-[10rem]`}>{f.label}</span>
        ))}
      </div>
    </div>
  );
}

export function SerialDebugger() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<'all' | Direction>('all');
  const idCounter = useRef(0);
  const pausedRef = useRef(paused);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rxBufferRef = useRef<number[]>([]);
  const [rxTotalBytes, setRxTotalBytes] = useState(0);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Drain complete frames from the rx buffer.
  // We try 22-byte ONLY when 22+ bytes are available — falling back to 21-byte
  // when the 22-byte CRC fails would occasionally (1/65536) misidentify a
  // 22-byte FDB frame as a valid 21-byte CTL frame, consuming 21 instead of 22
  // bytes and desynchronising the scanner from the real frame boundaries.
  const drainRxBuffer = (buffer: number[]) => {
    const frames: number[][] = [];
    let start = 0;
    while (start + 21 <= buffer.length) {
      if (buffer[start] === 0xAA && buffer[start + 1] === 0xBB) {
        if (start + 22 <= buffer.length) {
          // Enough data for a 22-byte frame — try it, advance by 1 on failure
          const candidate = buffer.slice(start, start + 22);
          const analysis = analyzeFrame(candidate);
          if (analysis.valid) {
            frames.push(candidate);
            start += 22;
            continue;
          }
          start += 1;
          continue;
        }
        // Exactly 21 bytes available at header — try 21-byte, then wait for more
        const candidate = buffer.slice(start, start + 21);
        const analysis = analyzeFrame(candidate);
        if (analysis.valid) {
          frames.push(candidate);
          start += 21;
          continue;
        }
        break;
      } else {
        start += 1;
      }
    }
    return { frames, consumed: start };
  };

  useEffect(() => {
    let unlistenTx: UnlistenFn | null = null;
    let unlistenRx: UnlistenFn | null = null;
    let cancelled = false;

    const appendTx = (bytes: number[]) => {
      if (pausedRef.current) return;
      const entry: LogEntry = {
        id: idCounter.current++,
        time: formatTime(new Date()),
        direction: 'tx',
        bytes,
      };
      setEntries((prev) => {
        const next = prev.length >= MAX_ENTRIES ? prev.slice(prev.length - MAX_ENTRIES + 1) : prev;
        return [...next, entry];
      });
    };

    const appendRxRaw = (bytes: number[]) => {
      if (pausedRef.current) return;
      setRxTotalBytes((n) => n + bytes.length);
      rxBufferRef.current.push(...bytes);
      const { frames, consumed } = drainRxBuffer(rxBufferRef.current);
      if (consumed > 0) {
        rxBufferRef.current = rxBufferRef.current.slice(consumed);
      }
      // Limit buffer to prevent unbounded growth on garbage data
      if (rxBufferRef.current.length > 512) {
        rxBufferRef.current = rxBufferRef.current.slice(-256);
      }
      if (frames.length > 0) {
        const now = new Date();
        setEntries((prev) => {
          let next = prev;
          for (const frame of frames) {
            const entry: LogEntry = {
              id: idCounter.current++,
              time: formatTime(now),
              direction: 'rx',
              bytes: frame,
            };
            if (next.length >= MAX_ENTRIES) {
              next = next.slice(next.length - MAX_ENTRIES + 1);
            }
            next = [...next, entry];
          }
          return next;
        });
      }
    };

    (async () => {
      const tx = await listen<number[]>('serial_tx', (e) => appendTx(e.payload));
      if (cancelled) { tx(); return; }
      unlistenTx = tx;
      const rx = await listen<number[]>('serial_rx', (e) => appendRxRaw(e.payload));
      if (cancelled) { rx(); return; }
      unlistenRx = rx;
    })();

    return () => {
      cancelled = true;
      unlistenTx?.();
      unlistenRx?.();
    };
  }, []);

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, autoScroll]);

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.direction === filter);

  return (
    <div className="bg-surface rounded-lg shadow border border-border flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold text-text">串口调试</h2>
        <div className="flex gap-1 text-xs">
          <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>全部</FilterBtn>
          <FilterBtn active={filter === 'tx'} onClick={() => setFilter('tx')}>TX</FilterBtn>
          <FilterBtn active={filter === 'rx'} onClick={() => setFilter('rx')}>RX</FilterBtn>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-border flex items-center gap-3 flex-wrap text-xs">
        <button
          onClick={() => setPaused((p) => !p)}
          className={`px-2 py-1 rounded text-white transition-colors ${
            paused ? 'bg-warning' : 'bg-gray-500 hover:bg-gray-600'
          }`}
        >
          {paused ? '已暂停' : '暂停'}
        </button>
        <button
          onClick={() => { setEntries([]); setRxTotalBytes(0); }}
          className="px-2 py-1 rounded bg-gray-500 text-white hover:bg-gray-600"
        >
          清空
        </button>
        <label className="flex items-center gap-1 text-text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="accent-primary"
          />
          自动滚动
        </label>
        <span className="ml-auto text-text-secondary font-mono">
          {filtered.length} / {entries.length} 帧 | {rxTotalBytes} B
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-2 font-mono text-xs space-y-1.5 min-h-0"
      >
        {filtered.length === 0 ? (
          <div className="text-center text-text-secondary py-8">无数据</div>
        ) : (
          filtered.map((e) => (
            <div
              key={e.id}
              className="flex gap-2 px-2 py-1.5 rounded hover:bg-bg"
            >
              <span className="text-text-secondary shrink-0 pt-0.5">{e.time}</span>
              <span
                className={`shrink-0 font-bold pt-0.5 ${
                  e.direction === 'tx' ? 'text-primary' : 'text-success'
                }`}
              >
                {e.direction === 'tx' ? '→' : '←'}
              </span>
              <div className="min-w-0 flex-1">
                <FrameHexDisplay bytes={e.bytes} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded transition-colors ${
        active ? 'bg-primary text-white' : 'bg-bg text-text-secondary hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}
