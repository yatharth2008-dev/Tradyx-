import React, { useState } from 'react';
import {
  AnalysisMode,
  MonitoringSessionConfig,
  Timeframe,
  TradingStyle
} from '../types';
import {
  Sliders,
  Check,
  Shield,
  Plus,
  X,
  Layers,
  Bell,
  Activity
} from 'lucide-react';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (config: MonitoringSessionConfig) => void;
  initialConfig?: MonitoringSessionConfig | null;
}

const AVAILABLE_INSTRUMENTS = [
  { symbol: 'NIFTY 50', name: 'Nifty 50 Index', category: 'Indices' },
  { symbol: 'GOLD', name: 'Gold Spot / Comex', category: 'Commodities' },
  { symbol: 'GOLD OTC', name: 'Gold OTC (High-Spread Derivative)', category: 'Commodities' },
  { symbol: 'HDFC BANK', name: 'HDFC Bank Ltd', category: 'Equities' },
  { symbol: 'BANK NIFTY', name: 'Nifty Bank Index', category: 'Indices' },
  { symbol: 'RELIANCE', name: 'Reliance Industries', category: 'Equities' },
  { symbol: 'BTC/USD', name: 'Bitcoin / US Dollar', category: 'Crypto' },
  { symbol: 'AAPL', name: 'Apple Inc.', category: 'Equities' },
  { symbol: 'EUR/USD', name: 'Euro / US Dollar', category: 'Forex' }
];

