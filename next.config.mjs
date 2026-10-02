import withPWA from 'next-pwa';

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Load firebase-admin from node_modules instead of bundling it (fixes the 500 crash)
  serverExternalPackages: ["firebase-admin"],
};

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Disable PWA in dev mode
  runtimeCaching: [
    // Never cache or intercept admin API calls
    {
      urlPattern: /\/api\/.*/i,
      handler: 'NetworkOnly',
    },
    // Cache Firestore data
    {
      urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'firestore-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
        },
      },
    },
    // Cache Firebase Storage images
    {
      urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'storage-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
  ],
})(nextConfig);