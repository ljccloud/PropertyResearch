/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Leaflet ships its own CSS — tell Next.js to allow it
  transpilePackages: ['leaflet', 'react-leaflet'],
  webpack: (config) => {
    // Leaflet uses window references at module level in some builds
    // This alias prevents SSR issues
    config.resolve.alias = {
      ...config.resolve.alias,
      'leaflet$': 'leaflet/dist/leaflet-src.esm.js',
    }
    return config
  },
}
module.exports = nextConfig
