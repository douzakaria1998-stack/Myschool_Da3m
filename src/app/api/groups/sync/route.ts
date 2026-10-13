import { NextRequest, NextResponse } from 'next/server';
import { broadcastGroupEvent } from '@/lib/realtimeBroadcaster';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventType, group, groupSheet, groupId, originClientId } = body;

    const targetId = (groupId || group?.id || '').trim().toUpperCase();
    if (!targetId || !['INSERT', 'UPDATE', 'DELETE'].includes(eventType)) {
      return NextResponse.json({ error: 'Invalid event payload' }, { status: 400 });
    }

    const timestamp = Date.now();

    // 1. Instantly broadcast to all connected devices via SSE
    broadcastGroupEvent({
      eventType,
      groupId: targetId,
      groupMeta: group,
      groupSheet,
      timestamp,
      originClientId
    });

    // 2. Persist to database (Supabase groups table) non-blockingly
    (async () => {
      try {
        if (eventType === 'DELETE') {
          await supabase.from('groups').delete().eq('id', targetId);
          await supabase.from('students').delete().eq('group_id', targetId);
        } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const sheet = groupSheet || {};
          const rowToUpsert = {
            id: targetId,
            teacher_id: group?.teacherId || null,
            subject: group?.subject || sheet.subject || '',
            day1: group?.day1 || sheet.day1 || '',
            time1: group?.time1 || sheet.time1 || '',
            day2: group?.day2 || sheet.day2 || null,
            time2: group?.time2 || sheet.time2 || null,
            type: group?.type || sheet.type || '4-2500',
            is_vip: Boolean(group?.isVip || sheet.isVip),
            session_count: group?.sessionCount || sheet.sessionCount || 4,
            student_fee: group?.studentFee || sheet.studentFee || null,
            teacher_rate: group?.teacherPayPerStudent || sheet.teacherPayPerStudent || null,
            status: group?.status || null,
            session_dates: group?.sessionDates || sheet.sessionDates || []
          };
          await supabase.from('groups').upsert(rowToUpsert);
        }
      } catch (dbErr) {
        // Non-blocking log if Supabase is offline or quota exceeded
        console.warn('Database background write error in /api/groups/sync:', dbErr);
      }
    })();

    return NextResponse.json({ success: true, eventType, groupId: targetId, timestamp });
  } catch (err: any) {
    console.error('Error in /api/groups/sync:', err);
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
