import React, { useEffect, useRef } from 'react';
import { ChaosMode } from './ChaosWidget';

interface ChaosEngineProps {
  activeMode: ChaosMode;
  onReset: () => void;
}

interface HiddenOriginal {
  element: HTMLElement;
  originalOpacity?: string;
  originalColor?: string;
  originalPointerEvents?: string;
  originalDisplay?: string;
  originalBorderTopColor?: string;
  originalBorderBottomColor?: string;
  originalVisibility?: string;
}

interface HiddenLine {
  element: HTMLElement;
  originalOpacity: string;
  originalVisibility: string;
}

interface PhysicsBinding {
  element: HTMLElement;
  body: any; // Matter.Body
  origX: number;
  origY: number;
  isLine?: boolean;
}

// Shortest angle difference helper for smooth 360 rotation without snapping
function lerpAngle(from: number, to: number, step: number): number {
  let diff = to - from;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return from + diff * step;
}

export const ChaosEngine: React.FC<ChaosEngineProps> = ({ activeMode }) => {
  const hiddenOriginalsRef = useRef<HiddenOriginal[]>([]);
  const hiddenLinesRef = useRef<HiddenLine[]>([]);
  const chaosContainerRef = useRef<HTMLDivElement | null>(null);

  const matterInstanceRef = useRef<any>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const bulldozerElRef = useRef<HTMLElement | null>(null);
  const physicsBindingsRef = useRef<PhysicsBinding[]>([]);
  const activeCleanupRef = useRef<(() => void) | null>(null);

  // =========================================================================
  // 1. UNIFIED CLEANUP & RESTORATION (teardownChaos)
  // =========================================================================
  const teardownChaos = () => {
    if (activeCleanupRef.current) {
      activeCleanupRef.current();
      activeCleanupRef.current = null;
    }

    if (animFrameIdRef.current !== null) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    if (matterInstanceRef.current) {
      const { engine, Matter } = matterInstanceRef.current;
      try {
        Matter.World.clear(engine.world, false);
        Matter.Engine.clear(engine);
      } catch (err) {
        console.warn('Matter cleanup notice:', err);
      }
      matterInstanceRef.current = null;
    }

    if (bulldozerElRef.current && bulldozerElRef.current.parentNode) {
      bulldozerElRef.current.parentNode.removeChild(bulldozerElRef.current);
      bulldozerElRef.current = null;
    }

    if (chaosContainerRef.current && chaosContainerRef.current.parentNode) {
      chaosContainerRef.current.parentNode.removeChild(chaosContainerRef.current);
      chaosContainerRef.current = null;
    }

    document.body.classList.remove('chaos-active');
    document.body.classList.remove('chaos-paint');
    document.body.classList.remove('chaos-googly');
    document.body.style.cursor = '';
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.touchAction = '';

    physicsBindingsRef.current = [];

    // Restore original DOM elements style
    hiddenOriginalsRef.current.forEach(({
      element,
      originalOpacity,
      originalColor,
      originalPointerEvents,
      originalDisplay,
      originalBorderTopColor,
      originalBorderBottomColor,
      originalVisibility
    }) => {
      if (element && document.body.contains(element)) {
        if (originalOpacity !== undefined) element.style.opacity = originalOpacity;
        if (originalColor !== undefined) element.style.color = originalColor;
        if (originalPointerEvents !== undefined) element.style.pointerEvents = originalPointerEvents;
        if (originalDisplay !== undefined) element.style.display = originalDisplay;
        if (originalBorderTopColor !== undefined) element.style.borderTopColor = originalBorderTopColor;
        if (originalBorderBottomColor !== undefined) element.style.borderBottomColor = originalBorderBottomColor;
        if (originalVisibility !== undefined) element.style.visibility = originalVisibility;
      }
    });
    hiddenOriginalsRef.current = [];

    // Unhide lines
    hiddenLinesRef.current.forEach(({ element, originalOpacity, originalVisibility }) => {
      if (element && document.body.contains(element)) {
        element.style.opacity = originalOpacity;
        element.style.visibility = originalVisibility;
      }
    });
    hiddenLinesRef.current = [];

    console.log('[Chaos Engine]: Cleaned up and restored DOM to original state.');
  };

  // =========================================================================
  // 2. UNIFIED DOM SETUP & CLONING ENGINE (setupChaosDOM)
  // =========================================================================
  const setupChaosDOM = () => {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const fullDocHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, height);

    let chaosContainer = document.getElementById('chaos-dom-container') as HTMLDivElement;
    if (!chaosContainer) {
      chaosContainer = document.createElement('div');
      chaosContainer.id = 'chaos-dom-container';
      chaosContainer.className = 'pointer-events-none select-none z-[9998] overflow-hidden';
      chaosContainer.style.position = 'absolute';
      chaosContainer.style.top = '0px';
      chaosContainer.style.left = '0px';
      chaosContainer.style.width = '100%';
      chaosContainer.style.height = `${fullDocHeight}px`;
      chaosContainer.setAttribute('data-chaos-ignore', 'true');
      document.body.appendChild(chaosContainer);
    }
    chaosContainerRef.current = chaosContainer;

    interface CreatedClone {
      clone: HTMLElement;
      rect: DOMRect;
      isLine?: boolean;
    }
    const createdClones: CreatedClone[] = [];

    // Hide magnetic text containers
    const magneticContainers = Array.from(document.querySelectorAll<HTMLElement>('.magnetic-text-container'));
    magneticContainers.forEach((mContainer) => {
      hiddenOriginalsRef.current.push({
        element: mContainer,
        originalOpacity: mContainer.style.opacity,
        originalVisibility: mContainer.style.visibility,
        originalPointerEvents: mContainer.style.pointerEvents,
      });
      mContainer.style.opacity = '0';
      mContainer.style.visibility = 'hidden';
      mContainer.style.pointerEvents = 'none';
    });

    // Query opt-in data-chaos elements, hr tags, and horizontal border/line elements
    const rawElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-chaos], hr, .border-t, .border-b, .border-y, [class*="border-t"], [class*="border-b"], [class*="divide-y"] > *'
      )
    ).filter((el) => {
      if (el.closest('[data-chaos-ignore="true"], #chaos-dom-container, .chaos-bulldozer-cursor')) return false;
      return true;
    });

    const processedElements = new Set<HTMLElement>();

    rawElements.forEach((element) => {
      if (processedElements.has(element)) return;
      processedElements.add(element);

      const type = element.getAttribute('data-chaos');
      const isHr = element.tagName === 'HR';
      const rect = element.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) return;

      // Exclude partially or fully cropped elements outside visible viewport bounds
      if (rect.top < 0 || rect.bottom > window.innerHeight) return;

      const computed = window.getComputedStyle(element);
      const isExplicitLine = type === 'line' || isHr;
      const isThinLine = rect.height <= 8 && rect.width >= 30;

      if (isExplicitLine || isThinLine) {
        let lineColor = 'rgba(255, 255, 255, 0.2)';
        if (computed.borderTopColor && computed.borderTopColor !== 'transparent' && computed.borderTopColor !== 'rgba(0, 0, 0, 0)') {
          lineColor = computed.borderTopColor;
        } else if (computed.borderColor && computed.borderColor !== 'transparent' && computed.borderColor !== 'rgba(0, 0, 0, 0)') {
          lineColor = computed.borderColor;
        } else if (computed.backgroundColor && computed.backgroundColor !== 'transparent' && computed.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          lineColor = computed.backgroundColor;
        }

        const numSegments = 3;
        const segmentWidth = rect.width / numSegments;
        const borderHeight = Math.max(1, rect.height <= 8 ? rect.height : 1);
        const lineY = rect.top;

        for (let i = 0; i < numSegments; i++) {
          const segLeft = rect.left + i * segmentWidth;
          const clone = document.createElement('div');
          clone.className = 'chaos-line-segment select-none pointer-events-none z-[9998]';
          clone.style.position = 'absolute';
          clone.style.left = `${segLeft + scrollX}px`;
          clone.style.top = `${lineY + scrollY}px`;
          clone.style.width = `${segmentWidth}px`;
          clone.style.height = `${borderHeight}px`;
          clone.style.margin = '0px';
          clone.style.padding = '0px';
          clone.style.backgroundColor = lineColor;
          clone.style.transformOrigin = 'center center';
          clone.style.willChange = 'transform';

          chaosContainer.appendChild(clone);
          const mockRect = new DOMRect(segLeft, lineY, segmentWidth, borderHeight);
          createdClones.push({ clone, rect: mockRect, isLine: true });
        }

        hiddenOriginalsRef.current.push({
          element,
          originalOpacity: element.style.opacity,
          originalVisibility: element.style.visibility,
          originalPointerEvents: element.style.pointerEvents,
          originalBorderTopColor: element.style.borderTopColor,
          originalBorderBottomColor: element.style.borderBottomColor,
        });

        element.style.opacity = '0';
        element.style.visibility = 'hidden';
        element.style.pointerEvents = 'none';
      } else {
        // For larger container elements, check if they have border-t or border-b styling
        const hasBorderTop = computed.borderTopWidth && parseFloat(computed.borderTopWidth) > 0 && computed.borderTopStyle !== 'none';
        
        if (hasBorderTop && !type) {
          // Extract top border line as 3-segment breakable line without hiding the container element
          const borderHeight = Math.max(1, parseFloat(computed.borderTopWidth) || 1);
          let lineColor = 'rgba(255, 255, 255, 0.2)';
          if (computed.borderTopColor && computed.borderTopColor !== 'transparent' && computed.borderTopColor !== 'rgba(0, 0, 0, 0)') {
            lineColor = computed.borderTopColor;
          }

          const numSegments = 3;
          const segmentWidth = rect.width / numSegments;
          const lineY = rect.top;

          for (let i = 0; i < numSegments; i++) {
            const segLeft = rect.left + i * segmentWidth;
            const clone = document.createElement('div');
            clone.className = 'chaos-line-segment select-none pointer-events-none z-[9998]';
            clone.style.position = 'absolute';
            clone.style.left = `${segLeft + scrollX}px`;
            clone.style.top = `${lineY + scrollY}px`;
            clone.style.width = `${segmentWidth}px`;
            clone.style.height = `${borderHeight}px`;
            clone.style.margin = '0px';
            clone.style.padding = '0px';
            clone.style.backgroundColor = lineColor;
            clone.style.transformOrigin = 'center center';
            clone.style.willChange = 'transform';

            chaosContainer.appendChild(clone);
            const mockRect = new DOMRect(segLeft, lineY, segmentWidth, borderHeight);
            createdClones.push({ clone, rect: mockRect, isLine: true });
          }

          hiddenOriginalsRef.current.push({
            element,
            originalOpacity: element.style.opacity,
            originalVisibility: element.style.visibility,
            originalPointerEvents: element.style.pointerEvents,
            originalBorderTopColor: element.style.borderTopColor,
            originalBorderBottomColor: element.style.borderBottomColor,
          });

          element.style.borderTopColor = 'transparent';
        } else if (type) {
          // Opt-in chaos text or widget element
          hiddenOriginalsRef.current.push({
            element,
            originalOpacity: element.style.opacity,
            originalVisibility: element.style.visibility,
            originalPointerEvents: element.style.pointerEvents,
            originalBorderTopColor: element.style.borderTopColor,
            originalBorderBottomColor: element.style.borderBottomColor,
          });

          element.style.opacity = '0';
          element.style.visibility = 'hidden';
          element.style.pointerEvents = 'none';

          const textContent = element.getAttribute('data-text') || element.textContent || '';

          const clone = document.createElement('div');
          clone.className = 'chaos-element-clone select-none pointer-events-none z-[9998]';
          clone.style.position = 'absolute';
          clone.style.left = `${rect.left + scrollX}px`;
          clone.style.top = `${rect.top + scrollY}px`;
          clone.style.width = `${rect.width}px`;
          clone.style.height = `${rect.height}px`;
          clone.style.margin = '0px';
          clone.style.padding = '0px';
          clone.style.fontSize = computed.fontSize;
          clone.style.fontFamily = computed.fontFamily;
          clone.style.fontWeight = computed.fontWeight;
          clone.style.fontStyle = computed.fontStyle;
          clone.style.lineHeight = computed.lineHeight || '1.05';
          clone.style.letterSpacing = computed.letterSpacing;
          clone.style.textTransform = computed.textTransform;
          clone.style.color = '#ffffff'; // Static white text for physical clones
          clone.style.display = 'inline-flex';
          clone.style.alignItems = 'center';
          clone.style.justifyContent = 'flex-start';
          clone.style.whiteSpace = 'nowrap';
          clone.style.transformOrigin = 'center center';
          clone.style.willChange = 'transform';
          clone.textContent = textContent;

          chaosContainer.appendChild(clone);
          createdClones.push({ clone, rect, isLine: false });
        }
      }
    });

    return {
      chaosContainer,
      createdClones,
      scrollX,
      scrollY,
      width,
      height,
      fullDocHeight,
    };
  };

  // =========================================================================
  // 3. UNIFIED PHYSICS BOUNDARIES & BINDINGS CREATOR
  // =========================================================================
  const createBoundaries = (
    Matter: any,
    engine: any,
    scrollX: number,
    scrollY: number,
    width: number,
    height: number,
    wallOptions: any
  ) => {
    const wallThickness = 100;
    const topWall = Matter.Bodies.rectangle(scrollX + width / 2, scrollY - wallThickness / 2, width * 2, wallThickness, { isStatic: true, label: 'wall', ...wallOptions });
    const bottomWall = Matter.Bodies.rectangle(scrollX + width / 2, scrollY + height + wallThickness / 2, width * 2, wallThickness, { isStatic: true, label: 'wall', ...wallOptions });
    const leftWall = Matter.Bodies.rectangle(scrollX - wallThickness / 2, scrollY + height / 2, wallThickness, height * 2, { isStatic: true, label: 'wall', ...wallOptions });
    const rightWall = Matter.Bodies.rectangle(scrollX + width + wallThickness / 2, scrollY + height / 2, wallThickness, height * 2, { isStatic: true, label: 'wall', ...wallOptions });

    Matter.World.add(engine.world, [topWall, bottomWall, leftWall, rightWall]);
    return [topWall, bottomWall, leftWall, rightWall];
  };

  const createBindingsFromClones = (
    Matter: any,
    engine: any,
    createdClones: { clone: HTMLElement; rect: DOMRect; isLine?: boolean }[],
    scrollX: number,
    scrollY: number,
    bodyOptionsFn: (rect: DOMRect, isLine?: boolean) => any
  ) => {
    const bindings: PhysicsBinding[] = [];

    createdClones.forEach(({ clone, rect, isLine }) => {
      const centerX = rect.left + (rect.width / 2) + scrollX;
      const centerY = rect.top + (rect.height / 2) + scrollY;

      const bodyWidth = Math.max(1, rect.width);
      // Massive invisible hitbox (40px minimum height for line bodies)
      const physicsHeight = isLine ? Math.max(40, rect.height) : Math.max(1, rect.height);

      const baseOptions = bodyOptionsFn(rect, isLine);
      // Line segment bodies are dynamic with frictionAir for stable floating until hit
      const bodyOptions = isLine ? { ...baseOptions, isStatic: false, frictionAir: 0.1 } : baseOptions;

      const body = Matter.Bodies.rectangle(centerX, centerY, bodyWidth, physicsHeight, bodyOptions);
      if (isLine) {
        body.label = 'line';
      }

      Matter.World.add(engine.world, body);
      bindings.push({
        element: clone,
        body,
        origX: centerX,
        origY: centerY,
        isLine: !!isLine,
      });
    });

    physicsBindingsRef.current = bindings;
    return bindings;
  };

  const syncBindingsToDOM = (bindings: PhysicsBinding[]) => {
    bindings.forEach(({ element, body, origX, origY }) => {
      const dx = body.position.x - origX;
      const dy = body.position.y - origY;
      element.style.transform = `translate3d(${dx}px, ${dy}px, 0px) rotate(${body.angle}rad)`;
    });
  };

  // =========================================================================
  // 4. BULLDOZE MODE IMPLEMENTATION
  // =========================================================================
  const initBulldozeMode = async () => {
    const Matter = await import('matter-js');

    document.body.style.cursor = '';

    const { chaosContainer, createdClones, scrollX, scrollY, width, height } = setupChaosDOM();

    // Bulldozer DOM cursor element
    const dozerEl = document.createElement('div');
    dozerEl.className = 'chaos-bulldozer-cursor pointer-events-none select-none z-[999999]';
    dozerEl.style.position = 'absolute';
    dozerEl.style.top = '0px';
    dozerEl.style.left = '0px';
    dozerEl.style.width = '60px';
    dozerEl.style.height = '66px';
    dozerEl.style.willChange = 'transform';
    dozerEl.setAttribute('data-chaos-ignore', 'true');

    dozerEl.innerHTML = `
      <svg width="60" height="66" viewBox="0 0 80 88" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 10px 20px rgba(0,0,0,0.85));">
        <!-- Left Track -->
        <rect x="8" y="22" width="12" height="58" rx="3" fill="#000000" stroke="#ffffff" stroke-width="2"/>
        <path d="M8 28H20M8 36H20M8 44H20M8 52H20M8 60H20M8 68H20" stroke="#ffffff" stroke-width="2"/>

        <!-- Right Track -->
        <rect x="60" y="22" width="12" height="58" rx="3" fill="#000000" stroke="#ffffff" stroke-width="2"/>
        <path d="M60 28H72M60 36H72M60 44H72M60 52H72M60 60H72M60 68H72" stroke="#ffffff" stroke-width="2"/>

        <!-- Heavy Hydraulic Loader Arms -->
        <rect x="16" y="12" width="8" height="24" fill="#ffffff" stroke="#000000" stroke-width="2"/>
        <rect x="56" y="12" width="8" height="24" fill="#ffffff" stroke="#000000" stroke-width="2"/>

        <!-- Main Machine Body / Engine Hood -->
        <rect x="20" y="26" width="40" height="48" rx="4" fill="#000000" stroke="#ffffff" stroke-width="2.5"/>

        <!-- Engine Grille & Vents -->
        <rect x="24" y="30" width="32" height="14" rx="2" fill="#ffffff"/>
        <path d="M28 34H52M28 38H52M28 42H52" stroke="#000000" stroke-width="2"/>

        <!-- Driver Cab Glass -->
        <rect x="26" y="50" width="28" height="18" rx="3" fill="#ffffff" stroke="#000000" stroke-width="2"/>
        <path d="M28 53L38 64" stroke="#000000" stroke-width="2" stroke-linecap="round"/>

        <!-- Exhaust Pipe Stack -->
        <circle cx="52" cy="34" r="3.5" fill="#ffffff" stroke="#000000" stroke-width="2"/>

        <!-- MASSIVE FRONT SCOOP / BLADE -->
        <path d="M2 2C2 2 20 8 40 8C60 8 78 2 78 2V16C78 19 72 22 40 22C8 22 2 19 2 16V2Z" fill="#ffffff" stroke="#000000" stroke-width="2.5"/>
        <path d="M6 5C20 10 40 10 60 10C68 10 74 6 74 5" stroke="#000000" stroke-width="2"/>
        <!-- Steel Bucket Teeth -->
        <path d="M6 2V6M20 2V8M34 2V8M46 2V8M60 2V8M74 2V6" stroke="#000000" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    `;

    chaosContainer.appendChild(dozerEl);
    bulldozerElRef.current = dozerEl;

    // Physics Engine
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 0 },
    });
    matterInstanceRef.current = { engine, Matter };

    createBoundaries(Matter, engine, scrollX, scrollY, width, height, { restitution: 0, friction: 0.8 });

    const bindings = createBindingsFromClones(
      Matter,
      engine,
      createdClones,
      scrollX,
      scrollY,
      () => ({
        restitution: 0,    // No bounciness
        friction: 0.8,     // High friction
        frictionAir: 0.08, // High air drag so elements settle smoothly
        density: 0.01,
      })
    );

    // Spawn Heavy Bulldozer Physics Body (25% smaller: 60x66)
    const dozerWidth = 60;
    const dozerHeight = 66;
    const spawnX = scrollX + width + 150; // Off-screen right
    const spawnY = scrollY + height * 0.25; // Vertically in middle of upper half
    const targetIntroX = scrollX + width - 150;

    const dozerBody = Matter.Bodies.rectangle(spawnX, spawnY, dozerWidth, dozerHeight, {
      density: 1000,
      frictionAir: 0.1,
      restitution: 0,
    });
    (dozerBody as any).isBullet = true;

    Matter.World.add(engine.world, dozerBody);

    let targetX = scrollX + width / 2;
    let targetY = scrollY + height / 2;

    const handleMouseMove = (e: MouseEvent) => {
      targetX = e.clientX + window.scrollX;
      targetY = e.clientY + window.scrollY;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Anti-gravity suspension for dynamic line segment bodies
    const handleBeforeUpdate = () => {
      bindings.forEach(({ body, isLine }) => {
        if (isLine) {
          body.force.y -= body.mass * engine.world.gravity.y * 0.001;
        }
      });
    };

    Matter.Events.on(engine, 'beforeUpdate', handleBeforeUpdate);

    activeCleanupRef.current = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (engine) {
        Matter.Events.off(engine, 'beforeUpdate', handleBeforeUpdate);
      }
    };

    // Animation Loop (Increased constant speed by 15%: 2.2815 * 1.15 = 2.623725)
    const CONST_SPEED = 2.623725;
    let isIntroFinished = false;

    let currDozerX = spawnX;
    let currDozerY = spawnY;
    let currDozerAngle = -Math.PI / 2; // Facing LEFT
    let chugPhase = 0;

    const renderLoop = () => {
      let vx = 0;
      let vy = 0;

      if (!isIntroFinished) {
        currDozerX -= CONST_SPEED;
        currDozerY = spawnY;
        currDozerAngle = -Math.PI / 2; // Facing LEFT

        vx = -CONST_SPEED;
        vy = 0;

        Matter.Body.setPosition(dozerBody, { x: currDozerX, y: currDozerY });
        Matter.Body.setVelocity(dozerBody, { x: vx, y: vy });

        if (currDozerX <= targetIntroX) {
          isIntroFinished = true;
        }
      } else {
        const dx = targetX - currDozerX;
        const dy = targetY - currDozerY;
        const dist = Math.hypot(dx, dy);

        if (dist > 10) {
          const targetHeading = Math.atan2(dy, dx) + Math.PI / 2;
          currDozerAngle = lerpAngle(currDozerAngle, targetHeading, 0.1);

          const dirX = Math.sin(currDozerAngle);
          const dirY = -Math.cos(currDozerAngle);

          vx = dirX * CONST_SPEED;
          vy = dirY * CONST_SPEED;

          currDozerX += vx;
          currDozerY += vy;

          Matter.Body.setPosition(dozerBody, { x: currDozerX, y: currDozerY });
          Matter.Body.setVelocity(dozerBody, { x: vx, y: vy });
        } else {
          vx = 0;
          vy = 0;
          Matter.Body.setVelocity(dozerBody, { x: 0, y: 0 });
        }
      }

      Matter.Engine.update(engine, 1000 / 60);

      const currentSpeed = Math.hypot(vx, vy);
      chugPhase += Math.max(0.08, currentSpeed * 0.1);
      // Pulse amplitude reduced by 40% (multiplied by 0.6)
      const bumblingScale = 1 + Math.sin(chugPhase) * 0.6 * (0.005 + Math.min(0.015, currentSpeed * 0.003));

      dozerEl.style.transform = `translate3d(${currDozerX - dozerWidth / 2}px, ${currDozerY - dozerHeight / 2}px, 0px) rotate(${currDozerAngle}rad) scale(${bumblingScale})`;

      syncBindingsToDOM(bindings);

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);
  };

  // =========================================================================
  // 5. ZERO-G MODE IMPLEMENTATION
  // =========================================================================
  const initZeroGMode = async () => {
    const Matter = await import('matter-js');

    document.body.style.cursor = 'default';

    const { createdClones, scrollX, scrollY, width, height } = setupChaosDOM();

    // Physics Engine with Zero Gravity
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 0 },
    });
    matterInstanceRef.current = { engine, Matter };

    // Bounding walls
    createBoundaries(Matter, engine, scrollX, scrollY, width, height, { restitution: 0.9, friction: 0 });

    const bindings = createBindingsFromClones(
      Matter,
      engine,
      createdClones,
      scrollX,
      scrollY,
      () => ({
        restitution: 0.9,   // highly bouncy so they don't lose energy when hitting walls
        frictionAir: 0.015,  // slight drag for floating fluid/space feel
        friction: 0,        // no surface friction
      })
    );

    // "The Drift" Initialization: microscopic randomized starting velocity
    bindings.forEach(({ body }) => {
      Matter.Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
      });
    });

    // Fluid Brush Cursor (20% Object Permanence with Stronger Repulse & Off-Center Torque)
    let mouseX = -10000;
    let mouseY = -10000;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX + window.scrollX;
      mouseY = e.clientY + window.scrollY;
    };

    window.addEventListener('mousemove', handleMouseMove);

    activeCleanupRef.current = () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };

    const brushRadius = 120;

    const renderLoop = () => {
      if (mouseX !== -10000 && mouseY !== -10000) {
        bindings.forEach(({ body }) => {
          const dx = body.position.x - mouseX;
          const dy = body.position.y - mouseY;
          const dist = Math.hypot(dx, dy);

          if (dist > 0 && dist < brushRadius) {
            if (body.isStatic) {
              Matter.Body.setStatic(body, false);
            }
            const nx = dx / dist;
            const ny = dy / dist;
            // Stronger repulse force: ~2.8x (0.00014 * mass)
            const forceMagnitude = 0.00014 * body.mass;

            // Apply force at an off-center position to induce natural rotation / torque
            const bodyWidth = body.bounds.max.x - body.bounds.min.x;
            const bodyHeight = body.bounds.max.y - body.bounds.min.y;
            const size = Math.min(bodyWidth, bodyHeight) || 10;

            const offsetPoint = {
              x: body.position.x - ny * size * 0.25,
              y: body.position.y + nx * size * 0.25,
            };

            Matter.Body.applyForce(body, offsetPoint, {
              x: nx * forceMagnitude,
              y: ny * forceMagnitude,
            });
          }
        });
      }

      Matter.Engine.update(engine, 1000 / 60);

      syncBindingsToDOM(bindings);

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);
  };

  // =========================================================================
  // 6. PAINT MODE IMPLEMENTATION
  // =========================================================================
  const initPaintMode = () => {
    // 1. Fullscreen Overlay Canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'chaos-paint-canvas';
    canvas.className = 'fixed top-0 left-0 w-full h-full z-[9990] select-none touch-none';
    canvas.style.position = 'fixed';
    canvas.style.top = '0px';
    canvas.style.left = '0px';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'auto';
    canvas.style.cursor = 'none';
    canvas.setAttribute('data-chaos-ignore', 'true');

    // 2. Custom DOM Cursor Element for Spray Can
    const cursorEl = document.createElement('div');
    cursorEl.id = 'paint-cursor';
    cursorEl.className = 'fixed top-0 left-0 pointer-events-none z-[9995] select-none';
    cursorEl.style.position = 'fixed';
    cursorEl.style.top = '0px';
    cursorEl.style.left = '0px';
    cursorEl.style.pointerEvents = 'none';
    cursorEl.style.zIndex = '9995';
    cursorEl.style.willChange = 'transform';
    cursorEl.style.display = 'none';

    const HERO_COLORS = ['#00f0ff', '#ff007f', '#ffe600', '#a855f7', '#ff6b00'];
    let colorIndex = 0;

    const hexToRgba = (hex: string, alpha: number) => {
      let c = hex.replace('#', '');
      if (c.length === 3) c = c.split('').map((x) => x + x).join('');
      const num = parseInt(c, 16);
      return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
    };

    // Vector Spray Can Icon with color band
    const renderSprayCanSvg = (color: string) => {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40" fill="none" style="pointer-events: none; filter: drop-shadow(0px 2px 6px rgba(0,0,0,0.6));">
        <!-- Nozzle Tip at top center (14, 2) -->
        <rect x="12" y="2" width="4" height="4" rx="1" fill="#e5e7eb" stroke="#111827" stroke-width="1"/>
        <rect x="11" y="6" width="6" height="3" fill="#9ca3af" stroke="#111827" stroke-width="1"/>
        <!-- Can Dome / Valve Rim -->
        <path d="M 6 12 C 6 9 8 8 14 8 C 20 8 22 9 22 12 Z" fill="#d1d5db" stroke="#111827" stroke-width="1.2"/>
        <!-- Can Main Body -->
        <rect x="5" y="12" width="18" height="24" rx="2" fill="#1f2937" stroke="#111827" stroke-width="1.2"/>
        <!-- Color Band / Label on Body -->
        <rect x="5" y="18" width="18" height="10" fill="${color}"/>
        <!-- Bottom Rim -->
        <rect x="6" y="36" width="16" height="2" rx="1" fill="#9ca3af" stroke="#111827" stroke-width="0.8"/>
      </svg>`;
    };

    cursorEl.innerHTML = renderSprayCanSvg(HERO_COLORS[0]);
    document.body.appendChild(cursorEl);
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateCanvasSize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx && canvas.width > 0 && canvas.height > 0) {
        tempCtx.drawImage(canvas, 0, 0);
      }

      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      if (tempCtx && tempCanvas.width > 0 && tempCanvas.height > 0) {
        ctx.drawImage(tempCanvas, 0, 0);
      }
    };

    updateCanvasSize();

    // Mouse tracking state
    let mouseX = -1000;
    let mouseY = -1000;
    let prevX = -1000;
    let prevY = -1000;
    let cursorVisible = false;
    let animFrameId: number | null = null;

    // 5-second color cycling interval
    const colorInterval = setInterval(() => {
      colorIndex = (colorIndex + 1) % HERO_COLORS.length;
      cursorEl.innerHTML = renderSprayCanSvg(HERO_COLORS[colorIndex]);
    }, 5000);

    // Drawing state
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    // Hover time / Drip tracking
    let holdX = 0;
    let holdY = 0;
    let holdStartTime = 0;
    let lastDripTime = 0;

    interface Drip {
      x: number;
      y: number;
      weight: number;
      color: string;
      inkVolume: number;
    }
    const activeDrips: Drip[] = [];

    // Aerated Spray Dot Generator (+50% scaled radius: 33px)
    const sprayAtPoint = (px: number, py: number) => {
      const sprayRadius = 33; // 50% increase from 22px
      const colorHex = HERO_COLORS[colorIndex];
      const grad = ctx.createRadialGradient(px, py, 0, px, py, sprayRadius);
      grad.addColorStop(0, hexToRgba(colorHex, 0.45));
      grad.addColorStop(0.4, hexToRgba(colorHex, 0.25));
      grad.addColorStop(1, hexToRgba(colorHex, 0));

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, sprayRadius, 0, Math.PI * 2);
      ctx.fill();

      // Aerosol speckles (scaled spread)
      for (let i = 0; i < 7; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * sprayRadius * 1.1;
        const sx = px + Math.cos(angle) * r;
        const sy = py + Math.sin(angle) * r;
        ctx.fillStyle = hexToRgba(colorHex, 0.55);
        ctx.fillRect(sx, sy, 1.3, 1.3);
      }
    };

    // Render loop for cursor, drips, and continuous spray
    const renderLoop = () => {
      if (cursorEl && cursorVisible) {
        // Offset (14, 2) aligns physical mouse coordinates at top-center spray nozzle
        cursorEl.style.transform = `translate3d(${mouseX - 14}px, ${mouseY - 2}px, 0px)`;
      }

      const now = Date.now();

      // 1. Render active drips
      if (activeDrips.length > 0) {
        for (let i = activeDrips.length - 1; i >= 0; i--) {
          const drip = activeDrips[i];
          ctx.beginPath();
          ctx.arc(drip.x, drip.y, drip.weight / 2, 0, Math.PI * 2);
          ctx.fillStyle = drip.color;
          ctx.fill();

          drip.y += 1.5;
          drip.x += (Math.random() - 0.5) * 0.8;
          drip.weight *= 0.992;
          drip.inkVolume -= 1;

          if (drip.inkVolume <= 0 || drip.weight <= 0.5) {
            activeDrips.splice(i, 1);
          }
        }
      }

      // 2. Continuous aerated spray while holding down
      if (isDrawing && mouseX > 0 && mouseY > 0) {
        sprayAtPoint(mouseX, mouseY);

        // Standard drip check based on time/density
        const distFromHold = Math.hypot(mouseX - holdX, mouseY - holdY);
        if (distFromHold <= 10) {
          if (now - holdStartTime > 500) {
            if (now - lastDripTime > 200 && activeDrips.length < 7) {
              activeDrips.push({
                x: mouseX + (Math.random() - 0.5) * 8,
                y: mouseY + 4,
                weight: 2.5 + Math.random() * 4.5,
                color: HERO_COLORS[colorIndex],
                inkVolume: 35 + Math.random() * 45,
              });
              lastDripTime = now;
            }
          }
        } else {
          holdX = mouseX;
          holdY = mouseY;
          holdStartTime = now;
        }
      }

      animFrameId = requestAnimationFrame(renderLoop);
    };
    animFrameId = requestAnimationFrame(renderLoop);

    const startDrawing = (x: number, y: number) => {
      isDrawing = true;
      lastX = x;
      lastY = y;
      prevX = x;
      prevY = y;
      holdX = x;
      holdY = y;
      holdStartTime = Date.now();

      sprayAtPoint(x, y);
    };

    const draw = (x: number, y: number) => {
      if (!isDrawing) return;

      const dist = Math.hypot(x - lastX, y - lastY);
      const steps = Math.max(1, Math.floor(dist / 5));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const px = lastX + (x - lastX) * t;
        const py = lastY + (y - lastY) * t;
        sprayAtPoint(px, py);
      }

      // Shake to Splatter mechanic based on velocity (+50% scaled radius: 53px)
      const dx = x - prevX;
      const dy = y - prevY;
      const velocity = Math.hypot(dx, dy);
      if (velocity > 50) {
        const colorHex = HERO_COLORS[colorIndex];
        for (let i = 0; i < 14; i++) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * 53; // Scaled splatter radius
          const sx = x + Math.cos(angle) * r;
          const sy = y + Math.sin(angle) * r;
          const size = 1 + Math.random() * 2.5;

          ctx.beginPath();
          ctx.arc(sx, sy, size, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(colorHex, 0.85);
          ctx.fill();
        }
      }

      lastX = x;
      lastY = y;
      prevX = x;
      prevY = y;
    };

    const stopDrawing = () => {
      isDrawing = false;
    };

    const handleMouseDown = (e: MouseEvent) => {
      startDrawing(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!cursorVisible) {
        cursorVisible = true;
        cursorEl.style.display = 'block';
      }
      draw(e.clientX, e.clientY);
    };

    const handleMouseUp = () => stopDrawing();
    const handleMouseLeave = () => {
      stopDrawing();
      cursorVisible = false;
      cursorEl.style.display = 'none';
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        mouseX = touch.clientX;
        mouseY = touch.clientY;
        if (!cursorVisible) {
          cursorVisible = true;
          cursorEl.style.display = 'block';
        }
        startDrawing(touch.clientX, touch.clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        mouseX = touch.clientX;
        mouseY = touch.clientY;
        draw(touch.clientX, touch.clientY);
      }
    };

    const handleResize = () => {
      updateCanvasSize();
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', stopDrawing);

    window.addEventListener('resize', handleResize);

    activeCleanupRef.current = () => {
      clearInterval(colorInterval);
      if (animFrameId !== null) cancelAnimationFrame(animFrameId);

      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);

      canvas.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', stopDrawing);

      window.removeEventListener('resize', handleResize);

      if (cursorEl && cursorEl.parentNode) {
        cursorEl.parentNode.removeChild(cursorEl);
      }
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
  };

  // =========================================================================
  // 7. SHOOT MODE IMPLEMENTATION (Retro Arcade Blaster)
  // =========================================================================
  const initShootMode = async () => {
    const Matter = await import('matter-js');

    document.body.style.cursor = 'crosshair';

    const { chaosContainer, createdClones, scrollX, scrollY, width, height } = setupChaosDOM();

    // 1. Physics Engine with Zero Gravity
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 0 },
    });
    matterInstanceRef.current = { engine, Matter };

    // Bounding walls
    createBoundaries(Matter, engine, scrollX, scrollY, width, height, { restitution: 0.8, friction: 0 });

    // Low frictionAir (0.005) so DOM clones glide, restitution (0.6) for bounciness and kinetic chain reactions
    const bindings = createBindingsFromClones(
      Matter,
      engine,
      createdClones,
      scrollX,
      scrollY,
      () => ({
        restitution: 0.6,
        frictionAir: 0.005,
        friction: 0.1,
        density: 0.01,
      })
    );

    // Strictly enforce perfectly stationary initial state (zero starting velocity or drift)
    bindings.forEach(({ body }) => {
      Matter.Body.setVelocity(body, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(body, 0);
    });

    // 2. The Blaster (Player Controller)
    const blasterEl = document.createElement('div');
    blasterEl.className = 'chaos-blaster pointer-events-none select-none z-[9999]';
    blasterEl.style.position = 'absolute';
    blasterEl.style.top = '0px';
    blasterEl.style.left = '0px';
    blasterEl.style.width = '48px';
    blasterEl.style.height = '48px';
    blasterEl.style.imageRendering = 'pixelated';
    blasterEl.style.willChange = 'transform';
    blasterEl.setAttribute('data-chaos-ignore', 'true');

    blasterEl.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="image-rendering: pixelated; shape-rendering: crispEdges; filter: drop-shadow(0px 0px 12px rgba(255,255,255,0.8)) contrast(200%) brightness(1.1);">
        <!-- Central Cannon Barrel Tip -->
        <rect x="22" y="2" width="4" height="10" fill="#ffffff" stroke="#000000" stroke-width="1.5"/>
        <rect x="20" y="8" width="8" height="4" fill="#000000" stroke="#ffffff" stroke-width="1"/>

        <!-- Main Fighter Wings / Hull -->
        <path d="M 24 8 L 34 22 L 46 36 L 40 44 L 28 38 L 24 42 L 20 38 L 8 44 L 2 36 L 14 22 Z" fill="#000000" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>

        <!-- White Inner Armor Plates / Accents -->
        <polygon points="24,14 30,26 18,26" fill="#ffffff" stroke="#000000" stroke-width="1.5"/>
        <path d="M 12 28 L 4 36 L 10 38 L 18 30 Z" fill="#ffffff"/>
        <path d="M 36 28 L 44 36 L 38 38 L 30 30 Z" fill="#ffffff"/>

        <!-- Mechanical Grille / Vents -->
        <path d="M 21 32 H 27 M 21 35 H 27" stroke="#ffffff" stroke-width="1.5"/>

        <!-- Thrusters -->
        <rect x="16" y="40" width="5" height="6" rx="1" fill="#ffffff" stroke="#000000" stroke-width="1"/>
        <rect x="27" y="40" width="5" height="6" rx="1" fill="#ffffff" stroke="#000000" stroke-width="1"/>
      </svg>
    `;

    chaosContainer.appendChild(blasterEl);

    let blasterX = scrollX + width / 2;
    const blasterY = scrollY + height - 50;

    // Kinematic Matter.js body locked to bottom of viewport
    const blasterBody = Matter.Bodies.rectangle(blasterX, blasterY, 48, 48, {
      isStatic: true,
      isKinematic: true,
    } as any);
    blasterBody.label = 'blaster';
    Matter.World.add(engine.world, blasterBody);

    const updateBlasterPos = (clientX: number) => {
      blasterX = Math.max(scrollX + 24, Math.min(scrollX + width - 24, clientX + scrollX));
      Matter.Body.setPosition(blasterBody, { x: blasterX, y: blasterY });
      blasterEl.style.transform = `translate3d(${blasterX - 24}px, ${blasterY - 24}px, 0px)`;
    };

    updateBlasterPos(width / 2);

    const handleMouseMove = (e: MouseEvent) => {
      updateBlasterPos(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        updateBlasterPos(e.touches[0].clientX);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    // 3. Auto-Fire Mechanics
    interface Bullet {
      body: any;
      element: HTMLElement;
    }
    const bullets: Bullet[] = [];

    const spawnBullet = () => {
      const bulletX = blasterX;
      const bulletY = blasterY - 24;

      const bulletEl = document.createElement('div');
      bulletEl.className = 'chaos-bullet pointer-events-none select-none z-[9998]';
      bulletEl.style.position = 'absolute';
      bulletEl.style.top = '0px';
      bulletEl.style.left = '0px';
      bulletEl.style.width = '6px';
      bulletEl.style.height = '16px';
      bulletEl.style.backgroundColor = '#ffffff';
      bulletEl.style.borderRadius = '3px';
      bulletEl.style.boxShadow = '0 0 8px #ffffff, 0 0 16px #ffffff';
      bulletEl.style.willChange = 'transform';
      chaosContainer.appendChild(bulletEl);

      const bulletBody = Matter.Bodies.rectangle(bulletX, bulletY, 6, 16, {
        density: 0.05,
        frictionAir: 0,
        restitution: 1,
      });
      bulletBody.label = 'bullet';

      Matter.World.add(engine.world, bulletBody);
      Matter.Body.setVelocity(bulletBody, { x: 0, y: -16 });

      bullets.push({ body: bulletBody, element: bulletEl });
    };

    // Auto-fire timer every 333ms (3 shots/sec)
    const shootTimer = setInterval(spawnBullet, 333);

    // 4. Collision Logic (Sequential Clearing via Projectile Sacrifice)
    const handleCollision = (event: any) => {
      event.pairs.forEach((pair: any) => {
        const { bodyA, bodyB } = pair;
        let bulletBody: any = null;
        let targetBody: any = null;

        if (bodyA.label === 'bullet') {
          bulletBody = bodyA;
          targetBody = bodyB;
        } else if (bodyB.label === 'bullet') {
          bulletBody = bodyB;
          targetBody = bodyA;
        }

        if (bulletBody && targetBody) {
          if (targetBody.label === 'blaster' || targetBody.label === 'bullet') {
            return;
          }

          // If colliding with boundary wall, immediately destroy the bullet
          if (targetBody.label === 'wall' || targetBody.isKinematic) {
            const bulletIdx = bullets.findIndex((b) => b.body === bulletBody);
            if (bulletIdx !== -1) {
              const b = bullets[bulletIdx];
              if (b.element.parentNode) {
                b.element.parentNode.removeChild(b.element);
              }
              bullets.splice(bulletIdx, 1);
            }
            try {
              Matter.World.remove(engine.world, bulletBody);
            } catch (err) {
              // ignore if already removed
            }
            return;
          }

          if (targetBody.isStatic) {
            Matter.Body.setStatic(targetBody, false);
          }

          // Radial Blast Explosion Wave
          const epicenter = { x: bulletBody.position.x, y: bulletBody.position.y };
          const blastRadius = 150;
          const allBodies = Matter.Composite.allBodies(engine.world);

          allBodies.forEach((body: any) => {
            if (body.label === 'wall' || body.isKinematic || body.label === 'blaster' || body.label === 'bullet') {
              return;
            }
            if (body.isStatic) {
              Matter.Body.setStatic(body, false);
            }
            const dx = body.position.x - epicenter.x;
            const dy = body.position.y - epicenter.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < blastRadius) {
              const dist = Math.max(distance, 1);
              const forceMagnitude = (blastRadius - dist) * 0.0005;
              Matter.Body.applyForce(body, body.position, {
                x: (dx / dist) * forceMagnitude,
                y: (dy / dist) * forceMagnitude,
              });

              // Apply rotational torque proportional to horizontal offset from epicenter
              const xOffset = epicenter.x - body.position.x;
              body.torque = xOffset * 0.003;
            }
          });

          // IMMEDIATELY DESTROY THE BULLET
          const bulletIdx = bullets.findIndex((b) => b.body === bulletBody);
          if (bulletIdx !== -1) {
            const b = bullets[bulletIdx];
            if (b.element.parentNode) {
              b.element.parentNode.removeChild(b.element);
            }
            bullets.splice(bulletIdx, 1);
          }
          try {
            Matter.World.remove(engine.world, bulletBody);
          } catch (err) {
            // ignore if already removed
          }
        }
      });
    };

    Matter.Events.on(engine, 'collisionStart', handleCollision);

    // 5. Render Loop
    const renderLoop = () => {
      Matter.Engine.update(engine, 1000 / 60);

      // Sync and clean up bullets (despawn on approach to ceiling <= scrollY + 20)
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (b.body.position.y <= scrollY + 20 || !Matter.Composite.allBodies(engine.world).includes(b.body)) {
          if (b.element.parentNode) {
            b.element.parentNode.removeChild(b.element);
          }
          try {
            Matter.World.remove(engine.world, b.body);
          } catch (err) {
            // ignore
          }
          bullets.splice(i, 1);
        } else {
          Matter.Body.setVelocity(b.body, { x: 0, y: -16 });
          b.element.style.transform = `translate3d(${b.body.position.x - 3}px, ${b.body.position.y - 8}px, 0px)`;
        }
      }

      // Sync DOM clone elements
      syncBindingsToDOM(bindings);

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    activeCleanupRef.current = () => {
      clearInterval(shootTimer);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      if (engine) {
        Matter.Events.off(engine, 'collisionStart', handleCollision);
      }
      bullets.forEach((b) => {
        if (b.element.parentNode) {
          b.element.parentNode.removeChild(b.element);
        }
      });
      if (blasterEl.parentNode) {
        blasterEl.parentNode.removeChild(blasterEl);
      }
    };
  };

  // =========================================================================
  // 7. GOOGLY EYES CHAOS MODE
  // =========================================================================
  const initGooglyMode = () => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    const height = window.innerHeight;
    const fullDocHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, height);

    // 1. ENSURE BASE BLACK BACKGROUND ON BODY & HTML (LAYER 0 - BOTTOM)
    const origBodyBg = document.body.style.backgroundColor;
    const origHtmlBg = document.documentElement.style.backgroundColor;
    document.body.style.setProperty('background-color', '#000000', 'important');
    document.documentElement.style.setProperty('background-color', '#000000', 'important');

    // 2. FORCE TRANSPARENT MAIN SITE WRAPPER AT Z-INDEX 1 & GLASS SHIELD
    const rootDiv = document.querySelector('#root > div') as HTMLElement;
    const origRootPos = rootDiv ? rootDiv.style.position : '';
    const origRootZ = rootDiv ? rootDiv.style.zIndex : '';
    const origRootBg = rootDiv ? rootDiv.style.backgroundColor : '';
    const origRootPE = rootDiv ? rootDiv.style.pointerEvents : '';

    if (rootDiv) {
      rootDiv.style.position = 'relative';
      rootDiv.style.zIndex = '1';
      rootDiv.style.setProperty('background-color', 'transparent', 'important');
      rootDiv.style.setProperty('pointer-events', 'none', 'important');
    }

    // 3. GOOGLY EYES CONTAINER AT MAXIMUM Z-INDEX (OVERLAY LAYER ON TOP OF ALL CONTENT)
    let chaosContainer = document.getElementById('chaos-dom-container') as HTMLDivElement;
    if (!chaosContainer) {
      chaosContainer = document.createElement('div');
      chaosContainer.id = 'chaos-dom-container';
      chaosContainer.className = 'pointer-events-none select-none overflow-hidden';
      chaosContainer.style.position = 'absolute';
      chaosContainer.style.top = '0px';
      chaosContainer.style.left = '0px';
      chaosContainer.style.width = '100%';
      chaosContainer.style.height = `${fullDocHeight}px`;
      chaosContainer.style.setProperty('z-index', '2147483647', 'important');
      chaosContainer.style.setProperty('isolation', 'isolate', 'important');
      chaosContainer.style.setProperty('opacity', '1', 'important');
      chaosContainer.style.setProperty('mix-blend-mode', 'normal', 'important');
      chaosContainer.setAttribute('data-chaos-ignore', 'true');
      document.body.appendChild(chaosContainer);
    } else {
      chaosContainer.className = 'pointer-events-none select-none overflow-hidden';
      chaosContainer.style.setProperty('z-index', '2147483647', 'important');
      chaosContainer.style.setProperty('isolation', 'isolate', 'important');
      chaosContainer.style.setProperty('opacity', '1', 'important');
      chaosContainer.style.setProperty('mix-blend-mode', 'normal', 'important');
    }
    chaosContainerRef.current = chaosContainer;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    interface EyeballState {
      eyeballEl: HTMLElement;
      pupilEl: HTMLElement;
      w: number;
      h: number;
      pupilSize: number;
      currentPx: number;
      currentPy: number;
    }
    const eyeballStates: EyeballState[] = [];

    const spawnEyePair = () => {
      if (!chaosContainerRef.current) return;

      // Base dimension randomization (~30% to 70% scale range)
      // Standard eyeball width: 32px to 68px
      const eyeW = Math.round(32 + Math.random() * 36);
      const eyeH = Math.round(eyeW * 1.35); // Vertically-oriented oval
      const gap = Math.round(eyeW * 0.25);
      const pairW = eyeW * 2 + gap;
      const pairH = eyeH;
      const pupilSize = Math.max(10, Math.round(eyeW * 0.38));
      const rotDeg = Math.round((Math.random() - 0.5) * 60); // -30deg to +30deg

      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      // Direct random coordinates across full screen without UI avoidance
      const randomX = Math.random() * Math.max(10, viewportW - pairW - 20) + 10;
      const randomY = Math.random() * Math.max(10, viewportH - pairH - 20) + 10;

      const bestX = randomX + window.scrollX;
      const bestY = randomY + window.scrollY;

      // Create Container for Eye Pair
      const pairContainer = document.createElement('div');
      pairContainer.className = 'chaos-googly-pair pointer-events-none select-none absolute z-[1] flex items-center justify-between';
      pairContainer.style.left = `${bestX}px`;
      pairContainer.style.top = `${bestY}px`;
      pairContainer.style.width = `${pairW}px`;
      pairContainer.style.height = `${pairH}px`;
      pairContainer.style.transform = `rotate(${rotDeg}deg)`;
      pairContainer.style.transformOrigin = 'center center';
      pairContainer.style.setProperty('opacity', '1', 'important');
      pairContainer.style.setProperty('mix-blend-mode', 'normal', 'important');

      // Build single eyeball with top & bottom eyelids
      const buildEyeball = () => {
        const eyeball = document.createElement('div');
        eyeball.className = 'chaos-eyeball relative overflow-hidden rounded-[50%] flex items-center justify-center';
        eyeball.style.width = `${eyeW}px`;
        eyeball.style.height = `${eyeH}px`;
        eyeball.style.setProperty('border', 'none', 'important');
        eyeball.style.outline = 'none';
        eyeball.style.boxShadow = 'none';
        eyeball.style.setProperty('background-color', '#ffffff', 'important');
        eyeball.style.setProperty('background', '#ffffff', 'important');
        eyeball.style.setProperty('opacity', '1', 'important');
        eyeball.style.setProperty('mix-blend-mode', 'normal', 'important');
        eyeball.style.setProperty('z-index', '1', 'important');

        const pupil = document.createElement('div');
        pupil.className = 'chaos-pupil absolute rounded-full';
        pupil.style.width = `${pupilSize}px`;
        pupil.style.height = `${pupilSize}px`;
        pupil.style.willChange = 'transform';
        pupil.style.setProperty('background-color', '#000000', 'important');
        pupil.style.setProperty('background', '#000000', 'important');
        pupil.style.setProperty('opacity', '1', 'important');
        pupil.style.setProperty('mix-blend-mode', 'normal', 'important');
        pupil.style.setProperty('z-index', '10', 'important');
        pupil.style.setProperty('position', 'absolute', 'important');
        eyeball.appendChild(pupil);

        const topEyelid = document.createElement('div');
        topEyelid.className = 'chaos-eyelid-top absolute top-0 left-0 w-full h-1/2';
        topEyelid.style.transition = 'transform 400ms cubic-bezier(0.25, 1, 0.5, 1)';
        topEyelid.style.transform = 'translateY(0%)';
        topEyelid.style.setProperty('background-color', '#000000', 'important');
        topEyelid.style.setProperty('background', '#000000', 'important');
        topEyelid.style.setProperty('opacity', '1', 'important');
        topEyelid.style.setProperty('mix-blend-mode', 'normal', 'important');
        topEyelid.style.setProperty('z-index', '20', 'important');
        eyeball.appendChild(topEyelid);

        const bottomEyelid = document.createElement('div');
        bottomEyelid.className = 'chaos-eyelid-bottom absolute bottom-0 left-0 w-full h-1/2';
        bottomEyelid.style.transition = 'transform 400ms cubic-bezier(0.25, 1, 0.5, 1)';
        bottomEyelid.style.transform = 'translateY(0%)';
        bottomEyelid.style.setProperty('background-color', '#000000', 'important');
        bottomEyelid.style.setProperty('background', '#000000', 'important');
        bottomEyelid.style.setProperty('opacity', '1', 'important');
        bottomEyelid.style.setProperty('mix-blend-mode', 'normal', 'important');
        bottomEyelid.style.setProperty('z-index', '20', 'important');
        eyeball.appendChild(bottomEyelid);

        eyeballStates.push({
          eyeballEl: eyeball,
          pupilEl: pupil,
          w: eyeW,
          h: eyeH,
          pupilSize,
          currentPx: 0,
          currentPy: 0,
        });

        return { eyeball, topEyelid, bottomEyelid };
      };

      const leftEye = buildEyeball();
      const rightEye = buildEyeball();

      pairContainer.appendChild(leftEye.eyeball);
      pairContainer.appendChild(rightEye.eyeball);

      chaosContainer.appendChild(pairContainer);

      // Trigger eyelids retract animation & completely hide eyelids once opened
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          leftEye.topEyelid.style.transform = 'translateY(-101%)';
          leftEye.bottomEyelid.style.transform = 'translateY(101%)';
          rightEye.topEyelid.style.transform = 'translateY(-101%)';
          rightEye.bottomEyelid.style.transform = 'translateY(101%)';

          setTimeout(() => {
            leftEye.topEyelid.style.setProperty('display', 'none', 'important');
            leftEye.bottomEyelid.style.setProperty('display', 'none', 'important');
            rightEye.topEyelid.style.setProperty('display', 'none', 'important');
            rightEye.bottomEyelid.style.setProperty('display', 'none', 'important');
          }, 450);
        });
      });
    };

    // Spawn initial eye pair immediately
    spawnEyePair();

    // Spawning loop between 750ms and 1500ms
    let spawnTimer: number | null = null;
    const scheduleNextSpawn = () => {
      const delay = Math.round(750 + Math.random() * 750);
      spawnTimer = window.setTimeout(() => {
        spawnEyePair();
        scheduleNextSpawn();
      }, delay);
    };
    scheduleNextSpawn();

    // Render loop for weighted pupil tracking
    const renderLoop = () => {
      eyeballStates.forEach((state) => {
        const rect = state.eyeballEl.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = mouseX - centerX;
        const dy = mouseY - centerY;
        const dist = Math.hypot(dx, dy);

        const maxTravelX = (state.w / 2 - state.pupilSize / 2) * 0.72;
        const maxTravelY = (state.h / 2 - state.pupilSize / 2) * 0.72;

        let targetPx = 0;
        let targetPy = 0;

        if (dist > 0) {
          const angle = Math.atan2(dy, dx);
          targetPx = Math.cos(angle) * Math.min(dist, maxTravelX);
          targetPy = Math.sin(angle) * Math.min(dist, maxTravelY);
        }

        // Weighted smoothing: 7% distance per frame for fluid gliding
        state.currentPx += (targetPx - state.currentPx) * 0.07;
        state.currentPy += (targetPy - state.currentPy) * 0.07;

        state.pupilEl.style.transform = `translate3d(${state.currentPx.toFixed(2)}px, ${state.currentPy.toFixed(2)}px, 0px)`;
      });

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    activeCleanupRef.current = () => {
      if (spawnTimer !== null) {
        clearTimeout(spawnTimer);
        spawnTimer = null;
      }
      window.removeEventListener('mousemove', handleMouseMove);
      eyeballStates.length = 0;
      const pairs = Array.from(document.querySelectorAll('.chaos-googly-pair'));
      pairs.forEach((p) => {
        if (p.parentNode) p.parentNode.removeChild(p);
      });

      if (rootDiv) {
        rootDiv.style.position = origRootPos;
        rootDiv.style.zIndex = origRootZ;
        if (origRootBg) {
          rootDiv.style.backgroundColor = origRootBg;
        } else {
          rootDiv.style.removeProperty('background-color');
        }
        if (origRootPE) {
          rootDiv.style.pointerEvents = origRootPE;
        } else {
          rootDiv.style.removeProperty('pointer-events');
        }
      }

      if (origBodyBg) {
        document.body.style.backgroundColor = origBodyBg;
      } else {
        document.body.style.removeProperty('background-color');
      }

      if (origHtmlBg) {
        document.documentElement.style.backgroundColor = origHtmlBg;
      } else {
        document.documentElement.style.removeProperty('background-color');
      }

      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  };

  // =========================================================================
  // 8. PLINKO CHAOS MODE
  // =========================================================================
  const initPlinkoMode = async () => {
    const Matter = await import('matter-js');

    document.body.style.cursor = 'default';

    const { chaosContainer, createdClones, scrollX, scrollY, width, height } = setupChaosDOM();

    // Physics Engine with standard Earth gravity
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1, scale: 0.001 },
    });
    matterInstanceRef.current = { engine, Matter };

    // Bounding walls (Top wall raised high so balls spawn above viewport and drop in freely)
    const wallThickness = 100;
    const topWall = Matter.Bodies.rectangle(scrollX + width / 2, scrollY - 200, width * 2, wallThickness, { isStatic: true, restitution: 0.8, friction: 0.1 });
    const bottomWall = Matter.Bodies.rectangle(scrollX + width / 2, scrollY + height + wallThickness / 2, width * 2, wallThickness, { isStatic: true, restitution: 0.8, friction: 0.1 });
    const leftWall = Matter.Bodies.rectangle(scrollX - wallThickness / 2, scrollY + height / 2, wallThickness, height * 2, { isStatic: true, restitution: 0.8, friction: 0.1 });
    const rightWall = Matter.Bodies.rectangle(scrollX + width + wallThickness / 2, scrollY + height / 2, wallThickness, height * 2, { isStatic: true, restitution: 0.8, friction: 0.1 });

    Matter.World.add(engine.world, [topWall, bottomWall, leftWall, rightWall]);

    // Create dynamic text bodies in suspension fluid (high air friction)
    const bindings = createBindingsFromClones(
      Matter,
      engine,
      createdClones,
      scrollX,
      scrollY,
      () => ({
        isStatic: false,
        density: 0.01,
        friction: 0.2,
        frictionAir: 0.15, // Thick fluid friction
        restitution: 0.4,
      })
    );

    const PLINKO_COLORS = ['#00f0ff', '#ff007f', '#ffe600', '#a855f7', '#ff6b00'];

    interface PlinkoBall {
      body: any;
      element: HTMLDivElement;
    }
    const ballBindings: PlinkoBall[] = [];

    let ballCount = 0;
    let colorIdx = 0;
    let spawnInterval: number | null = null;

    const radius = 30; // Doubled radius (30px radius = 60px diameter)

    const spawnBall = () => {
      if (ballCount >= 40) { // Increased drop limit to 40
        if (spawnInterval !== null) {
          clearInterval(spawnInterval);
          spawnInterval = null;
        }
        return;
      }

      const spawnX = scrollX + Math.random() * (width - 120) + 60;
      const spawnY = scrollY - 60;

      const color = PLINKO_COLORS[colorIdx % PLINKO_COLORS.length];
      colorIdx++;

      const ballEl = document.createElement('div');
      ballEl.className = 'chaos-plinko-ball absolute rounded-full select-none pointer-events-none z-[9999]';
      ballEl.style.width = `${radius * 2}px`;
      ballEl.style.height = `${radius * 2}px`;
      ballEl.style.backgroundColor = color;
      ballEl.style.boxShadow = `0 0 16px ${color}, 0 4px 12px rgba(0,0,0,0.6)`;
      ballEl.style.border = 'none'; // Removed stroke for solid fill
      ballEl.style.left = '0px';
      ballEl.style.top = '0px';
      ballEl.style.willChange = 'transform';
      chaosContainer.appendChild(ballEl);

      const ballBody = Matter.Bodies.circle(spawnX, spawnY, radius, {
        density: 0.05,
        restitution: 0.8,
        friction: 0.1,
        frictionAir: 0.005,
      });

      Matter.World.add(engine.world, ballBody);
      ballBindings.push({ body: ballBody, element: ballEl });
      ballCount++;
    };

    // Immediate initial ball drop, then every 300ms
    spawnBall();
    spawnInterval = window.setInterval(spawnBall, 300);

    // Native anti-gravity hover for text bodies (cancels global gravity until struck)
    const handleBeforeUpdate = () => {
      bindings.forEach(({ body }) => {
        body.force.y -= body.mass * engine.world.gravity.y * 0.001;
      });
    };

    const handleCollision = (event: any) => {
      event.pairs.forEach((pair: any) => {
        const { bodyA, bodyB } = pair;
        if (bodyA.isStatic && !bodyB.isStatic && bodyA !== topWall && bodyA !== bottomWall && bodyA !== leftWall && bodyA !== rightWall) {
          Matter.Body.setStatic(bodyA, false);
        } else if (bodyB.isStatic && !bodyA.isStatic && bodyB !== topWall && bodyB !== bottomWall && bodyB !== leftWall && bodyB !== rightWall) {
          Matter.Body.setStatic(bodyB, false);
        }
      });
    };

    Matter.Events.on(engine, 'beforeUpdate', handleBeforeUpdate);
    Matter.Events.on(engine, 'collisionStart', handleCollision);

    const renderLoop = () => {
      Matter.Engine.update(engine, 1000 / 60);

      // Sync text clones (will float in fluid suspension and react natively when struck)
      syncBindingsToDOM(bindings);

      // Sync ball positions
      ballBindings.forEach(({ body, element }) => {
        const x = body.position.x - radius;
        const y = body.position.y - radius;
        element.style.transform = `translate3d(${x}px, ${y}px, 0px) rotate(${body.angle}rad)`;
      });

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    activeCleanupRef.current = () => {
      if (spawnInterval !== null) {
        clearInterval(spawnInterval);
        spawnInterval = null;
      }
      if (engine) {
        Matter.Events.off(engine, 'beforeUpdate', handleBeforeUpdate);
        Matter.Events.off(engine, 'collisionStart', handleCollision);
      }

      ballBindings.forEach(({ body, element }) => {
        try {
          Matter.World.remove(engine.world, body);
        } catch (err) {
          // ignore
        }
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
      ballBindings.length = 0;
    };
  };

  // =========================================================================
  // 9. EFFECT CONTROL ENGINE
  // =========================================================================
  useEffect(() => {
    if (activeMode === 'normal') {
      teardownChaos();
      return;
    }

    if (activeMode === 'paint') {
      document.body.classList.add('chaos-active', 'chaos-paint');
    } else if (activeMode === 'googly') {
      document.body.classList.add('chaos-active', 'chaos-googly');
    } else {
      document.body.classList.add('chaos-active');
    }

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    if (activeMode === 'bulldoze') {
      initBulldozeMode();
    } else if (activeMode === 'zerog') {
      initZeroGMode();
    } else if (activeMode === 'paint') {
      initPaintMode();
    } else if (activeMode === 'shoot') {
      initShootMode();
    } else if (activeMode === 'googly') {
      initGooglyMode();
    } else if (activeMode === 'plinko') {
      initPlinkoMode();
    }

    return () => {
      teardownChaos();
    };
  }, [activeMode]);

  return null;
};

export default ChaosEngine;

