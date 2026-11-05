/* ESLint resolver using the same TypeScript aliases as the application. */
const ts = require('typescript');
const path = require('node:path');
const { builtinModules } = require('node:module');
const configPath = path.resolve(__dirname, '../tsconfig.json');
const raw = ts.readConfigFile(configPath, ts.sys.readFile);
const config = ts.parseJsonConfigFileContent(raw.config, ts.sys, path.dirname(configPath));
exports.interfaceVersion = 2;
exports.resolve = (source, file) => {
  if (source.startsWith('node:') || builtinModules.includes(source))
    return { found: true, path: null };
  const result = ts.resolveModuleName(source, file, config.options, ts.sys).resolvedModule;
  return result ? { found: true, path: result.resolvedFileName } : { found: false };
};
