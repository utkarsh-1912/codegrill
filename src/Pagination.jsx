import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getMessages } from './i18n.mjs';

function buildPages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('ellipsis-start');
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (end < total - 1) pages.push('ellipsis-end');
  pages.push(total);
  return pages;
}

export function Pagination({ page, totalItems, pageSize, onPageChange, locale = 'en' }) {
  const t = getMessages(locale);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return null;

  const safePage = Math.max(1, Math.min(totalPages, page));
  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);
  const pages = buildPages(safePage, totalPages);

  return (
    <nav className="pagination-bar" aria-label={t.pagination.label}>
      <span className="pagination-summary">
        {startItem}–{endItem} / {totalItems}
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label={t.pagination.prev}
          title={t.pagination.prev}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>

        {pages.map((entry) => (
          typeof entry === 'number' ? (
            <button
              key={entry}
              type="button"
              className={`pagination-btn ${entry === safePage ? 'is-current' : ''}`}
              aria-current={entry === safePage ? 'page' : undefined}
              onClick={() => onPageChange(entry)}
            >
              {entry}
            </button>
          ) : (
            <span key={entry} className="pagination-ellipsis" aria-hidden="true">…</span>
          )
        ))}

        <button
          type="button"
          className="pagination-btn"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label={t.pagination.next}
          title={t.pagination.next}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
