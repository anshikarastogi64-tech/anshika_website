<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';

require_admin_login();

$message = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $title = isset($_POST['title']) ? trim((string)$_POST['title']) : '';
    $paragraph = isset($_POST['paragraph']) ? trim((string)$_POST['paragraph']) : '';

    save_block('about', 'intro', 'title', $title);
    save_block('about', 'intro', 'paragraph', $paragraph);

    $message = 'About content updated successfully.';
}

$title = get_block('about', 'intro', 'title', 'About');
$paragraph = get_block(
    'about',
    'intro',
    'paragraph',
    'Interior design is the art and science of enhancing interior spaces to achieve a more aesthetically pleasing and functional environment.'
);

include __DIR__ . '/header.php';

?>

<div class="row">
    <div class="col-lg-8">
        <h1 class="h3 mb-4">Edit About Page Intro</h1>

        <?php if ($message !== ''): ?>
            <div class="alert alert-success"><?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>

        <form method="post">
            <div class="mb-3">
                <label for="title" class="form-label">Section Title</label>
                <input type="text" id="title" name="title" class="form-control"
                       value="<?php echo htmlspecialchars($title, ENT_QUOTES, 'UTF-8'); ?>">
            </div>
            <div class="mb-3">
                <label for="paragraph" class="form-label">Intro Paragraph</label>
                <textarea id="paragraph" name="paragraph" rows="5" class="form-control"><?php
                    echo htmlspecialchars($paragraph, ENT_QUOTES, 'UTF-8');
                ?></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Save About Content</button>
        </form>
    </div>
</div>

<?php include __DIR__ . '/footer.php'; ?>

