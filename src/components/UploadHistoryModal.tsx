import React, { useState } from 'react';
import {
  X,
  History,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Trash2,
  ArrowRight,
  Cloud,
  HardDrive,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  SavedUploadActivity,
  getSavedUploadActivities,
  deleteUploadActivity,
  clearAllUploadActivities,
} from '../services/autoSaveService';
import { BdktRecord } from '../types/bdkt';

interface UploadHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreActivity: (records: BdktRecord[], fileName: string) => void;
}

export const UploadHistoryModal: React.FC<UploadHistoryModalProps> = ({
  isOpen,
  onClose,
  onRestoreActivity,
}) => {
  const [activities, setActivities] = useState<SavedUploadActivity[]>(() =>
    getSavedUploadActivities()
  );
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const handleRefresh = () => {
    setActivities(getSavedUploadActivities());
  };

  const handleDelete = (id: string, fileName: string) => {
    if (window.confirm(`Hapus riwayat upload "${fileName}"?`)) {
      const updated = deleteUploadActivity(id);
      setActivities(updated);
    }
  };

  const handleClearAll = () => {
    if (
      window.confirm(
        'Hapus seluruh riwayat aktivitas upload yang tersimpan? Data sampel bawaan tetap ada.'
      )
    ) {
      clearAllUploadActivities();
      setActivities([]);
    }
  };

  const handleSelect = (activity: SavedUploadActivity) => {
    onRestoreActivity(activity.records, activity.fileName);
    onClose();
  };

  const filtered = activities.filter((a) => {
    const q = searchTerm.toLowerCase();
    return (
      a.fileName.toLowerCase().includes(q) ||
      a.productName.toLowerCase().includes(q) ||
      (a.skuCode && a.skuCode.toLowerCase().includes(q)) ||
      a.batchNo.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Riwayat Auto-Save Aktivitas Upload File
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {activities.length} File Tersimpan Otomatis
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Setiap aktivitas upload file Excel/CSV otomatis disimpan ke memori aplikasi & di-backup ke Google Drive.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-3 sm:p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama file, produk, SKU..."
              className="w-full bg-slate-50 text-xs text-slate-800 pl-8 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition font-medium cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Segarkan</span>
            </button>
            {activities.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition font-medium cursor-pointer border border-rose-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Semua</span>
              </button>
            )}
          </div>
        </div>

        {/* List of Saved Upload Activities */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-700">
                  {searchTerm
                    ? 'Tidak ada riwayat upload yang cocok dengan pencarian.'
                    : 'Belum ada aktivitas upload yang tersimpan.'}
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Setiap kali Anda mengunggah file hasil timbang Excel/CSV, data dan analisisnya akan otomatis tersimpan di sini sehingga Anda tidak perlu mengunggah ulang.
                </p>
              </div>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-xs transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                {/* Info File & Produk */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 font-mono">
                      {item.fileName}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      • {item.savedAtFormatted}
                    </span>
                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                        item.overallStatus === 'PASS'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : item.overallStatus === 'WARNING'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {item.overallStatus === 'PASS' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                      {item.overallStatus === 'WARNING' && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                      {item.overallStatus === 'FAIL' && <XCircle className="w-3 h-3 text-rose-600" />}
                      <span>{item.overallStatus === 'PASS' ? 'Memenuhi Syarat' : item.overallStatus === 'WARNING' ? 'Giveaway Tinggi' : 'Tidak Memenuhi Syarat'}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span className="font-bold text-slate-900">
                      {item.productName}
                    </span>
                    {item.skuCode && (
                      <span className="font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-[11px]">
                        SKU: {item.skuCode}
                      </span>
                    )}
                    <span className="font-mono text-slate-500">
                      Lot: {item.batchNo}
                    </span>
                    <span className="text-slate-500">
                      Standar: <strong>{item.nominalWeight} {item.unit}</strong>
                    </span>
                    <span className="text-slate-500">
                      Sampel: <strong>{item.totalRows} baris</strong>
                    </span>
                    <span className="text-slate-500">
                      Rata-rata: <strong>{item.averageWeight.toFixed(2)} {item.unit}</strong>
                    </span>
                  </div>

                  {/* Cloud status */}
                  <div className="flex items-center gap-2 pt-1 text-[11px]">
                    {item.cloudSynced ? (
                      <span className="inline-flex items-center gap-1 text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        <Cloud className="w-3 h-3 text-indigo-600" />
                        Tersimpan di Google Drive Cloud
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded">
                        <HardDrive className="w-3 h-3 text-slate-500" />
                        Tersimpan di Penyimpanan Lokal (Auto-Save)
                      </span>
                    )}

                    {item.t1Count > 0 && (
                      <span className="text-amber-700 font-semibold">
                        Cacat T1: {item.t1Count}
                      </span>
                    )}
                    {item.t2Count > 0 && (
                      <span className="text-rose-700 font-bold">
                        Cacat T2: {item.t2Count}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                  {item.cloudWebViewLink && (
                    <a
                      href={item.cloudWebViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"
                      title="Buka di Google Drive"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  <button
                    onClick={() => handleDelete(item.id, item.fileName)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                    title="Hapus riwayat ini"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleSelect(item)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
                  >
                    <span>Muat Data Ini</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Data tersimpan otomatis setiap kali file diunggah.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
