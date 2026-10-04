import {
  AppMonitoringMode,
  AuditEvent,
  Candle,
  ConnectionStatus,
  InstrumentAnalysisState,
  InstrumentInfo,
  MarketEvent,
  MonitoringSessionConfig,
  MonitoringSourceConfig,
  RawObservedMarketData,
  SignalState,
  Timeframe
} from '../types';
import { TechnicalEngine } from '../core/technicalEngine';
import { MarketStructureEngine } from '../core/marketStructureEngine';
import { MultiTimeframeEngine } from '../core/multiTimeframeEngine';
import { RiskEngine } from '../core/riskEngine';
import { SignalStateMachine } from '../core/stateMachine';
import { MarketDataSource } from '../datasources/MarketDataSource';
import { DemoMarketDataSource } from '../datasources/DemoMarketDataSource';
import { RealMarketCaptureSource } from '../datasources/RealMarketCaptureSource';
import { AIReasoningService } from './aiReasoningService';
import { PlatformAdapter } from '../platform/platformAdapter';
import { DataValidator } from '../core/chartObservation/DataValidator';
import { WindowCaptureManager } from '../core/chartObservation/WindowCaptureManager';

export type SessionStateListener = (states: Map<string, InstrumentAnalysisState>) => void;
export type AuditLogListener = (events: AuditEvent[]) => void;
export type AlertListener = (event: MarketEvent) => void;

export class SessionManager {
  private static instance: SessionManager;

  private appMode: AppMonitoringMode = 'REAL';
  private config: MonitoringSessionConfig | null = null;
  private isMonitoring = false;
  private isPaused = false;

  private realDataSource: RealMarketCaptureSource;
  private demoDataSource: DemoMarketDataSource;
  private dataSource: MarketDataSource;

  // Strict isolation: map keyed by exact symbol name
  private instrumentStates = new Map<string, InstrumentAnalysisState>();
  private auditTrail: AuditEvent[] = [];
  private activeAlerts: MarketEvent[] = [];

  private stateListeners = new Set<SessionStateListener>();
  private auditListeners = new Set<AuditLogListener>();
  private alertListeners = new Set<AlertListener>();

  private aiDebounceMap = new Map<string, number>();

