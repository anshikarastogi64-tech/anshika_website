# 🏛️ Master Technical Specification: Interior Design Portal (v12 - MASTER)

## 1. Project Overview & Aesthetic
* **Core Goal:** A high-end, full-lifecycle portal for Interior Design firms managing leads, projects, and site monitoring.
* **Aesthetic:** Luxury Minimalist / Architectural.
* **Color Palette:** Charcoal (#1A1A1A), Champagne Gold (#C5A059), Off-White (#F9F9F9).
* **Roles:**
    * **Admin:** User management (Creating Designers/Clients), Hardware mapping (CCTV), Global Lead Oversight.
    * **Designer:** Sales (Lead Management), Project execution, Daily updates, Extra Cost additions.
    * **Client:** Project tracking, 2D/3D viewing, CCTV access, Financial approval, Referrals (DV Points).

### Tailwind Theme Configuration
```javascript
theme: {
  extend: {
    colors: {
      charcoal: '#1A1A1A',
      gold: { 500: '#C5A059', 600: '#A38445' },
      offwhite: '#F9F9F9',
    },
    fontFamily: {
      serif: ['Playfair Display', 'serif'],
      sans: ['Inter', 'sans-serif'],
    },
  },
}

// prisma/schema.prisma

enum Role { CLIENT; DESIGNER; ADMIN }
enum LeadStatus { NEW; CONTACTED; UNREACHABLE; MEETING_SCHEDULED; QUOTATION_SENT; CLOSED_WON; CLOSED_LOST }
enum ProjectStatus { ACTIVE; COMPLETED; ON_HOLD }
enum Status { PENDING; APPROVED; REJECTED; OPEN; RESOLVED }

model User {
  id              String    @id @default(uuid())
  email           String    @unique
  passwordHash    String
  fullName        String
  role            Role      @default(CLIENT)
  dvPointsBalance Float     @default(0) 
  projects        Project[] @relation("ClientProjects")
  designedProjects Project[] @relation("DesignerProjects")
  referrals       Lead[]    @relation("ClientReferrals")
  leadsAssigned   Lead[]    @relation("DesignerLeads")
  createdAt       DateTime  @default(now())
}

model Lead {
  id                String      @id @default(uuid())
  name              String
  phoneNumber       String
  email             String?
  status            LeadStatus  @default(NEW)
  notes             String?     // Activity/Conversation logs
  nextFollowUp      DateTime?
  referrerId        String?
  referrer          User?       @relation("ClientReferrals", fields: [referrerId], references: [id])
  assignedDesignerId String?
  assignedDesigner  User?       @relation("DesignerLeads", fields: [assignedDesignerId], references: [id])
  convertedProjectId String?    @unique
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
}

model Project {
  id                String      @id @default(uuid())
  title             String
  budget            Float
  currentStage      Int         @default(0) // 0-6 index for Stepper
  status            ProjectStatus @default(ACTIVE)
  rtspLink          String?
  personalityPdfUrl String?
  clientId          String
  client            User        @relation("ClientProjects", fields: [clientId], references: [id])
  designerId        String
  designer          User        @relation("DesignerProjects", fields: [designerId], references: [id])
  quotations        Quotation[]
  media             Media[]
  complaints        Complaint[]
  invoices          Invoice[]
  finalTotalCost    Float?      
  dvPointsProcessed Boolean     @default(false)
}

model Quotation {
  id           String      @id @default(uuid())
  projectId    String
  project      Project     @relation(fields: [projectId], references: [id])
  baseTotal    Float
  items        Json        // [{item, qty, rate, total}]
  status       Status      @default(PENDING)
  extraCosts   ExtraCost[]
  isFinal      Boolean     @default(false)
}

model ExtraCost {
  id          String    @id @default(uuid())
  quotationId String
  quotation   Quotation @relation(fields: [quotationId], references: [id])
  description String
  amount      Float
  status      Status    @default(PENDING)
  comment     String?
}

model Invoice {
  id          String   @id @default(uuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id])
  totalAmount Float
  pdfUrl      String
  isPaid      Boolean  @default(false)
  createdAt   DateTime @default(now())
}

model Media {
  id        String   @id @default(uuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id])
  url       String
  type      String   // PHOTO, VIDEO, 3D, 2D
  category  String   // DAILY_PROGRESS, DESIGN_FINAL
  createdAt DateTime @default(now())
}

model Complaint {
  id        String   @id @default(uuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id])
  subject   String
  description String
  status    Status    @default(OPEN)
  createdAt DateTime  @default(now())
}