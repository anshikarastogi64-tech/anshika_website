<?php

declare(strict_types=1);

require __DIR__ . '/config.php';

$message = '';
$error = '';

$uploadDir = __DIR__ . '/uploads/womens-day';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = isset($_POST['name']) ? trim((string)$_POST['name']) : '';
    $email = isset($_POST['email']) ? trim((string)$_POST['email']) : '';
    $testimonial = isset($_POST['testimonial']) ? trim((string)$_POST['testimonial']) : '';
    $imagePath = '';

    if ($name === '') {
        $error = 'Please enter your name.';
    } else {
        if (isset($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES['photo'];
            $allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (in_array($file['type'], $allowed) && $file['size'] <= 5 * 1024 * 1024) {
                $ext = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';
                $filename = uniqid('wd_', true) . '.' . $ext;
                $dest = $uploadDir . '/' . $filename;
                if (move_uploaded_file($file['tmp_name'], $dest)) {
                    $imagePath = 'uploads/womens-day/' . $filename;
                }
            }
        }

        $db = get_db();
        $stmt = $db->prepare(
            'INSERT INTO womens_day_submissions (name, email, image_path, testimonial) VALUES (:name, :email, :image_path, :testimonial)'
        );
        $stmt->execute([
            ':name'       => $name,
            ':email'      => $email,
            ':image_path' => $imagePath,
            ':testimonial' => $testimonial,
        ]);
        $message = 'Thank you! Your submission has been shared. Happy Women\'s Day!';
    }
}

// Fetch approved submissions for display
$db = get_db();
$submissions = $db->query(
    "SELECT id, name, image_path, testimonial, created_at FROM womens_day_submissions WHERE approved = 1 AND (image_path != '' OR testimonial != '') ORDER BY created_at DESC LIMIT 24"
)->fetchAll();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Celebrating Women's Day – Designers Vision</title>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="assets/vendor/bootstrap/css/bootstrap.min.css" rel="stylesheet">
    <link href="assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet">
    <style>
        :root {
            --rose: #e8a4b8;
            --rose-deep: #d63384;
            --gold: #f4d58d;
            --cream: #fff8f0;
            --lavender: #c9b1bd;
            --plum: #723d46;
            --text-dark: #2d1b2e;
        }
        * { box-sizing: border-box; }
        body {
            font-family: 'Quicksand', sans-serif;
            background: linear-gradient(165deg, #fff8f5 0%, #fce4ec 30%, #f8bbd9 60%, #f48fb1 100%);
            min-height: 100vh;
            color: var(--text-dark);
            overflow-x: hidden;
        }
        .wd-hero {
            position: relative;
            padding: 5rem 2rem 4rem;
            text-align: center;
        }
        .wd-hero::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath fill='%23e8a4b8' fill-opacity='0.08' d='M50 10 Q60 30 50 50 Q40 70 50 90 Q70 70 50 50 Q30 30 50 10'/%3E%3C/svg%3E") repeat;
            opacity: 0.6;
        }
        .wd-hero h1 {
            font-family: 'Cormorant Garamond', serif;
            font-size: clamp(2.2rem, 5vw, 3.5rem);
            font-weight: 600;
            color: var(--plum);
            margin-bottom: 0.5rem;
        }
        .wd-hero .subtitle {
            font-size: 1.1rem;
            color: var(--rose-deep);
            letter-spacing: 0.3em;
            text-transform: uppercase;
        }
        .wd-card {
            background: rgba(255,255,255,0.85);
            border-radius: 24px;
            box-shadow: 0 12px 48px rgba(214,51,132,0.12);
            border: 1px solid rgba(232,164,184,0.4);
            overflow: hidden;
        }
        .wd-form-section {
            max-width: 540px;
            margin: 0 auto 3rem;
        }
        .wd-form-section h2 {
            font-family: 'Cormorant Garamond', serif;
            font-size: 1.6rem;
            color: var(--plum);
            margin-bottom: 1.5rem;
        }
        .wd-form-section .form-control, .wd-form-section .form-select {
            border-radius: 12px;
            border-color: rgba(214,51,132,0.2);
        }
        .wd-form-section .form-control:focus {
            border-color: var(--rose-deep);
            box-shadow: 0 0 0 0.25rem rgba(214,51,132,0.15);
        }
        .wd-btn {
            background: linear-gradient(135deg, var(--rose-deep), var(--rose));
            border: none;
            border-radius: 12px;
            padding: 0.75rem 2rem;
            font-weight: 600;
            color: white;
        }
        .wd-btn:hover { background: linear-gradient(135deg, var(--plum), var(--rose-deep)); color: white; }
        .wd-gallery {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 2rem;
        }
        .wd-gallery-item {
            border-radius: 16px;
            overflow: hidden;
            background: white;
            box-shadow: 0 8px 24px rgba(0,0,0,0.06);
            transition: transform 0.3s, box-shadow 0.3s;
        }
        .wd-gallery-item:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 32px rgba(214,51,132,0.2);
        }
        .wd-gallery-item .img-wrap {
            aspect-ratio: 4/3;
            min-height: 280px;
            overflow: hidden;
            background: linear-gradient(135deg, #fce4ec, #f8bbd9);
        }
        .wd-gallery-item .img-wrap img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .wd-gallery-item .img-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--rose);
            font-size: 3rem;
        }
        .wd-gallery-item .caption {
            padding: 1rem;
        }
        .wd-gallery-item .caption .name { font-weight: 600; color: var(--plum); }
        .wd-gallery-item .caption .testimonial { font-size: 0.9rem; color: #555; margin-top: 0.25rem; }
        .floating-petal {
            position: fixed;
            width: 20px; height: 20px;
            background: radial-gradient(circle, var(--rose), transparent);
            border-radius: 50%;
            opacity: 0.4;
            animation: float 8s ease-in-out infinite;
        }
        @keyframes float {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-30px) rotate(180deg); }
        }
        .nav-link-wd { color: var(--plum) !important; }
    </style>
