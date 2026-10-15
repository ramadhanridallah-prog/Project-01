import { BdktRecord, BatchAnalysis } from '../types/bdkt';
import { generateAnalysisExcelBlob } from '../utils/excelParser';
import {
  uploadFileToGoogleDrive,
  getOrCreateAppFolder,
  saveSyncRecord,
  SyncHistoryRecord,
} from './googleDrive';

export interface SavedUploadActivity {
  id: string;
  fileName: string;
  savedAt: string;
  savedAtFormatted: string;
  productName: string;
  skuCode?: string;
  batchNo: string;
  totalRows: number;
  validRows: number;
  nominalWeight: number;
  averageWeight: number;
  unit: string;
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  complianceStatus: string;
  t1Count: number;
  t2Count: number;
  records: BdktRecord[];
  cloudSynced: boolean;
  cloudFileId?: string;
  cloudWebViewLink?: string;
}

export interface ActiveDatasetSnapshot {
  fileName: string;
  savedAt: string;
  records: BdktRecord[];
  sampleId: string;
  costPerKg: number;
  autoSaved: boolean;
}

export interface AutoSaveSettings {
  autoSaveEnabled: boolean;
  cloudAutoSaveEnabled: boolean;
  lastUploadAutoSavedAt?: string;
  lastMasterDataAutoSavedAt?: string;
}

const ACTIVE_DATASET_KEY = 'bdkt_active_dataset_v1';
const UPLOAD_ACTIVITIES_KEY = 'bdkt_upload_activities_v1';
const AUTOSAVE_SETTINGS_KEY = 'bdkt_autosave_settings_v1';

/**
 * Menyimpan dataset aktif saat ini ke penyimpanan lokal (Auto-Save)
 */
export function saveActiveDataset(
  fileName: string,
  records: BdktRecord[],
  sampleId: string = 'custom',
  costPerKg: number = 25000
): void {
  try {
    const snapshot: ActiveDatasetSnapshot = {
      fileName,
      savedAt: new Date().toISOString(),
      records,
      sampleId,
      costPerKg,
      autoSaved: true,
    };
    localStorage.setItem(ACTIVE_DATASET_KEY, JSON.stringify(snapshot));
    recordLastUploadAutoSave();
  } catch (err) {
    console.error('Failed to auto-save active dataset:', err);
  }
}

/**
 * Memuat dataset aktif yang tersimpan otomatis
 */
export function loadActiveDataset(): ActiveDatasetSnapshot | null {
  try {
    const raw = localStorage.getItem(ACTIVE_DATASET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.records) && parsed.records.length > 0) {
      return parsed as ActiveDatasetSnapshot;
    }
  } catch (err) {
    console.error('Failed to load active auto-saved dataset:', err);
  }
  return null;
}

/**
 * Menghapus dataset aktif (misal saat pengguna memilih reset ke contoh sampel)
 */
export function clearActiveDataset(): void {
  try {
    localStorage.removeItem(ACTIVE_DATASET_KEY);
  } catch (err) {
    console.error('Failed to clear active dataset:', err);
  }
}

/**
 * Mengambil riwayat seluruh aktivitas upload yang tersimpan otomatis
 */
