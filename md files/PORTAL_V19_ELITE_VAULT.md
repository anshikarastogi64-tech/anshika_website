1. Aesthetic & UI Overhaul (Gallery View)
The Design Vault must transition from a table to a Visual Grid.

Card Style: Frosted glass cards with a 16:9 aspect ratio for thumbnails.

Folder UI: Folders should show a "Stacked" preview (showing the first 3 thumbnails inside) to hint at the contents.

Hover State: On hover, a gold border appears, and the file name/date slides up from the bottom.

2. The Integrated Media Viewer
Cursor must implement a custom, high-end Media Viewer (Lightbox) that handles both photos and videos seamlessly.

A. Continuous Image Viewer
Trigger: Clicking any image thumbnail.

UX: Full-screen overlay with blurred background.

Navigation: Left/Right arrows or swiping to navigate through all images in that folder without closing the viewer.

Zoom: Smooth pinch-to-zoom or scroll-to-zoom functionality.

B. Video Viewer
Logic: If the file is an .mp4 or .mov, show a "Play" icon overlay on the thumbnail.

Player: High-end custom video player with Gold control bars, volume, and full-screen toggle.

3. Automated Folder Sorting (Recap)
The "Site Progress" section remains automated by Year > Month, but instead of a list, it renders as a Nested Gallery:

Level 1: Folder Icons marked with Year.

Level 2: Folder Icons marked with Month.

Level 3: The Visual Grid of images/videos.

4. Instructions for Cursor (The "Visual" Order)
Replace Table with Grid: Refactor the current ListView in the Vault to a ResponsiveGrid (3-4 columns).

Thumbnail Logic: Use a library like Next/Image for optimized thumbnails. If it's a PDF, show a high-end "Document Icon"; if it's a Video, show a frame preview.

The Lightbox: Use framer-motion to create a smooth, continuous image/video viewer. Ensure users can "swipe" through the entire folder.

Breadcrumbs: Keep the Vault > Site Progress > 2026 breadcrumbs at the top so users can navigate back easily.

Actions: Add a "Download All" button at the top of each folder.

Step 2: The Cursor Prompt for the Overhaul
Copy and paste this into Cursor:

"The Design Vault looks like a boring table and is difficult to use. Please perform a total UX overhaul based on @PORTAL_V19_ELITE_VAULT.md.

Switch to Gallery Grid: Replace the list-view with an elegant, responsive grid of thumbnails. Use the Charcoal/Gold luxury aesthetic.

Implement the Lightbox: Create a continuous image/video viewer. When I click a photo, I should be able to scroll or arrow through all other photos in that folder without closing the view.

Video Player: Build a custom video player for site walk-throughs that fits the premium theme.

Interactive Folders: Folders should be visual blocks with 'stacked' previews of the files inside.

Site Progress: Maintain the automated Year/Month sorting but render it as nested visual galleries.

This must be implemented for Admin, Designer, and Client views so everyone sees the premium gallery."