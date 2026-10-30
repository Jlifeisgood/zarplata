/* Оформленный Excel-отчёт: свой генератор xlsx со стилями (шапка, группы, итоги, форматы чисел, закрепление строк, печать).
   Использует zip из xlsxfill.js. Лист: { name, tab, head:[], body:[{t:'row'|'grp'|'sub'|'tot', cells:[]}], widths:[], center:[индексы], footer:[[подпись, число]] } */
(function () {
  const { zipStore, toB64, enc, xmlEsc, colName } = window.XZip;

  // индексы cellXfs
  const ST = { def: 0, title: 1, sub: 2, head: 3, text: 4, num: 5, ctr: 6, grp: 7, subT: 8, subN: 9, totT: 10, totN: 11, bad: 12, note: 13, lbl: 14, big: 15 };

  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="9">' +
    '<font><sz val="11"/><color rgb="FF14182B"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="16"/><color rgb="FF4F46E5"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><sz val="10"/><color rgb="FF6B7390"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FF14182B"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FF4F46E5"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFD4364F"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><i/><sz val="10"/><color rgb="FF6B7390"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="12"/><color rgb="FF14182B"/><name val="Calibri"/><family val="2"/></font>' +
    '</fonts>' +
    '<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF4F46E5"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEEF0FF"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF6F7FD"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFDDE1FF"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left style="thin"><color rgb="FFD5D9E8"/></left><right style="thin"><color rgb="FFD5D9E8"/></right><top style="thin"><color rgb="FFD5D9E8"/></top><bottom style="thin"><color rgb="FFD5D9E8"/></bottom><diagonal/></border>' +
    '<border><left style="thin"><color rgb="FFD5D9E8"/></left><right style="thin"><color rgb="FFD5D9E8"/></right><top style="medium"><color rgb="FF4F46E5"/></top><bottom style="thin"><color rgb="FFD5D9E8"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="16">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +                                                                                          // 0 def
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +                                                                           // 1 title
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +                                                                           // 2 sub
    '<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' + // 3 head
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +                  // 4 text
    '<xf numFmtId="4" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' + // 5 num
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' + // 6 ctr
    '<xf numFmtId="0" fontId="5" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' + // 7 grp
    '<xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' + // 8 subT
    '<xf numFmtId="4" fontId="4" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' + // 9 subN
    '<xf numFmtId="0" fontId="4" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' + // 10 totT
    '<xf numFmtId="4" fontId="4" fillId="5" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' + // 11 totN
    '<xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' + // 12 bad
    '<xf numFmtId="0" fontId="7" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' + // 13 note
    '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +                                                                           // 14 lbl
    '<xf numFmtId="4" fontId="8" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' + // 15 big
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  const cell = (ref, v, s) => {
    if (typeof v === "number" && isFinite(v)) return '<c r="' + ref + '" s="' + s + '"><v>' + v + '</v></c>';
    if (v == null || v === "") return '<c r="' + ref + '" s="' + s + '"/>';
    return '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(v) + '</t></is></c>';
  };

  function sheetXml(sh, meta) {
    const n = sh.head.length, last = colName(n), rows = [], merges = [];
    const row = (r, cells, ht) => rows.push('<row r="' + r + '"' + (ht ? ' ht="' + ht + '" customHeight="1"' : "") + '>' + cells + '</row>');
    row(1, cell("A1", meta.company, ST.title), 24); merges.push("A1:" + last + "1");
    row(2, cell("A2", meta.inn, ST.sub)); merges.push("A2:" + last + "2");
    row(3, cell("A3", sh.title + " · " + meta.period, ST.lbl)); merges.push("A3:" + last + "3");
    row(5, sh.head.map((h, i) => cell(colName(i + 1) + "5", h, ST.head)).join(""), 34);
    let r = 6;
    sh.body.forEach(b => {
      let cells = "";
      for (let i = 0; i < n; i++) {
        const v = b.cells[i], ref = colName(i + 1) + r;
        if (b.t === "grp") cells += cell(ref, i === 0 ? v : "", ST.grp);
        else if (b.t === "sub") cells += cell(ref, v, typeof v === "number" ? ST.subN : ST.subT);
        else if (b.t === "tot") cells += cell(ref, v, typeof v === "number" ? ST.totN : ST.totT);
        else if (typeof v === "number") cells += cell(ref, v, ST.num);
        else if (v === "нет данных") cells += cell(ref, v, ST.bad);
        else cells += cell(ref, v, i > 0 && (sh.center || []).includes(i) ? ST.ctr : ST.text);
      }
      if (b.t === "grp") merges.push("A" + r + ":" + last + r);
      row(r++, cells, b.t === "row" ? 18 : 20);
    });
    if (sh.footer && sh.footer.length) {
      r++; row(r++, cell("A" + (r - 1), sh.footerTitle || "К перечислению", ST.lbl));
      sh.footer.forEach(f => { row(r, cell("A" + r, f[0], ST.text) + cell("B" + r, "", ST.text) + cell("C" + r, f[1], ST.big), 22); merges.push("A" + r + ":B" + r); r++; });
    }
    r++; row(r, cell("A" + r, meta.note, ST.note)); merges.push("A" + r + ":" + last + r);
    const cols = sh.widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join("");
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><tabColor rgb="FF4F46E5"/><pageSetUpPr fitToPage="1"/></sheetPr>' +
      '<dimension ref="A1:' + last + r + '"/>' +
      '<sheetViews><sheetView showGridLines="0" workbookViewId="0"' + (sh.first ? ' tabSelected="1"' : "") + '><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A6" sqref="A6"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/><cols>' + cols + '</cols><sheetData>' + rows.join("") + '</sheetData>' +
      '<mergeCells count="' + merges.length + '">' + merges.map(m => '<mergeCell ref="' + m + '"/>').join("") + '</mergeCells>' +
      '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
      '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
      '<headerFooter><oddFooter>&amp;L' + xmlEsc(meta.company) + '&amp;RСтр. &amp;P из &amp;N</oddFooter></headerFooter></worksheet>';
  }

  /** meta: { company, inn, period, note }; sheets — см. описание вверху. Возвращает xlsx в base64. */
  window.buildReportXlsx = function (meta, sheets) {
    sheets.forEach((s, i) => { s.first = i === 0; });
    const files = [
      ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("") +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
      ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ["xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>' +
        sheets.map((s, i) => '<sheet name="' + xmlEsc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join("") + '</sheets></workbook>'],
      ["xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join("") +
        '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ["xl/styles.xml", STYLES]
    ].concat(sheets.map((s, i) => ["xl/worksheets/sheet" + (i + 1) + ".xml", sheetXml(s, meta)]));
    return toB64(zipStore(files.map(f => ({ name: f[0], data: enc(f[1]) }))));
  };
})();
