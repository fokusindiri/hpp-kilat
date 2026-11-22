import { describe, expect, it } from 'vitest';
import { DEMO_INGREDIENTS, DEMO_RECIPE } from './demoData';
import {
  calculateHpp,
  calculateMinPrice,
  calculateNetProfit,
} from './pricing';

describe('Rumus HPP dan harga jual HPP-Kilat', () => {
  it('menghitung HPP Es Kopi Susu Gula Aren tepat Rp6.400', () => {
    const map = Object.fromEntries(DEMO_INGREDIENTS.map((i) => [i.id, i]));
    const res = calculateHpp(
      DEMO_RECIPE.items,
      map,
      DEMO_RECIPE.portions,
      DEMO_RECIPE.extra_cost
    );
    expect(res.hpp).toBe(6400);
  });

  it('menghasilkan harga jual minimal Rp14.500 untuk HPP 6.400, untung 5.000, potongan 20%, pembulatan 500', () => {
    const minRes = calculateMinPrice(6400, 'rupiah', 5000, 20, 0, 500);
    expect(minRes.impossible).toBe(false);
    expect(minRes.price).toBe(14500);

    const profit = calculateNetProfit(14500, 6400, 20, 0);
    expect(profit).toBe(5200);
  });

  it('menandai margin tidak mungkin dicapai jika potongan + margin >= 100%', () => {
    const res = calculateMinPrice(6400, 'percent', 85, 20, 0, 500);
    expect(res.impossible).toBe(true);
    expect(res.price).toBeNull();
  });
});