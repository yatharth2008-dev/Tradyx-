export type Timeframe = '1M' | '5M' | '15M' | '1H' | '4H' | '1D';

export type TrendDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'CONSOLIDATING';

export type SignalState =
  | 'NO_DATA'
  | 'INITIALIZING'
  | 'WATCHING'
  | 'POTENTIAL_SETUP'
  | 'CONFIRMATION_PENDING'
  | 'CONFIRMED_SETUP'
  | 'INVALIDATED'
  | 'COOLDOWN';

export type SetupBias = 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE';

export type AppMonitoringMode = 'REAL' | 'DEMO';

export type RealModeSourceState =
  | 'NO_SOURCE'
  | 'SOURCE_SELECTION'
  | 'CAPABILITY_CHECK'
  | 'AUTHORIZATION_REQUIRED'
  | 'AUTHORIZING'
  | 'CAPTURE_ACTIVE'
  | 'SOURCE_VERIFICATION'
  | 'DATA_VALIDATION'
  | 'READY_TO_MONITOR'
  | 'MONITORING'
  | 'SOURCE_LOST'
  | 'UNSUPPORTED_ENVIRONMENT'
  | 'PERMISSION_DENIED'
  | 'NOT_IMPLEMENTED';

export type CaptureCapabilityState =
  | 'SUPPORTED'
  | 'UNSUPPORTED'
  | 'RESTRICTED'
  | 'PERMISSION_REQUIRED'
  | 'UNKNOWN';

export type SourceConnectionStatus =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'NOT_IMPLEMENTED'
  | 'UNSUPPORTED_ENVIRONMENT'
  | 'PERMISSION_DENIED'
  | 'CONNECTING'
  | 'WAITING_FOR_DATA';

export interface SourceCapability {
  id: string;
  name: string;
  type: DataSourceCategory;
  adapterName: string;
  isImplemented: boolean;
  isSupportedInCurrentEnv: boolean;
  requiresUserPermission: boolean;
  requiresNativeApp: boolean;
  supportedPlatforms: PlatformTarget[];
  status: SourceConnectionStatus;
  details: string;
}

export interface CaptureEnvironmentReport {
  state: CaptureCapabilityState;
  isSecureContext: boolean;
  hasMediaDevices: boolean;
  hasGetDisplayMedia: boolean;
  isEmbeddedIframe: boolean;
  browserName: string;
  platform: string;
  isMobile: boolean;
  reason: string;
  recommendedAction: string;
}

export type ConnectionStatus =
  | 'DATA_CONNECTED'
  | 'DATA_DELAYED'
  | 'DATA_DISCONNECTED'
  | 'DATA_UNAVAILABLE'
  | 'WAITING_FOR_DATA'
  | 'PERMISSION_REQUIRED'
  | 'STALE'
  | 'INVALID'
  | 'ANALYSIS_PAUSED';

export type SourceFreshnessStatus =
  | 'LIVE'
  | 'DELAYED'
  | 'STALE'
  | 'DISCONNECTED'
  | 'PERMISSION_REQUIRED'
  | 'INVALID'
  | 'WAITING_FOR_DATA'
  | 'ANALYSIS_PAUSED';

export type ObservedDataConfidence = 'VALID' | 'UNCERTAIN' | 'UNAVAILABLE';

export type DataSourceCategory =
  | 'SCREEN_WINDOW_CAPTURE'
  | 'TRADING_APP'
  | 'BROKER_API'
  | 'MARKET_DATA_API'
  | 'DEMO_SYNTHETIC';

export type DataSourceType =
  | 'DEMO_FEED'
  | 'BROKER_API'
  | 'REALTIME_FEED'
  | 'SCREEN_CAPTURE';

export interface SourceEvidence {
  instrumentEvidence: 'OCR_TEXT' | 'WINDOW_TITLE' | 'USER_CONFIRMED' | 'CHART_HEADER' | 'NONE';
  priceEvidence: 'PRICE_SCALE' | 'OCR_TEXT' | 'USER_VERIFIED' | 'NONE';
  currencyEvidence: 'SYMBOL_TEXT' | 'SCALE_LABEL' | 'PLATFORM_METADATA' | 'USER_OVERRIDE' | 'NONE';
  timeframeEvidence: 'CHART_UI' | 'WINDOW_TITLE' | 'USER_CONFIRMED' | 'NONE';
  confidence: number; // 0 to 1 observation quality score
}

