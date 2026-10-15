import React, { useMemo } from 'react';
import {
  Calendar,
  Filter,
  X,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Package,
  FileText,
  Info,
} from 'lucide-react';
import { BdktRecord } from '../types/bdkt';

export type PeriodFilterOption = 'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'CUSTOM';

export interface FilterState {
  period: PeriodFilterOption;
  startDate: string;
  endDate: string;
  status: 'ALL' | 'SESUAI' | 'TIDAK_SESUAI' | 'T1_ONLY' | 'T2_ONLY' | 'OVERFILL_ONLY';
  productName: string;
  lineOrShift: string;
  batchNo: string;
}

interface FilterBarProps {
  records: BdktRecord[];
  filterState: FilterState;
  onFilterChange: (newState: FilterState) => void;
  filteredCount: number;
  totalCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  records,
  filterState,
  onFilterChange,
  filteredCount,
  totalCount,
}) => {
  // Extract unique products with rich metadata
  const availableProducts = useMemo(() => {
    const map = new Map<
      string,
      {
        productName: string;
        count: number;
        nominalWeight: number;
        unit: string;
        productDescription?: string;
        skuCode?: string;
        category?: string;
      }
    >();

    records.forEach((r) => {
      if (!map.has(r.productName)) {
        map.set(r.productName, {
          productName: r.productName,
          count: 0,
          nominalWeight: r.nominalWeight,
          unit: r.unit,
          productDescription: r.productDescription,
          skuCode: r.skuCode,
          category: r.category,
        });
      }
      const item = map.get(r.productName)!;
      item.count += 1;
      if (!item.productDescription && r.productDescription) {
        item.productDescription = r.productDescription;
      }
      if (!item.skuCode && r.skuCode) {
        item.skuCode = r.skuCode;
      }
      if (!item.category && r.category) {
        item.category = r.category;
      }
    });

    return Array.from(map.values());
  }, [records]);

  // Extract unique lines/shifts and batches
  const availableLines = Array.from(
    new Set(records.map((r) => r.lineOrShift).filter(Boolean))
  ) as string[];

  const availableBatches = Array.from(
    new Set(records.map((r) => r.batchNo).filter(Boolean))
  ) as string[];

  const isFiltered =
    filterState.productName !== 'ALL' ||
    filterState.period !== 'ALL' ||
    filterState.status !== 'ALL' ||
    filterState.lineOrShift !== 'ALL' ||
    filterState.batchNo !== 'ALL' ||
    Boolean(filterState.startDate || filterState.endDate);

  const selectedProductInfo = availableProducts.find(
    (p) => p.productName === filterState.productName
  );

  const handleReset = () => {
    onFilterChange({
      period: 'ALL',
      startDate: '',
      endDate: '',
      status: 'ALL',
      productName: 'ALL',
      lineOrShift: 'ALL',
      batchNo: 'ALL',
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Filter Data Pengujian BDKT</h3>
            <p className="text-xs text-slate-500">
              Filter data berdasarkan periode tanggal, status kepatuhan, batch, dan line produksi
            </p>
          </div>
        </div>

        {/* Count & Reset */}
        <div className="flex items-center gap-2.5 text-xs">
          <span className="text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl font-medium border border-slate-200">
            Hasil: <strong className="text-slate-900 font-bold">{filteredCount}</strong> dari {totalCount} sampel
          </span>

          {isFiltered && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-xl font-semibold transition"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      </div>

      {/* Dropdown Filters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
        {/* Dropdown 1: Produk / SKU */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Package className="w-3 h-3 text-emerald-600" />
            <span>Produk / SKU:</span>
          </label>
          <div className="relative">
            <select
              value={filterState.productName}
              onChange={(e) =>
                onFilterChange({
                  ...filterState,
                  productName: e.target.value,
                })
              }
              className={`w-full text-xs font-semibold px-3 py-2 rounded-xl border transition cursor-pointer appearance-none pr-8 ${
                filterState.productName !== 'ALL'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-400 font-bold'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300'
              }`}
            >
              <option value="ALL">Semua Produk ({availableProducts.length})</option>
              {availableProducts.map((p) => (
                <option key={p.productName} value={p.productName}>
                  {p.productName} ({p.count} smp - {p.nominalWeight}{p.unit})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Dropdown 2: Periode Tanggal */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>Periode Waktu:</span>
          </label>
          <div className="relative">
            <select
              value={filterState.period}
              onChange={(e) =>
                onFilterChange({
                  ...filterState,
                  period: e.target.value as PeriodFilterOption,
                })
              }
              className="w-full bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition cursor-pointer appearance-none pr-8"
            >
              <option value="ALL">Semua Periode</option>
              <option value="TODAY">Hari Ini</option>
              <option value="LAST_7_DAYS">7 Hari Terakhir</option>
              <option value="LAST_30_DAYS">30 Hari Terakhir</option>
              <option value="CUSTOM">Pilih Tanggal Kustom...</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Dropdown 3: Status Kepatuhan */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-slate-400" />
            <span>Status Kepatuhan:</span>
          </label>
          <div className="relative">
            <select
              value={filterState.status}
              onChange={(e) =>
                onFilterChange({
                  ...filterState,
                  status: e.target.value as any,
                })
              }
              className="w-full bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition cursor-pointer appearance-none pr-8"
            >
              <option value="ALL">Semua Status Kepatuhan</option>
              <option value="SESUAI">Sesuai (Lolos Standar)</option>
              <option value="TIDAK_SESUAI">Tidak Sesuai (Defisien T1 & T2)</option>
              <option value="T1_ONLY">Hanya Cacat Toleransi T1</option>
              <option value="T2_ONLY">Hanya Pelanggaran Fatal T2</option>
              <option value="OVERFILL_ONLY">Hanya Overfill Tinggi</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Dropdown 4: Nomor Batch / Lot */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Layers className="w-3 h-3 text-slate-400" />
            <span>Nomor Batch / Lot:</span>
          </label>
          <div className="relative">
            <select
              value={filterState.batchNo}
              onChange={(e) =>
                onFilterChange({
                  ...filterState,
                  batchNo: e.target.value,
                })
              }
              className="w-full bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition cursor-pointer appearance-none pr-8 font-mono"
            >
              <option value="ALL">Semua Batch ({availableBatches.length})</option>
              {availableBatches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Dropdown 5: Line Produksi / Shift */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
            Line Produksi / Shift:
          </label>
          <div className="relative">
            <select
              value={filterState.lineOrShift}
              onChange={(e) =>
                onFilterChange({
                  ...filterState,
                  lineOrShift: e.target.value,
                })
              }
              className="w-full bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition cursor-pointer appearance-none pr-8"
            >
              <option value="ALL">Semua Line / Shift ({availableLines.length})</option>
              {availableLines.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Product Description & Specification Preview Banner (if filtered to a specific product) */}
      {selectedProductInfo && (
        <div className="p-3 sm:p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0 mt-0.5 shadow-2xs">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-emerald-950 text-sm">
                  {selectedProductInfo.productName}
                </span>
                {selectedProductInfo.skuCode && (
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-white border border-emerald-300 rounded text-emerald-800 shadow-2xs">
                    {selectedProductInfo.skuCode}
                  </span>
                )}
                {selectedProductInfo.category && (
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-200/70 rounded text-emerald-900">
                    {selectedProductInfo.category}
                  </span>
                )}
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-white border border-emerald-300 rounded text-slate-800 shadow-2xs">
                  Standar Qn: {selectedProductInfo.nominalWeight} {selectedProductInfo.unit}
                </span>
                <span className="text-[10px] text-slate-500">
                  ({selectedProductInfo.count} sampel pada dataset)
                </span>
              </div>
              <p className="text-[11px] text-emerald-900 mt-1 leading-relaxed">
                <strong className="text-emerald-950">Deskripsi & Spesifikasi Produk:</strong>{' '}
                {selectedProductInfo.productDescription ||
                  'Produk resmi BDKT pabrik. Toleransi kekurangan dan batas T1/T2 dihitung otomatis sesuai regulasi Permendag No. 31/2011.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => onFilterChange({ ...filterState, productName: 'ALL' })}
            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 px-3 py-1.5 bg-white hover:bg-emerald-100 rounded-lg border border-emerald-200 transition cursor-pointer shrink-0 shadow-2xs"
          >
            Tampilkan Semua Produk
          </button>
        </div>
      )}

      {/* Date Pickers for Custom Range */}
      {filterState.period === 'CUSTOM' && (
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center gap-3 animate-in fade-in duration-150">
          <span className="text-xs font-semibold text-slate-700">Rentang Tanggal Kustom:</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Dari:</span>
            <input
              type="date"
              value={filterState.startDate}
              onChange={(e) =>
                onFilterChange({
                  ...filterState,
                  startDate: e.target.value,
                })
              }
              className="bg-white border border-slate-300 text-slate-800 text-xs px-2.5 py-1.5 rounded-lg focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Sampai:</span>
            <input
              type="date"
              value={filterState.endDate}
              onChange={(e) =>
                onFilterChange({
                  ...filterState,
                  endDate: e.target.value,
                })
              }
              className="bg-white border border-slate-300 text-slate-800 text-xs px-2.5 py-1.5 rounded-lg focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};
