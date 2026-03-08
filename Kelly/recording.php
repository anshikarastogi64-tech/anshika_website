<?php

declare(strict_types=1);

require __DIR__ . '/config.php';

$slug = isset($_GET['slug']) ? trim((string)$_GET['slug']) : '';

if ($slug === '') {
    http_response_code(404);
    echo '<!DOCTYPE html><html><head><title>Not Found</title></head><body><h1>Recording not found</h1><p>This link may be invalid or expired.</p></body></html>';
    exit;
}

$db = get_db();
$stmt = $db->prepare('SELECT id, slug, title, file_path FROM audio_recordings WHERE slug = :slug LIMIT 1');
$stmt->execute([':slug' => $slug]);
$recording = $stmt->fetch();

if (!$recording) {
    http_response_code(404);
    echo '<!DOCTYPE html><html><head><title>Not Found</title></head><body><h1>Recording not found</h1><p>This link may be invalid or expired.</p></body></html>';
    exit;
}

$audioUrl = $recording['file_path'];
$title = $recording['title'] ?: 'Audio Recording';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Listen – <?php echo htmlspecialchars($title, ENT_QUOTES, 'UTF-8'); ?></title>
    <link href="assets/vendor/bootstrap/css/bootstrap.min.css" rel="stylesheet">
    <link href="assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet">
    <style>
        body { min-height: 100vh; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: #eee; }
        .listen-card { max-width: 420px; margin: 0 auto; background: rgba(255,255,255,0.08); border-radius: 24px; backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); }
        .audio-wrapper { border-radius: 16px; overflow: hidden; background: rgba(0,0,0,0.2); }
        audio { width: 100%; height: 54px; }
        audio::-webkit-media-controls-panel { background: rgba(0,0,0,0.4); }
        .brand { font-size: 0.9rem; opacity: 0.8; }
    </style>
</head>
<body class="d-flex align-items-center justify-content-center p-4">
    <div class="text-center w-100">
        <div class="listen-card p-4 p-md-5 shadow-lg">
            <div class="mb-4">
                <i class="bi bi-music-note-beamed display-4 text-white-50"></i>
                <h1 class="h4 mt-2 mb-0"><?php echo htmlspecialchars($title, ENT_QUOTES, 'UTF-8'); ?></h1>
                <p class="brand mt-1 mb-0">Designers Vision</p>
            </div>
            <div class="audio-wrapper mb-3">
                <audio controls preload="metadata" class="w-100">
                    <source src="<?php echo htmlspecialchars($audioUrl, ENT_QUOTES, 'UTF-8'); ?>">
                    Your browser does not support the audio element.
                </audio>
            </div>
            <p class="small text-white-50 mb-0">Enjoy listening!</p>
        </div>
        <a href="index.html" class="btn btn-outline-light btn-sm mt-3">← Back to Home</a>
    </div>
</body>
</html>
