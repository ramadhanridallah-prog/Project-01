export interface SkuMasterItem {
  id: string;
  skuCode: string;
  productName: string;
  category?: string;
  nominalWeight: number; // Qn standar resmi (gram atau ml)
  unit: string; // 'g' | 'ml'
  tareWeight?: number; // gram
  tolerableDeficiency: number; // T (gram)
  t1Limit: number; // Qn - T
  t2Limit: number; // Qn - 2T
  notes?: string;
  updatedAt?: string;
}

export type ValidationErrorType =
  | 'NON_NUMERIC_WEIGHT'     // Berat aktual bukan angka numerik
  | 'NEGATIVE_OR_ZERO_WEIGHT' // Nilai berat aktual <= 0
  | 'EXTREME_OUTLIER'        // Berat sangat menyimpang tidak wajar (misal salah ketik 10x lipat)
  | 'SKU_NOT_FOUND'          // SKU / Nama produk belum terdaftar di Master Data
  | 'STANDARD_MISMATCH'      // Nilai berat standar (Qn) di file berbeda dari Master Data resmi
  | 'EMPTY_ROW';             // Baris tidak memiliki data

export type ValidationErrorSeverity = 'CRITICAL' | 'WARNING';

export interface DataValidationError {
  rowNumber: number; // Baris Excel (1-indexed dari data file)
  columnName?: string;
  inputValue?: any;
  sku?: string;
  productName?: string;
  errorType: ValidationErrorType;
  severity: ValidationErrorSeverity;
  message: string;
  expectedValue?: string | number;
  actionTaken: string; // e.g. "Dilewati (diabaikan)", "Otomatis disinkronkan ke standar Master Data"
}

export interface ValidationSummary {
  totalRowsProcessed: number;
  validRowsCount: number;
  criticalErrorsCount: number;
  warningsCount: number;
  errors: DataValidationError[];
  hasMasterDataMismatches: boolean;
  isRejected: boolean;
  rejectionReason?: string;
}
