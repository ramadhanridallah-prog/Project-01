import * as XLSX from 'xlsx';
import { BatchAnalysis, BdktRecord, ColumnMappingConfig } from '../types/bdkt';
import { evaluateSampleStatus } from './bdkt';
import {
  SkuMasterItem,
  DataValidationError,
  ValidationSummary,
} from '../types/masterData';
import { findMatchingSku } from '../services/masterDataService';

export interface ParseResult {
  records: BdktRecord[];
  sheets: string[];
  selectedSheet: string;
  detectedColumns: ColumnMappingConfig;
  availableColumns: string[];
  rawRows: Record<string, any>[];
  needsManualMapping: boolean;
  message?: string;
  validationSummary: ValidationSummary;
}

const NORMALIZE_STR = (str: string) =>
  String(str || '')
    .toLowerCase()
    .replace(/[_\s\-\.\/\(\)]/g, '');

/**
 * Otomatis mendeteksi pemetaan kolom berdasarkan nama header yang lazim
 */
export function autoDetectColumns(headers: string[]): ColumnMappingConfig {
  const config: ColumnMappingConfig = {
    actualWeightCol: '',
    nominalWeightCol: '',
    productNameCol: '',
    skuCodeCol: '',
    batchNoCol: '',
    lineCol: '',
    dateCol: '',
    sampleNoCol: '',
    tareWeightCol: '',
    grossWeightCol: '',
    unitCol: '',
  };

  for (const h of headers) {
    const clean = NORMALIZE_STR(h);

    // SKU Code
    if (
      !config.skuCodeCol &&
      (clean === 'sku' ||
        clean === 'kodesku' ||
        clean === 'skucode' ||
        clean === 'kodeproduk' ||
        clean === 'productcode' ||
        clean === 'barcode' ||
        clean === 'partnumber' ||
        clean.includes('kodesku') ||
        clean.includes('skucode'))
    ) {
      config.skuCodeCol = h;
    }

    // Actual Weight
    if (
      !config.actualWeightCol &&
      (clean.includes('aktual') ||
        clean.includes('actual') ||
        clean.includes('hasiltimbang') ||
        clean.includes('berataktual') ||
        clean.includes('nettoaktual') ||
        clean.includes('weighed') ||
        clean.includes('timbangan') ||
        clean === 'netto' ||
        clean === 'berat' ||
        clean === 'weight')
    ) {
      config.actualWeightCol = h;
    }

    // Nominal / Standard Qn
    if (
      !config.nominalWeightCol &&
      (clean.includes('standar') ||
        clean.includes('standard') ||
        clean.includes('nominal') ||
        clean.includes('target') ||
        clean.includes('qn') ||
        clean.includes('beratstandar') ||
        clean.includes('nettostandar') ||
        clean.includes('label'))
    ) {
      config.nominalWeightCol = h;
    }

    // Product Name (avoid capturing pure SKU column if already detected or clearly SKU)
    if (
      !config.productNameCol &&
      (clean.includes('produk') ||
        clean.includes('product') ||
        clean.includes('namaproduk') ||
        clean.includes('nama') ||
        clean.includes('item') ||
        clean.includes('barang') ||
        (clean.includes('sku') && !clean.includes('kodesku')))
    ) {
      // Don't assign to productName if this exact column is already skuCodeCol
      if (h !== config.skuCodeCol) {
        config.productNameCol = h;
      }
    }

    // Batch No
    if (
      !config.batchNoCol &&
      (clean.includes('batch') ||
        clean.includes('lot') ||
        clean.includes('nobatch') ||
        clean.includes('kodebatch') ||
        clean.includes('nolot'))
    ) {
      config.batchNoCol = h;
    }

    // Sample No
    if (
      !config.sampleNoCol &&
      (clean.includes('sample') ||
        clean.includes('sampel') ||
        clean.includes('nomor') ||
        clean === 'no' ||
        clean === 'id')
    ) {
      config.sampleNoCol = h;
    }

    // Line / Shift
    if (
      !config.lineCol &&
      (clean.includes('line') ||
        clean.includes('shift') ||
        clean.includes('mesin') ||
        clean.includes('operator') ||
        clean.includes('regu'))
    ) {
      config.lineCol = h;
    }

    // Date
    if (
      !config.dateCol &&
      (clean.includes('tanggal') ||
        clean.includes('date') ||
        clean.includes('waktu') ||
        clean.includes('time') ||
        clean.includes('jam'))
    ) {
      config.dateCol = h;
    }

    // Product Description / Notes / Specs
    if (
      !config.productDescriptionCol &&
      (clean.includes('deskripsi') ||
        clean.includes('description') ||
        clean.includes('keterangan') ||
        clean.includes('spesifikasi') ||
        clean.includes('spek') ||
        clean.includes('kemasan') ||
        clean === 'catatan' ||
        clean === 'notes')
    ) {
      config.productDescriptionCol = h;
    }

    // Tare / Gross
    if (!config.tareWeightCol && (clean.includes('tara') || clean.includes('tare'))) {
      config.tareWeightCol = h;
    }
    if (!config.grossWeightCol && (clean.includes('bruto') || clean.includes('gross'))) {
      config.grossWeightCol = h;
    }

    // Unit
    if (!config.unitCol && (clean.includes('unit') || clean.includes('satuan'))) {
      config.unitCol = h;
    }
  }

  // Fallback: jika belum ada actualWeightCol, coba cari kolom numerik pertama
  return config;
}

