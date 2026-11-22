export type Category = 'bahan' | 'kemasan';
export type Unit = 'gr' | 'ml' | 'pcs';
export type ProfitMode = 'rupiah' | 'percent';
export type RoundingStep = 100 | 500 | 1000;
export type PlanType = 'free' | 'pro';

export interface Ingredient {
  id: string;
  user_id?: string;
  name: string;
  category: Category;
  unit: Unit;
  buy_price: number;
  buy_qty: number;
  price_per_unit: number;
  updated_at?: string;
}

export interface PriceHistoryItem {
  id: string;
  ingredient_id: string;
  price_per_unit: number;
  recorded_at: string;
}

export interface RecipeItemDraft {
  ingredient_id: string;
  qty: number;
}

export interface Recipe {
  id: string;
  name: string;
  portions: number;
  extra_cost: number;
  profit_mode: ProfitMode;
  profit_value: number;
  items: RecipeItemDraft[];
}

export interface Channel {
  id: string;
  name: string;
  fee_percent: number;
  fee_flat: number;
  sort_order: number;
}

export interface PlanLimits {
  plan: PlanType;
  max_recipes: number | null;
  max_ingredients: number | null;
  max_channels: number | null;
}

export interface ChannelCalculation {
  channel: Channel;
  impossibleMargin: boolean;
  minPrice: number | null;
  netProfitAtMin: number | null;
  actualMarginAtMin: number | null;
  customPrice: number;
  netProfitAtCustom: number;
  actualMarginAtCustom: number;
  isBelowCostAfterFee: boolean;
}

export interface RecipeCalculation {
  ingredientSubtotalPerPortion: number;
  packagingSubtotalPerPortion: number;
  extraCostPerPortion: number;
  hpp: number;
  lineItems: Array<{
    ingredient: Ingredient;
    qty: number;
    costPerPortion: number;
  }>;
  channels: ChannelCalculation[];
}