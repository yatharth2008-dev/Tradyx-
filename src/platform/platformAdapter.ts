import { PlatformTarget } from '../types';
import { CaptureCapabilityService } from '../services/captureCapabilityService';

export interface PlatformCapabilities {
  target: PlatformTarget;
  supportsBackgroundMonitoring: boolean;
  supportsWindowCapture: boolean;
  supportsNativeNotifications: boolean;
  supportsSystemTray: boolean;
  backgroundConstraintDescription: string;
  captureApiName: string;
  isImplemented: boolean;
}

export class PlatformAdapter {
  private static currentPlatform: PlatformTarget = 'WEB';

  public static setPlatform(platform: PlatformTarget) {
    this.currentPlatform = platform;
  }

  public static getPlatform(): PlatformTarget {
    return this.currentPlatform;
  }

  public static getCapabilities(platform: PlatformTarget = this.currentPlatform): PlatformCapabilities {
    const isBrowserSupported = CaptureCapabilityService.isBrowserCaptureSupported();

    switch (platform) {
      case 'WINDOWS':
        return {
          target: 'WINDOWS',
          supportsBackgroundMonitoring: true,
          supportsWindowCapture: false, // NOT IMPLEMENTED in browser web environment
          supportsNativeNotifications: true,
          supportsSystemTray: true,
          backgroundConstraintDescription: 'Windows Native Capture (Windows.Graphics.Capture) is not implemented in browser web application. Requires native desktop container.',
          captureApiName: 'Windows.Graphics.Capture API (requires native desktop build)',
          isImplemented: false
        };
      case 'ANDROID':
        return {
          target: 'ANDROID',
          supportsBackgroundMonitoring: true,
          supportsWindowCapture: false, // NOT IMPLEMENTED in browser web environment
          supportsNativeNotifications: true,
          supportsSystemTray: false,
          backgroundConstraintDescription: 'Android MediaProjection is not implemented in browser web application. Requires native Android APK foreground service.',
          captureApiName: 'Android MediaProjection API (requires native Android APK)',
          isImplemented: false
        };
      case 'WEB':
      default:
        return {
          target: 'WEB',
          supportsBackgroundMonitoring: false,
          supportsWindowCapture: isBrowserSupported,
          supportsNativeNotifications: typeof window !== 'undefined' && 'Notification' in window,
          supportsSystemTray: false,
          backgroundConstraintDescription: isBrowserSupported
            ? 'Browser tab must remain active to maintain full tick frequency.'
            : 'Screen capture is unavailable in this browser environment. Connect via Market Data API or Stream Relay.',
          captureApiName: 'Browser Window Capture',
          isImplemented: true
        };
    }
  }

  public static async sendNotification(title: string, body: string): Promise<boolean> {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(`TRADYX: ${title}`, { body, icon: '/favicon.ico' });
        return true;
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(`TRADYX: ${title}`, { body });
          return true;
        }
      }
    }
    return false;
  }
}
