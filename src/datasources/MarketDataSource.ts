import { Candle, ConnectionStatus, DataSourceType, Timeframe } from '../types';

export interface DataFeedSubscriber {
  onCandleUpdate: (symbol: string, timeframe: Timeframe, candle: Candle) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

export interface MarketDataSource {
  id: string;
  name: string;
  type: DataSourceType;
  description: string;
  isSimulated: boolean;

  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  subscribe(symbol: string, subscriber: DataFeedSubscriber): void;
  unsubscribe(symbol: string): void;
  getLatestData(symbol: string, timeframe: Timeframe): Promise<Candle | null>;
  getHistoricalData(symbol: string, timeframe: Timeframe, count: number): Promise<Candle[]>;
  getStatus(): ConnectionStatus;
}
