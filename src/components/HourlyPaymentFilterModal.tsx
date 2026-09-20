'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Clock,
  Calendar,
  DollarSign,
  Users,
  Receipt,
  Printer,
  Download,
  X,
  Check,
  Search,
  Filter,
  ArrowUpDown,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { formatToYYYYMMDD } from '../utils/sessionUtils';
import {
  collectTodayAndHourlyPayments,
  PaymentRecordItem,
  PaymentHourlySummary
} from '../utils/paymentLogger';
import { printSingleThermalReceipt } from '../utils/printUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialGroupId?: string;
}

export default function HourlyPaymentFilterModal({ isOpen, onClose, initialGroupId }: Props) {
  const { data } = useApp();

  // Selected Date (default: today)
  const todayYYYYMMDD = useMemo(() => formatToYYYYMMDD(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayYYYYMMDD);

  // Group Scope: 'all' or specific group ID
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId || 'all');

  // Time Range (HH:mm)
  // Default to whole day or convenient 2-hour window
  const [fromTime, setFromTime] = useState<string>('08:00');
  const [toTime, setToTime] = useState<string>('18:00');

  // Quick Preset Tracker
  const [activePreset, setActivePreset] = useState<string>('day');

  // Search within payments
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Expand list / collapse filters toggle
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState<boolean>(false);

  // Update initial group if changed
  useEffect(() => {
    if (initialGroupId) {
      setSelectedGroupId(initialGroupId);
    }
  }, [initialGroupId]);

  // Current live time
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Quick Presets Handlers
  const handleApplyPreset = (preset: string) => {
    setActivePreset(preset);
    const now = new Date();
    const curHour = now.getHours();

    switch (preset) {
      case 'last2h': {
        const startH = Math.max(0, curHour - 2);
        setFromTime(`${String(startH).padStart(2, '0')}:00`);
        setToTime(`${String(curHour + 1).padStart(2, '0')}:00`);
        setSelectedDate(todayYYYYMMDD);
        break;
      }
      case '1to3pm': {
        // User explicitly asked for 1:00 PM to 3:00 PM (13:00 - 15:00)
        setFromTime('13:00');
        setToTime('15:00');
        setSelectedDate(todayYYYYMMDD);
        break;
      }
      case 'morning': {
        setFromTime('08:00');
        setToTime('12:00');
        break;
      }
      case 'afternoon': {
        setFromTime('12:00');
        setToTime('16:00');
        break;
      }
      case 'evening': {
        setFromTime('16:00');
        setToTime('20:00');
        break;
      }
      case 'allDay': {
        setFromTime('00:00');
        setToTime('23:59');
        break;
      }
      default:
        break;
    }
  };

  // Collect & Aggregate filtered payments
  const summary: PaymentHourlySummary = useMemo(() => {
    return collectTodayAndHourlyPayments(data, {
      dateStr: selectedDate,
      fromTime,
      toTime,
      groupId: selectedGroupId
    });
  }, [data, selectedDate, fromTime, toTime, selectedGroupId]);

  // Filtered payments by text search
  const displayedPayments = useMemo(() => {
    if (!searchFilter.trim()) return summary.payments;
    const q = searchFilter.trim().toLowerCase();
    return summary.payments.filter(
      (p) =>
        p.studentName.toLowerCase().includes(q) ||
        p.groupId.toLowerCase().includes(q) ||
        (p.studentPhone && p.studentPhone.includes(q)) ||
        (p.studentBarcode && p.studentBarcode.toLowerCase().includes(q))
    );
  }, [summary.payments, searchFilter]);

  // Print Thermal Receipt for individual transaction
  const handlePrintReceipt = (item: PaymentRecordItem) => {
    const group = data.groupData[item.groupId];
    const receiptNo = `REC-${item.groupId}-${(item.studentRowId || 1).toString().padStart(3, '0')}`;
    printSingleThermalReceipt({
      receiptNo,
      centerName: data.centerName || 'مؤسسة دعم',
      cycle: data.cycle || 'الدورة الحالية',
      academicYear: data.academicYear || '',
      date: item.dateStr,
      time: item.timeStr,
      studentName: item.studentName,
      studentPhone: item.studentPhone,
      groupId: item.groupId,
      subject: item.groupSubject || group?.subject || '',
      teacherName: item.teacherName || group?.teacherName || '—',
      amount: item.amount,
      totalFee: item.totalFee || 0,
      totalPaid: item.totalReceived || item.amount,
      balance: item.remainingDebt || 0
    });
  };

  // Export CSV Report of this specific time window
  const handleExportCsv = () => {
    const headers = [
      'التاريخ',
      'الوقت',
      'اسم التلميذ',
      'رقم الهاتف',
      'الفوج',
      'المادة',
      'الأستاذ',
      'الحصة',
      'المبلغ المدفوع (دج)',
      'إجمالي الرسوم (دج)',
      'الدين المتبقي (دج)'
    ];

    const rows = summary.payments.map((p) => [
      `"${p.dateStr}"`,
      `"${p.timeStr}"`,
      `"${p.studentName.replace(/"/g, '""')}"`,
      `"${p.studentPhone || ''}"`,
      `"${p.groupId}"`,
      `"${p.groupSubject || ''}"`,
      `"${p.teacherName || ''}"`,
      `"الحصة ${p.sessionIndex + 1}"`,
      p.amount,
      p.totalFee || 0,
      p.remainingDebt || 0
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير_المداخيل_${selectedDate.replace(/\//g, '-')}_من_${fromTime.replace(':', 'h')}_إلى_${toTime.replace(':', 'h')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Print Summary Sheet
  const handlePrintSummary = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rowsHtml = summary.payments
      .map(
        (p, idx) => `
      <tr>
        <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${p.timeStr}</td>
        <td style="padding: 6px; border: 1px solid #ddd; font-weight: bold;">${p.studentName}</td>
        <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${p.groupId} (${p.groupSubject || ''})</td>
        <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">الحصة ${p.sessionIndex + 1}</td>
        <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-weight: bold; color: #15803d;">${p.amount.toLocaleString()} دج</td>
        <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${(p.remainingDebt || 0).toLocaleString()} دج</td>
      </tr>
    `
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>تقرير المداخيل حسب الساعات - ${selectedDate}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
          .kpi-box { display: flex; justify-content: space-around; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 20px; }
          .kpi { text-align: center; }
          .kpi-title { font-size: 12px; color: #64748b; }
          .kpi-val { font-size: 18px; font-weight: bold; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #f1f5f9; padding: 8px; border: 1px solid #cbd5e1; text-align: center; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0 0 6px 0;">${data.centerName || 'مؤسسة دعم'}</h2>
          <div style="font-size: 14px; color: #475569;">
            كشف المداخيل المقبوضة ليوم: <strong>${selectedDate}</strong> | الفترة: من <strong>${fromTime}</strong> إلى <strong>${toTime}</strong>
            ${selectedGroupId !== 'all' ? ` | الفوج: <strong>${selectedGroupId}</strong>` : ' | كامل المركز'}
          </div>
        </div>

        <div class="kpi-box">
          <div class="kpi">
            <div class="kpi-title">مجموع المحصل</div>
            <div class="kpi-val" style="color: #16a34a;">${summary.totalAmount.toLocaleString()} دج</div>
          </div>
          <div class="kpi">
            <div class="kpi-title">عدد التلاميذ المسددين</div>
            <div class="kpi-val">${summary.uniqueStudentsCount} تلميذ</div>
          </div>
          <div class="kpi">
            <div class="kpi-title">عدد العمليات</div>
            <div class="kpi-val">${summary.paymentsCount} عملية</div>
          </div>
          <div class="kpi">
            <div class="kpi-title">مستحق الأساتذة</div>
            <div class="kpi-val" style="color: #0284c7;">${summary.teacherTotal.toLocaleString()} دج</div>
          </div>
          <div class="kpi">
            <div class="kpi-title">صافي المركز</div>
            <div class="kpi-val" style="color: #d97706;">${summary.schoolEarnTotal.toLocaleString()} دج</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>الوقت</th>
              <th>اسم التلميذ</th>
              <th>الفوج والمادة</th>
              <th>الحصة</th>
              <th>المبلغ المدفوع</th>
              <th>المتبقي (الدين)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="7" style="text-align: center; padding: 20px;">لا توجد مدفوعات مسجلة في هذه الفترة</td></tr>'}
          </tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };

  if (!isOpen) return null;

  return (
    <div className="m3-dialog-backdrop" onClick={onClose} style={{ zIndex: 120 }}>
      <div
        className="m3-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '1280px',
          width: '96%',
          height: '95vh',
          maxHeight: '95vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 20px',
          backgroundColor: 'var(--md-sys-color-surface)',
          borderRadius: 'var(--md-shape-xl)',
          boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
          boxSizing: 'border-box'
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '14px',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Clock size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--md-sys-color-on-surface)' }}>
                تصفية المداخيل حسب الساعات واليوم
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--md-sys-color-on-surface-variant)', margin: '2px 0 0 0' }}>
                متابعة حركة الصندوق والمدفوعات المحصلة بدقة بالساعة والدقيقة لكل فوج أو كامل المركز
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {currentTimeStr && (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--md-sys-color-surface-container-high)',
                  padding: '4px 10px',
                  borderRadius: 'var(--md-shape-full)',
                  color: 'var(--md-sys-color-on-surface)'
                }}
              >
                🕒 الساعة الآن: {currentTimeStr}
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsFiltersCollapsed((prev) => !prev)}
              className={`m3-btn m3-btn-sm ${isFiltersCollapsed ? 'm3-btn-tonal' : 'm3-btn-outlined'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', padding: '5px 12px' }}
              title={isFiltersCollapsed ? 'إظهار لوحة الفلاتر والإحصائيات' : 'تكبير حجم القائمة وإخفاء خيارات التصفية'}
            >
              {isFiltersCollapsed ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              <span>{isFiltersCollapsed ? 'إظهار الفلاتر' : '📐 تكبير القائمة'}</span>
            </button>
            <button
              onClick={onClose}
              className="m3-btn-text"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--md-sys-color-on-surface-variant)',
                cursor: 'pointer'
              }}
              title="إغلاق"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filter Controls & KPIs Panel */}
        {isFiltersCollapsed ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              padding: '8px 14px',
              borderRadius: '10px',
              margin: '8px 0',
              border: '1px solid var(--md-sys-color-outline-variant)',
              fontSize: '0.82rem',
              flexWrap: 'wrap',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <span>📅 <strong>{selectedDate}</strong></span>
              <span>⏰ من <strong>{fromTime}</strong> إلى <strong>{toTime}</strong></span>
              <span>🏫 <strong>{selectedGroupId === 'all' ? 'جميع الأفواج' : `فوج ${selectedGroupId}`}</strong></span>
              <span style={{ color: 'var(--status-present)', fontWeight: 800 }}>
                💵 المحصل: {summary.totalAmount.toLocaleString()} دج
              </span>
              <span style={{ color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 700 }}>
                👥 {summary.uniqueStudentsCount} تلميذ ({summary.paymentsCount} عملية)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsFiltersCollapsed(false)}
              className="m3-btn m3-btn-text m3-btn-sm"
              style={{ fontSize: '0.76rem', color: 'var(--md-sys-color-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>تعديل الفلاتر</span>
              <ChevronDown size={14} />
            </button>
          </div>
        ) : (
          <>
            {/* Filter Controls Panel */}
            <div
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-low)',
                padding: '10px 14px',
                borderRadius: '10px',
                marginTop: '10px',
                border: '1px solid var(--md-sys-color-outline-variant)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
          {/* Row 1: Date & Group Selector */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            {/* Date Picker */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>
                📅 تاريخ اليوم / الجرد:
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="date"
                  value={selectedDate.replace(/\//g, '-')}
                  onChange={(e) => {
                    const val = e.target.value ? e.target.value.replace(/-/g, '/') : todayYYYYMMDD;
                    setSelectedDate(val);
                  }}
                  className="m3-input"
                  style={{ flex: 1, padding: '6px 10px', fontSize: '0.84rem', fontWeight: 700 }}
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayYYYYMMDD)}
                  className="m3-btn m3-btn-outlined m3-btn-sm"
                  style={{ fontSize: '0.75rem', padding: '4px 10px', whiteSpace: 'nowrap' }}
                >
                  اليوم
                </button>
              </div>
            </div>

            {/* Group Scope */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>
                🏫 نطاق الفوج:
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="m3-input"
                style={{ width: '100%', padding: '6px 10px', fontSize: '0.84rem', fontWeight: 700 }}
              >
                <option value="all">🏢 جميع أفواج المركز (شامل)</option>
                {data.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    فوج {g.id} ({g.subject} - {g.teacherName})
                  </option>
                ))}
              </select>
            </div>

            {/* Time Range Pickers */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>
                ⏰ نطاق الساعات:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--md-sys-color-on-surface-variant)' }}>من:</span>
                  <input
                    type="time"
                    value={fromTime}
                    onChange={(e) => {
                      setFromTime(e.target.value);
                      setActivePreset('custom');
                    }}
                    className="m3-input"
                    style={{ flex: 1, padding: '6px 8px', fontSize: '0.84rem', fontWeight: 700 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--md-sys-color-on-surface-variant)' }}>إلى:</span>
                  <input
                    type="time"
                    value={toTime}
                    onChange={(e) => {
                      setToTime(e.target.value);
                      setActivePreset('custom');
                    }}
                    className="m3-input"
                    style={{ flex: 1, padding: '6px 8px', fontSize: '0.84rem', fontWeight: 700 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Quick Presets Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface-variant)', marginLeft: '4px' }}>
              ⚡ فترات سريعة:
            </span>

            <button
              type="button"
              onClick={() => handleApplyPreset('1to3pm')}
              className={`m3-btn m3-btn-sm ${activePreset === '1to3pm' ? 'm3-btn-filled' : 'm3-btn-outlined'}`}
              style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: 'var(--md-shape-full)' }}
              title="تصفية من الساعة 1:00 زوالاً إلى 3:00 مساءً"
            >
              ⭐ من 13:00 إلى 15:00 (1 PM - 3 PM)
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('last2h')}
              className={`m3-btn m3-btn-sm ${activePreset === 'last2h' ? 'm3-btn-filled' : 'm3-btn-outlined'}`}
              style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: 'var(--md-shape-full)' }}
              title="تصفية آخر ساعتين من الآن"
            >
              آخر ساعتين ⏳
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('morning')}
              className={`m3-btn m3-btn-sm ${activePreset === 'morning' ? 'm3-btn-filled' : 'm3-btn-outlined'}`}
              style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: 'var(--md-shape-full)' }}
            >
              الصباح (08:00 - 12:00)
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('afternoon')}
              className={`m3-btn m3-btn-sm ${activePreset === 'afternoon' ? 'm3-btn-filled' : 'm3-btn-outlined'}`}
              style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: 'var(--md-shape-full)' }}
            >
              الظهيرة (12:00 - 16:00)
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('evening')}
              className={`m3-btn m3-btn-sm ${activePreset === 'evening' ? 'm3-btn-filled' : 'm3-btn-outlined'}`}
              style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: 'var(--md-shape-full)' }}
            >
              المساء (16:00 - 20:00)
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('allDay')}
              className={`m3-btn m3-btn-sm ${activePreset === 'allDay' ? 'm3-btn-filled' : 'm3-btn-outlined'}`}
              style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: 'var(--md-shape-full)' }}
            >
              كامل اليوم (00:00 - 23:59)
            </button>
          </div>
        </div>

        {/* KPIs Cards Display (Mirrors user screenshot with hourly numbers!) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '8px',
            margin: '8px 0',
            backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1px solid var(--md-sys-color-outline-variant)',
            textAlign: 'center'
          }}
        >
          {/* Card 1: Total Received in Window */}
          <div style={{ borderInlineEnd: '1px solid var(--md-sys-color-outline-variant)', paddingInline: '4px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--status-present)' }}>
              المحصل في الفترة
            </span>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--status-present)', marginTop: '2px' }}>
              {summary.totalAmount.toLocaleString()}{' '}
              <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>دج</span>
            </div>
          </div>

          {/* Card 2: Number of Students */}
          <div style={{ borderInlineEnd: '1px solid var(--md-sys-color-outline-variant)', paddingInline: '4px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface-variant)' }}>
              التلاميذ المسددون
            </span>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--md-sys-color-on-surface)', marginTop: '2px' }}>
              {summary.uniqueStudentsCount}{' '}
              <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>تلميذ</span>
            </div>
          </div>

          {/* Card 3: Payments Count */}
          <div style={{ borderInlineEnd: '1px solid var(--md-sys-color-outline-variant)', paddingInline: '4px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface-variant)' }}>
              العمليات
            </span>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--md-sys-color-on-surface)', marginTop: '2px' }}>
              {summary.paymentsCount}{' '}
              <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>عملية</span>
            </div>
          </div>

          {/* Card 4: Teacher share */}
          <div style={{ borderInlineEnd: '1px solid var(--md-sys-color-outline-variant)', paddingInline: '4px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--md-sys-color-secondary)' }}>
              مستحق الأساتذة
            </span>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--md-sys-color-secondary)', marginTop: '2px' }}>
              {summary.teacherTotal.toLocaleString()}{' '}
              <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>دج</span>
            </div>
          </div>

          {/* Card 5: Center net share */}
          <div style={{ paddingInline: '4px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>
              صافي المركز
            </span>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--md-sys-color-primary)', marginTop: '2px' }}>
              {summary.schoolEarnTotal.toLocaleString()}{' '}
              <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>دج</span>
            </div>
          </div>
        </div>
      </>
    )}

        {/* Action Buttons & Search Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          {/* Search bar inside results */}
          <div style={{ position: 'relative', width: '280px' }}>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="ابحث باسم التلميذ أو الفوج..."
              className="m3-input"
              style={{ width: '100%', paddingInlineStart: '32px', paddingBlock: '6px', fontSize: '0.8rem' }}
            />
            <Search
              size={14}
              style={{
                position: 'absolute',
                insetInlineStart: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--md-sys-color-outline)',
                pointerEvents: 'none'
              }}
            />
          </div>

          {/* Export & Print Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={summary.payments.length === 0}
              className="m3-btn m3-btn-outlined m3-btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem' }}
              title="تصدير كشف هذه الفترة إلى ملف CSV / Excel"
            >
              <Download size={14} />
              <span>تصدير Excel (CSV)</span>
            </button>

            <button
              type="button"
              onClick={handlePrintSummary}
              disabled={summary.payments.length === 0}
              className="m3-btn m3-btn-tonal m3-btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem' }}
              title="طباعة تقرير كامل لهذه الفترة"
            >
              <Printer size={14} />
              <span>طباعة الكشف A4</span>
            </button>
          </div>
        </div>

        {/* Transactions Breakdown Table */}
        <div
          style={{
            flex: 1,
            minHeight: isFiltersCollapsed ? '640px' : '440px',
            overflowY: 'auto',
            border: '1px solid var(--md-sys-color-outline-variant)',
            borderRadius: '10px',
            backgroundColor: 'var(--md-sys-color-surface)'
          }}
        >
          <table className="m3-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--md-sys-color-surface-container)', position: 'sticky', top: 0, zIndex: 2 }}>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '45px' }}>#</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '95px' }}>⏰ الوقت</th>
                <th style={{ padding: '10px 12px', textAlign: 'start' }}>👤 اسم التلميذ</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>🏫 الفوج والمادة</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '85px' }}>الحصة</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '120px' }}>💵 المبلغ المسدد</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '110px' }}>المتبقي (الدين)</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '95px' }}>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {displayedPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Clock size={32} style={{ opacity: 0.4 }} />
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        لا توجد مدفوعات مسجلة بين الساعة {fromTime} والساعة {toTime} لهذا اليوم.
                      </div>
                      <div style={{ fontSize: '0.78rem' }}>
                        جرب توسيع نطاق الساعات أو الضغط على "كامل اليوم" للاطلاع على جميع مدفوعات اليوم.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedPayments.map((p, idx) => (
                  <tr
                    key={p.id || `${p.groupId}-${p.studentRowId}-${idx}`}
                    style={{
                      borderBottom: '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--md-sys-color-surface-container-lowest)'
                    }}
                  >
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--md-sys-color-on-surface-variant)' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: 'var(--md-sys-color-primary)' }}>
                      {p.timeStr}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>{p.studentName}</div>
                      {p.studentPhone && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                          📞 {p.studentPhone}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          backgroundColor: 'var(--md-sys-color-surface-container-high)',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        {p.groupId}
                      </span>
                      {p.groupSubject && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '2px' }}>
                          {p.groupSubject}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>
                      الحصة {p.sessionIndex + 1}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900, color: 'var(--status-present)' }}>
                      {p.amount.toLocaleString()} دج
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: p.remainingDebt && p.remainingDebt > 0 ? '#b91c1c' : 'var(--md-sys-color-on-surface-variant)', fontWeight: p.remainingDebt && p.remainingDebt > 0 ? 800 : 500 }}>
                      {p.remainingDebt && p.remainingDebt > 0 ? `${p.remainingDebt.toLocaleString()} دج` : 'خالص ✓'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handlePrintReceipt(p)}
                        className="m3-btn-text"
                        style={{
                          fontSize: '0.72rem',
                          padding: '3px 6px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          color: 'var(--md-sys-color-primary)',
                          fontWeight: 700
                        }}
                        title="طباعة وصل دفع حراري فوري 80mm"
                      >
                        <Receipt size={13} />
                        <span>وصل</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '12px',
            borderTop: '1px solid var(--md-sys-color-outline-variant)',
            marginTop: '12px',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
            إجمالي السجلات المعروضة: <strong>{displayedPayments.length}</strong> سجل دفع
          </div>
          <button
            type="button"
            onClick={onClose}
            className="m3-btn m3-btn-filled"
            style={{ padding: '6px 20px', fontSize: '0.84rem' }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
