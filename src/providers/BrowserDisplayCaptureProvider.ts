/**
 * TRADYX BrowserDisplayCaptureProvider
 * 
 * Implements ChartCaptureProvider using the standard browser getDisplayMedia API.
 * 
 * Principles:
 * - Product-level messaging only. No development-environment terminology.
 * - If unsupported, reports state UNSUPPORTED honestly without pretending.
 * - Extracts observed symbols, prices, and timeframes without hardcoded expectations.
 * - Never invents prices if the window is unreadable or obscured.
 */

import {
  ChartCaptureProvider,
  InstrumentMetadata,
  MarketDataCallback,
  NormalizedMarketData,
  ProviderLifecycleState,
  ProviderType,
  StateChangeCallback,
  TimeframeOption
} from './types';
import { WindowCaptureManager } from '../core/chartObservation/WindowCaptureManager';
import { MarketDataExtractor } from '../core/chartObservation/MarketDataExtractor';

export class BrowserDisplayCaptureProvider implements ChartCaptureProvider {
  public readonly id = 'browser-display-capture';
  public readonly name = 'Authorized Browser Window / Screen Capture';
  public readonly type: ProviderType = 'BROWSER_CAPTURE';
  public readonly supportedPlatforms: ('WEB' | 'WINDOWS' | 'ANDROID')[] = ['WEB', 'WINDOWS'];
  public readonly authenticationMethod = 'USER_PERMISSION' as const;
  public readonly isImplemented = true;

  private state: ProviderLifecycleState = 'DISCONNECTED';
  private details = 'Ready to authorize chart window capture.';
  private listeners = new Set<StateChangeCallback>();
  private subscriptions = new Map<string, { timeframe: string; callback: MarketDataCallback }>();

  private captureManager: WindowCaptureManager;
  private unsubscribeFrameListener: (() => void) | null = null;
  private unsubscribeDisconnectListener: (() => void) | null = null;
  private connectionId = '';

  constructor() {
    this.captureManager = WindowCaptureManager.getInstance();
    this.checkInitialCapability();
  }

