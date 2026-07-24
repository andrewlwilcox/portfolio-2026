import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check, X, Sparkles } from 'lucide-react';

export type ChaosMode = 'normal' | 'bulldoze' | 'zerog' | 'paint' | 'shoot' | 'googly' | 'plinko';

interface ChaosWidgetProps {
  chaosMode: ChaosMode;
  setChaosMode: (mode: ChaosMode) => void;
}

const MODE_OPTIONS: { value: ChaosMode; label: string }[] = [
  { value: 'bulldoze', label: 'Bulldoze' },
  { value: 'zerog', label: 'Zero-G' },
  { value: 'paint', label: 'Paint' },
  { value: 'shoot', label: 'Shoot' },
  { value: 'googly', label: 'Googly Eye' },
  { value: 'plinko', label: 'Plinko' },
];

export const ChaosWidget: React.FC<ChaosWidgetProps> = ({ chaosMode, setChaosMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGlitching, setIsGlitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. Placeholder Reaction: Update body data attribute, toggle chaos-active class, & log to console
  useEffect(() => {
    document.body.setAttribute('data-chaos-mode', chaosMode);
    if (chaosMode !== 'normal') {
      document.body.classList.add('chaos-active');
    } else {
      document.body.classList.remove('chaos-active');
    }
    console.log(`[Chaos Mode]: ${chaosMode}`);
  }, [chaosMode]);

  // 2. Escape Hatch Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        setChaosMode('normal');
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setChaosMode]);

  // 3. Click outside handler to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 4. Timed Glitch Teaser: Flash "DESTROY" with skewed glitch aesthetic at 2s, then every 5s for 150ms
  const isChaosActive = chaosMode !== 'normal';

  useEffect(() => {
    if (isChaosActive) {
      setIsGlitching(false);
      return;
    }

    let initialTimer: ReturnType<typeof setTimeout>;
    let intervalTimer: ReturnType<typeof setInterval>;
    let glitchOffTimeout: ReturnType<typeof setTimeout>;

    const triggerGlitchFlash = () => {
      setIsGlitching(true);
      glitchOffTimeout = setTimeout(() => {
        setIsGlitching(false);
      }, 150);
    };

    // Initial glitch trigger at 2000ms (2 seconds) after mount / reset
    initialTimer = setTimeout(() => {
      triggerGlitchFlash();

      // Continuous interval every 5000ms (5 seconds)
      intervalTimer = setInterval(() => {
        triggerGlitchFlash();
      }, 5000);
    }, 2000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      clearTimeout(glitchOffTimeout);
    };
  }, [isChaosActive]);

  const activeOption = MODE_OPTIONS.find((opt) => opt.value === chaosMode);

  return (
    <>
      <style>{`
        body.chaos-active {
          background-color: #000000 !important;
          background: #000000 !important;
        }
        body.chaos-active *:not([data-chaos-ignore="true"]):not([data-chaos-ignore="true"] *) {
          pointer-events: none !important;
        }
      `}</style>

      {/* -------------------------------------------------------------------------
          THE TRIGGER WIDGET / IN-PLACE ESCAPE PROMPT (Strictly Desktop Only)
          ------------------------------------------------------------------------- */}
      <div ref={dropdownRef} className="hidden md:flex flex-col items-end relative text-right select-none ml-auto" data-chaos-ignore="true">
        <AnimatePresence mode="wait">
          {isChaosActive ? (
            <motion.div
              key="escape-prompt"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="flex items-center justify-end ml-auto"
              data-chaos-ignore="true"
              style={{ mixBlendMode: 'normal', opacity: 1 }}
            >
              <div 
                className="font-mono text-xs font-bold px-3 py-1.5 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.8)] flex items-center gap-2 select-none border border-black/10 max-w-[260px] text-right ml-auto"
                style={{ mixBlendMode: 'normal', opacity: 1, backgroundColor: '#ffffff', color: '#000000' }}
              >
                <span className="w-2 h-2 rounded-full bg-black animate-pulse flex-shrink-0" style={{ opacity: 1 }} />
                <span className="text-black font-bold whitespace-nowrap" style={{ color: '#000000', opacity: 1 }}>Hit</span>
                <kbd 
                  onClick={() => setChaosMode('normal')}
                  title="Press Esc or click to reset"
                  className="chaos-esc-kbd cursor-pointer px-2 py-0.5 rounded text-xs font-mono font-bold shadow-sm transition-all hover:scale-105 active:scale-95 inline-flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#000000', color: '#ffffff', opacity: 1, mixBlendMode: 'normal', filter: 'none' }}
                >
                  <span style={{ color: '#ffffff', opacity: 1, mixBlendMode: 'normal', filter: 'none' }}>esc</span>
                </kbd>
                <span className="text-black font-bold text-[11px] leading-tight whitespace-nowrap" style={{ color: '#000000', opacity: 1 }}>to reset</span>
                <button
                  type="button"
                  onClick={() => setChaosMode('normal')}
                  className="chaos-close-btn ml-0.5 p-1 rounded-full transition-colors cursor-pointer inline-flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#000000', color: '#ffffff', opacity: 1, mixBlendMode: 'normal', filter: 'none' }}
                  title="Reset site to normal"
                  aria-label="Reset site to normal"
                >
                  <X 
                    className="w-3.5 h-3.5 stroke-[2.5]" 
                    style={{ fill: '#ffffff', stroke: '#ffffff', opacity: 1, mixBlendMode: 'normal', filter: 'none' }}
                  />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="widget-trigger"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="inline-flex items-center justify-end gap-2 md:gap-2.5 ml-auto"
            >
              {/* Outlined Pill Button containing Caret + VANDALIZE / DESTROY */}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className={`px-3 py-1.5 rounded-full border font-mono text-xs tracking-wider uppercase opacity-80 hover:opacity-100 hover:scale-[1.03] transition-all flex items-center space-x-1.5 focus:outline-none relative cursor-pointer min-w-[115px] justify-center ${
                  isChaosActive
                    ? 'border-amber-400 text-amber-300 opacity-100'
                    : isGlitching
                    ? 'opacity-100'
                    : 'border-current text-white'
                }`}
                style={
                  isGlitching
                    ? {
                        transform: 'skewX(-15deg)',
                        color: '#ff007f',
                        borderColor: '#ff007f',
                        textShadow: '2px 0 #00ffff',
                        boxShadow: '0 0 12px rgba(255, 0, 127, 0.8)',
                      }
                    : undefined
                }
                aria-expanded={isOpen}
                aria-haspopup="true"
              >
                <ChevronDown 
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`} 
                />
                <span className="inline-block text-center w-[78px]">
                  {isGlitching ? 'DESTROY' : 'VANDALIZE'}
                </span>
              </button>

              {/* "MY SITE" clean text */}
              <div className="inline-flex items-center">
                <span className="font-mono text-xs tracking-wider uppercase opacity-80 text-white">
                  MY SITE
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bare Dropdown Menu (Right-justified) */}
        <AnimatePresence>
          {!isChaosActive && isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute right-0 top-full mt-2 w-max z-50 text-right space-y-1.5 py-1"
            >
              {MODE_OPTIONS.map((opt) => {
                const isSelected = chaosMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setChaosMode(opt.value);
                      setIsOpen(false);
                    }}
                    className={`block w-full text-right font-mono text-xs tracking-wider uppercase transition-opacity cursor-pointer ${
                      isSelected
                        ? 'opacity-100 text-white font-bold'
                        : 'opacity-60 hover:opacity-100 text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default ChaosWidget;

