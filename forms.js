/* ============================================================
   Trimitere formulare către send.php (AJAX) + stare / erori
   ============================================================ */
window.sendForm = function (opts) {
    var form = opts.form, type = opts.type, btn = opts.btn;
    var msgEl = opts.msgEl || null;
    var onDone = opts.onDone || function () {};

    var fd = new FormData(form);
    fd.set('_form', type);

    var oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Se trimite…';
    if (msgEl) { msgEl.textContent = ''; msgEl.style.color = ''; }

    fetch('send.php', { method: 'POST', body: fd })
        .then(function (res) { return res.json().catch(function () { return { success: false }; }); })
        .then(function (data) {
            if (data && data.success) {
                var modal = document.getElementById('successModal');
                if (modal) modal.hidden = false;
                form.reset();
                onDone(true);
            } else {
                var err = (data && data.error) ? data.error : 'A apărut o eroare. Încearcă din nou sau scrie-ne pe email.';
                if (msgEl) { msgEl.textContent = err; msgEl.style.color = '#c0392b'; }
                else alert(err);
                onDone(false);
            }
        })
        .catch(function () {
            var err = 'Conexiune eșuată. Verifică internetul și încearcă din nou.';
            if (msgEl) { msgEl.textContent = err; msgEl.style.color = '#c0392b'; }
            else alert(err);
            onDone(false);
        })
        .then(function () {
            btn.disabled = false;
            btn.textContent = oldText;
        });
};
