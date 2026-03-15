🏛️ Luxury Interior Portal: Master Specification (v15 - COMPLETE)
1. Aesthetic & UI Design System
The Vibe: High-end Architectural Studio (Editorial style).

Typography: Headings in Serif (Playfair Display); Body/Data in Sans (Inter).

Palette: Charcoal (#121212), Champagne Gold (#D4AF37), Glass (rgba(255,255,255,0.03)), Soft Bone (#F8F8F8).

Interactions: Smooth fades and subtle hover scales using framer-motion.

2. The Structured "Vault" Logic
Cursor must implement a Nested Directory System for the client’s documents and media.

A. Manual Folder Categories
Architectural Plans: 2D Layouts, Electrical, Plumbing.

Visualizations: 3D Renders and Walkthroughs.

Official Documents: Quotations, Personality PDF, Invoices, Warranty Cards.

B. Automated Site Log (The "Smart Folder")
When a media file is uploaded as category: "SITE_LOG", the system must automatically organize it:

Logic: Extract the Month and Year from the createdAt timestamp.

UI Display: * Main Folder: Site Progress

Sub-Folder Level 1: Year (e.g., 2026)

Sub-Folder Level 2: Month (e.g., March)

Result: The client sees: Site Progress > 2026 > March > [List of daily photos/videos].

3. Automated Welcome Email System
When an Admin or Designer converts a Lead to a Project, the system must send a "Welcome" email.

Trigger: Successful execution of the convertLeadToProject function.

Content Template:

Subject: Welcome to [Your Brand Name] – Your Design Journey Begins

Dear [Client Name],

We are thrilled to begin crafting your dream space. Your project portal is now live.

Login Details:

Portal Link: [URL]

Username: [Email]

Temporary Password: [Auto-Generated-Password]

In your portal, you can track daily site progress, approve designs, and watch your site live via CCTV.

Welcome to the family.

The [Your Brand Name] Team

4. Key Logic Modules
A. The 4% DV Points Logic
Trigger: On Project.status === "COMPLETED".

Math: Reward = finalTotalCost * 0.04.

Credit: Add Reward to the dvPointsBalance of the referrerId.

B. Financial Integrity
Calculation: Total = Quotation.baseTotal + SUM(ExtraCost.amount WHERE status === "APPROVED").

Access: Only "Approved" costs appear on the client's final invoice.

C. Admin/Designer Mirror Mode
Access: /dashboard/mirror/[projectId].

Function: Renders the Client Dashboard in a Read-Only state with a Gold Top Banner.

5. UI Layout: The Vault List View
Table Columns: Name, Type (Icon), Uploaded On (Date & Time), Size, Download.

Row Style: Clean, thin gold-tinted borders with a subtle hover effect.

Breadcrumbs: Design Vault / Site Progress / 2026 / March.

6. Instructions for Cursor (The FINAL Order)
Auto-Sort Site Logs: Write a utility function groupMediaByDate(mediaItems) that takes a flat list of site logs and nests them into Year/Month objects for the UI.

Welcome Email: Integrate Nodemailer to send the automated welcome email with login credentials immediately upon account creation.

Strict File Meta: Every file must show the exact upload Date and Time (e.g., "March 12, 2026 - 4:10 PM").

Security: Implement role-based access for the Mirror Mode and ensure Designers only see their assigned data.

Refinement: Run a check to ensure all colors and typography match the "Luxury Architectural Studio" look.

Step 2: The Final Cursor Prompt
Copy and paste this into Cursor:

"I have finalized the specification to v15. Please perform the full implementation based on @PORTAL_V15_COMPLETE_SPEC.md.

Implement the Welcome Email: Use Nodemailer to send the 'Welcome to [Brand]' email with login details whenever a Lead is converted to a Project.

Structured Vault & Auto-Sort: Build the folder-based vault. Ensure the 'Site Progress' folder automatically sorts files by Year and Month.

Luxury Theme: Ensure the theme is high-end (Charcoal/Gold/Serif) and includes the breadcrumb navigation.

DV Points & Financials: Verify the 4% reward math and the approved-cost billing logic.

Build all files now and ensure the system is ready for a professional launch."