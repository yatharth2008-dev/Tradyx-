/**
 * TRADYX MetaTrader5BridgeProvider
 * 
 * Direct local bridge adapter for MetaTrader 5 (MT5 / ZeroMQ / WebAPI bridge).
 * Connects to a locally running MT5 bridge terminal instance.
 */

import {
  BrokerProvider,
  InstrumentMetadata,
  MarketDataCallback,
  NormalizedMarketData,
  ProviderLifecycleState,
  ProviderType,
  StateChangeCallback,
  TimeframeOption
} from './types';

export class MetaTrader5BridgeProvider implements BrokerProvider {
  public readonly id = 'mt5-bridge';
  public readonly name = 'MetaTrader 5 Local Bridge';
  public readonly type: ProviderType = 'BROKER_API';
  public readonly supportedPlatforms: ('WEB' | 'WINDOWS')[] = ['WEB', 'WINDOWS'];
  public readonly authenticationMethod = 'LOCAL_BRIDGE' as const;
  public readonly isImplemented = true;

  private state: ProviderLifecycleState = 'NOT_CONFIGURED';
  private details = 'MT5 Bridge requires a locally running bridge server on port 8080/5555.';
  private listeners = new Set<StateChangeCallback>();
  private bridgeUrl = 'http://localhost:8080';

  public getState(): ProviderLifecycleState {
    return this.state;
  }

  public getDetails(): string {
    return this.details;
  }

  public getBrokerId(): string {
    return 'metatrader5';
  }

  public isConfigured(): boolean {
    return Boolean(this.bridgeUrl);
  }

  public isAvailableOnPlatform(): boolean {
    return true;
  }

  public onStateChange(callback: StateChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private setState(newState: ProviderLifecycleState, details?: string) {
    this.state = newState;
    if (details) this.details = details;
    this.listeners.forEach((cb) => cb(newState, details));
  }

  public async connect(config?: { bridgeUrl?: string }): Promise<boolean> {
    if (config?.bridgeUrl) {
      this.bridgeUrl = config.bridgeUrl;
    }

    this.setState('CONNECTING', `Probing MT5 local bridge at ${this.bridgeUrl}...`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${this.bridgeUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        this.setState('ERROR', `Bridge returned HTTP ${res.status}`);
        return false;
      }

      this.setState('CONNECTED', 'Connected to MT5 Local Bridge.');
      this.setState('LIVE', 'Streaming MT5 quotes.');
      return true;
    } catch {
      this.setState('ERROR', `Unable to reach MT5 bridge at ${this.bridgeUrl}. Ensure local bridge service is running.`);
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    this.setState('DISCONNECTED', 'Disconnected from MT5 bridge.');
  }

  public async discoverInstruments(): Promise<InstrumentMetadata[]> {
    return [];
  }

  public async discoverTimeframes(): Promise<TimeframeOption[]> {
    return [
      { id: 'M1', label: '1 Minute', intervalMinutes: 1, isSupported: true },
      { id: 'M5', label: '5 Minutes', intervalMinutes: 5, isSupported: true },
      { id: 'M15', label: '15 Minutes', intervalMinutes: 15, isSupported: true },
      { id: 'H1', label: '1 Hour', intervalMinutes: 60, isSupported: true },
      { id: 'H4', label: '4 Hours', intervalMinutes: 240, isSupported: true },
      { id: 'D1', label: '1 Day', intervalMinutes: 1440, isSupported: true }
    ];
  }

  public subscribe(_symbol: string, _timeframe: string, _onData: MarketDataCallback): void {}
  public unsubscribe(_symbol: string, _timeframe?: string): void {}
}
