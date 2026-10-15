import React, { useRef, useState } from 'react';
import {
  X,
  Database,
  Upload,
  FileDown,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Layers,
} from 'lucide-react';
import { SkuMasterItem } from '../types/masterData';
import {
  parseMasterDataBuffer,
  downloadMasterDataTemplate,
  DEFAULT_MASTER_DATA,
} from '../services/masterDataService';

interface MasterDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterDataList: SkuMasterItem[];
  onUpdateMasterData: (newItems: SkuMasterItem[]) => void;
}

export const MasterDataModal: React.FC<MasterDataModalProps> = ({
  isOpen,
  onClose,
  masterDataList,
  onUpdateMasterData,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const filteredItems = masterDataList.filter((item) => {
    const q = searchTerm.toLowerCase();
    return (
      item.skuCode.toLowerCase().includes(q) ||
      item.productName.toLowerCase().includes(q) ||
      (item.category && item.category.toLowerCase().includes(q))
    );
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setSuccessMessage(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    setIsUploading(true);
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const newItems = parseMasterDataBuffer(buffer);
        onUpdateMasterData(newItems);
        setSuccessMessage(`Berhasil memperbarui Master Data! ${newItems.length} SKU telah tersimpan.`);
        setIsUploading(false);
      } catch (err: any) {
        console.error(err);
        setUploadError(err.message || 'Gagal memproses file Master Data.');
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      setUploadError('Gagal membaca file dari perangkat.');
      setIsUploading(false);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleResetToDefault = () => {
    if (window.confirm('Reset Master Data ke daftar SKU bawaan pabrik?')) {
      onUpdateMasterData(DEFAULT_MASTER_DATA);
      setSuccessMessage('Master Data berhasil di-reset ke pengaturan standar pabrik.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Manajemen Master Data SKU & Berat Standar BDKT</span>
                <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">
                  {masterDataList.length} SKU Terdaftar
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Pusat referensi standar nominal (Qn) resmi yang digunakan untuk memverifikasi file hasil timbang
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

        {/* Toolbar: Upload, Download Template, Reset, Search */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Upload & Template Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploading ? 'Memproses...' : 'Upload File Master Data'}</span>
              </button>

              <button
                onClick={downloadMasterDataTemplate}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-blue-600" />
                <span>Download Template Excel</span>
              </button>

              <button
                onClick={handleResetToDefault}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-rose-600 text-xs font-semibold rounded-xl border border-slate-200 transition cursor-pointer"
                title="Kembalikan ke master data bawaan"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Reset Default</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari kode SKU atau nama..."
                className="w-full bg-slate-50 text-xs text-slate-800 pl-8 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>

          {/* Alert Messages */}
          {uploadError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
              <button
                onClick={() => setSuccessMessage(null)}
                className="text-emerald-700 hover:text-emerald-900 font-bold"
              >
                Tutup
              </button>
            </div>
          )}
        </div>

        {/* Master Data Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Kode SKU</th>
                  <th className="py-2.5 px-3">Nama Produk Resmi</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3 text-right">Standar Qn</th>
                  <th className="py-2.5 px-3 text-right">Toleransi (T)</th>
                  <th className="py-2.5 px-3 text-center">Batas T1 / T2</th>
                  <th className="py-2.5 px-3 text-right">Tara Standar</th>
                  <th className="py-2.5 px-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Tidak ada data SKU yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                        {item.skuCode}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {item.productName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {item.category || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                        {item.nominalWeight} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-700 font-bold">
                        ±{item.tolerableDeficiency} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600">
                        <span className="text-amber-700">{item.t1Limit}</span> /{' '}
                        <span className="text-rose-700">{item.t2Limit} {item.unit}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                        {item.tareWeight ? `${item.tareWeight} g` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                        {item.notes || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 text-xs">
          <span className="text-slate-500">
            Perubahan Master Data otomatis disimpan di browser untuk validasi upload berikutnya.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-xl shadow-2xs transition cursor-pointer"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
