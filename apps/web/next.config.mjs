import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@blender-elt/animation',
    '@blender-elt/commands',
    '@blender-elt/contracts',
    '@blender-elt/file-formats',
    '@blender-elt/materials',
    '@blender-elt/modeling',
    '@blender-elt/persistence',
    '@blender-elt/scene-core',
    '@blender-elt/ui',
    '@blender-elt/viewport',
    'three',
    '@react-three/fiber',
    '@react-three/drei',
  ],
  webpack: (config, { isServer }) => {
    // Add shims for fs and path when bundling for browser or persistence
    config.resolve.alias = {
      ...config.resolve.alias,
      fs: path.resolve(__dirname, 'src/shims/node-shims.ts'),
      path: path.resolve(__dirname, 'src/shims/node-shims.ts'),
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },
};

export default nextConfig;
