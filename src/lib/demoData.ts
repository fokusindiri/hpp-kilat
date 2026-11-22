import type { Channel, Ingredient, Recipe } from '../types';

export const DEMO_INGREDIENTS: Ingredient[] = [
  {
    id: 'demo-kopi',
    name: 'Biji kopi',
    category: 'bahan',
    unit: 'gr',
    buy_price: 180000,
    buy_qty: 1000,
    price_per_unit: 180,
  },
  {
    id: 'demo-susu',
    name: 'Susu UHT',
    category: 'bahan',
    unit: 'ml',
    buy_price: 18000,
    buy_qty: 1000,
    price_per_unit: 18,
  },
  {
    id: 'demo-gula',
    name: 'Gula aren cair',
    category: 'bahan',
    unit: 'ml',
    buy_price: 30000,
    buy_qty: 1000,
    price_per_unit: 30,
  },
  {
    id: 'demo-gelas',
    name: 'Gelas',
    category: 'kemasan',
    unit: 'pcs',
    buy_price: 150000,
    buy_qty: 1000,
    price_per_unit: 150,
  },
  {
    id: 'demo-sedotan',
    name: 'Sedotan',
    category: 'kemasan',
    unit: 'pcs',
    buy_price: 10000,
    buy_qty: 100,
    price_per_unit: 100,
  },
];

export const DEMO_CHANNELS: Channel[] = [
  { id: 'ch-direct', name: 'Jual langsung', fee_percent: 0, fee_flat: 0, sort_order: 1 },
  { id: 'ch-gofood', name: 'GoFood', fee_percent: 20, fee_flat: 0, sort_order: 2 },
  { id: 'ch-grabfood', name: 'GrabFood', fee_percent: 20, fee_flat: 0, sort_order: 3 },
  { id: 'ch-shopeefood', name: 'ShopeeFood', fee_percent: 20, fee_flat: 0, sort_order: 4 },
];

export const DEMO_RECIPE: Recipe = {
  id: 'demo-es-kopi',
  name: 'Es Kopi Susu Gula Aren',
  portions: 1,
  extra_cost: 0,
  profit_mode: 'rupiah',
  profit_value: 5000,
  items: [
    { ingredient_id: 'demo-kopi', qty: 18 },
    { ingredient_id: 'demo-susu', qty: 120 },
    { ingredient_id: 'demo-gula', qty: 25 },
    { ingredient_id: 'demo-gelas', qty: 1 },
    { ingredient_id: 'demo-sedotan', qty: 1 },
  ],
};