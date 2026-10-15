import React, { useState, useMemo, useEffect } from 'react';
import {
  Activity,
  BarChart3,
  GitBranch,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Sparkles,
  Database,
  XCircle,
  AlertCircle,
  ArrowRight,
  Upload,
  Cloud,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { BatchAnalysis, BdktRecord, ColumnMappingConfig } from './types/bdkt';
import { evaluateBatchData } from './utils/bdkt';
import {
  parseSpreadsheetBuffer,
  downloadExcelTemplate,
  exportAnalysisToExcel,
} from './utils/excelParser';
import { SAMPLE_DATASETS, getSampleRecords } from './data/sampleData';
import { SkuMasterItem, ValidationSummary } from './types/masterData';
import { loadMasterData, saveMasterData } from './services/masterDataService';
import { initAuth, googleSignIn, logoutGoogle } from './services/firebaseAuth';

import { Header } from './components/Header';
import { FilterBar, FilterState } from './components/FilterBar';
import { MetricsCards } from './components/MetricsCards';
import { GapRunChart } from './components/GapRunChart';
import { DistributionHistogram } from './components/DistributionHistogram';
import { ProductComparisonChart } from './components/ProductComparisonChart';
import { DataTable } from './components/DataTable';
import { FileUploadModal } from './components/FileUploadModal';
import { BdktCalculatorModal } from './components/BdktCalculatorModal';
import { ColumnMapperModal } from './components/ColumnMapperModal';
import { GiveawaySection } from './components/GiveawaySection';
import { MasterDataModal } from './components/MasterDataModal';
import { ValidationErrorModal } from './components/ValidationErrorModal';
import { GoogleDriveModal } from './components/GoogleDriveModal';

export default function App() {
  // App dataset states
  const [selectedSampleId, setSelectedSampleId] = useState<string>('kopi-100g');
  const [records, setRecords] = useState<BdktRecord[]>(() => getSampleRecords('kopi-100g'));
  const [costPerKg, setCostPerKg] = useState<number>(25000); // Rp 25.000 / kg

  // Dropdown filter states
  const [filterState, setFilterState] = useState<FilterState>({
    period: 'ALL',
    startDate: '',
    endDate: '',
    status: 'ALL',
    productName: 'ALL',
    lineOrShift: 'ALL',
    batchNo: 'ALL',
  });

  // Active chart visualization tab
  const [activeTab, setActiveTab] = useState<'RUN_CHART' | 'DISTRIBUTION' | 'BREAKDOWN' | 'GIVEAWAY'>('RUN_CHART');

  // Master Data state
  const [masterDataList, setMasterDataList] = useState<SkuMasterItem[]>(() => loadMasterData());
  const [isMasterDataOpen, setIsMasterDataOpen] = useState(false);

  // Validation Error Modal & Summary states
  const [isValidationErrorOpen, setIsValidationErrorOpen] = useState(false);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [lastUploadedFileName, setLastUploadedFileName] = useState<string>('');

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isColumnMapperOpen, setIsColumnMapperOpen] = useState(false);
  const [isGoogleDriveOpen, setIsGoogleDriveOpen] = useState(false);
  const [googleDriveInitialTab, setGoogleDriveInitialTab] = useState<'SYNC_UPLOAD' | 'IMPORT_BROWSER' | 'HISTORY'>('SYNC_UPLOAD');

  // Google Drive & Firebase Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Initialize Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const handleSignInGoogle = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setCurrentUser(res.user);
        setAccessToken(res.accessToken);
        showToast(`Google Drive terhubung: ${res.user.email || 'Pengguna'}`, 'success');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Gagal menghubungkan Google Drive: ' + (err?.message || 'Error autentikasi'), 'error');
    }
  };

  const handleSignOutGoogle = async () => {
    try {
      await logoutGoogle();
      setCurrentUser(null);
      setAccessToken(null);
      showToast('Berhasil memutuskan koneksi Google Drive.', 'info');
    } catch (err: any) {
      console.error(err);
      showToast('Gagal keluar dari akun Google', 'error');
    }
  };

  // Buffer state for Column Mapper
  const [currentBuffer, setCurrentBuffer] = useState<ArrayBuffer | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [detectedMapping, setDetectedMapping] = useState<ColumnMappingConfig>({ actualWeightCol: '' });
  const [previewRows, setPreviewRows] = useState<Record<string, any>[]>([]);

  // Notification toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Update Master Data handler
  const handleUpdateMasterData = (newItems: SkuMasterItem[]) => {
    setMasterDataList(newItems);
    saveMasterData(newItems);
    showToast(`Master Data berhasil diperbarui (${newItems.length} SKU terdaftar)`, 'success');
  };

  // Filtered Records based on FilterBar Dropdown controls
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // 0. Product Filter
      if (filterState.productName !== 'ALL' && r.productName !== filterState.productName) {
        return false;
      }

      // 1. Status Filter
      if (filterState.status === 'SESUAI') {
        if (r.status !== 'OK' && r.status !== 'OVERFILL') return false;
      } else if (filterState.status === 'TIDAK_SESUAI') {
        if (r.status !== 'T1_DEFICIENT' && r.status !== 'T2_FAIL') return false;
      } else if (filterState.status === 'T1_ONLY') {
        if (r.status !== 'T1_DEFICIENT') return false;
      } else if (filterState.status === 'T2_ONLY') {
        if (r.status !== 'T2_FAIL') return false;
      } else if (filterState.status === 'OVERFILL_ONLY') {
        if (r.status !== 'OVERFILL') return false;
      }

      // 2. Line / Shift Filter
      if (filterState.lineOrShift !== 'ALL' && r.lineOrShift !== filterState.lineOrShift) {
        return false;
      }

      // 3. Batch Filter
      if (filterState.batchNo !== 'ALL' && r.batchNo !== filterState.batchNo) {
        return false;
      }

      // 4. Period / Date Filter
      if (r.timestamp) {
        const itemDateStr = r.timestamp.split(' ')[0]; // format YYYY-MM-DD
        const itemDate = new Date(itemDateStr);

        if (filterState.period === 'TODAY') {
          const todayStr = new Date().toISOString().split('T')[0];
          if (itemDateStr !== todayStr && itemDateStr !== '2026-10-14') return false;
        } else if (filterState.period === 'LAST_7_DAYS') {
          const now = new Date();
          const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 7 || diffDays < 0) return false;
        } else if (filterState.period === 'LAST_30_DAYS') {
          const now = new Date();
          const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 30 || diffDays < 0) return false;
        } else if (filterState.period === 'CUSTOM') {
          if (filterState.startDate && itemDateStr < filterState.startDate) return false;
          if (filterState.endDate && itemDateStr > filterState.endDate) return false;
        }
      }

      return true;
    });
  }, [records, filterState]);

  // Compute Batch Analysis dynamically from filtered records
  const analysis: BatchAnalysis = useMemo(() => {
    const targetDataset = filteredRecords.length > 0 ? filteredRecords : records;
    const prodName = targetDataset.length > 0 ? targetDataset[0].productName : 'Produk BDKT';
    const batch = targetDataset.length > 0 ? targetDataset[0].batchNo : 'BATCH-001';
    const unit = targetDataset.length > 0 ? targetDataset[0].unit : 'g';
    return evaluateBatchData(targetDataset, prodName, batch, unit, costPerKg);
  }, [filteredRecords, records, costPerKg]);

  // Handle sample selection change
  const handleSelectSample = (id: string) => {
    setSelectedSampleId(id);
    setFilterState((prev) => ({ ...prev, productName: 'ALL' }));
    if (id !== 'custom') {
      const data = getSampleRecords(id);
      setRecords(data);
      const meta = SAMPLE_DATASETS.find((d) => d.id === id);
      showToast(`Memuat data sampel: ${meta?.title}`, 'info');
    }
  };

  // Process Spreadsheet Buffer (from Upload)
  const handleSpreadsheetLoaded = (buffer: ArrayBuffer, fileName: string) => {
    try {
      setCurrentBuffer(buffer);
      setLastUploadedFileName(fileName);
      const parsed = parseSpreadsheetBuffer(buffer, undefined, undefined, 250, masterDataList);

      // Check if file is rejected or has input errors
      const hasErrors = parsed.validationSummary && (
        parsed.validationSummary.isRejected ||
        parsed.validationSummary.errors.length > 0 ||
        parsed.validationSummary.criticalErrorsCount > 0 ||
        parsed.validationSummary.hasMasterDataMismatches
      );

      if (hasErrors) {
        // ENFORCE STRICT REJECTION: Do NOT load flawed data into the system
        setValidationSummary(parsed.validationSummary);
        setIsValidationErrorOpen(true);
        showToast(
          `Upload DITOLAK: Ditemukan ${parsed.validationSummary.errors.length} kesalahan input data. File tidak dapat diproses. Hanya tersedia opsi Upload Ulang.`,
          'error'
        );
        return;
      }

      if (parsed.needsManualMapping || parsed.records.length === 0) {
        setSheets(parsed.sheets);
        setSelectedSheet(parsed.selectedSheet);
        setAvailableColumns(parsed.availableColumns);
        setDetectedMapping(parsed.detectedColumns);
        setPreviewRows(parsed.rawRows);
        setIsColumnMapperOpen(true);
      } else {
        // 100% clean data: load into records
        setRecords(parsed.records);
        setSelectedSampleId('custom');
        setValidationSummary(null);
        showToast(
          `Berhasil mengimpor ${parsed.records.length} data sampel dari ${fileName}! (100% Valid)`,
          'success'
        );
      }
    } catch (err: any) {
      console.error(err);
      showToast('Gagal memproses file: ' + (err.message || 'Format tidak valid'), 'error');
    }
  };

  // Apply Manual Column Mapping
  const handleApplyMapping = (mapping: ColumnMappingConfig, defaultQn: number) => {
    if (!currentBuffer) return;
    try {
      const parsed = parseSpreadsheetBuffer(currentBuffer, selectedSheet, mapping, defaultQn, masterDataList);
      const hasErrors = parsed.validationSummary && (
        parsed.validationSummary.isRejected ||
        parsed.validationSummary.errors.length > 0 ||
        parsed.validationSummary.criticalErrorsCount > 0 ||
        parsed.validationSummary.hasMasterDataMismatches
      );

      if (hasErrors) {
        // ENFORCE STRICT REJECTION
        setValidationSummary(parsed.validationSummary);
        setIsValidationErrorOpen(true);
        showToast(
          `Pemetaan DITOLAK: Ditemukan ${parsed.validationSummary.errors.length} kesalahan input. File tidak dapat diproses. Hanya tersedia opsi Upload Ulang.`,
          'error'
        );
        return;
      }

      if (parsed.records.length > 0) {
        setRecords(parsed.records);
        setSelectedSampleId('custom');
        setValidationSummary(null);
        showToast(`Berhasil memuat ${parsed.records.length} data dengan pemetaan kolom kustom!`, 'success');
      } else {
        showToast('Tidak ada data numerik yang valid pada kolom terpilih.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Gagal memproses data: ' + err.message, 'error');
    }
  };

  const handleSheetChange = (sheet: string) => {
    if (!currentBuffer) return;
    setSelectedSheet(sheet);
    const parsed = parseSpreadsheetBuffer(currentBuffer, sheet, undefined, 250, masterDataList);
    setAvailableColumns(parsed.availableColumns);
    setDetectedMapping(parsed.detectedColumns);
    setPreviewRows(parsed.rawRows);
  };

  // Download template
  const handleDownloadTemplate = () => {
    downloadExcelTemplate();
    showToast('Template Excel BDKT berhasil diunduh.', 'success');
  };

  // Export report
  const handleExportReport = () => {
    exportAnalysisToExcel(filteredRecords, analysis);
    showToast('Laporan Kepatuhan BDKT berhasil diekspor ke Excel.', 'success');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Navigation Header */}
      <Header
        onOpenUpload={() => setIsUploadOpen(true)}
        onDownloadTemplate={handleDownloadTemplate}
        onExportReport={handleExportReport}
        onOpenCalculator={() => setIsCalculatorOpen(true)}
        onOpenMasterData={() => setIsMasterDataOpen(true)}
        onOpenGoogleDrive={() => {
          setGoogleDriveInitialTab('SYNC_UPLOAD');
          setIsGoogleDriveOpen(true);
        }}
        isDriveConnected={Boolean(accessToken && currentUser)}
      />

      {/* Main Content Dashboard */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Toast Alert */}
        {toastMessage && (
          <div
            className={`p-3.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center justify-between gap-3 shadow-md animate-in slide-in-from-top duration-200 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : toastMessage.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-indigo-50 border-indigo-300 text-indigo-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600" />}
              {toastMessage.type === 'info' && <Info className="w-4 h-4 text-indigo-600" />}
              <span>{toastMessage.text}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Strict Rejection Notification Banner for File Input Mistakes & Master Data Discrepancies */}
        {validationSummary && validationSummary.errors.length > 0 && (
          <div className="rounded-2xl border border-rose-300 bg-rose-50/95 p-4 sm:p-5 shadow-xs transition animate-in fade-in duration-200 text-rose-950">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl shrink-0 shadow-2xs bg-rose-600 text-white">
                  <XCircle className="w-5 h-5" />
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-600 text-white shadow-2xs">
                      Upload File Ditolak
                    </span>
                    <h3 className="font-extrabold text-sm sm:text-base text-rose-950">
                      Terdeteksi Kesalahan Input Pembacaan Data BDKT
                    </h3>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white border border-rose-200 font-semibold text-slate-800">
                      {lastUploadedFileName || 'file_timbang.xlsx'}
                    </span>
                  </div>

                  <p className="text-xs text-rose-800 leading-relaxed max-w-3xl">
                    Seluruh file ditolak demi akurasi uji metrologi legal BDKT dan menghindari kesalahan klik (*misclick*). Data tidak dimasukkan ke dalam dashboard hingga file diperbaiki dan diunggah ulang.
                  </p>

                  {/* Summary badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-slate-800 shadow-2xs">
                      Total: {validationSummary.totalRowsProcessed} baris
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-300 font-mono">
                      ✕ 0 Baris Dimuat (Ditolak)
                    </span>
                    {validationSummary.criticalErrorsCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-rose-200 text-rose-900 border border-rose-300">
                        Kesalahan Fatal: {validationSummary.criticalErrorsCount}
                      </span>
                    )}
                    {validationSummary.errors.filter((e) => e.errorType === 'STANDARD_MISMATCH').length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-200 text-amber-900 border border-amber-300">
                        Mismatch Standar SKU: {validationSummary.errors.filter((e) => e.errorType === 'STANDARD_MISMATCH').length}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons: Only Upload Ulang & View Detail */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-sm transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Ulang File</span>
                </button>

                <button
                  onClick={() => setIsValidationErrorOpen(true)}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Detail Penolakan ({validationSummary.errors.length})</span>
                </button>

                {validationSummary.hasMasterDataMismatches && (
                  <button
                    onClick={() => setIsMasterDataOpen(true)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Cek Master SKU</span>
                  </button>
                )}

                <button
                  onClick={() => setValidationSummary(null)}
                  className="px-2.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-white/60 rounded-xl transition cursor-pointer"
                  title="Sembunyikan notifikasi ini"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Master Metrics & Compliance Banner */}
        <MetricsCards
          analysis={analysis}
          onCostPerKgChange={(cost) => setCostPerKg(cost)}
        />

        {/* Filter Bar with Period Filter & Dropdowns */}
        <FilterBar
          records={records}
          filterState={filterState}
          onFilterChange={(newState) => setFilterState(newState)}
          filteredCount={filteredRecords.length}
          totalCount={records.length}
        />

        {/* Visualization Tabs Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 text-xs shadow-2xs">
            <button
              onClick={() => setActiveTab('RUN_CHART')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold transition cursor-pointer ${
                activeTab === 'RUN_CHART'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Run Chart & Tren Underfill</span>
            </button>
            <button
              onClick={() => setActiveTab('DISTRIBUTION')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold transition cursor-pointer ${
                activeTab === 'DISTRIBUTION'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Distribusi Frekuensi (Histogram)</span>
            </button>
            <button
              onClick={() => setActiveTab('BREAKDOWN')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold transition cursor-pointer ${
                activeTab === 'BREAKDOWN'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              <span>Perbandingan Line / Batch</span>
            </button>
            <button
              onClick={() => setActiveTab('GIVEAWAY')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold transition cursor-pointer ${
                activeTab === 'GIVEAWAY'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Sub Giveaway (Qty & Harga)</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Terakhir diperbarui: {new Date().toLocaleTimeString('id-ID')}</span>
          </div>
        </div>

        {/* Active Visualization Chart / Section */}
        <div>
          {activeTab === 'RUN_CHART' && (
            <GapRunChart
              records={filteredRecords}
              analysis={analysis}
              onSelectProductFilter={(prod) =>
                setFilterState((prev) => ({ ...prev, productName: prod }))
              }
            />
          )}
          {activeTab === 'DISTRIBUTION' && (
            <DistributionHistogram records={filteredRecords} analysis={analysis} />
          )}
          {activeTab === 'BREAKDOWN' && (
            <ProductComparisonChart records={filteredRecords} />
          )}
          {activeTab === 'GIVEAWAY' && (
            <GiveawaySection
              records={filteredRecords}
              analysis={analysis}
              costPerKg={costPerKg}
              onCostPerKgChange={(cost) => setCostPerKg(cost)}
            />
          )}
        </div>


        {/* Detailed Records Table */}
        <DataTable records={filteredRecords} />

        {/* BDKT Legal Metrology Information Footer Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 text-xs text-slate-600 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Dasar Hukum & Standar Metrologi BDKT Republik Indonesia</span>
            </div>
            <p className="text-slate-600 max-w-3xl leading-relaxed">
              Pengujian Barang Dalam Keadaan Terbungkus (BDKT) diatur secara ketat oleh Kementerian Perdagangan RI (Permendag No. 31/M-DAG/PER/10/2011) yang mengadopsi rekomendasi internasional <strong>OIML R 87</strong> (Quantity of product in prepackages). Penerapan zero tolerance pada cacat T2 melindungi konsumen dari underfill dan melindungi produsen dari sanksi hukum.
            </p>
          </div>
          <button
            onClick={() => setIsCalculatorOpen(true)}
            className="shrink-0 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-emerald-700 border border-slate-300 font-bold rounded-xl transition cursor-pointer shadow-2xs"
          >
            Buka Kalkulator & Regulasi BDKT
          </button>
        </div>
      </main>

      {/* Modals */}
      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onFileLoaded={handleSpreadsheetLoaded}
        onDownloadTemplate={handleDownloadTemplate}
        onOpenGoogleDrive={() => {
          setGoogleDriveInitialTab('IMPORT_BROWSER');
          setIsGoogleDriveOpen(true);
        }}
      />

      <BdktCalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
      />

      <ColumnMapperModal
        isOpen={isColumnMapperOpen}
        onClose={() => setIsColumnMapperOpen(false)}
        sheets={sheets}
        selectedSheet={selectedSheet}
        onSheetChange={handleSheetChange}
        availableColumns={availableColumns}
        initialMapping={detectedMapping}
        previewRows={previewRows}
        onApplyMapping={handleApplyMapping}
      />

      {/* Master Data Management & Upload Modal */}
      <MasterDataModal
        isOpen={isMasterDataOpen}
        onClose={() => setIsMasterDataOpen(false)}
        masterDataList={masterDataList}
        onUpdateMasterData={handleUpdateMasterData}
      />

      {/* Input Error & Standard Mismatch Detail Modal */}
      <ValidationErrorModal
        isOpen={isValidationErrorOpen}
        onClose={() => setIsValidationErrorOpen(false)}
        summary={
          validationSummary || {
            totalRowsProcessed: 0,
            validRowsCount: 0,
            criticalErrorsCount: 0,
            warningsCount: 0,
            errors: [],
            hasMasterDataMismatches: false,
            isRejected: true,
          }
        }
        fileName={lastUploadedFileName || 'file_timbang.xlsx'}
        onReUpload={() => {
          setIsValidationErrorOpen(false);
          setIsUploadOpen(true);
        }}
        onOpenMasterData={() => setIsMasterDataOpen(true)}
      />

      {/* Google Drive Sync, Backup & Import Modal */}
      <GoogleDriveModal
        isOpen={isGoogleDriveOpen}
        onClose={() => setIsGoogleDriveOpen(false)}
        accessToken={accessToken}
        currentUser={currentUser}
        onSignInGoogle={handleSignInGoogle}
        onSignOutGoogle={handleSignOutGoogle}
        records={filteredRecords}
        analysis={analysis}
        masterDataList={masterDataList}
        onFileImported={handleSpreadsheetLoaded}
        initialTab={googleDriveInitialTab}
      />
    </div>
  );
}
