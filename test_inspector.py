import asyncio
import os
from inspect_pdf import inspect_pdf

class MockUploadFile:
    def __init__(self, filename):
        self.filename = filename
        
    async def read(self):
        with open(self.filename, "rb") as f:
            return f.read()

async def main():
    file = MockUploadFile("sanitx_test.pdf")
    try:
        result = await inspect_pdf(file)
        print("RESULT:")
        print(result)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
