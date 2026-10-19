<?php
/* ============================================================
   ADMIN — backend pentru panoul de administrare (admin.html)
   ------------------------------------------------------------
   Gestionează cererile primite de pe site (cereri de ofertă,
   CV-uri, mesaje de contact), salvate de send.php în
   data/submissions.json + data/uploads/.

   Acțiuni (POST, câmp "action"):
     login   – autentificare (parola din config.local.php) → sesiune + token CSRF
     session – verifică dacă sesiunea curentă e validă
     logout  – închide sesiunea
     list    – listează toate cererile            (cere sesiune + CSRF)
     update  – schimbă statusul / notițele        (cere sesiune + CSRF)
     delete  – șterge o cerere și fișierele ei    (cere sesiune + CSRF)
     file    – descarcă un fișier atașat          (cere sesiune + CSRF)
   ============================================================ */

require __DIR__ . '/lib.php';
harden_php();
api_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') err('Metodă invalidă.', 405);
require_same_origin();

define('STORE_FILE', __DIR__ . '/data/submissions.json');
define('UPLOADS_DIR', __DIR__ . '/data/uploads');

$action = isset($_POST['action']) ? (string)$_POST['action'] : '';

/* ---- acțiuni fără sesiune ---- */
if ($action === 'login') {
    $csrf = admin_login($_POST['password'] ?? '');
    ok(['csrf' => $csrf]);
}
if ($action === 'logout') { admin_logout(); ok(); }
if ($action === 'session') {
    if (!admin_authed()) err('Neautentificat.', 401);
    ok(['csrf' => $_SESSION['csrf']]);
}

/* ---- tot ce urmează cere admin autentificat + token CSRF ---- */
require_admin();

function load_store() { return store_read(STORE_FILE, ['items' => []]); }

/* id-urile sunt generate de server (S-XXXXXXXX) — le validăm strict înainte de a le folosi în căi */
function valid_id($id) { return is_string($id) && preg_match('/^S-[0-9A-F]{8}$/', $id) === 1; }

switch ($action) {

/* ---- listează toate cererile ---- */
case 'list':
    $items = array_values(load_store()['items']);
    usort($items, function ($a, $b) { return $b['created_at'] <=> $a['created_at']; });
    ok(['items' => $items]);
    break;

/* ---- actualizează status / notițe ---- */
case 'update':
    $id = clean($_POST['id'] ?? '');
    if (!valid_id($id)) err('Cerere inexistentă.', 404);
    $status = isset($_POST['status']) ? clean($_POST['status']) : null;
    if ($status !== null && !in_array($status, ['nou', 'in_lucru', 'rezolvat'], true)) err('Status invalid.');
    $notes = isset($_POST['notes']) ? clean_multiline($_POST['notes'], 5000) : null;

    try {
        $item = store_modify(STORE_FILE, ['items' => []], function (&$data) use ($id, $status, $notes) {
            if (!isset($data['items'][$id])) throw new RuntimeException('404');
            if ($status !== null) $data['items'][$id]['status'] = $status;
            if ($notes !== null)  $data['items'][$id]['notes']  = $notes;
            return $data['items'][$id];
        });
    } catch (RuntimeException $e) { err('Cerere inexistentă.', 404); }
    ok(['item' => $item]);
    break;

/* ---- șterge o cerere + fișierele ei ---- */
case 'delete':
    $id = clean($_POST['id'] ?? '');
    if (!valid_id($id)) err('Cerere inexistentă.', 404);

    try {
        $files = store_modify(STORE_FILE, ['items' => []], function (&$data) use ($id) {
            if (!isset($data['items'][$id])) throw new RuntimeException('404');
            $files = $data['items'][$id]['files'] ?? [];
            unset($data['items'][$id]);
            return $files;
        });
    } catch (RuntimeException $e) { err('Cerere inexistentă.', 404); }

    $dir = UPLOADS_DIR . '/' . $id;
    if (is_dir($dir)) {
        foreach ($files as $f) {
            $p = $dir . '/' . basename($f['stored']);
            if (is_file($p)) @unlink($p);
        }
        @rmdir($dir);
    }
    ok();
    break;

/* ---- descarcă un fișier atașat ---- */
case 'file':
    $id  = clean($_POST['id'] ?? '');
    $idx = (int)($_POST['index'] ?? -1);
    if (!valid_id($id)) err('Cerere inexistentă.', 404);
    $data = load_store();
    if (!isset($data['items'][$id])) err('Cerere inexistentă.', 404);
    $files = $data['items'][$id]['files'] ?? [];
    if (!isset($files[$idx])) err('Fișier inexistent.', 404);

    $stored = basename($files[$idx]['stored']);
    $path = UPLOADS_DIR . '/' . $id . '/' . $stored;
    if (!is_file($path)) err('Fișierul nu mai există pe server.', 404);

    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . preg_replace('/[^A-Za-z0-9._-]/', '_', $stored) . '"');
    header('Content-Length: ' . filesize($path));
    header('X-Content-Type-Options: nosniff');
    readfile($path);
    exit;

default:
    err('Acțiune necunoscută.');
}
