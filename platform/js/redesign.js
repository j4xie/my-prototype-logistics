/* 
 * High-Tech Interaction Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Mouse Tracking for Glow Effects
    const glowContainers = document.querySelectorAll('.glow-cursor');

    document.addEventListener('mousemove', (e) => {
        glowContainers.forEach(container => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            container.style.setProperty('--mouse-x', `${x}px`);
            container.style.setProperty('--mouse-y', `${y}px`);
        });
    });

    // 2. 3D Tilt Effect
    const tiltContainers = document.querySelectorAll('.bento-item');

    tiltContainers.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
        });
    });

    // 3. Scroll Reveal Logic
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal-active');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.bento-item, .hero-content').forEach(el => {
        el.classList.add('reveal-hidden');
        observer.observe(el);
    });

    // 4. Stat Counter Animation
    const statsSelector = document.querySelectorAll('.counter');
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = parseInt(entry.target.getAttribute('data-target'));
                const duration = 2000;
                let startTimestamp = null;
                const step = (timestamp) => {
                    if (!startTimestamp) startTimestamp = timestamp;
                    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                    entry.target.innerText = Math.floor(progress * target);
                    if (progress < 1) {
                        window.requestAnimationFrame(step);
                    }
                };
                window.requestAnimationFrame(step);
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    statsSelector.forEach(stat => statsObserver.observe(stat));
});
