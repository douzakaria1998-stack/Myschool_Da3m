const fs = require('fs');
const path = require('path');
const { createClient } = require('c:/Users/dell/Desktop/Da3m/node_modules/@supabase/supabase-js');

const initialDataPath = path.join(__dirname, '..', 'src', 'data', 'initialData.json');
const data = JSON.parse(fs.readFileSync(initialDataPath, 'utf8'));

const g = data.groupData['BACV01'];
if (g && g.students) {
  const countBefore = g.students.length;
  // Keep row 45 (the full paid record), remove row 44 (the duplicate unpaid row)
  g.students = g.students.filter(s => !(s.name.trim() === 'أنفال بن موسى' && s.rowId === 44));
  console.log(`BACV01: students reduced from ${countBefore} to ${g.students.length}`);

  // Re-index rowIds in BACV01
  g.students.forEach((s, idx) => {
    s.rowId = idx + 1;
  });

  fs.writeFileSync(initialDataPath, JSON.stringify(data, null, 2), 'utf8');
  console.log('Saved initialData.json successfully.');

  // Sync to Supabase
  async function syncToSupabase() {
    const supabaseUrl = 'https://pogsnezjtcjiwpgpctqr.supabase.co';
    const supabaseKey = 'sb_publishable_TYebW2XNVoWFX8fIP5xeAQ_DLORtnBq';
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Syncing deduplicated BACV01 to Supabase...');
    const { error } = await supabase
      .from('center_data')
      .upsert({
        id: 'main',
        data: data,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Supabase sync error:', error);
    } else {
      console.log('Successfully synced deduplicated data to Supabase!');
    }
  }

  syncToSupabase();
}
