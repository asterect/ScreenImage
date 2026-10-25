/*
 * PowerPoint（.pptx）出力
 *  - 1ページ = 1スライド。スライドの大きさは画面サイズと同じ比率（1px = 1/96 インチ）
 *  - 部品ごとに図形をグループ化するので、PowerPoint 上でも部品単位で動かせる
 *  - 表は PowerPoint の表として出力する（グループには入れられないため単独で置く）
 */
(function () {
  'use strict';

  const EMU = 9525; // 1px あたりの EMU（914400 / 96）
  const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  const emu = (px) => Math.round((Number(px) || 0) * EMU);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    // XML で使えない制御文字を除く
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const hex = (c) => {
    let h = String(c || '').replace('#', '').trim();
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    return /^[0-9a-fA-F]{6}$/.test(h) ? h.toUpperCase() : null;
  };

  class Slide {
    constructor() { this.nextId = 2; this.parts = []; }
    id() { return this.nextId++; }
  }

  function fillXml(color) {
    const h = hex(color);
    return h ? `<a:solidFill><a:srgbClr val="${h}"/></a:solidFill>` : '<a:noFill/>';
  }
  function lnXml(p, defaultStroke) {
    const h = hex(p.stroke || defaultStroke);
    if (!h) return '<a:ln><a:noFill/></a:ln>';
    const w = emu(p.sw == null ? 1 : p.sw);
    return `<a:ln w="${Math.max(w, 1)}"><a:solidFill><a:srgbClr val="${h}"/></a:solidFill>` +
      `${p.dash ? '<a:prstDash val="dash"/>' : ''}${p.arrow ? '<a:tailEnd type="triangle" w="med" len="med"/>' : ''}</a:ln>`;
  }
  function xfrm(x, y, w, h, extra) {
    return `<a:xfrm${extra || ''}><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${Math.max(emu(w), 0)}" cy="${Math.max(emu(h), 0)}"/></a:xfrm>`;
  }
  function nv(slide, name, txBox) {
    return `<p:nvSpPr><p:cNvPr id="${slide.id()}" name="${esc(name)}"/><p:cNvSpPr${txBox ? ' txBox="1"' : ''}/><p:nvPr/></p:nvSpPr>`;
  }

  function runXml(text, size, bold, color, fontName) {
    const sz = Math.max(100, Math.round(size * 0.75 * 100));
    const props = `lang="ja-JP" altLang="en-US" sz="${sz}"${bold ? ' b="1"' : ' b="0"'} dirty="0"`;
    const font = `<a:latin typeface="${esc(fontName)}"/><a:ea typeface="${esc(fontName)}"/>`;
    const fill = `<a:solidFill><a:srgbClr val="${hex(color) || '1F2937'}"/></a:solidFill>`;
    if (text === '') return `<a:endParaRPr ${props}>${fill}${font}</a:endParaRPr>`;
    return `<a:r><a:rPr ${props}>${fill}${font}</a:rPr><a:t>${esc(text)}</a:t></a:r>`;
  }

  function shapeXml(slide, p, ox, oy, R) {
    const x = ox + (p.x || 0);
    const y = oy + (p.y || 0);
    switch (p.t) {
      case 'rect':
      case 'ellipse': {
        let geom;
        if (p.t === 'ellipse') geom = '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>';
        else if (p.r) {
          const adj = Math.min(50000, Math.round((p.r / Math.max(1, Math.min(p.w, p.h))) * 100000));
          geom = `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${adj}"/></a:avLst></a:prstGeom>`;
        } else geom = '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
        return `<p:sp>${nv(slide, p.t === 'ellipse' ? '円' : '四角形')}<p:spPr>${xfrm(x, y, p.w, p.h)}${geom}${fillXml(p.fill)}${lnXml(p)}</p:spPr></p:sp>`;
      }
      case 'line': {
        const x1 = ox + p.x1, y1 = oy + p.y1, x2 = ox + p.x2, y2 = oy + p.y2;
        const flip = `${x2 < x1 ? ' flipH="1"' : ''}${y2 < y1 ? ' flipV="1"' : ''}`;
        return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${slide.id()}" name="線"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>` +
          `<p:spPr>${xfrm(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1), flip)}` +
          `<a:prstGeom prst="line"><a:avLst/></a:prstGeom>${lnXml(p, R.C.ink)}</p:spPr></p:cxnSp>`;
      }
      case 'tri': {
        // 二等辺三角形は上向き。回転で向きを変える（90度回転では幅と高さを入れ替える）
        const rot = { up: 0, right: 90, down: 180, left: 270 }[p.dir || 'down'] || 0;
        let bx = x, by = y, bw = p.w, bh = p.h;
        if (rot === 90 || rot === 270) { bw = p.h; bh = p.w; bx = x + (p.w - bw) / 2; by = y + (p.h - bh) / 2; }
        return `<p:sp>${nv(slide, '三角形')}<p:spPr>${xfrm(bx, by, bw, bh, rot ? ` rot="${rot * 60000}"` : '')}` +
          `<a:prstGeom prst="triangle"><a:avLst/></a:prstGeom>${fillXml(p.fill || R.C.ink)}<a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;
      }
      case 'text': {
        const size = p.size || 14;
        const algn = { left: 'l', center: 'ctr', right: 'r' }[p.align || 'left'];
        const anchor = { top: 't', middle: 'ctr', bottom: 'b' }[p.valign || 'middle'];
        const spc = Math.round(size * R.LINE_HEIGHT * 0.75 * 100);
        let paras;
        if (Array.isArray(p.runs)) {
          const rs = p.runs.filter((r) => r && r.text != null && r.text !== '');
          paras = `<a:p><a:pPr algn="${algn}"><a:buNone/></a:pPr>${rs.map((r) => runXml(String(r.text), r.size || 14, r.bold, r.color, R.FONT_NAME)).join('')}</a:p>`;
        } else paras = R.fitText(p).map((line) =>
          `<a:p><a:pPr algn="${algn}"><a:lnSpc><a:spcPts val="${spc}"/></a:lnSpc><a:buNone/></a:pPr>` +
          `${runXml(line, size, p.bold, p.color, R.FONT_NAME)}</a:p>`).join('');
        return `<p:sp>${nv(slide, 'テキスト', true)}<p:spPr>${xfrm(x, y, p.w, p.h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
          `<p:txBody><a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${anchor}" rtlCol="0"><a:noAutofit/></a:bodyPr>` +
          `<a:lstStyle/>${paras}</p:txBody></p:sp>`;
      }
      default:
        return '';
    }
  }

  function tableXml(slide, p, ox, oy, R, name) {
    const L = R.tableLayout(p);
    const size = p.size || 13;
    const border = hex(p.border || R.C.line);
    const ln = (tag) => `<a:${tag} w="${EMU}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="${border}"/></a:solidFill>` +
      `<a:prstDash val="solid"/></a:${tag}>`;
    const cell = (text, ci, ri) => {
      const header = ri === 0;
      const al = header ? (L.align[ci] === 'right' ? 'right' : 'left') : L.align[ci];
      const algn = { left: 'l', center: 'ctr', right: 'r' }[al];
      let fill = '<a:noFill/>';
      if (header) fill = fillXml(p.headerFill || R.C.soft);
      else if (p.stripe && (ri - 1) % 2 === 1) fill = fillXml(R.C.softer);
      const color = header ? (p.headerColor || R.C.ink) : R.C.ink;
      // 画面と同じ位置で改行・省略する
      const lines = R.fitText({ text: text == null ? '' : String(text), size, bold: header, w: L.colW[ci] - 16, h: L.rowH, fit: 'wrap' });
      const spc = Math.round(size * R.LINE_HEIGHT * 0.75 * 100);
      const paras = lines.map((line) => `<a:p><a:pPr algn="${algn}"><a:lnSpc><a:spcPts val="${spc}"/></a:lnSpc><a:buNone/></a:pPr>` +
        `${runXml(line, size, header, color, R.FONT_NAME)}</a:p>`).join('');
      return `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${paras}</a:txBody>` +
        `<a:tcPr marL="${emu(8)}" marR="${emu(8)}" marT="0" marB="0" anchor="ctr">${ln('lnL')}${ln('lnR')}${ln('lnT')}${ln('lnB')}${fill}</a:tcPr></a:tc>`;
    };
    const rowH = emu(L.rowH);
    const rowsXml = [p.columns, ...p.rows].map((row, ri) =>
      `<a:tr h="${rowH}">${p.columns.map((_, ci) => cell(row[ci], ci, ri)).join('')}</a:tr>`).join('');
    return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${slide.id()}" name="${esc(name)}"/>` +
      `<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>` +
      `<p:xfrm><a:off x="${emu(ox + p.x)}" y="${emu(oy + p.y)}"/><a:ext cx="${emu(p.w)}" cy="${rowH * L.rowCount}"/></p:xfrm>` +
      `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1"/>` +
      `<a:tblGrid>${L.colW.map((w) => `<a:gridCol w="${emu(w)}"/>`).join('')}</a:tblGrid>${rowsXml}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
  }

  function groupXml(slide, name, box, body) {
    const off = `<a:off x="${emu(box.x)}" y="${emu(box.y)}"/><a:ext cx="${emu(box.w)}" cy="${emu(box.h)}"/>`;
    const ch = `<a:chOff x="${emu(box.x)}" y="${emu(box.y)}"/><a:chExt cx="${emu(box.w)}" cy="${emu(box.h)}"/>`;
    return `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${slide.id()}" name="${esc(name)}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
      `<p:grpSpPr><a:xfrm>${off}${ch}</a:xfrm></p:grpSpPr>${body}</p:grpSp>`;
  }

  // 1部品分。表は PowerPoint の仕様でグループに入れられないため tables として別に返す。
  function itemXml(slide, item, ctx, R) {
    const def = window.GamenUI.get(item.type);
    if (!def) return { shapes: '', tables: '' };
    let prims = [];
    try { prims = def.draw(item.props, item.w, item.h, ctx) || []; } catch (e) { console.error(item.type, e); return { shapes: '', tables: '' }; }
    const label = def.name + (item.props && (item.props.label || item.props.title || item.props.text) ? `：${String(item.props.label || item.props.title || item.props.text).split('\n')[0]}` : '');
    const tables = prims.filter((p) => p.t === 'table');
    const shapes = prims.filter((p) => p.t !== 'table');
    let out = '';
    if (shapes.length === 1) out = shapeXml(slide, shapes[0], item.x, item.y, R);
    else if (shapes.length > 1) out = groupXml(slide, label, item, shapes.map((p) => shapeXml(slide, p, item.x, item.y, R)).join(''));
    return { shapes: out, tables: tables.map((t) => tableXml(slide, t, item.x, item.y, R, label)).join('') };
  }

  // エディタでグループ化した部品は、PowerPoint でも1つのグループにまとめる
  function slideXml(page, ctx, R) {
    const slide = new Slide();
    const done = new Set();
    let body = '';
    page.items.forEach((it) => {
      if (done.has(it.id)) return;
      if (!it.group) { const x = itemXml(slide, it, ctx, R); body += x.shapes + x.tables; return; }
      const members = page.items.filter((m) => m.group === it.group);
      members.forEach((m) => done.add(m.id));
      const parts = members.map((m) => itemXml(slide, m, ctx, R));
      const inner = parts.map((x) => x.shapes).filter(Boolean);
      const x1 = Math.min(...members.map((m) => m.x)), y1 = Math.min(...members.map((m) => m.y));
      const x2 = Math.max(...members.map((m) => m.x + m.w)), y2 = Math.max(...members.map((m) => m.y + m.h));
      body += inner.length > 1 ? groupXml(slide, 'グループ', { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, inner.join('')) : inner.join('');
      body += parts.map((x) => x.tables).join('');
    });
    return HEAD + `<p:sld ${NS}><p:cSld name="${esc(page.name)}"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
      '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
      `${body}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  }

  function buildFiles(doc) {
    const R = window.GamenRender;
    const T = window.GamenPptxTemplate;
    const ctx = R.makeCtx(doc.theme);
    const pages = doc.pages;
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const files = [];

    const ct = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
      '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
      '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
      pages.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('') +
      '<Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>' +
      '<Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>' +
      '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
      '<Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';
    files.push({ name: '[Content_Types].xml', data: HEAD + ct });

    files.push({ name: '_rels/.rels', data: HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/>` +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      `<Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/></Relationships>` });

    files.push({ name: 'docProps/core.xml', data: HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      `<dc:title>${esc(doc.title || '画面イメージ')}</dc:title><dc:creator>画面イメージエディタ</dc:creator><cp:revision>1</cp:revision>` +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` });

    files.push({ name: 'docProps/app.xml', data: HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
      'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
      `<Application>Microsoft Office PowerPoint</Application><Slides>${pages.length}</Slides><AppVersion>16.0000</AppVersion></Properties>` });

    const sldIds = pages.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${10 + i}"/>`).join('');
    files.push({ name: 'ppt/presentation.xml', data: HEAD + `<p:presentation ${NS} saveSubsetFonts="1">` +
      '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
      `<p:sldIdLst>${sldIds}</p:sldIdLst>` +
      `<p:sldSz cx="${emu(doc.size.w)}" cy="${emu(doc.size.h)}"/><p:notesSz cx="6858000" cy="9144000"/>` +
      '<p:defaultTextStyle><a:lvl1pPr marL="0" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1">' +
      '<a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr>' +
      '</a:lvl1pPr></p:defaultTextStyle></p:presentation>' });

    files.push({ name: 'ppt/_rels/presentation.xml.rels', data: HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      `<Relationship Id="rId1" Type="${REL}/slideMaster" Target="slideMasters/slideMaster1.xml"/>` +
      `<Relationship Id="rId2" Type="${REL}/presProps" Target="presProps.xml"/>` +
      `<Relationship Id="rId3" Type="${REL}/viewProps" Target="viewProps.xml"/>` +
      `<Relationship Id="rId4" Type="${REL}/theme" Target="theme/theme1.xml"/>` +
      `<Relationship Id="rId5" Type="${REL}/tableStyles" Target="tableStyles.xml"/>` +
      pages.map((_, i) => `<Relationship Id="rId${10 + i}" Type="${REL}/slide" Target="slides/slide${i + 1}.xml"/>`).join('') +
      '</Relationships>' });

    files.push({ name: 'ppt/presProps.xml', data: HEAD + `<p:presentationPr ${NS}/>` });
    files.push({ name: 'ppt/viewProps.xml', data: HEAD + `<p:viewPr ${NS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>` });
    files.push({ name: 'ppt/tableStyles.xml', data: HEAD + '<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>' });

    files.push({ name: 'ppt/slideMasters/slideMaster1.xml', data: T.master });
    files.push({ name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      `<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
      `<Relationship Id="rId2" Type="${REL}/theme" Target="../theme/theme1.xml"/></Relationships>` });
    files.push({ name: 'ppt/slideLayouts/slideLayout1.xml', data: T.layout });
    files.push({ name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      `<Relationship Id="rId1" Type="${REL}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>` });
    files.push({ name: 'ppt/theme/theme1.xml', data: T.theme });

    pages.forEach((page, i) => {
      files.push({ name: `ppt/slides/slide${i + 1}.xml`, data: slideXml(page, ctx, R) });
      files.push({ name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        `<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>` });
    });
    return files;
  }

  function build(doc) {
    const blob = window.GamenZip.makeZip(buildFiles(doc));
    return new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  }

  window.GamenPptx = { build, buildFiles };
})();
