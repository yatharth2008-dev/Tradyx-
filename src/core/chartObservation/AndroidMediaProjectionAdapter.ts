/**
 * TRADYX AndroidMediaProjectionAdapter
 * 
 * Android architecture adapter for MediaProjection API (Android 10 - Android 14+).
 * Requires explicit user consent via MediaProjectionManager.createScreenCaptureIntent(),
 * foreground service type 'mediaProjection' with persistent notification,
 * and handles Android 14+ projection session callbacks.
 * 
 * Includes strict enforcement of the "Other Phone Limitation":
 * TRADYX on Device A cannot access Device B's screen without an authorized network bridge.
 */

export interface AndroidCaptureState {
  isGranted: boolean;
  isForegroundServiceRunning: boolean;
  virtualDisplayActive: boolean;
  targetAppPackage?: string;
  targetAppName?: string;
  projectionSessionValid: boolean;
  errorCode?: string;
}

export class AndroidMediaProjectionAdapter {
  private static instance: AndroidMediaProjectionAdapter;

  private isAndroidHost: boolean;
  private state: AndroidCaptureState = {
    isGranted: false,
    isForegroundServiceRunning: false,
    virtualDisplayActive: false,
    projectionSessionValid: false
  };

  private constructor() {
    this.isAndroidHost =
      typeof navigator !== 'undefined' &&
      /android/i.test(navigator.userAgent) &&
      !!(window as any).__TRADYX_ANDROID_BRIDGE__;
  }

  public static getInstance(): AndroidMediaProjectionAdapter {
    if (!AndroidMediaProjectionAdapter.instance) {
      AndroidMediaProjectionAdapter.instance = new AndroidMediaProjectionAdapter();
    }
    return AndroidMediaProjectionAdapter.instance;
  }

  public isSupported(): boolean {
    return this.isAndroidHost;
  }

  /**
   * Evaluates whether the requested chart is on another physical device
   */
  public evaluateDeviceLocation(chartLocationType: 'SAME_DEVICE' | 'OTHER_PHONE'): {
    allowed: boolean;
    reason?: string;
    actionableAlternatives?: string[];
  } {
    if (chartLocationType === 'OTHER_PHONE') {
      return {
        allowed: false,
        reason: 'THIS CHART IS ON ANOTHER DEVICE. TRADYX cannot magically observe or inspect the screen of a separate physical phone.',
        actionableAlternatives: [
          'Run TRADYX directly on the same Android device where your trading app is open, and grant MediaProjection permission.',
          'Run TRADYX on Windows and select the trading application window using Windows.Graphics.Capture.',
          'Connect via an official broker or market data API (e.g. Upstox, Angel One, Binance, Deriv API).',
          'Export or stream authorized video via a verified local network bridge.'
        ]
      };
    }
    return { allowed: true };
  }

  /**
   * Prompts user for Android MediaProjection permission
   */
  public async requestMediaProjectionConsent(): Promise<{
    granted: boolean;
    error?: string;
  }> {
    if (!this.isAndroidHost) {
      return {
        granted: false,
        error: 'Android MediaProjection requires the TRADYX Android APK environment. Running in Web mode.'
      };
    }

    try {
      const bridge = (window as any).__TRADYX_ANDROID_BRIDGE__;
      const result = await bridge.requestScreenCapture();
      this.state.isGranted = result.granted;
      this.state.isForegroundServiceRunning = result.granted;
      this.state.virtualDisplayActive = result.granted;
      this.state.projectionSessionValid = result.granted;
      return { granted: result.granted };
    } catch (err: any) {
      return { granted: false, error: err.message };
    }
  }

  public getState(): AndroidCaptureState {
    return { ...this.state };
  }

  public stopCapture() {
    if (this.isAndroidHost) {
      (window as any).__TRADYX_ANDROID_BRIDGE__?.stopScreenCapture();
    }
    this.state = {
      isGranted: false,
      isForegroundServiceRunning: false,
      virtualDisplayActive: false,
      projectionSessionValid: false
    };
  }
}
