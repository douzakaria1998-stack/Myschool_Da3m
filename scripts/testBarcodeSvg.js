const { CODE128 } = require('jsbarcode/bin/barcodes/CODE128');

function renderBarcodeSvg(code, width = 1.45, height = 36) {
  const b = new CODE128(code, { text: code });
  const encoded = b.encode();
  const binary = encoded.data;
  let rects = '';
  const barWidth = width;
  const totalWidth = binary.length * barWidth;
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === '1') {
      rects += `<rect x="${(i * barWidth).toFixed(2)}" y="0" width="${barWidth.toFixed(2)}" height="${height}" fill="#000000"/>`;
    }
  }
  return `<svg viewBox="0 0 ${totalWidth.toFixed(2)} ${height + 14}" style="width: 100%; max-height: 14mm; display: block;" xmlns="http://www.w3.org/2000/svg">
    ${rects}
    <text x="${(totalWidth / 2).toFixed(2)}" y="${height + 11}" text-anchor="middle" font-family="monospace" font-size="9.5" font-weight="bold" fill="#000000">${code}</text>
  </svg>`;
}

const svg = renderBarcodeSvg('STU-27000101');
console.log('SVG generated successfully! Length:', svg.length);
console.log('Sample snippet:', svg.slice(0, 150));
