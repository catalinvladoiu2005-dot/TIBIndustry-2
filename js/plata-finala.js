    (function () {
        var codeStep = document.getElementById('codeStep');
        var finalStep = document.getElementById('finalStep');
        var codeInput = document.getElementById('codeInput');
        var codeMsg = document.getElementById('codeMsg');
        var finalMsg = document.getElementById('finalMsg');
        var currentCode = null;

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
        function post(action, params) {
            var fd = new FormData();
            fd.set('action', action);
            for (var k in params) fd.set(k, params[k]);
            return fetch('payments.php', { method: 'POST', body: fd })
                .then(function (r) { return r.json().catch(function () { return { success: false, error: 'Răspuns invalid.' }; }); });
        }

        function renderFinal(d) {
            currentCode = (codeInput.value || '').trim().toUpperCase();
            codeStep.hidden = true;
            finalStep.hidden = false;

            document.getElementById('finalSummary').innerHTML =
                '<div class="pay-row"><span>Referință ofertă</span><strong>' + esc(d.id) + '</strong></div>' +
                '<div class="pay-row"><span>Client</span><strong>' + esc(d.name) + '</strong></div>' +
                '<div class="pay-row"><span>Valoare totală</span><strong>' + esc(money(d.total, d.currency)) + '</strong></div>' +
                '<div class="pay-row"><span>Avans achitat</span><strong>' + esc(money(d.advance, d.currency)) + '</strong></div>' +
                '<div class="pay-row pay-row-hl"><span>Sumă rămasă de plată</span><strong>' + esc(money(d.remaining, d.currency)) + '</strong></div>';

            var b = d.bank;
            document.getElementById('finalBank').innerHTML =
                '<h3 class="pay-bank-title">Transfer bancar</h3>' +
                '<div class="pay-row"><span>Beneficiar</span><strong>' + esc(b.beneficiary) + '</strong></div>' +
                '<div class="pay-row"><span>IBAN</span><strong>' + esc(b.iban) + '</strong></div>' +
                '<div class="pay-row"><span>Banca</span><strong>' + esc(b.bank_name) + '</strong></div>' +
                '<div class="pay-row"><span>Sumă</span><strong>' + esc(money(d.remaining, d.currency)) + '</strong></div>' +
                '<div class="pay-row"><span>Detalii plată (obligatoriu)</span><strong>Final ' + esc(d.id) + '</strong></div>' +
                '<p class="pay-note">Treci referința „Final ' + esc(d.id) + '" la detaliile transferului. Plata se verifică manual de echipa noastră.</p>';
        }

        function checkCode(code) {
            code = (code || '').trim().toUpperCase();
            if (!code) { setMsg(codeMsg, 'Introdu codul.', false); return; }
            var btn = document.getElementById('checkCodeBtn');
            btn.disabled = true; var old = btn.textContent; btn.textContent = 'Se verifică…';
            post('code', { code: code }).then(function (d) {
                btn.disabled = false; btn.textContent = old;
                if (!d.success) { setMsg(codeMsg, d.error || 'Cod invalid.', false); return; }
                if (d.final_paid) { setMsg(codeMsg, 'Suma finală a fost deja achitată pentru acest cod.', true); return; }
                if (d.final_claimed) { setMsg(codeMsg, 'Am înregistrat anunțul tău de plată. Verificăm încasarea în cont.', true); return; }
                if (!d.unlocked) {
                    var when = new Date(d.unlock_at * 1000).toLocaleDateString('ro-RO');
                    setMsg(codeMsg, 'Codul este valid, dar plata finală devine disponibilă începând cu ' + when + '.', false);
                    return;
                }
                codeMsg.textContent = '';
                renderFinal(d);
            });
        }

        document.getElementById('checkCodeBtn').addEventListener('click', function () { checkCode(codeInput.value); });
        codeInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); checkCode(codeInput.value); } });

        document.getElementById('finalConfirmChk').addEventListener('change', function () {
            document.getElementById('finalBtn').disabled = !this.checked;
        });

        document.getElementById('finalBtn').addEventListener('click', function () {
            if (!currentCode) return;
            var btn = this; btn.disabled = true; var old = btn.textContent; btn.textContent = 'Se procesează…';
            post('pay_final', { code: currentCode }).then(function (d) {
                if (d.success) {
                    document.getElementById('finalModal').hidden = false;
                } else {
                    setMsg(finalMsg, d.error || 'A apărut o eroare.', false);
                    btn.disabled = false; btn.textContent = old;
                }
            });
        });

        // auto-completare cod din link: plata-finala.html?cod=XXXX-XXXX-XXXX
        var params = new URLSearchParams(location.search);
        var c = params.get('cod') || params.get('code');
        if (c) { codeInput.value = c.toUpperCase(); checkCode(c); }

        gsap.from('header', { duration: 0.6, opacity: 0, y: -30, ease: 'power3.out' });
        gsap.from('.about-hero', { duration: 0.7, opacity: 0, y: 20, ease: 'power2.out' });
        gsap.from('.contact-layout', { duration: 0.8, opacity: 0, y: 30, delay: 0.2, ease: 'power2.out' });
    })();
    
