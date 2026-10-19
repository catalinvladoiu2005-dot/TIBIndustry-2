        document.getElementById('submitContact').addEventListener('click', (e) => {
            const form = document.getElementById('contactForm');
            if (!form.checkValidity()) { form.reportValidity(); return; }
            window.sendForm({
                form: form, type: 'contact', btn: e.currentTarget,
                msgEl: document.getElementById('contactMsg')
            });
        });

        gsap.from('header', { duration: 0.6, opacity: 0, y: -30, ease: 'power3.out' });
        gsap.from('.about-hero', { duration: 0.7, opacity: 0, y: 20, ease: 'power2.out' });
        gsap.from('.contact-layout', { duration: 0.8, opacity: 0, y: 30, delay: 0.2, ease: 'power2.out' });
    
