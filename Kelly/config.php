<?php

// Basic configuration for the lightweight CMS / admin panel.
// Uses SQLite so it works on most PHP hosts without extra setup.

declare(strict_types=1);

// Path to the SQLite database file (relative to this config file)
$DB_PATH = __DIR__ . '/data.sqlite';

// Base path for assets (used by admin panel). Auto-detected from SCRIPT_NAME.
$ASSETS_BASE = '..';
if (isset($_SERVER['SCRIPT_NAME']) && $_SERVER['SCRIPT_NAME'] !== '') {
    $d = dirname($_SERVER['SCRIPT_NAME']);
    if (strpos($d, 'admin') !== false) {
        $ASSETS_BASE = dirname($d);
        if ($ASSETS_BASE === '.' || $ASSETS_BASE === '/') {
            $ASSETS_BASE = '..';
        }
    }
}

/**
 * Get a shared PDO connection to the SQLite database.
 *
 * @return PDO
 */
function get_db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    global $DB_PATH;

    $pdo = new PDO('sqlite:' . $DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Make sure foreign keys are enforced
    $pdo->exec('PRAGMA foreign_keys = ON');

    return $pdo;
}

/**
 * Simple helper to fetch a single content block.
 *
 * Content blocks are small pieces of text (titles, paragraphs, etc.)
 * identified by page + section + key.
 *
 * If the block does not exist yet, the provided default is returned.
 *
 * @param string $page
 * @param string $section
 * @param string $key
 * @param string $default
 * @return string
 */
function get_block(string $page, string $section, string $key, string $default = ''): string
{
    try {
        $db = get_db();
        $stmt = $db->prepare(
            'SELECT content FROM content_blocks WHERE page = :page AND section = :section AND block_key = :block_key LIMIT 1'
        );
        $stmt->execute([
            ':page'      => $page,
            ':section'   => $section,
            ':block_key' => $key,
        ]);
        $row = $stmt->fetch();
        if ($row && isset($row['content']) && $row['content'] !== '') {
            return $row['content'];
        }
    } catch (Throwable $e) {
        // On any error, just fall back to the default value so the site still renders.
    }

    return $default;
}

/**
 * Upsert a content block (used by the admin panel).
 *
 * @param string $page
 * @param string $section
 * @param string $key
 * @param string $content
 * @return void
 */
function save_block(string $page, string $section, string $key, string $content): void
{
    $db = get_db();
    $stmt = $db->prepare(
        'INSERT INTO content_blocks (page, section, block_key, content)
         VALUES (:page, :section, :block_key, :content)
         ON CONFLICT(page, section, block_key) DO UPDATE SET content = excluded.content'
    );
    $stmt->execute([
        ':page'      => $page,
        ':section'   => $section,
        ':block_key' => $key,
        ':content'   => $content,
    ]);
}

