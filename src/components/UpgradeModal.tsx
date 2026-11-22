import React, { useState } from 'react';
import { PRO_PRICE_LABEL } from '../lib/pricing';

interface UpgradeModalProps {
  open: boolean;
  reason: string;
  userEmail?: string;
  onClose: () => void;
  onGoToAuth?: () => void;
}

type PlanCycle = 'bulanan' | 'tahunan';

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  open,
  reason,
  userEmail,
  onClose,
  onGoToAuth,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<PlanCycle>('bulanan');

  if (!open) return null;

  const waNumber = ((import.meta.env.VITE_UPGRADE_WHATSAPP as string) || '').replace(
    /[^\d]/g,
    ''
  );
  const planText =
    selectedPlan === 'bulanan'
      ? 'Paket Pro Bulanan (Promo 10 UMKM Tercepat: Rp20.000 dari Rp50.000)'
      : 'Paket Pro Tahunan';
  const message = encodeURIComponent(
    [
      `Halo Sacademy.id, saya ingin klaim ${planText} untuk akun HPP-Kilat.`,
      `Email akun: ${userEmail || 'Belum login / Tamu'}`,
    ].join('\n')
  );
  const waHref = waNumber ? `https://wa.me/${waNumber}?text=${message}` : '#';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-dialog-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 p-6 text-slate-100 shadow-2xl shadow-black/70 ring-1 ring-white/10"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-amber-400/15 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-emerald-500/15 blur-2xl"
        />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
              HPP-Kilat Pro
            </span>
            <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
              Promo 10 UMKM Tercepat
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-1 text-xs text-slate-400 transition hover:border-slate-700 hover:text-white"
          >
            ✕
          </button>
        </div>

        <h2
          id="upgrade-dialog-title"
          className="relative z-10 mt-3 text-xl font-bold leading-snug text-white sm:text-2xl"
        >
          {reason ||
            'Buka akses tanpa batas resep, bahan baku, dan channel penjualan di HPP-Kilat Pro.'}
        </h2>

        <p className="relative z-10 mt-2 text-xs leading-relaxed text-slate-400 sm:text-sm">
          Khusus <strong className="text-emerald-300">10 UMKM tercepat</strong>, paket bulanan
          dapat diskon spesial dari <span className="line-through text-slate-500">Rp50.000</span>{' '}
          menjadi <strong className="text-white">Rp20.000 / 1 bulan</strong> untuk akses tanpa
          batas resep, bahan/kemasan, dan kanal penjualan.
        </p>

        {/* Pilihan skema Pro */}
        <div className="relative z-10 mt-4 grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setSelectedPlan('bulanan')}
            className={`rounded-2xl border p-3.5 text-left transition ${
              selectedPlan === 'bulanan'
                ? 'border-emerald-400/70 bg-emerald-500/10 text-white shadow-sm shadow-emerald-500/20'
                : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-emerald-300">Pro Bulanan</p>
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                HEMAT 60%
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-xs text-slate-500 line-through tabular-nums">Rp50.000</span>
              <span className="text-base font-bold text-white tabular-nums">Rp20.000</span>
              <span className="text-[11px] text-slate-400">/ 1 bulan</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Kuota terbatas 10 UMKM tercepat</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPlan('tahunan')}
            className={`rounded-2xl border p-3.5 text-left transition ${
              selectedPlan === 'tahunan'
                ? 'border-amber-400/70 bg-amber-400/10 text-white shadow-sm shadow-amber-400/20'
                : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700'
            }`}
          >
            <p className="font-semibold text-amber-300">Pro Tahunan</p>
            <p className="mt-1.5 text-sm font-bold text-white">
              {PRO_PRICE_LABEL || 'Lebih hemat untuk jangka panjang'}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">Cocok untuk menu rutin</p>
          </button>
        </div>

        {/* Info akun */}
        <div className="relative z-10 mt-4 rounded-2xl border border-slate-800/90 bg-slate-950/80 px-3.5 py-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Akun aktif:</span>
            <span className="truncate font-medium text-slate-200">
              {userEmail || 'Belum masuk (Mode Tamu)'}
            </span>
          </div>
          {!userEmail && onGoToAuth && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onGoToAuth();
              }}
              className="mt-2 text-left text-[11px] font-semibold text-emerald-400 underline-offset-2 hover:underline"
            >
              Masuk atau daftar akun dulu agar status Pro tersimpan →
            </button>
          )}
        </div>

        {/* Tombol aksi */}
        <div className="relative z-10 mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] rounded-xl border border-slate-700/80 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Nanti dulu
          </button>

          {waNumber ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:brightness-105"
            >
              {selectedPlan === 'bulanan'
                ? 'Klaim Promo Rp20.000 / Bulan'
                : 'Upgrade ke Pro via WhatsApp'}
            </a>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] rounded-xl bg-gradient-to-r from-amber-300 to-amber-400 px-5 py-2 text-xs font-bold text-slate-950 transition hover:brightness-105"
            >
              Hubungi Admin untuk Klaim Promo
            </button>
          )}
        </div>
      </div>
    </div>
  );
};