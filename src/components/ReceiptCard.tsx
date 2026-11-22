import React from 'react';
import { formatPercent, formatRupiah } from '../lib/pricing';
import type { RecipeCalculation } from '../types';
import { InstagramCredit } from './InstagramCredit';

interface ReceiptCardProps {
  recipeName: string;
  portions: number;
  calc: RecipeCalculation;
  profitMode: 'rupiah' | 'percent';
  profitValue: number;
  onChangeProfitMode?: (mode: 'rupiah' | 'percent') => void;
  onChangeProfitValue?: (val: number) => void;
  selectedChannelFee?: number;
  onChangeChannelFee?: (fee: number) => void;
  interactiveDemo?: boolean;
  onShareReceipt?: () => void;
  onPrintReceipt?: () => void;
}

export const ReceiptCard: React.FC<ReceiptCardProps> = ({
  recipeName,
  portions,
  calc,
  profitMode,
  profitValue,
  onChangeProfitMode,
  onChangeProfitValue,
  selectedChannelFee,
  onChangeChannelFee,
  interactiveDemo = false,
  onShareReceipt,
  onPrintReceipt,
}) => {
  return (
    <article
      className="receipt-font receipt-sawtooth animate-print-receipt bg-[var(--bg-receipt)] text-[var(--ink-primary)] border border-[rgba(20,33,61,0.14)] px-5 pt-5"
      aria-label="Nota Harga"
    >
      <div className="border-b border-dashed border-[rgba(20,33,61,0.28)] pb-3">
        <div className="flex items-center justify-between text-xs">
          <span>NOTA HARGA • HPP-KILAT</span>
          <span>{portions} PORSI</span>
        </div>
        <h3 className="mt-1 text-base font-semibold tracking-tight">
          {recipeName || 'Resep tanpa nama'}
        </h3>
      </div>

      <ul className="mt-3 space-y-2 text-xs">
        {calc.lineItems.map((row) => (
          <li
            key={row.ingredient.id}
            className="flex items-baseline justify-between gap-2"
          >
            <span className="truncate">
              {row.ingredient.name}{' '}
              <span className="opacity-70">
                ({row.qty} {row.ingredient.unit})
              </span>
            </span>
            <span className="shrink-0 font-medium">
              {formatRupiah(row.costPerPortion)}
            </span>
          </li>
        ))}
        {calc.extraCostPerPortion > 0 && (
          <li className="flex items-baseline justify-between gap-2">
            <span>Biaya lain / porsi</span>
            <span className="shrink-0 font-medium">
              {formatRupiah(calc.extraCostPerPortion)}
            </span>
          </li>
        )}
      </ul>

      <hr className="my-3 border-dashed border-[rgba(20,33,61,0.28)]" />

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span>Subtotal bahan</span>
          <span>{formatRupiah(calc.ingredientSubtotalPerPortion)}</span>
        </div>
        <div className="flex justify-between">
          <span>Subtotal kemasan</span>
          <span>{formatRupiah(calc.packagingSubtotalPerPortion)}</span>
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between border-y border-dashed border-[rgba(20,33,61,0.28)] py-3">
        <span className="text-sm font-semibold">Modal per porsi</span>
        <span className="text-xl font-semibold transition-colors duration-150">
          {formatRupiah(calc.hpp)}
        </span>
      </div>

      {interactiveDemo && onChangeProfitValue && onChangeChannelFee && (
        <div className="mt-3 grid grid-cols-2 gap-3 border-b border-dashed border-[rgba(20,33,61,0.28)] pb-3 text-xs">
          <div>
            <label htmlFor="demo-profit" className="block font-medium">
              Target untung ({profitMode === 'rupiah' ? 'Rp' : '%'})
            </label>
            {onChangeProfitMode && (
              <div className="mt-1 flex gap-1">
                <button
                  type="button"
                  onClick={() => onChangeProfitMode('rupiah')}
                  className={`min-h-[36px] flex-1 border px-2 text-xs ${
                    profitMode === 'rupiah'
                      ? 'border-[var(--accent-cobalt)] bg-[var(--accent-cobalt)] text-white'
                      : 'border-[rgba(20,33,61,0.2)]'
                  }`}
                >
                  Rp
                </button>
                <button
                  type="button"
                  onClick={() => onChangeProfitMode('percent')}
                  className={`min-h-[36px] flex-1 border px-2 text-xs ${
                    profitMode === 'percent'
                      ? 'border-[var(--accent-cobalt)] bg-[var(--accent-cobalt)] text-white'
                      : 'border-[rgba(20,33,61,0.2)]'
                  }`}
                >
                  %
                </button>
              </div>
            )}
            <input
              id="demo-profit"
              type="number"
              inputMode="decimal"
              value={profitValue}
              onChange={(e) => onChangeProfitValue(Number(e.target.value))}
              className="mt-1.5 min-h-[44px] w-full border border-[rgba(20,33,61,0.25)] bg-white px-2.5 text-right text-sm"
            />
          </div>
          <div>
            <label htmlFor="demo-fee" className="block font-medium">
              Potongan aplikasi (%)
            </label>
            <input
              id="demo-fee"
              type="number"
              inputMode="decimal"
              min={0}
              max={99}
              value={selectedChannelFee ?? 20}
              onChange={(e) => onChangeChannelFee(Number(e.target.value))}
              className="mt-1.5 min-h-[44px] w-full border border-[rgba(20,33,61,0.25)] bg-white px-2.5 text-right text-sm"
            />
          </div>
        </div>
      )}

      <div className="mt-3">
        <p className="text-xs font-semibold">Harga jual minimal</p>
        <div className="mt-2 space-y-2.5">
          {calc.channels.map((chCalc) => (
            <div
              key={chCalc.channel.id}
              className="border-b border-dotted border-[rgba(20,33,61,0.18)] pb-2 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">
                  {chCalc.channel.name}{' '}
                  <span className="opacity-70">({chCalc.channel.fee_percent}%)</span>
                </span>
                {chCalc.impossibleMargin || chCalc.minPrice === null ? (
                  <span className="text-xs font-semibold text-[var(--status-loss)]">
                    Target margin tidak mungkin dicapai dengan potongan sebesar itu
                  </span>
                ) : (
                  <span className="bg-[var(--highlight-yellow)] px-2 py-0.5 text-sm font-semibold text-[var(--ink-primary)] transition-colors duration-150">
                    {formatRupiah(chCalc.minPrice)}
                  </span>
                )}
              </div>
              {chCalc.minPrice !== null && chCalc.netProfitAtMin !== null && (
                <div className="mt-1 flex justify-between text-[11px] opacity-85">
                  <span>
                    Untung bersih:{' '}
                    <span
                      style={{
                        color:
                          chCalc.netProfitAtMin >= 0
                            ? 'var(--status-profit)'
                            : 'var(--status-loss)',
                      }}
                    >
                      {formatRupiah(chCalc.netProfitAtMin)}
                    </span>
                  </span>
                  <span>
                    Margin: {formatPercent(chCalc.actualMarginAtMin ?? 0)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {(onShareReceipt || onPrintReceipt) && (
        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          {onShareReceipt && (
            <button
              type="button"
              onClick={onShareReceipt}
              className="min-h-[44px] flex-1 border border-[rgba(20,33,61,0.25)] px-3 text-xs font-medium hover:bg-black/5"
            >
              Salin ringkasan
            </button>
          )}
          {onPrintReceipt && (
            <button
              type="button"
              onClick={onPrintReceipt}
              className="min-h-[44px] flex-1 border border-[rgba(20,33,61,0.25)] px-3 text-xs font-medium hover:bg-black/5"
            >
              Cetak nota
            </button>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-dashed border-[rgba(20,33,61,0.28)] pt-2 text-center">
        <InstagramCredit
          prefixText="dibuat oleh"
          className="justify-center text-xs"
        />
      </div>
    </article>
  );
};