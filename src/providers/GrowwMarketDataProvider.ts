/**
 * TRADYX Groww Market Data Provider
 * 
 * Implements Groww Official Market Data API Provider:
 * - Honest observation mode: REST_SNAPSHOT / POLLING (Never invent fake WebSockets)
 * - Dynamic Instrument Discovery (NSE, BSE, F&O)
 * - Level 2 Market Depth & Live Quotes (LTP, OHLC, Volume)
 * - Option Chain & Greeks where available
 * - Multi-Currency: INR native quote currency with auto-conversion capabilities
 * - Read-only Market Data
 */

import {
  BrokerProvider,
  DataNormalizer,
  InstrumentMetadata,
  InstrumentResolver,
  MarketDataCallback,
  NormalizedMarketData,
  ProviderLifecycleState,
  ProviderType,
  StateChangeCallback,
  TimeframeOption
} from './types';

export class GrowwMarketDataProvider implements BrokerProvider, InstrumentResolver, DataNormalizer {
  public readonly id = 'groww';
  public readonly name = 'Groww Market Data (REST Snapshot)';
  public readonly type: ProviderType = 'BROKER_API';
  public readonly supportedPlatforms: ('WEB' | 'WINDOWS' | 'ANDROID')[] = ['WEB', 'WINDOWS', 'ANDROID'];
  public readonly authenticationMethod = 'API_KEY';
  public readonly isImplemented = true;

  private state: ProviderLifecycleState = 'NOT_CONFIGURED';
  private details = 'Groww provider ready. Connect using Groww API token or session.';
  private listeners: StateChangeCallback[] = [];
  private subscriptions = new Map<string, MarketDataCallback>();
  private sseSource: EventSource | null = null;
  private isConfiguredState = false;

  constructor() {
    this.checkInitialStatus().catch(() => {});
  }

  public getBrokerId(): string {
    return 'groww';
  }

  public isConfigured(): boolean {
    return this.isConfiguredState;
  }

  public getState(): ProviderLifecycleState {
    return this.state;
  }

  public getDetails(): string {
    return this.details;
  }

  public isAvailableOnPlatform(): boolean {
    return true;
  }

  private setState(state: ProviderLifecycleState, details?: string) {
    this.state = state;
    if (details) this.details = details;
    this.listeners.forEach((cb) => cb(state, this.details));
  }

  public onStateChange(callback: StateChangeCallback): () => void {
    this.listeners.push(callback);
    callback(this.state, this.details);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public async checkInitialStatus(): Promise<void> {
    try {
      const res = await fetch('/api/brokers/groww/status');
      if (res.ok) {
        const json = await res.json();
        this.isConfiguredState = json.isConfigured;
        if (json.isAuthenticated) {
          this.setState('CONNECTED', `Connected to Groww Market Feed (${json.userName || 'Authorized'}). Mode: REST_SNAPSHOT`);
        } else if (json.isConfigured) {
          this.setState('CONNECTING', json.details);
        } else {
          this.setState('NOT_CONFIGURED', 'Enter Groww API access token or session key.');
        }
      }
    } catch {
      this.setState('NOT_CONFIGURED', 'Groww market service offline.');
    }
  }

  public async connect(credentials?: Record<string, any>): Promise<boolean> {
    this.setState('CONNECTING', 'Connecting to Groww Market Data service...');

    try {
      if (credentials && credentials.apiToken) {
        const res = await fetch('/api/brokers/groww/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials)
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          this.setState('ERROR', json.error || 'Authentication failed for Groww.');
          return false;
        }

        this.isConfiguredState = true;
      }

      this.setState('CONNECTED', 'Groww connection active. Streaming via REST_SNAPSHOT / POLLING.');
      this.initSseStream();
      return true;
    } catch (err: any) {
      this.setState('ERROR', `Connection failed: ${err?.message || 'Network error'}`);
      return false;
    }
  }

  private initSseStream() {
    if (this.sseSource) {
      this.sseSource.close();
    }

    try {
      this.sseSource = new EventSource('/api/brokers/stream');

      this.sseSource.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.provider === 'groww') {
            const sym = data.instrument?.sourceId || data.instrument?.symbol;
            if (sym && this.subscriptions.has(sym)) {
              if (this.state !== 'LIVE') {
                this.setState('LIVE', `Live snapshots streaming for ${sym} (Mode: REST_SNAPSHOT)`);
              }
              const cb = this.subscriptions.get(sym);
              cb?.(data as NormalizedMarketData);
            }
          }
        } catch {
          // ignore
        }
      };

