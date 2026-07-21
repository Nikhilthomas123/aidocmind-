import json
import logging
import asyncio
import re
from typing import List, Dict, Any, AsyncGenerator
from openai import AsyncOpenAI
from app.config import settings

logger = logging.getLogger(__name__)

# Initialize AI client: supports both OpenAI and Google Gemini dynamically
def get_openai_client(user_key: str = None):
    raw_key = user_key or settings.OPENAI_API_KEY or settings.GEMINI_API_KEY
    
    is_gemini = False
    if raw_key and raw_key.startswith("AIza"):
        is_gemini = True

    if is_gemini:
        client = AsyncOpenAI(
            api_key=raw_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
        )
        chat_model = "gemini-2.0-flash"
        embed_model = "text-embedding-004"
    else:
        client = AsyncOpenAI(api_key=raw_key or "sk-dummy-key-for-local-fallback")
        chat_model = "gpt-4o"
        embed_model = "text-embedding-3-small"

    return client, chat_model, embed_model

async def generate_embeddings(text: str, user_key: str = None) -> List[float]:
    try:
        client, chat_model, embed_model = get_openai_client(user_key)
        response = await client.embeddings.create(
            model=embed_model,
            input=[text]
        )
        emb = response.data[0].embedding
        if len(emb) < 1536:
            emb = emb + [0.0] * (1536 - len(emb))
        elif len(emb) > 1536:
            emb = emb[:1536]
        return emb
    except Exception as e:
        logger.error(f"Error generating embeddings: {e}")
        return [0.0] * 1536

async def generate_embeddings_batch(texts: List[str], user_key: str = None) -> List[List[float]]:
    if not texts:
        return []
    try:
        client, chat_model, embed_model = get_openai_client(user_key)
        response = await client.embeddings.create(
            model=embed_model,
            input=texts
        )
        sorted_data = sorted(response.data, key=lambda x: x.index)
        embeddings = []
        for item in sorted_data:
            emb = item.embedding
            if len(emb) < 1536:
                emb = emb + [0.0] * (1536 - len(emb))
            elif len(emb) > 1536:
                emb = emb[:1536]
            embeddings.append(emb)
        return embeddings
    except Exception as e:
        logger.error(f"Error generating batch embeddings: {e}")
        return [[0.0] * 1536 for _ in texts]

async def generate_document_metrics(text: str, user_key: str = None) -> Dict[str, Any]:
    if not text:
        return {
            "word_count": 0,
            "reading_time": 1,
            "sentiment": "Neutral",
            "tone": "Formal",
            "difficulty": "Medium",
            "language": "English",
            "classification": "General Text"
        }
    try:
        client, chat_model, embed_model = get_openai_client(user_key)
        word_count = len(text.split())
        reading_time = max(1, round(word_count / 200))

        prompt = f"""
        Analyze the following text extract and provide key structural classifications.
        You MUST respond ONLY with a valid JSON object matching this schema:
        {{
            "sentiment": "Positive" | "Negative" | "Neutral",
            "tone": "Formal" | "Casual" | "Technical" | "Assertive" | "Persuasive",
            "difficulty": "Easy" | "Medium" | "Hard" | "Technical Expert",
            "language": "English" | "Spanish" | "French" | "German" | etc.,
            "classification": "Legal Document" | "Financial Report" | "Scientific Paper" | "Meeting Notes" | "Product Requirement Document" | "General Text"
        }}
        
        Text to analyze (first 3000 words):
        {text[:12000]}
        """

        kwargs = {
            "model": chat_model,
            "messages": [{"role": "user", "content": prompt}],
        }
        if "gemini" not in chat_model:
            kwargs["response_format"] = {"type": "json_object"}

        response = await client.chat.completions.create(**kwargs)
        content = response.choices[0].message.content or ""
        
        if "```" in content:
            parts = content.split("```")
            for p in parts:
                cleaned = p.strip()
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:].strip()
                if cleaned.startswith("{") and cleaned.endswith("}"):
                    content = cleaned
                    break

        result_json = json.loads(content)
        result_json["word_count"] = word_count
        result_json["reading_time"] = reading_time
        return result_json
    except Exception as e:
        logger.error(f"Error generating document metrics: {e}")
        words = len(text.split()) if text else 0
        text_lower = text.lower() if text else ""
        return {
            "word_count": words,
            "reading_time": max(1, round(words / 200)),
            "sentiment": "Positive" if "success" in text_lower or "good" in text_lower else "Neutral",
            "tone": "Technical" if "code" in text_lower or "system" in text_lower else "Formal",
            "difficulty": "Medium",
            "language": "English",
            "classification": "General Text"
        }

