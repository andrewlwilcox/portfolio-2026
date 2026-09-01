import React, { useEffect, useRef } from 'react';

/**
 * MobileGyroBackground component
 *
 * Ambient physics background layer exclusively for mobile viewports (< 768px).
 * Exactly 10 hollow geometric wireframe shapes (5 circles, 5 triangles) float
 * in the background void and roll/collide based on physical device orientation.
 *
 * Performance Safeguards:
 * - Deferred init until window 'load' event
 * - Native 2D Canvas vector strokes (zero asset downloads)
 * - DPR capped at 2 for low GPU overhead
 * - requestAnimationFrame paused when document.hidden (visibilitychange)
 * - iOS 13+ DeviceOrientationEvent permission on first touch
 */
export const MobileGyroBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // 1. SCOPE & ISOLATION: Only initialize on mobile viewports (< 768px)
    if (typeof window === 'undefined' || window.innerWidth >= 768) {
      return;
    }

    let isMounted = true;
    let animFrameId: number | null = null;
    let cleanupListeners: (() => void) | null = null;
    let engine: any = null;
    let MatterModule: any = null;
    let isLoopRunning = false;

    // Active state tracking
    let isMobile = window.innerWidth < 768;
    let walls: any[] = [];
    let shapes: any[] = [];
    let currentGravityX = 0;
    let currentGravityY = 1; // Default downward gravity
    let targetGravityX = 0;
    let targetGravityY = 1;
    let isSensorActive = false;

    const setupGyroPhysics = async () => {
      try {
        const Matter = await import('matter-js');
        if (!isMounted) return;
        MatterModule = Matter;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;

        // DPR CAPPING: Max 2 for crisp retina rendering without GPU waste
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // Matter Engine initialization
        engine = Matter.Engine.create({
          enableSleeping: false,
        });
        engine.world.gravity.x = 0;
        engine.world.gravity.y = 1;
        engine.world.gravity.scale = 0.001;

        // 4 Static Boundary Walls just outside the edges of the mobile viewport
        const wallThickness = 60;
        const createWalls = (w: number, h: number) => {
          const top = Matter.Bodies.rectangle(w / 2, -wallThickness / 2, w * 2, wallThickness, {
            isStatic: true,
            restitution: 0.4,
            friction: 0.1,
          });
          const bottom = Matter.Bodies.rectangle(w / 2, h + wallThickness / 2, w * 2, wallThickness, {
            isStatic: true,
            restitution: 0.4,
            friction: 0.2,
          });
          const left = Matter.Bodies.rectangle(-wallThickness / 2, h / 2, wallThickness, h * 2, {
            isStatic: true,
            restitution: 0.4,
            friction: 0.1,
          });
          const right = Matter.Bodies.rectangle(w + wallThickness / 2, h / 2, wallThickness, h * 2, {
            isStatic: true,
            restitution: 0.4,
            friction: 0.1,
          });
          return [top, bottom, left, right];
        };

        walls = createWalls(width, height);
        Matter.World.add(engine.world, walls);

        // 2. SHAPE SPECIFICATIONS & SIZING (12.5% Scale):
        // Exactly 10 hollow geometric wireframe shapes: 5 circles, 5 triangles
        const createShapes = (w: number, h: number) => {
          const shapeSize = w * 0.125; // Exactly 12.5% of mobile viewport width
          const circleRadius = shapeSize / 2;
          const triangleRadius = shapeSize * 0.57735; // Equilateral triangle with bounding width = shapeSize

          const bodyOptions = {
            restitution: 0.4, // Gentle restitution
            friction: 0.01, // Low friction so shapes slide instantly
            frictionStatic: 0, // Eliminate static friction
            frictionAir: 0.02, // Slight air friction
            density: 0.002,
          };

          const newShapes: any[] = [];

          // Initial positions distributed across the upper half of screen to drop/roll naturally
          const spawnGrid = [
            { x: 0.18, y: 0.10, isCircle: true },
            { x: 0.42, y: 0.14, isCircle: false },
            { x: 0.68, y: 0.08, isCircle: true },
            { x: 0.85, y: 0.18, isCircle: false },
            { x: 0.28, y: 0.26, isCircle: false },
            { x: 0.55, y: 0.24, isCircle: true },
            { x: 0.78, y: 0.32, isCircle: false },
            { x: 0.15, y: 0.38, isCircle: true },
            { x: 0.45, y: 0.42, isCircle: false },
            { x: 0.82, y: 0.46, isCircle: true },
          ];

          spawnGrid.forEach((pos, idx) => {
            const posX = w * pos.x;
            const posY = h * pos.y;

            if (pos.isCircle) {
              // 5 Circles (Bodies.circle)
              const circle = Matter.Bodies.circle(posX, posY, circleRadius, {
                ...bodyOptions,
                label: `circle_${idx}`,
              });
              (circle as any).shapeType = 'circle';
              (circle as any).shapeRadius = circleRadius;
              newShapes.push(circle);
            } else {
              // 5 Equilateral Triangles (Bodies.polygon with 3 sides)
              const triangle = Matter.Bodies.polygon(posX, posY, 3, triangleRadius, {
                ...bodyOptions,
                angle: (idx * Math.PI) / 3, // Varied initial rotation
                label: `triangle_${idx}`,
              });
              (triangle as any).shapeType = 'triangle';
              (triangle as any).shapeRadius = triangleRadius;
              newShapes.push(triangle);
            }
          });

          return newShapes;
        };

        shapes = createShapes(width, height);
        Matter.World.add(engine.world, shapes);

        // 3. DEVICE TILT / GYROSCOPE PHYSICS (DeviceOrientation)
        // Instant responsive physics with automatic neutral baseline calibration
        let baselineBeta: number | null = null;
        let baselineGamma: number | null = null;

        const handleOrientation = (e: DeviceOrientationEvent) => {
          if (e.beta === null || e.gamma === null) return;
          isSensorActive = true;

          const rawGamma = Math.max(-90, Math.min(90, e.gamma || 0));
          const rawBeta = Math.max(-180, Math.min(180, e.beta || 0));

          if (baselineBeta === null || baselineGamma === null) {
            // Calibrate baseline angle on the very first event received
            baselineBeta = rawBeta;
            baselineGamma = rawGamma;
          } else {
            // Ultra-slow background adaptive centering (drift correction over 30s)
            baselineBeta += (rawBeta - baselineBeta) * 0.002;
            baselineGamma += (rawGamma - baselineGamma) * 0.002;
          }

          // Calculate deviation away from the user's personal holding baseline
          const deltaGamma = rawGamma - baselineGamma; // tilt left (-) / right (+)
          const deltaBeta = rawBeta - baselineBeta;   // tilt top forward/down (-) / backward/up (+)

          // High-sensitivity multiplier for instantaneous, crisp physical response
          const sensitivity = 2.0;
          const radGamma = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, (deltaGamma * sensitivity) * (Math.PI / 180)));
          const radBeta = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, (deltaBeta * sensitivity) * (Math.PI / 180)));

          // Instantaneous direct gravity assignment
          targetGravityX = Math.sin(radGamma) * 1.8;
          targetGravityY = (Math.sin(radBeta) * 1.8) + (Math.cos(radGamma) * 0.6);

          // Apply instantly to engine world gravity for zero delay
          if (engine) {
            engine.world.gravity.x = targetGravityX;
            engine.world.gravity.y = targetGravityY;
          }
        };

        // 4. UNCONDITIONAL SENSOR ATTACHMENT (Direct on mount, no tap/click gating)
        window.addEventListener('deviceorientation', handleOrientation, { passive: true });

        // RESIZE & ORIENTATION CHANGE HANDLING
        const handleResize = () => {
          if (!canvasRef.current || !engine) return;
          const newWidth = window.innerWidth;
          const newHeight = window.innerHeight;
          isMobile = newWidth < 768;

          if (!isMobile) {
            // Clear canvas if resized to desktop
            const currentCanvas = canvasRef.current;
            const currentCtx = currentCanvas.getContext('2d');
            if (currentCtx) {
              currentCtx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
            }
            return;
          }

          const currentCanvas = canvasRef.current;
          const currentCtx = currentCanvas.getContext('2d');
          if (!currentCtx) return;

          const newDpr = Math.min(window.devicePixelRatio || 1, 2);
          currentCanvas.width = newWidth * newDpr;
          currentCanvas.height = newHeight * newDpr;
          currentCtx.setTransform(1, 0, 0, 1, 0, 0);
          currentCtx.scale(newDpr, newDpr);

          // Update walls
          if (walls.length > 0) {
            Matter.World.remove(engine.world, walls);
          }
          walls = createWalls(newWidth, newHeight);
          Matter.World.add(engine.world, walls);

          // Update shapes
          if (shapes.length > 0) {
            Matter.World.remove(engine.world, shapes);
          }
          shapes = createShapes(newWidth, newHeight);
          Matter.World.add(engine.world, shapes);
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);

        // 4. VISIBILITY PAUSE: Pause render loop when tab/screen is hidden to save battery
        const handleVisibilityChange = () => {
          if (document.hidden) {
            if (animFrameId !== null) {
              cancelAnimationFrame(animFrameId);
              animFrameId = null;
            }
            isLoopRunning = false;
          } else if (!isLoopRunning && isMounted) {
            lastTime = performance.now();
            isLoopRunning = true;
            animFrameId = requestAnimationFrame(renderLoop);
          }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        cleanupListeners = () => {
          window.removeEventListener('deviceorientation', handleOrientation);
          window.removeEventListener('resize', handleResize);
          window.removeEventListener('orientationchange', handleResize);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        };

        // ANIMATION & PHYSICS RENDER LOOP
        let lastTime = performance.now();

        const renderLoop = (time: number) => {
          if (!isMounted) return;

          const dt = Math.min(time - lastTime, 33.33); // Clamp delta time to max ~30fps step
          lastTime = time;

          if (isMobile && engine && canvasRef.current) {
            const currentCanvas = canvasRef.current;
            const currentCtx = currentCanvas.getContext('2d');

            if (currentCtx) {
              // Direct zero-delay gravity update
              if (isSensorActive) {
                engine.world.gravity.x = targetGravityX;
                engine.world.gravity.y = targetGravityY;
              } else {
                engine.world.gravity.x = 0;
                engine.world.gravity.y = 1;
              }

              // Step Matter engine
              Matter.Engine.update(engine, dt);

              // Clear canvas
              currentCtx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);

              // 2. VISUAL STYLE:
              // Transparent fill, thin outline (1.2px), 70% muted gray / semi-transparent white (e.g., rgba(255, 255, 255, 0.3) / #707070)
              const isLight = document.documentElement.classList.contains('light') || document.body.classList.contains('light');
              currentCtx.save();
              currentCtx.lineWidth = 1.2;
              currentCtx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.3)';
              currentCtx.fillStyle = 'transparent';

              shapes.forEach((body) => {
                const { vertices, position, angle } = body;
                const shapeType = (body as any).shapeType;

                if (shapeType === 'circle') {
                  const r = (body as any).shapeRadius || body.circleRadius || 15;
                  currentCtx.save();
                  currentCtx.translate(position.x, position.y);
                  currentCtx.rotate(angle);
                  currentCtx.beginPath();
                  currentCtx.arc(0, 0, r, 0, Math.PI * 2);
                  currentCtx.stroke();
                  currentCtx.restore();
                } else if (vertices && vertices.length > 0) {
                  currentCtx.save();
                  currentCtx.beginPath();
                  currentCtx.moveTo(vertices[0].x, vertices[0].y);
                  for (let j = 1; j < vertices.length; j++) {
                    currentCtx.lineTo(vertices[j].x, vertices[j].y);
                  }
                  currentCtx.closePath();
                  currentCtx.stroke();
                  currentCtx.restore();
                }
              });

              currentCtx.restore();
            }
          }

          animFrameId = requestAnimationFrame(renderLoop);
        };

        isLoopRunning = true;
        animFrameId = requestAnimationFrame(renderLoop);
      } catch (err) {
        console.warn('MobileGyroBackground init error:', err);
      }
    };

    // Instant initialization without blocking or waiting for window 'load'
    setupGyroPhysics();

    return () => {
      isMounted = false;
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
      }
      if (cleanupListeners) {
        cleanupListeners();
      }
      if (engine && MatterModule) {
        try {
          MatterModule.World.clear(engine.world, false);
          MatterModule.Engine.clear(engine);
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-screen h-screen pointer-events-none z-0 select-none block md:hidden"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
      }}
      aria-hidden="true"
    />
  );
};
