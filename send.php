<?php
/* ============================================================
   TRIMITERE FORMULARE — email cu atașamente + notificare Telegram
   Primește POST (multipart/form-data) de la formularele site-ului.
   Răspunde cu JSON: { success: true } sau { success:false, error }
   ============================================================ */

require __DIR__ . '/lib.php';
harden_php();
api_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') err('Metodă invalidă.', 405);
require_same_origin();

$cfg = app_config();

// anti-spam: câmp ascuns „honeypot". Dacă e completat → bot → ieșim „cu succes".
if (!empty($_POST['_gotcha'])) ok();

// limitare rată: max 8 trimiteri / 10 minute / IP
rate_limit_or_die('send', 8, 600);
// plafon global (toate IP-urile): oprește un val de trimiteri de la mai multe adrese
rate_limit_or_die('send_all', 120, 3600, true);

// tipul formularului
$form = isset($_POST['_form']) && is_string($_POST['_form']) ? $_POST['_form'] : '';
$labels = ['cv' => 'CV nou', 'oferta' => 'Ofertă nouă', 'contact' => 'Mesaj nou'];
if (!isset($cfg['recipients'][$form])) err('Tip formular necunoscut.');

$to    = $cfg['recipients'][$form];
$label = $labels[$form];

$name  = clean($_POST['name']  ?? '', 120);
$phone = clean($_POST['phone'] ?? '', 40);
$email = clean($_POST['email'] ?? '', 200);

if ($name === '' || $email === '') err('Lipsesc câmpuri obligatorii.');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) err('Adresă de email invalidă.');

// subiect: „CV nou — Ion Popescu — 07xx..."
$subject = $label . ' — ' . ($name ?: 'fără nume');
if ($phone !== '') $subject .= ' — ' . $phone;

// ---- corpul mesajului: toate câmpurile completate ----
$niceNames = [
    'name' => 'Nume', 'phone' => 'Telefon', 'email' => 'Email',
    'subject' => 'Subiect', 'message' => 'Mesaj', 'position' => 'Postul vizat',
    'experience' => 'Experiență', 'city' => 'Localitate', 'about' => 'Despre candidat',
    'type' => 'Tip lucrare', 'description' => 'Descriere proiect', 'budget' => 'Buget estimativ',
];
// doar câmpurile cunoscute ajung în email / bază (restul sunt ignorate); mesajele lungi au limită mai mare
$longFields = ['message' => 5000, 'description' => 5000, 'about' => 5000];
function collect_fields($niceNames, $longFields) {
    $fields = [];
    foreach ($niceNames as $key => $_) {
        if (!isset($_POST[$key])) continue;
        $val = isset($longFields[$key]) ? clean_multiline($_POST[$key], $longFields[$key]) : clean($_POST[$key], 200);
        if ($val !== '') $fields[$key] = $val;
    }
    return $fields;
}
$fields = collect_fields($niceNames, $longFields);
function dir_size($dir) {
    $n = 0;
    if (!is_dir($dir)) return 0;
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS)) as $f) $n += $f->getSize();
    return $n;
}

$lines = [];
$lines[] = strtoupper($label);
$lines[] = str_repeat('=', 40);
$lines[] = '';
foreach ($fields as $key => $val) {
    $lines[] = $niceNames[$key] . ': ' . $val;
}
$lines[] = '';
$lines[] = str_repeat('-', 40);
$lines[] = 'Trimis de pe site-ul TibIndustry';
$body = implode("\n", $lines);

// ---- colectează atașamentele din $_FILES (single sau multiple) ----
$attachments = [];
$total = 0;
$allowed = array_map('strtolower', $cfg['allowed_ext']);

