import type { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { NaverAdsClient } from '../../naver/client.js';
import { registerRawTools } from '../raw.js';

/** registerTool에 넘어간 inputSchema를 그대로 꺼낸다. */
function capturedSchema(): z.ZodObject {
  const client = { get: vi.fn().mockResolvedValue({}) } as unknown as NaverAdsClient;

  let schema: z.ZodObject | undefined;
  const server = {
    registerTool: (_name: string, config: { inputSchema: z.ZodObject }) => {
      schema = config.inputSchema;
    },
  } as unknown as McpServer;

  registerRawTools(server, client);
  if (!schema) throw new Error('naver_ads_get이 등록되지 않았습니다.');
  return schema;
}

describe('naver_ads_get 스키마 이식성', () => {
  it('query 값은 type 배열이 아니라 anyOf로 방출한다', () => {
    const json = z.toJSONSchema(capturedSchema(), { io: 'input' });
    const query = json.properties?.query as { additionalProperties: Record<string, unknown> };
    const valueSchema = query.additionalProperties;

    // `type: ["string","number","boolean"]`은 합법이지만, 여러 MCP 클라이언트가
    // type을 단일 문자열로만 읽어 툴을 거부하거나 제약을 버린다.
    expect(Array.isArray(valueSchema.type)).toBe(false);
    expect(valueSchema.anyOf).toBeDefined();

    const branches = valueSchema.anyOf as { type: string }[];
    expect(branches.map((b) => b.type)).toEqual(['string', 'number', 'boolean']);
  });
});
