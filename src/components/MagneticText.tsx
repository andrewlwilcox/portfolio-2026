import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform, MotionValue } from 'motion/react';

interface MagneticLetterProps {
  char: string;
  color: string;
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  bgColor?: string;
  isParentHovered?: boolean;
  key?: React.Key;
}

interface MobileMagneticLetterProps {
  char: string;
  color: string;
  touchX: MotionValue<number>;
  bgColor?: string;
  key?: React.Key;
}

export function MobileMagneticLetter({
  char,
  color,
  touchX,
  bgColor = '#ffffff'
}: MobileMagneticLetterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  
  // Motion values for mobile touch repulsion
  const x = useMotionValue(0);
  
  // Spring physics for snapping back with Framer Motion spring
  const springX = useSpring(x, { stiffness: 220, damping: 18, mass: 0.5 });
  
  // Dynamic CSS filter blur based on how far it translates
  const blurValue = useTransform(springX, (latestX) => {
    const val = Math.abs(latestX);
    // Maps displacement (0-67.5px) to blur radius (0-4.5px)
    const blurAmount = Math.min(val * 0.15, 4.5);
    return blurAmount > 0.05 ? `blur(${blurAmount.toFixed(2)}px)` : 'none';
  });

  useEffect(() => {
    const unsubscribe = touchX.on("change", (latestTouchX) => {
      if (latestTouchX === -10000) {
        // When user lifts their thumb, instantly snap the motion target back to 0
        x.set(0);
        return;
      }
      
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const letterCenterX = rect.left + rect.width / 2;
      
      const dx = letterCenterX - latestTouchX;
      const absDx = Math.abs(dx);
      const threshold = 140; // Proximity threshold in pixels
      
      if (absDx < threshold) {
        const ratio = 1 - (absDx / threshold);
        // Proximity-based repulsion math (quadratic falloff for dramatic effect)
        const pushForce = Math.pow(ratio, 2.2) * 67.5; // Up to 67.5px repulsion
        const targetX = Math.sign(dx) * pushForce;
        x.set(targetX);
      } else {
        x.set(0);
      }
    });

    return () => unsubscribe();
  }, [touchX, x]);

  return (
    <span
      ref={ref}
      className="relative inline-block select-none"
      style={{ display: 'inline-block' }}
    >
      {/* BOTTOM LAYER (Static Reveal - colored letter) */}
      <span
        style={{
          color: color,
          pointerEvents: 'none',
        }}
        className="inline-block"
      >
        {char}
      </span>

      {/* TOP LAYER (Interactive solid white overlap with Motion Blur) */}
      <motion.span
        className="absolute top-0 left-0 w-full h-full block"
        style={{
          color: '#ffffff',
          pointerEvents: 'none',
          x: springX,
          filter: blurValue,
          zIndex: 10,
        }}
      >
        {char}
      </motion.span>
    </span>
  );
}

