import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Plus, Check, Loader2 } from 'lucide-react';
import { MasterSatuan } from '../types';

interface SatuanAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  masterSatuan?: MasterSatuan[];
  onAddMasterSatuan?: (nama: string) => Promise<{ success: boolean; error?: string }>;
  id?: string;
  className?: string;
}

const DEFAULT_FALLBACK_UNITS = [
  'Kg', 'Gram', 'Pcs', 'Ikat', 'Tray', 'Pack', 'Liter', 'Box', 'Karung', 'Krat', 'Ekor', 'Bungkus', 'Botol', 'Kaleng'
];

export const SatuanAutocomplete: React.FC<SatuanAutocompleteProps> = ({
  value,
  onChange,
  masterSatuan = [],
  onAddMasterSatuan,
  id = 'input-satuan-autocomplete',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Combine masterSatuan from Supabase and default units
  const allUnits = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    // Add masterSatuan first
    masterSatuan.forEach((s) => {
      const trimmed = s.nama?.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        list.push(trimmed);
      }
    });

    // Add fallback defaults if not already present
    DEFAULT_FALLBACK_UNITS.forEach((u) => {
      if (!seen.has(u.toLowerCase())) {
        seen.add(u.toLowerCase());
        list.push(u);
      }
    });

    return list;
  }, [masterSatuan]);

  // Filtered suggestions based on typed value
  const filteredUnits = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (!q) return allUnits;
    return allUnits.filter((u) => u.toLowerCase().includes(q));
  }, [allUnits, value]);

  // Check if current value exists in list (exact match case-insensitive)
  const isExactMatch = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    return allUnits.some((u) => u.toLowerCase() === q);
  }, [allUnits, value]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (unitName: string) => {
    onChange(unitName);
    setIsOpen(false);
  };

  const handleAddNew = async (nameToAdd?: string) => {
    const cleanName = (nameToAdd || value || '').trim();
    if (!cleanName) return;

    setIsAdding(true);
    try {
      if (onAddMasterSatuan) {
        await onAddMasterSatuan(cleanName);
      }
      onChange(cleanName);
      setIsOpen(false);
    } catch (e) {
      console.warn('Gagal menambah satuan baru:', e);
      onChange(cleanName);
      setIsOpen(false);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          type="text"
          autoComplete="off"
          value={value}
          placeholder="Cari satuan (Kg, Krat...)"
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (filteredUnits.length > 0) {
                handleSelect(filteredUnits[0]);
              } else if (value.trim()) {
                handleAddNew(value);
              }
            } else if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          className="w-full px-3 py-2 pr-8 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-slate-400 placeholder:font-normal"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) inputRef.current?.focus();
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          title="Buka daftar satuan"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
          {/* Option to Add New Unit if user typed something not matching exactly */}
          {value.trim().length > 0 && !isExactMatch && (
            <button
              type="button"
              disabled={isAdding}
              onClick={() => handleAddNew(value)}
              className="w-full text-left px-3.5 py-2 hover:bg-indigo-50 transition-colors flex items-center justify-between group cursor-pointer bg-indigo-50/50"
            >
              <div className="flex items-center gap-2">
                {isAdding ? (
                  <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5 text-indigo-600" />
                )}
                <span className="text-xs font-bold text-indigo-700">
                  Tambah satuan baru &ldquo;{value.trim()}&rdquo;
                </span>
              </div>
              <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-100/70 px-2 py-0.5 rounded-full">
                Simpan ke Master
              </span>
            </button>
          )}

          {/* Existing Units Suggestions */}
          {filteredUnits.length > 0 ? (
            filteredUnits.map((u) => {
              const isSelected = value.trim().toLowerCase() === u.toLowerCase();
              return (
                <button
                  key={u}
                  type="button"
                  onClick={() => handleSelect(u)}
                  className={`w-full text-left px-3.5 py-2 hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer ${
                    isSelected ? 'bg-indigo-50/60 font-bold text-indigo-900' : 'text-slate-700 font-medium'
                  }`}
                >
                  <span className="text-xs">{u}</span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  )}
                </button>
              );
            })
          ) : (
            !value.trim() && (
              <div className="p-3 text-center text-xs text-slate-400">
                Ketik nama satuan...
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};
