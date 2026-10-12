// 孢子森林整批閘門：沿用既有瀏覽器測試，不增加執行期依賴。
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const checks = [
  ['圖鑑與存檔', process.execPath, ['tests/album.cjs']],
  ['成就與貼紙', process.execPath, ['tests/wishes.cjs']],
  ['森林分工與收藏', process.execPath, ['tests/forest.cjs']],
  ['大量購買與長按', process.execPath, ['tests/purchase.cjs']],
  ['菌群突破成長', process.execPath, ['tests/breakthrough.cjs']],
  ['後期聚落與新菌群', process.execPath, ['tests/expansion.cjs']],
  ['差異空白檢查', 'git', ['diff', '--check']]
];
let passed = 0, assertions = 0;
for (const [name, command, args] of checks) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 120000, windowsHide: true });
  const summary = (result.stdout || '').match(/PASS (\d+); FAIL 0[^\r\n]*/);
  const ok = !result.error && result.status === 0 && (command !== process.execPath || summary);
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${summary ? '：' + summary[0] : ''}`);
  if (ok) { passed++; assertions += summary ? Number(summary[1]) : 0; }
  else { console.error((result.error?.message || result.stderr || result.stdout || '沒有檢查摘要').slice(0, 4000)); }
}
console.log(`閘門 ${passed}/${checks.length} 通過；測試斷言 ${assertions} 項`);
if (passed !== checks.length) process.exitCode = 1;