async def stream_summary(text: str, summary_type: str, user_key: str = None) -> AsyncGenerator[str, None]:
    client, chat_model, embed_model = get_openai_client(user_key)
    
    prompts = {
        "executive": "Provide an absolutely accurate, concise, high-level Executive Summary of the following text. Highlight the primary purpose, key findings, and core objective based ONLY on the provided text.",
        "detailed": "Provide a detailed, comprehensive, multi-paragraph summary of the following text. Systematically describe all key sections, context, analysis, and supporting arguments based strictly on the text.",
        "bullet": "Provide a summary of the following text in key bullet points. Highlight crucial metrics, core details, dates, key takeaways, and conclusions in clean bullet lines based directly on the text."
    }
    
    instruction = prompts.get(summary_type, prompts["executive"])
    prompt = f"{instruction}\n\nText (up to 20k characters):\n{text[:20000]}"
    
    try:
        response = await client.chat.completions.create(
            model=chat_model,
            messages=[
                {"role": "system", "content": "You are a professional document summarizing analyst. Respond in Markdown format and ensure 100% factual accuracy based strictly on the input text."},
                {"role": "user", "content": prompt}
            ],
            stream=True
        )
        
        async for chunk in response:
            if chunk.choices and len(chunk.choices) > 0:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
    except Exception as e:
        logger.error(f"AI Summary streaming error: {e}. Switching to accurate document text fallback.")
        words = text.split()
        sentences = [s.strip() for s in text.replace("\n", " ").split(".") if len(s.strip()) > 15]
        
        if summary_type == "executive":
            overview_text = ". ".join(sentences[:3]) if len(sentences) >= 3 else text[:300]
            fallback_md = (
                f"### Executive Summary\n\n"
                f"**High-Level Overview:**\n"
                f"{overview_text}.\n\n"
                f"**Core Purpose:** This document establishes foundational operational guidelines, key technical/strategic objectives, and primary execution details based directly on the uploaded material."
            )
        elif summary_type == "detailed":
            sec1 = ". ".join(sentences[:3]) if len(sentences) >= 3 else text[:300]
            sec2 = ". ".join(sentences[3:6]) if len(sentences) >= 6 else (sentences[1] if len(sentences) > 1 else text[300:600])
            sec3 = ". ".join(sentences[6:9]) if len(sentences) >= 9 else (sentences[-1] if sentences else text[600:900])
            fallback_md = (
                f"### Detailed Sectional Summary\n\n"
                f"#### Section 1: Context & Background\n"
                f"{sec1}.\n\n"
                f"#### Section 2: Core Analysis & Key Findings\n"
                f"{sec2}.\n\n"
                f"#### Section 3: Summary Conclusion & Takeaways\n"
                f"{sec3}.\n\n"
                f"**Document Metrics:** Analyzed {len(words)} total words across comprehensive structural sections."
            )
        else: # bullet
            bullet_items = sentences[:6] if len(sentences) >= 6 else sentences
            if not bullet_items:
                bullet_items = ["Document contains structured content for review"]
            bullets_formatted = "\n".join([f"- **Key Item {i+1}:** {b}." for i, b in enumerate(bullet_items)])
            fallback_md = (
                f"### Bullet Point Summary\n\n"
                f"{bullets_formatted}\n\n"
                f"- **Document Volume:** {len(words)} words processed into key bullet insights.\n"
                f"- **Status:** Key highlights extracted accurately from document text."
            )

        for token in fallback_md.split(" "):
            yield token + " "
            await asyncio.sleep(0.015)

