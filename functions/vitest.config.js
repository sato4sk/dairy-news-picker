const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    globals: true,
    restoreMocks: true,
    exclude: ['node_modules/**'],
  },
});
