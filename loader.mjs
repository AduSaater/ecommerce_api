import { isBuiltin } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

export async function resolve(specifier, context, nextResolve) {
  if (isBuiltin(specifier)) {
    return nextResolve(specifier, context);
  }

  const { parentURL } = context;
  // ONLY intercept relative imports originating from our compiled dist/ files
  if (parentURL && parentURL.includes('/dist/') && (specifier.startsWith('./') || specifier.startsWith('../'))) {
    const parentDir = dirname(fileURLToPath(parentURL));
    const targetPath = join(parentDir, specifier);

    if (existsSync(targetPath + '.js')) {
      return nextResolve(specifier + '.js', context);
    }
    if (existsSync(join(targetPath, 'index.js'))) {
      return nextResolve(specifier + '/index.js', context);
    }
  }

  return nextResolve(specifier, context);
}
