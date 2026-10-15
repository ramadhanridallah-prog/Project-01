import React from 'react';
import { BatchAnalysis, BdktRecord } from '../types/bdkt';

interface DistributionHistogramProps {
  records: BdktRecord[];
  analysis: BatchAnalysis;
}

export const DistributionHistogram: React.FC<DistributionHistogramProps> = ({
  records,
  analysis,
}) => {
  if (records.length === 0) return null;

  // Build histogram bins
  const binCount = 12;
  const weights = records.map((r) => r.actualWeight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const span = maxW - minW || 1;
  const binWidth = span / binCount;

  const bins: {
    min: number;
    max: number;
    count: number;
    records: BdktRecord[];
    isT2: boolean;
    isT1: boolean;
    isOverfill: boolean;
  }[] = [];

  for (let i = 0; i < binCount; i++) {
    const bMin = minW + i * binWidth;
    const bMax = i === binCount - 1 ? maxW + 0.001 : bMin + binWidth;
    const matched = records.filter(
      (r) => r.actualWeight >= bMin && r.actualWeight < bMax
    );

    const mid = (bMin + bMax) / 2;
    const isT2 = mid < analysis.t2Limit;
    const isT1 = mid >= analysis.t2Limit && mid < analysis.t1Limit;
    const isOverfill = mid > analysis.nominalWeight + 2 * analysis.tolerableDeficiency;

    bins.push({
      min: bMin,
      max: bMax,
      count: matched.length,
      records: matched,
      isT2,
      isT1,
      isOverfill,
    });
  }

  const maxCount = Math.max(...bins.map((b) => b.count), 1);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
            <span>Histogram Distribusi Frekuensi Berat Aktual</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Menganalisis pola sebaran normal pengisian kemasan terhadap batas spesifikasi BDKT.
          </p>
        </div>

        <div className="text-xs text-slate-700 font-mono bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 font-bold">
          μ = {analysis.averageActualWeight} {analysis.unit} | σ = {analysis.stdDeviation} {analysis.unit}
        </div>
      </div>

      {/* Visual Bins Bars */}
      <div className="h-48 sm:h-56 flex items-end gap-1.5 sm:gap-2 pt-6 pb-2 border-b border-slate-200">
        {bins.map((bin, idx) => {
          const heightPercent = (bin.count / maxCount) * 100;
          let barColor = 'bg-emerald-500/80 hover:bg-emerald-500';
          let borderColor = 'border-emerald-600';

          if (bin.isT2) {
            barColor = 'bg-rose-500 hover:bg-rose-600';
            borderColor = 'border-rose-600';
          } else if (bin.isT1) {
            barColor = 'bg-amber-400 hover:bg-amber-500';
            borderColor = 'border-amber-500';
          } else if (bin.isOverfill) {
            barColor = 'bg-cyan-500 hover:bg-cyan-600';
            borderColor = 'border-cyan-600';
          }

          return (
            <div
              key={idx}
              className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
            >
              {/* Tooltip on hover */}
              <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute -top-14 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-[10px] text-white shadow-xl z-20 whitespace-nowrap transition-opacity">
                <div className="font-bold text-emerald-400">
                  {bin.count} kemasan ({((bin.count / records.length) * 100).toFixed(1)}%)
                </div>
                <div className="text-slate-300">
                  {bin.min.toFixed(1)} - {bin.max.toFixed(1)} {analysis.unit}
                </div>
              </div>

              {/* Bar count label */}
              {bin.count > 0 && (
                <span className="text-[10px] text-slate-600 font-mono mb-1 font-bold">
                  {bin.count}
                </span>
              )}

              {/* Bar element */}
              <div
                style={{ height: `${Math.max(heightPercent, 4)}%` }}
                className={`w-full rounded-t-md border-t border-x ${borderColor} ${barColor} transition-all duration-200`}
              />
            </div>
          );
        })}
      </div>

      {/* X Labels Range */}
      <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono font-medium mt-2">
        <span>Min: {minW.toFixed(1)} {analysis.unit}</span>
        <span className="text-sky-700 font-bold">Target Qn: {analysis.nominalWeight} {analysis.unit}</span>
        <span>Max: {maxW.toFixed(1)} {analysis.unit}</span>
      </div>

      {/* Status Zones Guide */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-100 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
          <span className="text-slate-700 font-medium">Zona T2 Fatal (&lt; {analysis.t2Limit})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
          <span className="text-slate-700 font-medium">Zona T1 Defisien ({analysis.t2Limit} - {analysis.t1Limit})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
          <span className="text-slate-700 font-medium">Zona Target OK (&ge; {analysis.t1Limit})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block"></span>
          <span className="text-slate-700 font-medium">Zona Overfill Tinggi</span>
        </div>
      </div>
    </div>
  );
};
