    (function () {
        var refStep = document.getElementById('refStep');
        var payStep = document.getElementById('payStep');
        var refInput = document.getElementById('refInput');
        var refMsg = document.getElementById('refMsg');
        var payMsg = document.getElementById('payMsg');
        var currentId = null;

        function money(v, cur) {
            return Number(v).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cur;
        }
        function esc(s) {
            return String(s == null ? '' : s)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }
        function setMsg(el, txt, ok) {
            el.textContent = txt;
            el.className = 'voucher-msg ' + (ok ? 'ok' : 'err');
        }

        function renderOffer(o) {
            currentId = o.id;
            refStep.hidden = true;
            payStep.hidden = false;

            document.getElementById('paySummary').innerHTML =
                '<div class="pay-row"><span>Referință ofertă</span><strong>' + esc(o.id) + '</strong></div>' +
                '<div class="pay-row"><span>Client</span><strong>' + esc(o.name) + '</strong></div>' +
                '<div class="pay-row"><span>Valoare totală proiect</span><strong>' + esc(money(o.total, o.currency)) + '</strong></div>' +
                '<div class="pay-row pay-row-hl"><span>Avans de plată acum</span><strong>' + esc(money(o.advance, o.currency)) + '</strong></div>';

            var b = o.bank;
            document.getElementById('payBank').innerHTML =
                '<h3 class="pay-bank-title">Transfer bancar</h3>' +
                '<div class="pay-row"><span>Beneficiar</span><strong>' + esc(b.beneficiary) + '</strong></div>' +
                '<div class="pay-row"><span>IBAN</span><strong>' + esc(b.iban) + '</strong></div>' +
                '<div class="pay-row"><span>Banca</span><strong>' + esc(b.bank_name) + '</strong></div>' +
                '<div class="pay-row"><span>Sumă</span><strong>' + esc(money(o.advance, o.currency)) + '</strong></div>' +
                '<div class="pay-row"><span>Detalii plată (obligatoriu)</span><strong>Avans ' + esc(o.id) + '</strong></div>' +
                '<p class="pay-note">Treci referința „Avans ' + esc(o.id) + '" la detaliile transferului. Plata se verifică manual de echipa noastră.</p>';

            // starea plății (confirmarea o face echipa, după ce vede banii în cont)
            if (o.advance_paid) {
                showNotice('Avans confirmat', 'Am încasat avansul. Codul pentru plata finală ți-a fost trimis pe email.');
            } else if (o.advance_claimed) {
                showNotice('Plată în verificare', 'Am înregistrat anunțul tău. Verificăm încasarea; după confirmare vei primi codul pe email.');
            }
        }

        function showNotice(title, text) {
            document.getElementById('noticeTitle').textContent = title;
            document.getElementById('noticeText').textContent = text;
            document.getElementById('codeModal').hidden = false;
        }

        function post(action, params) {
            var fd = new FormData();
            fd.set('action', action);
            for (var k in params) fd.set(k, params[k]);
            return fetch('payments.php', { method: 'POST', body: fd })
                .then(function (r) { return r.json().catch(function () { return { success: false, error: 'Răspuns invalid.' }; }); });
        }

        function loadOffer(ref) {
            ref = (ref || '').trim().toUpperCase();
            if (!ref) { setMsg(refMsg, 'Introdu referința ofertei.', false); return; }
            var btn = document.getElementById('loadOfferBtn');
            btn.disabled = true; var old = btn.textContent; btn.textContent = 'Se încarcă…';
            post('offer', { id: ref }).then(function (d) {
                btn.disabled = false; btn.textContent = old;
                if (d.success) {
                    refMsg.textContent = '';
                    if (d.final_paid) { setMsg(refMsg, 'Această ofertă este deja achitată integral.', true); return; }
                    renderOffer(d);
                } else {
                    setMsg(refMsg, d.error || 'Ofertă negăsită.', false);
                }
            });
        }

        document.getElementById('loadOfferBtn').addEventListener('click', function () { loadOffer(refInput.value); });
        refInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); loadOffer(refInput.value); } });

        document.getElementById('payConfirmChk').addEventListener('change', function () {
            document.getElementById('payBtn').disabled = !this.checked;
        });

        document.getElementById('payBtn').addEventListener('click', function () {
            if (!currentId) return;
            var btn = this; btn.disabled = true; var old = btn.textContent; btn.textContent = 'Se procesează…';
            post('pay_advance', { id: currentId }).then(function (d) {
                if (d.success) {
                    showNotice('Plată anunțată', 'Mulțumim! Verificăm încasarea în cont. După confirmare îți trimitem pe email codul pentru plata finală.');
                } else {
                    setMsg(payMsg, d.error || 'A apărut o eroare.', false);
                    btn.disabled = false; btn.textContent = old;
                }
            });
        });

        // auto-încărcare din link: plata-avans.html?of=TIB-XXXXXX
        var params = new URLSearchParams(location.search);
        var of = params.get('of');
        if (of) { refInput.value = of.toUpperCase(); loadOffer(of); }

        gsap.from('header', { duration: 0.6, opacity: 0, y: -30, ease: 'power3.out' });
        gsap.from('.about-hero', { duration: 0.7, opacity: 0, y: 20, ease: 'power2.out' });
        gsap.from('.contact-layout', { duration: 0.8, opacity: 0, y: 30, delay: 0.2, ease: 'power2.out' });
    })();
    
