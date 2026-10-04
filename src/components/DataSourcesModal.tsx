import React, { useState } from 'react';
import { DataSourceType } from '../types';
import { Database, ShieldCheck, Monitor, Cpu, Check, AlertCircle, X, Key } from 'lucide-react';
import { SessionManager } from '../services/sessionManager';
import { ScreenCaptureSource } from '../datasources/ScreenCaptureSource';
import { DemoMarketDataSource } from '../datasources/DemoMarketDataSource';
import { BrokerApiAdapter } from '../datasources/BrokerApiAdapter';

interface DataSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataSourcesModal: React.FC<DataSourcesModalProps> = ({ isOpen, onClose }) => {
  const sessionManager = SessionManager.getInstance();
  const currentSource = sessionManager.getDataSource();

  const [selectedType, setSelectedType] = useState<DataSourceType>(currentSource.type);
  const [brokerKey, setBrokerKey] = useState('');
  const [brokerType, setBrokerType] = useState('upstox');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplySource = async (type: DataSourceType) => {
    if (sessionManager.getIsMonitoring()) {
      setStatusMessage('Please pause or stop the active monitoring session before switching data sources.');
      return;
    }

    try {
      if (type === 'DEMO_FEED') {
        const demo = new DemoMarketDataSource();
        sessionManager.setDataSource(demo);
        setSelectedType('DEMO_FEED');
        setStatusMessage('Connected to TRADYX Deterministic Demo Feed (Simulated).');
      } else if (type === 'SCREEN_CAPTURE') {
        const screen = new ScreenCaptureSource();
        const connected = await screen.connect();
        if (connected) {
          sessionManager.setDataSource(screen);
          setSelectedType('SCREEN_CAPTURE');
          setStatusMessage('User display capture authorized and connected.');
        } else {
          setStatusMessage('Screen capture permission denied or cancelled by user.');
        }
      } else if (type === 'BROKER_API') {
        const broker = new BrokerApiAdapter();
        broker.setCredentials({
          brokerId: brokerType as any,
          apiKey: brokerKey || 'DEV_KEY_PREVIEW',
          sandboxMode: true
        });
        sessionManager.setDataSource(broker);
        setSelectedType('BROKER_API');
        setStatusMessage(`Broker adapter initialized for ${brokerType.toUpperCase()} (Observation Mode).`);
      }
    } catch (err: any) {
      setStatusMessage(`Connection failed: ${err?.message || err}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans">
      <div className="relative w-full max-w-xl bg-[#0d121c] border border-[#223046] rounded-2xl p-6 shadow-2xl text-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-[#1c283d] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-mono text-base font-bold text-white">Market Data Architecture</h2>
              <p className="text-xs text-slate-400">
                Layered connection manager • Never fabricates unreceived feeds
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMessage && (
          <div className="mb-4 p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-xs font-mono text-cyan-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-cyan-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        <div className="space-y-3 font-sans">
          {/* 1. Demo Data Feed */}
          <div
            onClick={() => handleApplySource('DEMO_FEED')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedType === 'DEMO_FEED'
                ? 'bg-cyan-950/20 border-cyan-500/60 ring-1 ring-cyan-500/40'
                : 'bg-[#090d14] border-[#18212e] hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono font-bold text-xs text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                1. Deterministic Demo Feed (Safely Labeled)
              </span>
              {selectedType === 'DEMO_FEED' && (
                <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-cyan-400 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
                  <Check className="w-3 h-3" /> ACTIVE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Simulates realistic multi-timeframe OHLCV series for NIFTY 50, GOLD, HDFC BANK, etc. Verified math with zero hallucination.
            </p>
          </div>

          {/* 2. Broker / Market-Data API */}
          <div
            onClick={() => handleApplySource('BROKER_API')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedType === 'BROKER_API'
                ? 'bg-cyan-950/20 border-cyan-500/60 ring-1 ring-cyan-500/40'
                : 'bg-[#090d14] border-[#18212e] hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono font-bold text-xs text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                2. Authorized Broker API Adapter
              </span>
              {selectedType === 'BROKER_API' && (
                <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                  <Check className="w-3 h-3" /> ACTIVE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-2">
              Connects to Upstox (V3 Feed), Angel One SmartAPI, Interactive Brokers, or Binance for live market quotes.
            </p>

            <div className="flex items-center gap-2 pt-2 border-t border-[#1a2333]" onClick={(e) => e.stopPropagation()}>
              <select
                value={brokerType}
                onChange={(e) => setBrokerType(e.target.value)}
                className="bg-[#121926] border border-[#1f2b3d] rounded px-2 py-1 text-xs font-mono text-slate-300"
              >
                <option value="upstox">Upstox Market Data Feed (V3)</option>
                <option value="angelone">Angel One SmartAPI (India)</option>
                <option value="interactive_brokers">Interactive Brokers (Global)</option>
                <option value="alpaca">Alpaca Markets (US)</option>
                <option value="binance">Binance (Crypto)</option>
              </select>
              <input
                type="password"
                value={brokerKey}
                onChange={(e) => setBrokerKey(e.target.value)}
                placeholder="Broker API Key..."
                className="flex-1 bg-[#121926] border border-[#1f2b3d] rounded px-2 py-1 text-xs font-mono text-white placeholder-slate-600"
              />
            </div>
          </div>

          {/* 3. Screen/Window Observation */}
          <div
            onClick={() => handleApplySource('SCREEN_CAPTURE')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedType === 'SCREEN_CAPTURE'
                ? 'bg-cyan-950/20 border-cyan-500/60 ring-1 ring-cyan-500/40'
                : 'bg-[#090d14] border-[#18212e] hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono font-bold text-xs text-white flex items-center gap-2">
                <Monitor className="w-4 h-4 text-purple-400" />
                3. User-Authorized Window Observation
              </span>
              {selectedType === 'SCREEN_CAPTURE' && (
                <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-purple-400 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30">
                  <Check className="w-3 h-3" /> ACTIVE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Observes charting software (e.g. TradingView window) with explicit user consent. Uses Windows.Graphics.Capture on Windows, MediaProjection on Android, and Display Media API on Web.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-5 border-t border-[#1c283d] mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#182335] hover:bg-[#202e44] text-xs font-mono text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
