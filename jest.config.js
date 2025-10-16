/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.[tj]s?(x)', '**/__jest__/**/*.test.[tj]s?(x)'],
  moduleNameMapper: {
    '^@/lib/vectorStore$': '<rootDir>/tests/mocks/vectorStore.ts',
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
};
