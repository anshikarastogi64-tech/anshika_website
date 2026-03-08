<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';

global $ASSETS_BASE;
$assetsBase = $ASSETS_BASE ?? '..';

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Admin Panel - Designers Vision</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="<?php echo htmlspecialchars(rtrim($assetsBase, '/') . '/assets/vendor/bootstrap/css/bootstrap.min.css', ENT_QUOTES, 'UTF-8'); ?>" rel="stylesheet">
    <link href="<?php echo htmlspecialchars(rtrim($assetsBase, '/') . '/assets/vendor/bootstrap-icons/bootstrap-icons.css', ENT_QUOTES, 'UTF-8'); ?>" rel="stylesheet">
    <style>
        body {
            background-color: #f8f9fa;
            min-height: 100vh;
        }
        .admin-navbar {
            margin-bottom: 2rem;
        }
        #admin-content {
            padding-top: 1rem;
            min-height: 400px;
        }
        .admin-section-card {
            background: #fff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
    </style>
</head>
<body>
<nav class="navbar navbar-expand-lg navbar-dark bg-dark admin-navbar">
    <div class="container-fluid">
        <a class="navbar-brand" href="dashboard.php">Admin - Designers Vision</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#adminNav"
                aria-controls="adminNav" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="adminNav">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                <li class="nav-item"><a class="nav-link" href="dashboard.php">Dashboard</a></li>
                <li class="nav-item"><a class="nav-link" href="hero.php">Home Hero</a></li>
                <li class="nav-item"><a class="nav-link" href="about.php">About</a></li>
                <li class="nav-item"><a class="nav-link" href="services.php">Services</a></li>
                <li class="nav-item"><a class="nav-link" href="testimonials.php">Testimonials</a></li>
                <li class="nav-item"><a class="nav-link" href="recordings.php">Audio & QR</a></li>
                <li class="nav-item"><a class="nav-link" href="womens_day.php">Women's Day</a></li>
                <li class="nav-item"><a class="nav-link" href="contact.php">Contact Info</a></li>
            </ul>
            <span class="navbar-text me-3">
                <?php if (is_admin_logged_in()): ?>
                    Logged in as <?php echo htmlspecialchars(current_admin_username(), ENT_QUOTES, 'UTF-8'); ?>
                <?php endif; ?>
            </span>
            <?php if (is_admin_logged_in()): ?>
                <a href="logout.php" class="btn btn-outline-light btn-sm">Logout</a>
            <?php endif; ?>
        </div>
    </div>
</nav>
<div id="admin-content" class="container mb-5">