/**
 * Parsing ArrayBuffer (dari file upload lokal atau Google Drive)
 */
export function parseSpreadsheetBuffer(
  buffer: ArrayBuffer,
  targetSheetName?: string,
  customMapping?: ColumnMappingConfig,
  defaultNominalWeight: number = 250,
  masterDataList?: SkuMasterItem[]
): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheets = workbook.SheetNames;

  if (sheets.length === 0) {
    throw new Error('File spreadsheet tidak memiliki lembar kerja (worksheet).');
  }

  const selectedSheet = targetSheetName && sheets.includes(targetSheetName) ? targetSheetName : sheets[0];
  const worksheet = workbook.Sheets[selectedSheet];

  // Raw JSON conversion
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const emptyValidationSummary: ValidationSummary = {
    totalRowsProcessed: rawRows.length,
    validRowsCount: 0,
    criticalErrorsCount: 0,
    warningsCount: 0,
    errors: [],
    hasMasterDataMismatches: false,
    isRejected: rawRows.length === 0,
    rejectionReason: rawRows.length === 0 ? 'File kosong atau tidak memiliki data baris.' : undefined,
  };

  if (rawRows.length === 0) {
    return {
      records: [],
      sheets,
      selectedSheet,
      detectedColumns: { actualWeightCol: '' },
      availableColumns: [],
      rawRows: [],
      needsManualMapping: true,
      message: 'Lembar kerja kosong atau tidak memiliki data baris.',
      validationSummary: emptyValidationSummary,
    };
  }

  const availableColumns = Object.keys(rawRows[0] || {});
  const mapping = customMapping || autoDetectColumns(availableColumns);

  // Jika kolom berat aktual tidak ditemukan, minta pemetaan manual
  if (!mapping.actualWeightCol || !availableColumns.includes(mapping.actualWeightCol)) {
    return {
      records: [],
      sheets,
      selectedSheet,
      detectedColumns: mapping,
      availableColumns,
      rawRows,
      needsManualMapping: true,
      message: 'Kolom Berat Aktual tidak dapat dideteksi secara otomatis. Silakan pilih kolom.',
      validationSummary: emptyValidationSummary,
    };
  }

  // Validasi data dan konversi baris ke BdktRecord
  const records: BdktRecord[] = [];
  const validationErrors: DataValidationError[] = [];

  rawRows.forEach((row, index) => {
    const excelRowNumber = index + 2; // Baris 1 adalah header kolom

    // 1. Cek apakah seluruh baris kosong
    const isRowEmpty = Object.values(row).every(
      (val) => val === '' || val === null || val === undefined
    );
    if (isRowEmpty) {
      validationErrors.push({
        rowNumber: excelRowNumber,
        errorType: 'EMPTY_ROW',
        severity: 'WARNING',
        message: 'Baris kosong tanpa data ditemukan.',
        actionTaken: 'Baris dilewati otomatis',
      });
      return;
    }

    // 2. Parsing & Validasi Berat Aktual
    let actualWeight = NaN;
    const rawActualVal = mapping.actualWeightCol ? row[mapping.actualWeightCol] : undefined;

    if (rawActualVal !== undefined && String(rawActualVal).trim() !== '') {
      const sanitized = String(rawActualVal).replace(/,/g, '.').replace(/[^\d\.\-]/g, '');
      actualWeight = parseFloat(sanitized);
    }

    // Fallback perhitungan jika ada bruto & tara
    if (isNaN(actualWeight) || actualWeight <= 0) {
      if (mapping.grossWeightCol && mapping.tareWeightCol) {
        const rawGross = String(row[mapping.grossWeightCol] || '').replace(/,/g, '.');
        const rawTare = String(row[mapping.tareWeightCol] || '').replace(/,/g, '.');
        const gross = parseFloat(rawGross);
        const tare = parseFloat(rawTare);
        if (!isNaN(gross) && !isNaN(tare) && gross > tare && tare > 0) {
          actualWeight = gross - tare;
        }
      }
    }

    // Tangani error fatal berat aktual
    if (isNaN(actualWeight)) {
      validationErrors.push({
        rowNumber: excelRowNumber,
        columnName: mapping.actualWeightCol,
        inputValue: rawActualVal,
        errorType: 'NON_NUMERIC_WEIGHT',
        severity: 'CRITICAL',
        message: `Nilai berat aktual "${rawActualVal}" bukan angka numerik yang valid.`,
        actionTaken: 'Baris dilewati (tidak dapat dihitung)',
      });
      return; // Skip baris ini
    }

    if (actualWeight <= 0) {
      validationErrors.push({
        rowNumber: excelRowNumber,
        columnName: mapping.actualWeightCol,
        inputValue: actualWeight,
        errorType: 'NEGATIVE_OR_ZERO_WEIGHT',
        severity: 'CRITICAL',
        message: `Nilai berat aktual (${actualWeight}) tidak boleh bernilai nol atau negatif.`,
        actionTaken: 'Baris dilewati (tidak valid)',
      });
      return; // Skip baris ini
    }

    // 3. Parsing Nama Produk & SKU
    let productName = 'Produk Standar';
    if (mapping.productNameCol && row[mapping.productNameCol]) {
      productName = String(row[mapping.productNameCol]).trim();
    }
    let fileSkuCode = '';
    if (mapping.skuCodeCol && row[mapping.skuCodeCol]) {
      fileSkuCode = String(row[mapping.skuCodeCol]).trim();
    }

    // 4. Parsing Berat Standar Qn dari File
    let fileNominalWeight: number | null = null;
    if (mapping.nominalWeightCol && row[mapping.nominalWeightCol] !== undefined) {
      const sanitizedQn = String(row[mapping.nominalWeightCol]).replace(/,/g, '.').replace(/[^\d\.]/g, '');
      const parsedQn = parseFloat(sanitizedQn);
      if (!isNaN(parsedQn) && parsedQn > 0) {
        fileNominalWeight = parsedQn;
      }
    }

    // 5. Validasi Terhadap Master Data SKU
    let finalNominalWeight = fileNominalWeight ?? defaultNominalWeight;
    let matchedSku: SkuMasterItem | null = null;

    if (masterDataList && masterDataList.length > 0) {
      matchedSku = findMatchingSku(productName, masterDataList, fileSkuCode);

      if (matchedSku) {
        // Cek ketidakcocokan standar berat jika file mencantumkan Qn
        if (
          fileNominalWeight !== null &&
          Math.abs(fileNominalWeight - matchedSku.nominalWeight) > 0.01
        ) {
          validationErrors.push({
            rowNumber: excelRowNumber,
            columnName: mapping.nominalWeightCol || 'Standar Qn',
            inputValue: fileNominalWeight,
            sku: matchedSku.skuCode,
            productName: matchedSku.productName,
            expectedValue: matchedSku.nominalWeight,
            errorType: 'STANDARD_MISMATCH',
            severity: 'WARNING',
            message: `Ketidakcocokan standar berat: File mencantumkan ${fileNominalWeight}g, sedangkan Master Data SKU "${matchedSku.skuCode} - ${matchedSku.productName}" menetapkan standar resmi ${matchedSku.nominalWeight}g.`,
            actionTaken: `Otomatis diselaraskan ke standar Master Data resmi (${matchedSku.nominalWeight} ${matchedSku.unit})`,
          });
        }

        // Terapkan standar resmi dari Master Data
        finalNominalWeight = matchedSku.nominalWeight;
        productName = matchedSku.productName;
      } else if ((productName && productName !== 'Produk Standar') || fileSkuCode) {
        // SKU tidak ditemukan dalam Master Data
        const identifierLabel = fileSkuCode ? `SKU: ${fileSkuCode} (${productName})` : `"${productName}"`;
        validationErrors.push({
          rowNumber: excelRowNumber,
          columnName: mapping.skuCodeCol || mapping.productNameCol || 'SKU / Nama Produk',
          inputValue: fileSkuCode || productName,
          sku: fileSkuCode || undefined,
          productName,
          errorType: 'SKU_NOT_FOUND',
          severity: 'WARNING',
          message: `SKU / Produk ${identifierLabel} belum terdaftar dalam Master Data SKU pabrik.`,
          actionTaken: `Menggunakan standar berat ${finalNominalWeight}g`,
        });
      }
    }

    // 6. Validasi Nilai Ekstrem (Extreme Outlier)
    if (finalNominalWeight > 0) {
      if (actualWeight > finalNominalWeight * 5 || actualWeight < finalNominalWeight * 0.15) {
        validationErrors.push({
          rowNumber: excelRowNumber,
          columnName: mapping.actualWeightCol,
          inputValue: actualWeight,
          productName,
          expectedValue: `± ${finalNominalWeight}g`,
          errorType: 'EXTREME_OUTLIER',
          severity: 'WARNING',
          message: `Nilai berat (${actualWeight}g) sangat menyimpang dari standar nominal (${finalNominalWeight}g). Kemungkinan salah ketik skala atau unit timbangan.`,
          actionTaken: 'Tetap dimuat untuk verifikasi visual QC',
        });
      }
    }

    // 7. Parsing Properti Lainnya
    let batchNo = 'BATCH-001';
    if (mapping.batchNoCol && row[mapping.batchNoCol]) {
      batchNo = String(row[mapping.batchNoCol]).trim();
    }

    let sampleNo = index + 1;
    if (mapping.sampleNoCol && row[mapping.sampleNoCol]) {
      const parsedNo = parseInt(String(row[mapping.sampleNoCol]).replace(/[^\d]/g, ''), 10);
      if (!isNaN(parsedNo)) {
        sampleNo = parsedNo;
      }
    }

    let lineOrShift = 'Line 1';
    if (mapping.lineCol && row[mapping.lineCol]) {
      lineOrShift = String(row[mapping.lineCol]).trim();
    }

    let timestamp = new Date().toISOString().split('T')[0];
    if (mapping.dateCol && row[mapping.dateCol]) {
      timestamp = String(row[mapping.dateCol]).trim();
    }

    let unit = matchedSku?.unit || 'g';
    if (!matchedSku && mapping.unitCol && row[mapping.unitCol]) {
      unit = String(row[mapping.unitCol]).trim().toLowerCase();
    }

    // Product Description & Metadata
    let productDescription = '';
    if (mapping.productDescriptionCol && row[mapping.productDescriptionCol]) {
      productDescription = String(row[mapping.productDescriptionCol]).trim();
    }
    if (!productDescription && matchedSku) {
      productDescription = matchedSku.notes || (matchedSku.category ? `Kategori: ${matchedSku.category}` : '');
    }

    const skuCode = matchedSku?.skuCode || (fileSkuCode ? fileSkuCode : undefined);
    const category = matchedSku?.category;

    // Tare & Gross Weight
    let tareWeight: number | undefined = undefined;
    if (mapping.tareWeightCol && row[mapping.tareWeightCol] !== undefined) {
      const sanitizedTara = String(row[mapping.tareWeightCol]).replace(/,/g, '.').replace(/[^\d\.]/g, '');
      const parsedTara = parseFloat(sanitizedTara);
      if (!isNaN(parsedTara) && parsedTara > 0) tareWeight = Number(parsedTara.toFixed(2));
    }
    if (tareWeight === undefined && matchedSku?.tareWeight) {
      tareWeight = matchedSku.tareWeight;
    }

    let grossWeight: number | undefined = undefined;
    if (mapping.grossWeightCol && row[mapping.grossWeightCol] !== undefined) {
      const sanitizedBruto = String(row[mapping.grossWeightCol]).replace(/,/g, '.').replace(/[^\d\.]/g, '');
      const parsedBruto = parseFloat(sanitizedBruto);
      if (!isNaN(parsedBruto) && parsedBruto > 0) grossWeight = Number(parsedBruto.toFixed(2));
    }
    if (grossWeight === undefined) {
      const effectiveTare = tareWeight ?? (finalNominalWeight > 1000 ? 15 : finalNominalWeight > 200 ? 8.2 : 2.5);
      grossWeight = Number((actualWeight + effectiveTare).toFixed(2));
      if (tareWeight === undefined) tareWeight = effectiveTare;
    }

    // Evaluasi BDKT
    const evalResult = evaluateSampleStatus(actualWeight, finalNominalWeight);

    records.push({
      id: `sample-${index + 1}-${Date.now()}`,
      sampleNo,
      timestamp,
      productName,
      productDescription: productDescription || undefined,
      skuCode: skuCode || undefined,
      category: category || undefined,
      batchNo,
      lineOrShift,
      nominalWeight: finalNominalWeight,
      actualWeight: Number(actualWeight.toFixed(2)),
      tareWeight,
      grossWeight,
      unit,
      gap: evalResult.gap,
      gapPercent: evalResult.gapPercent,
      tolerableDeficiency: evalResult.t,
      t1Limit: evalResult.t1,
      t2Limit: evalResult.t2,
      status: evalResult.status,
    });
  });

  const criticalErrorsCount = validationErrors.filter((e) => e.severity === 'CRITICAL').length;
  const warningsCount = validationErrors.filter((e) => e.severity === 'WARNING').length;
  const hasMasterDataMismatches = validationErrors.some((e) => e.errorType === 'STANDARD_MISMATCH');
  const hasExtremeOutliers = validationErrors.some((e) => e.errorType === 'EXTREME_OUTLIER');

  // Kebijakan penolakan ketat BDKT: Bila ada kesalahan input atau mismatch master SKU, file langsung DITOLAK
  const isRejected = criticalErrorsCount > 0 || hasMasterDataMismatches || hasExtremeOutliers;
  let rejectionReason: string | undefined = undefined;
  if (isRejected) {
    if (criticalErrorsCount > 0) {
      rejectionReason = `File ditolak: Ditemukan ${criticalErrorsCount} baris dengan nilai bukan angka atau bernilai <= 0.`;
    } else if (hasMasterDataMismatches) {
      rejectionReason = `File ditolak: Standar berat (Qn) di file tidak sesuai dengan Master Data SKU resmi.`;
    } else if (hasExtremeOutliers) {
      rejectionReason = `File ditolak: Ditemukan nilai berat yang menyimpang drastis dari batas kewajaran produk.`;
    }
  }

  const validationSummary: ValidationSummary = {
    totalRowsProcessed: rawRows.length,
    validRowsCount: isRejected ? 0 : records.length,
    criticalErrorsCount,
    warningsCount,
    errors: validationErrors,
    hasMasterDataMismatches,
    isRejected,
    rejectionReason,
  };

  return {
    records,
    sheets,
    selectedSheet,
    detectedColumns: mapping,
    availableColumns,
    rawRows,
    needsManualMapping: records.length === 0,
    message: records.length === 0 ? 'Tidak ada baris data numerik berat yang valid ditemukan.' : undefined,
    validationSummary,
  };
}

