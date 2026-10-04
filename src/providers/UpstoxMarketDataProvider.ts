/**
 * TRADYX Upstox Market Data Provider (V3 API)
 * 
 * Direct Upstox Developer API V3 Market Data Feed provider.
 * Supports:
 * - Current V3 WebSocket Protobuf stream
 * - OAuth & Bearer Token Authentication
 * - True Exchange Instrument Discovery (NSE, BSE, MCX)
 * - Intraday / Historical Candle API
 * - Read-only Market Data
 */

import {
  BrokerProvider,
  InstrumentMetadata,
  InstrumentResolver,
  MarketDataCallback,
  NormalizedMarketData,
  ProviderLifecycleState,
  ProviderType,
  StateChangeCallback,
  TimeframeOption
} from './types';

export class UpstoxMarketDataProvider implements BrokerProvider, InstrumentResolver {
  public readonly id = 'upstox';
  public readonly name = 'Upstox Market Data Feed (V3)';
  public readonly type: ProviderType = 'BROKER_API';
  public readonly supportedPlatforms: ('WEB' | 'WINDOWS' | 'ANDROID')[] = ['WEB', 'WINDOWS', 'ANDROID'];
  public readonly authenticationMethod = 'OAUTH';
  public readonly isImplemented = true;

  private state: ProviderLifecycleState = 'NOT_CONFIGURED';
  private details = 'Upstox V3 API requires an access token or OAuth authorization code.';
  private listeners: StateChangeCallback[] = [];
  private subscriptions = new Map<string, MarketDataCallback>();
  private sseSource: EventSource | null = null;
  private isConfiguredState = false;

  constructor() {
    this.checkInitialStatus().catch(() => {});
  }

  public getBrokerId(): string {
    return 'upstox';
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
      const res = await fetch('/api/brokers/upstox/status');
      if (res.ok) {
        const json = await res.json();
        this.isConfiguredState = json.isConfigured;
        if (json.isAuthenticated) {
          this.setState('CONNECTED', `Authenticated with Upstox (${json.userName || 'Verified'}).`);
        } else if (json.isConfigured) {
          this.setState('CONNECTING', json.details);
        } else {
          this.setState('NOT_CONFIGURED', 'Enter Upstox Access Token or Client ID/Secret.');
        }
      }
    } catch {
      this.setState('NOT_CONFIGURED', 'Upstox market service offline.');
    }
  }

  public async connect(credentials?: Record<string, any>): Promise<boolean> {
    this.setState('AUTHORIZING', 'Authenticating with Upstox V3 API...');

    try {
      if (credentials) {
        const res = await fetch('/api/brokers/upstox/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials)
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          this.setState('ERROR', json.error || 'Authentication failed. Please verify Upstox token.');
          return false;
        }

        this.isConfiguredState = true;
      }

      // Connect to the V3 Market Data Feed WebSocket
      this.setState('CONNECTING', 'Connecting to Upstox V3 Market Data Feed WebSocket...');
      const streamRes = await fetch('/api/brokers/upstox/connect-stream', { method: 'POST' });
      const streamJson = await streamRes.json();

      if (!streamRes.ok || !streamJson.success) {
        this.setState('ERROR', streamJson.details || 'Failed to connect to Upstox V3 feed WebSocket.');
        return false;
      }

      this.setState('CONNECTED', 'Upstox V3 Feed connected. Subscribing to instruments...');
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
          if (data.provider === 'upstox') {
            const sym = data.instrument?.sourceId || data.instrument?.symbol;
            if (sym && this.subscriptions.has(sym)) {
              if (this.state !== 'LIVE') {
                this.setState('LIVE', `Live Upstox ticks streaming for ${sym}`);
              }
              const cb = this.subscriptions.get(sym);
              cb?.(data as NormalizedMarketData);
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      this.sseSource.onerror = () => {
        if (this.state === 'LIVE' || this.state === 'CONNECTED') {
          this.setState('RECONNECTING', 'Market stream interrupted. Reconnecting...');
        }
      };
    } catch (err) {
      console.error('[Upstox Provider] SSE initialization error:', err);
    }
  }

  public async disconnect(): Promise<void> {
    if (this.sseSource) {
      this.sseSource.close();
      this.sseSource = null;
    }
    this.subscriptions.clear();

    try {
      await fetch('/api/brokers/upstox/disconnect', { method: 'POST' });
    } catch {
      // ignore
    }

    this.setState('DISCONNECTED', 'Disconnected from Upstox market feed.');
  }

  public async discoverInstruments(): Promise<InstrumentMetadata[]> {
    try {
      const res = await fetch('/api/brokers/upstox/instruments');
      if (!res.ok) return [];
      const json = await res.json();
      return (json.instruments || []).map((inst: any) => ({
        symbol: inst.tradingSymbol,
        displayName: `${inst.name} (${inst.exchange})`,
        sourceId: inst.instrumentKey,
        assetClass: inst.instrumentType === 'INDEX' ? 'INDICES' : inst.segment === 'MCX_COMM' ? 'COMMODITIES' : 'EQUITIES',
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
      const res = await fetch(`/api/brokers/upstox/instruments?q=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.instruments || []).map((inst: any) => ({
        symbol: inst.tradingSymbol,
        displayName: `${inst.name} (${inst.exchange})`,
        sourceId: inst.instrumentKey,
        assetClass: inst.instrumentType === 'INDEX' ? 'INDICES' : inst.segment === 'MCX_COMM' ? 'COMMODITIES' : 'EQUITIES',
        exchange: inst.exchange,
        segment: inst.segment,
        instrumentType: inst.instrumentType,
        tickSize: inst.tickSize || 0.05,
        pricePrecision: inst.tickSize >= 1 ? 1 : 2,
        lotSize: inst.lotSize || 1,
        quoteCurrency: 'INR'
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
      { id: '1minute', label: '1 Minute', intervalMinutes: 1, isSupported: true },
      { id: '30minute', label: '30 Minutes', intervalMinutes: 30, isSupported: true },
      { id: 'day', label: '1 Day', intervalMinutes: 1440, isSupported: true },
      { id: 'week', label: '1 Week', intervalMinutes: 10080, isSupported: true },
      { id: 'month', label: '1 Month', intervalMinutes: 43200, isSupported: true }
    ];
  }

  public subscribe(symbol: string, timeframe: string, onData: MarketDataCallback): void {
    const instrumentKey = symbol.includes('|') ? symbol : `NSE_INDEX|${symbol}`;
    this.subscriptions.set(instrumentKey, onData);
    this.subscriptions.set(symbol, onData);

    fetch('/api/brokers/upstox/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instrumentKey })
    }).catch((err) => console.error('[Upstox Provider] Subscribe error:', err));

    if (!this.sseSource) {
      this.initSseStream();
    }
  }

  public unsubscribe(symbol: string): void {
    const instrumentKey = symbol.includes('|') ? symbol : `NSE_INDEX|${symbol}`;
    this.subscriptions.delete(instrumentKey);
    this.subscriptions.delete(symbol);

    fetch('/api/brokers/upstox/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instrumentKey })
    }).catch(() => {});
  }
}
