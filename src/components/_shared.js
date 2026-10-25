/*
 * 部品どうしで共通に使う描画パーツ。
 * 新しい部品を作るときも、ここの関数を使うと見た目を揃えやすい。
 */
(function () {
  'use strict';

  // ラベル付き入力欄の外枠。{ prims, box } を返し、box は入力欄部分の位置。
  function field(p, w, h, ctx, opt) {
    const C = ctx.C;
    const out = [];
    const label = String(p.label || '');
    const top = p.labelPos === 'top';
    let box;
    if (label && top) {
      out.push({ t: 'text', x: 0, y: 0, w, h: 22, text: label, size: 13, bold: true, color: C.ink, valign: 'top', fit: 'ellipsis' });
      box = { x: 0, y: 26, w, h: h - 26 };
    } else if (label && Number(p.labelWidth) > 0) {
      const lw = Number(p.labelWidth);
      // 必須マークはラベル欄の右端に揃えて置く（ラベルが長くても入力欄に重ならない）
      out.push({ t: 'text', x: 0, y: 0, w: lw - 12 - (p.required ? 40 : 0), h: opt && opt.labelTop ? 38 : h, text: label, size: 14, bold: true, color: C.ink, fit: 'wrap' });
      box = { x: lw, y: 0, w: w - lw, h };
    } else {
      box = { x: 0, y: 0, w, h };
    }
    if (label && p.required && (top || Number(p.labelWidth) > 0)) {
      const bx = top ? Math.min(ctx.measure(label, 13, true), w - 40) + 8 : Number(p.labelWidth) - 12 - 32;
      const by = top ? 2 : (opt && opt.labelTop ? 19 : h / 2) - 9;
      out.push({ t: 'rect', x: bx, y: by, w: 32, h: 18, r: 3, fill: C.danger });
      out.push({ t: 'text', x: bx, y: by, w: 32, h: 18, text: '必須', size: 11, bold: true, color: '#FFFFFF', align: 'center' });
    }
    out.push({ t: 'rect', ...box, r: 4, fill: p.disabled ? C.soft : C.paper, stroke: C.line });
    return { prims: out, box };
  }

  // 入力欄の中の文字（値があれば値、なければ薄いプレースホルダー）
  function fieldText(p, box, ctx, rightPad, valign) {
    const has = p.value != null && String(p.value) !== '';
    return {
      t: 'text', x: box.x + 12, y: box.y + (valign === 'top' ? 10 : 0), w: box.w - 24 - (rightPad || 0),
      h: valign === 'top' ? box.h - 20 : box.h, valign: valign || 'middle',
      text: has ? p.value : (p.placeholder || ''), size: 14, color: has ? ctx.C.ink : ctx.C.faint, fit: valign === 'top' ? 'wrap' : 'ellipsis',
    };
  }

  // チェックボックス・ラジオの並び
  function choices(p, w, h, ctx, mark) {
    const C = ctx.C;
    const opts = ctx.list(p.options);
    const out = [];
    const vertical = p.direction === 'vertical';
    let x = 0, y = 0;
    const rowH = vertical ? Math.max(24, Math.min(36, h / Math.max(1, opts.length))) : h;
    opts.forEach((o, i) => {
      const cy = vertical ? y + rowH / 2 : h / 2;
      out.push(...mark(x, cy - 9, i));
      const tw = ctx.measure(o, 14, false);
      out.push({ t: 'text', x: x + 26, y: cy - 12, w: tw + 4, h: 24, text: o, size: 14, color: C.ink });
      if (vertical) y += rowH; else x += 26 + tw + 28;
    });
    return out;
  }

  window.GamenParts = { field, fieldText, choices };
})();
