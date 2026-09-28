import { describe, expect, it } from 'vitest';
import { keepOnlyExplicitMasterContext } from './voiceParser';

describe('keepOnlyExplicitMasterContext', () => {
  it('mengosongkan konteks AI yang tidak tertulis di sumber', () => {
    const result = keepOnlyExplicitMasterContext(
      {
        intent: 'CREATE_ORDER',
        rawTranscript: 'daging 10 kg beli 50000 jual 60000',
        tujuanDapur: 'Siliragung',
        toko: 'HTG',
        pemasok: 'Ajeng fruits',
      },
      'daging 10 kg beli 50000 jual 60000',
      ['Siliragung'],
      ['HTG'],
      ['Ajeng fruits'],
    );

    expect(result.tujuanDapur).toBe('');
    expect(result.toko).toBe('');
    expect(result.pemasok).toBe('');
  });

  it('mempertahankan master yang memang disebutkan', () => {
    const result = keepOnlyExplicitMasterContext(
      {
        intent: 'CREATE_ORDER',
        rawTranscript: 'daging 10 kg dapur Siliragung toko HTG pemasok Ajeng fruits',
        tujuanDapur: 'salah',
        toko: 'salah',
        pemasok: 'salah',
      },
      'daging 10 kg dapur Siliragung toko HTG pemasok Ajeng fruits',
      ['Siliragung'],
      ['HTG'],
      ['Ajeng fruits'],
    );

    expect(result.tujuanDapur).toBe('Siliragung');
    expect(result.toko).toBe('HTG');
    expect(result.pemasok).toBe('Ajeng fruits');
  });
});
