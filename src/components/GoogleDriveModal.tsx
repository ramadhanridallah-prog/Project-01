import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  FileSpreadsheet,
  Search,
  RefreshCw,
  Download,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  UploadCloud,
  History,
  FileText,
  Database,
  ArrowRight,
  Folder,
  LogOut,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { DriveFileItem, BdktRecord, BatchAnalysis } from '../types/bdkt';
import { SkuMasterItem } from '../types/masterData';
import {
  listGoogleDriveFiles,
  downloadDriveFileAsArrayBuffer,
  uploadFileToGoogleDrive,
  getOrCreateAppFolder,
  getSyncHistory,
  saveSyncRecord,
  SyncHistoryRecord,
} from '../services/googleDrive';
import { generateAnalysisExcelBlob } from '../utils/excelParser';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken: string | null;
  currentUser: User | null;
  onSignInGoogle: () => Promise<void>;
  onSignOutGoogle: () => Promise<void>;
  records: BdktRecord[];
  analysis: BatchAnalysis;
  masterDataList: SkuMasterItem[];
  onFileImported: (buffer: ArrayBuffer, fileName: string) => void;
  initialTab?: 'SYNC_UPLOAD' | 'IMPORT_BROWSER' | 'HISTORY';
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  accessToken,
  currentUser,
  onSignInGoogle,
  onSignOutGoogle,
  records,
  analysis,
  masterDataList,
  onFileImported,
  initialTab = 'SYNC_UPLOAD',
}) => {
  const [activeTab, setActiveTab] = useState<'SYNC_UPLOAD' | 'IMPORT_BROWSER' | 'HISTORY'>(initialTab);

  // Sync state
  const [syncType, setSyncType] = useState<'REPORT_EXCEL' | 'MASTER_DATA'>('REPORT_EXCEL');
  const [customFileName, setCustomFileName] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<{
    fileName: string;
    webViewLink?: string;
    fileId: string;
  } | null>(null);
  const [syncConfirmationOpen, setSyncConfirmationOpen] = useState(false);

  // File Browser (Import) state
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  // Sync History state
  const [historyList, setHistoryList] = useState<SyncHistoryRecord[]>(() => getSyncHistory());

  // Error & Status state
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Initialize file name when modal opens or dataset changes
  useEffect(() => {
    if (isOpen) {
      const sanitizedProd = (analysis.productName || 'BDKT').replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      setCustomFileName(`Laporan_BDKT_${sanitizedProd}_${analysis.batchNo || 'Lot'}_${dateStr}.xlsx`);
      setSyncSuccess(null);
      setError(null);
      setSyncConfirmationOpen(false);
      setHistoryList(getSyncHistory());
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, analysis, initialTab]);

  // Fetch Drive files when import tab is active
  const fetchFiles = async () => {
    if (!accessToken) return;
    setIsLoadingFiles(true);
    setError(null);
    try {
      const items = await listGoogleDriveFiles(accessToken, searchQuery);
      setFiles(items);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Gagal memuat daftar file dari Google Drive.');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (isOpen && accessToken && activeTab === 'IMPORT_BROWSER') {
      fetchFiles();
    }
  }, [isOpen, accessToken, activeTab]);

  // Handle Google Sign In
  const handleSignIn = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      await onSignInGoogle();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Gagal masuk dengan akun Google.');
    } finally {
      setIsSigningIn(false);
    }
  };

  // Handle Google Sign Out
  const handleSignOut = async () => {
    try {
      await onSignOutGoogle();
      setFiles([]);
      setSyncSuccess(null);
    } catch (err: any) {
      console.error(err);
      setError('Gagal keluar dari akun Google.');
    }
  };

  // Step 1: Trigger confirmation dialog for sync
  const handleRequestSync = () => {
    setError(null);
    if (!accessToken) {
      setError('Silakan hubungkan akun Google Drive terlebih dahulu.');
      return;
    }
    setSyncConfirmationOpen(true);
  };

  // Step 2: User explicitly confirms saving data to Google Drive
  const handleExecuteSync = async () => {
    setSyncConfirmationOpen(false);
    if (!accessToken) return;

    setIsSyncing(true);
    setError(null);
    setSyncSuccess(null);

    try {
      let fileNameToUse = customFileName.trim();
      let blobToUpload: Blob;
      let recordCount = 0;
      let targetProduct = analysis.productName || 'BDKT';

      if (syncType === 'REPORT_EXCEL') {
        if (!fileNameToUse.toLowerCase().endsWith('.xlsx')) {
          fileNameToUse += '.xlsx';
        }
        blobToUpload = generateAnalysisExcelBlob(records, analysis);
        recordCount = records.length;
      } else {
        // Master Data SKU Backup
        if (!fileNameToUse.toLowerCase().endsWith('.json') && !fileNameToUse.toLowerCase().endsWith('.xlsx')) {
          fileNameToUse = `MasterData_SKU_BDKT_${new Date().toISOString().split('T')[0]}.json`;
        }
        const masterJson = JSON.stringify(masterDataList, null, 2);
        blobToUpload = new Blob([masterJson], { type: 'application/json' });
        recordCount = masterDataList.length;
        targetProduct = 'Master Data SKU';
      }

      // Check or create application folder in Google Drive
      const appFolderId = await getOrCreateAppFolder(accessToken, 'BDKT MetricGuard Cloud');

      // Upload file to Google Drive
      const uploadRes = await uploadFileToGoogleDrive(
        accessToken,
        fileNameToUse,
        blobToUpload,
        syncType === 'REPORT_EXCEL'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/json',
        `Hasil sinkronisasi data kepatuhan BDKT (${recordCount} baris data)`,
        appFolderId
      );

      // Save to sync history
      const historyItem: SyncHistoryRecord = {
        id: 'sync_' + Date.now(),
        fileId: uploadRes.id,
        fileName: uploadRes.name,
        fileType: syncType,
        timestamp: new Date().toLocaleString('id-ID'),
        webViewLink: uploadRes.webViewLink,
        recordCount,
        productName: targetProduct,
        status: 'SUCCESS',
      };
      saveSyncRecord(historyItem);
      setHistoryList(getSyncHistory());

      setSyncSuccess({
        fileName: uploadRes.name,
        webViewLink: uploadRes.webViewLink,
        fileId: uploadRes.id,
      });
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Terjadi kesalahan saat menyinkronkan data ke Google Drive.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Import file from Google Drive into application
  const handleSelectFile = async (file: DriveFileItem) => {
    if (!accessToken) return;
    setIsDownloading(file.id);
    setError(null);

    try {
      const { arrayBuffer } = await downloadDriveFileAsArrayBuffer(
        accessToken,
        file.id,
        file.mimeType
      );
      onFileImported(arrayBuffer, file.name);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Gagal mengunduh file dari Google Drive.');
    } finally {
      setIsDownloading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shadow-2xs">
              <Cloud className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  Sinkronisasi Google Drive
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Cloud Sync
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Simpan laporan pengujian & impor file spreadsheet langsung dari Google Drive
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account Authentication Banner */}
        <div className="px-5 py-3 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {currentUser && accessToken ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2.5 min-w-0">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Google User'}
                    className="w-7 h-7 rounded-full border border-indigo-200 shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                    {currentUser.email ? currentUser.email.charAt(0).toUpperCase() : 'G'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">
                    {currentUser.displayName || currentUser.email}
                  </p>
                  <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Google Drive Terhubung
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
              >
                <LogOut className="w-3 h-3" />
                <span>Keluar</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
              <span className="text-slate-500">
                Akun Google Drive belum terhubung. Masuk untuk menyinkronkan data.
              </span>
              {/* Official Google Material Sign In Button */}
              <button
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="gsi-material-button shrink-0 shadow-2xs hover:shadow-xs"
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {isSigningIn ? 'Menghubungkan...' : 'Sign in with Google'}
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/60 px-5 pt-2 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('SYNC_UPLOAD')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'SYNC_UPLOAD'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Simpan ke Google Drive</span>
          </button>
          <button
            onClick={() => setActiveTab('IMPORT_BROWSER')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'IMPORT_BROWSER'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Impor dari Google Drive</span>
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Riwayat Sinkronisasi</span>
            {historyList.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                {historyList.length}
              </span>
            )}
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* TAB 1: SYNC / UPLOAD TO GOOGLE DRIVE */}
          {activeTab === 'SYNC_UPLOAD' && (
            <div className="space-y-4">
              {/* Success Result Box */}
              {syncSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-emerald-900">
                          Sinkronisasi Berhasil!
                        </h4>
                        <p className="text-xs text-emerald-700">
                          File telah tersimpan dengan aman di folder Google Drive Anda.
                        </p>
                      </div>
                    </div>
                    {syncSuccess.webViewLink && (
                      <a
                        href={syncSuccess.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white text-emerald-700 border border-emerald-300 rounded-xl shadow-2xs hover:bg-emerald-100 transition"
                      >
                        <span>Buka di Google Drive</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  <div className="text-[11px] bg-white/70 rounded-lg p-2 font-mono text-slate-700 border border-emerald-100">
                    Nama File: <strong>{syncSuccess.fileName}</strong>
                  </div>
                </div>
              )}

              {/* Data Summary to Sync */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Data Pengujian BDKT Saat Ini</span>
                  </h3>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                      analysis.overallStatus === 'PASS' || analysis.overallStatus === 'WARNING_GIVEAWAY'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    Evaluasi: {analysis.overallStatus === 'PASS' ? 'MEMENUHI SYARAT' : analysis.overallStatus === 'WARNING_GIVEAWAY' ? 'LOLOS (GIVEAWAY)' : 'TIDAK SESUAI'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-medium">Produk</span>
                    <strong className="text-slate-800 truncate block font-bold">
                      {analysis.productName}
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-medium">Batch / Lot</span>
                    <strong className="text-slate-800 font-bold block">{analysis.batchNo}</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-medium">Total Sampel</span>
                    <strong className="text-slate-800 font-bold block">{records.length} baris</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-medium">Standar Qn</span>
                    <strong className="text-slate-800 font-bold block">
                      {analysis.nominalWeight} {analysis.unit}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Sync Configuration */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Pilihan Data yang Disinkronkan:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSyncType('REPORT_EXCEL')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition cursor-pointer ${
                        syncType === 'REPORT_EXCEL'
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-1 ring-indigo-500'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-xs block font-bold">
                          Laporan Lengkap Excel (.xlsx)
                        </strong>
                        <span className="text-[11px] text-slate-500 leading-tight block">
                          Ringkasan metrologi, evaluasi T1/T2, dan data mentah timbang.
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSyncType('MASTER_DATA')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition cursor-pointer ${
                        syncType === 'MASTER_DATA'
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-1 ring-indigo-500'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <Database className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-xs block font-bold">
                          Backup Master Data SKU ({masterDataList.length})
                        </strong>
                        <span className="text-[11px] text-slate-500 leading-tight block">
                          Cadangan standar SKU, Qn, batas T1/T2, dan deskripsi produk.
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama File di Google Drive:
                  </label>
                  <input
                    type="text"
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    placeholder="Nama file laporan di Google Drive..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Target Folder Badge */}
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-[11px]">
                  <Folder className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    Disimpan otomatis ke folder: <strong className="text-slate-800">"BDKT MetricGuard Cloud"</strong> di Google Drive Anda.
                  </span>
                </div>
              </div>

              {/* Sync Action Button */}
              <div className="pt-2">
                <button
                  onClick={handleRequestSync}
                  disabled={isSyncing || !accessToken}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm rounded-xl transition shadow-md cursor-pointer"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan ke Google Drive...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Singkronkan Sekarang ke Google Drive</span>
                    </>
                  )}
                </button>
                {!accessToken && (
                  <p className="text-[11px] text-center text-slate-500 mt-2">
                    *Harap login ke Google Drive terlebih dahulu melalui tombol di bagian atas modal.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT BROWSER */}
          {activeTab === 'IMPORT_BROWSER' && (
            <div className="space-y-4">
              {!accessToken ? (
                <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">
                    Hubungkan Akun Google Drive
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Silakan masuk dengan akun Google untuk melihat dan mengimpor file spreadsheet dari Google Drive Anda dengan izin Anda.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={handleSignIn}
                      disabled={isSigningIn}
                      className="gsi-material-button shadow-2xs"
                    >
                      <div className="gsi-material-button-state"></div>
                      <div className="gsi-material-button-content-wrapper">
                        <div className="gsi-material-button-icon">
                          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                            <path fill="none" d="M0 0h48v48H0z"></path>
                          </svg>
                        </div>
                        <span className="gsi-material-button-contents">Sign in with Google</span>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Search and Refresh */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchFiles()}
                        placeholder="Cari file spreadsheet di Google Drive..."
                        className="w-full bg-slate-50 text-xs text-slate-900 pl-8 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      onClick={fetchFiles}
                      disabled={isLoadingFiles}
                      title="Segarkan daftar file"
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-300 transition cursor-pointer"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {/* Files List */}
                  {isLoadingFiles ? (
                    <div className="py-14 text-center text-slate-400 flex flex-col items-center justify-center">
                      <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin mb-2" />
                      <span className="text-xs">Memuat file dari Google Drive...</span>
                    </div>
                  ) : files.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      Tidak ada file spreadsheet (.xlsx, .xls, .csv, Google Sheets) yang ditemukan di Drive.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-72 overflow-y-auto">
                      {files.map((file) => {
                        const isSheet = file.mimeType === 'application/vnd.google-apps.spreadsheet';
                        const isProcessing = isDownloading === file.id;

                        return (
                          <div
                            key={file.id}
                            className="p-3 hover:bg-slate-50 transition flex items-center justify-between gap-3 group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  isSheet
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                    : 'bg-blue-50 text-blue-600 border border-blue-200'
                                }`}
                              >
                                <FileSpreadsheet className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600">
                                  {file.name}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                  <span>{isSheet ? 'Google Sheets' : 'File Excel'}</span>
                                  {file.modifiedTime && (
                                    <>
                                      <span>•</span>
                                      <span>
                                        {new Date(file.modifiedTime).toLocaleDateString('id-ID', {
                                          day: 'numeric',
                                          month: 'short',
                                          year: 'numeric',
                                        })}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleSelectFile(file)}
                              disabled={isProcessing}
                              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition shadow-2xs cursor-pointer"
                            >
                              {isProcessing ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Mengimpor...</span>
                                </>
                              ) : (
                                <>
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Impor ke Aplikasi</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SYNC HISTORY */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-3">
              {historyList.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Belum ada riwayat sinkronisasi data ke Google Drive.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-80 overflow-y-auto">
                  {historyList.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 hover:bg-slate-50 transition flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {item.fileName}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span>{item.timestamp}</span>
                            <span>•</span>
                            <span>{item.recordCount} baris</span>
                            <span>•</span>
                            <span className="font-semibold text-slate-700">{item.productName}</span>
                          </div>
                        </div>
                      </div>

                      {item.webViewLink && (
                        <a
                          href={item.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                        >
                          <span>Buka Drive</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Explicit Confirmation Dialog (Mandatory user confirmation before mutating/creating files in Google Drive) */}
        {syncConfirmationOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Konfirmasi Sinkronisasi ke Google Drive
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Aplikasi akan menyimpan file berikut ke akun Google Drive Anda dengan izin Anda:
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nama File:</span>
                  <span className="font-bold text-slate-800">{customFileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tipe Konten:</span>
                  <span className="font-semibold text-slate-700">
                    {syncType === 'REPORT_EXCEL' ? 'Laporan BDKT (.xlsx)' : 'Master Data SKU (.json)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Jumlah Baris:</span>
                  <span className="font-semibold text-slate-700">
                    {syncType === 'REPORT_EXCEL' ? records.length : masterDataList.length} data
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setSyncConfirmationOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleExecuteSync}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Konfirmasi & Simpan</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
