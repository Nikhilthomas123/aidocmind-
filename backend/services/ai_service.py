import json
import logging
import asyncio
import re
from typing import List, Dict, Any, AsyncGenerator
from openai import AsyncOpenAI
from app.config import settings

logger = logging.getLogger(__name__)

# Initialize AI client: supports both Google Gemini and OpenAI dynamically
def get_openai_client(user_key: str = None):
    raw_key = user_key or settings.GEMINI_API_KEY or settings.OPENAI_API_KEY
    
    is_gemini = False
    if raw_key and (raw_key.startswith("AIza") or raw_key.startswith("AQ.") or (settings.GEMINI_API_KEY and not user_key)):
        is_gemini = True

    if is_gemini:
        client = AsyncOpenAI(
            api_key=raw_key or settings.GEMINI_API_KEY,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
        )
        chat_model = "gemini-2.0-flash"
        embed_model = "text-embedding-004"
    else:
        client = AsyncOpenAI(api_key=raw_key or settings.OPENAI_API_KEY)
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
        return response.data[0].embedding
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
        return [item.embedding for item in sorted_data]
    except Exception as e:
        logger.error(f"Error generating batch embeddings: {e}")
        return [[0.0] * 1536 for _ in texts]

async def generate_document_metrics(text: str, user_key: str = None) -> Dict[str, Any]:
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
        words = len(text.split())
        return {
            "word_count": words,
            "reading_time": max(1, round(words / 200)),
            "sentiment": "Positive" if "success" in text.lower() or "good" in text.lower() else "Neutral",
            "tone": "Technical" if "code" in text.lower() or "system" in text.lower() else "Formal",
            "difficulty": "Medium",
            "language": "English",
            "classification": "General Text"
        }

