const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://pogsnezjtcjiwpgpctqr.supabase.co', 'sb_publishable_TYebW2XNVoWFX8fIP5xeAQ_DLORtnBq');

async function run() {
  const init = JSON.parse(fs.readFileSync('./src/data/initialData.json', 'utf8'));
  const { data, error } = await sb.from('center_data').select('data').eq('id', 'main').single();
  if (error) { console.error(error); return; }
  
  const remoteGroups = data.data.groupData || {};
  const initGroups = init.groupData || {};

  console.log('--- COMPARING INITIAL DATA VS SUPABASE ---');
  let missingCount = 0;
  for (const [gid, igroup] of Object.entries(initGroups)) {
    const rgroup = remoteGroups[gid];
    if (!rgroup) {
      console.log('Group missing entirely in Supabase:', gid);
      continue;
    }
    const rStudentMap = new Map((rgroup.students || []).map(s => [s.name.trim(), s]));
    for (const istu of (igroup.students || [])) {
      const name = istu.name.trim();
      if (!rStudentMap.has(name)) {
        const byBarcode = istu.barcode ? (rgroup.students || []).find(s => s.barcode === istu.barcode) : null;
        const byRowId = (rgroup.students || []).find(s => s.rowId === istu.rowId);
        console.log(`Missing in ${gid}: rowId ${istu.rowId}, name: "${name}", barcode: ${istu.barcode} (found by barcode: ${byBarcode?.name}, by rowId: ${byRowId?.name})`);
        missingCount++;
      }
    }
  }
  console.log('Total initial students missing in Supabase:', missingCount);
}
run();
