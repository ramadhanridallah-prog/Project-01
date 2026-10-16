import React, { useRef, useState } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  FileDown,
  Cloud,
} from 'lucide-react';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileLoaded: (buffer: ArrayBuffer, fileName: string) => void;
  onDownloadTemplate: () => void;
  onOpenGoogleDrive?: () => void;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onFileLoaded,
  onDownloadTemplate,
  onOpenGoogleDrive,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessFile = (file: File) => {
    setError(null);
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExt = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExt) {
      setError('Format file tidak didukung. Harap unggah file .xlsx, .xls, atau .csv.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError('Ukuran file terlalu besar (maksimal 25MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (buffer) {
        onFileLoaded(buffer, file.name);
        onClose();
      } else {
        setError('Gagal membaca isi file.');
      }
    };
    reader.onerror = () => {
      setError('Terjadi kesalahan saat membaca file.');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Import File Excel / CSV</h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Auto-Save Aktif
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Unggah hasil timbang produk QC (.xlsx, .xls, .csv) — Tersimpan otomatis
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

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50/50'
                : 'border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100/70'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleProcessFile(e.target.files[0]);
                }
              }}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 mb-3 shadow-2xs">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              Tarik & Letakkan file Excel di sini atau <span className="text-emerald-600 underline">Klik untuk Pilih</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Mendukung format Microsoft Excel (.xlsx, .xls) dan Comma-Separated (.csv)
            </p>
          </div>

          {/* Or Import from Google Drive */}
          {onOpenGoogleDrive && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80 text-xs">
              <div className="flex items-center gap-2 text-indigo-950">
                <Cloud className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-semibold">Sinkronisasi & Impor Google Drive</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenGoogleDrive();
                }}
                className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <span>Buka Google Drive</span>
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Guidelines & Template Download */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Format Kolom yang Didukung Otomatis:
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownloadTemplate();
                }}
                className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Unduh Contoh Template</span>
              </button>
            </div>
            <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
              <li>
                <strong className="text-slate-800">Kode SKU & Produk:</strong> kolom "Kode SKU" (misal SKU-BCK-250) & "Nama Produk".
              </li>
              <li>
                <strong className="text-slate-800">Tanggal & Jam Sampling:</strong> kolom "Tanggal Sampling" (format <code>dd/mm/yy</code>) dan kolom "Jam Sampling" terpisah (<code>HH:mm:ss</code>).
              </li>
              <li>
                <strong className="text-slate-800">Berat Aktual & Standar Qn:</strong> kolom "Berat Aktual Netto (g)" dan "Standar Berat Qn (g)".
              </li>
              <li>
                <strong className="text-slate-800">Informasi Batch & Line:</strong> kolom "No Batch", "Line Produksi", "Berat Tara (g)".
              </li>
            </ul>
            <div className="pt-2 border-t border-slate-200 text-[10px] text-rose-700 font-semibold flex items-center gap-1.5">
              <span>⚠️ Kebijakan Validasi BDKT: Jika terdeteksi nilai berat tidak valid atau mismatch Master SKU, file otomatis ditolak dan harus diunggah ulang.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
