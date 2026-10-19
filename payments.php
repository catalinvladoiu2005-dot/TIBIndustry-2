<?php
/* ============================================================
   PLĂȚI — backend pentru avans + sumă finală (transfer bancar)
   ------------------------------------------------------------
   Toate datele se salvează într-un fișier JSON (config: payment.data_file).
   Acțiuni (POST, câmp "action"):
     create     – (admin) creează o ofertă cu sume setate de tine
     list       – (admin) listează toate ofertele
     offer      – încarcă o ofertă publică după referință (id)
     pay_advance– clientul ANUNȚĂ plata avansului (nu o confirmă; nu primește cod)
     confirm_advance – (admin) confirmă încasarea avansului → se generează codul și se trimite pe email
     code       – verifică un cod și starea lui (valid / blocat / anunțat / plătit)
     pay_final  – clientul ANUNȚĂ plata sumei finale (cu codul)
     confirm_final   – (admin) confirmă încasarea sumei finale
   Statusul „plătit" îl setează doar adminul, după ce vede banii în cont.
   Acțiunile de admin cer sesiune (login în admin.php) + token CSRF.
   Acțiunile publice sunt limitate ca rată (anti ghicire de referințe / coduri).
   Răspuns: JSON { success: bool, ... }
   ============================================================ */

require __DIR__ . '/lib.php';
harden_php();
api_headers();

