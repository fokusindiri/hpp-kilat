import { useEffect, useMemo, useState } from 'react';
import { UpgradeModal } from '../components/UpgradeModal';
import { DEMO_CHANNELS, DEMO_INGREDIENTS, DEMO_RECIPE } from '../lib/demoData';
import { calculateNetProfit, calculateRecipePricing, ceilToStep, formatRupiah } from '../lib/pricing';
import { supabase } from '../lib/supabase';
import type {
  Category,
  Channel,
  Ingredient,
  ProfitMode,
  Recipe,
  RecipeCalculation,
  RoundingStep,
  Unit,
} from '../types';

interface AppShellProps {
  onNavigate: (to: string) => void;
}

type PricePreset = 'bagus' | 'sangat_bagus' | 'profitable' | 'custom';

interface ProductSimState {
  // Fitur 1: Operasional & Batch
  batchQty: number;
  dailyWage: number;
  dailyOutput: number;
  monthlyOverhead: number;
  monthlyOutput: number;
  // Fitur 2 & 3: Channel & Simulasi Terjual
  selectedChannelId: string;
  pricePreset: PricePreset;
  customUnitPrice: number;
  soldUnits: number;
  // Fitur 4: Batch acuan BEP
  bepBatchUnits: number;
}

const DEFAULT_2026_FEES: Record<string, number> = {
  'ch-direct': 0,
  'ch-gofood': 20,
  'ch-shopeefood': 20,
  'ch-grabfood': 25,
};

function createDefaultSim(recipe: Recipe): ProductSimState {
  const defaultBatch = Math.max(100, recipe.portions || 100);
  return {
    batchQty: defaultBatch,
    dailyWage: 100000,
    dailyOutput: 500,
    monthlyOverhead: 2000000,
    monthlyOutput: 10000,
    selectedChannelId: DEMO_CHANNELS[0]?.id ?? 'ch-direct',
    pricePreset: 'bagus',
    customUnitPrice: 15000,
    soldUnits: 100,
    bepBatchUnits: 100,
  };
}

