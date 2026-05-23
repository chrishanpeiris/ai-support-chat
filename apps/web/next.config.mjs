import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  output: 'standalone',
  // Trace file dependencies from the monorepo root so standalone output
  // includes the correct relative paths when built inside Docker.
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default config;
