import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform, MotionValue } from 'motion/react';

interface MagneticLetterTopProps {
  key?: React.Key;
  char: string;
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  isTouchMotion: MotionValue<number>;
  bgColor?: string;
  disabled?: boolean;
}

function MagneticLetterTop({
  char,
  mouseX,
  mouseY,
  isTouchMotion,
  bgColor = '#ffffff',
  disabled = false,
}: MagneticLetterTopProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { stiffness: 180, damping: 15, mass: 0.8 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const blurValue = useTransform([springX, springY], ([latestX, latestY]) => {
    if (disabled) return 'none';
    const valX = typeof latestX === 'number' ? latestX : parseFloat(String(latestX)) || 0;
    const valY = typeof latestY === 'number' ? latestY : parseFloat(String(latestY)) || 0;
    const distance = Math.hypot(valX, valY);
    const blurAmount = Math.min(distance * 0.12, 4);
    return blurAmount > 0.05 ? `blur(${blurAmount.toFixed(2)}px)` : 'none';
  });

  useEffect(() => {
    if (disabled) {
      x.set(0);
      y.set(0);
      return;
    }

    const updatePull = () => {
      if (!containerRef.current) return;
      
      const mX = mouseX.get();
      const mY = mouseY.get();
      
      if (mX === -10000 || mY === -10000) {
        x.set(0);
        y.set(0);
        return;
      }
      
      const rect = containerRef.current.getBoundingClientRect();
      const letterCenterX = rect.left + rect.width / 2;
      const letterCenterY = rect.top + rect.height / 2;

      const isTouch = isTouchMotion.get() === 1 || window.matchMedia('(pointer: coarse)').matches;

      if (isTouch) {
        // MOBILE / TOUCH REPULSION
        // Vector = ObjectPosition - TouchPosition (pushing AWAY from finger)
        const repulsionX = letterCenterX - mX;
        const repulsionY = letterCenterY - mY;
        const distance = Math.hypot(repulsionX, repulsionY);

        // Increased radius for mobile touch (~350px)
        const threshold = 350;
        if (distance < threshold) {
          const ratio = 1 - (distance / threshold);
          const falloffRatio = ratio * ratio;
          const pushFactor = 0.5;
          x.set(repulsionX * pushFactor * falloffRatio);
          y.set(repulsionY * pushFactor * falloffRatio);
        } else {
          x.set(0);
          y.set(0);
        }
      } else {
        // DESKTOP MOUSE INTERACTION
        const distanceX = mX - letterCenterX;
        const distanceY = mY - letterCenterY;
        const distance = Math.hypot(distanceX, distanceY);

        const threshold = 180;
        if (distance < threshold) {
          const ratio = 1 - (distance / threshold);
          const falloffRatio = ratio * ratio;
          const pullFactor = 0.45;
          x.set(distanceX * pullFactor * falloffRatio);
          y.set(distanceY * pullFactor * falloffRatio);
        } else {
          x.set(0);
          y.set(0);
        }
      }
    };

    const unsubscribeX = mouseX.on("change", updatePull);
    const unsubscribeY = mouseY.on("change", updatePull);
    const unsubscribeTouch = isTouchMotion.on("change", updatePull);

    window.addEventListener('scroll', updatePull, { passive: true });

    updatePull();

    return () => {
      unsubscribeX();
      unsubscribeY();
      unsubscribeTouch();
      window.removeEventListener('scroll', updatePull);
    };
  }, [mouseX, mouseY, isTouchMotion, disabled]);

  return (
    <span
      ref={containerRef}
      className="relative inline-block select-none cursor-default"
      style={{ display: 'inline-block' }}
    >
      <motion.span
        className="block"
        style={{
          color: bgColor,
          pointerEvents: 'none',
          x: springX,
          y: springY,
          filter: blurValue,
          zIndex: 10,
          ...(disabled ? { transform: 'translate(0px, 0px)', transition: 'none' } : {})
        }}
      >
        {char}
      </motion.span>
    </span>
  );
}

interface MagneticTextProps {
  text: string;
  bgColor?: string;
}

export default function MagneticText({ text, bgColor = '#ffffff' }: MagneticTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);

  const mouseX = useMotionValue(-10000);
  const mouseY = useMotionValue(-10000);
  const isTouchMotion = useMotionValue(0);
  const [isPaintMode, setIsPaintMode] = useState(false);
  const [isGooglyMode, setIsGooglyMode] = useState(false);
  const [isChaosActive, setIsChaosActive] = useState(false);

  useEffect(() => {
    const checkModes = () => {
      const mode = document.body.getAttribute('data-chaos-mode');
      const isPaint = document.body.classList.contains('chaos-paint') || mode === 'paint';
      const isGoogly = document.body.classList.contains('chaos-googly') || mode === 'googly';
      const isChaos = document.body.classList.contains('chaos-active') || (!!mode && mode !== 'normal');

      setIsPaintMode(isPaint);
      setIsGooglyMode(isGoogly);
      setIsChaosActive(isChaos);
    };
    checkModes();

    const observer = new MutationObserver(checkModes);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-chaos-mode'] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isPaintMode || isChaosActive || isGooglyMode) {
      mouseX.set(-10000);
      mouseY.set(-10000);
      return;
    }

    let touchResetTimer: any = null;
    let lastTouchTime = 0;

    const clearResetTimer = () => {
      if (touchResetTimer) {
        clearTimeout(touchResetTimer);
        touchResetTimer = null;
      }
    };

    const resetToNeutral = () => {
      clearResetTimer();
      mouseX.set(-10000);
      mouseY.set(-10000);
      isTouchMotion.set(0);
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Ignore synthesized mousemove events dispatched by mobile browsers following touch events
      if (Date.now() - lastTouchTime < 1500) {
        return;
      }

      const isCoarse = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
      if (isCoarse) {
        // If on mobile/coarse pointer, ensure any mouse interaction is temporary and reverts
        clearResetTimer();
        isTouchMotion.set(1);
        mouseX.set(e.clientX);
        mouseY.set(e.clientY);
        touchResetTimer = setTimeout(resetToNeutral, 600);
      } else {
        clearResetTimer();
        isTouchMotion.set(0);
        mouseX.set(e.clientX);
        mouseY.set(e.clientY);
      }
    };

    const handleMouseLeaveWindow = () => {
      resetToNeutral();
    };

    const handleTouchStart = (e: TouchEvent) => {
      lastTouchTime = Date.now();
      clearResetTimer();

      if (e.touches.length > 0) {
        isTouchMotion.set(1);
        const touch = e.touches[0];
        mouseX.set(touch.clientX);
        mouseY.set(touch.clientY);

        // Guarantee the displacement effect is strictly temporary (auto-springs back after 700ms even if held)
        touchResetTimer = setTimeout(resetToNeutral, 700);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      lastTouchTime = Date.now();
      clearResetTimer();

      if (e.touches.length > 0) {
        isTouchMotion.set(1);
        const touch = e.touches[0];
        mouseX.set(touch.clientX);
        mouseY.set(touch.clientY);

        // Maintain temporary bound
        touchResetTimer = setTimeout(resetToNeutral, 700);
      }
    };

    const handleTouchEnd = () => {
      lastTouchTime = Date.now();
      clearResetTimer();
      // On tap release, smoothly return letters back over the colorful layer
      touchResetTimer = setTimeout(resetToNeutral, 180);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseleave', handleMouseLeaveWindow);
    
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      clearResetTimer();
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeaveWindow);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [mouseX, mouseY, isTouchMotion, isPaintMode, isChaosActive, isGooglyMode]);

  const colors = [
    '#ff07ef',
    '#035aa6',
    '#f2441d',
    '#f294c8',
    '#03c045',
    '#f2e205',
    '#128fff',
    '#f2137b',
    '#44daa7',
    '#ffc022',
    '#8100ff'
  ];

  const words = text.split(' ');
  let globalCharIdx = 0;

  return (
    <span 
      ref={containerRef}
      className="magnetic-text-container inline-flex flex-nowrap items-center whitespace-nowrap overflow-visible py-2"
    >
      {words.map((word, wordIdx) => {
        const wordChars = word.split('');
        const wordColors = wordChars.map(() => {
          const c = colors[globalCharIdx % colors.length];
          globalCharIdx++;
          return c;
        });

        return (
          <React.Fragment key={wordIdx}>
            {wordIdx > 0 && (
              <span className="inline-block w-[0.25em]" aria-hidden="true">
                &nbsp;
              </span>
            )}
            <span className="relative inline-flex items-center">
              {/* Bottom Layer: Colored letters (hidden during paint mode or googly mode to render pristine white text only) */}
              <span
                className="inline-flex items-center pointer-events-none select-none transition-opacity duration-200"
                style={{ opacity: (isPaintMode || isGooglyMode) ? 0 : 1, visibility: (isPaintMode || isGooglyMode) ? 'hidden' : 'visible' }}
              >
                {wordChars.map((char, cIdx) => (
                  <span
                    key={cIdx}
                    style={{ color: wordColors[cIdx] }}
                    className="inline-block"
                  >
                    {char}
                  </span>
                ))}
              </span>

              {/* Top Layer: White text wrapped in data-chaos="word" */}
              <span
                data-chaos="word"
                data-text={word}
                className="absolute top-0 left-0 w-full h-full inline-flex items-center"
              >
                {wordChars.map((char, cIdx) => (
                  <MagneticLetterTop
                    key={cIdx}
                    char={char}
                    mouseX={mouseX}
                    mouseY={mouseY}
                    isTouchMotion={isTouchMotion}
                    bgColor={bgColor}
                    disabled={isPaintMode || isGooglyMode || isChaosActive}
                  />
                ))}
              </span>
            </span>
          </React.Fragment>
        );
      })}
    </span>
  );
}

