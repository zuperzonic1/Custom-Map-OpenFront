const fs = require('fs');
const path = 'src/App.tsx';
let src = fs.readFileSync(path, 'utf8');
// remove control characters except TAB(0x09), LF(0x0A), CR(0x0D)
src = src.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
// normalize CRLF -> LF
src = src.replace(/\r\n/g, '\n');
fs.writeFileSync(path, src, 'utf8');
console.log('Cleaned', path);