import { Candle, TechnicalIndicators, Timeframe } from '../types';

export class TechnicalEngine {
  /**
   * Calculates all primary technical indicators deterministically for an instrument and timeframe
   */
  public static calculate(
    symbol: string,
    timeframe: Timeframe,
    candles: Candle[]
  ): TechnicalIndicators {
    if (!candles || candles.length === 0) {
      return this.getEmptyIndicators(symbol, timeframe);
    }

    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const volumes = candles.map((c) => c.volume);
    const lastCandle = candles[candles.length - 1];

    const ema9 = this.calculateEMA(closes, 9);
    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);
    const ema200 = this.calculateEMA(closes, 200);

    const sma20 = this.calculateSMA(closes, 20);
    const sma50 = this.calculateSMA(closes, 50);

    const rsi = this.calculateRSI(closes, 14);
    const vwap = this.calculateVWAP(candles);
    const atr = this.calculateATR(candles, 14);
    const bollingerBands = this.calculateBollingerBands(closes, 20, 2);
    const macd = this.calculateMACD(closes, 12, 26, 9);

    const volumeMa20 = this.calculateSMA(volumes, 20);
    const lastVolume = lastCandle.volume;
    const volumeTrend: 'EXPANDING' | 'CONTRACTING' | 'NORMAL' =
      lastVolume > volumeMa20 * 1.4
        ? 'EXPANDING'
        : lastVolume < volumeMa20 * 0.7
        ? 'CONTRACTING'
        : 'NORMAL';

    const pivotPoints = this.calculatePivotPoints(candles);
    const fibonacciLevels = this.calculateFibonacci(highs, lows);

