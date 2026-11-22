import { useEffect, useMemo, useState } from 'react';
import { ReceiptCard } from '../components/ReceiptCard';
import { UpgradeModal } from '../components/UpgradeModal';
import { DEMO_RECIPE } from '../lib/demoData';
import { calculateHpp } from '../lib/pricing';
import { supabase } from '../lib/supabase';
import type { Ingredient, Recipe, RecipeCalculation } from '../types';

interface AppShellProps {
  onNavigate: (to: string) => void;
}

export function AppShell({ onNavigate }: AppShellProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([DEMO_RECIPE]);
  const [selectedId, setSelectedId] = useState<string>(DEMO_RECIPE.id);
  const [ingredientsById] = useState<Record<string, Ingredient>>({});
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

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

    const hppResult = calculateHpp(
      activeRecipe.items,
      ingredientsById,
      activeRecipe.portions,
      activeRecipe.extra_cost
    );

    return {
      ...hppResult,
      channels: [],
    };
  }, [activeRecipe, ingredientsById]);

  const handleAddSampleRecipe = () => {
    const base = DEMO_RECIPE;
    const nextIndex = recipes.length + 1;
    const newItem: Recipe = {
      ...base,
      id: `custom-${Date.now()}`,
      name: `${base.name} #${nextIndex}`,
    };
    setRecipes((prev) => [newItem, ...prev]);
    setSelectedId(newItem.id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onNavigate('/masuk');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5">
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

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-12">
        <aside className="space-y-3 lg:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Daftar Resep / Produk</h2>
            <button
              type="button"
              onClick={handleAddSampleRecipe}
              className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-slate-700"
            >
              + Duplikat Contoh
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
                    Porsi: {recipe.portions} • Target untung:{' '}
                    {recipe.profit_mode === 'percent'
                      ? `${recipe.profit_value}%`
                      : `Rp ${recipe.profit_value.toLocaleString('id-ID')}`}
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="lg:col-span-8">
          {activeRecipe ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <ReceiptCard
                recipeName={activeRecipe.name}
                portions={activeRecipe.portions}
                calc={activeCalc}
                profitMode={activeRecipe.profit_mode}
                profitValue={activeRecipe.profit_value}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-400">
              Belum ada resep dipilih.
            </div>
          )}
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