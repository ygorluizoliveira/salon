import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

const stubs = {
  shimPath:           'src/stubs/react-native-shim.js',
  rnInternalPath:     'src/stubs/rn-internal.js',
  gestureHandlerPath: 'src/stubs/gesture-handler-stub.js',
  motiPath:           'src/stubs/moti-stub.js',
  safeAreaPath:       'src/stubs/safe-area-stub.js',
  screensPath:        'src/stubs/screens-stub.js',
};

function resolveStub(id: string, base: string): string | null {
  if (id === 'react-native') return path.resolve(base, stubs.shimPath);
  if (id.startsWith('react-native/')) return path.resolve(base, stubs.rnInternalPath);
  if (id === 'react-native-gesture-handler') return path.resolve(base, stubs.gestureHandlerPath);
  if (id === 'react-native-safe-area-context') return path.resolve(base, stubs.safeAreaPath);
  if (id === 'react-native-screens' || id.startsWith('react-native-screens/')) return path.resolve(base, stubs.screensPath);
  if (id === 'moti' || id.startsWith('moti/')) return path.resolve(base, stubs.motiPath);
  if (id === '@motify/core' || id.startsWith('@motify/')) return path.resolve(base, stubs.motiPath);
  if (id === 'react-native-reanimated' || id.startsWith('react-native-reanimated/')) return path.resolve(base, stubs.rnInternalPath);
  if (id === 'lucide-react-native') return path.resolve(base, 'node_modules/lucide-react/dist/esm/lucide-react.js');
  return null;
}

function reactNativeWebPlugin() {
  return {
    name: 'react-native-web-resolver',
    enforce: 'pre' as const,
    resolveId(id: string) {
      return resolveStub(id, __dirname);
    },
  };
}

// esbuild plugin applied during optimizeDeps pre-bundling phase
function makeEsbuildStubPlugin(base: string) {
  return {
    name: 'rn-stubs-esbuild',
    setup(build: any) {
      const patterns: [RegExp, string][] = [
        [/^react-native$/, path.resolve(base, stubs.shimPath)],
        [/^react-native\//, path.resolve(base, stubs.rnInternalPath)],
        [/^react-native-gesture-handler$/, path.resolve(base, stubs.gestureHandlerPath)],
        [/^react-native-safe-area-context$/, path.resolve(base, stubs.safeAreaPath)],
        [/^react-native-screens(\/.*)?$/, path.resolve(base, stubs.screensPath)],
        [/^moti(\/.*)?$/, path.resolve(base, stubs.motiPath)],
        [/^@motify\//, path.resolve(base, stubs.motiPath)],
        [/^react-native-reanimated(\/.*)?$/, path.resolve(base, stubs.rnInternalPath)],
        [/^lucide-react-native$/, path.resolve(base, 'node_modules/lucide-react/dist/esm/lucide-react.js')],
      ];
      for (const [filter, stubPath] of patterns) {
        build.onResolve({ filter }, () => ({ path: stubPath }));
      }
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [reactNativeWebPlugin(), react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      global: 'globalThis',
    },
    resolve: {
      alias: [{ find: '@', replacement: path.resolve(__dirname, '.') }],
    },
    optimizeDeps: {
      include: ['react-native-web', 'warn-once'],
      esbuildOptions: {
        plugins: [makeEsbuildStubPlugin(__dirname)],
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      historyApiFallback: true,
    },
  };
});
