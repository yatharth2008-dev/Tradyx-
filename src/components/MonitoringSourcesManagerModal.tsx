import React from 'react';
import {
  X,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Pause,
  Play
} from 'lucide-react';
import { InstrumentAnalysisState, MonitoringSourceConfig } from '../types';
import { DataFreshnessMonitor } from '../core/chartObservation/DataFreshnessMonitor';

interface MonitoringSourcesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  instrumentStates: Map<string, InstrumentAnalysisState>;
  onOpenSourceSetup: (symbol?: string) => void;
  onRemoveSource: (symbol: string) => void;
  isDemoMode: boolean;
}

export const MonitoringSourcesManagerModal: React.FC<MonitoringSourcesManagerModalProps> = ({
  isOpen,
  onClose,
  instrumentStates,
  onOpenSourceSetup,
  onRemoveSource,
  isDemoMode
}) => {
  if (!isOpen) return null;

  const statesArray = Array.from(instrumentStates.values());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Monitoring Sources & Window Bindings
                {isDemoMode ? (
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-400 font-mono">
                    DEMO SIMULATION FEED
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono">
                    REAL MARKET SOURCES
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Manage user-authorized window captures, freshness status, and data contracts for each instrument.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Active Instrument Source Bindings ({statesArray.length})
            </span>
            <button
              onClick={() => onOpenSourceSetup()}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Connect Another Market Source
            </button>
          </div>

          {statesArray.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl space-y-3 bg-slate-950/40">
              <Monitor className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-medium text-slate-300">No market sources connected yet.</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                TRADYX requires an explicit application window or verified live feed before beginning analysis.
              </p>
              <button
                onClick={() => onOpenSourceSetup()}
                className="mt-2 px-4 py-2 bg-cyan-500 text-slate-950 font-semibold text-xs rounded-lg hover:bg-cyan-400 transition-colors"
              >
                Connect First Market Source
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
              {statesArray.map((state) => {
                const isReal = !state.isDemo;
                const source = state.sourceConfig;
                const freshness = state.rawObservedData?.freshness || (state.hasValidLiveData ? 'LIVE' : 'WAITING_FOR_DATA');
                const badge = DataFreshnessMonitor.getBadgeColor(freshness);

                return (
                  <div key={state.symbol} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-bold text-slate-100">{state.symbol}</span>
                        <span className="text-xs text-slate-400 font-medium">({state.instrumentInfo.name})</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border font-mono font-medium flex items-center gap-1.5 ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {freshness}
                        </span>
                        {state.isDemo && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-400 font-mono">
                            DEMO SYNTHETIC
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
                        <div>
                          <span className="text-slate-500">Source: </span>
                          <span className="text-slate-300">
                            {source?.applicationName || state.instrumentInfo.dataSourceName || 'Unassigned'}
                          </span>
                        </div>
                        {source?.windowTitle && (
                          <div>
                            <span className="text-slate-500">Window: </span>
                            <span className="text-slate-300 truncate max-w-[200px] inline-block align-bottom">
                              {source.windowTitle}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500">Observed Price: </span>
                          <span className="text-amber-400 font-bold">
                            {state.currentCandle ? `${state.currentCandle.close} ${state.instrumentInfo.currency}` : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Status: </span>
                          <span className="text-slate-300">{state.dataSourceStatusMessage}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => onOpenSourceSetup(state.symbol)}
                        className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                        Re-validate / Switch Window
                      </button>
                      <button
                        onClick={() => onRemoveSource(state.symbol)}
                        className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                        title="Disconnect source"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
