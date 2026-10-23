/* Заполнение официального шаблона 11101_20 (приложение 4) без потери оформления.
   Шаблон лежит в tpl11101.js по частям; строки данных дописываются прямо в XML листа, затем собирается обычный xlsx (zip без сжатия). */
(function () {
  const dec = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const txt = u8 => new TextDecoder().decode(u8);
  const enc = s => new TextEncoder().encode(s);
  const xmlEsc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const colName = n => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

  const CRC = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; }
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

  /** files: [{name, data}] → Uint8Array zip (метод store) */
  function zipStore(files) {
    const DATE = ((2026 - 1980) << 9) | (10 << 5) | 24, parts = [], central = [];
    let offset = 0;
    files.forEach(f => {
      const name = enc(f.name), crc = crc32(f.data), size = f.data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, DATE, true); lh.setUint32(14, crc, true); lh.setUint32(18, size, true);
      lh.setUint32(22, size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, f.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, DATE, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + size;
    });
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    const all = parts.concat(central, [new Uint8Array(end.buffer)]);
    const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
    let o = 0; all.forEach(p => { out.set(p, o); o += p.length; });
    return out;
  }

  const toB64 = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  window.XZip = { zipStore, toB64, enc, xmlEsc, colName };

  /**
   * rows: массив строк; значения — число, строка или null. Колонки идут с B (графа 1). Данные пишутся с 15-й строки.
   * Возвращает xlsx в base64.
   */
  window.fillTemplate = function (rows) {
    const F = window.TPL_FILES, FIRST = 15, LASTCOL = 45; // AS — последняя графа для заполнения
    let sheet = txt(dec(F["xl/worksheets/sheet1.xml"]));
    let sst = txt(dec(F["xl/sharedStrings.xml"]));
    const head = sst.match(/<sst[^>]*>/)[0];
    let count = +head.match(/ count="(\d+)"/)[1], unique = +head.match(/uniqueCount="(\d+)"/)[1];
    const added = [];
    const str = s => { added.push('<si><t xml:space="preserve">' + xmlEsc(s) + '</t></si>'); count++; return unique++; };

    // стили колонок из шаблона (ячейка без стиля получила бы «пустой» формат)
    const style = {};
    (sheet.match(/<cols>.*<\/cols>/) || [""])[0].replace(/<col [^>]*>/g, c => {
      const min = +c.match(/min="(\d+)"/)[1], max = +c.match(/max="(\d+)"/)[1], s = c.match(/style="(\d+)"/);
      if (s) for (let i = min; i <= max; i++) style[i] = s[1];
      return c;
    });

    // в шаблоне у графы «рабочее время» формат «0» (0,5 выглядит как 1), а у сумм «0.0» (12000000,0): задаём читаемые форматы
    let styles = txt(dec(F["xl/styles.xml"]));
    const xfs = styles.match(/<cellXfs count="(\d+)">/), baseXf = +xfs[1];
    styles = styles.replace(xfs[0], '<cellXfs count="' + (baseXf + 2) + '">').replace("</cellXfs>",
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1" applyProtection="1"><alignment horizontal="center" vertical="center"/><protection locked="0"/></xf>' +
      '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1" applyProtection="1"><alignment horizontal="right" vertical="center"/><protection locked="0"/></xf></cellXfs>');
    style[10] = String(baseXf);                                          // J — рабочее время (в ставках)
    Object.keys(style).forEach(c => { if (style[c] === "11") style[c] = String(baseXf + 1); }); // суммы: #,##0.00

    const sums = {};
    const xml = rows.map((vals, i) => {
      const r = FIRST + i;
      let cells = "";
      for (let col = 2; col <= LASTCOL; col++) {
        const v = vals[col - 2], ref = colName(col) + r, s = style[col] ? ' s="' + style[col] + '"' : "";
        if (typeof v === "number" && isFinite(v)) { cells += '<c r="' + ref + '"' + s + '><v>' + v + '</v></c>'; sums[col] = (sums[col] || 0) + v; }
        else if (v != null && v !== "") cells += '<c r="' + ref + '"' + s + ' t="s"><v>' + str(v) + '</v></c>';
        else cells += '<c r="' + ref + '"' + s + '/>';
      }
      return '<row r="' + r + '" spans="2:49">' + cells + '</row>';
    }).join("");

    sheet = sheet.replace("</sheetData>", xml + "</sheetData>")
      .replace(/<dimension ref="[^"]*"\/>/, '<dimension ref="B1:AW' + (FIRST - 1 + Math.max(rows.length, 1)) + '"/>');
    // кэшированные итоги в строке 12 (Excel всё равно пересчитает при открытии)
    for (let col = 12; col <= LASTCOL; col++) {
      const L = colName(col);
      sheet = sheet.replace(new RegExp('(<c r="' + L + '12"[^>]*><f>[^<]*</f>)<v>[^<]*</v>'), "$1<v>" + (sums[col] || 0) + "</v>");
    }
    sst = sst.replace(head, head.replace(/ count="\d+"/, ' count="' + count + '"').replace(/uniqueCount="\d+"/, 'uniqueCount="' + unique + '"'))
      .replace("</sst>", added.join("") + "</sst>");

    const files = Object.keys(F).map(name => ({
      name,
      data: name === "xl/worksheets/sheet1.xml" ? enc(sheet) : name === "xl/sharedStrings.xml" ? enc(sst) : name === "xl/styles.xml" ? enc(styles) : dec(F[name])
    }));
    return toB64(zipStore(files));
  };
})();
