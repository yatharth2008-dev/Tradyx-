import { AIReasoningOutput, Candle, InstrumentAnalysisState } from '../types';

export class AIReasoningService {
  /**
   * Request event-driven AI interpretation of verified deterministic data
   */
  public static async reasonOverSnapshot(
    state: InstrumentAnalysisState,
    preferredModel: string = 'gemini-3.8-flash'
  ): Promise<AIReasoningOutput> {
    // Section 18: Zero-hallucination sentinel checks
    if (!state.hasValidLiveData || !state.currentCandle) {
      return {
        setupState: 'INITIALIZING',
        bias: 'WAIT',
        confidenceScore: 0,
        executiveSummary: 'INSUFFICIENT VERIFIED DATA: No live market source has been authorized or validated. Analysis is strictly paused.',
        bullCase: ['Awaiting user authorization of live chart source'],
        bearCase: ['No live data stream active'],
        missingConfirmation: 'Connect and validate an authorized application window or data feed.',
        invalidationCriteria: 'No live market stream',
        institutionalContext: 'TRADYX strictly prohibits running AI reasoning on unverified or missing market data.',
        actionableRecommendation: 'CONNECT YOUR MARKET SOURCE to begin observation.',
        provider: 'TRADYX Data Verification Sentinel',
        timestamp: Date.now()
      };
    }

    if (state.rawObservedData?.freshness === 'STALE' || state.rawObservedData?.freshness === 'ANALYSIS_PAUSED') {
      return {
        setupState: 'INITIALIZING',
        bias: 'WAIT',
        confidenceScore: 0,
        executiveSummary: 'STALE DATA — ANALYSIS PAUSED: Last observed frame is older than freshness threshold (>10s). Analysis paused to protect user capital.',
        bullCase: ['Data stream paused'],
        bearCase: ['Stale market conditions'],
        missingConfirmation: 'Resume live window observation.',
        invalidationCriteria: 'Stale stream',
        institutionalContext: 'Out-of-date chart observations cannot be used for real-time intelligence.',
        actionableRecommendation: 'WAIT: Restore live chart capture.',
        provider: 'TRADYX Freshness Sentinel',
        timestamp: Date.now()
      };
    }

    const snapshot = {
      symbol: state.symbol,
      timeframe: state.indicators.timeframe,
      price: state.currentCandle.close,
      currency: state.rawObservedData?.detectedCurrency || state.instrumentInfo.currency,
      observedSource: state.rawObservedData?.sourceApplicationName || 'Authorized Live Feed',
      sourceEvidence: state.rawObservedData?.sourceEvidence,
      isVerified: state.hasValidLiveData,
      isDemo: state.isDemo,
      trend: state.marketStructure.trend,
      structure: {
        pattern: state.marketStructure.structure,
        bos: state.marketStructure.bos,
        choch: state.marketStructure.choch,
        breakout: state.marketStructure.breakout,
        breakdown: state.marketStructure.breakdown,
        isFalseBreakout: state.marketStructure.isFalseBreakout
      },
      indicators: {
        rsi: state.indicators.rsi,
        ema20: state.indicators.ema20,
        ema50: state.indicators.ema50,
        ema200: state.indicators.ema200,
        vwap: state.indicators.vwap,
        atr: state.indicators.atr,
        macd: state.indicators.macd
      },
      volumeState: state.indicators.volumeTrend,
      mtfAlignment: {
        score: state.mtfAnalysis.alignmentScore,
        summary: state.mtfAnalysis.alignmentSummary,
        higherTrend: state.mtfAnalysis.higherTimeframeTrend,
        intermediateTrend: state.mtfAnalysis.intermediateTrend,
        lowerTrend: state.mtfAnalysis.lowerTimeframeTrend
      },
      resistance: state.marketStructure.keyResistance[0] || state.currentCandle.close * 1.02,
      support: state.marketStructure.keySupport[0] || state.currentCandle.close * 0.98,
      risk: {
        entryZone: `${state.riskCalculation.entryZone.min} - ${state.riskCalculation.entryZone.max}`,
        stopLoss: state.riskCalculation.stopLoss,
        target1: state.riskCalculation.target1,
        target2: state.riskCalculation.target2,
        riskRewardRatio: state.riskCalculation.riskRewardRatio
      },
      eventTrigger: state.latestEvent?.title || 'Periodic Event-Driven Sync'
    };

    try {
      const response = await fetch('/api/ai/reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot, preferredModel })
      });

      if (!response.ok) {
        throw new Error(`AI Service HTTP error ${response.status}`);
      }

      const data = await response.json();
      const r = data.reasoning;

      return {
        setupState: r.setupState || 'WATCH',
        bias: r.bias || 'NEUTRAL',
        confidenceScore: r.confidenceScore || 50,
        executiveSummary: r.executiveSummary || 'Awaiting clear directional impulse.',
        bullCase: Array.isArray(r.bullCase) ? r.bullCase : ['Base technical support intact'],
        bearCase: Array.isArray(r.bearCase) ? r.bearCase : ['Overhead supply resistance limits momentum'],
        missingConfirmation: r.missingConfirmation || 'Waiting for structural confirmation.',
        invalidationCriteria: r.invalidationCriteria || `Breach of opposite swing boundary`,
        institutionalContext: r.institutionalContext || 'Algorithmic liquidity pools situated above/below range boundaries.',
        actionableRecommendation: r.actionableRecommendation || 'WAIT: Do not force trades without edge.',
        provider: data.provider || 'Deterministic Engine',
        timestamp: Date.now()
      };
    } catch (err: any) {
      console.warn('AI reasoning call failed, falling back to local deterministic model:', err?.message);
      return this.getLocalDeterministicReasoning(state);
    }
  }

  public static async parseNaturalLanguageCommand(command: string): Promise<any> {
    try {
      const res = await fetch('/api/ai/parse-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      const data = await res.json();
      return data.parsed;
    } catch (err) {
      console.warn('Command parsing error:', err);
      return {
        instruments: ['NIFTY 50', 'GOLD', 'HDFC BANK'],
        timeframe: '15M',
        tradingStyle: 'INTRADAY',
        minRiskReward: 2.0,
        mode: 'balanced',
        alertsEnabled: true
      };
    }
  }

  public static getLocalDeterministicReasoning(state: InstrumentAnalysisState): AIReasoningOutput {
    const trend = state.marketStructure.trend;
    const isBull = trend === 'BULLISH';
    const isBear = trend === 'BEARISH';

    return {
      setupState: state.signalState,
      bias: state.bias,
      confidenceScore: isBull || isBear ? 68 : 45,
      executiveSummary: `Deterministic Rule Analysis: ${trend} market structure on ${state.indicators.timeframe}. Confluence score at ${state.mtfAnalysis.alignmentScore}%.`,
      bullCase: [
        'Higher timeframe trend support observed',
        'Price trading relative to session VWAP and EMAs',
        state.marketStructure.bos ? 'Verified Break of Structure (BOS)' : 'Accumulation phase in progress'
      ],
      bearCase: [
        'Overhead liquidity pool may induce supply rejection',
        state.indicators.rsi > 70 ? 'RSI indicates momentum exhaustion' : 'Consolidation ceiling nearby',
        'False breakout risk under average volume'
      ],
      missingConfirmation: 'Definitive candle body closure beyond swing extremes accompanied by volume expansion.',
      invalidationCriteria: `Price cross beyond structural invalidation price: ${state.riskCalculation.invalidationPrice}`,
      institutionalContext: 'Orders clustered around prior session highs and lows.',
      actionableRecommendation: state.signalState === 'CONFIRMED_SETUP' ? 'Setup valid under verified criteria. User decision required.' : 'WAIT: Maintain capital discipline.',
      provider: 'Local Deterministic Fallback Engine',
      timestamp: Date.now()
    };
  }
}
