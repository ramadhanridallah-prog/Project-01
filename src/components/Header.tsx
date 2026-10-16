import React from 'react';
import {
  FileSpreadsheet,
  Download,
  FileDown,
  Calculator,
  Database,
  History,
  Cloud,
} from 'lucide-react';

interface HeaderProps {
  onOpenUpload: () => void;
  onDownloadTemplate: () => void;
  onExportReport: () => void;
  onOpenCalculator: () => void;
  onOpenMasterData: () => void;
  onOpenUploadHistory?: () => void;
  savedUploadCount?: number;
  onOpenGoogleDrive?: () => void;
  isDriveConnected?: boolean;
  realtimeStatus?: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
  onlineUsersCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenUpload,
  onDownloadTemplate,
  onExportReport,
  onOpenCalculator,
  onOpenMasterData,
  onOpenUploadHistory,
  savedUploadCount = 0,
  onOpenGoogleDrive,
  isDriveConnected,
  realtimeStatus = 'CONNECTED',
  onlineUsersCount = 1,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 text-slate-800 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-4">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base sm:text-xl tracking-tight text-slate-900 flex items-center gap-1.5">
                  BDKT <span className="text-emerald-600 font-black">MetricGuard</span>
                </h1>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Permendag 31/2011 & OIML R87
                </span>

                {/* Real-Time Live Status Indicator Badge */}
                <div
                  title={
                    realtimeStatus === 'CONNECTED'
                      ? `Real-Time Aktif: Sinkronisasi data multi-pengguna langsung (${onlineUsersCount} online)`
                      : realtimeStatus === 'CONNECTING'
                      ? 'Menyambungkan koneksi real-time ke server...'
                      : 'Koneksi real-time terputus (mencoba menyambung kembali)'
                  }
                  className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                    realtimeStatus === 'CONNECTED'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : realtimeStatus === 'CONNECTING'
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-slate-100 text-slate-600 border-slate-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      realtimeStatus === 'CONNECTED'
                        ? 'bg-emerald-500 animate-pulse'
                        : realtimeStatus === 'CONNECTING'
                        ? 'bg-amber-500 animate-ping'
                        : 'bg-slate-400'
                    }`}
                  />
                  <span>{realtimeStatus === 'CONNECTED' ? 'Real-Time' : 'Sync...'}</span>
                  {onlineUsersCount > 0 && (
                    <span className="px-1 py-0.2 rounded bg-white text-slate-700 font-mono text-[9px] border border-slate-200">
                      {onlineUsersCount} online
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Monitoring Gap Standar Berat BDKT & Toleransi Kuantitas Netto
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Auto-Save & Upload History Button */}
            {onOpenUploadHistory && (
              <button
                onClick={onOpenUploadHistory}
                title="Riwayat Auto-Save Aktivitas Upload File"
                className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-300 transition shadow-2xs cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <History className="w-3.5 h-3.5 text-emerald-600 sm:hidden" />
                <span className="hidden sm:inline">Riwayat Upload</span>
                {savedUploadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-mono font-bold">
                    {savedUploadCount}
                  </span>
                )}
              </button>
            )}

            {/* Master Data SKU Button */}
            <button
              onClick={onOpenMasterData}
              title="Kelola & Update Master Data SKU Resmi (Auto-Save Aktif)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition shadow-2xs cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Master Data SKU</span>
            </button>

            {/* Google Drive Status & Sync Button */}
            {onOpenGoogleDrive && (
              <button
                onClick={onOpenGoogleDrive}
                title={
                  isDriveConnected
                    ? 'Google Drive Terhubung (Auto-Save Cloud Aktif)'
                    : 'Hubungkan Google Drive untuk Auto-Save Cloud'
                }
                className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl border transition shadow-2xs cursor-pointer ${
                  isDriveConnected
                    ? 'text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
                    : 'text-slate-600 bg-slate-50 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <Cloud
                  className={`w-3.5 h-3.5 ${
                    isDriveConnected ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                />
                <span className="hidden lg:inline">
                  {isDriveConnected ? 'Drive Cloud' : 'Google Drive'}
                </span>
              </button>
            )}

            {/* BDKT Calculator Button */}
            <button
              onClick={onOpenCalculator}
              title="Kalkulator Batas Toleransi BDKT (Permendag RI)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition shadow-2xs cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Kalkulator</span>
            </button>

            {/* Template Download */}
            <button
              onClick={onDownloadTemplate}
              title="Download Template Format Excel BDKT"
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition shadow-2xs cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden md:inline">Template Excel</span>
            </button>

            {/* Import Local Excel */}
            <button
              onClick={onOpenUpload}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-sm shadow-emerald-700/20 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Import Excel</span>
            </button>

            {/* Export Report */}
            <button
              onClick={onExportReport}
              title="Ekspor Laporan Hasil Uji BDKT ke Excel"
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden xl:inline">Export Excel</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
