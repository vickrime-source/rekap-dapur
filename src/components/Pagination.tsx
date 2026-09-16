import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  onPageSizeChange,
}) => {
  const safeTotalPages = Math.max(1, totalPages || 1);
  const safeCurrentPage = Math.min(Math.max(1, currentPage || 1), safeTotalPages);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (safeTotalPages <= 7) {
      for (let i = 1; i <= safeTotalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) pages.push('...');

      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(safeTotalPages - 1, safeCurrentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (safeCurrentPage < safeTotalPages - 2) pages.push('...');
      pages.push(safeTotalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 py-3 px-3 sm:px-4 bg-slate-50/80 border-t border-slate-200 font-sans text-xs no-print">
      {/* KIRI: Informasi Data & Halaman */}
      <div className="flex items-center flex-wrap gap-2 text-slate-600 font-medium text-[11px] sm:text-xs">
        {totalItems !== undefined ? (
          <span>
            Menampilkan{' '}
            <strong className="text-slate-900 font-bold">
              {totalItems === 0
                ? 0
                : Math.min(totalItems, (safeCurrentPage - 1) * (pageSize || 10) + 1)}
              -
              {Math.min(totalItems, safeCurrentPage * (pageSize || 10))}
            </strong>{' '}
            dari <strong className="text-slate-900 font-bold">{totalItems}</strong> data
            <span className="hidden xs:inline text-slate-400 mx-1.5">•</span>
            <span className="hidden xs:inline">
              Hal <strong className="text-slate-900 font-bold">{safeCurrentPage}</strong> / {safeTotalPages}
            </span>
          </span>
        ) : (
          <span>
            Halaman <strong className="text-slate-900 font-bold">{safeCurrentPage}</strong> dari{' '}
            <strong className="text-slate-900 font-bold">{safeTotalPages}</strong>
          </span>
        )}

        {/* Pilihan Ukuran Baris per Halaman */}
        {onPageSizeChange && pageSize && (
          <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-slate-300">
            <span className="text-slate-500 text-[11px]">Tampil:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-white border border-slate-300 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value={10}>10 baris</option>
              <option value={15}>15 baris</option>
              <option value={25}>25 baris</option>
              <option value={50}>50 baris</option>
            </select>
          </div>
        )}
      </div>

      {/* KANAN: Tombol Navigasi Halaman */}
      <div className="flex items-center gap-1">
        {/* Prev button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
          disabled={safeCurrentPage <= 1}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer font-bold text-xs shadow-2xs active:scale-95"
          title="Halaman Sebelumnya"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Prev</span>
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1 mx-0.5">
          {getPageNumbers().map((page, idx) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 font-bold text-xs">
                  ...
                </span>
              );
            }

            const isCurrent = page === safeCurrentPage;
            return (
              <button
                type="button"
                key={`page-${page}`}
                onClick={() => onPageChange(page as number)}
                className={`min-w-8 h-8 px-2 flex items-center justify-center rounded-lg font-black text-xs transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/30 ring-1 ring-indigo-600'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* Next button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(safeTotalPages, safeCurrentPage + 1))}
          disabled={safeCurrentPage >= safeTotalPages}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer font-bold text-xs shadow-2xs active:scale-95"
          title="Halaman Selanjutnya"
        >
          <span className="hidden xs:inline">Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
