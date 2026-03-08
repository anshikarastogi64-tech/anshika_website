<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';

require_admin_login();

$db = get_db();

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

$stmt = $db->prepare('SELECT id, title, image_path FROM services WHERE id = :id');
$stmt->execute([':id' => $id]);
$service = $stmt->fetch();

if (!$service) {
    header('Location: services.php');
    exit;
}

$message = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $title = isset($_POST['title']) ? trim((string)$_POST['title']) : '';
    $imagePath = isset($_POST['image_path']) ? trim((string)$_POST['image_path']) : '';

    if ($title !== '') {
        $update = $db->prepare(
            'UPDATE services SET title = :title, image_path = :image_path WHERE id = :id'
        );
        $update->execute([
            ':title'      => $title,
            ':image_path' => $imagePath,
            ':id'         => $id,
        ]);
        $message = 'Service updated.';

        $stmt = $db->prepare('SELECT id, title, image_path FROM services WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $service = $stmt->fetch();
    } else {
        $message = 'Title is required.';
    }
}

include __DIR__ . '/header.php';

?>

<div class="row">
    <div class="col-lg-8">
        <h1 class="h3 mb-4">Edit Service</h1>

        <?php if ($message !== ''): ?>
            <div class="alert alert-info"><?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>

        <form method="post">
            <div class="mb-3">
                <label class="form-label">Title</label>
                <input type="text" name="title" class="form-control"
                       value="<?php echo htmlspecialchars($service['title'], ENT_QUOTES, 'UTF-8'); ?>" required>
            </div>
            <div class="mb-3">
                <label class="form-label">Image Path (relative)</label>
                <input type="text" name="image_path" class="form-control"
                       value="<?php echo htmlspecialchars($service['image_path'], ENT_QUOTES, 'UTF-8'); ?>">
            </div>
            <button type="submit" class="btn btn-primary">Save Changes</button>
            <a href="services.php" class="btn btn-secondary">Back</a>
        </form>
    </div>
</div>

<?php include __DIR__ . '/footer.php'; ?>

