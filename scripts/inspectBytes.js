const fs = require('fs');
const path = 'src/App.tsx';
const data = fs.readFileSync(path);
const text = data.toString('utf8');
const lines = text.split(/\r?\n/);
const start = Math.max(0, 420 - 1);
const end = Math.min(lines.length, 430);
for (let i = start; i < end; i++) {
  const line = lines[i] || '';
  const bytes = Buffer.from(line, 'utf8');
  console.log(`${i+1}: ${line}`);
  console.log('bytes:', bytes.toString('hex').match(/.{1,2}/g).join(' '));
}