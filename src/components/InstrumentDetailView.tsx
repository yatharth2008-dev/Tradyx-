import React, { useState } from 'react';
import { InstrumentAnalysisState, Timeframe } from '../types';
import { CandlestickChart } from './CandlestickChart';
import {
  TrendingUp,
  TrendingDown,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Cpu,
  Layers,
  ChevronDown,
  ChevronUp,
  Zap,
  RotateCcw,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { SessionManager } from '../services/sessionManager';

interface InstrumentDetailViewProps {
  state: InstrumentAnalysisState;
  onBack: () => void;
}

export const InstrumentDetailView: React.FC<InstrumentDetailViewProps> = ({ state, onBack }) => {
  const [selectedTf, setSelectedTf] = useState<Timeframe>(state.indicators.timeframe || '15M');
  const [expandedSections, setExpandedSections] = useState({
    indicators: true,
    structure: true,
    mtf: true,
    risk: true,
    ai: true,
    simulator: false
  });

  const toggleSection = (key: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const { symbol, currentCandle, indicators, marketStructure, mtfAnalysis, riskCalculation, lastAiReasoning, isAiReasoningPending } = state;

  const candles = state.candles[selectedTf] || state.candles['15M'] || [];

  return (
    <div className="flex flex-col gap-5 font-sans pb-12">
      {/* Top action header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d121c] border border-[#1d2636] p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <button
            id="btn-back-dashboard"
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg bg-[#161f2e] hover:bg-[#1f2c40] border border-[#24334a] text-xs font-mono text-slate-300 transition-colors"
          >
            ← Watchlist
          </button>
          <div>
            <h2 className="font-mono font-bold text-xl text-white flex items-center gap-2">
              {symbol}
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                {state.signalState}
              </span>
            </h2>
            <div className="text-xs text-slate-400 font-mono">
              {state.instrumentInfo.name} • {state.instrumentInfo.dataSourceName}
            </div>
          </div>
        </div>

        {/* Live quote */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
              {state.hasValidLiveData ? 'Verified Live Price' : 'Price Status'}
            </div>
            <div className="font-mono text-2xl font-bold text-white flex items-baseline justify-end gap-1.5">
              <span>{currentCandle ? currentCandle.close.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}</span>
              <span className="text-xs font-mono text-cyan-400 font-bold">
                {state.rawObservedData?.detectedCurrency || state.instrumentInfo.currency}
              </span>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Setup Bias</div>
            <div className={`font-mono text-base font-bold ${state.bias === 'LONG' ? 'text-emerald-400' : state.bias === 'SHORT' ? 'text-rose-400' : 'text-slate-400'}`}>
              {state.hasValidLiveData ? state.bias : 'WAIT'}
            </div>
          </div>
        </div>
      </div>

      {/* Real Mode Observed Source Evidence Bar */}
      {state.hasValidLiveData && state.rawObservedData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-[#0a0f18] border border-[#1b2536] rounded-xl text-xs font-mono">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Observed Source</span>
            <span className="text-slate-200 font-bold truncate block">{state.rawObservedData.sourceApplicationName}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Detected Currency / Pair</span>
            <span className="text-cyan-400 font-bold">
              {state.rawObservedData.detectedCurrency || 'SOURCE AUTO'}
              {state.rawObservedData.baseCurrency && state.rawObservedData.quoteCurrency ? (
                <span className="text-slate-400 ml-1">({state.rawObservedData.baseCurrency}/{state.rawObservedData.quoteCurrency})</span>
              ) : null}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Observation Evidence</span>
            <span className="text-slate-300 truncate block">
              ID:{state.rawObservedData.sourceEvidence?.instrumentEvidence || 'TITLE'} • PX:{state.rawObservedData.sourceEvidence?.priceEvidence || 'SCALE'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Data Freshness</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {state.rawObservedData.freshness}
            </span>
          </div>
        </div>
      )}

      {/* Live Data Connection Warning Banner if not validated */}
      {!state.hasValidLiveData && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-amber-950/25 border border-amber-500/40 rounded-xl text-amber-300 font-sans">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-bold font-mono text-amber-300">
                SOURCE-FIRST ENFORCEMENT: {state.dataSourceStatusMessage || 'LIVE DATA UNAVAILABLE'}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                TRADYX will not synthesize or fake market data. Connect an authorized application window (TradingView, MT4/5, Binance, etc.) to begin continuous live observation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Core Principle Banner */}
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-indigo-950/40 border border-cyan-500/20 rounded-lg text-xs font-mono text-cyan-300">
        <span className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-cyan-400" />
          SYSTEM PHILOSOPHY: <strong>CODE CALCULATES. AI REASONS. USER DECIDES.</strong>
        </span>
        <span className="text-slate-400 text-[11px] hidden sm:inline">Zero data fabrication • Event-driven reasoning</span>
      </div>

      {/* Live Chart */}
      <CandlestickChart
        symbol={symbol}
        timeframe={selectedTf}
        candles={candles}
        ema20={indicators.ema20}
        ema50={indicators.ema50}
        vwap={indicators.vwap}
        resistance={marketStructure.keyResistance[0]}
        support={marketStructure.keySupport[0]}
        onTimeframeChange={(tf) => setSelectedTf(tf)}
      />

      {/* AI Reasoning Layer Output Card */}
      <div className="rounded-xl border border-cyan-500/30 bg-[#0d131f] overflow-hidden shadow-xl shadow-cyan-950/20">
        <div
          onClick={() => toggleSection('ai')}
          className="flex items-center justify-between p-4 bg-gradient-to-r from-cyan-950/30 to-transparent border-b border-[#1c283d] cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                AI Reasoning Layer
                <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  {lastAiReasoning?.provider || 'NVIDIA Nemotron 3 Ultra'}
                </span>
                {isAiReasoningPending && (
                  <span className="text-xs text-cyan-400 animate-pulse">Analyzing event...</span>
                )}
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Interprets verified technical facts • Evaluates Bull vs Bear confluence • Prioritizes WAIT over forced signals
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isAiReasoningPending}
              onClick={(e) => {
                e.stopPropagation();
                SessionManager.getInstance().requestAiReasoning(symbol, true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded bg-[#162032] hover:bg-[#1f2d47] text-cyan-300 border border-cyan-500/30 transition-colors disabled:opacity-50"
              title="Trigger instant AI reasoning evaluation"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAiReasoningPending ? 'animate-spin' : ''}`} />
              <span>{isAiReasoningPending ? 'Evaluating...' : 'Re-analyze'}</span>
            </button>
            <button className="text-slate-400 hover:text-white p-1">
              {expandedSections.ai ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {expandedSections.ai && (
          <div className="p-5 flex flex-col gap-4 text-sm font-sans">
            {lastAiReasoning ? (
              <>
                {/* Executive Summary & Confidence */}
                <div className="flex flex-wrap items-start justify-between gap-3 p-3 rounded-lg bg-[#090d14] border border-[#1b2536]">
                  <div className="max-w-xl">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">Executive Assessment</span>
                    <p className="text-slate-200 font-medium mt-0.5">{lastAiReasoning.executiveSummary}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">Setup State</span>
                      <span className="font-mono font-bold text-cyan-400">{lastAiReasoning.setupState}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">Evidence Confidence</span>
                      <span className="font-mono font-bold text-emerald-400">{lastAiReasoning.confidenceScore}%</span>
                    </div>
                  </div>
                </div>

                {/* Confluence Evaluation: Bull Case vs Bear Case */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bull Case */}
                  <div className="p-3.5 rounded-lg bg-emerald-950/10 border border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-2 font-mono text-xs font-bold text-emerald-400">
                      <TrendingUp className="w-3.5 h-3.5" />
                      BULL CASE CONFLUENCE
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {lastAiReasoning.bullCase.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Bear Case */}
                  <div className="p-3.5 rounded-lg bg-rose-950/10 border border-rose-500/20">
                    <div className="flex items-center gap-2 mb-2 font-mono text-xs font-bold text-rose-400">
                      <TrendingDown className="w-3.5 h-3.5" />
                      BEAR CASE & RISKS
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {lastAiReasoning.bearCase.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Missing confirmation & Invalidation criteria */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-[#090d14] border border-[#1c2638]">
                    <span className="text-[10px] text-amber-400 font-bold block mb-1">MISSING CONFIRMATION REQUIRED:</span>
                    <p className="text-slate-300 font-sans">{lastAiReasoning.missingConfirmation}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#090d14] border border-[#1c2638]">
                    <span className="text-[10px] text-rose-400 font-bold block mb-1">INVALIDATION CRITERIA:</span>
                    <p className="text-slate-300 font-sans">{lastAiReasoning.invalidationCriteria}</p>
                  </div>
                </div>

                {/* Actionable recommendation */}
                <div className="p-3 rounded-lg bg-[#101724] border border-[#223046] flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span><strong>DECISION GUIDANCE:</strong> {lastAiReasoning.actionableRecommendation}</span>
                  </div>
                  <span className="text-slate-500 text-[10px] shrink-0">Updated: {new Date(lastAiReasoning.timestamp).toLocaleTimeString()}</span>
                </div>
              </>
            ) : (
              <div className="text-center py-6 text-slate-500 font-mono text-xs">
                AWAITING EVENT-DRIVEN REASONING PASS
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid: Technical Engine + Market Structure Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Deterministic Technical Engine Table */}
        <div className="rounded-xl border border-[#1d2638] bg-[#0c111a] overflow-hidden">
          <div
            onClick={() => toggleSection('indicators')}
            className="flex items-center justify-between p-3.5 bg-[#101724] border-b border-[#1d2638] cursor-pointer"
          >
            <h3 className="font-mono text-xs font-bold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              DETERMINISTIC TECHNICAL ENGINE ({selectedTf})
            </h3>
            {expandedSections.indicators ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>

          {expandedSections.indicators && (
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
              <div className="p-2 rounded bg-[#090d14] border border-[#17202e]">
                <span className="text-[10px] text-slate-500 block">EMA (9 / 20)</span>
                <span className="text-slate-200">{indicators.ema9} / {indicators.ema20}</span>
              </div>
              <div className="p-2 rounded bg-[#090d14] border border-[#17202e]">
                <span className="text-[10px] text-slate-500 block">EMA (50 / 200)</span>
                <span className="text-slate-200">{indicators.ema50} / {indicators.ema200}</span>
              </div>
              <div className="p-2 rounded bg-[#090d14] border border-[#17202e]">
                <span className="text-[10px] text-slate-500 block">RSI (14)</span>
                <span className={`font-bold ${indicators.rsi > 70 ? 'text-rose-400' : indicators.rsi < 30 ? 'text-emerald-400' : 'text-slate-200'}`}>
                  {indicators.rsi.toFixed(2)}
                </span>
              </div>
              <div className="p-2 rounded bg-[#090d14] border border-[#17202e]">
                <span className="text-[10px] text-slate-500 block">VWAP</span>
                <span className="text-purple-300 font-semibold">{indicators.vwap}</span>
              </div>
              <div className="p-2 rounded bg-[#090d14] border border-[#17202e]">
                <span className="text-[10px] text-slate-500 block">ATR (14)</span>
                <span className="text-slate-200">{indicators.atr}</span>
              </div>
              <div className="p-2 rounded bg-[#090d14] border border-[#17202e]">
                <span className="text-[10px] text-slate-500 block">Bollinger (20, 2)</span>
                <span className="text-slate-300 text-[11px]">{indicators.bollingerBands.lower} - {indicators.bollingerBands.upper}</span>
              </div>
              <div className="p-2 rounded bg-[#090d14] border border-[#17202e]">
                <span className="text-[10px] text-slate-500 block">MACD Histogram</span>
                <span className={`font-bold ${indicators.macd.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {indicators.macd.histogram}
                </span>
              </div>
              <div className="p-2 rounded bg-[#090d14] border border-[#17202e]">
                <span className="text-[10px] text-slate-500 block">Volume Trend</span>
                <span className={`font-bold ${indicators.volumeTrend === 'EXPANDING' ? 'text-purple-400' : 'text-slate-400'}`}>
                  {indicators.volumeTrend}
                </span>
              </div>
              <div className="p-2 rounded bg-[#090d14] border border-[#17202e]">
                <span className="text-[10px] text-slate-500 block">Standard Pivot (PP)</span>
                <span className="text-amber-300">{indicators.pivotPoints.pp}</span>
              </div>
            </div>
          )}
        </div>

        {/* Market Structure Engine Table */}
        <div className="rounded-xl border border-[#1d2638] bg-[#0c111a] overflow-hidden">
          <div
            onClick={() => toggleSection('structure')}
            className="flex items-center justify-between p-3.5 bg-[#101724] border-b border-[#1d2638] cursor-pointer"
          >
            <h3 className="font-mono text-xs font-bold text-slate-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              PRICE ACTION & MARKET STRUCTURE
            </h3>
            {expandedSections.structure ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>

          {expandedSections.structure && (
            <div className="p-4 space-y-3 font-mono text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded bg-[#090d14] border border-[#17202e]">
                  <span className="text-[10px] text-slate-500 block">Trend</span>
                  <span className={`font-bold ${marketStructure.trend === 'BULLISH' ? 'text-emerald-400' : marketStructure.trend === 'BEARISH' ? 'text-rose-400' : 'text-slate-300'}`}>
                    {marketStructure.trend}
                  </span>
                </div>
                <div className="p-2 rounded bg-[#090d14] border border-[#17202e]">
                  <span className="text-[10px] text-slate-500 block">Sequence</span>
                  <span className="text-cyan-300 font-semibold">{marketStructure.structure}</span>
                </div>
                <div className="p-2 rounded bg-[#090d14] border border-[#17202e]">
                  <span className="text-[10px] text-slate-500 block">Volatility</span>
                  <span className="text-slate-300">{marketStructure.volatilityState}</span>
                </div>
              </div>

              {/* Structural Triggers */}
              <div className="p-3 rounded-lg bg-[#090d14] border border-[#17202e] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Break of Structure (BOS):</span>
                  <span className={`font-bold ${marketStructure.bos ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {marketStructure.bos ? 'CONFIRMED' : 'NO'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Change of Character (CHoCH):</span>
                  <span className={`font-bold ${marketStructure.choch ? 'text-amber-400' : 'text-slate-600'}`}>
                    {marketStructure.choch ? 'DETECTED' : 'NO'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Breakout State:</span>
                  <span className={`font-bold ${marketStructure.breakout ? 'text-cyan-400' : 'text-slate-600'}`}>
                    {marketStructure.breakout ? 'BREAKOUT ACTIVE' : marketStructure.breakdown ? 'BREAKDOWN ACTIVE' : 'WITHIN RANGE'}
                  </span>
                </div>
              </div>

              {/* S/R Key Levels */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded bg-[#090d14] border border-[#17202e]">
                  <span className="text-[10px] text-rose-400 font-semibold block">Resistance Cluster:</span>
                  <span className="text-slate-300">{marketStructure.keyResistance.join(', ') || 'N/A'}</span>
                </div>
                <div className="p-2 rounded bg-[#090d14] border border-[#17202e]">
                  <span className="text-[10px] text-emerald-400 font-semibold block">Support Cluster:</span>
                  <span className="text-slate-300">{marketStructure.keySupport.join(', ') || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Multi-Timeframe Confluence Hierarchy */}
      <div className="rounded-xl border border-[#1d2638] bg-[#0c111a] overflow-hidden">
        <div
          onClick={() => toggleSection('mtf')}
          className="flex items-center justify-between p-3.5 bg-[#101724] border-b border-[#1d2638] cursor-pointer"
        >
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-200">
            <Layers className="w-4 h-4 text-purple-400" />
            MULTI-TIMEFRAME ALIGNMENT MATRIX
            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
              Confluence: {mtfAnalysis.alignmentScore}%
            </span>
          </div>
          {expandedSections.mtf ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>

        {expandedSections.mtf && (
          <div className="p-4 space-y-3">
            <div className="p-3 rounded-lg bg-[#090d14] border border-[#17202e] text-xs font-mono text-slate-300">
              <strong className="text-cyan-400">Hierarchy Interpretation: </strong>
              {mtfAnalysis.alignmentSummary}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 font-mono text-xs text-center">
              {(['1D', '4H', '1H', '15M', '5M', '1M'] as Timeframe[]).map((tf) => {
                const snap = mtfAnalysis.snapshots[tf];
                const isBull = snap?.trend === 'BULLISH';
                const isBear = snap?.trend === 'BEARISH';
                return (
                  <div
                    key={tf}
                    className={`p-2.5 rounded-lg border ${
                      tf === selectedTf
                        ? 'bg-[#152033] border-cyan-500/60'
                        : 'bg-[#090d14] border-[#17202e]'
                    }`}
                  >
                    <span className="text-[10px] text-slate-500 font-bold block">{tf}</span>
                    <span className={`font-bold text-xs block my-0.5 ${isBull ? 'text-emerald-400' : isBear ? 'text-rose-400' : 'text-slate-400'}`}>
                      {snap?.trend || 'NEUTRAL'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">RSI: {snap?.rsi?.toFixed(0) || '50'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Deterministic Risk Management Engine */}
      <div className="rounded-xl border border-[#1d2638] bg-[#0c111a] overflow-hidden">
        <div
          onClick={() => toggleSection('risk')}
          className="flex items-center justify-between p-3.5 bg-[#101724] border-b border-[#1d2638] cursor-pointer"
        >
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-200">
            <Shield className="w-4 h-4 text-emerald-400" />
            RISK MANAGEMENT & POSITION SIZING
          </div>
          {expandedSections.risk ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>

        {expandedSections.risk && (
          <div className="p-4 space-y-4 font-mono text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-[#090d14] border border-[#17202e]">
                <span className="text-[10px] text-slate-500 block">Entry Zone</span>
                <span className="text-cyan-300 font-bold">
                  {riskCalculation.entryZone.min} - {riskCalculation.entryZone.max}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#090d14] border border-[#17202e]">
                <span className="text-[10px] text-slate-500 block">Stop Loss Level</span>
                <span className="text-rose-400 font-bold">{riskCalculation.stopLoss}</span>
              </div>
              <div className="p-3 rounded-lg bg-[#090d14] border border-[#17202e]">
                <span className="text-[10px] text-slate-500 block">Target 1 & 2</span>
                <span className="text-emerald-400 font-bold">
                  {riskCalculation.target1} / {riskCalculation.target2}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#090d14] border border-[#17202e]">
                <span className="text-[10px] text-slate-500 block">Calculated R:R Ratio</span>
                <span className="text-white font-bold">1 : {riskCalculation.riskRewardRatio}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#090d14] border border-[#17202e] flex flex-wrap items-center justify-between gap-2 text-slate-400">
              <span>Account: <strong>${riskCalculation.accountCapital.toLocaleString()}</strong></span>
              <span>Risk: <strong>{riskCalculation.riskPercentage}% (${riskCalculation.riskAmount})</strong></span>
              <span>Position Units: <strong>{riskCalculation.recommendedPositionUnits}</strong></span>
              <span>Total Exposure: <strong>${riskCalculation.totalExposure.toLocaleString()}</strong></span>
            </div>

            <p className="text-[11px] text-slate-500 font-sans italic">
              * {riskCalculation.disclaimer}
            </p>
          </div>
        )}
      </div>

      {/* Interactive Testing & Event Injection Simulator */}
      <div className="rounded-xl border border-dashed border-[#24334a] bg-[#0a0e17] overflow-hidden">
        <div
          onClick={() => toggleSection('simulator')}
          className="flex items-center justify-between p-3 bg-[#0e1420] cursor-pointer"
        >
          <div className="flex items-center gap-2 font-mono text-xs font-semibold text-slate-400">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            QA / Testing: Deterministic Event Injection Sandbox
          </div>
          {expandedSections.simulator ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>

        {expandedSections.simulator && (
          <div className="p-4 space-y-3 font-mono text-xs">
            <p className="text-slate-400 font-sans text-xs">
              Inject verified structural triggers into the observation pipeline to inspect state machine transitions and event-driven AI reasoning:
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                id="btn-inject-breakout"
                onClick={() => SessionManager.getInstance().triggerSimulatedEvent(symbol, 'BULLISH_BREAKOUT')}
                className="px-3 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 font-semibold flex items-center gap-1.5 transition-colors"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Inject Bullish Breakout
              </button>
              <button
                id="btn-inject-breakdown"
                onClick={() => SessionManager.getInstance().triggerSimulatedEvent(symbol, 'BEARISH_BREAKDOWN')}
                className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 font-semibold flex items-center gap-1.5 transition-colors"
              >
                <TrendingDown className="w-3.5 h-3.5" />
                Inject Bearish Breakdown
              </button>
              <button
                id="btn-inject-volume"
                onClick={() => SessionManager.getInstance().triggerSimulatedEvent(symbol, 'VOLUME_SPIKE')}
                className="px-3 py-1.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                Inject Volume Expansion
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
