export type DocumentExportFormat = 'markdown' | 'pdf' | 'docx';
export type BinaryDocumentExportFormat = Exclude<DocumentExportFormat, 'markdown'>;

interface ParsedLine {
  kind: 'blank' | 'heading' | 'list' | 'paragraph';
  level?: number;
  text: string;
}

const encoder = new TextEncoder();

function stripInlineMarkdown(input: string): string {
  return input
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/[*_`~]/g, '')
    .trim();
}

function parseMarkdown(markdown: string): ParsedLine[] {
  return markdown.split(/\r?\n/).map((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      return { kind: 'blank', text: '' };
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      return {
        kind: 'heading',
        level: heading[1].length,
        text: stripInlineMarkdown(heading[2]),
      };
    }

    const list = line.match(/^[-*]\s+(.+)$/);
    if (list) {
      return { kind: 'list', text: stripInlineMarkdown(list[1]) };
    }

    return { kind: 'paragraph', text: stripInlineMarkdown(line) };
  });
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
  return new Uint8Array([
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >> 24) & 0xff,
  ]);
}

function xmlEscape(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function pdfHexString(input: string): string {
  const bytes: number[] = [0xfe, 0xff];

  for (let index = 0; index < input.length; index += 1) {
    const codePoint = input.charCodeAt(index);
    bytes.push((codePoint >> 8) & 0xff, codePoint & 0xff);
  }

  return `<${bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')}>`;
}

function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  const averageCharWidth = fontSize * 0.52;
  const maxChars = Math.max(12, Math.floor(maxWidth / averageCharWidth));

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : [''];
}

interface PdfLine {
  text: string;
  fontSize: number;
  bold: boolean;
  indent: number;
  gapBefore: number;
  lineHeight: number;
}

function markdownToPdfLines(markdown: string): PdfLine[] {
  const output: PdfLine[] = [];

  for (const line of parseMarkdown(markdown)) {
    if (line.kind === 'blank') {
      output.push({
        text: '',
        fontSize: 10,
        bold: false,
        indent: 0,
        gapBefore: 4,
        lineHeight: 8,
      });
      continue;
    }

    if (line.kind === 'heading') {
      const fontSize = line.level === 1 ? 20 : line.level === 2 ? 16 : 13;
      output.push({
        text: line.text,
        fontSize,
        bold: true,
        indent: 0,
        gapBefore: line.level === 1 ? 10 : 8,
        lineHeight: fontSize * 1.35,
      });
      continue;
    }

    const isList = line.kind === 'list';
    output.push({
      text: isList ? `- ${line.text}` : line.text,
      fontSize: 11,
      bold: false,
      indent: isList ? 12 : 0,
      gapBefore: isList ? 1 : 4,
      lineHeight: 14,
    });
  }

  return output;
}

export function generatePdfFromMarkdown(markdown: string): Uint8Array {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 54;
  const usableWidth = pageWidth - margin * 2;
  const pages: string[] = [];
  let currentPage: string[] = [];
  let y = pageHeight - margin;

  const startNewPage = () => {
    pages.push(currentPage.join('\n'));
    currentPage = [];
    y = pageHeight - margin;
  };

  for (const line of markdownToPdfLines(markdown)) {
    y -= line.gapBefore;

    if (!line.text) {
      y -= line.lineHeight;
      if (y < margin) startNewPage();
      continue;
    }

    const wrapped = wrapText(line.text, line.fontSize, usableWidth - line.indent);
    for (const textLine of wrapped) {
      if (y - line.lineHeight < margin) {
        startNewPage();
      }

      const font = line.bold ? 'F2' : 'F1';
      const x = margin + line.indent;
      currentPage.push(`BT /${font} ${line.fontSize} Tf ${x} ${Math.round(y)} Td ${pdfHexString(textLine)} Tj ET`);
      y -= line.lineHeight;
    }
  }

  if (currentPage.length || pages.length === 0) {
    pages.push(currentPage.join('\n'));
  }

  const objects = new Map<number, string>();
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.set(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const pageRefs: string[] = [];
  let objectId = 5;

  for (const pageContent of pages) {
    const pageObjectId = objectId;
    const contentObjectId = objectId + 1;
    objectId += 2;
    pageRefs.push(`${pageObjectId} 0 R`);

    const contentLength = encoder.encode(pageContent).length;
    objects.set(
      pageObjectId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    objects.set(contentObjectId, `<< /Length ${contentLength} >>\nstream\n${pageContent}\nendstream`);
  }

  objects.set(2, `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pages.length} >>`);

  let pdf = '%PDF-1.4\n%Meetily\n';
  const offsets: number[] = [0];
  const objectIds = Array.from(objects.keys()).sort((a, b) => a - b);

  for (const id of objectIds) {
    offsets[id] = encoder.encode(pdf).length;
    pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }

  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objectIds.length + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (const id of objectIds) {
    pdf += `${offsets[id].toString().padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objectIds.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return encoder.encode(pdf);
}

function paragraphXml(text: string, options: { headingLevel?: number; list?: boolean } = {}): string {
  const fontSize = options.headingLevel === 1 ? 32 : options.headingLevel === 2 ? 28 : options.headingLevel ? 24 : 22;
  const bold = options.headingLevel || text.startsWith('**');
  const cleaned = text.replace(/\*\*/g, '');
  const prefix = options.list ? '- ' : '';
  const paragraphProps = options.headingLevel
    ? '<w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr>'
    : '<w:pPr><w:spacing w:after="80"/></w:pPr>';

  return [
    '<w:p>',
    paragraphProps,
    '<w:r>',
    `<w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${fontSize}"/></w:rPr>`,
    `<w:t xml:space="preserve">${xmlEscape(prefix + cleaned)}</w:t>`,
    '</w:r>',
    '</w:p>',
  ].join('');
}

function markdownToDocumentXml(markdown: string): string {
  const paragraphs = parseMarkdown(markdown)
    .map((line) => {
      if (line.kind === 'blank') {
        return '<w:p/>';
      }

      if (line.kind === 'heading') {
        return paragraphXml(line.text, { headingLevel: Math.min(line.level || 1, 3) });
      }

      if (line.kind === 'list') {
        return paragraphXml(line.text, { list: true });
      }

      return paragraphXml(line.text);
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimestamp(date = new Date()): { time: number; day: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function createZip(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const { time, day } = dosTimestamp();
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.data);
    const localHeader = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(time),
      u16(day),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
    ]);

    localParts.push(localHeader, file.data);

    const centralHeader = concatBytes([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(time),
      u16(day),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);

    centralParts.push(centralHeader);
    offset += localHeader.length + file.data.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const localDirectory = concatBytes(localParts);
  const endRecord = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDirectory.length),
    u32(localDirectory.length),
    u16(0),
  ]);

  return concatBytes([localDirectory, centralDirectory, endRecord]);
}

export function generateDocxFromMarkdown(markdown: string): Uint8Array {
  const now = new Date().toISOString();
  const files = [
    {
      name: '[Content_Types].xml',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`),
    },
    {
      name: '_rels/.rels',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`),
    },
    {
      name: 'docProps/core.xml',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Meetily Export</dc:title>
  <dc:creator>Meetily</dc:creator>
  <cp:lastModifiedBy>Meetily</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`),
    },
    {
      name: 'docProps/app.xml',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Meetily</Application>
</Properties>`),
    },
    {
      name: 'word/document.xml',
      data: encoder.encode(markdownToDocumentXml(markdown)),
    },
  ];

  return createZip(files);
}
