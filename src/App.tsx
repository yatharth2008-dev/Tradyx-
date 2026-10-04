import React, { useState, useEffect } from 'react';
import {
  AuditEvent,
  InstrumentAnalysisState,
  MarketEvent,
  MonitoringSessionConfig,
  MonitoringSourceConfig,
  PlatformTarget,
  Timeframe
} from './types';
import { SessionManager } from './services/sessionManager';
import { PlatformAdapter } from './platform/platformAdapter';
import { TopBar } from './components/TopBar';
import { CommandBar } from './components/CommandBar';
import { InstrumentCard } from './components/InstrumentCard';
import { InstrumentDetailView } from './components/InstrumentDetailView';
import { CreateSessionModal } from './components/CreateSessionModal';
import { DataSourcesModal } from './components/DataSourcesModal';
import { PlatformArchitectureModal } from './components/PlatformArchitectureModal';
import { MinimizedTrayBar } from './components/MinimizedTrayBar';
import { AlertsPanel } from './components/AlertsPanel';
import { AuditLogView } from './components/AuditLogView';
import { SourceSetupModal } from './components/SourceSetupModal';
import { MonitoringSourcesManagerModal } from './components/MonitoringSourcesManagerModal';
import { SystemDiagnosticsModal } from './components/SystemDiagnosticsModal';
import { ConnectionStatusBar } from './components/ConnectionStatusBar';
import {
  Shield,
  Activity,
  Plus,
  AlertTriangle,
  Play,
  Sliders,
  Layers,
  Sparkles,
  Info,
  Monitor,
  CheckCircle2,
  Lock
} from 'lucide-react';

