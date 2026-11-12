import { fileURLToPath } from 'node:url';
import { runCheck } from './design-tokens/run.ts';

process.exitCode = await runCheck(fileURLToPath(new URL('../', import.meta.url)));
