import type { NaverAdsConfig } from '../config.js';
import { NaverAdsApiError, NaverAdsTransportError, redactSecrets } from './errors.js';
import { buildAuthHeaders, type HttpMethod } from './signature.js';

/** 쿼리스트링에 실을 수 있는 값. 배열은 콤마 조인, 객체는 JSON 직렬화된다. */
export type QueryValue =
  | string
  | number
  | boolean
  | readonly (string | number)[]
  | object
  | null
  | undefined;
export type Query = Record<string, QueryValue>;

export interface RequestOptions {
  method: HttpMethod;
  /** 쿼리스트링을 제외한 경로. 예: `/ncc/campaigns` */
  path: string;
  query?: Query | undefined;
  body?: unknown;
  /** 이 호출에만 다른 광고계정을 쓸 때. 미지정 시 설정값을 쓴다. */
  customerId?: string | undefined;
  signal?: AbortSignal | undefined;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export class NaverAdsClient {
  constructor(private readonly config: NaverAdsConfig) {}

  get defaultCustomerId(): string {
    return this.config.customerId;
  }

  /** 에러 메시지에서 지워야 할 값. 설정을 아는 곳이 여기뿐이라 여기서 넘긴다. */
  private get secrets(): readonly string[] {
    return [this.config.apiKey, this.config.secretKey];
  }

  async get<T = unknown>(
    path: string,
    query?: Query,
    opts?: Pick<RequestOptions, 'customerId' | 'signal'>,
  ): Promise<T> {
    return this.request<T>({ method: 'GET', path, query, ...opts });
  }

  async post<T = unknown>(
    path: string,
    body?: unknown,
    query?: Query,
    opts?: Pick<RequestOptions, 'customerId' | 'signal'>,
  ): Promise<T> {
    return this.request<T>({ method: 'POST', path, body, query, ...opts });
  }

  async put<T = unknown>(
    path: string,
    body?: unknown,
    query?: Query,
    opts?: Pick<RequestOptions, 'customerId' | 'signal'>,
  ): Promise<T> {
    return this.request<T>({ method: 'PUT', path, body, query, ...opts });
  }

  async delete<T = unknown>(
    path: string,
    query?: Query,
    opts?: Pick<RequestOptions, 'customerId' | 'signal'>,
  ): Promise<T> {
    return this.request<T>({ method: 'DELETE', path, query, ...opts });
  }

  async request<T = unknown>(options: RequestOptions): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      if (attempt > 0) await delay(backoffMs(attempt), options.signal);

      try {
        return await this.send<T>(options);
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === this.config.maxRetries) throw error;
      }
    }

    throw lastError;
  }

  private async send<T>(options: RequestOptions): Promise<T> {
    const { method, path, query, body, customerId, signal } = options;
    const url = new URL(path, this.config.baseUrl);
    appendQuery(url, query);

    const headers: Record<string, string> = {
      ...buildAuthHeaders({
        timestamp: Date.now(),
        method,
        path,
        secretKey: this.config.secretKey,
        apiKey: this.config.apiKey,
        customerId: customerId ?? this.config.customerId,
      }),
      Accept: 'application/json',
    };

    const init: RequestInit = {
      method,
      headers,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(this.config.timeoutMs)])
        : AbortSignal.timeout(this.config.timeoutMs),
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json; charset=UTF-8';
      init.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (cause) {
      throw new NaverAdsTransportError(method, path, cause, this.secrets);
    }

    const text = await response.text();
    const parsed = safeJsonParse(text);

    if (!response.ok) {
      const payload = (parsed ?? {}) as Record<string, unknown>;
      throw new NaverAdsApiError({
        method,
        path,
        status: response.status,
        transactionId: response.headers.get('X-Transaction-ID') ?? undefined,
        code: asScalar(payload.code),
        // 네이버가 응답 본문에 되돌려준 키를 그대로 실어 나르지 않는다.
        title: redactSecrets(asString(payload.title), this.secrets),
        detail: redactSecrets(asString(payload.detail) ?? asString(payload.message), this.secrets),
        rawBody:
          parsed === undefined ? redactSecrets(asString(truncate(text)), this.secrets) : undefined,
      });
    }

    return (parsed ?? null) as T;
  }
}

function appendQuery(url: URL, query: Query | undefined): void {
  if (!query) return;

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      url.searchParams.set(key, value.join(','));
    } else if (typeof value === 'object') {
      url.searchParams.set(key, JSON.stringify(value));
    } else {
      url.searchParams.set(key, String(value));
    }
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof NaverAdsTransportError) return true;
  return error instanceof NaverAdsApiError && RETRYABLE_STATUS.has(error.status);
}

/** 1차 400ms, 2차 800ms … 지수 백오프. */
function backoffMs(attempt: number): number {
  return 200 * 2 ** attempt;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal ? abortError(signal) : new Error('요청이 취소되었습니다.'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** `AbortSignal.reason`은 any라 그대로 reject하면 Error가 아닐 수 있다. */
function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new Error('요청이 취소되었습니다.', { cause: signal.reason });
}

function safeJsonParse(text: string): unknown {
  if (text.trim() === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function asScalar(value: unknown): string | number | undefined {
  return typeof value === 'string' || typeof value === 'number' ? value : undefined;
}

function truncate(text: string, max = 500): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
