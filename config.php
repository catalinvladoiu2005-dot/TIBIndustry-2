<?php
/* ============================================================
   CONFIGURARE FORMULARE — editează doar acest fișier
   ============================================================ */
$config = [

    // Unde ajung mesajele, în funcție de tipul formularului
    'recipients' => [
        'cv'      => 'cariere@tibindustry.ro',   // CV-uri (pagina Cariere)
        'oferta'  => 'contact@tibindustry.ro',   // cereri de ofertă
        'contact' => 'contact@tibindustry.ro',   // mesaje de contact
    ],

    // Expeditor (trebuie să fie o adresă DE PE domeniul tău, ca să nu cadă în spam)
    'from_email' => 'no-reply@tibindustry.ro',
    'from_name'  => 'Site TibIndustry',

    // Trimite o copie a fiecărui mesaj și aici (lasă gol pentru a dezactiva)
    'bcc' => '',

    // Limite atașamente
    'max_file_bytes'  => 50 * 1024 * 1024,   // 50 MB / fișier
    'max_total_bytes' => 100 * 1024 * 1024,  // 100 MB total / mesaj

    // Plafoane de stocare pe server (data/uploads + submissions.json). La depășire, cererea
    // se trimite în continuare pe email, dar fără copie în panoul de admin.
    'max_store_bytes' => 2 * 1024 * 1024 * 1024,  // 2 GB atașamente salvate
    'max_submissions' => 5000,                    // număr maxim de cereri păstrate

    // Extensii permise (svg scos intenționat: poate conține JavaScript; zip scos: poate ascunde malware)
    'allowed_ext' => ['pdf','doc','docx','odt','rtf','txt','jpg','jpeg','png','webp','gif','heic','dwg','dxf'],

    // ATENȚIE: dacă folosești Cloudflare/proxy și lași false, toți vizitatorii au același IP
    // (limitele de rată se aplică tuturor odată). Dacă nu ai proxy, true permite falsificarea IP-ului.
    // Pune true DOAR dacă site-ul e în spatele unui proxy/CDN de încredere (ex. Cloudflare)
    // care setează X-Forwarded-For / X-Forwarded-Proto. Altfel lasă false.
    'trust_proxy' => false,

    // ---- Notificare instant pe Telegram (opțional) ----
    // SECRETELE (token, parolă admin) NU se scriu aici — se pun în config.local.php
    // (vezi config.local.example.php). Fișierul acela nu intră în git și e blocat din web.
    'telegram_token'   => '',
    'telegram_chat_id' => '',

    // ============================================================
    //  PLĂȚI — avans + sumă finală (prin transfer bancar)
    // ============================================================
    'payment' => [

        // Hash-ul parolei panoului de administrare (admin.html). Se setă în
        // config.local.php — vezi config.local.example.php pentru cum îl generezi.
        'admin_password_hash' => '',

        // Datele contului bancar afișate clientului (completează-le mai târziu)
        'bank' => [
            'beneficiary' => 'TibIndustry SRL',
            'iban'        => 'ROXX XXXX XXXX XXXX XXXX XXXX', // ← pune IBAN-ul tău
            'bank_name'   => 'Banca ta',
            'currency'    => 'RON',
        ],

        // După câte ZILE de la plata avansului devine valid codul pentru
        // plata sumei finale (clientul vede „codul devine valid pe ...").
        'final_unlock_days' => 7,

        // Procentul de avans sugerat automat în pagina de admin (poți schimba
        // suma manual la fiecare ofertă).
        'advance_percent_default' => 30,

        // Fișierul în care se salvează ofertele, codurile și statusul plăților.
        'data_file' => __DIR__ . '/data/payments.json',
    ],
];

// Valorile secrete: din config.local.php (sau variabile de mediu) suprascriu ce e mai sus
if (is_file(__DIR__ . '/config.local.php')) {
    $config = array_replace_recursive($config, require __DIR__ . '/config.local.php');
}
if (($h = getenv('TIB_ADMIN_PASSWORD_HASH')) !== false && $h !== '') $config['payment']['admin_password_hash'] = $h;
if (($t = getenv('TIB_TELEGRAM_TOKEN')) !== false && $t !== '')      $config['telegram_token'] = $t;

return $config;
