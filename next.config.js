/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Leaflet and react-leaflet need to be transpiled in Next.js 14
  transpilePackages: ['leaflet', 'react-leaflet'],
}
module.exports = nextConfig
