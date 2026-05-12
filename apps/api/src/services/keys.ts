export const USER_PK = 'USER#me' as const;

export function dailyLogKey(date: string): { pk: string; sk: string } {
  return { pk: USER_PK, sk: `DAY#${date}` };
}

export function workoutKey(date: string, id: string): { pk: string; sk: string } {
  return { pk: USER_PK, sk: `WORKOUT#${date}#${id}` };
}

export function workoutExerciseKey(workoutId: string, idx: number): { pk: string; sk: string } {
  return { pk: USER_PK, sk: `WEX#${workoutId}#${idx}` };
}

export function workoutSetKey(
  workoutId: string,
  exoIdx: number,
  setIdx: number,
): { pk: string; sk: string } {
  return { pk: USER_PK, sk: `WSET#${workoutId}#${exoIdx}#${setIdx}` };
}

export function measurementKey(metric: string, date: string): { pk: string; sk: string } {
  return { pk: USER_PK, sk: `MEAS#${metric}#${date}` };
}

export function photoKey(date: string, id: string): { pk: string; sk: string } {
  return { pk: USER_PK, sk: `PHOTO#${date}#${id}` };
}

export function xpEventKey(timestamp: number, id: string): { pk: string; sk: string } {
  return { pk: USER_PK, sk: `XP#${timestamp}#${id}` };
}

export function statsKey(): { pk: string; sk: string } {
  return { pk: USER_PK, sk: 'STATS' };
}

export function streakKey(category: string): { pk: string; sk: string } {
  return { pk: USER_PK, sk: `STREAK#${category}` };
}

export function questKey(id: string): { pk: string; sk: string } {
  return { pk: USER_PK, sk: `QUEST#${id}` };
}

export function profileKey(): { pk: string; sk: string } {
  return { pk: USER_PK, sk: 'PROFILE' };
}

export function photoAnalysisKey(date: string, id: string): { pk: string; sk: string } {
  return { pk: USER_PK, sk: `PHOTOAN#${date}#${id}` };
}

export function bloodTestKey(date: string, id: string): { pk: string; sk: string } {
  return { pk: USER_PK, sk: `BLOOD#${date}#${id}` };
}

export function perfTestKey(date: string, id: string): { pk: string; sk: string } {
  return { pk: USER_PK, sk: `PERF#${date}#${id}` };
}

export function seasonKey(id: string): { pk: string; sk: string } {
  return { pk: USER_PK, sk: `SEASON#${id}` };
}

export function dateString(date?: Date): string {
  const d = date ?? new Date();
  return d.toISOString().slice(0, 10);
}
