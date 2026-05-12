'use client';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  PolarRadiusAxis,
} from 'recharts';
import type { Stats } from '@lifeos/shared';

const statLabels: Record<string, string> = {
  force: 'FORCE',
  endurance: 'END.',
  vitality: 'VIT.',
  discipline: 'DISC.',
  appearance: 'APP.',
  spirit: 'ESP.',
};

export function StatsRadar({ stats }: { stats: Stats }) {
  const data = (
    Object.entries(stats.per_stat) as [string, { level: number }][]
  ).map(([stat, d]) => ({
    stat: statLabels[stat] ?? stat.toUpperCase().slice(0, 4),
    level: d.level,
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#21262d" />
        <PolarAngleAxis dataKey="stat" tick={{ fill: '#8b949e', fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="Stats"
          dataKey="level"
          stroke="#00d9ff"
          fill="#00d9ff"
          fillOpacity={0.25}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
