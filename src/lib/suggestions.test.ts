import { describe, it, expect } from 'vitest';
import { getItemSuggestions, ITEM_SUGGESTIONS } from './suggestions';

describe('Item Auto-Suggest Engine', () => {
  it('should have all master item suggestions loaded', () => {
    expect(ITEM_SUGGESTIONS.length).toBeGreaterThan(100);
    expect(ITEM_SUGGESTIONS).toContain('Ikan Teri');
    expect(ITEM_SUGGESTIONS).toContain('Apel Fuji');
    expect(ITEM_SUGGESTIONS).toContain('Kaki Naga Ikan');
    expect(ITEM_SUGGESTIONS).toContain('Keripik Tempe');
  });

  it('should return suggestions matching "ik" case-insensitively and prioritize start of word', () => {
    const results = getItemSuggestions('ik', [], 10);
    expect(results.length).toBeGreaterThan(0);
    
    // Items starting with "Ikan" should appear before items having "ik" in the middle
    const ikanIndex = results.findIndex((item) => item.toLowerCase().startsWith('ikan'));
    expect(ikanIndex).toBeGreaterThanOrEqual(0);

    // Check that "Ikan Teri" or other "Ikan..." items are prioritized
    expect(results[0].toLowerCase().startsWith('ik')).toBe(true);

    // If "Kaki Naga Ikan" is in results, it should come before middle-of-word matches like "Keripik"
    const kakiNagaIndex = results.indexOf('Kaki Naga Ikan');
    const keripikIndex = results.indexOf('Keripik Tempe');
    if (kakiNagaIndex !== -1 && keripikIndex !== -1) {
      expect(kakiNagaIndex).toBeLessThan(keripikIndex);
    }
  });

  it('should match case-insensitively', () => {
    const upper = getItemSuggestions('IKAN', [], 5);
    const lower = getItemSuggestions('ikan', [], 5);
    expect(upper).toEqual(lower);
  });

  it('should match substring anywhere (e.g. "muscat" -> "Anggur Muscat")', () => {
    const results = getItemSuggestions('muscat', [], 5);
    expect(results).toContain('Anggur Muscat');
  });

  it('should allow custom items to be included in suggestions', () => {
    const results = getItemSuggestions('custom', ['Custom Item Spesial'], 5);
    expect(results).toContain('Custom Item Spesial');
  });

  it('should return empty array for empty query', () => {
    expect(getItemSuggestions('')).toEqual([]);
    expect(getItemSuggestions('   ')).toEqual([]);
  });
});
