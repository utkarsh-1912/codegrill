import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export function SelectDropdown({
  value,
  options,
  onChange,
  ariaLabel,
  prefix,
  compact = false,
  align = 'left',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const listId = useId();

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const selected = options[selectedIndex] || options[0];

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const gap = 6;
    const maxMenuH = Math.min(300, Math.floor(viewportH * 0.45));
    const spaceBelow = viewportH - rect.bottom - gap - 12;
    const spaceAbove = rect.top - gap - 12;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(maxMenuH, openUp ? spaceAbove : spaceBelow));
    const width = Math.min(Math.max(rect.width, 190), viewportW - 24);

    let left = align === 'right' ? rect.right - width : rect.left;
    left = Math.max(12, Math.min(left, viewportW - width - 12));

    setMenuStyle({
      position: 'fixed',
      left: `${left}px`,
      width: `${width}px`,
      maxHeight: `${maxHeight}px`,
      ...(openUp
        ? { bottom: `${viewportH - rect.top + gap}px`, top: 'auto' }
        : { top: `${rect.bottom + gap}px`, bottom: 'auto' }),
      zIndex: 1200,
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);

    const onMouseDown = (event) => {
      const inTrigger = rootRef.current && rootRef.current.contains(event.target);
      const inMenu = menuRef.current && menuRef.current.contains(event.target);
      if (!inTrigger && !inMenu) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, selectedIndex]);

  function commit(index) {
    const opt = options[index];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  }

  function handleKeyDown(event) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + options.length) % options.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commit(activeIndex >= 0 ? activeIndex : 0);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className={`custom-select ${compact ? 'is-compact' : ''} ${open ? 'is-open' : ''} ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className="custom-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
      >
        {prefix && <span className="lang-code-badge" aria-hidden="true">{prefix}</span>}
        <span className="custom-select-value" lang={selected?.lang}>{selected?.label}</span>
        <ChevronDown size={15} className="custom-select-chevron" aria-hidden="true" />
      </button>

      {open && menuStyle && createPortal(
        <ul
          ref={menuRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={`custom-select-menu is-portaled align-${align}`}
          style={menuStyle}
        >
          {options.map((opt, index) => {
            const isSelected = opt.value === value;
            const isFocused = index === activeIndex;
            return (
              <li key={String(opt.value)} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`custom-select-option ${isSelected ? 'is-selected' : ''} ${isFocused ? 'is-focused' : ''}`}
                  lang={opt.lang}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(index)}
                >
                  <span className="custom-select-opt-label">
                    {opt.badge && <span className="lang-code-badge" aria-hidden="true">{opt.badge}</span>}
                    <span>{opt.label}</span>
                  </span>
                  {isSelected && <Check size={14} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>,
        document.body,
      )}
    </div>
  );
}
