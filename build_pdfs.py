import os
import re
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#4B5563")) # Slate gray
        
        # Draw header (only on pages after the first page)
        if self._pageNumber > 1:
            self.setStrokeColor(colors.HexColor("#E5E7EB")) # Light gray line
            self.setLineWidth(0.5)
            self.line(54, 738, 558, 738)
            self.drawString(54, 744, "DocMind AI - Project Deliverables")
            
        # Draw footer on all pages
        self.setStrokeColor(colors.HexColor("#E5E7EB"))
        self.setLineWidth(0.5)
        self.line(54, 54, 558, 54)
        
        self.setFont("Helvetica", 8)
        self.drawString(54, 40, "Live URL: https://docmind-ai.ap-south-1.awsapprunner.com")
        
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 40, page_text)
        self.restoreState()

def parse_markdown_to_flowables(md_text, styles):
    flowables = []
    lines = md_text.split('\n')
    
    in_code_block = False
    code_content = []
    
    for line in lines:
        stripped = line.strip()
        
        # Check for code blocks
        if line.startswith("```"):
            if in_code_block:
                # End of code block
                in_code_block = False
                raw_code = "\n".join(code_content)
                code_content = []
                
                # Render code block inside a single-cell table for border and background shading
                p = Paragraph(f"<font name='Courier' size='8' color='#1F2937'>{raw_code.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('\n', '<br/>').replace(' ', '&nbsp;')}</font>", styles['CodeStyle'])
                t = Table([[p]], colWidths=[504])
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F3F4F6")),
                    ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#E5E7EB")),
                    ('VALIGN', (0,0), (-1,-1), 'TOP'),
                    ('TOPPADDING', (0,0), (-1,-1), 8),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                    ('LEFTPADDING', (0,0), (-1,-1), 8),
                    ('RIGHTPADDING', (0,0), (-1,-1), 8),
                ]))
                flowables.append(t)
                flowables.append(Spacer(1, 10))
            else:
                in_code_block = True
            continue
            
        if in_code_block:
            code_content.append(line)
            continue
            
        if not stripped:
            continue
            
        # Parse inline markdown elements: **bold** -> <b>bold</b>
        line_html = stripped
        line_html = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', line_html)
        
        # Parse headings
        if line.startswith("# "):
            title = line[2:].strip()
            flowables.append(Spacer(1, 15))
            flowables.append(Paragraph(title, styles['CustomH1']))
            flowables.append(Spacer(1, 10))
        elif line.startswith("## "):
            heading = line[3:].strip()
            flowables.append(Spacer(1, 12))
            flowables.append(Paragraph(heading, styles['CustomH2']))
            flowables.append(Spacer(1, 8))
        elif line.startswith("### "):
            subheading = line[4:].strip()
            flowables.append(Spacer(1, 8))
            flowables.append(Paragraph(subheading, styles['CustomH3']))
            flowables.append(Spacer(1, 6))
        # Parse horizontal lines
        elif stripped == "---":
            # Draw a horizontal rule by using a thin colored table
            hr = Table([['']], colWidths=[504], rowHeights=[1])
            hr.setStyle(TableStyle([
                ('LINEABOVE', (0,0), (-1,-1), 1, colors.HexColor("#E5E7EB")),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 0),
            ]))
            flowables.append(Spacer(1, 10))
            flowables.append(hr)
            flowables.append(Spacer(1, 10))
        # Parse lists (unordered/bullet)
        elif line.startswith("- ") or line.startswith("* ") or line.startswith("● "):
            content = line[2:].strip()
            content_html = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', content)
            bullet_html = f"<font color='#2563EB'>•</font> {content_html}"
            flowables.append(Paragraph(bullet_html, styles['CustomBullet']))
            flowables.append(Spacer(1, 4))
        # Parse numbered lists
        elif re.match(r'^\d+\.\s', stripped):
            match = re.match(r'^(\d+)\.\s(.*)', stripped)
            num = match.group(1)
            content = match.group(2)
            content_html = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', content)
            list_html = f"<font color='#2563EB'><b>{num}.</b></font> {content_html}"
            flowables.append(Paragraph(list_html, styles['CustomNumberList']))
            flowables.append(Spacer(1, 4))
        # Standard paragraph
        else:
            flowables.append(Paragraph(line_html, styles['CustomBody']))
            flowables.append(Spacer(1, 8))
            
    return flowables

def compile_pdf(source_md_path, target_pdf_path):
    print(f"Compiling {source_md_path} to {target_pdf_path}...")
    
    if not os.path.exists(source_md_path):
        print(f"Source file not found: {source_md_path}")
        return
        
    with open(source_md_path, "r", encoding="utf-8") as f:
        md_text = f.read()
        
    # Document Setup (margins: 54pt = 0.75 in)
    doc = SimpleDocTemplate(
        target_pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=72,
        bottomMargin=72
    )
    
    # Custom Styles Setup
    styles = getSampleStyleSheet()
    
    # Modifying existing or creating new styles with custom color palettes
    custom_styles = {
        'CustomH1': ParagraphStyle(
            'CustomH1',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#1E3A8A"), # Deep Blue
            spaceAfter=12,
            keepWithNext=True
        ),
        'CustomH2': ParagraphStyle(
            'CustomH2',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=15,
            leading=19,
            textColor=colors.HexColor("#2563EB"), # Royal Blue
            spaceBefore=14,
            spaceAfter=8,
            keepWithNext=True
        ),
        'CustomH3': ParagraphStyle(
            'CustomH3',
            parent=styles['Heading3'],
            fontName='Helvetica-Bold',
            fontSize=12,
            leading=15,
            textColor=colors.HexColor("#1F2937"), # Charcoal
            spaceBefore=10,
            spaceAfter=6,
            keepWithNext=True
        ),
        'CustomBody': ParagraphStyle(
            'CustomBody',
            parent=styles['BodyText'],
            fontName='Helvetica',
            fontSize=10,
            leading=15,
            textColor=colors.HexColor("#374151"), # Charcoal Gray
            spaceAfter=8
        ),
        'CustomBullet': ParagraphStyle(
            'CustomBullet',
            parent=styles['BodyText'],
            fontName='Helvetica',
            fontSize=10,
            leading=15,
            textColor=colors.HexColor("#374151"),
            leftIndent=15,
            firstLineIndent=-10,
            spaceAfter=4
        ),
        'CustomNumberList': ParagraphStyle(
            'CustomNumberList',
            parent=styles['BodyText'],
            fontName='Helvetica',
            fontSize=10,
            leading=15,
            textColor=colors.HexColor("#374151"),
            leftIndent=15,
            firstLineIndent=-10,
            spaceAfter=4
        ),
        'CodeStyle': ParagraphStyle(
            'CodeStyle',
            fontName='Courier',
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#1F2937"),
        )
    }
    
    flowables = parse_markdown_to_flowables(md_text, custom_styles)
    
    # Build Document using NumberedCanvas
    doc.build(flowables, canvasmaker=NumberedCanvas)
    print(f"Successfully generated {target_pdf_path}")

if __name__ == "__main__":
    compile_pdf("concept_note.md", "concept_note.pdf")
    compile_pdf("project_report.md", "project_report.pdf")
    print("All PDFs compiled.")
