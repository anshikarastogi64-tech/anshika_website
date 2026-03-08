<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';

require_admin_login();

$db = get_db();
$message = '';

// Handle delete
if (isset($_GET['delete'])) {
    $id = (int)$_GET['delete'];
    $stmt = $db->prepare('DELETE FROM services WHERE id = :id');
    $stmt->execute([':id' => $id]);
    $message = 'Service deleted.';
}

// Handle add
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $title = isset($_POST['title']) ? trim((string)$_POST['title']) : '';
    $imagePath = isset($_POST['image_path']) ? trim((string)$_POST['image_path']) : '';

    if ($title !== '') {
        $stmt = $db->prepare(
            'INSERT INTO services (title, image_path, sort_order) VALUES (:title, :image_path, 0)'
        );
        $stmt->execute([
            ':title'      => $title,
            ':image_path' => $imagePath,
        ]);
        $message = 'Service added.';
    } else {
        $message = 'Title is required.';
    }
}

$services = $db->query('SELECT id, title, image_path FROM services ORDER BY sort_order ASC, id DESC')
               ->fetchAll();

include __DIR__ . '/header.php';

?>

<div class="row">
    <div class="col-lg-7">
        <h1 class="h3 mb-4">Services</h1>

        <?php if ($message !== ''): ?>
            <div class="alert alert-info"><?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>

        <table class="table table-sm table-striped align-middle">
            <thead>
            <tr>
                <th>Title</th>
                <th>Image Path</th>
                <th style="width: 80px;">Actions</th>
            </tr>
            </thead>
            <tbody>
            <?php if (!$services): ?>
                <tr><td colspan="3" class="text-muted">No services yet.</td></tr>
            <?php else: ?>
                <?php foreach ($services as $s): ?>
                    <tr>
                        <td><?php echo htmlspecialchars($s['title'], ENT_QUOTES, 'UTF-8'); ?></td>
                        <td><?php echo htmlspecialchars($s['image_path'], ENT_QUOTES, 'UTF-8'); ?></td>
                        <td>
                            <a class="btn btn-sm btn-outline-secondary"
                               href="service_edit.php?id=<?php echo (int)$s['id']; ?>">Edit</a>
                            <a class="btn btn-sm btn-outline-danger"
                               href="services.php?delete=<?php echo (int)$s['id']; ?>"
                               onclick="return confirm('Delete this service?');">Del</a>
                        </td>
                    </tr>
                <?php endforeach; ?>
            <?php endif; ?>
            </tbody>
        </table>
    </div>
    <div class="col-lg-5">
        <h2 class="h5 mb-3">Add New Service</h2>
        <form method="post">
            <div class="mb-3">
                <label for="title" class="form-label">Title</label>
                <input type="text" id="title" name="title" class="form-control" required>
            </div>
            <div class="mb-3">
                <label for="image_path" class="form-label">Image Path (relative)</label>
                <input type="text" id="image_path" name="image_path" class="form-control"
                       placeholder="e.g. assets/img/services/File 10.jpg">
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Add Service</button>
        </form>
        <p class="mt-3 text-muted small">
            Image uploads can be added later; for now, paste the path to an existing image under
            <code>assets/img/...</code>.
        </p>
    </div>
</div>

<?php include __DIR__ . '/footer.php'; ?>

