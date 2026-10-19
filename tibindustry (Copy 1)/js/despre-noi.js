        gsap.registerPlugin(ScrollTrigger);
        gsap.from('header', { duration: 0.6, opacity: 0, y: -30, ease: 'power3.out' });
        gsap.from('.about-hero', { duration: 0.8, opacity: 0, y: 30, ease: 'power2.out' });
        gsap.from('.about-grid', { scrollTrigger: { trigger: '.about-grid', start: 'top 88%' }, opacity: 0, y: 30, duration: 0.7, ease: 'power2.out' });
        gsap.from('.group-overview', { scrollTrigger: { trigger: '.group-overview', start: 'top 90%' }, opacity: 0, y: 25, duration: 0.6, ease: 'power2.out' });
        gsap.from('.entity-card', { scrollTrigger: { trigger: '.entities-grid', start: 'top 88%' }, opacity: 0, y: 25, duration: 0.5, stagger: 0.1, ease: 'power2.out' });
        gsap.from('.timeline li', { scrollTrigger: { trigger: '.group-cols', start: 'top 85%' }, opacity: 0, x: -20, duration: 0.45, stagger: 0.08, ease: 'power2.out' });
        gsap.from('.value-card', { scrollTrigger: { trigger: '.values-grid', start: 'top 88%' }, opacity: 0, y: 25, duration: 0.5, stagger: 0.1, ease: 'power2.out' });
        gsap.from('.stat-item', { scrollTrigger: { trigger: '.stats-strip', start: 'top 90%' }, opacity: 0, y: 20, duration: 0.5, stagger: 0.08, ease: 'power2.out' });
        gsap.from('.cta-big', { scrollTrigger: { trigger: '.cta-big', start: 'top 90%' }, opacity: 0, y: 30, duration: 0.7, ease: 'power2.out' });
    
