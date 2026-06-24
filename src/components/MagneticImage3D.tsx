import React, { useRef, useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface MagneticImage3DProps {
  src: string;
  alt: string;
  isHovered?: boolean;
  isAnyHovered?: boolean;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  key?: React.Key;
  isSelected?: boolean;
  onSelect?: () => void;
}

export default function MagneticImage3D({ 
  src, 
  alt,
  isHovered = false,
  isAnyHovered = false,
  onHoverStart,
  onHoverEnd,
  isSelected = false,
  onSelect
}: MagneticImage3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [hasGyro, setHasGyro] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const initialOrientationRef = useRef<{ beta: number; gamma: number } | null>(null);

  // Detect mobile viewport (under 768px matching Tailwind md:)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Normalized positional values (target coordinates between -0.5 and 0.5)
  const x = useMotionValue(0); 
  const y = useMotionValue(0); 

  // Smooth springs with realistic physical damping and stiffness
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [15, -15]), {
    damping: 25,
    stiffness: 150,
  });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-15, 15]), {
    damping: 25,
    stiffness: 150,
  });

  // Enhanced gyroscopic transforms for the lightbox view (+20% intensity: 15 * 1.2 = 18 degrees limits)
  const lightboxRotateX = useSpring(useTransform(y, [-0.5, 0.5], [18, -18]), {
    damping: 25,
    stiffness: 150,
  });
  const lightboxRotateY = useSpring(useTransform(x, [-0.5, 0.5], [-18, 18]), {
    damping: 25,
    stiffness: 150,
  });

  const scale = useSpring(1.0, {
    damping: 25,
    stiffness: 150,
  });

  const translateZ = useSpring(0, {
    damping: 25,
    stiffness: 150,
  });

  // Animate grid scale based on hover states and selection state
  useEffect(() => {
    if (isLightboxOpen) {
      scale.set(1.0);
      translateZ.set(0);
    } else if (isMobile) {
      if (isSelected) {
        scale.set(1.0); // Scale up to the full original size (1.0) when clicked/selected on mobile
        translateZ.set(40);
      } else if (isHovered) {
        scale.set(0.92); // Elegant scale up from baseline 0.85 on hover on mobile
        translateZ.set(25);
      } else if (isAnyHovered) {
        scale.set(0.80); // Scale down surrounding elements slightly on mobile
        translateZ.set(-15);
      } else {
        scale.set(0.85); // Baseline is 15% scaled down on mobile
        translateZ.set(0);
      }
    } else {
      // Desktop behaviors
      if (isHovered) {
        scale.set(1.05); // Elegant slight scale up for grid hover on desktop
        translateZ.set(40);
      } else if (isAnyHovered) {
        scale.set(0.95); // Scale down surrounding elements elegantly on desktop
        translateZ.set(-15);
      } else {
        scale.set(1.0); // Baseline is 1.0 on desktop
        translateZ.set(0);
      }
    }
  }, [isHovered, isAnyHovered, isSelected, isLightboxOpen, isMobile, scale, translateZ]);

  // Handle device orientation tracking on mobile/tablet viewports
  useEffect(() => {
    let active = true;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!active) return;
      const { beta, gamma } = e;
      if (beta === null || gamma === null) return;

      // On first reading, set baseline relative orientation
      if (!initialOrientationRef.current) {
        initialOrientationRef.current = { beta, gamma };
        setHasGyro(true);
        return;
      }

      // Smooth drift baseline auto-calibration (keeps interactive window centered gracefully)
      const alpha = 0.05;
      initialOrientationRef.current.beta = initialOrientationRef.current.beta * (1 - alpha) + beta * alpha;
      initialOrientationRef.current.gamma = initialOrientationRef.current.gamma * (1 - alpha) + gamma * alpha;

      const deltaBeta = beta - initialOrientationRef.current.beta;
      const deltaGamma = gamma - initialOrientationRef.current.gamma;

      // Map dynamic deviation angles of +/- 15 deg to normal motion coordinate space [-1, 1]
      const normY = Math.min(Math.max(deltaBeta / 15, -1), 1);
      const normX = Math.min(Math.max(deltaGamma / 15, -1), 1);

      // Keep motion values mapped comfortably in physical view
      x.set(normX * 0.5);
      y.set(normY * 0.5);
      
      setHasGyro(true);
    };

    // Listen only on touch/mobile viewports to respect CPU performance
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice && typeof window !== 'undefined') {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      active = false;
      if (isTouchDevice && typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, [x, y]);

  // Fallback: Elegant subtle auto-orbit shifting when sensor is inactive/unavailable
  useEffect(() => {
    if (hasGyro || isHovered || isLightboxOpen) return;

    let animId: number;
    // Non-synchronized offset derived from the asset path
    const offset = src.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) * 0.03;

    const tick = () => {
      const time = Date.now() * 0.0006 + offset;
      const driftX = Math.sin(time) * 0.06;
      const driftY = Math.cos(time * 0.8) * 0.06;

      x.set(driftX);
      y.set(driftY);

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [hasGyro, isHovered, isLightboxOpen, src, x, y]);

  // Cursor-based mouse interaction for desktop
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hasGyro || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = (mouseX / width) - 0.5;
    const yPct = (mouseY / height) - 0.5;

    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseEnter = () => {
    if (onHoverStart) onHoverStart();
  };

  const handleMouseLeave = () => {
    if (!hasGyro) {
      x.set(0);
      y.set(0);
    }
    if (onHoverEnd) onHoverEnd();
  };

  // Safe gesture-driven orientation authorization for iOS Safari
  const handleImageClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const state = await (DeviceOrientationEvent as any).requestPermission();
        if (state === 'granted') {
          initialOrientationRef.current = null; // Forces re-calibration with fresh orientation baseline
        }
      } catch (err) {
        console.warn('Orientation permission not explicitly authorized:', err);
      }
    }

    if (!isMobile) {
      setIsLightboxOpen(true);
    } else {
      if (isSelected) {
        setIsLightboxOpen(true);
      } else {
        if (onSelect) onSelect();
      }
    }
  };

  return (
    <>
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleImageClick}
        className={`relative aspect-[3/2] select-none cursor-pointer transition-all duration-500 ease-out ${
          isHovered 
            ? 'z-30' 
            : isAnyHovered 
              ? 'z-10 opacity-50 blur-[1px] brightness-75 contrast-[0.98]' 
              : 'z-20 opacity-100'
        }`}
        style={{
          perspective: 1200,
        }}
      >
        <motion.div
          className="w-full h-full relative rounded-xl overflow-hidden border bg-zinc-950 transition-colors duration-500 ease-out"
          style={{
            rotateX,
            rotateY,
            scale,
            z: translateZ,
            transformStyle: 'preserve-3d',
            borderColor: isHovered ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)',
            boxShadow: isHovered 
              ? '0 30px 50px -15px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 255, 255, 0.08)' 
              : '0 8px 16px -4px rgba(0, 0, 0, 0.4)'
          }}
        >
          <img
            src={src}
            alt={alt}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover select-none pointer-events-none"
          />
          {/* Subtle shifting glass reflection */}
          <div 
            className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 mix-blend-overlay pointer-events-none rounded-xl"
            style={{
              transform: 'translateZ(30px)',
            }}
          />
        </motion.div>
      </div>

      {/* Portal-Rendered Mobile/Tablet Fluid Lightbox */}
      <AnimatePresence>
        {isLightboxOpen && typeof document !== 'undefined' && createPortal(
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/95 backdrop-blur-xl"
            onClick={() => setIsLightboxOpen(false)}
          >
            {/* Minimal Close Button */}
            <button 
              onClick={(e) => { e.stopPropagation(); setIsLightboxOpen(false); }}
              className="absolute top-6 right-6 p-3 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 text-white/60 hover:text-white transition-all duration-300 z-50 cursor-pointer"
              aria-label="Close Lightbox"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Immersive 3D Image Card with multi-axis drag-to-dismiss */}
            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.6}
              onDragEnd={(_, info) => {
                if (Math.abs(info.offset.y) > 120) {
                  setIsLightboxOpen(false);
                }
              }}
              initial={{ scale: 0.92, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="relative max-w-[92vw] max-h-[82vh] flex items-center justify-center rounded-2xl overflow-hidden border border-white/10 bg-zinc-950 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.9)] cursor-grab active:cursor-grabbing select-none"
              onClick={(e) => e.stopPropagation()}
              style={{
                rotateX: lightboxRotateX,
                rotateY: lightboxRotateY,
                transformStyle: 'preserve-3d',
                perspective: 1000,
              }}
            >
              <img
                src={src}
                alt={alt}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[82vh] object-contain select-none pointer-events-none rounded-2xl"
              />
              {/* Dynamic reflection overlay */}
              <div 
                className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/15 mix-blend-overlay pointer-events-none rounded-2xl"
                style={{
                  transform: 'translateZ(40px)',
                }}
              />
            </motion.div>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>
    </>
  );
}
