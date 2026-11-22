import { useEffect, useMemo, useState } from 'react';
import { UpgradeModal } from '../components/UpgradeModal';
import { DEMO_CHANNELS, DEMO_INGREDIENTS, DEMO_RECIPE } from '../lib/demoData';
import { calculateNetProfit, calculateRecipePricing, formatRupiah } from '../lib/pricing';
import type { RecipeCalculation } from '../types';

interface LandingPageProps {
  onNavigate: (to: string) => void;
}

interface TestimonialItem {
  id: string;
  name: string;
  business: string;
  role: string;
  quote: string;
  impact: string;
}

const TESTIMONIALS: TestimonialItem[] = [
  {
    id: 't-1',
    name: 'Rizky Pratama',
    business: 'Kopi Senja Pagi',
    role: 'Pemilik Kedai Kopi',
    quote:
      'Dulu ngira jualan es kopi susu harga Rp13.000 sudah aman, ternyata setelah dihitung bareng cup, sedotan, dan fee aplikasi marginnya tipis banget. Sekarang lebih tenang atur harga.',
    impact: 'Margin bersih naik +14%',
  },
  {
    id: 't-2',
    name: 'Dian Kusuma',
    business: 'Dapur Dimsum Mba Dian',
    role: 'UMKM Frozen & Ready-to-Eat',
    quote:
      'Enaknya langsung kelihatan beda untung jual langsung sama lewat GoFood atau GrabFood. Tinggal ubah takaran atau harga beli bahan, nota HPP langsung menyesuaikan.',
    impact: 'Hitung menu baru < 3 menit',
  },
  {
    id: 't-3',
    name: 'Fajar Nugroho',
    business: 'Bakso Bakar Mas Fajar',
    role: 'Usaha Kuliner Harian',
    quote:
      'Waktu harga saus dan kemasan naik, aku bisa cek cepat mana menu yang masih sehat dan mana yang perlu disesuaikan tanpa bongkar rumus Excel yang bikin pusing.',
    impact: 'Zero boncos saat harga bahan naik',
  },
  {
    id: 't-4',
    name: 'Hendra Wijaya',
    business: 'Churros & Toast Co.',
    role: 'Booth Jajanan Mall',
    quote:
      'Simulasi target untung per porsi maupun persen bikin keputusan promo atau bundling jadi terukur. Sangat membantu buat yang baru mulai merapikan pembukuan.',
    impact: 'Harga promo lebih terukur',
  },
];

type DashboardScenario = 'rugi' | 'untung';

