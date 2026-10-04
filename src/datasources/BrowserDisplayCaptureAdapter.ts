/**
 * TRADYX BrowserDisplayCaptureAdapter
 * 
 * Handles client-side browser screen/window capture via navigator.mediaDevices.getDisplayMedia.
 * Strictly checks runtime capabilities before requesting capture.
 * If running in an unsupported environment (embedded iframe, mobile browser, insecure context),
 * returns UNSUPPORTED_ENVIRONMENT and never attempts to fake a stream or data.
 */

import { RealMarketCaptureSource } from './RealMarketCaptureSource';
import { CaptureSource } from './CaptureSource';
import { ConnectionStatus, SourceCapability, SourceConnectionStatus } from '../types';
import { CaptureCapabilityService } from '../services/captureCapabilityService';

export class BrowserDisplayCaptureAdapter extends RealMarketCaptureSource implements CaptureSource {
  public override id = 'browser-display-capture';
  public override name = 'Browser Window Display Capture';
  public override description = 'User-authorized window/tab capture via standard getDisplayMedia API';

  public isAvailableInEnvironment(): boolean {
    return CaptureCapabilityService.isBrowserCaptureSupported();
  }

  public getCapability(): SourceCapability {
    const report = CaptureCapabilityService.detectCapabilities();
    return {
      id: this.id,
      name: this.name,
      type: 'SCREEN_WINDOW_CAPTURE',
      adapterName: 'BrowserDisplayCaptureAdapter',
      isImplemented: true,
      isSupportedInCurrentEnv: report.state === 'SUPPORTED',
      requiresUserPermission: true,
      requiresNativeApp: false,
      supportedPlatforms: ['WEB'],
      status: this.getCaptureStatus(),
      details: report.state === 'SUPPORTED'
        ? 'Standard browser getDisplayMedia window selection'
        : report.reason
    };
  }

  public getCaptureStatus(): SourceConnectionStatus {
    const report = CaptureCapabilityService.detectCapabilities();
    if (report.state !== 'SUPPORTED') {
      return 'UNSUPPORTED_ENVIRONMENT';
    }

    const baseStatus = this.getStatus();
    if (baseStatus === 'DATA_CONNECTED') return 'CONNECTED';
    if (baseStatus === 'PERMISSION_REQUIRED') return 'WAITING_FOR_DATA';
    if (baseStatus === 'DATA_DISCONNECTED') return 'DISCONNECTED';
    return 'WAITING_FOR_DATA';
  }

  public override async connect(): Promise<boolean> {
    const report = CaptureCapabilityService.detectCapabilities();
    if (report.state !== 'SUPPORTED') {
      this.setStatus('DATA_UNAVAILABLE' as ConnectionStatus);
      return false;
    }

    return super.connect();
  }
}