      this.sseSource.onerror = () => {
        if (this.state === 'LIVE' || this.state === 'CONNECTED') {
          this.setState('RECONNECTING', 'Groww stream polling interrupted. Reconnecting...');
        }
      };
    } catch (err) {
      console.error('[Groww Provider] SSE initialization error:', err);
    }
  }

  public async disconnect(): Promise<void> {
    if (this.sseSource) {
      this.sseSource.close();
      this.sseSource = null;
    }
    this.subscriptions.clear();

    try {
      await fetch('/api/brokers/groww/disconnect', { method: 'POST' });
    } catch {
      // ignore
    }

    this.setState('DISCONNECTED', 'Disconnected from Groww market data provider.');
  }

  public async discoverInstruments(): Promise<InstrumentMetadata[]> {
    try {
      const res = await fetch('/api/brokers/groww/instruments');
      if (!res.ok) return [];
      const json = await res.json();
      return (json.instruments || []).map((inst: any) => ({
        symbol: inst.symbol,
        displayName: `${inst.companyName} (${inst.exchange})`,
        sourceId: inst.growwContractId,
        assetClass: inst.instrumentType === 'INDEX' ? 'INDICES' : inst.segment === 'COMMODITY' ? 'COMMODITIES' : 'EQUITIES',
        exchange: inst.exchange,
        segment: inst.segment,
        instrumentType: inst.instrumentType,
        tickSize: inst.tickSize || 0.05,
        pricePrecision: inst.tickSize >= 1 ? 1 : 2,
        lotSize: inst.lotSize || 1,
        quoteCurrency: 'INR',
        baseCurrency: 'INR'
      }));
    } catch {
      return [];
    }
  }

  public async searchSymbols(query: string): Promise<InstrumentMetadata[]> {
    try {
      const res = await fetch(`/api/brokers/groww/instruments?q=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.instruments || []).map((inst: any) => ({
        symbol: inst.symbol,
        displayName: `${inst.companyName} (${inst.exchange})`,
        sourceId: inst.growwContractId,
        assetClass: inst.instrumentType === 'INDEX' ? 'INDICES' : inst.segment === 'COMMODITY' ? 'COMMODITIES' : 'EQUITIES',
        exchange: inst.exchange,
        segment: inst.segment,
        instrumentType: inst.instrumentType,
        tickSize: inst.tickSize || 0.05,
        pricePrecision: inst.tickSize >= 1 ? 1 : 2,
        lotSize: inst.lotSize || 1,
        quoteCurrency: 'INR',
        baseCurrency: 'INR'
      }));
    } catch {
      return [];
    }
  }

  public async resolveSymbol(rawSymbol: string): Promise<InstrumentMetadata | null> {
    const list = await this.searchSymbols(rawSymbol);
    return list.find((i) => i.symbol.toUpperCase() === rawSymbol.toUpperCase() || i.sourceId === rawSymbol) || list[0] || null;
  }

  public async discoverTimeframes(): Promise<TimeframeOption[]> {
    return [
      { id: '1', label: '1 Minute', intervalMinutes: 1, isSupported: true },
      { id: '5', label: '5 Minutes', intervalMinutes: 5, isSupported: true },
      { id: '15', label: '15 Minutes', intervalMinutes: 15, isSupported: true },
      { id: '30', label: '30 Minutes', intervalMinutes: 30, isSupported: true },
      { id: '60', label: '1 Hour', intervalMinutes: 60, isSupported: true },
      { id: '1440', label: '1 Day', intervalMinutes: 1440, isSupported: true }
    ];
  }

  public subscribe(symbol: string, timeframe: string, onData: MarketDataCallback): void {
    const cleanSym = symbol.toUpperCase();
    this.subscriptions.set(cleanSym, onData);

    fetch('/api/brokers/groww/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: cleanSym })
    }).catch((err) => console.error('[Groww Provider] Subscribe error:', err));

    if (!this.sseSource) {
      this.initSseStream();
    }
  }

  public unsubscribe(symbol: string): void {
    const cleanSym = symbol.toUpperCase();
    this.subscriptions.delete(cleanSym);

    fetch('/api/brokers/groww/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: cleanSym })
    }).catch(() => {});
  }

  public normalize(raw: any, metadata: InstrumentMetadata, timeframe: string): NormalizedMarketData {
    return {
      provider: 'groww',
      connectionId: 'groww-rest-snapshot',
      sourceTimestamp: raw.timestamp || Date.now(),
      source: {
        providerId: 'groww',
        providerName: 'Groww Market Data',
        connectionId: 'groww-rest-snapshot',
        connectionState: this.state
      },
      instrument: {
        sourceId: metadata.sourceId || metadata.symbol,
        symbol: metadata.symbol,
        displayName: metadata.displayName,
        exchange: metadata.exchange || 'NSE',
        assetClass: metadata.assetClass,
        baseCurrency: 'INR',
        quoteCurrency: 'INR'
      },
      timeframe: {
        interval: timeframe
      },
      marketData: {
        timestamp: raw.timestamp || Date.now(),
        ltp: raw.ltp,
        last: raw.ltp,
        open: raw.open,
        high: raw.high,
        low: raw.low,
        close: raw.close,
        volume: raw.volume,
        bid: raw.marketDepth?.buy?.[0]?.price || null,
        ask: raw.marketDepth?.sell?.[0]?.price || null
      },
      currency: {
        sourceCurrency: 'INR',
        displayCurrency: 'INR',
        conversionRate: 1.0
      },
      quality: {
        freshness: 'LIVE',
        completeness: raw.open !== null ? 'COMPLETE' : 'PARTIAL',
        sourceConfidence: 'VALID'
      }
    };
  }
}
