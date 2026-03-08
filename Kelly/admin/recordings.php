<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';

require_admin_login();

$db = get_db();
$message = '';
$error = '';

$uploadDir = __DIR__ . '/../uploads/recordings';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Handle delete
if (isset($_GET['delete'])) {
    $id = (int)$_GET['delete'];
    $stmt = $db->prepare('SELECT file_path FROM audio_recordings WHERE id = :id');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();
    if ($row && $row['file_path']) {
        $filePath = __DIR__ . '/../' . $row['file_path'];
        if (file_exists($filePath)) {
            unlink($filePath);
        }
    }
    $stmt = $db->prepare('DELETE FROM audio_recordings WHERE id = :id');
    $stmt->execute([':id' => $id]);
    $message = 'Recording deleted.';
}

// Handle upload
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['audio_file'])) {
    $title = isset($_POST['title']) ? trim((string)$_POST['title']) : 'Recording';
    $file = $_FILES['audio_file'];

    $allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/x-wav', 'audio/mp4'];
    $maxSize = 50 * 1024 * 1024; // 50 MB

    if ($file['error'] !== UPLOAD_ERR_OK) {
        $error = 'Upload failed. Error code: ' . $file['error'];
    } elseif ($file['size'] > $maxSize) {
        $error = 'File too large. Maximum 50 MB.';
    } elseif (!in_array($file['type'], $allowedTypes) && !preg_match('/\.(mp3|wav|ogg|webm|m4a)$/i', $file['name'])) {
        $error = 'Invalid file type. Allowed: MP3, WAV, OGG, WebM, M4A.';
    } else {
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION)) ?: 'mp3';
        $slug = bin2hex(random_bytes(8));
        $filename = $slug . '.' . $ext;
        $destPath = $uploadDir . '/' . $filename;
        $relativePath = 'uploads/recordings/' . $filename;

        if (move_uploaded_file($file['tmp_name'], $destPath)) {
            $stmt = $db->prepare(
                'INSERT INTO audio_recordings (slug, title, file_path) VALUES (:slug, :title, :file_path)'
            );
            $stmt->execute([
                ':slug'     => $slug,
                ':title'    => $title,
                ':file_path' => $relativePath,
            ]);
            $message = 'Recording uploaded! Share the QR code below with users.';
        } else {
            $error = 'Could not save file.';
        }
    }
}

$recordings = $db->query(
    'SELECT id, slug, title, file_path, created_at FROM audio_recordings ORDER BY created_at DESC'
)->fetchAll();

function get_listen_url(string $slug): string
{
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $base = dirname(dirname($_SERVER['SCRIPT_NAME'] ?? ''));
    $base = rtrim($base, '/');
    return $protocol . '://' . $host . $base . '/recording.php?slug=' . urlencode($slug);
}

include __DIR__ . '/header.php';

?>

<div class="row">
    <div class="col-12">
        <h1 class="h3 mb-4">Audio Recordings & QR Codes</h1>
        <p class="mb-4">
            Upload audio recordings. Each recording gets a unique QR code. Share the QR code with users—when they scan it, they can listen to the recording.
        </p>

        <?php if ($message !== ''): ?>
            <div class="alert alert-success"><?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>
        <?php if ($error !== ''): ?>
            <div class="alert alert-danger"><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>
    </div>
</div>

<div class="row">
    <div class="col-lg-5 mb-4">
        <div class="card">
            <div class="card-header"><strong>Upload New Recording</strong></div>
            <div class="card-body">
                <form method="post" enctype="multipart/form-data">
                    <div class="mb-3">
                        <label class="form-label">Title (optional)</label>
                        <input type="text" name="title" class="form-control" placeholder="e.g. Special Message">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Audio File (MP3, WAV, OGG, M4A – max 50 MB)</label>
                        <input type="file" name="audio_file" class="form-control" accept="audio/*" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Upload & Generate QR Code</button>
                </form>
            </div>
        </div>
    </div>
    <div class="col-lg-7">
        <div class="card">
            <div class="card-header"><strong>Your Recordings</strong></div>
            <div class="card-body p-0">
                <?php if (empty($recordings)): ?>
                    <p class="p-4 text-muted mb-0">No recordings yet. Upload one above.</p>
                <?php else: ?>
                    <div class="table-responsive">
                        <table class="table table-sm table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Date</th>
                                    <th>QR Code</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($recordings as $r): ?>
                                    <?php
                                    $listenUrl = get_listen_url($r['slug']);
                                    $qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' . urlencode($listenUrl);
                                    ?>
                                    <tr>
                                        <td><?php echo htmlspecialchars($r['title'] ?: 'Recording', ENT_QUOTES, 'UTF-8'); ?></td>
                                        <td><?php echo htmlspecialchars(date('M j, Y', strtotime($r['created_at'])), ENT_QUOTES, 'UTF-8'); ?></td>
                                        <td>
                                            <a href="<?php echo htmlspecialchars($listenUrl, ENT_QUOTES, 'UTF-8'); ?>" target="_blank" title="Open link - Right-click to save QR for printing">
                                                <img src="<?php echo htmlspecialchars($qrUrl, ENT_QUOTES, 'UTF-8'); ?>" alt="QR Code" width="140" height="140" class="border">
                                            </a>
                                        </td>
                                        <td>
                                            <a href="<?php echo htmlspecialchars($listenUrl, ENT_QUOTES, 'UTF-8'); ?>" target="_blank" class="btn btn-sm btn-outline-primary" title="Copy & share this link">Link</a>
                                            <a href="recordings.php?delete=<?php echo (int)$r['id']; ?>" class="btn btn-sm btn-outline-danger"
                                               onclick="return confirm('Delete this recording?');">Del</a>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>

<?php include __DIR__ . '/footer.php'; ?>
