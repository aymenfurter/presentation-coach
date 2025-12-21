import { useState, useRef, useEffect, useCallback } from 'react';

interface UseDropdownReturn<T> {
  isOpen: boolean;
  selected: T | null;
  ref: React.RefObject<HTMLDivElement | null>;
  toggle: () => void;
  close: () => void;
  select: (item: T) => void;
  setSelected: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Hook for managing dropdown state with click-outside handling
 */
export function useDropdown<T>(initialValue: T | null = null): UseDropdownReturn<T> {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<T | null>(initialValue);
  const ref = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);
  const close = useCallback(() => setIsOpen(false), []);
  
  const select = useCallback((item: T) => {
    setSelected(item);
    setIsOpen(false);
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return { isOpen, selected, ref, toggle, close, select, setSelected };
}
