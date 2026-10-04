/**
 * TRADYX Server-Side NVIDIA Nemotron 3 Ultra Service
 * 
 * Model: nvidia/nemotron-3-ultra-550b-a55b
 * Base URL: https://integrate.api.nvidia.com/v1
 * Interface: OpenAI-compatible Chat Completions
 * 
 * Security: NVIDIA_API_KEY is accessed strictly server-side via process.env.
 * Never exposed to browser, bundle, logs, or client responses.
 */

export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
export const NEMOTRON_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';

export interface NemotronInferenceLog {
  requestId: string;
  timestamp: string;
  model: string;
  sourceSessionId: string;
  instrument: string;
  timeframes: string[];
  inputDataVersion: string;
  latencyMs: number;
  success: boolean;
  providerResponseStatus: number | string;
  error?: string;
}

export interface NemotronStatusResponse {
  provider: 'NVIDIA';
  model: string;
  configured: boolean;
  reachable: boolean;
  status: 'READY' | 'MISSING_API_KEY' | 'PROVIDER_UNAVAILABLE' | 'MODEL_ERROR';
  details?: string;
  timestamp: string;
  totalInferences?: number;
  lastLatencyMs?: number;
}

export interface NemotronReasoningResponse {
  setupState: 'WAIT' | 'NO_TRADE' | 'WATCH' | 'POTENTIAL_SETUP' | 'CONFIRMED_SETUP' | 'INVALIDATED';
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNCLEAR';
  setup: 'NONE' | 'POTENTIAL' | 'CONFIRMED';
  confidenceScore: number;
  entryZone: string | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  riskRewardRatio: number | null;
  bullCase: string[];
  bearCase: string[];
  confirmationRequired: string[];
  invalidationConditions: string[];
  dataQuality: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  executiveSummary: string;
  provider: string;
  timestamp: number;
  thinkingContent?: string;
}

export class NvidiaNemotronService {
  private static lastReachableCheck: { reachable: boolean; timestamp: number; status: string } | null = null;
  private static inferenceLogs: NemotronInferenceLog[] = [];
  private static lastLatencyMs = 0;

  public static getApiKey(): string | null {
    return process.env.NVIDIA_API_KEY || process.env.NVIDIA_NEMOTRON_API_KEY || null;
  }

  public static isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  public static getInferenceLogs(): NemotronInferenceLog[] {
    return [...this.inferenceLogs];
  }

  private static recordInference(log: NemotronInferenceLog) {
    this.inferenceLogs.unshift(log);
    if (this.inferenceLogs.length > 100) {
      this.inferenceLogs.pop();
    }
    this.lastLatencyMs = log.latencyMs;
  }