  private checkInitialCapability() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      this.state = 'UNSUPPORTED';
      this.details = 'Window capture is not available on this platform.';
      return;
    }

    const hasMedia = Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function');
    if (!hasMedia) {
      this.state = 'UNSUPPORTED';
      this.details = 'Window capture is not supported by the current browser runtime.';
    } else {
      this.state = 'DISCONNECTED';
      this.details = 'Ready to select chart window.';
    }
  }

  public getState(): ProviderLifecycleState {
    return this.state;
  }

  public getDetails(): string {
    return this.details;
  }

  public isAvailableOnPlatform(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    return Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function');
  }

  public onStateChange(callback: StateChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private setState(newState: ProviderLifecycleState, details?: string) {
    this.state = newState;
    if (details) this.details = details;
    this.listeners.forEach((cb) => cb(newState, details));
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.captureManager.getCanvas();
  }

  public getCapturedWindowName(): string | null {
    const meta = this.captureManager.getMetadata();
    return meta ? `${meta.applicationName} - ${meta.windowTitle}` : null;
  }

  public async connect(): Promise<boolean> {
    if (!this.isAvailableOnPlatform()) {
      this.setState('UNSUPPORTED', 'Window capture is unavailable in the current browser environment.');
      return false;
    }

    this.setState('AUTHORIZING', 'Awaiting window selection in system dialog...');
    const result = await this.captureManager.requestWindowCapture();

    if (!result.success) {
      this.setState('ERROR', result.error || 'Unable to connect to the selected market window.');
      return false;
    }

    this.connectionId = `browser-cap-${Date.now()}`;
    this.setState('CONNECTED', 'Chart window authorized.');
    this.setState('LIVE', 'Observing live chart stream.');
    this.attachCaptureListeners();
    return true;
  }

  public async requestWindowCapture(): Promise<boolean> {
    return this.connect();
  }

  private attachCaptureListeners() {
    if (this.unsubscribeFrameListener) this.unsubscribeFrameListener();
    if (this.unsubscribeDisconnectListener) this.unsubscribeDisconnectListener();

    this.unsubscribeFrameListener = this.captureManager.onFrame((frameUrl) => {
      this.processFrame(frameUrl);
    });

    this.unsubscribeDisconnectListener = this.captureManager.onDisconnect(() => {
      this.setState('DISCONNECTED', 'Capture window was closed or stopped.');
    });
  }

  private processFrame(frameUrl: string) {
    const canvas = this.captureManager.getCanvas();
    const metadata = this.captureManager.getMetadata();
    const appName = metadata?.applicationName || 'Application Window';
    const windowTitle = metadata?.windowTitle || 'Captured Chart';

    for (const [symbol, sub] of this.subscriptions.entries()) {
      const extracted = MarketDataExtractor.extractFromFrame({
        canvas,
        frameUrl,
        expectedSymbol: symbol,
        expectedTimeframe: sub.timeframe as any,
        sourceApplicationName: appName,
        sourceWindowTitle: windowTitle,
        sourceId: this.id
      });

      const normalized: NormalizedMarketData = {
        source: {
          providerId: this.id,
          providerName: this.name,
          connectionId: this.connectionId,
          connectionState: this.state
        },
        instrument: {
          symbol: extracted.detectedSymbol || symbol,
          sourceSymbol: extracted.detectedSymbol || symbol,
          displayName: extracted.detectedInstrumentName || symbol,
          assetClass: 'UNKNOWN',
          exchange: appName,
          baseCurrency: extracted.baseCurrency,
          quoteCurrency: extracted.quoteCurrency
        },
        timeframe: {
          interval: sub.timeframe,
          sourceInterval: extracted.observedTimeframe
        },
        marketData: {
          timestamp: extracted.observedTimestamp || Date.now(),
          ltp: extracted.observedPrice,
          open: extracted.observedPrice,
          high: extracted.observedPrice,
          low: extracted.observedPrice,
          close: extracted.observedPrice,
          last: extracted.observedPrice,
          volume: extracted.observedVolume
        },
        currency: {
          sourceCurrency: extracted.detectedCurrency || 'USD',
          displayCurrency: 'USD'
        },
        quality: {
          freshness: extracted.observedPrice !== null ? 'LIVE' : 'STALE',
          completeness: extracted.observedPrice !== null ? 'COMPLETE' : 'INSUFFICIENT',
          sourceConfidence: extracted.priceConfidence === 'VALID' ? 'VALID' : extracted.priceConfidence === 'UNCERTAIN' ? 'UNCERTAIN' : 'UNAVAILABLE',
          observationConfidence: extracted.priceConfidence
        }
      };

      sub.callback(normalized);
    }
  }

  public async disconnect(): Promise<void> {
    if (this.unsubscribeFrameListener) {
      this.unsubscribeFrameListener();
      this.unsubscribeFrameListener = null;
    }
    if (this.unsubscribeDisconnectListener) {
      this.unsubscribeDisconnectListener();
      this.unsubscribeDisconnectListener = null;
    }
    this.captureManager.stopCapture();
    this.subscriptions.clear();
    this.setState('DISCONNECTED', 'Window capture stopped.');
  }

  public async discoverInstruments(): Promise<InstrumentMetadata[]> {
    const meta = this.captureManager.getMetadata();
    if (!meta) return [];

    return [
      {
        symbol: meta.windowTitle.split(/[\s\-|:]+/)[0] || 'OBSERVED',
        displayName: meta.windowTitle,
        assetClass: 'UNKNOWN',
        exchange: meta.applicationName,
        pricePrecision: 2,
        tickSize: 0.01,
        tradingStatus: 'TRADING'
      }
    ];
  }

  public async discoverTimeframes(_symbol?: string): Promise<TimeframeOption[]> {
    return [
      { id: '1M', label: '1 Minute (1M)', intervalMinutes: 1, isSupported: true },
      { id: '5M', label: '5 Minutes (5M)', intervalMinutes: 5, isSupported: true },
      { id: '15M', label: '15 Minutes (15M)', intervalMinutes: 15, isSupported: true },
      { id: '1H', label: '1 Hour (1H)', intervalMinutes: 60, isSupported: true },
      { id: '4H', label: '4 Hours (4H)', intervalMinutes: 240, isSupported: true },
      { id: '1D', label: '1 Day (1D)', intervalMinutes: 1440, isSupported: true }
    ];
  }

  public subscribe(symbol: string, timeframe: string, onData: MarketDataCallback): void {
    this.subscriptions.set(symbol, { timeframe, callback: onData });
  }

  public unsubscribe(symbol: string, _timeframe?: string): void {
    this.subscriptions.delete(symbol);
  }
}
