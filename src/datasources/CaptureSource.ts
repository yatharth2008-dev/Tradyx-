/**
 * TRADYX CaptureSource Interface
 * 
 * Defines the contract for all physical, browser, and OS capture adapters.
 * Ensures consistent capability reporting, status tracking, and zero synthetic data leaks.
 */

import { MarketDataSource } from './MarketDataSource';
import { SourceCapability, SourceConnectionStatus } from '../types';

export interface CaptureSource extends MarketDataSource {
  getCapability(): SourceCapability;
  getCaptureStatus(): SourceConnectionStatus;
  isAvailableInEnvironment(): boolean;
}