export function MagneticLetter({
  char,
  color,
  mouseX,
  mouseY,
  bgColor = '#ffffff',
  isParentHovered = false
}: MagneticLetterProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  
  // Motion values for magnetic pull translation
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Spring physics setup for buttery smooth, organic snap back
  const springConfig = { stiffness: 180, damping: 15, mass: 0.8 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  // Dynamic opacity MotionValue and spring
  const opacity = useMotionValue(0);
  const springOpacity = useSpring(opacity, { stiffness: 120, damping: 20 });

  // Fallback / local hover override (for direct hovering and mobile taps)
  const displayOpacity = useTransform(springOpacity, (latestOpacity) => {
    if (isParentHovered) return 1;
    return latestOpacity;
  });

  // Dynamic motion blur calculation based on spring-animated distance traveled
  const blurValue = useTransform([springX, springY], ([latestX, latestY]) => {
    const valX = typeof latestX === 'number' ? latestX : parseFloat(String(latestX)) || 0;
    const valY = typeof latestY === 'number' ? latestY : parseFloat(String(latestY)) || 0;
    const distance = Math.hypot(valX, valY);
    // Map distance to a subtle blur radius (e.g. 0px to 4px max)
    const blurAmount = Math.min(distance * 0.12, 4);
    return blurAmount > 0.05 ? `blur(${blurAmount.toFixed(2)}px)` : 'none';
  });

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        ('ontouchstart' in window) || 
        (navigator.maxTouchPoints > 0) ||
        window.innerWidth < 768
      );
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const updatePull = () => {
      if (isMobile || !containerRef.current) return;
      
      const mX = mouseX.get();
      const mY = mouseY.get();
      
      // If cursor coordinates are reset to default resting off-screen position, return to rest
      if (mX === -10000 || mY === -10000) {
        x.set(0);
        y.set(0);
        opacity.set(0);
        return;
      }
      
      const rect = containerRef.current.getBoundingClientRect();
      const letterCenterX = rect.left + rect.width / 2;
      const letterCenterY = rect.top + rect.height / 2;

      const distanceX = mX - letterCenterX;
      const distanceY = mY - letterCenterY;
      const distance = Math.hypot(distanceX, distanceY);

      // Increased awareness threshold to 180px so letters respond to ambient nearby hovers
      const threshold = 180;
      if (distance < threshold) {
        // Calculate pull factor proportionally (stronger pull when closer, dropping off quadratically)
        const ratio = 1 - (distance / threshold); // 1 to 0
        const falloffRatio = ratio * ratio; // quadratic falloff
        
        const pullFactor = 0.45;
        x.set(distanceX * pullFactor * falloffRatio);
        y.set(distanceY * pullFactor * falloffRatio);

        // Opacity transition: fully visible when close (40px or less), fades to 0 at 180px
        const opVal = 1 - Math.max(0, (distance - 40) / (threshold - 40));
        opacity.set(Math.max(0, Math.min(1, opVal)));
      } else {
        x.set(0);
        y.set(0);
        opacity.set(0);
      }
    };

    const unsubscribeX = mouseX.on("change", updatePull);
    const unsubscribeY = mouseY.on("change", updatePull);

    // Initial calculation
    updatePull();

    return () => {
      unsubscribeX();
      unsubscribeY();
    };
  }, [isMobile, mouseX, mouseY]);

  return (
    <span
      ref={containerRef}
      className="relative inline-block select-none cursor-default"
      style={{
        display: 'inline-block',
      }}
    >
      {/* BOTTOM LAYER (Static Reveal - loops through portfolio colors, dynamically faded) */}
      <motion.span
        style={{
          color: color,
          pointerEvents: 'none',
          opacity: isMobile ? (isParentHovered ? 1 : 0) : displayOpacity,
        }}
        className="inline-block"
      >
        {char}
      </motion.span>

      {/* TOP LAYER (Magnetic Background Color Matching Overlap with Motion Blur) */}
      <motion.span
        className="absolute top-0 left-0 w-full h-full block"
        style={{
          color: bgColor,
          pointerEvents: 'none',
          x: isMobile ? 0 : springX,
          y: isMobile ? 0 : springY,
          filter: isMobile ? 'none' : blurValue,
          zIndex: 10,
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
  const [isParentHovered, setIsParentHovered] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  // Detect mobile viewport (under 768px matching Tailwind md:)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    setIsMobileViewport(mediaQuery.matches);
    
    const listener = (e: MediaQueryListEvent) => {
      setIsMobileViewport(e.matches);
    };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // Coordinate motion values tracked at the block / window level
  const mouseX = useMotionValue(-10000);
  const mouseY = useMotionValue(-10000);

  // Motion value for mobile touch tracking
  const touchX = useMotionValue(-10000);

  // Track global window mousemove for ambient awareness
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    const handleMouseLeaveWindow = () => {
      // Return characters to resting states when user exits browser viewport
      mouseX.set(-10000);
      mouseY.set(-10000);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseleave', handleMouseLeaveWindow);
    
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeaveWindow);
    };
  }, [mouseX, mouseY]);

  // Touch event handlers for mobile repulsion physics
  const handleTouchStart = (e: React.TouchEvent<HTMLSpanElement>) => {
    if (e.touches.length > 0) {
      touchX.set(e.touches[0].clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLSpanElement>) => {
    if (e.touches.length > 0) {
      touchX.set(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = () => {
    touchX.set(-10000);
  };

  // Local element triggers (for immediate visual feedback / mobile interactions)
  const handleMouseMove = () => {
    setIsParentHovered(true);
  };

  const handleMouseLeave = () => {
    setIsParentHovered(false);
  };

  // Exact color palette requested by user
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

  let charIdx = 0;

  if (isMobileViewport) {
    return (
      <span 
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="inline-flex flex-nowrap items-center whitespace-nowrap overflow-visible py-2"
      >
        {text.split('').map((char, index) => {
          if (char === ' ') {
            return (
              <span key={index} className="inline-block w-[0.25em]" aria-hidden="true">
                &nbsp;
              </span>
            );
          }
          const color = colors[charIdx % colors.length];
          charIdx++;
          return (
            <MobileMagneticLetter
              key={index}
              char={char}
              color={color}
              touchX={touchX}
              bgColor={bgColor}
            />
          );
        })}
      </span>
    );
  }

  return (
    <span 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="inline-flex flex-nowrap items-center whitespace-nowrap overflow-visible py-2"
    >
      {text.split('').map((char, index) => {
        if (char === ' ') {
          return (
            <span key={index} className="inline-block w-[0.25em]" aria-hidden="true">
              &nbsp;
            </span>
          );
        }
        const color = colors[charIdx % colors.length];
        charIdx++;
        return (
          <MagneticLetter
            key={index}
            char={char}
            color={color}
            mouseX={mouseX}
            mouseY={mouseY}
            bgColor={bgColor}
            isParentHovered={isParentHovered}
          />
        );
      })}
    </span>
  );
}
