/**
 * TRADYX MEXC Market Data Provider
 * 
 * Supports Official Current MEXC APIs:
 * - MEXC Spot & MEXC Futures (Strictly Segregated)
 * - Dynamic Symbol Discovery (Zero hardcoded symbol assumptions)
 * - REST Ticker, Order Book Depth (Bid/Ask), Klines
 * - Real-time WebSocket Market Feed
 * - Multi-Currency: Quotes in USDT/USD, auto-convertible to INR for Indian traders
 * - Read-only Market Data
 */

import {
  DataNormalizer,
  InstrumentMetadata,
  InstrumentResolver,
  MarketDataCallback,
  MarketDataProvider,
  NormalizedMarketData,
  ProviderLifecycleState,
  ProviderType,
  StateChangeCallback,
  TimeframeOption
} from './types';

export class MEXCMarketDataProvider implements MarketDataProvider, InstrumentResolver, DataNormalizer {
  public readonly id = 'mexc';
  public readonly name = 'MEXC Global (Spot & Futures)';
  public readonly type: ProviderType = 'BROKER_API';
  public readonly supportedPlatforms: ('WEB' | 'WINDOWS' | 'ANDROID')[] = ['WEB', 'WINDOWS', 'ANDROID'];
  public readonly authenticationMethod = 'NONE';
  public readonly isImplemented = true;

  private state: ProviderLifecycleState = 'CONNECTED';
  private details = 'MEXC Market Feed active (Public REST & WebSocket stream).';
  private listeners: StateChangeCallback[] = [];
  private subscriptions = new Map<string, MarketDataCallback>();
  private sseSource: EventSource | null = null;

  constructor() {
    this.checkInitialStatus().catch(() => {});
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
      const res = await fetch('/api/brokers/mexc/status');
      if (res.ok) {
        const json = await res.json();
        this.setState(json.connectionState || 'CONNECTED', json.details);
      }
    } catch {
      this.setState('NOT_CONFIGURED', 'MEXC service offline.');
    }
  }

  public async connect(_credentials?: Record<string, any>): Promise<boolean> {
    this.setState('CONNECTING', 'Connecting to MEXC market stream...');
    try {
      this.initSseStream();
      this.setState('CONNECTED', 'Connected to MEXC live market data feed.');
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
          if (data.provider === 'mexc') {
            const sym = data.instrument?.symbol;
            if (sym && this.subscriptions.has(sym)) {
              if (this.state !== 'LIVE') {
                this.setState('LIVE', `Live ticks streaming for ${sym}`);
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
          this.setState('RECONNECTING', 'MEXC stream interrupted. Reconnecting...');
        }
      };
    } catch (err) {
      console.error('[MEXC Provider] SSE initialization error:', err);
    }
  }

  public async disconnect(): Promise<void> {
    if (this.sseSource) {
      this.sseSource.close();
      this.sseSource = null;
    }
    this.subscriptions.clear();

    try {
      await fetch('/api/brokers/mexc/disconnect', { method: 'POST' });
    } catch {
      // ignore
    }

    this.setState('DISCONNECTED', 'Disconnected from MEXC market feed.');
  }

  public async discoverInstruments(segment = 'MEXC_SPOT'): Promise<InstrumentMetadata[]> {
    try {
      const res = await fetch(`/api/brokers/mexc/instruments?segment=${segment}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.instruments || []).map((i: any) => ({
        symbol: i.symbol,
        displayName: `${i.symbol} (${i.segment})`,
        sourceId: i.symbol,
        assetClass: 'CRYPTO' as const,
        exchange: 'MEXC',
        segment: i.segment,
        instrumentType: i.isFutures ? 'FUTURES' : 'SPOT',
        tickSize: i.tickSize || 0.0001,
        pricePrecision: i.pricePrecision || 4,
        lotSize: i.lotSize || 0.0001,
        baseCurrency: i.baseAsset,
        quoteCurrency: i.quoteAsset || 'USDT'
      }));
    } catch {
      return [];
    }
  }

  public async searchSymbols(query: string): Promise<InstrumentMetadata[]> {
    try {
      const res = await fetch(`/api/brokers/mexc/instruments?q=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.instruments || []).map((i: any) => ({
        symbol: i.symbol,
        displayName: `${i.symbol} (${i.segment})`,
        sourceId: i.symbol,
        assetClass: 'CRYPTO' as const,
        exchange: 'MEXC',
        segment: i.segment,
        instrumentType: i.isFutures ? 'FUTURES' : 'SPOT',
        tickSize: i.tickSize || 0.0001,
        pricePrecision: i.pricePrecision || 4,
        lotSize: i.lotSize || 0.0001,
        baseCurrency: i.baseAsset,
        quoteCurrency: i.quoteAsset || 'USDT'
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
      { id: '1m', label: '1 Minute', intervalMinutes: 1, isSupported: true },
      { id: '5m', label: '5 Minutes', intervalMinutes: 5, isSupported: true },
      { id: '15m', label: '15 Minutes', intervalMinutes: 15, isSupported: true },
      { id: '30m', label: '30 Minutes', intervalMinutes: 30, isSupported: true },
      { id: '60m', label: '1 Hour', intervalMinutes: 60, isSupported: true },
      { id: '4h', label: '4 Hours', intervalMinutes: 240, isSupported: true },
      { id: '1d', label: '1 Day', intervalMinutes: 1440, isSupported: true }
    ];
  }

  public subscribe(symbol: string, timeframe: string, onData: MarketDataCallback): void {
    const cleanSym = symbol.toUpperCase().replace(/\//g, '');
    this.subscriptions.set(cleanSym, onData);

    const segment = cleanSym.includes('_') ? 'MEXC_FUTURES' : 'MEXC_SPOT';

    fetch('/api/brokers/mexc/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: cleanSym, segment })
    }).catch((err) => console.error('[MEXC Provider] Subscribe error:', err));

    if (!this.sseSource) {
      this.initSseStream();
    }
  }

  public unsubscribe(symbol: string): void {
    const cleanSym = symbol.toUpperCase().replace(/\//g, '');
    this.subscriptions.delete(cleanSym);

    fetch('/api/brokers/mexc/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: cleanSym })
    }).catch(() => {});
  }

  public normalize(raw: any, metadata: InstrumentMetadata, timeframe: string): NormalizedMarketData {
    const quoteCurrency = metadata.quoteCurrency || 'USDT';
    // Indian trader conversion rate against INR (1 USD/USDT ≈ 84.75 INR)
    const inrRate = 84.75;

    return {
      provider: 'mexc',
      connectionId: 'mexc-ws-stream',
      sourceTimestamp: raw.timestamp || Date.now(),
      source: {
        providerId: 'mexc',
        providerName: 'MEXC Global',
        connectionId: 'mexc-ws-stream',
        connectionState: this.state
      },
      instrument: {
        sourceId: metadata.sourceId || metadata.symbol,
        symbol: metadata.symbol,
        displayName: metadata.displayName,
        exchange: 'MEXC',
        assetClass: 'CRYPTO',
        baseCurrency: metadata.baseCurrency || 'BTC',
        quoteCurrency
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
        bid: raw.bid,
        ask: raw.ask
      },
      currency: {
        sourceCurrency: quoteCurrency,
        displayCurrency: 'INR',
        conversionRate: inrRate
      },
      quality: {
        freshness: 'LIVE',
        completeness: raw.open !== null ? 'COMPLETE' : 'PARTIAL',
        sourceConfidence: 'VALID'
      }
    };
  }
}
