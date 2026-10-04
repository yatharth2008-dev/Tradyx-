/**
 * TRADYX CaptureCapabilityService
 * 
 * Runtime detection of screen & window capture capabilities.
 * Never assumes support. Differentiates embedded preview iframes,
 * mobile browsers, secure contexts, and native OS capabilities.
 */

import { CaptureCapabilityState, CaptureEnvironmentReport, SourceCapability } from '../types';

export class CaptureCapabilityService {
  /**
   * Detects the exact runtime capabilities of the current client environment.
   */
  public static detectCapabilities(): CaptureEnvironmentReport {
    const isBrowser = typeof window !== 'undefined';
    const isSecureContext = isBrowser ? Boolean(window.isSecureContext) : false;
    const hasMediaDevices = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices);
    const hasGetDisplayMedia = typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function');

    // Detect if running inside an iframe (e.g. AI Studio preview sandbox)
    let isEmbeddedIframe = false;
    if (isBrowser) {
      try {
        isEmbeddedIframe = window.self !== window.top;
      } catch {
        // Cross-origin access failure to window.top proves the window is inside an iframe
        isEmbeddedIframe = true;
      }
    }

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const hostname = isBrowser ? window.location?.hostname || '' : '';
    const isAiStudio = hostname.includes('run.app') || hostname.includes('aistudio') || hostname.includes('google');

    let browserName = 'Web Browser';
    if (ua.includes('Firefox')) browserName = 'Mozilla Firefox';
    else if (ua.includes('Edg/')) browserName = 'Microsoft Edge';
    else if (ua.includes('Chrome')) browserName = 'Google Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browserName = 'Apple Safari';
    else if (isBrowser) browserName = 'Web Browser';

    let state: CaptureCapabilityState = 'UNKNOWN';
    let reason = '';
    let recommendedAction = '';

    if (!isSecureContext) {
      state = 'RESTRICTED';
      reason = 'Screen capture requires a Secure Context (HTTPS or localhost).';
      recommendedAction = 'Access TRADYX over HTTPS or localhost.';
    } else if (!hasGetDisplayMedia) {
      state = 'UNSUPPORTED';
      if (isMobile) {
        reason = 'Mobile browsers do not support desktop window capture.';
        recommendedAction = 'Connect a supported Broker / Market Data API or run on a desktop browser.';
      } else {
        reason = 'The current browser environment does not expose window capture.';
        recommendedAction = 'Connect a supported Broker / Market Data API or select an alternate stream source.';
      }
    } else {
      // getDisplayMedia is exposed by the browser
      state = 'SUPPORTED';
      reason = 'Browser exposes window capture with user authorization.';
      recommendedAction = 'Authorize your trading chart window.';
    }

    return {
      state,
      isSecureContext,
      hasMediaDevices,
      hasGetDisplayMedia,
      isEmbeddedIframe,
      browserName,
      platform: typeof navigator !== 'undefined' ? navigator.platform || 'Web' : 'Node.js',
      isMobile,
      reason,
      recommendedAction
    };
  }

  /**
   * Helper check for whether browser window capture is currently supported
   */
  public static isBrowserCaptureSupported(): boolean {
    const report = this.detectCapabilities();
    return report.state === 'SUPPORTED';
  }

  /**
   * Returns exhaustive list of source adapters and their verified runtime availability
   */
  public static getAvailableAdapters(): SourceCapability[] {
    const report = this.detectCapabilities();

    return [
      {
        id: 'browser-display-capture',
        name: 'Browser Screen / Window Capture',
        type: 'SCREEN_WINDOW_CAPTURE',
        adapterName: 'BrowserDisplayCaptureAdapter',
        isImplemented: true,
        isSupportedInCurrentEnv: report.state === 'SUPPORTED',
        requiresUserPermission: true,
        requiresNativeApp: false,
        supportedPlatforms: ['WEB'],
        status: report.state === 'SUPPORTED' ? 'WAITING_FOR_DATA' : 'UNSUPPORTED_ENVIRONMENT',
        details: report.state === 'SUPPORTED'
          ? 'Operating system window selection dialog via navigator.mediaDevices.getDisplayMedia'
          : `Unavailable: ${report.reason}`
      },
      {
        id: 'broker-api',
        name: 'Broker Market Data API Gateway',
        type: 'BROKER_API',
        adapterName: 'BrokerApiAdapter',
        isImplemented: true,
        isSupportedInCurrentEnv: true,
        requiresUserPermission: true,
        requiresNativeApp: false,
        supportedPlatforms: ['WEB', 'WINDOWS', 'ANDROID'],
        status: 'DISCONNECTED',
        details: 'Direct quote connection for Upstox V3, Angel One SmartAPI, MT5 Bridge, Binance. Requires API keys.'
      },
      {
        id: 'local-relay',
        name: 'Local Video / RTSP Relay Stream',
        type: 'TRADING_APP',
        adapterName: 'LocalRelayAdapter',
        isImplemented: true,
        isSupportedInCurrentEnv: true,
        requiresUserPermission: false,
        requiresNativeApp: false,
        supportedPlatforms: ['WEB', 'WINDOWS', 'ANDROID'],
        status: 'DISCONNECTED',
        details: 'Connect an external RTSP video stream, OBS Virtual Camera, or local agent frame relay.'
      },
      {
        id: 'windows-native-capture',
        name: 'Windows Native Window Capture',
        type: 'SCREEN_WINDOW_CAPTURE',
        adapterName: 'WindowsNativeCaptureAdapter',
        isImplemented: false,
        isSupportedInCurrentEnv: false,
        requiresUserPermission: true,
        requiresNativeApp: true,
        supportedPlatforms: ['WINDOWS'],
        status: 'NOT_IMPLEMENTED',
        details: 'Windows Native Capture (Windows.Graphics.Capture API) is not implemented in browser web application. Requires native desktop executable.'
      },
      {
        id: 'android-mediaprojection',
        name: 'Android MediaProjection Capture',
        type: 'SCREEN_WINDOW_CAPTURE',
        adapterName: 'AndroidMediaProjectionAdapter',
        isImplemented: false,
        isSupportedInCurrentEnv: false,
        requiresUserPermission: true,
        requiresNativeApp: true,
        supportedPlatforms: ['ANDROID'],
        status: 'NOT_IMPLEMENTED',
        details: 'Android MediaProjection capture is not implemented in browser web application. Requires native Android APK foreground service.'
      }
    ];
  }

  /**
   * Explicit clarification of physical cross-device limitation
   */
  public static getCrossDeviceLimitation(): {
    isSupported: false;
    title: string;
    explanation: string;
    supportedWorkarounds: string[];
  } {
    return {
      isSupported: false,
      title: 'Separate Physical Phone Screen Capture Limitation',
      explanation: 'Operating system sandboxing strictly prohibits any web application from reading the screen of a DIFFERENT physical phone through thin air. TRADYX will never pretend it can observe a disconnected physical screen.',
      supportedWorkarounds: [
        'Open your trading chart on the SAME computer or browser running TRADYX',
        'Use authorized Broker Market Data API gateway (no screen capture needed)',
        'Stream phone screen to PC via USB debugging / scrcpy / RTSP local relay',
        'Run TRADYX natively on the mobile device with Android MediaProjection (when native app is deployed)'
      ]
    };
  }
}
