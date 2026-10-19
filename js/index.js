        gsap.registerPlugin(ScrollTrigger);

        gsap.from("header", { duration: 0.6, opacity: 0, y: -30, ease: "power3.out" });
        gsap.from(".hero-badge", { duration: 0.5, opacity: 0, y: 20, delay: 0.2, ease: "power2.out" });
        gsap.from(".hero-title", { duration: 0.8, opacity: 0, y: 30, delay: 0.3, ease: "power3.out" });
        gsap.from(".hero-sub", { duration: 0.6, opacity: 0, y: 20, delay: 0.5, ease: "power2.out" });
        gsap.from(".hero-ctas", { duration: 0.6, opacity: 0, y: 20, delay: 0.65, ease: "power2.out" });
        gsap.from(".hero-metric", { duration: 0.6, opacity: 0, y: 20, delay: 0.8, stagger: 0.1, ease: "power2.out" });

        gsap.utils.toArray(".lux-section-head, .intro-brand").forEach(el => {
            gsap.from(el, { scrollTrigger: { trigger: el, start: "top 88%" }, opacity: 0, y: 30, duration: 0.7, ease: "power2.out" });
        });

        gsap.from(".division-card", { scrollTrigger: { trigger: ".divisions-grid", start: "top 85%" }, opacity: 0, y: 40, duration: 0.7, stagger: 0.12, ease: "power2.out" });
        gsap.from(".work-row", { scrollTrigger: { trigger: ".work-list", start: "top 88%" }, opacity: 0, y: 30, duration: 0.6, stagger: 0.1, ease: "power2.out", clearProps: "opacity" });
        gsap.from(".signature-item", { scrollTrigger: { trigger: ".signature-list", start: "top 85%" }, opacity: 0, y: 40, duration: 0.9, stagger: 0.15, ease: "power2.out" });
        gsap.from(".testimonial-card", { scrollTrigger: { trigger: ".testimonials-grid", start: "top 88%" }, opacity: 0, y: 25, duration: 0.6, stagger: 0.12, ease: "power2.out" });
        gsap.from(".press-logo", { scrollTrigger: { trigger: ".press-row", start: "top 92%" }, opacity: 0, y: 15, duration: 0.5, stagger: 0.08, ease: "power2.out" });
        gsap.from(".client-logo", { scrollTrigger: { trigger: ".clients-grid", start: "top 90%" }, opacity: 0, y: 15, duration: 0.45, stagger: 0.06, ease: "power2.out" });
        gsap.from(".process-step", { scrollTrigger: { trigger: ".process-grid", start: "top 88%" }, opacity: 0, y: 30, duration: 0.6, stagger: 0.15, ease: "power2.out" });
        gsap.from(".faq-item", { scrollTrigger: { trigger: ".faq-list", start: "top 88%" }, opacity: 0, y: 20, duration: 0.5, stagger: 0.08, ease: "power2.out" });
    
