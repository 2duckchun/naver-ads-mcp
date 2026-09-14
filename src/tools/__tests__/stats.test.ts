import type { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';
import type { NaverAdsClient, Query } from '../../naver/client.js';
import { registerStatTools } from '../stats.js';

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

/**
 * get_stats 하나만 떼어내 호출부를 들여다본다.
 *
 * /stats가 ids와 fields를 서로 다른 형식으로 받는 탓에 한쪽만 맞춰도
 * 전체가 400으로 죽는다. 실호출 없이 이 직렬화를 고정한다.
 */
function setup() {
  const get = vi.fn<NaverAdsClient['get']>().mockResolvedValue({ data: [] });
  const client = { get } as unknown as NaverAdsClient;

  let handler: Handler | undefined;
  const server = {
    registerTool: (_name: string, _config: unknown, fn: Handler) => {
      handler = fn;
    },
  } as unknown as McpServer;

  registerStatTools(server, client);
  if (!handler) throw new Error('get_stats가 등록되지 않았습니다.');

  return { get, call: handler };
}

/** run()이 client.get에 넘긴 쿼리. */
function queryOf(get: ReturnType<typeof setup>['get']): Query {
  return get.mock.calls[0]![1] as Query;
}

describe('get_stats', () => {
  it('ids는 배열 그대로 넘겨 콤마로 직렬화되게 한다', async () => {
    const { get, call } = setup();
    await call({
      ids: ['cmp-1', 'cmp-2'],
      fields: ['impCnt'],
      timeIncrement: 'allDays',
      datePreset: 'last7days',
    });

    // JSON.stringify하면 네이버가 400 code 11001로 거부한다.
    expect(queryOf(get).ids).toEqual(['cmp-1', 'cmp-2']);
    expect(queryOf(get).ids).not.toBe('["cmp-1","cmp-2"]');
  });

  it('fields는 JSON 배열 문자열로 넘긴다', async () => {
    const { get, call } = setup();
    await call({
      ids: ['cmp-1'],
      fields: ['impCnt', 'clkCnt'],
      timeIncrement: 'allDays',
      datePreset: 'last7days',
    });

    expect(queryOf(get).fields).toBe('["impCnt","clkCnt"]');
  });

  it('since+until은 timeRange JSON으로 접는다', async () => {
    const { get, call } = setup();
    await call({
      ids: ['cmp-1'],
      fields: ['impCnt'],
      timeIncrement: 'allDays',
      since: '2026-09-01',
      until: '2026-09-07',
    });

    const query = queryOf(get);
    expect(query.timeRange).toBe('{"since":"2026-09-01","until":"2026-09-07"}');
    expect(query.datePreset).toBeUndefined();
  });

  it('기간을 반만 지정하면 API를 부르지 않고 isError로 돌려준다', async () => {
    const { get, call } = setup();

    // registerReadTool이 예외를 잡아 isError 결과로 바꾸므로 reject가 아니다.
    const result = (await call({
      ids: ['cmp-1'],
      fields: ['impCnt'],
      timeIncrement: 'allDays',
      since: '2026-09-01',
    })) as { isError?: boolean; content: { text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/함께 지정/);
    expect(get).not.toHaveBeenCalled();
  });
});
