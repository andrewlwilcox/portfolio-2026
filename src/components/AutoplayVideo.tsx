import React, { useRef, useEffect } from 'react';

interface AutoplayVideoProps {
  src: string;
  title: string;
}

export default function AutoplayVideo({ src, title }: AutoplayVideoProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!iframe.contentWindow) return;
          try {
            if (entry.isIntersecting) {
              iframe.contentWindow.postMessage(JSON.stringify({ method: 'play' }), '*');
            } else {
              iframe.contentWindow.postMessage(JSON.stringify({ method: 'pause' }), '*');
            }
          } catch (e) {
            console.error('Error postMessage to iframe', e);
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(iframe);

    return () => {
      observer.unobserve(iframe);
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      className="absolute inset-0 w-full h-full border-none bg-black"
      style={{ backgroundColor: 'black', border: '0', outline: 'none' }}
      frameBorder="0"
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
      title={title}
    />
  );
}
