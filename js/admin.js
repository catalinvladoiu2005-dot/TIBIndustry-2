    (function () {
        var csrf = '';   // token CSRF primit la login; parola nu mai e păstrată în browser
        var allItems = [];
        var curType = '';
        var openId = null;

        var TYPE_LABELS = { oferta: 'Cerere ofertă', cv: 'CV', contact: 'Contact' };
        var STATUS_LABELS = { nou: 'Nou', in_lucru: 'În lucru', rezolvat: 'Rezolvat' };
        var FIELD_LABELS = {
            name: 'Nume', phone: 'Telefon', email: 'Email',
            subject: 'Subiect', message: 'Mesaj', position: 'Postul vizat',
            experience: 'Experiență', city: 'Localitate', about: 'Despre candidat',
            type: 'Tip lucrare', description: 'Descriere proiect', budget: 'Buget estimativ'
        };

        function esc(s) {
            return String(s == null ? '' : s)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }
        function setMsg(el, txt, ok) { el.textContent = txt; el.className = 'voucher-msg ' + (ok ? 'ok' : 'err'); }
        function fmtDate(ts) {
            var d = new Date(ts * 1000);
            return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
                ' ' + d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
        }
        function fmtSize(b) {
            if (b > 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
            if (b > 1024) return Math.round(b / 1024) + ' KB';
            return b + ' B';
        }
        function money(v) {
            return Number(v).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        function post(endpoint, action, params) {
            var fd = new FormData();
            fd.set('action', action);
            for (var k in params) fd.set(k, params[k]);
            return fetch(endpoint, { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf } })
                .then(function (r) {
                    return r.json().catch(function () { return { success: false, error: 'Răspuns invalid.' }; })
                        .then(function (d) { if (r.status === 401 && csrf) showLogin(); return d; });
                });
        }

        /* ---------- login (comun pentru cereri + plăți) ---------- */
        function showPanel() {
            document.getElementById('loginStep').hidden = true;
            document.getElementById('adminPanel').hidden = false;
        }
        function showLogin() {
            csrf = '';
            allItems = [];
            document.getElementById('adminPw').value = '';
            document.getElementById('adminPanel').hidden = true;
            document.getElementById('loginStep').hidden = false;
        }
        function enterPanel() {
            post('admin.php', 'list', {}).then(function (d) {
                if (!d.success) return;
                showPanel();
                allItems = d.items;
                render();
                loadOffers();
            });
        }
        function tryLogin(p) {
            var fd = new FormData();
            fd.set('action', 'login');
            fd.set('password', p);
            fetch('admin.php', { method: 'POST', body: fd, credentials: 'same-origin' })
                .then(function (r) { return r.json().catch(function () { return { success: false, error: 'Răspuns invalid.' }; }); })
                .then(function (d) {
                    document.getElementById('adminPw').value = '';
                    if (d.success) {
                        csrf = d.csrf;
                        setMsg(document.getElementById('loginMsg'), '', true);
                        enterPanel();
                    } else {
                        setMsg(document.getElementById('loginMsg'), d.error || 'Parolă incorectă.', false);
                    }
                });
        }
        function doLogout() {
            post('admin.php', 'logout', {}).then(function () { showLogin(); });
        }
        document.getElementById('loginBtn').addEventListener('click', function () {
            tryLogin(document.getElementById('adminPw').value);
        });
        document.getElementById('adminPw').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); tryLogin(this.value); }
        });

        /* ---------- comutare secțiuni Cereri / Plăți ---------- */
        document.getElementById('mainTabs').addEventListener('click', function (e) {
            var btn = e.target.closest('.admin-main-tab');
            if (!btn) return;
            this.querySelectorAll('.admin-main-tab').forEach(function (b) { b.classList.toggle('active', b === btn); });
            document.getElementById('sectionCereri').hidden = btn.dataset.section !== 'cereri';
            document.getElementById('sectionPlati').hidden = btn.dataset.section !== 'plati';
        });

        /* ================== CERERI & MESAJE ================== */
        function loadList() {
            post('admin.php', 'list', {}).then(function (d) {
                if (d.success) { allItems = d.items; render(); }
                else setMsg(document.getElementById('listMsg'), d.error || 'Eroare la listare.', false);
            });
        }
        document.getElementById('refreshBtn').addEventListener('click', loadList);
        document.getElementById('searchBox').addEventListener('input', render);
        document.getElementById('hideDone').addEventListener('change', render);

        document.getElementById('tabs').addEventListener('click', function (e) {
            var btn = e.target.closest('.admin-tab');
            if (!btn) return;
            curType = btn.dataset.type;
            this.querySelectorAll('.admin-tab').forEach(function (b) { b.classList.toggle('active', b === btn); });
            render();
        });

        function filtered() {
            var q = document.getElementById('searchBox').value.trim().toLowerCase();
            var hideDone = document.getElementById('hideDone').checked;
            return allItems.filter(function (it) {
                if (curType && it.type !== curType) return false;
                if (hideDone && it.status === 'rezolvat') return false;
                if (q) {
                    var hay = [it.name, it.email, it.phone, it.notes];
                    for (var k in it.fields) hay.push(it.fields[k]);
                    if (hay.join(' ').toLowerCase().indexOf(q) === -1) return false;
                }
                return true;
            });
        }

        function updateCounts() {
            document.getElementById('tabs').querySelectorAll('.admin-tab').forEach(function (b) {
                var t = b.dataset.type;
                var n = allItems.filter(function (it) { return !t || it.type === t; }).length;
                b.querySelector('.cnt').textContent = '(' + n + ')';
            });
        }

        function statusBadge(st) {
            return '<span class="st-badge st-' + esc(st) + '">' + esc(STATUS_LABELS[st] || st) + '</span>';
        }

        function render() {
            updateCounts();
            var body = document.getElementById('subsBody');
            var items = filtered();
            body.innerHTML = '';
            if (!items.length) {
                body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-soft);">Nicio cerere.</td></tr>';
                return;
            }
            items.forEach(function (it) {
                var tr = document.createElement('tr');
                tr.className = 'row-toggle';
                tr.innerHTML =
                    '<td style="white-space:nowrap;">' + esc(fmtDate(it.created_at)) + '</td>' +
                    '<td>' + esc(TYPE_LABELS[it.type] || it.type) + '</td>' +
                    '<td><strong>' + esc(it.name) + '</strong></td>' +
                    '<td>' + esc(it.email) + (it.phone ? '<br>' + esc(it.phone) : '') + '</td>' +
                    '<td style="text-align:center;">' + (it.files.length ? '📎 ' + it.files.length : '—') + '</td>' +
                    '<td>' + statusBadge(it.status) + '</td>' +
                    '<td><a href="#" data-open="' + esc(it.id) + '">' + (openId === it.id ? 'închide' : 'detalii') + '</a></td>';
                tr.addEventListener('click', function (e) {
                    e.preventDefault();
                    openId = (openId === it.id) ? null : it.id;
                    render();
                });
                body.appendChild(tr);
                if (openId === it.id) body.appendChild(detailRow(it));
            });
        }

        /* ---------- detalii ---------- */
        function detailRow(it) {
            var tr = document.createElement('tr');
            tr.className = 'sub-detail';
            var td = document.createElement('td');
            td.colSpan = 7;

            var html = '<dl>';
            html += '<dt>Referință</dt><dd>' + esc(it.id) + '</dd>';
            for (var k in it.fields) {
                var label = FIELD_LABELS[k] || (k.charAt(0).toUpperCase() + k.slice(1));
                var val = it.fields[k];
                if (k === 'email') val = '<a href="mailto:' + esc(val) + '">' + esc(val) + '</a>';
                else if (k === 'phone') val = '<a href="tel:' + esc(val) + '">' + esc(val) + '</a>';
                else val = esc(val);
                html += '<dt>' + esc(label) + '</dt><dd>' + val + '</dd>';
            }
            html += '</dl>';

            if (it.files.length) {
                html += '<div style="margin-bottom:0.8rem;"><strong style="font-size:0.85rem;color:var(--text-soft);">Fișiere atașate</strong><br>';
                it.files.forEach(function (f, i) {
                    html += '<button type="button" class="file-btn" data-file="' + i + '" style="margin:0.3rem 0.4rem 0 0;">⬇ ' +
                        esc(f.name) + ' <span style="opacity:0.6;">(' + esc(fmtSize(f.size)) + ')</span></button>';
                });
                html += '</div>';
            }

            html += '<label style="font-size:0.85rem;color:var(--text-soft);font-weight:600;">Notițe interne</label>' +
                '<textarea data-notes placeholder="ex: sunat clientul, revine cu detalii…">' + esc(it.notes) + '</textarea>' +
                '<div class="sub-actions">' +
                    '<select data-status>' +
                        ['nou', 'in_lucru', 'rezolvat'].map(function (s) {
                            return '<option value="' + s + '"' + (it.status === s ? ' selected' : '') + '>' + STATUS_LABELS[s] + '</option>';
                        }).join('') +
                    '</select>' +
                    '<button type="button" class="order-modal-btn" data-save>Salvează</button>' +
                    '<span class="voucher-msg" data-msg></span>' +
                    '<button type="button" class="danger-btn" data-del>Șterge cererea</button>' +
                '</div>';

            td.innerHTML = html;
            tr.appendChild(td);
            tr.addEventListener('click', function (e) { e.stopPropagation(); });

            // descărcare fișiere
            td.querySelectorAll('[data-file]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var i = +btn.dataset.file;
                    var f = it.files[i];
                    btn.disabled = true;
                    var fd = new FormData();
                    fd.set('action', 'file');
                    fd.set('id', it.id); fd.set('index', i);
                    fetch('admin.php', { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf } })
                        .then(function (r) {
                            if (!r.ok) throw new Error();
                            return r.blob();
                        })
                        .then(function (blob) {
                            var a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = f.name;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(a.href);
                        })
                        .catch(function () { alert('Nu am putut descărca fișierul.'); })
                        .then(function () { btn.disabled = false; });
                });
            });

            // salvare status + notițe
            td.querySelector('[data-save]').addEventListener('click', function () {
                var btn = this;
                var msg = td.querySelector('[data-msg]');
                btn.disabled = true;
                post('admin.php', 'update', {
                    id: it.id,
                    status: td.querySelector('[data-status]').value,
                    notes: td.querySelector('[data-notes]').value
                }).then(function (d) {
                    btn.disabled = false;
                    if (d.success) {
                        var idx = allItems.findIndex(function (x) { return x.id === it.id; });
                        if (idx !== -1) allItems[idx] = d.item;
                        setMsg(msg, 'Salvat ✓', true);
                        updateCounts();
                        // actualizează badge-ul din rândul de deasupra fără să închidă detaliile
                        var prev = tr.previousElementSibling;
                        if (prev) prev.children[5].innerHTML = statusBadge(d.item.status);
                    } else {
                        setMsg(msg, d.error || 'Eroare la salvare.', false);
                    }
                });
            });

            // ștergere
            td.querySelector('[data-del]').addEventListener('click', function () {
                if (!confirm('Sigur ștergi cererea „' + it.name + '" (' + it.id + ')? Fișierele atașate se șterg și ele definitiv.')) return;
                var msg = td.querySelector('[data-msg]');
                post('admin.php', 'delete', { id: it.id }).then(function (d) {
                    if (d.success) {
                        allItems = allItems.filter(function (x) { return x.id !== it.id; });
                        openId = null;
                        render();
                    } else {
                        setMsg(msg, d.error || 'Eroare la ștergere.', false);
                    }
                });
            });

            return tr;
        }

        /* ================== OFERTE & PLĂȚI ================== */

        // auto-completare avans = procent din total
        var advPct = 30;
        document.getElementById('cTotal').addEventListener('input', function () {
            var t = parseFloat((this.value || '').replace(',', '.'));
            var adv = document.getElementById('cAdvance');
            if (!isNaN(t) && !adv.dataset.touched) adv.value = Math.round(t * advPct / 100);
        });
        document.getElementById('cAdvance').addEventListener('input', function () { this.dataset.touched = '1'; });

        document.getElementById('createBtn').addEventListener('click', function () {
            var name = document.getElementById('cName').value.trim();
            var email = document.getElementById('cEmail').value.trim();
            var total = document.getElementById('cTotal').value.trim();
            var advance = document.getElementById('cAdvance').value.trim();
            var msg = document.getElementById('createMsg');
            if (!name || !total || !advance) { setMsg(msg, 'Completează numele, suma totală și avansul.', false); return; }
            var btn = this; btn.disabled = true; var old = btn.textContent; btn.textContent = 'Se creează…';
            post('payments.php', 'create', { name: name, email: email, total: total, advance: advance }).then(function (d) {
                btn.disabled = false; btn.textContent = old;
                if (!d.success) { setMsg(msg, d.error || 'Eroare.', false); return; }
                setMsg(msg, 'Ofertă creată: ' + d.id, true);
                var link = location.origin + location.pathname.replace(/admin\.html$/, '') + 'plata-avans.html?of=' + d.id;
                document.getElementById('newRef').textContent = d.id;
                document.getElementById('newLink').textContent = link;
                document.getElementById('linkBox').hidden = false;
                document.getElementById('copyLinkBtn').onclick = function () {
                    navigator.clipboard.writeText(link).then(function () { setMsg(msg, 'Link copiat!', true); });
                };
                document.getElementById('createForm').reset();
                document.getElementById('cAdvance').dataset.touched = '';
                loadOffers();
            });
        });

        function renderOffers(offers) {
            var body = document.getElementById('offersBody');
            body.innerHTML = '';
            if (!offers || !offers.length) {
                body.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-soft);">Nicio ofertă încă.</td></tr>';
                return;
            }
            offers.forEach(function (o) {
                var link = 'plata-avans.html?of=' + encodeURIComponent(o.id);
                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td><strong>' + esc(o.id) + '</strong></td>' +
                    '<td>' + esc(o.name) + '</td>' +
                    '<td>' + esc(money(o.total)) + ' ' + esc(o.currency) + '</td>' +
                    '<td>' + esc(money(o.advance)) + ' ' + esc(o.currency) + '</td>' +
                    '<td>' + esc(o.code || '—') + '</td>' +
                    '<td>' + payCell(o.advance_paid, o.advance_claimed, 'confirm_advance', o.id) + '</td>' +
                    '<td>' + payCell(o.final_paid, o.final_claimed, 'confirm_final', o.id, !o.advance_paid) + '</td>' +
                    '<td><a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">deschide</a></td>';
                tr.querySelectorAll('[data-confirm]').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        var what = btn.dataset.confirm === 'confirm_advance' ? 'avansul' : 'suma finală';
                        if (!confirm('Confirmi că ai văzut ' + what + ' încasat(ă) în cont pentru ' + btn.dataset.id + '?')) return;
                        btn.disabled = true;
                        post('payments.php', btn.dataset.confirm, { id: btn.dataset.id }).then(function (d) {
                            if (d.success) loadOffers();
                            else { btn.disabled = false; setMsg(document.getElementById('payListMsg'), d.error || 'Eroare.', false); }
                        });
                    });
                });
                body.appendChild(tr);
            });
        }

        function payCell(paid, claimed, action, id, blocked) {
            if (paid) return '✓';
            if (blocked) return '—';
            return (claimed ? '<em>anunțat</em><br>' : '') +
                '<button type="button" class="file-btn" data-confirm="' + action + '" data-id="' + esc(id) + '">Confirmă încasarea</button>';
        }

        function loadOffers() {
            post('payments.php', 'list', {}).then(function (d) {
                if (d.success) renderOffers(d.offers);
                else setMsg(document.getElementById('payListMsg'), d.error || 'Eroare la listare.', false);
            });
        }

        document.getElementById('payRefreshBtn').addEventListener('click', loadOffers);

        document.getElementById('logoutBtn').addEventListener('click', doLogout);

        // dacă există deja o sesiune validă (cookie), intrăm direct
        fetch('admin.php', { method: 'POST', credentials: 'same-origin', body: (function () { var f = new FormData(); f.set('action', 'session'); return f; })() })
            .then(function (r) { return r.json().catch(function () { return { success: false }; }); })
            .then(function (d) { if (d.success) { csrf = d.csrf; enterPanel(); } });
    })();
    
