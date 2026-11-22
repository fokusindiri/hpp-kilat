import type {
  Channel,
  ChannelCalculation,
  Ingredient,
  ProfitMode,
  RecipeCalculation,
  RecipeItemDraft,
  RoundingStep,
} from '../types';

export const PRO_PRICE_LABEL = 'Hubungi kami untuk harga Pro';

const idrFormatter = new Intl.NumberFormat('id-ID');
const decimalFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 1,
});

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return idrFormatter.format(Math.round(value));
}

export function formatRupiah(value: number): string {
  const rounded = Math.round(value);
  if (rounded < 0) {
    return `-Rp${idrFormatter.format(Math.abs(rounded))}`;
  }
  return `Rp${idrFormatter.format(rounded)}`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${decimalFormatter.format(value)}%`;
}

export function ceilToStep(amount: number, step: RoundingStep): number {
  if (!Number.isFinite(amount) || amount <= 0) return step;
  return Math.ceil(amount / step) * step;
}

export function calculateHpp(
  items: RecipeItemDraft[],
  ingredientsById: Record<string, Ingredient>,
  portions: number,
  extraCost: number
): {
  ingredientSubtotalPerPortion: number;
  packagingSubtotalPerPortion: number;
  extraCostPerPortion: number;
  hpp: number;
  lineItems: Array<{
    ingredient: Ingredient;
    qty: number;
    costPerPortion: number;
  }>;
} {
  const safePortions = portions > 0 ? portions : 1;
  const safeExtra = Number.isFinite(extraCost) ? extraCost : 0;

  let ingredientTotal = 0;
  let packagingTotal = 0;
  const lineItems: Array<{
    ingredient: Ingredient;
    qty: number;
    costPerPortion: number;
  }> = [];

  for (const item of items) {
    const ing = ingredientsById[item.ingredient_id];
    if (!ing) continue;
    const qty = Number.isFinite(item.qty) && item.qty > 0 ? item.qty : 0;
    const lineCost = qty * ing.price_per_unit;
    const costPerPortion = lineCost / safePortions;

    if (ing.category === 'kemasan') {
      packagingTotal += lineCost;
    } else {
      ingredientTotal += lineCost;
    }

    lineItems.push({
      ingredient: ing,
      qty,
      costPerPortion,
    });
  }

  const ingredientSubtotalPerPortion = ingredientTotal / safePortions;
  const packagingSubtotalPerPortion = packagingTotal / safePortions;
  const extraCostPerPortion = safeExtra;
  const hpp =
    ingredientSubtotalPerPortion + packagingSubtotalPerPortion + extraCostPerPortion;

  return {
    ingredientSubtotalPerPortion,
    packagingSubtotalPerPortion,
    extraCostPerPortion,
    hpp,
    lineItems,
  };
}

export function calculateMinPrice(
  hpp: number,
  profitMode: ProfitMode,
  profitValue: number,
  feePercent: number,
  feeFlat: number,
  roundingStep: RoundingStep
): { impossible: boolean; price: number | null } {
  const feeRate = feePercent / 100;
  const safeProfit = Number.isFinite(profitValue) ? profitValue : 0;
  const safeFeeFlat = Number.isFinite(feeFlat) ? feeFlat : 0;

  if (profitMode === 'rupiah') {
    const denom = 1 - feeRate;
    if (denom <= 0) return { impossible: true, price: null };
    const raw = (hpp + safeProfit + safeFeeFlat) / denom;
    return { impossible: false, price: ceilToStep(raw, roundingStep) };
  }

  const marginRate = safeProfit / 100;
  const denom = 1 - feeRate - marginRate;
  if (denom <= 0) {
    return { impossible: true, price: null };
  }
  const raw = (hpp + safeFeeFlat) / denom;
  return { impossible: false, price: ceilToStep(raw, roundingStep) };
}

export function calculateNetProfit(
  sellingPrice: number,
  hpp: number,
  feePercent: number,
  feeFlat: number
): number {
  const feeRate = feePercent / 100;
  return sellingPrice * (1 - feeRate) - feeFlat - hpp;
}

export function calculateRecipePricing(params: {
  items: RecipeItemDraft[];
  ingredients: Ingredient[];
  portions: number;
  extraCost: number;
  profitMode: ProfitMode;
  profitValue: number;
  channels: Channel[];
  roundingStep: RoundingStep;
  customPricesByChannel: Record<string, number>;
}): RecipeCalculation {
  const map: Record<string, Ingredient> = {};
  for (const ing of params.ingredients) {
    map[ing.id] = ing;
  }

  const base = calculateHpp(
    params.items,
    map,
    params.portions,
    params.extraCost
  );

  const channels: ChannelCalculation[] = params.channels.map((ch) => {
    const minRes = calculateMinPrice(
      base.hpp,
      params.profitMode,
      params.profitValue,
      ch.fee_percent,
      ch.fee_flat,
      params.roundingStep
    );

    const netProfitAtMin =
      minRes.price !== null
        ? calculateNetProfit(minRes.price, base.hpp, ch.fee_percent, ch.fee_flat)
        : null;

    const actualMarginAtMin =
      minRes.price !== null && minRes.price > 0 && netProfitAtMin !== null
        ? (netProfitAtMin / minRes.price) * 100
        : null;

    const customPrice = params.customPricesByChannel[ch.id] ?? 0;
    const netProfitAtCustom = calculateNetProfit(
      customPrice,
      base.hpp,
      ch.fee_percent,
      ch.fee_flat
    );
    const actualMarginAtCustom =
      customPrice > 0 ? (netProfitAtCustom / customPrice) * 100 : 0;

    const netReceivedAfterFee =
      customPrice * (1 - ch.fee_percent / 100) - ch.fee_flat;
    const isBelowCostAfterFee = netReceivedAfterFee < base.hpp;

    return {
      channel: ch,
      impossibleMargin: minRes.impossible,
      minPrice: minRes.price,
      netProfitAtMin,
      actualMarginAtMin,
      customPrice,
      netProfitAtCustom,
      actualMarginAtCustom,
      isBelowCostAfterFee,
    };
  });

  return {
    ...base,
    channels,
  };
}