import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useTransform, MotionValue } from 'motion/react';

// ---------------------------------------------------------------------------
// Locked Baseline Specifications ("Standard" Settings) - 11 Site Colors
// ---------------------------------------------------------------------------
const RAY_COLORS_HEX = [
  '#ff07ef', // Stop 1
  '#035aa6', // Stop 2
  '#f2441d', // Stop 3
  '#f294c8', // Stop 4
  '#03c045', // Stop 5
  '#f2e205', // Stop 6
  '#128fff', // Stop 7
  '#f2137b', // Stop 8
  '#44daa7', // Stop 9
  '#ffc022', // Stop 10
  '#8100ff', // Stop 11
];

const RAY_COLORS_RGB: [number, number, number][] = RAY_COLORS_HEX.map((hex) => {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
});

// Exactly 11 base stop positions distributed once across 0..96% (no repeating)
const BASE_POSITIONS = [0, 10, 20, 30, 40, 49, 59, 68, 78, 87, 96];

// Locked Wave & Motion Parameters
const FLOW_SPEED = 2.2;
const DIR_SIGN = 1; // +1 flowing upward & rightward toward 1:00
const AMP = 7.0; // Band Warble Depth (±7%)
const FREQ = 2.3; // Wave Frequency (2.3 waves across the stage)
const SPREAD = 0.70; // Band Independence (70%)
const COMP = 1.00; // Fluid Irregularity (100%)
const SHIM = 0.00; // Shimmer Ripple (0%)

/**
 * Exact Per-Column / Per-Slice Warbled Stop Calculation (`computeWarpedStopsAtU`)
 */
function computeWarpedStopsAtU(u: number, phase: number, warpedOut: Float32Array): void {
  const m = BASE_POSITIONS.length;
  const phiBase = u * FREQ * Math.PI * 2 - phase;

  for (let k = 0; k < m; k++) {
    // Per-stop phase offset for "Band Pinch (Accordion)" mode:
    const thetaK = k * SPREAD * 2.15;
    const alpha = phiBase + thetaK;

    // Primary wave + non-repeating secondary fluid harmonics:
    const w1 = Math.sin(alpha);
    const w2 = Math.sin(1.73 * phiBase - 0.65 * phase + 1.9 * thetaK + 1.3);
    const w3 = Math.cos(0.61 * phiBase + 0.42 * phase - 1.3 * thetaK + 2.4);
    const wShim =
      Math.sin(6.4 * phiBase - 2.8 * phase + k * 2.3) *
      Math.cos(2.7 * phiBase + 1.9 * phase);

    // Alternating accordion pinch harmonic so neighboring bands compress and expand against each other:
    const pinchHarmonic =
      (k % 2 === 0 ? 1 : -1) * Math.sin(phiBase * 1.25 - phase * 0.4) * SPREAD * 0.35;

    const combined =
      (w1 + pinchHarmonic) * (1 - 0.35 * COMP) +
      (0.65 * w2 + 0.35 * w3) * COMP +
      0.35 * SHIM * wShim;

    // Outer boundary stops (0 and m-1) move at 55% amplitude so anchors stay grounded:
    const isOuter = k === 0 || k === m - 1;
    const weight = isOuter ? 0.55 : 1.0;

    warpedOut[k] = BASE_POSITIONS[k] + AMP * weight * combined;
  }

  // Monotonic non-inverting stop clamping so color bands can pinch thin without ever crossing or flipping order:
  for (let k = 1; k < m; k++) {
    const baseGap = Math.max(1, BASE_POSITIONS[k] - BASE_POSITIONS[k - 1]);
    const minGap = Math.min(1.4, baseGap * 0.22);
    if (warpedOut[k] < warpedOut[k - 1] + minGap) {
      warpedOut[k] = warpedOut[k - 1] + minGap;
    }
  }
  for (let k = m - 2; k >= 0; k--) {
    const baseGap = Math.max(1, BASE_POSITIONS[k + 1] - BASE_POSITIONS[k]);
    const minGap = Math.min(1.4, baseGap * 0.22);
    if (warpedOut[k] > warpedOut[k + 1] - minGap) {
      warpedOut[k] = warpedOut[k + 1] - minGap;
    }
  }
}

