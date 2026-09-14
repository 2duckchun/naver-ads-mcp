import { createHmac } from 'node:crypto';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface SignatureInput {
  /** epoch milliseconds */
  timestamp: number;
  method: HttpMethod;
  /** 쿼리스트링을 제외한 경로. 예: `/ncc/campaigns` */
  path: string;
  secretKey: string;
}

/**
 * `{timestamp}.{METHOD}.{path}` 를 비밀키로 HMAC-SHA256 서명한 뒤 base64로 인코딩한다.
 *
 * 주의: 서명 대상 경로에는 쿼리스트링이 들어가지 않는다. `/stats?ids=...`를
 * 호출하더라도 서명에는 `/stats`만 사용한다.
 */
export function buildSignature({ timestamp, method, path, secretKey }: SignatureInput): string {
  const message = `${timestamp}.${method}.${path}`;
  return createHmac('sha256', secretKey).update(message, 'utf8').digest('base64');
}

export interface AuthHeaderInput extends SignatureInput {
  apiKey: string;
  customerId: string;
}

/** 네이버 검색광고 API가 요구하는 인증 헤더 4종을 만든다. */
export function buildAuthHeaders(input: AuthHeaderInput): Record<string, string> {
  return {
    'X-Timestamp': String(input.timestamp),
    'X-API-KEY': input.apiKey,
    'X-Customer': input.customerId,
    'X-Signature': buildSignature(input),
  };
}
