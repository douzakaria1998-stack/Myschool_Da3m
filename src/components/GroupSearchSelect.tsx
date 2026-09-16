'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Search, X, Check, ChevronDown, Sparkles, Calendar } from 'lucide-react';
import { isGroupToday, formatGroupTime, normalizeArabicText, sortGroupsActiveFirstOldToNew } from '../utils/sessionUtils';

interface Props {
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
  label?: string;
  placeholder?: string;
  width?: string;
}

export default function GroupSearchSelect({
  selectedGroupId,
  onSelectGroup,
  label = 'اختر الفوج الدراسي:',
  placeholder = 'ابحث عن فوج (مثال: BAC01، فيزياء، البشير...)',
  width = '320px'
}: Props) {
  const { data } = useApp();
  const currentGroup = data.groups.find((g) => g.id === selectedGroupId) || data.groups[0];

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync display text when selectedGroupId changes
  const getGroupDisplayText = (g?: typeof currentGroup) => {
    if (!g) return '';
    return `${g.id} - ${g.subject} (${g.teacherName})`;
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter and sort groups: active first from oldest to newest ID
  const filteredGroups = useMemo(() => {
    const matched = data.groups.filter((g) => {
      if (!query.trim()) return true;
      const normQ = normalizeArabicText(query.toLowerCase());
      const normId = normalizeArabicText(g.id.toLowerCase());
      const normSubject = normalizeArabicText(g.subject.toLowerCase());
      const normTeacher = normalizeArabicText(g.teacherName.toLowerCase());
      const normDay1 = normalizeArabicText(g.day1?.toLowerCase() || '');
      const normDay2 = normalizeArabicText(g.day2?.toLowerCase() || '');

      return (
        normId.includes(normQ) ||
        normSubject.includes(normQ) ||
        normTeacher.includes(normQ) ||
        normDay1.includes(normQ) ||
        normDay2.includes(normQ) ||
        (g.isVip && (normQ.includes('vip') || normQ.includes('خاص')))
      );
    });

    return sortGroupsActiveFirstOldToNew(matched, data.groupData, data.pricingTiers);
  }, [data.groups, data.groupData, data.pricingTiers, query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 < filteredGroups.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredGroups.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredGroups[highlightedIndex]) {
        handleSelect(filteredGroups[highlightedIndex].id);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (groupId: string) => {
    onSelectGroup(groupId);
    setIsOpen(false);
    setQuery('');
  };

  const handleFocus = () => {
    setIsOpen(true);
    setHighlightedIndex(0);
    // Select text on focus so typing immediately searches
    inputRef.current?.select();
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width, minWidth: '260px' }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: 'var(--md-sys-color-on-surface-variant)',
            marginBottom: '4px'
          }}
        >
          {label}
        </label>
      )}

      {/* Search Input Box */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--md-sys-color-surface)',
          borderRadius: 'var(--md-shape-sm)',
          border: isOpen
            ? '2px solid var(--md-sys-color-primary)'
            : '1px solid var(--md-sys-color-outline-variant)',
          boxShadow: isOpen ? '0 0 0 3px rgba(0, 99, 155, 0.15)' : 'none',
          transition: 'border 0.2s ease, box-shadow 0.2s ease'
        }}
      >
        <Search
          size={18}
          color={isOpen ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)'}
          style={{ marginInlineStart: '12px', flexShrink: 0 }}
        />

        <input
          ref={inputRef}
          type="text"
          value={isOpen ? query : getGroupDisplayText(currentGroup)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={isOpen ? placeholder : getGroupDisplayText(currentGroup) || placeholder}
          className="m3-input"
          style={{
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            padding: '8px 10px',
            fontSize: '0.95rem',
            fontWeight: 700,
            color: 'var(--md-sys-color-on-surface)',
            backgroundColor: 'transparent',
            width: '100%',
            cursor: 'text'
          }}
        />

        {/* Action icons on end: Clear query or dropdown indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginInlineEnd: '8px', gap: '4px' }}>
          {isOpen && query && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setQuery('');
                inputRef.current?.focus();
              }}
              className="m3-btn-text"
              style={{ padding: '2px', borderRadius: '50%', color: 'var(--md-sys-color-on-surface-variant)' }}
              title="مسح البحث"
            >
              <X size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen) inputRef.current?.focus();
            }}
            className="m3-btn-text"
            style={{ padding: '2px', color: 'var(--md-sys-color-on-surface-variant)' }}
            tabIndex={-1}
          >
            <ChevronDown
              size={18}
              style={{
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            />
          </button>
        </div>
      </div>

      {/* Floating Results Popover */}
      {isOpen && (
        <div
          ref={listRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            insetInlineStart: 0,
            width: '100%',
            maxHeight: '340px',
            overflowY: 'auto',
            backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
            borderRadius: 'var(--md-shape-sm)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            padding: '4px'
          }}
        >
          {filteredGroups.length === 0 ? (
            <div
              style={{
                padding: '16px',
                textAlign: 'center',
                color: 'var(--md-sys-color-on-surface-variant)',
                fontSize: '0.85rem'
              }}
            >
              لا يوجد فوج مطابق لـ &quot;{query}&quot;
            </div>
          ) : (
            filteredGroups.map((g, idx) => {
              const isSelected = g.id === selectedGroupId;
              const isHighlighted = idx === highlightedIndex;
              const isToday = isGroupToday(g, data.groupData[g.id]);

              return (
                <div
                  key={g.id}
                  onClick={() => handleSelect(g.id)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--md-shape-xs)',
                    cursor: 'pointer',
                    backgroundColor: isHighlighted
                      ? 'var(--md-sys-color-surface-container-high)'
                      : isSelected
                      ? 'var(--md-sys-color-primary-container)'
                      : 'transparent',
                    transition: 'background-color 0.1s ease',
                    marginBottom: '2px'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '0.92rem',
                          color: isSelected
                            ? 'var(--md-sys-color-on-primary-container)'
                            : 'var(--md-sys-color-primary)'
                        }}
                      >
                        {g.id}
                      </span>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          color: 'var(--md-sys-color-on-surface)'
                        }}
                      >
                        {g.subject}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                        ({g.teacherName})
                      </span>

                      {isToday && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            backgroundColor: 'var(--status-present-container)',
                            color: 'var(--status-present)',
                            padding: '1px 6px',
                            borderRadius: 'var(--md-shape-full)'
                          }}
                        >
                          اليوم ★
                        </span>
                      )}

                      {g.isVip && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            backgroundColor: 'var(--status-vip-container, #fef3c7)',
                            color: 'var(--status-vip, #b45309)',
                            padding: '1px 6px',
                            borderRadius: 'var(--md-shape-full)'
                          }}
                        >
                          VIP
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.74rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                      {g.day1} ({formatGroupTime(g.time1) || 'صباحاً'})
                      {g.day2 ? ` • ${g.day2} (${formatGroupTime(g.time2)})` : ''}
                      {' • '}
                      <span style={{ fontWeight: 600 }}>{g.type}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <Check
                      size={16}
                      color="var(--md-sys-color-primary)"
                      style={{ marginInlineStart: '8px', flexShrink: 0 }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