  private constructor() {
    this.realDataSource = new RealMarketCaptureSource();
    this.demoDataSource = new DemoMarketDataSource();
    // Default to REAL data source - strictly zero mock data in real mode
    this.dataSource = this.realDataSource;
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  public getAppMode(): AppMonitoringMode {
    return this.appMode;
  }

  public setAppMode(mode: AppMonitoringMode) {
    if (this.appMode === mode) return;

    if (this.isMonitoring) {
      this.stopMonitoring();
    }

    this.appMode = mode;
    if (mode === 'REAL') {
      this.dataSource = this.realDataSource;
      this.auditTrail = [];
      this.activeAlerts = [];
      // Reinitialize states without synthetic data
      for (const [symbol, state] of this.instrumentStates.entries()) {
        state.isDemo = false;
        state.hasValidLiveData = false;
        state.dataSourceStatusMessage = 'WAITING FOR USER TO SELECT DATA SOURCE';
        state.connectionStatus = 'WAITING_FOR_DATA';
        state.currentCandle = null;
        state.signalState = 'INITIALIZING';
        state.bias = 'WAIT';
        state.rawObservedData = null;
      }
    } else {
      this.dataSource = this.demoDataSource;
      for (const [_, state] of this.instrumentStates.entries()) {
        state.isDemo = true;
        state.hasValidLiveData = true;
        state.dataSourceStatusMessage = 'DEMO DATA (SYNTHETIC)';
      }
    }

    this.notifyState();
    if (this.auditListeners) {
      this.auditListeners.forEach((fn) => fn(this.auditTrail));
    }
  }

  public getDataSource(): MarketDataSource {
    return this.dataSource;
  }

  public getRealCaptureSource(): RealMarketCaptureSource {
    return this.realDataSource;
  }

  public isCaptureActive(): boolean {
    return (
      WindowCaptureManager.getInstance().getIsCapturing() ||
      this.realDataSource.getStatus() === 'DATA_CONNECTED'
    );
  }

  public async stopLiveSource(): Promise<void> {
    const windowManager = WindowCaptureManager.getInstance();
    windowManager.stopCapture();
    await this.realDataSource.disconnect();

    this.isMonitoring = false;
    this.isPaused = true;

    for (const [_, state] of this.instrumentStates.entries()) {
      state.connectionStatus = 'DATA_DISCONNECTED';
      state.signalState = 'INITIALIZING';
      state.hasValidLiveData = false;
      state.dataSourceStatusMessage = 'Live source stopped. Capture: INACTIVE, Monitoring: PAUSED, AI: PAUSED.';
      if (state.rawObservedData) {
        state.rawObservedData.freshness = 'DISCONNECTED';
      }
    }

    this.notifyState();
    this.logAudit({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      symbol: 'SYSTEM',
      timeframe: '15M',
      event: 'LIVE_SOURCE_STOPPED',
      dataSource: 'RealMarketCaptureSource',
      marketState: 'INACTIVE',
      aiDecision: 'PAUSED',
      details: 'Live chart capture stopped by user. Monitoring & AI analysis paused.'
    });
  }

  public setDataSource(ds: MarketDataSource) {
    if (this.isMonitoring) {
      throw new Error('Cannot change data source while monitoring is active. Stop monitoring first.');
    }
    this.dataSource = ds;
  }

  public getConfig(): MonitoringSessionConfig | null {
    return this.config;
  }

  public getIsMonitoring(): boolean {
    return this.isMonitoring;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public getInstrumentStates(): Map<string, InstrumentAnalysisState> {
    return new Map(this.instrumentStates);
  }

  public getAuditTrail(): AuditEvent[] {
    return [...this.auditTrail];
  }

  public getActiveAlerts(): MarketEvent[] {
    return [...this.activeAlerts];
  }

  public subscribe(
    onState: SessionStateListener,
    onAudit?: AuditLogListener,
    onAlert?: AlertListener
  ) {
    this.stateListeners.add(onState);
    if (onAudit) this.auditListeners.add(onAudit);
    if (onAlert) this.alertListeners.add(onAlert);

    // Initial notify
    onState(this.getInstrumentStates());
    if (onAudit) onAudit(this.getAuditTrail());

    return () => {
      this.stateListeners.delete(onState);
      if (onAudit) this.auditListeners.delete(onAudit);
      if (onAlert) this.alertListeners.delete(onAlert);
    };
  }

  /**
   * Configures a user-authorized source for a specific instrument
   */
  public configureInstrumentSource(symbolOrConfig: string | MonitoringSourceConfig, maybeConfig?: MonitoringSourceConfig) {
    const sourceConfig = typeof symbolOrConfig === 'string' ? maybeConfig! : symbolOrConfig;
    const symbol = typeof symbolOrConfig === 'string' ? symbolOrConfig : sourceConfig.instrumentSymbol;

    this.realDataSource.setSourceConfig(symbol, sourceConfig);

    if (this.config) {
      if (!this.config.selectedInstruments.includes(symbol)) {
        this.config.selectedInstruments.push(symbol);
      }
      if (!this.config.monitoringSources) {
        this.config.monitoringSources = {};
      }
      this.config.monitoringSources[symbol] = sourceConfig;
    }

    let state = this.instrumentStates.get(symbol);
    if (!state) {
      this.initializeSingleInstrument(symbol, sourceConfig);
      state = this.instrumentStates.get(symbol);
    }

    if (state) {
      state.sourceConfig = sourceConfig;
      state.dataSourceStatusMessage = `Source configured: ${sourceConfig.applicationName} (${sourceConfig.windowTitle})`;
      state.connectionStatus = 'WAITING_FOR_DATA';
    }
    this.notifyState();
  }

  /**
   * Starts a new monitoring session with validated configuration
   */
  public async startSession(config: MonitoringSessionConfig): Promise<boolean> {
    this.config = config;
    this.appMode = config.mode || 'REAL';

    if (this.appMode === 'REAL') {
      this.dataSource = this.realDataSource;
      // Real sessions start with clean, un-polluted audit log
      this.auditTrail = [];
      this.activeAlerts = [];
    } else {
      this.dataSource = this.demoDataSource;
    }

    // Connect data source
    await this.dataSource.connect();

    const symbols = config.selectedInstruments;

    for (const symbol of symbols) {
      const sourceConfig = config.monitoringSources?.[symbol];
      await this.initializeSingleInstrument(symbol, sourceConfig);
    }

    this.isMonitoring = true;
    this.isPaused = false;
    this.notifyState();

    if (this.auditListeners) {
      this.auditListeners.forEach((fn) => fn(this.auditTrail));
    }

    return true;
  }

  private async initializeSingleInstrument(symbol: string, sourceConfig?: MonitoringSourceConfig) {
    if (!this.config) return;

    const isReal = this.appMode === 'REAL';
    const timeframes: Timeframe[] = ['1D', '4H', '1H', '15M', '5M', '1M'];
    const candlesByTf: Record<Timeframe, Candle[]> = {} as any;

    // In REAL mode, do NOT generate fake historical candles!
    if (isReal) {
      for (const tf of timeframes) {
        candlesByTf[tf] = [];
      }

      const instrumentInfo: InstrumentInfo = {
        symbol,
        name: sourceConfig?.instrumentName || this.getInstrumentFriendlyName(symbol),
        assetClass: this.getAssetClass(symbol),
        currency: sourceConfig?.currency || (symbol.includes('USD') || symbol.includes('GOLD') ? 'USD' : 'INR'),
        tickSize: 0.05,
        currentPrice: 0,
        changePercent: 0,
        high24h: 0,
        low24h: 0,
        volume24h: 0,
        dataSourceType: 'SCREEN_CAPTURE',
        dataSourceName: sourceConfig?.applicationName || 'Awaiting Window Selection'
      };

      const emptyIndicators = TechnicalEngine.calculate(symbol, this.config.primaryTimeframe, []);
      const emptyStructure = MarketStructureEngine.analyze(symbol, this.config.primaryTimeframe, []);
      const emptyMtf = MultiTimeframeEngine.analyze(symbol, this.config.primaryTimeframe, candlesByTf);
      const emptyRisk = RiskEngine.calculate({
        accountCapital: this.config.accountSize,
        riskPerTradePercent: this.config.riskPerTradePercent,
        minRiskRewardRatio: this.config.minRiskRewardRatio,
        currentPrice: 0,
        bias: 'WAIT',
        marketStructure: emptyStructure,
        indicators: emptyIndicators
      });

      const isolatedState: InstrumentAnalysisState = {
        symbol,
        instrumentInfo,
        connectionStatus: sourceConfig?.isValidated ? 'WAITING_FOR_DATA' : 'DATA_DISCONNECTED',
        candles: candlesByTf,
        currentCandle: null,
        indicators: emptyIndicators,
        marketStructure: emptyStructure,
        mtfAnalysis: emptyMtf,
        riskCalculation: emptyRisk,
        signalState: 'INITIALIZING',
        bias: 'WAIT',
        lastAiReasoning: null,
        isAiReasoningPending: false,
        latestEvent: null,
        lastUpdated: Date.now(),
        isDemo: false,
        hasValidLiveData: false,
        dataSourceStatusMessage: sourceConfig?.isValidated
          ? 'Source configured. Waiting for live frames...'
          : 'WAITING FOR USER TO SELECT DATA SOURCE',
        rawObservedData: null,
        sourceConfig: sourceConfig || null
      };

      this.instrumentStates.set(symbol, isolatedState);

      this.dataSource.subscribe(symbol, {
        onCandleUpdate: (sym, tf, candle) => this.handleCandleUpdate(sym, tf, candle),
        onStatusChange: (status) => this.handleStatusChange(symbol, status)
      });
    } else {
      // DEMO MODE: explicitly labeled synthetic feed
      for (const tf of timeframes) {
        candlesByTf[tf] = await this.demoDataSource.getHistoricalData(symbol, tf, 80);
      }

      const primaryCandles = candlesByTf[this.config.primaryTimeframe] || [];
      const lastCandle = primaryCandles[primaryCandles.length - 1] || {
        timestamp: Date.now(),
        open: 1000,
        high: 1000,
        low: 1000,
        close: 1000,
        volume: 0
      };

      const instrumentInfo: InstrumentInfo = {
        symbol,
        name: this.getInstrumentFriendlyName(symbol),
        assetClass: this.getAssetClass(symbol),
        currency: symbol === 'GOLD' || symbol === 'BTC/USD' || symbol === 'AAPL' ? 'USD' : 'INR',
        tickSize: 0.05,
        currentPrice: lastCandle.close,
        changePercent: 0.2,
        high24h: lastCandle.high * 1.01,
        low24h: lastCandle.low * 0.99,
        volume24h: 980000,
        dataSourceType: 'DEMO_FEED',
        dataSourceName: 'TRADYX Demo Synthetic Feed'
      };

      const indicators = TechnicalEngine.calculate(symbol, this.config.primaryTimeframe, primaryCandles);
      const marketStructure = MarketStructureEngine.analyze(symbol, this.config.primaryTimeframe, primaryCandles);
      const mtfAnalysis = MultiTimeframeEngine.analyze(symbol, this.config.primaryTimeframe, candlesByTf);
      const riskCalculation = RiskEngine.calculate({
        accountCapital: this.config.accountSize,
        riskPerTradePercent: this.config.riskPerTradePercent,
        minRiskRewardRatio: this.config.minRiskRewardRatio,
        currentPrice: lastCandle.close,
        bias: 'WAIT',
        marketStructure,
        indicators
      });

      const tempState: InstrumentAnalysisState = {
        symbol,
        instrumentInfo,
        connectionStatus: 'DATA_CONNECTED',
        candles: candlesByTf,
        currentCandle: lastCandle,
        indicators,
        marketStructure,
        mtfAnalysis,
        riskCalculation,
        signalState: 'WATCHING',
        bias: 'WAIT',
        lastAiReasoning: null,
        isAiReasoningPending: false,
        latestEvent: null,
        lastUpdated: Date.now(),
        isDemo: true,
        hasValidLiveData: true,
        dataSourceStatusMessage: 'DEMO DATA (SYNTHETIC)'
      };

      tempState.lastAiReasoning = AIReasoningService.getLocalDeterministicReasoning(tempState);
      this.instrumentStates.set(symbol, tempState);

      this.demoDataSource.subscribe(symbol, {
        onCandleUpdate: (sym, tf, candle) => this.handleCandleUpdate(sym, tf, candle),
        onStatusChange: (status) => this.handleStatusChange(symbol, status)
      });
    }
  }

  public pauseMonitoring() {
    this.isPaused = true;
    this.notifyState();
    this.logAudit({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      symbol: 'SYSTEM',
      timeframe: '15M',
      event: 'SESSION_PAUSED',
      dataSource: this.dataSource.name,
      marketState: 'PAUSED',
      aiDecision: 'STANDBY',
      details: 'Observation paused by user command.'
    });
  }

  public resumeMonitoring() {
    this.isPaused = false;
    this.notifyState();
    this.logAudit({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      symbol: 'SYSTEM',
      timeframe: '15M',
      event: 'SESSION_RESUMED',
      dataSource: this.dataSource.name,
      marketState: 'ACTIVE',
      aiDecision: 'RESUMED',
      details: 'Observation pipeline resumed.'
    });
  }

  public async stopMonitoring() {
    this.isMonitoring = false;
    this.isPaused = false;
    await this.dataSource.disconnect();

    for (const symbol of this.instrumentStates.keys()) {
      this.dataSource.unsubscribe(symbol);
    }

    this.notifyState();
    this.logAudit({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      symbol: 'SYSTEM',
      timeframe: '15M',
      event: 'SESSION_STOPPED',
      dataSource: this.dataSource.name,
      marketState: 'TERMINATED',
      aiDecision: 'OFFLINE',
      details: 'Monitoring session ended. Resources released.'
    });
  }

  public addInstrument(symbol: string, sourceConfig?: MonitoringSourceConfig) {
    if (!this.config) return;
    if (!this.config.selectedInstruments.includes(symbol)) {
      this.config.selectedInstruments.push(symbol);
      this.initializeSingleInstrument(symbol, sourceConfig);
      this.notifyState();
    }
  }

  public removeInstrument(symbol: string) {
    this.dataSource.unsubscribe(symbol);
    this.instrumentStates.delete(symbol);
    if (this.config) {
      this.config.selectedInstruments = this.config.selectedInstruments.filter((s) => s !== symbol);
    }
    this.notifyState();
  }

  /**
   * Main deterministic processing loop triggered on incoming tick/candle
   */
  private handleCandleUpdate(symbol: string, timeframe: Timeframe, updatedCandle: Candle) {
    if (!this.isMonitoring || this.isPaused) return;

    const state = this.instrumentStates.get(symbol);
    if (!state) return;

    // Update Raw Observed data from real source if available
    if (this.appMode === 'REAL') {
      const raw = this.realDataSource.getRawData(symbol);
      state.rawObservedData = raw;

      if (!raw || raw.priceConfidence !== 'VALID' || raw.observedPrice === null) {
        state.hasValidLiveData = false;
        state.dataSourceStatusMessage = raw?.mismatchError || 'INSUFFICIENT VISUAL DATA';
        state.connectionStatus = 'WAITING_FOR_DATA';
        this.notifyState();
        return;
      }

      state.hasValidLiveData = true;
      if (raw.detectedCurrency) {
        state.instrumentInfo.currency = raw.detectedCurrency;
      }
      state.dataSourceStatusMessage = `LIVE: Observed from ${raw.sourceApplicationName}`;
      state.connectionStatus = 'DATA_CONNECTED';
    }

    // Append / update candle history for this timeframe
    if (!state.candles[timeframe]) {
      state.candles[timeframe] = [];
    }

    const candles = state.candles[timeframe];
    const lastCandle = candles[candles.length - 1];

    if (!lastCandle || lastCandle.timestamp !== updatedCandle.timestamp) {
      candles.push(updatedCandle);
      if (candles.length > 200) candles.shift();
    } else {
      candles[candles.length - 1] = updatedCandle;
    }

    state.currentCandle = updatedCandle;
    state.instrumentInfo.currentPrice = updatedCandle.close;

    // Recalculate indicators ONLY on primary timeframe
    if (timeframe === this.config?.primaryTimeframe || state.indicators.timeframe === timeframe) {
      const prevStructure = { ...state.marketStructure };
      const prevSignalState = state.signalState;

      state.indicators = TechnicalEngine.calculate(symbol, timeframe, candles);
      state.marketStructure = MarketStructureEngine.analyze(symbol, timeframe, candles);
      state.mtfAnalysis = MultiTimeframeEngine.analyze(symbol, timeframe, state.candles);

      state.riskCalculation = RiskEngine.calculate({
        accountCapital: this.config?.accountSize || 25000,
        riskPerTradePercent: this.config?.riskPerTradePercent || 1.0,
        minRiskRewardRatio: this.config?.minRiskRewardRatio || 2.0,
        currentPrice: updatedCandle.close,
        bias: state.bias,
        marketStructure: state.marketStructure,
        indicators: state.indicators
      });

      // Deterministic state machine transition
      const evaluation = SignalStateMachine.evaluate({
        currentState: state.signalState,
        currentPrice: updatedCandle.close,
        indicators: state.indicators,
        structure: state.marketStructure,
        mtf: state.mtfAnalysis,
        risk: state.riskCalculation,
        minRiskReward: this.config?.minRiskRewardRatio || 2.0,
        hasVolumeConfirmation: state.indicators.volumeTrend === 'EXPANDING'
      });

      state.signalState = evaluation.nextState;
      state.bias = evaluation.bias;
      state.lastUpdated = Date.now();

      // Check if meaningful event occurred (BOS, breakout, or state change)
      const eventOccurred =
        evaluation.isEventTrigger ||
        (state.marketStructure.bos && !prevStructure.bos) ||
        (state.marketStructure.choch && !prevStructure.choch) ||
        (state.marketStructure.breakout && !prevStructure.breakout) ||
        prevSignalState !== state.signalState;

      if (eventOccurred) {
        const eventTitle =
          state.marketStructure.bos && !prevStructure.bos
            ? 'Break of Structure (BOS)'
            : state.marketStructure.choch && !prevStructure.choch
            ? 'Change of Character (CHoCH)'
            : state.marketStructure.breakout && !prevStructure.breakout
            ? 'Range Breakout'
            : evaluation.stateChangeReason;

        const marketEvent: MarketEvent = {
          id: Math.random().toString(36).substring(2, 9),
          symbol,
          timestamp: Date.now(),
          type: state.signalState === 'CONFIRMED_SETUP' ? 'SETUP_CONFIRMED' : 'BOS_DETECTED',
          title: eventTitle,
          description: evaluation.stateChangeReason,
          severity: state.signalState === 'CONFIRMED_SETUP' ? 'SETUP' : state.signalState === 'INVALIDATED' ? 'WARNING' : 'INFO',
          timeframe
        };

        state.latestEvent = marketEvent;
        this.activeAlerts.unshift(marketEvent);
        if (this.activeAlerts.length > 50) this.activeAlerts.pop();

        this.alertListeners.forEach((fn) => fn(marketEvent));
        PlatformAdapter.sendNotification(marketEvent.title, `${symbol}: ${marketEvent.description}`);

        this.logAudit({
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          symbol,
          timeframe,
          event: eventTitle,
          dataSource: this.dataSource.name,
          marketState: state.signalState,
          aiDecision: state.bias,
          details: evaluation.stateChangeReason
        });

        // Trigger Event-Driven AI Reasoning Layer
        this.triggerAiReasoningForSymbol(symbol);
      }
    }

    this.notifyState();
  }

  private handleStatusChange(symbol: string, status: ConnectionStatus) {
    const state = this.instrumentStates.get(symbol);
    if (state) {
      state.connectionStatus = status;
      if (status === 'DATA_DISCONNECTED') {
        state.hasValidLiveData = false;
        state.dataSourceStatusMessage = 'DATA SOURCE DISCONNECTED';
      }
      this.notifyState();
    }
  }

  public async requestAiReasoning(symbol: string, force = true) {
    return this.triggerAiReasoningForSymbol(symbol, force);
  }

  private async triggerAiReasoningForSymbol(symbol: string, force = false) {
    const state = this.instrumentStates.get(symbol);
    if (!state || state.isAiReasoningPending) return;

    // Rate-limit automated AI triggers
    const lastCalled = this.aiDebounceMap.get(symbol) || 0;
    const cooldown = force ? 3000 : 60000;
    if (Date.now() - lastCalled < cooldown) return;

    this.aiDebounceMap.set(symbol, Date.now());
    state.isAiReasoningPending = true;
    this.notifyState();

    try {
      const reasoning = await AIReasoningService.reasonOverSnapshot(state);
      state.lastAiReasoning = reasoning;
      state.isAiReasoningPending = false;

      if (state.hasValidLiveData) {
        this.logAudit({
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          symbol,
          timeframe: state.indicators.timeframe,
          event: 'AI_REASONING_COMPLETED',
          dataSource: this.dataSource.name,
          marketState: state.signalState,
          aiDecision: `${reasoning.setupState} (${reasoning.bias})`,
          details: `${reasoning.executiveSummary} - Invalidation: ${reasoning.invalidationCriteria}`
        });
      }
    } catch (err) {
      console.warn('AI update failed:', err);
      state.isAiReasoningPending = false;
    }

    this.notifyState();
  }

  public triggerSimulatedEvent(symbol: string, type: 'BULLISH_BREAKOUT' | 'BEARISH_BREAKDOWN' | 'VOLUME_SPIKE') {
    if (this.appMode === 'DEMO') {
      this.demoDataSource.injectSimulatedEvent(symbol, type);
    }
  }

  private logAudit(entry: AuditEvent) {
    this.auditTrail.unshift(entry);
    if (this.auditTrail.length > 100) this.auditTrail.pop();
    this.auditListeners.forEach((fn) => fn(this.auditTrail));
  }

  private notifyState() {
    const snapshot = this.getInstrumentStates();
    this.stateListeners.forEach((fn) => fn(snapshot));
  }

  private getInstrumentFriendlyName(symbol: string): string {
    const names: Record<string, string> = {
      'GOLD OTC': 'Gold OTC (Over-The-Counter Contract)',
      'GOLD': 'Gold Spot / Comex',
      'NIFTY 50': 'Nifty 50 Index',
      'BANK NIFTY': 'Nifty Bank Index',
      'HDFC BANK': 'HDFC Bank Ltd',
      'RELIANCE': 'Reliance Industries',
      'BTC/USD': 'Bitcoin / US Dollar',
      'AAPL': 'Apple Inc.',
      'EUR/USD': 'Euro / US Dollar'
    };
    return names[symbol] || symbol;
  }

  private getAssetClass(symbol: string): 'INDICES' | 'COMMODITIES' | 'EQUITIES' | 'CRYPTO' | 'FOREX' {
    if (symbol.includes('NIFTY')) return 'INDICES';
    if (symbol.includes('GOLD') || symbol === 'SILVER' || symbol.includes('OIL')) return 'COMMODITIES';
    if (symbol === 'BTC/USD' || symbol === 'ETH/USD') return 'CRYPTO';
    if (symbol === 'EUR/USD') return 'FOREX';
    return 'EQUITIES';
  }
}
