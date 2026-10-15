import * as XLSX from 'xlsx';
import { SkuMasterItem } from '../types/masterData';
import { calculateTolerableDeficiency, getT1Limit, getT2Limit } from '../utils/bdkt';

const STORAGE_KEY = 'bdkt_master_data_v1';

export const DEFAULT_MASTER_DATA: SkuMasterItem[] = [
  {
    id: 'master-1',
    skuCode: 'SKU-KPB-100',
    productName: 'Kopi Bubuk Spesial 100g',
    category: 'Minuman Bubuk',
    nominalWeight: 100,
    unit: 'g',
    tareWeight: 2.5,
    tolerableDeficiency: 4.5,
    t1Limit: 95.5,
    t2Limit: 91.0,
    notes: 'Kemasan sachet aluminium foil',
    updatedAt: '2026-10-14',
  },
  {
    id: 'master-2',
    skuCode: 'SKU-BCK-250',
    productName: 'Biskuit Cokelat Krispi 250g',
    category: 'Biskuit & Snack',
    nominalWeight: 250,
    unit: 'g',
    tareWeight: 8.2,
    tolerableDeficiency: 9.0,
    t1Limit: 241.0,
    t2Limit: 232.0,
    notes: 'Kemasan bantal pillow pack',
    updatedAt: '2026-10-14',
  },
  {
    id: 'master-3',
    skuCode: 'SKU-MGS-920',
    productName: 'Minyak Goreng Sawit 1000ml (920g)',
    category: 'Minyak & Lemak',
    nominalWeight: 920,
    unit: 'g',
    tareWeight: 14.5,
    tolerableDeficiency: 15.0,
    t1Limit: 905.0,
    t2Limit: 890.0,
    notes: 'Standar density 0.92 g/ml',
    updatedAt: '2026-10-14',
  },
  {
    id: 'master-4',
    skuCode: 'SKU-UHT-200',
    productName: 'Susu Cair UHT Cokelat 200ml',
    category: 'Dairy & Susu',
    nominalWeight: 206,
    unit: 'g',
    tareWeight: 11.8,
    tolerableDeficiency: 9.0,
    t1Limit: 197.0,
    t2Limit: 188.0,
    notes: 'Kemasan aseptic tetra pack',
    updatedAt: '2026-10-14',
  },
  {
    id: 'master-5',
    skuCode: 'SKU-GLP-1000',
    productName: 'Gula Pasir Kristal Putih 1000g',
    category: 'Bahan Pokok',
    nominalWeight: 1000,
    unit: 'g',
    tareWeight: 5.5,
    tolerableDeficiency: 15.0,
    t1Limit: 985.0,
    t2Limit: 970.0,
    notes: 'Kemasan polybag standing',
    updatedAt: '2026-10-14',
  },
  {
    id: 'master-6',
    skuCode: 'SKU-TPG-500',
    productName: 'Tepung Terigu Serbaguna 500g',
    category: 'Bahan Pokok',
    nominalWeight: 500,
    unit: 'g',
    tareWeight: 4.8,
    tolerableDeficiency: 15.0,
    t1Limit: 485.0,
    t2Limit: 470.0,
    notes: 'Kemasan plastik LLDPE',
    updatedAt: '2026-10-14',
  },
];

/**
 * Mengambil master data dari localStorage atau default
 */
export function loadMasterData(): SkuMasterItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading master data from localStorage:', err);
  }
  return DEFAULT_MASTER_DATA;
}

/**
 * Menyimpan master data ke localStorage (Auto-Save)
 */
export function saveMasterData(items: SkuMasterItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    try {
      const raw = localStorage.getItem('bdkt_autosave_settings_v1');
      const settings = raw ? JSON.parse(raw) : { autoSaveEnabled: true, cloudAutoSaveEnabled: true };
      settings.lastMasterDataAutoSavedAt = new Date().toISOString();
      localStorage.setItem('bdkt_autosave_settings_v1', JSON.stringify(settings));
    } catch {}
  } catch (err) {
    console.error('Error saving master data to localStorage:', err);
  }
}

