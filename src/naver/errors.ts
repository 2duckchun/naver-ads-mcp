import type { HttpMethod } from './signature.js';

export interface NaverAdsErrorContext {
  method: HttpMethod;
  path: string;
  status: number;
  /** 응답 헤더의 X-Transaction-ID — 네이버에 문의할 때 필요한 값. */
  transactionId?: string | undefined;
  /** 네이버가 내려주는 에러 코드 (예: 1001). */
  code?: string | number | undefined;
  title?: string | undefined;
  detail?: string | undefined;
  /** 파싱 실패 시를 대비한 원문 일부. */
  rawBody?: string | undefined;
}

export const REDACTED = '***';

/**
 * 자격증명이 너무 짧으면 응답 본문의 평범한 단어와 겹쳐 멀쩡한 메시지를
 * 훼손한다. 실제 발급값은 수십 자라 이 경계에 걸리지 않는다.
 */
const MIN_REDACTABLE_LENGTH = 8;

export function redactSecrets(text: string, secrets: readonly string[]): string;
export function redactSecrets(
  text: string | undefined,
  secrets: readonly string[],
): string | undefined;
/**
 * 에러 메시지에서 자격증명을 지운다.
 *
 * 네이버는 인증 실패 시 `API-KEY 'xxx' is invalid.`처럼 **보낸 키를 응답 본문에
 * 그대로 되돌려준다.** 이 문자열은 툴 결과로 모델 컨텍스트에 들어가고 로그에도
 * 남으므로, 에러로 감싸기 전에 가린다.
 */
export function redactSecrets(
  text: string | undefined,
  secrets: readonly string[],
): string | undefined {
  if (text === undefined) return undefined;

  let out = text;
  for (const secret of secrets) {
    if (secret.length < MIN_REDACTABLE_LENGTH) continue;
    out = out.split(secret).join(REDACTED);
  }
  return out;
}

/** 네이버 검색광고 API가 2xx 이외를 반환했을 때 던진다. */
export class NaverAdsApiError extends Error {
  readonly method: HttpMethod;
  readonly path: string;
  readonly status: number;
  readonly transactionId: string | undefined;
  readonly code: string | number | undefined;
  readonly title: string | undefined;
  readonly detail: string | undefined;
  readonly rawBody: string | undefined;

  constructor(ctx: NaverAdsErrorContext) {
    const summary = ctx.title ?? ctx.detail ?? ctx.rawBody ?? '(응답 본문 없음)';
    super(`네이버 검색광고 API ${ctx.status} — ${ctx.method} ${ctx.path}: ${summary}`);
    this.name = 'NaverAdsApiError';
    this.method = ctx.method;
    this.path = ctx.path;
    this.status = ctx.status;
    this.transactionId = ctx.transactionId;
    this.code = ctx.code;
    this.title = ctx.title;
    this.detail = ctx.detail;
    this.rawBody = ctx.rawBody;
  }

  /** 모델이 그대로 읽을 수 있도록 구조화한다. */
  toJSON(): Record<string, unknown> {
    return {
      error: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      title: this.title,
      detail: this.detail,
      request: { method: this.method, path: this.path },
      transactionId: this.transactionId,
      hint: hintFor(this.status),
    };
  }
}

function hintFor(status: number): string | undefined {
  switch (status) {
    case 401:
    case 403:
      return 'API_KEY / SECRET_KEY / CUSTOMER_ID 조합과 서버 시각(X-Timestamp)을 확인하세요. 시각이 수 분 이상 어긋나면 서명이 거부됩니다.';
    case 404:
      return '경로 또는 리소스 ID가 존재하지 않습니다. nccCampaignId·nccAdgroupId 같은 ID 형식을 확인하세요.';
    case 429:
      return '호출 한도를 초과했습니다. 잠시 후 재시도하거나 조회 범위를 좁히세요.';
    default:
      return undefined;
  }
}

/** 타임아웃·네트워크 단절 등 응답을 받기 전에 실패한 경우. */
export class NaverAdsTransportError extends Error {
  readonly method: HttpMethod;
  readonly path: string;

  constructor(method: HttpMethod, path: string, cause: unknown, secrets: readonly string[] = []) {
    super(
      `네이버 검색광고 API 요청 실패 — ${method} ${path}: ${redactSecrets(describe(cause), secrets)}`,
    );
    this.name = 'NaverAdsTransportError';
    this.method = method;
    this.path = path;
    this.cause = cause;
  }
}

function describe(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.name === 'TimeoutError' || cause.name === 'AbortError'
      ? '타임아웃'
      : cause.message;
  }
  return String(cause);
}
