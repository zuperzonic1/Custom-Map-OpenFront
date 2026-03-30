const fs = require('fs');
const p = 'src/App.tsx';
let s = fs.readFileSync(p, 'utf8');
// remove C0 control characters except allowed: TAB(0x09), LF(0x0A), CR(0x0D)
s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
// normalize line endings
s = s.replace(/\r\n/g, '\n');
fs.writeFileSync(p, s, 'utf8');
console.log('Stripped control chars from', p);