"""
Gemini Vision Road Damage Classifier
Falls back to rule-based analysis if Gemini API key is missing/invalid.
"""

import os
import json
import re
import PIL.Image


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


def _is_valid_gemini_key(key: str) -> bool:
    """Accept AIza... (AI Studio) or AQ... (Vertex Express) keys."""
    return bool(key and len(key) > 20 and (key.startswith("AIza") or key.startswith("AQ.")))


def _fallback_analysis(image_path: str) -> dict:
    """
    Rule-based fallback when Gemini is unavailable.
    Uses basic image brightness/color heuristics to guess damage type.
    Always marks is_road_image=True so the form can continue.
    """
    try:
        img = PIL.Image.open(image_path).convert("RGB")
        img_small = img.resize((64, 64))
        pixels = list(img_small.getdata())

        # Average brightness
        brightness = sum(r + g + b for r, g, b in pixels) / (len(pixels) * 3 * 255)

        # Dark patches suggest potholes/damage
        dark_pixels = sum(1 for r, g, b in pixels if (r + g + b) / 3 < 80)
        dark_ratio = dark_pixels / len(pixels)

        if dark_ratio > 0.3:
            return {
                "is_road_image": True,
                "damage_type": "pothole",
                "damage_type_nepali": "गड्ढा",
                "confidence": 0.55,
                "severity_suggestion": "high",
                "description": "Possible road damage detected. Please verify severity.",
                "description_nepali": "सडकमा क्षति देखिएको छ। कृपया जाँच गर्नुहोस्।",
                "_fallback": True,
            }
        elif brightness < 0.35:
            return {
                "is_road_image": True,
                "damage_type": "crack",
                "damage_type_nepali": "चर्को",
                "confidence": 0.50,
                "severity_suggestion": "medium",
                "description": "Surface irregularity detected. Please verify.",
                "description_nepali": "सतहमा असमानता देखिएको छ।",
                "_fallback": True,
            }
        else:
            return {
                "is_road_image": True,
                "damage_type": "crack",
                "damage_type_nepali": "चर्को",
                "confidence": 0.45,
                "severity_suggestion": "medium",
                "description": "Road image received. Manual severity selection recommended.",
                "description_nepali": "सडकको फोटो प्राप्त भयो। कृपया गम्भीरता छान्नुहोस्।",
                "_fallback": True,
            }
    except Exception:
        return {
            "is_road_image": True,
            "damage_type": "crack",
            "damage_type_nepali": "चर्को",
            "confidence": 0.40,
            "severity_suggestion": "medium",
            "description": "Image received. Please select severity manually.",
            "description_nepali": "फोटो प्राप्त भयो। कृपया गम्भीरता छान्नुहोस्।",
            "_fallback": True,
        }


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

    api_key = os.environ.get("GEMINI_API_KEY", "")

    # Use fallback if key is missing or clearly invalid
    if not _is_valid_gemini_key(api_key):
        print("[AI] GEMINI_API_KEY not valid — using fallback analysis")
        return _fallback_analysis(image_path)

    try:
        from google import genai
        import PIL.Image as _PIL

        client = genai.Client(api_key=api_key)
        image = _PIL.open(image_path).convert("RGB")

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[image, PROMPT],
        )

        if not response.text:
            raise ValueError("Empty response from Gemini")

        text = response.text.strip()

        # Strip markdown code fences if present
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)

        return safe_json_parse(text)

    except Exception as e:
        print(f"[AI] Gemini failed: {e} — using fallback")
        return _fallback_analysis(image_path)