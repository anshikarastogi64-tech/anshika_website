<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';

require_admin_login();

include __DIR__ . '/header.php';

?>

<div class="row">
    <div class="col-12">
        <h1 class="h3 mb-4">Admin Dashboard</h1>
        <p class="mb-4">
            Use the sections below to update the content that appears on your public website.
        </p>
    </div>
</div>

<div class="row g-3">
    <div class="col-md-4">
        <div class="card h-100 admin-section-card">
            <div class="card-body">
                <h2 class="h5 card-title">Home Hero</h2>
                <p class="card-text">Edit the main hero text on the home page (name, greeting, and taglines).</p>
                <a href="hero.php" class="btn btn-sm btn-primary">Manage Hero</a>
            </div>
        </div>
    </div>
    <div class="col-md-4">
        <div class="card h-100 admin-section-card">
            <div class="card-body">
                <h2 class="h5 card-title">About</h2>
                <p class="card-text">Control the About page title and introductory text.</p>
                <a href="about.php" class="btn btn-sm btn-primary">Manage About</a>
            </div>
        </div>
    </div>
    <div class="col-md-4">
        <div class="card h-100 admin-section-card">
            <div class="card-body">
                <h2 class="h5 card-title">Contact Info</h2>
                <p class="card-text">Update the address, email, and phone number shown on the Contact page.</p>
                <a href="contact.php" class="btn btn-sm btn-primary">Manage Contact Info</a>
            </div>
        </div>
    </div>
    <div class="col-md-4">
        <div class="card h-100 admin-section-card">
            <div class="card-body">
                <h2 class="h5 card-title">Services</h2>
                <p class="card-text">Add, edit, or remove services shown on the Services page.</p>
                <a href="services.php" class="btn btn-sm btn-primary">Manage Services</a>
            </div>
        </div>
    </div>
    <div class="col-md-4">
        <div class="card h-100 admin-section-card border-primary">
            <div class="card-body">
                <h2 class="h5 card-title"><i class="bi bi-mic-fill me-1"></i> Audio Recordings & QR</h2>
                <p class="card-text">Upload audio recordings and generate unique QR codes to share with users.</p>
                <a href="recordings.php" class="btn btn-sm btn-primary">Upload Audio & Get QR</a>
            </div>
        </div>
    </div>
    <div class="col-md-4">
        <div class="card h-100 admin-section-card">
            <div class="card-body">
                <h2 class="h5 card-title">Testimonials</h2>
                <p class="card-text">Manage testimonials that appear on the About page slider.</p>
                <a href="testimonials.php" class="btn btn-sm btn-primary">Manage Testimonials</a>
            </div>
        </div>
    </div>
    <div class="col-md-4">
        <div class="card h-100 admin-section-card">
            <div class="card-body">
                <h2 class="h5 card-title">Women's Day Submissions</h2>
                <p class="card-text">View photos and testimonials submitted for the Women's Day special.</p>
                <a href="womens_day.php" class="btn btn-sm btn-primary">View Submissions</a>
            </div>
        </div>
    </div>
</div>

<?php include __DIR__ . '/footer.php'; ?>