</head>
<body>
    <div class="floating-petal" style="top:10%;left:5%;"></div>
    <div class="floating-petal" style="top:20%;right:8%;animation-delay:-2s;"></div>
    <div class="floating-petal" style="bottom:15%;left:10%;animation-delay:-4s;"></div>
    <div class="floating-petal" style="bottom:25%;right:5%;animation-delay:-6s;"></div>

    <nav class="navbar navbar-expand-lg navbar-light bg-transparent py-3">
        <div class="container">
            <a class="navbar-brand fw-bold nav-link-wd" href="index.html">Anshika</a>
            <a class="ms-auto btn btn-outline-secondary btn-sm" href="index.html">← Back to Home</a>
        </div>
    </nav>

    <section class="wd-hero">
        <div class="container position-relative">
            <h1>Celebrating Women's Day</h1>
            <p class="subtitle">March 8</p>
            <p class="mt-3 mx-auto" style="max-width: 480px;">
                Share your Women's Day moment with us — upload a photo of you with your gift and add a testimonial if you'd like.
            </p>
        </div>
    </section>

    <section class="container pb-5">
        <div class="wd-card p-4 p-md-5 wd-form-section">
            <?php if ($message): ?>
                <div class="alert alert-success border-0"><?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?></div>
            <?php endif; ?>
            <?php if ($error): ?>
                <div class="alert alert-danger border-0"><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></div>
            <?php endif; ?>

            <h2><i class="bi bi-heart-fill text-danger me-2"></i>Share Your Moment</h2>
            <form method="post" enctype="multipart/form-data">
                <div class="mb-3">
                    <label class="form-label">Your Name <span class="text-danger">*</span></label>
                    <input type="text" name="name" class="form-control" placeholder="Your name" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">Email (optional)</label>
                    <input type="email" name="email" class="form-control" placeholder="your@email.com">
                </div>
                <div class="mb-3">
                    <label class="form-label">Photo with your Women's Day gift</label>
                    <input type="file" name="photo" class="form-control" accept="image/jpeg,image/png,image/gif,image/webp">
                    <small class="text-muted">JPG, PNG, GIF or WebP. Max 5 MB.</small>
                </div>
                <div class="mb-4">
                    <label class="form-label">Testimonial <small class="text-muted">(optional — share your thoughts if you'd like)</small></label>
                    <textarea name="testimonial" class="form-control" rows="4" placeholder="What does Women's Day mean to you? Your experience with our gift..."></textarea>
                </div>
                <button type="submit" class="wd-btn btn">Submit</button>
            </form>
        </div>

        <?php if (!empty($submissions)): ?>
        <h2 class="text-center mb-4" style="font-family: 'Cormorant Garamond', serif; color: var(--plum);">
            <i class="bi bi-images me-2"></i>Community Gallery
        </h2>
        <div class="wd-gallery">
            <?php foreach ($submissions as $s): ?>
            <div class="wd-gallery-item">
                <div class="img-wrap">
                    <?php if ($s['image_path']): ?>
                        <img src="<?php echo htmlspecialchars($s['image_path'], ENT_QUOTES, 'UTF-8'); ?>" alt="<?php echo htmlspecialchars($s['name'], ENT_QUOTES, 'UTF-8'); ?>">
                    <?php else: ?>
                        <div class="img-placeholder"><i class="bi bi-person-badge"></i></div>
                    <?php endif; ?>
                </div>
                <div class="caption">
                    <div class="name"><?php echo htmlspecialchars($s['name'], ENT_QUOTES, 'UTF-8'); ?></div>
                    <?php if ($s['testimonial']): ?>
                        <div class="testimonial">"<?php echo htmlspecialchars($s['testimonial'], ENT_QUOTES, 'UTF-8'); ?>"</div>
                    <?php endif; ?>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>
    </section>

    <footer class="text-center py-4 text-muted small">
        <p class="mb-0">Happy Women's Day from Designers Vision</p>
    </footer>

    <script src="assets/vendor/bootstrap/js/bootstrap.bundle.min.js"></script>
</body>
</html>
