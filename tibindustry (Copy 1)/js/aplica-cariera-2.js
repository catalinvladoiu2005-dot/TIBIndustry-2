        /* ---- Preselectează postul din parametrul ?post= ---- */
        (function () {
            const params = new URLSearchParams(window.location.search);
            const post = params.get('post');
            if (!post) return;
            const sel = document.getElementById('positionSelect');
            const wanted = decodeURIComponent(post).trim().toLowerCase();
            for (const opt of sel.options) {
                if (opt.value.trim().toLowerCase() === wanted) { sel.value = opt.value; break; }
            }
        })();

        /* ---- Drag & drop CV upload ---- */
        (function () {
            const dz = document.getElementById('cvDropzone');
            const input = document.getElementById('cvInput');
            const empty = document.getElementById('cvEmpty');
            const fileBox = document.getElementById('cvFile');
            const nameEl = document.getElementById('cvFileName');
            const sizeEl = document.getElementById('cvFileSize');
            const removeBtn = document.getElementById('cvRemove');
            const errEl = document.getElementById('cvError');

            const MAX = 30 * 1024 * 1024; // 30 MB
            const ALLOWED = ['pdf','doc','docx','odt','rtf','txt','jpg','jpeg','png'];

            function fmtSize(b) {
                if (b < 1024) return b + ' B';
                if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
                return (b / 1024 / 1024).toFixed(1) + ' MB';
            }
            function showError(msg) { errEl.textContent = msg; errEl.hidden = false; }
            function clearError() { errEl.hidden = true; errEl.textContent = ''; }

            function handleFile(file) {
                clearError();
                if (!file) return;
                const ext = (file.name.split('.').pop() || '').toLowerCase();
                if (ALLOWED.indexOf(ext) === -1) {
                    showError('Format neacceptat. Folosește PDF, DOC, DOCX, JPG sau PNG.');
                    resetFile();
                    return;
                }
                if (file.size > MAX) {
                    showError('Fișierul depășește 30 MB. Te rugăm comprimă-l sau trimite un PDF.');
                    resetFile();
                    return;
                }
                // sincronizează fișierul cu input-ul (pentru drag & drop)
                try {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    input.files = dt.files;
                } catch (e) { /* unele browsere vechi nu suportă DataTransfer */ }

                nameEl.textContent = file.name;
                sizeEl.textContent = fmtSize(file.size);
                empty.hidden = true;
                fileBox.hidden = false;
                dz.classList.add('has-file');
            }

            function resetFile() {
                input.value = '';
                empty.hidden = false;
                fileBox.hidden = true;
                dz.classList.remove('has-file');
            }

            dz.addEventListener('click', function (e) {
                if (e.target === removeBtn) return;
                input.click();
            });
            dz.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
            });
            input.addEventListener('change', function () { handleFile(input.files[0]); });

            removeBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                resetFile();
                clearError();
            });

            ['dragenter', 'dragover'].forEach(function (ev) {
                dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('is-dragover'); });
            });
            ['dragleave', 'dragend'].forEach(function (ev) {
                dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('is-dragover'); });
            });
            dz.addEventListener('drop', function (e) {
                e.preventDefault();
                dz.classList.remove('is-dragover');
                if (e.dataTransfer.files && e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
            });

            // previne deschiderea fișierului dacă e tras în afara zonei
            window.addEventListener('dragover', function (e) { e.preventDefault(); });
            window.addEventListener('drop', function (e) { e.preventDefault(); });
        })();

        document.getElementById('submitCareer').addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const form = document.getElementById('careerForm');
            const cv = document.getElementById('cvInput');
            if (!form.checkValidity()) { form.reportValidity(); return; }
            window.sendForm({
                form: form, type: 'cv', btn: btn,
                msgEl: document.getElementById('careerMsg'),
                onDone: (ok) => {
                    if (!ok) return;
                    document.getElementById('cvInput').value = '';
                    document.getElementById('cvEmpty').hidden = false;
                    document.getElementById('cvFile').hidden = true;
                    document.getElementById('cvDropzone').classList.remove('has-file');
                }
            });
        });

        gsap.registerPlugin(ScrollTrigger);
        gsap.from('header', { duration: 0.6, opacity: 0, y: -30, ease: 'power3.out' });
        gsap.from('.service-hero', { duration: 0.8, opacity: 0, y: 30, ease: 'power2.out' });
        gsap.from('.contact-layout', { scrollTrigger: { trigger: '.contact-layout', start: 'top 88%' }, opacity: 0, y: 30, duration: 0.7, ease: 'power2.out' });
    
