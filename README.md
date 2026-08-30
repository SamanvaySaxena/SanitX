# SanitX

### AI-Powered Document Prompt Injection Detection

SanitX is a security-focused inspection pipeline designed to detect **prompt injection attacks hidden inside documents (PDF and Markdown)** before the document is processed by an AI system.

The core idea is simple:

> **Treat every uploaded document as untrusted input.**

SanitX combines deterministic, format-specific analysis with semantic AI analysis to identify suspicious content that traditional text extraction alone may miss.

---

## How It Works

```text
                    ┌─────────────────┐
                    │ Document Upload │
                    │ (PDF/Markdown)  │
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
                 │ Deterministic Scanner │
                 │                       │
                 │ PDF:                  │
                 │ • Tiny text           │
                 │ • Low contrast        │
                 │ • Border placement    │
                 │ • Active content strip│
                 │                       │
                 │ Markdown:             │
                 │ • Invisible Unicode   │
                 │ • Hidden HTML comments│
                 │ • CSS hidden text     │
                 │ • Active tags & URIs  │
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
                    │ 🟢 Verified │
                    │ 🟡 Review   │
                    │ 🔴 Blocked  │
                    └─────────────┘
```

---

## Detection Architecture

### Layer 1 — Deterministic Analysis

Layer 1 inspects the raw document at a low level based on its file type. It does not make the final security decision; it produces evidence for Layer 2 and neutralizes active executable content before handing it over.

#### PDF Analysis (via PyMuPDF)
It parses the visual pixel and text layers to detect suspicious characteristics:
* Extremely small text (e.g., under 2.0pt)
* Text with very low contrast against its local background
* Text positioned unusually close to the page border
* Dangerous embedded SQL queries
* **Sanitization (P0-7 fix):** Strips active content including `/JavaScript`, `/OpenAction`, executable annotations, and XFA streams.

#### Markdown/HTML Analysis (Heuristic Scan)
It parses the raw source text to identify hidden instructions invisible to human readers but visible to LLMs:
* Invisible or zero-width Unicode characters
* HTML comments (`&lt;!-- --&gt;`)
* Inline CSS hiding text (`display: none`, `opacity: 0`)
* Raw active HTML tags (`&lt;script&gt;`, `&lt;iframe&gt;`, `&lt;meta&gt;`)
* Suspicious URI schemes (`javascript:`, `data:`)
* **Sanitization:** Neutralizes executable HTML tags and script-executing URIs.

When suspicious text is detected in either format, SanitX records its precise location (bounding box or line number) and the detection reason, passing this as structured evidence.

---

### Layer 2 — Semantic Analysis

The sanitized document, suspicious-region coordinates, and dangerous SQL-query list are passed to **Gemini** through its REST API.

Layer 2 analyzes the document semantically and determines whether the suspicious content actually represents a prompt injection.

It considers:

* The document's legitimate context and purpose
* Text surrounding suspicious regions
* Hidden or obfuscated instructions
* Direct AI manipulation attempts (e.g., overriding instructions)
* Indirect prompt injection
* Attempts to extract sensitive information or execute unauthorized code/SQL
* Multi-region and multi-page distributed attacks
* Legitimate content that could otherwise produce false positives (e.g., a SQL tutorial vs. a malicious SQL injection attempt)

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

* malicious hidden instructions targeting an LLM, or
* a legitimate legal footnote.

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

This separation allows SanitX to combine **precise low-level inspection** with **context-aware semantic analysis**.

---

## Security Philosophy

SanitX follows an important principle:

> **The document is data, not instructions.**

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

Gemini is instructed to **analyze** these elements rather than follow them. The pipeline ensures active content is neutralized *before* Layer 2 ever sees the document.

---

## Tech Stack

### Backend
* Python
* FastAPI (API router)
* PyMuPDF (PDF structural & visual analysis)
* HTTPX
* Google Gemini REST API
* python-dotenv

### Frontend (`/web`)
* Next.js (React 19, TypeScript)
* Tailwind CSS
* GSAP (Scrollytelling and pipeline visualization animations)
* Vitest (Frontend testing)

The frontend is designed with two distinct zones: a narrative scrollytelling introduction ("The Reveal") that visually demonstrates prompt injection, and a dense, fast instrument view ("The Instrument") for security engineers evaluating the tool's output.

---

## Current Pipeline

```text
Upload PDF / Markdown
   ↓
FastAPI
   ↓
Layer 1 — PyMuPDF / Heuristic Scan
   ↓
Highlight / identify suspicious content
   ↓
Collect suspicious coordinates & lines
   ↓
Collect dangerous SQL queries
   ↓
Create edited document 
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

SanitX is being developed toward a production-oriented document security pipeline capable of detecting prompt injection attacks that may otherwise be invisible to users.

The long-term goal is to make AI document processing safer by providing a security layer between:

```text
Untrusted Documents (PDF/Markdown)
         ↓
      SanitX
         ↓
     AI Systems
```

---

 