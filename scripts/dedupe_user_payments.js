const raw = [
  { id: 1, time: '09:28:26', name: 'حنين دريدي', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 1250 },
  { id: 2, time: '09:28:26', name: 'باللموشي رحمة', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 1250 },
  { id: 3, time: '09:28:26', name: 'زبيدي اسراء', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 1250 },
  { id: 4, time: '09:28:26', name: 'بكوش عبد الرحمان', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 1250 },
  { id: 5, time: '09:28:26', name: 'ابراهيم زقب', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { id: 6, time: '09:28:26', name: 'فرج مريم البتول', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { id: 7, time: '09:28:26', name: 'قابوسة ايمان', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { id: 8, time: '09:28:26', name: 'نصير مريم', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { id: 9, time: '09:25:49', name: 'ابراهيم زقب', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { id: 10, time: '09:25:35', name: 'زبيدي اسراء', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 1250 },
  { id: 11, time: '09:25:17', name: 'بكوش عبد الرحمان', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 1250 },
  { id: 12, time: '09:25:05', name: 'حنين دريدي', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 1250 },
  { id: 13, time: '09:24:01', name: 'باللموشي رحمة', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 1250 },
  { id: 14, time: '09:23:04', name: 'عدوكة اكرام', groupId: 'BAC08', subject: 'علوم', sessionIdx: 0, amount: 2500 },
  { id: 15, time: '09:22:47', name: 'فرج مريم البتول', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { id: 16, time: '09:21:09', name: 'نصير مريم', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { id: 17, time: '08:55:38', name: 'عدوكة اكرام', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { id: 18, time: '08:55:08', name: 'فرج مريم البتول', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { id: 19, time: '08:54:06', name: 'نصير مريم', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { id: 20, time: '08:53:41', name: 'يوسف قوري', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { id: 21, time: '08:53:06', name: 'تركي احمد', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { id: 22, time: '08:40:18', name: 'علالي طه', groupId: 'BACV06', subject: 'فيزياء', sessionIdx: 0, amount: 10000 },
  { id: 23, time: '08:35:56', name: 'فروي روفيدة', groupId: 'BACV11', subject: 'علوم', sessionIdx: 0, amount: 10000 },
  { id: 24, time: '08:35:10', name: 'فروي روفيدة', groupId: 'BACV02', subject: 'علوم', sessionIdx: 0, amount: 10000 },
  { id: 25, time: '08:32:25', name: 'فروي روفيدة', groupId: 'BACV06', subject: 'فيزياء', sessionIdx: 1, amount: 10000 },
  { id: 26, time: '08:21:34', name: 'هميسي نور اليقين', groupId: 'BACV07', subject: 'رياضيات', sessionIdx: 1, amount: 10000 },
  { id: 27, time: '08:20:18', name: 'ولاء بقاص', groupId: 'BACV12', subject: 'فيزياء', sessionIdx: 0, amount: 10000 }
];

console.log('Total raw transactions:', raw.length);
console.log('Total raw sum:', raw.reduce((s, r) => s + r.amount, 0), 'DZD');

// Deduplicate: A student in the same group paying for the same session index is ONE transaction.
// When duplicates occurred due to multiple clicks/scans within minutes, take the earliest or unique one.
const dedupedMap = new Map();
for (const r of raw) {
  const key = `${r.groupId}_${r.name}_${r.sessionIdx}`;
  if (!dedupedMap.has(key)) {
    dedupedMap.set(key, r);
  }
}

const uniqueList = Array.from(dedupedMap.values());
console.log('Unique deduplicated count:', uniqueList.length);
console.log('Unique total sum:', uniqueList.reduce((s, r) => s + r.amount, 0), 'DZD');
console.log('\n--- DEDUPLICATED TRANSACTIONS ---');
uniqueList.forEach((u, i) => {
  console.log(`${i + 1}. [${u.time}] ${u.name} - ${u.groupId} (${u.subject}) - الحصة ${u.sessionIdx + 1} - ${u.amount.toLocaleString()} DZD`);
});