foreach ($_FILES as $field) {
    if (!is_array($field) || !isset($field['name'])) continue;
    $names = $field['name'];
    if (is_array($names)) {
        for ($i = 0; $i < count($names); $i++) {
            if (!is_string($names[$i]) || ($field['error'][$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) continue;
            $attachments[] = ['name' => $names[$i], 'tmp' => $field['tmp_name'][$i], 'size' => $field['size'][$i]];
        }
    } else {
        if (!is_string($names) || $field['error'] !== UPLOAD_ERR_OK) continue;
        $attachments[] = ['name' => $names, 'tmp' => $field['tmp_name'], 'size' => $field['size']];
    }
}

/* validare conținut real (nu doar extensia). Întoarce null dacă e OK, altfel motivul respingerii. */
function check_file_content($tmp, $ext) {
    $head = (string)@file_get_contents($tmp, false, null, 0, 4096);
    if (preg_match('/<\?(php|=)|<script|<html|<svg|<!doctype html/i', $head)) return 'conține conținut nepermis.';

    if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)) {
        if (@getimagesize($tmp) === false) return 'nu este o imagine validă.';
    } elseif ($ext === 'pdf') {
        if (strpos($head, '%PDF-') === false) return 'nu este un PDF valid.';
        // PDF cu JavaScript / acțiuni de lansare → respins
        $raw = (string)@file_get_contents($tmp, false, null, 0, 16 * 1024 * 1024);
        if (preg_match('#/(JavaScript|JS|Launch)\b#', $raw)) return 'conține conținut activ (JavaScript).';
    } elseif (in_array($ext, ['docx', 'odt'], true)) {
        if (substr($head, 0, 2) !== 'PK') return 'nu este un document valid.';
        if (class_exists('ZipArchive')) {
            $z = new ZipArchive();
            if ($z->open($tmp) !== true) return 'nu este un document valid.';
            for ($i = 0; $i < $z->numFiles; $i++) {
                $n = strtolower((string)$z->getNameIndex($i));
                if (strpos($n, 'vbaproject') !== false || preg_match('#(^|/)(scripts|basic)/#', $n) || substr($n, -4) === '.exe') {
                    $z->close();
                    return 'conține macro-uri.';
                }
            }
            $z->close();
        }
    } elseif ($ext === 'doc') {
        if (substr($head, 0, 8) !== "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1") return 'nu este un document valid.';
        $raw = (string)@file_get_contents($tmp, false, null, 0, 16 * 1024 * 1024);
        if (stripos($raw, 'VBA') !== false || stripos($raw, "M\0a\0c\0r\0o\0s") !== false) return 'conține macro-uri.';
    } elseif ($ext === 'rtf') {
        if (strpos($head, '{\\rtf') !== 0) return 'nu este un RTF valid.';
    }
    return null;
}

// validează atașamentele
if (count($attachments) > 10) err('Prea multe fișiere atașate (maxim 10).');
$valid = [];
foreach ($attachments as $a) {
    $ext = strtolower(pathinfo($a['name'], PATHINFO_EXTENSION));
    $shown = clean($a['name'], 80);
    if (!in_array($ext, $allowed, true)) err('Fișier cu format neacceptat: ' . $shown);
    if ($a['size'] > $cfg['max_file_bytes']) err('Fișierul „' . $shown . '" depășește limita.');
    if (!is_uploaded_file($a['tmp'])) continue;
    // verificăm conținutul real, nu doar extensia
    $bad = check_file_content($a['tmp'], $ext);
    if ($bad !== null) err('Fișierul „' . $shown . '" ' . $bad);
    $total += $a['size'];
    if ($total > $cfg['max_total_bytes']) err('Atașamentele depășesc limita totală.');
    $valid[] = $a;
}

// CV-ul este opțional — candidatura se poate trimite și fără atașament

/* ---- salvează cererea în data/submissions.json + fișierele în data/uploads/ ----
   (pentru panoul de administrare admin.html; emailul se trimite în continuare) */
