import { Candle, ConnectionStatus, DataSourceType, Timeframe } from '../types';
import { DataFeedSubscriber, MarketDataSource } from './MarketDataSource';

interface SeedInstrument {
  symbol: string;
  name: string;
  basePrice: number;
  volatility: number;
  tickSize: number;
}

const SEED_INSTRUMENTS: Record<string, SeedInstrument> = {
  'NIFTY 50': { symbol: 'NIFTY 50', name: 'Nifty 50 Index', basePrice: 22485.5, volatility: 8.5, tickSize: 0.05 },
  'GOLD': { symbol: 'GOLD', name: 'Gold Spot / Comex', basePrice: 2342.8, volatility: 1.2, tickSize: 0.1 },
  'HDFC BANK': { symbol: 'HDFC BANK', name: 'HDFC Bank Ltd', basePrice: 1538.2, volatility: 1.1, tickSize: 0.05 },
  'BANK NIFTY': { symbol: 'BANK NIFTY', name: 'Nifty Bank Index', basePrice: 47920.0, volatility: 25.0, tickSize: 0.05 },
  'RELIANCE': { symbol: 'RELIANCE', name: 'Reliance Industries', basePrice: 2940.0, volatility: 2.2, tickSize: 0.05 },
  'BTC/USD': { symbol: 'BTC/USD', name: 'Bitcoin / US Dollar', basePrice: 64250.0, volatility: 85.0, tickSize: 0.5 },
  'AAPL': { symbol: 'AAPL', name: 'Apple Inc.', basePrice: 186.5, volatility: 0.45, tickSize: 0.01 },
  'EUR/USD': { symbol: 'EUR/USD', name: 'Euro / US Dollar', basePrice: 1.0845, volatility: 0.0003, tickSize: 0.0001 }
};

export class DemoMarketDataSource implements MarketDataSource {
  public id = 'demo-feed';
  public name = 'TRADYX Deterministic Demo Data Feed';
  public type: DataSourceType = 'DEMO_FEED';
  public description = 'Clearly labeled simulated deterministic feed for development, testing, and safe demonstration';
  public isSimulated = true;

  private status: ConnectionStatus = 'DATA_DISCONNECTED';
  private subscribers = new Map<string, Set<DataFeedSubscriber>>();
  private candleCache = new Map<string, Map<Timeframe, Candle[]>>();
  private tickInterval: any = null;

  constructor() {
    this.initHistory();
  }

  private initHistory() {
    const timeframes: Timeframe[] = ['1D', '4H', '1H', '15M', '5M', '1M'];
    const now = Date.now();

    for (const [sym, seed] of Object.entries(SEED_INSTRUMENTS)) {
      const tfMap = new Map<Timeframe, Candle[]>();

      for (const tf of timeframes) {
        const count = tf === '1D' ? 60 : tf === '1H' || tf === '4H' ? 80 : 100;
        const intervalMs = this.getIntervalMs(tf);
        const candles: Candle[] = [];
        let price = seed.basePrice;

        for (let i = count; i >= 0; i--) {
          const timestamp = now - i * intervalMs;
          const delta = (Math.sin(i / 5) * 0.4 + (Math.random() - 0.48)) * seed.volatility;
          const open = Number(price.toFixed(2));
          price = Math.max(open + delta, seed.basePrice * 0.7);
          const close = Number(price.toFixed(2));
          const high = Number((Math.max(open, close) + Math.random() * seed.volatility * 0.8).toFixed(2));
          const low = Number((Math.min(open, close) - Math.random() * seed.volatility * 0.8).toFixed(2));
          const volume = Math.floor(1000 + Math.random() * 8000);

          candles.push({ timestamp, open, high, low, close, volume });
        }

        tfMap.set(tf, candles);
      }

      this.candleCache.set(sym, tfMap);
    }
  }

  private getIntervalMs(tf: Timeframe): number {
    switch (tf) {
      case '1M': return 60 * 1000;
      case '5M': return 5 * 60 * 1000;
      case '15M': return 15 * 60 * 1000;
      case '1H': return 60 * 60 * 1000;
      case '4H': return 4 * 60 * 60 * 1000;
      case '1D': return 24 * 60 * 60 * 1000;
    }
  }

