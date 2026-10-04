/**
 * TRADYX Angel One SmartAPI Market Data Provider
 * 
 * Direct Angel One SmartAPI provider.
 * Supports:
 * - SmartAPI Login (TOTP + MPIN/Password + API Key)
 * - SmartStream WebSocket binary streaming
 * - Dynamic Instrument Discovery (NSE, BSE, MCX)
 * - Historical Candle API
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

export class AngelOneMarketDataProvider implements BrokerProvider, InstrumentResolver {
  public readonly id = 'angelone';
  public readonly name = 'Angel One SmartAPI';
  public readonly type: ProviderType = 'BROKER_API';
  public readonly supportedPlatforms: ('WEB' | 'WINDOWS' | 'ANDROID')[] = ['WEB', 'WINDOWS', 'ANDROID'];
  public readonly authenticationMethod = 'API_KEY';
  public readonly isImplemented = true;

  private state: ProviderLifecycleState = 'NOT_CONFIGURED';
  private details = 'Angel One SmartAPI requires API Key, Client Code, and TOTP session.';
  private listeners: StateChangeCallback[] = [];
  private subscriptions = new Map<string, MarketDataCallback>();
  private sseSource: EventSource | null = null;
  private isConfiguredState = false;

  constructor() {
    this.checkInitialStatus().catch(() => {});
  }

  public getBrokerId(): string {
    return 'angelone';
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
      const res = await fetch('/api/brokers/angelone/status');
      if (res.ok) {
        const json = await res.json();
        this.isConfiguredState = json.isConfigured;
        if (json.isAuthenticated) {
          this.setState('CONNECTED', `Authenticated with SmartAPI (${json.clientCode || 'Active'}).`);
        } else if (json.isConfigured) {
          this.setState('CONNECTING', json.details);
        } else {
          this.setState('NOT_CONFIGURED', 'Enter Angel One API Key, Client Code, and TOTP.');
        }
      }
    } catch {
      this.setState('NOT_CONFIGURED', 'Angel One service offline.');
    }
  }

  public async connect(credentials?: Record<string, any>): Promise<boolean> {
    this.setState('AUTHORIZING', 'Authenticating with Angel One SmartAPI...');

    try {
      if (credentials) {
        const res = await fetch('/api/brokers/angelone/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials)
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          this.setState('ERROR', json.error || 'SmartAPI authentication failed.');
          return false;
        }

        this.isConfiguredState = true;
      }

      // Connect to the SmartStream WebSocket
      this.setState('CONNECTING', 'Connecting to Angel One SmartStream WebSocket...');
      const streamRes = await fetch('/api/brokers/angelone/connect-stream', { method: 'POST' });
      const streamJson = await streamRes.json();

      if (!streamRes.ok || !streamJson.success) {
        this.setState('ERROR', streamJson.details || 'Failed to connect to SmartStream.');
        return false;
      }

      this.setState('CONNECTED', 'SmartStream connected. Subscribing to instruments...');
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
          if (data.provider === 'angelone') {
            const token = data.instrument?.sourceId;
            const sym = data.instrument?.symbol;
            const key = token || sym;

            if (key && (this.subscriptions.has(key) || (sym && this.subscriptions.has(sym)) || (token && this.subscriptions.has(token)))) {
              if (this.state !== 'LIVE') {
                this.setState('LIVE', `Live SmartAPI ticks streaming for ${sym || token}`);
              }
              const cb = this.subscriptions.get(key) || (sym ? this.subscriptions.get(sym) : null) || (token ? this.subscriptions.get(token) : null);
              cb?.(data as NormalizedMarketData);
            }
          }
        } catch {
          // ignore
        }
      };

      this.sseSource.onerror = () => {
        if (this.state === 'LIVE' || this.state === 'CONNECTED') {
          this.setState('RECONNECTING', 'SmartStream interrupted. Reconnecting...');
        }
      };
    } catch (err) {
      console.error('[Angel One Provider] SSE initialization error:', err);
    }
  }

  public async disconnect(): Promise<void> {
    if (this.sseSource) {
      this.sseSource.close();
      this.sseSource = null;
    }
    this.subscriptions.clear();

    try {
      await fetch('/api/brokers/angelone/disconnect', { method: 'POST' });
    } catch {
      // ignore
    }

    this.setState('DISCONNECTED', 'Disconnected from Angel One SmartStream.');
  }

  public async discoverInstruments(): Promise<InstrumentMetadata[]> {
    try {
      const res = await fetch('/api/brokers/angelone/instruments');
      if (!res.ok) return [];
      const json = await res.json();
      return (json.instruments || []).map((inst: any) => ({
        symbol: inst.symbol,
        displayName: `${inst.name} (${inst.exchange})`,
        sourceId: inst.token,
        assetClass: inst.instrumentType === 'INDEX' ? 'INDICES' : inst.exchange === 'MCX' ? 'COMMODITIES' : 'EQUITIES',
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
      const res = await fetch(`/api/brokers/angelone/instruments?q=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.instruments || []).map((inst: any) => ({
        symbol: inst.symbol,
        displayName: `${inst.name} (${inst.exchange})`,
        sourceId: inst.token,
        assetClass: inst.instrumentType === 'INDEX' ? 'INDICES' : inst.exchange === 'MCX' ? 'COMMODITIES' : 'EQUITIES',
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
      { id: 'ONE_MINUTE', label: '1 Minute', intervalMinutes: 1, isSupported: true },
      { id: 'FIVE_MINUTE', label: '5 Minutes', intervalMinutes: 5, isSupported: true },
      { id: 'FIFTEEN_MINUTE', label: '15 Minutes', intervalMinutes: 15, isSupported: true },
      { id: 'ONE_HOUR', label: '1 Hour', intervalMinutes: 60, isSupported: true },
      { id: 'ONE_DAY', label: '1 Day', intervalMinutes: 1440, isSupported: true }
    ];
  }

  public subscribe(symbol: string, timeframe: string, onData: MarketDataCallback): void {
    this.subscriptions.set(symbol, onData);

    // Resolve token or pass as token
    const token = symbol === 'NIFTY 50' || symbol === 'Nifty 50' ? '26000' :
                  symbol === 'BANKNIFTY' || symbol === 'Nifty Bank' ? '26009' :
                  symbol === 'FINNIFTY' ? '26037' :
                  symbol === 'RELIANCE' ? '2885' :
                  symbol === 'TCS' ? '11536' :
                  symbol === 'HDFCBANK' ? '1333' :
                  symbol === 'GOLD' ? '254425' : symbol;

    this.subscriptions.set(token, onData);

    fetch('/api/brokers/angelone/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        exchangeType: token === '254425' || token === '254426' ? 5 : 1,
        symbol
      })
    }).catch((err) => console.error('[Angel One Provider] Subscribe error:', err));

    if (!this.sseSource) {
      this.initSseStream();
    }
  }

  public unsubscribe(symbol: string): void {
    this.subscriptions.delete(symbol);

    const token = symbol === 'NIFTY 50' || symbol === 'Nifty 50' ? '26000' :
                  symbol === 'BANKNIFTY' || symbol === 'Nifty Bank' ? '26009' :
                  symbol === 'FINNIFTY' ? '26037' :
                  symbol === 'RELIANCE' ? '2885' :
                  symbol === 'TCS' ? '11536' :
                  symbol === 'HDFCBANK' ? '1333' :
                  symbol === 'GOLD' ? '254425' : symbol;

    this.subscriptions.delete(token);

    fetch('/api/brokers/angelone/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    }).catch(() => {});
  }
}
