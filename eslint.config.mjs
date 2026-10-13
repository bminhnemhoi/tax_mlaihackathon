import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
const config = [
  { ignores: ['.next*/**', 'node_modules/**', 'data/runtime/**', 'data/uploads/**', 'backups/**', '.codex-finalizer/**', 'docs/evidence/**'] },
  ...compat.extends('next/core-web-vitals'),
];

export default config;
