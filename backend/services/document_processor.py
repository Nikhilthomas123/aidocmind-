import os
try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None
import pdfplumber
import docx
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class RecursiveCharacterTextSplitter:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200, separators: List[str] = None):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", " ", ""]

    def split_text(self, text: str) -> List[str]:
        return self._split_text(text, self.separators)

    def _split_text(self, text: str, separators: List[str]) -> List[str]:
        final_chunks = []
        
        # Get the appropriate separator
        separator = separators[-1]
        new_separators = []
        for i, sep in enumerate(separators):
            if sep == "":
                separator = sep
                break
            if len(text) > self.chunk_size and sep in text:
                separator = sep
                new_separators = separators[i + 1:]
                break
        
        # Split text based on separator
        splits = text.split(separator) if separator != "" else list(text)
        
        # Merge splits into chunks of appropriate sizes
        current_chunk = []
        current_length = 0
        
        for split in splits:
            split_len = len(split)
            
            # If a single split is larger than chunk size, split it recursively
            if split_len > self.chunk_size:
                if current_chunk:
                    final_chunks.append(separator.join(current_chunk))
                    current_chunk = []
                    current_length = 0
                
                # Recursively split the long segment
                sub_chunks = self._split_text(split, new_separators or self.separators)
                final_chunks.extend(sub_chunks)
            
            # Normal size segment: check if adding it exceeds chunk size
            elif current_length + split_len + (len(separator) if current_chunk else 0) <= self.chunk_size:
                current_chunk.append(split)
                current_length += split_len + (len(separator) if len(current_chunk) > 1 else 0)
            else:
                # Add current chunk to output
                if current_chunk:
                    final_chunks.append(separator.join(current_chunk))
                
                # Handle overlap
                # Keep items from current_chunk that fit in overlap
                overlap_chunk = []
                overlap_len = 0
                for item in reversed(current_chunk):
                    item_len = len(item)
                    if overlap_len + item_len + (len(separator) if overlap_chunk else 0) <= self.chunk_overlap:
                        overlap_chunk.insert(0, item)
                        overlap_len += item_len + (len(separator) if len(overlap_chunk) > 1 else 0)
                    else:
                        break
                
                current_chunk = overlap_chunk + [split]
                current_length = overlap_len + split_len + (len(separator) if len(current_chunk) > 1 else 0)
        
        if current_chunk:
            final_chunks.append(separator.join(current_chunk))
            
        return final_chunks


def extract_text_from_pdf(file_path: str) -> List[Dict[str, Any]]:
    pages_data = []
    
    # Try PyMuPDF (fitz) first as it is high performance
    try:
        if fitz is None:
            raise ImportError("PyMuPDF (fitz) is not installed")
        doc = fitz.open(file_path)
        for i, page in enumerate(doc):
            text = page.get_text()
            if text.strip():
                pages_data.append({"page": i + 1, "text": text})
        doc.close()
    except Exception as e:
        logger.warning(f"PyMuPDF failed to parse {file_path}, falling back to pdfplumber. Error: {e}")
        # Fallback to pdfplumber
        try:
            with pdfplumber.open(file_path) as pdf:
                for i, page in enumerate(pdf.pages):
                    text = page.extract_text()
                    if text and text.strip():
                        pages_data.append({"page": i + 1, "text": text})
        except Exception as ex:
            logger.error(f"Fallback pdfplumber also failed: {ex}")
            raise ex
            
    return pages_data


def extract_text_from_docx(file_path: str) -> List[Dict[str, Any]]:
    pages_data = []
    try:
        doc = docx.Document(file_path)
        full_text = []
        for para in doc.paragraphs:
            if para.text.strip():
                full_text.append(para.text)
        
        # Word documents don't have natural "pages" like PDFs, so we chunk it by text segments
        # We group paragraphs into rough "pages" of 1500 chars for layout compatibility
        current_text = ""
        page_num = 1
        for para_text in full_text:
            current_text += para_text + "\n"
            if len(current_text) >= 1500:
                pages_data.append({"page": page_num, "text": current_text})
                current_text = ""
                page_num += 1
        if current_text.strip():
            pages_data.append({"page": page_num, "text": current_text})
    except Exception as e:
        logger.error(f"Error parsing Word Document: {e}")
        raise e
        
    return pages_data


def extract_text_from_txt(file_path: str) -> List[Dict[str, Any]]:
    pages_data = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        
        # Split into blocks of 1500 characters
        chunk_size = 1500
        page_num = 1
        for i in range(0, len(content), chunk_size):
            segment = content[i:i+chunk_size]
            if segment.strip():
                pages_data.append({"page": page_num, "text": segment})
                page_num += 1
    except Exception as e:
        logger.error(f"Error parsing Text File: {e}")
        raise e
        
    return pages_data


def parse_and_chunk_document(file_path: str, ext: str) -> List[Dict[str, Any]]:
    # Extract text based on file format extension
    if ext == ".pdf":
        pages_data = extract_text_from_pdf(file_path)
    elif ext == ".docx":
        pages_data = extract_text_from_docx(file_path)
    elif ext == ".txt":
        pages_data = extract_text_from_txt(file_path)
    else:
        raise ValueError("Unsupported file format extension")

    # Split text into chunks recursively
    splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=150)
    
    chunked_data = []
    for page in pages_data:
        text_chunks = splitter.split_text(page["text"])
        for chunk in text_chunks:
            if chunk.strip():
                chunked_data.append({
                    "content": chunk,
                    "page": page["page"]
                })
                
    return chunked_data
