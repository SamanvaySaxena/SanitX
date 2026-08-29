import pymupdf

def scan_and_highlight(pdf_bytes: bytes) -> bytes:
    """
    Scans a PDF document from raw bytes for potentially hidden text
    and highlights the detected text. It checks for:
    - Text smaller than 4.0pt
    - Text colored pure white (16777215)
    
    Time and Space Complexity Analysis:
    - Let N be the total number of pages in the PDF.
    - Let B be the maximum number of text blocks on any given page.
    - Let L be the maximum number of lines in a block.
    - Let S be the maximum number of spans in a line.
    
    Time Complexity:
    - Opening the document from bytes is O(1) wrt the number of pages, though
      parsing the overall PDF structure takes O(P) where P is the file size.
    - Iterating through pages takes O(N) time.
    - `page.get_text("dict")` extracts a dictionary of all text elements.
      Extracting the text dictionary takes O(B * L * S) per page.
    - Iterating through blocks, lines, and spans takes O(B * L * S) per page.
    - Drawing a highlight annotation `add_highlight_annot` takes O(1) per detected span.
    - Re-saving the document `doc.tobytes()` takes O(P) where P is the total PDF size.
    Overall Time Complexity: O(P + N * B * L * S), which scales linearly with the number
    of text spans across all pages and the overall file size.

    Space Complexity:
    - Loading the document creates an in-memory representation taking O(P) space.
    - `page.get_text("dict")` creates a python dictionary representing the text of the page.
      This requires O(B * L * S) space per page, which is garbage collected each loop iteration.
    - Storing the highlighted PDF bytes at the end takes O(P') space, where P' is the new file size.
    Overall Space Complexity: O(P + max(B * L * S)), which scales linearly with the file size
    and the densest page's text content.
    
    Args:
        pdf_bytes (bytes): The raw bytes of the original PDF document.
        
    Returns:
        bytes: The raw bytes of the modified PDF document with highlights.
    """
    # Open the document entirely in memory
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    
    # Iterate through all pages in the document
    for page in doc:
        # Get all text elements as a structured dictionary
        text_dict = page.get_text("dict")
        
        # Iterate over text blocks
        for block in text_dict.get("blocks", []):
            # Only process blocks of type 0 (text)
            if block.get("type") != 0: 
                continue
                
            # Iterate over lines in the block
            for line in block.get("lines", []):
                # Iterate over spans of text within the line
                for span in line.get("spans", []):
                    suspicious = False
                    
                    # Condition 1: Font size is strictly less than 4.0pt
                    if span["size"] < 4.0:
                        suspicious = True
                        
                    # Condition 2: Color is pure white (16777215 is 0xFFFFFF)
                    if span["color"] == 16777215:
                        suspicious = True
                        
                    # If the text is suspicious, highlight it
                    if suspicious:
                        bbox = pymupdf.Rect(span["bbox"])
                        # Draw a visible highlight annotation (yellow by default) over the bbox
                        page.add_highlight_annot(bbox)
                        
    # Save the modified document to raw bytes in memory
    modified_pdf_bytes = doc.tobytes()
    
    # Close the document to free up native resources
    doc.close()
    
    return modified_pdf_bytes
