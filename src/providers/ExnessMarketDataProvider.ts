/**
 * TRADYX Exness / MT5 Forex Market Data Provider
 * 
 * Provider Adapter Architecture:
 * Connects to Exness / MetaTrader 5 Bridge Connector for true multi-asset Forex feeds.
 * Supports:
 * - Dynamic Discovery: Forex Majors/Crosses, Spot Metals (XAU/USD, XAG/USD), Indices, Commodities, Crypto
 * - Spread, Bid, Ask, LTP, OHLC
 * - Multi-Currency: Native quotes in USD/EUR with live INR conversion for Indian traders
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

export class ExnessMarketDataProvider implements BrokerProvider, InstrumentResolver, DataNormalizer {
  public readonly id = 'exness';
  public readonly name = 'Exness / MT5 Forex & Metals';
  public readonly type: ProviderType = 'BROKER_API';
  public readonly supportedPlatforms: ('WEB' | 'WINDOWS' | 'ANDROID')[] = ['WEB', 'WINDOWS', 'ANDROID'];
  public readonly authenticationMethod = 'LOCAL_BRIDGE';
  public readonly isImplemented = true;

  private state: ProviderLifecycleState = 'NOT_CONFIGURED';
  private details = 'Exness / MT5 bridge ready. Connect to local bridge or broker gateway.';
  private listeners: StateChangeCallback[] = [];
  private subscriptions = new Map<string, MarketDataCallback>();
  private sseSource: EventSource | null = null;
  private isConfiguredState = false;

  constructor() {
    this.checkInitialStatus().catch(() => {});
  }

  public getBrokerId(): string {
    return 'exness';
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
      const res = await fetch('/api/brokers/exness/status');
      if (res.ok) {
        const json = await res.json();
        this.isConfiguredState = json.isConfigured;
        if (json.isAuthenticated) {
          this.setState('CONNECTED', `Connected to Exness / MT5 Bridge (${json.accountLogin || 'Live'}).`);
        } else if (json.isConfigured) {
          this.setState('CONNECTING', json.details);
        } else {
          this.setState('NOT_CONFIGURED', 'Enter Exness / MT5 Bridge Endpoint.');
        }
      }
    } catch {
      this.setState('NOT_CONFIGURED', 'Exness / MT5 service offline.');
    }
  }

  public async connect(credentials?: Record<string, any>): Promise<boolean> {
    this.setState('CONNECTING', 'Connecting to Exness / MT5 Bridge...');

    try {
      if (credentials) {
        const res = await fetch('/api/brokers/exness/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials)
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          this.setState('ERROR', json.error || 'Failed to connect to Exness / MT5 Bridge.');
          return false;
        }

        this.isConfiguredState = true;
      }

      this.setState('CONNECTED', 'Exness / MT5 Bridge connected.');
      this.initSseStream();
      return true;
    } catch (err: any) {
      this.setState('ERROR', `Connection failed: ${err?.message || 'Error'}`);
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
          if (data.provider === 'exness') {
            const sym = data.instrument?.symbol;
            if (sym && this.subscriptions.has(sym)) {
              if (this.state !== 'LIVE') {
                this.setState('LIVE', `Live Exness ticks streaming for ${sym}`);
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
          this.setState('RECONNECTING', 'Exness stream interrupted. Reconnecting...');
        }
      };
    } catch (err) {
      console.error('[Exness Provider] SSE initialization error:', err);
    }
  }

  public async disconnect(): Promise<void> {
    if (this.sseSource) {
      this.sseSource.close();
      this.sseSource = null;
    }
    this.subscriptions.clear();

    try {
      await fetch('/api/brokers/exness/disconnect', { method: 'POST' });
    } catch {
      // ignore
    }

    this.setState('DISCONNECTED', 'Disconnected from Exness / MT5 bridge.');
  }

  public async discoverInstruments(category?: string): Promise<InstrumentMetadata[]> {
    try {
      const url = category ? `/api/brokers/exness/instruments?category=${category}` : '/api/brokers/exness/instruments';
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.instruments || []).map((i: any) => ({
        symbol: i.symbol,
        displayName: `${i.symbol} (${i.description})`,
        sourceId: i.symbol,
        assetClass: i.category as any,
        exchange: 'EXNESS',
        segment: i.category,
        instrumentType: i.category,
        tickSize: i.point || 0.0001,
        pricePrecision: i.digits || 4,
        lotSize: i.lotSize || 100000,
        baseCurrency: i.baseCurrency,
        quoteCurrency: i.quoteCurrency
      }));
    } catch {
      return [];
    }
  }

  public async searchSymbols(query: string): Promise<InstrumentMetadata[]> {
    try {
      const res = await fetch(`/api/brokers/exness/instruments?q=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.instruments || []).map((i: any) => ({
        symbol: i.symbol,
        displayName: `${i.symbol} (${i.description})`,
        sourceId: i.symbol,
        assetClass: i.category as any,
        exchange: 'EXNESS',
        segment: i.category,
        instrumentType: i.category,
        tickSize: i.point || 0.0001,
        pricePrecision: i.digits || 4,
        lotSize: i.lotSize || 100000,
        baseCurrency: i.baseCurrency,
        quoteCurrency: i.quoteCurrency
      }));
    } catch {
      return [];
    }
  }

  public async resolveSymbol(rawSymbol: string): Promise<InstrumentMetadata | null> {
    const list = await this.searchSymbols(rawSymbol);
    return list.find((i) => i.symbol.toUpperCase() === rawSymbol.toUpperCase()) || list[0] || null;
  }

  public async discoverTimeframes(): Promise<TimeframeOption[]> {
    return [
      { id: '1M', label: '1 Minute (M1)', intervalMinutes: 1, isSupported: true },
      { id: '5M', label: '5 Minutes (M5)', intervalMinutes: 5, isSupported: true },
      { id: '15M', label: '15 Minutes (M15)', intervalMinutes: 15, isSupported: true },
      { id: '30M', label: '30 Minutes (M30)', intervalMinutes: 30, isSupported: true },
      { id: '1H', label: '1 Hour (H1)', intervalMinutes: 60, isSupported: true },
      { id: '4H', label: '4 Hours (H4)', intervalMinutes: 240, isSupported: true },
      { id: '1D', label: '1 Day (D1)', intervalMinutes: 1440, isSupported: true }
    ];
  }

  public subscribe(symbol: string, timeframe: string, onData: MarketDataCallback): void {
    const cleanSym = symbol.toUpperCase().replace(/\//g, '');
    this.subscriptions.set(cleanSym, onData);

    fetch('/api/brokers/exness/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: cleanSym })
    }).catch((err) => console.error('[Exness Provider] Subscribe error:', err));

    if (!this.sseSource) {
      this.initSseStream();
    }
  }

  public unsubscribe(symbol: string): void {
    const cleanSym = symbol.toUpperCase().replace(/\//g, '');
    this.subscriptions.delete(cleanSym);

    fetch('/api/brokers/exness/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: cleanSym })
    }).catch(() => {});
  }

  public normalize(raw: any, metadata: InstrumentMetadata, timeframe: string): NormalizedMarketData {
    const quoteCurrency = metadata.quoteCurrency || 'USD';
    const inrRate = 84.75; // Indicative INR conversion rate for USD pairs

    return {
      provider: 'exness',
      connectionId: 'exness-mt5-bridge',
      sourceTimestamp: raw.timestamp || Date.now(),
      source: {
        providerId: 'exness',
        providerName: 'Exness / MT5 Forex',
        connectionId: 'exness-mt5-bridge',
        connectionState: this.state
      },
      instrument: {
        sourceId: metadata.sourceId || metadata.symbol,
        symbol: metadata.symbol,
        displayName: metadata.displayName,
        exchange: 'EXNESS',
        assetClass: metadata.assetClass,
        baseCurrency: metadata.baseCurrency || 'EUR',
        quoteCurrency
      },
      timeframe: {
        interval: timeframe
      },
      marketData: {
        timestamp: raw.timestamp || Date.now(),
        ltp: raw.ltp,
        last: raw.ltp,
        bid: raw.bid,
        ask: raw.ask,
        open: raw.open,
        high: raw.high,
        low: raw.low,
        close: raw.close,
        volume: raw.volume
      },
      currency: {
        sourceCurrency: quoteCurrency,
        displayCurrency: 'INR',
        conversionRate: inrRate
      },
      quality: {
        freshness: 'LIVE',
        completeness: raw.bid !== null ? 'COMPLETE' : 'PARTIAL',
        sourceConfidence: 'VALID'
      }
    };
  }
}
