const fs = require('fs');
const path = require('path');

function scanDir(dir, depth = 0) {
  if (depth > 2) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        console.log(`[DIR]  ${full}`);
        scanDir(full, depth + 1);
      } else {
        const stat = fs.statSync(full);
        console.log(`[FILE] ${full} (${stat.size} bytes, modified: ${stat.mtime.toISOString()})`);
      }
    }
  } catch (e) {
    console.error(`Error scanning ${dir}: ${e.message}`);
  }
}

console.log('--- Scanning C:\\Users\\dell\\Downloads\\STU ---');
scanDir('C:\\Users\\dell\\Downloads\\STU');
