/**
 * TRADYX Product-Grade Market Data Provider Interfaces
 * 
 * CORE PRINCIPLE:
 * Real Source -> Source Connector -> Raw Observed Market Data ->
 * Data Normalization -> Validation -> Deterministic Calculations ->
 * Market Structure -> Multi-Timeframe State -> Nemotron Reasoning -> User Analysis
 * 
 * Zero pretrained market assumptions. Zero hardcoded price expectations.
 */

export type ProviderLifecycleState =
  | 'DISCOVERING'
  | 'CONNECTING'
  | 'AUTHORIZING'
  | 'CONNECTED'
  | 'SYNCING'
  | 'LIVE'
  | 'DELAYED'
  | 'STALE'
  | 'RECONNECTING'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'UNSUPPORTED'
  | 'NOT_CONFIGURED'
  | 'NOT_IMPLEMENTED';

export type ProviderType =
  | 'BROWSER_CAPTURE'
  | 'WINDOWS_NATIVE_CAPTURE'
  | 'ANDROID_NATIVE_CAPTURE'
  | 'BROKER_API'
  | 'MARKET_DATA_FEED'
  | 'LOCAL_STREAM'
  | 'REMOTE_STREAM';

export type AssetClass =
  | 'INDICES'
  | 'COMMODITIES'
  | 'EQUITIES'
  | 'CRYPTO'
  | 'FOREX'
  | 'UNKNOWN';

export interface InstrumentMetadata {
  symbol: string;
  displayName: string;
  sourceId?: string; // Token, scrip code, or instrument_key
  assetClass: AssetClass;
  exchange?: string;
  segment?: string;
  instrumentType?: string;
  expiry?: string | null;
  strike?: number | null;
  market?: string;
  contract?: string;
  lotSize?: number;
  tickSize: number;
  pricePrecision: number;
  baseCurrency?: string | null;
  quoteCurrency?: string | null;
  tradingStatus?: 'TRADING' | 'HALTED' | 'CLOSED' | 'UNKNOWN';
  timezone?: string;
}

export interface TimeframeOption {
  id: string;
  label: string;
  intervalMinutes: number;
  isSupported: boolean;
}

export interface NormalizedMarketData {
  provider?: 'upstox' | 'angelone' | 'binance' | string;
  connectionId?: string;
  sourceTimestamp?: number;

  source: {
    providerId: string;
    providerName: string;
    connectionId: string;
    connectionState: ProviderLifecycleState;
  };

  instrument: {
    sourceId?: string;
    sourceSymbol?: string;
    symbol: string;
    displayName: string;
    exchange?: string;
    segment?: string;
    assetClass: string;
    instrumentType?: string;
    expiry?: string | null;
    strike?: number | null;
    market?: string;
    contract?: string;
    baseCurrency?: string | null;
    quoteCurrency?: string | null;
  };

  timeframe: {
    interval: string;
    sourceInterval?: string;
  };

  marketData: {
    timestamp: number;
    ltp: number | null;
    last: number | null;
    bid?: number | null;
    ask?: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
    openInterest?: number | null;
  };

  currency?: {
    sourceCurrency: string;
    displayCurrency: string;
    conversionRate?: number;
    conversionTimestamp?: number;
  };

  quality: {
    freshness: 'LIVE' | 'DELAYED' | 'STALE' | 'DISCONNECTED';
    completeness: 'COMPLETE' | 'PARTIAL' | 'MINIMAL' | 'INSUFFICIENT';
    sourceConfidence: 'VALID' | 'UNCERTAIN' | 'UNAVAILABLE';
    observationConfidence?: 'VALID' | 'UNCERTAIN' | 'UNAVAILABLE';
  };
}

export type MarketDataCallback = (data: NormalizedMarketData) => void;
export type StateChangeCallback = (state: ProviderLifecycleState, details?: string) => void;

/**
 * Base Market Data Provider contract
 */
export interface MarketDataProvider {
  readonly id: string;
  readonly name: string;
  readonly type: ProviderType;
  readonly supportedPlatforms: ('WEB' | 'WINDOWS' | 'ANDROID')[];
  readonly authenticationMethod: 'NONE' | 'USER_PERMISSION' | 'API_KEY' | 'OAUTH' | 'LOCAL_BRIDGE';
  readonly isImplemented: boolean;

  getState(): ProviderLifecycleState;
  getDetails(): string;
  isAvailableOnPlatform(): boolean;

  connect(credentials?: Record<string, any>): Promise<boolean>;
  disconnect(): Promise<void>;

  discoverInstruments?(): Promise<InstrumentMetadata[]>;
  discoverTimeframes?(symbol?: string): Promise<TimeframeOption[]>;

  subscribe(symbol: string, timeframe: string, onData: MarketDataCallback): void;
  unsubscribe(symbol: string, timeframe?: string): void;

  onStateChange(callback: StateChangeCallback): () => void;
}

/**
 * Chart Capture Provider (Visual Observation)
 */
export interface ChartCaptureProvider extends MarketDataProvider {
  getCanvas?(): HTMLCanvasElement | null;
  getCapturedWindowName?(): string | null;
  requestWindowCapture?(): Promise<boolean>;
}

/**
 * Broker Direct Provider
 */
export interface BrokerProvider extends MarketDataProvider {
  getBrokerId(): string;
  isConfigured(): boolean;
  validateCredentials?(credentials: Record<string, any>): Promise<boolean>;
}

/**
 * Streaming Ingest Provider (RTSP, OBS, WebRTC)
 */
export interface StreamingProvider extends MarketDataProvider {
  getStreamUrl(): string | null;
  setStreamUrl(url: string): void;
}

/**
 * Instrument Resolver
 */
export interface InstrumentResolver {
  resolveSymbol(rawSymbol: string): Promise<InstrumentMetadata | null>;
  searchSymbols(query: string): Promise<InstrumentMetadata[]>;
}

/**
 * Data Normalizer
 */
export interface DataNormalizer {
  normalize(raw: any, metadata: InstrumentMetadata, timeframe: string): NormalizedMarketData;
}

/**
 * Market Data Validator
 */
export interface MarketDataValidator {
  validate(data: NormalizedMarketData): {
    isValid: boolean;
    issues: string[];
  };
}
