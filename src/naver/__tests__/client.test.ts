import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NaverAdsConfig } from '../../config.js';
import { NaverAdsClient } from '../client.js';
import { NaverAdsApiError } from '../errors.js';
import { buildSignature } from '../signature.js';

const config: NaverAdsConfig = {
  apiKey: 'key',
  secretKey: 'secret',
  customerId: '1234567',
  baseUrl: 'https://api.searchad.naver.com',
  timeoutMs: 1_000,
  maxRetries: 0,
};

function mockFetch(response: Response) {
  const spy = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NaverAdsClient', () => {
  it('서명에는 쿼리스트링을 제외한 경로만 쓴다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    const spy = mockFetch(new Response('[]', { status: 200 }));

    await new NaverAdsClient(config).get('/stats', { ids: 'a,b' });

    const [url, init] = spy.mock.calls[0]!;
    const headers = init!.headers as Record<string, string>;
    const expected = buildSignature({
      timestamp: 1_700_000_000_000,
      method: 'GET',
      path: '/stats',
      secretKey: config.secretKey,
    });

    expect((url as URL).search).toBe('?ids=a%2Cb');
    expect(headers['X-Signature']).toBe(expected);
    vi.useRealTimers();
  });

  it('배열은 콤마로, 객체는 JSON으로 직렬화한다', async () => {
    const spy = mockFetch(new Response('{}', { status: 200 }));
    await new NaverAdsClient(config).get('/ncc/campaigns', {
      nccCampaignIdList: ['cmp-1', 'cmp-2'],
      timeRange: { since: '2026-09-01', until: '2026-09-14' },
    });

    const url = spy.mock.calls[0]![0] as URL;
    expect(url.searchParams.get('nccCampaignIdList')).toBe('cmp-1,cmp-2');
    expect(url.searchParams.get('timeRange')).toBe('{"since":"2026-09-01","until":"2026-09-14"}');
  });

  it('빈 값과 빈 배열은 쿼리에서 제외한다', async () => {
    const spy = mockFetch(new Response('{}', { status: 200 }));
    await new NaverAdsClient(config).get('/ncc/adgroups', {
      nccCampaignId: undefined,
      nccAdgroupIdList: [],
      type: '',
    });

    expect((spy.mock.calls[0]![0] as URL).search).toBe('');
  });

  it('customerId를 호출 단위로 덮어쓸 수 있다', async () => {
    const spy = mockFetch(new Response('{}', { status: 200 }));
    await new NaverAdsClient(config).get('/ncc/campaigns', undefined, { customerId: '7654321' });

    const headers = spy.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers['X-Customer']).toBe('7654321');
  });

  it('에러 응답을 NaverAdsApiError로 변환한다', async () => {
    mockFetch(
      new Response(JSON.stringify({ code: 1001, title: 'Invalid ID', detail: 'not found' }), {
        status: 404,
        headers: { 'X-Transaction-ID': 'tx-1' },
      }),
    );

    await expect(new NaverAdsClient(config).get('/ncc/campaigns/none')).rejects.toMatchObject({
      name: 'NaverAdsApiError',
      status: 404,
      code: 1001,
      transactionId: 'tx-1',
    });
  });

  it('429는 maxRetries만큼 재시도한다', async () => {
    const spy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', spy);

    const result = await new NaverAdsClient({ ...config, maxRetries: 1 }).get('/stats');

    expect(spy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true });
  });

  it('400은 재시도하지 않는다', async () => {
    const spy = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 400 }));
    vi.stubGlobal('fetch', spy);

    await expect(
      new NaverAdsClient({ ...config, maxRetries: 2 }).get('/stats'),
    ).rejects.toBeInstanceOf(NaverAdsApiError);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
