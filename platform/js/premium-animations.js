/**
 * Premium Animation Engine for Cretaceous AI
 *
 * Features:
 * - Orchestrated page load sequence
 * - IntersectionObserver-based scroll reveals
 * - Magnetic button effects
 * - Smooth parallax scrolling
 * - Enhanced counter animations
 * - Custom cursor (desktop only)
 */

(function() {
    'use strict';

    // =====================================================
    // CONFIGURATION
    // =====================================================
    const CONFIG = {
        // Scroll reveal settings
        revealThreshold: 0.15,
        revealRootMargin: '0px 0px -80px 0px',

        // Counter animation
        counterDuration: 2000,
        counterEasing: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,

        // Magnetic button settings
        magneticStrength: 0.3,
        magneticRadius: 100,

        // Parallax
        parallaxEnabled: true,

        // Custom cursor
        cursorEnabled: window.matchMedia('(hover: hover) and (pointer: fine)').matches
    };

    // =====================================================
    // PAGE LOAD ORCHESTRATION
    // =====================================================
    function initPageLoad() {
        const loader = document.querySelector('.page-loader');

        // Add load class after content is ready
        window.addEventListener('load', () => {
            // Small delay for visual impact
            setTimeout(() => {
                if (loader) {
                    loader.classList.add('loaded');
                }

                // Trigger hero animations
                triggerHeroAnimation();
            }, 300);
        });

        // Fallback if load takes too long
        setTimeout(() => {
            if (loader && !loader.classList.contains('loaded')) {
                loader.classList.add('loaded');
                triggerHeroAnimation();
            }
        }, 3000);
    }

    function triggerHeroAnimation() {
        // Support both .hero and .smartbi-hero selectors
        const heroElements = document.querySelectorAll('.hero [data-delay], .smartbi-hero [data-delay]');

        heroElements.forEach((el, index) => {
            const delay = parseInt(el.dataset.delay || index + 1) * 100;

            setTimeout(() => {
                el.classList.add('anim-active');
            }, delay);
        });

        // Also trigger any anim-fade-up elements in hero (support both class names)
        document.querySelectorAll('.hero .anim-fade-up, .hero .anim-scale-in, .smartbi-hero .anim-fade-up, .smartbi-hero .anim-scale-in').forEach((el, i) => {
            setTimeout(() => {
                el.classList.add('anim-active');
            }, i * 80 + 200);
        });
    }

    // =====================================================
    // SCROLL-TRIGGERED REVEALS
    // =====================================================
    function initScrollReveals() {
        const revealElements = document.querySelectorAll(
            '.reveal, .reveal-blur, .reveal-left, .reveal-right, .reveal-stagger, ' +
            '.dimension-card, .solution-card, .pricing-card, .scenario-card, .case-card, ' +
            '.section:not(.hero) .h2, .section:not(.hero) .display, ' +
            '.grid-2 > *, .grid-3 > *, .grid-4 > *, .comparison-grid > *'
        );

        if (!revealElements.length) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Add stagger delay for grid items
                    const parent = entry.target.parentElement;
                    if (parent && (parent.classList.contains('grid-2') ||
                                   parent.classList.contains('grid-3') ||
                                   parent.classList.contains('grid-4') ||
                                   parent.classList.contains('comparison-grid'))) {
                        const siblings = Array.from(parent.children);
                        const index = siblings.indexOf(entry.target);
                        entry.target.style.transitionDelay = `${index * 100}ms`;
                    }

                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: CONFIG.revealThreshold,
            rootMargin: CONFIG.revealRootMargin
        });

        revealElements.forEach(el => {
            // Add reveal class if not already present
            if (!el.classList.contains('reveal') &&
                !el.classList.contains('reveal-blur') &&
                !el.classList.contains('reveal-left') &&
                !el.classList.contains('reveal-right') &&
                !el.classList.contains('reveal-stagger')) {
                el.classList.add('reveal');
            }
            observer.observe(el);
        });
    }

    // =====================================================
    // ENHANCED COUNTER ANIMATION
    // =====================================================
    function initCounters() {
        const counters = document.querySelectorAll('.counter, [data-count-to]');
        if (!counters.length) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(counter => observer.observe(counter));
    }

    function animateCounter(element) {
        const target = parseInt(element.dataset.target || element.dataset.countTo || element.textContent);
        const suffix = element.dataset.suffix || '';
        const prefix = element.dataset.prefix || '';
        const duration = CONFIG.counterDuration;
        const startTime = performance.now();

        element.classList.add('counting');

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = CONFIG.counterEasing(progress);
            const current = Math.round(easedProgress * target);

            element.textContent = prefix + current.toLocaleString() + suffix;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.classList.remove('counting');
                element.textContent = prefix + target.toLocaleString() + suffix;
            }
        }

        requestAnimationFrame(update);
    }

    // =====================================================
    // MAGNETIC BUTTON EFFECT
    // =====================================================
    function initMagneticButtons() {
        const buttons = document.querySelectorAll('.btn-magnetic, .btn-primary, .btn-accent');

        buttons.forEach(btn => {
            btn.addEventListener('mousemove', (e) => {
                const rect = btn.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;

                const distance = Math.sqrt(x * x + y * y);

                if (distance < CONFIG.magneticRadius) {
                    const pull = (1 - distance / CONFIG.magneticRadius) * CONFIG.magneticStrength;
                    btn.style.transform = `translate(${x * pull}px, ${y * pull}px)`;

                    const btnText = btn.querySelector('.btn-text, span');
                    if (btnText) {
                        btnText.style.transform = `translate(${x * pull * 0.5}px, ${y * pull * 0.5}px)`;
                    }
                }
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.transform = '';
                const btnText = btn.querySelector('.btn-text, span');
                if (btnText) {
                    btnText.style.transform = '';
                }
            });
        });
    }

    // =====================================================
    // CARD MOUSE TRACKING
    // =====================================================
    function initCardMouseTracking() {
        const cards = document.querySelectorAll(
            '.card-premium, .dimension-card, .solution-card, .pricing-card, .scenario-card'
        );

        cards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;

                card.style.setProperty('--mouse-x', `${x}%`);
                card.style.setProperty('--mouse-y', `${y}%`);
            });
        });
    }

    // =====================================================
    // SMOOTH PARALLAX
    // =====================================================
    function initParallax() {
        if (!CONFIG.parallaxEnabled) return;

        const parallaxElements = document.querySelectorAll('[data-parallax]');
        if (!parallaxElements.length) return;

        let ticking = false;

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    updateParallax(parallaxElements);
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    function updateParallax(elements) {
        const scrollY = window.scrollY;

        elements.forEach(el => {
            const speed = el.dataset.parallax === 'slow' ? 0.02 :
                         el.dataset.parallax === 'medium' ? 0.05 : 0.1;
            const yPos = scrollY * speed;
            el.style.transform = `translateY(${yPos}px)`;
        });
    }

    // =====================================================
    // NAVIGATION SCROLL EFFECT
    // =====================================================
    function initNavScroll() {
        const nav = document.querySelector('.nav');
        if (!nav) return;

        let lastScrollY = 0;
        let ticking = false;

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    if (window.scrollY > 100) {
                        nav.classList.add('scrolled');
                    } else {
                        nav.classList.remove('scrolled');
                    }
                    lastScrollY = window.scrollY;
                    ticking = false;
                });
                ticking = true;
            }
        });

        // Update active nav link based on scroll position
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.nav-link[href^="#"]');

        if (sections.length && navLinks.length) {
            const sectionObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const id = entry.target.id;
                        navLinks.forEach(link => {
                            link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                        });
                    }
                });
            }, { threshold: 0.3 });

            sections.forEach(section => sectionObserver.observe(section));
        }
    }

    // =====================================================
    // CUSTOM CURSOR (DESKTOP ONLY)
    // =====================================================
    function initCustomCursor() {
        if (!CONFIG.cursorEnabled) return;

        const cursor = document.createElement('div');
        cursor.className = 'custom-cursor';
        document.body.appendChild(cursor);

        let cursorX = 0, cursorY = 0;
        let currentX = 0, currentY = 0;

        document.addEventListener('mousemove', (e) => {
            cursorX = e.clientX;
            cursorY = e.clientY;
        });

        // Smooth cursor follow
        function animateCursor() {
            const dx = cursorX - currentX;
            const dy = cursorY - currentY;

            currentX += dx * 0.15;
            currentY += dy * 0.15;

            cursor.style.left = `${currentX}px`;
            cursor.style.top = `${currentY}px`;

            requestAnimationFrame(animateCursor);
        }
        animateCursor();

        // Hover effects
        const interactiveElements = document.querySelectorAll(
            'a, button, .btn, .nav-link, .scenario-tab, input, textarea, .clickable'
        );

        interactiveElements.forEach(el => {
            el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
            el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
        });

        // Click effect
        document.addEventListener('mousedown', () => cursor.classList.add('clicking'));
        document.addEventListener('mouseup', () => cursor.classList.remove('clicking'));
    }

    // =====================================================
    // SMOOTH SCROLL FOR ANCHOR LINKS
    // =====================================================
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                if (href === '#') return;

                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    const navHeight = document.querySelector('.nav')?.offsetHeight || 0;
                    const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight - 20;

                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    // =====================================================
    // SCENARIO TABS ENHANCEMENT
    // =====================================================
    function initScenarioTabs() {
        const tabs = document.querySelectorAll('.scenario-tab');
        const panels = document.querySelectorAll('.scenario-panel');

        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const targetTab = this.dataset.tab;

                // Update active states
                tabs.forEach(t => t.classList.remove('active'));
                panels.forEach(p => p.classList.remove('active'));

                this.classList.add('active');
                const targetPanel = document.getElementById(`panel-${targetTab}`);
                if (targetPanel) {
                    targetPanel.classList.add('active');

                    // Trigger reveal animations for cards in the panel
                    targetPanel.querySelectorAll('.scenario-card, .case-card').forEach((card, i) => {
                        card.style.transitionDelay = `${i * 100}ms`;
                        // Remove and re-add revealed class to trigger animation
                        card.classList.remove('revealed');
                        requestAnimationFrame(() => {
                            card.classList.add('revealed');
                        });
                    });
                }
            });
        });
    }

    // =====================================================
    // TEXT SCRAMBLE EFFECT (OPTIONAL)
    // =====================================================
    class TextScramble {
        constructor(el) {
            this.el = el;
            this.chars = '!<>-_\\/[]{}=+*^?#________';
            this.update = this.update.bind(this);
        }

        setText(newText) {
            const oldText = this.el.innerText;
            const length = Math.max(oldText.length, newText.length);
            const promise = new Promise(resolve => this.resolve = resolve);
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

            for (let i = 0, n = this.queue.length; i < n; i++) {
                let { from, to, start, end, char } = this.queue[i];

                if (this.frame >= end) {
                    complete++;
                    output += to;
                } else if (this.frame >= start) {
                    if (!char || Math.random() < 0.28) {
                        char = this.randomChar();
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

        randomChar() {
            return this.chars[Math.floor(Math.random() * this.chars.length)];
        }
    }

    // Expose TextScramble globally if needed
    window.TextScramble = TextScramble;

    // =====================================================
    // INITIALIZE EVERYTHING
    // =====================================================
    function init() {
        initPageLoad();
        initScrollReveals();
        initCounters();
        initMagneticButtons();
        initCardMouseTracking();
        initParallax();
        initNavScroll();
        initSmoothScroll();
        initScenarioTabs();

        // Initialize custom cursor after a small delay
        setTimeout(initCustomCursor, 500);

        // Log initialization
        console.log('%c[Premium Animations] Initialized', 'color: #C45C26; font-weight: bold;');
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
