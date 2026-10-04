import React, { useState } from 'react';
import { MarketEvent } from '../types';
import { Bell, AlertTriangle, CheckCircle2, Info, Filter, Volume2, VolumeX } from 'lucide-react';

interface AlertsPanelProps {
  alerts: MarketEvent[];
  onClear?: () => void;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts }) => {
  const [filterSymbol, setFilterSymbol] = useState<string>('ALL');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const symbols = Array.from(new Set(alerts.map((a) => a.symbol)));

  const filtered = alerts.filter((a) => (filterSymbol === 'ALL' ? true : a.symbol === filterSymbol));

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'SETUP':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'CRITICAL':
      case 'WARNING':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Info className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  return (
    <div className="bg-[#0b0f17] border border-[#1c2638] rounded-xl p-4 font-sans space-y-3">
      <div className="flex items-center justify-between pb-3 border-b border-[#1c2638]">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-cyan-400" />
          <h3 className="font-mono text-xs font-bold text-white">
            ACTIVE ALERTS & EVENT FEED ({filtered.length})
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1 rounded text-slate-400 hover:text-white"
            title={soundEnabled ? 'Alert audio enabled' : 'Alert audio muted'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {symbols.length > 0 && (
            <select
              value={filterSymbol}
              onChange={(e) => setFilterSymbol(e.target.value)}
              className="bg-[#121824] border border-[#1e293b] rounded text-[11px] font-mono text-slate-300 px-2 py-0.5"
            >
              <option value="ALL">All Instruments</option>
              {symbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="text-center py-6 text-slate-500 font-mono text-xs">
            No events detected yet. Monitoring pipeline observing price action...
          </div>
        ) : (
          filtered.map((alert) => (
            <div
              key={alert.id}
              className={`p-2.5 rounded-lg border text-xs font-sans transition-all flex items-start justify-between gap-3 ${
                alert.severity === 'SETUP'
                  ? 'bg-emerald-950/20 border-emerald-500/30'
                  : alert.severity === 'WARNING'
                  ? 'bg-amber-950/20 border-amber-500/30'
                  : 'bg-[#0e131d] border-[#18212e]'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5">{getIcon(alert.severity)}</div>
                <div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-white text-xs">{alert.symbol}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">{alert.title}</span>
                    <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400">{alert.timeframe}</span>
                  </div>
                  <p className="text-slate-300 text-[11px] mt-0.5">{alert.description}</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-500 shrink-0">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
