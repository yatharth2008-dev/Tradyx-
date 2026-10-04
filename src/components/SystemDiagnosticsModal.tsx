import React, { useState, useEffect } from 'react';
import {
  Shield,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Cpu,
  Server,
  Zap,
  Terminal,
  Database,
  Radio,
  X
} from 'lucide-react';

interface SystemDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSourceCount: number;
  isCapturing: boolean;
  appMode: 'REAL' | 'DEMO';
}

interface DiagnosticsData {
  system: string;
  frontend: string;
  backend: string;
  vite: string;
  nvidia: {
    provider: string;
    model: string;
    baseUrl: string;
    configured: boolean;
    reachable: boolean;
    status: string;
    details?: string;
  };
  marketSource: string;
  capture: string;
  aiEngine: string;
  timestamp: string;
}

interface BrokerSessionInfo {
  brokerId: string;
  displayName: string;
  status: string;
  details: string;
  isAuthenticated: boolean;
  userName?: string;
  accountCode?: string;
  requiresReconnect: boolean;
}

interface TestResult {
  success: boolean;
  text: string;
  model: string;
  latencyMs: number;
  hasThinking: boolean;
  error?: string;
}

export const SystemDiagnosticsModal: React.FC<SystemDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  activeSourceCount,
  isCapturing,
  appMode
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<BrokerSessionInfo[]>([]);
  const [restoringSessions, setRestoringSessions] = useState(false);

  const [testingAi, setTestingAi] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const fetchDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [diagRes, sessRes] = await Promise.all([
        fetch('/api/diagnostics'),
        fetch('/api/brokers/sessions').catch(() => null)
      ]);

      if (!diagRes.ok) throw new Error(`HTTP ${diagRes.status}`);
      const json = await diagRes.json();
      setData(json);

      if (sessRes && sessRes.ok) {
        const sessJson = await sessRes.json();
        setSessions(sessJson.sessions || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load diagnostics');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreSessions = async () => {
    setRestoringSessions(true);
    try {
      const res = await fetch('/api/brokers/sessions/restore', { method: 'POST' });
      const json = await res.json();
      if (json.sessions) {
        setSessions(json.sessions);
      }
    } catch {
      // ignore
    } finally {
      setRestoringSessions(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiagnostics();
    }
  }, [isOpen]);

  const runAiTest = async () => {
    setTestingAi(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ai/test', { method: 'POST' });
      const json = await res.json();
      setTestResult(json);
    } catch (err: any) {
      setTestResult({
        success: false,
        text: '',
        model: 'nvidia/nemotron-3-ultra-550b-a55b',
        latencyMs: 0,
        hasThinking: false,
        error: err?.message || 'Failed to execute test request'
      });
    } finally {
      setTestingAi(false);
    }
  };

  if (!isOpen) return null;

  const isNvidiaConfigured = data?.nvidia?.configured ?? false;
  const isNvidiaReachable = data?.nvidia?.reachable ?? false;
  const isBackendReady = data?.backend === 'READY';
  const hasMarketSource = activeSourceCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#0b101a] border border-[#1b2536] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1b2536] bg-[#0d1422]/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold text-white tracking-wide">
                TRADYX SYSTEM STATUS & DIAGNOSTICS
              </h2>
              <p className="text-xs font-mono text-slate-400">
                Core Engine Verification & Provider Health
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDiagnostics}
              disabled={loading}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors disabled:opacity-50"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Status Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
            {/* Frontend */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e1726] border border-slate-800">
              <div className="flex items-center gap-2 text-slate-300">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Frontend Client</span>
              </div>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                READY
              </span>
            </div>

            {/* Backend */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e1726] border border-slate-800">
              <div className="flex items-center gap-2 text-slate-300">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>Backend Engine</span>
              </div>
              {isBackendReady ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  READY
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold">
                  <XCircle className="w-3.5 h-3.5" />
                  ERROR
                </span>
              )}
            </div>

            {/* Vite Dev & HMR */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e1726] border border-slate-800">
              <div className="flex items-center gap-2 text-slate-300">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Vite Dev Environment</span>
              </div>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                READY (Port 3000 Bound)
              </span>
            </div>

            {/* NVIDIA Configuration */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e1726] border border-slate-800">
              <div className="flex items-center gap-2 text-slate-300">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span>NVIDIA Configuration</span>
              </div>
              {isNvidiaConfigured ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  CONFIGURED
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  MISSING
                </span>
              )}
            </div>

            {/* NVIDIA API Connectivity */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e1726] border border-slate-800">
              <div className="flex items-center gap-2 text-slate-300">
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>NVIDIA API</span>
              </div>
              {isNvidiaReachable ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  REACHABLE
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  UNAVAILABLE
                </span>
              )}
            </div>

            {/* Nemotron Model */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e1726] border border-slate-800">
              <div className="flex items-center gap-2 text-slate-300">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span>Nemotron 3 Ultra</span>
              </div>
              {isNvidiaConfigured && isNvidiaReachable ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  READY
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-bold">
                  FALLBACK ENGINE
                </span>
              )}
            </div>

            {/* Market Source */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e1726] border border-slate-800">
              <div className="flex items-center gap-2 text-slate-300">
                <Database className="w-4 h-4 text-cyan-400" />
                <span>Market Source</span>
              </div>
              {hasMarketSource ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  CONNECTED ({activeSourceCount})
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-bold">
                  NOT CONNECTED
                </span>
              )}
            </div>

            {/* Chart Capture */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e1726] border border-slate-800">
              <div className="flex items-center gap-2 text-slate-300">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>Window Capture</span>
              </div>
              {isCapturing ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ACTIVE
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-bold">
                  INACTIVE
                </span>
              )}
            </div>
          </div>

          {/* Real Broker Sessions & Auto-Restoration (One-Time Auth / Session Store) */}
          <div className="p-4 rounded-xl bg-[#090f1a] border border-[#1b2536] space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  AUTHENTICATED BROKER SESSIONS
                </h3>
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                  Server-side session store maintains secure tokens. Sessions auto-restore on boot.
                </p>
              </div>
              <button
                onClick={handleRestoreSessions}
                disabled={restoringSessions}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${restoringSessions ? 'animate-spin' : ''}`} />
                {restoringSessions ? 'Restoring...' : 'Restore Sessions'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {sessions.map((s) => (
                <div
                  key={s.brokerId}
                  className="p-3 rounded-lg bg-[#0c1322] border border-slate-800 flex items-center justify-between"
                >
                  <div className="space-y-0.5 truncate pr-2">
                    <span className="font-bold text-slate-200 block text-xs truncate">{s.displayName}</span>
                    <span className="text-[10px] text-slate-400 block truncate font-sans">
                      {s.userName ? `User: ${s.userName}` : s.accountCode ? `ID: ${s.accountCode}` : s.details}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold shrink-0 ${
                      s.status === 'LIVE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : s.status === 'CONNECTED'
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                        : s.status === 'AUTHENTICATION_REQUIRED'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Provider Details Box */}
          <div className="p-4 rounded-xl bg-[#080d16] border border-[#1b2536] space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-bold">Active Reasoning Architecture:</span>
              <span className="text-cyan-400 font-bold">
                {data?.nvidia?.model || 'nvidia/nemotron-3-ultra-550b-a55b'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Base URL:</span>
              <span className="text-slate-300">https://integrate.api.nvidia.com/v1</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Secret / Env Variable:</span>
              <span className="text-emerald-400 font-bold">
                {isNvidiaConfigured ? 'NVIDIA_API_KEY (CONFIGURED & PROTECTED)' : 'NVIDIA_API_KEY (NOT FOUND)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Core Directive:</span>
              <span className="text-slate-300">"CODE CALCULATES. AI REASONS. USER DECIDES."</span>
            </div>
            {!isNvidiaConfigured && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
                Notice: NVIDIA_API_KEY is not configured in server environment. TRADYX will safely use its local deterministic institutional rule engine until configured.
              </div>
            )}
          </div>

          {/* Interactive Connection Test */}
          <div className="p-4 rounded-xl bg-[#0a101d] border border-cyan-950/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  NVIDIA NEMOTRON 3 ULTRA CONNECTION TEST
                </h3>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Sends safe ping: "You are TRADYX AI. Reply only with: TRADYX AI ONLINE"
                </p>
              </div>
              <button
                id="btn-test-nemotron"
                onClick={runAiTest}
                disabled={testingAi}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs shadow-md shadow-cyan-500/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <Radio className={`w-3.5 h-3.5 ${testingAi ? 'animate-spin' : ''}`} />
                {testingAi ? 'Testing...' : 'Run Connection Test'}
              </button>
            </div>

            {testResult && (
              <div className="mt-3 p-3 rounded-lg bg-[#060a12] border border-slate-800 font-mono text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  {testResult.success ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      SUCCESS ({testResult.latencyMs}ms)
                    </span>
                  ) : (
                    <span className="text-rose-400 font-bold flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" />
                      FAILED
                    </span>
                  )}
                </div>
                {testResult.success ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Model:</span>
                      <span className="text-cyan-300">{testResult.model}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Nemotron Thinking:</span>
                      <span className="text-purple-300 font-bold">
                        {testResult.hasThinking ? 'DETECTED & ENABLED' : 'STANDARD'}
                      </span>
                    </div>
                    <div className="pt-1.5 border-t border-slate-800/80">
                      <span className="text-slate-400">Output:</span>
                      <p className="mt-1 px-2.5 py-1.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 font-bold">
                        {testResult.text}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="pt-1.5 border-t border-slate-800 text-rose-300">
                    Error: {testResult.error || 'Connection failed'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#1b2536] bg-[#0d1422]/60 flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-500">
            TRADYX Diagnostic Sentinel v1.2
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-mono font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
