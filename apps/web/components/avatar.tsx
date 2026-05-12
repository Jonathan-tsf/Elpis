'use client';
import clsx from 'clsx';
import { motion } from 'framer-motion';

export function Avatar({
  initial,
  level,
  mode = 'active',
  size = 64,
}: {
  initial: string;
  level: number;
  mode?: 'active' | 'decaying' | 'dormant';
  size?: number;
}) {
  return (
    <div className="relative inline-block">
      <motion.div
        animate={{ scale: mode === 'active' ? [1, 1.03, 1] : 1 }}
        transition={{ duration: 3, repeat: Infinity }}
        className={clsx(
          'rounded-full flex items-center justify-center font-display tracking-wider relative overflow-hidden',
          mode === 'active' &&
            'ring-2 ring-accent-spirit shadow-[0_0_20px_rgba(0,217,255,0.4)]',
          mode === 'decaying' && 'ring-2 ring-text-muted grayscale-[60%] opacity-90',
          mode === 'dormant' && 'ring-2 ring-text-muted grayscale opacity-50',
        )}
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, #1a1330 0%, #4a3680 50%, #0a0a1f 100%)',
        }}
      >
        <span className="text-accent-spirit text-2xl font-bold uppercase">{initial}</span>
        {mode === 'dormant' && (
          <span className="absolute top-0 right-0 text-xs text-text-muted">💤</span>
        )}
      </motion.div>
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-bg-strong text-accent-xp text-[10px] font-display tracking-wider">
        Lv {level}
      </div>
    </div>
  );
}
