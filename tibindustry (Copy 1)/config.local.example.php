<?php
/* ============================================================
   SECRETE — copiază acest fișier ca config.local.php și completează.
   config.local.php NU se publică în git și e blocat din web (.htaccess).

   Generează hash-ul parolei de admin (pe calculatorul tău sau pe server):
       php -r 'echo password_hash(readline("Parola: "), PASSWORD_DEFAULT), "\n";'
   Folosește o parolă lungă (16+ caractere) și unică.
   ============================================================ */
return [
    'payment' => [
        'admin_password_hash' => '$2y$10$...lipește-aici-hash-ul...',
    ],
    // 'telegram_token'   => '',
    // 'telegram_chat_id' => '',
];