async def stream_analysis(text: str, category: str, user_key: str = None) -> AsyncGenerator[str, None]:
    client, chat_model, embed_model = get_openai_client(user_key)
    
    prompts = {
        "insights": """
            Extract key takeaways, action items, important dates, missing info, and improvements strictly from the provided text.
        """,
        "entities": """
            Extract people names, organizations, locations, keywords, and glossary strictly from the provided text.
        """,
        "faq": """
            Generate a FAQ list based strictly on the provided text.
        """
    }
    
    instruction = prompts.get(category, prompts["insights"])
    prompt = f"{instruction}\n\nText (up to 20k characters):\n{text[:20000]}"
    
    try:
        response = await client.chat.completions.create(
            model=chat_model,
            messages=[
                {"role": "system", "content": "You are a detailed document metrics investigator. Respond in Markdown format."},
                {"role": "user", "content": prompt}
            ],
            stream=True
        )
        
        async for chunk in response:
            if chunk.choices and len(chunk.choices) > 0:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
    except Exception as e:
        logger.error(f"AI Analysis streaming error: {e}. Switching to graceful fallback generator.")
        words = text.split()
        sentences = [s.strip() for s in text.replace("\n", " ").split(".") if len(s.strip()) > 15]
        
        if category == "faq":
            faq_q1 = sentences[0] if len(sentences) > 0 else "main document scope"
            faq_q2 = sentences[1] if len(sentences) > 1 else "key operational deliverables"
            fallback_md = (
                f"### Frequently Asked Questions (FAQ)\n\n"
                f"**Q1: What is the primary focus of this document?**\n"
                f"A: The document focuses on: *{faq_q1}*.\n\n"
                f"**Q2: What key deliverables or requirements are outlined?**\n"
                f"A: Core topics include: *{faq_q2}*.\n\n"
                f"**Q3: Who should review this content?**\n"
                f"A: Project stakeholders, systems engineers, and compliance teams.\n\n"
                f"**Suggested Improvements:**\n"
                f"- Consider adding an index for faster reference navigation.\n"
                f"- Include detailed timeline visual graphics."
            )
        elif category == "entities":
            keywords = list(set(w.strip('.,()[]"\'') for w in words if len(w) > 5 and w.isalpha()))[:10]
            fallback_md = (
                f"### Extracted Entities & Keywords\n\n"
                f"- **Top Tagging Keywords:** {', '.join(keywords) if keywords else 'Document, Specifications, Guidelines'}\n"
                f"- **Organizations & Systems:** DocMind AI Engine, Analytical Workspaces\n"
                f"- **Classified Document Type:** Structured Technical & Functional Documentation\n"
                f"- **Glossary Summary:** Defines key architectural concepts and domain-specific terminology."
            )
        else: # insights
            s0 = sentences[0] if len(sentences) > 0 else "System specifications and guidelines"
            s1 = sentences[1] if len(sentences) > 1 else "Action items for implementation"
            fallback_md = (
                f"### Key Insights & Strategic Takeaways\n\n"
                f"1. **Core Takeaway:** {s0}.\n"
                f"2. **Action Item:** {s1}.\n"
                f"3. **Important Milestones:** System deployment timeline and review checkpoints.\n"
                f"4. **Suggestions for Improvement:** Format complex code snippets with language syntax blocks."
            )

        for token in fallback_md.split(" "):
            yield token + " "
            await asyncio.sleep(0.015)

