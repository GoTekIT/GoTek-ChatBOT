from pathlib import Path
p=Path('research/build_handoff.py');s=p.read_text()
a=s.index('def add_text(');b=s.index('def table(',a)
s=s[:a]+'''def add_text(p,text):
 text=text.replace('`','')
 pattern=r'\\[\\[([^|]+)\\|([^]]+)\\]\\]|https://[^\\s]+'
 pos=0
 for m in re.finditer(pattern,text):
  p.add_run(text[pos:m.start()]);h=OxmlElement('w:hyperlink')
  if m.group(1):
   h.set(qn('w:anchor'),m.group(1));label=m.group(2)
  else:
   u=m.group();rel=p.part.relate_to(u,'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',is_external=True);h.set(qn('r:id'),rel);label=u.replace('/','/\\u200b')
  r=OxmlElement('w:r');pr=OxmlElement('w:rPr');c=OxmlElement('w:color');c.set(qn('w:val'),'0057E1');pr.append(c);r.append(pr);t=OxmlElement('w:t');t.text=label;r.append(t);h.append(r);p._p.append(h);pos=m.end()
 p.add_run(text[pos:])
''' + s[b:]
s=s.replace("r=p.add_run(v);r.font.size=Pt(9.3);r.bold=i==0", "add_text(p,v)\n   for r in p.runs:r.font.size=Pt(9.3);r.bold=i==0")
s=s.replace("if line=='---PAGE---':page+=1;continue", "if line=='---PAGE---':page+=1;continue\n if line=='---BREAK---':d.add_page_break();continue\n if line.startswith('!['):\n  match=re.match(r'!\\[(.*?)\\]\\((.*)\\)',line)\n  if match:\n   p=d.add_paragraph();p.paragraph_format.keep_with_next=True\n   run=p.add_run();pic=run.add_picture(match[2],width=Inches(6.65));pic._inline.docPr.set('descr',match[1])\n  continue")
s=s.replace('range(1,14)','range(1,18)')
# Existing heading title text with no links, generate bookmarks.
pos=s.index("for el in d.element.xpath('//w:pBdr'):")
s=s[:pos]+'''# Anchors for module sheets and extension features; all cross-references resolve locally.
next_id=100
for p in d.paragraphs:
 if p.style.name=='Heading 2' and re.match(r'^[HE]\\d{2} ',p.text):
  name=p.text.split()[0];st=OxmlElement('w:bookmarkStart');st.set(qn('w:id'),str(next_id));st.set(qn('w:name'),name);p._p.insert(0,st);en=OxmlElement('w:bookmarkEnd');en.set(qn('w:id'),str(next_id));p._p.append(en);next_id+=1
# Sources are local original attachments; paths are navigational references, not upload actions.
p=d.add_paragraph('Tệp nguồn đính kèm để đối chiếu:')
for label,path in [('D1 Product Brief','/Users/ngxuanphu/Downloads/GoTek - Product Brief Saas _AI Sales Chatbot + Dashboard_  (2).docx'),('D2 Báo cáo dự án','/Users/ngxuanphu/Downloads/GoTek ChatBOT - Bao Cáo & Mô Tả Dự Án (1).docx'),('Bộ nhận diện Go Tek','/Users/ngxuanphu/Downloads/Go Tek/')]:
 p=d.add_paragraph();h=OxmlElement('w:hyperlink');h.set(qn('r:id'),p.part.relate_to(path,'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',is_external=True));r=OxmlElement('w:r');t=OxmlElement('w:t');t.text=label;r.append(t);h.append(r);p._p.append(h)
''' + s[pos:]
p.write_text(s)
