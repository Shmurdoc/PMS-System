import { getAuthToken } from './api/config';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  requestId: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatuses: number[];
  retryableErrors: string[];
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'ECONNABORTED'],
};

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelay
  );
  const jitter = Math.random() * 0.3 * delay;
  return delay + jitter;
}

function isRetryable(error: unknown, config: RetryConfig): boolean {
  if (error instanceof Response) {
    return config.retryableStatuses.includes(error.status);
  }
  
  if (error instanceof Error) {
    const errorCode = (error as unknown as { code?: string }).code;
    if (errorCode && config.retryableErrors.includes(errorCode)) {
      return true;
    }
  }
  
  return false;
}

export async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit & { retryConfig?: Partial<RetryConfig> } = {}
): Promise<ApiResponse<T>> {
  const { retryConfig, ...fetchOptions } = options;
  const config = { ...defaultRetryConfig, ...retryConfig };
  const requestId = generateRequestId();
  const token = getAuthToken();
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...fetchOptions.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok && config.retryableStatuses.includes(response.status)) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Read as text first: 204 No Content passes through the envelope
      // middleware unwrapped with an empty body, and response.json() would throw.
      const raw = await response.text();

      if (raw.length === 0) {
        if (response.ok) {
          return {
            success: true,
            timestamp: new Date().toISOString(),
            requestId,
          };
        }
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: response.statusText || `Request failed with status ${response.status}`,
          },
          timestamp: new Date().toISOString(),
          requestId,
        };
      }

      const data = JSON.parse(raw) as ApiResponse<T>;

      return {
        ...data,
        requestId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      lastError = error;

      if (attempt < config.maxRetries && isRetryable(error, config)) {
        const delay = calculateDelay(attempt, config);
        console.warn(`Retry attempt ${attempt + 1}/${config.maxRetries} after ${delay.toFixed(0)}ms`, { url });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      break;
    }
  }

  return {
    success: false,
    error: {
      code: 'REQUEST_FAILED',
      message: lastError instanceof Error ? lastError.message : 'Unknown error',
      details: lastError,
    },
    timestamp: new Date().toISOString(),
    requestId,
  };
}

export function createApiClient(baseUrl: string) {
  return {
    get: <T = unknown>(endpoint: string, options?: RequestInit) =>
      apiRequest<T>(`${baseUrl}${endpoint}`, { ...options, method: 'GET' }),
    
    post: <T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) =>
      apiRequest<T>(`${baseUrl}${endpoint}`, { ...options, method: 'POST', body: JSON.stringify(body) }),
    
    put: <T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) =>
      apiRequest<T>(`${baseUrl}${endpoint}`, { ...options, method: 'PUT', body: JSON.stringify(body) }),
    
    patch: <T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) =>
      apiRequest<T>(`${baseUrl}${endpoint}`, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
    
    delete: <T = unknown>(endpoint: string, options?: RequestInit) =>
      apiRequest<T>(`${baseUrl}${endpoint}`, { ...options, method: 'DELETE' }),
  };
}
