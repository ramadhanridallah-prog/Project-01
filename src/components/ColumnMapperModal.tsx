import React, { useState } from 'react';
import { X, Check, Columns, AlertCircle } from 'lucide-react';
import { ColumnMappingConfig } from '../types/bdkt';

interface ColumnMapperModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheets: string[];
  selectedSheet: string;
  onSheetChange: (sheet: string) => void;
  availableColumns: string[];
  initialMapping: ColumnMappingConfig;
  previewRows: Record<string, any>[];
  onApplyMapping: (mapping: ColumnMappingConfig, defaultQn: number) => void;
}

export const ColumnMapperModal: React.FC<ColumnMapperModalProps> = ({
  isOpen,
  onClose,
  sheets,
  selectedSheet,
  onSheetChange,
  availableColumns,
  initialMapping,
  previewRows,
  onApplyMapping,
}) => {
  const [mapping, setMapping] = useState<ColumnMappingConfig>(initialMapping);
  const [defaultQn, setDefaultQn] = useState<number>(250);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApply = () => {
    if (!mapping.actualWeightCol) {
      setError('Kolom Berat Aktual wajib dipilih!');
      return;
    }
    setError(null);
    onApplyMapping(mapping, defaultQn);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
              <Columns className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Pemetaan Kolom Spreadsheet</h2>
              <p className="text-xs text-slate-500">
                Cocokkan kolom di file Anda dengan parameter analisis BDKT
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Sheet Selector (if multiple) */}
          {sheets.length > 1 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Pilih Worksheet / Tab:
              </label>
              <select
                value={selectedSheet}
                onChange={(e) => onSheetChange(e.target.value)}
                className="w-full bg-slate-50 text-xs text-slate-900 px-3 py-2 rounded-xl border border-slate-300 font-medium"
              >
                {sheets.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Grid of Mappings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Required: Actual Weight */}
            <div>
              <label className="block text-xs font-bold text-emerald-700 mb-1.5">
                Kolom Berat Aktual (Wajib) *
              </label>
              <select
                value={mapping.actualWeightCol || ''}
                onChange={(e) =>
                  setMapping({ ...mapping, actualWeightCol: e.target.value })
                }
                className="w-full bg-slate-50 text-xs text-slate-900 px-3 py-2 rounded-xl border border-emerald-500 focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                <option value="">-- Pilih Kolom Berat Aktual --</option>
                {availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            {/* Optional: Nominal Weight */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Kolom Standar Berat Qn (Opsional)
              </label>
              <select
                value={mapping.nominalWeightCol || ''}
                onChange={(e) =>
                  setMapping({ ...mapping, nominalWeightCol: e.target.value })
                }
                className="w-full bg-slate-50 text-xs text-slate-900 px-3 py-2 rounded-xl border border-slate-300 font-medium"
              >
                <option value="">-- Gunakan Nilai Standar Default di bawah --</option>
                {availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            {/* Default Qn fallback */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nilai Standar Qn Default (jika kolom kosong)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={defaultQn}
                  onChange={(e) => setDefaultQn(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 text-xs text-slate-900 px-3 py-2 rounded-xl border border-slate-300 font-medium"
                />
                <span className="text-xs text-slate-500 font-mono">gram</span>
              </div>
            </div>

            {/* SKU Code */}
            <div>
              <label className="block text-xs font-bold text-indigo-700 mb-1.5">
                Kolom Kode SKU (Opsional)
              </label>
              <select
                value={mapping.skuCodeCol || ''}
                onChange={(e) =>
                  setMapping({ ...mapping, skuCodeCol: e.target.value })
                }
                className="w-full bg-slate-50 text-xs text-slate-900 px-3 py-2 rounded-xl border border-slate-300 font-medium"
              >
                <option value="">-- Otomatis / Cari di Master Data --</option>
                {availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Kolom Nama Produk (Opsional)
              </label>
              <select
                value={mapping.productNameCol || ''}
                onChange={(e) =>
                  setMapping({ ...mapping, productNameCol: e.target.value })
                }
                className="w-full bg-slate-50 text-xs text-slate-900 px-3 py-2 rounded-xl border border-slate-300 font-medium"
              >
                <option value="">-- Otomatis --</option>
                {availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Kolom Deskripsi Produk (Opsional)
              </label>
              <select
                value={mapping.productDescriptionCol || ''}
                onChange={(e) =>
                  setMapping({ ...mapping, productDescriptionCol: e.target.value })
                }
                className="w-full bg-slate-50 text-xs text-slate-900 px-3 py-2 rounded-xl border border-slate-300 font-medium"
              >
                <option value="">-- Otomatis / Dari Master Data --</option>
                {availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            {/* Batch No */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Kolom No Batch / Lot (Opsional)
              </label>
              <select
                value={mapping.batchNoCol || ''}
                onChange={(e) =>
                  setMapping({ ...mapping, batchNoCol: e.target.value })
                }
                className="w-full bg-slate-50 text-xs text-slate-900 px-3 py-2 rounded-xl border border-slate-300 font-medium"
              >
                <option value="">-- Otomatis --</option>
                {availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            {/* Line / Shift */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Kolom Line Produksi / Shift (Opsional)
              </label>
              <select
                value={mapping.lineCol || ''}
                onChange={(e) =>
                  setMapping({ ...mapping, lineCol: e.target.value })
                }
                className="w-full bg-slate-50 text-xs text-slate-900 px-3 py-2 rounded-xl border border-slate-300 font-medium"
              >
                <option value="">-- Otomatis --</option>
                {availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            {/* Sampling Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Kolom Tanggal Sampling (dd/mm/yy)
              </label>
              <select
                value={mapping.dateCol || ''}
                onChange={(e) =>
                  setMapping({ ...mapping, dateCol: e.target.value })
                }
                className="w-full bg-slate-50 text-xs text-slate-900 px-3 py-2 rounded-xl border border-slate-300 font-medium"
              >
                <option value="">-- Otomatis --</option>
                {availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            {/* Sampling Time */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Kolom Jam Sampling (Terpisah)
              </label>
              <select
                value={mapping.timeCol || ''}
                onChange={(e) =>
                  setMapping({ ...mapping, timeCol: e.target.value })
                }
                className="w-full bg-slate-50 text-xs text-slate-900 px-3 py-2 rounded-xl border border-slate-300 font-medium"
              >
                <option value="">-- Otomatis / Dari Tanggal --</option>
                {availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Data Preview */}
          {previewRows.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200">
              <span className="text-xs font-bold text-slate-700 block mb-2">
                Pratinjau 3 Baris Data Teratas:
              </span>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-[11px] text-slate-700">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      {availableColumns.slice(0, 6).map((c) => (
                        <th key={c} className="py-2 px-3 whitespace-nowrap">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.slice(0, 3).map((r, i) => (
                      <tr key={i}>
                        {availableColumns.slice(0, 6).map((c) => (
                          <td key={c} className="py-1.5 px-3 whitespace-nowrap font-mono">
                            {String(r[c] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-xl cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Terapkan Pemetaan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
