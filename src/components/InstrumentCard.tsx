import React from 'react';
import { InstrumentAnalysisState } from '../types';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  AlertCircle,
  Clock,
  ShieldAlert,
  ChevronRight,
  Trash2,
  Cpu
} from 'lucide-react';

interface InstrumentCardProps {
  state: InstrumentAnalysisState;
  isSelected?: boolean;
  onSelect: () => void;
  onRemove?: () => void;
  onConnectSource?: () => void;
}

export const InstrumentCard: React.FC<InstrumentCardProps> = ({
  state,
  isSelected,
  onSelect,
  onRemove,
  onConnectSource
}) => {
  const {
    symbol,
    instrumentInfo,
    currentCandle,
    signalState,
    bias,
    marketStructure,
    indicators,
    mtfAnalysis,
    latestEvent,
    isAiReasoningPending,
    hasValidLiveData,
    dataSourceStatusMessage,
    isDemo,
    sourceConfig
  } = state;

  const isGreen = currentCandle ? currentCandle.close >= currentCandle.open : false;

  // Signal State styling
  const getSignalBadge = (sigState: string, hasData: boolean) => {
    if (!hasData) {
      return {
        bg: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
        dot: 'bg-amber-400 animate-pulse',
        label: 'AWAITING SOURCE'
      };
    }
    switch (sigState) {
      case 'CONFIRMED_SETUP':
        return {
          bg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
          dot: 'bg-emerald-400',
          label: 'CONFIRMED SETUP'
        };
      case 'CONFIRMATION_PENDING':
        return {
          bg: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
          dot: 'bg-amber-400 animate-pulse',
          label: 'CONFIRMATION PENDING'
        };
      case 'POTENTIAL_SETUP':
        return {
          bg: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300',
          dot: 'bg-cyan-400',
          label: 'POTENTIAL SETUP'
        };
      case 'INVALIDATED':
        return {
          bg: 'bg-rose-500/15 border-rose-500/40 text-rose-400',
          dot: 'bg-rose-400',
          label: 'SETUP INVALIDATED'
        };
      case 'COOLDOWN':
        return {
          bg: 'bg-purple-500/15 border-purple-500/40 text-purple-300',
          dot: 'bg-purple-400',
          label: 'COOLDOWN'
        };
      case 'WATCHING':
      default:
        return {
          bg: 'bg-slate-800/60 border-slate-700 text-slate-300',
          dot: 'bg-slate-400',
          label: 'OBSERVING'
        };
    }
  };

  const badge = getSignalBadge(signalState, hasValidLiveData);

  return (
    <div
      id={`card-instrument-${symbol.replace(/[\s/]/g, '-').toLowerCase()}`}
      onClick={onSelect}
      className={`group relative rounded-xl border p-4 transition-all duration-200 cursor-pointer bg-[#0e131d] hover:bg-[#121926] ${
        isSelected
          ? 'border-cyan-500/80 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/50'
          : !hasValidLiveData
          ? 'border-dashed border-slate-700/80 hover:border-amber-500/50'
          : 'border-[#1e2738] hover:border-[#2e3b52]'
      }`}
    >
      {/* Top row: Symbol, asset class, connection status */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-lg text-white group-hover:text-cyan-300 transition-colors">
            {symbol}
          </span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60">
            {instrumentInfo.assetClass}
          </span>
          {isDemo && (
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">
              DEMO
            </span>
          )}
          {isAiReasoningPending && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 animate-pulse">
              <Cpu className="w-3 h-3" />
              AI
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${badge.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
            {badge.label}
          </span>

          {onRemove && (
            <button
              id={`btn-remove-${symbol.replace(/[\s/]/g, '-').toLowerCase()}`}
              title="Remove from monitoring"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-500 hover:text-rose-400 rounded"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* State A: When live data is NOT connected */}
      {!hasValidLiveData ? (
        <div className="py-3 px-3.5 rounded-lg bg-slate-950/60 border border-slate-800 text-center space-y-2 mb-3">
          <div className="text-xs text-amber-400 font-mono flex items-center justify-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            <span>{dataSourceStatusMessage || 'LIVE DATA UNAVAILABLE'}</span>
          </div>
          <p className="text-[11px] text-slate-400">
            TRADYX requires an authorized application window before computing signals.
          </p>
          {onConnectSource && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConnectSource();
              }}
              className="w-full py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold font-mono transition-colors shadow-sm"
            >
              Connect Chart Window
            </button>
          )}
        </div>
      ) : (
        /* State B: When live data is verified */
        <>
          {/* Price and directional state */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Current Price</div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono font-bold text-xl text-white tracking-tight">
                  {currentCandle ? currentCandle.close.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                </span>
                <span className="text-[11px] font-mono text-cyan-400 font-bold">
                  {state.rawObservedData?.detectedCurrency || instrumentInfo.currency}
                </span>
                {currentCandle && (state.rawObservedData?.detectedCurrency || instrumentInfo.currency) !== 'INR' && (
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
                    ≈ ₹{(currentCandle.close * 84.75).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                )}
                {currentCandle && (
                  <span
                    className={`text-xs font-mono font-medium ${
                      isGreen ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isGreen ? '+' : ''}
                    {(((currentCandle.close - currentCandle.open) / currentCandle.open) * 100).toFixed(2)}%
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Trend & Structure</div>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                {marketStructure.trend === 'BULLISH' ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : marketStructure.trend === 'BEARISH' ? (
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                ) : (
                  <Minus className="w-4 h-4 text-slate-400" />
                )}
                <span
                  className={`font-mono text-xs font-semibold ${
                    marketStructure.trend === 'BULLISH'
                      ? 'text-emerald-400'
                      : marketStructure.trend === 'BEARISH'
                      ? 'text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  {marketStructure.trend}
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  ({marketStructure.structure})
                </span>
              </div>
            </div>
          </div>

          {/* Verified deterministic indicators snapshot */}
          <div className="grid grid-cols-4 gap-1.5 p-2 rounded-lg bg-[#080b12] border border-[#18202d] text-center mb-3">
            <div>
              <span className="text-[9px] font-mono text-slate-500 block">RSI(14)</span>
              <span className={`text-xs font-mono font-semibold ${indicators.rsi > 70 ? 'text-rose-400' : indicators.rsi < 30 ? 'text-emerald-400' : 'text-slate-300'}`}>
                {indicators.rsi > 0 ? indicators.rsi.toFixed(1) : '—'}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-mono text-slate-500 block">VWAP</span>
              <span className="text-xs font-mono text-slate-300">
                {indicators.vwap > 0 ? indicators.vwap.toFixed(0) : '—'}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-mono text-slate-500 block">MTF CONFL</span>
              <span className="text-xs font-mono text-cyan-400 font-semibold">
                {mtfAnalysis.alignmentScore}%
              </span>
            </div>
            <div>
              <span className="text-[9px] font-mono text-slate-500 block">R:R</span>
              <span className="text-xs font-mono text-emerald-400 font-semibold">
                {state.riskCalculation.riskRewardRatio > 0 ? `1:${state.riskCalculation.riskRewardRatio}` : 'N/A'}
              </span>
            </div>
          </div>

          {/* Structural triggers (BOS / CHoCH / Breakout flags) */}
          <div className="flex flex-wrap gap-1 mb-3">
            {marketStructure.bos && (
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                BOS CONFIRMED
              </span>
            )}
            {marketStructure.choch && (
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                CHoCH DETECTED
              </span>
            )}
            {marketStructure.breakout && (
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                BREAKOUT ACTIVE
              </span>
            )}
            {indicators.volumeTrend === 'EXPANDING' && (
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                VOL EXPANSION
              </span>
            )}
          </div>
        </>
      )}

      {/* Latest Event / Source note */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-[#18202d]">
        <div className="flex items-center gap-1.5 truncate max-w-[85%]">
          <Activity className="w-3 h-3 text-cyan-400 shrink-0" />
          <span className="truncate font-sans text-slate-300">
            {sourceConfig ? `Source: ${sourceConfig.applicationName}` : latestEvent ? latestEvent.title : 'Waiting for verified data source'}
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition-colors" />
      </div>
    </div>
  );
};