$cfg = app_config();
$pc  = $cfg['payment'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') err('Metodă invalidă.', 405);
require_same_origin();

define('STORE_FILE', $pc['data_file']);
function load_store() { return store_read(STORE_FILE, ['offers' => []]); }

/* ---------- helpers ---------- */
function gen_id() {
    // referință ofertă scurtă, ușor de citit: TIB-XXXXXX
    $alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    $s = '';
    for ($i = 0; $i < 6; $i++) $s .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    return 'TIB-' . $s;
}

function gen_code() {
    // cod plată finală: 3 grupe de 4 caractere XXXX-XXXX-XXXX
    $alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    $parts = [];
    for ($g = 0; $g < 3; $g++) {
        $s = '';
        for ($i = 0; $i < 4; $i++) $s .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        $parts[] = $s;
    }
    return implode('-', $parts);
}

function bank_block() {
    global $pc;
    return [
        'beneficiary' => $pc['bank']['beneficiary'],
        'iban'        => $pc['bank']['iban'],
        'bank_name'   => $pc['bank']['bank_name'],
        'currency'    => $pc['bank']['currency'],
    ];
}

/* ---------- notificare email (text simplu) ---------- */
function send_mail($to, $subject, $body) {
    global $cfg;
    if (!$to || !filter_var($to, FILTER_VALIDATE_EMAIL)) return;
    $enc = function ($s) { return '=?UTF-8?B?' . base64_encode($s) . '?='; };
    $headers  = 'From: ' . $enc($cfg['from_name']) . ' <' . $cfg['from_email'] . '>' . "\r\n";
    $headers .= 'MIME-Version: 1.0' . "\r\n";
    $headers .= 'Content-Type: text/plain; charset=UTF-8' . "\r\n";
    $headers .= 'Content-Transfer-Encoding: base64' . "\r\n";
    @mail($to, $enc($subject), chunk_split(base64_encode($body)), $headers, '-f' . $cfg['from_email']);
}

function valid_offer_id($id) { return preg_match('/^TIB-[2-9A-HJ-NP-Z]{6}$/', $id) === 1; }
function valid_code($c)      { return preg_match('/^[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){2}$/', $c) === 1; }

/* ============================================================ */
$action = isset($_POST['action']) ? (string)$_POST['action'] : '';

switch ($action) {

/* ---- ADMIN: creează ofertă ---- */
case 'create':
    require_admin();
    $name  = clean($_POST['name']  ?? '', 120);
    $email = clean($_POST['email'] ?? '', 200);
    $total = (float)str_replace([',', ' '], ['.', ''], (string)($_POST['total']   ?? '0'));
    $adv   = (float)str_replace([',', ' '], ['.', ''], (string)($_POST['advance'] ?? '0'));

    if ($name === '') err('Lipsește numele clientului.');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) err('Email client invalid.');
    if ($total <= 0)  err('Suma totală trebuie să fie mai mare ca 0.');
    if ($total > 1e9) err('Suma totală este prea mare.');
    if ($adv <= 0)    err('Avansul trebuie să fie mai mare ca 0.');
    if ($adv > $total) err('Avansul nu poate depăși suma totală.');

    $id = store_modify(STORE_FILE, ['offers' => []], function (&$data) use ($name, $email, $total, $adv, $pc) {
        do { $id = gen_id(); } while (isset($data['offers'][$id]));
        $data['offers'][$id] = [
            'id'              => $id,
            'name'            => $name,
            'email'           => $email,
            'total'           => round($total, 2),
            'advance'         => round($adv, 2),
            'currency'        => $pc['bank']['currency'],
            'created_at'      => time(),
            'advance_claimed' => false,
            'advance_claimed_at' => null,
            'advance_paid'    => false,
            'advance_paid_at' => null,
            'code'            => null,
            'unlock_at'       => null,
            'final_claimed'   => false,
            'final_claimed_at' => null,
            'final_paid'      => false,
            'final_paid_at'   => null,
        ];
        return $id;
    });
    ok(['id' => $id]);
    break;

/* ---- ADMIN: listează ofertele ---- */
case 'list':
    require_admin();
    $offers = array_values(load_store()['offers']);
    usort($offers, function ($a, $b) { return $b['created_at'] <=> $a['created_at']; });
    ok(['offers' => $offers]);
    break;

/* ---- PUBLIC: încarcă o ofertă după referință ---- */
case 'offer':
    rate_limit_or_die('pay_offer', 20, 600);
    $id = strtoupper(clean($_POST['id'] ?? '', 20));
    $data = load_store();
    if (!valid_offer_id($id) || !isset($data['offers'][$id])) err('Nu am găsit nicio ofertă cu această referință.', 404);
    $o = $data['offers'][$id];
    ok([
        'id'           => $o['id'],
        'name'         => $o['name'],
        'total'        => $o['total'],
        'advance'      => $o['advance'],
        'remaining'    => round($o['total'] - $o['advance'], 2),
        'currency'     => $o['currency'],
        'advance_claimed' => !empty($o['advance_claimed']),
        'advance_paid' => $o['advance_paid'],
        'final_paid'   => $o['final_paid'],
        'bank'         => bank_block(),
    ]);
    break;

/* ---- CLIENT: anunță că a plătit avansul (NU generează codul) ---- */
case 'pay_advance':
    rate_limit_or_die('pay_advance', 10, 600);
    $id = strtoupper(clean($_POST['id'] ?? '', 20));
    if (!valid_offer_id($id)) err('Ofertă inexistentă.', 404);

    try {
        $res = store_modify(STORE_FILE, ['offers' => []], function (&$data) use ($id) {
            if (!isset($data['offers'][$id])) throw new RuntimeException('404');
            $o = &$data['offers'][$id];
            if ($o['advance_paid'] || !empty($o['advance_claimed'])) return ['already' => true, 'offer' => $o];
            $o['advance_claimed']    = true;
            $o['advance_claimed_at'] = time();
            return ['already' => false, 'offer' => $o];
        });
    } catch (RuntimeException $e) { err('Ofertă inexistentă.', 404); }

    $o = $res['offer'];
    if (!$res['already']) {
        send_mail($cfg['recipients']['oferta'] ?? '', 'Avans anunțat — ' . $o['id'],
            "Clientul " . $o['name'] . " a anunțat plata avansului pentru " . $o['id'] .
            " (" . number_format($o['advance'], 2, ',', '.') . " " . $o['currency'] . ").\n" .
            "Verifică încasarea în cont, apoi confirmă din panoul de administrare (se generează codul).");
    }
    ok(['claimed' => true, 'already' => $res['already']]);
    break;

/* ---- ADMIN: confirmă încasarea avansului → generează cod + email client ---- */
case 'confirm_advance':
    require_admin();
    $id = strtoupper(clean($_POST['id'] ?? '', 20));
    if (!valid_offer_id($id)) err('Ofertă inexistentă.', 404);

    try {
        $res = store_modify(STORE_FILE, ['offers' => []], function (&$data) use ($id, $pc) {
            if (!isset($data['offers'][$id])) throw new RuntimeException('404');
            $o = &$data['offers'][$id];
            if ($o['advance_paid']) return ['already' => true, 'offer' => $o];

            $existing = [];
            foreach ($data['offers'] as $of) if (!empty($of['code'])) $existing[$of['code']] = true;
            do { $code = gen_code(); } while (isset($existing[$code]));

            $o['advance_paid']    = true;
            $o['advance_paid_at'] = time();
            $o['code']            = $code;
            $o['unlock_at']       = time() + ((int)$pc['final_unlock_days'] * 86400);
            return ['already' => false, 'offer' => $o];
        });
    } catch (RuntimeException $e) { err('Ofertă inexistentă.', 404); }

    $o = $res['offer'];
    if ($res['already']) ok(['already' => true, 'code' => $o['code']]);

    if (!empty($o['email'])) {
        $when = date('d.m.Y', $o['unlock_at']);
        $body  = "Bună, " . $o['name'] . ",\n\n";
        $body .= "Am încasat avansul pentru oferta " . $o['id'] . ".\n\n";
        $body .= "CODUL TĂU PENTRU PLATA FINALĂ:\n   " . $o['code'] . "\n\n";
        $body .= "Păstrează acest cod. Începând cu data de " . $when . " îl poți folosi pe\n";
        $body .= "pagina de plată finală pentru a achita suma rămasă (" . number_format($o['total'] - $o['advance'], 2, ',', '.') . " " . $o['currency'] . ").\n\n";
        $body .= "— Echipa TibIndustry";
        send_mail($o['email'], 'Codul tău TibIndustry — oferta ' . $o['id'], $body);
    }
    ok(['code' => $o['code'], 'unlock_at' => $o['unlock_at'], 'emailed' => !empty($o['email'])]);
    break;

/* ---- ADMIN: confirmă încasarea sumei finale ---- */
case 'confirm_final':
    require_admin();
    $id = strtoupper(clean($_POST['id'] ?? '', 20));
    if (!valid_offer_id($id)) err('Ofertă inexistentă.', 404);
    try {
        store_modify(STORE_FILE, ['offers' => []], function (&$data) use ($id) {
            if (!isset($data['offers'][$id])) throw new RuntimeException('404');
            $o = &$data['offers'][$id];
            if (!$o['advance_paid']) throw new RuntimeException('409');
            if (!$o['final_paid']) { $o['final_paid'] = true; $o['final_paid_at'] = time(); }
        });
    } catch (RuntimeException $e) {
        if ($e->getMessage() === '409') err('Avansul nu este confirmat încă.', 409);
        err('Ofertă inexistentă.', 404);
    }
    ok();
    break;

/* ---- CLIENT: verifică un cod ---- */
case 'code':
    rate_limit_or_die('pay_code', 10, 600);
    $code = strtoupper(clean($_POST['code'] ?? '', 30));
    if ($code === '') err('Introdu codul.');
    $found = null;
    if (valid_code($code)) {
        foreach (load_store()['offers'] as $of) if (!empty($of['code']) && hash_equals($of['code'], $code)) { $found = $of; break; }
    }
    if (!$found) err('Cod invalid. Verifică-l în emailul primit de la noi.', 404);

    $unlocked = time() >= (int)$found['unlock_at'];
    ok([
        'id'         => $found['id'],
        'name'       => $found['name'],
        'remaining'  => round($found['total'] - $found['advance'], 2),
        'total'      => $found['total'],
        'advance'    => $found['advance'],
        'currency'   => $found['currency'],
        'final_paid' => $found['final_paid'],
        'final_claimed' => !empty($found['final_claimed']),
        'unlocked'   => $unlocked,
        'unlock_at'  => $found['unlock_at'],
        'bank'       => bank_block(),
    ]);
    break;

/* ---- CLIENT: confirmă plata finală ---- */
case 'pay_final':
    rate_limit_or_die('pay_final', 10, 600);
    $code = strtoupper(clean($_POST['code'] ?? '', 30));
    if ($code === '') err('Introdu codul.');
    if (!valid_code($code)) err('Cod invalid.', 404);

    try {
        $res = store_modify(STORE_FILE, ['offers' => []], function (&$data) use ($code) {
            $key = null;
            foreach ($data['offers'] as $k => $of) if (!empty($of['code']) && hash_equals($of['code'], $code)) { $key = $k; break; }
            if ($key === null) throw new RuntimeException('404');
            $o = &$data['offers'][$key];
            if ($o['final_paid'] || !empty($o['final_claimed'])) return ['already' => true, 'offer' => $o];
            if (time() < (int)$o['unlock_at']) throw new RuntimeException('403');
            $o['final_claimed']    = true;
            $o['final_claimed_at'] = time();
            return ['already' => false, 'offer' => $o];
        });
    } catch (RuntimeException $e) {
        if ($e->getMessage() === '403') err('Codul nu este încă valid pentru plata finală.', 403);
        err('Cod invalid.', 404);
    }
    if ($res['already']) ok(['already' => true]);

    $o = $res['offer'];
    send_mail($cfg['recipients']['oferta'] ?? '', 'Plată finală anunțată — ' . $o['id'],
        "Clientul " . $o['name'] . " a anunțat plata finală pentru " . $o['id'] .
        " (" . number_format($o['total'] - $o['advance'], 2, ',', '.') . " " . $o['currency'] . ").\n" .
        "Verifică încasarea în cont, apoi confirmă din panoul de administrare.");
    ok();
    break;

default:
    err('Acțiune necunoscută.');
}
