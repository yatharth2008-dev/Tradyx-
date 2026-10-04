import { Candle, MultiTimeframeAnalysis, Timeframe, TimeframeSnapshot, TrendDirection } from '../types';
import { TechnicalEngine } from './technicalEngine';
import { MarketStructureEngine } from './marketStructureEngine';

export class MultiTimeframeEngine {
  /**
   * Deterministically evaluates multi-timeframe alignment and confluence hierarchy
   */
  public static analyze(
    symbol: string,
    primaryTimeframe: Timeframe,
    candlesByTimeframe: Record<Timeframe, Candle[]>
  ): MultiTimeframeAnalysis {
    const timeframes: Timeframe[] = ['1D', '4H', '1H', '15M', '5M', '1M'];
    const secondaryTimeframes = timeframes.filter((tf) => tf !== primaryTimeframe);

    const snapshots: Record<Timeframe, TimeframeSnapshot> = {} as any;

    for (const tf of timeframes) {
      const candles = candlesByTimeframe[tf] || [];
      if (candles.length > 0) {
        const last = candles[candles.length - 1];
        const tech = TechnicalEngine.calculate(symbol, tf, candles);
        const struct = MarketStructureEngine.analyze(symbol, tf, candles);

        snapshots[tf] = {
          timeframe: tf,
          trend: struct.trend,
          structure: struct.structure,
          lastClose: last.close,
          rsi: tech.rsi,
          aboveVwap: tech.vwap > 0 ? last.close >= tech.vwap : true,
          isAligned: false
        };
      } else {
        snapshots[tf] = {
          timeframe: tf,
          trend: 'NEUTRAL',
          structure: 'CONSOLIDATION',
          lastClose: 0,
          rsi: 50,
          aboveVwap: true,
          isAligned: false
        };
      }
    }

    // Determine hierarchy:
    // Higher: 1D or 4H
    // Intermediate: 1H or 15M
    // Lower: 5M or 1M
    const higherTf: Timeframe = candlesByTimeframe['1D']?.length ? '1D' : '4H';
    const intermediateTf: Timeframe = candlesByTimeframe['1H']?.length ? '1H' : '15M';
    const lowerTf: Timeframe = candlesByTimeframe['5M']?.length ? '5M' : '1M';

    const higherTrend = snapshots[higherTf]?.trend || 'NEUTRAL';
    const intermediateTrend = snapshots[intermediateTf]?.trend || 'NEUTRAL';
    const lowerTrend = snapshots[lowerTf]?.trend || 'NEUTRAL';

    // Calculate confluence score
    let matchCount = 0;
    let evaluatedCount = 0;

    for (const tf of timeframes) {
      if (candlesByTimeframe[tf]?.length > 0) {
        evaluatedCount++;
        const snapshot = snapshots[tf];
        const matchesPrimary = snapshot.trend === snapshots[primaryTimeframe]?.trend && snapshot.trend !== 'NEUTRAL';
        snapshot.isAligned = matchesPrimary;
        if (matchesPrimary) matchCount++;
      }
    }

    const alignmentScore = evaluatedCount > 0 ? Math.round((matchCount / evaluatedCount) * 100) : 50;

    // Synthesize human-readable hierarchy interpretation
    let alignmentSummary = 'Timeframes diverging. Neutral stance advised.';
    if (higherTrend === 'BULLISH' && intermediateTrend === 'BULLISH') {
      if (lowerTrend === 'BEARISH') {
        alignmentSummary = 'Higher & Intermediate trends Bullish; Lower timeframe pulling back into demand zone. Awaiting trigger.';
      } else if (lowerTrend === 'BULLISH') {
        alignmentSummary = 'Full Bullish Confluence across Higher, Intermediate, and Lower timeframes.';
      } else {
        alignmentSummary = 'Trend Bullish on macro; lower timeframe in tight consolidation.';
      }
    } else if (higherTrend === 'BEARISH' && intermediateTrend === 'BEARISH') {
      if (lowerTrend === 'BULLISH') {
        alignmentSummary = 'Higher & Intermediate trends Bearish; Lower timeframe in counter-trend relief rally towards supply.';
      } else if (lowerTrend === 'BEARISH') {
        alignmentSummary = 'Full Bearish Confluence across all timeframes. High downward momentum.';
      } else {
        alignmentSummary = 'Bearish macro structure intact; lower timeframe pausing.';
      }
    } else if (higherTrend !== intermediateTrend) {
      alignmentSummary = `Macro timeframe (${higherTf}) is ${higherTrend} while Intermediate (${intermediateTf}) is ${intermediateTrend}. Conflict reduces setup reliability.`;
    }

    return {
      primaryTimeframe,
      secondaryTimeframes,
      higherTimeframeTrend: higherTrend,
      intermediateTrend,
      lowerTimeframeTrend: lowerTrend,
      alignmentScore,
      alignmentSummary,
      snapshots
    };
  }
}
