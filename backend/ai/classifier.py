"""
Gemini Vision Road Damage Classifier (Stable Version)
"""

import os
import json
import re
import PIL.Image
from google import genai


PROMPT = """
You are a road damage detection AI for Nepal (SadakSathi app).

Return ONLY valid JSON. No markdown. No explanation.

If NOT a road image:
{
"is_road_image": false,
"damage_type": "not_road",
"damage_type_nepali": "सडकको फोटो होइन",
"confidence": 0.99,
"severity_suggestion": "none",
"description": "Not a road image.",
"description_nepali": "यो सडकको फोटो होइन।"
}

If ROAD image:
{
"is_road_image": true,
"damage_type": "pothole | crack | landslide_debris | waterlogging | good_road",
"damage_type_nepali": "गड्ढा | चर्को | पहिरो | पानी जमेको | राम्रो सडक",
"confidence": 0.0,
"severity_suggestion": "low | medium | high",
"description": "One sentence English",
"description_nepali": "एक वाक्य नेपाली"
}

Rules:
- pothole = high
- crack = medium
- landslide_debris = high
- waterlogging = medium
- good_road = low
"""


def safe_json_parse(text: str):
    """Robust JSON parser for Gemini responses."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.S)
        if match:
            return json.loads(match.group())
        raise ValueError(f"Invalid JSON response: {text}")


def analyze_road_image(image_path: str) -> dict:
    if not os.path.exists(image_path):
        raise FileNotFoundError("Image not found")

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)

    try:
        image = PIL.Image.open(image_path).convert("RGB")

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[image, PROMPT],
        )

        if not response.text:
            raise ValueError("Empty response from Gemini")

        text = response.text.strip()

        # remove markdown if exists
        if text.startswith("```"):
            text = text.strip("```")
            if text.startswith("json"):
                text = text[4:].strip()

        return safe_json_parse(text)

    except Exception as e:
        raise ValueError(f"Gemini analysis failed: {str(e)}")