---
name: persona-image-generator
description: Generate stylized persona/character images (single or multi-variation) for agents, profile pictures, and "draw me" requests. Use when a user asks for an image/avatar/persona concept, visual style exploration, or consistent character sheets. Prefer this skill for creative image generation requests instead of long text-only descriptions.
---

# Persona Image Generator

Generate a concrete image output (not just a prompt) for persona/avatar requests.

## Workflow

1. Extract intent in one line: subject + style + mood + output usage.
2. Ask only missing essentials (max 3):
   - style (pixel-art, anime, cinematic, minimal, etc.)
   - framing (portrait, full-body, scene)
   - constraints (colors, outfit, symbols, no-go items)
3. Create one strong base prompt + 2 variations.
4. Invoke the configured image-generation capability (e.g., nano-banana-pro) and produce image outputs.
5. Return:
   - generated image(s)
   - short caption per image
   - reusable final prompt text

## Prompt template

Use this structure:

`<subject>, <visual style>, <camera/framing>, <lighting>, <palette>, <mood>, <environment>, high detail, clean composition, no text watermark`

## Defaults

- If user says "draw your persona":
  - subject: friendly AI assistant mascot
  - style: modern pixel-art or clean illustration
  - framing: portrait (head + shoulders)
  - mood: warm, competent, calm
- Generate 3 variants unless user asks for 1.

## Quality checks

Before finalizing, verify:

- subject matches requested identity
- style is clearly visible
- no unwanted text/watermarks
- output is usable as avatar/banner (if requested)

## Output format

Provide concise output:

1. `Variant A/B/C` + one-line style description
2. Attach image(s)
3. `Prompt used:` block for reuse/editing

## Do not

- Do not respond with prompt-only if user explicitly asked for generated images.
- Do not over-question; proceed with sensible defaults when possible.
- Do not include copyrighted character names unless user explicitly requests parody/fan style.
