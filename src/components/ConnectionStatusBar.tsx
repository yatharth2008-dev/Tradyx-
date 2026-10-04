import React from 'react';
import { SourceFreshnessStatus } from '../types';
import { Radio, AlertCircle, CheckCircle2, Square, Monitor, Cpu } from 'lucide-react';

interface ConnectionStatusBarProps {
  appMode: 'REAL' | 'DEMO';
  isCaptureActive: boolean;
  activeInstrument: string;
  observedPrice: number | null;
  currency?: string;
  dataFreshness: SourceFreshnessStatus | string;
  lastUpdateTimestamp: number | null;
  aiStatus: 'READY' | 'WAITING FOR VERIFIED DATA' | 'REASONING...';
  onStopCapture: () => void;
  onConnectSource: () => void;
}

export const ConnectionStatusBar: React.FC<ConnectionStatusBarProps> = ({
  appMode,
  isCaptureActive,
  activeInstrument,
  observedPrice,
  currency = 'USD',
  dataFreshness,
  lastUpdateTimestamp,
  aiStatus,
  onStopCapture,
  onConnectSource
}) => {
  const isSourceConnected = isCaptureActive || (appMode === 'DEMO');

  const getFreshnessColor = (freshness: string) => {
    switch (freshness) {
      case 'LIVE':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'DELAYED':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'STALE':
      case 'INVALID':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'WAITING_FOR_DATA':
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      case 'DISCONNECTED':
      default:
        return 'text-slate-400 bg-slate-800/80 border-slate-700';
    }
  };

  return (
    <div
      id="compact-connection-status-bar"
      className="bg-[#090d15] border border-[#1b2536] rounded-xl px-4 py-2.5 shadow-sm font-mono text-xs flex flex-wrap items-center justify-between gap-3"
    >
      {/* Metrics Row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {/* MARKET SOURCE */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 text-[11px]">MARKET SOURCE:</span>
          {isSourceConnected ? (
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              CONNECTED
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
              DISCONNECTED
            </span>
          )}
        </div>

        <div className="h-3.5 w-px bg-slate-800 hidden sm:block"></div>

        {/* CAPTURE */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 text-[11px]">CAPTURE:</span>
          {isCaptureActive ? (
            <span className="flex items-center gap-1 text-cyan-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              ACTIVE
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
              INACTIVE
            </span>
          )}
        </div>

        <div className="h-3.5 w-px bg-slate-800 hidden sm:block"></div>

        {/* DATA FRESHNESS */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 text-[11px]">DATA:</span>
          <span
            className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${getFreshnessColor(
              dataFreshness
            )}`}
          >
            ● {dataFreshness}
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-800 hidden md:block"></div>

        {/* INSTRUMENT */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 text-[11px]">INSTRUMENT:</span>
          <span className="text-white font-bold bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
            {activeInstrument || 'None Selected'}
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-800 hidden md:block"></div>

        {/* PRICE */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 text-[11px]">PRICE:</span>
          <span className="text-amber-400 font-bold text-sm">
            {observedPrice !== null && observedPrice > 0
              ? `${observedPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${currency}`
              : '—'}
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-800 hidden lg:block"></div>

        {/* LAST UPDATE */}
        <div className="flex items-center gap-1.5 text-slate-400">
          <span className="text-slate-500 text-[11px]">LAST UPDATE:</span>
          <span>
            {lastUpdateTimestamp && lastUpdateTimestamp > 0
              ? new Date(lastUpdateTimestamp).toLocaleTimeString()
              : 'Waiting for frame'}
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-800 hidden lg:block"></div>

        {/* AI STATUS */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 text-[11px]">AI:</span>
          <span
            className={`flex items-center gap-1 font-bold ${
              aiStatus === 'READY'
                ? 'text-emerald-400'
                : aiStatus === 'REASONING...'
                ? 'text-cyan-400 animate-pulse'
                : 'text-amber-400'
            }`}
          >
            <Cpu className="w-3 h-3" />
            {aiStatus}
          </span>
        </div>
      </div>

      {/* Action controls for capture stream */}
      <div className="flex items-center gap-2">
        {isCaptureActive ? (
          <button
            id="btn-stop-live-source"
            onClick={onStopCapture}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold transition-colors"
            title="Stop Live Source and pause AI analysis"
          >
            <Square className="w-3 h-3 fill-current" />
            STOP LIVE SOURCE
          </button>
        ) : (
          <button
            id="btn-connect-live-source-bar"
            onClick={onConnectSource}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold transition-colors"
          >
            <Monitor className="w-3 h-3" />
            Connect Live Source
          </button>
        )}
      </div>
    </div>
  );
};
