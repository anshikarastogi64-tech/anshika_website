# Interior Portal - Flow Test Checklist

Use this checklist to manually verify all portal flows after seeding test data.

## Test Credentials
- **Admin:** admin@example.com / Admin@123
- **Designer:** designer@example.com / Designer@123
- **Client:** client@example.com / Client@123

## Setup
```bash
npm run seed:portal    # Create test data
npm run test:portal    # Run automated DB flow tests
npm start             # Start server (http://localhost:8000)
```

## 1. Auth
- [ ] GET /portal/login – Login page loads
- [ ] POST login (invalid) – Error shown
- [ ] POST login (admin) – Redirect to /portal/admin
- [ ] POST login (designer) – Redirect to /portal/designer
- [ ] POST login (client) – Redirect to /portal/client
- [ ] Logout – Redirect to login

## 2. Admin
- [ ] Dashboard – Users, leads, projects counts
- [ ] Users – List users, create new user
- [ ] Leads – List all leads, assign designer
- [ ] Lead detail – Notes, assign, convert link (designer)
- [ ] Projects – List all projects
- [ ] Project detail – Quotations, extra costs, approve/reject, CCTV URL, Complete, Final Invoice
- [ ] Mirror – "View as Client" opens client view with gold banner
- [ ] Final Invoice – Generate PDF, download; project locks
- [ ] Mark Completed – DV Points processed for referred project

## 3. Designer
- [ ] Dashboard – Leads, projects, pending follow-ups badge
- [ ] Leads – List, create new, filter by assigned
- [ ] Lead detail – Status, follow-up date, activity timeline, add note, convert to project
- [ ] Lead convert – Select client, create project
- [ ] Projects – List assigned projects
- [ ] Project detail – Stage, media upload, extra cost, View as Client
- [ ] View as Client – Gold banner, read-only

## 4. Client
- [ ] Dashboard – Projects, referrals
- [ ] Projects – My projects list
- [ ] Project detail – Quotations, extra costs, media, CCTV link
- [ ] Refer – Submit referral (new lead)
- [ ] CCTV – Live stream (or offline placeholder for RTSP)

## 5. API
- [ ] GET /portal/api/quotation/:id/total – Returns total (base + APPROVED extras) for Admin/Designer/Client with project access

## 6. Permissions
- [ ] Client cannot access /portal/admin or designer routes (403/redirect)
- [ ] Designer cannot access another designer’s leads/projects (403)
- [ ] Client cannot access another client’s projects (403)
- [ ] Designer cannot mirror/view-as projects not assigned to them (403)