    return {
      symbol,
      timeframe,
      timestamp: lastCandle.timestamp,
      ema9,
      ema20,
      ema50,
      ema200,
      sma20,
      sma50,
      rsi,
      vwap,
      atr,
      bollingerBands,
      macd,
      volumeMa20,
      volumeTrend,
      pivotPoints,
      fibonacciLevels
    };
  }

  public static calculateSMA(data: number[], period: number): number {
    if (data.length === 0) return 0;
    const slice = data.slice(-period);
    const sum = slice.reduce((acc, val) => acc + val, 0);
    return Number((sum / slice.length).toFixed(2));
  }

  public static calculateEMA(data: number[], period: number): number {
    if (data.length === 0) return 0;
    if (data.length < period) return this.calculateSMA(data, data.length);

    const k = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((acc, v) => acc + v, 0) / period;

    for (let i = period; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }

    return Number(ema.toFixed(2));
  }

  public static calculateRSI(closes: number[], period: number = 14): number {
    if (closes.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);
    return Number(rsi.toFixed(2));
  }

  public static calculateVWAP(candles: Candle[]): number {
    if (candles.length === 0) return 0;
    let totalVP = 0;
    let totalVolume = 0;

    for (const c of candles) {
      const typicalPrice = (c.high + c.low + c.close) / 3;
      totalVP += typicalPrice * c.volume;
      totalVolume += c.volume;
    }

    return totalVolume > 0 ? Number((totalVP / totalVolume).toFixed(2)) : candles[candles.length - 1].close;
  }

  public static calculateATR(candles: Candle[], period: number = 14): number {
    if (candles.length < 2) return 0;

    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const prev = candles[i - 1];
      const tr = Math.max(
        current.high - current.low,
        Math.abs(current.high - prev.close),
        Math.abs(current.low - prev.close)
      );
      trs.push(tr);
    }

    return this.calculateSMA(trs, period);
  }

  public static calculateBollingerBands(
    closes: number[],
    period: number = 20,
    multiplier: number = 2
  ): { upper: number; middle: number; lower: number; bandwidth: number } {
    if (closes.length === 0) return { upper: 0, middle: 0, lower: 0, bandwidth: 0 };
    const middle = this.calculateSMA(closes, period);
    const slice = closes.slice(-period);

    const variance =
      slice.reduce((acc, val) => acc + Math.pow(val - middle, 2), 0) / slice.length;
    const stdDev = Math.sqrt(variance);

    const upper = Number((middle + multiplier * stdDev).toFixed(2));
    const lower = Number((middle - multiplier * stdDev).toFixed(2));
    const bandwidth = middle > 0 ? Number((((upper - lower) / middle) * 100).toFixed(2)) : 0;

    return { upper, middle, lower, bandwidth };
  }

  public static calculateMACD(
    closes: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): { macdLine: number; signalLine: number; histogram: number } {
    if (closes.length < slowPeriod) {
      return { macdLine: 0, signalLine: 0, histogram: 0 };
    }

    const fastEMA = this.calculateEMA(closes, fastPeriod);
    const slowEMA = this.calculateEMA(closes, slowPeriod);
    const macdLine = Number((fastEMA - slowEMA).toFixed(2));

    // Signal line approximation over series
    const macdHistory: number[] = [];
    const windowSize = Math.min(closes.length, slowPeriod + signalPeriod);
    for (let i = windowSize; i >= 1; i--) {
      const subCloses = closes.slice(0, closes.length - i + 1);
      const f = this.calculateEMA(subCloses, fastPeriod);
      const s = this.calculateEMA(subCloses, slowPeriod);
      macdHistory.push(f - s);
    }

    const signalLine = this.calculateEMA(macdHistory, signalPeriod);
    const histogram = Number((macdLine - signalLine).toFixed(2));

    return { macdLine, signalLine, histogram };
  }

  public static calculatePivotPoints(candles: Candle[]): {
    pp: number;
    r1: number;
    r2: number;
    s1: number;
    s2: number;
  } {
    if (candles.length === 0) {
      return { pp: 0, r1: 0, r2: 0, s1: 0, s2: 0 };
    }
    const recent = candles.slice(-20);
    const high = Math.max(...recent.map((c) => c.high));
    const low = Math.min(...recent.map((c) => c.low));
    const close = candles[candles.length - 1].close;

    const pp = (high + low + close) / 3;
    const r1 = 2 * pp - low;
    const s1 = 2 * pp - high;
    const r2 = pp + (high - low);
    const s2 = pp - (high - low);

    return {
      pp: Number(pp.toFixed(2)),
      r1: Number(r1.toFixed(2)),
      r2: Number(r2.toFixed(2)),
      s1: Number(s1.toFixed(2)),
      s2: Number(s2.toFixed(2))
    };
  }

  public static calculateFibonacci(
    highs: number[],
    lows: number[]
  ): {
    fib236: number;
    fib382: number;
    fib500: number;
    fib618: number;
    fib786: number;
  } {
    if (highs.length === 0 || lows.length === 0) {
      return { fib236: 0, fib382: 0, fib500: 0, fib618: 0, fib786: 0 };
    }
    const maxHigh = Math.max(...highs.slice(-40));
    const minLow = Math.min(...lows.slice(-40));
    const diff = maxHigh - minLow;

    return {
      fib236: Number((maxHigh - diff * 0.236).toFixed(2)),
      fib382: Number((maxHigh - diff * 0.382).toFixed(2)),
      fib500: Number((maxHigh - diff * 0.5).toFixed(2)),
      fib618: Number((maxHigh - diff * 0.618).toFixed(2)),
      fib786: Number((maxHigh - diff * 0.786).toFixed(2))
    };
  }

  private static getEmptyIndicators(symbol: string, timeframe: Timeframe): TechnicalIndicators {
    return {
      symbol,
      timeframe,
      timestamp: Date.now(),
      ema9: 0,
      ema20: 0,
      ema50: 0,
      ema200: 0,
      sma20: 0,
      sma50: 0,
      rsi: 50,
      vwap: 0,
      atr: 0,
      bollingerBands: { upper: 0, middle: 0, lower: 0, bandwidth: 0 },
      macd: { macdLine: 0, signalLine: 0, histogram: 0 },
      volumeMa20: 0,
      volumeTrend: 'NORMAL',
      pivotPoints: { pp: 0, r1: 0, r2: 0, s1: 0, s2: 0 },
      fibonacciLevels: { fib236: 0, fib382: 0, fib500: 0, fib618: 0, fib786: 0 }
    };
  }
}
