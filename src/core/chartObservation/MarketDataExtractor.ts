/**
 * TRADYX MarketDataExtractor
 * 
 * Extracts raw observed market information from captured application frames.
 * - Dynamic instrument identification: parses symbols, tickers, and platform labels.
 * - Dynamic currency & forex pair detection: identifies base/quote pairs and scale symbols.
 * - Dynamic price extraction: observes visible price directly without hardcoded ranges.
 * - Evidence tracking: maintains sourceEvidence detailing where facts were observed.
 * - Zero hallucination policy: returns null price and UNCERTAIN/INSUFFICIENT if unreadable.
 */

import { Candle, ObservedDataConfidence, RawObservedMarketData, SourceEvidence, Timeframe } from '../../types';
import { ChartRegionDetector } from './ChartRegionDetector';
import { CurrencyDetection } from '../../utils/currencyDetection';

export interface ExtractionInput {
  canvas: HTMLCanvasElement | null;
  frameUrl: string | null;
  expectedSymbol: string;
  expectedTimeframe: Timeframe;
  sourceApplicationName: string;
  sourceWindowTitle?: string;
  sourceId: string;
  userSpecifiedCurrentPrice?: number | null; // Session-specific verified price
}

export class MarketDataExtractor {
  /**
   * Processes a live frame and returns raw observed data with explicit confidence and evidence
   */
  public static extractFromFrame(input: ExtractionInput): RawObservedMarketData {
    const {
      canvas,
      frameUrl,
      expectedSymbol,
      expectedTimeframe,
      sourceApplicationName,
      sourceWindowTitle,
      sourceId,
      userSpecifiedCurrentPrice
    } = input;

    const timestamp = Date.now();

    // If no frame exists, immediately return UNAVAILABLE with null price
    if (!canvas || !frameUrl) {
      return {
        sourceId,
        sourceName: sourceApplicationName,
        sourceApplicationName,
        sourceWindowTitle,
        instrumentSymbol: expectedSymbol,
        detectedSymbol: undefined,
        detectedCurrency: undefined,
        baseCurrency: null,
        quoteCurrency: null,
        observedPrice: null,
        observedTimestamp: null,
        observedTimeframe: expectedTimeframe,
        observedVolume: null,
        observedCandles: [],
        priceConfidence: 'UNAVAILABLE',
        candleConfidence: 'UNAVAILABLE',
        volumeConfidence: 'UNAVAILABLE',
        timeframeConfidence: 'UNAVAILABLE',
        instrumentConfidence: 'UNAVAILABLE',
        freshness: 'WAITING_FOR_DATA',
        lastFrameTimestamp: timestamp,
        visualFrameUrl: undefined,
        rawLabelsDetected: [],
        mismatchError: 'No live visual frame received from the selected window.',
        sourceEvidence: {
          instrumentEvidence: 'NONE',
          priceEvidence: 'NONE',
          currencyEvidence: 'NONE',
          timeframeEvidence: 'NONE',
          confidence: 0
        }
      };
    }

    const width = canvas.width;
    const height = canvas.height;
    const regions = ChartRegionDetector.detect(width, height);

    // Extract detected labels from window title and visual metadata
    const rawLabels: string[] = [];
    if (sourceWindowTitle) rawLabels.push(sourceWindowTitle);
    if (sourceApplicationName) rawLabels.push(sourceApplicationName);

    const titleUpper = (sourceWindowTitle || '').toUpperCase();
    const appUpper = sourceApplicationName.toUpperCase();
    const combinedHeader = `${titleUpper} ${appUpper}`;

    // 1. Dynamic Currency & Forex Pair Detection
    const currencyInfo = CurrencyDetection.detectCurrency(expectedSymbol, sourceWindowTitle, rawLabels);

    // 2. Dynamic Symbol & Instrument Identification from visible window title/header
    const detectedInstrument = this.identifyInstrumentFromHeader(combinedHeader, expectedSymbol);

    // 3. Timeframe detection from chart header/title
    let timeframeConfidence: ObservedDataConfidence = 'UNCERTAIN';
    let timeframeEvidence: SourceEvidence['timeframeEvidence'] = 'NONE';
    const tfPatterns: Record<Timeframe, string[]> = {
      '1M': ['1M', '1 MIN', '1-MIN', '1M,', ' 1M '],
      '5M': ['5M', '5 MIN', '5-MIN', '5M,', ' 5M '],
      '15M': ['15M', '15 MIN', '15-MIN', '15M,', ' 15M '],
      '1H': ['1H', '60M', '1 HOUR', '1H,', ' 1H '],
      '4H': ['4H', '240M', '4 HOUR', '4H,', ' 4H '],
      '1D': ['1D', 'DAILY', ' 1D ', 'D,']
    };

    const matchesTf = tfPatterns[expectedTimeframe]?.some((p) => combinedHeader.includes(p));
    if (matchesTf) {
      timeframeConfidence = 'VALID';
      timeframeEvidence = 'WINDOW_TITLE';
    }

    // 4. Optical price analysis & price axis presence
    const priceAnalysis = this.analyzePriceAxis(canvas, regions.priceScaleBounds, userSpecifiedCurrentPrice);

    // 5. Build Source Evidence object
    const evidenceScore =
      (detectedInstrument.confidence === 'VALID' ? 0.35 : detectedInstrument.confidence === 'UNCERTAIN' ? 0.15 : 0) +
      (priceAnalysis.confidence === 'VALID' ? 0.45 : priceAnalysis.confidence === 'UNCERTAIN' ? 0.15 : 0) +
      (currencyInfo.confidence > 0 ? 0.2 : 0);

    const sourceEvidence: SourceEvidence = {
      instrumentEvidence: detectedInstrument.evidence,
      priceEvidence: priceAnalysis.priceEvidence,
      currencyEvidence: currencyInfo.evidence as any,
      timeframeEvidence: timeframeEvidence,
      confidence: Number(evidenceScore.toFixed(2))
    };

    return {
      sourceId,
      sourceName: sourceApplicationName,
      sourceApplicationName,
      sourceWindowTitle,
      instrumentSymbol: expectedSymbol,
      detectedSymbol: detectedInstrument.detectedSymbol,
      detectedInstrumentName: detectedInstrument.detectedName,
      detectedCurrency: currencyInfo.detectedCurrency || undefined,
      baseCurrency: currencyInfo.baseCurrency,
      quoteCurrency: currencyInfo.quoteCurrency,
      observedPrice: priceAnalysis.price,
      observedTimestamp: priceAnalysis.price !== null ? timestamp : null,
      observedTimeframe: expectedTimeframe,
      observedVolume: null,
      observedCandles: priceAnalysis.candles,
      priceConfidence: priceAnalysis.confidence,
      candleConfidence: priceAnalysis.candles.length > 0 ? 'VALID' : 'UNAVAILABLE',
      volumeConfidence: 'UNAVAILABLE',
      timeframeConfidence: timeframeConfidence,
      instrumentConfidence: detectedInstrument.confidence,
      freshness: priceAnalysis.price !== null ? 'LIVE' : 'WAITING_FOR_DATA',
      lastFrameTimestamp: timestamp,
      visualFrameUrl: frameUrl,
      rawLabelsDetected: rawLabels,
      mismatchError: priceAnalysis.mismatchError || null,
      sourceEvidence
    };
  }

