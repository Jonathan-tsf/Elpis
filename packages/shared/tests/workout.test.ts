import { describe, expect, it } from 'vitest';
import { Workout, WorkoutInput, WorkoutSet, WorkoutExercise } from '../src/workout';

const validWorkout = {
  date: '2026-05-11',
  type: 'push' as const,
  duration_min: 60,
  rpe: 7,
  exercises: [
    {
      name: 'Bench Press',
      sets: [{ reps: 8, weight_kg: 80 }, { reps: 8, weight_kg: 82.5 }],
    },
  ],
  notes: 'Felt strong',
};

describe('Workout schemas', () => {
  it('accepts a valid WorkoutInput', () => {
    const result = WorkoutInput.parse(validWorkout);
    expect(result.type).toBe('push');
  });

  it('accepts a Workout with id and created_at', () => {
    const result = Workout.parse({ ...validWorkout, id: 'wk_abc', created_at: 1715430000000 });
    expect(result.id).toBe('wk_abc');
  });

  it('rejects WorkoutInput with rpe > 10', () => {
    expect(() => WorkoutInput.parse({ ...validWorkout, rpe: 11 })).toThrow();
  });

  it('rejects WorkoutExercise with more than 20 sets', () => {
    const tooManySets = Array.from({ length: 21 }, () => ({ reps: 5 }));
    expect(() =>
      WorkoutExercise.parse({ name: 'Squat', sets: tooManySets }),
    ).toThrow();
  });
});
