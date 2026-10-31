import { defineConfig } from 'vitest/config';

// Unit tests only. The browser flows live in e2e/ and run under Playwright,
// which needs a live frontend and API; these run anywhere with node.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
