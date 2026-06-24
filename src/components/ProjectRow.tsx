import React, { useRef, useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Project } from '../types';

interface ProjectRowProps {
  project: Project;
  index: number;
  numStr: string;
  displayTitle: string;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  isMobileActive: boolean;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
  onTouchCancel?: () => void;
  key?: React.Key;
}

export default function ProjectRow({
  project,
  index,
  numStr,
  displayTitle,
  onClick,
  onMouseEnter,
  onMouseLeave,
  isMobileActive,
  onTouchStart,
  onTouchEnd,
  onTouchCancel
}: ProjectRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
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

  return (
    <motion.div
      ref={rowRef}
      data-project-id={project.id}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      className="group relative py-4 md:py-6 cursor-pointer transition-all duration-300 flex items-center justify-between gap-3 md:gap-6 overflow-hidden text-[#f4f4f7]"
    >
      {/* MOBILE ONLY: Rapid, smooth expanding GIF background behind text */}
      {project.hoverGifUrl && (
        <motion.div
          animate={isMobileActive ? 'active' : 'inactive'}
          variants={{
            inactive: {
              right: '24px',
              left: 'calc(100% - 56px)',
              width: '32px',
              height: '32px',
              top: '50%',
              y: '-50%',
              borderRadius: '4px',
              borderStyle: 'solid',
              borderWidth: '1px',
              borderColor: 'rgba(255, 255, 255, 0.12)',
              opacity: 1
            },
            active: {
              right: '0px',
              left: '0px',
              width: '100%',
              height: '100%',
              top: '0px',
              y: '0%',
              borderRadius: '0px',
              borderStyle: 'solid',
              borderWidth: '0px',
              borderColor: 'rgba(255, 255, 255, 0)',
              opacity: 1
            }
          }}
          transition={{
            duration: 0.45,
            ease: [0.16, 1, 0.3, 1], // Custom ultra-smooth easeOutExpo-like curve for snappy but fluid motion
            borderWidth: { duration: 0 }, // Instant border removal
            borderColor: { duration: 0 }
          }}
          className="md:hidden"
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            overflow: 'hidden',
            zIndex: 0
          }}
        >
          <img
            src={project.hoverGifUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          {/* Subtle overlay when active to ensure legibility */}
          {isMobileActive && (
            <div className="absolute inset-0 bg-black/40 pointer-events-none" />
          )}
        </motion.div>
      )}

      {/* Left row labels - sliding left on hover on desktop only to preserve layout and prevent mobile cropping */}
      <div className={`flex items-center space-x-3 md:space-x-12 z-10 transition-transform duration-300 md:group-hover:-translate-x-[4.25rem] ${
        isMobileViewport && isMobileActive ? '-translate-x-[1.75rem]' : ''
      }`}>
        <span className="font-mono text-xs md:text-sm tracking-widest opacity-40 select-none">
          {numStr}
        </span>
        <h3 className="font-young text-4xl md:text-8xl font-normal tracking-tight normal-case transition-all duration-300 leading-none">
          {displayTitle}
        </h3>
      </div>

      {/* DESKTOP ONLY: Right side info metadata */}
      <div className="hidden md:flex md:items-center space-x-6 md:space-x-12 z-10 font-mono text-xs tracking-wider uppercase">
        <span className="opacity-50">
          {project.category}
        </span>

        <ArrowUpRight className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
      </div>

      {/* MOBILE ONLY: Right side layout spacer & arrow */}
      <div className="flex md:hidden items-center space-x-2 z-10 font-mono text-xs tracking-wider uppercase">
        {project.hoverGifUrl && (
          <div className="w-8 h-8 shrink-0 pointer-events-none" />
        )}
        <ArrowUpRight className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity transform shrink-0" />
      </div>
    </motion.div>
  );
}