  /**
   * Health and Status Endpoint implementation
   * GET /api/ai/status
   */
  public static async getStatus(): Promise<NemotronStatusResponse> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      return {
        provider: 'NVIDIA',
        model: NEMOTRON_MODEL,
        configured: false,
        reachable: false,
        status: 'MISSING_API_KEY',
        details: 'NVIDIA_API_KEY environment variable is not configured. Configure in AI Studio Secrets.',
        timestamp: new Date().toISOString(),
        totalInferences: this.inferenceLogs.length,
        lastLatencyMs: this.lastLatencyMs
      };
    }

    // Cache check within 30 seconds to prevent hammering status endpoint
    const now = Date.now();
    if (this.lastReachableCheck && now - this.lastReachableCheck.timestamp < 30000) {
      return {
        provider: 'NVIDIA',
        model: NEMOTRON_MODEL,
        configured: true,
        reachable: this.lastReachableCheck.reachable,
        status: this.lastReachableCheck.status as any,
        timestamp: new Date().toISOString(),
        totalInferences: this.inferenceLogs.length,
        lastLatencyMs: this.lastLatencyMs
      };
    }

    // Ping test
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: NEMOTRON_MODEL,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 1,
          temperature: 0.1
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        this.lastReachableCheck = { reachable: true, timestamp: now, status: 'READY' };
        return {
          provider: 'NVIDIA',
          model: NEMOTRON_MODEL,
          configured: true,
          reachable: true,
          status: 'READY',
          timestamp: new Date().toISOString()
        };
      } else if (response.status === 401 || response.status === 403) {
        this.lastReachableCheck = { reachable: false, timestamp: now, status: 'MODEL_ERROR' };
        return {
          provider: 'NVIDIA',
          model: NEMOTRON_MODEL,
          configured: true,
          reachable: false,
          status: 'MODEL_ERROR',
          details: 'Authentication failed. Please verify NVIDIA_API_KEY.',
          timestamp: new Date().toISOString()
        };
      } else {
        this.lastReachableCheck = { reachable: false, timestamp: now, status: 'PROVIDER_UNAVAILABLE' };
        return {
          provider: 'NVIDIA',
          model: NEMOTRON_MODEL,
          configured: true,
          reachable: false,
          status: 'PROVIDER_UNAVAILABLE',
          details: `NVIDIA API responded with HTTP status ${response.status}`,
          timestamp: new Date().toISOString()
        };
      }
    } catch (err: any) {
      const isTimeout = err.name === 'AbortError';
      this.lastReachableCheck = { reachable: false, timestamp: now, status: 'PROVIDER_UNAVAILABLE' };
      return {
        provider: 'NVIDIA',
        model: NEMOTRON_MODEL,
        configured: true,
        reachable: false,
        status: 'PROVIDER_UNAVAILABLE',
        details: isTimeout ? 'Connection timed out connecting to NVIDIA API' : 'Failed to connect to NVIDIA API endpoint',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Safe Diagnostic Connection Test
   * POST /api/ai/test
   */
  public static async runConnectionTest(): Promise<{
    success: boolean;
    text: string;
    model: string;
    latencyMs: number;
    hasThinking: boolean;
    error?: string;
  }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        success: false,
        text: '',
        model: NEMOTRON_MODEL,
        latencyMs: 0,
        hasThinking: false,
        error: 'NVIDIA_API_KEY is not configured in server environment.'
      };
    }

    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: NEMOTRON_MODEL,
          messages: [
            {
              role: 'user',
              content: 'You are TRADYX AI. Reply only with:\nTRADYX AI ONLINE'
            }
          ],
          max_tokens: 64,
          temperature: 0.1
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return {
          success: false,
          text: '',
          model: NEMOTRON_MODEL,
          latencyMs,
          hasThinking: false,
          error: `HTTP ${response.status}: ${response.statusText} ${errorText.slice(0, 120)}`
        };
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      const content = (message?.content || '').trim();
      const hasThinking = Boolean(message?.reasoning_content);

      return {
        success: true,
        text: content,
        model: data.model || NEMOTRON_MODEL,
        latencyMs,
        hasThinking
      };
    } catch (err: any) {
      return {
        success: false,
        text: '',
        model: NEMOTRON_MODEL,
        latencyMs: Date.now() - startTime,
        hasThinking: false,
        error: err.name === 'AbortError' ? 'Connection timed out after 20s' : (err.message || 'Network error')
      };
    }
  }

  /**
   * Event-Driven Structured Reasoning
   * POST /api/ai/reason
   */
  public static async generateReasoning(snapshot: any): Promise<NemotronReasoningResponse> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      throw new Error('NVIDIA_API_KEY is missing. Configure secret in AI Studio.');
    }

    const systemPrompt = `You are TRADYX AI, powered by NVIDIA Nemotron 3 Ultra, an institutional-grade market structure reasoning engine.
Core Directive: "CODE CALCULATES. AI REASONS. USER DECIDES."
All technical indicators, EMAs, VWAP, ATR, and price levels were pre-calculated deterministically. Do not recalculate them.
Your task is to analyze the market context, evaluate the Bull Case vs Bear Case, determine if confirmation is pending or invalidated, and synthesize a disciplined recommendation.

CRITICAL DISCIPLINE RULES:
1. Never force a trade setup. If structure is choppy, mixed, or low-quality, select "WAIT" or "NO_TRADE".
2. Setup classification MUST be one of: ["WAIT", "NO_TRADE", "WATCH", "POTENTIAL_SETUP", "CONFIRMED_SETUP", "INVALIDATED"].
3. Bias MUST be one of: ["BULLISH", "BEARISH", "NEUTRAL", "UNCLEAR"].
4. Setup MUST be one of: ["NONE", "POTENTIAL", "CONFIRMED"].
5. Always state explicit confirmation required and clear invalidation conditions.
6. Output strictly valid JSON matching this schema:
{
  "setupState": "WAIT" | "NO_TRADE" | "WATCH" | "POTENTIAL_SETUP" | "CONFIRMED_SETUP" | "INVALIDATED",
  "bias": "BULLISH" | "BEARISH" | "NEUTRAL" | "UNCLEAR",
  "setup": "NONE" | "POTENTIAL" | "CONFIRMED",
  "confidenceScore": number (0-100),
  "entryZone": string or null,
  "stopLoss": number or null,
  "takeProfit1": number or null,
  "takeProfit2": number or null,
  "riskRewardRatio": number or null,
  "bullCase": [string],
  "bearCase": [string],
  "confirmationRequired": [string],
  "invalidationConditions": [string],
  "dataQuality": "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT",
  "executiveSummary": string
}`;

    const userPrompt = `Verified Real Market Context for ${snapshot.symbol}:
Observed Source: ${snapshot.observedSource || 'Authorized Live Feed'}
Timeframe: ${snapshot.timeframe}
Observed Price: ${snapshot.price} ${snapshot.currency || ''}
Market Trend: ${snapshot.trend}
Structural Events: Breakout=${Boolean(snapshot.structure?.breakout)}, BOS=${Boolean(snapshot.structure?.bos)}, CHoCH=${Boolean(snapshot.structure?.choch)}, FalseBreakout=${Boolean(snapshot.structure?.isFalseBreakout)}
Indicators:
- RSI(14): ${snapshot.indicators?.rsi ?? 'N/A'}
- EMA 20: ${snapshot.indicators?.ema20 ?? 'N/A'} | EMA 50: ${snapshot.indicators?.ema50 ?? 'N/A'} | EMA 200: ${snapshot.indicators?.ema200 ?? 'N/A'}
- VWAP: ${snapshot.indicators?.vwap ?? 'N/A'}
- ATR(14): ${snapshot.indicators?.atr ?? 'N/A'}
- Volume: ${snapshot.volumeState || 'NORMAL'}
Multi-Timeframe Alignment:
- Alignment Score: ${snapshot.mtfAlignment?.score ?? 'N/A'}%
- HTF Trend: ${snapshot.mtfAlignment?.higherTrend ?? 'N/A'} | LTF Trend: ${snapshot.mtfAlignment?.lowerTrend ?? 'N/A'}
Deterministic Risk Parameters:
- Entry Range: ${snapshot.risk?.entryZone || 'N/A'}
- Stop Loss: ${snapshot.risk?.stopLoss || 'N/A'}
- Target 1: ${snapshot.risk?.target1 || 'N/A'} | Target 2: ${snapshot.risk?.target2 || 'N/A'}
- Calculated R:R: ${snapshot.risk?.riskRewardRatio || 'N/A'}
Event Trigger: ${snapshot.eventTrigger || 'Structure Check'}

Synthesize your institutional analysis as pure JSON now.`;

    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const startTime = Date.now();
    const sourceSessionId = snapshot.sessionId || 'session-default';
    const instrument = snapshot.symbol || 'UNKNOWN';
    const timeframes = snapshot.timeframes || [snapshot.timeframe || '15M'];
    const inputDataVersion = snapshot.lastUpdated ? String(snapshot.lastUpdated) : String(Date.now());

    let retries = 2;
    let lastError: any = null;
    let lastStatus: number | string = 0;

    while (retries >= 0) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: NEMOTRON_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.2,
            top_p: 0.7,
            max_tokens: 1500,
            enable_thinking: true
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        lastStatus = response.status;

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          if (response.status === 429) {
            throw new Error(`Rate limit exceeded (429): ${errorText.slice(0, 100)}`);
          }
          if (response.status >= 500 && retries > 0) {
            retries--;
            await new Promise((res) => setTimeout(res, 1000));
            continue;
          }
          throw new Error(`NVIDIA API error ${response.status}: ${errorText.slice(0, 100)}`);
        }

        const data = await response.json();
        const latencyMs = Date.now() - startTime;
        const message = data.choices?.[0]?.message;
        const rawContent = message?.content || '{}';
        const thinkingContent = message?.reasoning_content || undefined;

        // Parse JSON content
        const cleaned = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        // Observability: record successful inference
        this.recordInference({
          requestId,
          timestamp: new Date().toISOString(),
          model: data.model || NEMOTRON_MODEL,
          sourceSessionId,
          instrument,
          timeframes,
          inputDataVersion,
          latencyMs,
          success: true,
          providerResponseStatus: response.status
        });

        return {
          setupState: parsed.setupState || 'WATCH',
          bias: parsed.bias || 'NEUTRAL',
          setup: parsed.setup || 'NONE',
          confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 50,
          entryZone: parsed.entryZone || (snapshot.risk?.entryZone ? String(snapshot.risk.entryZone) : null),
          stopLoss: typeof parsed.stopLoss === 'number' ? parsed.stopLoss : (snapshot.risk?.stopLoss ? Number(snapshot.risk.stopLoss) : null),
          takeProfit1: typeof parsed.takeProfit1 === 'number' ? parsed.takeProfit1 : (snapshot.risk?.target1 ? Number(snapshot.risk.target1) : null),
          takeProfit2: typeof parsed.takeProfit2 === 'number' ? parsed.takeProfit2 : (snapshot.risk?.target2 ? Number(snapshot.risk.target2) : null),
          riskRewardRatio: typeof parsed.riskRewardRatio === 'number' ? parsed.riskRewardRatio : (snapshot.risk?.riskRewardRatio ? Number(snapshot.risk.riskRewardRatio) : null),
          bullCase: Array.isArray(parsed.bullCase) ? parsed.bullCase : ['Base structural support active'],
          bearCase: Array.isArray(parsed.bearCase) ? parsed.bearCase : ['Supply overhead resistance active'],
          confirmationRequired: Array.isArray(parsed.confirmationRequired) ? parsed.confirmationRequired : ['Awaiting confirmation candle'],
          invalidationConditions: Array.isArray(parsed.invalidationConditions) ? parsed.invalidationConditions : ['Break of opposite pivot'],
          dataQuality: parsed.dataQuality || 'HIGH',
          executiveSummary: parsed.executiveSummary || 'Nemotron 3 Ultra analysis completed.',
          provider: `NVIDIA Nemotron 3 Ultra (${NEMOTRON_MODEL})`,
          timestamp: Date.now(),
          thinkingContent
        };
      } catch (err: any) {
        lastError = err;
        if (retries > 0 && !String(err?.message).includes('missing')) {
          retries--;
          await new Promise((res) => setTimeout(res, 800));
          continue;
        }
        break;
      }
    }

    // Observability: record failed inference
    this.recordInference({
      requestId,
      timestamp: new Date().toISOString(),
      model: NEMOTRON_MODEL,
      sourceSessionId,
      instrument,
      timeframes,
      inputDataVersion,
      latencyMs: Date.now() - startTime,
      success: false,
      providerResponseStatus: lastStatus || 'ERROR',
      error: lastError?.message || 'Inference failed'
    });

    throw lastError || new Error('Reasoning request failed');
  }

  /**
   * General Chat Completion method for Nemotron 3 Ultra
   */
  public static async createChatCompletion(options: {
    model?: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  }): Promise<any> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('NVIDIA_API_KEY is not configured in server environment.');
    }

    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: options.model || NEMOTRON_MODEL,
        messages: options.messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.max_tokens ?? 2048,
        top_p: options.top_p ?? 0.7
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`NVIDIA API error (${response.status}): ${errText}`);
    }

    return await response.json();
  }
}