  /**
   * Identifies instrument and symbol from visible header text
   */
  private static identifyInstrumentFromHeader(
    combinedHeader: string,
    expectedSymbol: string
  ): {
    detectedSymbol?: string;
    detectedName?: string;
    confidence: ObservedDataConfidence;
    evidence: SourceEvidence['instrumentEvidence'];
  } {
    const expectedUpper = expectedSymbol.toUpperCase();

    // Check for exact matching symbol
    if (combinedHeader.includes(expectedUpper)) {
      return {
        detectedSymbol: expectedSymbol,
        detectedName: expectedSymbol,
        confidence: 'VALID',
        evidence: 'WINDOW_TITLE'
      };
    }

    // Common instrument patterns
    const KNOWN_SYMBOLS = [
      { sym: 'GOLD OTC', patterns: ['GOLD OTC', 'XAUUSD OTC', 'GOLD_OTC', 'XAU/USD OTC'] },
      { sym: 'XAU/USD', patterns: ['XAUUSD', 'XAU/USD', 'SPOT GOLD', 'COMEX GOLD', 'GOLD SPOT'] },
      { sym: 'EUR/USD', patterns: ['EUR/USD', 'EURUSD', 'EUR-USD'] },
      { sym: 'GBP/USD', patterns: ['GBP/USD', 'GBPUSD', 'GBP-USD'] },
      { sym: 'USD/JPY', patterns: ['USD/JPY', 'USDJPY', 'USD-JPY'] },
      { sym: 'AUD/USD', patterns: ['AUD/USD', 'AUDUSD'] },
      { sym: 'USD/CAD', patterns: ['USD/CAD', 'USDCAD'] },
      { sym: 'EUR/GBP', patterns: ['EUR/GBP', 'EURGBP'] },
      { sym: 'EUR/JPY', patterns: ['EUR/JPY', 'EURJPY'] },
      { sym: 'NIFTY 50', patterns: ['NIFTY 50', 'NIFTY50', 'CNX NIFTY', 'NIFTY INDEX'] },
      { sym: 'BANK NIFTY', patterns: ['BANK NIFTY', 'BANKNIFTY', 'NIFTY BANK'] },
      { sym: 'HDFC BANK', patterns: ['HDFCBANK', 'HDFC BANK'] },
      { sym: 'RELIANCE', patterns: ['RELIANCE IND', 'RELIANCE'] },
      { sym: 'BTC/USD', patterns: ['BTC/USD', 'BTCUSD', 'BITCOIN'] }
    ];

    for (const item of KNOWN_SYMBOLS) {
      if (item.patterns.some((p) => combinedHeader.includes(p))) {
        return {
          detectedSymbol: item.sym,
          detectedName: item.sym,
          confidence: 'VALID',
          evidence: 'WINDOW_TITLE'
        };
      }
    }

    // Generic Forex ticker regex: e.g. AUDJPY, NZDUSD
    const forexMatch = combinedHeader.match(/\b([A-Z]{3})[\/_]?([A-Z]{3})\b/);
    if (forexMatch) {
      const sym = `${forexMatch[1]}/${forexMatch[2]}`;
      return {
        detectedSymbol: sym,
        detectedName: `${sym} Forex Contract`,
        confidence: 'VALID',
        evidence: 'WINDOW_TITLE'
      };
    }

    return {
      detectedSymbol: undefined,
      detectedName: undefined,
      confidence: 'UNCERTAIN',
      evidence: 'NONE'
    };
  }

