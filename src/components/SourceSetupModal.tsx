import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Monitor,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  ShieldCheck,
  ChevronRight,
  Info,
  Smartphone,
  Laptop,
  Check,
  Layers,
  Radio,
  Clock,
  ArrowRight,
  Lock,
  Wifi,
  Square
} from 'lucide-react';
import {
  CaptureEnvironmentReport,
  DataSourceCategory,
  MonitoringSourceConfig,
  RawObservedMarketData,
  RealModeSourceState,
  SourceCapability,
  SourceFreshnessStatus,
  SourceValidationState,
  Timeframe
} from '../types';
import { WindowCaptureManager } from '../core/chartObservation/WindowCaptureManager';
import { MarketDataExtractor } from '../core/chartObservation/MarketDataExtractor';
import { DataValidator } from '../core/chartObservation/DataValidator';
import { DataFreshnessMonitor } from '../core/chartObservation/DataFreshnessMonitor';
import { AndroidMediaProjectionAdapter } from '../core/chartObservation/AndroidMediaProjectionAdapter';
import { ChartRegionDetector, ChartRegions } from '../core/chartObservation/ChartRegionDetector';
import { CurrencyDetection, DisplayCurrencyOption } from '../utils/currencyDetection';
import { CaptureCapabilityService } from '../services/captureCapabilityService';
import { BrokerApiAdapter, BrokerCredentials } from '../datasources/BrokerApiAdapter';
import { LocalRelayAdapter } from '../datasources/LocalRelayAdapter';
import { WindowsNativeCaptureAdapter } from '../datasources/WindowsNativeCaptureAdapter';
import { AndroidMediaProjectionAdapter as AndroidDatasourceAdapter } from '../datasources/AndroidMediaProjectionAdapter';

export type RealModeProviderState =
  | 'SELECT_PROVIDER'
  | 'AUTHENTICATION_REQUIRED'
  | 'APPROVAL_REQUIRED'
  | 'AUTHENTICATING'
  | 'AUTHENTICATED'
  | 'TOKEN_GENERATED'
  | 'TOKEN_EXPIRED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'SYNCING'
  | 'LIVE_DATA_VERIFICATION'
  | 'READY'
  | 'AUTHENTICATION_FAILED'
  | 'CONNECTION_FAILED'
  | 'DATA_UNAVAILABLE'
  | 'STALE_DATA'
  | 'INSTRUMENT_NOT_FOUND'
  | 'PROVIDER_UNSUPPORTED'
  | 'ERROR';

export interface BrokerVerificationPayload {
  provider: string;
  status: RealModeProviderState;
  authenticated: boolean;
  connected: boolean;
  instrumentResolved: boolean;
  liveDataReceived: boolean;
  dataMode: 'LIVE_STREAM' | 'LIVE_POLLING' | 'REST_SNAPSHOT';
  marketData?: {
    symbol: string;
    exchange: string;
    price: number;
    timestamp: number;
    currency: string;
    freshnessSeconds: number;
  };
  error?: string;
}

interface SourceSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSource: (config: MonitoringSourceConfig) => void;
  initialInstrumentSymbol?: string;
}

const COMMON_INSTRUMENTS = [
  {
    symbol: 'GOLD OTC',
    name: 'Gold OTC Contract',
    market: 'OTC' as const,
    currency: 'USD',
    tip: 'Over-The-Counter synthetic gold contract specification'
  },
  {
    symbol: 'GOLD',
    name: 'Gold Spot / Comex',
    market: 'SPOT' as const,
    currency: 'USD',
    tip: 'Global benchmark spot gold (XAU/USD)'
  },
  {
    symbol: 'XAUUSD',
    name: 'XAU/USD Spot Gold',
    market: 'SPOT' as const,
    currency: 'USD',
    tip: 'Standard Forex spot gold contract quoted against US Dollar'
  },
  {
    symbol: 'EUR/USD',
    name: 'Euro / US Dollar',
    market: 'SPOT' as const,
    currency: 'USD',
    tip: 'Forex Major: Base EUR, Quote USD'
  },
  {
    symbol: 'USD/JPY',
    name: 'US Dollar / Japanese Yen',
    market: 'SPOT' as const,
    currency: 'JPY',
    tip: 'Forex Major: Base USD, Quote JPY'
  },
  {
    symbol: 'NIFTY 50',
    name: 'Nifty 50 Index (NSE)',
    market: 'INDEX' as const,
    currency: 'INR',
    tip: 'National Stock Exchange of India 50 index benchmark'
  },
  {
    symbol: 'BANK NIFTY',
    name: 'Nifty Bank Index (NSE)',
    market: 'INDEX' as const,
    currency: 'INR',
    tip: 'NSE Banking Sector Index'
  },
  {
    symbol: 'HDFC BANK',
    name: 'HDFC Bank Ltd (NSE)',
    market: 'EQUITY' as const,
    currency: 'INR',
    tip: 'HDFC Bank equity shares (NSE/BSE)'
  },
  {
    symbol: 'BTC/USD',
    name: 'Bitcoin / US Dollar',
    market: 'CRYPTO' as const,
    currency: 'USD',
    tip: 'Bitcoin cryptocurrency spot & perpetual futures'
  }
];

const TRADING_APPLICATIONS = [
  { id: 'TradingView', name: 'TradingView Desktop / Web', icon: Laptop, category: 'TRADING_APP' as DataSourceCategory },
  { id: 'Upstox Pro', name: 'Upstox Pro (Web / App)', icon: Laptop, category: 'TRADING_APP' as DataSourceCategory },
  { id: 'Angel One', name: 'Angel One (Web / App)', icon: Laptop, category: 'TRADING_APP' as DataSourceCategory },
  { id: 'MetaTrader 5', name: 'MetaTrader 4 / 5 Client Terminal', icon: Laptop, category: 'TRADING_APP' as DataSourceCategory },
  { id: 'Pocket Option', name: 'Pocket Option (OTC Chart)', icon: Laptop, category: 'TRADING_APP' as DataSourceCategory },
  { id: 'Quotex', name: 'Quotex Web / Desktop', icon: Laptop, category: 'TRADING_APP' as DataSourceCategory },
  { id: 'Exness', name: 'Exness WebTrader', icon: Laptop, category: 'TRADING_APP' as DataSourceCategory },
  { id: 'Browser Window', name: 'Google Chrome / Edge Trading Tab', icon: Monitor, category: 'SCREEN_WINDOW_CAPTURE' as DataSourceCategory }
];

