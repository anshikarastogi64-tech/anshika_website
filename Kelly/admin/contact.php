<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';

require_admin_login();

$message = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $address = isset($_POST['address']) ? trim((string)$_POST['address']) : '';
    $email = isset($_POST['email']) ? trim((string)$_POST['email']) : '';
    $phone = isset($_POST['phone']) ? trim((string)$_POST['phone']) : '';

    save_block('contact', 'info', 'address', $address);
    save_block('contact', 'info', 'email', $email);
    save_block('contact', 'info', 'phone', $phone);

    $message = 'Contact information updated successfully.';
}

$address = get_block(
    'contact',
    'info',
    'address',
    'Honer Vivantis, Tellapur Road, Hyderabad, India, 500019'
);
$email = get_block('contact', 'info', 'email', 'info@designersvision.com');
$phone = get_block('contact', 'info', 'phone', '+91 9557058902');

include __DIR__ . '/header.php';

?>

<div class="row">
    <div class="col-lg-8">
        <h1 class="h3 mb-4">Edit Contact Information</h1>

        <?php if ($message !== ''): ?>
            <div class="alert alert-success"><?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>

        <form method="post">
            <div class="mb-3">
                <label for="address" class="form-label">Address</label>
                <textarea id="address" name="address" rows="3" class="form-control"><?php
                    echo htmlspecialchars($address, ENT_QUOTES, 'UTF-8');
                ?></textarea>
            </div>
            <div class="mb-3">
                <label for="email" class="form-label">Email</label>
                <input type="email" id="email" name="email" class="form-control"
                       value="<?php echo htmlspecialchars($email, ENT_QUOTES, 'UTF-8'); ?>">
            </div>
            <div class="mb-3">
                <label for="phone" class="form-label">Phone</label>
                <input type="text" id="phone" name="phone" class="form-control"
                       value="<?php echo htmlspecialchars($phone, ENT_QUOTES, 'UTF-8'); ?>">
            </div>
            <button type="submit" class="btn btn-primary">Save Contact Info</button>
        </form>
    </div>
</div>

<?php include __DIR__ . '/footer.php'; ?>

