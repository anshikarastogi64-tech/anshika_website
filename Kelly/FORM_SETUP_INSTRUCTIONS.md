# Dream Contact Form Setup Instructions

## What the form does:

1. **Opens a beautiful modal** when user clicks "YES! Let's Build My Dream Home"
2. **Collects user details**: Name, Mobile, Email, Project Type, Message
3. **Sends to admin email** (you)
4. **Opens WhatsApp** with amazing welcome message to customer
5. **Notifies admin** via WhatsApp about new lead

## Setup Steps:

### Step 1: Configure Email Service (Formspree - FREE)

1. Go to https://formspree.io/
2. Sign up for FREE account
3. Create a new form
4. Copy your form endpoint (looks like: `https://formspree.io/f/xyzabc123`)
5. Open `Kelly/assets/js/dream-form.js`
6. Replace line 8:
   ```javascript
   formspreeEndpoint: 'https://formspree.io/f/YOUR_FORM_ID'
   ```
   With your actual endpoint:
   ```javascript
   formspreeEndpoint: 'https://formspree.io/f/xyzabc123'
   ```

### Step 2: Configure Admin Contact

In `Kelly/assets/js/dream-form.js`, update lines 6-8:

```javascript
adminEmail: 'your-actual-email@gmail.com',
adminMobile: '919557058902', // Your WhatsApp number with country code
adminWhatsApp: '919557058902',
```

### Step 3: Test the Form

1. Open the website
2. Click "YES! Let's Build My Dream Home" button
3. Fill the form
4. Submit
5. Check:
   - Email arrives in your inbox
   - WhatsApp opens with customer message
   - Admin WhatsApp notification appears

## Alternative Email Services (if not using Formspree):

### Option 1: EmailJS (FREE)
- Website: https://www.emailjs.com/
- No backend needed
- 200 emails/month free

### Option 2: Web3Forms (FREE)
- Website: https://web3forms.com/
- Unlimited emails
- Super simple setup

### Option 3: Google Forms + Zapier
- Use Google Forms as backend
- Zapier connects to email/WhatsApp
- More complex but powerful

## Customization:

### Change WhatsApp Message to Customer:
Edit lines 158-180 in `dream-form.js`

### Change Form Fields:
Edit the HTML form in `Kelly/index.html` (search for "dreamContactForm")

### Change Success Message:
Edit lines 1251-1256 in `Kelly/index.html`

## Support:

If you need help setting this up, please contact your developer or:
1. Check Formspree documentation: https://help.formspree.io/
2. Watch setup video: [Link to video tutorial]
3. Contact: support@formspree.io

---

**Note**: The form is already styled and functional. You just need to configure the email endpoint!
