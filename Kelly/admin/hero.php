<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';

require_admin_login();

$message = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $greeting = isset($_POST['greeting']) ? trim((string)$_POST['greeting']) : '';
    $name = isset($_POST['name']) ? trim((string)$_POST['name']) : '';
    $line1 = isset($_POST['line1']) ? trim((string)$_POST['line1']) : '';
    $line2 = isset($_POST['line2']) ? trim((string)$_POST['line2']) : '';
    $line3 = isset($_POST['line3']) ? trim((string)$_POST['line3']) : '';

    save_block('home', 'hero', 'greeting', $greeting);
    save_block('home', 'hero', 'name', $name);
    save_block('home', 'hero', 'line1', $line1);
    save_block('home', 'hero', 'line2', $line2);
    save_block('home', 'hero', 'line3', $line3);

    $message = 'Hero content updated successfully.';
}

$greeting = get_block('home', 'hero', 'greeting', 'Hi, I am');
$name = get_block('home', 'hero', 'name', 'Anshika Rastogi');
$line1 = get_block('home', 'hero', 'line1', 'A professional Interior Designer and Interior Consultant from India');
$line2 = get_block('home', 'hero', 'line2', 'A creative Artist, Love to paint my thoughts on Canvas and Walls');
$line3 = get_block('home', 'hero', 'line3', 'A beautiful Classical Dancer');

include __DIR__ . '/header.php';

?>

<div class="row">
    <div class="col-lg-8">
        <h1 class="h3 mb-4">Edit Home Hero Section</h1>

        <?php if ($message !== ''): ?>
            <div class="alert alert-success"><?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>

        <form method="post">
            <div class="mb-3">
                <label for="greeting" class="form-label">Greeting (small text)</label>
                <input type="text" id="greeting" name="greeting" class="form-control"
                       value="<?php echo htmlspecialchars($greeting, ENT_QUOTES, 'UTF-8'); ?>">
            </div>
            <div class="mb-3">
                <label for="name" class="form-label">Name (big heading)</label>
                <input type="text" id="name" name="name" class="form-control"
                       value="<?php echo htmlspecialchars($name, ENT_QUOTES, 'UTF-8'); ?>">
            </div>
            <div class="mb-3">
                <label for="line1" class="form-label">Line 1</label>
                <input type="text" id="line1" name="line1" class="form-control"
                       value="<?php echo htmlspecialchars($line1, ENT_QUOTES, 'UTF-8'); ?>">
            </div>
            <div class="mb-3">
                <label for="line2" class="form-label">Line 2</label>
                <input type="text" id="line2" name="line2" class="form-control"
                       value="<?php echo htmlspecialchars($line2, ENT_QUOTES, 'UTF-8'); ?>">
            </div>
            <div class="mb-3">
                <label for="line3" class="form-label">Line 3</label>
                <input type="text" id="line3" name="line3" class="form-control"
                       value="<?php echo htmlspecialchars($line3, ENT_QUOTES, 'UTF-8'); ?>">
            </div>
            <button type="submit" class="btn btn-primary">Save Hero Content</button>
        </form>
    </div>
</div>

<?php include __DIR__ . '/footer.php'; ?>

