import { Candle, MarketStructureState, Timeframe, TrendDirection } from '../types';

export class MarketStructureEngine {
  /**
   * Deterministically evaluates price action and structural patterns
   */
  public static analyze(
    symbol: string,
    timeframe: Timeframe,
    candles: Candle[]
  ): MarketStructureState {
    if (!candles || candles.length < 15) {
      return this.getEmptyState(symbol, timeframe);
    }

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    // 1. Identify swing points (fractal high / low over 3-candle radius)
    const swingHighs: Array<{ price: number; index: number }> = [];
    const swingLows: Array<{ price: number; index: number }> = [];

    for (let i = 2; i < candles.length - 2; i++) {
      const c = candles[i];
      const isHigh =
        c.high > candles[i - 1].high &&
        c.high > candles[i - 2].high &&
        c.high > candles[i + 1].high &&
        c.high > candles[i + 2].high;

      const isLow =
        c.low < candles[i - 1].low &&
        c.low < candles[i - 2].low &&
        c.low < candles[i + 1].low &&
        c.low < candles[i + 2].low;

      if (isHigh) swingHighs.push({ price: c.high, index: i });
      if (isLow) swingLows.push({ price: c.low, index: i });
    }

    const lastHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : last.high;
    const prevHigh = swingHighs.length > 1 ? swingHighs[swingHighs.length - 2].price : lastHigh;

    const lastLow = swingLows.length > 0 ? swingLows[swingLows.length - 1].price : last.low;
    const prevLow = swingLows.length > 1 ? swingLows[swingLows.length - 2].price : lastLow;

    // 2. Classify HH/HL or LH/LL structure
    let structure: 'HH_HL' | 'LH_LL' | 'CONSOLIDATION' | 'EXPANSION' = 'CONSOLIDATION';
    let trend: TrendDirection = 'NEUTRAL';

    const isHigherHigh = lastHigh > prevHigh;
    const isHigherLow = lastLow > prevLow;
    const isLowerHigh = lastHigh < prevHigh;
    const isLowerLow = lastLow < prevLow;

    if (isHigherHigh && isHigherLow) {
      structure = 'HH_HL';
      trend = 'BULLISH';
    } else if (isLowerHigh && isLowerLow) {
      structure = 'LH_LL';
      trend = 'BEARISH';
    } else if (isHigherHigh && isLowerLow) {
      structure = 'EXPANSION';
      trend = 'CONSOLIDATING';
    } else {
      structure = 'CONSOLIDATION';
      trend = 'NEUTRAL';
    }

    // 3. BOS (Break of Structure) & CHoCH (Change of Character)
    // BOS: In bullish trend, candle close breaks above previous swing high
    const bos = trend === 'BULLISH' ? last.close > lastHigh && prev.close <= lastHigh : trend === 'BEARISH' ? last.close < lastLow && prev.close >= lastLow : false;

    // CHoCH: trend change confirmation when price breaks counter-trend swing point
    let choch = false;
    if (trend === 'BEARISH' && last.close > lastHigh) {
      choch = true;
      trend = 'BULLISH';
    } else if (trend === 'BULLISH' && last.close < lastLow) {
      choch = true;
      trend = 'BEARISH';
    }

    // 4. Breakout & Breakdown
    const breakout = last.close > lastHigh;
    const breakdown = last.close < lastLow;

    // 5. False Breakout condition: Wick pushed above high, but closed back below with low volume
    const wickHigh = last.high > lastHigh && last.close < lastHigh;
    const isFalseBreakout = wickHigh && last.volume < (candles[candles.length - 3]?.volume || 1000);

    // 6. Support & Resistance levels from swing points
    const keyResistance = swingHighs
      .map((s) => s.price)
      .slice(-3)
      .sort((a, b) => a - b);
    const keySupport = swingLows
      .map((s) => s.price)
      .slice(-3)
      .sort((a, b) => a - b);

    // 7. Supply & Demand zones
    const supplyZones = keyResistance.map((lvl) => ({
      high: Number((lvl * 1.002).toFixed(2)),
      low: Number(lvl.toFixed(2)),
      tested: 1
    }));

    const demandZones = keySupport.map((lvl) => ({
      high: Number(lvl.toFixed(2)),
      low: Number((lvl * 0.998).toFixed(2)),
      tested: 1
    }));

    // 8. Momentum score (-100 to +100)
    const range = Math.max(lastHigh - lastLow, 0.01);
    const posInRange = (last.close - lastLow) / range;
    const momentumScore = Math.round((posInRange - 0.5) * 200);

    // 9. Volatility state
    const recentCandleRanges = candles.slice(-10).map((c) => c.high - c.low);
    const avgRange = recentCandleRanges.reduce((a, b) => a + b, 0) / recentCandleRanges.length;
    const currentRange = last.high - last.low;
    const volatilityState: 'LOW' | 'NORMAL' | 'ELEVATED' | 'EXTREME' =
      currentRange > avgRange * 2.2
        ? 'EXTREME'
        : currentRange > avgRange * 1.5
        ? 'ELEVATED'
        : currentRange < avgRange * 0.6
        ? 'LOW'
        : 'NORMAL';

    return {
      symbol,
      timeframe,
      timestamp: last.timestamp,
      trend,
      structure,
      recentSwingHigh: lastHigh,
      recentSwingLow: lastLow,
      bos,
      choch,
      breakout,
      breakdown,
      isFalseBreakout,
      keyResistance: keyResistance.length > 0 ? keyResistance : [Number((last.close * 1.02).toFixed(2))],
      keySupport: keySupport.length > 0 ? keySupport : [Number((last.close * 0.98).toFixed(2))],
      supplyZones,
      demandZones,
      momentumScore,
      volatilityState
    };
  }

  private static getEmptyState(symbol: string, timeframe: Timeframe): MarketStructureState {
    return {
      symbol,
      timeframe,
      timestamp: Date.now(),
      trend: 'NEUTRAL',
      structure: 'CONSOLIDATION',
      recentSwingHigh: 0,
      recentSwingLow: 0,
      bos: false,
      choch: false,
      breakout: false,
      breakdown: false,
      isFalseBreakout: false,
      keyResistance: [],
      keySupport: [],
      supplyZones: [],
      demandZones: [],
      momentumScore: 0,
      volatilityState: 'NORMAL'
    };
  }
}
