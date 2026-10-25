import { readFileSync } from 'node:fs';
const engine = readFileSync(new URL('../engine.js', import.meta.url), 'utf8').replaceAll('export ', '');
const cases = readFileSync(new URL('./engine-tests.js', import.meta.url), 'utf8');
const results = new Function(engine + '\n' + cases)();
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.error ? ': ' + r.error : ''}`);
if (results.some(r => !r.ok)) process.exitCode = 1;
