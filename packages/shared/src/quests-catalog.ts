import { type Quest } from './quest';

export const DAILY_QUESTS: Omit<Quest, 'status'>[] = [
  {
    id: 'daily_sleep_8h',
    title: 'Dormir 8h ou plus',
    description: 'Une bonne nuit complète.',
    period: 'daily',
    condition: { type: 'sleep_hours_gte', params: { hours: 8 } },
    xp_reward: 30,
    stat_reward: 'vitality',
  },
  {
    id: 'daily_skincare_am',
    title: 'Routine skincare du matin',
    period: 'daily',
    condition: { type: 'skincare_am_done' },
    xp_reward: 15,
    stat_reward: 'appearance',
  },
  {
    id: 'daily_skincare_pm',
    title: 'Routine skincare du soir',
    period: 'daily',
    condition: { type: 'skincare_pm_done' },
    xp_reward: 15,
    stat_reward: 'appearance',
  },
  {
    id: 'daily_hydration',
    title: "Boire 2.5L d'eau",
    period: 'daily',
    condition: { type: 'hydration_l_gte', params: { liters: 2.5 } },
    xp_reward: 15,
    stat_reward: 'vitality',
  },
  {
    id: 'daily_log_filled',
    title: 'Remplir le journal du soir',
    period: 'daily',
    condition: { type: 'daily_log_filled' },
    xp_reward: 20,
    stat_reward: 'discipline',
  },
];
