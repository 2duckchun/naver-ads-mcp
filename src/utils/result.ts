import type { CallToolResult } from '@modelcontextprotocol/server';

import { NaverAdsApiError } from '../naver/errors.js';

export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

/**
 * 예외를 툴 결과로 바꾼다.
 *
 * 그대로 던지면 클라이언트가 프로토콜 오류로 받아 모델이 원인을 보지 못한다.
 * `isError` 결과로 내려야 모델이 읽고 스스로 교정할 수 있다.
 */
export function errorResult(error: unknown): CallToolResult {
  const payload =
    error instanceof NaverAdsApiError
      ? error.toJSON()
      : {
          error: error instanceof Error ? error.name : 'UnknownError',
          message: error instanceof Error ? error.message : String(error),
        };

  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], isError: true };
}
