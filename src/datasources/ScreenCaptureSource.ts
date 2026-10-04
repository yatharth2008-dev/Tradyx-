import { Candle, ConnectionStatus, DataSourceType, Timeframe } from '../types';
import { DataFeedSubscriber, MarketDataSource } from './MarketDataSource';

export class ScreenCaptureSource implements MarketDataSource {
  public id = 'screen-capture';
  public name = 'Authorized Chart Observation (Screen/Window)';
  public type: DataSourceType = 'SCREEN_CAPTURE';
  public description = 'User-authorized display capture of charting application window';
  public isSimulated = false;

  private status: ConnectionStatus = 'DATA_DISCONNECTED';
  private mediaStream: MediaStream | null = null;
  private subscribers = new Map<string, Set<DataFeedSubscriber>>();

  public async connect(): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia) {
        // Request explicit user permission via system display media picker
        this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'window'
          },
          audio: false
        });

        this.status = 'DATA_CONNECTED';

        this.mediaStream.getVideoTracks()[0].addEventListener('ended', () => {
          this.status = 'DATA_DISCONNECTED';
          this.mediaStream = null;
        });

        return true;
      } else {
        console.warn('Screen capture API not supported in current environment');
        this.status = 'DATA_UNAVAILABLE';
        return false;
      }
    } catch (err) {
      console.error('Screen capture permission denied or failed:', err);
      this.status = 'DATA_DISCONNECTED';
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
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