export function AppShell({ onNavigate }: AppShellProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>(DEMO_INGREDIENTS);
  const [recipes, setRecipes] = useState<Recipe[]>([DEMO_RECIPE]);
  const [selectedId, setSelectedId] = useState<string>(DEMO_RECIPE.id);
  const [roundingStep, setRoundingStep] = useState<RoundingStep>(500);
  const [channels, setChannels] = useState<Channel[]>(() =>
    DEMO_CHANNELS.map((ch) => ({
      ...ch,
      fee_percent: DEFAULT_2026_FEES[ch.id] ?? ch.fee_percent,
    }))
  );

  const [simByRecipe, setSimByRecipe] = useState<Record<string, ProductSimState>>(() => ({
    [DEMO_RECIPE.id]: createDefaultSim(DEMO_RECIPE),
  }));

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Input tambah produk baru ke Daftar Produk / Resep
  const [newProductName, setNewProductName] = useState('');

  // Form tambah bahan baku / kemasan yang dibeli (Fitur 1)
  const [newIngName, setNewIngName] = useState('');
  const [newIngCategory, setNewIngCategory] = useState<Category>('bahan');
  const [newIngUnit, setNewIngUnit] = useState<Unit>('gr');
  const [newIngBuyPrice, setNewIngBuyPrice] = useState<number>(20000);
  const [newIngBuyQty, setNewIngBuyQty] = useState<number>(500);
  const [newIngUseQty, setNewIngUseQty] = useState<number>(25);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setUserEmail(data.user?.email ?? null);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUserEmail(session?.user?.email ?? null);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const activeRecipe = recipes.find((item) => item.id === selectedId) ?? recipes[0];

  const activeSim = useMemo<ProductSimState>(() => {
    if (!activeRecipe) return createDefaultSim(DEMO_RECIPE);
    return simByRecipe[activeRecipe.id] ?? createDefaultSim(activeRecipe);
  }, [activeRecipe, simByRecipe]);

  const updateActiveRecipe = (updater: (recipe: Recipe) => Recipe) => {
    if (!activeRecipe) return;
    setRecipes((prev) =>
      prev.map((item) => (item.id === activeRecipe.id ? updater(item) : item))
    );
  };

  const updateActiveSim = (updater: (sim: ProductSimState) => ProductSimState) => {
    if (!activeRecipe) return;
    setSimByRecipe((prev) => {
      const current = prev[activeRecipe.id] ?? createDefaultSim(activeRecipe);
      return {
        ...prev,
        [activeRecipe.id]: updater(current),
      };
    });
  };

  // Biaya operasional per unit: Tenaga Kerja + Overhead
  const laborCostPerUnit = useMemo(() => {
    const safeOutput = activeSim.dailyOutput > 0 ? activeSim.dailyOutput : 1;
    return activeSim.dailyWage / safeOutput;
  }, [activeSim.dailyWage, activeSim.dailyOutput]);

  const overheadCostPerUnit = useMemo(() => {
    const safeMonthlyOutput = activeSim.monthlyOutput > 0 ? activeSim.monthlyOutput : 1;
    return activeSim.monthlyOverhead / safeMonthlyOutput;
  }, [activeSim.monthlyOverhead, activeSim.monthlyOutput]);

  const operationalCostPerUnit = laborCostPerUnit + overheadCostPerUnit;

  // Perhitungan inti resep & channel
  const activeCalc = useMemo<RecipeCalculation>(() => {
    if (!activeRecipe) {
      return {
        ingredientSubtotalPerPortion: 0,
        packagingSubtotalPerPortion: 0,
        extraCostPerPortion: 0,
        hpp: 0,
        lineItems: [],
        channels: [],
      };
    }

    const combinedExtraPerPortion =
      (Number.isFinite(activeRecipe.extra_cost) ? activeRecipe.extra_cost : 0) +
      operationalCostPerUnit;

    return calculateRecipePricing({
      items: activeRecipe.items,
      ingredients,
      portions: Math.max(1, activeRecipe.portions || 1),
      extraCost: combinedExtraPerPortion,
      profitMode: activeRecipe.profit_mode,
      profitValue: activeRecipe.profit_value,
      channels,
      roundingStep,
      customPricesByChannel: {},
    });
  }, [activeRecipe, ingredients, operationalCostPerUnit, channels, roundingStep]);

  // Ringkasan Fitur 1: Total Pembelian Bahan, Total Biaya Lain, Biaya Produksi Total, HPP per Produk
  const batchQty = Math.max(1, activeSim.batchQty || 1);

  const productionSummary = useMemo(() => {
    const materialCostPerUnit =
      activeCalc.ingredientSubtotalPerPortion + activeCalc.packagingSubtotalPerPortion;
    const totalMaterialPurchase = materialCostPerUnit * batchQty;
    const totalOtherCost =
      (operationalCostPerUnit + (activeRecipe?.extra_cost ?? 0)) * batchQty;
    const totalProductionCost = totalMaterialPurchase + totalOtherCost;
    const hppPerUnit = totalProductionCost / batchQty;

    return {
      materialCostPerUnit,
      totalMaterialPurchase,
      totalOtherCost,
      totalProductionCost,
      hppPerUnit,
    };
  }, [activeCalc, batchQty, operationalCostPerUnit, activeRecipe?.extra_cost]);

  // Fitur 2: Saran Harga Jual (Bagus, Sangat Bagus, Profitable) per Channel
  const channelSuggestions = useMemo(() => {
    const hpp = productionSummary.hppPerUnit;

    return channels.map((ch) => {
      const feeRate = Math.min(0.9, Math.max(0, ch.fee_percent / 100));
      const denomBase = 1 - feeRate;

      // Bagus: margin sehat ~45% (standar minimum F&B sehat)
      // Sangat Bagus: margin ~52%
      // Profitable: margin ~60%
      const calcForMargin = (targetMarginPct: number) => {
        const marginRate = targetMarginPct / 100;
        const denom = 1 - feeRate - marginRate;
        if (denom <= 0) {
          const fallback = ceilToStep((hpp + ch.fee_flat) / Math.max(0.1, denomBase), roundingStep);
          const profit = calculateNetProfit(fallback, hpp, ch.fee_percent, ch.fee_flat);
          const margin = fallback > 0 ? (profit / fallback) * 100 : 0;
          return { price: fallback, profit, margin };
        }
        const rawPrice = (hpp + ch.fee_flat) / denom;
        const price = ceilToStep(rawPrice, roundingStep);
        const profit = calculateNetProfit(price, hpp, ch.fee_percent, ch.fee_flat);
        const margin = price > 0 ? (profit / price) * 100 : 0;
        return { price, profit, margin };
      };

      const bagus = calcForMargin(45);
      const sangatBagus = calcForMargin(52);
      const profitable = calcForMargin(60);

      return {
        channel: ch,
        bagus,
        sangatBagus,
        profitable,
      };
    });
  }, [channels, productionSummary.hppPerUnit, roundingStep]);

  const activeChannelSuggestion =
    channelSuggestions.find((item) => item.channel.id === activeSim.selectedChannelId) ??
    channelSuggestions[0];

  // Fitur 3: Harga jual terpilih (Bagus / Sangat Bagus / Profitable / Custom) & simulasi terjual
  const selectedUnitPrice = useMemo(() => {
    if (!activeChannelSuggestion) return activeSim.customUnitPrice;
    if (activeSim.pricePreset === 'bagus') return activeChannelSuggestion.bagus.price;
    if (activeSim.pricePreset === 'sangat_bagus') return activeChannelSuggestion.sangatBagus.price;
    if (activeSim.pricePreset === 'profitable') return activeChannelSuggestion.profitable.price;
    return Math.max(0, activeSim.customUnitPrice);
  }, [activeChannelSuggestion, activeSim.pricePreset, activeSim.customUnitPrice]);

  const selectedFeePercent = activeChannelSuggestion?.channel.fee_percent ?? 0;
  const selectedFeeFlat = activeChannelSuggestion?.channel.fee_flat ?? 0;

  const profitPerUnit = useMemo(() => {
    return calculateNetProfit(
      selectedUnitPrice,
      productionSummary.hppPerUnit,
      selectedFeePercent,
      selectedFeeFlat
    );
  }, [selectedUnitPrice, productionSummary.hppPerUnit, selectedFeePercent, selectedFeeFlat]);

  const selectedMarginPct = useMemo(() => {
    if (selectedUnitPrice <= 0) return 0;
    return (profitPerUnit / selectedUnitPrice) * 100;
  }, [profitPerUnit, selectedUnitPrice]);

  const soldUnits = Math.max(0, activeSim.soldUnits || 0);
  const totalProfitFromSold = profitPerUnit * soldUnits;
  const totalRevenueFromSold = selectedUnitPrice * soldUnits;

  // Fitur 4: Simulasi BEP / Balik Modal
  const bepSim = useMemo(() => {
    const bepBatch = Math.max(1, activeSim.bepBatchUnits || batchQty);
    const totalCostForBepBatch = productionSummary.hppPerUnit * bepBatch;

    if (profitPerUnit <= 0 || selectedUnitPrice <= 0) {
      return {
        bepBatch,
        totalCostForBepBatch,
        bepUnits: null as number | null,
        bepRevenue: null as number | null,
        bepPct: null as number | null,
        surplusUnits: 0,
        surplusProfit: 0,
        isReachable: false,
      };
    }

    const bepUnits = Math.ceil(totalCostForBepBatch / profitPerUnit);
    const bepRevenue = bepUnits * selectedUnitPrice;
    const bepPct = (bepUnits / bepBatch) * 100;
    const surplusUnits = Math.max(0, bepBatch - bepUnits);
    const surplusProfit = surplusUnits * profitPerUnit;

    return {
      bepBatch,
      totalCostForBepBatch,
      bepUnits,
      bepRevenue,
      bepPct,
      surplusUnits,
      surplusProfit,
      isReachable: true,
    };
  }, [activeSim.bepBatchUnits, batchQty, productionSummary.hppPerUnit, profitPerUnit, selectedUnitPrice]);

  // Handler tambah produk ke Daftar Produk / Resep
  const handleAddProduct = () => {
    const cleanName = newProductName.trim() || `Produk Baru ${recipes.length + 1}`;
    const newId = `rec-${Date.now()}`;
    const firstIngredient = ingredients[0];
    const created: Recipe = {
      id: newId,
      name: cleanName,
      portions: 1,
      extra_cost: 0,
      profit_mode: 'percent',
      profit_value: 45,
      items: firstIngredient ? [{ ingredient_id: firstIngredient.id, qty: 10 }] : [],
    };
    setRecipes((prev) => [...prev, created]);
    setSimByRecipe((prev) => ({ ...prev, [newId]: createDefaultSim(created) }));
    setSelectedId(newId);
    setNewProductName('');
  };

  const handleDuplicateRecipe = () => {
    if (!activeRecipe) return;
    const newId = `rec-${Date.now()}`;
    const copy: Recipe = {
      ...activeRecipe,
      id: newId,
      name: `${activeRecipe.name} (Salinan)`,
      items: activeRecipe.items.map((item) => ({ ...item })),
    };
    setRecipes((prev) => [...prev, copy]);
    setSimByRecipe((prev) => ({
      ...prev,
      [newId]: { ...activeSim },
    }));
    setSelectedId(newId);
  };

  const handleDeleteRecipe = (id: string) => {
    if (recipes.length <= 1) return;
    const remaining = recipes.filter((r) => r.id !== id);
    setRecipes(remaining);
    if (selectedId === id) {
      setSelectedId(remaining[0].id);
    }
  };

  // Handler tambah bahan / kemasan ke daftar & resep aktif
  const handleAddIngredient = () => {
    const cleanName = newIngName.trim();
    if (!cleanName || newIngBuyQty <= 0) return;
    const unitPrice = newIngBuyPrice / newIngBuyQty;
    const newId = `ing-${Date.now()}`;
    const created: Ingredient = {
      id: newId,
      name: cleanName,
      category: newIngCategory,
      unit: newIngUnit,
      buy_price: newIngBuyPrice,
      buy_qty: newIngBuyQty,
      price_per_unit: unitPrice,
    };

    setIngredients((prev) => [...prev, created]);
    if (activeRecipe) {
      const useQty = newIngUseQty > 0 ? newIngUseQty : 1;
      updateActiveRecipe((r) => ({
        ...r,
        items: [...r.items, { ingredient_id: newId, qty: useQty }],
      }));
    }
    setNewIngName('');
  };

  const handleAddExistingIngredientToRecipe = (ingredientId: string) => {
    if (!ingredientId || !activeRecipe) return;
    const alreadyExists = activeRecipe.items.some((item) => item.ingredient_id === ingredientId);
    if (alreadyExists) return;
    updateActiveRecipe((r) => ({
      ...r,
      items: [...r.items, { ingredient_id: ingredientId, qty: 1 }],
    }));
  };

  const handleUpdateRecipeItemQty = (ingredientId: string, qty: number) => {
    updateActiveRecipe((r) => ({
      ...r,
      items: r.items.map((item) =>
        item.ingredient_id === ingredientId ? { ...item, qty: Math.max(0, qty) } : item
      ),
    }));
  };

  const handleRemoveRecipeItem = (ingredientId: string) => {
    updateActiveRecipe((r) => ({
      ...r,
      items: r.items.filter((item) => item.ingredient_id !== ingredientId),
    }));
  };

  const handleUpdateChannelFee = (channelId: string, feePercent: number) => {
    const safeFee = Math.min(80, Math.max(0, feePercent));
    setChannels((prev) =>
      prev.map((ch) => (ch.id === channelId ? { ...ch, fee_percent: safeFee } : ch))
    );
  };

  const handleExportPdf = () => {
    window.print();
  };

  const isHealthyMargin = selectedMarginPct >= 45 && profitPerUnit > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 print:bg-white print:text-slate-900">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-card {
            border: 1px solid #cbd5e1 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Topbar */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="rounded-lg bg-gradient-to-r from-emerald-400 to-teal-400 px-3 py-1.5 text-sm font-bold text-slate-950 shadow"
            >
              HPP-Kilat
            </button>
            <span className="text-xs text-slate-400">
              {userEmail ? `Akun: ${userEmail}` : 'Mode Uji Coba / Tamu'}
            </span>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              Standar Margin F&amp;B Sehat &gt; 45%
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
            >
              Ekspor PDF
            </button>
            <button
              type="button"
              onClick={() => setShowUpgrade(true)}
              className="rounded-lg border border-amber-400/40 bg-amber-400/15 px-3.5 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/25"
            >
              Upgrade Pro
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/masuk')}
              className="rounded-lg bg-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950 transition hover:brightness-105"
            >
              {userEmail ? 'Ganti Akun' : 'Masuk / Daftar'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-12">
        {/* Kolom Kiri: Daftar Produk / Resep & Catatan Margin Sehat */}
        <aside className="no-print space-y-5 lg:col-span-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-white">Daftar Produk / Resep</h2>
              <button
                type="button"
                onClick={handleDuplicateRecipe}
                className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-emerald-400/50"
              >
                + Duplikat
              </button>
            </div>

            <div className="mt-3 flex gap-1.5">
              <input
                type="text"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="Nama menu / produk..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddProduct}
                className="shrink-0 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950 hover:brightness-105"
              >
                Tambah
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {recipes.map((rec) => {
                const isSelected = rec.id === activeRecipe?.id;
                return (
                  <div
                    key={rec.id}
                    className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs transition ${
                      isSelected
                        ? 'border-emerald-400/60 bg-emerald-500/10 text-white'
                        : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(rec.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate font-semibold">{rec.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        Batch: {simByRecipe[rec.id]?.batchQty ?? 100} unit
                      </p>
                    </button>
                    {recipes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRecipe(rec.id)}
                        aria-label={`Hapus ${rec.name}`}
                        className="rounded-lg px-1.5 py-1 text-[11px] text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Keterangan Margin Sehat F&B > 45% */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-xs">
            <p className="font-bold text-emerald-300">Acuan Margin Sehat F&amp;B (&gt; 45%)</p>
            <p className="mt-1.5 leading-relaxed text-slate-300">
              Untuk bisnis <strong>minuman dan makanan</strong>, margin bersih ideal berada di atas{' '}
              <strong>45%</strong> agar aman menahan kenaikan harga bahan baku, kemasan, *waste*
              produksi, maupun potongan *platform* pesan-antar.
            </p>
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/80 p-2.5">
              <span className="text-[11px] text-slate-400">Status harga aktif saat ini:</span>
              <p
                className={`mt-0.5 font-bold tabular-nums ${
                  isHealthyMargin ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {selectedMarginPct.toFixed(1)}% &bull;{' '}
                {isHealthyMargin
                  ? 'Sehat (≥ 45%)'
                  : profitPerUnit >= 0
                  ? 'Di bawah 45% (perlu evaluasi)'
                  : 'Rugi / di bawah modal'}
              </p>
            </div>
          </div>
        </aside>

        {/* Kolom Tengah: Fitur 1, Fitur 2, Fitur 3, Fitur 4 */}
        <section className="no-print space-y-6 lg:col-span-5">
          {activeRecipe ? (
            <>
              {/* FITUR 1: Input Data Produk */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                      Fitur 1
                    </span>
                    <h2 className="text-base font-bold text-white">Input Data Produk &amp; HPP</h2>
                  </div>
                  <div className="flex items-center gap-1 text-[11px]">
                    {([100, 500, 1000] as RoundingStep[]).map((step) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => setRoundingStep(step)}
                        className={`rounded-lg px-2 py-1 font-medium ${
                          roundingStep === step
                            ? 'bg-emerald-400 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        Rp{step}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div>
                    <label className="block text-slate-400">Nama Produk / Menu</label>
                    <input
                      type="text"
                      value={activeRecipe.name}
                      onChange={(e) =>
                        updateActiveRecipe((r) => ({ ...r, name: e.target.value }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-emerald-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400">Jumlah Produksi / Batch (unit)</label>
                    <input
                      type="number"
                      min={1}
                      value={activeSim.batchQty}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value) || 1);
                        updateActiveSim((s) => ({
                          ...s,
                          batchQty: val,
                          bepBatchUnits: val,
                        }));
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white tabular-nums focus:border-emerald-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400">Mode Target Untung</label>
                    <select
                      value={activeRecipe.profit_mode}
                      onChange={(e) =>
                        updateActiveRecipe((r) => ({
                          ...r,
                          profit_mode: e.target.value as ProfitMode,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-emerald-400 focus:outline-none"
                    >
                      <option value="percent">Margin Persen (%)</option>
                      <option value="rupiah">Nominal Rupiah (Rp)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400">
                      Target Untung ({activeRecipe.profit_mode === 'percent' ? '%' : 'Rp / unit'})
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={activeRecipe.profit_value}
                      onChange={(e) =>
                        updateActiveRecipe((r) => ({
                          ...r,
                          profit_value: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white tabular-nums focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Sub-bagian: Bahan Baku & Kemasan yang Dibeli */}
                <div className="border-t border-slate-800 pt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-white">
                      Bahan Baku &amp; Kemasan yang Dibeli
                    </h3>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddExistingIngredientToRecipe(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-400 focus:outline-none"
                    >
                      <option value="">+ Pilih dari daftar bahan...</option>
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({ing.category}, {formatRupiah(ing.price_per_unit)}/{ing.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Daftar bahan terpakai di produk ini */}
                  <div className="space-y-2">
                    {activeCalc.lineItems.map(({ ingredient, qty, costPerPortion }) => {
                      const unitCostForOneProduction =
                        ingredient.buy_qty > 0
                          ? (ingredient.buy_price / ingredient.buy_qty) * qty
                          : costPerPortion;

                      return (
                        <div
                          key={ingredient.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-white">{ingredient.name}</p>
                            <p className="text-[11px] text-slate-400">
                              {ingredient.category === 'kemasan' ? 'Kemasan' : 'Bahan'} &bull; Beli:{' '}
                              {formatRupiah(ingredient.buy_price)} / {ingredient.buy_qty}{' '}
                              {ingredient.unit}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={qty}
                              onChange={(e) =>
                                handleUpdateRecipeItemQty(
                                  ingredient.id,
                                  Number(e.target.value) || 0
                                )
                              }
                              className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-right text-white tabular-nums"
                            />
                            <span className="text-[11px] text-slate-400">{ingredient.unit}</span>
                            <span className="w-24 text-right font-semibold text-emerald-300 tabular-nums">
                              {formatRupiah(unitCostForOneProduction)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveRecipeItem(ingredient.id)}
                              className="rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Form tambah bahan/kemasan baru */}
                  <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-3 space-y-2.5 text-xs">
                    <p className="font-semibold text-slate-300">Tambah Bahan / Kemasan Baru</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        type="text"
                        value={newIngName}
                        onChange={(e) => setNewIngName(e.target.value)}
                        placeholder="Nama bahan / cup"
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white placeholder-slate-500"
                      />
                      <select
                        value={newIngCategory}
                        onChange={(e) => setNewIngCategory(e.target.value as Category)}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white"
                      >
                        <option value="bahan">Bahan</option>
                        <option value="kemasan">Kemasan</option>
                      </select>
                      <select
                        value={newIngUnit}
                        onChange={(e) => setNewIngUnit(e.target.value as Unit)}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white"
                      >
                        <option value="gr">gr</option>
                        <option value="ml">ml</option>
                        <option value="pcs">pcs</option>
                      </select>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <div>
                        <span className="text-[11px] text-slate-400">Harga beli (Rp)</span>
                        <input
                          type="number"
                          min={0}
                          value={newIngBuyPrice}
                          onChange={(e) => setNewIngBuyPrice(Math.max(0, Number(e.target.value) || 0))}
                          className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white tabular-nums"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Isi kemasan ({newIngUnit})</span>
                        <input
                          type="number"
                          min={1}
                          value={newIngBuyQty}
                          onChange={(e) => setNewIngBuyQty(Math.max(1, Number(e.target.value) || 1))}
                          className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white tabular-nums"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">
                          Kebutuhan 1 produksi ({newIngUnit})
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={newIngUseQty}
                          onChange={(e) => setNewIngUseQty(Math.max(0, Number(e.target.value) || 0))}
                          className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        Harga satuan 1 produksi:{' '}
                        <strong className="text-emerald-300">
                          {formatRupiah(
                            newIngBuyQty > 0
                              ? (newIngBuyPrice / newIngBuyQty) * newIngUseQty
                              : 0
                          )}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleAddIngredient}
                        className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:brightness-105"
                      >
                        + Simpan Bahan
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sub-bagian: Biaya Operasional (Tenaga Kerja & Overhead) */}
                <div className="border-t border-slate-800 pt-4 space-y-3 text-xs">
                  <h3 className="font-bold text-white">Biaya Operasional per Unit</h3>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 space-y-2">
                    <p className="font-semibold text-slate-200">Biaya Tenaga Kerja per Unit (Rp)</p>
                    <p className="text-[11px] text-slate-400">
                      Rumus: Gaji per hari ÷ jumlah produk per hari (contoh: Rp100.000 ÷ 500 =
                      Rp200)
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[11px] text-slate-400">Gaji / hari (Rp)</span>
                        <input
                          type="number"
                          min={0}
                          value={activeSim.dailyWage}
                          onChange={(e) =>
                            updateActiveSim((s) => ({
                              ...s,
                              dailyWage: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white tabular-nums"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Produk / hari</span>
                        <input
                          type="number"
                          min={1}
                          value={activeSim.dailyOutput}
                          onChange={(e) =>
                            updateActiveSim((s) => ({
                              ...s,
                              dailyOutput: Math.max(1, Number(e.target.value) || 1),
                            }))
                          }
                          className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white tabular-nums"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Tenaga kerja / unit</span>
                        <div className="mt-0.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 font-bold text-emerald-300 tabular-nums">
                          {formatRupiah(laborCostPerUnit)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 space-y-2">
                    <p className="font-semibold text-slate-200">Biaya Overhead per Unit (Rp)</p>
                    <p className="text-[11px] text-slate-400">
                      Rumus: Total biaya bulanan (listrik, sewa, dll) ÷ jumlah produksi (contoh:
                      Rp2.000.000 ÷ 10.000 = Rp200)
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[11px] text-slate-400">Biaya / bulan (Rp)</span>
                        <input
                          type="number"
                          min={0}
                          value={activeSim.monthlyOverhead}
                          onChange={(e) =>
                            updateActiveSim((s) => ({
                              ...s,
                              monthlyOverhead: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white tabular-nums"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Produksi / bulan</span>
                        <input
                          type="number"
                          min={1}
                          value={activeSim.monthlyOutput}
                          onChange={(e) =>
                            updateActiveSim((s) => ({
                              ...s,
                              monthlyOutput: Math.max(1, Number(e.target.value) || 1),
                            }))
                          }
                          className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white tabular-nums"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Overhead / unit</span>
                        <div className="mt-0.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 font-bold text-cyan-300 tabular-nums">
                          {formatRupiah(overheadCostPerUnit)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hasil Perhitungan Fitur 1 */}
                <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-emerald-500/30 bg-slate-950/90 p-3.5 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400">Total Pembelian Bahan</span>
                    <p className="mt-0.5 font-bold text-white tabular-nums">
                      {formatRupiah(productionSummary.totalMaterialPurchase)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">
                      Total Biaya Lain (TK + Overhead)
                    </span>
                    <p className="mt-0.5 font-bold text-white tabular-nums">
                      {formatRupiah(productionSummary.totalOtherCost)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Biaya Produksi Total</span>
                    <p className="mt-0.5 font-bold text-cyan-300 tabular-nums">
                      {formatRupiah(productionSummary.totalProductionCost)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">HPP per Produk</span>
                    <p className="mt-0.5 text-sm font-extrabold text-emerald-300 tabular-nums">
                      {formatRupiah(productionSummary.hppPerUnit)}
                    </p>
                  </div>
                </div>
              </div>

              {/* FITUR 2: Saran Harga Jual (Bagus, Sangat Bagus, Profitable) */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 space-y-3.5">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    Fitur 2 &bull; Standar Platform 2026
                  </span>
                  <h2 className="text-base font-bold text-white">
                    Saran Harga Jual (Bagus, Sangat Bagus, Profitable)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Bandingkan channel penjualan dengan potongan platform 2026 (dapat disesuaikan).
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  {channelSuggestions.map((item) => {
                    const isChannelSelected = item.channel.id === activeSim.selectedChannelId;
                    return (
                      <div
                        key={item.channel.id}
                        className={`rounded-2xl border p-3.5 transition ${
                          isChannelSelected
                            ? 'border-emerald-400/60 bg-slate-950'
                            : 'border-slate-800 bg-slate-950/70'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateActiveSim((s) => ({
                                ...s,
                                selectedChannelId: item.channel.id,
                              }))
                            }
                            className="text-left font-bold text-white hover:text-emerald-300"
                          >
                            {item.channel.name}{' '}
                            {isChannelSelected && (
                              <span className="ml-1 rounded bg-emerald-400/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                                Aktif
                              </span>
                            )}
                          </button>

                          <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span>Fee %</span>
                            <input
                              type="number"
                              min={0}
                              max={80}
                              step="0.5"
                              value={item.channel.fee_percent}
                              onChange={(e) =>
                                handleUpdateChannelFee(
                                  item.channel.id,
                                  Number(e.target.value) || 0
                                )
                              }
                              className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-right text-white tabular-nums"
                            />
                          </label>
                        </div>

                        <div className="mt-2.5 grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateActiveSim((s) => ({
                                ...s,
                                selectedChannelId: item.channel.id,
                                pricePreset: 'bagus',
                              }))
                            }
                            className="rounded-xl border border-slate-800 bg-slate-900/90 p-2 text-left hover:border-emerald-400/50"
                          >
                            <span className="text-[10px] font-semibold text-emerald-300">
                              Bagus (~45%)
                            </span>
                            <p className="mt-0.5 font-bold text-white tabular-nums">
                              {formatRupiah(item.bagus.price)}
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateActiveSim((s) => ({
                                ...s,
                                selectedChannelId: item.channel.id,
                                pricePreset: 'sangat_bagus',
                              }))
                            }
                            className="rounded-xl border border-slate-800 bg-slate-900/90 p-2 text-left hover:border-cyan-400/50"
                          >
                            <span className="text-[10px] font-semibold text-cyan-300">
                              Sangat Bagus (~52%)
                            </span>
                            <p className="mt-0.5 font-bold text-white tabular-nums">
                              {formatRupiah(item.sangatBagus.price)}
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateActiveSim((s) => ({
                                ...s,
                                selectedChannelId: item.channel.id,
                                pricePreset: 'profitable',
                              }))
                            }
                            className="rounded-xl border border-slate-800 bg-slate-900/90 p-2 text-left hover:border-amber-400/50"
                          >
                            <span className="text-[10px] font-semibold text-amber-300">
                              Profitable (~60%)
                            </span>
                            <p className="mt-0.5 font-bold text-white tabular-nums">
                              {formatRupiah(item.profitable.price)}
                            </p>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* FITUR 3: Simulasi Produk Terjual & Profit */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 space-y-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    Fitur 3
                  </span>
                  <h2 className="text-base font-bold text-white">
                    Simulasi Produk Terjual &amp; Profit
                  </h2>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-xs">
                  {(
                    [
                      ['bagus', 'Bagus'],
                      ['sangat_bagus', 'Sangat Bagus'],
                      ['profitable', 'Profitable'],
                      ['custom', 'Custom'],
                    ] as Array<[PricePreset, string]>
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        updateActiveSim((s) => ({
                          ...s,
                          pricePreset: key,
                          customUnitPrice:
                            key === 'custom' && s.customUnitPrice <= 0
                              ? selectedUnitPrice
                              : s.customUnitPrice,
                        }))
                      }
                      className={`rounded-xl py-2 font-semibold transition ${
                        activeSim.pricePreset === key
                          ? 'bg-emerald-400 text-slate-950'
                          : 'border border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div>
                    <label className="block text-slate-400">Harga Jual per Unit (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      value={
                        activeSim.pricePreset === 'custom'
                          ? activeSim.customUnitPrice
                          : selectedUnitPrice
                      }
                      disabled={activeSim.pricePreset !== 'custom'}
                      onChange={(e) =>
                        updateActiveSim((s) => ({
                          ...s,
                          pricePreset: 'custom',
                          customUnitPrice: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white tabular-nums disabled:opacity-75 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400">Jumlah Produk Terjual (unit)</label>
                    <input
                      type="number"
                      min={0}
                      value={activeSim.soldUnits}
                      onChange={(e) =>
                        updateActiveSim((s) => ({
                          ...s,
                          soldUnits: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white tabular-nums focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 rounded-2xl border border-slate-800 bg-slate-950/90 p-3.5 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400">HPP per Produk</span>
                    <p className="mt-0.5 font-bold text-white tabular-nums">
                      {formatRupiah(productionSummary.hppPerUnit)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Profit per Produk</span>
                    <p
                      className={`mt-0.5 font-bold tabular-nums ${
                        profitPerUnit >= 0 ? 'text-emerald-300' : 'text-rose-400'
                      }`}
                    >
                      {formatRupiah(profitPerUnit)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">
                      Total Profit ({soldUnits} unit)
                    </span>
                    <p
                      className={`mt-0.5 text-sm font-extrabold tabular-nums ${
                        totalProfitFromSold >= 0 ? 'text-cyan-300' : 'text-rose-400'
                      }`}
                    >
                      {formatRupiah(totalProfitFromSold)}
                    </p>
                  </div>
                </div>
              </div>

              {/* FITUR 4: Simulasi BEP / Balik Modal */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 space-y-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    Fitur 4
                  </span>
                  <h2 className="text-base font-bold text-white">Simulasi BEP / Balik Modal</h2>
                  <p className="text-xs text-slate-400">
                    Hitung berapa unit terjual agar seluruh biaya produksi tertutup.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div>
                    <label className="block text-slate-400">Total Produksi Disiapkan (unit)</label>
                    <input
                      type="number"
                      min={1}
                      value={bepSim.bepBatch}
                      onChange={(e) =>
                        updateActiveSim((s) => ({
                          ...s,
                          bepBatchUnits: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white tabular-nums focus:border-emerald-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400">Harga Jual Dipilih</label>
                    <div className="mt-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-bold text-white tabular-nums">
                      {formatRupiah(selectedUnitPrice)} / unit
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-slate-800 bg-slate-950/90 p-3.5 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400">Total Biaya Produksi</span>
                    <p className="mt-0.5 font-bold text-white tabular-nums">
                      {formatRupiah(bepSim.totalCostForBepBatch)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[1