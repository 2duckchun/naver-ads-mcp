import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * package.json의 version을 읽는다.
 *
 * 소스를 직접 실행하든(`src/index.ts`) 번들을 실행하든(`dist/index.js`)
 * 한 단계 위가 패키지 루트라 같은 경로로 해결된다. 버전 표기 하나 때문에
 * 서버가 죽을 이유는 없으므로 실패 시 조용히 물러선다.
 */
function readVersion(): string {
  try {
    const path = fileURLToPath(new URL('../package.json', import.meta.url));
    const pkg: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof pkg === 'object' && pkg !== null && 'version' in pkg) {
      const { version } = pkg as { version: unknown };
      if (typeof version === 'string') return version;
    }
  } catch {
    // 무시 — 아래 기본값으로 간다.
  }
  return '0.0.0';
}

export const SERVER_VERSION = readVersion();
