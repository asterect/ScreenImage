/*
 * 描画まわり
 *  - makeCtx(theme): 部品の draw() に渡すヘルパー群
 *  - toSVG(prims):   プリミティブ配列を SVG 要素の文字列に変換
 *  - tableLayout():  表の列幅・行位置の計算（SVG と PowerPoint で共通）
 */
(function () {
  'use strict';

  // 画面イメージ内の文字に使うフォント。PowerPoint 出力も同じフォント名を指定する。
  const FONT_NAME = 'Meiryo UI';
  const FONT_STACK = "'Meiryo UI', 'Yu Gothic UI', 'Hiragino Sans', 'Noto Sans JP', sans-serif";
  const LINE_HEIGHT = 1.35;

  // 部品で共通して使う色
  const C = {
    ink: '#1F2937', sub: '#64748B', faint: '#94A3B8', line: '#CBD5E1', lineSoft: '#E2E8F0',
    soft: '#F1F5F9', softer: '#F8FAFC', paper: '#FFFFFF',
    danger: '#DC2626', success: '#16A34A', warning: '#D97706', info: '#2563EB',
  };

  function hexToRgb(hex) {
    let h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return [0, 0, 0];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  function rgbToHex(rgb) {
    return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  function mix(hex, target, t) {
    const a = hexToRgb(hex);
    return rgbToHex(a.map((v, i) => v + (target[i] - v) * t));
  }

  let measureCanvas = null;
  function measure(text, size, bold) {
    if (!measureCanvas) measureCanvas = document.createElement('canvas').getContext('2d');
    measureCanvas.font = `${bold ? 'bold ' : ''}${size}px ${FONT_STACK}`;
    const lines = String(text == null ? '' : text).split('\n');
    return Math.max(...lines.map((l) => measureCanvas.measureText(l).width));
  }

  // 「A,B,C」や「A、B、C」を配列にする
  function list(value) {
    return String(value == null ? '' : value).split(/[,、，]/).map((s) => s.trim()).filter((s) => s !== '');
  }
  function lines(value) {
    return String(value == null ? '' : value).split(/\r?\n/).map((s) => s.trim()).filter((s) => s !== '');
  }

  function makeCtx(theme) {
    const primary = (theme && theme.primary) || '#2457C5';
    return {
      C,
      FONT_NAME,
      theme: { primary },
      color: (c) => c || primary,
      tint: (hex, t) => mix(hex, [255, 255, 255], t),
      shade: (hex, t) => mix(hex, [0, 0, 0], t),
      // 背景色の上で読みやすい文字色（白 or 濃い灰）
      onColor: (bg) => {
        const [r, g, b] = hexToRgb(bg || primary).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? C.ink : '#FFFFFF';
      },
      measure,
      list,
      lines,
    };
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  const n = (v) => Math.round((Number(v) || 0) * 100) / 100;

  function strokeAttrs(p) {
    if (!p.stroke) return 'stroke="none"';
    const sw = p.sw == null ? 1 : p.sw;
    return `stroke="${esc(p.stroke)}" stroke-width="${n(sw)}"${p.dash ? ` stroke-dasharray="${n(sw * 4)} ${n(sw * 3)}"` : ''}`;
  }

  // 数値・金額らしいセルは右寄せ
  // 0 で始まる番号（顧客番号など）はコードとみなして左寄せのまま
  function isNumeric(s) {
    const t = String(s).trim();
    if (/^0\d/.test(t)) return false;
    return /^[-+]?[¥￥$]?[\d,]+(\.\d+)?(円|%|件)?$/.test(t);
  }

  function tableLayout(p) {
    const cols = p.columns.length || 1;
    let ratios = (p.colRatios || []).map(Number).filter((v) => v > 0);
    if (ratios.length !== cols) ratios = new Array(cols).fill(1);
    const total = ratios.reduce((a, b) => a + b, 0);
    const colW = [];
    let acc = 0;
    ratios.forEach((r, i) => {
      const w = i === cols - 1 ? p.w - acc : Math.round((p.w * r) / total);
      colW.push(w);
      acc += w;
    });
    const colX = [];
    acc = 0;
    colW.forEach((w) => { colX.push(acc); acc += w; });
    const rowCount = p.rows.length + 1;
    const rowH = p.h / rowCount;
    const align = p.columns.map((_, ci) => {
      if (p.align && p.align[ci]) return p.align[ci];
      const body = p.rows.map((r) => r[ci]).filter((v) => v != null && v !== '');
      return body.length && body.every(isNumeric) ? 'right' : 'left';
    });
    return { colW, colX, rowH, rowCount, align };
  }

  // 大きさの違う文字を1行に並べる（例：「3,250,000」＋「円」）。ベースラインを揃える。
  function runsSVG(p) {
    const runs = p.runs.filter((r) => r && r.text != null && r.text !== '');
    const maxSize = Math.max(...runs.map((r) => r.size || 14), 1);
    const va = p.valign || 'middle';
    const base = va === 'top' ? p.y + maxSize * 1.05 : va === 'bottom' ? p.y + p.h - maxSize * 0.3 : p.y + p.h / 2 + maxSize * 0.36;
    const al = p.align || 'left';
    const x = al === 'center' ? p.x + p.w / 2 : al === 'right' ? p.x + p.w : p.x;
    const anchor = al === 'center' ? 'middle' : al === 'right' ? 'end' : 'start';
    return `<text x="${n(x)}" y="${n(base)}" text-anchor="${anchor}">` + runs.map((r) =>
      `<tspan font-size="${n(r.size || 14)}"${r.bold ? ' font-weight="bold"' : ''} fill="${esc(r.color || C.ink)}">${esc(r.text)}</tspan>`).join('') + '</text>';
  }

  // ---- 文字の折り返し・省略 ----------------------------------------------
  // fit: 'wrap'     … 幅で折り返し、高さに収まらない分は最終行を「…」で省略
  //      'ellipsis' … 折り返さず、幅を超えたら「…」で省略（改行は残す）
  //      なし       … そのまま（はみ出しても描く）
  // 画面・PNG・PowerPoint の3つで同じ結果になるよう、改行位置はここで決めて渡す。
  const NO_LINE_START = '、。，．,.）)］]｝}」』〉》】〕・：；:;！!？?ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ々〜…';
  let overflowHit = false; // 直近の描画で文字が収まらなかったか（エディタの警告表示用）

  function ellipsize(line, size, bold, w) {
    if (measure(line, size, bold) <= w) return line;
    let s = line;
    while (s.length && measure(s + '…', size, bold) > w) s = s.slice(0, -1);
    return s + '…';
  }

  function wrapParagraph(text, size, bold, w) {
    const out = [];
    let cur = '';
    for (const ch of text) {
      if (cur === '' && ch === ' ') continue;
      if (measure(cur + ch, size, bold) <= w || cur === '') { cur += ch; continue; }
      if (NO_LINE_START.includes(ch)) { out.push(cur + ch); cur = ''; continue; } // 句読点は行頭に置かない
      const sp = cur.lastIndexOf(' ');
      if (/[A-Za-z0-9]/.test(ch) && sp > 0 && /[A-Za-z0-9]$/.test(cur)) { // 英単語は途中で切らない
        out.push(cur.slice(0, sp));
        cur = cur.slice(sp + 1) + ch;
      } else { out.push(cur); cur = ch; }
    }
    out.push(cur);
    return out;
  }

  function fitText(p) {
    const size = p.size || 14;
    const raw = String(p.text == null ? '' : p.text).split('\n');
    if (!p.fit || !(p.w > 0)) return raw;
    const lh = size * LINE_HEIGHT;
    const maxLines = Math.max(1, Math.floor((p.h + 0.5) / lh));
    let lines = p.fit === 'wrap' ? raw.flatMap((l) => wrapParagraph(l, size, p.bold, p.w)) : raw.slice();
    let cut = false;
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); cut = true; }
    lines = lines.map((l) => { const f = ellipsize(l, size, p.bold, p.w); if (f !== l) cut = true; return f; });
    if (cut) {
      const i = lines.length - 1;
      if (!lines[i].endsWith('…')) lines[i] = ellipsize(lines[i] + '…', size, p.bold, p.w);
    }
    if (cut) overflowHit = true;
    return lines;
  }

  function textSVG(p) {
    if (Array.isArray(p.runs)) return runsSVG(p);
    const size = p.size || 14;
    const lh = size * LINE_HEIGHT;
    const ls = fitText(p);
    const block = ls.length * lh;
    const va = p.valign || 'middle';
    const top = va === 'top' ? p.y : va === 'bottom' ? p.y + p.h - block : p.y + (p.h - block) / 2;
    const al = p.align || 'left';
    const x = al === 'center' ? p.x + p.w / 2 : al === 'right' ? p.x + p.w : p.x;
    const anchor = al === 'center' ? 'middle' : al === 'right' ? 'end' : 'start';
    return ls.map((line, i) => `<text x="${n(x)}" y="${n(top + lh * i + lh / 2)}" font-size="${n(size)}"` +
      `${p.bold ? ' font-weight="bold"' : ''} fill="${esc(p.color || C.ink)}" text-anchor="${anchor}" dominant-baseline="central">${esc(line)}</text>`).join('');
  }

  function tableSVG(p) {
    const L = tableLayout(p);
    const size = p.size || 13;
    const border = p.border || C.line;
    let s = `<g transform="translate(${n(p.x)} ${n(p.y)})">`;
    s += `<rect x="0" y="0" width="${n(p.w)}" height="${n(L.rowH)}" fill="${esc(p.headerFill || C.soft)}"/>`;
    if (p.stripe) {
      p.rows.forEach((_, ri) => {
        if (ri % 2 === 1) s += `<rect x="0" y="${n(L.rowH * (ri + 1))}" width="${n(p.w)}" height="${n(L.rowH)}" fill="${C.softer}"/>`;
      });
    }
    for (let r = 1; r < L.rowCount; r++) {
      s += `<line x1="0" y1="${n(L.rowH * r)}" x2="${n(p.w)}" y2="${n(L.rowH * r)}" stroke="${esc(border)}" stroke-width="1"/>`;
    }
    L.colX.slice(1).forEach((x) => {
      s += `<line x1="${n(x)}" y1="0" x2="${n(x)}" y2="${n(p.h)}" stroke="${esc(border)}" stroke-width="1"/>`;
    });
    s += `<rect x="0" y="0" width="${n(p.w)}" height="${n(p.h)}" fill="none" stroke="${esc(border)}" stroke-width="1"/>`;
    const pad = 8;
    const cell = (text, ci, ri, bold, color) => {
      const al = ri === 0 ? (L.align[ci] === 'right' ? 'right' : 'left') : L.align[ci];
      return textSVG({ x: L.colX[ci] + pad, y: L.rowH * ri, w: L.colW[ci] - pad * 2, h: L.rowH, text, size, bold, color, align: al, fit: 'wrap' });
    };
    p.columns.forEach((c, ci) => { s += cell(c, ci, 0, true, p.headerColor || C.ink); });
    p.rows.forEach((row, ri) => p.columns.forEach((_, ci) => { s += cell(row[ci] == null ? '' : row[ci], ci, ri + 1, false, C.ink); }));
    return s + '</g>';
  }

  function triPoints(p) {
    const { x, y, w, h } = p;
    switch (p.dir) {
      case 'up': return [[x + w / 2, y], [x + w, y + h], [x, y + h]];
      case 'left': return [[x, y + h / 2], [x + w, y], [x + w, y + h]];
      case 'right': return [[x, y], [x + w, y + h / 2], [x, y + h]];
      default: return [[x, y], [x + w, y], [x + w / 2, y + h]];
    }
  }

  function toSVG(prims) {
    return (prims || []).map((p) => {
      switch (p.t) {
        case 'rect':
          return `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(Math.max(0, p.w))}" height="${n(Math.max(0, p.h))}"` +
            `${p.r ? ` rx="${n(p.r)}"` : ''} fill="${esc(p.fill || 'none')}" ${strokeAttrs(p)}/>`;
        case 'ellipse':
          return `<ellipse cx="${n(p.x + p.w / 2)}" cy="${n(p.y + p.h / 2)}" rx="${n(p.w / 2)}" ry="${n(p.h / 2)}" fill="${esc(p.fill || 'none')}" ${strokeAttrs(p)}/>`;
        case 'line': {
          const stroke = p.stroke || C.ink;
          if (!p.arrow) {
            return `<line x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}" ${strokeAttrs({ ...p, stroke })} stroke-linecap="round"/>`;
          }
          // 終点に矢じり（PowerPoint の「三角」矢じりに近い大きさ）
          const sw = p.sw == null ? 1 : p.sw;
          const len = Math.max(8, sw * 3.5), half = Math.max(4, sw * 1.75);
          const a = Math.atan2(p.y2 - p.y1, p.x2 - p.x1);
          const bx = p.x2 - Math.cos(a) * len, by = p.y2 - Math.sin(a) * len;
          const pts = [[p.x2, p.y2], [bx - Math.sin(a) * half, by + Math.cos(a) * half], [bx + Math.sin(a) * half, by - Math.cos(a) * half]];
          return `<line x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(bx)}" y2="${n(by)}" ${strokeAttrs({ ...p, stroke })}/>` +
            `<polygon points="${pts.map((pt) => pt.map(n).join(',')).join(' ')}" fill="${esc(stroke)}"/>`;
        }
        case 'tri':
          return `<polygon points="${triPoints(p).map((pt) => pt.map(n).join(',')).join(' ')}" fill="${esc(p.fill || C.ink)}"/>`;
        case 'text':
          return textSVG(p);
        case 'table':
          return tableSVG(p);
        default:
          return '';
      }
    }).join('');
  }

  // 1部品をサイズ付きの SVG 文字列にする（パレットのサムネイルや PNG 出力用）
  function itemSVG(def, props, w, h, ctx) {
    let prims = [];
    try { prims = def.draw(props, w, h, ctx) || []; } catch (e) { console.error(def.type, e); }
    overflowHit = false;
    const svg = toSVG(prims);
    itemSVG.overflow = overflowHit;
    return svg;
  }

  window.GamenRender = { makeCtx, toSVG, itemSVG, tableLayout, fitText, FONT_NAME, FONT_STACK, LINE_HEIGHT, C };
})();
