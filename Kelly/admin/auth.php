<?php

declare(strict_types=1);

session_start();

require __DIR__ . '/../config.php';

/**
 * Check whether an admin user is currently logged in.
 *
 * @return bool
 */
function is_admin_logged_in(): bool
{
    return isset($_SESSION['admin_id']) && is_int($_SESSION['admin_id']);
}

/**
 * Ensure the current request is from a logged-in admin.
 * If not, redirect to the login page.
 *
 * @return void
 */
function require_admin_login(): void
{
    if (!is_admin_logged_in()) {
        header('Location: login.php');
        exit;
    }
}

/**
 * Get the current admin's username, if available.
 *
 * @return string
 */
function current_admin_username(): string
{
    return isset($_SESSION['admin_username']) ? (string)$_SESSION['admin_username'] : '';
}

