Luxury Interior Portal: Deep Rectification & Feature Specification
1. Aesthetic Overhaul: "The Architectural Studio" Look
The current theme is too basic. We need to implement a high-end, editorial-style interface.

A. Design System (Tailwind)
Typography: Use a high-end Serif for headings (Playfair Display or Cormorant Garamond) and a crisp Sans-Serif for data (Inter or Montserrat).

Color Palette:

Charcoal: #121212 (Deep, rich black)

Champagne Gold: #D4AF37 (Metallic gold accent)

Soft Bone: #F5F5F7 (Backgrounds)

Glass: rgba(255, 255, 255, 0.05) (For frosted glass cards)

Visual Style:

Generous Whitespace: Don't crowd the data.

Micro-interactions: Use framer-motion for smooth fades and slide-ins.

Borders: Use very thin 1px borders in gold or charcoal-gray.

2. Granular Feature Implementation
A. Lead & Sales Management (Designer/Admin View)
Cursor must implement a Timeline-based CRM for leads.

Status Workflow: NEW → CONTACTED → FOLLOW_UP → CLOSED_WON → CONVERTED.

The Activity Log: Every lead must have an Activity[] array in the DB. When a Designer adds a note, it should show up in a vertical "Timeline" view with a timestamp.

Follow-up Reminders: If a nextFollowUp date is set, show a "Pending Task" badge on the Designer's dashboard.

B. The "Mirror Mode" (The Master Shadow)
The Requirement: Admin/Designer must see exactly what the client sees.

Implementation: Create a reusable ClientDashboardContent component.

The Route: /dashboard/mirror/[projectId].

Logic: Fetch the project data as if you were the client. If the user is an ADMIN or the assigned DESIGNER, grant access to this "Read-Only" replica of the client's home screen.

C. Financial Logic (Strict Math)
The current calculation is likely wrong. Cursor must use this logic:

Quotation: A JSON object of line items.

Extra Costs: Individual records linked to the Quotation.

The Total: BaseAmount + SUM(ExtraCosts WHERE status = 'APPROVED').

Invoicing: The "Final Invoice" button must lock the project and generate a PDF with this exact sum.

D. Referral & DV Points (The 4% Reward)
This must be a background trigger.

The Hook: When Project.status changes to COMPLETED:

Identify the referrerId from the associated Lead.

Execute: referrer.dvPointsBalance += (Project.finalTotalCost * 0.04).

Create a Notification for the referrer: "You've earned [X] points!"

3. Role-Based Permissions (Strict Access)
Cursor must verify permissions on every API route:

Admin: Can see everything, create Users, and delete projects.

Designer: Can only see Leads and Projects assigned to them.

Client: Can only see their own project and referral data.

4. Technical Stack & Integrity
Database: Prisma (PostgreSQL). Ensure Referral and Lead relations are robust.

Media: All uploads must go to AWS S3 or Cloudinary.

Live CCTV: Implement a "CCTV Card" that displays the RTSP stream (using react-player or hls.js).

Step 2: The Rectification Prompt for Cursor
After you have saved the file above, open the Cursor Chat and use this "Hard Reset" prompt:

"I am unhappy with the current basic implementation. It is boring and lacks the luxury feel and specific logic we discussed.

Please read @PORTAL_RECTIFICATION_PLAN.md and perform a total overhaul of the project:

Apply the 'Architectural Studio' Theme: Update the Tailwind config and all UI components to use the Charcoal/Gold luxury palette with high-end typography and generous whitespace.

Fix the Lead Logic: Implement the vertical timeline for lead notes and the 'Convert to Project' flow.

Implement the Mirror Mode: Create the /mirror route that perfectly replicates the Client Dashboard for Admin/Designer use.

Fix the DV Points Math: Ensure the 4% reward is calculated correctly on project completion and credited to the referrer.

Clean the Code: Ensure all API routes have strict role-based checks.

Do not settle for basic components. Make it look like a premium architectural software."