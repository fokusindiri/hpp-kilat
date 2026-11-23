import { useEffect, useMemo, useState } from 'react';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { UpgradeModal } from '../components/UpgradeModal';
import { DEMO_CHANNELS, DEMO_INGREDIENTS, DEMO_RECIPE } from '../lib/demoData';
import { calculateNetProfit, calculateRecipePricing, ceilToStep, formatRupiah } from '../lib/pricing';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
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
  batchQty: number;
  dailyWage: number;
  dailyOutput: number;
  monthlyOverhead: number;
  monthlyOutput: number;
  selectedChannelId: string;
  pricePreset: PricePreset;
  customUnitPrice: number;
  soldUnits: number;
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
  const { isDark } = useTheme();

  const surfaceCard = isDark
    ? 'border-slate-800 bg-slate-900/75 text-slate-100'
    : 'border-slate-200 bg-white text-slate-900 shadow-xs';

  const nestedBox = isDark
    ? 'border-slate-800 bg-slate-950/80'
    : 'border-slate-200/90 bg-slate-50';

  const fieldInput = isDark
    ? 'border-slate-700 bg-slate-950 text-white placeholder-slate-500 focus:border-emerald-400'
    : 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white';

  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500';
  const headingText = isDark ? 'text-white' : 'text-slate-900';

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
  const [newProductName, setNewProductName] = useState('');

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

  const laborCostPerUnit = useMemo(() => {
    const safeOutput = activeSim.dailyOutput > 0 ? activeSim.dailyOutput : 1;
    return activeSim.dailyWage / safeOutput;
  }, [activeSim.dailyWage, activeSim.dailyOutput]);

  const overheadCostPerUnit = useMemo(() => {
    const safeMonthlyOutput = activeSim.monthlyOutput > 0 ? activeSim.monthlyOutput : 1;
    return activeSim.monthlyOverhead / safeMonthlyOutput;
  }, [activeSim.monthlyOverhead, activeSim.monthlyOutput]);

  const operationalCostPerUnit = laborCostPerUnit + overheadCostPerUnit;

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

  const channelSuggestions = useMemo(() => {
    const hpp = productionSummary.hppPerUnit;

    return channels.map((ch) => {
      const feeRate = Math.min(0.9, Math.max(0, ch.fee_percent / 100));
      const denomBase = 1 - feeRate;

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

      return {
        channel: ch,
        bagus: calcForMargin(45),
        sangatBagus: calcForMargin(52),
        profitable: calcForMargin(60),
      };
    });
  }, [channels, productionSummary.hppPerUnit, roundingStep]);

  const activeChannelSuggestion =
    channelSuggestions.find((item) => item.channel.id === activeSim.selectedChannelId) ??
    channelSuggestions[0];

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
    <div
      className={`min-h-screen transition-colors duration-300 print:bg-white print:text-slate-900 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
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
      <header
        className={`no-print sticky top-0 z-30 border-b backdrop-blur-xl transition-colors duration-300 ${
          isDark
            ? 'border-slate-800/80 bg-slate-950/85'
            : 'border-slate-200/90 bg-white/85'
        }`}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="rounded-lg bg-gradient-to-r from-emerald-400 to-teal-400 px-3 py-1.5 text-sm font-bold text-slate-950 shadow"
            >
              HPP-Kilat
            </button>
            <span className={`text-xs ${mutedText}`}>
              {userEmail ? `Akun: ${userEmail}` : 'Mode Uji Coba / Tamu'}
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                isDark
                  ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              Standar Margin F&amp;B Sehat &gt; 45%
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggleButton />
            <button
              type="button"
              onClick={handleExportPdf}
              className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                isDark
                  ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Ekspor PDF
            </button>
            <button
              type="button"
              onClick={() => setShowUpgrade(true)}
              className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                isDark
                  ? 'border-amber-400/40 bg-amber-400/15 text-amber-300 hover:bg-amber-400/25'
                  : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
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
          <div className={`rounded-2xl border p-4 ${surfaceCard}`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className={`text-sm font-bold ${headingText}`}>Daftar Produk / Resep</h2>
              <button
                type="button"
                onClick={handleDuplicateRecipe}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium ${
                  isDark
                    ? 'border-slate-700 bg-slate-800/80 text-slate-200 hover:border-emerald-400/50'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-400'
                }`}
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
                className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none ${fieldInput}`}
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
                        ? isDark
                          ? 'border-emerald-400/60 bg-emerald-500/10 text-white'
                          : 'border-emerald-400 bg-emerald-50/80 text-slate-900'
                        : isDark
                        ? 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(rec.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate font-semibold">{rec.name}</p>
                      <p className={`mt-0.5 text-[11px] ${mutedText}`}>
                        Batch: {simByRecipe[rec.id]?.batchQty ?? 100} unit
                      </p>
                    </button>
                    {recipes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRecipe(rec.id)}
                        aria-label={`Hapus ${rec.name}`}
                        className="rounded-lg px-1.5 py-1 text-[11px] text-slate-400 hover:bg-rose-500/15 hover:text-rose-500"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={`rounded-2xl border p-4 text-xs ${
              isDark
                ? 'border-emerald-500/30 bg-emerald-950/20 text-slate-300'
                : 'border-emerald-200 bg-emerald-50/70 text-slate-700'
            }`}
          >
            <p className={`font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
              Acuan Margin Sehat F&amp;B (&gt; 45%)
            </p>
            <p className="mt-1.5 leading-relaxed">
              Untuk bisnis <strong>minuman dan makanan</strong>, margin bersih ideal berada di atas{' '}
              <strong>45%</strong> agar aman menahan kenaikan harga bahan baku, kemasan, *waste*
              produksi, maupun potongan *platform* pesan-antar.
            </p>
            <div className={`mt-3 rounded-xl border p-2.5 ${nestedBox}`}>
              <span className={`text-[11px] ${mutedText}`}>Status harga aktif saat ini:</span>
              <p
                className={`mt-0.5 font-bold tabular-nums ${
                  isHealthyMargin
                    ? isDark
                      ? 'text-emerald-300'
                      : 'text-emerald-700'
                    : isDark
                    ? 'text-amber-300'
                    : 'text-amber-700'
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
              {/* FITUR 1 */}
              <div className={`rounded-2xl border p-5 space-y-4 ${surfaceCard}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider ${
                        isDark ? 'text-emerald-400' : 'text-emerald-700'
                      }`}
                    >
                      Fitur 1
                    </span>
                    <h2 className={`text-base font-bold ${headingText}`}>
                      Input Data Produk &amp; HPP
                    </h2>
                  </div>
                  <div className="flex items-center gap-1 text-[11px]">
                    {([100, 500, 1000] as RoundingStep[]).map((step) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => setRoundingStep(step)}
                        className={`rounded-lg px-2 py-1 font-medium ${
                          roundingStep === step
                            ? 'bg-emerald-400 font-bold text-slate-950'
                            : isDark
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        Rp{step}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div>
                    <label className={`block ${mutedText}`}>Nama Produk / Menu</label>
                    <input
                      type="text"
                      value={activeRecipe.name}
                      onChange={(e) =>
                        updateActiveRecipe((r) => ({ ...r, name: e.target.value }))
                      }
                      className={`mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none ${fieldInput}`}
                    />
                  </div>

                  <div>
                    <label className={`block ${mutedText}`}>Jumlah Produksi / Batch (unit)</label>
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
                      className={`mt-1 w-full rounded-xl border px-3 py-2 tabular-nums focus:outline-none ${fieldInput}`}
                    />
                  </div>

                  <div>
                    <label className={`block ${mutedText}`}>Mode Target Untung</label>
                    <select
                      value={activeRecipe.profit_mode}
                      onChange={(e) =>
                        updateActiveRecipe((r) => ({
                          ...r,
                          profit_mode: e.target.value as ProfitMode,
                        }))
                      }
                      className={`mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none ${fieldInput}`}
                    >
                      <option value="percent">Margin Persen (%)</option>
                      <option value="rupiah">Nominal Rupiah (Rp)</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block ${mutedText}`}>
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
                      className={`mt-1 w-full rounded-xl border px-3 py-2 tabular-nums focus:outline-none ${fieldInput}`}
                    />
                  </div>
                </div>

                {/* Bahan baku & kemasan */}
                <div
                  className={`border-t pt-4 space-y-3 ${
                    isDark ? 'border-slate-800' : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className={`text-xs font-bold ${headingText}`}>
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
                      className={`rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none ${fieldInput}`}
                    >
                      <option value="">+ Pilih dari daftar bahan...</option>
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({ing.category}, {formatRupiah(ing.price_per_unit)}/{ing.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    {activeCalc.lineItems.map(({ ingredient, qty, costPerPortion }) => {
                      const unitCostForOneProduction =
                        ingredient.buy_qty > 0
                          ? (ingredient.buy_price / ingredient.buy_qty) * qty
                          : costPerPortion;

                      return (
                        <div
                          key={ingredient.id}
                          className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2.5 text-xs ${nestedBox}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className={`truncate font-semibold ${headingText}`}>
                              {ingredient.name}
                            </p>
                            <p className={`text-[11px] ${mutedText}`}>
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
                              className={`w-20 rounded-lg border px-2 py-1 text-right tabular-nums ${fieldInput}`}
                            />
                            <span className={`text-[11px] ${mutedText}`}>{ingredient.unit}</span>
                            <span
                              className={`w-24 text-right font-semibold tabular-nums ${
                                isDark ? 'text-emerald-300' : 'text-emerald-700'
                              }`}
                            >
                              {formatRupiah(unitCostForOneProduction)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveRecipeItem(ingredient.id)}
                              className="rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-rose-500/15 hover:text-rose-500"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className={`rounded-xl border p-3 space-y-2.5 text-xs ${nestedBox}`}>
                    <p className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Tambah Bahan / Kemasan Baru
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        type="text"
                        value={newIngName}
                        onChange={(e) => setNewIngName(e.target.value)}
                        placeholder="Nama bahan / cup"
                        className={`rounded-lg border px-2.5 py-1.5 ${fieldInput}`}
                      />
                      <select
                        value={newIngCategory}
                        onChange={(e) => setNewIngCategory(e.target.value as Category)}
                        className={`rounded-lg border px-2.5 py-1.5 ${fieldInput}`}
                      >
                        <option value="bahan">Bahan</option>
                        <option value="kemasan">Kemasan</option>
                      </select>
                      <select
                        value={newIngUnit}
                        onChange={(e) => setNewIngUnit(e.target.value as Unit)}
                        className={`rounded-lg border px-2.5 py-1.5 ${fieldInput}`}
                      >
                        <option value="gr">gr</option>
                        <option value="ml">ml</option>
                        <option value="pcs">pcs</option>
                      </select>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <div>
                        <span className={`text-[11px] ${mutedText}`}>Harga beli (Rp)</span>
                        <input
                          type="number"
                          min={0}
                          value={newIngBuyPrice}
                          onChange={(e) =>
                            setNewIngBuyPrice(Math.max(0, Number(e.target.value) || 0))
                          }
                          className={`mt-0.5 w-full rounded-lg border px-2.5 py-1.5 tabular-nums ${fieldInput}`}
                        />
                      </div>
                      <div>
                        <span className={`text-[11px] ${mutedText}`}>
                          Isi kemasan ({newIngUnit})
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={newIngBuyQty}
                          onChange={(e) =>
                            setNewIngBuyQty(Math.max(1, Number(e.target.value) || 1))
                          }
                          className={`mt-0.5 w-full rounded-lg border px-2.5 py-1.5 tabular-nums ${fieldInput}`}
                        />
                      </div>
                      <div>
                        <span className={`text-[11px] ${mutedText}`}>
                          Kebutuhan 1 produksi ({newIngUnit})
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={newIngUseQty}
                          onChange={(e) =>
                            setNewIngUseQty(Math.max(0, Number(e.target.value) || 0))
                          }
                          className={`mt-0.5 w-full rounded-lg border px-2.5 py-1.5 tabular-nums ${fieldInput}`}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className={`text-[11px] tabular-nums ${mutedText}`}>
                        Harga satuan 1 produksi:{' '}
                        <strong className={isDark ? 'text-emerald-300' : 'text-emerald-700'}>
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

                {/* Biaya operasional */}
                <div
                  className={`border-t pt-4 space-y-3 text-xs ${
                    isDark ? 'border-slate-800' : 'border-slate-200'
                  }`}
                >
                  <h3 className={`font-bold ${headingText}`}>Biaya Operasional per Unit</h3>

                  <div className={`rounded-xl border p-3 space-y-2 ${nestedBox}`}>
                    <p className={`font-semibold ${headingText}`}>
                      Biaya Tenaga Kerja per Unit (Rp)
                    </p>
                    <p className={`text-[11px] ${mutedText}`}>
                      Rumus: Gaji per hari ÷ jumlah produk per hari (contoh: Rp100.000 ÷ 500 =
                      Rp200)
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className={`text-[11px] ${mutedText}`}>Gaji / hari (Rp)</span>
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
                          className={`mt-0.5 w-full rounded-lg border px-2.5 py-1.5 tabular-nums ${fieldInput}`}
                        />
                      </div>
                      <div>
                        <span className={`text-[11px] ${mutedText}`}>Produk / hari</span>
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
                          className={`mt-0.5 w-full rounded-lg border px-2.5 py-1.5 tabular-nums ${fieldInput}`}
                        />
                      </div>
                      <div>
                        <span className={`text-[11px] ${mutedText}`}>Tenaga kerja / unit</span>
                        <div
                          className={`mt-0.5 rounded-lg border px-2.5 py-1.5 font-bold tabular-nums ${
                            isDark
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {formatRupiah(laborCostPerUnit)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`rounded-xl border p-3 space-y-2 ${nestedBox}`}>
                    <p className={`font-semibold ${headingText}`}>Biaya Overhead per Unit (Rp)</p>
                    <p className={`text-[11px] ${mutedText}`}>
                      Rumus: Total biaya bulanan (listrik, sewa, dll) ÷ jumlah produksi (contoh:
                      Rp2.000.000 ÷ 10.000 = Rp200)
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className={`text-[11px] ${mutedText}`}>Biaya / bulan (Rp)</span>
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
                          className={`mt-0.5 w-full rounded-lg border px-2.5 py-1.5 tabular-nums ${fieldInput}`}
                        />
                      </div>
                      <div>
                        <span className={`text-[11px] ${mutedText}`}>Produksi / bulan</span>
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
                          className={`mt-0.5 w-full rounded-lg border px-2.5 py-1.5 tabular-nums ${fieldInput}`}
                        />
                      </div>
                      <div>
                        <span className={`text-[11px] ${mutedText}`}>Overhead / unit</span>
                        <div
                          className={`mt-0.5 rounded-lg border px-2.5 py-1.5 font-bold tabular-nums ${
                            isDark
                              ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                              : 'border-cyan-200 bg-cyan-50 text-cyan-800'
                          }`}
                        >
                          {formatRupiah(overheadCostPerUnit)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hasil Perhitungan Fitur 1 */}
                <div className={`grid grid-cols-2 gap-2.5 rounded-2xl border p-3.5 text-xs ${nestedBox}`}>
                  <div>
                    <span className={`text-[11px] ${mutedText}`}>Total Pembelian Bahan</span>
                    <p className={`mt-0.5 font-bold tabular-nums ${headingText}`}>
                      {formatRupiah(productionSummary.totalMaterialPurchase)}
                    </p>
                  </div>
                  <div>
                    <span className={`text-[11px] ${mutedText}`}>
                      Total Biaya Lain (TK + Overhead)
                    </span>
                    <p className={`mt-0.5 font-bold tabular-nums ${headingText}`}>
                      {formatRupiah(productionSummary.totalOtherCost)}
                    </p>
                  </div>
                  <div>
                    <span className={`text-[11px] ${mutedText}`}>Biaya Produksi Total</span>
                    <p
                      className={`mt-0.5 font-bold tabular-nums ${
                        isDark ? 'text-cyan-300' : 'text-cyan-700'
                      }`}
                    >
                      {formatRupiah(productionSummary.totalProductionCost)}
                    </p>
                  </div>
                  <div>
                    <span className={`text-[11px] ${mutedText}`}>HPP per Produk</span>
                    <p
                      className={`mt-0.5 text-sm font-extrabold tabular-nums ${
                        isDark ? 'text-emerald-300' : 'text-emerald-700'
                      }`}
                    >
                      {formatRupiah(productionSummary.hppPerUnit)}
                    </p>
                  </div>
                </div>
              </div>

              {/* FITUR 2 */}
              <div className={`rounded-2xl border p-5 space-y-3.5 ${surfaceCard}`}>
                <div>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      isDark ? 'text-emerald-400' : 'text-emerald-700'
                    }`}
                  >
                    Fitur 2 &bull; Standar Platform 2026
                  </span>
                  <h2 className={`text-base font-bold ${headingText}`}>
                    Saran Harga Jual (Bagus, Sangat Bagus, Profitable)
                  </h2>
                  <p className={`text-xs ${mutedText}`}>
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
                            ? isDark
                              ? 'border-emerald-400/60 bg-slate-950'
                              : 'border-emerald-400 bg-emerald-50/35'
                            : nestedBox
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
                            className={`text-left font-bold hover:text-emerald-500 ${headingText}`}
                          >
                            {item.channel.name}{' '}
                            {isChannelSelected && (
                              <span
                                className={`ml-1 rounded px-1.5 py-0.5 text-[10px] ${
                                  isDark
                                    ? 'bg-emerald-400/20 text-emerald-300'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                Aktif
                              </span>
                            )}
                          </button>

                          <label className={`flex items-center gap-1.5 text-[11px] ${mutedText}`}>
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
                              className={`w-16 rounded-lg border px-2 py-1 text-right tabular-nums ${fieldInput}`}
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
                            className={`rounded-xl border p-2 text-left hover:border-emerald-400 ${
                              isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-white'
                            }`}
                          >
                            <span
                              className={`text-[10px] font-semibold ${
                                isDark ? 'text-emerald-300' : 'text-emerald-700'
                              }`}
                            >
                              Bagus (~45%)
                            </span>
                            <p className={`mt-0.5 font-bold tabular-nums ${headingText}`}>
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
                            className={`rounded-xl border p-2 text-left hover:border-cyan-400 ${
                              isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-white'
                            }`}
                          >
                            <span
                              className={`text-[10px] font-semibold ${
                                isDark ? 'text-cyan-300' : 'text-cyan-700'
                              }`}
                            >
                              Sangat Bagus (~52%)
                            </span>
                            <p className={`mt-0.5 font-bold tabular-nums ${headingText}`}>
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
                            className={`rounded-xl border p-2 text-left hover:border-amber-400 ${
                              isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-white'
                            }`}
                          >
                            <span
                              className={`text-[10px] font-semibold ${
                                isDark ? 'text-amber-300' : 'text-amber-700'
                              }`}
                            >
                              Profitable (~60%)
                            </span>
                            <p className={`mt-0.5 font-bold tabular-nums ${headingText}`}>
                              {formatRupiah(item.profitable.price)}
                            </p>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* FITUR 3 */}
              <div className={`rounded-2xl border p-5 space-y-4 ${surfaceCard}`}>
                <div>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      isDark ? 'text-emerald-400' : 'text-emerald-700'
                    }`}
                  >
                    Fitur 3
                  </span>
                  <h2 className={`text-base font-bold ${headingText}`}>
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
                          : isDark
                          ? 'border border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'
                          : 'border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div>
                    <label className={`block ${mutedText}`}>Harga Jual per Unit (Rp)</label>
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
                      className={`mt-1 w-full rounded-xl border px-3 py-2 tabular-nums disabled:opacity-75 focus:outline-none ${fieldInput}`}
                    />
                  </div>

                  <div>
                    <label className={`block ${mutedText}`}>Jumlah Produk Terjual (unit)</label>
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
                      className={`mt-1 w-full rounded-xl border px-3 py-2 tabular-nums focus:outline-none ${fieldInput}`}
                    />
                  </div>
                </div>

                <div className={`grid grid-cols-3 gap-2.5 rounded-2xl border p-3.5 text-xs ${nestedBox}`}>
                  <div>
                    <span className={`text-[11px] ${mutedText}`}>HPP per Produk</span>
                    <p className={`mt-0.5 font-bold tabular-nums ${headingText}`}>
                      {formatRupiah(productionSummary.hppPerUnit)}
                    </p>
                  </div>
                  <div>
                    <span className={`text-[11px] ${mutedText}`}>Profit per Produk</span>
                    <p
                      className={`mt-0.5 font-bold tabular-nums ${
                        profitPerUnit >= 0
                          ? isDark
                            ? 'text-emerald-300'
                            : 'text-emerald-700'
                          : isDark
                          ? 'text-rose-400'
                          : 'text-rose-600'
                      }`}
                    >
                      {formatRupiah(profitPerUnit)}
                    </p>
                  </div>
                  <div>
                    <span className={`text-[11px] ${mutedText}`}>
                      Total Profit ({soldUnits} unit)
                    </span>
                    <p
                      className={`mt-0.5 text-sm font-extrabold tabular-nums ${
                        totalProfitFromSold >= 0
                          ? isDark
                            ? 'text-cyan-300'
                            : 'text-cyan-700'
                          : isDark
                          ? 'text-rose-400'
                          : 'text-rose-600'
                      }`}
                    >
                      {formatRupiah(totalProfitFromSold)}
                    </p>
                  </div>
                </div>
              </div>

              {/* FITUR 4 */}
              <div className={`rounded-2xl border p-5 space-y-4 ${surfaceCard}`}>
                <div>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      isDark ? 'text-emerald-400' : 'text-emerald-700'
                    }`}
                  >
                    Fitur 4
                  </span>
                  <h2 className={`text-base font-bold ${headingText}`}>
                    Simulasi BEP / Balik Modal
                  </h2>
                  <p className={`text-xs ${mutedText}`}>
                    Hitung berapa unit terjual agar seluruh biaya produksi tertutup.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div>
                    <label className={`block ${mutedText}`}>Total Produksi Disiapkan (unit)</label>
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
                      className={`mt-1 w-full rounded-xl border px-3 py-2 tabular-nums focus:outline-none ${fieldInput}`}
                    />
                  </div>

                  <div>
                    <label className={`block ${mutedText}`}>Harga Jual Dipilih</label>
                    <div
                      className={`mt-1 rounded-xl border px-3 py-2 font-bold tabular-nums ${nestedBox} ${headingText}`}
                    >
                      {formatRupiah(selectedUnitPrice)} / unit
                    </div>
                  </div>
                </div>

                <div className={`grid grid-cols-2 gap-2.5 rounded-2xl border p-3.5 text-xs ${nestedBox}`}>
                  <div>
                    <span className={`text-[11px] ${mutedText}`}>Total Biaya Produksi</span>
                    <p className={`mt-0.5 font-bold tabular-nums ${headingText}`}>
                      {formatRupiah(bepSim.totalCostForBepBatch)}
                    </p>
                  </div>
                  <div>
                    <span className={`text-[11px] ${mutedText}`}>BEP (Unit Terjual)</span>
                    <p
                      className={`mt-0.5 font-bold tabular-nums ${
                        isDark ? 'text-emerald-300' : 'text-emerald-700'
                      }`}
                    >
                      {bepSim.bepUnits !== null ? `${bepSim.bepUnits} unit` : 'Belum tercapai'}
                    </p>
                  </div>
                  <div>
                    <span className={`text-[11px] ${mutedText}`}>BEP (Omzet)</span>
                    <p
                      className={`mt-0.5 font-bold tabular-nums ${
                        isDark ? 'text-cyan-300' : 'text-cyan-700'
                      }`}
                    >
                      {bepSim.bepRevenue !== null ? formatRupiah(bepSim.bepRevenue) : '-'}
                    </p>
                  </div>
                  <div>
                    <span className={`text-[11px] ${mutedText}`}>
                      Dari {bepSim.bepBatch} Unit Produksi
                    </span>
                    <p className={`mt-0.5 font-bold tabular-nums ${headingText}`}>
                      {bepSim.bepPct !== null
                        ? `BEP di ${bepSim.bepUnits} unit (${bepSim.bepPct.toFixed(1)}%)`
                        : '-'}
                    </p>
                  </div>
                  <div
                    className={`col-span-2 flex items-center justify-between border-t pt-2 ${
                      isDark ? 'border-slate-800' : 'border-slate-200'
                    }`}
                  >
                    <span className={`text-[11px] ${mutedText}`}>Sisa Unit Murni Profit</span>
                    <span
                      className={`font-bold tabular-nums ${
                        isDark ? 'text-emerald-300' : 'text-emerald-700'
                      }`}
                    >
                      {bepSim.surplusUnits} unit ({formatRupiah(bepSim.surplusProfit)})
                    </span>
                  </div>
                </div>

                <div
                  className={`rounded-xl border p-3 text-xs leading-relaxed ${
                    isDark
                      ? 'border-cyan-500/25 bg-cyan-950/20 text-slate-200'
                      : 'border-cyan-200 bg-cyan-50/70 text-slate-700'
                  }`}
                >
                  {bepSim.isReachable && bepSim.bepUnits !== null ? (
                    <>
                      Contoh simulasi: Dengan <strong>{bepSim.bepBatch} unit</strong> terjual pada
                      harga <strong>{formatRupiah(selectedUnitPrice)}</strong>, kamu balik modal
                      setelah terjual <strong>{bepSim.bepUnits} unit</strong>, dan sisa{' '}
                      <strong>{bepSim.surplusUnits} unit</strong> menghasilkan profit bersih{' '}
                      <strong
                        className={`tabular-nums ${
                          isDark ? 'text-emerald-300' : 'text-emerald-700'
                        }`}
                      >
                        {formatRupiah(bepSim.surplusProfit)}
                      </strong>
                      .
                    </>
                  ) : (
                    <>
                      Naikkan harga jual atau tekan biaya per unit agar profit per unit positif dan
                      titik balik modal (BEP) dapat tercapai.
                    </>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </section>

        {/* Kolom Kanan: Preview Ringkasan & Ekspor PDF */}
        <section className="lg:col-span-4">
          <div
            className={`print-card sticky top-20 rounded-2xl border p-5 space-y-4 ${
              isDark ? 'border-slate-800 bg-slate-900/85 shadow-xl' : 'border-slate-200 bg-white shadow-sm'
            }`}
          >
            <div
              className={`flex items-start justify-between gap-2 border-b pb-3 ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <div>
                <p
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    isDark ? 'text-emerald-400' : 'text-emerald-700'
                  }`}
                >
                  Preview Laporan HPP
                </p>
                <h2 className={`text-lg font-bold ${headingText}`}>
                  {activeRecipe?.name ?? 'Produk'}
                </h2>
                <p className={`text-xs ${mutedText}`}>
                  Channel: {activeChannelSuggestion?.channel.name ?? 'Jual Langsung'} (Fee{' '}
                  {selectedFeePercent}%)
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportPdf}
                className="no-print rounded-xl bg-emerald-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:brightness-105"
              >
                Ekspor PDF
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className={mutedText}>Total Pembelian Bahan</span>
                <span className="font-semibold tabular-nums">
                  {formatRupiah(productionSummary.totalMaterialPurchase)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={mutedText}>Total Biaya Lain (TK + Overhead)</span>
                <span className="font-semibold tabular-nums">
                  {formatRupiah(productionSummary.totalOtherCost)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={mutedText}>Biaya Produksi Total</span>
                <span className="font-semibold tabular-nums">
                  {formatRupiah(productionSummary.totalProductionCost)}
                </span>
              </div>
              <div
                className={`flex justify-between border-t pt-2 text-sm ${
                  isDark ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                <span className="font-bold">HPP per Produk</span>
                <span
                  className={`font-extrabold tabular-nums ${
                    isDark ? 'text-emerald-300' : 'text-emerald-700'
                  }`}
                >
                  {formatRupiah(productionSummary.hppPerUnit)}
                </span>
              </div>
            </div>

            <div className={`rounded-xl border p-3 print:border-slate-300 print:bg-slate-50 space-y-1.5 text-xs ${nestedBox}`}>
              <p className={`font-bold ${headingText}`}>
                Saran Harga ({activeChannelSuggestion?.channel.name})
              </p>
              <div className="flex justify-between tabular-nums">
                <span>Bagus</span>
                <span className="font-semibold">
                  {formatRupiah(activeChannelSuggestion?.bagus.price ?? 0)}
                </span>
              </div>
              <div className="flex justify-between tabular-nums">
                <span>Sangat Bagus</span>
                <span className="font-semibold">
                  {formatRupiah(activeChannelSuggestion?.sangatBagus.price ?? 0)}
                </span>
              </div>
              <div className="flex justify-between tabular-nums">
                <span>Profitable</span>
                <span className="font-semibold">
                  {formatRupiah(activeChannelSuggestion?.profitable.price ?? 0)}
                </span>
              </div>
            </div>

            <div className={`rounded-xl border p-3 print:border-slate-300 print:bg-slate-50 space-y-1.5 text-xs ${nestedBox}`}>
              <p className={`font-bold ${headingText}`}>
                Simulasi Terjual ({soldUnits} unit) &amp; BEP
              </p>
              <div className="flex justify-between tabular-nums">
                <span>Harga Jual / Profit per Unit</span>
                <span className="font-semibold">
                  {formatRupiah(selectedUnitPrice)} / {formatRupiah(profitPerUnit)}
                </span>
              </div>
              <div className="flex justify-between tabular-nums">
                <span>Omzet / Total Profit</span>
                <span
                  className={`font-bold ${
                    isDark ? 'text-cyan-300' : 'text-cyan-700'
                  }`}
                >
                  {formatRupiah(totalRevenueFromSold)} / {formatRupiah(totalProfitFromSold)}
                </span>
              </div>
              <div className="flex justify-between tabular-nums">
                <span>Titik BEP</span>
                <span className="font-semibold">
                  {bepSim.bepUnits !== null
                    ? `${bepSim.bepUnits} unit (${formatRupiah(bepSim.bepRevenue ?? 0)})`
                    : '-'}
                </span>
              </div>
            </div>

            <p className={`text-[11px] ${mutedText}`}>
              Catatan F&amp;B: Margin minuman &amp; makanan disarankan &gt; 45%. Saat klik Ekspor
              PDF, pilih &ldquo;Save as PDF&rdquo; pada dialog cetak browser.
            </p>
          </div>
        </section>
      </main>

      <UpgradeModal
        open={showUpgrade}
        reason="Buka akses tanpa batas resep, bahan baku, dan channel penjualan di HPP-Kilat Pro."
        userEmail={userEmail ?? undefined}
        onClose={() => setShowUpgrade(false)}
        onGoToAuth={() => onNavigate('/masuk')}
      />
    </div>
  );
}