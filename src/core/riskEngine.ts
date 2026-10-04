import { MarketStructureState, RiskCalculation, SetupBias, TechnicalIndicators } from '../types';

export interface RiskEngineParams {
  accountCapital: number;
  riskPerTradePercent: number;
  minRiskRewardRatio: number;
  currentPrice: number;
  bias: SetupBias;
  marketStructure: MarketStructureState;
  indicators: TechnicalIndicators;
}

export class RiskEngine {
  /**
   * Deterministically calculates entry, stop, targets, position sizing, and invalidation
   */
  public static calculate(params: RiskEngineParams): RiskCalculation {
    const {
      accountCapital = 25000,
      riskPerTradePercent = 1.0,
      minRiskRewardRatio = 2.0,
      currentPrice,
      bias,
      marketStructure,
      indicators
    } = params;

    const riskAmount = Number(((accountCapital * riskPerTradePercent) / 100).toFixed(2));
    const atr = indicators.atr > 0 ? indicators.atr : currentPrice * 0.005;

    if (bias === 'WAIT' || bias === 'NO_TRADE' || currentPrice <= 0) {
      return {
        accountCapital,
        riskPercentage: riskPerTradePercent,
        riskAmount,
        bias,
        entryZone: { min: currentPrice, max: currentPrice, suggested: currentPrice },
        stopLoss: currentPrice,
        target1: currentPrice,
        target2: currentPrice,
        invalidationPrice: currentPrice,
        riskRewardRatio: 0,
        recommendedPositionUnits: 0,
        totalExposure: 0,
        disclaimer: 'TRADYX is an analytical decision-support system. Market outcomes are probabilistic. Never risk more than authorized.'
      };
    }

    let entryMin: number;
    let entryMax: number;
    let suggestedEntry: number;
    let stopLoss: number;
    let invalidationPrice: number;
    let target1: number;
    let target2: number;

    if (bias === 'LONG') {
      // Long setup: Entry near recent swing low or current price pullback
      suggestedEntry = currentPrice;
      entryMin = Number((currentPrice - 0.3 * atr).toFixed(2));
      entryMax = Number((currentPrice + 0.1 * atr).toFixed(2));

      // Stop loss set beyond recent swing low or 1.5 ATR
      const structuralLow = marketStructure.recentSwingLow > 0 && marketStructure.recentSwingLow < currentPrice
        ? marketStructure.recentSwingLow - 0.2 * atr
        : currentPrice - 1.5 * atr;

      stopLoss = Number(structuralLow.toFixed(2));
      invalidationPrice = Number((stopLoss - 0.1 * atr).toFixed(2));

      const riskPerUnit = Math.max(suggestedEntry - stopLoss, 0.01);
      target1 = Number((suggestedEntry + riskPerUnit * minRiskRewardRatio).toFixed(2));
      target2 = Number((suggestedEntry + riskPerUnit * (minRiskRewardRatio + 1.2)).toFixed(2));
    } else {
      // Short setup: Entry near recent swing high or current price
      suggestedEntry = currentPrice;
      entryMin = Number((currentPrice - 0.1 * atr).toFixed(2));
      entryMax = Number((currentPrice + 0.3 * atr).toFixed(2));

      // Stop loss set above recent swing high or 1.5 ATR
      const structuralHigh = marketStructure.recentSwingHigh > currentPrice
        ? marketStructure.recentSwingHigh + 0.2 * atr
        : currentPrice + 1.5 * atr;

      stopLoss = Number(structuralHigh.toFixed(2));
      invalidationPrice = Number((stopLoss + 0.1 * atr).toFixed(2));

      const riskPerUnit = Math.max(stopLoss - suggestedEntry, 0.01);
      target1 = Number((suggestedEntry - riskPerUnit * minRiskRewardRatio).toFixed(2));
      target2 = Number((suggestedEntry - riskPerUnit * (minRiskRewardRatio + 1.2)).toFixed(2));
    }

    const priceRisk = Math.abs(suggestedEntry - stopLoss);
    const recommendedPositionUnits = priceRisk > 0 ? Math.floor(riskAmount / priceRisk) : 0;
    const totalExposure = Number((recommendedPositionUnits * suggestedEntry).toFixed(2));

    const rewardDistance = Math.abs(target1 - suggestedEntry);
    const riskRewardRatio = priceRisk > 0 ? Number((rewardDistance / priceRisk).toFixed(2)) : 0;

    return {
      accountCapital,
      riskPercentage: riskPerTradePercent,
      riskAmount,
      bias,
      entryZone: { min: entryMin, max: entryMax, suggested: suggestedEntry },
      stopLoss,
      target1,
      target2,
      invalidationPrice,
      riskRewardRatio,
      recommendedPositionUnits,
      totalExposure,
      disclaimer: 'TRADYX is an analytical decision-support system. Risk metrics are calculated deterministically. The final trading decision rests solely with the user.'
    };
  }
}
