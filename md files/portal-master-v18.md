# 🏛️ Luxury Interior Portal: Master Specification (v18 - FINAL)

## 1. Aesthetic & UI Design System
* **Theme:** High-end Architectural Studio (Editorial style).
* **Typography:** Headings: Serif (`Playfair Display`); Data: Sans (`Inter`).
* **Palette:** Charcoal (#121212), Champagne Gold (#D4AF37), Soft Bone (#F8F8F8).
* **Interactions:** Use `framer-motion` for smooth fades and gold-tinted hover effects.

---

## 2. The 11-Stage Interior Lifecycle
Replace numeric stages (0-10) with this professional sequence:

| Stage | Name | Description |
| :--- | :--- | :--- |
| **0** | **Onboarding** | Briefing, contract signing, and portal setup. |
| **1** | **Site Survey** | Measurement and structural analysis. |
| **2** | **Design Concept** | Moodboards, color palettes, and theme finalization. |
| **3** | **2D Space Planning** | Detailed layouts and furniture placement. |
| **4** | **3D Visualizations** | High-fidelity photorealistic renders. |
| **5** | **Material Selection** | Finalizing finishes, fabrics, and hardware. |
| **6** | **Procurement** | Order placement for materials and decor. |
| **7** | **Civil & MEP Works** | On-site masonry, electrical, and plumbing. |
| **8** | **Woodwork & Fit-outs** | Carpentry and cabinetry installation. |
| **9** | **Finishing & Styling** | Painting, lighting, and decor layering. |
| **10** | **Grand Handover** | Quality audit and key handover. |

---

## 3. Core Feature Logic

### A. Interactive Financial Hub (Decision Engine)
* **Client Approvals:** Clients must click 'Approve' on the Quotation and any Extra Costs.
* **Math Logic:** `Total Project Value = Approved Quotation + SUM(ExtraCosts WHERE status = 'APPROVED')`.
* **Real-time Updates:** The Grand Total at the top of the screen must update instantly upon client approval.

### B. Structured Document Vault
* **Categories:** Architectural Plans, Visualizations, Official Docs.
* **Auto-Sorting Site Log:** Media uploaded as `SITE_LOG` must automatically nest into `Year > Month` folders based on the upload date.
* **Metadata:** Every file must show `Name`, `Upload Date`, and `Exact Time` (e.g., Oct 24, 2026 - 4:30 PM).

### C. Referral & DV Points (The 4% Reward)
* **Trigger:** When Project Status is changed to `COMPLETED`.
* **Action:** Calculate 4% of the `finalTotalCost`. Credit this amount to the `dvPointsBalance` of the client who referred this project.

### D. Mirror Mode & Manual Entry
* **Mirror Mode:** Admin/Designer view via `/mirror/[projectId]`. Replicates the client UI in Read-Only mode with a Gold banner.
* **Manual Entry:** Admin can bypass the lead funnel to manually add a New Project or New Lead.

---

## 4. Automated Onboarding (Welcome Email)
* **Trigger:** Creation of a new Client account.
* **Action:** Use Nodemailer to send a welcome email with:
    1. Portal URL.
    2. Username (Email).
    3. Auto-generated temporary password.

---

## 5. Instructions for Cursor AI
1. **Frontend:** Implement the `ProgressStepper` using the 11 named stages. 
2. **Backend:** Ensure strict role-based access. Designers only see assigned projects.
3. **Integrity:** The 'Generate Invoice' button must only include items approved by the client.
4. **Theme:** Maintain the luxury Charcoal/Gold aesthetic across all new forms and buttons. 