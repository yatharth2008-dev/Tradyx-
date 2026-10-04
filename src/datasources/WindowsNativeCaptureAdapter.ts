/**
 * TRADYX WindowsNativeCaptureAdapter
 * 
 * Target Architecture: Windows.Graphics.Capture API (via native C++/C#/Rust or Electron/Tauri bridge).
 * Requires explicit user consent per application window.
 * 
 * STATUS: NOT IMPLEMENTED in browser webapp environment.
 * Never claims to be connected or implemented when running in a standard browser.
 */

import { Candle, ConnectionStatus, DataSourceType, SourceCapability, SourceConnectionStatus, Timeframe } from '../types';
import { DataFeedSubscriber, MarketDataSource } from './MarketDataSource';
import { CaptureSource } from './CaptureSource';

export class WindowsNativeCaptureAdapter implements MarketDataSource, CaptureSource {
  public id = 'windows-native-capture';
  public name = 'Windows Native Window Capture';
  public type: DataSourceType = 'SCREEN_CAPTURE';
  public description = 'OS-level window capture using Windows.Graphics.Capture API';
  public isSimulated = false;

  private status: ConnectionStatus = 'DATA_UNAVAILABLE';
  private subscribers = new Map<string, Set<DataFeedSubscriber>>();

  public isAvailableInEnvironment(): boolean {
    // Windows.Graphics.Capture requires native OS runtime, not exposed to browser sandbox
    return false;
  }

  public getCapability(): SourceCapability {
    return {
      id: this.id,
      name: this.name,
      type: 'SCREEN_WINDOW_CAPTURE',
      adapterName: 'WindowsNativeCaptureAdapter',
      isImplemented: false,
      isSupportedInCurrentEnv: false,
      requiresUserPermission: true,
      requiresNativeApp: true,
      supportedPlatforms: ['WINDOWS'],
      status: 'NOT_IMPLEMENTED',
      details: 'Windows Native Capture (Windows.Graphics.Capture API) is not implemented in browser web application. Requires native Windows desktop container.'
    };
  }

  public getCaptureStatus(): SourceConnectionStatus {
    return 'NOT_IMPLEMENTED';
  }

  public async connect(): Promise<boolean> {
    this.status = 'DATA_UNAVAILABLE';
    console.warn('[TRADYX] Windows Native Capture adapter is NOT IMPLEMENTED in browser environment.');
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
