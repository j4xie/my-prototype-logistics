// responsive-helper.js

/**
 * Checks if the current viewport width is considered mobile.
 * This is a basic example; for more complex scenarios, consider using
 * window.matchMedia or a dedicated library.
 * Tailwind's default 'sm' breakpoint is 640px.
 */
export const isMobileView = (breakpoint = 640) => {
  if (typeof window !== 'undefined') {
    return window.innerWidth < breakpoint;
  }
  return false; // Default to false in SSR or non-browser environments
};

/**
 * Returns the current Tailwind-like breakpoint name.
 * This is a simplified example.
 */
export const getCurrentBreakpoint = () => {
  if (typeof window === 'undefined') {
    return 'ssr'; // Or handle as an error/unknown
  }

  const width = window.innerWidth;
  if (width < 640) return 'xs'; // Extra small, or mobile
  if (width < 768) return 'sm';
  if (width < 1024) return 'md';
  if (width < 1280) return 'lg';
  if (width < 1536) return 'xl';
  return '2xl';
};

// Add other responsive helper functions as needed, e.g., for:
// - Debouncing resize events
// - Dynamically loading components based on screen size
// - etc. 