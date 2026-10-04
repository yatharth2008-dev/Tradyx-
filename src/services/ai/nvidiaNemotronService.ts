/**
 * TRADYX Client-Side NVIDIA Nemotron 3 Ultra Service Adapter
 *
 * Provides a clean, typed interface to the secure backend Nemotron 3 Ultra service.
 * - Guarantees NVIDIA_API_KEY is never exposed in client bundles or network responses.
 * - Directs all chat completions and diagnostic checks through /api/ai endpoints.
 * - Conforms to the OpenAI-compatible Chat Completion interface.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  enable_thinking?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  thinkingContent?: string;
}

export interface NemotronDiagnosticStatus {
  provider: 'NVIDIA';
  model: string;
  configured: boolean;
  reachable: boolean;
  status: 'READY' | 'MISSING_API_KEY' | 'PROVIDER_UNAVAILABLE' | 'MODEL_ERROR';
  details?: string;
  timestamp: string;
}

export class NvidiaNemotronClientService {
  private static readonly MODEL_NAME = 'nvidia/nemotron-3-ultra-550b-a55b';

  /**
   * Safe diagnostic status method to verify model readiness
   */
  public static async getDiagnosticStatus(): Promise<NemotronDiagnosticStatus> {
    try {
      const res = await fetch('/api/ai/status');
      if (!res.ok) {
        return {
          provider: 'NVIDIA',
          model: this.MODEL_NAME,
          configured: false,
          reachable: false,
          status: 'PROVIDER_UNAVAILABLE',
          details: `Server responded with status ${res.status}`,
          timestamp: new Date().toISOString()
        };
      }
      return await res.json();
    } catch (err: any) {
      return {
        provider: 'NVIDIA',
        model: this.MODEL_NAME,
        configured: false,
        reachable: false,
        status: 'PROVIDER_UNAVAILABLE',
        details: err?.message || 'Network error connecting to backend AI service',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Executes a quick verification ping test against Nemotron 3 Ultra
   */
  public static async testConnection(): Promise<{
    success: boolean;
    text?: string;
    model: string;
    latencyMs: number;
    error?: string;
    hasThinking?: boolean;
  }> {
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        model: this.MODEL_NAME,
        latencyMs: 0,
        error: err?.message || 'Test request failed'
      };
    }
  }

  /**
   * Dispatches a chat completion request to the secure backend proxy
   */
  public static async createChatCompletion(
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    const payload = {
      model: options.model || this.MODEL_NAME,
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens ?? 2048,
      top_p: options.top_p ?? 0.7,
      enable_thinking: options.enable_thinking ?? true
    };

    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Nemotron chat completion failed (${res.status}): ${errorBody}`);
    }

    return await res.json();
  }
}
