# SanitX

### AI-Powered PDF Prompt Injection Detection

SanitX is a security-focused PDF inspection pipeline designed to detect **prompt injection attacks hidden inside PDF documents** before the document is processed by an AI system.

The core idea is simple:

> **Treat every uploaded PDF as untrusted input.**

SanitX combines deterministic PDF analysis with semantic AI analysis to identify suspicious content that traditional text extraction alone may miss.

---

## How It Works

```text
                    ┌─────────────────┐
                    │   PDF Upload    │
                    │    Frontend     │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    FastAPI      │
                    │     Router      │
                    └────────┬────────┘
                             │
                             ▼
                 ┌───────────────────────┐
                 │       Layer 1         │
                 │      PyMuPDF          │
                 │                       │
                 │  • Tiny text         │
                 │  • Low contrast      │
                 │  • Border placement  │
                 │  • Suspicious SQL    │
                 └──────────┬────────────┘
                            │
             ┌──────────────┴──────────────┐
             │                             │
             ▼                             ▼
      Suspicious Regions          Dangerous SQL Queries
             │                             │
             └──────────────┬──────────────┘
                            │
                            ▼
                 ┌───────────────────────┐
                 │       Layer 2         │
                 │    Gemini Semantic    │
                 │       Analysis        │
                 │                       │
                 │  • Context analysis   │
                 │  • Intent detection   │
                 │  • Prompt injection   │
                 │    detection          │
                 └──────────┬────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │ ACCEPT / REJECT  │
                  │     + Evidence   │
                  └────────┬─────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Frontend  │
                    │             │
                    │ 🟢 Accepted │
                    │ 🔴 Rejected │
                    └─────────────┘
```

---

## Detection Architecture

### Layer 1 — Deterministic Analysis

Layer 1 uses **PyMuPDF** to inspect the PDF at a low level.

It currently looks for suspicious characteristics such as:

* Extremely small text
* Text with very low contrast against its local background
* Text positioned unusually close to the page border
* Potentially dangerous SQL queries

When suspicious text is detected, SanitX records its:

* Page number
* Bounding-box coordinates
* Detection reason

Suspicious regions are also highlighted in a modified copy of the PDF.

The important distinction is that **Layer 1 does not make the final security decision**.

It produces evidence for Layer 2.

---

### Layer 2 — Semantic Analysis

The modified PDF, suspicious-region coordinates, and dangerous SQL-query list are passed to **Gemini** through its REST API.

Layer 2 analyzes the document semantically and determines whether the suspicious content actually represents a prompt injection.

It considers:

* The document's overall context
* The purpose of the document
* Text surrounding suspicious regions
* Hidden or obfuscated instructions
* Direct AI manipulation attempts
* Indirect prompt injection
* Attempts to override instructions
* Attempts to extract sensitive information
* Attempts to execute SQL, code, or external actions
* Multi-region and multi-page attacks
* Legitimate content that could otherwise produce false positives

Layer 2 ultimately produces a structured security decision:

```json
{
  "decision": "ACCEPT",
  "confidence": 0.0,
  "reason": "...",
  "evidence": []
}
```

---

## Why Two Layers?

A purely rule-based detector can identify suspicious formatting, but it cannot reliably determine **intent**.

For example:

```text
Tiny text
```

could be:

* malicious hidden instructions, or
* a legitimate footnote.

Likewise:

```sql
SELECT * FROM users;
```

could be:

* ordinary technical documentation, or
* part of an attack targeting an AI agent with database access.

Therefore:

```text
Layer 1
Deterministic evidence
        ↓
Layer 2
Semantic reasoning
        ↓
Final security decision
```

This separation allows SanitX to combine **precise low-level PDF inspection** with **context-aware semantic analysis**.

---

## Security Philosophy

SanitX follows an important principle:

> **The PDF is data, not instructions.**

Everything extracted from the document is considered untrusted.

This includes:

* Text
* SQL
* URLs
* Commands
* Code
* Metadata
* Hidden content
* Instructions directed at AI systems

Gemini is instructed to **analyze** these elements rather than follow them.

---

## Tech Stack

### Backend

* Python
* FastAPI
* PyMuPDF
* HTTPX
* Google Gemini REST API
* python-dotenv

### Frontend

* Web-based PDF upload interface
* Visual ACCEPT / REJECT feedback
* Suspicious-content explanation

---

## Current Pipeline

```text
Upload PDF
   ↓
FastAPI
   ↓
Layer 1 — PyMuPDF
   ↓
Highlight suspicious content
   ↓
Collect suspicious coordinates
   ↓
Collect dangerous SQL queries
   ↓
Create edited PDF
   ↓
Layer 2 — Gemini
   ↓
Semantic security analysis
   ↓
Structured decision
   ↓
Frontend
```

---

## Project Goals

SanitX is being developed toward a production-oriented PDF security pipeline capable of detecting prompt injection attacks that may otherwise be invisible to users.

The long-term goal is to make AI document processing safer by providing a security layer between:

```text
Untrusted Documents
        ↓
     SanitX
        ↓
    AI Systems
```

---

## Status

🚧 **Currently under active development**

The core two-layer inspection architecture is being implemented.

Current focus:

* PDF-level suspicious content detection
* Suspicious-region tracking
* SQL query analysis
* Gemini semantic analysis
* Structured security decisions
* Frontend visualization
