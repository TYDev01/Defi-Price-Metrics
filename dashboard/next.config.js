const path = require('path')
const { loadEnvConfig } = require('@next/env')

// Pull shared secrets (Firebase, Telegram, etc.) from the repo root .env as well
loadEnvConfig(path.resolve(__dirname, '..'), process.env.NODE_ENV !== 'production')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

module.exports = nextConfig
