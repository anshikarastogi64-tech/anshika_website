1. The Critical Fix: "Room-Bound" System Instruction
Cursor: Update the Gemini System Instruction. We must explicitly forbid outdoor scenes, statues, and streets. The AI must act as an Interior Photographer, not a Travel Photographer.

New System Prompt:
"You are an Elite Interior Design AI. Your task is to generate 4 visual options for a personality quiz.
CRITICAL RULE: All images MUST be interior shots of rooms (Living room, Bedroom, Kitchen, etc.) or close-up material textures.
FORBIDDEN: No outdoor streets, no statues, no people, no cars, no exterior architecture.
STYLE: Use Architectural Photography standards: wide-angle, symmetrical, 8k, photorealistic, high-end lighting."

2. Phase 1: The "Seed Anchor" Rectification (Steps 1-3)
To prevent the AI from generating random 'essences,' we use pre-defined, high-fidelity interior prompts for the first 3 questions.

Q1: The "Atmosphere" Filter
Option A (Natural): "A sun-drenched Japandi living room, light oak wood, floor-to-ceiling windows, soft linen sofa, minimal greenery, 8k, photorealistic."

Option B (Industrial): "A dramatic dark industrial loft, exposed brick, vintage leather armchair, cinematic spotlighting, cool shadows, metallic accents, 8k."

Option C (Ornate): "A royal Indian lounge with intricate hand-carved jali screens, velvet crimson cushions, brass lamps, warm ambient lighting, 8k."

Option D (Minimal): "An ultra-minimalist white gallery-style room, sharp geometric lines, floating designer furniture, polished concrete, high-end negative space, 8k."

Q2: The "Texture" Filter (The Fix for the 'Cat' Image)
Instead of 'Mediterranean Essence,' use these tactile interior details:

Option A: "Close-up of hand-laid terracotta tiles and raw clay plaster interior wall, Mediterranean texture, 8k."

Option B: "Close-up of a white marble countertop with gold veins, luxury kitchen detail, high-end finish, 8k."

Option C: "A shot of polished concrete meeting a warm walnut wood floor transition, modern interior architectural detail, 8k."

Option D: "Macro shot of a heavy-weave blue and white Mediterranean textile draped over a wooden chair, 8k."

3. UI/UX Polish: Premium Game Interface
Cursor: Replace current quiz styles with this high-end version to ensure the user feels they are in a luxury experience.

4. Final Instruction for Cursor
"The current implementation is generating outdoor scenes and irrelevant statues (like cats) for interior design questions.

Update the Gemini System Prompt to strictly enforce INTERIOR PHOTOGRAPHY only.

Use the 'Seed Anchor' prompts for the first 3 questions to set the luxury standard.

Apply the new CSS for a premium, game-like user experience.

Ensure that after Step 3, the dynamic prompts always include the prefix: 'High-end interior design photograph of...'"