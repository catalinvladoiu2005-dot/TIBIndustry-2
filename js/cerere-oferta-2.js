        /* ---- Atașamente: drag & drop, mai multe fișiere (aceleași limite ca în send.php) ---- */
        (function () {
            const dz = document.getElementById('attDropzone');
            const input = document.getElementById('attInput');
            const list = document.getElementById('attList');
            const errEl = document.getElementById('attError');
            if (!dz || !input) return;

            const MAX_FILE = 50 * 1024 * 1024;
            const MAX_TOTAL = 100 * 1024 * 1024;
            const MAX_COUNT = 10;
            const ALLOWED = ['pdf','doc','docx','odt','rtf','txt','jpg','jpeg','png','webp','gif','heic','dwg','dxf'];
            let files = [];

            function fmtSize(b) {
                if (b < 1024) return b + ' B';
                if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
                return (b / 1024 / 1024).toFixed(1) + ' MB';
            }
            function showError(msg) { errEl.textContent = msg; errEl.hidden = false; }
            function clearError() { errEl.hidden = true; errEl.textContent = ''; }

            // sincronizează lista cu <input>, ca FormData(form) să includă fișierele
            function sync() {
                try {
                    const dt = new DataTransfer();
                    files.forEach(function (f) { dt.items.add(f); });
                    input.files = dt.files;
                } catch (e) { /* browsere foarte vechi fără DataTransfer */ }
            }

            function render() {
                list.textContent = '';
                files.forEach(function (f, i) {
                    const li = document.createElement('li');
                    li.className = 'att-item';
                    const name = document.createElement('span');
                    name.style.flex = '1';
                    name.style.overflowWrap = 'anywhere';
                    name.textContent = f.name;
                    const size = document.createElement('span');
                    size.style.opacity = '0.6';
                    size.textContent = fmtSize(f.size);
                    const rm = document.createElement('button');
                    rm.type = 'button';
                    rm.textContent = '✕';
                    rm.setAttribute('aria-label', 'Șterge ' + f.name);
                    rm.style.cssText = 'background:none;border:none;cursor:pointer;font-size:1rem;color:inherit;';
                    rm.addEventListener('click', function () {
                        files.splice(i, 1);
                        clearError();
                        sync();
                        render();
                    });
                    li.appendChild(name); li.appendChild(size); li.appendChild(rm);
                    list.appendChild(li);
                });
                dz.classList.toggle('has-file', files.length > 0);
            }

            function addFiles(incoming) {
                clearError();
                const problems = [];
                Array.prototype.forEach.call(incoming, function (f) {
                    const ext = (f.name.split('.').pop() || '').toLowerCase();
                    const dup = files.some(function (x) { return x.name === f.name && x.size === f.size && x.lastModified === f.lastModified; });
                    const total = files.reduce(function (s, x) { return s + x.size; }, 0);
                    if (dup) return;
                    if (ALLOWED.indexOf(ext) === -1) { problems.push('„' + f.name + '": format neacceptat.'); return; }
                    if (f.size > MAX_FILE) { problems.push('„' + f.name + '" depășește 50 MB.'); return; }
                    if (files.length >= MAX_COUNT) { problems.push('Maximum ' + MAX_COUNT + ' fișiere.'); return; }
                    if (total + f.size > MAX_TOTAL) { problems.push('Total maxim 100 MB.'); return; }
                    files.push(f);
                });
                sync();
                render();
                if (problems.length) showError(problems.join(' '));
            }

            dz.addEventListener('click', function (e) { if (e.target !== input) input.click(); });
            dz.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
            });
            input.addEventListener('change', function () { addFiles(input.files); });
            ['dragenter', 'dragover'].forEach(function (ev) {
                dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('is-dragover'); });
            });
            ['dragleave', 'drop'].forEach(function (ev) {
                dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('is-dragover'); });
            });
            dz.addEventListener('drop', function (e) { if (e.dataTransfer) addFiles(e.dataTransfer.files); });

            // folosit după trimitere reușită
            window.resetQuoteAttachments = function () { files = []; clearError(); sync(); render(); };
        })();

        /* ---- Trimitere formular → send.php (type "oferta") ---- */
        document.getElementById('submitQuote').addEventListener('click', (e) => {
            const form = document.getElementById('quoteForm');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            window.sendForm({
                form: form, type: 'oferta', btn: e.currentTarget,
                msgEl: document.getElementById('quoteMsg'),
                onDone: (ok) => { if (ok && window.resetQuoteAttachments) window.resetQuoteAttachments(); }
            });
        });

        gsap.from('header', { duration: 0.6, opacity: 0, y: -30, ease: 'power3.out' });
        gsap.from('.about-hero', { duration: 0.7, opacity: 0, y: 20, ease: 'power2.out' });
        gsap.from('.contact-layout', { duration: 0.8, opacity: 0, y: 30, delay: 0.2, ease: 'power2.out' });
