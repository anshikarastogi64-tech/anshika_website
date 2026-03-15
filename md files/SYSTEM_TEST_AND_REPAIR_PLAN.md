🛠️ Interior Portal: Automated Test, Debug, & Rectification Plan
1. Core Logic Audit (The "Math" Check)
The Requirement: Every financial calculation must be audited for precision.

Test Case 1: Quotation Summation

Action: Add a Base Quote of 100,000. Add two 'Approved' Extra Costs of 5,000 each. Add one 'Rejected' Extra Cost of 2,000.

Expected Result: Final Invoice total must be exactly 110,000.

Rectification: If the total includes 'Rejected' or 'Pending' costs, rewrite the calculateTotal function in @/lib/finance.ts.

Test Case 2: 4% DV Points Credit

Action: Mark a 200,000 project as COMPLETED.

Expected Result: The User record of the referrerId must increase by 8,000 points.

Rectification: Verify the Prisma transaction logic in the completeProject API route.

2. Permissions & Security Audit
The Requirement: Zero-access leak between clients.

Test Case 3: ID Manipulation (IDOR)

Action: Attempt to access /api/projects/[ID_OF_OTHER_CLIENT] while logged in as a different client.

Expected Result: 403 Forbidden.

Rectification: Ensure middleware or server-side checks verify session.user.id === project.clientId.

Test Case 4: Designer Isolation

Action: A Designer attempts to view a Lead or Project not assigned to them.

Expected Result: 404 Not Found or 403 Forbidden.

3. Feature Functional Audit
Test Case 5: Lead-to-Project Conversion

Action: Toggle a Lead to CLOSED_WON and click "Convert."

Expected Result: A new User record is created, a Project is created, and the Lead.convertedProjectId is populated.

Test Case 6: Mirror Mode Rendering

Action: Access /mirror/[projectId] as an Admin.

Expected Result: Page renders the ClientDashboard component with a ReadOnly state and a gold banner.

Test Case 7: RTSP Player Fallback

Action: Provide a broken or null RTSP link.

Expected Result: UI shows "Live Stream Offline" placeholder instead of a crash.

4. UI/UX "Luxury" Aesthetic Check
Checklist:

Are headings in Serif font?

Is the primary button #D4AF37 (Gold) with white text?

Is there a 10% fade-in animation on page load?

Is the Sidebar Charcoal (#121212)?

Rectification: Global layout.tsx and globals.css must be refactored if these are not met.

Step 2: The "Self-Correction" Prompt for Cursor
Once that file is saved, use this Master QA Prompt. This tells Cursor to act as its own developer and tester.

"I have attached @SYSTEM_TEST_AND_REPAIR_PLAN.md. I want you to act as a Senior QA Engineer and Full-Stack Developer.

Instructions:

Run a full audit: Go through every Test Case (1 through 7) in the plan.

Detect Bugs: Look at the current code for the Financials, Leads, and Mirror Mode. If the logic does not match the 'Expected Result' in the test plan, mark it as a bug.

Auto-Rectify: Fix the code immediately for any failed test case.

Theme Fix: Update the UI to match the 'Luxury Aesthetic Check' in Section 4. Replace basic components with high-end, polished versions using the Gold/Charcoal palette and Serif typography.

Verify Security: Ensure that every API route is properly protected so designers only see their assigned data and clients only see theirs.

Proceed with fixing the entire system now."