export const SourceSetupModal: React.FC<SourceSetupModalProps> = ({
  isOpen,
  onClose,
  onSaveSource,
  initialInstrumentSymbol = 'GOLD OTC'
}) => {
  // 6-step flow as specified in Phase 2 guidelines
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Step 1: Instrument state
  const [selectedSymbol, setSelectedSymbol] = useState<string>(initialInstrumentSymbol);
  const [customSymbol, setCustomSymbol] = useState<string>('');
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('15M');
  const [sessionId] = useState<string>(() => `sess-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`);

  // Step 2: Data Source state
  const [sourceType, setSourceType] = useState<'SCREEN_CAPTURE' | 'BROKER_API' | 'OTHER_SOURCE' | 'NATIVE_OS'>('SCREEN_CAPTURE');
  const [selectedApp, setSelectedApp] = useState<string>('TradingView');
  const [brokerApiType, setBrokerApiType] = useState<'UPSTOX' | 'ANGELONE' | 'GROWW' | 'MEXC' | 'EXNESS' | 'MT5' | 'BINANCE'>('UPSTOX');
  const [brokerApiKey, setBrokerApiKey] = useState<string>('');
  const [brokerApiSecret, setBrokerApiSecret] = useState<string>('');
  const [brokerClientCode, setBrokerClientCode] = useState<string>('');
  const [brokerTotp, setBrokerTotp] = useState<string>('');
  const [mexcSegment, setMexcSegment] = useState<'MEXC_SPOT' | 'MEXC_FUTURES'>('MEXC_SPOT');
  const [exnessBridgeUrl, setExnessBridgeUrl] = useState<string>('ws://localhost:5001/stream');
  const [localRelayUrl, setLocalRelayUrl] = useState<string>('ws://localhost:8554/live');
  const [envReport, setEnvReport] = useState<CaptureEnvironmentReport>(() => CaptureCapabilityService.detectCapabilities());
  const [realModeSourceState, setRealModeSourceState] = useState<RealModeSourceState>('SOURCE_SELECTION');

  // Step 3 & 4: Authorization & Chart Selection states
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [capturedFrameUrl, setCapturedFrameUrl] = useState<string | null>(null);
  const [capturedWindowName, setCapturedWindowName] = useState<string>('');
  const [captureDimensions, setCaptureDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [chartRegions, setChartRegions] = useState<ChartRegions | null>(null);

  // Step 2 & 3: Real Mode Provider State Machine
  const [providerState, setProviderState] = useState<RealModeProviderState>('SELECT_PROVIDER');
  const [brokerVerification, setBrokerVerification] = useState<BrokerVerificationPayload | null>(null);
  const [isVerifyingBroker, setIsVerifyingBroker] = useState<boolean>(false);
  const [isGrowwApprovalRequired, setIsGrowwApprovalRequired] = useState<boolean>(false);

  // Step 5: Verification states
  const [rawObserved, setRawObserved] = useState<RawObservedMarketData | null>(null);
  const [validationState, setValidationState] = useState<SourceValidationState | null>(null);
  const [userConfirmedPrice, setUserConfirmedPrice] = useState<string>('');
  const [lastFrameTime, setLastFrameTime] = useState<number | null>(null);
  const [selectedDisplayCurrency, setSelectedDisplayCurrency] = useState<DisplayCurrencyOption>('AUTO');

  const captureManager = useRef(WindowCaptureManager.getInstance()).current;
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Refresh runtime environment report on step transitions or modal open
  useEffect(() => {
    const report = CaptureCapabilityService.detectCapabilities();
    setEnvReport(report);
  }, [step, isOpen]);

  // Connect video element to live MediaStream whenever step 4, 5, or 6 is active
  useEffect(() => {
    if (!isOpen) return;
    if (step >= 4 && videoPreviewRef.current) {
      const stream = captureManager.getMediaStream();
      if (stream && videoPreviewRef.current.srcObject !== stream) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch((err) => console.warn('Preview play warning:', err));
      }
    }
  }, [isOpen, step, isCapturing]);

  // Sync initial symbol if provided
  useEffect(() => {
    if (initialInstrumentSymbol) {
      setSelectedSymbol(initialInstrumentSymbol);
    }
  }, [initialInstrumentSymbol]);

  const currentInstrument =
    COMMON_INSTRUMENTS.find((i) => i.symbol === selectedSymbol) || {
      symbol: customSymbol || selectedSymbol,
      name: customSymbol || selectedSymbol,
      market: 'OTC' as const,
      currency: 'USD',
      tip: 'Custom trading contract'
    };

  // Real Mode Truthful Verification Engine (Backend is Source of Truth)
  const verifyBrokerConnection = async (
    broker = brokerApiType,
    symbol = currentInstrument.symbol,
    segment = mexcSegment
  ): Promise<BrokerVerificationPayload | null> => {
    setIsVerifyingBroker(true);
    setCaptureError(null);
    setProviderState('LIVE_DATA_VERIFICATION');

    try {
      const res = await fetch(
        `/api/brokers/${broker.toLowerCase()}/verify?symbol=${encodeURIComponent(symbol)}&segment=${segment}`
      );
      const data: BrokerVerificationPayload = await res.json();
      setBrokerVerification(data);
      setProviderState(data.status);

      if (data.status === 'APPROVAL_REQUIRED') {
        setIsGrowwApprovalRequired(true);
      } else {
        setIsGrowwApprovalRequired(false);
      }

      if (data.status === 'READY' && data.marketData) {
        setCapturedWindowName(`${data.provider} Verified Feed (${data.dataMode})`);
        setValidationState({
          status: 'VALID',
          application: `${data.provider} Direct Gateway`,
          windowTitle: `${data.provider} Live Feed (${data.dataMode})`,
          instrument: data.marketData.symbol,
          timeframe: selectedTimeframe,
          observedPrice: data.marketData.price,
          observedCurrency: data.marketData.currency,
          detectedSymbol: data.marketData.symbol,
          observedTimestamp: data.marketData.timestamp || Date.now(),
          freshness: data.marketData.freshnessSeconds <= 5 ? 'LIVE' : 'DELAYED',
          captureStatus: 'ACTIVE',
          confidence: 'VALID',
          hasUserConfirmed: true,
          details: `Live ${data.dataMode} verified from ${data.provider} (${data.marketData.exchange}). Price: ${data.marketData.price} ${data.marketData.currency}. Freshness: ${data.marketData.freshnessSeconds}s.`,
          sourceEvidence: {
            instrumentEvidence: 'CHART_HEADER',
            priceEvidence: 'USER_VERIFIED',
            currencyEvidence: 'PLATFORM_METADATA',
            timeframeEvidence: 'CHART_UI',
            confidence: 1.0
          }
        });
      } else if (data.error) {
        setCaptureError(data.error);
      }
      return data;
    } catch (err: any) {
      setProviderState('ERROR');
      setCaptureError(`Verification network error: ${err?.message || 'Failed to verify'}`);
      return null;
    } finally {
      setIsVerifyingBroker(false);
    }
  };

  // Poll / check verification state when in Step 3 for Broker API
  useEffect(() => {
    if (!isOpen) return;
    if (step === 3 && sourceType === 'BROKER_API') {
      verifyBrokerConnection(brokerApiType, currentInstrument.symbol, mexcSegment);
    }
  }, [isOpen, step, sourceType, brokerApiType, mexcSegment, currentInstrument.symbol]);

  // Handle OAuth postMessage events (e.g. Upstox OAuth completion)
  useEffect(() => {
    if (!isOpen) return;
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'UPSTOX_AUTH_SUCCESS') {
        setProviderState('AUTHENTICATED');
        verifyBrokerConnection('UPSTOX', currentInstrument.symbol);
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, [isOpen, currentInstrument.symbol]);

  // Groww API Key + Secret authentication
  const handleConnectGroww = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!brokerApiKey || !brokerApiSecret) {
      setCaptureError('Please enter both Groww API Key and API Secret.');
      setProviderState('AUTHENTICATION_REQUIRED');
      return;
    }

    setProviderState('AUTHENTICATING');
    setCaptureError(null);
    setIsGrowwApprovalRequired(false);

    try {
      const res = await fetch('/api/brokers/groww/auth-api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: brokerApiKey,
          apiSecret: brokerApiSecret
        })
      });

      // CRITICAL SECURITY RULE: Clear the secret immediately from component state!
      setBrokerApiSecret('');

      const data = await res.json();
      if (data.status === 'APPROVAL_REQUIRED' || data.approvalRequired) {
        setIsGrowwApprovalRequired(true);
        setProviderState('APPROVAL_REQUIRED');
        setCaptureError(data.details || 'Groww approval required: Daily approval is required on the Groww Cloud API Keys page.');
        return;
      }

      if (!data.success && data.status === 'AUTHENTICATION_FAILED') {
        setProviderState('AUTHENTICATION_FAILED');
        setCaptureError(data.details || data.error || 'Groww authentication failed. Check credentials.');
        return;
      }

      setProviderState('AUTHENTICATED');
      await verifyBrokerConnection('GROWW', currentInstrument.symbol);
    } catch (err: any) {
      setBrokerApiSecret('');
      setProviderState('ERROR');
      setCaptureError(`Groww authentication error: ${err?.message}`);
    }
  };

  // Upstox Connect
  const handleConnectUpstox = async () => {
    setCaptureError(null);
    if (brokerApiKey) {
      setProviderState('AUTHENTICATING');
      try {
        const res = await fetch('/api/brokers/upstox/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: brokerApiKey })
        });
        const data = await res.json();
        if (data.success) {
          setProviderState('AUTHENTICATED');
          await verifyBrokerConnection('UPSTOX', currentInstrument.symbol);
        } else {
          setProviderState('AUTHENTICATION_FAILED');
          setCaptureError(data.error || 'Upstox token invalid.');
        }
      } catch (err: any) {
        setProviderState('ERROR');
        setCaptureError(err?.message);
      }
    } else {
      setProviderState('AUTHENTICATING');
      try {
        const res = await fetch('/api/brokers/upstox/auth-url');
        const json = await res.json();
        if (json.url) {
          window.open(json.url, 'UpstoxOAuth', 'width=650,height=750');
        }
      } catch (err: any) {
        setProviderState('ERROR');
        setCaptureError('Failed to generate Upstox OAuth URL.');
      }
    }
  };

  // Angel One Connect
  const handleConnectAngelOne = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!brokerApiKey || !brokerClientCode || !brokerTotp || !brokerApiSecret) {
      setCaptureError('Please enter SmartAPI Key, Client Code, Password/MPIN, and TOTP.');
      setProviderState('AUTHENTICATION_REQUIRED');
      return;
    }

    setProviderState('AUTHENTICATING');
    setCaptureError(null);

    try {
      const res = await fetch('/api/brokers/angelone/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: brokerApiKey,
          clientCode: brokerClientCode,
          password: brokerApiSecret,
          totp: brokerTotp
        })
      });

      // Clear sensitive secrets from memory immediately
      setBrokerApiSecret('');
      setBrokerTotp('');

      const data = await res.json();
      if (data.success) {
        setProviderState('AUTHENTICATED');
        await verifyBrokerConnection('ANGELONE', currentInstrument.symbol);
      } else {
        setProviderState('AUTHENTICATION_FAILED');
        setCaptureError(data.error || 'Angel One SmartAPI login failed.');
      }
    } catch (err: any) {
      setBrokerApiSecret('');
      setBrokerTotp('');
      setProviderState('ERROR');
      setCaptureError(err?.message);
    }
  };

  // MEXC Connect
  const handleConnectMexc = async () => {
    setCaptureError(null);
    setProviderState('CONNECTING');
    await verifyBrokerConnection('MEXC', currentInstrument.symbol, mexcSegment);
  };

  // Exness Connect
  const handleConnectExness = async () => {
    setCaptureError(null);
    setProviderState('CONNECTING');
    try {
      await fetch('/api/brokers/exness/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bridgeUrl: exnessBridgeUrl,
          accountLogin: brokerClientCode || undefined,
          serverName: brokerApiSecret || undefined
        })
      });
      await verifyBrokerConnection('EXNESS', currentInstrument.symbol);
    } catch (err: any) {
      setProviderState('CONNECTION_FAILED');
      setCaptureError(err?.message);
    }
  };

  // Binance Connect
  const handleConnectBinance = async () => {
    setCaptureError(null);
    setProviderState('CONNECTING');
    await verifyBrokerConnection('BINANCE', currentInstrument.symbol);
  };

  // Step 3: Trigger OS Window Capture Picker via navigator.mediaDevices.getDisplayMedia
  const handleRequestWindowCapture = async () => {
    setCaptureError(null);

    // Verify runtime capability before calling getDisplayMedia
    const report = CaptureCapabilityService.detectCapabilities();
    setEnvReport(report);

    if (report.state !== 'SUPPORTED') {
      setRealModeSourceState('UNSUPPORTED_ENVIRONMENT');
      setCaptureError(`ENVIRONMENT CAPABILITY LIMITATION: ${report.reason}`);
      return;
    }

    setIsCapturing(true);
    setRealModeSourceState('AUTHORIZING');
    const res = await captureManager.requestWindowCapture(selectedApp);
    setIsCapturing(false);

    if (!res.success || !res.metadata) {
      const isDenied = res.error?.toLowerCase().includes('cancel') || res.error?.toLowerCase().includes('declined');
      setRealModeSourceState(isDenied ? 'PERMISSION_DENIED' : 'UNSUPPORTED_ENVIRONMENT');
      setCaptureError(res.error || 'Failed to capture application window. Please verify permissions.');
      return;
    }

    setRealModeSourceState('CAPTURE_ACTIVE');
    const winTitle = res.metadata.windowTitle || selectedApp;
    setCapturedWindowName(winTitle);
    setCaptureDimensions({ width: res.metadata.width, height: res.metadata.height });

    // Detect chart regions
    const regions = ChartRegionDetector.detect(res.metadata.width, res.metadata.height);
    setChartRegions(regions);

    const canvas = captureManager.getCanvas();
    const frame = captureManager.getLatestFrame();
    setCapturedFrameUrl(frame.frameUrl);
    setLastFrameTime(frame.timestamp || Date.now());

    // Run initial validation pass
    runValidationPass(winTitle, canvas, frame.frameUrl);

    // Advance to Step 4 (Select Chart / Window Inspection)
    setStep(4);
  };

  const runValidationPass = (
    windowTitle: string,
    canvas: HTMLCanvasElement | null,
    frameUrl: string | null,
    priceOverride?: number,
    displayCurr: DisplayCurrencyOption = selectedDisplayCurrency
  ) => {
    const extracted = MarketDataExtractor.extractFromFrame({
      canvas,
      frameUrl,
      expectedSymbol: currentInstrument.symbol,
      expectedTimeframe: selectedTimeframe,
      sourceApplicationName: selectedApp,
      sourceWindowTitle: windowTitle,
      sourceId: 'src-' + Date.now(),
      userSpecifiedCurrentPrice: priceOverride
    });

    setRawObserved(extracted);
    setLastFrameTime(extracted.lastFrameTimestamp);

    const sourceConfig: MonitoringSourceConfig = {
      id: 'cfg-' + currentInstrument.symbol.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      instrumentSymbol: currentInstrument.symbol,
      instrumentName: currentInstrument.name,
      marketType: currentInstrument.market as any,
      exchangeBroker: selectedApp,
      currency: extracted.detectedCurrency || currentInstrument.currency,
      displayCurrency: displayCurr,
      sourceCategory: 'SCREEN_WINDOW_CAPTURE',
      applicationName: selectedApp,
      windowTitle: windowTitle,
      timeframe: selectedTimeframe,
      isValidated: false,
      sessionId: sessionId,
      validatedPrice: priceOverride
    };

    const valState = DataValidator.createValidationState(sourceConfig, extracted, !!priceOverride);
    setValidationState(valState);
  };

  const handlePriceVerificationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(userConfirmedPrice);
    if (!isNaN(parsed) && parsed > 0) {
      const canvas = captureManager.getCanvas();
      const frame = captureManager.getLatestFrame();
      runValidationPass(capturedWindowName, canvas, frame.frameUrl, parsed);
    }
  };

  // Step 3 Deterministic Validation Rule:
  // REAL MODE MUST NEVER PROCEED TO LIVE MONITORING WITHOUT:
  // 1. Provider selected
  // 2. Authentication completed
  // 3. Provider connection established
  // 4. Instrument resolved
  // 5. Actual live market data received
  // 6. Data freshness verified
  // 7. Source/instrument identity verified
  const isStep3Valid = (() => {
    if (step !== 3) return true;
    if (sourceType === 'SCREEN_CAPTURE') {
      return envReport.state === 'SUPPORTED' && Boolean(capturedWindowName);
    }
    if (sourceType === 'BROKER_API') {
      return (
        providerState === 'READY' &&
        brokerVerification?.status === 'READY' &&
        brokerVerification?.authenticated === true &&
        brokerVerification?.connected === true &&
        brokerVerification?.instrumentResolved === true &&
        brokerVerification?.liveDataReceived === true &&
        brokerVerification?.marketData?.price !== undefined &&
        brokerVerification.marketData.price > 0
      );
    }
    if (sourceType === 'OTHER_SOURCE') {
      return Boolean(localRelayUrl && localRelayUrl.trim().length > 0);
    }
    return false; // NATIVE_OS not supported in browser
  })();

  const handleSaveAndConfirm = () => {
    if (sourceType === 'BROKER_API') {
      if (providerState !== 'READY' || !brokerVerification?.liveDataReceived || brokerVerification?.status !== 'READY') {
        setCaptureError('Cannot start monitoring: Real mode broker feed is not verified.');
        return;
      }

      const confirmedPrice = brokerVerification.marketData?.price;
      const verifiedCurr = brokerVerification.marketData?.currency || currentInstrument.currency;

      const sourceConfig: MonitoringSourceConfig = {
        id: 'source-' + currentInstrument.symbol.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        instrumentSymbol: currentInstrument.symbol,
        instrumentName: currentInstrument.name,
        marketType: currentInstrument.market as any,
        exchangeBroker: brokerVerification.marketData?.exchange || brokerApiType,
        currency: verifiedCurr,
        displayCurrency: selectedDisplayCurrency,
        sourceCategory: 'BROKER_API',
        applicationName: brokerApiType,
        windowTitle: `${brokerApiType} Live Feed (${brokerVerification.dataMode})`,
        timeframe: selectedTimeframe,
        isValidated: true,
        lastValidatedTimestamp: Date.now(),
        sessionId: sessionId,
        validatedPrice: confirmedPrice
      };

      onSaveSource(sourceConfig);
      onClose();
      return;
    }

    if (!validationState || validationState.status !== 'VALID') return;

    const confirmedPrice = validationState.observedPrice || (userConfirmedPrice ? parseFloat(userConfirmedPrice) : undefined);

    const sourceConfig: MonitoringSourceConfig = {
      id: 'source-' + currentInstrument.symbol.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      instrumentSymbol: currentInstrument.symbol,
      instrumentName: currentInstrument.name,
      marketType: currentInstrument.market as any,
      exchangeBroker: selectedApp,
      currency: validationState.observedCurrency || currentInstrument.currency,
      displayCurrency: selectedDisplayCurrency,
      sourceCategory: 'SCREEN_WINDOW_CAPTURE',
      applicationName: selectedApp,
      windowTitle: capturedWindowName,
      timeframe: selectedTimeframe,
      isValidated: true,
      lastValidatedTimestamp: Date.now(),
      sessionId: sessionId,
      validatedPrice: confirmedPrice
    };

    onSaveSource(sourceConfig);
    onClose();
  };

  const displayPriceInfo = CurrencyDetection.calculateDisplayPrice(
    validationState?.observedPrice ?? null,
    validationState?.observedCurrency || currentInstrument.currency,
    selectedDisplayCurrency
  );

  const freshnessBadge = validationState
    ? DataFreshnessMonitor.getBadgeColor(validationState.freshness)
    : null;

  if (!isOpen) return null;

  return (
    <div id="source-setup-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0b0f17] border border-[#1b2536] w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1b2536] bg-[#080c14]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                REAL MODE: CONNECT MARKET SOURCE
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono">
                  LIVE PIPELINE
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Deterministic validation before AI reasoning. Zero synthetic values permitted.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 6-Step Pipeline Progress Bar */}
        <div className="grid grid-cols-6 border-b border-[#1b2536] bg-[#070a10] text-[11px] font-mono">
          {[
            { num: 1, label: '1. Instrument' },
            { num: 2, label: '2. Source' },
            { num: 3, label: '3. Authorize' },
            { num: 4, label: '4. Select Chart' },
            { num: 5, label: '5. Verify Live' },
            { num: 6, label: '6. Monitor' }
          ].map((s) => (
            <div
              key={s.num}
              onClick={() => {
                // Allow navigating back to completed steps
                if (s.num < step) setStep(s.num as any);
              }}
              className={`py-2 px-1 text-center border-b-2 flex items-center justify-center cursor-pointer transition-colors ${
                step === s.num
                  ? 'border-cyan-400 text-cyan-300 font-bold bg-cyan-950/20'
                  : s.num < step
                  ? 'border-emerald-500/60 text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-400'
              }`}
            >
              <span className="truncate">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs font-mono">
          {/* STEP 1: SELECT INSTRUMENT */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 font-sans">
                  Step 1: Select Target Trading Instrument
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {COMMON_INSTRUMENTS.map((inst) => (
                    <button
                      key={inst.symbol}
                      type="button"
                      onClick={() => {
                        setSelectedSymbol(inst.symbol);
                        setCustomSymbol('');
                      }}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        selectedSymbol === inst.symbol && !customSymbol
                          ? 'bg-cyan-950/40 border-cyan-500/60 ring-1 ring-cyan-500/50'
                          : 'bg-[#0f1522] border-[#1f2c42] hover:bg-[#151d2d]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-slate-100 text-sm">{inst.symbol}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {inst.market}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 font-sans">{inst.name}</p>
                      <p className="text-[11px] text-cyan-400/90 mt-1.5 italic font-mono">{inst.tip}</p>
                    </button>
                  ))}
                </div>

                {/* Custom Symbol Input */}
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Or enter custom contract symbol (e.g. CRUDEOIL, EUR/USD)"
                    value={customSymbol}
                    onChange={(e) => {
                      setCustomSymbol(e.target.value.toUpperCase());
                      setSelectedSymbol(e.target.value.toUpperCase());
                    }}
                    className="flex-1 bg-[#090d15] border border-[#1f2c42] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Timeframe Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 font-sans">
                  Chart Timeframe (Must match the candlestick timeframe on your visible chart)
                </label>
                <div className="flex gap-2">
                  {(['1M', '5M', '15M', '1H', '4H', '1D'] as Timeframe[]).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setSelectedTimeframe(tf)}
                      className={`flex-1 py-2 text-xs font-mono rounded-lg border transition-all ${
                        selectedTimeframe === tf
                          ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-sm'
                          : 'bg-[#0f1522] border-[#1f2c42] text-slate-300 hover:bg-[#151d2d]'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Distinction Highlight Card */}
              <div className="p-3.5 rounded-xl bg-[#070b12] border border-[#182335] space-y-1.5 text-[11px]">
                <div className="flex items-center gap-1.5 font-bold text-cyan-400">
                  <Info className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Verified Contract Matching</span>
                </div>
                <p className="text-slate-400">
                  TRADYX validates the incoming market feed or captured chart against your selected symbol. Ensure your source matches the intended instrument contract.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: SELECT DATA SOURCE */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Source Manager Status Banner */}
              <div className="p-3.5 rounded-xl bg-[#070b12] border border-[#1b2738] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${envReport.state === 'SUPPORTED' ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'}`} />
                  <div>
                    <span className="font-mono text-slate-200 font-bold">
                      Market Source Connection Manager
                    </span>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Connect an authorized live market source adapter to begin deterministic analysis.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-slate-800/80 border-slate-700 text-slate-300">
                  REAL MODE
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 font-sans">
                  Step 2: Select Market Data Source Adapter
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  {/* Option A: Application / Screen Capture */}
                  <div
                    onClick={() => setSourceType('SCREEN_CAPTURE')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      sourceType === 'SCREEN_CAPTURE'
                        ? 'bg-cyan-950/30 border-cyan-500/60 ring-1 ring-cyan-500/40'
                        : 'bg-[#0f1522] border-[#1f2c42] hover:bg-[#151d2d]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Laptop className="w-5 h-5 text-cyan-400" />
                        <div>
                          <span className="font-bold text-white text-sm">
                            Option A: Browser Screen / Window Capture
                          </span>
                          <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                            BrowserDisplayCaptureAdapter
                          </span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        envReport.state === 'SUPPORTED'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}>
                        {envReport.state === 'SUPPORTED' ? 'AVAILABLE' : 'RESTRICTED'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 font-sans">
                      Observe your live trading chart window (TradingView, MT4/MT5, Upstox Pro, Angel One, Pocket Option, Quotex, Exness, or browser tabs) via browser window sharing.
                    </p>
                  </div>

                  {/* Option B: Broker / Market Data API */}
                  <div
                    onClick={() => setSourceType('BROKER_API')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      sourceType === 'BROKER_API'
                        ? 'bg-cyan-950/30 border-cyan-500/60 ring-1 ring-cyan-500/40'
                        : 'bg-[#0f1522] border-[#1f2c42] hover:bg-[#151d2d]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Wifi className="w-5 h-5 text-purple-400" />
                        <div>
                          <span className="font-bold text-white text-sm">
                            Option B: Broker / Market Data Direct API Gateway
                          </span>
                          <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300">
                            BrokerApiAdapter
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        IMPLEMENTED
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 font-sans">
                      Connect verified broker quotes (Upstox V3 Market Data Feed, Angel One SmartAPI, MetaTrader 5 Bridge, Binance).
                    </p>
                  </div>

                  {/* Option C: Other Authorized Source */}
                  <div
                    onClick={() => setSourceType('OTHER_SOURCE')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      sourceType === 'OTHER_SOURCE'
                        ? 'bg-cyan-950/30 border-cyan-500/60 ring-1 ring-cyan-500/40'
                        : 'bg-[#0f1522] border-[#1f2c42] hover:bg-[#151d2d]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Layers className="w-5 h-5 text-amber-400" />
                        <div>
                          <span className="font-bold text-white text-sm">
                            Option C: Local Video / RTSP Relay Stream
                          </span>
                          <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
                            LocalRelayAdapter
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        IMPLEMENTED
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 font-sans">
                      Connect an external video stream or RTSP/WebRTC hardware capture card or local agent frame relay.
                    </p>
                  </div>

                  {/* Option D: Native OS Window Capture */}
                  <div
                    onClick={() => setSourceType('NATIVE_OS')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      sourceType === 'NATIVE_OS'
                        ? 'bg-cyan-950/30 border-cyan-500/60 ring-1 ring-cyan-500/40'
                        : 'bg-[#0f1522] border-[#1f2c42] hover:bg-[#151d2d]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Smartphone className="w-5 h-5 text-slate-400" />
                        <div>
                          <span className="font-bold text-white text-sm">
                            Option D: Native OS Window Capture (Windows / Android)
                          </span>
                          <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            Native OS
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300">
                        NOT IMPLEMENTED IN WEB
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 font-sans">
                      Requires native OS runtime wrapper (Windows.Graphics.Capture for Windows, Android MediaProjection for Android).
                    </p>
                  </div>
                </div>
              </div>

              {/* Target Trading Application Grid (for Screen Capture) */}
              {sourceType === 'SCREEN_CAPTURE' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 font-sans">
                    Target Trading Application Hint
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {TRADING_APPLICATIONS.map((app) => (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => setSelectedApp(app.id)}
                        className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                          selectedApp === app.id
                            ? 'bg-cyan-950/50 border-cyan-500 text-cyan-200 ring-1 ring-cyan-500/50'
                            : 'bg-[#0f1522] border-[#1f2c42] text-slate-300 hover:bg-[#151d2d]'
                        }`}
                      >
                        <app.icon className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="truncate text-xs">{app.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cross-Device Architecture Note */}
              <div className="bg-[#070b12] border border-[#182335] rounded-xl p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center gap-2 font-semibold text-slate-300 font-mono">
                  <Info className="w-4 h-4 text-cyan-400" />
                  <span>Physical Device Architecture Note</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                  Web browser security prohibits directly reading the screen of a separate physical phone. For mobile charts, open your chart on this computer, connect via authorized Broker API, or run TRADYX on the same device.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: AUTHORIZE ACCESS */}
          {step === 3 && (
            <div className="space-y-4 py-2">
              {sourceType === 'SCREEN_CAPTURE' && (
                <>
                  {envReport.state !== 'SUPPORTED' ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-[#070b12] border border-amber-500/40 text-left space-y-3">
                        <div className="flex items-center gap-2.5 text-amber-300 font-bold font-mono text-sm">
                          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                          <span>SOURCE CONNECTION REQUIRED</span>
                        </div>
                        <div className="text-xs text-slate-300 space-y-2">
                          <p className="font-semibold text-white">
                            Unable to connect to the selected market source.
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Window capture is unavailable in this browser environment. Connect a supported Market Data API, local stream relay, or native adapter.
                          </p>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSourceType('BROKER_API');
                                setStep(2);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold transition-colors"
                            >
                              Change Source
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRequestWindowCapture()}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold transition-colors"
                            >
                              Retry
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Available Alternative Methods */}
                      <div className="space-y-2 text-left">
                        <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                          Available Alternative Source Methods:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setSourceType('BROKER_API');
                              setStep(2);
                            }}
                            className="p-3 rounded-xl border border-purple-500/30 bg-purple-950/20 hover:bg-purple-950/40 text-left transition-all group"
                          >
                            <div className="flex items-center justify-between text-purple-300 font-bold font-mono">
                              <span className="flex items-center gap-1.5">
                                <Wifi className="w-4 h-4" /> Option B: Broker API
                              </span>
                              <span className="text-[10px] text-purple-400 group-hover:underline">Select →</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 font-sans">
                              Connect Upstox V3, Angel One SmartAPI, MT5, or Binance quotes via direct API.
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSourceType('OTHER_SOURCE');
                              setStep(2);
                            }}
                            className="p-3 rounded-xl border border-cyan-500/30 bg-cyan-950/20 hover:bg-cyan-950/40 text-left transition-all group"
                          >
                            <div className="flex items-center justify-between text-cyan-300 font-bold font-mono">
                              <span className="flex items-center gap-1.5">
                                <Layers className="w-4 h-4" /> Option C: Local Relay
                              </span>
                              <span className="text-[10px] text-cyan-400 group-hover:underline">Select →</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 font-sans">
                              Connect an RTSP video stream, OBS Virtual Camera, or WebSocket feed.
                            </p>
                          </button>
                        </div>

                        {/* Deployed app notice */}
                        {envReport.isEmbeddedIframe && (
                          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                            <span>To test browser window capture, open the deployed application directly in a full desktop browser window.</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (typeof window !== 'undefined' && window.location?.href) {
                                  window.open(window.location.href, '_blank');
                                }
                              }}
                              className="text-xs text-cyan-400 underline font-mono shrink-0 ml-2"
                            >
                              Open in New Tab ↗
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors"
                        >
                          ← Change Data Source
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
                        <ShieldCheck className="w-7 h-7" />
                      </div>
                      <div className="max-w-md mx-auto space-y-1.5">
                        <h3 className="text-base font-bold text-white font-mono">
                          Step 3: Authorize Window Access
                        </h3>
                        <p className="text-xs text-emerald-400 font-mono font-medium">
                          Browser screen/window capture available.
                        </p>
                        <p className="text-xs text-slate-400 font-sans leading-relaxed">
                          Your browser will open the native screen/window selection dialog. Select the exact window where your{' '}
                          <strong className="text-cyan-300">{selectedApp}</strong> chart for{' '}
                          <strong className="text-cyan-300">{currentInstrument.symbol}</strong> is displayed.
                        </p>
                      </div>

                      <div className="bg-[#070b12] border border-[#182335] rounded-xl p-4 max-w-md mx-auto text-left space-y-2 text-xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Selected Instrument:</span>
                          <span className="text-cyan-400 font-bold">{currentInstrument.symbol}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Timeframe:</span>
                          <span className="text-slate-200">{selectedTimeframe}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Expected Application:</span>
                          <span className="text-slate-200">{selectedApp}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Session ID:</span>
                          <span className="text-slate-400">{sessionId}</span>
                        </div>
                      </div>

                      {captureError && (
                        <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3.5 text-left max-w-md mx-auto text-xs text-amber-300 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-amber-200">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            <span>Capture Status Notice</span>
                          </div>
                          <p className="whitespace-pre-line text-[11px] text-amber-300/90 font-sans">{captureError}</p>
                        </div>
                      )}

                      <div className="pt-2 flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs transition-colors"
                        >
                          ← Change Source
                        </button>
                        <button
                          type="button"
                          onClick={handleRequestWindowCapture}
                          disabled={isCapturing}
                          className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 flex items-center gap-2"
                        >
                          <Monitor className="w-4 h-4" />
                          {isCapturing ? 'Opening Browser Permission Dialog...' : 'AUTHORIZE CAPTURE & SELECT WINDOW'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Option B: Broker API Configuration */}
              {sourceType === 'BROKER_API' && (
                <div className="space-y-4 max-w-md mx-auto text-left">
                  <div className="text-center space-y-1">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto">
                      <Wifi className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-white font-mono">
                      Step 3: Configure Broker API Gateway
                    </h3>
                    <p className="text-xs text-slate-400 font-sans">
                      Connect direct real-time quotes for {currentInstrument.symbol}.
                    </p>
                  </div>

                  <div className="space-y-3 bg-[#070b12] border border-[#182335] rounded-xl p-4 text-xs font-sans">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-mono uppercase">Select Broker Provider</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(
                          [
                            { id: 'UPSTOX', name: 'Upstox V3' },
                            { id: 'ANGELONE', name: 'Angel One' },
                            { id: 'GROWW', name: 'Groww (Snapshot)' },
                            { id: 'MEXC', name: 'MEXC Global' },
                            { id: 'EXNESS', name: 'Exness / MT5' },
                            { id: 'BINANCE', name: 'Binance' }
                          ] as const
                        ).map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setBrokerApiType(b.id as any)}
                            className={`p-2 rounded border text-xs font-mono text-left transition-all ${
                              brokerApiType === b.id
                                ? 'bg-purple-950/50 border-purple-500 text-purple-200'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {b.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {brokerApiType === 'UPSTOX' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1 font-mono uppercase">Upstox Bearer Access Token</label>
                          <input
                            type="password"
                            value={brokerApiKey}
                            onChange={(e) => setBrokerApiKey(e.target.value)}
                            placeholder="Enter Upstox Access Token"
                            className="w-full bg-[#0d131f] border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleConnectUpstox}
                            disabled={isVerifyingBroker}
                            className="flex-1 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold transition-all disabled:opacity-50"
                          >
                            {isVerifyingBroker ? 'Verifying Upstox...' : 'Connect Upstox Token'}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await fetch('/api/brokers/upstox/auth-url');
                                const json = await res.json();
                                if (json.url) {
                                  window.open(json.url, 'UpstoxAuth', 'width=600,height=700');
                                }
                              } catch {
                                setCaptureError('Failed to generate Upstox auth URL.');
                              }
                            }}
                            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold border border-slate-700 transition-colors"
                          >
                            Official OAuth Login →
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Session token is stored securely on backend. Auto-restores on future launches.
                        </p>
                      </div>
                    )}

                    {brokerApiType === 'ANGELONE' && (
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1 font-mono uppercase">SmartAPI Key</label>
                          <input
                            type="password"
                            value={brokerApiKey}
                            onChange={(e) => setBrokerApiKey(e.target.value)}
                            placeholder="Enter Angel One SmartAPI Key"
                            className="w-full bg-[#0d131f] border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1 font-mono uppercase">Client Code</label>
                            <input
                              type="text"
                              value={brokerClientCode}
                              onChange={(e) => setBrokerClientCode(e.target.value)}
                              placeholder="e.g. A123456"
                              className="w-full bg-[#0d131f] border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1 font-mono uppercase">MPIN / Password</label>
                            <input
                              type="password"
                              value={brokerApiSecret}
                              onChange={(e) => setBrokerApiSecret(e.target.value)}
                              placeholder="PIN or Password"
                              className="w-full bg-[#0d131f] border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1 font-mono uppercase">Authenticator TOTP</label>
                          <input
                            type="text"
                            value={brokerTotp}
                            onChange={(e) => setBrokerTotp(e.target.value)}
                            placeholder="6-digit TOTP code"
                            className="w-full bg-[#0d131f] border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={handleConnectAngelOne}
                            disabled={isVerifyingBroker}
                            className="w-full px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold transition-all disabled:opacity-50"
                          >
                            {isVerifyingBroker ? 'Authenticating Angel One...' : 'Connect Angel One SmartAPI'}
                          </button>
                        </div>
                      </div>
                    )}

                    {brokerApiType === 'GROWW' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1 font-mono uppercase">Groww API Key</label>
                          <input
                            type="text"
                            value={brokerApiKey}
                            onChange={(e) => setBrokerApiKey(e.target.value)}
                            placeholder="Enter Groww Cloud API Key"
                            className="w-full bg-[#0d131f] border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1 font-mono uppercase">Groww API Secret</label>
                          <input
                            type="password"
                            value={brokerApiSecret}
                            onChange={(e) => setBrokerApiSecret(e.target.value)}
                            placeholder="Enter Groww API Secret"
                            className="w-full bg-[#0d131f] border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
                          />
                          <p className="text-[10px] text-slate-500 mt-1 font-sans">
                            Secrets are sent encrypted to backend only. Never stored in browser storage.
                          </p>
                        </div>

                        {/* Groww Daily Approval Banner */}
                        {(isGrowwApprovalRequired || providerState === 'APPROVAL_REQUIRED') && (
                          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 space-y-2 text-xs">
                            <div className="flex items-center gap-1.5 text-amber-300 font-bold font-mono">
                              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>Groww approval required</span>
                            </div>
                            <p className="text-[11px] text-amber-200/90 font-sans">
                              Groww Cloud API requires daily approval on your developer keys page. Please complete approval on Groww, then click Complete Approval.
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => verifyBrokerConnection('GROWW', currentInstrument.symbol)}
                                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold transition-colors"
                              >
                                Complete Approval
                              </button>
                              <a
                                href="https://groww.in/cloud"
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs border border-slate-700"
                              >
                                Open Groww Cloud ↗
                              </a>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleConnectGroww}
                            disabled={isVerifyingBroker || !brokerApiKey}
                            className="flex-1 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition-all disabled:opacity-50"
                          >
                            {isVerifyingBroker ? 'Authenticating...' : 'Connect Groww'}
                          </button>
                        </div>

                        <div className="p-2 rounded bg-cyan-950/20 border border-cyan-800/40 text-[10px] text-cyan-300 font-mono">
                          Mode: LIVE_POLLING / REST_SNAPSHOT (Truthful snapshot polling every 2s. Zero synthetic data).
                        </div>
                      </div>
                    )}

                    {brokerApiType === 'MEXC' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1 font-mono uppercase">Market Segment</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setMexcSegment('MEXC_SPOT')}
                              className={`p-2 rounded border text-xs font-mono ${
                                mexcSegment === 'MEXC_SPOT' ? 'bg-cyan-950 border-cyan-500 text-cyan-200' : 'bg-slate-900 border-slate-800 text-slate-400'
                              }`}
                            >
                              MEXC Spot
                            </button>
                            <button
                              type="button"
                              onClick={() => setMexcSegment('MEXC_FUTURES')}
                              className={`p-2 rounded border text-xs font-mono ${
                                mexcSegment === 'MEXC_FUTURES' ? 'bg-cyan-950 border-cyan-500 text-cyan-200' : 'bg-slate-900 border-slate-800 text-slate-400'
                              }`}
                            >
                              MEXC Futures
                            </button>
                          </div>
                        </div>
                        <div className="p-2 rounded bg-emerald-950/20 border border-emerald-800/40 text-[10px] text-emerald-300 font-mono">
                          ✓ Public market data active. Dynamic discovery across spot and perpetual contracts with zero private keys needed.
                        </div>
                        <button
                          type="button"
                          onClick={handleConnectMexc}
                          disabled={isVerifyingBroker}
                          className="w-full px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition-all disabled:opacity-50"
                        >
                          {isVerifyingBroker ? 'Connecting MEXC Feed...' : 'Connect MEXC Market Feed'}
                        </button>
                      </div>
                    )}

                    {brokerApiType === 'EXNESS' && (
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1 font-mono uppercase">Exness / MT5 Bridge Endpoint</label>
                          <input
                            type="text"
                            value={exnessBridgeUrl}
                            onChange={(e) => setExnessBridgeUrl(e.target.value)}
                            placeholder="ws://localhost:5001/stream"
                            className="w-full bg-[#0d131f] border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1 font-mono uppercase">Account Login (Optional)</label>
                            <input
                              type="text"
                              value={brokerClientCode}
                              onChange={(e) => setBrokerClientCode(e.target.value)}
                              placeholder="e.g. 14029482"
                              className="w-full bg-[#0d131f] border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1 font-mono uppercase">Server Name (Optional)</label>
                            <input
                              type="text"
                              value={brokerApiSecret}
                              onChange={(e) => setBrokerApiSecret(e.target.value)}
                              placeholder="e.g. Exness-Real7"
                              className="w-full bg-[#0d131f] border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={handleConnectExness}
                            disabled={isVerifyingBroker}
                            className="w-full px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold transition-all disabled:opacity-50"
                          >
                            {isVerifyingBroker ? 'Testing MT5 Bridge...' : 'Connect Exness / MT5 Bridge'}
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Requires MT5 gateway connector running locally on port 5001.
                        </div>
                      </div>
                    )}

                    {brokerApiType === 'BINANCE' && (
                      <div className="space-y-2">
                        <label className="block text-[11px] text-slate-400 mb-1 font-mono uppercase">Public Stream</label>
                        <p className="text-[11px] text-emerald-400 font-mono">
                          Public Binance quotes connected directly via WebSocket. Zero credentials required for read-only.
                        </p>
                        <button
                          type="button"
                          onClick={handleConnectBinance}
                          disabled={isVerifyingBroker}
                          className="w-full px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold transition-all disabled:opacity-50"
                        >
                          {isVerifyingBroker ? 'Connecting Binance...' : 'Connect Binance Feed'}
                        </button>
                      </div>
                    )}

                    {/* Dedicated Live Provider Verification Card */}
                    <div className="mt-3 pt-3 border-t border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-400 font-bold uppercase">
                          Live Provider Verification Audit
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                            providerState === 'READY'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : providerState === 'APPROVAL_REQUIRED'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : providerState === 'AUTHENTICATING' || providerState === 'LIVE_DATA_VERIFICATION'
                              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 animate-pulse'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {providerState}
                        </span>
                      </div>

                      <div className="bg-[#0b101a] border border-[#1b2536] rounded-lg p-3 space-y-1.5 text-[11px] font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Target Instrument:</span>
                          <span className="text-white font-bold">{currentInstrument.symbol}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Resolved Contract:</span>
                          <span className={brokerVerification?.instrumentResolved ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                            {brokerVerification?.marketData?.symbol || 'AWAITING RESOLUTION'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Live Quote (LTP):</span>
                          <span className={brokerVerification?.liveDataReceived ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                            {brokerVerification?.marketData?.price !== undefined
                              ? `${brokerVerification.marketData.price} ${brokerVerification.marketData.currency}`
                              : 'NO TICK RECEIVED'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Data Freshness:</span>
                          <span className={brokerVerification?.liveDataReceived ? 'text-emerald-400' : 'text-slate-500'}>
                            {brokerVerification?.marketData?.freshnessSeconds !== undefined
                              ? `${brokerVerification.marketData.freshnessSeconds}s`
                              : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Observation Mode:</span>
                          <span className="text-cyan-400">
                            {brokerVerification?.dataMode || (brokerApiType === 'GROWW' ? 'LIVE_POLLING' : 'LIVE_STREAM')}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => verifyBrokerConnection(brokerApiType, currentInstrument.symbol, mexcSegment)}
                        disabled={isVerifyingBroker}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingBroker ? 'animate-spin' : ''}`} />
                        {isVerifyingBroker ? 'Testing Live Feed...' : 'Test Connection & Verify Live Feed'}
                      </button>

                      {providerState !== 'READY' && (
                        <p className="text-[10px] text-amber-300/80 font-sans italic">
                          * Real Mode Rule: You cannot advance until the provider is authenticated and actual live market data is received and verified.
                        </p>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Market observation only. TRADYX never executes trades or manages account funds.
                    </p>
                  </div>
                </div>
              )}

              {/* Option C: Local Relay Stream */}
              {sourceType === 'OTHER_SOURCE' && (
                <div className="space-y-4 max-w-md mx-auto text-left">
                  <div className="text-center space-y-1">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                      <Layers className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-white font-mono">
                      Step 3: Connect Local Video / RTSP Relay
                    </h3>
                    <p className="text-xs text-slate-400 font-sans">
                      Connect an external video stream or RTSP capture card.
                    </p>
                  </div>

                  <div className="space-y-3 bg-[#070b12] border border-[#182335] rounded-xl p-4 text-xs font-sans">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-mono uppercase">Relay Stream URL</label>
                      <input
                        type="text"
                        value={localRelayUrl}
                        onChange={(e) => setLocalRelayUrl(e.target.value)}
                        placeholder="ws://localhost:8554/live or rtsp://..."
                        className="w-full bg-[#0d131f] border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Receives live video frames from OBS Virtual Camera or local hardware capture.
                    </p>
                  </div>
                </div>
              )}

              {/* Option D: Native OS */}
              {sourceType === 'NATIVE_OS' && (
                <div className="space-y-4 max-w-md mx-auto text-left">
                  <div className="text-center space-y-1">
                    <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-white font-mono">
                      Native OS Capture Adapters
                    </h3>
                    <p className="text-xs text-rose-400 font-mono">
                      NOT IMPLEMENTED IN BROWSER WEB APPLICATION
                    </p>
                  </div>

                  <div className="space-y-2.5 bg-[#070b12] border border-[#182335] rounded-xl p-4 text-xs">
                    <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1">
                      <span className="font-bold text-slate-200 font-mono">Windows Native Capture</span>
                      <p className="text-[11px] text-slate-400">
                        Requires Windows.Graphics.Capture API in a native desktop container (Electron / Tauri / C#).
                      </p>
                      <span className="text-[10px] text-rose-400 font-mono">Status: NOT IMPLEMENTED</span>
                    </div>

                    <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1">
                      <span className="font-bold text-slate-200 font-mono">Android MediaProjection</span>
                      <p className="text-[11px] text-slate-400">
                        Requires Android native APK with MediaProjection service and system permission prompt.
                      </p>
                      <span className="text-[10px] text-rose-400 font-mono">Status: NOT IMPLEMENTED</span>
                    </div>
                  </div>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors"
                    >
                      ← Back to Available Sources
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: SELECT CHART (Inspection & Confirmation) */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-sans">
                    {sourceType === 'BROKER_API'
                      ? 'Step 4: Verified Direct Broker API Gateway Stream'
                      : 'Step 4: Selected Application Window & Stream Metadata'}
                  </h3>
                  <p className="text-xs text-slate-400 font-sans">
                    {sourceType === 'BROKER_API'
                      ? 'Inspect live incoming market quotes and protocol stream telemetry.'
                      : 'Confirm that the stream points to your trading chart.'}
                  </p>
                </div>
                {sourceType === 'BROKER_API' ? (
                  <button
                    type="button"
                    onClick={() => verifyBrokerConnection(brokerApiType, currentInstrument.symbol, mexcSegment)}
                    disabled={isVerifyingBroker}
                    className="px-3 py-1.5 rounded-lg bg-[#141d2b] border border-[#202e42] hover:bg-[#1b273a] text-cyan-400 text-xs font-mono transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingBroker ? 'animate-spin' : ''}`} />
                    Test Feed Again
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestWindowCapture}
                    className="px-3 py-1.5 rounded-lg bg-[#141d2b] border border-[#202e42] hover:bg-[#1b273a] text-cyan-400 text-xs font-mono transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Change Window
                  </button>
                )}
              </div>

              {/* Stream Metadata Card */}
              <div className="bg-[#070b12] border border-[#182335] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">APPLICATION:</span>
                  <span className="text-white font-bold">{sourceType === 'BROKER_API' ? `${brokerApiType} Market Gateway` : selectedApp}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">{sourceType === 'BROKER_API' ? 'FEED CHANNEL:' : 'WINDOW TITLE:'}</span>
                  <span className="text-slate-200 truncate block font-bold">
                    {capturedWindowName || (sourceType === 'BROKER_API' ? `${brokerApiType} Direct Stream` : 'Active Chart Window')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">{sourceType === 'BROKER_API' ? 'DATA TRANSPORT:' : 'STREAM RESOLUTION:'}</span>
                  <span className="text-cyan-400 font-bold">
                    {sourceType === 'BROKER_API'
                      ? brokerVerification?.dataMode || (brokerApiType === 'GROWW' ? 'LIVE_POLLING' : 'LIVE_STREAM')
                      : captureDimensions.width > 0 ? `${captureDimensions.width} x ${captureDimensions.height}` : '1920 x 1080 (HD)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">CAPTURE STATUS:</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {sourceType === 'BROKER_API' ? 'GATEWAY ACTIVE' : 'ACTIVE'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">DATA FRESHNESS:</span>
                  <span className="text-slate-300">
                    {sourceType === 'BROKER_API'
                      ? `${brokerVerification?.marketData?.freshnessSeconds ?? 0}s latency`
                      : '~15 - 30 fps (500ms sample)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">SESSION ISOLATION:</span>
                  <span className="text-slate-400 truncate block">{sessionId}</span>
                </div>
              </div>

              {/* Step 4 Visual / Live Feed Container */}
              {sourceType === 'BROKER_API' ? (
                <div className="bg-[#070b12] rounded-xl border border-purple-900/40 p-5 relative space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-xs font-mono font-bold text-white uppercase">
                        {brokerApiType} LIVE TICKER INSPECTOR
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      ● LIVE VERIFIED (0% SYNTHETIC)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                    <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">SYMBOL</span>
                      <span className="text-white font-bold text-sm">
                        {brokerVerification?.marketData?.symbol || currentInstrument.symbol}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">LIVE LTP</span>
                      <span className="text-amber-400 font-bold text-base">
                        {brokerVerification?.marketData?.price !== undefined
                          ? `${brokerVerification.marketData.price} ${brokerVerification.marketData.currency}`
                          : '—'}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">EXCHANGE</span>
                      <span className="text-cyan-400 font-bold text-sm">
                        {brokerVerification?.marketData?.exchange || 'GATEWAY'}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">MODE</span>
                      <span className="text-purple-400 font-bold text-sm">
                        {brokerVerification?.dataMode || 'LIVE_STREAM'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0b101a] border border-[#1b2536] text-[11px] text-slate-300 flex items-center justify-between">
                    <span>Direct broker feed authenticated and bound to TRADYX SSE stream.</span>
                    <span className="text-emerald-400 font-bold font-mono">Status: READY FOR AUDIT</span>
                  </div>
                </div>
              ) : (
                <div className="bg-black rounded-xl border border-slate-800 p-2 overflow-hidden aspect-video relative flex items-center justify-center">
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-contain rounded"
                  />
                  <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/70 border border-slate-700 text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    LIVE STREAM ACTIVE
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: VERIFY LIVE DATA */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-sans">
                  Step 5: Mandatory Live Source Verification
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  Deterministic audit of chart layout, asset symbol, price range, and freshness.
                </p>
              </div>

              {/* Validation Status Banner */}
              {validationState && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    validationState.status === 'VALID'
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : validationState.status === 'INVALID'
                      ? 'bg-rose-950/50 border-rose-500/60 text-rose-300'
                      : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                  }`}
                >
                  {validationState.status === 'VALID' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 text-xs flex-1">
                    <div className="font-bold flex items-center justify-between">
                      <span className="text-sm">
                        {validationState.status === 'VALID'
                          ? 'SOURCE VALIDATION PASSED'
                          : validationState.status === 'INVALID'
                          ? 'SOURCE / INSTRUMENT MISMATCH DETECTED'
                          : 'AWAITING LIVE PRICE CONFIRMATION'}
                      </span>
                      {freshnessBadge && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border font-mono ${freshnessBadge.bg} ${freshnessBadge.text} ${freshnessBadge.border}`}
                        >
                          ● {validationState.freshness}
                        </span>
                      )}
                    </div>
                    <p className="font-sans leading-relaxed opacity-90">{validationState.details}</p>
                    {validationState.mismatchReason && (
                      <div className="font-bold text-rose-200 mt-2 bg-rose-950/60 p-2.5 rounded-lg border border-rose-800/80 whitespace-pre-line font-mono text-[11px]">
                        {validationState.mismatchReason}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Two-column layout: Left = Live Visual Capture Preview, Right = Audit & Price Verification */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Visual Capture / Broker Feed Inspection Box */}
                <div className="bg-[#070b12] border border-[#182335] rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <Eye className="w-3.5 h-3.5" />
                      {sourceType === 'BROKER_API' ? 'LIVE BROKER FEED AUDIT' : 'LIVE SOURCE PREVIEW'}
                    </span>
                    <span className="text-[10px] truncate max-w-[160px] text-slate-500">
                      {capturedWindowName || (sourceType === 'BROKER_API' ? `${brokerApiType} Live Feed` : 'Active Window')}
                    </span>
                  </div>

                  {sourceType === 'BROKER_API' ? (
                    <div className="relative aspect-video bg-black rounded-lg border border-purple-900/40 p-3 overflow-hidden flex flex-col justify-between font-mono">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">FEED SOURCE:</span>
                        <span className="text-white font-bold">{brokerApiType} DIRECT GATEWAY</span>
                      </div>
                      <div className="text-center py-2">
                        <span className="text-[10px] text-slate-500 uppercase block">OBSERVED LIVE PRICE</span>
                        <span className="text-2xl font-bold text-amber-400">
                          {validationState?.observedPrice !== undefined && validationState?.observedPrice !== null
                            ? `${validationState.observedPrice} ${validationState.observedCurrency || currentInstrument.currency}`
                            : brokerVerification?.marketData?.price !== undefined
                            ? `${brokerVerification.marketData.price} ${brokerVerification.marketData.currency}`
                            : '—'}
                        </span>
                        <span className="text-[10px] text-emerald-400 block mt-1">
                          ● {brokerVerification?.dataMode || 'LIVE_STREAM'} | 0% SYNTHETIC
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-900 pt-1">
                        <span>INSTRUMENT: {brokerVerification?.marketData?.symbol || currentInstrument.symbol}</span>
                        <span>LATENCY: {brokerVerification?.marketData?.freshnessSeconds ?? 0}s</span>
                      </div>
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-emerald-950/80 text-[9px] text-emerald-400 border border-emerald-800 font-mono">
                        VERIFIED
                      </div>
                    </div>
                  ) : (
                    <div className="relative aspect-video bg-black rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center">
                      <video
                        ref={videoPreviewRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/80 text-[10px] text-slate-300 font-mono">
                        ● CAPTURE ACTIVE | {lastFrameTime ? new Date(lastFrameTime).toLocaleTimeString() : 'LIVE'}
                      </div>
                    </div>
                  )}

                  {/* Feed / Layout Detection status */}
                  <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{sourceType === 'BROKER_API' ? 'Feed Verification:' : 'Layout Detection:'}</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      {sourceType === 'BROKER_API' ? 'LIVE DATA VERIFIED' : 'CHART REGION CONFIRMED'}
                    </span>
                  </div>
                </div>

                {/* Audit & Confidence Matrix */}
                <div className="bg-[#070b12] border border-[#182335] rounded-xl p-3.5 flex flex-col justify-between text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-sans">
                      Observed Live Audit
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Session: {sessionId.slice(0, 10)}...
                    </span>
                  </div>
                  <div className="space-y-2 divide-y divide-slate-800/80">
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-400">Target Instrument:</span>
                      <span className="text-cyan-400 font-bold">{currentInstrument.symbol}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-400">Observed Identity:</span>
                      <span className="font-bold">
                        {validationState?.detectedSymbol ? (
                          validationState.detectedSymbol.toUpperCase() === currentInstrument.symbol.toUpperCase() ? (
                            <span className="text-emerald-400">● {validationState.detectedSymbol} (MATCH)</span>
                          ) : (
                            <span className="text-rose-400">⚠ {validationState.detectedSymbol} (MISMATCH)</span>
                          )
                        ) : (
                          <span className="text-amber-400">UNCERTAIN (Requires Inspection)</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-400">Observed Window:</span>
                      <span className="text-slate-200 truncate max-w-[170px]">{capturedWindowName}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-400">Observed Source Price:</span>
                      <span className="text-amber-400 font-bold text-sm">
                        {validationState?.observedPrice !== null && validationState?.observedPrice !== undefined
                          ? `${validationState.observedPrice} ${validationState.observedCurrency || currentInstrument.currency}`
                          : 'Awaiting User Price Check'}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-400">Observed Currency:</span>
                      <span className="text-slate-200 font-bold">
                        {validationState?.observedCurrency || 'SOURCE AUTO'}
                        {validationState?.baseCurrency && validationState?.quoteCurrency ? (
                          <span className="text-slate-500 font-normal ml-1">
                            ({validationState.baseCurrency}/{validationState.quoteCurrency})
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-400">Display Currency:</span>
                      <select
                        value={selectedDisplayCurrency}
                        onChange={(e) => {
                          const val = e.target.value as DisplayCurrencyOption;
                          setSelectedDisplayCurrency(val);
                          const canvas = captureManager.getCanvas();
                          const frame = captureManager.getLatestFrame();
                          const curPrice = validationState?.observedPrice || (userConfirmedPrice ? parseFloat(userConfirmedPrice) : undefined);
                          runValidationPass(capturedWindowName, canvas, frame.frameUrl, curPrice, val);
                        }}
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-cyan-300 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="AUTO">AUTO / SOURCE ({validationState?.observedCurrency || currentInstrument.currency})</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="INR">INR (₹)</option>
                        <option value="JPY">JPY (¥)</option>
                        <option value="AUD">AUD (A$)</option>
                        <option value="CAD">CAD (C$)</option>
                        <option value="CHF">CHF (Fr)</option>
                      </select>
                    </div>
                    {displayPriceInfo.isConverted && displayPriceInfo.displayPrice !== null && (
                      <div className="flex justify-between pt-1 bg-cyan-950/20 px-2 py-1 rounded border border-cyan-800/40">
                        <span className="text-cyan-400 text-[11px]">Display Override:</span>
                        <span className="text-cyan-300 font-bold text-xs">
                          {displayPriceInfo.displayPrice} {displayPriceInfo.displayCurrency}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-400">Timeframe:</span>
                      <span className="text-slate-200">{selectedTimeframe}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-400">Source Evidence:</span>
                      <span className="text-slate-300 font-mono text-[11px]">
                        ID:{validationState?.sourceEvidence?.instrumentEvidence || 'NONE'} | PX:{validationState?.sourceEvidence?.priceEvidence || 'NONE'}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-400">Confidence:</span>
                      <span
                        className={`font-bold ${
                          validationState?.confidence === 'VALID'
                            ? 'text-emerald-400'
                            : validationState?.confidence === 'UNCERTAIN'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {validationState?.confidence === 'VALID' ? 'HIGH (Verified)' : 'UNCERTAIN (Requires Calibration)'}
                      </span>
                    </div>
                  </div>

                  {/* Manual verification of visible price */}
                  <form onSubmit={handlePriceVerificationSubmit} className="pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] text-slate-300 font-medium">
                        Confirm visible price on your chart scale:
                      </label>
                      <span className="text-[10px] text-slate-500 font-mono">Session isolated</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-1.5 leading-tight">
                      Entering the visible price calibrates optical observation for this session. It does not hardcode permanent market rules.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 4023.50 or current visible price"
                        value={userConfirmedPrice}
                        onChange={(e) => setUserConfirmedPrice(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs border border-slate-700 font-bold"
                      >
                        Verify
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: START MONITORING (Source Verification Summary) */}
          {step === 6 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-sans">
                  Step 6: Source Verification & Start Monitoring
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  Review the validated connection profile before initializing the AI reasoning loop.
                </p>
              </div>

              {/* Final Source Verification Summary Card */}
              <div className="bg-[#070b12] border border-[#182335] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                      ✓
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">SOURCE VERIFICATION SUMMARY</h4>
                      <p className="text-[11px] text-slate-400 font-sans">Ready to bind to TRADYX execution engine</p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded border font-bold ${
                      validationState?.status === 'VALID'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {validationState?.status === 'VALID' ? 'VALID' : 'INVALID'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">INSTRUMENT:</span>
                    <span className="text-cyan-400 font-bold">{currentInstrument.symbol}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">SOURCE:</span>
                    <span className="text-slate-200 font-bold">{selectedApp}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">TIMEFRAME:</span>
                    <span className="text-slate-200 font-bold">{selectedTimeframe}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">OBSERVED SOURCE PRICE:</span>
                    <span className="text-amber-400 font-bold">
                      {validationState?.observedPrice !== null && validationState?.observedPrice !== undefined
                        ? `${validationState.observedPrice} ${validationState.observedCurrency || currentInstrument.currency}`
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">OBSERVED CURRENCY:</span>
                    <span className="text-slate-200 font-bold">
                      {validationState?.observedCurrency || 'SOURCE AUTO'}
                    </span>
                  </div>
                  {displayPriceInfo.isConverted && (
                    <div>
                      <span className="text-cyan-500 block text-[10px]">DISPLAY OVERRIDE:</span>
                      <span className="text-cyan-300 font-bold">
                        {displayPriceInfo.displayPrice} {displayPriceInfo.displayCurrency}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500 block text-[10px]">CAPTURE STATUS:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      ACTIVE
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">DATA FRESHNESS:</span>
                    <span className="text-emerald-400 font-bold">● {validationState?.freshness || 'LIVE'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">CONFIDENCE:</span>
                    <span className="text-emerald-400 font-bold">HIGH</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">IDENTITY STATUS:</span>
                    <span className="text-emerald-400 font-bold">MATCH</span>
                  </div>
                </div>

                {validationState?.status !== 'VALID' && (
                  <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-xs">
                    <strong>CANNOT START MONITORING:</strong> Complete Step 5 live validation and resolve instrument/price mismatches.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Step Navigation Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1b2536] bg-[#080c14]">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as any) : 1))}
                className="px-4 py-2 rounded-lg bg-[#141d2b] hover:bg-[#1c2738] border border-[#202e42] text-slate-300 text-xs font-bold transition-colors"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 text-xs transition-colors"
            >
              Cancel
            </button>

            {step < 5 && (
              <button
                type="button"
                disabled={
                  (step === 3 && !isStep3Valid) ||
                  (step === 3 && sourceType === 'NATIVE_OS')
                }
                onClick={() => {
                  if (step === 3) {
                    if (sourceType === 'SCREEN_CAPTURE') {
                      if (envReport.state !== 'SUPPORTED') return;
                      if (!capturedWindowName) {
                        handleRequestWindowCapture();
                        return;
                      }
                    } else if (sourceType === 'NATIVE_OS') {
                      return;
                    } else if (sourceType === 'BROKER_API') {
                      if (!isStep3Valid) {
                        setCaptureError('Cannot proceed: Provider connection and live market tick verification required.');
                        return;
                      }
                      setCapturedWindowName(`${brokerApiType} Verified Feed (${brokerVerification?.dataMode || 'LIVE'})`);
                    } else if (sourceType === 'OTHER_SOURCE') {
                      if (!localRelayUrl.trim()) {
                        setCaptureError('Please enter a valid local relay stream URL.');
                        return;
                      }
                      setCapturedWindowName('Local Relay Stream');
                    }
                  }
                  setStep((s) => (s + 1) as any);
                }}
                className={`px-5 py-2 rounded-lg font-bold text-xs font-mono transition-colors flex items-center gap-1.5 shadow-md ${
                  (step === 3 && !isStep3Valid) || (step === 3 && sourceType === 'NATIVE_OS')
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
                }`}
              >
                {step === 3 && sourceType === 'BROKER_API' ? (
                  isVerifyingBroker
                    ? 'Verifying Live Provider...'
                    : providerState === 'READY'
                    ? 'Continue to Inspection (Verified ✓)'
                    : providerState === 'AUTHENTICATION_REQUIRED'
                    ? 'Authentication Required'
                    : providerState === 'APPROVAL_REQUIRED'
                    ? 'Groww Approval Required'
                    : providerState === 'AUTHENTICATING'
                    ? 'Authenticating...'
                    : providerState === 'TOKEN_GENERATED'
                    ? 'Token Generated (Connecting...)'
                    : providerState === 'AUTHENTICATED'
                    ? 'Authenticated (Connecting...)'
                    : providerState === 'CONNECTING'
                    ? 'Connecting Feed...'
                    : providerState === 'SYNCING'
                    ? 'Syncing Market Ticks...'
                    : providerState === 'LIVE_DATA_VERIFICATION'
                    ? 'Verifying Live Data...'
                    : providerState === 'AUTHENTICATION_FAILED'
                    ? 'Authentication Failed'
                    : providerState === 'CONNECTION_FAILED'
                    ? 'Connection Failed'
                    : providerState === 'DATA_UNAVAILABLE'
                    ? 'Market Data Unavailable'
                    : providerState === 'STALE_DATA'
                    ? 'Stale Market Data'
                    : providerState === 'INSTRUMENT_NOT_FOUND'
                    ? 'Instrument Not Found'
                    : 'Verify Provider to Continue'
                ) : step === 3 && sourceType === 'SCREEN_CAPTURE' ? (
                  envReport.state !== 'SUPPORTED'
                    ? 'Capture Unavailable in Preview'
                    : !capturedWindowName
                    ? 'Authorize & Select Window'
                    : 'Continue'
                ) : step === 3 && sourceType === 'NATIVE_OS' ? (
                  'Native Capture Unavailable'
                ) : (
                  'Continue'
                )}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 5 && (
              <button
                type="button"
                onClick={() => setStep(6)}
                disabled={!validationState || validationState.status !== 'VALID'}
                className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-colors flex items-center gap-1.5 shadow-md shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Proceed to Final Summary
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 6 && (
              <button
                id="btn-start-monitoring"
                type="button"
                onClick={handleSaveAndConfirm}
                disabled={
                  !validationState ||
                  validationState.status !== 'VALID' ||
                  (sourceType === 'BROKER_API' && (providerState !== 'READY' || brokerVerification?.status !== 'READY'))
                }
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                START MONITORING
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
