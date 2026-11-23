// Runs the API (port 8787) and the Vite dev server (port 5173) together.
import { spawn } from 'node:child_process';
const run = (args) => spawn('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' });
const procs = [run(['tsx', 'watch', 'server/index.ts']), run(['vite'])];
const stop = () => { for (const p of procs) p.kill('SIGTERM'); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
