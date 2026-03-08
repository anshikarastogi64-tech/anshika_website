<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';

require_admin_login();

$db = get_db();
$message = '';

// Handle delete action
if (isset($_GET['delete'])) {
    $id = (int)$_GET['delete'];
    $stmt = $db->prepare('DELETE FROM testimonials WHERE id = :id');
    $stmt->execute([':id' => $id]);
    $message = 'Testimonial deleted.';
}

// Handle add action
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = isset($_POST['name']) ? trim((string)$_POST['name']) : '';
    $role = isset($_POST['role']) ? trim((string)$_POST['role']) : '';
    $messageText = isset($_POST['message']) ? trim((string)$_POST['message']) : '';

    if ($name !== '' && $messageText !== '') {
        $stmt = $db->prepare(
            'INSERT INTO testimonials (name, role, message, sort_order) VALUES (:name, :role, :message, 0)'
        );
        $stmt->execute([
            ':name'    => $name,
            ':role'    => $role,
            ':message' => $messageText,
        ]);
        $message = 'Testimonial added.';
    } else {
        $message = 'Name and message are required.';
    }
}

$testimonials = $db->query('SELECT id, name, role, message FROM testimonials ORDER BY sort_order ASC, id DESC')
                   ->fetchAll();

include __DIR__ . '/header.php';

?>

<div class="row">
    <div class="col-lg-7">
        <h1 class="h3 mb-4">Testimonials</h1>

        <?php if ($message !== ''): ?>
            <div class="alert alert-info"><?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>

        <table class="table table-sm table-striped align-middle">
            <thead>
            <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Message (preview)</th>
                <th style="width: 80px;">Actions</th>
            </tr>
            </thead>
            <tbody>
            <?php if (!$testimonials): ?>
                <tr>
                    <td colspan="4" class="text-muted">No testimonials yet.</td>
                </tr>
            <?php else: ?>
                <?php foreach ($testimonials as $t): ?>
                    <tr>
                        <td><?php echo htmlspecialchars($t['name'], ENT_QUOTES, 'UTF-8'); ?></td>
                        <td><?php echo htmlspecialchars($t['role'], ENT_QUOTES, 'UTF-8'); ?></td>
                        <td><?php echo htmlspecialchars(mb_substr($t['message'], 0, 80), ENT_QUOTES, 'UTF-8'); ?><?php
                            echo (mb_strlen($t['message']) > 80 ? '…' : '');
                        ?></td>
                        <td>
                            <a class="btn btn-sm btn-outline-secondary"
                               href="testimonial_edit.php?id=<?php echo (int)$t['id']; ?>">Edit</a>
                            <a class="btn btn-sm btn-outline-danger"
                               href="testimonials.php?delete=<?php echo (int)$t['id']; ?>"
                               onclick="return confirm('Delete this testimonial?');">Del</a>
                        </td>
                    </tr>
                <?php endforeach; ?>
            <?php endif; ?>
            </tbody>
        </table>
    </div>
    <div class="col-lg-5">
        <h2 class="h5 mb-3">Add New Testimonial</h2>
        <form method="post">
            <div class="mb-3">
                <label for="name" class="form-label">Name</label>
                <input type="text" id="name" name="name" class="form-control" required>
            </div>
            <div class="mb-3">
                <label for="role" class="form-label">Role / Title</label>
                <input type="text" id="role" name="role" class="form-control">
            </div>
            <div class="mb-3">
                <label for="message" class="form-label">Message</label>
                <textarea id="message" name="message" rows="4" class="form-control" required></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Add Testimonial</button>
        </form>
    </div>
</div>

<?php include __DIR__ . '/footer.php'; ?>

