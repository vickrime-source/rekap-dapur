import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Truck, ChevronDown, Check, X, Search } from 'lucide-react';
import { MasterPemasok } from '../types';

interface PemasokAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  fallbackPemasok?: string;
  masterPemasok?: MasterPemasok[];
  pemasokList?: string[];
  id?: string;
  className?: string;
  compact?: boolean;
}

export const PemasokAutocomplete: React.FC<PemasokAutocompleteProps> = ({
  value = '',
  onChange,
  placeholder,
  fallbackPemasok,
  masterPemasok = [],
  pemasokList = [],
  id = 'input-pemasok-autocomplete',
  className = '',
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayValue = value !== undefined && value !== null ? value : '';

  // Combine and deduplicate suppliers from masterPemasok and pemasokList
  const allSuppliers = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    masterPemasok.forEach((p) => {
      const trimmed = p.nama?.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        list.push(trimmed);
      }
    });

    pemasokList.forEach((p) => {
      const trimmed = p?.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        list.push(trimmed);
      }
    });

    return list.sort((a, b) => a.localeCompare(b, 'id'));
  }, [masterPemasok, pemasokList]);

  // Filtered suppliers based on current text
  const filteredSuppliers = useMemo(() => {
    const q = displayValue.trim().toLowerCase();
    if (!q) return allSuppliers;
    return allSuppliers.filter((s) => s.toLowerCase().includes(q));
  }, [allSuppliers, displayValue]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (supplierName: string) => {
    onChange(supplierName);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const dynamicPlaceholder = useMemo(() => {
    return placeholder || '';
  }, [placeholder]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          id={id}
          value={displayValue}
          autoComplete="off"
          placeholder={dynamicPlaceholder}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className={`w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-semibold ${
            compact ? 'px-2.5 py-1.5 text-xs pr-14' : 'px-3 py-2 text-xs sm:text-sm pr-14'
          }`}
        />

        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {displayValue && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Kosongkan (kembali ikut pemasok utama)"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title="Daftar pemasok"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
          {/* Header indicator */}
          <div className="sticky top-0 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-[9.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 z-10">
            <span className="flex items-center gap-1">
              <Truck className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
              <span>Daftar Pemasok Tersimpan ({allSuppliers.length})</span>
            </span>
            {fallbackPemasok && (
              <span className="text-[9px] font-normal text-indigo-600 dark:text-indigo-400">
                Utama: {fallbackPemasok}
              </span>
            )}
          </div>

          {/* Fallback option if custom value exists */}
          {fallbackPemasok && (
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                !displayValue
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="italic">Ikuti Pemasok Utama ({fallbackPemasok})</span>
              </div>
              {!displayValue && (
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded">
                  Default
                </span>
              )}
            </button>
          )}

          {/* List of suppliers */}
          {filteredSuppliers.length > 0 ? (
            filteredSuppliers.map((supplier) => {
              const isSelected = displayValue.trim().toLowerCase() === supplier.trim().toLowerCase();
              return (
                <button
                  key={supplier}
                  type="button"
                  onClick={() => handleSelect(supplier)}
                  className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-bold'
                      : 'text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{supplier}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                </button>
              );
            })
          ) : (
            <div className="p-3 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Pemasok "<span className="font-semibold text-slate-700 dark:text-slate-200">{displayValue}</span>" belum ada di daftar
              </p>
              <span className="inline-block text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg">
                + Nama ini tetap akan disimpan untuk item ini
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
