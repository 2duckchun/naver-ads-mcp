import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { buildAuthHeaders, buildSignature } from '../signature.js';

const SECRET = 'test-secret';

describe('buildSignature', () => {
  it('{timestamp}.{METHOD}.{path}를 HMAC-SHA256 base64로 서명한다', () => {
    const expected = createHmac('sha256', SECRET)
      .update('1700000000000.GET./ncc/campaigns')
      .digest('base64');

    expect(
      buildSignature({
        timestamp: 1_700_000_000_000,
        method: 'GET',
        path: '/ncc/campaigns',
        secretKey: SECRET,
      }),
    ).toBe(expected);
  });

  it('메서드가 다르면 서명도 달라진다', () => {
    const base = { timestamp: 1, path: '/stats', secretKey: SECRET } as const;
    expect(buildSignature({ ...base, method: 'GET' })).not.toBe(
      buildSignature({ ...base, method: 'POST' }),
    );
  });
});

describe('buildAuthHeaders', () => {
  it('인증 헤더 4종을 만든다', () => {
    const headers = buildAuthHeaders({
      timestamp: 1_700_000_000_000,
      method: 'GET',
      path: '/stats',
      secretKey: SECRET,
      apiKey: 'test-api-key',
      customerId: '1234567',
    });

    expect(headers).toMatchObject({
      'X-Timestamp': '1700000000000',
      'X-API-KEY': 'test-api-key',
      'X-Customer': '1234567',
    });
    expect(headers['X-Signature']).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