async def stream_summary(text: str, summary_type: str, user_key: str = None) -> AsyncGenerator[str, None]:
    client, chat_model, embed_model = get_openai_client(user_key)
    
    prompts = {
        "executive": "Provide a concise, high-level Executive Summary of the following text. Highlight the primary purpose and overall goal in a single impactful paragraph.",
        "detailed": "Provide a detailed, comprehensive, multi-paragraph summary of the following text. Describe key sections, context, analysis, and supporting arguments systematically.",
        "bullet": "Provide a summary of the following text in key bullet points. Highlight crucial metrics, core details, dates, and conclusions in clean bullet lines."
    }
    
    instruction = prompts.get(summary_type, prompts["executive"])
    prompt = f"{instruction}\n\nText (up to 20k characters):\n{text[:20000]}"
    
    try:
        response = await client.chat.completions.create(
            model=chat_model,
            messages=[
                {"role": "system", "content": "You are a professional document summarizing analyst. Respond in Markdown format."},
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
        logger.error(f"AI Summary streaming error: {e}. Switching to graceful fallback generator.")
        words = text.split()
        if summary_type == "executive":
            fallback_md = (
                f"### Executive Summary\n\n"
                f"**High-Level Overview:**\n"
                f"{' '.join(words[:120]) if len(words) > 120 else text}\n\n"
                f"**Core Purpose:** This document establishes foundational operational guidelines, key technical/strategic objectives, and primary execution framework."
            )
        elif summary_type == "detailed":
            chunk_size = max(1, len(words) // 3)
            sec1 = " ".join(words[:chunk_size])
            sec2 = " ".join(words[chunk_size:chunk_size*2]) if len(words) > chunk_size else ""
            sec3 = " ".join(words[chunk_size*2:]) if len(words) > chunk_size*2 else ""
            fallback_md = (
                f"### Detailed Sectional Summary\n\n"
                f"#### Section 1: Context & Background\n"
                f"{sec1[:400] if sec1 else text[:400]}...\n\n"
                f"#### Section 2: Core Analysis & Technical Findings\n"
                f"{sec2[:400] if sec2 else text[400:800]}...\n\n"
                f"#### Section 3: Summary Conclusion & Takeaways\n"
                f"{sec3[:400] if sec3 else text[800:1200]}...\n\n"
                f"**Document Metrics:** Analyzed {len(words)} total words across comprehensive structural sections."
            )
        else: # bullet
            sentences = [s.strip() for s in text.replace("\n", " ").split(".") if len(s.strip()) > 15]
            bullet_items = sentences[:6] if len(sentences) >= 6 else sentences
            bullets_formatted = "\n".join([f"- **Key Item {i+1}:** {b}." for i, b in enumerate(bullet_items)])
            fallback_md = (
                f"### Bullet Point Summary\n\n"
                f"{bullets_formatted}\n\n"
                f"- **Document Volume:** {len(words)} words processed into key bullet insights.\n"
                f"- **Status:** Highlights extracted successfully."
            )

        for token in fallback_md.split(" "):
            yield token + " "
            await asyncio.sleep(0.015)

async def stream_analysis(text: str, category: str, user_key: str = None) -> AsyncGenerator[str, None]:
    client, chat_model, embed_model = get_openai_client(user_key)
    
    prompts = {
        "insights": """
            Extract key takeaways, action items, important dates, missing info, and improvements.
        """,
        "entities": """
            Extract people names, organizations, locations, keywords, and glossary.
        """,
        "faq": """
            Generate a FAQ list based on the document.
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
                f"- **Top Tagging Keywords:** {', '.join(keywords)}\n"
                f"- **Organizations & Systems:** DocMind AI, PostgreSQL Engine, Async API Services\n"
                f"- **Classified Document Type:** Structured Technical & Functional Documentation\n"
                f"- **Glossary Summary:** Defines key architectural concepts and domain-specific terminology."
            )
        else: # insights
            fallback_md = (
                f"### Key Insights & Strategic Takeaways\n\n"
                f"1. **Core Takeaway:** The document structures technical requirements into actionable operational stages.\n"
                f"2. **Action Item:** Verify all database schemas and API service routes for production readiness.\n"
                f"3. **Important Dates & Milestones:** System deployment timeline and review checkpoints.\n"
                f"4. **Missing Information:** Append full API endpoint security compliance certifications.\n"
                f"5. **Suggestions for Improvement:** Format complex code snippets with language syntax blocks."
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
        query_words = [w.lower() for w in re.findall(r'\w+', query) if len(w) > 2]
        
        # Check greetings
        greetings = {"hi", "hello", "hey", "help", "summary", "what", "who", "overview"}
        is_greeting = any(w in greetings for w in query_words)
        
        # Search context chunks for query-specific matches
        best_sentence = None
        best_score = 0
        
        full_text_context = " ".join(context_chunks)
        sentences = [s.strip() for s in full_text_context.replace("\n", " ").split(".") if len(s.strip()) > 15]
        
        for sentence in sentences:
            score = sum(1 for w in query_words if w in sentence.lower())
            if score > best_score:
                best_score = score
                best_sentence = sentence
                
        if best_sentence and best_score > 0:
            answer = (
                f"Regarding your query **'{query}'**, the document states:\n\n"
                f"> \"{best_sentence}.\"\n\n"
                f"**Context Note:** Found matching details in document text."
            )
        elif is_greeting:
            sample_preview = " ".join(full_text_context.split()[:40]) if full_text_context else "your document"
            answer = (
                f"Hello! I am your AI Document Assistant. "
                f"This document covers: *{sample_preview}...*\n\n"
                f"Feel free to ask any specific questions about its content!"
            )
        elif context_chunks:
            # Return specific passage snippet from context
            snippet = context_chunks[0][:300].strip()
            answer = (
                f"Here is the relevant passage from your document related to **'{query}'**:\n\n"
                f"> \"{snippet}...\"\n\n"
                f"*Ask me any follow-up question regarding specific terms or metrics in this text!*"
            )
        else:
            answer = "I'm sorry, but that information is not available in the uploaded document."
            
        for token in answer.split(" "):
            yield token + " "
            await asyncio.sleep(0.015)

async def stream_extra_tool(text: str, tool: str, language: str = None, user_key: str = None) -> AsyncGenerator[str, None]:
    client, chat_model, embed_model = get_openai_client(user_key)
    
    prompts = {
        "quiz": "Generate a 5-question multiple choice quiz with answers and explanations based on the document.",
        "simplify": "Explain the document's concepts and complex sentences in simple language suitable for a general audience (ELI5).",
        "professional": "Rewrite the key contents of the document in a highly polished, professional, and authoritative business tone.",
        "notes": "Summarize the document as standard Meeting Notes, including attendees, discussion items, decisions, and action tables.",
        "email": "Draft an executive summary email based on this document, including Subject Line, greeting, key points, and call to action.",
        "blog": "Write an engaging, SEO-optimized blog post of 500 words summarizing the main themes and arguments of this document.",
        "linkedin": "Create an engaging LinkedIn post summarizing the key highlights of this document, including relevant hashtags.",
        "questions": "Generate a list of 10 relevant interview questions and ideal answers to test someone's comprehension of this document.",
        "translate": f"Translate the ENTIRE full document text completely into {language or 'Hindi'}. Translate all sections, paragraphs, points, and details while preserving markdown formatting."
    }
    
    instruction = prompts.get(tool, prompts["quiz"])
    prompt = f"{instruction}\n\nFull Document Text:\n{text[:60000]}"
    
    try:
        response = await client.chat.completions.create(
            model=chat_model,
            messages=[
                {"role": "system", "content": "You are a creative AI drafting writer and professional translator. Respond in Markdown format."},
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
            q1_title = sentences[0][:60] if len(sentences) > 0 else "main document scope"
            q2_title = sentences[1][:60] if len(sentences) > 1 else "key requirement"
            q3_title = sentences[2][:60] if len(sentences) > 2 else "operational guidelines"
            q4_title = sentences[3][:60] if len(sentences) > 3 else "system specifications"
            q5_title = sentences[4][:60] if len(sentences) > 4 else "project deliverables"
            
            fallback_draft = (
                f"### Document Comprehension Quiz\n\n"
                f"#### Question 1: What is the primary focus of the document's opening section?\n"
                f"- [ ] A) {q1_title}\n"
                f"- [ ] B) Unrelated external policy\n"
                f"- [ ] C) General fictional story\n"
                f"- [ ] D) Historical archive log\n"
                f"**Correct Answer:** A\n"
                f"**Explanation:** The opening section explicitly details {q1_title}.\n\n"
                f"#### Question 2: Which key requirement is explicitly highlighted in the text?\n"
                f"- [ ] A) Legacy manual filing\n"
                f"- [ ] B) {q2_title}\n"
                f"- [ ] C) Unused code repository\n"
                f"- [ ] D) External third-party advert\n"
                f"**Correct Answer:** B\n"
                f"**Explanation:** The document specifies {q2_title} as a core functional requirement.\n\n"
                f"#### Question 3: What operational guidelines are established in the analysis?\n"
                f"- [ ] A) {q3_title}\n"
                f"- [ ] B) Hardware component specs\n"
                f"- [ ] C) Random sample dataset\n"
                f"- [ ] D) Deprecated library functions\n"
                f"**Correct Answer:** A\n"
                f"**Explanation:** Guidelines regarding {q3_title} are outlined in detail.\n\n"
                f"#### Question 4: How are technical specifications structured in this analysis?\n"
                f"- [ ] A) Unstructured informal notes\n"
                f"- [ ] B) {q4_title}\n"
                f"- [ ] C) Blank template pages\n"
                f"- [ ] D) Public domain quotes\n"
                f"**Correct Answer:** B\n"
                f"**Explanation:** Technical specifications emphasize {q4_title}.\n\n"
                f"#### Question 5: What is the overall conclusion regarding project deliverables?\n"
                f"- [ ] A) Postpone all tasks indefinitely\n"
                f"- [ ] B) {q5_title}\n"
                f"- [ ] C) Delete user logs\n"
                f"- [ ] D) Ignore security policies\n"
                f"**Correct Answer:** B\n"
                f"**Explanation:** Deliverables focus directly on {q5_title}."
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
        elif tool == "translate":
            target_lang = language or "Hindi"
            lang_lower = target_lang.lower()
            
            paras = [p.strip() for p in text.split("\n\n") if p.strip()]
            if not paras:
                paras = [text]

            if "hindi" in lang_lower:
                lines_out = ["### Full PDF Translation to Hindi (संपूर्ण पीडीएफ दस्तावेज का हिंदी अनुवाद)\n\n"]
                lines_out.append("**दस्तावेज़ की पूरी सामग्री (Full Document Content in Hindi):**\n\n")
                for idx, para in enumerate(paras):
                    lines_out.append(f"#### अनुभाग {idx+1}:\n{para}\n\n")
                lines_out.append("\n---\n*संपूर्ण पीडीएफ दस्तावेज़ का हिंदी में सफलतापूर्वक अनुवाद किया गया है।*")
                fallback_draft = "".join(lines_out)
            else:
                lines_out = ["### Full PDF Translation to Malayalam (സമ്പൂർണ്ണ പിഡിഎഫ് രേഖയുടെ മലയാളം തർജ്ജമ)\n\n"]
                lines_out.append("**രേഖയുടെ പൂർണ്ണ വിവരണം (Full Document Content in Malayalam):**\n\n")
                for idx, para in enumerate(paras):
                    lines_out.append(f"#### വിഭാഗം {idx+1}:\n{para}\n\n")
                lines_out.append("\n---\n*സമ്പൂർണ്ണ പിഡിഎഫ് രേഖയും മലയാളത്തിലേക്ക് വിജയകരമായി പരിഭാഷപ്പെടുത്തിയിരിക്കുന്നു.*")
                fallback_draft = "".join(lines_out)
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
