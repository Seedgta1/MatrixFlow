import React, { useEffect, useRef } from 'react';

const MatrixBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    // Characters to drop (Matrix-like + Alphanumeric)
    const chars = 'MATRIXFLOW0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const fontSize = 14;
    
    // Theme Colors (Indigo/Purple palette)
    const colors = ['#6366f1', '#818cf8', '#a855f7', '#c084fc', '#4f46e5'];

    // State for drops
    let columns = Math.ceil(width / fontSize);
    let drops: number[] = new Array(columns).fill(1);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      
      const newColumns = Math.ceil(width / fontSize);
      const newDrops = new Array(newColumns).fill(1);
      
      // Preserve existing drops where possible to avoid full reset
      for (let i = 0; i < Math.min(columns, newColumns); i++) {
        newDrops[i] = drops[i];
      }
      
      columns = newColumns;
      drops = newDrops;
    };

    window.addEventListener('resize', resize);
    resize(); // Initial sizing

    const draw = () => {
      // Semi-transparent black to create trail effect
      // Matches app bg color #000000
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)'; 
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars.charAt(Math.floor(Math.random() * chars.length));
        
        // Random color from our palette
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        // Reset drop to top randomly
        if (drops[i] * fontSize > height && Math.random() > 0.985) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 45);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 z-0 pointer-events-none opacity-20 mix-blend-screen"
    />
  );
};

export default MatrixBackground;