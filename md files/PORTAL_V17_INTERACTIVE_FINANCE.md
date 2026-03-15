🏛️ Luxury Interior Portal: Master Specification (v17 - INTERACTIVE)
1. Aesthetic & UI Design System
Theme: High-end Architectural Studio.

Colors: Charcoal (#121212), Champagne Gold (#D4AF37), Soft Bone (#F8F8F8).

Typography: Serif (Playfair Display) for financial totals; Sans (Inter) for line items.

2. Client Interactive Approval Hub
This is the heart of the project’s financial transparency. The Client Dashboard must have a dedicated "Financials" tab.

A. Quotation Management
The View: Clients see the latest Quotation with an itemized breakdown (Item, Description, Rate, Quantity, Total).

Actions:

Accept: Marks the quotation as APPROVED. Triggers a notification to the Designer.

Comment/Negotiate: A text area where the client can ask for changes.

History: Ability to view older "Rejected" versions of quotations for reference.

B. Extra Cost (Variation) Approval
The View: A "Pending Variations" section.

Logic: Every extra cost added by a Designer appears here with a "Reason" and "Amount."

Action Buttons: * Approve (Gold Button): Instantly adds the amount to the "Current Project Value."

Reject (Outline Button): Marks it as rejected; amount is not added to the total.

Audit Trail: Every approval/rejection must store a timestamp (approvedAt).

C. Live Budget Tracker
Calculation (Dynamic): * Total Project Value = Approved Base Quotation + SUM(Approved Extra Costs).

Visual: A large, elegant gold total at the top of the page that updates via state (no page refresh) when the client clicks "Approve."

3. Designer/Admin Feedback Loop
Notifications: When a client approves a cost, the Designer receives an Instant SMS & Email: "Client [Name] has just approved the variation for [Item Name] (₹XXX)."

Mirror Mode: In Mirror Mode, the Designer sees exactly what the client has approved or rejected, but cannot click the buttons (Read-Only).

4. Database Schema (Interactive Updates)
Code snippet
model Quotation {
  id             String      @id @default(uuid())
  projectId      String
  status         Status      @default(PENDING) // PENDING, APPROVED, REJECTED
  clientComments String?     
  approvedAt     DateTime?
  baseTotal      Float
  items          Json        // [{item, description, rate, qty, total}]
}

model ExtraCost {
  id          String    @id @default(uuid())
  description String
  amount      Float
  status      Status    @default(PENDING) // Must be APPROVED for billing
  comment     String?   // Designer's reason
  clientNote  String?   // Client's feedback
  approvedAt  DateTime?
}
5. Instructions for Cursor (The "Action" Order)
Interactive Buttons: Build the QuotationCard and ExtraCostCard with functional Approve/Reject/Comment buttons.

State Management: Use React Context or Zustand (or simple useState) to ensure the "Total Project Value" updates the moment a client clicks Approve.

The "Lock" Mechanism: Once a Quotation is APPROVED, the Designer cannot edit it. They must instead add "Extra Costs" for any further changes.

Automated Invoice/Warranty: Build the logic to generate a PDF containing only the APPROVED items.

Manual Overrides: In the Admin Dashboard, allow the Admin to manually add a "Project" or "Lead" as per v16.

Step 2: The Final Cursor Prompt
Copy and paste this into Cursor:

"I have updated the specification to v17. We are missing the interactive approval system. Please perform the full implementation based on @PORTAL_V17_INTERACTIVE_FINANCE.md.

Implement Client Approvals: On the Client Dashboard, build the UI for the client to 'Accept', 'Reject', or 'Comment' on Quotations and 'Extra Costs'.

Live Math: Ensure the 'Total Project Value' on the screen updates dynamically to sum only the base quotation and APPROVED extra costs.

Designer Notifications: Trigger SMS/Email notifications to the Designer whenever a client makes a financial decision.

Mirror Mode: Ensure the Designer/Admin can see these decisions in the Mirror View but cannot change them.

Manual Entry: Don't forget the 'Add Project' and 'Add Lead' forms for the Admin.

Use the Luxury Architectural theme (Charcoal/Gold/Serif) for all buttons and cards. Proceed with the build."