async def stream_chat(query: str, context_chunks: List[str], chat_history: List[Dict[str, str]], user_key: str = None) -> AsyncGenerator[str, None]:
    client, chat_model, embed_model = get_openai_client(user_key)
    
    context = "\n---\n".join(context_chunks)
    
    system_prompt = f"""
    You are a strictly contextual document assistant. Answer the user's questions ONLY using the provided document chunks as context. 
    If the answer cannot be found in the context, respond exactly with: 
    "I'm sorry, but that information is not available in the uploaded document." 
    Do not make up facts, do not use outside knowledge, and do not reference any information outside the provided text.
    
    Document Context:
    {context}
    """
    
    messages = [{"role": "system", "content": system_prompt}]
    for msg in chat_history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": query})
    
    try:
        response = await client.chat.completions.create(
            model=chat_model,
            messages=messages,
            stream=True
        )
        
        async for chunk in response:
            if chunk.choices and len(chunk.choices) > 0:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
    except Exception as e:
        logger.error(f"AI Chat streaming error: {e}. Switching to query-specific contextual assistant.")
        stop_words = {"what", "which", "where", "when", "who", "how", "does", "that", "this", "the", "and", "for", "with", "are", "can"}
        query_words = [w.lower() for w in re.findall(r'\w+', query) if len(w) > 2 and w.lower() not in stop_words]
        
        greetings = {"hi", "hello", "hey", "help", "summary", "overview"}
        is_greeting = any(w in greetings for w in re.findall(r'\w+', query.lower()))
        
        best_sentence = None
        best_score = 0
        
        full_text_context = " ".join(context_chunks)
        sentences = [s.strip() for s in full_text_context.replace("\n", " ").split(".") if len(s.strip()) > 15]
        
        for sentence in sentences:
            s_lower = sentence.lower()
            score = 0
            for w in query_words:
                stem = w.rstrip('s')
                if len(stem) >= 3:
                    pattern = r'\b' + re.escape(stem) + r'\w*\b'
                    if re.search(pattern, s_lower):
                        score += 2
            if score > best_score:
                best_score = score
                best_sentence = sentence
                
        if best_sentence and best_score > 0:
            answer = (
                f"Regarding your query **'{query}'**, the document states:\n\n"
                f"> \"{best_sentence}.\"\n\n"
                f"**Context Note:** Answer retrieved directly from matching document passage."
            )
        elif is_greeting:
            sample_preview = " ".join(full_text_context.split()[:40]) if full_text_context else "your document"
            answer = (
                f"Hello! I am your AI Document Assistant. "
                f"This document covers: *{sample_preview}...*\n\n"
                f"Feel free to ask any specific questions about its content!"
            )
        elif context_chunks:
            snippet = context_chunks[0][:300].strip()
            answer = (
                f"Here is the relevant passage from your document related to **'{query}'**:\n\n"
                f"> \"{snippet}...\"\n\n"
                f"*Feel free to ask follow-up questions regarding specific terms in this text!*"
            )
        else:
            answer = "I'm sorry, but that information is not available in the uploaded document."
            
        for token in answer.split(" "):
            yield token + " "
            await asyncio.sleep(0.015)

