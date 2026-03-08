<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';

require_admin_login();

$db = get_db();
$message = '';

// Toggle approval
if (isset($_GET['toggle'])) {
    $id = (int)$_GET['toggle'];
    $stmt = $db->prepare('UPDATE womens_day_submissions SET approved = 1 - approved WHERE id = :id');
    $stmt->execute([':id' => $id]);
    $message = 'Submission updated.';
}

// Delete
if (isset($_GET['delete'])) {
    $id = (int)$_GET['delete'];
    $stmt = $db->prepare('SELECT image_path FROM womens_day_submissions WHERE id = :id');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();
    if ($row && $row['image_path']) {
        $path = __DIR__ . '/../' . $row['image_path'];
        if (file_exists($path)) unlink($path);
    }
    $stmt = $db->prepare('DELETE FROM womens_day_submissions WHERE id = :id');
    $stmt->execute([':id' => $id]);
    $message = 'Submission deleted.';
}

$submissions = $db->query(
    'SELECT id, name, email, image_path, testimonial, approved, created_at FROM womens_day_submissions ORDER BY created_at DESC'
)->fetchAll();

include __DIR__ . '/header.php';

?>

<div class="row">
    <div class="col-12">
        <h1 class="h3 mb-4">Women's Day Submissions</h1>
        <p class="mb-4">
            Photos and testimonials submitted on the Women's Day special page.
        </p>

        <?php if ($message !== ''): ?>
            <div class="alert alert-info"><?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>

        <div class="mb-3">
            <a href="../womens-day.php" target="_blank" class="btn btn-sm btn-outline-primary">View Public Page</a>
        </div>
    </div>
</div>

<div class="row">
    <?php if (empty($submissions)): ?>
        <div class="col-12">
            <p class="text-muted">No submissions yet.</p>
        </div>
    <?php else: ?>
        <?php foreach ($submissions as $s): ?>
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="card h-100">
                <?php if ($s['image_path']): ?>
                    <img src="../<?php echo htmlspecialchars($s['image_path'], ENT_QUOTES, 'UTF-8'); ?>" class="card-img-top" alt="" style="height: 280px; object-fit: cover;">
                <?php else: ?>
                    <div class="card-img-top bg-light d-flex align-items-center justify-content-center" style="height: 280px;">
                        <i class="bi bi-person display-4 text-muted"></i>
                    </div>
                <?php endif; ?>
                <div class="card-body">
                    <h5 class="card-title"><?php echo htmlspecialchars($s['name'], ENT_QUOTES, 'UTF-8'); ?></h5>
                    <?php if ($s['email']): ?>
                        <p class="card-text small text-muted"><?php echo htmlspecialchars($s['email'], ENT_QUOTES, 'UTF-8'); ?></p>
                    <?php endif; ?>
                    <?php if ($s['testimonial']): ?>
                        <p class="card-text small">"<?php echo htmlspecialchars($s['testimonial'], ENT_QUOTES, 'UTF-8'); ?>"</p>
                    <?php endif; ?>
                    <p class="card-text small text-muted"><?php echo htmlspecialchars(date('M j, Y g:i A', strtotime($s['created_at'])), ENT_QUOTES, 'UTF-8'); ?></p>
                    <div class="d-flex gap-1">
                        <a href="womens_day.php?toggle=<?php echo (int)$s['id']; ?>" class="btn btn-sm btn-outline-<?php echo $s['approved'] ? 'warning' : 'success'; ?>">
                            <?php echo $s['approved'] ? 'Hide' : 'Show'; ?>
                        </a>
                        <a href="womens_day.php?delete=<?php echo (int)$s['id']; ?>" class="btn btn-sm btn-outline-danger" onclick="return confirm('Delete this submission?');">Delete</a>
                    </div>
                </div>
            </div>
        </div>
        <?php endforeach; ?>
    <?php endif; ?>
</div>

<?php include __DIR__ . '/footer.php'; ?>