/**
 * Mencari item Master Data berdasarkan Kode SKU atau Nama Produk
 * Mendukung pencarian eksplisit SKU dan Nama Produk sekaligus
 */
export function findMatchingSku(
  identifier: string,
  masterList: SkuMasterItem[],
  explicitSkuCode?: string
): SkuMasterItem | null {
  if (!masterList || masterList.length === 0) return null;

  // 1. Jika ada explicitSkuCode dari kolom SKU terpisah di file Excel
  if (explicitSkuCode && explicitSkuCode.trim().length > 0) {
    const cleanSku = explicitSkuCode.toLowerCase().replace(/[^a-z0-9]/g, '');
    const byExplicitSku = masterList.find(
      (m) => m.skuCode.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanSku
    );
    if (byExplicitSku) return byExplicitSku;
  }

  if (!identifier) return null;
  const clean = identifier.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 2. Exact or clean match by skuCode
  const byCode = masterList.find(
    (m) => m.skuCode.toLowerCase().replace(/[^a-z0-9]/g, '') === clean
  );
  if (byCode) return byCode;

  // 3. Exact or clean match by productName
  const byName = masterList.find(
    (m) => m.productName.toLowerCase().replace(/[^a-z0-9]/g, '') === clean
  );
  if (byName) return byName;

  // 4. Substring match
  const bySub = masterList.find(
    (m) =>
      clean.includes(m.skuCode.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
      clean.includes(m.productName.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
      m.productName.toLowerCase().replace(/[^a-z0-9]/g, '').includes(clean)
  );
  if (bySub) return bySub;

  return null;
}

/**
 * Auto-Save Master Data ke Google Drive di latar belakang jika terhubung
 */
export async function autoSaveMasterDataToGoogleDrive(
  accessToken: string,
  items: SkuMasterItem[]
): Promise<{ fileId: string; webViewLink?: string }> {
  const { uploadFileToGoogleDrive, getOrCreateAppFolder, saveSyncRecord } = await import(
    './googleDrive'
  );

  const fileName = `AutoSave_MasterData_SKU_BDKT_${new Date().toISOString().split('T')[0]}.json`;
  const jsonBlob = new Blob([JSON.stringify(items, null, 2)], {
    type: 'application/json',
  });

  const appFolderId = await getOrCreateAppFolder(accessToken, 'BDKT MetricGuard Cloud');
  const uploadRes = await uploadFileToGoogleDrive(
    accessToken,
    fileName,
    jsonBlob,
    'application/json',
    `Backup Auto-Save Master Data BDKT (${items.length} SKU terdaftar)`,
    appFolderId
  );

  saveSyncRecord({
    id: 'sync_md_' + Date.now(),
    fileId: uploadRes.id,
    fileName: uploadRes.name,
    fileType: 'MASTER_DATA',
    timestamp: new Date().toLocaleString('id-ID'),
    webViewLink: uploadRes.webViewLink,
    recordCount: items.length,
    productName: 'Master Data SKU',
    status: 'SUCCESS',
    details: 'Auto-Save otomatis sinkronisasi Master Data ke Google Drive',
  });

  return { fileId: uploadRes.id, webViewLink: uploadRes.webViewLink };
}

/**
 * Parse File Master Data yang diunggah pengguna (.xlsx, .xls, .csv)
 */
export function parseMasterDataBuffer(buffer: ArrayBuffer): SkuMasterItem[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (rows.length === 0) {
    throw new Error('File Master Data tidak memiliki baris data.');
  }

  const items: SkuMasterItem[] = [];

  rows.forEach((row, idx) => {
    // Cari kolom SKU
    const skuCode = String(
      row['Kode SKU'] ||
      row['SKU'] ||
      row['Kode Produk'] ||
      row['Code'] ||
      row['sku'] ||
      `SKU-${idx + 1}`
    ).trim();

    // Cari kolom Nama Produk
    const productName = String(
      row['Nama Produk'] ||
      row['Produk'] ||
      row['Product Name'] ||
      row['Item'] ||
      row['nama'] ||
      skuCode
    ).trim();

    // Cari kolom Standar Berat Qn
    const rawQn = String(
      row['Standar Berat Qn (g)'] ||
      row['Standar Qn'] ||
      row['Standar Berat'] ||
      row['Qn'] ||
      row['Target Berat'] ||
      row['Nominal'] ||
      '0'
    ).replace(/,/g, '.').replace(/[^\d\.]/g, '');

    const nominalWeight = parseFloat(rawQn);
    if (isNaN(nominalWeight) || nominalWeight <= 0) {
      return; // Abaikan jika standar berat tidak valid
    }

    // Satuan
    const unit = String(row['Satuan'] || row['Unit'] || 'g').trim().toLowerCase();

    // Berat Tara
    const rawTare = String(
      row['Berat Tara (g)'] ||
      row['Tara'] ||
      row['Tare'] ||
      '0'
    ).replace(/,/g, '.').replace(/[^\d\.]/g, '');
    const tareWeight = parseFloat(rawTare) || 0;

    // Kategori
    const category = String(row['Kategori'] || row['Category'] || 'Umum').trim();
    const notes = String(row['Catatan'] || row['Notes'] || '').trim();

    // Kalkulasi otomatis BDKT
    const t = calculateTolerableDeficiency(nominalWeight);
    const t1 = getT1Limit(nominalWeight, t);
    const t2 = getT2Limit(nominalWeight, t);

    items.push({
      id: `master-${Date.now()}-${idx + 1}`,
      skuCode,
      productName,
      category,
      nominalWeight,
      unit,
      tareWeight,
      tolerableDeficiency: t,
      t1Limit: t1,
      t2Limit: t2,
      notes,
      updatedAt: new Date().toISOString().split('T')[0],
    });
  });

  if (items.length === 0) {
    throw new Error('Tidak ditemukan data SKU dengan standar berat (Qn) yang valid.');
  }

  return items;
}

/**
 * Unduh Template File Master Data Excel
 */
export function downloadMasterDataTemplate(): void {
  const template = [
    {
      'Kode SKU': 'SKU-KPB-100',
      'Nama Produk': 'Kopi Bubuk Spesial 100g',
      Kategori: 'Minuman',
      'Standar Berat Qn (g)': 100,
      Satuan: 'g',
      'Berat Tara (g)': 2.5,
      Catatan: 'Kemasan foil sachet',
    },
    {
      'Kode SKU': 'SKU-BCK-250',
      'Nama Produk': 'Biskuit Cokelat Krispi 250g',
      Kategori: 'Makanan Ringan',
      'Standar Berat Qn (g)': 250,
      Satuan: 'g',
      'Berat Tara (g)': 8.2,
      Catatan: 'Kemasan bantal plastik',
    },
    {
      'Kode SKU': 'SKU-MGS-920',
      'Nama Produk': 'Minyak Goreng Sawit 1000ml (920g)',
      Kategori: 'Minyak',
      'Standar Berat Qn (g)': 920,
      Satuan: 'g',
      'Berat Tara (g)': 14.5,
      Catatan: 'Standar pouch 1 liter',
    },
    {
      'Kode SKU': 'SKU-UHT-200',
      'Nama Produk': 'Susu Cair UHT Cokelat 200ml',
      Kategori: 'Minuman Susu',
      'Standar Berat Qn (g)': 206,
      Satuan: 'g',
      'Berat Tara (g)': 11.8,
      Catatan: 'Tetra pack 200ml',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(template);
  ws['!cols'] = [
    { wch: 18 },
    { wch: 32 },
    { wch: 18 },
    { wch: 22 },
    { wch: 10 },
    { wch: 16 },
    { wch: 26 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Master Data SKU BDKT');
  XLSX.writeFile(wb, 'Template_Master_Data_SKU_BDKT.xlsx');
}
