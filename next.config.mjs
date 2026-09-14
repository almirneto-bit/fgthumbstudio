const basePath = process.env.PAGES_BASE_PATH || '';

export default {
  reactStrictMode: true,
  ...(process.env.STATIC_EXPORT === '1' ? { output: 'export' } : {}),
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};