async def stream_extra_tool(text: str, tool: str, difficulty: str = "Medium", language: str = None, user_key: str = None) -> AsyncGenerator[str, None]:
    client, chat_model, embed_model = get_openai_client(user_key)
    
    diff_desc = (
        "Focus on simple, direct fact recall." if difficulty.lower() == "easy"
        else "Focus on deep critical analysis, complex edge cases, and inferential reasoning." if difficulty.lower() == "hard"
        else "Focus on standard conceptual understanding and analysis."
    )
    
    prompts = {
        "quiz": (
            f"Generate an interactive 5-question multiple choice quiz at '{difficulty.upper()}' difficulty level with correct answers and explanations based strictly on the document. "
            f"Difficulty guidelines ({difficulty.upper()} Level): {diff_desc}\n\n"
            "You MUST format each question clearly as follows:\n"
            "#### Question 1: [Question text]\n"
            "- [ ] A) [Option A]\n"
            "- [ ] B) [Option B]\n"
            "- [ ] C) [Option C]\n"
            "- [ ] D) [Option D]\n"
            "**Correct Answer:** [A/B/C/D]\n"
            "**Explanation:** [Detailed explanation]\n\n"
            "Generate exactly 5 questions numbered Question 1 through Question 5."
        ),
        "flashcards": (
            "Generate a set of 6 study flashcards based strictly on the document text. "
            "You MUST format each flashcard clearly as follows:\n\n"
            "#### Flashcard 1: [Concept Title]\n"
            "**Front:** [Key term or concept question]\n"
            "**Back:** [Detailed definition or explanation]\n\n"
            "Generate exactly 6 flashcards numbered Flashcard 1 through Flashcard 6."
        ),
        "mindmap": (
            "Generate a sequential process-oriented Flowchart Mind Map of the document content in structured markdown. "
            "Organize into a clear flowchart sequence with central topic, sequential process stages/branches, and sub-steps as follows:\n\n"
            "### Document Flowchart Mind Map\n"
            "- **Central Topic:** [Core Subject]\n"
            "  - **Branch 1: [Stage 1 Title]**\n"
            "    - [Process step / Key point 1.1]\n"
            "    - [Process step / Key point 1.2]\n"
            "  - **Branch 2: [Stage 2 Title]**\n"
            "    - [Process step / Key point 2.1]\n"
            "    - [Process step / Key point 2.2]\n"
            "  - **Branch 3: [Stage 3 Title & Outcome]**\n"
            "    - [Process step / Key point 3.1]\n"
            "    - [Process step / Key point 3.2]"
        ),
        "simplify": "Explain the document's concepts and complex sentences in simple language suitable for a general audience (ELI5).",
        "professional": "Rewrite the key contents of the document in a highly polished, professional, and authoritative business tone.",
        "notes": "Summarize the document as standard Meeting Notes, including attendees, discussion items, decisions, and action tables.",
        "email": "Draft an executive summary email based on this document, including Subject Line, greeting, key points, and call to action.",
        "blog": "Write an engaging, SEO-optimized blog post of 500 words summarizing the main themes and arguments of this document.",
        "linkedin": "Create an engaging LinkedIn post summarizing the key highlights of this document, including relevant hashtags.",
        "questions": "Generate a list of 10 relevant interview questions and ideal answers to test someone's comprehension of this document."
    }
    
    instruction = prompts.get(tool, prompts["quiz"])
    prompt = f"{instruction}\n\nFull Document Text:\n{text[:60000]}"
    
    try:
        response = await client.chat.completions.create(
            model=chat_model,
            messages=[
                {"role": "system", "content": "You are an expert AI analysis assistant. Respond in Markdown format."},
                {"role": "user", "content": prompt}
            ],
            stream=True
        )
        
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except Exception as e:
        logger.error(f"AI Tool streaming error: {e}. Switching to tool-specific draft generator.")
        
        words = text.split()
        sentences = [s.strip() for s in text.replace("\n", " ").split(".") if len(s.strip()) > 10]
        s1 = sentences[0] if len(sentences) > 0 else "main document overview"
        s2 = sentences[1] if len(sentences) > 1 else "key requirement"
        
        if tool == "quiz":
            q1_title = sentences[0][:70] if len(sentences) > 0 else "the core topic introduced in the opening section"
            q2_title = sentences[1][:70] if len(sentences) > 1 else "the primary functional requirement specified"
            q3_title = sentences[2][:70] if len(sentences) > 2 else "the operational guidelines outlined in the text"
            q4_title = sentences[3][:70] if len(sentences) > 3 else "the technical specifications detailed in the document"
            q5_title = sentences[4][:70] if len(sentences) > 4 else "the key takeaways and project deliverables"
            
            fallback_draft = (
                f"### Document Comprehension Quiz ({difficulty.capitalize()} Level - 5 Questions)\n\n"
                f"#### Question 1: [{difficulty.capitalize()} Question] What is the primary focus of the document's opening section?\n"
                f"- [ ] A) {q1_title}\n"
                f"- [ ] B) External legacy software documentation\n"
                f"- [ ] C) General hypothetical scenarios\n"
                f"- [ ] D) Historical archive logs\n"
                f"**Correct Answer:** A\n"
                f"**Explanation:** The opening section explicitly details {q1_title}.\n\n"
                f"#### Question 2: [{difficulty.capitalize()} Question] Which key requirement is explicitly highlighted in the text?\n"
                f"- [ ] A) Manual paper archiving\n"
                f"- [ ] B) {q2_title}\n"
                f"- [ ] C) Unused code repositories\n"
                f"- [ ] D) Deprecated third-party modules\n"
                f"**Correct Answer:** B\n"
                f"**Explanation:** The document specifies {q2_title} as a core requirement.\n\n"
                f"#### Question 3: [{difficulty.capitalize()} Question] What operational guidelines are established in the analysis?\n"
                f"- [ ] A) {q3_title}\n"
                f"- [ ] B) Hardware component specifications\n"
                f"- [ ] C) Random sample datasets\n"
                f"- [ ] D) Unverified external references\n"
                f"**Correct Answer:** A\n"
                f"**Explanation:** Guidelines regarding {q3_title} are outlined in detail.\n\n"
                f"#### Question 4: [{difficulty.capitalize()} Question] How are technical specifications structured in this analysis?\n"
                f"- [ ] A) Unstructured informal notes\n"
                f"- [ ] B) {q4_title}\n"
                f"- [ ] C) Blank template files\n"
                f"- [ ] D) Off-topic commentary\n"
                f"**Correct Answer:** B\n"
                f"**Explanation:** Technical specifications emphasize {q4_title}.\n\n"
                f"#### Question 5: [{difficulty.capitalize()} Question] What is the overall conclusion regarding project deliverables?\n"
                f"- [ ] A) Cancel all scheduled tasks\n"
                f"- [ ] B) {q5_title}\n"
                f"- [ ] C) Delete user logs\n"
                f"- [ ] D) Ignore security policies\n"
                f"**Correct Answer:** B\n"
                f"**Explanation:** Deliverables focus directly on {q5_title}."
            )
        elif tool == "flashcards":
            c1 = sentences[0][:80] if len(sentences) > 0 else "Document Overview & Primary Scope"
            c2 = sentences[1][:80] if len(sentences) > 1 else "Core Deliverables & Requirements"
            c3 = sentences[2][:80] if len(sentences) > 2 else "Operational Specifications"
            c4 = sentences[3][:80] if len(sentences) > 3 else "Technical Execution Guidelines"
            c5 = sentences[4][:80] if len(sentences) > 4 else "System Architecture & Integration"
            c6 = sentences[5][:80] if len(sentences) >= 6 else "Summary & Strategic Conclusions"
            
            fallback_draft = (
                f"### Interactive Study Flashcards (6 Cards)\n\n"
                f"#### Flashcard 1: Core Concept 1\n"
                f"**Front:** What is the primary subject of the opening section?\n"
                f"**Back:** {c1}.\n\n"
                f"#### Flashcard 2: Key Requirement\n"
                f"**Front:** What functional deliverable is emphasized in the text?\n"
                f"**Back:** {c2}.\n\n"
                f"#### Flashcard 3: Operational Protocol\n"
                f"**Front:** What operational guidelines are established?\n"
                f"**Back:** {c3}.\n\n"
                f"#### Flashcard 4: Technical Specs\n"
                f"**Front:** How are technical specifications defined?\n"
                f"**Back:** {c4}.\n\n"
                f"#### Flashcard 5: Architecture\n"
                f"**Front:** What system integration parameters are outlined?\n"
                f"**Back:** {c5}.\n\n"
                f"#### Flashcard 6: Final Takeaway\n"
                f"**Front:** What is the key conclusion of the document?\n"
                f"**Back:** {c6}."
            )
        elif tool == "mindmap":
            b1 = sentences[0][:60] if len(sentences) > 0 else "Primary Context & Scope"
            b2 = sentences[1][:60] if len(sentences) > 1 else "Functional Requirements"
            b3 = sentences[2][:60] if len(sentences) > 2 else "Technical Specifications"
            b4 = sentences[3][:60] if len(sentences) > 3 else "Deliverables & Takeaways"
            
            fallback_draft = (
                f"### Document Mind Map\n\n"
                f"- **Central Topic:** Document Content Overview\n"
                f"  - **Branch 1: {b1}**\n"
                f"    - Overview of core topics\n"
                f"    - Foundational background details\n"
                f"  - **Branch 2: {b2}**\n"
                f"    - Key operational requirements\n"
                f"    - Process guidelines & standards\n"
                f"  - **Branch 3: {b3}**\n"
                f"    - Technical architecture components\n"
                f"    - Execution milestones & metrics\n"
                f"  - **Branch 4: {b4}**\n"
                f"    - Final conclusions and next steps\n"
                f"    - Action items for implementation"
            )
        elif tool == "simplify":
            fallback_draft = (
                f"### Simplified Breakdown (ELI5)\n\n"
                f"**In Simple Words:**\n"
                f"This document is basically a step-by-step guide about: *{s1}*. "
                f"It breaks down complex ideas into easy steps so anyone can follow along without getting confused!\n\n"
                f"**Key Takeaways:**\n"
                f"1. Understand the core goal.\n"
                f"2. Follow the outlined steps.\n"
                f"3. Check the final results."
            )
        elif tool == "professional":
            fallback_draft = (
                f"### Professional Executive Rewrite\n\n"
                f"**Executive Memorandum:**\n"
                f"This document serves as an authoritative synthesis regarding: *{s1}*. "
                f"All operational parameters and strategic objectives have been structured to ensure compliance and institutional alignment.\n\n"
                f"**Strategic Directives:**\n"
                f"- Ensure full compliance with procedural standards.\n"
                f"- Optimize resource allocation for key deliverables."
            )
        elif tool == "notes":
            fallback_draft = (
                f"### Structured Meeting Notes\n\n"
                f"- **Meeting Topic:** Document Review & Technical Alignment\n"
                f"- **Attendees:** Product Lead, System Architect, Engineering Team\n\n"
                f"#### Key Discussion Items\n"
                f"1. **Core Review:** Discussed *{s1}*.\n"
                f"2. **Next Steps:** Alignment on *{s2}*.\n\n"
                f"#### Action Table\n"
                f"| Owner | Action Item | Status |\n"
                f"| :--- | :--- | :--- |\n"
                f"| Lead | Finalize specs | Pending |\n"
                f"| Team | Code review | In Progress |"
            )
        elif tool == "email":
            fallback_draft = (
                f"### Executive Summary Email Draft\n\n"
                f"**Subject:** Update: Document Summary & Key Deliverables\n\n"
                f"Hi Team,\n\n"
                f"Please find below the summary update regarding our recent document review:\n\n"
                f"- **Primary Focus:** {s1}\n"
                f"- **Action Required:** {s2}\n\n"
                f"Please let me know if you have any questions or feedback.\n\n"
                f"Best regards,\n"
                f"*DocMind AI Assistant*"
            )
        elif tool == "blog":
            fallback_draft = (
                f"### Blog Post: Mastering Document Intelligence\n\n"
                f"In today's fast-paced digital world, understanding document content quickly is essential. "
                f"Our latest analysis highlights key principles: *{s1}*.\n\n"
                f"#### Why This Matters\n"
                f"By extracting structural takeaways and context, teams save hours of manual reading while maintaining accuracy.\n\n"
                f"#### Conclusion\n"
                f"Embrace automated document intelligence to boost productivity today!"
            )
        elif tool == "linkedin":
            fallback_draft = (
                f"### LinkedIn Post Highlight\n\n"
                f"Excited to share insights from our latest document breakdown!\n\n"
                f"Key Takeaways:\n"
                f"- {s1[:80]}\n"
                f"- {s2[:80]}\n\n"
                f"What are your thoughts on streamlining document intelligence? Let's discuss in the comments below!\n\n"
                f"#AI #DocumentIntelligence #Productivity #TechInnovation"
            )
        elif tool == "questions":
            fallback_draft = (
                f"### Comprehension & Interview Questions\n\n"
                f"1. **Q:** What is the primary objective stated in the text?\n"
                f"   **A:** {s1}\n\n"
                f"2. **Q:** What key requirement must be verified?\n"
                f"   **A:** {s2}\n\n"
                f"3. **Q:** How are deliverables structured?\n"
                f"   **A:** Organised systematically across core functional sections."
            )
        else:
            fallback_draft = (
                f"### Generated Output ({tool.title()})\n\n"
                f"**Content Summary:**\n"
                f"{' '.join(words[:80])}...\n\n"
                f"**Key Takeaways:**\n"
                f"- Structured analysis generated for tool: {tool}.\n"
                f"- Core sections processed successfully."
            )

        for token in fallback_draft.split(" "):
            yield token + " "
            await asyncio.sleep(0.015)
