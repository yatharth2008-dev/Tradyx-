/**
 * TRADYX AndroidMediaProjectionAdapter
 * 
 * Target Architecture: Android MediaProjection API (via Kotlin/Java Android Foreground Service).
 * Requires Android's native user-authorized screen-capture dialog and persistent foreground notification.
 * 
 * STATUS: NOT IMPLEMENTED in browser webapp environment.
 * Browsers on Android cannot directly invoke MediaProjection without an Android native wrapper.
 * Never claims to be connected or implemented in the browser.
 */

import { Candle, ConnectionStatus, DataSourceType, SourceCapability, SourceConnectionStatus, Timeframe } from '../types';
import { DataFeedSubscriber, MarketDataSource } from './MarketDataSource';
import { CaptureSource } from './CaptureSource';

export class AndroidMediaProjectionAdapter implements MarketDataSource, CaptureSource {
  public id = 'android-mediaprojection';
  public name = 'Android MediaProjection Capture';
  public type: DataSourceType = 'SCREEN_CAPTURE';
  public description = 'Android native screen/window capture using MediaProjection service';
  public isSimulated = false;

  private status: ConnectionStatus = 'DATA_UNAVAILABLE';
  private subscribers = new Map<string, Set<DataFeedSubscriber>>();

  public isAvailableInEnvironment(): boolean {
    // MediaProjection requires native Android runtime with foreground service privileges
    return false;
  }

  public getCapability(): SourceCapability {
    return {
      id: this.id,
      name: this.name,
      type: 'SCREEN_WINDOW_CAPTURE',
      adapterName: 'AndroidMediaProjectionAdapter',
      isImplemented: false,
      isSupportedInCurrentEnv: false,
      requiresUserPermission: true,
      requiresNativeApp: true,
      supportedPlatforms: ['ANDROID'],
      status: 'NOT_IMPLEMENTED',
      details: 'Android MediaProjection capture is not implemented in browser web application. Requires native Android APK with foreground service.'
    };
  }

  public getCaptureStatus(): SourceConnectionStatus {
    return 'NOT_IMPLEMENTED';
  }

  public async connect(): Promise<boolean> {
    this.status = 'DATA_UNAVAILABLE';
    console.warn('[TRADYX] Android MediaProjection adapter is NOT IMPLEMENTED in browser environment.');
    return false;
  }

  public async disconnect(): Promise<void> {
    this.status = 'DATA_DISCONNECTED';
  }

  public subscribe(symbol: string, subscriber: DataFeedSubscriber): void {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
    }
    this.subscribers.get(symbol)!.add(subscriber);
  }

  public unsubscribe(symbol: string): void {
    this.subscribers.delete(symbol);
  }

  public async getLatestData(_symbol: string, _timeframe: Timeframe): Promise<Candle | null> {
    return null;
  }

  public async getHistoricalData(_symbol: string, _timeframe: Timeframe, _count: number): Promise<Candle[]> {
    return [];
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }
}
