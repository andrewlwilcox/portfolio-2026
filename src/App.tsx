import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowUpRight, 
  Mail, 
  Copy, 
  Check, 
  Menu, 
  X, 
  ArrowDown, 
  MapPin, 
  Sparkles, 
  Send, 
  History, 
  Heart,
  Linkedin
} from 'lucide-react';
import { portfolioData } from './portfolioData.js';
import { Project } from './types';
import MagneticText from './components/MagneticText';
import MagneticImage3D from './components/MagneticImage3D';
import ProjectRow from './components/ProjectRow';
import { SplitFlapCountdown } from './components/SplitFlapCountdown';
import { motion, AnimatePresence } from 'motion/react';

const AVAILABILITY_DATE = "2026-09-02T09:00:00";

const formatAvailabilityDate = (dateString: string) => {
  const date = new Date(dateString);
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

export default function App() {
  // Navigation & Scroll states
  const [isNavbarVisible, setIsNavbarVisible] = useState(true);
  const [prevScrollPos, setPrevScrollPos] = useState(0);
  const [activeSection, setActiveSection] = useState('work');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active hover states for project index
  const [hoveredProject, setHoveredProject] = useState<Project | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [activeBgColor, setActiveBgColor] = useState('#0a0a0c'); // Default elegant deep rich off-black

  // Contact form submission states (100% Client-Side Persistence)
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [sentMessages, setSentMessages] = useState<any[]>([]);
  const [showSentLogs, setShowSentLogs] = useState(false);

  // General UI States
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<Project | null>(null);
  const [likedProjects, setLikedProjects] = useState<Record<string, boolean>>({});
  const [hoveredCaseStudyImageIndex, setHoveredCaseStudyImageIndex] = useState<number | null>(null);
  const [selectedCaseStudyImageIndex, setSelectedCaseStudyImageIndex] = useState<number | null>(null);
  const [modalScrollY, setModalScrollY] = useState(0);
  const [hoveredExperienceIndex, setHoveredExperienceIndex] = useState<number | null>(null);

  // Reset selected image when selectedCaseStudy changes
  useEffect(() => {
    setSelectedCaseStudyImageIndex(null);
  }, [selectedCaseStudy]);

  const isPopStateRef = useRef(false);

  // Close helper
  const closeCaseStudy = () => {
    if (window.history.state?.projectDetailOpen === true && !isPopStateRef.current) {
      window.history.back();
    }
    isPopStateRef.current = false;
    setSelectedCaseStudy(null);
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (selectedCaseStudy) {
        isPopStateRef.current = true;
        setSelectedCaseStudy(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [selectedCaseStudy]);

  useEffect(() => {
    if (selectedCaseStudy) {
      if (window.history.state?.projectDetailOpen !== true) {
        window.history.pushState({ projectDetailOpen: true }, '', '');
      }
    }
  }, [selectedCaseStudy]);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleModalTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }
  };

  const handleModalTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length !== 1) return;
    
    const startX = touchStartRef.current.x;
    const startY = touchStartRef.current.y;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    
    const diffX = endX - startX;
    const diffY = endY - startY;
    
    // Check for mostly horizontal swipe
    if (Math.abs(diffY) < 60) {
      // Swipe left: finger moves right-to-left (diffX < -60)
      // Swipe right: finger moves left-to-right (diffX > 60)
      if (Math.abs(diffX) > 60) {
        closeCaseStudy();
      }
    }
    
    touchStartRef.current = null;
  };

  // Mobile viewport and vertical center-stage project tracking
  const [activeCenterStageRowId, setActiveCenterStageRowId] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const workContainerRef = useRef<HTMLDivElement>(null);
  const mobileScrollTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    setIsMobileViewport(mediaQuery.matches);
    
    const listener = (e: MediaQueryListEvent) => {
      setIsMobileViewport(e.matches);
    };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // Reset active state when the active project row scrolls significantly out of the vertical center of the viewport,
  // or when scrolling ceases completely.
  useEffect(() => {
    if (!isMobileViewport) {
      setActiveCenterStageRowId(null);
      return;
    }

    const handleScroll = () => {
      // Clear any pending scroll-end deactivation timeout
      if (mobileScrollTimeoutRef.current) {
        clearTimeout(mobileScrollTimeoutRef.current);
      }

      if (activeCenterStageRowId) {
        const activeElement = document.querySelector(`[data-project-id="${activeCenterStageRowId}"]`);
        if (activeElement) {
          const rect = activeElement.getBoundingClientRect();
          const elementCenter = rect.top + rect.height / 2;
          const viewportCenter = window.innerHeight / 2;
          const maxDistance = window.innerHeight * 0.35; // Deactivate if element center is > 35% of innerHeight away from viewport center
          if (Math.abs(elementCenter - viewportCenter) > maxDistance) {
            setActiveCenterStageRowId(null);
            return; // Don't queue scroll-end since it is already null
          }
        }

        // Set up the scroll-end debouncer (150ms) to revert active state to null
        mobileScrollTimeoutRef.current = setTimeout(() => {
          setActiveCenterStageRowId(null);
        }, 150);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (mobileScrollTimeoutRef.current) {
        clearTimeout(mobileScrollTimeoutRef.current);
      }
    };
  }, [isMobileViewport, activeCenterStageRowId]);

  useEffect(() => {
    if (!isMobileViewport) return;
    
    if (activeCenterStageRowId) {
      const activeProj = portfolioData.projects.find((p: any) => p.id === activeCenterStageRowId);
      if (activeProj?.hoverBgColor) {
        setActiveBgColor(activeProj.hoverBgColor);
      }
    } else {
      setActiveBgColor('#0a0a0c');
    }
  }, [activeCenterStageRowId, isMobileViewport]);

  // ---------------------------------------------------------------------------
  // Project ID definitions & custom mapping for strict displaying requirements
  // ---------------------------------------------------------------------------
  const workProjectIds = [
    'openai',
    'google-safer',
    'airbnb',
    'bose-alexa',
    'google-unblur',
    'motorola-e',
    'meta',
    'amazon-alexa',
    'arconic',
    'motorola-x',
    'amazon-halo',
    'nike-china'
  ];

  const sideProjectIds = [
    'cook-with-alexa',
    'book-that-is-a-raincoat',
    'some-kind-of-quest'
  ];

  const workProjects = workProjectIds
    .map(id => portfolioData.projects.find(p => p.id === id) as Project | undefined)
    .filter((p): p is Project => !!p);

  const sideProjects = sideProjectIds
    .map(id => portfolioData.projects.find(p => p.id === id) as Project | undefined)
    .filter((p): p is Project => !!p);

  const getProjectDisplayTitle = (project: Project) => {
    if (!project) return '';
    if (project.id === 'choose-choice' || project.id === 'motorola-x') return 'Motorola X';
    if (project.id === 'drop' || project.id === 'motorola-e') return 'Motorola E';
    if (project.id === 'airbnb' || project.id === 'airbnb-experiences') return 'Airbnb';
    if (project.id === 'openai') return 'OpenAI';
    if (project.id === 'google-safer' || project.id === 'google-security' || project.id === 'google') return 'Google Security';
    if (project.id === 'google-unblur' || project.id === 'google-pixel') return 'Google Unblur';
    if (project.id === 'bose-alexa') return 'Bose + Alexa';
    if (project.id === 'meta-amani' || project.id === 'meta') return 'Meta';
    if (project.id === 'alexa-cove' || project.id === 'amazon-alexa') return 'Amazon Alexa';
    if (project.id === 'this-is-guangzhou' || project.id === 'nike-china') return 'Nike China';
    if (project.id === 'arconic') return 'Arconic';
    if (project.id === 'amazon-halo') return 'Amazon Halo';
    if (project.id === 'cook-with-alexa') return 'Cook with Alexa';
    if (project.id === 'btiarc' || project.id === 'book-that-is-a-raincoat') return 'Book That Is A Raincoat';
    if (project.id === 'some-kind-of-quest') return 'Some Kind of Quest';
    
    // Programmatic Title Case fallback
    if (!project.title) return '';
    return project.title
      .toLowerCase()
      .split(' ')
      .map((word: string, i: number) => {
        if (word === 'with' || word === 'is' || word === 'a' || word === 'that' || word === 'of') {
          return i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  };

  const getProjectStrategyLine = (projectId: string): string => {
    if (selectedCaseStudy && selectedCaseStudy.id === projectId && selectedCaseStudy.strategy_line) {
      return selectedCaseStudy.strategy_line;
    }
    const strategyLines: Record<string, string> = {
      openai: "Show what the first 10 years at OpenAI felt like.",
      "google-safer": "Google Security: online safety top of mind, all the time.",
      google: "Google Security: online safety top of mind, all the time.",
      "google-security": "Google Security: online safety top of mind, all the time.",
      "airbnb-experiences": "Experiences are story, design, and feeling.",
      airbnb: "Experiences are story, design, and feeling.",
      "bose-alexa": "Don't miss a thing.",
      "google-unblur": "The moments in between the moments.",
      "google-pixel": "The moments in between the moments.",
      "meta-amani": "Leveling the playing field to remove the barrier of distance and connect us all.",
      meta: "Leveling the playing field to remove the barrier of distance and connect us all.",
      drop: "Durability and breakthrough watchability.",
      "motorola-e": "Durability and breakthrough watchability.",
      "motorola-x": "Choose choice: custom smart devices built by people, not robots.",
      "alexa-cove": "Campuses are a different world. So we created a Snapchat series to meet them where they are.",
      "amazon-alexa": "Campuses are a different world. So we created a Snapchat series to meet them where they are.",
      "this-is-guangzhou": "Your Game is Your Voice.",
      "nike-china": "Your Game is Your Voice.",
      arconic: "Products of the future.",
      "choose-choice": "Choose choice: custom smart devices built by people, not robots.",
      "start-here": "Bioregions are organic and fluid topographies beyond political labels.",
      "amazon-halo": "Understand your body, build healthier habits for life.",
      "everyday": "Target understands why life happens.",
      "cook-with-alexa": "alexa, let's cook.",
      "btiarc": "We all have much more going on on the inside than what is on the outside.",
      "book-that-is-a-raincoat": "We all have much more going on on the inside than what is on the outside.",
      "some-kind-of-quest": "What happens when artwork becomes life's work?",
      "my-own-summer": "Exploring typographic layout and fluid color gradients.",
      "seven-words": "High-contrast editorial grid structures for digital publication."
    };
    return strategyLines[projectId] || "Authentic art direction and visual aesthetics.";
  };

  // ---------------------------------------------------------------------------
  // Relative Luminance Calculator to automatically flip styling (for high contrast readability)
  // ---------------------------------------------------------------------------
  const isLightColor = (hexColor: string) => {
    if (!hexColor || hexColor === '#0a0a0c') return false;
    
    // Support hsla parsing if any color is encoded in hsla format
    if (hexColor.startsWith('hsla') || hexColor.startsWith('hsl')) {
      // Extract lightness percentage
      const match = hexColor.match(/(\d+)%\s*,\s*[^,)]+\)$/) || hexColor.match(/,\s*(\d+)%\s*,/);
      if (match) {
        const lightness = parseInt(match[1], 10);
        return lightness > 65;
      }
      return false;
    }

    const hex = hexColor.replace('#', '');
    if (hex.length < 6) return false;
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Relative luminance ITU-R BT.709 formulation
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luma > 165; 
  };

  const isLightActive = isLightColor(activeBgColor);

  // ---------------------------------------------------------------------------
  // Smooth Dampened Cursor-Tracking Physics (Velocity & Rotation)
  // ---------------------------------------------------------------------------
  const mouseRef = useRef({ x: 0, y: 0 });
  const currentPosRef = useRef({ x: 0, y: 0 });
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const rotationRef = useRef(0);
  const scaleRef = useRef(0);
  
  const [previewStyle, setPreviewStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    left: 0,
    top: 0,
    transform: 'translate3d(0px, 0px, 0px) rotate(0deg) scale(0)',
    opacity: 0,
    pointerEvents: 'none',
    zIndex: 9999,
  });

  // Keep tracking target mouse raw position
  useEffect(() => {
    const handleRawMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleRawMouseMove);
    return () => window.removeEventListener('mousemove', handleRawMouseMove);
  }, []);

  // Update loop for custom inertia & tilt calculations
  useEffect(() => {
    let animationId = 0;

    const tickPhysics = () => {
      // Scale dynamic sizing (0 to 1 with spring easing)
      const targetScale = isHovering && hoveredProject ? 1 : 0;
      scaleRef.current += (targetScale - scaleRef.current) * 0.15; // spring-like scaling

      // Glide current visual positions towards raw targets (dampening lag effect)
      const dx = mouseRef.current.x - currentPosRef.current.x;
      const dy = mouseRef.current.y - currentPosRef.current.y;
      currentPosRef.current.x += dx * 0.08;
      currentPosRef.current.y += dy * 0.08;

      // Vertical & horizontal velocities to calculate tilt values
      const vx = mouseRef.current.x - prevMouseRef.current.x;
      prevMouseRef.current = { ...mouseRef.current };

      // Rotation matches horizontal swipe speeds (clamped safely between -20 and 20 deg)
      const targetRotation = Math.max(-20, Math.min(20, vx * 0.45));
      rotationRef.current += (targetRotation - rotationRef.current) * 0.09; // smooth recovery tilt decay

      if (scaleRef.current > 0.01) {
        setPreviewStyle({
          position: 'fixed',
          left: 0,
          top: 0,
          width: '480px',
          height: '480px',
          transform: `translate3d(${currentPosRef.current.x}px, ${currentPosRef.current.y}px, 0px) translate(-50%, -50%) rotate(${rotationRef.current}deg) scale(${scaleRef.current})`,
          opacity: Math.max(0, Math.min(1, scaleRef.current * 0.98)),
          pointerEvents: 'none',
          zIndex: 9999,
          borderRadius: '0px',
          boxShadow: `0 32px 70px rgba(0,0,0,0.48), 0 0 40px ${activeBgColor}35`,
          transition: 'opacity 0.15s ease-out',
        });
      } else {
        setPreviewStyle({
          position: 'fixed',
          left: `${mouseRef.current.x}px`,
          top: `${mouseRef.current.y}px`,
          transform: 'translate(-50%, -50%) scale(0)',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: 9999,
        });
      }

      animationId = requestAnimationFrame(tickPhysics);
    };

    animationId = requestAnimationFrame(tickPhysics);
    return () => cancelAnimationFrame(animationId);
  }, [isHovering, hoveredProject, activeBgColor]);

  // ---------------------------------------------------------------------------
  // Smart Hiding Header Scroll Observer
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollPos = window.pageYOffset || document.documentElement.scrollTop;

      // Track relative sections to update navigation indicator
      const sections = ['work', 'side-projects', 'connect'];
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 250 && rect.bottom >= 250) {
            setActiveSection(section);
          }
        }
      }

      // Hide header on downward scroll, expose header on upward scroll
      if (currentScrollPos < 70) {
        setIsNavbarVisible(true);
      } else {
        setIsNavbarVisible(prevScrollPos > currentScrollPos);
      }

      setPrevScrollPos(currentScrollPos);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [prevScrollPos]);

  // ---------------------------------------------------------------------------
  // Local Storage Data Hydration
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const savedMsg = localStorage.getItem('portfolio_messages_logs');
    if (savedMsg) {
      try { setSentMessages(JSON.parse(savedMsg)); } catch (_) {}
    }

    const savedLikes = localStorage.getItem('portfolio_likes_registry');
    if (savedLikes) {
      try { setLikedProjects(JSON.parse(savedLikes)); } catch (_) {}
    }
  }, []);

  useEffect(() => {
    if (selectedCaseStudy) {
      document.body.style.overflow = 'hidden';
      setModalScrollY(0);
    } else {
      document.body.style.overflow = '';
    }
    setHoveredCaseStudyImageIndex(null);
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedCaseStudy]);

  // ---------------------------------------------------------------------------
  // Interaction Utilities
  // ---------------------------------------------------------------------------
  const copyMailAddress = () => {
    navigator.clipboard.writeText("andrewlwilcox@gmail.com");
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleBriefSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) return;

    const submission = {
      id: `msg-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString(),
      ...contactForm
    };

    const updated = [submission, ...sentMessages];
    setSentMessages(updated);
    localStorage.setItem('portfolio_messages_logs', JSON.stringify(updated));
    setFormSubmitted(true);
    setContactForm({ name: '', email: '', message: '' });

    setTimeout(() => setFormSubmitted(false), 4000);
  };

  const toggleProjectLikes = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...likedProjects, [projectId]: !likedProjects[projectId] };
    setLikedProjects(updated);
    localStorage.setItem('portfolio_likes_registry', JSON.stringify(updated));
  };

  const clearMessageHistory = () => {
    if (window.confirm("Do you want to clear your local communications history?")) {
      setSentMessages([]);
      localStorage.removeItem('portfolio_messages_logs');
    }
  };

  // Vimeo & YouTube Embed URL parser helper
  const getVimeoEmbedUrl = (url: string) => {
    if (!url || url === 'nan') return null;
    try {
      // YouTube Support
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = '';
        if (url.includes('youtu.be/')) {
          videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('v=')) {
          videoId = url.split('v=')[1].split('&')[0];
        } else if (url.includes('youtube.com/embed/')) {
          videoId = url.split('youtube.com/embed/')[1].split('?')[0];
        } else if (url.includes('youtube.com/shorts/')) {
          videoId = url.split('youtube.com/shorts/')[1].split('?')[0];
        }
        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`;
        }
      }

      // Vimeo Support
      if (url.includes('player.vimeo.com/video/')) {
        const parts = url.split('/video/');
        const rest = parts[1];
        const id = rest.split('?')[0].split('/')[0];
        
        let hashParam = '';
        const queryIndex = rest.indexOf('?');
        if (queryIndex !== -1) {
          const queryStr = rest.substring(queryIndex + 1);
          const params = new URLSearchParams(queryStr);
          if (params.has('h')) {
            hashParam = params.get('h') || '';
          }
        }
        
        const pathSegments = rest.split('?')[0].split('/');
        if (pathSegments.length > 1 && pathSegments[1]) {
          hashParam = pathSegments[1];
        }

        const hashQuery = hashParam ? `&h=${hashParam}` : '';
        return `https://player.vimeo.com/video/${id}?background=0&autoplay=0&muted=0${hashQuery}`;
      }
      
      const vimeoDomainRemoved = url
        .replace('https://', '')
        .replace('http://', '')
        .replace('www.', '')
        .replace('vimeo.com/', '')
        .split('?')[0];

      const pathParts = vimeoDomainRemoved.split('/');
      const id = pathParts[0];
      const hash = pathParts[1];
      if (id) {
        const hashQuery = hash ? `&h=${hash}` : '';
        return `https://player.vimeo.com/video/${id}?background=0&autoplay=0&muted=0${hashQuery}`;
      }
    } catch (e) {
      console.error("Embed URL parsing error", e);
    }
    return null;
  };

  return (
    <div 
      className="min-h-screen flex flex-col font-sans overflow-x-hidden relative"
      style={{ 
        backgroundColor: activeBgColor,
        color: isLightActive ? '#0a0a0c' : '#f4f4f7'
      }}
    >
      {/* Absolute Ambient Grid Subtle Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.012] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]"
        style={{ 
          opacity: isLightActive ? 0.04 : 0.012,
          backgroundImage: isLightActive ? 'radial-gradient(#000_1px,transparent_1px)' : 'radial-gradient(#fff_1px,transparent_1px)'
        }}
      />

      {/* -------------------------------------------------------------------------
          SMART HIDING NAVIGATION BAR
          ------------------------------------------------------------------------- */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isNavbarVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        }`}
        style={{ 
          backgroundColor: prevScrollPos > 40 
            ? (isLightActive ? 'rgba(255,255,255,0.85)' : 'rgba(10,10,12,0.85)') 
            : 'transparent',
          backdropFilter: prevScrollPos > 40 ? 'blur(16px)' : 'none',
          borderBottom: prevScrollPos > 40 
            ? (isLightActive ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.05)') 
            : '1px solid transparent'
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          
          {/* Top-Left: "Let's Talk" button (Desktop & Mobile left-aligned) */}
          <div className="flex items-center">
            {/* Desktop Let's Talk button */}
            <div className="hidden md:flex items-center">
              <motion.button 
                onClick={copyMailAddress}
                whileHover="hover"
                initial="initial"
                className="px-3 py-1.5 rounded-full border border-current font-mono text-xs tracking-wider uppercase opacity-80 hover:opacity-100 hover:scale-[1.03] transition-all flex items-center space-x-1.5 focus:outline-none relative"
              >
                {copiedEmail ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500 animate-pulse" />
                    <span className="text-emerald-500 font-bold">EMAIL COPIED!</span>
                  </>
                ) : (
                  <>
                    <motion.span 
                      variants={{
                        initial: { y: 0, scale: 1, rotate: 0 },
                        hover: { 
                          y: -14, 
                          scale: 1.25, 
                          rotate: 20,
                          transition: { 
                            type: "spring", 
                            stiffness: 260, 
                            damping: 15,
                            mass: 0.8
                          } 
                        }
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 15
                      }}
                      className="inline-flex items-center justify-center relative z-10"
                    >
                      <svg 
                        viewBox="0 0 24 24" 
                        style={{ width: '14.4px', height: '14.4px' }}
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        {/* Backing solid rectangle to cover button outline when breaking out */}
                        <rect x="2" y="4" width="20" height="16" rx="2" fill={activeBgColor} stroke="currentColor" strokeWidth="2" />
                        {/* Fold lines without fill so V-flap remains visible */}
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" fill="none" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    </motion.span>
                    <span>LET'S TALK</span>
                  </>
                )}
              </motion.button>
            </div>

            {/* Mobile Let's Talk button (Left aligned) */}
            <div className="md:hidden flex items-center">
              <motion.button 
                onClick={copyMailAddress}
                className="px-2.5 py-1 rounded-full border border-current font-mono text-[0.55rem] tracking-wider uppercase opacity-80 hover:opacity-100 transition-all flex items-center space-x-1 focus:outline-none relative"
              >
                {copiedEmail ? (
                  <>
                    <Check className="w-2.5 h-2.5 text-emerald-500 animate-pulse" />
                    <span className="text-emerald-500 font-bold">COPIED!</span>
                  </>
                ) : (
                  <>
                    <span>LET'S TALK</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>

          {/* Top-Right Area: Split-Flap for Desktop, Hamburger for Mobile */}
          <div className="flex items-center justify-end">
            {/* Grouped dynamic text and SplitFlapCountdown (Desktop only) */}
            <div className="hidden md:flex items-center justify-end gap-2 md:gap-3">
              <div className="text-right font-mono text-xs tracking-widest text-neutral-400 uppercase leading-normal select-none">
                AVAILABLE FOR NEW PROJECTS ON <span className="text-white font-medium">{formatAvailabilityDate(AVAILABILITY_DATE)}</span>
              </div>
              <SplitFlapCountdown availabilityDateTime={AVAILABILITY_DATE} />
            </div>

            {/* Mobile hamburger Toggle */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 opacity-80 hover:opacity-100 transition-opacity focus:outline-none"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <div 
          className={`md:hidden absolute top-20 left-0 right-0 border-b overflow-hidden transition-all duration-500 ease-out ${
            mobileMenuOpen ? 'max-h-64 opacity-100 visible' : 'max-h-0 opacity-0 invisible'
          }`}
          style={{ 
            borderColor: isLightActive ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)',
            backgroundColor: isLightActive ? '#ffffff' : '#0e0f12'
          }}
        >
          <div className="px-6 py-6 flex flex-col space-y-4 font-mono text-xs uppercase tracking-widest">
            {[
              { id: 'work', label: 'Work' },
              { id: 'side-projects', label: 'Side Work' },
              { id: 'connect', label: 'Experience' }
            ].map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
                  setMobileMenuOpen(false);
                  setActiveSection(section.id);
                  if (section.id !== 'work' && section.id !== 'side-projects') {
                    setActiveBgColor('#0a0a0c');
                  }
                }}
                className={`py-1 ${activeSection === section.id ? 'font-bold opacity-100' : 'opacity-60'}`}
              >
                {section.label}
              </a>
            ))}
            <div className="pt-2 border-t border-current border-opacity-10">
              <button 
                onClick={() => {
                  copyMailAddress();
                  setMobileMenuOpen(false);
                }}
                className="text-[0.65rem] tracking-wider font-semibold opacity-70"
              >
                {copiedEmail ? '✓ EMAIL COPIED!' : 'COPY EMAIL CORRESPONDENCE'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------------------
          INTERACTIVE VELOCITY CURSOR-TRACKING PREVIEW
          ------------------------------------------------------------------------- */}
      <div 
        style={previewStyle}
        className="pointer-events-none fixed z-[9999] overflow-hidden rounded-none hidden md:block"
      >
        {hoveredProject && (
          <div className="relative w-full h-full bg-neutral-900 overflow-hidden transform scale-[1.01]">
            <img 
              src={hoveredProject.hoverGifUrl} 
              alt={hoveredProject.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover select-none pointer-events-none scale-105 duration-700 object-center"
            />
            
            {/* Minimal High-Contrast Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent flex flex-col justify-end p-5">
              <div className="space-y-1">
                <h4 className="font-young text-sm md:text-base font-bold leading-tight text-white mb-1">
                  {getProjectDisplayTitle(hoveredProject)}
                </h4>
                <p 
                  className="font-mono text-xs tracking-wider uppercase font-bold"
                  style={{ color: hoveredProject.hoverBgColor }}
                >
                  {hoveredProject.category}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------------
          MAIN ARCHITECTURAL VIEWPORTS
          ------------------------------------------------------------------------- */}
      <main className="flex-grow pt-12 md:pt-16">

        {/* 1. Hero Introduction */}
        <section 
          id="hero" 
          className="max-w-6xl mx-auto px-6 pt-8 pb-4 md:pt-12 md:pb-6"
        >
          <div className="max-w-4xl">
            <span className="font-mono text-xs uppercase tracking-[0.3em] opacity-40 block mb-8">
              / HELLO /
            </span>
            
            <h1 className="font-young text-[9.8vw] md:text-8xl font-normal tracking-tight leading-[1.05] normal-case">
              <span className="block whitespace-nowrap overflow-visible">Andrew Wilcox</span>
              <span className="block whitespace-nowrap overflow-visible">
                <MagneticText text="Creative Director" />
              </span>
            </h1>

            <p className="font-mono text-xs uppercase tracking-[0.18em] leading-relaxed max-w-3xl opacity-70 mt-4">
              {portfolioData.hero.subheadline}
            </p>
          </div>
        </section>

        {/* 2. Interactive Work Index List (Carbon Copy 1:1 physics tracker) */}
        <section 
          id="work" 
          className="max-w-6xl mx-auto px-6 pt-6 pb-4 md:pt-8 md:pb-6 border-t"
          style={{ borderColor: isLightActive ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)' }}
        >
          <div className="flex flex-col md:flex-row md:items-baseline md:justify-between mb-8 gap-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-[0.3em] opacity-40">
                / INDEX /
              </span>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase mt-1">
                Selected Work
              </h2>
            </div>
          </div>

          <div 
            ref={workContainerRef}
            className="flex flex-col divide-y divide-current divide-opacity-10 border-t border-b border-current border-opacity-10"
          >
            {workProjects.map((project: any, index) => {
               const numStr = String(index + 1).padStart(2, '0');
               const displayTitle = getProjectDisplayTitle(project);
               const isMobileActive = activeCenterStageRowId === project.id;
               
               return (
                 <ProjectRow
                   key={project.id}
                   project={project}
                   index={index}
                   numStr={numStr}
                   displayTitle={displayTitle}
                   isMobileActive={isMobileActive}
                   onClick={() => setSelectedCaseStudy(project)}
                   onMouseEnter={() => {
                     setHoveredProject(project);
                     setActiveBgColor(project.hoverBgColor);
                     setIsHovering(true);
                   }}
                   onMouseLeave={() => {
                     setHoveredProject(null);
                     setActiveBgColor('#0a0a0c');
                     setIsHovering(false);
                   }}
                   onTouchStart={() => {
                     if (isMobileViewport) {
                       setActiveCenterStageRowId(project.id);
                     }
                   }}
                   onTouchEnd={() => {
                     if (isMobileViewport) {
                       setActiveCenterStageRowId(null);
                     }
                   }}
                   onTouchCancel={() => {
                     if (isMobileViewport) {
                       setActiveCenterStageRowId(null);
                     }
                   }}
                 />
               );
             })}
          </div>
        </section>

        {/* 2.5. Side Projects Section */}
        <section 
          id="side-projects" 
          className="max-w-6xl mx-auto px-6 pt-4 pb-4 md:pt-6 md:pb-6 border-t"
          style={{ borderColor: isLightActive ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)' }}
        >
          <div className="flex flex-col md:flex-row md:items-baseline md:justify-between mb-16 gap-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-[0.3em] opacity-40">
                / EXTRA /
              </span>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase mt-1">
                Side Work
              </h2>
            </div>
            
            <p className="text-xs font-mono max-w-xs opacity-50 uppercase tracking-widest leading-relaxed text-right md:text-right">
              *experimental side projects and creative explorations.
            </p>
          </div>

          <div className="flex flex-col divide-y divide-current divide-opacity-10 border-t border-b border-current border-opacity-10">
            {sideProjects.map((project: any, index) => {
              const numStr = String(index + 1).padStart(2, '0');
              const displayTitle = getProjectDisplayTitle(project);
              const isMobileActive = activeCenterStageRowId === project.id;
              
              return (
                <ProjectRow
                  key={project.id}
                  project={project}
                  index={index}
                  numStr={numStr}
                  displayTitle={displayTitle}
                  isMobileActive={isMobileActive}
                  onClick={() => setSelectedCaseStudy(project)}
                  onMouseEnter={() => {
                    setHoveredProject(project);
                    setActiveBgColor(project.hoverBgColor);
                    setIsHovering(true);
                  }}
                  onMouseLeave={() => {
                    setHoveredProject(null);
                    setActiveBgColor('#0a0a0c');
                    setIsHovering(false);
                  }}
                  onTouchStart={() => {
                    if (isMobileViewport) {
                      setActiveCenterStageRowId(project.id);
                    }
                  }}
                  onTouchEnd={() => {
                    if (isMobileViewport) {
                      setActiveCenterStageRowId(null);
                    }
                  }}
                  onTouchCancel={() => {
                    if (isMobileViewport) {
                      setActiveCenterStageRowId(null);
                    }
                  }}
                />
              );
            })}
          </div>
        </section>

        {/* 3. Biography & Résumé Section (Combined Connect Block) */}
         <div id="connect">
          <section 
            id="about" 
            className="max-w-6xl mx-auto px-6 pt-4 pb-12 md:pt-5 md:pb-16 border-t"
            style={{ borderColor: isLightActive ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)' }}
          >
            <div className="space-y-8 md:space-y-10">
              {/* Header */}
              <div className="space-y-4">
                <span className="font-mono text-xs uppercase tracking-[0.3em] opacity-40">
                  / EXPERIENCE /
                </span>
                <h2 className="font-young text-2xl md:text-4xl font-normal tracking-tight normal-case leading-tight mt-1">
                  {portfolioData.about.philosophyHeadline}
                </h2>
              </div>

              {/* Biography Text */}
              <div className="font-mono text-xs uppercase tracking-[0.18em] leading-relaxed opacity-70 font-normal space-y-6 max-w-3xl">
                <p>{portfolioData.about.biography}</p>
              </div>

              {/* Handcrafted Résumé List */}
              <div className="space-y-6 pt-2">
                <div className="flex items-center justify-between gap-4 border-b border-current border-opacity-15 pb-4">
                  <div />
                  <a 
                    href="https://www.linkedin.com/in/andrewlwilcox/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-full border border-current font-mono text-[0.62rem] tracking-wider uppercase opacity-80 hover:opacity-100 hover:scale-[1.03] transition-all flex items-center space-x-1.5 focus:outline-none shrink-0"
                  >
                    <Linkedin className="w-3 h-3" />
                    <span>LinkedIn</span>
                  </a>
                </div>
                <div className="divide-y divide-current divide-opacity-10 border-b border-current border-opacity-10">
                  {[
                    {
                      role: "Creative Director",
                      company: "OpenAI",
                      location: "SAN FRANCISCO, CA",
                      years: "OCT 2025 — PRESENT",
                      desc: "FOCUSED ON BRAND AND PRODUCT LAUNCH WORK STREAMS. MOVING FAST AND EXPERIMENTING."
                    },
                    {
                      role: "Creative Director",
                      company: "Airbnb",
                      location: "SAN FRANCISCO, CA",
                      years: "JAN 2025 — MAY 2025",
                      desc: "PARTNERED WITH CREATIVE LEADERSHIP AT AIRBNB TO LAUNCH AIRBNB EXPERIENCES— THE MOST SIGNIFICANT PRODUCT RELEASE IN THE COMPANY'S HISTORY AT THAT TIME."
                    },
                    {
                      role: "Creative Director, Blue Studio",
                      company: "IBM",
                      location: "NEW YORK, NY",
                      years: "MAR 2024 — DEC 2024",
                      desc: "WORKED ON LAUNCH CREATIVE AND DESIGN FOR IBM'S COLLECTION OF LIGHTWEIGHT BUSINESS-FOCUSED AI MODELS."
                    },
                    {
                      role: "Creative Director, Brand Studio",
                      company: "Google",
                      location: "SEATTLE, WA",
                      years: "NOV 2022 — FEB 2024",
                      desc: "WORKED ON LAUNCH CREATIVE FOR GOOGLE'S EXPANSION INTO GENERATIVE AI AND CYBERSECURITY INITIATIVES- WHAT BECAME “GEMINI.”"
                    },
                    {
                      role: "Creative Director, Emerging Devices",
                      company: "Amazon",
                      location: "SEATTLE, WA",
                      years: "DEC 2019 — FEB 2022",
                      desc: "CO-BUILT THE AMAZON HALO BRAND FROM INCEPTION, DESIGNING BRAND POSITIONING, PRODUCT FILMS, AND GLOBAL LAUNCH CAMPAIGNS."
                    },
                    {
                      role: "Assoc. Creative Director, Echo & Alexa",
                      company: "Amazon",
                      location: "SEATTLE, WA",
                      years: "AUG 2017 — DEC 2019",
                      desc: "LED THE CREATIVE LAUNCHES FOR MULTIPLE ECHO GENERATIONS AND SPEARHEADED INTERNATIONAL ALEXA EXPANSION INTO KEY GLOBAL MARKETS."
                    },
                    {
                      role: "Senior Art Director",
                      company: "Droga5",
                      location: "NEW YORK, NY",
                      years: "SEP 2012 — SEP 2015",
                      desc: "CRAFTED AWARD-WINNING CAMPAIGNS AND BRAND EXPERIENCES FOR PREMIER CLIENTS INCLUDING MOTOROLA, HARRY'S, AND HENNESSY."
                    },
                    {
                      role: "Art Director",
                      company: "Wieden + Kennedy",
                      location: "PORTLAND, OR",
                      years: "FEB 2011 — SEP 2012",
                      desc: "DEVELOPED CREATIVE CAMPAIGNS FOR ICONIC GLOBAL BRANDS INCLUDING NIKE AND TARGET, AS WELL AS PRO-BONO WORK FOR ECO-TRUST."
                    },
                    {
                      role: "Junior Art Director",
                      company: "Wieden + Kennedy",
                      location: "SHANGHAI, CHINA",
                      years: "OCT 2008 — FEB 2011",
                      desc: "ART DIRECTION FOR NIKE, UMBRO AND LEVI'S FOR THE CHINA MARKET."
                    }
                  ].map((item, i) => (
                    <div 
                      key={i}
                      className="py-2 flex flex-col space-y-0.5 transition-all duration-300 cursor-default"
                      style={{
                        opacity: hoveredExperienceIndex === null ? 1 : hoveredExperienceIndex === i ? 1 : 0.3
                      }}
                      onMouseEnter={() => setHoveredExperienceIndex(i)}
                      onMouseLeave={() => setHoveredExperienceIndex(null)}
                    >
                      <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-2">
                        {/* Title at the top, larger and bold, in young serif */}
                        <h4 className="font-young text-sm md:text-base font-bold leading-tight normal-case">
                          {item.role} — {item.company}
                        </h4>
                        
                        {/* Dates to the right, in narrow typeface, same font size (text-xs) */}
                        <div className="font-mono text-xs tracking-[0.18em] uppercase opacity-75 shrink-0">
                          {item.years}
                        </div>
                      </div>
                      
                      {/* Underneath: location of the client in narrow typeface */}
                      <div className="font-mono text-xs tracking-[0.18em] uppercase opacity-80">
                        {item.location}
                      </div>
                      
                      {/* Summary description in narrow typeface, same font size (text-xs) - runs continuously with no max-w constraints */}
                      <p className="font-mono text-xs tracking-[0.18em] uppercase opacity-50 leading-relaxed font-light w-full">
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

      </main>

      {/* -------------------------------------------------------------------------
          CASE STUDY DETAILED FRAMELESS FLOATING OVERLAY (Overhauled Immersive Layout)
          ------------------------------------------------------------------------- */}
      <AnimatePresence>
        {selectedCaseStudy && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onScroll={(e) => setModalScrollY(e.currentTarget.scrollTop)}
            onClick={() => setSelectedCaseStudyImageIndex(null)}
            onTouchStart={handleModalTouchStart}
            onTouchEnd={handleModalTouchEnd}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl overflow-y-auto"
          >
            {/* Minimalist, absolute "Close" [X] button top right that glides smoothly */}
            <motion.div 
              animate={{ y: modalScrollY }}
              transition={{ type: "spring", stiffness: 60, damping: 15, mass: 0.7 }}
              className="absolute top-6 right-6 z-[60]"
            >
              <button 
                onClick={closeCaseStudy}
                className="p-3 text-stone-300 hover:text-white rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:scale-110 focus:outline-none shadow-lg backdrop-blur-sm"
                title="Close overlay"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>

            {/* Layout width constrained to exactly match the main index layout */}
            <div className="max-w-6xl w-full mx-auto px-4 md:px-8 pt-24 pb-32">
              
              {/* Header Details: Typography kept at top, perfectly left-aligned */}
              <div className="border-b border-white/10 pb-8 mb-12 space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span 
                    className="font-mono text-[0.62rem] tracking-widest bg-white/10 border border-white/10 px-2.5 py-1 rounded uppercase animate-pulse"
                    style={{ color: selectedCaseStudy.hoverBgColor }}
                  >
                    {selectedCaseStudy.category}
                  </span>
                </div>

                <h2 className="text-4xl md:text-7xl font-normal font-young text-white tracking-tight leading-none">
                  {getProjectDisplayTitle(selectedCaseStudy)}
                </h2>
              </div>

              {/* Media layout flow stacks below description, matching standard layout */}
              <div className="space-y-16">
                
                {/* 2. New Hero Image & Strategy Block */}
                <div className="relative w-full aspect-[16/5] min-h-[150px] md:min-h-[220px] rounded-none overflow-hidden bg-zinc-950 shadow-2xl">
                  <img 
                    src={selectedCaseStudy.hoverGifUrl || (selectedCaseStudy.gallery_images && selectedCaseStudy.gallery_images[0]) || (selectedCaseStudy.images && selectedCaseStudy.images[0]) || ''} 
                    alt={`${selectedCaseStudy.title} Strategy Backing`} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover select-none pointer-events-none"
                  />
                  {/* Subtle CSS dark gradient scrim overlay for perfect text legibility */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/85 pointer-events-none" />
                  {/* Large white typography overlay without text drop shadows */}
                  <div className="absolute inset-0 flex items-center justify-start p-6 md:p-12 pl-0 md:pl-0 text-left pointer-events-none">
                    <h3 className="font-young text-2xl sm:text-3xl md:text-7xl text-white tracking-tight leading-tight md:leading-none max-w-5xl font-normal normal-case">
                      {getProjectStrategyLine(selectedCaseStudy.id)}
                    </h3>
                  </div>
                </div>

                {/* 3. Project Description: Directly underneath the hero image block */}
                {selectedCaseStudy.overview && (
                  <div className="text-left max-w-4xl space-y-4">
                    <h4 className="text-xs font-sans tracking-widest uppercase text-zinc-500 mb-4">
                      THE OBJECTIVE
                    </h4>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] leading-relaxed max-w-3xl pr-4 md:pr-16 text-white opacity-100 md:opacity-70 md:transition-colors md:duration-300 cursor-default md:hover:text-white md:hover:opacity-100">
                      {selectedCaseStudy.overview}
                    </p>
                  </div>
                )}

                {/* 4. Primary Video: Rendered directly below the serif description block */}
                {selectedCaseStudy.videos && selectedCaseStudy.videos.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 pb-2 border-b border-white/5">
                      <span className="h-[1px] w-8 bg-white/20"></span>
                      <h4 className="text-xs font-sans tracking-widest uppercase text-zinc-500 mb-4">
                        MAIN FILM
                      </h4>
                    </div>

                    {(() => {
                      const embedUrl = getVimeoEmbedUrl(selectedCaseStudy.videos[0]);
                      if (!embedUrl) return null;
                      return (
                        <div className="space-y-3">
                          <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl">
                            <iframe
                               src={embedUrl}
                               className="absolute inset-0 w-full h-full border-0"
                               allow="autoplay; fullscreen; picture-in-picture"
                               allowFullScreen
                               title={`${selectedCaseStudy.title} Primary Video`}
                            />
                          </div>

                          {/* 5. NEW: video_caption text directly below primary video */}
                          {selectedCaseStudy.video_caption && (
                            <p className="font-mono text-xs uppercase tracking-[0.18em] leading-relaxed max-w-3xl pr-4 md:pr-16 text-white opacity-100 md:opacity-70 md:transition-colors md:duration-300 cursor-default md:hover:text-white md:hover:opacity-100">
                              {selectedCaseStudy.video_caption}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* 6. Results Text: Directly below the primary video and caption */}
                {selectedCaseStudy.results && (
                  <div 
                    className="border-l-2 pl-6 py-2 max-w-4xl space-y-4"
                    style={{ borderColor: selectedCaseStudy.hoverBgColor }}
                  >
                    <h4 className="text-xs font-sans tracking-widest uppercase text-zinc-500 mb-4">
                      OUTCOMES
                    </h4>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] leading-relaxed max-w-3xl pr-4 md:pr-16 text-white opacity-100 md:opacity-70 md:transition-colors md:duration-300 cursor-default md:hover:text-white md:hover:opacity-100">
                      {selectedCaseStudy.results}
                    </p>
                  </div>
                )}

                {/* 7. Multiple Video Logic: Render all additional videos directly below Results */}
                {selectedCaseStudy.videos && selectedCaseStudy.videos.length > 1 && (
                  <div className="space-y-12">
                    <div className="flex items-center space-x-3 pb-2 border-b border-white/5">
                      <span className="h-[1px] w-8 bg-white/20"></span>
                      <h4 className="text-xs font-sans tracking-widest uppercase text-zinc-500 mb-4">
                        ADDITIONAL VIDEO
                      </h4>
                    </div>
                    <div className="flex flex-col gap-y-12">
                      {selectedCaseStudy.videos.slice(1).map((videoUrl: string, idx: number) => {
                        const embedUrl = getVimeoEmbedUrl(videoUrl);
                        if (!embedUrl) return null;
                        return (
                          <div 
                            key={`video-add-${idx}`} 
                            className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl transition-all"
                          >
                            <iframe
                              src={embedUrl}
                              className="absolute inset-0 w-full h-full border-0"
                              allow="autoplay; fullscreen; picture-in-picture"
                              allowFullScreen
                              title={`${selectedCaseStudy.title} Video ${idx + 2}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 8. Multicolumn immersive Responsive interaction grid */}
                {((selectedCaseStudy.gallery_images && selectedCaseStudy.gallery_images.length > 0) || (selectedCaseStudy.images && selectedCaseStudy.images.length > 0)) && (
                  <div className="space-y-12">
                    <div className="flex items-center space-x-3 pb-4 border-b border-white/5">
                      <span className="h-[1px] w-8 bg-white/20"></span>
                      <h4 className="text-xs font-sans tracking-widest uppercase text-zinc-500 mb-4">
                        CAMPAIGN IMAGERY
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                      {(selectedCaseStudy.gallery_images || selectedCaseStudy.images).slice(0, 18).map((imgUrl: string, idx: number) => (
                        <MagneticImage3D 
                           key={`img-${idx}`}
                           src={imgUrl}
                           alt={`${selectedCaseStudy.title} Interactive Visual ${idx + 1}`}
                           isHovered={hoveredCaseStudyImageIndex === idx}
                           isAnyHovered={hoveredCaseStudyImageIndex !== null}
                           isSelected={selectedCaseStudyImageIndex === idx}
                           onHoverStart={() => setHoveredCaseStudyImageIndex(idx)}
                           onHoverEnd={() => setHoveredCaseStudyImageIndex(null)}
                           onSelect={() => setSelectedCaseStudyImageIndex(idx)}
                        />
                      ))}
                    </div>
                  </div>
                )}

              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -------------------------------------------------------------------------
          MODERN MINIMAL HUMBLE FOOTER
          ------------------------------------------------------------------------- */}
      <footer 
        className="max-w-6xl mx-auto px-6 py-12 border-t flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-[0.62rem] uppercase tracking-widest text-stone-500 mt-16"
        style={{ 
          borderColor: isLightActive ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'
        }}
      >
        <div className="flex items-center space-x-2">
          <span className="font-semibold" style={{ color: isLightActive ? '#0a0a0c' : '#ffffff' }}>
            {portfolioData.global.name}
          </span>
          <span className="opacity-40">—</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
        <div className="text-left md:text-right leading-relaxed">
          IF YOU'RE READING THIS I APPRECIATE YOUR ATTENTION TO DETAIL. WE SHOULD WORK TOGETHER.
        </div>
      </footer>

    </div>
  );
}
