// Run serially: real Ollama tests share one local model service.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'evidence');
fs.mkdirSync(output, { recursive: true });
const scripts = ['smoke-test.js', 'highlight-target-regression.js', 'chat-bold.cjs', 'sprint1-browser.cjs', 'sprint1-revalidation.cjs',
  'sprint2-browser.cjs', 'sprint3-browser.cjs', 'sprint3-model.cjs',
  'repeat-same-carousel.cjs', 'manual-return-context.cjs', 'career-navigation-regression.cjs', 'guided-explanation.cjs', 'three-incidents-regression.cjs', 'sprint4-browser.cjs'];
const report = { date: new Date().toISOString(), results: [] };
for (const script of scripts) {
  const start = Date.now();
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    cwd: root, encoding: 'utf8', timeout: 600000, maxBuffer: 8 * 1024 * 1024
  });
  const log = script + '.log';
  fs.writeFileSync(path.join(output, log), (result.stdout || '') + (result.stderr || ''));
  report.results.push({ script, passed: result.status === 0, exitCode: result.status,
    error: result.error?.message, seconds: (Date.now() - start) / 1000, log });
  console.log(JSON.stringify(report.results.at(-1)));
}
report.passed = report.results.every(result => result.passed);
fs.writeFileSync(path.join(output, 'acceptance.json'), JSON.stringify(report, null, 2));
process.exitCode = report.passed ? 0 : 1;
