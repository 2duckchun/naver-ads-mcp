import { describe, expect, it } from 'vitest';

import { loadConfig } from '../config.js';

const valid = {
  NAVER_ADS_API_KEY: 'key',
  NAVER_ADS_SECRET_KEY: 'secret',
  NAVER_ADS_CUSTOMER_ID: '1234567',
} satisfies NodeJS.ProcessEnv;

describe('loadConfig', () => {
  it('선택 변수는 기본값으로 채운다', () => {
    expect(loadConfig(valid)).toEqual({
      apiKey: 'key',
      secretKey: 'secret',
      customerId: '1234567',
      baseUrl: 'https://api.searchad.naver.com',
      timeoutMs: 15_000,
      maxRetries: 2,
    });
  });

  it('빠진 변수를 한 번에 모아 알려준다', () => {
    expect(() => loadConfig({})).toThrow(/NAVER_ADS_API_KEY[\s\S]*NAVER_ADS_CUSTOMER_ID/);
  });

  it('customerId가 숫자가 아니면 거부한다', () => {
    expect(() => loadConfig({ ...valid, NAVER_ADS_CUSTOMER_ID: 'abc' })).toThrow(/숫자/);
  });
});
