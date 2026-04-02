module.exports = {
  apps: [
    {
      name: 'ludo-online',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: 3000,
      },
    },
  ],
};
