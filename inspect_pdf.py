import os
import base64
import httpx
from dotenv import load_dotenv
import pymupdf

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")


async def inspect_pdf(file):

    async def layer_1(file):

        pdf_bytes = await file.read()

        doc = pymupdf.open(
            stream=pdf_bytes,
            filetype="pdf"
        )

        for page in doc:

            page_width = page.rect.width
            page_height = page.rect.height

            # Distance from the page edge considered "near border"
            border_margin = 20

            text_dict = page.get_text("dict")

            for block in text_dict.get("blocks", []):

                # Only process text blocks
                if block.get("type") != 0:
                    continue

                for line in block.get("lines", []):

                    for span in line.get("spans", []):

                        suspicious = False

                        # -------------------------
                        # CONDITION 1:
                        # Very small text
                        # -------------------------

                        if span["size"] < 4.0:
                            suspicious = True


                        # -------------------------
                        # CONDITION 2:
                        # White / near-white text
                        # -------------------------

                        color = span["color"]

                        red = (color >> 16) & 255
                        green = (color >> 8) & 255
                        blue = color & 255

                        near_white = min(red, green, blue) >= 235

                        if near_white:
                            suspicious = True


                        # -------------------------
                        # CONDITION 3:
                        # Text near page border
                        # -------------------------

                        x0, y0, x1, y1 = span["bbox"]

                        near_left = x0 <= border_margin
                        near_top = y0 <= border_margin
                        near_right = x1 >= page_width - border_margin
                        near_bottom = y1 >= page_height - border_margin

                        near_border = (
                            near_left
                            or near_top
                            or near_right
                            or near_bottom
                        )

                        if near_border:
                            suspicious = True


                        # -------------------------
                        # HIGHLIGHT
                        # -------------------------

                        if suspicious:
                            bbox = pymupdf.Rect(span["bbox"])
                            page.add_highlight_annot(bbox)

        # Convert edited PDF back to bytes
        edited_pdf = doc.tobytes()
        doc.close()
        return edited_pdf


    async def layer_2(edited_pdf: bytes):
        prompt = ""
        pdf_base64 = base64.b64encode(edited_pdf).decode("utf-8")
        headers = {
            "x-goog-api-key": GOOGLE_API_KEY
        }
        data = {
            "model": "gemini-3.1-flash-lite",
            "input": [
                {
                    "type": "text",
                    "text": prompt
                },
                {
                    "type": "document",
                    "data": pdf_base64,
                    "mime_type": "application/pdf"
                }
            ]
        }

        url = "https://generativelanguage.googleapis.com/v1beta/interactions"

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                url,
                headers=headers,
                json=data
            )
            answer = response.json()

        steps = answer.get("steps", [])
        for step in steps:
            content = step.get("content", [])
            for item in content:
                if item.get("type") == "text":
                    return item.get("text", "")
        return ""

    # -------------------------
    # INSPECTION PIPELINE
    # -------------------------

    edited_pdf = await layer_1(file)
    result = await layer_2(edited_pdf)
    return result
