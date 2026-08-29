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

            # -------------------------------------------------
            # Render the ORIGINAL page once for pixel analysis.
            # PDF annotations are excluded.
            # -------------------------------------------------

            pix = page.get_pixmap(
                matrix=pymupdf.Matrix(2, 2),
                colorspace=pymupdf.csRGB,
                alpha=False,
                annots=False
            )

            text_dict = page.get_text("dict")

            for block in text_dict.get("blocks", []):

                # Only process text blocks
                if block.get("type") != 0:
                    continue

                for line in block.get("lines", []):

                    for span in line.get("spans", []):

                        suspicious = False

                        # -------------------------------------------------
                        # CONDITION 1:
                        # Very small text
                        # -------------------------------------------------

                        if span["size"] < 4.0:
                            suspicious = True

                        # -------------------------------------------------
                        # CONDITION 2:
                        # Text color vs local background color
                        # -------------------------------------------------

                        color = span["color"]

                        text_r = (color >> 16) & 255
                        text_g = (color >> 8) & 255
                        text_b = color & 255

                        x0, y0, x1, y1 = span["bbox"]

                        scale = 2

                        # Convert PDF coordinates to pixel coordinates
                        px0 = max(0, int(x0 * scale))
                        py0 = max(0, int(y0 * scale))
                        px1 = min(pix.width, int(x1 * scale))
                        py1 = min(pix.height, int(y1 * scale))

                        # Number of pixels sampled around the text
                        padding = 4 * scale

                        samples = []

                        # Top
                        for y in range(
                                max(0, py0 - padding),
                                py0
                        ):
                            for x in range(px0, px1):
                                samples.append(pix.pixel(x, y))

                        # Bottom
                        for y in range(
                                py1,
                                min(pix.height, py1 + padding)
                        ):
                            for x in range(px0, px1):
                                samples.append(pix.pixel(x, y))

                        # Left
                        for y in range(py0, py1):
                            for x in range(
                                    max(0, px0 - padding),
                                    px0
                            ):
                                samples.append(pix.pixel(x, y))

                        # Right
                        for y in range(py0, py1):
                            for x in range(
                                    px1,
                                    min(pix.width, px1 + padding)
                            ):
                                samples.append(pix.pixel(x, y))

                        if samples:

                            # -------------------------------------------------
                            # Estimate local background using median RGB.
                            # Median is less affected by unrelated pixels.
                            # -------------------------------------------------

                            samples.sort(
                                key=lambda pixel: (
                                        pixel[0]
                                        + pixel[1]
                                        + pixel[2]
                                )
                            )

                            middle = len(samples) // 2

                            bg_r = samples[middle][0]
                            bg_g = samples[middle][1]
                            bg_b = samples[middle][2]

                            # -------------------------------------------------
                            # Calculate RGB distance between text and background
                            # -------------------------------------------------

                            color_difference = (
                                    (
                                            (text_r - bg_r) ** 2
                                            + (text_g - bg_g) ** 2
                                            + (text_b - bg_b) ** 2
                                    ) ** 0.5
                            )

                            # Very low contrast
                            if color_difference < 25:
                                suspicious = True

                        # -------------------------------------------------
                        # CONDITION 3:
                        # Text near page border
                        # -------------------------------------------------

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

                        # -------------------------------------------------
                        # HIGHLIGHT SUSPICIOUS TEXT
                        # -------------------------------------------------

                        if suspicious:
                            bbox = pymupdf.Rect(
                                span["bbox"]
                            )
                            page.add_highlight_annot(bbox)

        # -------------------------------------------------
        # Convert edited PDF back to bytes
        # -------------------------------------------------

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
