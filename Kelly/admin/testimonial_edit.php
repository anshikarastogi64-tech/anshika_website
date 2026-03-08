<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';

require_admin_login();

$db = get_db();

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

$stmt = $db->prepare('SELECT id, name, role, message FROM testimonials WHERE id = :id');
$stmt->execute([':id' => $id]);
$testimonial = $stmt->fetch();

if (!$testimonial) {
    header('Location: testimonials.php');
    exit;
}

$message = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = isset($_POST['name']) ? trim((string)$_POST['name']) : '';
    $role = isset($_POST['role']) ? trim((string)$_POST['role']) : '';
    $messageText = isset($_POST['message']) ? trim((string)$_POST['message']) : '';

    if ($name !== '' && $messageText !== '') {
        $update = $db->prepare(
            'UPDATE testimonials SET name = :name, role = :role, message = :message WHERE id = :id'
        );
        $update->execute([
            ':name'    => $name,
            ':role'    => $role,
            ':message' => $messageText,
            ':id'      => $id,
        ]);
        $message = 'Testimonial updated.';

        $stmt = $db->prepare('SELECT id, name, role, message FROM testimonials WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $testimonial = $stmt->fetch();
    } else {
        $message = 'Name and message are required.';
    }
}

include __DIR__ . '/header.php';

?>

<div class="row">
    <div class="col-lg-8">
        <h1 class="h3 mb-4">Edit Testimonial</h1>

        <?php if ($message !== ''): ?>
            <div class="alert alert-info"><?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>

        <form method="post">
            <div class="mb-3">
                <label class="form-label">Name</label>
                <input type="text" name="name" class="form-control"
                       value="<?php echo htmlspecialchars($testimonial['name'], ENT_QUOTES, 'UTF-8'); ?>" required>
            </div>
            <div class="mb-3">
                <label class="form-label">Role / Title</label>
                <input type="text" name="role" class="form-control"
                       value="<?php echo htmlspecialchars($testimonial['role'], ENT_QUOTES, 'UTF-8'); ?>">
            </div>
            <div class="mb-3">
                <label class="form-label">Message</label>
                <textarea name="message" rows="5" class="form-control" required><?php
                    echo htmlspecialchars($testimonial['message'], ENT_QUOTES, 'UTF-8');
                ?></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Save Changes</button>
            <a href="testimonials.php" class="btn btn-secondary">Back</a>
        </form>
    </div>
</div>

<?php include __DIR__ . '/footer.php'; ?>

