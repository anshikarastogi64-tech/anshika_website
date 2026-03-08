<?php

// One-time (or repeatable) database initialisation script.
// Visit this file in the browser (e.g. /Kelly/init_db.php) to create tables
// and seed some initial content. It is safe to run multiple times.

declare(strict_types=1);

require __DIR__ . '/config.php';

$db = get_db();

// Wrap everything in a transaction so we either fully apply schema changes or not at all.
$db->beginTransaction();

// Admin users table
$db->exec(
    'CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )'
);

// Small text blocks (titles, paragraphs, etc.)
$db->exec(
    'CREATE TABLE IF NOT EXISTS content_blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page TEXT NOT NULL,
        section TEXT NOT NULL,
        block_key TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT "",
        UNIQUE(page, section, block_key)
    )'
);

// Testimonials slider on About page
$db->exec(
    'CREATE TABLE IF NOT EXISTS testimonials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT DEFAULT "",
        message TEXT NOT NULL,
        image_path TEXT DEFAULT "",
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )'
);

// Services grid
$db->exec(
    'CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        image_path TEXT DEFAULT "",
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )'
);

// Portfolio items (optional, can be wired up later)
$db->exec(
    'CREATE TABLE IF NOT EXISTS portfolio_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        image_path TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )'
);

// Global site settings such as contact info
$db->exec(
    'CREATE TABLE IF NOT EXISTS site_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT NOT NULL UNIQUE,
        setting_value TEXT NOT NULL
    )'
);

// Audio recordings for QR code sharing
$db->exec(
    'CREATE TABLE IF NOT EXISTS audio_recordings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT DEFAULT "",
        file_path TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )'
);

// Women's Day submissions (photo + testimonial)
$db->exec(
    'CREATE TABLE IF NOT EXISTS womens_day_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT DEFAULT "",
        image_path TEXT DEFAULT "",
        testimonial TEXT DEFAULT "",
        approved INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )'
);

// Seed default admin user if none exists
$stmt = $db->query('SELECT COUNT(*) AS cnt FROM admins');
$row = $stmt->fetch();

if (!$row || (int)$row['cnt'] === 0) {
    $username = 'admin';
    $passwordPlain = 'Admin@123'; // You should change this after first login
    $passwordHash = password_hash($passwordPlain, PASSWORD_DEFAULT);

    $insert = $db->prepare('INSERT INTO admins (username, password_hash) VALUES (:u, :p)');
    $insert->execute([':u' => $username, ':p' => $passwordHash]);
}

// Seed some key content blocks only if they don't exist yet
function seed_block(PDO $db, string $page, string $section, string $key, string $content): void
{
    $stmt = $db->prepare(
        'INSERT OR IGNORE INTO content_blocks (page, section, block_key, content)
         VALUES (:page, :section, :block_key, :content)'
    );
    $stmt->execute([
        ':page'      => $page,
        ':section'   => $section,
        ':block_key' => $key,
        ':content'   => $content,
    ]);
}

// Hero section (home page)
seed_block(
    $db,
    'home',
    'hero',
    'greeting',
    'Hi, I am'
);
seed_block(
    $db,
    'home',
    'hero',
    'name',
    'Anshika Rastogi'
);
seed_block(
    $db,
    'home',
    'hero',
    'line1',
    'A professional Interior Designer and Interior Consultant from India'
);
seed_block(
    $db,
    'home',
    'hero',
    'line2',
    'A creative Artist, Love to paint my thoughts on Canvas and Walls'
);
seed_block(
    $db,
    'home',
    'hero',
    'line3',
    'A beautiful Classical Dancer'
);

// About page intro text
seed_block(
    $db,
    'about',
    'intro',
    'title',
    'About'
);
seed_block(
    $db,
    'about',
    'intro',
    'paragraph',
    'Interior design is the art and science of enhancing interior spaces to achieve a more aesthetically pleasing and functional environment.'
);

// Contact info
seed_block(
    $db,
    'contact',
    'info',
    'address',
    'Honer Vivantis, Tellapur Road, Hyderabad, India, 500019'
);
seed_block(
    $db,
    'contact',
    'info',
    'email',
    'info@designersvision.com'
);
seed_block(
    $db,
    'contact',
    'info',
    'phone',
    '+91 9557058902'
);

// Site footer owner name
seed_block(
    $db,
    'global',
    'footer',
    'owner_name',
    'Anshika Rastogi'
);

$db->commit();

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Database initialised</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="assets/vendor/bootstrap/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-lg-6">
            <div class="card shadow-sm">
                <div class="card-body">
                    <h1 class="h4 mb-3">Database initialised</h1>
                    <p class="mb-3">
                        The CMS tables have been created (or already existed), and a default admin user was ensured.
                    </p>
                    <ul>
                        <li><strong>Username</strong>: admin</li>
                        <li><strong>Temporary password</strong>: Admin@123</li>
                    </ul>
                    <p class="mb-3">
                        You can now navigate to the admin login page once it is created (for example
                        <code>/Kelly/admin/login.php</code>).
                    </p>
                    <p class="text-muted mb-0">
                        For security, you should delete or restrict access to this <code>init_db.php</code> file
                        after deployment.
                    </p>
                </div>
            </div>
        </div>
    </div>
</div>
</body>
</html>

