/**
 * TRADYX DataValidator
 * 
 * Performs identity-based validation and discrepancy checks on live market observations.
 * 
 * CORE PRINCIPLE:
 * OBSERVE FIRST -> IDENTIFY -> EXTRACT -> VALIDATE -> CALCULATE -> REASON
 * 
 * Real Market Source is the SOLE source of truth.
 * Zero hardcoded price ranges, price bands, or assumed instrument prices.
 * Instrument validation is strictly IDENTITY-BASED.
 */

import { MonitoringSourceConfig, RawObservedMarketData, SourceValidationState } from '../../types';

export interface ValidationResult {
  isValid: boolean;
  status: 'VALID' | 'INVALID' | 'WAITING';
  reason: string;
  detectedSymbol?: string;
  observedPrice: number | null;
  observedCurrency?: string;
  baseCurrency?: string | null;
  quoteCurrency?: string | null;
  mismatchDetails?: {
    expectedInstrument: string;
    observedSource: string;
    observedSymbol?: string;
    observedPrice: number | null;
    action: string;
  };
}

export class DataValidator {
  /**
   * Validates raw observed market data using observed identity and live price presence
   * Zero hardcoded price bounds are used.
   */
  public static validate(
    sourceConfig: MonitoringSourceConfig,
    observedData: RawObservedMarketData | null,
    hasUserConfirmed = false
  ): ValidationResult {
    if (!observedData) {
      return {
        isValid: false,
        status: 'WAITING',
        reason: 'Waiting for live application window or data feed connection.',
        observedPrice: null
      };
    }

    // Check if capture is completely inactive or disconnected
    if (observedData.freshness === 'DISCONNECTED' || observedData.freshness === 'PERMISSION_REQUIRED') {
      return {
        isValid: false,
        status: 'INVALID',
        reason: 'Window capture is inactive or permission was not granted.',
        observedPrice: null
      };
    }

    const expectedSymbol = sourceConfig.instrumentSymbol.toUpperCase();
    const observedPrice = observedData.observedPrice;
    const detectedSymbol = observedData.detectedSymbol?.toUpperCase();
    const observedCurrency = observedData.detectedCurrency || sourceConfig.currency;

    // Check Window Title / Detected Labels for Identity Mismatch
    const titleUpper = (observedData.sourceWindowTitle || '').toUpperCase();
    const appUpper = (observedData.sourceApplicationName || '').toUpperCase();
    const allLabels = (observedData.rawLabelsDetected || []).map((l) => l.toUpperCase()).join(' ');
    const combinedText = `${titleUpper} ${appUpper} ${allLabels}`;

    // Cross-asset conflicting identifiers to detect mismatched windows
    const CONFLICTING_ASSETS: Array<{ id: string; name: string; patterns: string[] }> = [
      { id: 'EUR/USD', name: 'EUR/USD (Forex)', patterns: ['EUR/USD', 'EURUSD', 'EUR USD'] },
      { id: 'GBP/USD', name: 'GBP/USD (Forex)', patterns: ['GBP/USD', 'GBPUSD', 'GBP USD'] },
      { id: 'USD/JPY', name: 'USD/JPY (Forex)', patterns: ['USD/JPY', 'USDJPY', 'USD JPY'] },
      { id: 'AUD/USD', name: 'AUD/USD (Forex)', patterns: ['AUD/USD', 'AUDUSD'] },
      { id: 'BANK NIFTY', name: 'BANK NIFTY (NSE)', patterns: ['BANKNIFTY', 'BANK NIFTY', 'NIFTY BANK'] },
      { id: 'NIFTY 50', name: 'NIFTY 50 (NSE)', patterns: ['NIFTY 50', 'NIFTY50', 'CNX NIFTY'] },
      { id: 'HDFC BANK', name: 'HDFC BANK (NSE)', patterns: ['HDFCBANK', 'HDFC BANK'] },
      { id: 'RELIANCE', name: 'RELIANCE (NSE)', patterns: ['RELIANCE IND', 'RELIANCE'] },
      { id: 'BTC/USD', name: 'BTC/USD (Bitcoin)', patterns: ['BTC/USD', 'BTCUSD', 'BITCOIN'] },
      { id: 'GOLD OTC', name: 'GOLD OTC Contract', patterns: ['GOLD OTC', 'XAUUSD OTC', 'GOLD_OTC'] },
      { id: 'SPOT GOLD', name: 'Spot Gold / XAUUSD', patterns: ['SPOT GOLD', 'COMEX GOLD', 'XAUUSD', 'XAU/USD'] }
    ];

    // Identity check against conflicting instruments
    for (const conflict of CONFLICTING_ASSETS) {
      const isExpectedThisAsset =
        expectedSymbol === conflict.id ||
        conflict.patterns.some((p) => expectedSymbol.includes(p));

      // If window explicitly matches a different conflicting asset
      if (!isExpectedThisAsset && conflict.patterns.some((p) => combinedText.includes(p))) {
        // Special case: 'NIFTY 50' vs 'BANK NIFTY'
        if (expectedSymbol === 'NIFTY 50' && (combinedText.includes('BANK NIFTY') || combinedText.includes('BANKNIFTY'))) {
          return {
            isValid: false,
            status: 'INVALID',
            reason: 'INSTRUMENT MISMATCH: Selected NIFTY 50, but captured chart shows BANK NIFTY. Monitoring cannot start.',
            detectedSymbol: 'BANK NIFTY',
            observedPrice,
            observedCurrency,
            mismatchDetails: {
              expectedInstrument: 'NIFTY 50',
              observedSource: observedData.sourceApplicationName || 'Selected Window',
              observedSymbol: 'BANK NIFTY',
              observedPrice,
              action: 'INSTRUMENT MISMATCH\nSelected: NIFTY 50\nObserved: BANK NIFTY\nMonitoring cannot start. Please select the matching NIFTY 50 chart window.'
            }
          };
        }

        // Special case: GOLD Spot vs GOLD OTC contract identity
        if (expectedSymbol === 'GOLD' && (combinedText.includes('GOLD OTC') || combinedText.includes('OTC'))) {
          return {
            isValid: false,
            status: 'INVALID',
            reason: 'CONTRACT MISMATCH: Selected Global Spot Gold, but captured chart shows GOLD OTC contract.',
            detectedSymbol: 'GOLD OTC',
            observedPrice,
            observedCurrency,
            mismatchDetails: {
              expectedInstrument: 'GOLD (Spot / Benchmark)',
              observedSource: observedData.sourceApplicationName,
              observedSymbol: 'GOLD OTC',
              observedPrice,
              action: 'CONTRACT MISMATCH\nSelected: Spot GOLD\nObserved: GOLD OTC\nMonitoring cannot start with mismatched contract specifications.'
            }
          };
        }

        // Dynamic mismatch check: if window explicitly matches a known distinct conflict asset
        return {
          isValid: false,
          status: 'INVALID',
          reason: `INSTRUMENT MISMATCH: Selected ${expectedSymbol}, but captured chart identifies ${conflict.name}. Monitoring cannot start.`,
          detectedSymbol: conflict.id,
          observedPrice,
          observedCurrency,
          mismatchDetails: {
            expectedInstrument: expectedSymbol,
            observedSource: observedData.sourceApplicationName || 'Selected Window',
            observedSymbol: conflict.id,
            observedPrice,
            action: `INSTRUMENT MISMATCH\nSelected: ${expectedSymbol}\nObserved: ${conflict.name}\nMonitoring cannot start with mismatched instrument. Please switch to the correct chart window.`
          }
        };
      }
    }

    // Check price presence - Zero price assumptions!
    // What price is actually visible on the selected live source?
    if (observedPrice === null || observedPrice <= 0) {
      return {
        isValid: false,
        status: 'WAITING',
        reason: 'INSUFFICIENT VISUAL DATA: Price reading pending. Verify that the price scale is visible or enter visible price in verification preview.',
        observedPrice: null,
        observedCurrency
      };
    }

    // Valid identity and live price observed
    const currencyDisplay = observedCurrency ? ` ${observedCurrency}` : '';
    return {
      isValid: true,
      status: 'VALID',
      reason: `Live data verified from ${sourceConfig.applicationName}. Observed price: ${observedPrice}${currencyDisplay}.`,
      observedPrice,
      observedCurrency,
      baseCurrency: observedData.baseCurrency,
      quoteCurrency: observedData.quoteCurrency,
      detectedSymbol: detectedSymbol || expectedSymbol
    };
  }

  /**
   * Helper to build a clean SourceValidationState for UI presentation
   */
  public static createValidationState(
    sourceConfig: MonitoringSourceConfig,
    observedData: RawObservedMarketData | null,
    hasUserConfirmed = false
  ): SourceValidationState {
    const result = this.validate(sourceConfig, observedData, hasUserConfirmed);

    return {
      status: result.status,
      application: sourceConfig.applicationName,
      windowTitle: sourceConfig.windowTitle,
      instrument: sourceConfig.instrumentName,
      timeframe: sourceConfig.timeframe,
      observedPrice: result.observedPrice,
      observedCurrency: result.observedCurrency,
      baseCurrency: result.baseCurrency,
      quoteCurrency: result.quoteCurrency,
      observedTimestamp: observedData?.observedTimestamp || null,
      freshness: observedData?.freshness || 'WAITING_FOR_DATA',
      captureStatus: observedData ? 'ACTIVE' : 'INACTIVE',
      confidence: observedData?.priceConfidence || 'UNAVAILABLE',
      details: result.reason,
      hasUserConfirmed,
      detectedSymbol: result.detectedSymbol,
      mismatchReason: result.mismatchDetails?.action,
      sourceEvidence: observedData?.sourceEvidence
    };
  }
}
