import { z } from 'zod';
import { StatName } from './stats';

export const AchievementId = z.string();

export const Achievement = z.object({
  id: AchievementId,
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  category: z.enum(['sleep', 'workout', 'looksmax', 'discipline', 'global', 'milestone']),
  stat: StatName.optional(),
  xp_reward: z.number().int().min(0).max(10_000),
});

export type Achievement = z.infer<typeof Achievement>;
export type AchievementWithStatus = Achievement & { unlocked: boolean; unlocked_at?: number };

export const ACHIEVEMENTS: Achievement[] = [
  // Sleep
  { id: 'sleep_7d_streak', title: '7 nuits sur 7', description: "Dormir 7h+ pendant 7 jours d'affilée.", icon: '😴', category: 'sleep', stat: 'vitality', xp_reward: 100 },
  { id: 'sleep_30d_streak', title: 'Marathonien du sommeil', description: "30 jours de sommeil 7h+ d'affilée.", icon: '🛌', category: 'sleep', stat: 'vitality', xp_reward: 500 },
  { id: 'sleep_8h_first', title: 'Première vraie nuit', description: 'Première nuit de 8h ou plus.', icon: '✨', category: 'sleep', stat: 'vitality', xp_reward: 30 },
  // Workout
  { id: 'workout_first', title: 'Première séance', description: 'Première séance enregistrée.', icon: '🏋️', category: 'workout', stat: 'force', xp_reward: 30 },
  { id: 'workout_10', title: '10 séances', description: '10 séances enregistrées.', icon: '💪', category: 'workout', stat: 'force', xp_reward: 100 },
  { id: 'workout_50', title: '50 séances', description: '50 séances enregistrées.', icon: '🔥', category: 'workout', stat: 'force', xp_reward: 300 },
  { id: 'workout_100', title: 'Centurion', description: '100 séances enregistrées.', icon: '⚔️', category: 'workout', stat: 'force', xp_reward: 600 },
  { id: 'workout_4_per_week', title: '4 séances en 7 jours', description: '4 séances dans une fenêtre de 7 jours.', icon: '📅', category: 'workout', stat: 'discipline', xp_reward: 80 },
  // Looksmax
  { id: 'photo_first', title: 'Première photo', description: 'Première photo enregistrée.', icon: '📸', category: 'looksmax', stat: 'appearance', xp_reward: 20 },
  { id: 'photo_protocol_set', title: 'Set protocolaire', description: '4 photos protocolaires (face, profil G, profil D, posture) dans la même semaine.', icon: '🎯', category: 'looksmax', stat: 'appearance', xp_reward: 150 },
  { id: 'photo_100', title: '100 photos', description: '100 photos enregistrées.', icon: '🖼️', category: 'looksmax', stat: 'appearance', xp_reward: 200 },
  { id: 'skincare_30d', title: '30 jours skincare AM+PM', description: "30 jours d'affilée avec routine AM et PM.", icon: '✨', category: 'looksmax', stat: 'appearance', xp_reward: 250 },
  // Discipline
  { id: 'daily_log_7d', title: '7 jours de journal', description: "7 jours d'affilée à remplir le journal.", icon: '📔', category: 'discipline', stat: 'discipline', xp_reward: 80 },
  { id: 'daily_log_30d', title: '30 jours de journal', description: "30 jours d'affilée à remplir le journal.", icon: '📚', category: 'discipline', stat: 'discipline', xp_reward: 400 },
  { id: 'daily_log_100d', title: '100 jours de journal', description: "100 jours d'affilée à remplir le journal.", icon: '🏆', category: 'discipline', stat: 'discipline', xp_reward: 1000 },
  // Global / milestones
  { id: 'level_5_global', title: 'Niveau 5 global', description: 'Atteindre le niveau global 5.', icon: '⭐', category: 'milestone', xp_reward: 0 },
  { id: 'level_10_global', title: 'Niveau 10 global', description: 'Atteindre le niveau global 10.', icon: '🌟', category: 'milestone', xp_reward: 0 },
  { id: 'level_25_global', title: 'Niveau 25 global', description: 'Atteindre le niveau global 25.', icon: '💫', category: 'milestone', xp_reward: 0 },
  { id: 'level_50_global', title: 'Niveau 50 global', description: 'Atteindre le niveau global 50.', icon: '🌠', category: 'milestone', xp_reward: 0 },
  // Stat milestones
  { id: 'force_level_10', title: 'Force niveau 10', description: 'Stat Force au niveau 10.', icon: '💪', category: 'milestone', stat: 'force', xp_reward: 0 },
  { id: 'endurance_level_10', title: 'Endurance niveau 10', description: 'Stat Endurance au niveau 10.', icon: '🏃', category: 'milestone', stat: 'endurance', xp_reward: 0 },
  { id: 'vitality_level_10', title: 'Vitalité niveau 10', description: 'Stat Vitalité au niveau 10.', icon: '🌱', category: 'milestone', stat: 'vitality', xp_reward: 0 },
  { id: 'discipline_level_10', title: 'Discipline niveau 10', description: 'Stat Discipline au niveau 10.', icon: '🎯', category: 'milestone', stat: 'discipline', xp_reward: 0 },
  { id: 'appearance_level_10', title: 'Apparence niveau 10', description: 'Stat Apparence au niveau 10.', icon: '✨', category: 'milestone', stat: 'appearance', xp_reward: 0 },
  { id: 'spirit_level_10', title: 'Esprit niveau 10', description: 'Stat Esprit au niveau 10.', icon: '🧠', category: 'milestone', stat: 'spirit', xp_reward: 0 },
  // Measurements
  { id: 'measurement_first', title: 'Première mesure', description: 'Première mesure enregistrée.', icon: '📏', category: 'looksmax', stat: 'appearance', xp_reward: 20 },
  { id: 'measurement_4_weeks', title: '4 semaines de mesures', description: 'Au moins une mesure par semaine pendant 4 semaines.', icon: '📊', category: 'looksmax', stat: 'discipline', xp_reward: 100 },
  // Hydration
  { id: 'hydration_7d_target', title: '7 jours hydratation 2.5L', description: "Boire 2.5L 7 jours d'affilée.", icon: '💧', category: 'discipline', stat: 'vitality', xp_reward: 80 },
  // Coach
  { id: 'coach_first_conv', title: 'Premier coaching', description: 'Première conversation avec le coach IA.', icon: '💬', category: 'discipline', xp_reward: 20 },
  { id: 'voice_journal_first', title: 'Premier journal vocal', description: 'Premier journal enregistré par la voix.', icon: '🎙️', category: 'discipline', xp_reward: 40 },
];

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
