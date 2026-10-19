        gsap.registerPlugin(ScrollTrigger);
        gsap.from('header', { duration: 0.6, opacity: 0, y: -30, ease: 'power3.out' });
        gsap.from('.service-hero', { duration: 0.8, opacity: 0, y: 30, ease: 'power2.out' });
        gsap.from('.service-block', { scrollTrigger: { trigger: '.services-list', start: 'top 88%' }, opacity: 0, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' });
        gsap.from('.value-card', { scrollTrigger: { trigger: '.values-grid', start: 'top 88%' }, opacity: 0, y: 25, duration: 0.5, stagger: 0.1, ease: 'power2.out' });
        gsap.from('.cta-big', { scrollTrigger: { trigger: '.cta-big', start: 'top 90%' }, opacity: 0, y: 30, duration: 0.7, ease: 'power2.out' });
    
