#!/usr/bin/env node
/**
 * Soft gate for `npm start`: warn if runtime missing (main.js will also error).
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dshBin = join(
  root,
  'resources',
  'harness',
  'node_modules',
  '@deepseek-ai',
  'dsh',
  'lib',
  'bin.js',
);

if (!existsSync(dshBin) && !process.env.DSH_BIN) {
  console.warn(
    '[prestart] 未找到 resources/harness 内的 dsh。请先运行: npm run sync:runtime',
  );
  console.warn('[prestart] 或设置 DSH_BIN 指向已安装的 lib/bin.js');
}
