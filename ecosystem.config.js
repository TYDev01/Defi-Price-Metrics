module.exports = {
  apps: [
    {
      name: 'defiprice-bot',
      script: './dist/index.js',
      cwd: './bot',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './bot/logs/pm2-error.log',
      out_file: './bot/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000,
    },
  ],
}