export default function App() {
  const sessionManager = SessionManager.getInstance();

  const [instrumentStates, setInstrumentStates] = useState<Map<string, InstrumentAnalysisState>>(new Map());
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [alerts, setAlerts] = useState<MarketEvent[]>([]);
  const [appMode, setAppMode] = useState<'REAL' | 'DEMO'>(sessionManager.getAppMode());

  const [activeTab, setActiveTab] = useState<'grid' | 'alerts' | 'audit'>('grid');

  // Modals & overlay states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDataSourcesModalOpen, setIsDataSourcesModalOpen] = useState(false);
  const [isPlatformArchModalOpen, setIsPlatformArchModalOpen] = useState(false);
  const [isSourceSetupOpen, setIsSourceSetupOpen] = useState(false);
  const [isSourcesManagerOpen, setIsSourcesManagerOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [setupTargetSymbol, setSetupTargetSymbol] = useState<string | undefined>(undefined);
  const [isMinimizedToTray, setIsMinimizedToTray] = useState(false);
  const [currentPlatform, setCurrentPlatform] = useState<PlatformTarget>('WINDOWS');

  // Subscribe to session manager on mount
  useEffect(() => {
    PlatformAdapter.setPlatform(currentPlatform);

    // Auto-restore authorized broker sessions (Upstox, Angel One, Groww, Exness)
    fetch('/api/brokers/sessions/restore', { method: 'POST' }).catch(() => {});

    const unsubscribe = sessionManager.subscribe(
      (states) => {
        setInstrumentStates(states);
        setIsMonitoring(sessionManager.getIsMonitoring());
        setIsPaused(sessionManager.getIsPaused());
        setAppMode(sessionManager.getAppMode());
      },
      (logs) => setAuditLogs(logs),
      (alert) => setAlerts(sessionManager.getActiveAlerts())
    );

    // Auto-start default session with NIFTY 50, GOLD, HDFC BANK
    const defaultConfig: MonitoringSessionConfig = {
      id: 'default-session',
      name: 'Primary Multi-Market Watch',
      mode: 'REAL',
      selectedInstruments: ['NIFTY 50', 'GOLD', 'HDFC BANK'],
      tradingStyle: 'INTRADAY',
      primaryTimeframe: '15M',
      secondaryTimeframes: ['1D', '1H', '5M'],
      analysisMode: 'balanced',
      accountSize: 25000,
      riskPerTradePercent: 1.0,
      minRiskRewardRatio: 2.0,
      maxSimultaneousSetups: 3,
      preferredDataSource: 'DEMO_FEED',
      enableNewsAnalysis: true,
      enableVolumeAnalysis: true,
      enableMarketStructure: true,
      enableMultiTimeframe: true,
      alertsEnabled: true,
      alertSound: true,
      alertSensitivity: 'MEDIUM',
      sessionDurationMinutes: 240
    };

    sessionManager.startSession(defaultConfig);

    return () => {
      unsubscribe();
    };
  }, []);

  const handleModeChange = (newMode: 'REAL' | 'DEMO') => {
    setAppMode(newMode);
    sessionManager.setAppMode(newMode);
  };

  const handleOpenSourceSetup = (symbol?: string) => {
    setSetupTargetSymbol(symbol || (instrumentStates.size > 0 ? Array.from(instrumentStates.keys())[0] : 'GOLD'));
    setIsSourceSetupOpen(true);
  };

  const handleSourceConfigured = (sourceConfig: MonitoringSourceConfig) => {
    sessionManager.configureInstrumentSource(sourceConfig);
    setIsSourceSetupOpen(false);
  };

  const handleStartNewSession = (config: MonitoringSessionConfig) => {
    sessionManager.startSession(config);
    setSelectedSymbol(null);
    setActiveTab('grid');
  };

  const handlePause = () => {
    sessionManager.pauseMonitoring();
  };

  const handleResume = () => {
    sessionManager.resumeMonitoring();
  };

  const handleStop = () => {
    sessionManager.stopMonitoring();
  };

  const handleApplyCommand = (parsed: any) => {
    if (!parsed?.instruments || parsed.instruments.length === 0) return;

    const newConfig: MonitoringSessionConfig = {
      id: Math.random().toString(36).substring(2, 9),
      name: `NL Command: ${parsed.instruments.join(', ')}`,
      mode: appMode,
      selectedInstruments: parsed.instruments,
      tradingStyle: parsed.tradingStyle || 'INTRADAY',
      primaryTimeframe: (parsed.timeframe as Timeframe) || '15M',
      secondaryTimeframes: ['1D', '1H', '5M'],
      analysisMode: parsed.mode || 'balanced',
      accountSize: 25000,
      riskPerTradePercent: 1.0,
      minRiskRewardRatio: parsed.minRiskReward || 2.0,
      maxSimultaneousSetups: 3,
      preferredDataSource: 'DEMO_FEED',
      enableNewsAnalysis: true,
      enableVolumeAnalysis: true,
      enableMarketStructure: true,
      enableMultiTimeframe: true,
      alertsEnabled: true,
      alertSound: true,
      alertSensitivity: 'MEDIUM',
      sessionDurationMinutes: 240
    };

    sessionManager.startSession(newConfig);
    setSelectedSymbol(null);
  };

  const handlePlatformChange = (p: PlatformTarget) => {
    setCurrentPlatform(p);
    PlatformAdapter.setPlatform(p);
  };

  const statesArray = Array.from(instrumentStates.values());
  const selectedState = selectedSymbol ? instrumentStates.get(selectedSymbol) : null;
  const verifiedCount = statesArray.filter((s) => s.hasValidLiveData).length;

  const currentActiveState = selectedState || (statesArray.length > 0 ? statesArray[0] : null);
  const activeInstrumentSymbol = selectedSymbol || (currentActiveState?.symbol ?? 'None');
  const activeObservedPrice = currentActiveState?.currentCandle?.close ?? (currentActiveState?.rawObservedData?.observedPrice ?? null);
  const activeFreshness = currentActiveState?.rawObservedData?.freshness ?? (sessionManager.isCaptureActive() ? 'LIVE' : (appMode === 'DEMO' ? 'LIVE' : 'DISCONNECTED'));
  const activeAiStatus = (currentActiveState?.hasValidLiveData && !currentActiveState?.isAiReasoningPending) ? 'READY' : (currentActiveState?.isAiReasoningPending ? 'REASONING...' : 'WAITING FOR VERIFIED DATA');

  return (
    <div className="min-h-screen bg-[#070a0f] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Top Header */}
      <TopBar
        isMonitoring={isMonitoring}
        isPaused={isPaused}
        activeInstrumentCount={verifiedCount}
        dataSourceName={sessionManager.getDataSource().name}
        currentPlatform={currentPlatform}
        activeTab={activeTab}
        appMode={appMode}
        onModeChange={handleModeChange}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSelectedSymbol(null);
        }}
        onStartSessionClick={() => setIsCreateModalOpen(true)}
        onPauseMonitoring={handlePause}
        onResumeMonitoring={handleResume}
        onStopMonitoring={handleStop}
        onOpenSourceSetup={() => handleOpenSourceSetup()}
        onOpenSourcesManager={() => setIsSourcesManagerOpen(true)}
        onOpenPlatformArch={() => setIsPlatformArchModalOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onMinimizeToTray={() => setIsMinimizedToTray(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-5">
        {/* Real Mode vs Demo Mode Banner */}
        {appMode === 'REAL' ? (
          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2.5 text-slate-300">
              <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-emerald-300">REAL MONITORING MODE: </span>
                <span className="text-slate-300 font-sans">
                  {verifiedCount} of {statesArray.length} instruments bound to authorized live sources. Zero synthetic data allowed.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleOpenSourceSetup()}
                className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-colors text-[11px]"
              >
                + Connect Market Source
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-purple-950/25 border border-purple-500/30 flex items-center justify-between gap-3 text-xs font-mono text-purple-300">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
              <div>
                <strong className="text-purple-200">DEMO MODE ACTIVE: </strong>
                <span className="text-slate-300 font-sans">
                  Synthetic test feed running for system UI testing. To observe real live desktop or mobile charts, switch to REAL MODE.
                </span>
              </div>
            </div>
            <button
              onClick={() => handleModeChange('REAL')}
              className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shrink-0 transition-colors text-[11px]"
            >
              Switch to Real Mode
            </button>
          </div>
        )}

        {/* Compact Connection Status Section (Section 33) */}
        <ConnectionStatusBar
          appMode={appMode}
          isCaptureActive={sessionManager.isCaptureActive()}
          activeInstrument={activeInstrumentSymbol}
          observedPrice={activeObservedPrice}
          currency={currentActiveState?.instrumentInfo.currency || 'USD'}
          dataFreshness={activeFreshness}
          lastUpdateTimestamp={currentActiveState?.lastUpdated || null}
          aiStatus={activeAiStatus as any}
          onStopCapture={() => sessionManager.stopLiveSource()}
          onConnectSource={() => handleOpenSourceSetup(selectedSymbol || undefined)}
        />

        {/* Command Interface */}
        <CommandBar onApplyCommand={handleApplyCommand} />

        {/* Selected Instrument Detail View */}
        {selectedState ? (
          <InstrumentDetailView
            state={selectedState}
            onBack={() => setSelectedSymbol(null)}
          />
        ) : (
          <>
            {/* Tab: Dashboard Grid */}
            {activeTab === 'grid' && (
              <div className="space-y-4">
                {/* Watchlist Section Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                      Active Observation Watchlist ({instrumentStates.size})
                      <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        Isolated State Per Instrument
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Select an instrument to inspect verified indicators, market structure, multi-timeframe matrix, and AI reasoning.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsSourcesManagerOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141d2b] hover:bg-[#1f2b3e] border border-[#202e42] text-xs font-mono text-slate-300 transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      Manage Sources
                    </button>
                    <button
                      id="btn-add-instrument-quick"
                      onClick={() => setIsCreateModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141d2b] hover:bg-[#1f2b3e] border border-[#202e42] text-xs font-mono text-cyan-400 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Modify Watchlist
                    </button>
                  </div>
                </div>

                {/* Instrument Grid */}
                {statesArray.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl border border-dashed border-[#1f293d] bg-[#0b0f17] space-y-3">
                    <Activity className="w-8 h-8 text-slate-600 mx-auto" />
                    <h3 className="font-mono text-sm font-bold text-slate-300">No Instruments Monitored</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      TRADYX requires user-authorized instruments to observe. Select instruments to activate the deterministic calculation and AI reasoning pipeline.
                    </p>
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-mono text-xs font-bold shadow-md shadow-cyan-500/20"
                    >
                      Configure Watchlist
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {statesArray.map((state) => (
                      <InstrumentCard
                        key={state.symbol}
                        state={state}
                        isSelected={selectedSymbol === state.symbol}
                        onSelect={() => setSelectedSymbol(state.symbol)}
                        onRemove={() => sessionManager.removeInstrument(state.symbol)}
                        onConnectSource={() => handleOpenSourceSetup(state.symbol)}
                      />
                    ))}
                  </div>
                )}

                {/* Quick Alerts Preview Banner underneath grid */}
                {alerts.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-[#0a0e17] border border-[#1a2436] flex items-center justify-between gap-3 text-xs font-mono">
                    <div className="flex items-center gap-2 text-slate-300 truncate">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0"></span>
                      <strong className="text-white">LATEST DETECTED EVENT:</strong>
                      <span className="text-cyan-300 font-bold">{alerts[0].symbol}</span>
                      <span className="text-slate-400 truncate">— {alerts[0].title}: {alerts[0].description}</span>
                    </div>
                    <button
                      onClick={() => setActiveTab('alerts')}
                      className="px-2.5 py-1 rounded bg-[#162030] hover:bg-[#202e44] text-[11px] text-cyan-400 shrink-0 transition-colors"
                    >
                      View All Alerts ({alerts.length}) →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Alerts Feed */}
            {activeTab === 'alerts' && <AlertsPanel alerts={alerts} />}

            {/* Tab: Audit Log */}
            {activeTab === 'audit' && <AuditLogView logs={auditLogs} />}
          </>
        )}
      </main>

      {/* Persistent Minimized Tray Simulator (Windows / Android PIP) */}
      {isMinimizedToTray && (
        <MinimizedTrayBar
          instruments={instrumentStates}
          isPaused={isPaused}
          onRestore={() => setIsMinimizedToTray(false)}
          onSelectInstrument={(sym) => {
            setIsMinimizedToTray(false);
            setSelectedSymbol(sym);
          }}
        />
      )}

      {/* Configuration & Modals */}
      <CreateSessionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onStart={handleStartNewSession}
        initialConfig={sessionManager.getConfig()}
      />

      <SourceSetupModal
        isOpen={isSourceSetupOpen}
        onClose={() => setIsSourceSetupOpen(false)}
        onSaveSource={handleSourceConfigured}
        initialInstrumentSymbol={setupTargetSymbol}
      />

      <MonitoringSourcesManagerModal
        isOpen={isSourcesManagerOpen}
        onClose={() => setIsSourcesManagerOpen(false)}
        instrumentStates={instrumentStates}
        onOpenSourceSetup={(sym) => handleOpenSourceSetup(sym)}
        onRemoveSource={(sym) => sessionManager.removeInstrument(sym)}
        isDemoMode={appMode === 'DEMO'}
      />

      <DataSourcesModal
        isOpen={isDataSourcesModalOpen}
        onClose={() => setIsDataSourcesModalOpen(false)}
      />

      <PlatformArchitectureModal
        isOpen={isPlatformArchModalOpen}
        onClose={() => setIsPlatformArchModalOpen(false)}
        currentPlatform={currentPlatform}
        onSelectPlatform={handlePlatformChange}
      />

      <SystemDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        activeSourceCount={verifiedCount}
        isCapturing={sessionManager.isCaptureActive()}
        appMode={appMode}
      />
    </div>
  );
}
