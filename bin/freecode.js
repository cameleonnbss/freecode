#!/usr/bin/env node
/**
 * FreeCode — CLI entry point.
 * This file just boots the compiled TypeScript from dist/index.js.
 */
import('../dist/index.js').catch((e) => {
  process.stderr.write('Failed to boot FreeCode: ' + (e?.message ?? e) + '\n');
  process.stderr.write('Did you run `npm run build`? Try: cd freecode && npm install && npm run build\n');
  process.exit(1);
});