/**
 * Membuat dan mengunduh Template Excel Standar BDKT
 */
export function downloadExcelTemplate(): void {
  const templateData = [
    {
      'No Sampel': 1,
      'Tanggal/Waktu': '2026-10-14 08:30',
      'Nama Produk': 'Biskuit Cokelat Krispi 250g',
      'Deskripsi Produk': 'Kemasan bantal pillow pack plastik metalized',
      'No Batch': 'BC-202610-A1',
      'Line Produksi': 'Line Packing 1',
      'Standar Berat Qn (g)': 250,
      'Berat Aktual Netto (g)': 252.4,
      'Berat Tara (g)': 8.2,
      'Berat Bruto (g)': 260.6,
      Satuan: 'g',
      'Catatan QC': 'Target terpenuhi, sedikit overfill',
    },
    {
      'No Sampel': 2,
      'Tanggal/Waktu': '2026-10-14 08:35',
      'Nama Produk': 'Biskuit Cokelat Krispi 250g',
      'Deskripsi Produk': 'Kemasan bantal pillow pack plastik metalized',
      'No Batch': 'BC-202610-A1',
      'Line Produksi': 'Line Packing 1',
      'Standar Berat Qn (g)': 250,
      'Berat Aktual Netto (g)': 249.8,
      'Berat Tara (g)': 8.1,
      'Berat Bruto (g)': 257.9,
      Satuan: 'g',
      'Catatan QC': 'Sesuai toleransi BDKT',
    },
    {
      'No Sampel': 3,
      'Tanggal/Waktu': '2026-10-14 08:40',
      'Nama Produk': 'Biskuit Cokelat Krispi 250g',
      'Deskripsi Produk': 'Kemasan bantal pillow pack plastik metalized',
      'No Batch': 'BC-202610-A1',
      'Line Produksi': 'Line Packing 1',
      'Standar Berat Qn (g)': 250,
      'Berat Aktual Netto (g)': 242.1,
      'Berat Tara (g)': 8.3,
      'Berat Bruto (g)': 250.4,
      Satuan: 'g',
      'Catatan QC': 'Cacat T1 (Di bawah batas 241g adalah T1)',
    },
    {
      'No Sampel': 4,
      'Tanggal/Waktu': '2026-10-14 08:45',
      'Nama Produk': 'Biskuit Cokelat Krispi 250g',
      'Deskripsi Produk': 'Kemasan bantal pillow pack plastik metalized',
      'No Batch': 'BC-202610-A1',
      'Line Produksi': 'Line Packing 1',
      'Standar Berat Qn (g)': 250,
      'Berat Aktual Netto (g)': 251.0,
      'Berat Tara (g)': 8.2,
      'Berat Bruto (g)': 259.2,
      Satuan: 'g',
      'Catatan QC': 'Normal',
    },
    {
      'No Sampel': 5,
      'Tanggal/Waktu': '2026-10-14 08:50',
      'Nama Produk': 'Biskuit Cokelat Krispi 250g',
      'Deskripsi Produk': 'Kemasan bantal pillow pack plastik metalized',
      'No Batch': 'BC-202610-A1',
      'Line Produksi': 'Line Packing 1',
      'Standar Berat Qn (g)': 250,
      'Berat Aktual Netto (g)': 250.5,
      'Berat Tara (g)': 8.2,
      'Berat Bruto (g)': 258.7,
      Satuan: 'g',
      'Catatan QC': 'Normal',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);

  // Styling column widths
  ws['!cols'] = [
    { wch: 10 },
    { wch: 18 },
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 8 },
    { wch: 32 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Uji BDKT');
  XLSX.writeFile(wb, 'Template_Uji_BDKT_Standar.xlsx');
}

export function buildAnalysisWorkbook(records: BdktRecord[], analysis: BatchAnalysis): XLSX.WorkBook {
  const summarySheetData = [
    ['LAPORAN ANALISIS KEPATUHAN BERAT BDKT (METROLOGI LEGAL)'],
    ['Regulasi: Permendag RI No. 31/M-DAG/PER/10/2011 & OIML R 87'],
    ['Tanggal Export:', new Date().toLocaleString('id-ID')],
    [],
    ['PARAMETER PENGUJIAN', 'NILAI', 'KETERANGAN'],
    ['Nama Produk', analysis.productName, analysis.productDescription ? `Deskripsi: ${analysis.productDescription}` : ''],
    ['Nomor Batch / Lot', analysis.batchNo, analysis.skuCode ? `SKU: ${analysis.skuCode}` : ''],
    ['Standar Nominal (Qn)', `${analysis.nominalWeight} ${analysis.unit}`, 'Kuantitas tercantum pada kemasan'],
    ['Toleransi Kekurangan (T)', `${analysis.tolerableDeficiency} ${analysis.unit}`, 'Batas toleransi maksimal diizinkan'],
    ['Batas Toleransi T1 (Qn - T)', `${analysis.t1Limit} ${analysis.unit}`, 'Maksimal 2.5% sampel boleh di rentang T1-T2'],
    ['Batas Kritis T2 (Qn - 2T)', `${analysis.t2Limit} ${analysis.unit}`, 'Zero tolerance: 0 sampel diizinkan'],
    [],
    ['HASIL STATISTIK', 'NILAI', 'EVALUASI METROLOGI'],
    ['Total Sampel Diuji', analysis.sampleCount, ''],
    ['Rata-rata Berat Aktual', `${analysis.averageActualWeight} ${analysis.unit}`, analysis.isAveragePassed ? 'LOLOS (>= Qn)' : 'TIDAK LOLOS (< Qn)'],
    ['Rata-rata Gap (Aktual - Qn)', `${analysis.averageGap >= 0 ? '+' : ''}${analysis.averageGap} ${analysis.unit}`, `${analysis.averageGapPercent.toFixed(2)}% dari standar`],
    ['Standar Deviasi (s)', `${analysis.stdDeviation} ${analysis.unit}`, 'Variabilitas proses pengisian'],
    ['Nilai Cpk (Kapabilitas)', analysis.cpk !== null ? analysis.cpk : 'N/A', analysis.cpk && analysis.cpk >= 1.33 ? 'Proses Sangat Mampu' : 'Perlu Kalibrasi'],
    ['Jumlah Sampel Cacat T1', `${analysis.t1Count} (${analysis.t1Percent}%)`, analysis.isT1Passed ? 'LOLOS (<= 2.5%)' : 'GAGAL (> 2.5%)'],
    ['Jumlah Pelanggaran Fatal T2', `${analysis.t2Count} (${analysis.t2Percent}%)`, analysis.isT2Passed ? 'LOLOS (Nol Pelanggaran)' : 'GAGAL KRITIS (Zero Tolerance)'],
    ['Sampel Overfill', `${analysis.overfillCount} (${analysis.overfillPercent}%)`, 'Potensi kerugian material pabrik'],
    ['Estimasi Biaya Giveaway (Overfill)', `Rp ${analysis.giveawayFinancialLoss.toLocaleString('id-ID')}`, `Total kelebihan: ${(analysis.totalGiveawayGrams / 1000).toFixed(2)} kg`],
    [],
    ['KESIMPULAN AKHIR BDKT:', analysis.overallStatus, analysis.statusMessage],
  ];

  const detailSheetData = records.map((r) => ({
    'No Sampel': r.sampleNo,
    'Tanggal/Waktu': r.timestamp || '-',
    'Kode SKU': r.skuCode || '-',
    'Nama Produk': r.productName,
    'Deskripsi Produk': r.productDescription || '-',
    'No Batch': r.batchNo,
    'Line / Shift': r.lineOrShift || '-',
    'Standar Qn (g)': r.nominalWeight,
    'Berat Tara (g)': r.tareWeight ?? '-',
    'Berat Bruto (g)': r.grossWeight ?? '-',
    'Berat Bersih/Aktual (g)': r.actualWeight,
    'Gap (g)': r.gap,
    '% Gap': `${r.gapPercent >= 0 ? '+' : ''}${r.gapPercent}%`,
    'Batas T1 (g)': r.t1Limit,
    'Batas T2 (g)': r.t2Limit,
    'Status BDKT':
      r.status === 'OK'
        ? 'Sesuai'
        : r.status === 'OVERFILL'
        ? 'Sesuai (Overfill)'
        : r.status === 'T1_DEFICIENT'
        ? 'Tidak Sesuai (Cacat T1)'
        : 'Tidak Sesuai (Fatal T2)',
  }));

  const wb = XLSX.utils.book_new();

  const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetData);
  wsSummary['!cols'] = [{ wch: 30 }, { wch: 24 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Kepatuhan BDKT');

  const wsDetail = XLSX.utils.json_to_sheet(detailSheetData);
  wsDetail['!cols'] = [
    { wch: 10 },
    { wch: 16 },
    { wch: 26 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Data Mentah Pengujian');

  return wb;
}

/**
 * Ekspor Hasil Analisis BDKT ke File Excel Lengkap (Download lokal)
 */
export function exportAnalysisToExcel(records: BdktRecord[], analysis: BatchAnalysis): void {
  const wb = buildAnalysisWorkbook(records, analysis);
  const sanitizedProd = analysis.productName.replace(/[^a-zA-Z0-9]/g, '_');
  XLSX.writeFile(wb, `Laporan_BDKT_${sanitizedProd}_${analysis.batchNo}.xlsx`);
}

/**
 * Menghasilkan Blob file Excel (.xlsx) untuk upload atau sinkronisasi ke cloud (Google Drive)
 */
export function generateAnalysisExcelBlob(records: BdktRecord[], analysis: BatchAnalysis): Blob {
  const wb = buildAnalysisWorkbook(records, analysis);
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
