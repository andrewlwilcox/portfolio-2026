import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';

interface SplitFlapCardProps {
  value: string | number;
  label: string;
}

const SplitFlapCard: React.FC<SplitFlapCardProps> = ({ value, label }) => {
  const [currentValue, setCurrentValue] = useState(value);
  const [nextValue, setNextValue] = useState(value);
  const [isFlipping, setIsFlipping] = useState(false);
  const [triggerKey, setTriggerKey] = useState(0);

  useEffect(() => {
    if (value !== nextValue) {
      setCurrentValue(nextValue);
      setNextValue(value);
      setIsFlipping(true);
      setTriggerKey(prev => prev + 1);
    }
  }, [value, nextValue]);

  const handleAnimationComplete = () => {
    setCurrentValue(nextValue);
    setIsFlipping(false);
  };

  const displayCurrent = String(currentValue).padStart(2, '0');
  const displayNext = String(nextValue).padStart(2, '0');

  return (
    <div className="relative flex flex-col items-center">
      {/* Physical Card Container with 3D Perspective */}
      <div 
        className="relative w-[1.95rem] h-[1.95rem] md:w-[2.11rem] md:h-[2.11rem] bg-[#101012] rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.5)] select-none border border-stone-900" 
        style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
      >
        {/* Left metal hinge */}
        <div className="absolute left-[-2px] top-1/2 -translate-y-1/2 w-[3px] h-2 bg-[#2a2a2c] rounded-[1px] border border-black/80 z-30" />
        {/* Right metal hinge */}
        <div className="absolute right-[-2px] top-1/2 -translate-y-1/2 w-[3px] h-2 bg-[#2a2a2c] rounded-[1px] border border-black/80 z-30" />

        {/* 1. TOP STATIC HALF (Shows next/new value if flipping, otherwise current value) */}
        <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden bg-gradient-to-b from-[#161618] to-[#0e0e10] rounded-t-md p-0">
          <div className="absolute top-0 inset-x-0 h-[200%] flex items-center justify-center font-mono text-xs font-semibold text-[#f4f4f7] tracking-tight leading-none">
            {isFlipping ? displayNext : displayCurrent}
          </div>
        </div>

        {/* 2. BOTTOM STATIC HALF (Shows current/old value) */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden bg-gradient-to-b from-[#0a0a0c] to-[#060608] rounded-b-md p-0">
          <div className="absolute top-0 inset-x-0 h-[200%] -translate-y-1/2 flex items-center justify-center font-mono text-xs font-semibold text-[#f4f4f7] tracking-tight leading-none">
            {displayCurrent}
          </div>
        </div>

        {/* CENTRAL SPLIT LINE */}
        <div className="absolute top-1/2 -translate-y-[0.5px] left-0 right-0 h-[1px] bg-black z-20" />

        {/* 3. FLIPPING FLAP PANEL */}
        {isFlipping && (
          <motion.div
            key={triggerKey}
            initial={{ rotateX: 0 }}
            animate={{ rotateX: -180 }}
            transition={{
              duration: 0.48,
              ease: [0.25, 0.46, 0.45, 0.94], // Snappy physical mechanical feel
            }}
            onAnimationComplete={handleAnimationComplete}
            style={{
              transformStyle: 'preserve-3d',
              transformOrigin: '50% 100%',
            }}
            className="absolute inset-x-0 top-0 h-1/2 z-10 origin-bottom"
          >
            {/* FRONT FACE of top flap (Shows top half of current value) */}
            <div 
              style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
              className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#161618] to-[#0e0e10] rounded-t-md p-0"
            >
              <div className="absolute top-0 inset-x-0 h-[200%] flex items-center justify-center font-mono text-xs font-semibold text-[#f4f4f7] tracking-tight leading-none">
                {displayCurrent}
              </div>
            </div>

            {/* BACK FACE of top flap (Shows bottom half of next value, rotated so it's upright when flipped down) */}
            <div 
              style={{ 
                backfaceVisibility: 'hidden', 
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateX(180deg)' 
              }}
              className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#0a0a0c] to-[#060608] rounded-b-md p-0"
            >
              <div className="absolute top-0 inset-x-0 h-[200%] -translate-y-1/2 flex items-center justify-center font-mono text-xs font-semibold text-[#f4f4f7] tracking-tight leading-none">
                {displayNext}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Label - absolutely positioned below to avoid structural alignment skew, perfectly centered */}
      <span className="absolute top-full left-0 right-0 mt-1 w-full text-center font-mono text-[6.5px] tracking-widest text-neutral-400 uppercase select-none leading-none whitespace-nowrap">
        {label}
      </span>
    </div>
  );
};

interface SplitFlapCountdownProps {
  targetDate?: Date;
  onCycleExpire?: (newTargetDate: Date) => void;
}

// Anchor date: September 8, 2026 at 09:00:00 local time
// Month in Date constructor is 0-indexed: 8 is September
export const ANCHOR_DATE = new Date(2026, 8, 8, 9, 0, 0);
export const CYCLE_MS = 14 * 24 * 60 * 60 * 1000; // 1,209,600,000 ms (14-day cycle)

/**
 * Calculates the current active target availability date based on the September 8, 2026 anchor.
 * If now < anchorDate, returns the anchor date.
 * If now >= targetDate, calculates elapsed 14-day cycles and advances by 14-day increments until targetDate > now.
 */
export const getNextAvailabilityDate = (now: Date = new Date()): Date => {
  const nowMs = now.getTime();
  const anchorMs = ANCHOR_DATE.getTime();
  if (nowMs < anchorMs) {
    return new Date(anchorMs);
  }
  const cyclesPassed = Math.floor((nowMs - anchorMs) / CYCLE_MS) + 1;
  return new Date(anchorMs + cyclesPassed * CYCLE_MS);
};

/**
 * Dynamically formats a Date into uppercase month abbreviation + day with ordinal suffix (e.g., "SEP 8TH", "SEP 22ND", "OCT 6TH")
 */
export const formatAvailabilityDate = (date: Date): string => {
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();

  const getOrdinalSuffix = (n: number) => {
    if (n >= 11 && n <= 13) return 'TH';
    switch (n % 10) {
      case 1: return 'ST';
      case 2: return 'ND';
      case 3: return 'RD';
      default: return 'TH';
    }
  };

  return `${month} ${day}${getOrdinalSuffix(day)}`;
};

export const SplitFlapCountdown: React.FC<SplitFlapCountdownProps> = ({
  targetDate: propTargetDate,
  onCycleExpire,
}) => {
  const [days, setDays] = useState(0);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [isShuffling, setIsShuffling] = useState(true);

  // Helper to get active target date
  const getActiveTarget = () => {
    const now = new Date();
    if (propTargetDate && propTargetDate.getTime() > now.getTime()) {
      return propTargetDate;
    }
    return getNextAvailabilityDate(now);
  };

  // Calculate standard time remaining values
  const getTargetValues = () => {
    const now = new Date();
    const activeTarget = getActiveTarget();
    let differenceMs = activeTarget.getTime() - now.getTime();
    if (differenceMs <= 0) {
      const nextTarget = getNextAvailabilityDate(now);
      if (onCycleExpire) {
        onCycleExpire(nextTarget);
      }
      differenceMs = Math.max(0, nextTarget.getTime() - now.getTime());
    }
    const totalSeconds = Math.floor(differenceMs / 1000);
    const d = Math.floor(totalSeconds / (3600 * 24));
    const h = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return { d, h, m };
  };

  // Rapid mount shuffle effect
  useEffect(() => {
    if (!isShuffling) return;

    const { d: targetDays, h: targetHours, m: targetMinutes } = getTargetValues();

    if (targetDays === 0 && targetHours === 0 && targetMinutes === 0) {
      setIsShuffling(false);
      return;
    }

    const shuffleInterval = setInterval(() => {
      setDays(prev => {
        if (prev < targetDays) {
          const gap = targetDays - prev;
          if (gap > 40) {
            return prev + Math.ceil(gap / 12);
          }
          return prev + 1;
        }
        return targetDays;
      });

      setHours(prev => {
        if (prev < targetHours) {
          return prev + 1;
        }
        return targetHours;
      });

      setMinutes(prev => {
        if (prev < targetMinutes) {
          const gap = targetMinutes - prev;
          if (gap > 25) {
            return prev + Math.ceil(gap / 6);
          }
          return prev + 1;
        }
        return targetMinutes;
      });
    }, 30); // 30ms for that amazing energetic mechanical chatter

    return () => clearInterval(shuffleInterval);
  }, [propTargetDate, isShuffling]);

  // Smooth handoff from shuffling to active countdown
  useEffect(() => {
    if (!isShuffling) return;

    const { d: targetDays, h: targetHours, m: targetMinutes } = getTargetValues();
    if (days >= targetDays && hours >= targetHours && minutes >= targetMinutes) {
      setIsShuffling(false);
    }
  }, [days, hours, minutes, isShuffling]);

  // Standard countdown interval once shuffle is complete
  useEffect(() => {
    if (isShuffling) return;

    const calculateTimeRemaining = () => {
      const { d, h, m } = getTargetValues();
      setDays(prev => (prev !== d ? d : prev));
      setHours(prev => (prev !== h ? h : prev));
      setMinutes(prev => (prev !== m ? m : prev));
    };

    calculateTimeRemaining();
    const intervalId = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(intervalId);
  }, [isShuffling, propTargetDate]);

  return (
    <div className="flex items-center space-x-2.5 overflow-visible py-2">
      <SplitFlapCard value={days} label="DAYS" />
      <SplitFlapCard value={hours} label="HRS" />
      <SplitFlapCard value={minutes} label="MINS" />
    </div>
  );
};
