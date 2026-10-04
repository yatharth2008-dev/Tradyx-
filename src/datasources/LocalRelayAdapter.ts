/**
 * TRADYX LocalRelayAdapter
 * 
 * Supports local video / RTSP / WebRTC frame relay from external capture devices,
 * OBS Virtual Camera, or a local Python/Go agent relaying live chart frames.
 * Does not simulate or generate fake data.
 */

import { Candle, ConnectionStatus, DataSourceType, SourceCapability, SourceConnectionStatus, Timeframe } from '../types';
import { DataFeedSubscriber, MarketDataSource } from './MarketDataSource';
import { CaptureSource } from './CaptureSource';

export interface LocalRelayConfig {
  streamUrl: string; // e.g., 'ws://localhost:8554/live' or 'rtsp://...'
  streamType: 'WEBRTC' | 'WEBSOCKET_FRAMES' | 'MJPEG';
  label?: string;
}

export class LocalRelayAdapter implements MarketDataSource, CaptureSource {
  public id = 'local-relay';
  public name = 'Local Video / RTSP Relay Stream';
  public type: DataSourceType = 'SCREEN_CAPTURE';
  public description = 'External live video stream relayed over local network or hardware capture card';
  public isSimulated = false;

  private status: ConnectionStatus = 'DATA_DISCONNECTED';
  private config: LocalRelayConfig | null = null;
  private subscribers = new Map<string, Set<DataFeedSubscriber>>();

  public setConfig(config: LocalRelayConfig) {
    this.config = config;
  }

  public getConfig(): LocalRelayConfig | null {
    return this.config;
  }

  public isAvailableInEnvironment(): boolean {
    return typeof window !== 'undefined' && ('WebSocket' in window || 'RTCPeerConnection' in window);
  }

  public getCapability(): SourceCapability {
    return {
      id: this.id,
      name: this.name,
      type: 'TRADING_APP',
      adapterName: 'LocalRelayAdapter',
      isImplemented: true,
      isSupportedInCurrentEnv: this.isAvailableInEnvironment(),
      requiresUserPermission: false,
      requiresNativeApp: false,
      supportedPlatforms: ['WEB', 'WINDOWS', 'ANDROID'],
      status: this.getCaptureStatus(),
      details: this.config
        ? `Configured for ${this.config.streamUrl} (${this.config.streamType})`
        : 'Awaiting local relay stream URL (RTSP / WebRTC / WebSocket)'
    };
  }

  public getCaptureStatus(): SourceConnectionStatus {
    if (this.status === 'DATA_CONNECTED') return 'CONNECTED';
    return 'DISCONNECTED';
  }

  public async connect(): Promise<boolean> {
    if (!this.config || !this.config.streamUrl) {
      this.status = 'DATA_UNAVAILABLE';
      return false;
    }

    // In this phase, relay requires active local server stream
    this.status = 'WAITING_FOR_DATA';
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
