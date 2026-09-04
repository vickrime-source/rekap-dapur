import React from 'react';

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 6,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-pulse font-sans">
      {/* Skeleton Header */}
      <div className="bg-slate-100/90 border-b border-slate-200 p-2.5 flex items-center justify-between">
        <div className="h-4 bg-slate-300 rounded w-28"></div>
        <div className="flex gap-2">
          <div className="h-4 bg-slate-300 rounded w-16"></div>
          <div className="h-4 bg-slate-300 rounded w-16"></div>
        </div>
      </div>

      {/* Skeleton Rows */}
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="p-3 flex items-center gap-3">
            {/* Date / # */}
            <div className="h-5 bg-slate-200 rounded w-14 shrink-0"></div>
            {/* Dapur Badge */}
            <div className="h-5 bg-slate-200 rounded w-20 shrink-0"></div>
            {/* Item details */}
            <div className="flex-1 space-y-1">
              <div className="h-3.5 bg-slate-200 rounded w-3/4"></div>
              <div className="h-2.5 bg-slate-100 rounded w-1/3"></div>
            </div>
            {/* Qty */}
            <div className="h-5 bg-slate-200 rounded w-8 shrink-0"></div>
            {/* Prices */}
            <div className="h-5 bg-slate-200 rounded w-16 shrink-0"></div>
            {/* Toko Badge */}
            <div className="h-5 bg-slate-200 rounded w-16 shrink-0"></div>
            {/* Status Pills */}
            <div className="flex gap-1 shrink-0">
              <div className="h-5 bg-slate-200 rounded w-12"></div>
              <div className="h-5 bg-slate-200 rounded w-12"></div>
            </div>
            {/* Action */}
            <div className="h-6 w-6 bg-slate-200 rounded-lg shrink-0"></div>
          </div>
        ))}
      </div>
    </div>
  );
};