export function LandingPage({ onNavigate }: LandingPageProps) {
  const sampleRecipe = DEMO_RECIPE;

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // State animasi dashboard: Jualan Rugi vs Jualan Untung
  const [scenario, setScenario] = useState<DashboardScenario>('rugi');
  const [isDashboardAuto, setIsDashboardAuto] = useState(true);

  useEffect(() => {
    if (!isDashboardAuto) return;

    const timer = window.setInterval(() => {
      setScenario((prev) => (prev === 'rugi' ? 'untung' : 'rugi'));
    }, 3400);

    return () => window.clearInterval(timer);
  }, [isDashboardAuto]);

  const handleSelectScenario = (next: DashboardScenario) => {
    setScenario(next);
    setIsDashboardAuto(false);
  };

  // State testimoni auto-geser: berhenti otomatis ketika diklik
  const [activeTestimonialIdx, setActiveTestimonialIdx] = useState(0);
  const [isAutoSliding, setIsAutoSliding] = useState(true);

  useEffect(() => {
    if (!isAutoSliding) return;

    const timer = window.setInterval(() => {
      setActiveTestimonialIdx((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 3600);

    return () => window.clearInterval(timer);
  }, [isAutoSliding]);

  const handleSelectTestimonial = (idx: number) => {
    setActiveTestimonialIdx(idx);
    setIsAutoSliding(false);
  };

  const sampleCalc = useMemo<RecipeCalculation>(() => {
    return calculateRecipePricing({
      items: sampleRecipe.items,
      ingredients: DEMO_INGREDIENTS,
      portions: sampleRecipe.portions,
      extraCost: sampleRecipe.extra_cost,
      profitMode: sampleRecipe.profit_mode,
      profitValue: sampleRecipe.profit_value,
      channels: DEMO_CHANNELS,
      roundingStep: 500,
      customPricesByChannel: {},
    });
  }, [sampleRecipe]);

  const appChannelCalc =
    sampleCalc.channels.find((c) => c.channel.id === 'ch-gofood') ?? sampleCalc.channels[0];
  const feePercent = appChannelCalc?.channel.fee_percent ?? 20;

  const dashboardMetrics = useMemo(() => {
    const hpp = sampleCalc.hpp;
    const safeMinPrice = appChannelCalc?.minPrice ?? Math.ceil((hpp + 5000) / 500) * 500;
    const lossPrice = Math.max(1000, Math.round((hpp * 1.15) / 500) * 500);
    const activePrice = scenario === 'untung' ? safeMinPrice : lossPrice;

    const feeAmount = Math.round(activePrice * (feePercent / 100));
    const netProfit = Math.round(calculateNetProfit(activePrice, hpp, feePercent, 0));
    const dailyPortions = 30;
    const dailyProfit = netProfit * dailyPortions;

    const totalBarBase = Math.max(activePrice, hpp + feeAmount + Math.max(0, netProfit), 1);
    const hppBarPct = Math.min(100, Math.max(8, (hpp / totalBarBase) * 100));
    const feeBarPct = Math.min(100 - hppBarPct, Math.max(0, (feeAmount / totalBarBase) * 100));
    const profitBarPct = Math.max(0, 100 - hppBarPct - feeBarPct);

    return {
      hpp,
      activePrice,
      safeMinPrice,
      lossPrice,
      feeAmount,
      netProfit,
      dailyProfit,
      dailyPortions,
      hppBarPct,
      feeBarPct,
      profitBarPct,
    };
  }, [sampleCalc.hpp, appChannelCalc?.minPrice, scenario, feePercent]);

  const isUntung = scenario === 'untung';

  return (
    <div className="min-h-screen overflow-x-clip bg-slate-950 text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-400 px-2.5 py-1 text-sm font-bold text-slate-950 shadow-md shadow-emerald-500/25">
              HPP-Kilat
            </span>
            <span className="text-xs font-medium text-slate-400">Kalkulator Margin F&amp;B</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/masuk')}
              className="rounded-lg border border-slate-700/80 px-4 py-2 text-sm font-medium text-slate-200 transition duration-200 hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-900"
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="rounded-lg bg-gradient-to-r from-emerald-400 to-teal-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition duration-200 hover:-translate-y-0.5 hover:brightness-105"
            >
              Buka Kalkulator
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl space-y-12 px-4 py-8 sm:space-y-16 sm:py-12">
        {/* Banner Promo 10 UMKM Tercepat */}
        <div className="relative z-10 flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-400/35 bg-gradient-to-r from-amber-400/10 via-emerald-500/10 to-teal-500/10 px-4 py-3.5 text-xs shadow-lg shadow-black/30 backdrop-blur-xl sm:flex-row sm:items-center sm:px-5 sm:text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
              PROMO 10 UMKM TERCEPAT
            </span>
            <span className="text-slate-200">
              Paket Pro Bulanan{' '}
              <span className="line-through text-slate-500 tabular-nums">Rp50.000</span>{' '}
              <strong className="font-bold text-emerald-300 tabular-nums">
                Rp20.000 / 1 bulan
              </strong>{' '}
              untuk akses tanpa batas.
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowUpgradeModal(true)}
            className="shrink-0 rounded-xl bg-gradient-to-r from-amber-300 to-amber-400 px-4 py-2 text-xs font-bold text-slate-950 shadow transition hover:-translate-y-0.5 hover:brightness-105"
          >
            Lihat Detail Promo →
          </button>
        </div>

        {/* Efek ambient glow modern */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 top-6 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-28 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl"
        />

        {/* Hero & Animasi Dashboard Jualan Untung vs Jualan Rugi */}
        <section className="relative z-10 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-300 shadow-sm shadow-emerald-500/10">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Kenapa HPP Wajib Dihitung Sebelum Jualan
            </div>

            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              Pastikan Setiap Porsi &amp; Gelas Jualan Kamu{' '}
              <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
                Untung Terukur
              </span>
            </h1>

            <p className="text-base leading-relaxed text-slate-300">
              Harga jual yang cuma ikut-ikutan atau menebak modal bisa bikin jualan kelihatan
              ramai, padahal setelah bahan, kemasan, dan potongan kanal dihitung hasilnya rugi atau
              tipis banget.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/app')}
                className="rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition duration-200 hover:-translate-y-0.5 hover:shadow-emerald-400/35"
              >
                Mulai Hitung HPP Sekarang
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/masuk')}
                className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-6 py-3 text-sm font-medium text-slate-200 backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-900"
              >
                Login / Daftar Akun
              </button>
            </div>
          </div>

          {/* Animasi Dashboard: Jualan Untung vs Jualan Rugi */}
          <div
            className={`rounded-3xl border p-5 shadow-2xl backdrop-blur-xl transition-all duration-500 ${
              isUntung
                ? 'border-emerald-400/40 bg-gradient-to-b from-slate-900/95 via-emerald-950/20 to-slate-950/95 shadow-emerald-950/40'
                : 'border-rose-400/35 bg-gradient-to-b from-slate-900/95 via-rose-950/20 to-slate-950/95 shadow-rose-950/40'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors duration-300 ${
                    isUntung ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isUntung ? 'animate-ping bg-emerald-400' : 'animate-pulse bg-rose-400'
                    }`}
                  />
                  {isUntung
                    ? 'Simulasi: Jualan Untung (Pakai Hitung HPP)'
                    : 'Simulasi: Jualan Rugi (Harga Asal Tebak)'}
                </span>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Contoh: {sampleRecipe.name} &bull; Fee kanal {feePercent}%
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleSelectScenario('rugi')}
                  className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                    !isUntung
                      ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/30'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Rugi
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectScenario('untung')}
                  className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                    isUntung
                      ? 'bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-400/30'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Untung
                </button>
                <button
                  type="button"
                  onClick={() => setIsDashboardAuto((prev) => !prev)}
                  className="rounded-lg border border-slate-700/80 bg-slate-900/90 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-slate-500"
                >
                  {isDashboardAuto ? 'Jeda' : 'Auto'}
                </button>
              </div>
            </div>

            {/* Kartu Angka Utama Beranimasi */}
            <div className="mt-4 grid grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-2xl border border-slate-800/90 bg-slate-950/75 p-3">
                <span className="text-[11px] text-slate-400">Harga Jual</span>
                <p className="mt-1 text-sm font-bold text-white tabular-nums transition-all duration-300 sm:text-base">
                  {formatRupiah(dashboardMetrics.activePrice)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800/90 bg-slate-950/75 p-3">
                <span className="text-[11px] text-slate-400">Laba / Porsi</span>
                <p
                  className={`mt-1 text-sm font-bold tabular-nums transition-all duration-300 sm:text-base ${
                    dashboardMetrics.netProfit >= 0 ? 'text-emerald-300' : 'text-rose-400'
                  }`}
                >
                  {formatRupiah(dashboardMetrics.netProfit)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800/90 bg-slate-950/75 p-3">
                <span className="text-[11px] text-slate-400">
                  {dashboardMetrics.dailyPortions} Porsi / Hari
                </span>
                <p
                  className={`mt-1 text-sm font-bold tabular-nums transition-all duration-300 sm:text-base ${
                    dashboardMetrics.dailyProfit >= 0 ? 'text-cyan-300' : 'text-rose-400'
                  }`}
                >
                  {formatRupiah(dashboardMetrics.dailyProfit)}
                </p>
              </div>
            </div>

            {/* Bar Komposisi Biaya vs Laba Beranimasi */}
            <div className="mt-4 space-y-2 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Aliran dana per porsi:</span>
                <span
                  className={`font-semibold transition-colors duration-300 ${
                    isUntung ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {isUntung
                    ? 'HPP + fee aman, sisa untung terjaga'
                    : 'Terpotong HPP & fee, margin tergerus'}
                </span>
              </div>

              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  style={{ width: `${dashboardMetrics.hppBarPct}%` }}
                  className="bg-amber-400 transition-all duration-500 ease-out"
                  title={`HPP: ${formatRupiah(dashboardMetrics.hpp)}`}
                />
                <div
                  style={{ width: `${dashboardMetrics.feeBarPct}%` }}
                  className="bg-cyan-400 transition-all duration-500 ease-out"
                  title={`Fee kanal: ${formatRupiah(dashboardMetrics.feeAmount)}`}
                />
                <div
                  style={{ width: `${dashboardMetrics.profitBarPct}%` }}
                  className={`transition-all duration-500 ease-out ${
                    isUntung ? 'bg-emerald-400' : 'bg-rose-500'
                  }`}
                  title={`Laba bersih: ${formatRupiah(dashboardMetrics.netProfit)}`}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  HPP {formatRupiah(dashboardMetrics.hpp)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  Fee {formatRupiah(dashboardMetrics.feeAmount)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isUntung ? 'bg-emerald-400' : 'bg-rose-500'
                    }`}
                  />
                  Bersih {formatRupiah(dashboardMetrics.netProfit)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Bagian Testimoni Auto-Geser (Berhenti Saat Diklik) */}
        <section
          aria-label="Testimoni pengguna HPP-Kilat"
          className="relative z-10 rounded-3xl border border-slate-800/90 bg-slate-900/65 p-6 shadow-xl backdrop-blur-xl sm:p-8"
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Cerita Pengguna
              </span>
              <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                Setelah Menggunakan HPP-Kilat
              </h2>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium ${
                  isAutoSliding
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isAutoSliding ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                {isAutoSliding ? 'Geser otomatis aktif' : 'Dijeda (klik kartu untuk pilih)'}
              </span>

              {!isAutoSliding && (
                <button
                  type="button"
                  onClick={() => setIsAutoSliding(true)}
                  className="rounded-full border border-slate-700 bg-slate-800/90 px-3 py-1 font-medium text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-300"
                >
                  Lanjutkan Auto
                </button>
              )}
            </div>
          </div>

          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{
                transform: `translateX(-${activeTestimonialIdx * 100}%)`,
              }}
            >
              {TESTIMONIALS.map((item, idx) => {
                const isSelected = idx === activeTestimonialIdx;
                return (
                  <div key={item.id} className="w-full shrink-0 px-0.5">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectTestimonial(idx)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectTestimonial(idx);
                        }
                      }}
                      className={`cursor-pointer rounded-2xl border p-6 transition duration-200 ${
                        isSelected
                          ? 'border-emerald-400/50 bg-slate-950/90 shadow-lg shadow-emerald-500/10'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 font-bold text-emerald-300 ring-1 ring-emerald-400/30">
                            {item.name
                              .split(' ')
                              .map((part) => part[0])
                              .slice(0, 2)
                              .join('')}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{item.name}</p>
                            <p className="text-xs text-slate-400">
                              {item.role} &bull; {item.business}
                            </p>
                          </div>
                        </div>

                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                          {item.impact}
                        </span>
                      </div>

                      <p className="mt-4 text-sm leading-relaxed text-slate-200 sm:text-base">
                        &ldquo;{item.quote}&rdquo;
                      </p>

                      <p className="mt-4 text-[11px] text-slate-400">
                        Klik pada kartu ini untuk berhenti bergeser otomatis dan fokus membaca.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {TESTIMONIALS.map((item, idx) => {
                const active = idx === activeTestimonialIdx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTestimonial(idx)}
                    aria-label={`Lihat testimoni ${item.name}`}
                    className={`h-2.5 rounded-full transition-all duration-200 ${
                      active
                        ? 'w-8 bg-emerald-400'
                        : 'w-2.5 bg-slate-700 hover:bg-slate-500'
                    }`}
                  />
                );
              })}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  handleSelectTestimonial(
                    (activeTestimonialIdx - 1 + TESTIMONIALS.length) % TESTIMONIALS.length
                  )
                }
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500"
              >
                Sebelumnya
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSelectTestimonial((activeTestimonialIdx + 1) % TESTIMONIALS.length)
                }
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </section>
      </main>

      <UpgradeModal
        open={showUpgradeModal}
        reason="Buka akses tanpa batas resep, bahan baku, dan channel penjualan di HPP-Kilat Pro."
        onClose={() => setShowUpgradeModal(false)}
        onGoToAuth={() => onNavigate('/masuk')}
      />
    </div>
  );
}