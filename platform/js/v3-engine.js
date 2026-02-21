/**
 * V3 Interaction Engine — Cretaceous AI
 *
 * Consolidates: redesign.js + premium-animations.js + inline <script>
 * Removes all duplicates. Single source of truth for:
 *   - Page load orchestration
 *   - Scroll-triggered reveals & counters
 *   - Card effects (tilt, glow, mouse tracking)
 *   - Magnetic buttons
 *   - Custom cursor (desktop)
 *   - Navigation (scroll spy, mobile menu)
 *   - Smooth scroll anchors
 *   - Scenario tabs
 *   - Wage calculator
 *   - Form handling
 *   - Reduced-motion respect
 */

(function () {
  'use strict';

  // ===========================================================
  // CONFIG
  // ===========================================================
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const CFG = {
    reveal: { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
    counter: {
      duration: 2000,
      ease: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    },
    magnetic: { strength: 0.3, radius: 100 },
    cursor: { lerp: 0.15, enabled: isDesktop && !prefersReducedMotion },
    tilt: { max: 8, scale: 1.02, perspective: 1000 }
  };

  // ===========================================================
  // 1. PAGE LOAD ORCHESTRATION
  // ===========================================================
  function initPageLoad() {
    const loader = document.querySelector('.page-loader');

    window.addEventListener('load', () => {
      setTimeout(() => {
        if (loader) loader.classList.add('loaded');
        triggerHeroAnimation();
      }, 300);
    });

    // Fallback
    setTimeout(() => {
      if (loader && !loader.classList.contains('loaded')) {
        loader.classList.add('loaded');
        triggerHeroAnimation();
      }
    }, 3000);
  }

  function triggerHeroAnimation() {
    // data-delay elements
    document.querySelectorAll('.hero [data-delay], .smartbi-hero [data-delay]').forEach((el, i) => {
      const delay = parseInt(el.dataset.delay || i + 1) * 100;
      setTimeout(() => el.classList.add('anim-active'), delay);
    });

    // anim-fade-up / anim-scale-in
    document.querySelectorAll(
      '.hero .anim-fade-up, .hero .anim-scale-in, .smartbi-hero .anim-fade-up, .smartbi-hero .anim-scale-in'
    ).forEach((el, i) => {
      setTimeout(() => el.classList.add('anim-active'), i * 80 + 200);
    });
  }

  // ===========================================================
  // 2. SCROLL-TRIGGERED REVEALS (single observer, no duplicates)
  // ===========================================================
  function initScrollReveals() {
    const selector = [
      '.reveal', '.reveal-blur', '.reveal-left', '.reveal-right', '.reveal-stagger',
      '.dimension-card', '.solution-card', '.pricing-card', '.scenario-card', '.case-card',
      '.feature-card', '.bento-item',
      'section:not(.hero) .h2', 'section:not(.hero) .display',
      '.grid-2 > *', '.grid-3 > *', '.grid-4 > *', '.comparison-grid > *'
    ].join(', ');

    const elements = document.querySelectorAll(selector);
    if (!elements.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        // Stagger delay for grid children
        const parent = entry.target.parentElement;
        if (parent && /\bgrid-(2|3|4)\b|comparison-grid/.test(parent.className)) {
          const idx = Array.from(parent.children).indexOf(entry.target);
          entry.target.style.transitionDelay = `${idx * 100}ms`;
        }

        entry.target.classList.add('revealed', 'visible');

        // Trigger counters within this element
        entry.target.querySelectorAll('.counter:not(.animated)').forEach(c => {
          c.classList.add('animated');
          animateCounter(c);
        });

        observer.unobserve(entry.target);
      });
    }, {
      threshold: CFG.reveal.threshold,
      rootMargin: CFG.reveal.rootMargin
    });

    elements.forEach(el => {
      if (![
        'reveal', 'reveal-blur', 'reveal-left', 'reveal-right', 'reveal-stagger'
      ].some(c => el.classList.contains(c))) {
        el.classList.add('reveal');
      }
      observer.observe(el);
    });

    // Also observe hero stats separately for counters
    const heroStats = document.querySelector('.hero-stats');
    if (heroStats) {
      const statsObs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll('.counter:not(.animated)').forEach(c => {
              c.classList.add('animated');
              animateCounter(c);
            });
            statsObs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });
      statsObs.observe(heroStats);
    }
  }

  // ===========================================================
  // 3. COUNTER ANIMATION (single implementation with easing)
  // ===========================================================
  function animateCounter(el) {
    const target = parseInt(el.dataset.target || el.dataset.countTo || el.textContent) || 0;
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const startTime = performance.now();

    el.classList.add('counting');

    function tick(now) {
      const progress = Math.min((now - startTime) / CFG.counter.duration, 1);
      const eased = CFG.counter.ease(progress);
      el.textContent = prefix + Math.round(eased * target).toLocaleString() + suffix;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.classList.remove('counting');
        el.textContent = prefix + target.toLocaleString() + suffix;
      }
    }
    requestAnimationFrame(tick);
  }

  // ===========================================================
  // 4. CARD EFFECTS (tilt, glow tracking, spotlight)
  // ===========================================================
  function initCardEffects() {
    if (isMobile) return;

    // 4a. 3D tilt on feature/solution/bento cards
    document.querySelectorAll('.feature-card, .solution-card, .bento-item').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const rx = ((y - cy) / cy) * CFG.tilt.max;
        const ry = ((cx - x) / cx) * CFG.tilt.max;

        card.style.transform =
          `perspective(${CFG.tilt.perspective}px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-8px) scale(${CFG.tilt.scale})`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform =
          `perspective(${CFG.tilt.perspective}px) rotateX(0) rotateY(0) translateY(0) scale(1)`;
      });
    });

    // 4b. Mouse-follow glow on premium cards
    document.querySelectorAll(
      '.card-premium, .dimension-card, .solution-card, .pricing-card, .scenario-card, .glow-cursor'
    ).forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
        card.style.setProperty('--mouse-y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
      });
    });

    // 4c. Dimension card dot patterns + spotlight
    document.querySelectorAll('.dimension-card').forEach(card => {
      if (!card.querySelector('.dot-pattern')) {
        const dot = document.createElement('div');
        dot.className = 'dot-pattern';
        card.appendChild(dot);
      }
    });
  }

  // ===========================================================
  // 5. MAGNETIC BUTTONS
  // ===========================================================
  function initMagneticButtons() {
    if (isMobile) return;

    document.querySelectorAll('.btn-magnetic, .btn-primary, .btn-accent').forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        const dist = Math.sqrt(x * x + y * y);

        if (dist < CFG.magnetic.radius) {
          const pull = (1 - dist / CFG.magnetic.radius) * CFG.magnetic.strength;
          btn.style.transform = `translate(${x * pull}px, ${y * pull}px)`;
          const inner = btn.querySelector('.btn-text, span');
          if (inner) inner.style.transform = `translate(${x * pull * 0.5}px, ${y * pull * 0.5}px)`;
        }
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
        const inner = btn.querySelector('.btn-text, span');
        if (inner) inner.style.transform = '';
      });
    });
  }

  // ===========================================================
  // 6. CUSTOM CURSOR (desktop only)
  // ===========================================================
  function initCustomCursor() {
    if (!CFG.cursor.enabled) return;

    const cursor = document.createElement('div');
    cursor.className = 'custom-cursor';
    document.body.appendChild(cursor);

    let targetX = 0, targetY = 0, currentX = 0, currentY = 0;

    document.addEventListener('mousemove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
    });

    function loop() {
      currentX += (targetX - currentX) * CFG.cursor.lerp;
      currentY += (targetY - currentY) * CFG.cursor.lerp;
      cursor.style.left = `${currentX}px`;
      cursor.style.top = `${currentY}px`;
      requestAnimationFrame(loop);
    }
    loop();

    // Hover states
    document.querySelectorAll(
      'a, button, .btn, .nav-link, .scenario-tab, input, textarea, .clickable'
    ).forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
    });

    document.addEventListener('mousedown', () => cursor.classList.add('clicking'));
    document.addEventListener('mouseup', () => cursor.classList.remove('clicking'));
  }

  // ===========================================================
  // 7. SPOTLIGHT CURSOR (hero/page-level glow)
  // ===========================================================
  function initSpotlight() {
    if (isMobile) return;

    const spotlight = document.getElementById('spotlight');
    if (!spotlight) return;

    let mouseX = 0, mouseY = 0, spotX = 0, spotY = 0;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      spotlight.classList.add('active');
    });

    document.addEventListener('mouseleave', () => spotlight.classList.remove('active'));

    function tick() {
      spotX += (mouseX - spotX) * 0.1;
      spotY += (mouseY - spotY) * 0.1;
      spotlight.style.left = spotX + 'px';
      spotlight.style.top = spotY + 'px';
      requestAnimationFrame(tick);
    }
    tick();
  }

  // ===========================================================
  // 8. PARALLAX
  // ===========================================================
  function initParallax() {
    if (prefersReducedMotion) return;
    const els = document.querySelectorAll('[data-parallax]');
    if (!els.length) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          els.forEach(el => {
            const speed = el.dataset.parallax === 'slow' ? 0.02 :
                          el.dataset.parallax === 'medium' ? 0.05 : 0.1;
            el.style.transform = `translateY(${scrollY * speed}px)`;
          });
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  // ===========================================================
  // 9. NAVIGATION (scroll spy + scroll class)
  // ===========================================================
  function initNavigation() {
    const nav = document.querySelector('.nav');
    if (!nav) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          nav.classList.toggle('scrolled', window.scrollY > 100);
          ticking = false;
        });
        ticking = true;
      }
    });

    // Scroll spy — highlight active nav link
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');

    if (sections.length && navLinks.length) {
      window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
          if (window.scrollY >= section.offsetTop - 120) {
            current = section.getAttribute('id');
          }
        });
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === '#' + current);
        });
      });
    }
  }

  // ===========================================================
  // 10. SMOOTH SCROLL FOR ANCHOR LINKS
  // ===========================================================
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;

        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          const navH = document.querySelector('.nav')?.offsetHeight || 0;
          window.scrollTo({
            top: target.getBoundingClientRect().top + window.scrollY - navH - 20,
            behavior: 'smooth'
          });
        }
      });
    });
  }

  // ===========================================================
  // 11. SCENARIO TABS (single implementation)
  // ===========================================================
  function initScenarioTabs() {
    const tabs = document.querySelectorAll('.scenario-tab');
    const panels = document.querySelectorAll('.scenario-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', function () {
        const name = this.dataset.tab;

        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));

        this.classList.add('active');
        const panel = document.getElementById('panel-' + name);
        if (panel) {
          panel.classList.add('active');
          // Re-trigger reveal animation for cards
          panel.querySelectorAll('.scenario-card, .case-card').forEach((card, i) => {
            card.style.transitionDelay = `${i * 100}ms`;
            card.classList.remove('revealed');
            requestAnimationFrame(() => card.classList.add('revealed'));
          });

          // Support old class-based reveal
          panel.querySelectorAll('.reveal-hidden').forEach(el => {
            el.classList.remove('reveal-hidden');
            el.classList.add('reveal-visible');
          });
        }
      });
    });
  }

  // Global function for onclick handlers in HTML
  window.switchScenarioTab = function (tabName) {
    const tab = document.querySelector(`.scenario-tab[data-tab="${tabName}"]`);
    if (tab) tab.click();
  };

  // ===========================================================
  // 12. WAGE CALCULATOR
  // ===========================================================
  let currentMode = 'basic';
  const BASE_WAGE = 100;

  window.selectMode = function (mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-card').forEach(card => {
      card.classList.toggle('active', card.dataset.mode === mode);
    });
    window.calculateWageRealtime();
  };

  window.calculateWageRealtime = function () {
    const input = document.getElementById('piece-count');
    if (!input) return;
    const count = parseInt(input.value) || 0;

    let pieceWage = 0;
    let breakdownHTML = '';

    if (currentMode === 'basic') {
      pieceWage = count * 0.5;
      if (count > 0) {
        breakdownHTML = `<div class="breakdown-line"><span class="calc">${count} &times; &yen;0.5</span><span class="result">= &yen;${pieceWage.toFixed(2)}</span></div>`;
      }
    } else {
      const t1 = Math.min(count, 300);
      const t2 = Math.min(Math.max(count - 300, 0), 100);
      const t3 = Math.max(count - 400, 0);
      const w1 = t1 * 0.4, w2 = t2 * 0.5, w3 = t3 * 0.6;
      pieceWage = w1 + w2 + w3;

      if (count > 0) {
        const lines = [];
        if (t1 > 0) lines.push(`<div class="breakdown-line"><span class="calc">${t1} &times; &yen;0.4 (基础档)</span><span class="result">= &yen;${w1.toFixed(2)}</span></div>`);
        if (t2 > 0) lines.push(`<div class="breakdown-line"><span class="calc">${t2} &times; &yen;0.5 (进阶档)</span><span class="result">= &yen;${w2.toFixed(2)}</span></div>`);
        if (t3 > 0) lines.push(`<div class="breakdown-line"><span class="calc">${t3} &times; &yen;0.6 (高效档)</span><span class="result">= &yen;${w3.toFixed(2)}</span></div>`);
        breakdownHTML = lines.join('');
      }
    }

    const qualityBonus = count >= 300 ? 20 : 0;
    const total = BASE_WAGE + pieceWage + qualityBonus;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('wage-amount', '\u00A5' + pieceWage.toFixed(2));
    set('piece-wage', '\u00A5' + pieceWage.toFixed(2));
    set('quality-bonus', '\u00A5' + qualityBonus.toFixed(2));
    set('total-wage', '\u00A5' + total.toFixed(2));

    const bd = document.getElementById('breakdown-items');
    if (bd) bd.innerHTML = breakdownHTML || '<div class="breakdown-placeholder">输入件数后显示计算过程</div>';
  };

  // ===========================================================
  // 13. MOBILE MENU
  // ===========================================================
  window.toggleMobileMenu = function () {
    const menu = document.getElementById('mobileMenu');
    const btn = document.querySelector('.mobile-menu-btn');
    if (!menu || !btn) return;

    const menuIcon = btn.querySelector('.menu-icon');
    const closeIcon = btn.querySelector('.close-icon');

    menu.classList.toggle('active');
    const isOpen = menu.classList.contains('active');
    if (menuIcon) menuIcon.style.display = isOpen ? 'none' : 'block';
    if (closeIcon) closeIcon.style.display = isOpen ? 'block' : 'none';
  };

  window.closeMobileMenu = function () {
    const menu = document.getElementById('mobileMenu');
    const btn = document.querySelector('.mobile-menu-btn');
    if (!menu || !btn) return;

    const menuIcon = btn.querySelector('.menu-icon');
    const closeIcon = btn.querySelector('.close-icon');

    menu.classList.remove('active');
    if (menuIcon) menuIcon.style.display = 'block';
    if (closeIcon) closeIcon.style.display = 'none';
  };

  // ===========================================================
  // 14. FORM HANDLING
  // ===========================================================
  window.handleSubmit = function (e) {
    e.preventDefault();
    alert('感谢您的咨询！我们会在24小时内与您联系。');
    e.target.reset();
  };

  // ===========================================================
  // 15. SCROLL-TO HELPER
  // ===========================================================
  window.scrollTo_ = function (selector) {
    const el = document.querySelector(selector);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };
  // Keep the old global name for onclick="scrollTo('#section')" compat
  window.scrollToSection = window.scrollTo_;

  // ===========================================================
  // 16. TEXT SCRAMBLE (optional effect)
  // ===========================================================
  class TextScramble {
    constructor(el) {
      this.el = el;
      this.chars = '!<>-_\\/[]{}=+*^?#________';
      this.update = this.update.bind(this);
    }

    setText(newText) {
      const oldText = this.el.innerText;
      const length = Math.max(oldText.length, newText.length);
      const promise = new Promise(resolve => (this.resolve = resolve));
      this.queue = [];

      for (let i = 0; i < length; i++) {
        const from = oldText[i] || '';
        const to = newText[i] || '';
        const start = Math.floor(Math.random() * 20);
        const end = start + Math.floor(Math.random() * 20);
        this.queue.push({ from, to, start, end });
      }

      cancelAnimationFrame(this.frameRequest);
      this.frame = 0;
      this.update();
      return promise;
    }

    update() {
      let output = '';
      let complete = 0;

      for (let i = 0; i < this.queue.length; i++) {
        let { from, to, start, end, char } = this.queue[i];

        if (this.frame >= end) {
          complete++;
          output += to;
        } else if (this.frame >= start) {
          if (!char || Math.random() < 0.28) {
            char = this.chars[Math.floor(Math.random() * this.chars.length)];
            this.queue[i].char = char;
          }
          output += `<span class="scramble-char">${char}</span>`;
        } else {
          output += from;
        }
      }

      this.el.innerHTML = output;
      if (complete === this.queue.length) {
        this.resolve();
      } else {
        this.frameRequest = requestAnimationFrame(this.update);
        this.frame++;
      }
    }
  }
  window.TextScramble = TextScramble;

  // ===========================================================
  // 17. REDUCED MOTION RESPECT
  // ===========================================================
  function applyReducedMotion() {
    if (!prefersReducedMotion) return;
    document.querySelectorAll(
      '.hero-aurora, .particles-container, .meteor, .float-element, .film-grain'
    ).forEach(el => (el.style.display = 'none'));
  }

  // ===========================================================
  // INIT
  // ===========================================================
  function init() {
    initPageLoad();
    initScrollReveals();
    initCardEffects();
    initMagneticButtons();
    initParallax();
    initNavigation();
    initSmoothScroll();
    initScenarioTabs();
    initSpotlight();
    applyReducedMotion();

    // Custom cursor after slight delay
    setTimeout(initCustomCursor, 500);

    // Wage calculator
    window.calculateWageRealtime();

    console.log('%c[V3 Engine] Initialized', 'color: #C45C26; font-weight: bold;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
