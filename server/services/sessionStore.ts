/**
 * TRADYX Secure Server-Side Broker Session Store
 * 
 * CORE PRINCIPLE:
 * Real Broker Authentication -> Server-Side Token & Session Persistence ->
 * Automatic Session Validation on Launch -> Automatic Reconnection.
 * 
 * Zero client-side credentials exposure. Zero secrets in localStorage.
 * Honest lifecycle status: NOT_CONFIGURED | AUTHENTICATION_REQUIRED | AUTHENTICATING |
 * CONNECTED | SYNCING | LIVE | STALE | DISCONNECTED | ERROR.
 */

import fs from 'fs';
import path from 'path';

export type BrokerId = 'upstox' | 'angelone' | 'groww' | 'mexc' | 'exness';

export type BrokerSessionStatus =
  | 'NOT_CONFIGURED'
  | 'AUTHENTICATION_REQUIRED'
  | 'AUTHENTICATING'
  | 'CONNECTED'
  | 'SYNCING'
  | 'LIVE'
  | 'STALE'
  | 'DISCONNECTED'
  | 'ERROR';

export interface StoredSessionRecord {
  brokerId: BrokerId;
  status: BrokerSessionStatus;
  details: string;
  userName?: string;
  accountCode?: string;
  email?: string;
  tokens?: {
    accessToken?: string;
    jwtToken?: string;
    feedToken?: string;
    refreshToken?: string;
    apiKey?: string;
    expiresAt?: number;
  };
  config?: Record<string, any>;
  lastConnectedAt?: string;
  lastValidatedAt?: string;
  lastTickTimestamp?: number;
}

export interface SanitizedSessionSummary {
  brokerId: BrokerId;
  displayName: string;
  status: BrokerSessionStatus;
  details: string;
  isAuthenticated: boolean;
  userName?: string;
  accountCode?: string;
  email?: string;
  lastConnectedAt?: string;
  lastTickTimestamp?: number;
  requiresReconnect: boolean;
}

const SESSION_FILE_PATH = path.join(process.cwd(), '.tradyx-sessions.json');

class SessionStore {
  private sessions = new Map<BrokerId, StoredSessionRecord>();

  constructor() {
    this.loadFromDisk();
    this.initDefaultsIfEmpty();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(SESSION_FILE_PATH)) {
        const raw = fs.readFileSync(SESSION_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          for (const [key, val] of Object.entries(parsed)) {
            this.sessions.set(key as BrokerId, val as StoredSessionRecord);
          }
        }
      }
    } catch (err) {
      console.warn('[SessionStore] Could not read sessions from disk:', err);
    }
  }

  private saveToDisk() {
    try {
      const obj: Record<string, any> = {};
      for (const [key, val] of this.sessions.entries()) {
        obj[key] = val;
      }
      fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[SessionStore] Could not write sessions to disk:', err);
    }
  }

  private initDefaultsIfEmpty() {
    const defaultBrokers: { id: BrokerId; name: string }[] = [
      { id: 'upstox', name: 'Upstox V3' },
      { id: 'angelone', name: 'Angel One SmartAPI' },
      { id: 'groww', name: 'Groww Market Data' },
      { id: 'mexc', name: 'MEXC Global' },
      { id: 'exness', name: 'Exness / MT5 Forex' }
    ];

    for (const b of defaultBrokers) {
      if (!this.sessions.has(b.id)) {
        this.sessions.set(b.id, {
          brokerId: b.id,
          status: 'NOT_CONFIGURED',
          details: `${b.name} requires one-time secure authorization.`
        });
      }
    }
  }

  public getSession(brokerId: BrokerId): StoredSessionRecord | undefined {
    return this.sessions.get(brokerId);
  }

  public setSession(brokerId: BrokerId, session: Partial<StoredSessionRecord>) {
    const existing = this.sessions.get(brokerId) || {
      brokerId,
      status: 'NOT_CONFIGURED',
      details: 'Initialized'
    };
    const updated: StoredSessionRecord = {
      ...existing,
      ...session,
      brokerId
    };
    this.sessions.set(brokerId, updated);
    this.saveToDisk();
    return updated;
  }

  public updateStatus(brokerId: BrokerId, status: BrokerSessionStatus, details?: string) {
    const sess = this.sessions.get(brokerId);
    if (sess) {
      sess.status = status;
      if (details) sess.details = details;
      this.saveToDisk();
    }
  }

  public recordTick(brokerId: BrokerId, ts = Date.now()) {
    const sess = this.sessions.get(brokerId);
    if (sess) {
      sess.lastTickTimestamp = ts;
      if (sess.status !== 'LIVE') {
        sess.status = 'LIVE';
      }
    }
  }

  public clearSession(brokerId: BrokerId) {
    this.sessions.set(brokerId, {
      brokerId,
      status: 'NOT_CONFIGURED',
      details: 'Session disconnected by user.'
    });
    this.saveToDisk();
  }

  /**
   * Sanitized session list for safe frontend consumption (no secrets or private tokens)
   */
  public getSanitizedSessions(): SanitizedSessionSummary[] {
    const displayNames: Record<BrokerId, string> = {
      upstox: 'Upstox Developer V3',
      angelone: 'Angel One SmartAPI',
      groww: 'Groww Market Data',
      mexc: 'MEXC Crypto (Spot & Futures)',
      exness: 'Exness / MT5 Forex'
    };

    return Array.from(this.sessions.entries()).map(([id, sess]) => {
      const isExpired = Boolean(sess.tokens?.expiresAt && sess.tokens.expiresAt < Date.now());
      const effectiveStatus: BrokerSessionStatus = isExpired ? 'AUTHENTICATION_REQUIRED' : sess.status;

      return {
        brokerId: id,
        displayName: displayNames[id] || id,
        status: effectiveStatus,
        details: isExpired ? 'Session token expired. Reconnect required.' : sess.details,
        isAuthenticated: Boolean(sess.tokens?.accessToken || sess.tokens?.jwtToken || sess.tokens?.apiKey) && !isExpired,
        userName: sess.userName,
        accountCode: sess.accountCode,
        email: sess.email,
        lastConnectedAt: sess.lastConnectedAt,
        lastTickTimestamp: sess.lastTickTimestamp,
        requiresReconnect: isExpired || effectiveStatus === 'AUTHENTICATION_REQUIRED'
      };
    });
  }
}

export const sessionStore = new SessionStore();
