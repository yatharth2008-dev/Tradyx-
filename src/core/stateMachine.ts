import { MarketStructureState, MultiTimeframeAnalysis, RiskCalculation, SignalState, SetupBias, TechnicalIndicators } from '../types';

export interface StateEvaluationContext {
  currentState: SignalState;
  currentPrice: number;
  indicators: TechnicalIndicators;
  structure: MarketStructureState;
  mtf: MultiTimeframeAnalysis;
  risk: RiskCalculation;
  minRiskReward: number;
  hasVolumeConfirmation: boolean;
}

export class SignalStateMachine {
  /**
   * Deterministically transitions the setup state machine based on verified market facts
   */
  public static evaluate(context: StateEvaluationContext): {
    nextState: SignalState;
    bias: SetupBias;
    stateChangeReason: string;
    isEventTrigger: boolean;
  } {
    const {
      currentState,
      currentPrice,
      indicators,
      structure,
      mtf,
      risk,
      minRiskReward,
      hasVolumeConfirmation
    } = context;

    if (!currentPrice || indicators.rsi === 0) {
      return {
        nextState: 'INITIALIZING',
        bias: 'WAIT',
        stateChangeReason: 'Awaiting market data pipeline initialization',
        isEventTrigger: false
      };
    }

    // Determine directional bias from structure + MTF
    let bias: SetupBias = 'WAIT';
    if (structure.trend === 'BULLISH' && (mtf.higherTimeframeTrend === 'BULLISH' || mtf.intermediateTrend === 'BULLISH')) {
      bias = 'LONG';
    } else if (structure.trend === 'BEARISH' && (mtf.higherTimeframeTrend === 'BEARISH' || mtf.intermediateTrend === 'BEARISH')) {
      bias = 'SHORT';
    } else {
      bias = 'WAIT';
    }

    // Check invalidation if in a setup
    if (
      ['POTENTIAL_SETUP', 'CONFIRMATION_PENDING', 'CONFIRMED_SETUP'].includes(currentState)
    ) {
      if (bias === 'LONG' && currentPrice <= risk.invalidationPrice) {
        return {
          nextState: 'INVALIDATED',
          bias: 'WAIT',
          stateChangeReason: `Price (${currentPrice}) breached invalidation level (${risk.invalidationPrice})`,
          isEventTrigger: true
        };
      }
      if (bias === 'SHORT' && currentPrice >= risk.invalidationPrice) {
        return {
          nextState: 'INVALIDATED',
          bias: 'WAIT',
          stateChangeReason: `Price (${currentPrice}) breached invalidation level (${risk.invalidationPrice})`,
          isEventTrigger: true
        };
      }
    }

    // State Transitions
    switch (currentState) {
      case 'NO_DATA':
      case 'INITIALIZING':
        return {
          nextState: 'WATCHING',
          bias: 'WAIT',
          stateChangeReason: 'Observation pipeline established and indicators verified',
          isEventTrigger: true
        };

      case 'WATCHING': {
        if (bias !== 'WAIT' && mtf.alignmentScore >= 50) {
          return {
            nextState: 'POTENTIAL_SETUP',
            bias,
            stateChangeReason: `Potential ${bias} setup detected: ${structure.trend} trend with ${mtf.alignmentScore}% MTF confluence`,
            isEventTrigger: true
          };
        }
        return {
          nextState: 'WATCHING',
          bias: 'WAIT',
          stateChangeReason: 'No clear edge. Continuously observing market structure.',
          isEventTrigger: false
        };
      }

      case 'POTENTIAL_SETUP': {
        // Look for breakout, BOS, or swing touch
        const trigger = structure.bos || structure.breakout || structure.choch;
        if (trigger) {
          return {
            nextState: 'CONFIRMATION_PENDING',
            bias,
            stateChangeReason: `${structure.bos ? 'Break of Structure (BOS)' : 'Breakout'} detected; awaiting volume confirmation & R:R satisfaction`,
            isEventTrigger: true
          };
        }
        if (structure.trend === 'NEUTRAL' || structure.trend === 'CONSOLIDATING') {
          return {
            nextState: 'WATCHING',
            bias: 'WAIT',
            stateChangeReason: 'Structure faded into consolidation. Returned to watching.',
            isEventTrigger: true
          };
        }
        return {
          nextState: 'POTENTIAL_SETUP',
          bias,
          stateChangeReason: 'Potential setup active, waiting for structural trigger',
          isEventTrigger: false
        };
      }

      case 'CONFIRMATION_PENDING': {
        const rrSatisfied = risk.riskRewardRatio >= minRiskReward;
        if (hasVolumeConfirmation && rrSatisfied && !structure.isFalseBreakout) {
          return {
            nextState: 'CONFIRMED_SETUP',
            bias,
            stateChangeReason: `Setup Confirmed: Volume confirmation verified, R:R (${risk.riskRewardRatio}) meets target (>= ${minRiskReward})`,
            isEventTrigger: true
          };
        }
        if (structure.isFalseBreakout) {
          return {
            nextState: 'INVALIDATED',
            bias: 'WAIT',
            stateChangeReason: 'False breakout detected: Wick rejection with deteriorating volume',
            isEventTrigger: true
          };
        }
        return {
          nextState: 'CONFIRMATION_PENDING',
          bias,
          stateChangeReason: 'Awaiting volume confirmation or adequate risk-reward ratio',
          isEventTrigger: false
        };
      }

      case 'CONFIRMED_SETUP': {
        // Setup remains confirmed until target 1 is touched or invalidation occurs
        if (bias === 'LONG' && currentPrice >= risk.target1) {
          return {
            nextState: 'COOLDOWN',
            bias: 'WAIT',
            stateChangeReason: `Target 1 (${risk.target1}) reached successfully`,
            isEventTrigger: true
          };
        }
        if (bias === 'SHORT' && currentPrice <= risk.target1) {
          return {
            nextState: 'COOLDOWN',
            bias: 'WAIT',
            stateChangeReason: `Target 1 (${risk.target1}) reached successfully`,
            isEventTrigger: true
          };
        }
        return {
          nextState: 'CONFIRMED_SETUP',
          bias,
          stateChangeReason: 'Confirmed setup active, tracking price against targets',
          isEventTrigger: false
        };
      }

      case 'INVALIDATED':
        return {
          nextState: 'COOLDOWN',
          bias: 'WAIT',
          stateChangeReason: 'Entering cooldown period after invalidation',
          isEventTrigger: true
        };

      case 'COOLDOWN':
        return {
          nextState: 'WATCHING',
          bias: 'WAIT',
          stateChangeReason: 'Cooldown complete. Resetting observation pipeline to watching.',
          isEventTrigger: true
        };

      default:
        return {
          nextState: 'WATCHING',
          bias: 'WAIT',
          stateChangeReason: 'Default safe fallback',
          isEventTrigger: false
        };
    }
  }
}
