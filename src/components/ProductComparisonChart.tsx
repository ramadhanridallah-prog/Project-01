import React from 'react';
import { BdktRecord } from '../types/bdkt';

interface ProductComparisonChartProps {
  records: BdktRecord[];
}

export const ProductComparisonChart: React.FC<ProductComparisonChartProps> = ({
  records,
}) => {
  if (records.length === 0) return null;

  // Group records by lineOrShift or batchNo
  const groupKey = records.some((r) => r.lineOrShift && r.lineOrShift !== 'Line 1')
    ? 'lineOrShift'
    : 'batchNo';

  const groups: Record<
    string,
    {
      name: string;
      records: BdktRecord[];
      avgWeight: number;
      nominalWeight: number;
      avgGap: number;
      t1Count: number;
      t2Count: number;
      unit: string;
    }
  > = {};

  records.forEach((r) => {
    const key = (groupKey === 'lineOrShift' ? r.lineOrShift : r.batchNo) || 'Default';
    if (!groups[key]) {
      groups[key] = {
        name: key,
        records: [],
        avgWeight: 0,
        nominalWeight: r.nominalWeight,
        avgGap: 0,
        t1Count: 0,
        t2Count: 0,
        unit: r.unit,
      };
    }
    groups[key].records.push(r);
    if (r.status === 'T1_DEFICIENT') groups[key].t1Count++;
    if (r.status === 'T2_FAIL') groups[key].t2Count++;
  });

  const groupList = Object.values(groups).map((g) => {
    const sum = g.records.reduce((acc, r) => acc + r.actualWeight, 0);
    const avg = sum / g.records.length;
    const avgGap = avg - g.nominalWeight;
    return {
      ...g,
      avgWeight: Number(avg.toFixed(2)),
      avgGap: Number(avgGap.toFixed(2)),
    };
  });

  const maxGapAbs = Math.max(...groupList.map((g) => Math.abs(g.avgGap)), 2);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
            <span>Perbandingan Gap Berat Berdasarkan {groupKey === 'lineOrShift' ? 'Line / Shift' : 'Batch'}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Mendeteksi line pengemasan atau shift yang mengalami deviasi pengisian tertinggi.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {groupList.map((g) => {
          const isOver = g.avgGap >= 0;
          const barWidthPercent = Math.min((Math.abs(g.avgGap) / maxGapAbs) * 100, 100);

          return (
            <div
              key={g.name}
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="sm:w-48">
                <span className="font-bold text-slate-900 text-xs block truncate">
                  {g.name}
                </span>
                <span className="text-[10px] text-slate-500">
                  {g.records.length} sampel | Qn: {g.nominalWeight} {g.unit}
                </span>
              </div>

              {/* Progress bar visual for gap */}
              <div className="flex-1">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-600 font-mono font-medium">
                    Rata-rata: {g.avgWeight} {g.unit}
                  </span>
                  <span
                    className={`font-bold font-mono ${
                      isOver ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    Gap: {isOver ? '+' : ''}
                    {g.avgGap} {g.unit}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden flex">
                  <div
                    style={{ width: `${Math.max(barWidthPercent, 5)}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${
                      g.t2Count > 0
                        ? 'bg-rose-500'
                        : isOver
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                    }`}
                  />
                </div>
              </div>

              {/* Defect Indicators */}
              <div className="flex items-center gap-2 text-[10px] shrink-0 font-bold">
                {g.t1Count > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    {g.t1Count} T1
                  </span>
                )}
                {g.t2Count > 0 && (
                  <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                    {g.t2Count} T2 Fatal
                  </span>
                )}
                {g.t1Count === 0 && g.t2Count === 0 && (
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    100% Sesuai
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
