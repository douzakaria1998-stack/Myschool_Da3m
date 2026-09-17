const fs = require('fs');
const zlib = require('zlib');

const pdfPath = 'C:\\Users\\dell\\Downloads\\STU\\مؤسسة دعم للدروس الخصوصية والتعليمية _ Da3m Education.pdf';
const buf = fs.readFileSync(pdfPath);

let idx = 0;
while ((idx = buf.indexOf('stream', idx)) !== -1) {
  const start = idx + 6;
  const end = buf.indexOf('endstream', start);
  if (end !== -1) {
    let slice = buf.slice(start, end);
    if (slice[0] === 13 && slice[1] === 10) slice = slice.slice(2);
    else if (slice[0] === 10) slice = slice.slice(1);
    try {
      const decomp = zlib.inflateSync(slice).toString();
      if (decomp.includes('TJ') || decomp.includes('Tj')) {
        console.log('--- Stream text ---');
        console.log(decomp.slice(0, 300));
      }
    } catch(e) {}
  }
  idx = end + 9;
}
