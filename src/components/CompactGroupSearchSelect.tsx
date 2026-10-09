'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { GroupMeta, GroupSheet } from '../types';
import {
  isGroupToday,
  normalizeArabicText,
  getGroupLevelFromId,
  getLevelDisplayName
} from '../utils/sessionUtils';

interface Props {
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
  groups: GroupMeta[];
  groupData?: Record<string, GroupSheet>;
  placeholder?: string;
  height?: string;
  style?: React.CSSProperties;
}

export default function CompactGroupSearchSelect({
  selectedGroupId,
  onSelectGroup,
  groups,
  groupData,
  placeholder = 'ابحث عن فوج...',
  height = '28px',
  style
}: Props) {
  const currentGroup = useMemo(() => {
    return groups.find((g) => g.id === selectedGroupId) || groups[0];
  }, [groups, selectedGroupId]);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const getDisplayText = (g?: GroupMeta) => {
    if (!g) return '';
    const hasToday = groupData && isGroupToday(g, groupData[g.id]);
    return `${hasToday ? '⭐ ' : ''}فوج ${g.id} (${g.subject})`;
  };

  // Close dropdown on outside click
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

  // Filtered and sorted groups
  const filteredGroups = useMemo(() => {
    const list = groups.filter((g) => {
      if (!query.trim()) return true;
      const q = normalizeArabicText(query.toLowerCase().trim());
      const id = normalizeArabicText((g.id || '').toLowerCase());
      const subj = normalizeArabicText((g.subject || '').toLowerCase());
      const teacher = normalizeArabicText((g.teacherName || '').toLowerCase());
      const lvl = normalizeArabicText((g.level || getGroupLevelFromId(g.id) || '').toLowerCase());
      const lvlName = normalizeArabicText(getLevelDisplayName(g.level || getGroupLevelFromId(g.id)).toLowerCase());

      return (
        id.includes(q) ||
        subj.includes(q) ||
        teacher.includes(q) ||
        lvl.includes(q) ||
        lvlName.includes(q) ||
        `فوج ${id}`.includes(q)
      );
    });

    return [...list].sort((a, b) => {
      const aToday = groupData && isGroupToday(a, groupData[a.id]) ? 1 : 0;
      const bToday = groupData && isGroupToday(b, groupData[b.id]) ? 1 : 0;
      return bToday - aToday;
    });
  }, [groups, groupData, query]);

  // Keyboard navigation
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
    inputRef.current?.select();
  };

  const isCompact = height === '28px';
  const iconSize = isCompact ? 12 : 16;
  const inputFontSize = isCompact ? '0.76rem' : '0.86rem';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        zIndex: isOpen ? 100 : 1,
        ...style
      }}
    >
      {/* Search Input Box */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          height,
          padding: isCompact ? '0 6px' : '0 10px',
          backgroundColor: 'var(--md-sys-color-surface)',
          borderRadius: isCompact ? '6px' : '8px',
          border: isOpen
            ? '1.5px solid var(--md-sys-color-primary)'
            : '1px solid var(--md-sys-color-outline-variant)',
          boxShadow: isOpen ? '0 0 0 2px rgba(0, 99, 155, 0.15)' : 'none',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          boxSizing: 'border-box'
        }}
      >
        <Search
          size={iconSize}
          color={isOpen ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)'}
          style={{ flexShrink: 0 }}
        />

        <input
          ref={inputRef}
          type="text"
          value={isOpen ? query : getDisplayText(currentGroup)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={isOpen ? placeholder : getDisplayText(currentGroup) || placeholder}
          className="m3-input"
          style={{
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            padding: 0,
            fontSize: inputFontSize,
            fontWeight: 700,
            color: 'var(--md-sys-color-on-surface)',
            backgroundColor: 'transparent',
            width: '100%',
            cursor: 'text',
            height: '100%'
          }}
          title={getDisplayText(currentGroup)}
        />

        {/* Clear query button */}
        {isOpen && query && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQuery('');
              inputRef.current?.focus();
            }}
            className="m3-btn-text"
            style={{
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              color: 'var(--md-sys-color-on-surface-variant)',
              cursor: 'pointer',
              flexShrink: 0
            }}
            title="مسح"
          >
            <X size={12} />
          </button>
        )}

        {/* Toggle Chevron */}
        <button
          type="button"
          onClick={() => {
            setIsOpen((prev) => !prev);
            if (!isOpen) inputRef.current?.focus();
          }}
          className="m3-btn-text"
          style={{
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            color: 'var(--md-sys-color-on-surface-variant)',
            cursor: 'pointer',
            flexShrink: 0
          }}
          tabIndex={-1}
        >
          <ChevronDown
            size={12}
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease'
            }}
          />
        </button>
      </div>

      {/* Floating Results Popover */}
      {isOpen && (
        <div
          ref={listRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 3px)',
            insetInlineStart: 0,
            minWidth: '230px',
            maxWidth: '290px',
            maxHeight: '220px',
            overflowY: 'auto',
            backgroundColor: 'var(--md-sys-color-surface)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
            padding: '4px',
            zIndex: 9999
          }}
        >
          {filteredGroups.length === 0 ? (
            <div
              style={{
                padding: '8px 10px',
                fontSize: '0.75rem',
                textAlign: 'center',
                color: 'var(--md-sys-color-on-surface-variant)',
                fontWeight: 600
              }}
            >
              لا يوجد أي فوج مطابق
            </div>
          ) : (
            filteredGroups.map((g, idx) => {
              const isSelected = g.id === selectedGroupId;
              const isHighlighted = idx === highlightedIndex;
              const hasSessionToday = groupData && isGroupToday(g, groupData[g.id]);

              return (
                <div
                  key={g.id}
                  onClick={() => handleSelect(g.id)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: isHighlighted
                      ? 'var(--md-sys-color-surface-container-high)'
                      : isSelected
                      ? 'var(--md-sys-color-primary-container)'
                      : 'transparent',
                    color: isSelected
                      ? 'var(--md-sys-color-on-primary-container)'
                      : 'var(--md-sys-color-on-surface)',
                    fontSize: '0.76rem',
                    transition: 'background-color 0.1s ease',
                    marginBottom: '2px'
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {hasSessionToday ? '⭐ ' : ''}فوج {g.id} ({g.subject})
                    </div>
                    {g.teacherName && (
                      <div
                        style={{
                          fontSize: '0.67rem',
                          color: 'var(--md-sys-color-on-surface-variant)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        الأستاذ: {g.teacherName}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <Check
                      size={13}
                      color="var(--md-sys-color-primary)"
                      style={{ flexShrink: 0, marginInlineStart: '6px' }}
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
