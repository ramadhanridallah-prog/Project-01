import { DriveFileItem } from '../types/bdkt';

/**
 * Mengambil daftar file spreadsheet/Excel dari Google Drive pengguna
 */
export async function listGoogleDriveFiles(
  accessToken: string,
  searchQuery?: string
): Promise<DriveFileItem[]> {
  try {
    let q = "trashed = false and (mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType = 'application/vnd.ms-excel' or mimeType = 'text/csv')";
    if (searchQuery && searchQuery.trim().length > 0) {
      const sanitized = searchQuery.replace(/'/g, "\\'");
      q += ` and name contains '${sanitized}'`;
    }

    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', q);
    url.searchParams.set('pageSize', '40');
    url.searchParams.set(
      'fields',
      'files(id, name, mimeType, modifiedTime, size, iconLink, webViewLink)'
    );
    url.searchParams.set('orderBy', 'modifiedTime desc');

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Sesi Google Drive telah berakhir. Silakan login kembali.');
      }
      const errJson = await response.json().catch(() => ({}));
      throw new Error(
        errJson?.error?.message || `Gagal mengambil data dari Google Drive (${response.status})`
      );
    }

    const data = await response.json();
    return (data.files || []) as DriveFileItem[];
  } catch (error: unknown) {
    console.error('Error listing Google Drive files:', error);
    throw error;
  }
}

/**
 * Mengunduh file dari Google Drive sebagai ArrayBuffer
 * Jika file adalah Google Sheets asli, diekspor otomatis sebagai file Excel .xlsx
 */
export async function downloadDriveFileAsArrayBuffer(
  accessToken: string,
  fileId: string,
  mimeType: string
): Promise<{ arrayBuffer: ArrayBuffer; isGoogleSheet: boolean }> {
  try {
    let downloadUrl: string;
    const isGoogleSheet = mimeType === 'application/vnd.google-apps.spreadsheet';

    if (isGoogleSheet) {
      // Export Google Sheet ke XLSX format
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
    } else {
      // Unduh binary file (.xlsx, .xls, .csv)
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    }

    const response = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Sesi login Google Drive kedaluwarsa. Silakan login ulang.');
      }
      throw new Error(`Gagal mengunduh file dari Google Drive (${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return { arrayBuffer, isGoogleSheet };
  } catch (error: unknown) {
    console.error('Error downloading Drive file:', error);
    throw error;
  }
}

export interface UploadDriveFileResult {
  id: string;
  name: string;
  webViewLink?: string;
  size?: string;
  createdTime?: string;
}

export interface SyncHistoryRecord {
  id: string;
  fileId: string;
  fileName: string;
  fileType: 'REPORT_EXCEL' | 'MASTER_DATA' | 'CUSTOM_EXPORT';
  timestamp: string;
  webViewLink?: string;
  recordCount: number;
  productName: string;
  status: 'SUCCESS' | 'FAILED';
  details?: string;
}

const SYNC_HISTORY_KEY = 'bdkt_drive_sync_history_v1';

export function getSyncHistory(): SyncHistoryRecord[] {
  try {
    const raw = localStorage.getItem(SYNC_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveSyncRecord(record: SyncHistoryRecord): void {
  try {
    const current = getSyncHistory();
    const updated = [record, ...current].slice(0, 30); // keep last 30 sync operations
    localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save sync record:', err);
  }
}

/**
 * Mencari atau membuat folder khusus "BDKT MetricGuard" di Google Drive pengguna
 */
export async function getOrCreateAppFolder(
  accessToken: string,
  folderName = 'BDKT MetricGuard Cloud'
): Promise<string | null> {
  try {
    // 1. Cek folder yang sudah ada
    const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName.replace(/'/g, "\\'")}' and trashed = false`;
    const checkUrl = new URL('https://www.googleapis.com/drive/v3/files');
    checkUrl.searchParams.set('q', query);
    checkUrl.searchParams.set('fields', 'files(id, name)');

    const res = await fetch(checkUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    // 2. Buat folder baru jika belum ada
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        description: 'Folder penyimpanan otomatis data laporan dan backup BDKT MetricGuard',
      }),
    });

    if (createRes.ok) {
      const folderData = await createRes.json();
      return folderData.id;
    }
    return null;
  } catch (err) {
    console.warn('Could not get or create app folder, saving in root directory:', err);
    return null;
  }
}

/**
 * Mengunggah file ke Google Drive menggunakan Multipart Upload
 */
export async function uploadFileToGoogleDrive(
  accessToken: string,
  fileName: string,
  blob: Blob,
  mimeType: string,
  description?: string,
  folderId?: string | null
): Promise<UploadDriveFileResult> {
  const metadata: Record<string, any> = {
    name: fileName,
    mimeType: mimeType,
    description: description || 'File pengujian kepatuhan BDKT MetricGuard',
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = '-------MetricGuardDriveSyncBoundary' + Math.random().toString(36).substring(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metaBlob = new Blob(
    [
      `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
        metadata
      )}\r\n${delimiter}Content-Type: ${mimeType}\r\n\r\n`,
    ],
    { type: 'text/plain' }
  );

  const closeBlob = new Blob([closeDelimiter], { type: 'text/plain' });

  const multipartBody = new Blob([metaBlob, blob, closeBlob], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const uploadUrl = new URL('https://www.googleapis.com/upload/drive/v3/files');
  uploadUrl.searchParams.set('uploadType', 'multipart');
  uploadUrl.searchParams.set('fields', 'id, name, webViewLink, size, createdTime');

  const response = await fetch(uploadUrl.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: multipartBody,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Sesi Google Drive telah berakhir. Silakan login ulang.');
    }
    const errJson = await response.json().catch(() => ({}));
    throw new Error(
      errJson?.error?.message || `Gagal mengunggah file ke Google Drive (Status: ${response.status})`
    );
  }

  const result = await response.json();
  return result as UploadDriveFileResult;
}
