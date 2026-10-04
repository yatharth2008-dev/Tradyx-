/**
 * TRADYX WindowsNativeCaptureProvider
 * 
 * Native Windows desktop capture using Windows.Graphics.Capture API.
 * In a web browser environment, this provider is explicitly NOT_IMPLEMENTED.
 */

import {
  ChartCaptureProvider,
  InstrumentMetadata,
  MarketDataCallback,
  NormalizedMarketData,
  ProviderLifecycleState,
  ProviderType,
  StateChangeCallback,
  TimeframeOption
} from './types';

export class WindowsNativeCaptureProvider implements ChartCaptureProvider {
  public readonly id = 'windows-native-capture';
  public readonly name = 'Windows Native Graphics Capture (Desktop App)';
  public readonly type: ProviderType = 'WINDOWS_NATIVE_CAPTURE';
  public readonly supportedPlatforms: ('WINDOWS')[] = ['WINDOWS'];
  public readonly authenticationMethod = 'USER_PERMISSION' as const;
  public readonly isImplemented = false;

  private state: ProviderLifecycleState = 'NOT_IMPLEMENTED';
  private details = 'Windows Native Capture requires the native TRADYX desktop runtime (Windows.Graphics.Capture).';
  private listeners = new Set<StateChangeCallback>();

  public getState(): ProviderLifecycleState {
    return this.state;
  }

  public getDetails(): string {
    return this.details;
  }

  public isAvailableOnPlatform(): boolean {
    return false; // Web browser runtime
  }

  public onStateChange(callback: StateChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public async connect(): Promise<boolean> {
    this.state = 'NOT_IMPLEMENTED';
    return false;
  }

  public async disconnect(): Promise<void> {}
  public async discoverInstruments(): Promise<InstrumentMetadata[]> { return []; }
  public async discoverTimeframes(): Promise<TimeframeOption[]> { return []; }
  public subscribe(_symbol: string, _timeframe: string, _onData: MarketDataCallback): void {}
  public unsubscribe(_symbol: string, _timeframe?: string): void {}
}
