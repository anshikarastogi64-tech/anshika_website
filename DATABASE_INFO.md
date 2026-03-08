# Database Configuration and Structure

## Current Database: SQLite

The application currently uses **SQLite** (`data.sqlite`), which is a file-based database perfect for small to medium-sized applications. It requires no separate server installation and stores all data in a single file.

## Database Tables

### 1. `admins`
Stores admin user accounts for the CMS.
- `id` (INTEGER PRIMARY KEY)
- `username` (TEXT, UNIQUE)
- `password_hash` (TEXT) - bcrypt hashed passwords
- `created_at` (TEXT)

**Default Admin:**
- Username: `admin`
- Password: `Admin@123`

### 2. `content_blocks`
Stores small text content blocks (titles, paragraphs, etc.) identified by page, section, and key.
- `id` (INTEGER PRIMARY KEY)
- `page` (TEXT) - e.g., 'home', 'about', 'contact'
- `section` (TEXT) - e.g., 'hero', 'intro', 'facts'
- `block_key` (TEXT) - e.g., 'title', 'paragraph', 'clients'
- `content` (TEXT)
- UNIQUE constraint on (page, section, block_key)

**Examples:**
- `home/hero/greeting` = "Hi, I am"
- `about/facts/clients` = "156"
- `contact/info/email` = "info@designersvision.com"

### 3. `testimonials`
Stores customer testimonials displayed on the About page.
- `id` (INTEGER PRIMARY KEY)
- `name` (TEXT)
- `role` (TEXT)
- `message` (TEXT)
- `image_path` (TEXT) - relative path to testimonial photo
- `sort_order` (INTEGER) - for ordering
- `created_at` (TEXT)

**Current Count:** 7 testimonials (seeded from static site)

### 4. `services`
Stores service offerings displayed on the Services page.
- `id` (INTEGER PRIMARY KEY)
- `title` (TEXT) - e.g., "COMMERCIAL INTERIOR"
- `image_path` (TEXT) - relative path to service image
- `sort_order` (INTEGER) - for ordering
- `created_at` (TEXT)

**Current Count:** 13 services (seeded from static site)

### 5. `portfolio_items`
Stores portfolio/gallery items displayed on the Portfolio page.
- `id` (INTEGER PRIMARY KEY)
- `title` (TEXT)
- `category` (TEXT) - e.g., "filter-kitchen", "filter-bedroom", "filter-hospital"
- `image_path` (TEXT) - relative path to portfolio image
- `sort_order` (INTEGER) - for ordering
- `created_at` (TEXT)

**Current Count:** 128 portfolio items (seeded from static site)

**Categories:**
- `filter-kitchen` (40 items)
- `filter-bedroom` (13 items)
- `filter-hospital` (17 items)
- `filter-bar` (28 items)
- `filter-wardrobe` (20 items)
- `filter-livingarea` (7 items)
- `filter-office` (2 items)
- `filter-dining` (1 item)

### 6. `site_settings`
Stores general site settings (currently unused but available for future use).
- `id` (INTEGER PRIMARY KEY)
- `setting_key` (TEXT, UNIQUE)
- `setting_value` (TEXT)

## Database Location

- **File:** `data.sqlite` (in project root)
- **Path:** `c:\Users\ankse\Downloads\Kelly 2\data.sqlite`

## Seeding Data

Data is automatically seeded when:
1. Database is first created
2. Tables are empty

To manually reseed all data, run:
```bash
node reseed.js
```

This will:
- Clear all testimonials, services, and portfolio items
- Re-insert all data from `seed-data.js`

## Alternative Database Options

If you want to migrate to a different database system, here are recommendations:

### For Production/Scaling:
1. **PostgreSQL** - Robust, feature-rich, great for production
2. **MySQL/MariaDB** - Popular, well-supported
3. **MongoDB** - If you prefer NoSQL/document-based storage

### For Simplicity (Current):
- **SQLite** - Perfect for small to medium sites, no server needed

## Migration Considerations

If migrating to PostgreSQL/MySQL:
1. Update `db.js` to use appropriate driver (e.g., `pg`, `mysql2`)
2. Update connection string in environment variables
3. SQL syntax is mostly compatible (minor adjustments may be needed)
4. Update `package.json` dependencies

## Current Status

✅ All tables created and seeded
✅ 7 testimonials loaded
✅ 13 services loaded  
✅ 128 portfolio items loaded
✅ Content blocks initialized
✅ Admin user created