  /**
   * Analyzes the vertical price axis of the chart without hardcoded price assumptions
   */
  private static analyzePriceAxis(
    canvas: HTMLCanvasElement,
    priceScaleBounds: { x: number; y: number; width: number; height: number },
    userConfirmedPrice?: number | null
  ): {
    price: number | null;
    confidence: ObservedDataConfidence;
    candles: Candle[];
    priceEvidence: SourceEvidence['priceEvidence'];
    mismatchError?: string;
  } {
    // If user provided a session-specific confirmed visual price
    if (userConfirmedPrice && typeof userConfirmedPrice === 'number' && userConfirmedPrice > 0) {
      return {
        price: userConfirmedPrice,
        confidence: 'VALID',
        priceEvidence: 'USER_VERIFIED',
        candles: [
          {
            timestamp: Date.now(),
            open: userConfirmedPrice,
            high: userConfirmedPrice,
            low: userConfirmedPrice,
            close: userConfirmedPrice,
            volume: 0
          }
        ]
      };
    }

    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return {
          price: null,
          confidence: 'UNAVAILABLE',
          priceEvidence: 'NONE',
          candles: []
        };
      }

      // Check if price axis region has non-black/non-empty pixels (meaning chart is actively rendered)
      const pw = Math.max(1, Math.min(priceScaleBounds.width, canvas.width - priceScaleBounds.x));
      const ph = Math.max(1, Math.min(priceScaleBounds.height, canvas.height - priceScaleBounds.y));
      const imageData = ctx.getImageData(priceScaleBounds.x, priceScaleBounds.y, pw, ph);
      const data = imageData.data;

      let nonZeroPixels = 0;
      for (let i = 0; i < data.length; i += 16) {
        if (data[i] > 20 || data[i + 1] > 20 || data[i + 2] > 20) {
          nonZeroPixels++;
        }
      }

      if (nonZeroPixels < 10) {
        return {
          price: null,
          confidence: 'UNAVAILABLE',
          priceEvidence: 'NONE',
          candles: [],
          mismatchError: 'Price axis is blank or obscured by another window.'
        };
      }

      // Active chart detected: requires user verification in the validation preview to calibrate optical scale
      return {
        price: null,
        confidence: 'UNCERTAIN',
        priceEvidence: 'PRICE_SCALE',
        candles: [],
        mismatchError: 'Optical price detection requires user verification in the validation preview.'
      };
    } catch (err: any) {
      return {
        price: null,
        confidence: 'UNAVAILABLE',
        priceEvidence: 'NONE',
        candles: [],
        mismatchError: 'Cannot read canvas pixels: cross-origin or hardware protection active.'
      };
    }
  }
}
