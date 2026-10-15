export type BdktStatus = 'OK' | 'T1_DEFICIENT' | 'T2_FAIL' | 'OVERFILL';

export type BatchComplianceStatus = 
  | 'PASS'              // Memenuhi Syarat BDKT
  | 'FAIL_AVERAGE'      // Rata-rata kurang dari Qn
  | 'FAIL_T2'           // Terdapat cacat fatal T2 (Zero tolerance)
  | 'FAIL_T1_EXCESS'    // Cacat T1 melebihi toleransi (maks 2.5%)
  | 'WARNING_GIVEAWAY'; // Lolos tapi overfill tinggi (kerugian bahan baku)

export interface BdktRecord {
  id: string;
  sampleNo: number;
  timestamp?: string;
  productName: string;
  productDescription?: string; // Deskripsi produk (kemasan, spesifikasi)
  skuCode?: string;            // Kode SKU Master
  category?: string;           // Kategori produk
  batchNo: string;
  lineOrShift?: string;
  nominalWeight: number; // Qn (gram)
  actualWeight: number;  // Berat Aktual (gram)
  tareWeight?: number;    // Berat Tara (gram)
  grossWeight?: number;   // Berat Bruto (gram)
  unit: string;          // 'g', 'ml', 'kg'
  
  // Calculated properties
  gap: number;           // actualWeight - nominalWeight
  gapPercent: number;    // (gap / nominalWeight) * 100
  tolerableDeficiency: number; // T (gram)
  t1Limit: number;       // Qn - T
  t2Limit: number;       // Qn - 2*T
  status: BdktStatus;
  notes?: string;
}

export interface BatchAnalysis {
  productName: string;
  productDescription?: string;
  skuCode?: string;
  category?: string;
  batchNo: string;
  unit: string;
  sampleCount: number;
  nominalWeight: number; // Qn
  tolerableDeficiency: number; // T
  t1Limit: number;
  t2Limit: number;

  // Statistical Metrics
  averageActualWeight: number;
  averageGap: number;
  averageGapPercent: number;
  minActualWeight: number;
  maxActualWeight: number;
  range: number;
  stdDeviation: number;
  variance: number;
  
  // Process Capability
  cp: number | null;
  cpk: number | null;

  // Compliance Breakdown
  t1Count: number;
  t1Percent: number;
  t2Count: number;
  t2Percent: number;
  okCount: number;
  okPercent: number;
  overfillCount: number;
  overfillPercent: number;

  // BDKT Rules evaluation
  isAveragePassed: boolean; // Average >= Qn
  isT2Passed: boolean;      // T2 Count == 0
  isT1Passed: boolean;      // T1 Percent <= 2.5%
  overallStatus: BatchComplianceStatus;
  statusMessage: string;

  // Economic analysis (Giveaway)
  totalGiveawayGrams: number;
  estimatedCostPerKg: number; // default e.g. Rp 25.000 / kg
  giveawayFinancialLoss: number;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  iconLink?: string;
  webViewLink?: string;
}

export interface ColumnMappingConfig {
  sampleNoCol?: string;
  productNameCol?: string;
  skuCodeCol?: string;
  productDescriptionCol?: string;
  batchNoCol?: string;
  lineCol?: string;
  dateCol?: string;
  actualWeightCol: string;
  nominalWeightCol?: string;
  tareWeightCol?: string;
  grossWeightCol?: string;
  unitCol?: string;
}
