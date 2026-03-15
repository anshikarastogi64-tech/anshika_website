1. Dependency Upgrade
Cursor: We are switching from the standard Gemini SDK to the Vertex AI SDK to utilize the paid project billing.

Action: Run npm uninstall @google/generative-ai

Action: Run npm install @google-cloud/vertexai

2. Authentication Strategy (ADC)
Cursor: The app will now use Application Default Credentials (ADC). Ensure the code does not rely on a simple API Key string if running in a Vertex AI context.

JavaScript
const { VertexAI } = require('@google-cloud/vertexai');

// Initialize Vertex AI with your specific project
const vertexAI = new VertexAI({
  project: 'anshika-website-persona', 
  location: 'us-central1' // Or your preferred region
});

// For Image Generation (Imagen 3)
const generativeModel = vertexAI.getGenerativeModel({
  model: 'imagen-3.0-generate-001',
});
3. Strict Image Prompt Rectification
The current images (like the cat statue) are irrelevant. We must enforce a "Professional Interior Photographer" persona.

Rule: Every dynamic prompt must be wrapped in this template:

"A professional, high-end interior design photograph of a [ROOM_TYPE].
Theme: [USER_SELECTION].
Composition: Symmetrical wide shot, architectural photography.
Lighting: Soft natural light.
Strict Negative Prompt: No people, no outdoor streets, no statues, no animals, no cars."

4. Local Development Fix (For You)
If you are developing locally on your computer, you must run this command in your terminal for Cursor to have permission to use your paid project:
gcloud auth application-default login