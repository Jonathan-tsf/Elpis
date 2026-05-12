import { type QuestCondition, type DailyLogInput } from '@lifeos/shared';

export function evaluateCondition(cond: QuestCondition, log: DailyLogInput | null): boolean {
  if (!log) return false;
  switch (cond.type) {
    case 'daily_log_filled':
      return true; // existence of log = filled
    case 'sleep_hours_gte': {
      const hours = (log.sleep?.duration_min ?? 0) / 60;
      const need = Number((cond.params as { hours?: number } | undefined)?.hours ?? 0);
      return hours >= need;
    }
    case 'skincare_am_done':
      return !!log.skincare?.am;
    case 'skincare_pm_done':
      return !!log.skincare?.pm;
    case 'hydration_l_gte': {
      const need = Number((cond.params as { liters?: number } | undefined)?.liters ?? 0);
      return (log.hydration_l ?? 0) >= need;
    }
    case 'workout_count_gte':
      return false; // computed by quests route from workouts data — TODO
    case 'photo_with_tag':
      return false; // computed by quests route from photos data — TODO
    default:
      return false;
  }
}
