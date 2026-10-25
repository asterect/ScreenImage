/* 入力系の部品：ボタン、テキスト入力、プルダウン、日付、テキストエリア、検索ボックス、チェックボックス、ラジオ、トグル */
(function () {
  'use strict';
  const { register } = window.GamenUI;
  const { field, fieldText, choices } = window.GamenParts;

  // ラベル付き入力欄に共通のプロパティ
  const FIELD_PROPS = (label, placeholder) => [
    { key: 'label', label: 'ラベル', type: 'text', default: label },
    { key: 'labelPos', label: 'ラベルの位置', type: 'select', default: 'left', options: [['left', '左'], ['top', '上']] },
    { key: 'labelWidth', label: 'ラベル幅（左のとき）', type: 'number', default: 120, min: 0 },
    { key: 'placeholder', label: 'プレースホルダー', type: 'text', default: placeholder },
    { key: 'value', label: '入力値', type: 'text', default: '' },
    { key: 'required', label: '必須マーク', type: 'bool', default: false },
    { key: 'disabled', label: '入力不可（灰色）', type: 'bool', default: false },
  ];

  register({
    type: 'button',
    name: 'ボタン',
    category: '入力',
    size: { w: 120, h: 40 },
    props: [
      { key: 'label', label: '表示文字', type: 'text', default: '検索' },
      {
        key: 'variant', label: '種類', type: 'select', default: 'primary',
        options: [['primary', 'メイン（塗り）'], ['secondary', 'サブ（白）'], ['outline', '枠線'], ['danger', '危険（赤）'], ['link', 'リンク風']],
      },
      { key: 'color', label: '色', type: 'color', default: '' },
    ],
    draw(p, w, h, ctx) {
      const C = ctx.C;
      const c = p.variant === 'danger' ? C.danger : ctx.color(p.color);
      const st = {
        primary: { fill: c, text: ctx.onColor(c), bold: true },
        danger: { fill: c, text: '#FFFFFF', bold: true },
        secondary: { fill: C.paper, stroke: C.line, text: C.ink },
        outline: { fill: C.paper, stroke: c, text: c, bold: true },
        link: { text: c },
      }[p.variant] || { fill: c, text: '#FFFFFF' };
      const out = [];
      if (st.fill || st.stroke) out.push({ t: 'rect', x: 0, y: 0, w, h, r: 6, fill: st.fill, stroke: st.stroke });
      out.push({ t: 'text', x: 0, y: 0, w, h, text: p.label, size: 14, bold: st.bold, color: st.text, align: 'center', fit: 'ellipsis' });
      if (p.variant === 'link') {
        const tw = Math.min(w, ctx.measure(p.label, 14, false));
        out.push({ t: 'line', x1: (w - tw) / 2, y1: h / 2 + 11, x2: (w + tw) / 2, y2: h / 2 + 11, stroke: c });
      }
      return out;
    },
  });

  register({
    type: 'input',
    name: 'テキスト入力',
    category: '入力',
    size: { w: 400, h: 40 },
    props: FIELD_PROPS('氏名（カナ）', '例）ヤマダ タロウ'),
    draw(p, w, h, ctx) {
      const f = field(p, w, h, ctx);
      return [...f.prims, fieldText(p, f.box, ctx)];
    },
  });

  register({
    type: 'select',
    name: 'プルダウン',
    category: '入力',
    size: { w: 400, h: 40 },
    props: FIELD_PROPS('店舗', '選択してください'),
    draw(p, w, h, ctx) {
      const f = field(p, w, h, ctx);
      const b = f.box;
      return [...f.prims, fieldText(p, b, ctx, 20),
        { t: 'tri', x: b.x + b.w - 26, y: b.y + b.h / 2 - 3, w: 11, h: 6, fill: ctx.C.sub, dir: 'down' }];
    },
  });

  register({
    type: 'date',
    name: '日付入力',
    category: '入力',
    size: { w: 320, h: 40 },
    props: FIELD_PROPS('取引日', 'YYYY/MM/DD'),
    draw(p, w, h, ctx) {
      const C = ctx.C;
      const f = field(p, w, h, ctx);
      const b = f.box;
      const ix = b.x + b.w - 32, iy = b.y + b.h / 2 - 8;
      return [...f.prims, fieldText(p, b, ctx, 24),
        { t: 'rect', x: ix, y: iy, w: 18, h: 17, r: 2, stroke: C.sub, sw: 1.3 },
        { t: 'line', x1: ix, y1: iy + 5, x2: ix + 18, y2: iy + 5, stroke: C.sub, sw: 1.3 },
        { t: 'line', x1: ix + 5, y1: iy - 2, x2: ix + 5, y2: iy + 2, stroke: C.sub, sw: 1.3 },
        { t: 'line', x1: ix + 13, y1: iy - 2, x2: ix + 13, y2: iy + 2, stroke: C.sub, sw: 1.3 }];
    },
  });

  register({
    type: 'textarea',
    name: 'テキストエリア',
    category: '入力',
    size: { w: 560, h: 112 },
    props: FIELD_PROPS('備考', '自由に入力できます（最大500文字）'),
    draw(p, w, h, ctx) {
      const f = field(p, w, h, ctx, { labelTop: true });
      return [...f.prims, fieldText(p, f.box, ctx, 0, 'top')];
    },
  });

  register({
    type: 'search',
    name: '検索ボックス',
    category: '入力',
    size: { w: 320, h: 40 },
    props: [
      { key: 'placeholder', label: 'プレースホルダー', type: 'text', default: '顧客番号・氏名で検索' },
      { key: 'value', label: '入力値', type: 'text', default: '' },
    ],
    draw(p, w, h, ctx) {
      const C = ctx.C;
      const cy = h / 2;
      return [
        { t: 'rect', x: 0, y: 0, w, h, r: h / 2, fill: C.paper, stroke: C.line },
        { t: 'ellipse', x: 16, y: cy - 8, w: 12, h: 12, stroke: C.sub, sw: 1.6 },
        { t: 'line', x1: 26, y1: cy + 2, x2: 31, y2: cy + 7, stroke: C.sub, sw: 1.6 },
        fieldText({ ...p }, { x: 30, y: 0, w: w - 40, h }, ctx),
      ];
    },
  });

  register({
    type: 'checkbox',
    name: 'チェックボックス',
    category: '入力',
    size: { w: 320, h: 32 },
    props: [
      { key: 'options', label: '選択肢（カンマ区切り）', type: 'text', default: 'メール,電話,郵送' },
      { key: 'checked', label: 'チェック済みの番号（例：1,3）', type: 'text', default: '1' },
      { key: 'direction', label: '並び', type: 'select', default: 'horizontal', options: [['horizontal', '横'], ['vertical', '縦']] },
      { key: 'color', label: '色', type: 'color', default: '' },
    ],
    draw(p, w, h, ctx) {
      const C = ctx.C;
      const c = ctx.color(p.color);
      const on = ctx.list(p.checked).map(Number);
      return choices(p, w, h, ctx, (x, y, i) => {
        if (!on.includes(i + 1)) return [{ t: 'rect', x, y, w: 18, h: 18, r: 3, fill: C.paper, stroke: C.faint, sw: 1.5 }];
        return [
          { t: 'rect', x, y, w: 18, h: 18, r: 3, fill: c },
          { t: 'line', x1: x + 4.5, y1: y + 9.5, x2: x + 7.5, y2: y + 12.5, stroke: '#FFFFFF', sw: 2 },
          { t: 'line', x1: x + 7.5, y1: y + 12.5, x2: x + 13.5, y2: y + 5.5, stroke: '#FFFFFF', sw: 2 },
        ];
      });
    },
  });

  register({
    type: 'radio',
    name: 'ラジオボタン',
    category: '入力',
    size: { w: 240, h: 32 },
    props: [
      { key: 'options', label: '選択肢（カンマ区切り）', type: 'text', default: '個人,法人' },
      { key: 'selected', label: '選択中の番号', type: 'number', default: 1, min: 0 },
      { key: 'direction', label: '並び', type: 'select', default: 'horizontal', options: [['horizontal', '横'], ['vertical', '縦']] },
      { key: 'color', label: '色', type: 'color', default: '' },
    ],
    draw(p, w, h, ctx) {
      const C = ctx.C;
      const c = ctx.color(p.color);
      return choices(p, w, h, ctx, (x, y, i) => (i + 1 === Number(p.selected)
        ? [{ t: 'ellipse', x, y, w: 18, h: 18, fill: C.paper, stroke: c, sw: 1.5 }, { t: 'ellipse', x: x + 4.5, y: y + 4.5, w: 9, h: 9, fill: c }]
        : [{ t: 'ellipse', x, y, w: 18, h: 18, fill: C.paper, stroke: C.faint, sw: 1.5 }]));
    },
  });

  register({
    type: 'toggle',
    name: 'トグルスイッチ',
    category: '入力',
    size: { w: 200, h: 32 },
    props: [
      { key: 'label', label: 'ラベル', type: 'text', default: '通知を受け取る' },
      { key: 'on', label: 'オン', type: 'bool', default: true },
      { key: 'color', label: '色', type: 'color', default: '' },
    ],
    draw(p, w, h, ctx) {
      const C = ctx.C;
      const c = ctx.color(p.color);
      const y = h / 2 - 11;
      return [
        { t: 'rect', x: 0, y, w: 40, h: 22, r: 11, fill: p.on ? c : C.line },
        { t: 'ellipse', x: p.on ? 20 : 2, y: y + 2, w: 18, h: 18, fill: '#FFFFFF' },
        { t: 'text', x: 52, y: 0, w: w - 52, h, text: p.label, size: 14, color: C.ink, fit: 'ellipsis' },
      ];
    },
  });
})();