export interface RealTimeObservation {
  sessionId: string;
  timestamp: number;
  source: {
    application: string;
    window?: string;
    type: DataSourceCategory;
  };
  instrument: {
    displayName: string;
    symbol: string;
    assetClass?: string;
    marketType?: string;
    baseCurrency?: string | null;
    quoteCurrency?: string | null;
  };
  price: {
    value: number | null;
    currency: string | null;
    displayValue?: number | null;
    displayCurrency?: string | null;
    confidence: ObservedDataConfidence;
  };
  timeframe: Timeframe | null;
  dataQuality: 'SUFFICIENT' | 'INSUFFICIENT' | 'WAITING_FOR_DATA';
  sourceEvidence: SourceEvidence;
}

export interface RawObservedMarketData {
  sourceId: string;
  sourceName: string;
  sourceApplicationName: string;
  sourceWindowTitle?: string;
  sourceWindowId?: string;
  instrumentSymbol: string;
  detectedSymbol?: string;
  detectedInstrumentName?: string;
  detectedCurrency?: string;
  baseCurrency?: string | null;
  quoteCurrency?: string | null;
  displayCurrency?: string;
  convertedPrice?: number | null;
  observedPrice: number | null;
  observedTimestamp: number | null;
  observedTimeframe: Timeframe;
  observedVolume: number | null;
  observedCandles: Candle[];
  priceConfidence: ObservedDataConfidence;
  candleConfidence: ObservedDataConfidence;
  volumeConfidence: ObservedDataConfidence;
  timeframeConfidence: ObservedDataConfidence;
  instrumentConfidence: ObservedDataConfidence;
  freshness: SourceFreshnessStatus;
  lastFrameTimestamp: number;
  visualFrameUrl?: string;
  rawLabelsDetected: string[];
  mismatchError?: string | null;
  sourceEvidence?: SourceEvidence;
}

export interface SourceValidationState {
  status: 'WAITING' | 'VALID' | 'INVALID';
  application: string;
  windowTitle: string;
  instrument: string;
  timeframe: Timeframe;
  observedPrice: number | null;
  observedCurrency?: string;
  baseCurrency?: string | null;
  quoteCurrency?: string | null;
  expectedPriceRange?: { min: number; max: number };
  observedTimestamp: number | null;
  freshness: SourceFreshnessStatus;
  captureStatus: 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'PERMISSION_DENIED';
  confidence: ObservedDataConfidence;
  details: string;
  hasUserConfirmed: boolean;
  detectedSymbol?: string;
  mismatchReason?: string | null;
  sourceEvidence?: SourceEvidence;
}

export interface MonitoringSourceConfig {
  id: string;
  instrumentSymbol: string;
  instrumentName: string;
  marketType: 'OTC' | 'SPOT' | 'FUTURES' | 'EQUITY' | 'INDEX' | 'CRYPTO';
  exchangeBroker: string;
  currency: string;
  displayCurrency?: string;
  sourceCategory: DataSourceCategory;
  applicationName: string;
  windowTitle: string;
  windowId?: string;
  timeframe: Timeframe;
  expectedPriceRange?: { min: number; max: number };
  isValidated: boolean;
  lastValidatedTimestamp?: number;
  sessionId?: string;
  validatedPrice?: number;
}

export type TradingStyle = 'SCALPING' | 'INTRADAY' | 'SWING' | 'POSITIONAL';

export type AnalysisMode = 'conservative' | 'balanced' | 'aggressive';

export type PlatformTarget = 'WINDOWS' | 'ANDROID' | 'WEB';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface InstrumentInfo {
  symbol: string;
  name: string;
  assetClass: 'INDICES' | 'COMMODITIES' | 'EQUITIES' | 'CRYPTO' | 'FOREX';
  currency: string;
  tickSize: number;
  currentPrice: number;
  changePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  dataSourceType: DataSourceType;
  dataSourceName: string;
}

export interface TechnicalIndicators {
  symbol: string;
  timeframe: Timeframe;
  timestamp: number;
  ema9: number;
  ema20: number;
  ema50: number;
  ema200: number;
  sma20: number;
  sma50: number;
  rsi: number;
  vwap: number;
  atr: number;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
  };
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
  };
  volumeMa20: number;
  volumeTrend: 'EXPANDING' | 'CONTRACTING' | 'NORMAL';
  pivotPoints: {
    pp: number;
    r1: number;
    r2: number;
    s1: number;
    s2: number;
  };
  fibonacciLevels: {
    fib236: number;
    fib382: number;
    fib500: number;
    fib618: number;
    fib786: number;
  };
}

