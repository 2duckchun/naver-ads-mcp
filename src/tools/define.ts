import type { McpServer, StandardSchemaWithJSON } from '@modelcontextprotocol/server';
import type { z } from 'zod';

import { errorResult, jsonResult } from '../utils/result.js';
import { readOnly } from './shared.js';

export interface ReadToolDefinition<S extends z.ZodObject> {
  /** MCP 툴 이름. snake_case. */
  name: string;
  title: string;
  /** 모델이 언제 이 툴을 쓸지 판단하는 유일한 근거. 입력 ID의 출처까지 적는다. */
  description: string;
  inputSchema: S;
  run: (args: z.output<S>) => Promise<unknown>;
}

/**
 * 조회 전용 툴을 등록한다.
 *
 * 읽기 힌트 부착, 결과 JSON 직렬화, 에러를 `isError` 결과로 변환하는 처리를
 * 한곳에 모아 각 툴 파일이 "무엇을 어떤 인자로 부르는가"만 남게 한다.
 */
export function registerReadTool<S extends z.ZodObject>(
  server: McpServer,
  def: ReadToolDefinition<S>,
): void {
  // zod 스키마는 `~standard.jsonSchema`를 실제로 구현하지만, 타입 파라미터 상태의
  // ZodObject는 StandardSchemaWithJSON에 구조적으로 매칭되지 않아 registerTool의
  // Standard Schema 오버로드가 잡히지 않는다. 호출부에서 구체 스키마로 이미
  // 검증되므로 여기서 한 번만 좁혀준다.
  const inputSchema = def.inputSchema as unknown as StandardSchemaWithJSON<unknown, z.output<S>>;

  server.registerTool(
    def.name,
    {
      title: def.title,
      description: def.description,
      inputSchema,
      annotations: readOnly,
    },
    async (args) => {
      try {
        return jsonResult(await def.run(args));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