interface CharLayoutMetric {
  char: string;
  x: number;
  baselineY: number;
  width: number;
  height: number;
}

interface SpringPair {
  x: MotionValue<number>;
  y: MotionValue<number>;
}

interface MagneticLetterTopProps {
  key?: React.Key;
  char: string;
  charIdx: number;
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  isTouchMotion: MotionValue<number>;
  springsRef: React.MutableRefObject<(SpringPair | null)[]>;
  bgColor?: string;
  disabled?: boolean;
}

function MagneticLetterTop({
  char,
  charIdx,
  mouseX,
  mouseY,
  isTouchMotion,
  springsRef,
  bgColor = '#ffffff',
  disabled = false,
}: MagneticLetterTopProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { stiffness: 180, damping: 15, mass: 0.8 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  useEffect(() => {
    springsRef.current[charIdx] = { x: springX, y: springY };
    return () => {
      springsRef.current[charIdx] = null;
    };
  }, [charIdx, springX, springY, springsRef]);

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
        // MOBILE / TOUCH REPULSION (50% reduced displacement)
        const repulsionX = letterCenterX - mX;
        const repulsionY = letterCenterY - mY;
        const distance = Math.hypot(repulsionX, repulsionY);

        const threshold = 350;
        if (distance < threshold) {
          const ratio = 1 - (distance / threshold);
          const falloffRatio = ratio * ratio;
          const pushFactor = 0.25;
          x.set(repulsionX * pushFactor * falloffRatio);
          y.set(repulsionY * pushFactor * falloffRatio);
        } else {
          x.set(0);
          y.set(0);
        }
      } else {
        // DESKTOP MOUSE INTERACTION (50% reduced displacement)
        const distanceX = mX - letterCenterX;
        const distanceY = mY - letterCenterY;
        const distance = Math.hypot(distanceX, distanceY);

        const threshold = 180;
        if (distance < threshold) {
          const ratio = 1 - (distance / threshold);
          const falloffRatio = ratio * ratio;
          const pullFactor = 0.225;
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

const CANVAS_PAD = 24; // Padding around text box for subtle vapor bleed
const RAY_W = 320;
const RAY_H = 90;
const U_LUT_STEPS = 384;

export default function MagneticText({ text, bgColor = '#ffffff' }: MagneticTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const mistCanvasRef = useRef<HTMLCanvasElement>(null);
  const coreCanvasRef = useRef<HTMLCanvasElement>(null);
  const charSpansRef = useRef<(HTMLSpanElement | null)[]>([]);
  const baselineProbesRef = useRef<(HTMLSpanElement | null)[]>([]);

  const totalChars = text.replace(/ /g, '').length;
  const springsRef = useRef<(SpringPair | null)[]>(new Array(totalChars).fill(null));
  const vaporLevelsRef = useRef<Float32Array>(new Float32Array(totalChars));

  const layoutMetricsRef = useRef<{
    width: number;
    height: number;
    font: string;
    chars: CharLayoutMetric[];
  }>({
    width: 0,
    height: 0,
    font: '400 72px "Young Serif", serif',
    chars: [],
  });

  const [canvasBox, setCanvasBox] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const mouseX = useMotionValue(-10000);
  const mouseY = useMotionValue(-10000);
  const isTouchMotion = useMotionValue(0);
  const [isPaintMode, setIsPaintMode] = useState(false);
  const [isGooglyMode, setIsGooglyMode] = useState(false);
  const [isChaosActive, setIsChaosActive] = useState(false);

  // Measure exact character positions and baseline from the DOM layout spans
  const measureLayout = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const cRect = container.getBoundingClientRect();
    if (cRect.width === 0 || cRect.height === 0) return;

    const firstSpan = charSpansRef.current[0];
    let fontStr = '400 72px "Young Serif", serif';
    if (firstSpan) {
      const cs = window.getComputedStyle(firstSpan);
      fontStr = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    }

    const chars: CharLayoutMetric[] = [];
    for (let i = 0; i < charSpansRef.current.length; i++) {
      const span = charSpansRef.current[i];
      if (!span) continue;
      const r = span.getBoundingClientRect();
      const wordIdx = Number(span.getAttribute('data-word-idx') || '0');
      const probe = baselineProbesRef.current[wordIdx];
      const baselineY = probe
        ? probe.getBoundingClientRect().top - cRect.top + CANVAS_PAD
        : r.top - cRect.top + r.height * 0.78 + CANVAS_PAD;

      chars.push({
        char: span.textContent || '',
        x: r.left - cRect.left + CANVAS_PAD,
        baselineY,
        width: r.width,
        height: r.height,
      });
    }

    layoutMetricsRef.current = {
      width: cRect.width,
      height: cRect.height,
      font: fontStr,
      chars,
    };

    const paddedW = Math.ceil(cRect.width + CANVAS_PAD * 2);
    const paddedH = Math.ceil(cRect.height + CANVAS_PAD * 2);
    setCanvasBox((prev) =>
      prev.width === paddedW && prev.height === paddedH ? prev : { width: paddedW, height: paddedH }
    );
  }, []);

  useEffect(() => {
    measureLayout();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        measureLayout();
      });
    }
    const ro = new ResizeObserver(() => {
      measureLayout();
    });
    if (containerRef.current) {
      ro.observe(containerRef.current);
    }
    window.addEventListener('resize', measureLayout);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measureLayout);
    };
  }, [measureLayout, text]);

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
      if (Date.now() - lastTouchTime < 1500) {
        return;
      }

      const isCoarse = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
      if (isCoarse) {
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

        touchResetTimer = setTimeout(resetToNeutral, 700);
      }
    };

    const handleTouchEnd = () => {
      lastTouchTime = Date.now();
      clearResetTimer();
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

  // ---------------------------------------------------------------------------
  // 60fps Flowing Energy Ray (11 Non-Repeating Stops, 1:00 Flow) + 50% Vapor Mist
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (canvasBox.width === 0 || canvasBox.height === 0) return;

    const mistCanvas = mistCanvasRef.current;
    const coreCanvas = coreCanvasRef.current;
    if (!mistCanvas || !coreCanvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Mist canvas runs at 1x CSS resolution since it is GPU-blurred
    mistCanvas.width = canvasBox.width;
    mistCanvas.height = canvasBox.height;
    // Core canvas runs at full Retina DPR for razor-sharp Young Serif letterforms
    coreCanvas.width = Math.round(canvasBox.width * dpr);
    coreCanvas.height = Math.round(canvasBox.height * dpr);

    const mistCtx = mistCanvas.getContext('2d');
    const coreCtx = coreCanvas.getContext('2d');
    if (!mistCtx || !coreCtx) return;

    // Offscreen low-res energy ray buffer (320x90)
    const rayCanvas = document.createElement('canvas');
    rayCanvas.width = RAY_W;
    rayCanvas.height = RAY_H;
    const rayCtx = rayCanvas.getContext('2d');
    if (!rayCtx) return;

    const rayImgData = rayCtx.createImageData(RAY_W, RAY_H);
    const rayPixels32 = new Uint32Array(rayImgData.data.buffer);

    const numStops = BASE_POSITIONS.length; // 11 non-repeating stops
    const warpedLUT = new Float32Array(U_LUT_STEPS * numStops);
    const singleSlice = new Float32Array(numStops);
    const rawDists = new Float32Array(32);
    const charDists = new Float32Array(32);

    let phase = 0;
    let lastTime = performance.now();
    let rafId = 0;
    let wasActiveLastFrame = false;

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      // A. Autonomous Time Phase Advancement (60fps)
      phase += dt * FLOW_SPEED * 2.35 * DIR_SIGN;

      const springs = springsRef.current;
      const vaporLevels = vaporLevelsRef.current;
      const { chars, font, width: textW, height: textH } = layoutMetricsRef.current;

      for (let i = 0; i < chars.length; i++) {
        const sp = springs[i];
        const dx = sp ? sp.x.get() : 0;
        const dy = sp ? sp.y.get() : 0;
        rawDists[i] = Math.hypot(dx, dy);
      }

      let anyLetterVisible = false;
      for (let i = 0; i < chars.length; i++) {
        // Combine letter displacement with immediate neighbors so passing dead-center over a letter stays continuous
        const dSelf = rawDists[i] || 0;
        const dPrev = i > 0 ? (rawDists[i - 1] || 0) * 0.85 : 0;
        const dNext = i < chars.length - 1 ? (rawDists[i + 1] || 0) * 0.85 : 0;
        const d = Math.max(dSelf, dPrev, dNext);
        charDists[i] = d;

        // Target vapor bloom localized around parted letters (calibrated for 50% pull amplitude)
        const targetVapor = d > 0.3 ? Math.min(1, (d - 0.3) / 3.75) : 0;
        const currVapor = vaporLevels[i] || 0;
        const rate = targetVapor > currVapor ? 0.22 : 0.14;
        const nextVapor = currVapor + (targetVapor - currVapor) * rate;
        vaporLevels[i] = nextVapor < 0.003 ? 0 : nextVapor;

        if (d > 0.04 || vaporLevels[i] > 0.003) {
          anyLetterVisible = true;
        }
      }

      if (!anyLetterVisible) {
        if (wasActiveLastFrame) {
          mistCtx.clearRect(0, 0, canvasBox.width, canvasBox.height);
          coreCtx.clearRect(0, 0, coreCanvas.width, coreCanvas.height);
          wasActiveLastFrame = false;
        }
        rafId = requestAnimationFrame(renderFrame);
        return;
      }

      wasActiveLastFrame = true;

      // B. Precompute Warped Stop Positions across U_LUT_STEPS
      for (let s = 0; s < U_LUT_STEPS; s++) {
        const u = s / (U_LUT_STEPS - 1);
        computeWarpedStopsAtU(u, phase, singleSlice);
        warpedLUT.set(singleSlice, s * numStops);
      }

      // C. Render 11 Non-Repeating Color Bands across "Creative Director" with 1:00 Wave Trajectory
      const invW = 1 / (RAY_W - 1);
      const invH = 1 / (RAY_H - 1);

      let pIdx = 0;
      for (let cy = 0; cy < RAY_H; cy++) {
        const ny = cy * invH; // 0 (top) -> 1 (bottom)
        // Wave advances steeply upward (1 - ny weighted 0.68) toward 1:00
        const uFromY = (1 - ny) * 0.68;
        // Single non-repeating 0..96 sweep across the entire phrase (each of the 11 colors appears once)
        const vFromY = ny * 0.24;

        for (let cx = 0; cx < RAY_W; cx++) {
          const nx = cx * invW; // 0 (left) -> 1 (right)

          // Along-ray wave coordinate u (0..1) streaming toward 1:00 (upward & rightward)
          const u = uFromY + nx * 0.32;
          const uIdx = Math.min(
            U_LUT_STEPS - 1,
            Math.max(0, (u * (U_LUT_STEPS - 1)) | 0)
          );
          const lutOffset = uIdx * numStops;

          // Cross-ray stop coordinate v (0..96) spanning all 11 colors ONCE across "Creative Director"
          const v = (vFromY + nx * 0.76) * 96;

          let r = 0;
          let g = 0;
          let b = 0;

          if (v <= warpedLUT[lutOffset]) {
            const c0 = RAY_COLORS_RGB[0];
            r = c0[0];
            g = c0[1];
            b = c0[2];
          } else if (v >= warpedLUT[lutOffset + numStops - 1]) {
            const cLast = RAY_COLORS_RGB[numStops - 1];
            r = cLast[0];
            g = cLast[1];
            b = cLast[2];
          } else {
            for (let k = 0; k < numStops - 1; k++) {
              const s0 = warpedLUT[lutOffset + k];
              const s1 = warpedLUT[lutOffset + k + 1];
              if (v >= s0 && v <= s1) {
                const span = s1 - s0;
                const t = span > 0.0001 ? (v - s0) / span : 0;
                const c0 = RAY_COLORS_RGB[k];
                const c1 = RAY_COLORS_RGB[k + 1];
                r = (c0[0] + (c1[0] - c0[0]) * t) | 0;
                g = (c0[1] + (c1[1] - c0[1]) * t) | 0;
                b = (c0[2] + (c1[2] - c0[2]) * t) | 0;
                break;
              }
            }
          }

          // Pack ABGR for little-endian Uint32Array
          rayPixels32[pIdx++] = (255 << 24) | (b << 16) | (g << 8) | r;
        }
      }

      rayCtx.putImageData(rayImgData, 0, 0);

      // D. Render Localized 1:00 Vapor Mist at 50% Reduced Prevalence/Bleed
      mistCtx.clearRect(0, 0, canvasBox.width, canvasBox.height);
      mistCtx.save();
      mistCtx.globalCompositeOperation = 'source-over';
      mistCtx.font = font;
      mistCtx.textBaseline = 'alphabetic';
      mistCtx.fillStyle = '#ffffff';
      mistCtx.strokeStyle = '#ffffff';
      mistCtx.lineJoin = 'round';
      mistCtx.lineCap = 'round';

      let hasMist = false;
      // Scale vapor drift and stroke width proportionally on smaller mobile viewports
      const mistScale = Math.min(1, Math.max(0.5, textH / 95));
      for (let i = 0; i < chars.length; i++) {
        const vLevel = vaporLevels[i];
        if (vLevel <= 0.005) continue;
        hasMist = true;

        const ch = chars[i];
        // Subtle 1:00 upward & rightward vapor drift (50% reduced spread, scaled for desktop & mobile)
        const wisp1 = Math.sin(phase * 0.95 + i * 0.85);
        const wisp2 = Math.cos(phase * 1.35 - i * 1.15);
        const driftX = (1.2 + 0.9 * wisp1) * vLevel * mistScale;
        const driftY = (-2.4 - 1.8 * (0.5 + 0.5 * wisp2)) * vLevel * mistScale;

        // Pass 1: Tight contour aura around the parted letter
        mistCtx.globalAlpha = vLevel * 0.44;
        mistCtx.lineWidth = 1.6 * vLevel * mistScale;
        mistCtx.strokeText(ch.char, ch.x, ch.baselineY);
        mistCtx.fillText(ch.char, ch.x, ch.baselineY);

        // Pass 2: Subtle 1:00 upward-rightward vapor wisp
        mistCtx.globalAlpha = vLevel * 0.34;
        mistCtx.lineWidth = 2.6 * vLevel * mistScale;
        mistCtx.strokeText(ch.char, ch.x + driftX, ch.baselineY + driftY);

        // Pass 3: Delicate outer feather
        mistCtx.globalAlpha = vLevel * 0.18;
        mistCtx.lineWidth = 3.6 * vLevel * mistScale;
        mistCtx.strokeText(
          ch.char,
          ch.x + driftX * 1.35 - wisp2 * 0.6 * mistScale,
          ch.baselineY + driftY * 1.3
        );
      }

      if (hasMist) {
        mistCtx.globalAlpha = 1;
        mistCtx.globalCompositeOperation = 'source-in';
        mistCtx.drawImage(
          rayCanvas,
          CANVAS_PAD - 8,
          CANVAS_PAD - 10,
          textW + 16,
          textH + 20
        );
      }
      mistCtx.restore();

      // E. Render Crisp Energy-Ray Core Letterforms on coreCanvas
      coreCtx.clearRect(0, 0, coreCanvas.width, coreCanvas.height);
      coreCtx.save();
      coreCtx.scale(dpr, dpr);
      coreCtx.globalCompositeOperation = 'source-over';
      coreCtx.font = font;
      coreCtx.textBaseline = 'alphabetic';
      coreCtx.fillStyle = '#ffffff';

      for (let i = 0; i < chars.length; i++) {
        const d = charDists[i] || 0;
        const vLevel = vaporLevels[i] || 0;
        // Ramp core letterform to 100% opacity immediately as the white letter parts
        const coreAlpha = Math.max(vLevel, Math.min(1, d / 0.3));
        if (coreAlpha <= 0.005) continue;

        const ch = chars[i];
        coreCtx.globalAlpha = coreAlpha;
        coreCtx.fillText(ch.char, ch.x, ch.baselineY);
      }

      coreCtx.globalAlpha = 1;
      coreCtx.globalCompositeOperation = 'source-in';
      coreCtx.drawImage(
        rayCanvas,
        CANVAS_PAD - 4,
        CANVAS_PAD - 4,
        textW + 8,
        textH + 8
      );
      coreCtx.restore();

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [canvasBox.width, canvasBox.height]);

  const words = text.split(' ');
  let globalLayoutCharIdx = 0;
  let globalTopCharIdx = 0;

  const isUnderneathHidden = isPaintMode || isGooglyMode || isChaosActive;

  return (
    <span 
      ref={containerRef}
      className="magnetic-text-container relative inline-flex flex-nowrap items-center whitespace-nowrap overflow-visible py-2"
    >
      {/* Layer 1: Subtle Localized Vapor Mist (50% reduced prevalence & bleed) */}
      <canvas
        ref={mistCanvasRef}
        aria-hidden="true"
        className="pointer-events-none select-none transition-opacity duration-200"
        style={{
          position: 'absolute',
          left: `-${CANVAS_PAD}px`,
          top: `-${CANVAS_PAD}px`,
          width: canvasBox.width ? `${canvasBox.width}px` : '100%',
          height: canvasBox.height ? `${canvasBox.height}px` : '100%',
          filter: 'blur(4px) saturate(1.3) brightness(1.05)',
          opacity: isUnderneathHidden ? 0 : 0.52,
          visibility: isUnderneathHidden ? 'hidden' : 'visible',
          zIndex: 1,
        }}
      />

      {/* Layer 2: Crisp Energy-Ray Core Letterforms */}
      <canvas
        ref={coreCanvasRef}
        aria-hidden="true"
        className="pointer-events-none select-none transition-opacity duration-200"
        style={{
          position: 'absolute',
          left: `-${CANVAS_PAD}px`,
          top: `-${CANVAS_PAD}px`,
          width: canvasBox.width ? `${canvasBox.width}px` : '100%',
          height: canvasBox.height ? `${canvasBox.height}px` : '100%',
          opacity: isUnderneathHidden ? 0 : 1,
          visibility: isUnderneathHidden ? 'hidden' : 'visible',
          zIndex: 2,
        }}
      />

      {words.map((word, wordIdx) => {
        const wordChars = word.split('');

        return (
          <React.Fragment key={wordIdx}>
            {wordIdx > 0 && (
              <span className="inline-block w-[0.25em]" aria-hidden="true">
                &nbsp;
              </span>
            )}
            <span className="relative inline-flex items-center">
              {/* True Inline Alphabetic Baseline Probe (outside flex-item alignment) */}
              <span
                aria-hidden="true"
                className="absolute top-0 left-0 pointer-events-none select-none opacity-0"
                style={{ display: 'block', lineHeight: 'inherit' }}
              >
                M
                <span
                  ref={(el) => {
                    baselineProbesRef.current[wordIdx] = el;
                  }}
                  style={{
                    display: 'inline-block',
                    width: 0,
                    height: 0,
                    verticalAlign: 'baseline',
                  }}
                />
              </span>

              {/* Invisible Layout & Metric Reference Spans (provides exact DOM glyph coordinates) */}
              <span
                className="inline-flex items-center pointer-events-none select-none opacity-0"
                aria-hidden="true"
              >
                {wordChars.map((char, cIdx) => {
                  const idx = globalLayoutCharIdx++;
                  return (
                    <span
                      key={cIdx}
                      ref={(el) => {
                        charSpansRef.current[idx] = el;
                      }}
                      data-word-idx={wordIdx}
                      className="inline-block"
                    >
                      {char}
                    </span>
                  );
                })}
              </span>

              {/* Top Layer: White text wrapped in data-chaos="word" */}
              <span
                data-chaos="word"
                data-text={word}
                className="absolute top-0 left-0 w-full h-full inline-flex items-center z-10"
              >
                {wordChars.map((char, cIdx) => {
                  const idx = globalTopCharIdx++;
                  return (
                    <MagneticLetterTop
                      key={cIdx}
                      char={char}
                      charIdx={idx}
                      mouseX={mouseX}
                      mouseY={mouseY}
                      isTouchMotion={isTouchMotion}
                      springsRef={springsRef}
                      bgColor={bgColor}
                      disabled={isPaintMode || isGooglyMode || isChaosActive}
                    />
                  );
                })}
              </span>
            </span>
          </React.Fragment>
        );
      })}
    </span>
  );
}
