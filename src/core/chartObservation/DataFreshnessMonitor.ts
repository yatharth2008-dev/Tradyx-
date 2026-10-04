/**
 * TRADYX DataFreshnessMonitor
 * 
 * Tracks live data updates and enforces strict freshness tiers:
 * - LIVE: Received within last 3 seconds
 * - DELAYED: 3 to 10 seconds since last frame/tick
 * - STALE: More than 10 seconds without updates -> triggers ANALYSIS_PAUSED
 * - DISCONNECTED: Capture stream terminated or connection closed
 */

import { SourceFreshnessStatus } from '../../types';

export class DataFreshnessMonitor {
  public static evaluate(lastTimestamp: number | null, isConnected: boolean): SourceFreshnessStatus {
    if (!isConnected) return 'DISCONNECTED';
    if (!lastTimestamp || lastTimestamp <= 0) return 'WAITING_FOR_DATA';

    const elapsedMs = Date.now() - lastTimestamp;

    if (elapsedMs < 2000) {
      return 'LIVE';
    } else if (elapsedMs <= 10000) {
      return 'DELAYED';
    } else {
      return 'STALE';
    }
  }

  public static getBadgeColor(status: SourceFreshnessStatus): {
    bg: string;
    text: string;
    border: string;
    dot: string;
  } {
    switch (status) {
      case 'LIVE':
        return {
          bg: 'bg-emerald-500/10',
          text: 'text-emerald-400',
          border: 'border-emerald-500/30',
          dot: 'bg-emerald-400 animate-pulse'
        };
      case 'DELAYED':
        return {
          bg: 'bg-amber-500/10',
          text: 'text-amber-400',
          border: 'border-amber-500/30',
          dot: 'bg-amber-400'
        };
      case 'STALE':
      case 'ANALYSIS_PAUSED':
        return {
          bg: 'bg-rose-500/10',
          text: 'text-rose-400',
          border: 'border-rose-500/30',
          dot: 'bg-rose-400'
        };
      case 'WAITING_FOR_DATA':
        return {
          bg: 'bg-cyan-500/10',
          text: 'text-cyan-400',
          border: 'border-cyan-500/30',
          dot: 'bg-cyan-400 animate-pulse'
        };
      case 'DISCONNECTED':
      case 'PERMISSION_REQUIRED':
      case 'INVALID':
      default:
        return {
          bg: 'bg-slate-800/80',
          text: 'text-slate-400',
          border: 'border-slate-700',
          dot: 'bg-slate-500'
        };
    }
  }
}
