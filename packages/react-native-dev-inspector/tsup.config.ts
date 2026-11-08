import { defineConfig } from 'tsup';

// Bundles the three workspace packages (core, metro-plugin, rn-compat) into a
// single dist so the published package has no internal dependencies.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    metro: 'src/metro.ts',
    'rn-compat': 'src/rn-compat.ts',
  },
  format: ['cjs'],
  dts: true,
  sourcemap: false,
  clean: true,
  splitting: false,
  alias: true,
  external: [
    /^react($|\/)/,
    /^react-native($|\/)/,
    /^@babel\//,
    /^metro($|\/)/,
    /^metro-config($|\/)/,
    /^launch-editor/,
    /^expo($|\/|-)/,
    /^@expo\//,
  ],
});
