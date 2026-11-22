import { useMemo, useState } from 'react';
import heroImg from '../assets/hero.png';
import { ReceiptCard } from '../components/ReceiptCard';
import { DEMO_CHANNELS, DEMO_INGREDIENTS, DEMO_RECIPE } from '../lib/demoData';
import { calculateRecipePricing, formatRupiah } from '../lib/pricing';
import type { Channel, ProfitMode, RecipeCalculation } from '../types';

interface LandingPageProps {
  onNavigate: (to: string) => void;
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  const sampleRecipe = DEMO_RECIPE;

  const [channels, setChannels] = useState<Channel[]>(DEMO_CHANNELS);
  const [selectedChannelId, setSelectedChannelId] = useState<string>(
    DEMO_CHANNELS[1]?.id ?? DEMO_CHANNELS[0]?.id ?? 'ch-gofood'
  );
  const [profitMode, setProfitMode] = useState<ProfitMode>(sampleRecipe.profit_mode);
  const [profitValue, setProfitValue] = useState<number>(sampleRecipe.profit_value);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const selectedChannel = useMemo(
    () => channels.find((ch) => ch.id === selectedChannelId) ?? channels[0],
    [channels, selectedChannelId]
  );

  const sampleCalc = useMemo<RecipeCalculation>(() => {
    return calculateRecipePricing({
      items: sampleRecipe.items,
      ingredients: DEMO_INGREDIENTS,
      portions: sampleRecipe.portions,
      extraCost: sampleRecipe.extra_cost,
      profitMode,
      profitValue,
      channels,
      roundingStep: 500,
      customPricesByChannel: {},
    });
  }, [sampleRecipe, profitMode, profitValue, channels]);

  const activeChannelCalc = useMemo(
    () =>
      sampleCalc.channels.find((c) => c.channel.id === selectedChannel?.id) ??
      sampleCalc.channels[0],
    [sampleCalc, selectedChannel]
  );

  const handleChannelFeeChange = (nextFee: number) => {
    const safeFee = Number.isFinite(nextFee) ? Math.min(99, Math.max(0, nextFee)) : 0;
    const targetId = selectedChannel?.id;
    if (!targetId) return;

    setChannels((prev) =>
      prev.map((ch) => (ch.id === targetId ? { ...ch, fee_percent: safeFee } : ch))
    );
  };

  const handleCopySummary = async () => {
    const minPriceText =
      activeChannelCalc && !activeChannelCalc.impossibleMargin && activeChannelCalc.minPrice !== null
        ? formatRupiah(activeChannelCalc.minPrice)
        : 'Tidak tercapai';

    const summary = [
      `Simulasi HPP - ${sampleRecipe.name} (${sampleRecipe.portions} porsi)`,
      `Modal per porsi: ${formatRupiah(sampleCalc.hpp)}`,
      `Channel ${activeChannelCalc?.channel.name ?? 'Utama'} (Fee ${
        activeChannelCalc?.channel.fee_percent ?? 0
      }%): Harga jual min ${minPriceText}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(summary);
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      setCopiedSummary(false);
    }
  };

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

      <main className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-2 lg:items-start">
        {/* Efek ambient glow modern */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 top-6 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-28 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl"
        />

        {/* Kolom Kiri: Headline & Preview Visual */}
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-300 shadow-sm shadow-emerald-500/10">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Hitung HPP, Food Cost %, &amp; Harga Jual UMKM Kuliner
          </div>

          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            Pastikan Setiap Porsi &amp; Gelas Jualan Kamu{' '}
            <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
              Untung Terukur
            </span>
          </h1>

          <p className="text-base leading-relaxed text-slate-300">
            Hitung biaya bahan baku per porsi, cek potongan fee GoFood, GrabFood, dan
            ShopeeFood, lalu tentukan harga jual yang aman tanpa ribet hitung manual.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition duration-200 hover:-translate-y-0.5 hover:shadow-emerald-400/35"
            >
              Mulai Hitung Sekarang
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/masuk')}
              className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-6 py-3 text-sm font-medium text-slate-200 backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-900"
            >
              Login / Daftar Akun
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1 text-xs">
            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-3.5 backdrop-blur">
              <p className="text-slate-400">Modal / Porsi</p>
              <p className="mt-1 text-base font-bold text-white tabular-nums">
                {formatRupiah(sampleCalc.hpp)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-3.5 backdrop-blur">
              <p className="text-slate-400">Bahan + Kemasan</p>
              <p className="mt-1 text-base font-bold text-emerald-300 tabular-nums">
                {formatRupiah(
                  sampleCalc.ingredientSubtotalPerPortion + sampleCalc.packagingSubtotalPerPortion
                )}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-3.5 backdrop-blur">
              <p className="text-slate-400">Channel Aktif</p>
              <p className="mt-1 truncate text-base font-bold text-cyan-300">
                {selectedChannel?.name ?? '-'}
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/60 shadow-xl transition duration-300 hover:border-emerald-400/40">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-80 transition duration-300 group-hover:opacity-50" />
            <img
              src={heroImg}
              alt="Ilustrasi perhitungan HPP usaha kuliner"
              className="h-48 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          </div>
        </div>

        {/* Kolom Kanan: Kartu Simulasi Interaktif + Nota */}
        <div className="relative z-10 rounded-3xl border border-slate-800/90 bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-slate-950/90 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl ring-1 ring-white/5 transition duration-300 hover:border-emerald-400/35">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Contoh Simulasi Nota HPP
              </span>
              <p className="text-[11px] text-slate-400">
                Pilih channel &amp; atur target untung langsung di bawah
              </p>
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
              Live Preview
            </span>
          </div>

          {/* Pemilih Channel Cepat */}
          <div className="mb-4 rounded-2xl border border-slate-800/90 bg-slate-950/75 p-3 text-xs">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-slate-400">Simulasi Channel:</span>
              {copiedSummary && (
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                  Ringkasan tersalin!
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {channels.map((ch) => {
                const active = ch.id === selectedChannel?.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChannelId(ch.id)}
                    className={`rounded-xl border px-2.5 py-1.5 text-center transition duration-150 ${
                      active
                        ? 'border-emerald-400/70 bg-emerald-500/15 font-semibold text-emerald-300 shadow-sm shadow-emerald-500/20'
                        : 'border-slate-800 bg-slate-900/90 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span className="block truncate">{ch.name}</span>
                    <span className="block text-[10px] opacity-75">{ch.fee_percent}%</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            key={`${profitMode}-${selectedChannel?.id}`}
            className="transition-all duration-300"
          >
            <ReceiptCard
              recipeName={sampleRecipe.name}
              portions={sampleRecipe.portions}
              calc={sampleCalc}
              profitMode={profitMode}
              profitValue={profitValue}
              onChangeProfitMode={(mode) => {
                setProfitMode(mode);
                setProfitValue(mode === 'percent' ? 40 : 5000);
              }}
              onChangeProfitValue={(val) =>
                setProfitValue(Number.isFinite(val) ? Math.max(0, val) : 0)
              }
              selectedChannelFee={selectedChannel?.fee_percent ?? 0}
              onChangeChannelFee={handleChannelFeeChange}
              interactiveDemo={true}
              onShareReceipt={handleCopySummary}
            />
          </div>
        </div>
      </main>
    </div>
  );
}