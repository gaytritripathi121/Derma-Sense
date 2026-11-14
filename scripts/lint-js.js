import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import esbuild from 'esbuild';

const ROOT = process.cwd();
const TARGET_DIRS = ['src', 'server', 'tests', 'scripts'];
const FORBIDDEN_EXTS = ['.ts', '.tsx'];

function walk(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, results);
    } else {
      results.push(full);
    }
  }
  return results;
}

let errors = 0;
let checked = 0;

for (const dir of TARGET_DIRS) {
  const files = walk(path.join(ROOT, dir));
  for (const file of files) {
    const ext = path.extname(file);
    if (FORBIDDEN_EXTS.includes(ext)) {
      console.error(`Forbidden TypeScript file found: ${path.relative(ROOT, file)}`);
      errors++;
      continue;
    }
    if (ext === '.js') {
      try {
        execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
        checked++;
      } catch (err) {
        console.error(`Syntax error in ${path.relative(ROOT, file)}:\n${err.stderr?.toString() || err.message}`);
        errors++;
      }
    } else if (ext === '.jsx') {
      try {
        const code = fs.readFileSync(file, 'utf8');
        esbuild.transformSync(code, { loader: 'jsx', format: 'esm' });
        checked++;
      } catch (err) {
        console.error(`JSX error in ${path.relative(ROOT, file)}:\n${err.message}`);
        errors++;
      }
    }
  }
}

if (fs.existsSync(path.join(ROOT, 'vite.config.ts')) || fs.existsSync(path.join(ROOT, 'tsconfig.json'))) {
  console.error('Forbidden TypeScript config files still exist at root.');
  errors++;
}

if (errors > 0) {
  console.error(`JS/JSX validation failed with ${errors} error(s).`);
  process.exit(1);
}

console.log(`JS/JSX validation passed (${checked} files checked, 0 TypeScript files).`);
