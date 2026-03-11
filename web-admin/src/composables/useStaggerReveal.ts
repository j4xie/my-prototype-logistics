import { ref, watch, onUnmounted, type Ref } from 'vue';

/**
 * Stagger reveal composable — triggers CSS class on children sequentially
 * using IntersectionObserver + requestAnimationFrame for smooth "fade-in one by one" effect.
 *
 * Usage:
 *   const { containerRef } = useStaggerReveal({ stagger: 80, threshold: 0.1 });
 *   <div ref="containerRef" class="stagger-container"> ... children with .stagger-item ... </div>
 *
 * CSS (add to your component):
 *   .stagger-item { opacity: 0; transform: translateY(12px); transition: opacity 0.4s, transform 0.4s; }
 *   .stagger-item.revealed { opacity: 1; transform: translateY(0); }
 */
export function useStaggerReveal(options?: {
  /** Delay between each item reveal in ms (default: 80) */
  stagger?: number;
  /** IntersectionObserver threshold (default: 0.1) */
  threshold?: number;
  /** CSS selector for items within the container (default: '.stagger-item') */
  selector?: string;
}) {
  const stagger = options?.stagger ?? 80;
  const threshold = options?.threshold ?? 0.1;
  const selector = options?.selector ?? '.stagger-item';

  const containerRef: Ref<HTMLElement | undefined> = ref();
  let observer: IntersectionObserver | null = null;
  let revealed = false;

  function revealChildren(container: HTMLElement) {
    if (revealed) return;
    revealed = true;

    const items = container.querySelectorAll(selector);
    items.forEach((item, index) => {
      setTimeout(() => {
        requestAnimationFrame(() => {
          (item as HTMLElement).classList.add('revealed');
        });
      }, index * stagger);
    });
  }

  function startObserving(el: HTMLElement) {
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: reveal immediately
      revealChildren(el);
      return;
    }

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            revealChildren(entry.target as HTMLElement);
            observer?.unobserve(entry.target);
          }
        }
      },
      { threshold }
    );

    observer.observe(el);
  }

  // Watch for late-binding refs (e.g., v-else conditional rendering)
  // flush: 'post' ensures callback runs AFTER Vue DOM updates — required for template refs
  watch(containerRef, (el) => {
    if (el && !revealed) {
      observer?.disconnect();
      // Check if already visible — if so, reveal immediately instead of waiting for observer
      const rect = el.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (inView) {
        revealChildren(el);
      } else {
        startObserving(el);
      }
    }
  }, { flush: 'post' });

  onUnmounted(() => {
    observer?.disconnect();
    observer = null;
  });

  /** Manually reset and re-trigger the reveal (e.g., after data reload) */
  function reset() {
    revealed = false;
    if (containerRef.value) {
      const items = containerRef.value.querySelectorAll(selector);
      items.forEach((item) => {
        (item as HTMLElement).classList.remove('revealed');
      });
      // Re-observe
      observer?.disconnect();
      startObserving(containerRef.value);
    }
  }

  return { containerRef, reset };
}
