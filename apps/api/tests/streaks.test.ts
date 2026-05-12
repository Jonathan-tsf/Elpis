import { describe, expect, it, vi, afterAll } from 'vitest';
import { recomputeStreaks } from '../src/services/streaks';

// We'll control "today" so streak tests are deterministic
const FAKE_TODAY = '2026-05-12';

// Mock Date so "today" is always FAKE_TODAY
vi.useFakeTimers();
vi.setSystemTime(new Date(FAKE_TODAY + 'T12:00:00Z'));

afterAll(() => {
  vi.useRealTimers();
});

describe('recomputeStreaks', () => {
  it('empty logs => all streaks 0/0 with no last_event_date', () => {
    const result = recomputeStreaks([]);
    expect(result.daily_log.current).toBe(0);
    expect(result.daily_log.longest).toBe(0);
    expect(result.daily_log.last_event_date).toBeUndefined();
    expect(result.skincare_am.current).toBe(0);
    expect(result.skincare_am.longest).toBe(0);
    expect(result.skincare_pm.current).toBe(0);
    expect(result.skincare_pm.longest).toBe(0);
  });

  it('3 consecutive days => daily_log current=3, longest=3', () => {
    const logs = [
      { date: '2026-05-10', data: {} },
      { date: '2026-05-11', data: {} },
      { date: FAKE_TODAY, data: {} }, // today
    ];
    const result = recomputeStreaks(logs);
    expect(result.daily_log.current).toBe(3);
    expect(result.daily_log.longest).toBe(3);
    expect(result.daily_log.last_event_date).toBe(FAKE_TODAY);
  });

  it('gap of 2 days then 2 more => daily_log current=2, longest=3', () => {
    const logs = [
      { date: '2026-05-07', data: {} },
      { date: '2026-05-08', data: {} },
      { date: '2026-05-09', data: {} },
      // gap: 2026-05-10 missing
      { date: '2026-05-11', data: {} },
      { date: FAKE_TODAY, data: {} },
    ];
    const result = recomputeStreaks(logs);
    expect(result.daily_log.current).toBe(2);
    expect(result.daily_log.longest).toBe(3);
  });

  it('skincare_am: only logs where skincare.am=true count', () => {
    const logs = [
      { date: '2026-05-10', data: { skincare: { am: true, pm: false } } },
      { date: '2026-05-11', data: { skincare: { am: false, pm: true } } }, // no am
      { date: FAKE_TODAY, data: { skincare: { am: true, pm: true } } },
    ];
    const result = recomputeStreaks(logs);
    // 2026-05-11 breaks the skincare_am streak (no am)
    // 2026-05-12 is today with am=true, current=1
    expect(result.skincare_am.current).toBe(1);
    expect(result.skincare_am.longest).toBe(1);
    expect(result.skincare_pm.current).toBe(2); // 05-11 and 05-12
    expect(result.skincare_pm.longest).toBe(2);
  });

  it('last log more than 1 day before today => current=0', () => {
    // FAKE_TODAY is 2026-05-12, logs end at 2026-05-10 (2 days ago)
    const logs = [
      { date: '2026-05-08', data: {} },
      { date: '2026-05-09', data: {} },
      { date: '2026-05-10', data: {} },
    ];
    const result = recomputeStreaks(logs);
    expect(result.daily_log.current).toBe(0);
    expect(result.daily_log.longest).toBe(3);
    expect(result.daily_log.last_event_date).toBe('2026-05-10');
  });

  it('last log yesterday => current stays active', () => {
    // yesterday = 2026-05-11 (diffDays to today = 1)
    const logs = [
      { date: '2026-05-10', data: {} },
      { date: '2026-05-11', data: {} },
    ];
    const result = recomputeStreaks(logs);
    expect(result.daily_log.current).toBe(2);
    expect(result.daily_log.longest).toBe(2);
  });
});
