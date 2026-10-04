/**
 * TRADYX Currency & Forex Pair Detection Utility
 * 
 * Dynamically detects currency symbols, currency codes, and Forex base/quote pairs
 * from live chart labels, window titles, scales, and metadata.
 * 
 * Principles:
 * - Never globally assumes GOLD = USD or NIFTY = INR or Forex = USD.
 * - Extracts base and quote currencies directly from pair conventions (e.g. EUR/USD, USD/JPY, XAU/EUR).
 * - Manages optional Display Currency override without mutating underlying observed values.
 */

export interface CurrencyDetectionResult {
  detectedCurrency: string | null;
  baseCurrency: string | null;
  quoteCurrency: string | null;
  evidence: 'SYMBOL_TEXT' | 'SCALE_LABEL' | 'PLATFORM_METADATA' | 'NONE';
  confidence: number;
}

export type DisplayCurrencyOption = 'AUTO' | 'USD' | 'EUR' | 'GBP' | 'INR' | 'JPY' | 'AUD' | 'CAD' | 'CHF';

export class CurrencyDetection {
  // Approximate conversion rates against USD for optional DISPLAY OVERRIDE only
  // Source values are NEVER overwritten by these rates.
  private static readonly INDICATIVE_RATES_TO_USD: Record<string, number> = {
    USD: 1.0,
    EUR: 1.085,
    GBP: 1.295,
    INR: 0.0118, // 1 USD ≈ 84.75 INR
    JPY: 0.0065, // 1 USD ≈ 153.8 JPY
    AUD: 0.655,
    CAD: 0.725,
    CHF: 1.135
  };

  /**
   * Dynamically analyzes text from chart headers, window titles, and scale labels
   */
  public static detectCurrency(
    symbol: string,
    windowTitle?: string,
    rawLabels: string[] = []
  ): CurrencyDetectionResult {
    const combined = `${symbol} ${windowTitle || ''} ${rawLabels.join(' ')}`.toUpperCase();

    // 1. Forex pair pattern: e.g. EUR/USD, EURUSD, USD/JPY, XAU/USD, XAU/EUR, GBP/JPY
    const pairRegex = /\b([A-Z]{3})[\/_ -]?([A-Z]{3})\b/;
    const pairMatch = combined.match(pairRegex);

    if (pairMatch) {
      const base = pairMatch[1];
      const quote = pairMatch[2];

      // Known currencies
      const KNOWN_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF', 'NZD', 'SGD', 'HKD', 'CNY'];
      if (KNOWN_CURRENCIES.includes(quote)) {
        return {
          detectedCurrency: quote,
          baseCurrency: base,
          quoteCurrency: quote,
          evidence: 'SYMBOL_TEXT',
          confidence: 0.95
        };
      }
    }

    // 2. Explicit currency symbols in text
    if (combined.includes('₹') || combined.includes('INR')) {
      return {
        detectedCurrency: 'INR',
        baseCurrency: null,
        quoteCurrency: 'INR',
        evidence: 'SCALE_LABEL',
        confidence: 0.9
      };
    }
    if (combined.includes('€') || combined.includes('EUR')) {
      return {
        detectedCurrency: 'EUR',
        baseCurrency: null,
        quoteCurrency: 'EUR',
        evidence: 'SCALE_LABEL',
        confidence: 0.9
      };
    }
    if (combined.includes('£') || combined.includes('GBP')) {
      return {
        detectedCurrency: 'GBP',
        baseCurrency: null,
        quoteCurrency: 'GBP',
        evidence: 'SCALE_LABEL',
        confidence: 0.9
      };
    }
    if (combined.includes('¥') || combined.includes('JPY')) {
      return {
        detectedCurrency: 'JPY',
        baseCurrency: null,
        quoteCurrency: 'JPY',
        evidence: 'SCALE_LABEL',
        confidence: 0.9
      };
    }
    if (combined.includes('C$') || combined.includes('CAD')) {
      return {
        detectedCurrency: 'CAD',
        baseCurrency: null,
        quoteCurrency: 'CAD',
        evidence: 'SCALE_LABEL',
        confidence: 0.85
      };
    }
    if (combined.includes('A$') || combined.includes('AUD')) {
      return {
        detectedCurrency: 'AUD',
        baseCurrency: null,
        quoteCurrency: 'AUD',
        evidence: 'SCALE_LABEL',
        confidence: 0.85
      };
    }
    if (combined.includes('$') || combined.includes('USD')) {
      return {
        detectedCurrency: 'USD',
        baseCurrency: null,
        quoteCurrency: 'USD',
        evidence: 'SCALE_LABEL',
        confidence: 0.85
      };
    }

    // 3. Known index/equity convention heuristic as fallback only if visible
    if (combined.includes('NIFTY') || combined.includes('NSE') || combined.includes('BSE')) {
      return {
        detectedCurrency: 'INR',
        baseCurrency: null,
        quoteCurrency: 'INR',
        evidence: 'PLATFORM_METADATA',
        confidence: 0.8
      };
    }

    return {
      detectedCurrency: null,
      baseCurrency: null,
      quoteCurrency: null,
      evidence: 'NONE',
      confidence: 0.0
    };
  }

  /**
   * Calculates optional Display Currency conversion while preserving observed source value
   */
  public static calculateDisplayPrice(
    sourcePrice: number | null,
    sourceCurrency: string | null,
    displayCurrency: DisplayCurrencyOption
  ): {
    displayPrice: number | null;
    displayCurrency: string;
    isConverted: boolean;
  } {
    if (sourcePrice === null || !sourceCurrency || displayCurrency === 'AUTO') {
      return {
        displayPrice: sourcePrice,
        displayCurrency: sourceCurrency || 'AUTO',
        isConverted: false
      };
    }

    if (sourceCurrency.toUpperCase() === displayCurrency.toUpperCase()) {
      return {
        displayPrice: sourcePrice,
        displayCurrency: sourceCurrency,
        isConverted: false
      };
    }

    const srcRate = this.INDICATIVE_RATES_TO_USD[sourceCurrency.toUpperCase()] || 1.0;
    const targetRate = this.INDICATIVE_RATES_TO_USD[displayCurrency.toUpperCase()] || 1.0;

    // Price in USD = sourcePrice * srcRate
    // Price in Target = (sourcePrice * srcRate) / targetRate
    const inUsd = sourcePrice * srcRate;
    const converted = inUsd / targetRate;

    // Format precision based on currency
    const precision = displayCurrency === 'JPY' ? 0 : displayCurrency === 'INR' ? 2 : 2;
    const rounded = Number(converted.toFixed(precision));

    return {
      displayPrice: rounded,
      displayCurrency: displayCurrency,
      isConverted: true
    };
  }
}