export function getSavedUploadActivities(): SavedUploadActivity[] {
  try {
    const raw = localStorage.getItem(UPLOAD_ACTIVITIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Mencatat dan menyimpan otomatis aktivitas upload baru ke riwayat
 */
export function saveUploadActivity(
  fileName: string,
  records: BdktRecord[],
  analysis: BatchAnalysis,
  cloudResult?: { fileId: string; webViewLink?: string }
): SavedUploadActivity {
  const now = new Date();
  const dateFormatted = now.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const overallSimple: 'PASS' | 'FAIL' | 'WARNING' =
    analysis.overallStatus === 'PASS'
      ? 'PASS'
      : analysis.overallStatus === 'WARNING_GIVEAWAY'
      ? 'WARNING'
      : 'FAIL';

  const newActivity: SavedUploadActivity = {
    id: `upload_${now.getTime()}_${Math.random().toString(36).substring(2, 7)}`,
    fileName,
    savedAt: now.toISOString(),
    savedAtFormatted: dateFormatted,
    productName: analysis.productName || 'Produk BDKT',
    skuCode: analysis.skuCode,
    batchNo: analysis.batchNo || 'Lot',
    totalRows: records.length,
    validRows: records.length,
    nominalWeight: analysis.nominalWeight,
    averageWeight: analysis.averageActualWeight,
    unit: analysis.unit || 'g',
    overallStatus: overallSimple,
    complianceStatus: analysis.statusMessage,
    t1Count: analysis.t1Count,
    t2Count: analysis.t2Count,
    records,
    cloudSynced: Boolean(cloudResult?.fileId),
    cloudFileId: cloudResult?.fileId,
    cloudWebViewLink: cloudResult?.webViewLink,
  };

  try {
    const current = getSavedUploadActivities();
    // Keep up to 30 most recent uploads
    const updated = [newActivity, ...current.filter((a) => a.id !== newActivity.id)].slice(0, 30);
    localStorage.setItem(UPLOAD_ACTIVITIES_KEY, JSON.stringify(updated));
    recordLastUploadAutoSave();
  } catch (err) {
    console.error('Failed to save upload activity:', err);
  }

  return newActivity;
}

/**
 * Memperbarui status sinkronisasi cloud pada aktivitas upload yang sudah ada
 */
export function updateUploadActivityCloudSync(
  activityId: string,
  fileId: string,
  webViewLink?: string
): void {
  try {
    const list = getSavedUploadActivities();
    const idx = list.findIndex((a) => a.id === activityId);
    if (idx !== -1) {
      list[idx].cloudSynced = true;
      list[idx].cloudFileId = fileId;
      list[idx].cloudWebViewLink = webViewLink;
      localStorage.setItem(UPLOAD_ACTIVITIES_KEY, JSON.stringify(list));
    }
  } catch (err) {
    console.error('Failed to update upload activity sync status:', err);
  }
}

/**
 * Menghapus satu item dari riwayat aktivitas upload
 */
export function deleteUploadActivity(id: string): SavedUploadActivity[] {
  try {
    const current = getSavedUploadActivities();
    const updated = current.filter((item) => item.id !== id);
    localStorage.setItem(UPLOAD_ACTIVITIES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Menghapus seluruh riwayat aktivitas upload
 */
export function clearAllUploadActivities(): void {
  try {
    localStorage.removeItem(UPLOAD_ACTIVITIES_KEY);
  } catch (err) {
    console.error('Failed to clear upload activities:', err);
  }
}

/**
 * Auto-Save upload ke Google Drive di latar belakang
 */
export async function autoSaveUploadToGoogleDrive(
  accessToken: string,
  fileName: string,
  records: BdktRecord[],
  analysis: BatchAnalysis
): Promise<{ fileId: string; webViewLink?: string }> {
  try {
    const sanitizedProd = (analysis.productName || 'BDKT').replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedBatch = (analysis.batchNo || 'LOT').replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const driveFileName = `AutoSave_${sanitizedProd}_${sanitizedBatch}_${dateStr}.xlsx`;

    // Generate Excel Blob
    const excelBlob = generateAnalysisExcelBlob(records, analysis);

    // Get or create App folder
    const appFolderId = await getOrCreateAppFolder(accessToken, 'BDKT MetricGuard Cloud');

    // Upload to Drive
    const uploadRes = await uploadFileToGoogleDrive(
      accessToken,
      driveFileName,
      excelBlob,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      `Auto-Save Laporan Uji BDKT dari file "${fileName}" (${records.length} data)`,
      appFolderId
    );

    // Record in sync history
    const historyItem: SyncHistoryRecord = {
      id: 'sync_auto_' + Date.now(),
      fileId: uploadRes.id,
      fileName: uploadRes.name,
      fileType: 'REPORT_EXCEL',
      timestamp: new Date().toLocaleString('id-ID'),
      webViewLink: uploadRes.webViewLink,
      recordCount: records.length,
      productName: analysis.productName || 'BDKT',
      status: 'SUCCESS',
      details: `Auto-Save otomatis dari upload file: ${fileName}`,
    };
    saveSyncRecord(historyItem);

    return {
      fileId: uploadRes.id,
      webViewLink: uploadRes.webViewLink,
    };
  } catch (err) {
    console.error('Error during auto-save to Google Drive:', err);
    throw err;
  }
}

/**
 * Pengaturan Auto-Save
 */
export function getAutoSaveSettings(): AutoSaveSettings {
  try {
    const raw = localStorage.getItem(AUTOSAVE_SETTINGS_KEY);
    if (!raw) {
      return {
        autoSaveEnabled: true,
        cloudAutoSaveEnabled: true,
      };
    }
    return JSON.parse(raw);
  } catch {
    return {
      autoSaveEnabled: true,
      cloudAutoSaveEnabled: true,
    };
  }
}

export function updateAutoSaveSettings(settings: Partial<AutoSaveSettings>): AutoSaveSettings {
  const current = getAutoSaveSettings();
  const updated = { ...current, ...settings };
  try {
    localStorage.setItem(AUTOSAVE_SETTINGS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update autosave settings:', err);
  }
  return updated;
}

function recordLastUploadAutoSave() {
  updateAutoSaveSettings({
    lastUploadAutoSavedAt: new Date().toISOString(),
  });
}

export function recordLastMasterDataAutoSave() {
  updateAutoSaveSettings({
    lastMasterDataAutoSavedAt: new Date().toISOString(),
  });
}
