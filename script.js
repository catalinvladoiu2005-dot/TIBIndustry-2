/* ============================================================
   TibIndustry - script.js
   Animații și interacțiuni pentru întreg site-ul
   ============================================================ */

(function () {
    'use strict';

    const $  = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const onReady = (fn) => {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    };
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- inject CSS for the JS-added widgets ---------- */
    const css = `
        .scroll-progress {
            position: fixed; top: 0; left: 0; height: 2px; width: 0%;
            background: hsl(var(--terracotta));
            z-index: 9999; transition: width .08s linear;
        }
        .back-to-top {
            position: fixed; right: 22px; bottom: 22px;
            width: 44px; height: 44px; border-radius: 0;
            background: hsl(var(--foreground));
            color: hsl(var(--background)); border: none; cursor: pointer;
            box-shadow: 0 10px 28px -14px hsl(30 20% 18% / .4);
            display: flex; align-items: center; justify-content: center;
            opacity: 0; transform: translateY(16px);
            transition: opacity .35s ease, transform .35s ease, background .35s ease;
            z-index: 998; pointer-events: none;
        }
        .back-to-top.show { opacity: 1; transform: translateY(0); pointer-events: auto; }
        .back-to-top:hover { background: hsl(var(--terracotta)); transform: translateY(-3px); }
        .back-to-top svg { width: 18px; height: 18px; }

        .toast-stack {
            position: fixed; right: 18px; top: 92px;
            display: flex; flex-direction: column; gap: 10px;
            z-index: 9998; pointer-events: none;
        }
        .toast {
            background: hsl(var(--background));
            color: hsl(var(--foreground));
            border: 1px solid hsl(var(--border-c));
            border-left: 2px solid hsl(var(--terracotta));
            border-radius: 0; padding: 13px 18px 13px 15px;
            box-shadow: 0 18px 44px -22px hsl(30 20% 18% / .3);
            font-size: 13.5px; font-weight: 500;
            min-width: 200px; max-width: 320px;
            display: flex; align-items: center; gap: 10px;
            transform: translateX(120%); opacity: 0;
            transition: transform .5s cubic-bezier(.22,1,.36,1), opacity .35s;
        }
        .toast.show { transform: translateX(0); opacity: 1; }
        .toast .toast-icon { font-size: 17px; }

        .ripple {
            position: absolute; border-radius: 50%;
            transform: scale(0); animation: ripple-anim .6s ease-out;
            background: hsl(var(--background) / .35); pointer-events: none;
        }
        @keyframes ripple-anim { to { transform: scale(4); opacity: 0; } }

        .reveal { opacity: 0; transform: translateY(28px); transition: opacity .8s cubic-bezier(.25,.46,.45,.94), transform .8s cubic-bezier(.25,.46,.45,.94); }
        .reveal.in-view { opacity: 1; transform: translateY(0); }

        @media (prefers-reduced-motion: reduce) {
            .reveal, .division-card, .portfolio-item, .service-block, .value-card,
            .back-to-top, .toast, .scroll-progress { transition: none !important; animation: none !important; }
        }
    `;
    const styleEl = document.createElement('style');
    styleEl.id = 'tibindustry-anim-styles';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    /* ============================================================
       Scroll progress bar
       ============================================================ */
    function initScrollProgress() {
        const bar = document.createElement('div');
        bar.className = 'scroll-progress';
        document.body.appendChild(bar);
        const update = () => {
            const h = document.documentElement;
            const scrolled = h.scrollTop / (h.scrollHeight - h.clientHeight) || 0;
            bar.style.width = (scrolled * 100) + '%';
        };
        window.addEventListener('scroll', update, { passive: true });
        update();
    }

    /* ============================================================
       Back-to-top button
       ============================================================ */
    function initBackToTop() {
        const btn = document.createElement('button');
        btn.className = 'back-to-top';
        btn.setAttribute('aria-label', 'Sus');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
        document.body.appendChild(btn);

        window.addEventListener('scroll', () => {
            btn.classList.toggle('show', window.scrollY > 400);
        }, { passive: true });

        btn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
        });
    }

    /* ============================================================
       Animated counters for hero stats
       ============================================================ */
    function animateCounter(el, target, suffix = '', duration = 1400) {
        if (prefersReducedMotion) { el.textContent = target.toLocaleString('ro-RO') + suffix; return; }
        const start = performance.now();
        const isFloat = target % 1 !== 0;
        function frame(now) {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            const val = target * eased;
            el.textContent = (isFloat ? val.toFixed(1) : Math.floor(val).toLocaleString('ro-RO')) + suffix;
            if (t < 1) requestAnimationFrame(frame);
            else el.textContent = (isFloat ? target.toFixed(1) : target.toLocaleString('ro-RO')) + suffix;
        }
        requestAnimationFrame(frame);
    }

    function initStatCounters() {
        const stats = $$('.hero-stat strong, .stat-value');
        if (!stats.length) return;
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                const raw = e.target.textContent.trim();
                const num = parseFloat(raw.replace(/[^\d,.]/g, '').replace(',', '.'));
                if (isNaN(num)) return;
                const suffix = raw.replace(/[\d,. ]/g, '');
                e.target.textContent = '0' + suffix;
                animateCounter(e.target, num, suffix);
                io.unobserve(e.target);
            });
        }, { threshold: 0.4 });
        stats.forEach(s => io.observe(s));
    }

    /* ============================================================
       Ripple effect for buttons
       ============================================================ */
    function initRipples() {
        const selector = '.hero-btn, .promo-btn, .header-cta, .contact-submit, .search-btn';
        document.addEventListener('click', (e) => {
            const btn = e.target.closest(selector);
            if (!btn || prefersReducedMotion) return;
            const rect = btn.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
            ripple.style.top  = (e.clientY - rect.top  - size / 2) + 'px';
            const cs = getComputedStyle(btn);
            if (cs.position === 'static') btn.style.position = 'relative';
            btn.style.overflow = 'hidden';
            btn.appendChild(ripple);
            setTimeout(() => ripple.remove(), 650);
        });
    }

    /* ============================================================
       Reveal on scroll
       ============================================================ */
    function initReveal() {
        const targets = $$('.intro-brand, .trust-item, .section-header, .promo-banner');
        targets.forEach(el => el.classList.add('reveal'));

        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry, i) => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const delay = Math.min(i * 60, 240);
                    setTimeout(() => el.classList.add('in-view'), delay);
                    io.unobserve(el);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
        targets.forEach(t => io.observe(t));
    }

    /* ============================================================
       Header shrink/blur on scroll
       ============================================================ */
    function initHeaderScroll() {
        const header = $('header');
        if (!header) return;
        const update = () => header.classList.toggle('scrolled', window.scrollY > 30);
        window.addEventListener('scroll', update, { passive: true });
        update();
    }

    /* ============================================================
       Smooth scroll for in-page anchors
       ============================================================ */
    function initSmoothScroll() {
        document.addEventListener('click', (e) => {
            const a = e.target.closest('a[href^="#"]');
            if (!a) return;
            const id = a.getAttribute('href');
            if (id.length < 2) return;
            const target = document.querySelector(id);
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
        });
    }

    /* ============================================================
       Lazy image fade-in
       ============================================================ */
    function initImageFade() {
        $$('img').forEach(img => {
            if (img.complete && img.naturalHeight !== 0) return;
            img.style.opacity = '0';
            img.style.transition = 'opacity .5s ease';
            const reveal = () => { img.style.opacity = '1'; };
            img.addEventListener('load', reveal, { once: true });
            img.addEventListener('error', reveal, { once: true });
        });
    }

    /* ============================================================
       Language switcher — Google Translate cu UI custom
       ============================================================ */
    const LANG_KEY = 'tibindustry_lang';
    const LANG_NAMES = {
        ro: 'RO', en: 'EN', de: 'DE', fr: 'FR', it: 'IT', es: 'ES',
        hu: 'HU', pl: 'PL', ru: 'RU', uk: 'UK', ar: 'AR',
        'zh-CN': 'ZH', ja: 'JA', tr: 'TR'
    };
    // numele limbilor în limba lor proprie (rămân netraduse niciodată)
    const LANG_NATIVE = {
        ro: 'Română', en: 'English', de: 'Deutsch',
        fr: 'Français', it: 'Italiano', es: 'Español',
        hu: 'Magyar', pl: 'Polski', ru: 'Русский',
        uk: 'Українська', ar: 'العربية',
        'zh-CN': '中文', ja: '日本語', tr: 'Türkçe'
    };

    function restoreNativeLabels() {
        document.querySelectorAll('#langMenu a[data-lang]').forEach(a => {
            const code = a.dataset.lang;
            if (!LANG_NATIVE[code]) return;
            const flag = a.querySelector('.flag');
            const langCode = a.querySelector('.lang-code');
            if (flag && langCode) {
                a.innerHTML = '';
                a.appendChild(flag);
                a.appendChild(document.createTextNode(' ' + LANG_NATIVE[code] + ' '));
                a.appendChild(langCode);
            }
        });
    }

    function getCurrentLang() {
        const stored = localStorage.getItem(LANG_KEY);
        if (stored) return stored;
        const cookie = document.cookie.split(';').find(c => c.trim().startsWith('googtrans='));
        if (cookie) {
            const parts = cookie.split('=')[1].split('/');
            if (parts[2]) return parts[2];
        }
        return 'ro';
    }

    function setLanguageCookie(lang) {
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 1);
        const cookieValue = lang === 'ro' ? '' : '/ro/' + lang;
        const host = location.hostname;
        document.cookie = 'googtrans=' + cookieValue + ';path=/;expires=' + expires.toUTCString();
        if (host && host !== 'localhost') {
            document.cookie = 'googtrans=' + cookieValue + ';path=/;domain=' + host + ';expires=' + expires.toUTCString();
            if (host.split('.').length > 1) {
                const rootDomain = '.' + host.split('.').slice(-2).join('.');
                document.cookie = 'googtrans=' + cookieValue + ';path=/;domain=' + rootDomain + ';expires=' + expires.toUTCString();
            }
        }
    }

    function updateLangUI(lang) {
        const current = $('#langCurrent');
        if (current) current.textContent = LANG_NAMES[lang] || lang.toUpperCase();
        document.querySelectorAll('#langMenu a[data-lang]').forEach(a => {
            a.classList.toggle('active', a.dataset.lang === lang);
        });
    }

    function clearGoogTransCookie() {
        const host = location.hostname;
        const pastDate = 'Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'googtrans=;path=/;expires=' + pastDate;
        if (host && host !== 'localhost') {
            document.cookie = 'googtrans=;path=/;domain=' + host + ';expires=' + pastDate;
            if (host.split('.').length > 1) {
                const root = '.' + host.split('.').slice(-2).join('.');
                document.cookie = 'googtrans=;path=/;domain=' + root + ';expires=' + pastDate;
            }
        }
    }

    // ——— Tranziție „în trepte" la schimbarea limbii (stil killianherzer) ———
    const STAGGER_STEP = 35;   // ms între elemente
    const STAGGER_MAX  = 16;   // câte elemente animăm (cele vizibile)

    // Blocurile de text vizibile, în ordinea de sus în jos (fără header/footer/switcher)
    function getStaggerTargets() {
        const scope = document.querySelector('main') || document.body;
        const sel = 'h1, h2, h3, h4, h5, p, li, blockquote, .eyebrow, .service-eyebrow, .about-eyebrow, .job-tag';
        let els = Array.from(scope.querySelectorAll(sel)).filter(el => {
            if (el.closest('#langSwitcher, header, footer')) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.top < window.innerHeight + 300 && r.bottom > -100;
        });
        // elimină strămoșii care conțin alt target (evită animație dublă)
        els = els.filter(el => !els.some(o => o !== el && el.contains(o)));
        els.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        return els.slice(0, STAGGER_MAX);
    }

    // Iese: fiecare rând alunecă în sus + fade, în cascadă de sus în jos.
    function staggerOut(targets) {
        targets.forEach((el, i) => {
            el.style.willChange = 'opacity, transform';
            el.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
            el.style.transitionDelay = (i * STAGGER_STEP) + 'ms';
            el.style.opacity = '0';
            el.style.transform = 'translateY(-14px)';
        });
        return (targets.length * STAGGER_STEP) + 360;
    }

    // Intră: versiunea nouă vine de jos, în cascadă de sus în jos.
    function staggerIn(targets) {
        targets.forEach(el => {
            el.style.transition = 'none';
            el.style.opacity = '0';
            el.style.transform = 'translateY(16px)';
        });
        void document.body.offsetHeight; // forțează reflow ca să prindă starea de start
        targets.forEach((el, i) => {
            el.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
            el.style.transitionDelay = (i * STAGGER_STEP) + 'ms';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        });
        // curăță stilurile inline după ce se termină animația
        setTimeout(() => targets.forEach(el => {
            el.style.transition = '';
            el.style.transitionDelay = '';
            el.style.transform = '';
            el.style.opacity = '';
            el.style.willChange = '';
        }), (targets.length * STAGGER_STEP) + 600);
    }

    // Rulează callback DOAR după ce Google a terminat de rescris textul
    // (urmărim mutațiile din DOM; ne liniștim ~350ms după ultima).
    function whenSettled(cb) {
        let settleTimer, done = false;
        const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(settleTimer);
            clearTimeout(safety);
            obs.disconnect();
            cb();
        };
        const obs = new MutationObserver(() => {
            clearTimeout(settleTimer);
            settleTimer = setTimeout(finish, 350);
        });
        obs.observe(document.body, { childList: true, subtree: true, characterData: true });
        // dacă traducerea nu mișcă nimic vizibil, continuăm oricum
        settleTimer = setTimeout(finish, 900);
        // plasă de siguranță absolută
        const safety = setTimeout(finish, 3000);
    }

    function setLanguage(lang) {
        const current = getCurrentLang();
        if (current === lang) return;

        // persistă alegerea
        localStorage.setItem(LANG_KEY, lang);

        // UI imediat + închide meniul
        updateLangUI(lang);
        const menu = $('#langMenu');
        const btn = $('#langBtn');
        menu?.classList.remove('open');
        btn?.classList.remove('active');
        btn?.setAttribute('aria-expanded', 'false');

        // === Revenire la limba originală (ro) ===
        // Google Translate nu poate dez-traduce inline; șterg cookie + reload curat.
        // Facem întâi animația de ieșire, apoi reload (la load se animează intrarea).
        if (lang === 'ro') {
            clearGoogTransCookie();
            sessionStorage.setItem('tib_anim_in', '1'); // semnal pentru intrarea după reload
            if (prefersReducedMotion) { location.reload(); return; }
            const targets = getStaggerTargets();
            const out = staggerOut(targets);
            setTimeout(() => location.reload(), out + 120);
            return;
        }

        // === Tranziție inline către altă limbă ===
        setLanguageCookie(lang);

        // fără animație pentru cei cu „mișcare redusă"
        if (prefersReducedMotion) {
            const s = document.querySelector('.goog-te-combo');
            if (s) { s.value = lang; s.dispatchEvent(new Event('change')); }
            else { location.reload(); }
            return;
        }

        const targets = getStaggerTargets();
        const out = staggerOut(targets);

        const applyVia = (sel) => {
            // declanșează traducerea după ce textul a ieșit (e ascuns)
            setTimeout(() => {
                sel.value = lang;
                sel.dispatchEvent(new Event('change'));
                whenSettled(() => staggerIn(targets));
            }, out);
        };

        const sel = document.querySelector('.goog-te-combo');
        if (sel) {
            applyVia(sel);
            return;
        }

        // combo-ul Google nu e încă în DOM — așteaptă
        let tries = 0;
        const poll = setInterval(() => {
            const s = document.querySelector('.goog-te-combo');
            tries++;
            if (s) {
                clearInterval(poll);
                applyVia(s);
            } else if (tries > 50) {
                clearInterval(poll);
                // fallback: reload (cookie-ul deja e setat)
                location.reload();
            }
        }, 100);
    }

    function initLangSwitcher() {
        const switcher = $('#langSwitcher');
        if (!switcher) return;
        const btn = $('#langBtn');
        const menu = $('#langMenu');

        // exclude tot switcher-ul (+ descendenții) din traducerea Google
        // — altfel "Română"/"English"/"Deutsch" sunt traduse în limba activă
        switcher.setAttribute('translate', 'no');
        switcher.classList.add('notranslate');
        switcher.querySelectorAll('*').forEach(el => {
            el.setAttribute('translate', 'no');
            el.classList.add('notranslate');
        });

        // restaurează numele native (dacă Google a apucat să le traducă)
        restoreNativeLabels();
        // re-verifică după ce Google termină traducerea (poate suprascrie după)
        setTimeout(restoreNativeLabels, 800);
        setTimeout(restoreNativeLabels, 2000);

        // tranziție lină pe html pentru fade
        document.documentElement.style.willChange = 'opacity';

        const lang = getCurrentLang();
        updateLangUI(lang);

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = menu.classList.toggle('open');
            btn.classList.toggle('active', open);
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });

        document.addEventListener('click', (e) => {
            if (!switcher.contains(e.target)) {
                menu.classList.remove('open');
                btn.classList.remove('active');
                btn.setAttribute('aria-expanded', 'false');
            }
        });

        menu.querySelectorAll('a[data-lang]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.dataset.lang;
                if (target === 'all') {
                    // arată widget-ul Google complet pentru toate limbile
                    const sel = document.querySelector('.goog-te-combo');
                    if (sel) {
                        const combo = document.createElement('div');
                        combo.style.cssText = 'position:fixed;top:88px;right:24px;z-index:9999;background:hsl(var(--background));padding:1.1rem;border:1px solid hsl(var(--border-c));border-radius:0;box-shadow:0 24px 60px -30px hsl(30 20% 18% / .45);';
                        combo.innerHTML = '<div style="color:hsl(var(--terracotta));font-size:.62rem;letter-spacing:.24em;text-transform:uppercase;margin-bottom:.7rem;font-weight:600;">Selectează limba</div>';
                        combo.appendChild(sel.cloneNode(true));
                        const close = document.createElement('button');
                        close.textContent = '✕';
                        close.style.cssText = 'position:absolute;top:4px;right:8px;background:none;border:none;color:hsl(var(--muted-foreground));cursor:pointer;font-size:1rem;';
                        close.onclick = () => combo.remove();
                        combo.appendChild(close);
                        document.body.appendChild(combo);
                        combo.querySelector('select').addEventListener('change', function () {
                            setLanguage(this.value);
                        });
                    } else {
                        alert('Serviciul de traducere se încarcă, încearcă din nou în câteva secunde.');
                    }
                    return;
                }
                setLanguage(target);
            });
        });
    }

    function loadGoogleTranslate() {
        if (!$('#google_translate_element')) return;

        // La încărcare: animăm intrarea „în trepte" dacă pagina e tradusă
        // (Google rescrie textul) sau dacă tocmai am revenit la RO printr-un reload.
        const loadLang = getCurrentLang();
        const animInFlag = sessionStorage.getItem('tib_anim_in');
        sessionStorage.removeItem('tib_anim_in');
        if (!prefersReducedMotion && (loadLang !== 'ro' || animInFlag)) {
            const targets = getStaggerTargets();
            // ascunde textul cât timp se așază pagina (evită „saltul" RO→tradus)
            targets.forEach(el => {
                el.style.transition = 'none';
                el.style.opacity = '0';
                el.style.transform = 'translateY(16px)';
            });
            if (loadLang !== 'ro') {
                whenSettled(() => staggerIn(targets));   // așteaptă traducerea Google
            } else {
                requestAnimationFrame(() => staggerIn(targets)); // RO: nimic de tradus
            }
        }

        // callback global
        window.googleTranslateElementInit = function () {
            new window.google.translate.TranslateElement({
                pageLanguage: 'ro',
                autoDisplay: false
            }, 'google_translate_element');
        };
        // încarcă scriptul o singură dată
        if (!document.querySelector('script[src*="translate.google.com/translate_a/element.js"]')) {
            const s = document.createElement('script');
            s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
            s.async = true;
            document.head.appendChild(s);
        }
    }

    /* ============================================================
       Mobile nav toggle
       ============================================================ */
    function initNavToggle() {
        const toggle = $('#navToggle');
        const nav = $('#headerNav');
        if (!toggle || !nav) return;
        toggle.addEventListener('click', () => {
            const open = nav.classList.toggle('open');
            toggle.classList.toggle('active', open);
        });
        nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
            nav.classList.remove('open');
            toggle.classList.remove('active');
        }));
    }

    /* ============================================================
       FAQ accordion
       ============================================================ */
    function initFaq() {
        $$('.faq-item').forEach(item => {
            const q = item.querySelector('.faq-q');
            const a = item.querySelector('.faq-a');
            if (!q || !a) return;
            q.addEventListener('click', () => {
                const isOpen = item.classList.contains('open');
                $$('.faq-item').forEach(other => {
                    other.classList.remove('open');
                    const oa = other.querySelector('.faq-a');
                    if (oa) oa.style.maxHeight = null;
                });
                if (!isOpen) {
                    item.classList.add('open');
                    a.style.maxHeight = a.scrollHeight + 'px';
                }
            });
        });
    }

    /* ============================================================
       Interactive project rows (expand inline, no navigation)
       ============================================================ */
    function initProjects() {
        const items = $$('.portfolio-item').filter(it => it.querySelector('.pf-detail'));
        items.forEach(item => {
            const detail = item.querySelector('.pf-detail');
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');
            const toggle = () => {
                const isOpen = item.classList.contains('open');
                items.forEach(other => {
                    other.classList.remove('open');
                    const d = other.querySelector('.pf-detail');
                    if (d) d.style.maxHeight = null;
                });
                if (!isOpen) {
                    item.classList.add('open');
                    detail.style.maxHeight = detail.scrollHeight + 'px';
                }
            };
            item.addEventListener('click', toggle);
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
            });
        });
    }

    /* ============================================================
       Work list — preview imagine ce urmărește cursorul
       ============================================================ */
    function initWorkList() {
        const list = document.querySelector('.work-list');
        const preview = document.querySelector('.work-preview');
        if (!list || !preview) return;
        const img = preview.querySelector('img');
        const rows = $$('.work-row', list);
        if (!img || !rows.length) return;

        // doar pe dispozitive cu mouse fin (nu pe touch)
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

        let tx = 0, ty = 0, cx = 0, cy = 0, scale = 0.85, targetScale = 0.85;
        let raf = null, primed = false;
        const lerp = (a, b, n) => a + (b - a) * n;

        function loop() {
            cx = lerp(cx, tx, 0.18);
            cy = lerp(cy, ty, 0.18);
            scale = lerp(scale, targetScale, 0.18);
            preview.style.transform =
                `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(${scale})`;
            raf = requestAnimationFrame(loop);
        }

        list.addEventListener('mouseenter', (e) => {
            tx = e.clientX; ty = e.clientY;
            if (!primed) { cx = tx; cy = ty; primed = true; }
            if (!raf) loop();
        });
        list.addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; });
        list.addEventListener('mouseleave', () => {
            targetScale = 0.85;
            preview.classList.remove('is-visible');
        });

        rows.forEach(row => {
            row.addEventListener('mouseenter', () => {
                const src = row.dataset.img;
                if (src && img.getAttribute('src') !== src) img.src = src;
                targetScale = 1;
                preview.classList.add('is-visible');
            });
        });
    }

    /* ============================================================
       Boot
       ============================================================ */
    onReady(() => {
        initScrollProgress();
        initBackToTop();
        initStatCounters();
        initRipples();
        initReveal();
        initHeaderScroll();
        initSmoothScroll();
        initImageFade();
        initLangSwitcher();
        initNavToggle();
        initFaq();
        initProjects();
        initWorkList();
        loadGoogleTranslate();
    });
})();
