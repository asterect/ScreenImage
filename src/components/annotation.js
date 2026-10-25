/* 注釈系の部品：番号マーク、付箋、矢印、範囲枠。設計書で画面に説明を書き込むときに使う */
(function () {
  'use strict';
  const { register } = window.GamenUI;

  register({
    type: 'marker',
    name: '番号マーク',
    category: '注釈',
    size: { w: 28, h: 28 },
    props: [
      { key: 'number', label: '番号', type: 'text', default: '1' },
      { key: 'color', label: '色', type: 'color', default: '#E11D48' },
    ],
    draw(p, w, h, ctx) {
      const c = p.color || '#E11D48';
      const s = Math.min(w, h);
      return [
        { t: 'ellipse', x: (w - s) / 2, y: (h - s) / 2, w: s, h: s, fill: c },
        { t: 'text', x: 0, y: 0, w, h, text: p.number, size: Math.round(s * 0.5), bold: true, color: ctx.onColor(c), align: 'center' },
      ];
    },
  });

  register({
    type: 'sticky',
    name: '付箋',
    category: '注釈',
    size: { w: 220, h: 120 },
    props: [
      { key: 'title', label: '見出し', type: 'text', default: '① 検索条件' },
      { key: 'text', label: '本文', type: 'textarea', default: '条件を1つ以上入力しないと\n「検索」は押せない。\n氏名は前方一致で検索する。' },
      { key: 'color', label: '色', type: 'color', default: '#FEF3C7' },
    ],
    draw(p, w, h, ctx) {
      const bg = p.color || '#FEF3C7';
      const bd = ctx.shade(bg, 0.18);
      const out = [{ t: 'rect', x: 0, y: 0, w, h, r: 2, fill: bg, stroke: bd }];
      let y = 10;
      if (p.title) { out.push({ t: 'text', x: 12, y, w: w - 24, h: 20, text: p.title, size: 13, bold: true, color: '#78350F', fit: 'ellipsis' }); y += 24; }
      out.push({ t: 'text', x: 12, y, w: w - 24, h: h - y - 10, text: p.text, size: 12, color: '#78350F', valign: 'top', fit: 'wrap' });
      return out;
    },
  });

  register({
    type: 'arrow',
    name: '矢印',
    category: '注釈',
    size: { w: 120, h: 24 },
    props: [
      { key: 'dir', label: '向き', type: 'select', default: 'right',
        options: [['right', '→ 右'], ['left', '← 左'], ['down', '↓ 下'], ['up', '↑ 上'], ['downright', '↘ 右下'], ['upright', '↗ 右上'], ['downleft', '↙ 左下'], ['upleft', '↖ 左上']] },
      { key: 'color', label: '色', type: 'color', default: '#E11D48' },
      { key: 'width', label: '太さ', type: 'number', default: 2, min: 1, max: 8 },
      { key: 'dash', label: '破線', type: 'bool', default: false },
    ],
    draw(p, w, h) {
      const m = {
        right: [0, h / 2, w, h / 2], left: [w, h / 2, 0, h / 2], down: [w / 2, 0, w / 2, h], up: [w / 2, h, w / 2, 0],
        downright: [0, 0, w, h], upright: [0, h, w, 0], downleft: [w, 0, 0, h], upleft: [w, h, 0, 0],
      }[p.dir] || [0, h / 2, w, h / 2];
      return [{ t: 'line', x1: m[0], y1: m[1], x2: m[2], y2: m[3], stroke: p.color || '#E11D48', sw: Number(p.width) || 2, dash: p.dash, arrow: true }];
    },
  });

  register({
    type: 'focus',
    name: '範囲枠',
    category: '注釈',
    size: { w: 280, h: 120 },
    props: [
      { key: 'color', label: '色', type: 'color', default: '#E11D48' },
      { key: 'width', label: '太さ', type: 'number', default: 2, min: 1, max: 8 },
      { key: 'dash', label: '破線', type: 'bool', default: true },
    ],
    draw(p, w, h) {
      const sw = Number(p.width) || 2;
      return [{ t: 'rect', x: sw / 2, y: sw / 2, w: w - sw, h: h - sw, r: 6, stroke: p.color || '#E11D48', sw, dash: p.dash }];
    },
  });
})();
