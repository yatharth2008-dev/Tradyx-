/**
 * TRADYX ProviderRegistry
 * 
 * Central registry for all Market Data & Capture Providers.
 * Dynamically discovers providers available in the current runtime environment.
 * Enforces truthful connection lifecycle states.
 */

import {
  ChartCaptureProvider,
  MarketDataProvider,
  ProviderLifecycleState,
  ProviderType
} from './types';
import { BrowserDisplayCaptureProvider } from './BrowserDisplayCaptureProvider';
import { BinancePublicMarketDataProvider } from './BinancePublicMarketDataProvider';
import { UpstoxMarketDataProvider } from './UpstoxMarketDataProvider';
import { AngelOneMarketDataProvider } from './AngelOneMarketDataProvider';
import { GrowwMarketDataProvider } from './GrowwMarketDataProvider';
import { MEXCMarketDataProvider } from './MEXCMarketDataProvider';
import { ExnessMarketDataProvider } from './ExnessMarketDataProvider';
import { MetaTrader5BridgeProvider } from './MetaTrader5BridgeProvider';
import { LocalRelayStreamingProvider } from './LocalRelayStreamingProvider';
import { WindowsNativeCaptureProvider } from './WindowsNativeCaptureProvider';
import { AndroidNativeCaptureProvider } from './AndroidNativeCaptureProvider';

export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers = new Map<string, MarketDataProvider>();
  private activeProvider: MarketDataProvider | null = null;

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  private registerDefaults() {
    // 1. Indian Broker APIs (Real Market Data Feeds)
    this.registerProvider(new UpstoxMarketDataProvider());
    this.registerProvider(new AngelOneMarketDataProvider());
    this.registerProvider(new GrowwMarketDataProvider());

    // 2. Global Crypto (MEXC Spot & Futures) & Public feeds
    this.registerProvider(new MEXCMarketDataProvider());
    this.registerProvider(new BinancePublicMarketDataProvider());

    // 3. Forex & Multi-Asset Broker (Exness / MT5)
    this.registerProvider(new ExnessMarketDataProvider());
    this.registerProvider(new MetaTrader5BridgeProvider());

    // 4. Browser Window/Screen Capture
    this.registerProvider(new BrowserDisplayCaptureProvider());

    // 5. Local Streaming Ingest
    this.registerProvider(new LocalRelayStreamingProvider());

    // 6. Platform-specific Native Capture Providers
    this.registerProvider(new WindowsNativeCaptureProvider());
    this.registerProvider(new AndroidNativeCaptureProvider());
  }

  public registerProvider(provider: MarketDataProvider) {
    this.providers.set(provider.id, provider);
  }

  public getProvider(id: string): MarketDataProvider | undefined {
    return this.providers.get(id);
  }

  public getAllProviders(): MarketDataProvider[] {
    return Array.from(this.providers.values());
  }

  public getAvailableProviders(): MarketDataProvider[] {
    return this.getAllProviders().filter((p) => p.isAvailableOnPlatform());
  }

  public getProvidersByType(type: ProviderType): MarketDataProvider[] {
    return this.getAllProviders().filter((p) => p.type === type);
  }

  public getActiveProvider(): MarketDataProvider | null {
    return this.activeProvider;
  }

  public setActiveProvider(id: string): MarketDataProvider | null {
    const provider = this.providers.get(id);
    if (!provider) return null;
    this.activeProvider = provider;
    return provider;
  }
}
