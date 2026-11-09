// npm run content: validate content/ and write public/data/.
// Exits with an error code when the content has errors, so it can gate CI.

import path from 'node:path';
import { buildContent, describe, writeContent } from './build.ts';

const root = path.resolve(import.meta.dirname, '../..');
const result = buildContent(path.join(root, 'content'));
console.log(describe(result));
if (result.errors.length) process.exit(1);
writeContent(result, path.join(root, 'public'));
