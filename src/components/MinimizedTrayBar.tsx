import React from 'react';
import { InstrumentAnalysisState } from '../types';
import {
  Maximize2,
  Shield,
  AlertTriangle,
  Radio,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';

interface MinimizedTrayBarProps {
  instruments: Map<string, InstrumentAnalysisState>;
  isPaused: boolean;
  onRestore: () => void;
  onSelectInstrument: (symbol: string) => void;
}

export const MinimizedTrayBar: React.FC<MinimizedTrayBarProps> = ({
  instruments,
  isPaused,
  onRestore,
  onSelectInstrument
}) => {
  const items = Array.from(instruments.values());

  // Check for critical system states across any instrument
  const hasDisconnected = items.some((i) => i.connectionStatus === 'DATA_DISCONNECTED');
  const hasUnavailable = items.some((i) => i.connectionStatus === 'DATA_UNAVAILABLE');

  return (
    <div className="fixed bottom-3 right-3 left-3 sm:left-auto sm:w-[680px] z-50 bg-[#0c111a]/95 border border-cyan-500/40 rounded-xl p-3 shadow-2xl shadow-cyan-950/60 backdrop-blur-md font-sans text-slate-200 animate-slide-up">
      {/* Top status bar */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1c2638] mb-2 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white tracking-wider flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            TRADYX
          </span>
          <span className="text-[10px] text-slate-400">
            [PERSISTENT BACKGROUND OBSERVATION]
          </span>

          {isPaused && (
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
              ANALYSIS PAUSED
            </span>
          )}

          {hasDisconnected && (
            <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[10px] font-bold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              DATA DISCONNECTED
            </span>
          )}

          {hasUnavailable && (
            <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
              DATA UNAVAILABLE
            </span>
          )}
        </div>

        <button
          id="btn-restore-dashboard"
          onClick={onRestore}
          title="Restore full dashboard"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#182335] hover:bg-[#22314a] border border-[#27374f] text-[11px] text-cyan-300 transition-colors"
        >
          <Maximize2 className="w-3 h-3" />
          Restore
        </button>
      </div>

      {/* Instruments compact list */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {items.map((state) => {
          const { symbol, currentCandle, signalState, marketStructure, latestEvent } = state;
          return (
            <div
              key={symbol}
              onClick={() => onSelectInstrument(symbol)}
              className="p-2 rounded-lg bg-[#080c14] border border-[#18212e] hover:border-cyan-500/50 cursor-pointer transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="font-bold text-white">{symbol}</span>
                <span className="font-semibold text-slate-300">
                  {currentCandle ? currentCandle.close.toFixed(1) : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                <span className="flex items-center gap-1">
                  {marketStructure.trend === 'BULLISH' ? (
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                  ) : marketStructure.trend === 'BEARISH' ? (
                    <TrendingDown className="w-3 h-3 text-rose-400" />
                  ) : (
                    <Minus className="w-3 h-3 text-slate-400" />
                  )}
                  {marketStructure.trend}
                </span>

                <span
                  className={`font-semibold ${
                    signalState === 'CONFIRMED_SETUP'
                      ? 'text-emerald-400'
                      : signalState === 'CONFIRMATION_PENDING'
                      ? 'text-amber-400'
                      : signalState === 'INVALIDATED'
                      ? 'text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  {signalState}
                </span>
              </div>

              <div className="text-[9px] text-slate-500 truncate font-sans">
                {latestEvent ? latestEvent.title : 'Observing structure...'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