$savedFiles = [];
$subId = 'S-' . strtoupper(bin2hex(random_bytes(4)));
// plafon de stocare: dacă e plin, cererea se trimite doar pe email (fără copie pe server)
$storeFull = dir_size(__DIR__ . '/data/uploads') + $total > $cfg['max_store_bytes'];
if ($storeFull) $valid_to_store = []; else $valid_to_store = $valid;
if (count($valid_to_store)) {
    $updir = __DIR__ . '/data/uploads/' . $subId;
    if (!is_dir($updir)) @mkdir($updir, 0750, true);
    foreach ($valid_to_store as $a) {
        // nume pe disc: prefix aleatoriu + nume curățat (fără puncte multiple periculoase, max 80 caractere)
        $base = preg_replace('/[^A-Za-z0-9_-]+/', '_', pathinfo($a['name'], PATHINFO_FILENAME));
        $ext  = strtolower(pathinfo($a['name'], PATHINFO_EXTENSION));
        $safe = bin2hex(random_bytes(3)) . '_' . substr(trim($base, '_') ?: 'fisier', 0, 80) . '.' . $ext;
        if (@copy($a['tmp'], $updir . '/' . $safe)) {
            @chmod($updir . '/' . $safe, 0640);
            $savedFiles[] = ['name' => clean($a['name'], 150), 'stored' => $safe, 'size' => $a['size']];
        }
    }
}
$saved = false;
$maxItems = (int)$cfg['max_submissions'];
try {
    store_modify(__DIR__ . '/data/submissions.json', ['items' => []], function (&$store) use ($subId, $form, $name, $phone, $email, $fields, $savedFiles, $maxItems) {
        if (!isset($store['items']) || !is_array($store['items'])) $store['items'] = [];
        if (count($store['items']) >= $maxItems) throw new RuntimeException('full');
        $store['items'][$subId] = [
            'id'         => $subId,
            'type'       => $form,
            'name'       => $name,
            'phone'      => $phone,
            'email'      => $email,
            'fields'     => $fields,
            'files'      => $savedFiles,
            'created_at' => time(),
            'status'     => 'nou',
            'notes'      => '',
        ];
    });
    $saved = true;
} catch (Throwable $e) {
    // emailul de mai jos încearcă oricum; fișierele salvate fără intrare în bază se șterg
    foreach ($savedFiles as $f) @unlink(__DIR__ . '/data/uploads/' . $subId . '/' . $f['stored']);
    @rmdir(__DIR__ . '/data/uploads/' . $subId);
}

// ---- construiește emailul MIME (multipart/mixed) ----
function encHeader($s) { return '=?UTF-8?B?' . base64_encode($s) . '?='; }

$boundary = 'b_' . bin2hex(random_bytes(12));

$headers  = 'From: ' . encHeader($cfg['from_name']) . ' <' . $cfg['from_email'] . '>' . "\r\n";
$headers .= 'Reply-To: ' . encHeader($name) . ' <' . $email . '>' . "\r\n";
if (!empty($cfg['bcc'])) $headers .= 'Bcc: ' . $cfg['bcc'] . "\r\n";
$headers .= 'MIME-Version: 1.0' . "\r\n";
$headers .= 'Content-Type: multipart/mixed; boundary="' . $boundary . '"' . "\r\n";

$msg  = '--' . $boundary . "\r\n";
$msg .= 'Content-Type: text/plain; charset=UTF-8' . "\r\n";
$msg .= 'Content-Transfer-Encoding: base64' . "\r\n\r\n";
$msg .= chunk_split(base64_encode($body)) . "\r\n";

foreach ($valid as $a) {
    $data = file_get_contents($a['tmp']);
    if ($data === false) continue;
    $fname = str_replace(['"', '\\'], '', clean($a['name'], 150));
    $msg .= '--' . $boundary . "\r\n";
    $msg .= 'Content-Type: application/octet-stream; name="' . $fname . '"' . "\r\n";
    $msg .= 'Content-Transfer-Encoding: base64' . "\r\n";
    $msg .= 'Content-Disposition: attachment; filename="' . $fname . '"' . "\r\n\r\n";
    $msg .= chunk_split(base64_encode($data)) . "\r\n";
}
$msg .= '--' . $boundary . '--';

$sent = @mail($to, encHeader($subject), $msg, $headers, '-f' . $cfg['from_email']);

// ---- notificare instant Telegram (opțional) ----
if (!empty($cfg['telegram_token']) && !empty($cfg['telegram_chat_id'])) {
    $tg  = "🔔 " . $label . "\n";
    $tg .= "👤 " . $name . "\n";
    if ($phone !== '') $tg .= "📞 " . $phone . "\n";
    $tg .= "✉️ " . $email . "\n";
    if (count($valid)) $tg .= "📎 " . count($valid) . " fișier(e) atașate";
    $url = 'https://api.telegram.org/bot' . $cfg['telegram_token'] . '/sendMessage';
    $payload = http_build_query(['chat_id' => $cfg['telegram_chat_id'], 'text' => $tg]);
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload, CURLOPT_TIMEOUT => 8,
        ]);
        curl_exec($ch); curl_close($ch);
    } else {
        @file_get_contents($url . '?' . $payload);
    }
}

// cererea contează ca primită dacă a fost salvată pentru panoul de admin,
// chiar dacă emailul de notificare nu a putut pleca (ex: local, fără server de mail)
if (!$sent && !$saved) err('Mesajul nu a putut fi trimis. Încearcă din nou sau scrie-ne direct pe email.', 500);
ok();