export const CreateSessionModal: React.FC<CreateSessionModalProps> = ({
  isOpen,
  onClose,
  onStart,
  initialConfig
}) => {
  const [sessionName, setSessionName] = useState(initialConfig?.name || 'Primary Market Intelligence Session');
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(
    initialConfig?.selectedInstruments || ['NIFTY 50', 'GOLD', 'HDFC BANK']
  );
  const [customInput, setCustomInput] = useState('');
  const [tradingStyle, setTradingStyle] = useState<TradingStyle>(initialConfig?.tradingStyle || 'INTRADAY');
  const [primaryTf, setPrimaryTf] = useState<Timeframe>(initialConfig?.primaryTimeframe || '15M');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(initialConfig?.analysisMode || 'balanced');
  const [accountSize, setAccountSize] = useState(initialConfig?.accountSize || 25000);
  const [riskPercent, setRiskPercent] = useState(initialConfig?.riskPerTradePercent || 1.0);
  const [minRR, setMinRR] = useState(initialConfig?.minRiskRewardRatio || 2.0);

  const [enableVolume, setEnableVolume] = useState(initialConfig?.enableVolumeAnalysis ?? true);
  const [enableStructure, setEnableStructure] = useState(initialConfig?.enableMarketStructure ?? true);
  const [enableMtf, setEnableMtf] = useState(initialConfig?.enableMultiTimeframe ?? true);
  const [enableNews, setEnableNews] = useState(initialConfig?.enableNewsAnalysis ?? true);
  const [alertsEnabled, setAlertsEnabled] = useState(initialConfig?.alertsEnabled ?? true);
  const [alertSensitivity, setAlertSensitivity] = useState<'LOW' | 'MEDIUM' | 'HIGH'>(
    initialConfig?.alertSensitivity || 'MEDIUM'
  );

  if (!isOpen) return null;

  const toggleSymbol = (sym: string) => {
    if (selectedSymbols.includes(sym)) {
      if (selectedSymbols.length > 1) {
        setSelectedSymbols(selectedSymbols.filter((s) => s !== sym));
      }
    } else {
      setSelectedSymbols([...selectedSymbols, sym]);
    }
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customInput.trim().toUpperCase();
    if (clean && !selectedSymbols.includes(clean)) {
      setSelectedSymbols([...selectedSymbols, clean]);
      setCustomInput('');
    }
  };

  const handleStart = () => {
    if (selectedSymbols.length === 0) return;

    const config: MonitoringSessionConfig = {
      id: Math.random().toString(36).substring(2, 9),
      name: sessionName,
      mode: initialConfig?.mode || 'REAL',
      selectedInstruments: selectedSymbols,
      tradingStyle,
      primaryTimeframe: primaryTf,
      secondaryTimeframes: ['1D', '1H', '5M'].filter((t) => t !== primaryTf) as Timeframe[],
      analysisMode,
      accountSize,
      riskPerTradePercent: riskPercent,
      minRiskRewardRatio: minRR,
      maxSimultaneousSetups: 3,
      preferredDataSource: 'DEMO_FEED',
      enableNewsAnalysis: enableNews,
      enableVolumeAnalysis: enableVolume,
      enableMarketStructure: enableStructure,
      enableMultiTimeframe: enableMtf,
      alertsEnabled,
      alertSound: true,
      alertSensitivity,
      sessionDurationMinutes: 240
    };

    onStart(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0d121c] border border-[#223046] rounded-2xl p-6 shadow-2xl shadow-cyan-950/40 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1c283d] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-mono text-lg font-bold text-white">Configure Monitoring Session</h2>
              <p className="text-xs text-slate-400 font-sans">
                Set active watchlists, deterministic parameters, and risk criteria
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Watchlist Instrument Selection */}
          <div>
            <label className="text-xs font-mono font-semibold text-slate-300 block mb-2 flex items-center justify-between">
              <span>Selected Instruments ({selectedSymbols.length})</span>
              <span className="text-[11px] text-cyan-400 font-normal">Each instrument maintains strictly isolated state</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {AVAILABLE_INSTRUMENTS.map((inst) => {
                const isSelected = selectedSymbols.includes(inst.symbol);
                return (
                  <button
                    key={inst.symbol}
                    id={`btn-select-${inst.symbol.replace(/[\s/]/g, '-').toLowerCase()}`}
                    type="button"
                    onClick={() => toggleSymbol(inst.symbol)}
                    className={`p-2.5 rounded-xl border text-left font-mono transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-500/50 text-white shadow-sm'
                        : 'bg-[#090d14] border-[#1a2333] text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs">{inst.symbol}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <span className="text-[10px] text-slate-500 block truncate">{inst.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom symbol input */}
            <form onSubmit={handleAddCustom} className="flex gap-2">
              <input
                id="input-custom-symbol"
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Add custom symbol (e.g. TCS, CRUDE OIL, ETH/USD)..."
                className="flex-1 bg-[#090d14] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
              <button
                id="btn-add-custom-symbol"
                type="submit"
                className="px-3 py-2 rounded-lg bg-[#182335] hover:bg-[#22314a] border border-[#263752] text-xs font-mono text-cyan-400 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </form>
          </div>

          {/* Timeframe & Trading Style */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono font-semibold text-slate-300 block mb-2">
                Primary Timeframe
              </label>
              <div className="grid grid-cols-6 gap-1.5 bg-[#090d14] p-1.5 rounded-xl border border-[#1a2333]">
                {(['1M', '5M', '15M', '1H', '4H', '1D'] as Timeframe[]).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setPrimaryTf(tf)}
                    className={`py-1.5 text-xs font-mono font-bold rounded-lg transition-colors ${
                      primaryTf === tf
                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-mono font-semibold text-slate-300 block mb-2">
                Trading Style
              </label>
              <div className="grid grid-cols-4 gap-1.5 bg-[#090d14] p-1.5 rounded-xl border border-[#1a2333]">
                {(['SCALPING', 'INTRADAY', 'SWING', 'POSITIONAL'] as TradingStyle[]).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setTradingStyle(style)}
                    className={`py-1.5 text-[10px] font-mono font-bold rounded-lg transition-colors ${
                      tradingStyle === style
                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Risk Parameters */}
          <div className="p-4 rounded-xl bg-[#090d14] border border-[#1a2333] space-y-4">
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-200">
              <Shield className="w-4 h-4 text-emerald-400" />
              DETERMINISTIC RISK RULES
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Account Size ($)</label>
                <input
                  id="input-account-size"
                  type="number"
                  value={accountSize}
                  onChange={(e) => setAccountSize(Number(e.target.value))}
                  className="w-full bg-[#0d131f] border border-[#1f2c42] rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Risk Per Trade (%)</label>
                <input
                  id="input-risk-percent"
                  type="number"
                  step="0.1"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(Number(e.target.value))}
                  className="w-full bg-[#0d131f] border border-[#1f2c42] rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Minimum R:R Ratio</label>
                <input
                  id="input-min-rr"
                  type="number"
                  step="0.5"
                  value={minRR}
                  onChange={(e) => setMinRR(Number(e.target.value))}
                  className="w-full bg-[#0d131f] border border-[#1f2c42] rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-[#18202d]">
              <span>Max loss per trade: <strong className="text-rose-400">${((accountSize * riskPercent) / 100).toFixed(2)}</strong></span>
              <span>Analysis Mode: </span>
              <div className="flex gap-1">
                {(['conservative', 'balanced', 'aggressive'] as AnalysisMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAnalysisMode(m)}
                    className={`px-2 py-0.5 text-[10px] uppercase rounded ${
                      analysisMode === m ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Module Toggles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <label className="flex items-center gap-2 p-2.5 rounded-lg bg-[#090d14] border border-[#1a2333] cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={enableStructure}
                onChange={(e) => setEnableStructure(e.target.checked)}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span className="text-[11px] text-slate-300">Market Structure</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-lg bg-[#090d14] border border-[#1a2333] cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={enableMtf}
                onChange={(e) => setEnableMtf(e.target.checked)}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span className="text-[11px] text-slate-300">Multi-Timeframe</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-lg bg-[#090d14] border border-[#1a2333] cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={enableVolume}
                onChange={(e) => setEnableVolume(e.target.checked)}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span className="text-[11px] text-slate-300">Volume Analysis</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-lg bg-[#090d14] border border-[#1a2333] cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={alertsEnabled}
                onChange={(e) => setAlertsEnabled(e.target.checked)}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span className="text-[11px] text-slate-300">Active Alerts</span>
            </label>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-[#1c283d] mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            id="btn-confirm-start-monitoring"
            type="button"
            onClick={handleStart}
            disabled={selectedSymbols.length === 0}
            className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Activity className="w-4 h-4" />
            START MONITORING ({selectedSymbols.length} INSTRUMENTS)
          </button>
        </div>
      </div>
    </div>
  );
};
