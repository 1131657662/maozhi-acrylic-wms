export default {
  dev: {
    '/api/': {
      target: 'http://127.0.0.1:4310',
      changeOrigin: true,
    },
  },
  test: {
    '/api/': {
      target: process.env.API_TARGET || 'http://127.0.0.1:4311',
      changeOrigin: true,
    },
  },
};
