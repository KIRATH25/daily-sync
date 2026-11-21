/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Pure logic and repository tests run in plain Node so they can use the
  // built-in `node:sqlite` engine as a stand-in for expo-sqlite.
  testEnvironment: 'node',
};
