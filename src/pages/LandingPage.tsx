import { useMemo } from 'react';
import heroImg from '../assets/hero.png';
import { ReceiptCard } from '../components/ReceiptCard';
import { DEMO_RECIPE } from '../lib/demoData';
import { calculateHpp } from '../lib/pricing';
import type { Ingredient, RecipeCalculation } from '../types';

interface LandingPageProps {
  onNavigate: (to: string) => void;
}

const EMPTY_INGREDIENTS: Record<string, Ingredient> = {};

export function LandingPage({ onNavigate }: LandingPageProps) {
  const sampleRecipe = DEMO_RECIPE;

  const sampleCalc = useMemo<RecipeCalculation>(() => {
    const hppResult = calculateHpp(
      sampleRecipe.items,
      EMPTY_INGREDIENTS,
      sampleRecipe.portions,
      sampleRecipe.extra_cost
    );

    return {
      ...hppResult,
      channels: [],
    };
  }, [sampleRecipe]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-emerald-500 px-2.5 py-1 text-sm font-bold text-slate-950">
              HPP-Kilat
            </span>
            <span className="text-xs text-slate-400">Kalkulator Margin F&amp;B</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/masuk')}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Buka Kalkulator
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-2 lg:items-center">
        <div className="space-y-6">
          <p className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Hitung HPP, Food Cost %, &amp; Harga Jual UMKM Kuliner
          </p>

          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            Pastikan Setiap Porsi &amp; Gelas Jualan Kamu Untung Terukur
          </h1>

          <p className="text-base leading-relaxed text-slate-300">
            Hitung biaya bahan baku per porsi, cek persentase HPP, dan tentukan harga jual
            yang aman untuk usaha makanan dan minuman tanpa ribet rumus manual.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Mulai Hitung Sekarang
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/masuk')}
              className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-600"
            >
              Login / Daftar Akun
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            <img
              src={heroImg}
              alt="Ilustrasi perhitungan HPP usaha kuliner"
              className="h-48 w-full object-cover"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Contoh Simulasi Nota HPP
            </span>
            <span className="text-xs text-slate-400">Data Contoh</span>
          </div>
          <ReceiptCard
            recipeName={sampleRecipe.name}
            portions={sampleRecipe.portions}
            calc={sampleCalc}
            profitMode={sampleRecipe.profit_mode}
            profitValue={sampleRecipe.profit_value}
          />
        </div>
      </main>
    </div>
  );
}