  public async connect(): Promise<boolean> {
    this.status = 'DATA_CONNECTED';
    this.notifyStatus(this.status);
    this.startStreaming();
    return true;
  }

  public async disconnect(): Promise<void> {
    this.status = 'DATA_DISCONNECTED';
    this.stopStreaming();
    this.notifyStatus(this.status);
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

  public async getLatestData(symbol: string, timeframe: Timeframe): Promise<Candle | null> {
    const list = this.candleCache.get(symbol)?.get(timeframe);
    return list && list.length > 0 ? list[list.length - 1] : null;
  }

  public async getHistoricalData(
    symbol: string,
    timeframe: Timeframe,
    count: number = 80
  ): Promise<Candle[]> {
    const list = this.candleCache.get(symbol)?.get(timeframe);
    if (!list) {
      // Generate fallback for custom symbol
      const seed = SEED_INSTRUMENTS[symbol] || {
        symbol,
        name: symbol,
        basePrice: 1000,
        volatility: 5,
        tickSize: 0.1
      };
      SEED_INSTRUMENTS[symbol] = seed;
      this.initHistory();
      return this.candleCache.get(symbol)?.get(timeframe)?.slice(-count) || [];
    }
    return list.slice(-count);
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  private startStreaming() {
    if (this.tickInterval) clearInterval(this.tickInterval);

    // Stream tick updates every 1500ms
    this.tickInterval = setInterval(() => {
      if (this.status !== 'DATA_CONNECTED') return;

      const now = Date.now();

      for (const [symbol, subs] of this.subscribers.entries()) {
        const seed = SEED_INSTRUMENTS[symbol] || { basePrice: 1000, volatility: 2, tickSize: 0.1 };
        const tfMap = this.candleCache.get(symbol);
        if (!tfMap) continue;

        // Micro price tick
        const tickMove = (Math.random() - 0.49) * seed.volatility * 0.25;

        for (const [tf, candles] of tfMap.entries()) {
          if (candles.length === 0) continue;
          const last = candles[candles.length - 1];
          const intervalMs = this.getIntervalMs(tf);

          let updatedCandle: Candle;
          if (now - last.timestamp >= intervalMs) {
            // New candle
            const newClose = Number((last.close + tickMove).toFixed(2));
            updatedCandle = {
              timestamp: now,
              open: last.close,
              high: Math.max(last.close, newClose),
              low: Math.min(last.close, newClose),
              close: newClose,
              volume: Math.floor(100 + Math.random() * 500)
            };
            candles.push(updatedCandle);
            if (candles.length > 200) candles.shift();
          } else {
            // Update current candle
            const newClose = Number((last.close + tickMove).toFixed(2));
            last.close = newClose;
            last.high = Math.max(last.high, newClose);
            last.low = Math.min(last.low, newClose);
            last.volume += Math.floor(10 + Math.random() * 50);
            updatedCandle = { ...last };
          }

          subs.forEach((sub) => sub.onCandleUpdate(symbol, tf, updatedCandle));
        }
      }
    }, 1500);
  }

  private stopStreaming() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private notifyStatus(status: ConnectionStatus) {
    for (const subs of this.subscribers.values()) {
      subs.forEach((sub) => sub.onStatusChange(status));
    }
  }

  /**
   * Helper to manually inject an event like a Breakout or BOS for interactive testing
   */
  public injectSimulatedEvent(symbol: string, eventType: 'BULLISH_BREAKOUT' | 'BEARISH_BREAKDOWN' | 'VOLUME_SPIKE') {
    const tfMap = this.candleCache.get(symbol);
    if (!tfMap) return;

    for (const candles of tfMap.values()) {
      if (candles.length < 2) continue;
      const last = candles[candles.length - 1];
      if (eventType === 'BULLISH_BREAKOUT') {
        last.close = Number((last.close * 1.018).toFixed(2));
        last.high = Math.max(last.high, last.close);
        last.volume *= 2.8;
      } else if (eventType === 'BEARISH_BREAKDOWN') {
        last.close = Number((last.close * 0.982).toFixed(2));
        last.low = Math.min(last.low, last.close);
        last.volume *= 2.5;
      } else if (eventType === 'VOLUME_SPIKE') {
        last.volume *= 3.5;
      }
    }
  }
}
