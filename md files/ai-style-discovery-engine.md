# Specification: AI Style Discovery Engine (Complete Integration)

## 1. Project Overview
A premium lead-generation tool added as a new route to the existing Node.js site.
- **URL Path:** `/style-discovery`
- **Goal:** Convert visitors into high-intent leads via a gamified AI experience.
- **AI Stack:** Gemini 2.5 Flash-Lite (Logic) + Imagen 4 Fast (Visuals).

## 2. Environment Variables (.env)
```bash
GEMINI_API_KEY=your_google_ai_studio_key
ADMIN_BYPASS_OTP=true
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_app_specific_password
ADMIN_RECEIVER_EMAIL=sales@yourcompany.com
CALENDLY_LINK=[https://calendly.com/your-link](https://calendly.com/your-link)
3. The User Journey & Logic
Step A: Lead Capture & OTP
UI: Landing page with Name & Mobile fields.

Logic: Generate 6-digit OTP.

Bypass: If ADMIN_BYPASS_OTP === 'true', allow any code to proceed to Step 1.

Database: Save lead to Leads collection in MongoDB.

Step B: The 10-Step Adaptive Quiz
Steps 1-3 (Static Seeds): Serve images from /public/images/quiz/seeds/.

Q1: Atmosphere (Natural, Moody, Ornate, Clean)

Q2: Texture (Stone, Silk, Metal, Linen)

Q3: Landscape (Urban, Tropical, Forest, Historic)

Steps 4-9 (Dynamic Branching): - Backend: Send selectedTags to Gemini 2.5 Flash-Lite.

AI Output: JSON containing questionText and 4 imagePrompts.

Visuals: Call Imagen 4 Fast to generate 4 thumbnails (512px for cost efficiency).

Step 10 (Result): AI synthesizes the "Design Persona" and generates one high-res imagen-4-ultra Hero Image.

Step C: The Design Manifesto (PDF)
Engine: Puppeteer.

Content: AI-written "Design Identity" (3-word Persona Name, Essence, and Signature Elements).

Style: High-end Architectural Digest aesthetic.

Step D: Thank You & Booking
UI: Show thumbnail of the report + "Download PDF" button.

Feature: Embed Calendly/Google Calendar widget for an instant 15-min consultation.

4. Admin Sales Intelligence Email
Trigger: On Step 10 completion.

Recipient: ADMIN_RECEIVER_EMAIL.

Subject: 🔥 [HOT LEAD] ${personaName} - ${userName}

Body: - Lead Info: ${name}, ${mobile}.

AI Persona: ${personaName}.

Sales Insight: [AI-generated summary of why they like this style].

Copy-Paste SMS Script: "Hi ${name}, this is [Name] from [Company]. I just saw your ${personaName} report—it’s stunning! I have some ideas for your ${style} project. Are you free for our booked chat?"

5. Premium "Game-Feel" CSS
CSS
:root { --gold: #d4af37; --bg: #0a0a0a; --glass: rgba(255, 255, 255, 0.05); }
.quiz-wrapper { background: var(--bg); color: white; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; }
.image-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; max-width: 800px; }
.option-card { border-radius: 12px; overflow: hidden; border: 1px solid var(--glass); transition: all 0.4s ease; cursor: pointer; }
.option-card:hover { transform: translateY(-8px); border-color: var(--gold); box-shadow: 0 15px 45px rgba(212,175,55,0.2); }
.progress-track { width: 100%; height: 3px; background: #222; position: fixed; top: 0; left: 0; }
.progress-fill { height: 100%; background: var(--gold); transition: width 0.6s ease; }
6. Theme Reference List (50 Themes)
Indian, Contemporary, Modern, Eclectic, American, Asian, Coastal, Industrial, Mediterranean, Transitional, Tropical, British Colonial, Scandinavian, Craftsman, Greek, Moroccan, Italian, Caribbean, Cottage, Italian Neoclassical, Rustic, Casual, Traditional, Pop Art, Farmhouse, Ambient Modern, Victorian, Midcentury Modern, Minimalist, Nautical, Oriental, Hollywood Glam, Japandi, French, Shabby Chic, Sustainable, Art Deco, Dark Interior, Biophilic, Boho, African, Egyptian, Chinese, Pirate Patric, Steampunk, Cyberpunk, Atompunk, Stoneage, Antique, Pet Friendly.


---

### 2. The Prompt for Cursor AI
Once you have created the file above, open **Cursor**, press **Cmd+K (Mac)** or **Ctrl+K (Windows)**, and type:

> "I want to add a new lead-gen feature to my website. Follow the full technical plan in `ai-style-discovery-engine.md`. 
> 1. Create a new router for `/style-discovery`.
> 2. Use the provided CSS to make the quiz feel like a premium game.
> 3. Implement the logic for static seeds (Steps 1-3) and dynamic AI generation (Steps 4-10).
> 4. Ensure the Admin Email includes the SMS follow-up script and the generated PDF as an attachment.
> 5. Use Gemini 2.5 Flash-Lite for text and Imagen 4 Fast for visuals."

---

### One Final Tip for the "App Password":
Since you are using Gmail to send the admin emails:
1. Go to your **Google Account Settings** > **Security**.
2. Search for **"App Passwords"** (you must have 2-Step Verification on).
3. Generate a password for "Mail" and "Other (Custom Name: Interior App)".
4. Use that **16-character code** in your `.env` file as `EMAIL_PASS`.