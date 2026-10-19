<?php
/* ============================================================
   FUNCȚII COMUNE DE SECURITATE (folosite de admin.php, payments.php, send.php)
   Nu se apelează direct din browser (blocat în .htaccess).
   ============================================================ */

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'lib.php') { http_response_code(403); exit; }

function app_config() {
    static $cfg = null;
    if ($cfg === null) $cfg = require __DIR__ . '/config.php';
    return $cfg;
}

/* ---------- răspunsuri JSON ---------- */
function api_headers() {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
}
function out($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function ok($extra = [])            { out(array_merge(['success' => true], $extra)); }
function err($msg, $code = 400)     { out(['success' => false, 'error' => $msg], $code); }

/* erorile PHP nu trebuie afișate vizitatorilor (nu divulgăm căi / cod) */
function harden_php() {
    ini_set('display_errors', '0');
    ini_set('display_startup_errors', '0');
    ini_set('log_errors', '1');
    error_reporting(E_ALL);
}

/* ---------- curățare input ---------- */
function clean($v, $max = 200) {
    $v = is_array($v) ? implode(', ', array_map('strval', $v)) : (string)$v;
    $v = trim(str_replace(["\r", "\n", "\0"], ' ', $v));
    return mb_substr($v, 0, $max, 'UTF-8');
}
function clean_multiline($v, $max = 5000) {
    $v = is_array($v) ? implode(', ', array_map('strval', $v)) : (string)$v;
    $v = trim(str_replace("\0", '', $v));
    return mb_substr($v, 0, $max, 'UTF-8');
}

/* ---------- HTTPS / IP ---------- */
function is_https() {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https' && !empty(app_config()['trust_proxy']));
}
function client_ip() {
    // X-Forwarded-For poate fi falsificat → îl folosim doar dacă ai activat 'trust_proxy'
    if (!empty(app_config()['trust_proxy']) && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ip = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

/* ---------- protecție CSRF / CORS: acceptăm doar cereri de pe același site ---------- */
function require_same_origin() {
    $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
    foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $h) {
        if (empty($_SERVER[$h])) continue;
        $src = strtolower((string)parse_url($_SERVER[$h], PHP_URL_HOST));
        $port = parse_url($_SERVER[$h], PHP_URL_PORT);
        if ($port) $src .= ':' . $port;
        if ($src !== $host) err('Cerere respinsă.', 403);
        return;
    }
    // fără Origin/Referer = client non-browser (curl etc.) → nu există risc CSRF din browser
}

/* ---------- limitare rată (fișiere în data/ratelimit/, fără DB) ----------
   Citirea + verificarea + scrierea se fac sub același flock → cererile paralele
   nu pot trece de limită. $global=true → contor comun tuturor IP-urilor. */
function rl_path($bucket, $global = false) {
    $dir = __DIR__ . '/data/ratelimit';
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    return $dir . '/' . hash('sha256', $bucket . '|' . ($global ? '*' : client_ip())) . '.json';
}
/* $fn(array $hits): ?array — primește accesările din fereastră, întoarce lista nouă (sau null = fără scriere) */
function rl_locked($path, $window, callable $fn) {
    $fp = @fopen($path, 'c+');
    if (!$fp) return $fn([]);
    flock($fp, LOCK_EX);
    $now = time();
    $hits = [];
    $d = json_decode((string)stream_get_contents($fp), true);
    if (is_array($d)) foreach ($d as $t) if (is_int($t) && $t > $now - $window) $hits[] = $t;
    $new = null;
    $res = $fn($hits, $new);
    if (is_array($new)) {
        ftruncate($fp, 0); rewind($fp);
        fwrite($fp, json_encode(array_values($new)));
        fflush($fp);
    }
    flock($fp, LOCK_UN); fclose($fp);
    if (mt_rand(1, 50) === 1) {            // curățare ocazională a fișierelor vechi
        foreach (glob(dirname($path) . '/*.json') ?: [] as $f) if (@filemtime($f) < time() - 86400) @unlink($f);
    }
    return $res;
}
/* înregistrează o încercare ATOMIC și întoarce false dacă s-a depășit limita */
function rate_limit($bucket, $max, $window, $global = false) {
    return rl_locked(rl_path($bucket, $global), $window, function ($hits, &$new) use ($max) {
        if (count($hits) >= $max) return false;
        $hits[] = time();
        $new = $hits;
        return true;
    });
}
function rate_limit_or_die($bucket, $max, $window, $global = false) {
    if (!rate_limit($bucket, $max, $window, $global)) {
        header('Retry-After: ' . $window);
        err('Prea multe încercări. Încearcă din nou mai târziu.', 429);
    }
}
function rate_reset($bucket) { @unlink(rl_path($bucket)); }

/* ---------- sesiune admin (cookie HttpOnly + SameSite, token CSRF) ---------- */
function admin_session_start() {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('tib_admin');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_start();
    // expiră după 2 ore de inactivitate
    if (!empty($_SESSION['auth']) && time() - ($_SESSION['last'] ?? 0) > 7200) {
        $_SESSION = [];
        session_destroy();
        session_start();
    }
    if (!empty($_SESSION['auth'])) $_SESSION['last'] = time();
}
function admin_login($password) {
    $cfg  = app_config();
    $hash = (string)($cfg['payment']['admin_password_hash'] ?? '');
    if ($hash === '') err('Panoul de administrare nu este configurat (lipsește parola în config.local.php).', 503);

    // încercarea se numără ÎNAINTE de verificare (atomic) → nu se poate ocoli cu cereri paralele;
    // plus un plafon global, ca o rețea de IP-uri să nu poată ghici parola la nesfârșit
    if (!rate_limit('login', 5, 900) || !rate_limit('login_all', 60, 3600, true)) {
        header('Retry-After: 900');
        err('Prea multe încercări eșuate. Încearcă peste 15 minute.', 429);
    }
    if (!password_verify((string)$password, $hash)) {
        usleep(400000);
        err('Parolă incorectă.', 401);
    }
    rate_reset('login');
    admin_session_start();
    session_regenerate_id(true);
    $_SESSION['auth'] = true;
    $_SESSION['last'] = time();
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}
function admin_logout() {
    admin_session_start();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 3600, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}
function admin_authed() {
    admin_session_start();
    return !empty($_SESSION['auth']);
}
/* cere sesiune validă + token CSRF în antetul X-CSRF-Token */
function require_admin() {
    if (!admin_authed()) err('Sesiune expirată. Autentifică-te din nou.', 401);
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($sent) || !hash_equals((string)($_SESSION['csrf'] ?? ''), $sent)) err('Token CSRF invalid.', 403);
}

/* ---------- stocare JSON atomică (citire + modificare + scriere sub același lock) ---------- */
function store_read($path, $default) {
    if (!is_file($path)) return $default;
    $d = json_decode((string)file_get_contents($path), true);
    return is_array($d) ? $d : $default;
}
/* $fn primește datele prin referință; poate arunca RuntimeException ca să anuleze scrierea */
function store_modify($path, $default, callable $fn) {
    $dir = dirname($path);
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    $fp = fopen($path, 'c+');
    if (!$fp) err('Nu pot scrie datele pe server.', 500);
    flock($fp, LOCK_EX);
    $data = json_decode((string)stream_get_contents($fp), true);
    if (!is_array($data)) $data = $default;
    try {
        $result = $fn($data);
    } catch (RuntimeException $e) {
        flock($fp, LOCK_UN); fclose($fp);
        throw $e;
    }
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $result;
}
