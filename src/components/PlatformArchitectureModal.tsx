import React from 'react';
import { PlatformAdapter } from '../platform/platformAdapter';
import { PlatformTarget } from '../types';
import { Monitor, Smartphone, Globe, Shield, Cpu, Layers, CheckCircle2, X } from 'lucide-react';

interface PlatformArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlatform: PlatformTarget;
  onSelectPlatform: (p: PlatformTarget) => void;
}

export const PlatformArchitectureModal: React.FC<PlatformArchitectureModalProps> = ({
  isOpen,
  onClose,
  currentPlatform,
  onSelectPlatform
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0d121c] border border-[#223046] rounded-2xl p-6 shadow-2xl text-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-[#1c283d] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-mono text-base font-bold text-white">
                Cross-Platform Deployment Architecture
              </h2>
              <p className="text-xs text-slate-400">
                Windows (System Tray) • Android (Jetpack Compose / Foreground Service) • Web
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Perspective Switcher */}
        <div className="flex items-center gap-2 p-1.5 bg-[#090d14] rounded-xl border border-[#1a2333] mb-5">
          <button
            onClick={() => onSelectPlatform('WINDOWS')}
            className={`flex-1 py-2 rounded-lg font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              currentPlatform === 'WINDOWS'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Windows Runtime
          </button>
          <button
            onClick={() => onSelectPlatform('ANDROID')}
            className={`flex-1 py-2 rounded-lg font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              currentPlatform === 'ANDROID'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Android Runtime
          </button>
          <button
            onClick={() => onSelectPlatform('WEB')}
            className={`flex-1 py-2 rounded-lg font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              currentPlatform === 'WEB'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4" />
            Web Sandbox
          </button>
        </div>

        {/* Architecture details */}
        <div className="space-y-4 text-xs font-sans">
          {currentPlatform === 'WINDOWS' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-[#0a0e17] border border-[#192333]">
                <h4 className="font-mono text-xs font-bold text-cyan-400 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Windows Background Process & Tray Architecture
                </h4>
                <p className="text-slate-300">
                  TRADYX runs as a native lightweight desktop app. When minimized, it closes to the system tray while maintaining its low-CPU observation loop.
                </p>
                <ul className="mt-2 space-y-1 text-slate-400 list-disc list-inside">
                  <li>Direct access to Windows.Graphics.Capture API with zero frame lag</li>
                  <li>Native toast notifications via Windows Action Center</li>
                  <li>Background memory footprint &lt; 85MB using shared deterministic C++ / Rust bindings</li>
                  <li>Persistent multi-monitor support</li>
                </ul>
              </div>
            </div>
          )}

          {currentPlatform === 'ANDROID' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-[#0a0e17] border border-[#192333]">
                <h4 className="font-mono text-xs font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Android Jetpack Compose & Foreground Service
                </h4>
                <p className="text-slate-300">
                  Strictly follows modern Android architecture rules: Kotlin + Jetpack Compose with strict lifecycle awareness.
                </p>
                <ul className="mt-2 space-y-1 text-slate-400 list-disc list-inside">
                  <li>Runs as an Android Foreground Service with continuous status notification to prevent OS kill</li>
                  <li>Picture-in-Picture (PiP) mode and floating head overlay for real-time market structure tracking</li>
                  <li>MediaProjection API with explicit user authorization prompt before capturing charts</li>
                  <li>Battery optimization management and thermal throttling safeguards</li>
                </ul>
              </div>
            </div>
          )}

          {currentPlatform === 'WEB' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-[#0a0e17] border border-[#192333]">
                <h4 className="font-mono text-xs font-bold text-cyan-400 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Web Application Container
                </h4>
                <p className="text-slate-300">
                  Runs TRADYX's deterministic calculation engines and event-driven AI reasoning pipelines inside the modern web sandbox with Web Notifications and Display Media capture.
                </p>
              </div>
            </div>
          )}

          {/* Shared Core Architecture */}
          <div className="p-4 rounded-xl bg-[#080c14] border border-[#16202d] space-y-2">
            <h4 className="font-mono text-xs font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Shared Core Architectural Invariants
            </h4>
            <p className="text-slate-400">
              Regardless of the target OS, TRADYX enforces the same zero-compromise core:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-[11px] font-mono">
              <div className="p-2 rounded bg-[#0d121c] border border-[#1c2738] text-slate-300">
                • Strict per-instrument isolation
              </div>
              <div className="p-2 rounded bg-[#0d121c] border border-[#1c2738] text-slate-300">
                • Code calculates, AI reasons, user decides
              </div>
              <div className="p-2 rounded bg-[#0d121c] border border-[#1c2738] text-slate-300">
                • Deterministic mathematical ground truth
              </div>
              <div className="p-2 rounded bg-[#0d121c] border border-[#1c2738] text-slate-300">
                • Event-driven AI triggering (no continuous polling)
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-5 border-t border-[#1c283d] mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#182335] hover:bg-[#202e44] text-xs font-mono text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