export interface MarketStructureState {
  symbol: string;
  timeframe: Timeframe;
  timestamp: number;
  trend: TrendDirection;
  structure: 'HH_HL' | 'LH_LL' | 'CONSOLIDATION' | 'EXPANSION';
  recentSwingHigh: number;
  recentSwingLow: number;
  bos: boolean; // Break of Structure
  choch: boolean; // Change of Character
  breakout: boolean;
  breakdown: boolean;
  isFalseBreakout: boolean;
  keyResistance: number[];
  keySupport: number[];
  supplyZones: Array<{ high: number; low: number; tested: number }>;
  demandZones: Array<{ high: number; low: number; tested: number }>;
  momentumScore: number; // -100 to +100
  volatilityState: 'LOW' | 'NORMAL' | 'ELEVATED' | 'EXTREME';
}

export interface TimeframeSnapshot {
  timeframe: Timeframe;
  trend: TrendDirection;
  structure: string;
  lastClose: number;
  rsi: number;
  aboveVwap: boolean;
  isAligned: boolean;
}

export interface MultiTimeframeAnalysis {
  primaryTimeframe: Timeframe;
  secondaryTimeframes: Timeframe[];
  higherTimeframeTrend: TrendDirection;
  intermediateTrend: TrendDirection;
  lowerTimeframeTrend: TrendDirection;
  alignmentScore: number; // 0 to 100%
  alignmentSummary: string;
  snapshots: Record<Timeframe, TimeframeSnapshot>;
}

export interface RiskCalculation {
  accountCapital: number;
  riskPercentage: number;
  riskAmount: number;
  bias: SetupBias;
  entryZone: { min: number; max: number; suggested: number };
  stopLoss: number;
  target1: number;
  target2: number;
  invalidationPrice: number;
  riskRewardRatio: number;
  recommendedPositionUnits: number;
  totalExposure: number;
  disclaimer: string;
}

export interface AIReasoningOutput {
  setupState: SignalState;
  bias: SetupBias;
  confidenceScore: number;
  executiveSummary: string;
  bullCase: string[];
  bearCase: string[];
  missingConfirmation: string;
  invalidationCriteria: string;
  institutionalContext: string;
  actionableRecommendation: string;
  provider: string;
  timestamp: number;
}

export interface MarketEvent {
  id: string;
  symbol: string;
  timestamp: number;
  type:
    | 'BOS_DETECTED'
    | 'CHOCH_DETECTED'
    | 'BREAKOUT'
    | 'BREAKDOWN'
    | 'VOLUME_CONFIRMATION'
    | 'SETUP_FORMED'
    | 'SETUP_CONFIRMED'
    | 'SETUP_INVALIDATED'
    | 'DATA_DISCONNECTED'
    | 'DATA_RECONNECTED'
    | 'RISK_THRESHOLD_EXCEEDED'
    | 'AI_REASONING_UPDATE';
  title: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'SETUP';
  timeframe: Timeframe;
}

export interface InstrumentAnalysisState {
  symbol: string;
  instrumentInfo: InstrumentInfo;
  connectionStatus: ConnectionStatus;
  candles: Record<Timeframe, Candle[]>;
  currentCandle: Candle | null;
  indicators: TechnicalIndicators;
  marketStructure: MarketStructureState;
  mtfAnalysis: MultiTimeframeAnalysis;
  riskCalculation: RiskCalculation;
  signalState: SignalState;
  bias: SetupBias;
  lastAiReasoning: AIReasoningOutput | null;
  isAiReasoningPending: boolean;
  latestEvent: MarketEvent | null;
  lastUpdated: number;

  // New source-first architecture fields
  isDemo?: boolean;
  hasValidLiveData: boolean;
  dataSourceStatusMessage: string;
  rawObservedData?: RawObservedMarketData | null;
  sourceConfig?: MonitoringSourceConfig | null;
}

export interface MonitoringSessionConfig {
  id: string;
  name: string;
  mode: AppMonitoringMode;
  selectedInstruments: string[];
  monitoringSources?: Record<string, MonitoringSourceConfig>;
  tradingStyle: TradingStyle;
  primaryTimeframe: Timeframe;
  secondaryTimeframes: Timeframe[];
  analysisMode: AnalysisMode;
  accountSize: number;
  riskPerTradePercent: number;
  minRiskRewardRatio: number;
  maxSimultaneousSetups: number;
  preferredDataSource: DataSourceType;
  enableNewsAnalysis: boolean;
  enableVolumeAnalysis: boolean;
  enableMarketStructure: boolean;
  enableMultiTimeframe: boolean;
  alertsEnabled: boolean;
  alertSound: boolean;
  alertSensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
  sessionDurationMinutes: number;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  symbol: string;
  timeframe: Timeframe;
  event: string;
  dataSource: string;
  marketState: string;
  aiDecision: string;
  details: string;
}
