import React, { useState, useMemo } from 'react';
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Package,
  FileText,
  Filter,
  Layers,
  ArrowUpRight,
  Info,
  Scale,
} from 'lucide-react';
import { BatchAnalysis, BdktRecord } from '../types/bdkt';
import { evaluateBatchData } from '../utils/bdkt';

export type TrendBasisType = 'GROSS' | 'NET';

interface SingleProductRunChartProps {
  productName: string;
  records: BdktRecord[];
  costPerKg: number;
  onFilterProduct?: (productName: string) => void;
  isStandalone?: boolean;
  trendBasis?: TrendBasisType;
  onTrendBasisChange?: (basis: TrendBasisType) => void;
}

export const SingleProductRunChart: React.FC<SingleProductRunChartProps> = ({
  productName,
  records,
  costPerKg,
  onFilterProduct,
  isStandalone = false,
  trendBasis: controlledTrendBasis,
  onTrendBasisChange,
}) => {
  const [internalTrendBasis, setInternalTrendBasis] = useState<TrendBasisType>('GROSS');
  const trendBasis = controlledTrendBasis ?? internalTrendBasis;

  const handleBasisChange = (basis: TrendBasisType) => {
    if (onTrendBasisChange) {
      onTrendBasisChange(basis);
    } else {
      setInternalTrendBasis(basis);
    }
  };

  const [hoveredRecord, setHoveredRecord] = useState<BdktRecord | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'ISSUES_ONLY'>('ALL');
  const [showTrendProjection, setShowTrendProjection] = useState<boolean>(true);
  const [trendScope, setTrendScope] = useState<'ALL' | 'LAST_10' | 'LAST_15'>('ALL');

  // Compute specific analysis for this product
  const analysis: BatchAnalysis = useMemo(() => {
    const pBatch = records.length > 0 ? records[0].batchNo : 'BATCH-001';
    const pUnit = records.length > 0 ? records[0].unit : 'g';
    return evaluateBatchData(records, productName, pBatch, pUnit, costPerKg);
  }, [records, productName, costPerKg]);

  const productDescription = records.find((r) => r.productDescription)?.productDescription;
  const skuCode = records.find((r) => r.skuCode)?.skuCode;
  const category = records.find((r) => r.category)?.category;

  // Determine tare weight for this product
  const tareWeight = useMemo(() => {
    const recTare = records.find((r) => r.tareWeight !== undefined && r.tareWeight > 0)?.tareWeight;
    if (recTare !== undefined) return recTare;
    return analysis.nominalWeight > 1000 ? 15 : analysis.nominalWeight > 200 ? 8.2 : 2.5;
  }, [records, analysis.nominalWeight]);

  if (records.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
        Tidak ada data sampel untuk produk {productName}.
      </div>
    );
  }

  // Weight Value Accessor based on trendBasis (Gross vs Net)
  const getWeightValue = (r: BdktRecord): number => {
    if (trendBasis === 'GROSS') {
      return r.grossWeight ?? Number((r.actualWeight + (r.tareWeight ?? tareWeight)).toFixed(2));
    }
    return r.actualWeight;
  };

  // Target lines based on mode
  const nominalTarget =
    trendBasis === 'GROSS'
      ? Number((analysis.nominalWeight + tareWeight).toFixed(2))
      : analysis.nominalWeight;

  const t1Target =
    trendBasis === 'GROSS'
      ? Number((analysis.t1Limit + tareWeight).toFixed(2))
      : analysis.t1Limit;

  const t2Target =
    trendBasis === 'GROSS'
      ? Number((analysis.t2Limit + tareWeight).toFixed(2))
      : analysis.t2Limit;

  // Linear Regression Calculation
  const windowCount =
    trendScope === 'LAST_10'
      ? Math.min(10, records.length)
      : trendScope === 'LAST_15'
      ? Math.min(15, records.length)
      : records.length;

  const windowStartIndex = records.length - windowCount;
  const windowRecords = records.slice(windowStartIndex);

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  const nW = windowRecords.length;

  windowRecords.forEach((r, idx) => {
    const x = windowStartIndex + idx;
    const y = getWeightValue(r);
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });

  const slope = nW > 1 ? (nW * sumXY - sumX * sumY) / (nW * sumXX - sumX * sumX) : 0;
  const currentAvgWeight =
    records.reduce((acc, r) => acc + getWeightValue(r), 0) / (records.length || 1);
  const intercept = nW > 0 ? (sumY - slope * sumX) / nW : currentAvgWeight;

  const forecastSteps = showTrendProjection ? 5 : 0;
  const totalChartSteps = records.length + forecastSteps;

  const isDownwardTrend = slope < -0.015;
  const isUpwardTrend = slope > 0.03;

  const currentLastIndex = records.length - 1;
  const lastProjectedWeight = slope * (currentLastIndex + forecastSteps) + intercept;

  let samplesUntilT1: number | null = null;
  if (isDownwardTrend && slope < 0) {
    const xHitT1 = (t1Target - intercept) / slope;
    if (xHitT1 > currentLastIndex) {
      samplesUntilT1 = Math.round(xHitT1 - currentLastIndex);
    } else if (getWeightValue(records[currentLastIndex]) <= t1Target) {
      samplesUntilT1 = 0;
    }
  }

  // Scales for Compact SVG rendering (reduced from 330px to 195px height)
  const width = 920;
  const height = 195;
  const padding = { top: 22, right: 40, bottom: 25, left: 52 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const allHistoricalWeights = records.map((r) => getWeightValue(r));
  const projectedValues = showTrendProjection
    ? [slope * currentLastIndex + intercept, lastProjectedWeight]
    : [];

  const refValues = [
    nominalTarget,
    t1Target,
    t2Target,
    currentAvgWeight,
    ...allHistoricalWeights,
    ...projectedValues,
  ];

  const rawMinY = Math.min(...refValues);
  const rawMaxY = Math.max(...refValues);
  const yPadding = Math.max((rawMaxY - rawMinY) * 0.16, 2.5);

  const minY = Math.floor(rawMinY - yPadding);
  const maxY = Math.ceil(rawMaxY + yPadding);
  const yRange = maxY - minY || 1;

  const getY = (val: number) => {
    const norm = (val - minY) / yRange;
    return padding.top + chartHeight - norm * chartHeight;
  };

  const getX = (index: number) => {
    if (totalChartSteps <= 1) return padding.left + chartWidth / 2;
    return padding.left + (index / (totalChartSteps - 1)) * chartWidth;
  };

  const yNominal = getY(nominalTarget);
  const yT1 = getY(t1Target);
  const yT2 = getY(t2Target);

  const yTicks = [
    minY,
    minY + yRange * 0.33,
    minY + yRange * 0.66,
    maxY,
  ].map((v) => Number(v.toFixed(1)));

  const pointsPath = records
    .map((r, i) => `${getX(i)},${getY(getWeightValue(r))}`)
    .join(' ');

  const regStartX = getX(windowStartIndex);
  const regStartY = getY(slope * windowStartIndex + intercept);
  const regEndX = getX(currentLastIndex);
  const regEndY = getY(slope * currentLastIndex + intercept);

  const forecastEndX = getX(currentLastIndex + forecastSteps);
  const forecastEndY = getY(lastProjectedWeight);

  const forecastPoints = Array.from({ length: forecastSteps }, (_, i) => {
    const fIdx = currentLastIndex + i + 1;
    const fWeight = slope * fIdx + intercept;
    return {
      index: fIdx,
      weight: fWeight,
      x: getX(fIdx),
      y: getY(fWeight),
    };
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-2.5 transition hover:shadow-sm">
      {/* Product Title Bar & Description - Compact Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <div className="p-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700">
              <Package className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
              {productName}
            </h4>
            {skuCode && (
              <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {skuCode}
              </span>
            )}
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200">
              Qn: {analysis.nominalWeight} {analysis.unit}
            </span>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200">
              Tara: {tareWeight}g | Target Bruto: {nominalTarget}g
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              ({records.length} smp)
            </span>
          </div>

          {/* Product Description Badge - Compact single line */}
          <div className="flex items-center gap-1 text-[11px] text-slate-500 pt-0.5">
            <FileText className="w-3 h-3 text-slate-400 shrink-0" />
            <p className="line-clamp-1 italic text-slate-600">
              {productDescription ||
                `Spesifikasi: Target nominal ${analysis.nominalWeight}g, tara ${tareWeight}g, toleransi T=${analysis.tolerableDeficiency}g (T1=${analysis.t1Limit}g, T2=${analysis.t2Limit}g).`}
            </p>
          </div>
        </div>

        {/* Action Controls: Gross/Net Switcher, Trend Scope & Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Trend Basis Selector (Berat Bruto vs Berat Bersih) */}
          <div className="flex items-center bg-purple-50/80 p-0.5 rounded-xl border border-purple-200 text-[11px]">
            <button
              onClick={() => handleBasisChange('GROSS')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                trendBasis === 'GROSS'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-purple-700 hover:text-purple-900 hover:bg-purple-100'
              }`}
              title="Pembacaan tren berdasarkan nilai Berat Bruto (Netto + Tara)"
            >
              <Scale className="w-3 h-3" />
              <span>Berat Bruto</span>
            </button>
            <button
              onClick={() => handleBasisChange('NET')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                trendBasis === 'NET'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-purple-700 hover:text-purple-900 hover:bg-purple-100'
              }`}
              title="Pembacaan tren berdasarkan nilai Berat Bersih (Netto)"
            >
              <span>Netto</span>
            </button>
          </div>

          {onFilterProduct && (
            <button
              onClick={() => onFilterProduct(productName)}
              className="flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold transition cursor-pointer shadow-2xs"
              title="Filter seluruh dashboard ke produk ini"
            >
              <Filter className="w-3 h-3" />
              <span>Filter Produk</span>
            </button>
          )}

          {/* Trend Toggle */}
          <button
            onClick={() => setShowTrendProjection(!showTrendProjection)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition border cursor-pointer ${
              showTrendProjection
                ? 'bg-purple-50 text-purple-700 border-purple-200 shadow-2xs'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <Sparkles className="w-3 h-3 text-purple-600" />
            <span>Garis Tren</span>
          </button>

          {/* Scope buttons */}
          {showTrendProjection && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
              <button
                onClick={() => setTrendScope('ALL')}
                className={`px-1.5 py-0.5 rounded-md font-medium transition cursor-pointer ${
                  trendScope === 'ALL'
                    ? 'bg-purple-600 text-white font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setTrendScope('LAST_10')}
                className={`px-1.5 py-0.5 rounded-md font-medium transition cursor-pointer ${
                  trendScope === 'LAST_10'
                    ? 'bg-purple-600 text-white font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                10 Smp
              </button>
            </div>
          )}

          {/* Defect Filter */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-1.5 py-0.5 rounded-md font-medium transition cursor-pointer ${
                filterMode === 'ALL'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setFilterMode('ISSUES_ONLY')}
              className={`px-1.5 py-0.5 rounded-md font-medium transition cursor-pointer ${
                filterMode === 'ISSUES_ONLY'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cacat T1/T2
            </button>
          </div>
        </div>
      </div>

      {/* COMPACT INTELLIGENT TREND & PROJECTION BANNER */}
      {showTrendProjection && (
        <div
          className={`p-2.5 rounded-xl border text-[11px] flex flex-col md:flex-row items-start md:items-center justify-between gap-2 ${
            isDownwardTrend
              ? samplesUntilT1 !== null && samplesUntilT1 <= 10
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
              : isUpwardTrend
              ? 'bg-sky-50 border-sky-200 text-sky-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-white border border-slate-200 shrink-0 shadow-2xs">
              {isDownwardTrend ? (
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              ) : isUpwardTrend ? (
                <TrendingUp className="w-3.5 h-3.5 text-sky-600" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold uppercase tracking-wide text-[11px]">
                {trendBasis === 'GROSS' ? 'Tren Berat Bruto:' : 'Tren Berat Netto:'}{' '}
                {isDownwardTrend
                  ? 'Penurunan (Risiko Underfill)'
                  : isUpwardTrend
                  ? 'Kenaikan (Risiko Giveaway)'
                  : 'Stabil & Terkendali'}
              </span>
              <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-white border border-slate-300 text-slate-800 shadow-2xs">
                Slope: {slope >= 0 ? '+' : ''}{slope.toFixed(3)} {analysis.unit}/smp ({trendBasis === 'GROSS' ? 'Bruto' : 'Netto'})
              </span>
              {isDownwardTrend && samplesUntilT1 !== null && (
                <span className="text-rose-700 font-bold">
                  {samplesUntilT1 <= 0 ? 'Sudah tembus T1!' : `Tembus T1 dlm ~${samplesUntilT1} smp`}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-slate-600 text-[10px] font-mono bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
            <span>Proyeksi +{forecastSteps} smp:</span>
            <span
              className={`font-black ${
                lastProjectedWeight < t1Target
                  ? 'text-rose-600'
                  : lastProjectedWeight < nominalTarget
                  ? 'text-amber-600'
                  : 'text-emerald-700'
              }`}
            >
              ~{lastProjectedWeight.toFixed(2)} {analysis.unit}
            </span>
          </div>
        </div>
      )}

      {/* Chart Legend - Compact Single Line */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-[10px] text-slate-600 py-1 border-y border-slate-100">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-0.5 bg-sky-600 inline-block"></span>
          <span className="font-mono">
            {trendBasis === 'GROSS' ? `Target Bruto (${nominalTarget}g)` : `Standar Qn (${nominalTarget}g)`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-0.5 bg-amber-500 inline-block border-b border-dashed border-amber-500"></span>
          <span className="font-mono">
            T1 {trendBasis === 'GROSS' ? 'Bruto' : ''} ({t1Target}g)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-0.5 bg-rose-600 inline-block"></span>
          <span className="font-mono">
            T2 Fatal ({t2Target}g)
          </span>
        </div>
        {showTrendProjection && (
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-0.5 bg-purple-600 inline-block"></span>
            <span className="text-purple-700 font-mono font-bold">
              Garis Tren & Forecast (+{forecastSteps})
            </span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2 text-slate-400 font-sans">
          <span>Titik:</span>
          <span className="text-emerald-600 font-bold">● Sesuai</span>
          <span className="text-amber-600 font-bold">● T1</span>
          <span className="text-rose-600 font-bold">● T2</span>
        </div>
      </div>

      {/* SVG Run Chart Container - Compact Height (195px) */}
      <div className="relative w-full overflow-x-auto select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[620px] font-sans"
        >
          {/* Horizontal grid lines & ticks */}
          {yTicks.map((val, idx) => (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={getY(val)}
                x2={width - padding.right}
                y2={getY(val)}
                stroke="#e2e8f0"
                strokeDasharray="2,3"
                strokeWidth="1"
              />
              <text
                x={padding.left - 6}
                y={getY(val) + 3}
                textAnchor="end"
                className="text-[9px] fill-slate-400 font-mono font-medium"
              >
                {val}
              </text>
            </g>
          ))}

          {/* Shaded Forecast Horizon Zone */}
          {showTrendProjection && forecastSteps > 0 && (
            <g>
              <rect
                x={getX(currentLastIndex)}
                y={padding.top}
                width={width - padding.right - getX(currentLastIndex)}
                height={chartHeight}
                fill="#f3e8ff"
                fillOpacity="0.35"
              />
              <line
                x1={getX(currentLastIndex)}
                y1={padding.top}
                x2={getX(currentLastIndex)}
                y2={padding.top + chartHeight}
                stroke="#c084fc"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
            </g>
          )}

          {/* Reference Line: T2 (Fatal Defect) */}
          <line
            x1={padding.left}
            y1={yT2}
            x2={width - padding.right}
            y2={yT2}
            stroke="#e11d48"
            strokeWidth="1.2"
            strokeDasharray="3,2"
          />
          <text
            x={width - padding.right}
            y={yT2 - 3}
            textAnchor="end"
            className="text-[9px] fill-rose-600 font-bold"
          >
            T2: {t2Target}g
          </text>

          {/* Reference Line: T1 (Tolerable Deficiency) */}
          <line
            x1={padding.left}
            y1={yT1}
            x2={width - padding.right}
            y2={yT1}
            stroke="#d97706"
            strokeWidth="1.2"
            strokeDasharray="3,3"
          />
          <text
            x={width - padding.right}
            y={yT1 - 3}
            textAnchor="end"
            className="text-[9px] fill-amber-600 font-bold"
          >
            T1: {t1Target}g
          </text>

          {/* Reference Line: Nominal Qn or Target Bruto */}
          <line
            x1={padding.left}
            y1={yNominal}
            x2={width - padding.right}
            y2={yNominal}
            stroke="#0284c7"
            strokeWidth="1.5"
          />
          <text
            x={padding.left + 6}
            y={yNominal - 4}
            className="text-[9px] fill-sky-700 font-bold"
          >
            {trendBasis === 'GROSS' ? `Target Bruto: ${nominalTarget}g` : `Qn: ${nominalTarget}g`}
          </text>

          {/* Historical Trend Polyline */}
          <polyline
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.2"
            points={pointsPath}
          />

          {/* LINEAR REGRESSION TRENDLINE */}
          {showTrendProjection && (
            <g>
              <line
                x1={regStartX}
                y1={regStartY}
                x2={regEndX}
                y2={regEndY}
                stroke="#9333ea"
                strokeWidth="2"
                strokeLinecap="round"
              />

              <line
                x1={regEndX}
                y1={regEndY}
                x2={forecastEndX}
                y2={forecastEndY}
                stroke={isDownwardTrend ? '#e11d48' : '#9333ea'}
                strokeWidth="2"
                strokeDasharray="3,2"
                strokeLinecap="round"
              />

              {forecastPoints.map((pt) => (
                <g key={`forecast-${pt.index}`}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={3}
                    fill={isDownwardTrend ? '#e11d48' : '#9333ea'}
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                  <text
                    x={pt.x}
                    y={pt.y - 5}
                    textAnchor="middle"
                    className="text-[8px] fill-purple-800 font-mono font-bold"
                  >
                    {pt.weight.toFixed(1)}
                  </text>
                </g>
              ))}
            </g>
          )}

          {/* Historical Data Points */}
          {records.map((r, i) => {
            const val = getWeightValue(r);
            const cx = getX(i);
            const cy = getY(val);
            const isHovered = hoveredRecord?.id === r.id;

            let fill = '#10b981';
            let stroke = '#047857';
            let radius = isHovered ? 5.5 : 3.5;

            if (r.status === 'T2_FAIL') {
              fill = '#ef4444';
              stroke = '#b91c1c';
              radius = isHovered ? 7 : 4.5;
            } else if (r.status === 'T1_DEFICIENT') {
              fill = '#f59e0b';
              stroke = '#b45309';
              radius = isHovered ? 6 : 4;
            } else if (r.status === 'OVERFILL') {
              fill = '#06b6d4';
              stroke = '#0e7490';
            }

            const isDimmed =
              filterMode === 'ISSUES_ONLY' &&
              r.status !== 'T1_DEFICIENT' &&
              r.status !== 'T2_FAIL';

            return (
              <g
                key={r.id}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredRecord(r)}
                onMouseLeave={() => setHoveredRecord(null)}
              >
                {r.status === 'T2_FAIL' && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={radius + 3}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    strokeOpacity="0.6"
                    className="animate-ping"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth="1.2"
                  opacity={isDimmed ? 0.15 : 1}
                />
              </g>
            );
          })}

          {/* X Axis Base Line */}
          <line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={width - padding.right}
            y2={padding.top + chartHeight}
            stroke="#cbd5e1"
            strokeWidth="1"
          />

          {/* X Axis Labels */}
          <text
            x={padding.left}
            y={height - 8}
            className="text-[9px] fill-slate-400 font-mono font-medium"
          >
            #1
          </text>
          <text
            x={getX(currentLastIndex)}
            y={height - 8}
            textAnchor="middle"
            className="text-[9px] fill-slate-700 font-mono font-bold"
          >
            Sampel #{records.length}
          </text>
          {showTrendProjection && forecastSteps > 0 && (
            <text
              x={width - padding.right}
              y={height - 8}
              textAnchor="end"
              className="text-[9px] fill-purple-700 font-mono font-bold"
            >
              +5 Forecast
            </text>
          )}
        </svg>

        {/* Hover Tooltip Box */}
        {hoveredRecord && (
          <div className="absolute top-2 right-2 bg-slate-900/95 backdrop-blur-xs text-white border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs pointer-events-none min-w-[210px] z-10">
            <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800">
              <span className="font-bold text-slate-200 text-xs">
                Sampel #{hoveredRecord.sampleNo}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                  hoveredRecord.status === 'T2_FAIL'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : hoveredRecord.status === 'T1_DEFICIENT'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : hoveredRecord.status === 'OVERFILL'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}
              >
                {hoveredRecord.status === 'OK'
                  ? 'Sesuai'
                  : hoveredRecord.status === 'OVERFILL'
                  ? 'Sesuai (Overfill)'
                  : hoveredRecord.status === 'T1_DEFICIENT'
                  ? 'Tidak Sesuai (T1)'
                  : 'Tidak Sesuai (T2 Fatal)'}
              </span>
            </div>

            <div className="space-y-0.5 text-slate-300 text-[11px]">
              <div className="flex justify-between">
                <span className="text-purple-300 font-medium">Berat Bruto:</span>
                <span className="font-bold text-purple-200 font-mono">
                  {hoveredRecord.grossWeight ?? Number((hoveredRecord.actualWeight + (hoveredRecord.tareWeight ?? tareWeight)).toFixed(2))} {hoveredRecord.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Berat Netto:</span>
                <span className="font-bold text-white font-mono">
                  {hoveredRecord.actualWeight} {hoveredRecord.unit}
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Tara Kemasan:</span>
                <span className="font-mono text-slate-300">{hoveredRecord.tareWeight ?? tareWeight} {hoveredRecord.unit}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Standar Qn:</span>
                <span className="font-mono text-slate-300">{hoveredRecord.nominalWeight} {hoveredRecord.unit}</span>
              </div>
              <div className="flex justify-between pt-0.5 border-t border-slate-800">
                <span className="text-slate-400">Gap Netto:</span>
                <span
                  className={`font-semibold font-mono ${
                    hoveredRecord.gap >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {hoveredRecord.gap >= 0 ? '+' : ''}
                  {hoveredRecord.gap} {hoveredRecord.unit} ({hoveredRecord.gapPercent >= 0 ? '+' : ''}
                  {hoveredRecord.gapPercent}%)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mini Product Metrics Bar - Compact 4 columns */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-xs">
        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200">
          <span className="text-slate-500 text-[10px] block">Rata-rata {trendBasis === 'GROSS' ? 'Bruto' : 'Netto'}:</span>
          <span className="font-bold text-slate-900 font-mono text-xs">
            {currentAvgWeight.toFixed(2)} {analysis.unit}
          </span>
        </div>

        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200">
          <span className="text-slate-500 text-[10px] block">Standar Deviasi (s):</span>
          <span className="font-bold text-slate-900 font-mono text-xs">
            ± {analysis.stdDeviation} {analysis.unit}
          </span>
        </div>

        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200">
          <span className="text-slate-500 text-[10px] block">Cacat T1 / T2:</span>
          <span className="font-bold font-mono text-xs">
            <span className={analysis.t1Count > 0 ? 'text-amber-600' : 'text-slate-700'}>
              T1: {analysis.t1Count}
            </span>{' '}
            |{' '}
            <span className={analysis.t2Count > 0 ? 'text-rose-600 font-black' : 'text-slate-700'}>
              T2: {analysis.t2Count}
            </span>
          </span>
        </div>

        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200">
          <span className="text-slate-500 text-[10px] block">Status BDKT Produk:</span>
          <span
            className={`font-black text-[11px] ${
              analysis.overallStatus === 'PASS'
                ? 'text-emerald-600'
                : analysis.overallStatus === 'WARNING_GIVEAWAY'
                ? 'text-cyan-600'
                : 'text-rose-600'
            }`}
          >
            {analysis.overallStatus === 'PASS'
              ? 'MEMENUHI SYARAT'
              : analysis.overallStatus === 'WARNING_GIVEAWAY'
              ? 'SESUAI (OVERFILL)'
              : 'DITOLAK (REJECT)'}
          </span>
        </div>
      </div>
    </div>
  );
};

interface GapRunChartProps {
  records: BdktRecord[];
  analysis: BatchAnalysis;
  onSelectProductFilter?: (productName: string) => void;
}

export const GapRunChart: React.FC<GapRunChartProps> = ({
  records,
  analysis,
  onSelectProductFilter,
}) => {
  // Global trend basis for all products: GROSS (default) or NET
  const [globalTrendBasis, setGlobalTrendBasis] = useState<TrendBasisType>('GROSS');

  // Group records by product
  const products = useMemo(() => {
    const map = new Map<string, BdktRecord[]>();
    records.forEach((r) => {
      const pName = r.productName || 'Produk BDKT';
      if (!map.has(pName)) {
        map.set(pName, []);
      }
      map.get(pName)!.push(r);
    });

    return Array.from(map.entries()).map(([productName, prodRecords]) => ({
      productName,
      records: prodRecords,
      nominalWeight: prodRecords[0]?.nominalWeight || 0,
      unit: prodRecords[0]?.unit || 'g',
      productDescription: prodRecords.find((r) => r.productDescription)?.productDescription,
      skuCode: prodRecords.find((r) => r.skuCode)?.skuCode,
      category: prodRecords.find((r) => r.category)?.category,
    }));
  }, [records]);

  // Tab state for selecting a specific product or showing all separated stacked
  const [selectedProductTab, setSelectedProductTab] = useState<string>('ALL');

  if (records.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
        Tidak ada data sampel untuk ditampilkan pada grafik Run Chart.
      </div>
    );
  }

  // Filter which products to display in the run chart
  const displayedProducts =
    selectedProductTab === 'ALL'
      ? products
      : products.filter((p) => p.productName === selectedProductTab);

  return (
    <div className="space-y-3">
      {/* Run Chart Header & Global Controls - Compact */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
              <TrendingDown className="w-4 h-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Grafik Tren Run Chart per Produk
                </h3>
                <span className="px-2 py-0.2 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">
                  {products.length} Produk
                </span>
                <span className="px-2 py-0.2 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800">
                  Dasar: {globalTrendBasis === 'GROSS' ? 'Berat Bruto (Qn + Tara)' : 'Berat Bersih (Netto)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Visualisasi tren underfill, batas defisiensi T1/T2, dan proyeksi linier per sampel timbang.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Global Trend Basis Switcher (Gross vs Net) */}
            <div className="flex items-center bg-purple-50 p-1 rounded-xl border border-purple-200 text-xs">
              <span className="text-[11px] font-bold text-purple-900 mr-1.5 hidden sm:inline">Dasar Tren:</span>
              <button
                onClick={() => setGlobalTrendBasis('GROSS')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  globalTrendBasis === 'GROSS'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-purple-700 hover:text-purple-900 hover:bg-purple-100'
                }`}
                title="Hitung dan tampilkan tren berdasarkan nilai Berat Bruto"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Berat Bruto</span>
              </button>
              <button
                onClick={() => setGlobalTrendBasis('NET')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  globalTrendBasis === 'NET'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-purple-700 hover:text-purple-900 hover:bg-purple-100'
                }`}
                title="Hitung dan tampilkan tren berdasarkan nilai Berat Bersih (Netto)"
              >
                <span>Netto</span>
              </button>
            </div>

            {/* Switcher Tabs if multiple products exist */}
            {products.length > 1 && (
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  onClick={() => setSelectedProductTab('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-[11px] ${
                    selectedProductTab === 'ALL'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  Semua ({products.length})
                </button>

                {products.map((p) => (
                  <button
                    key={p.productName}
                    onClick={() => setSelectedProductTab(p.productName)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-[11px] ${
                      selectedProductTab === p.productName
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    {p.productName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Render Separated Compact Run Chart for Each Product */}
      <div className="space-y-3">
        {displayedProducts.map((p) => (
          <SingleProductRunChart
            key={p.productName}
            productName={p.productName}
            records={p.records}
            costPerKg={analysis.estimatedCostPerKg}
            onFilterProduct={onSelectProductFilter}
            isStandalone={products.length === 1}
            trendBasis={globalTrendBasis}
            onTrendBasisChange={(b) => setGlobalTrendBasis(b)}
          />
        ))}
      </div>
    </div>
  );
};
