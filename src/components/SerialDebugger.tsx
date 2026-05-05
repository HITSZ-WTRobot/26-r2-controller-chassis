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

function toHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

function formatTime(d: Date): string {
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function SerialDebugger() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<'all' | Direction>('all');
  const idCounter = useRef(0);
  const pausedRef = useRef(paused);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    let unlistenTx: UnlistenFn | null = null;
    let unlistenRx: UnlistenFn | null = null;

    const append = (direction: Direction, bytes: number[]) => {
      if (pausedRef.current) return;
      const entry: LogEntry = {
        id: idCounter.current++,
        time: formatTime(new Date()),
        direction,
        bytes,
      };
      setEntries((prev) => {
        const next = prev.length >= MAX_ENTRIES ? prev.slice(prev.length - MAX_ENTRIES + 1) : prev;
        return [...next, entry];
      });
    };

    (async () => {
      unlistenTx = await listen<number[]>('serial_tx', (e) => append('tx', e.payload));
      unlistenRx = await listen<number[]>('serial_rx', (e) => append('rx', e.payload));
    })();

    return () => {
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
          onClick={() => setEntries([])}
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
          {filtered.length} / {entries.length}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-2 font-mono text-xs space-y-1 min-h-0"
      >
        {filtered.length === 0 ? (
          <div className="text-center text-text-secondary py-8">无数据</div>
        ) : (
          filtered.map((e) => (
            <div
              key={e.id}
              className="flex gap-2 px-2 py-1 rounded hover:bg-bg break-all"
            >
              <span className="text-text-secondary shrink-0">{e.time}</span>
              <span
                className={`shrink-0 font-bold ${
                  e.direction === 'tx' ? 'text-primary' : 'text-success'
                }`}
              >
                {e.direction === 'tx' ? '→' : '←'}
              </span>
              <span className="text-text break-all">{toHex(e.bytes)}</span>
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
