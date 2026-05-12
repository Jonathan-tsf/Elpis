import { describe, expect, it } from 'vitest';
import { Measurement, MeasurementInput } from '../src/measurement';

describe('Measurement schemas', () => {
  it('accepts a valid weight measurement', () => {
    const result = MeasurementInput.parse({
      metric: 'weight',
      value: 75,
      date: '2026-05-11',
    });
    expect(result.value).toBe(75);
  });

  it('rejects metric "blood_pressure" (not in enum)', () => {
    expect(() =>
      MeasurementInput.parse({ metric: 'blood_pressure', value: 120, date: '2026-05-11' }),
    ).toThrow();
  });

  it('rejects negative value', () => {
    expect(() =>
      MeasurementInput.parse({ metric: 'weight', value: -1, date: '2026-05-11' }),
    ).toThrow();
  });

  it('accepts Measurement with created_at', () => {
    const result = Measurement.parse({
      metric: 'waist',
      value: 82,
      date: '2026-05-11',
      created_at: 1715430000000,
    });
    expect(result.created_at).toBe(1715430000000);
  });
});
