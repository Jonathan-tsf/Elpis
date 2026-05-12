import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseTranscript } from '../src/services/voice-parser';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bedrockMock = mockClient(BedrockRuntimeClient as any);

function encodeResponse(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj));
}

beforeEach(() => {
  bedrockMock.reset();
});

describe('parseTranscript', () => {
  it('accumulates draft from log_sleep + log_mood + log_meal tool calls', async () => {
    // Round 1: Claude calls log_sleep
    const sleepToolUse = {
      content: [
        {
          type: 'tool_use',
          id: 'tool-sleep',
          name: 'log_sleep',
          input: { duration_min: 480, quality: 8, bedtime: '23:00', wake_time: '07:00' },
        },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 100, output_tokens: 50 },
    };
    // Round 2: Claude calls log_mood
    const moodToolUse = {
      content: [
        {
          type: 'tool_use',
          id: 'tool-mood',
          name: 'log_mood',
          input: { mood: 8, energy: 7, focus: 9, notes: 'Great day' },
        },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 120, output_tokens: 60 },
    };
    // Round 3: Claude calls log_meal
    const mealToolUse = {
      content: [
        {
          type: 'tool_use',
          id: 'tool-meal',
          name: 'log_meal',
          input: { slot: 'lunch', description: 'Poulet riz brocoli', score: 4 },
        },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 130, output_tokens: 70 },
    };
    // Round 4: Claude finishes
    const finalResponse = {
      content: [{ type: 'text', text: 'Terminé' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 140, output_tokens: 10 },
    };

    bedrockMock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(InvokeModelCommand as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ body: encodeResponse(sleepToolUse) } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ body: encodeResponse(moodToolUse) } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ body: encodeResponse(mealToolUse) } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ body: encodeResponse(finalResponse) } as any);

    const draft = await parseTranscript(
      "Hier soir j'ai dormi 8h, je me suis couché à 23h et levé à 7h, qualité 8. Humeur 8 énergie 7 focus 9, super journée. A midi j'ai mangé poulet riz brocoli score 4.",
    );

    // Sleep
    expect(draft.daily_log_draft.sleep).toEqual({
      duration_min: 480,
      quality: 8,
      bedtime: '23:00',
      wake_time: '07:00',
    });

    // Mood
    expect(draft.daily_log_draft.mood).toEqual({
      mood: 8,
      energy: 7,
      focus: 9,
      notes: 'Great day',
    });

    // Meals
    expect(draft.daily_log_draft.meals).toHaveLength(1);
    expect(draft.daily_log_draft.meals?.[0]).toEqual({
      slot: 'lunch',
      description: 'Poulet riz brocoli',
      score: 4,
    });

    // No workout
    expect(draft.workout_draft).toBeUndefined();
  });

  it('accumulates multiple meals when Claude calls log_meal multiple times', async () => {
    const meal1 = {
      content: [
        {
          type: 'tool_use',
          id: 'tool-m1',
          name: 'log_meal',
          input: { slot: 'breakfast', description: 'Porridge' },
        },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 100, output_tokens: 40 },
    };
    const meal2 = {
      content: [
        {
          type: 'tool_use',
          id: 'tool-m2',
          name: 'log_meal',
          input: { slot: 'dinner', description: 'Steak légumes', score: 5 },
        },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 110, output_tokens: 40 },
    };
    const done = {
      content: [{ type: 'text', text: 'Terminé' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 120, output_tokens: 5 },
    };

    bedrockMock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(InvokeModelCommand as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ body: encodeResponse(meal1) } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ body: encodeResponse(meal2) } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ body: encodeResponse(done) } as any);

    const draft = await parseTranscript('Matin porridge, soir steak légumes note 5.');

    expect(draft.daily_log_draft.meals).toHaveLength(2);
    expect(draft.daily_log_draft.meals?.[0]?.slot).toBe('breakfast');
    expect(draft.daily_log_draft.meals?.[1]?.slot).toBe('dinner');
  });

  it('captures workout_draft when Claude calls log_workout', async () => {
    const workoutToolUse = {
      content: [
        {
          type: 'tool_use',
          id: 'tool-wo',
          name: 'log_workout',
          input: {
            type: 'push',
            duration_min: 60,
            rpe: 8,
            exercises: [{ name: 'Bench press', sets: [{ reps: 8, weight_kg: 80 }] }],
          },
        },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 100, output_tokens: 60 },
    };
    const done = {
      content: [{ type: 'text', text: 'Terminé' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 110, output_tokens: 5 },
    };

    bedrockMock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(InvokeModelCommand as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ body: encodeResponse(workoutToolUse) } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolvesOnce({ body: encodeResponse(done) } as any);

    const draft = await parseTranscript("J'ai fait du push aujourd'hui, bench press 80kg 8 reps.");

    expect(draft.workout_draft).toBeDefined();
    expect((draft.workout_draft as { type: string }).type).toBe('push');
    expect((draft.workout_draft as { duration_min: number }).duration_min).toBe(60);
  });

  it('returns empty draft when Claude calls no tools', async () => {
    const done = {
      content: [{ type: 'text', text: 'Terminé' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 50, output_tokens: 5 },
    };

    bedrockMock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(InvokeModelCommand as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolves({ body: encodeResponse(done) } as any);

    const draft = await parseTranscript('Rien de particulier à noter.');

    expect(draft.daily_log_draft).toEqual({});
    expect(draft.workout_draft).toBeUndefined();
    expect(draft.notes).toEqual([]);
  });
});
