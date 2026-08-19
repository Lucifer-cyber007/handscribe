"""
AI Summarizer backing /api/pdf/summarize.

Deliberately calls Groq directly with a fixed model (openai/gpt-oss-120b)
rather than going through the app's configurable LLM_PROVIDER/get_llm_provider()
— this is a fixed choice for this one tool, independent of whichever
provider (Groq/Gemini/Vertex) is configured for the extraction workflow.

gpt-oss-120b is a reasoning model: a live test call confirmed Groq returns
its reasoning in a separate `message.reasoning` field, already cleanly
split from the actual summary in `message.content` — no <think>-tag
stripping needed here, unlike the llama-3.3 path in llm/base.py.
"""
from groq import Groq

from app.config import settings

SUMMARIZER_MODEL = "openai/gpt-oss-120b"

# Keeps a single call's prompt comfortably sized regardless of how long the
# source document is — Groq's free-tier tokens-per-minute budget (varies by
# account) can be burned through fast by a reasoning model on a very long
# document, so long input is truncated with a clear note rather than risking
# a rate-limit failure or a silently-incomplete summary.
MAX_INPUT_CHARACTERS = 24000

_SYSTEM_PROMPT = (
    "You are a precise summarization assistant. Read the given document "
    "text and produce a clear, well-organized summary: a short overview "
    "paragraph, followed by the key points as bullet points (using '- '). "
    "Only summarize information actually stated in the document — never "
    "invent, infer, or pad with plausible-sounding specifics (numbers, "
    "names, dates, next steps) that aren't genuinely present in the text. "
    "If the document is short or sparse, give a short summary rather than "
    "manufacturing extra detail to fill it out. Output ONLY the summary — "
    "no commentary, no preamble, no markdown code fences."
)


_ASK_SYSTEM_PROMPT_TEMPLATE = (
    "You are a precise assistant that answers questions using ONLY the "
    "document text provided below. Never use outside knowledge, and never "
    "invent, guess, or infer information that isn't actually stated in the "
    "document. If the answer isn't in the document, say so clearly instead "
    "of guessing.\n\n"
    "Format the answer in clean Markdown: short answers can be plain "
    "prose or a bullet list; only use a table when the question genuinely "
    "asks for structured/tabular data, and if you do, use valid GitHub-"
    "flavored Markdown table syntax with every row on its own line and a "
    "proper '| --- | --- |' header separator — never cram a table onto a "
    "single line.\n\nDOCUMENT:\n---\n{document}\n---"
)

# Bounds how much prior chat gets replayed into each new question's prompt
# — the document text itself already dominates prompt size, but an
# unbounded chat history would otherwise keep growing every turn.
MAX_HISTORY_MESSAGES = 10


class SummarizerError(RuntimeError):
    """Raised when a summary/answer can't be produced — callers turn this
    into a 502."""


class SummarizerNotConfiguredError(SummarizerError):
    """Raised when GROQ_API_KEY isn't set — AI Summarizer needs it
    regardless of which LLM_PROVIDER is configured for extraction."""


def _require_groq_configured() -> None:
    if not settings.groq_api_key:
        raise SummarizerNotConfiguredError(
            "AI Summarizer needs GROQ_API_KEY configured on the server "
            "(it always uses Groq for this tool, regardless of LLM_PROVIDER)."
        )


def _truncate(text: str) -> tuple[str, bool]:
    was_truncated = len(text) > MAX_INPUT_CHARACTERS
    return text[:MAX_INPUT_CHARACTERS], was_truncated


def _complete(messages: list[dict]) -> str:
    client = Groq(api_key=settings.groq_api_key)
    try:
        completion = client.chat.completions.create(
            model=SUMMARIZER_MODEL,
            messages=messages,
            temperature=0.2,
            max_completion_tokens=settings.groq_summarizer_max_completion_tokens,
        )
    except Exception as exc:
        raise SummarizerError(f"Groq API request failed: {exc}") from exc

    choice = completion.choices[0]
    if choice.finish_reason == "length":
        raise SummarizerError(
            "The response was cut off before completing (hit the token limit)."
        )

    content = (choice.message.content or "").strip()
    if not content:
        raise SummarizerError("The model returned an empty response.")
    return content


def summarize_text(text: str) -> str:
    _require_groq_configured()
    input_text, was_truncated = _truncate(text)

    prompt = f"Summarize the following document:\n\n---\n{input_text}\n---"
    summary = _complete(
        [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]
    )

    if was_truncated:
        summary += (
            "\n\n[Note: this document was long, so only the first "
            f"{MAX_INPUT_CHARACTERS:,} characters were summarized.]"
        )
    return summary


def answer_question(document_text: str, question: str, history: list[dict]) -> str:
    """Grounded Q&A over a specific document's already-extracted text (no
    file re-upload, no re-running OCR per question) — the frontend caches
    the text returned from the initial /summarize call and sends it back
    with each follow-up question."""
    _require_groq_configured()
    input_text, _ = _truncate(document_text)

    messages = [
        {"role": "system", "content": _ASK_SYSTEM_PROMPT_TEMPLATE.format(document=input_text)}
    ]
    messages.extend(history[-MAX_HISTORY_MESSAGES:])
    messages.append({"role": "user", "content": question})

    return _complete(messages)
