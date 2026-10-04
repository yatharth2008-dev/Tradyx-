/**
 * TRADYX WindowCaptureManager
 * 
 * Manages live screen & application window capture via user-authorized display streams.
 * In a browser environment, uses navigator.mediaDevices.getDisplayMedia with displaySurface: 'window'.
 * Extracts live video frames into an offscreen canvas for OCR and visual analysis.
 */

export interface CapturedWindowMetadata {
  applicationName: string;
  windowTitle: string;
  windowId: string;
  width: number;
  height: number;
  frameRate: number;
  capturedAt: number;
}

export type FrameCaptureCallback = (frameDataUrl: string, width: number, height: number) => void;
export type CaptureDisconnectCallback = (reason: string) => void;

export class WindowCaptureManager {
  private static instance: WindowCaptureManager;

  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private activeMetadata: CapturedWindowMetadata | null = null;
  private isCapturing = false;
  private captureIntervalId: any = null;

  private frameListeners = new Set<FrameCaptureCallback>();
  private disconnectListeners = new Set<CaptureDisconnectCallback>();

  private lastCapturedFrameUrl: string | null = null;
  private lastCapturedTimestamp = 0;

  private constructor() {}

  public static getInstance(): WindowCaptureManager {
    if (!WindowCaptureManager.instance) {
      WindowCaptureManager.instance = new WindowCaptureManager();
    }
    return WindowCaptureManager.instance;
  }

  /**
   * Prompts the operating system window picker for user-authorized capture
   */
  public async requestWindowCapture(preferredAppHint?: string): Promise<{
    success: boolean;
    metadata: CapturedWindowMetadata | null;
    error?: string;
  }> {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
        return {
          success: false,
          metadata: null,
          error: 'Operating system window capture is not supported in this browser/environment.'
        };
      }

      // Stop any existing stream
      this.stopCapture();

      // Request window-level display media from OS
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'window' as any,
          frameRate: { ideal: 15, max: 30 },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      this.mediaStream = stream;
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      const trackLabel = videoTrack.label || 'Application Window';

      // Parse application and window title from track label if available
      const appName = preferredAppHint || this.parseAppNameFromLabel(trackLabel);
      const windowTitle = trackLabel;

      this.activeMetadata = {
        applicationName: appName,
        windowTitle: windowTitle,
        windowId: videoTrack.id,
        width: settings.width || 1280,
        height: settings.height || 720,
        frameRate: settings.frameRate || 15,
        capturedAt: Date.now()
      };

      // Set up hidden video element to feed the canvas
      this.setupVideoProcessing(stream);

      // Listen for when user stops sharing via browser UI
      videoTrack.addEventListener('ended', () => {
        this.handleStreamEnded('User terminated window capture or closed application window');
      });

      this.isCapturing = true;

      return {
        success: true,
        metadata: this.activeMetadata
      };
    } catch (err: any) {
      let errorMsg = err?.message || 'Failed to capture application window.';
      if (err.name === 'NotAllowedError') {
        errorMsg = 'User cancelled or declined the window selection dialog.';
      } else if (err.name === 'SecurityError') {
        errorMsg = 'Window capture is prohibited by the iframe sandbox or security policy.';
      } else if (err.name === 'NotSupportedError') {
        errorMsg = 'getDisplayMedia is not supported in this environment.';
      } else if (err.name === 'NotFoundError') {
        errorMsg = 'No capture surface was selected or available.';
      }

      return {
        success: false,
        metadata: null,
        error: errorMsg
      };
    }
  }

  private setupVideoProcessing(stream: MediaStream) {
    if (typeof document === 'undefined') return;

    if (!this.videoElement) {
      this.videoElement = document.createElement('video');
      this.videoElement.autoplay = true;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      this.videoElement.style.display = 'none';
      document.body.appendChild(this.videoElement);
    }

    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
      this.canvasCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    }

    this.videoElement.srcObject = stream;
    this.videoElement.play().catch((e) => console.warn('Video play error:', e));

    // Sample frames every 500ms for OCR & visual price reading
    if (this.captureIntervalId) clearInterval(this.captureIntervalId);
    this.captureIntervalId = setInterval(() => {
      this.captureFrame();
    }, 500);
  }

  private captureFrame() {
    if (!this.videoElement || !this.offscreenCanvas || !this.canvasCtx || !this.isCapturing) return;
    if (this.videoElement.videoWidth === 0 || this.videoElement.videoHeight === 0) return;

    const width = this.videoElement.videoWidth;
    const height = this.videoElement.videoHeight;

    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;

    this.canvasCtx.drawImage(this.videoElement, 0, 0, width, height);

    try {
      const dataUrl = this.offscreenCanvas.toDataURL('image/jpeg', 0.85);
      this.lastCapturedFrameUrl = dataUrl;
      this.lastCapturedTimestamp = Date.now();

      this.frameListeners.forEach((cb) => cb(dataUrl, width, height));
    } catch (e) {
      console.warn('Frame conversion error:', e);
    }
  }

  public getLatestFrame(): { frameUrl: string | null; timestamp: number } {
    return {
      frameUrl: this.lastCapturedFrameUrl,
      timestamp: this.lastCapturedTimestamp
    };
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.offscreenCanvas;
  }

  public getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  public getMetadata(): CapturedWindowMetadata | null {
    return this.activeMetadata;
  }

  public getIsCapturing(): boolean {
    return this.isCapturing;
  }

  public stopCapture() {
    if (this.captureIntervalId) {
      clearInterval(this.captureIntervalId);
      this.captureIntervalId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.isCapturing = false;
    this.activeMetadata = null;
  }

  private handleStreamEnded(reason: string) {
    this.stopCapture();
    this.disconnectListeners.forEach((cb) => cb(reason));
  }

  public onFrame(cb: FrameCaptureCallback) {
    this.frameListeners.add(cb);
    return () => this.frameListeners.delete(cb);
  }

  public onDisconnect(cb: CaptureDisconnectCallback) {
    this.disconnectListeners.add(cb);
    return () => this.disconnectListeners.delete(cb);
  }

  private parseAppNameFromLabel(label: string): string {
    const lower = label.toLowerCase();
    if (lower.includes('tradingview')) return 'TradingView';
    if (lower.includes('metatrader') || lower.includes('mt4') || lower.includes('mt5')) return 'MetaTrader';
    if (lower.includes('chrome')) return 'Web Trading (Google Chrome)';
    if (lower.includes('edge')) return 'Web Trading (Microsoft Edge)';
    if (lower.includes('upstox')) return 'Upstox Pro';
    if (lower.includes('angel') || lower.includes('smartapi')) return 'Angel One';
    if (lower.includes('pocketoption')) return 'Pocket Option';
    if (lower.includes('quotex')) return 'Quotex';
    if (lower.includes('exness')) return 'Exness WebTrader';
    return label || 'Trading Application';
  }
}
