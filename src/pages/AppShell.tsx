import { useEffect, useMemo, useState } from 'react';
import { ReceiptCard } from '../components/ReceiptCard';
import { UpgradeModal } from '../components/UpgradeModal';
import { DEMO_CHANNELS, DEMO_INGREDIENTS, DEMO_RECIPE } from '../lib/demoData';
import { calculateRecipePricing, formatRupiah } from '../lib/pricing';
import { supabase } from '../lib/supabase';
import type {
  Category,
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

export function AppShell({ onNavigate }: AppShellProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>(DEMO_INGREDIENTS);
  const [recipes, setRecipes] = useState<Recipe[]>([DEMO_RECIPE]);
  const [selectedId, setSelectedId] = useState<string>(DEMO_RECIPE.id);
  const [roundingStep, setRoundingStep] = useState<RoundingStep>(500);
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Form tambah bahan/kemasan baru
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

  const updateActiveRecipe = (updater: (recipe: Recipe) => Recipe) => {
    if (!activeRecipe) return;
    setRecipes((prev) =>
      prev.map((item) => (item.id === activeRecipe.id ? updater(item) : item))
    );
  };

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

    return calculateRecipePricing({
      items: activeRecipe.items,
      ingredients,
      portions: activeRecipe.portions,
      extraCost: activeRecipe.extra_cost,
      profitMode: activeRecipe.profit_mode,
      profitValue: activeRecipe.profit_value,
      channels: DEMO_CHANNELS,
      roundingStep,
      customPricesByChannel: customPrices,
    });
  }, [activeRecipe, ingredients, roundingStep, customPrices]);

  const handleAddSampleRecipe = () => {
    const base = activeRecipe ?? DEMO_RECIPE;
    const nextIndex = recipes.length + 1;
    const newItem: Recipe = {
      ...base,
      id: `custom-${Date.now()}`,
      name: `${base.name} #${nextIndex}`,
      items: base.items.map((item) => ({ ...item })),
    };
    setRecipes((prev) => [newItem, ...prev]);
    setSelectedId(newItem.id);
  };

  const handleItemQtyChange = (ingredientId: string, qty: number) => {
    updateActiveRecipe((recipe) => ({
      ...recipe,
      items: recipe.items.map((item) =>
        item.ingredient_id === ingredientId
          ? { ...item, qty: Number.isFinite(qty) && qty >= 0 ? qty : 0 }
          : item
      ),
    }));
  };

  const handleRemoveItem = (ingredientId: string) => {
    updateActiveRecipe((recipe) => ({
      ...recipe,
      items: recipe.items.filter((item) => item.ingredient_id !== ingredientId),
    }));
  };

  const handleAddExistingIngredient = (ingredientId: string) => {
    if (!ingredientId || !activeRecipe) return;
    updateActiveRecipe((recipe) => {
      const existing = recipe.items.find((i) => i.ingredient_id === ingredientId);
      if (existing) {
        return {
          ...recipe,
          items: recipe.items.map((i) =>
            i.ingredient_id === ingredientId ? { ...i, qty: i.qty + 1 } : i
          ),
        };
      }
      return {
        ...recipe,
        items: [...recipe.items, { ingredient_id: ingredientId, qty: 10 }],
      };
    });
  };

  const handleCreateIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newIngName.trim();
    if (!cleanName || newIngBuyQty <= 0) return;

    const pricePerUnit = newIngBuyPrice / newIngBuyQty;
    const created: Ingredient = {
      id: `ing-${Date.now()}`,
      name: cleanName,
      category: newIngCategory,
      unit: newIngUnit,
      buy_price: Math.max(0, newIngBuyPrice),
      buy_qty: newIngBuyQty,
      price_per_unit: pricePerUnit,
    };

    setIngredients((prev) => [...prev, created]);
    updateActiveRecipe((recipe) => ({
      ...recipe,
      items: [
        ...recipe.items,
        {
          ingredient_id: created.id,
          qty: newIngUseQty > 0 ? newIngUseQty : 1,
        },
      ],
    }));

    setNewIngName('');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onNavigate('/masuk');
  };

  const ingredientsById = useMemo(() => {
    const map: Record<string, Ingredient> = {};
    for (const ing of ingredients) map[ing.id] = ing;
    return map;
  }, [ingredients]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="rounded-lg bg-emerald-500 px-2.5 py-1 text-sm font-bold text-slate-950"
            >
              HPP-Kilat
            </button>
            <span className="text-xs text-slate-400">
              {userEmail ? `Masuk sebagai ${userEmail}` : 'Mode Uji Coba / Tamu'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowUpgrade(true)}
              className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/20"
            >
              Upgrade Pro
            </button>

            {userEmail ? (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                Keluar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('/masuk')}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Masuk / Daftar
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-12">
        {/* Kolom Kiri: Daftar Resep & Pengaturan */}
        <aside className="space-y-4 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Daftar Produk / Resep</h2>
            <button
              type="button"
              onClick={handleAddSampleRecipe}
              className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-slate-700"
            >
              + Duplikat
            </button>
          </div>

          <div className="space-y-2">
            {recipes.map((recipe) => {
              const isSelected = recipe.id === activeRecipe?.id;
              return (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => setSelectedId(recipe.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{recipe.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Porsi: {recipe.portions} • Target:{' '}
                    {recipe.profit_mode === 'percent'
                      ? `${recipe.profit_value}%`
                      : formatRupiah(recipe.profit_value)}
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Kolom Tengah: Form Kalkulator HPP, Bahan, & Channel */}
        <section className="space-y-6 lg:col-span-5">
          {activeRecipe ? (
            <>
              <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h2 className="text-base font-bold text-white">Parameter Produk &amp; Target</h2>

                <div>
                  <label className="mb-1 block text-xs text-slate-400">Nama Produk / Menu</label>
                  <input
                    type="text"
                    value={activeRecipe.name}
                    onChange={(e) =>
                      updateActiveRecipe((r) => ({ ...r, name: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Jumlah Porsi / Batch</label>
                    <input
                      type="number"
                      min={1}
                      value={activeRecipe.portions}
                      onChange={(e) =>
                        updateActiveRecipe((r) => ({
                          ...r,
                          portions: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-400">
                      Biaya Tambahan / Porsi (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={activeRecipe.extra_cost}
                      onChange={(e) =>
                        updateActiveRecipe((r) => ({
                          ...r,
                          extra_cost: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Mode Target Untung</label>
                    <select
                      value={activeRecipe.profit_mode}
                      onChange={(e) =>
                        updateActiveRecipe((r) => ({
                          ...r,
                          profit_mode: e.target.value as ProfitMode,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    >
                      <option value="rupiah">Nominal Rupiah (Rp)</option>
                      <option value="percent">Margin Persen (%)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-400">
                      {activeRecipe.profit_mode === 'percent'
                        ? 'Target Margin (%)'
                        : 'Target Untung / Porsi (Rp)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={activeRecipe.profit_mode === 'percent' ? 1 : 500}
                      value={activeRecipe.profit_value}
                      onChange={(e) =>
                        updateActiveRecipe((r) => ({
                          ...r,
                          profit_value: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Pembulatan Harga Jual
                  </label>
                  <div className="flex gap-2">
                    {([100, 500, 1000] as RoundingStep[]).map((step) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => setRoundingStep(step)}
                        className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition ${
                          roundingStep === step
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                            : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        Rp {step}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Komposisi Bahan & Kemasan */}
              <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-white">Bahan Baku &amp; Kemasan</h2>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      handleAddExistingIngredient(e.target.value);
                      e.target.value = '';
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <option value="" disabled>
                      + Pilih dari daftar...
                    </option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({formatRupiah(ing.price_per_unit)}/{ing.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  {activeRecipe.items.map((item) => {
                    const ing = ingredientsById[item.ingredient_id];
                    if (!ing) return null;
                    const lineTotal = item.qty * ing.price_per_unit;
                    return (
                      <div
                        key={item.ingredient_id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-white">{ing.name}</p>
                          <p className="text-slate-400">
                            {ing.category === 'kemasan' ? 'Kemasan' : 'Bahan'} •{' '}
                            {formatRupiah(ing.price_per_unit)}/{ing.unit}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={item.qty}
                            onChange={(e) =>
                              handleItemQtyChange(item.ingredient_id, Number(e.target.value))
                            }
                            className="w-20 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-right text-white"
                          />
                          <span className="w-8 text-slate-400">{ing.unit}</span>
                        </div>

                        <div className="w-24 text-right font-semibold text-emerald-300">
                          {formatRupiah(lineTotal / Math.max(1, activeRecipe.portions))}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.ingredient_id)}
                          className="rounded px-1.5 py-1 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400"
                          title="Hapus item"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>

                <form
                  onSubmit={handleCreateIngredient}
                  className="space-y-2.5 border-t border-slate-800 pt-4 text-xs"
                >
                  <p className="font-semibold text-slate-300">Tambah Bahan / Kemasan Baru</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Nama (misal: Es batu / Cup)"
                      value={newIngName}
                      onChange={(e) => setNewIngName(e.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                    />
                    <div className="flex gap-1.5">
                      <select
                        value={newIngCategory}
                        onChange={(e) => setNewIngCategory(e.target.value as Category)}
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                      >
                        <option value="bahan">Bahan</option>
                        <option value="kemasan">Kemasan</option>
                      </select>
                      <select
                        value={newIngUnit}
                        onChange={(e) => setNewIngUnit(e.target.value as Unit)}
                        className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                      >
                        <option value="gr">gr</option>
                        <option value="ml">ml</option>
                        <option value="pcs">pcs</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[11px] text-slate-400">Harga beli (Rp)</span>
                      <input
                        type="number"
                        min={0}
                        value={newIngBuyPrice}
                        onChange={(e) => setNewIngBuyPrice(Number(e.target.value) || 0)}
                        className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400">Isi kemasan</span>
                      <input
                        type="number"
                        min={1}
                        value={newIngBuyQty}
                        onChange={(e) => setNewIngBuyQty(Math.max(1, Number(e.target.value) || 1))}
                        className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400">Pakai / batch</span>
                      <input
                        type="number"
                        min={0.1}
                        step="any"
                        value={newIngUseQty}
                        onChange={(e) => setNewIngUseQty(Number(e.target.value) || 0)}
                        className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    + Tambah &amp; Masukkan ke Resep
                  </button>
                </form>
              </div>

              {/* Simulasi Harga Jual per Channel */}
              <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h2 className="text-base font-bold text-white">Simulasi Channel Penjualan</h2>
                <div className="space-y-2.5">
                  {activeCalc.channels.map((chCalc) => {
                    const chId = chCalc.channel.id;
                    const priceInput = customPrices[chId] ?? chCalc.minPrice ?? 0;
                    return (
                      <div
                        key={chId}
                        className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white">
                            {chCalc.channel.name}{' '}
                            <span className="font-normal text-slate-400">
                              (Fee {chCalc.channel.fee_percent}%)
                            </span>
                          </span>
                          <span className="font-semibold text-emerald-300">
                            Min:{' '}
                            {chCalc.impossibleMargin || chCalc.minPrice === null
                              ? 'Tidak tercapai'
                              : formatRupiah(chCalc.minPrice)}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-3">
                          <label className="text-slate-400">Harga jual kamu:</label>
                          <input
                            type="number"
                            min={0}
                            step={500}
                            value={priceInput}
                            onChange={(e) =>
                              setCustomPrices((prev) => ({
                                ...prev,
                                [chId]: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            className="w-32 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-right text-white"
                          />
                        </div>

                        <div className="mt-1.5 flex items-center justify-between text-[11px]">
                          <span
                            className={
                              chCalc.isBelowCostAfterFee ? 'text-rose-400' : 'text-slate-400'
                            }
                          >
                            {chCalc.isBelowCostAfterFee
                              ? 'Peringatan: di bawah HPP setelah fee!'
                              : `Margin: ${chCalc.actualMarginAtCustom.toFixed(1)}%`}
                          </span>
                          <span
                            className={
                              chCalc.netProfitAtCustom >= 0
                                ? 'font-semibold text-emerald-400'
                                : 'font-semibold text-rose-400'
                            }
                          >
                            Laba bersih: {formatRupiah(chCalc.netProfitAtCustom)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-400">
              Belum ada resep dipilih.
            </div>
          )}
        </section>

        {/* Kolom Kanan: Preview Nota HPP */}
        <section className="lg:col-span-4">
          {activeRecipe ? (
            <div className="sticky top-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <ReceiptCard
                recipeName={activeRecipe.name}
                portions={activeRecipe.portions}
                calc={activeCalc}
                profitMode={activeRecipe.profit_mode}
                profitValue={activeRecipe.profit_value}
                onChangeProfitMode={(mode) =>
                  updateActiveRecipe((r) => ({ ...r, profit_mode: mode }))
                }
                onChangeProfitValue={(val) =>
                  updateActiveRecipe((r) => ({ ...r, profit_value: Math.max(0, val) }))
                }
              />
            </div>
          ) : null}
        </section>
      </main>

      <UpgradeModal
        open={showUpgrade}
        reason="Buka akses tanpa batas resep, bahan baku, dan channel penjualan di HPP-Kilat Pro."
        userEmail={userEmail ?? undefined}
        onClose={() => setShowUpgrade(false)}
      />
    </div>
  );
}