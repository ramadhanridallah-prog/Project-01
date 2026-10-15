import React, { useState } from 'react';
import {
  X,
  XCircle,
  AlertOctagon,
  Database,
  FileDown,
  Upload,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ValidationSummary } from '../types/masterData';

interface ValidationErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: ValidationSummary;
  fileName: string;
  onReUpload: () => void;
  onOpenMasterData?: () => void;
}

export const ValidationErrorModal: React.FC<ValidationErrorModalProps> = ({
  isOpen,
  onClose,
  summary,
  fileName,
  onReUpload,
  onOpenMasterData,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'MISMATCH'>('ALL');

  if (!isOpen) return null;

  const filteredErrors = summary.errors.filter((err) => {
    if (activeTab === 'CRITICAL') return err.severity === 'CRITICAL';
    if (activeTab === 'WARNING') return err.severity === 'WARNING';
    if (activeTab === 'MISMATCH') return err.errorType === 'STANDARD_MISMATCH';
    return true;
  });

  const mismatchCount = summary.errors.filter((e) => e.errorType === 'STANDARD_MISMATCH').length;

  const handleExportErrorLog = () => {
    const data = summary.errors.map((err) => ({
      'Baris Excel': err.rowNumber,
      'Kolom': err.columnName || '-',
      'Nilai Asli Input': err.inputValue !== undefined ? String(err.inputValue) : '-',
      'Tingkat Masalah': err.severity === 'CRITICAL' ? 'FATAL / CRITICAL' : 'PERINGATAN',
      'Tipe Masalah': err.errorType,
      'Kode SKU': err.sku || '-',
      'Nama Produk': err.productName || '-',
      'Nilai Standar Master': err.expectedValue !== undefined ? String(err.expectedValue) : '-',
      'Pesan Error': err.message,
      'Status Tindakan': 'File Ditolak (Harus Diperbaiki)',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Log Kesalahan Upload BDKT');
    XLSX.writeFile(wb, `Log_Penolakan_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-rose-300 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header with High-Contrast Rejection Notice */}
        <div className="p-4 sm:p-5 border-b border-rose-200 flex items-center justify-between bg-rose-50/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Upload Ditolak: Ditemukan Kesalahan Input BDKT
                </h2>
                <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-600 text-white shadow-2xs">
                  File Ditolak
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-300 font-mono">
                  {fileName}
                </span>
              </div>
              <p className="text-xs text-rose-800 font-medium mt-0.5">
                Standar pengujian BDKT mensyaratkan integritas data 100%. Data tidak dimuat untuk mencegah kesalahan analisis.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-rose-100 transition cursor-pointer"
            title="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mandatory Rejection Warning Banner */}
        <div className="p-4 bg-rose-100/70 border-b border-rose-200 flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-950 space-y-1">
            <p className="font-extrabold text-rose-900">
              Sistem menolak seluruh file ini demi menghindari kesalahan klik (*misclick*) dan kesalahan vonis kepatuhan BDKT.
            </p>
            <p className="text-rose-800 leading-relaxed">
              Opsi memproses baris valid dinonaktifkan. Silakan periksa rincian baris di bawah ini atau download log Excel, lakukan perbaikan pada spreadsheet Anda, lalu gunakan tombol <strong>"Upload Ulang File"</strong>.
            </p>
          </div>
        </div>

        {/* Summary Metric Counters */}
        <div className="p-4 sm:p-5 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 block">Total Baris File</span>
            <span className="text-xl font-black text-slate-900">{summary.totalRowsProcessed}</span>
          </div>

          <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
            <span className="text-[11px] font-bold text-rose-700 block">Status File</span>
            <span className="text-sm font-black text-rose-800 uppercase tracking-wide">DITOLAK TOTAL</span>
          </div>

          <div className="p-3 bg-rose-50/80 rounded-xl border border-rose-200">
            <span className="text-[11px] font-bold text-rose-700 block">Kesalahan Fatal (Nilai/Format)</span>
            <span className="text-xl font-black text-rose-800">{summary.criticalErrorsCount}</span>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
            <span className="text-[11px] font-bold text-amber-700 block">Mismatch Standar Master SKU</span>
            <span className="text-xl font-black text-amber-800">{mismatchCount}</span>
          </div>
        </div>

        {/* Tab Filter & Quick Actions */}
        <div className="px-5 py-2.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-rose-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Kesalahan ({summary.errors.length})
            </button>
            <button
              onClick={() => setActiveTab('CRITICAL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'CRITICAL'
                  ? 'bg-rose-700 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              Kesalahan Fatal ({summary.criticalErrorsCount})
            </button>
            <button
              onClick={() => setActiveTab('MISMATCH')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'MISMATCH'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Mismatch Master SKU ({mismatchCount})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {summary.errors.length > 0 && (
              <button
                onClick={handleExportErrorLog}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold transition cursor-pointer shadow-2xs text-[11px]"
                title="Download daftar baris error dalam format Excel untuk diperbaiki"
              >
                <FileDown className="w-3.5 h-3.5 text-rose-600" />
                <span>Download Log Error Excel</span>
              </button>
            )}

            {onOpenMasterData && (
              <button
                onClick={() => {
                  onClose();
                  onOpenMasterData();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold transition cursor-pointer shadow-2xs text-[11px]"
                title="Buka dan periksa Master Data SKU resmi"
              >
                <Database className="w-3.5 h-3.5 text-indigo-600" />
                <span>Cek Master SKU</span>
              </button>
            )}
          </div>
        </div>

        {/* Detailed Error Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {filteredErrors.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <span>Tidak ada catatan pada kategori filter ini.</span>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 w-16">Baris Excel</th>
                    <th className="py-2.5 px-3">Kolom</th>
                    <th className="py-2.5 px-3">Nilai Asli Input</th>
                    <th className="py-2.5 px-3">Jenis Masalah</th>
                    <th className="py-2.5 px-3">Keterangan Error & Konteks</th>
                    <th className="py-2.5 px-3 text-rose-700 font-bold">Status Penolakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredErrors.map((err, idx) => (
                    <tr
                      key={idx}
                      className={
                        err.severity === 'CRITICAL'
                          ? 'bg-rose-50/50 hover:bg-rose-50/80'
                          : 'bg-amber-50/40 hover:bg-amber-50/70'
                      }
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        #{err.rowNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 font-semibold">
                        {err.columnName || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-900 font-bold">
                        {err.inputValue !== undefined ? String(err.inputValue) : '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            err.severity === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {err.errorType === 'NON_NUMERIC_WEIGHT'
                            ? 'Bukan Angka'
                            : err.errorType === 'NEGATIVE_OR_ZERO_WEIGHT'
                            ? 'Nilai <= 0'
                            : err.errorType === 'STANDARD_MISMATCH'
                            ? 'Standar Qn Beda Master'
                            : err.errorType === 'SKU_NOT_FOUND'
                            ? 'SKU Tak Dikenal'
                            : err.errorType === 'EXTREME_OUTLIER'
                            ? 'Nilai Ekstrem'
                            : 'Baris Kosong'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 text-[11px] leading-relaxed">
                        {err.message}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] font-bold text-rose-700">
                        Ditolak (Wajib Perbaiki)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Actions: Strictly Re-Upload Only (to prevent misclicks) */}
        <div className="p-4 sm:p-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50">
          <div className="text-xs text-rose-800 font-semibold flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Seluruh file ditolak. Hanya tersedia opsi <strong>Upload Ulang</strong> untuk menghindari pemrosesan data yang salah.
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-xl transition cursor-pointer"
            >
              Tutup
            </button>

            {/* The single primary action: Re-upload */}
            <button
              onClick={() => {
                onClose();
                onReUpload();
              }}
              className="flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-md transition cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Ulang File BDKT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
