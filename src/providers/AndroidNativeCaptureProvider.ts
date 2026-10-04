/**
 * TRADYX AndroidNativeCaptureProvider
 * 
 * Native Android screen capture using MediaProjection API.
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

export class AndroidNativeCaptureProvider implements ChartCaptureProvider {
  public readonly id = 'android-native-capture';
  public readonly name = 'Android Native Capture (MediaProjection)';
  public readonly type: ProviderType = 'ANDROID_NATIVE_CAPTURE';
  public readonly supportedPlatforms: ('ANDROID')[] = ['ANDROID'];
  public readonly authenticationMethod = 'USER_PERMISSION' as const;
  public readonly isImplemented = false;

  private state: ProviderLifecycleState = 'NOT_IMPLEMENTED';
  private details = 'Android Native Capture requires the native TRADYX Android APK with MediaProjection permission.';
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
