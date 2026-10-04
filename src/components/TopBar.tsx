import React from 'react';
import { PlatformTarget } from '../types';
import {
  Shield,
  Activity,
  Play,
  Pause,
  Square,
  Sliders,
  Database,
  Layers,
  Minimize2,
  FileText,
  Radio,
  Monitor,
  Smartphone,
  Globe,
  Cpu
} from 'lucide-react';

interface TopBarProps {
  isMonitoring: boolean;
  isPaused: boolean;
  activeInstrumentCount: number;
  dataSourceName: string;
  currentPlatform: PlatformTarget;
  activeTab: 'grid' | 'alerts' | 'audit';
  appMode: 'REAL' | 'DEMO';
  onModeChange: (mode: 'REAL' | 'DEMO') => void;
  onTabChange: (tab: 'grid' | 'alerts' | 'audit') => void;
  onStartSessionClick: () => void;
  onPauseMonitoring: () => void;
  onResumeMonitoring: () => void;
  onStopMonitoring: () => void;
  onOpenSourceSetup: () => void;
  onOpenSourcesManager: () => void;
  onOpenPlatformArch: () => void;
  onOpenDiagnostics: () => void;
  onMinimizeToTray: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  isMonitoring,
  isPaused,
  activeInstrumentCount,
  dataSourceName,
  currentPlatform,
  activeTab,
  appMode,
  onModeChange,
  onTabChange,
  onStartSessionClick,
  onPauseMonitoring,
  onResumeMonitoring,
  onStopMonitoring,
  onOpenSourceSetup,
  onOpenSourcesManager,
  onOpenPlatformArch,
  onOpenDiagnostics,
  onMinimizeToTray
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0a0e17]/95 border-b border-[#1b2536] backdrop-blur-md px-4 py-2.5 font-sans">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Branding & Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30">
              <Activity className="w-5 h-5 font-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono font-black text-lg tracking-wider text-white">TRADYX</h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                  v1.0-PROD
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-400">
                Source-First AI Market Intelligence
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden md:block"></div>

          {/* Mode Switcher: REAL (Source-First) vs DEMO */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px] font-mono">
            <button
              onClick={() => onModeChange('REAL')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 font-bold ${
                appMode === 'REAL'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${appMode === 'REAL' ? 'bg-slate-950' : 'bg-emerald-500'}`} />
              REAL MODE
            </button>
            <button
              onClick={() => onModeChange('DEMO')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 font-medium ${
                appMode === 'DEMO'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              DEMO MODE
            </button>
          </div>

          {/* Live system state badges */}
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono">
            {isMonitoring ? (
              isPaused ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  PAUSED
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  OBSERVING ({activeInstrumentCount} SOURCES)
                </span>
              )
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                STANDBY
              </span>
            )}

            <button
              onClick={onOpenSourcesManager}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-500/20 transition-colors"
              title="View configured market sources"
            >
              <Database className="w-3 h-3" />
              <span>Sources</span>
            </button>

            <button
              id="btn-system-status"
              onClick={onOpenDiagnostics}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 border border-purple-500/30 transition-colors"
              title="TRADYX System Diagnostics & Nemotron Status"
            >
              <Cpu className="w-3 h-3 text-purple-400" />
              <span>System Status</span>
            </button>

            <button
              onClick={onOpenPlatformArch}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 border border-slate-700/80 transition-colors"
            >
              {currentPlatform === 'WINDOWS' ? (
                <Monitor className="w-3 h-3 text-cyan-400" />
              ) : currentPlatform === 'ANDROID' ? (
                <Smartphone className="w-3 h-3 text-emerald-400" />
              ) : (
                <Globe className="w-3 h-3 text-slate-400" />
              )}
              <span>{currentPlatform}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Dashboard / Alerts / Audit Trail) */}
        <div className="flex items-center gap-1 bg-[#090d14] p-1 rounded-xl border border-[#1b2536]">
          <button
            id="tab-btn-dashboard"
            onClick={() => onTabChange('grid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
              activeTab === 'grid'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Dashboard
          </button>
          <button
            id="tab-btn-alerts"
            onClick={() => onTabChange('alerts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
              activeTab === 'alerts'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Alerts
          </button>
          <button
            id="tab-btn-audit"
            onClick={() => onTabChange('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
              activeTab === 'audit'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Audit Trail
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSourceSetup}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold text-xs transition-colors"
          >
            <Monitor className="w-3.5 h-3.5" />
            Connect Market Source
          </button>
          {isMonitoring ? (
            <>
              {isPaused ? (
                <button
                  id="btn-resume-monitoring"
                  onClick={onResumeMonitoring}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs shadow-sm transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Resume
                </button>
              ) : (
                <button
                  id="btn-pause-monitoring"
                  onClick={onPauseMonitoring}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-mono font-bold text-xs transition-colors"
                >
                  <Pause className="w-3.5 h-3.5" />
                  Pause
                </button>
              )}

              <button
                id="btn-stop-monitoring"
                onClick={onStopMonitoring}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-mono font-bold text-xs transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                Stop
              </button>

              <button
                id="btn-minimize-tray"
                onClick={onMinimizeToTray}
                title="Minimize to System Tray (Windows / Android PIP)"
                className="p-1.5 rounded-lg bg-[#141c29] hover:bg-[#1f2b3e] text-slate-400 hover:text-white border border-[#233247] transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              id="btn-new-session"
              onClick={onStartSessionClick}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs shadow-md shadow-cyan-500/20 transition-all"
            >
              <Sliders className="w-3.5 h-3.5" />
              Configure & Start
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
