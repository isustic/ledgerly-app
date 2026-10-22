import { useState, useEffect, useCallback } from 'react';

interface UseResizableSidebarOptions {
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  storageKey: string;
}

interface UseResizableSidebarReturn {
  sidebarWidth: number;
  isDragging: boolean;
  dragHandleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
  };
}

export function useResizableSidebar({
  minWidth,
  maxWidth,
  defaultWidth,
  storageKey,
}: UseResizableSidebarOptions): UseResizableSidebarReturn {
  // Initialize width from localStorage to avoid flash of incorrect width
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    // SSR safety: only access localStorage on client
    if (typeof window === 'undefined') return defaultWidth;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to load sidebar width from localStorage:', error);
    }
    return defaultWidth;
  });

  const [isDragging, setIsDragging] = useState(false);

  // Handle mouse move during drag
  useEffect(() => {
    if (!isDragging) return;

    // Coalesce pointer moves to one state update per frame so a drag doesn't re-render the page on every pixel.
    let frame = 0;
    let pendingX: number | null = null;
    const applyPending = () => {
      frame = 0;
      if (pendingX === null) return;
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, pendingX));
      pendingX = null;
      setSidebarWidth(clampedWidth);
    };
    const schedule = (x: number) => {
      pendingX = x;
      if (!frame) frame = requestAnimationFrame(applyPending);
    };

    // Note: Using clientX directly works because sidebar is at left edge of viewport
    const handleMouseMove = (e: MouseEvent) => schedule(e.clientX);

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      schedule(touch.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, minWidth, maxWidth]);

  // Save to localStorage when width changes (and not dragging)
  // This optimization prevents excessive localStorage writes during drag
  useEffect(() => {
    if (!isDragging) {
      try {
        localStorage.setItem(storageKey, sidebarWidth.toString());
      } catch (error) {
        console.warn('Failed to save sidebar width to localStorage:', error);
      }
    }
  }, [sidebarWidth, isDragging, storageKey]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  return {
    sidebarWidth,
    isDragging,
    dragHandleProps: {
      onMouseDown: handleMouseDown,
      onTouchStart: handleTouchStart,
    },
  };
}