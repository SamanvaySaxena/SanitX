from reportlab.lib.colors import Color
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


def create_clean_test_pdf(filename):
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter

    c.setFillColor(Color(0, 0, 0))
    c.setFont("Helvetica-Bold", 20)
    c.drawString(72, height - 90, "SanitX Clean Invoice Sample")

    c.setFont("Helvetica", 12)
    rows = [
        "Invoice 2026-041",
        "Bill to: Northwind Ltd",
        "Subtotal: 4,200.00",
        "Tax: 756.00",
        "Total due: 4,956.00",
        "Payment terms: Net 30",
    ]
    for i, row in enumerate(rows):
        c.drawString(72, height - 135 - i * 24, row)

    c.setFont("Helvetica", 10)
    c.drawString(72, 80, "Generated for scanner integration testing.")
    c.save()


if __name__ == "__main__":
    create_clean_test_pdf("sanitx_clean_test.pdf")
    print("Created sanitx_clean_test.pdf")
