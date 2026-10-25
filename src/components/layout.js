/* レイアウト系の部品：ヘッダー、サイドメニュー、グループ枠、ダイアログ、区切り線 */
(function () {
  'use strict';
  const { register } = window.GamenUI;

  register({
    type: 'header',
    name: 'ヘッダー',
    category: 'レイアウト',
    size: { w: 1280, h: 56 },
    props: [
      { key: 'title', label: 'システム名', type: 'text', default: '顧客管理システム' },
      { key: 'user', label: 'ログインユーザー', type: 'text', default: '営業部　山田 太郎' },
      { key: 'logout', label: 'ログアウトボタン', type: 'bool', default: true },
      { key: 'color', label: '背景色', type: 'color', default: '' },
    ],
    draw(p, w, h, ctx) {
      const bg = ctx.color(p.color);
      const fg = ctx.onColor(bg);
      const out = [{ t: 'rect', x: 0, y: 0, w, h, fill: bg }];
      const mark = Math.min(30, h - 16);
      out.push({ t: 'rect', x: 20, y: (h - mark) / 2, w: mark, h: mark, r: 6, fill: fg === '#FFFFFF' ? ctx.tint(bg, 0.2) : ctx.shade(bg, 0.12) });
      out.push({ t: 'text', x: 20, y: (h - mark) / 2, w: mark, h: mark, text: String(p.title || ' ').trim().charAt(0), size: 15, bold: true, color: fg, align: 'center' });
      out.push({ t: 'text', x: 20 + mark + 12, y: 0, w: w / 2, h, text: p.title, size: 18, bold: true, color: fg, fit: 'ellipsis' });
      let right = w - 20;
      if (p.logout) {
        out.push({ t: 'rect', x: right - 96, y: (h - 32) / 2, w: 96, h: 32, r: 4, stroke: fg, sw: 1 });
        out.push({ t: 'text', x: right - 96, y: (h - 32) / 2, w: 96, h: 32, text: 'ログアウト', size: 13, color: fg, align: 'center' });
        right -= 96 + 20;
      }
      if (p.user) out.push({ t: 'text', x: right - 360, y: 0, w: 360, h, text: p.user, size: 13, color: fg, align: 'right', fit: 'ellipsis' });
      return out;
    },
  });

  register({
    type: 'sidemenu',
    name: 'サイドメニュー',
    category: 'レイアウト',
    size: { w: 220, h: 664 },
    props: [
      { key: 'items', label: 'メニュー（1行に1つ）', type: 'textarea', default: 'ホーム\n顧客検索\n顧客登録\n口座照会\n取引履歴\n帳票出力\n設定' },
      { key: 'active', label: '選択中の番号', type: 'number', default: 2, min: 0 },
      { key: 'color', label: '強調色', type: 'color', default: '' },
    ],
    draw(p, w, h, ctx) {
      const C = ctx.C;
      const c = ctx.color(p.color);
      const out = [{ t: 'rect', x: 0, y: 0, w, h, fill: C.softer }, { t: 'line', x1: w, y1: 0, x2: w, y2: h, stroke: C.lineSoft }];
      ctx.lines(p.items).forEach((it, i) => {
        const y = 12 + i * 44;
        const on = i + 1 === Number(p.active);
        if (on) {
          out.push({ t: 'rect', x: 8, y, w: w - 16, h: 40, r: 6, fill: ctx.tint(c, 0.86) });
          out.push({ t: 'rect', x: 8, y: y + 8, w: 4, h: 24, r: 2, fill: c });
        }
        out.push({ t: 'text', x: 28, y, w: w - 40, h: 40, text: it, size: 14, bold: on, color: on ? ctx.shade(c, 0.15) : '#334155', fit: 'ellipsis' });
      });
      return out;
    },
  });

  register({
    type: 'panel',
    name: 'グループ枠',
    category: 'レイアウト',
    size: { w: 560, h: 240 },
    props: [
      { key: 'title', label: '見出し', type: 'text', default: '検索条件' },
      { key: 'fill', label: '背景色', type: 'color', default: '#FFFFFF' },
    ],
    draw(p, w, h, ctx) {
      const C = ctx.C;
      const out = [{ t: 'rect', x: 0, y: 0, w, h, r: 6, fill: p.fill || C.paper, stroke: C.line }];
      if (p.title) {
        out.push({ t: 'rect', x: 1, y: 1, w: w - 2, h: 40, r: 5, fill: C.softer });
        out.push({ t: 'rect', x: 1, y: 20, w: w - 2, h: 21, fill: C.softer });
        out.push({ t: 'line', x1: 0, y1: 41, x2: w, y2: 41, stroke: C.line });
        out.push({ t: 'text', x: 16, y: 1, w: w - 32, h: 40, text: p.title, size: 15, bold: true, color: C.ink, fit: 'ellipsis' });
      }
      return out;
    },
  });

  register({
    type: 'dialog',
    name: 'ダイアログ',
    category: 'レイアウト',
    size: { w: 440, h: 220 },
    props: [
      { key: 'title', label: 'タイトル', type: 'text', default: '登録の確認' },
      { key: 'message', label: 'メッセージ', type: 'textarea', default: '入力した内容で顧客情報を登録します。\nよろしいですか？' },
      { key: 'buttons', label: 'ボタン（カンマ区切り）', type: 'text', default: 'キャンセル,登録する' },
      { key: 'color', label: '強調色', type: 'color', default: '' },
    ],
    draw(p, w, h, ctx) {
      const C = ctx.C;
      const c = ctx.color(p.color);
      const out = [
        { t: 'rect', x: 4, y: 6, w, h, r: 8, fill: '#D5DCE5' },
        { t: 'rect', x: 0, y: 0, w, h, r: 8, fill: C.paper, stroke: C.line },
        { t: 'text', x: 24, y: 0, w: w - 72, h: 52, text: p.title, size: 16, bold: true, color: C.ink, fit: 'ellipsis' },
        { t: 'line', x1: w - 38, y1: 20, x2: w - 26, y2: 32, stroke: C.sub, sw: 1.5 },
        { t: 'line', x1: w - 26, y1: 20, x2: w - 38, y2: 32, stroke: C.sub, sw: 1.5 },
        { t: 'line', x1: 0, y1: 52, x2: w, y2: 52, stroke: C.lineSoft },
        { t: 'text', x: 24, y: 68, w: w - 48, h: h - 140, text: p.message, size: 14, color: C.ink, valign: 'top', fit: 'wrap' },
        { t: 'line', x1: 0, y1: h - 64, x2: w, y2: h - 64, stroke: C.lineSoft },
      ];
      const btns = ctx.list(p.buttons);
      let x = w - 20;
      btns.slice().reverse().forEach((b, ri) => {
        const bw = Math.max(96, ctx.measure(b, 14, true) + 36);
        x -= bw;
        const main = ri === 0;
        out.push({ t: 'rect', x, y: h - 50, w: bw, h: 36, r: 6, fill: main ? c : C.paper, stroke: main ? null : C.line });
        out.push({ t: 'text', x, y: h - 50, w: bw, h: 36, text: b, size: 14, bold: main, color: main ? ctx.onColor(c) : C.ink, align: 'center' });
        x -= 12;
      });
      return out;
    },
  });

  register({
    type: 'divider',
    name: '区切り線',
    category: 'レイアウト',
    size: { w: 400, h: 16 },
    props: [
      { key: 'color', label: '色', type: 'color', default: '#CBD5E1' },
      { key: 'width', label: '太さ', type: 'number', default: 1, min: 0.5, max: 8, step: 0.5 },
      { key: 'dash', label: '破線', type: 'bool', default: false },
    ],
    draw(p, w, h, ctx) {
      const s = { stroke: p.color || ctx.C.line, sw: Number(p.width) || 1, dash: p.dash };
      return h > w ? [{ t: 'line', x1: w / 2, y1: 0, x2: w / 2, y2: h, ...s }] : [{ t: 'line', x1: 0, y1: h / 2, x2: w, y2: h / 2, ...s }];
    },
  });
})();
