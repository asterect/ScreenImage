/* 表示系の部品：見出し、テキスト、表、タブ、パンくず、ページ送り、ステータス、メッセージ、数値カード、画像 */
(function () {
  'use strict';
  const { register } = window.GamenUI;

  register({
    type: 'heading',
    name: '見出し',
    category: '表示',
    size: { w: 480, h: 40 },
    props: [
      { key: 'text', label: '文字', type: 'text', default: '顧客検索' },
      { key: 'size', label: '文字サイズ(px)', type: 'number', default: 22, min: 8, max: 72 },
      { key: 'style', label: '装飾', type: 'select', default: 'bar', options: [['bar', '左に色帯'], ['underline', '下線'], ['none', 'なし']] },
      { key: 'color', label: '装飾の色', type: 'color', default: '' },
    ],
    draw(p, w, h, ctx) {
      const c = ctx.color(p.color);
      const size = Number(p.size) || 22;
      const out = [];
      let x = 0;
      if (p.style === 'bar') { out.push({ t: 'rect', x: 0, y: (h - size * 1.2) / 2, w: 5, h: size * 1.2, r: 2, fill: c }); x = 16; }
      out.push({ t: 'text', x, y: 0, w: w - x, h, text: p.text, size, bold: true, color: ctx.C.ink, fit: 'ellipsis' });
      if (p.style === 'underline') out.push({ t: 'line', x1: 0, y1: h - 1, x2: w, y2: h - 1, stroke: c, sw: 2 });
      return out;
    },
  });

  register({
    type: 'text',
    name: 'テキスト',
    category: '表示',
    size: { w: 320, h: 28 },
    props: [
      { key: 'text', label: '文字', type: 'textarea', default: '検索条件を入力して「検索」を押してください。' },
      { key: 'size', label: '文字サイズ(px)', type: 'number', default: 14, min: 8, max: 72 },
      { key: 'bold', label: '太字', type: 'bool', default: false },
      { key: 'align', label: '横位置', type: 'select', default: 'left', options: [['left', '左'], ['center', '中央'], ['right', '右']] },
      { key: 'valign', label: '縦位置', type: 'select', default: 'middle', options: [['top', '上'], ['middle', '中央'], ['bottom', '下']] },
      { key: 'fit', label: '枠に収まらないとき', type: 'select', default: 'wrap', options: [['wrap', '折り返して、残りは「…」'], ['ellipsis', '折り返さずに「…」'], ['none', 'そのまま（はみ出す）']] },
      { key: 'color', label: '文字色', type: 'color', default: '#1F2937' },
    ],
    draw(p, w, h, ctx) {
      return [{ t: 'text', x: 0, y: 0, w, h, text: p.text, size: Number(p.size) || 14, bold: p.bold, color: p.color || ctx.C.ink, align: p.align, valign: p.valign, fit: p.fit === 'none' ? null : (p.fit || 'wrap') }];
    },
  });

  register({
    type: 'table',
    name: '表',
    category: '表示',
    size: { w: 800, h: 252 },
    props: [
      { key: 'columns', label: '列見出し（カンマ区切り）', type: 'text', default: '顧客番号,氏名,店舗,口座種別,残高' },
      { key: 'rows', label: 'データ（1行に1件、カンマ区切り）', type: 'textarea',
        default: '0012345,山田 太郎,本店営業部,普通預金,1,250,000\n0012388,佐藤 花子,駅前支店,定期預金,3,000,000\n0013021,鈴木 一郎,本店営業部,普通預金,84,320\n0013457,高橋 美咲,北町支店,当座預金,12,600,000\n0014002,田中 健,駅前支店,普通預金,507,000\n0014519,伊藤 由美,本店営業部,定期預金,2,000,000' },
      { key: 'widths', label: '列幅の比率（例：2,3,2,2,2）', type: 'text', default: '2,2.4,2.4,2,2.2' },
      { key: 'header', label: '見出し行の色', type: 'select', default: 'soft', options: [['soft', '淡い色'], ['solid', '濃い色'], ['gray', '灰色']] },
      { key: 'stripe', label: '1行おきに色を付ける', type: 'bool', default: true },
      { key: 'size', label: '文字サイズ(px)', type: 'number', default: 13, min: 8, max: 32 },
      { key: 'color', label: '色', type: 'color', default: '' },
    ],
    draw(p, w, h, ctx) {
      const c = ctx.color(p.color);
      const columns = ctx.list(p.columns);
      // Excel からの貼り付け（タブ区切り）にも対応。
      // カンマ区切りで「1,250,000」のように列数より多くなった場合は、余りを最後の列にまとめる。
      const rows = String(p.rows || '').split(/\r?\n/).filter((l) => l.trim() !== '').map((line) => {
        if (line.includes('\t')) return line.split('\t').map((s) => s.trim());
        const cells = line.split(/[,、，]/).map((s) => s.trim());
        if (cells.length > columns.length && columns.length > 0) {
          const head = cells.slice(0, columns.length - 1);
          return [...head, cells.slice(columns.length - 1).join(',')];
        }
        return cells;
      });
      const header = {
        soft: { fill: ctx.tint(c, 0.88), color: ctx.shade(c, 0.35) },
        solid: { fill: c, color: ctx.onColor(c) },
        gray: { fill: ctx.C.soft, color: ctx.C.ink },
      }[p.header] || { fill: ctx.C.soft, color: ctx.C.ink };
      return [{
        t: 'table', x: 0, y: 0, w, h, columns: columns.length ? columns : [' '], rows,
        colRatios: ctx.list(p.widths), size: Number(p.size) || 13,
        headerFill: header.fill, headerColor: header.color, stripe: p.stripe,
      }];
    },
  });

  register({
    type: 'tabs',
    name: 'タブ',
    category: '表示',
    size: { w: 640, h: 44 },
    props: [
      { key: 'tabs', label: 'タブ（カンマ区切り）', type: 'text', default: '基本情報,口座情報,取引履歴,対応メモ' },
      { key: 'active', label: '選択中の番号', type: 'number', default: 1, min: 0 },
      { key: 'color', label: '色', type: 'color', default: '' },
    ],
    draw(p, w, h, ctx) {
      const C = ctx.C;
      const c = ctx.color(p.color);
      const out = [{ t: 'line', x1: 0, y1: h - 1, x2: w, y2: h - 1, stroke: C.line }];
      let x = 0;
      ctx.list(p.tabs).forEach((t, i) => {
        const on = i + 1 === Number(p.active);
        const tw = ctx.measure(t, 14, true) + 40;
        out.push({ t: 'text', x, y: 0, w: tw, h: h - 3, text: t, size: 14, bold: on, color: on ? c : C.sub, align: 'center' });
        if (on) out.push({ t: 'rect', x, y: h - 3, w: tw, h: 3, fill: c });
        x += tw;
      });
      return out;
    },
  });

  register({
    type: 'breadcrumb',
    name: 'パンくずリスト',
    category: '表示',
    size: { w: 480, h: 24 },
    props: [
      { key: 'items', label: '階層（カンマ区切り）', type: 'text', default: 'ホーム,顧客管理,顧客検索' },
      { key: 'color', label: 'リンク色', type: 'color', default: '' },
    ],
    draw(p, w, h, ctx) {
      const C = ctx.C;
      const c = ctx.color(p.color);
      const items = ctx.list(p.items);
      const out = [];
      let x = 0;
      items.forEach((it, i) => {
        const last = i === items.length - 1;
        const tw = ctx.measure(it, 13, last);
        out.push({ t: 'text', x, y: 0, w: tw + 2, h, text: it, size: 13, bold: last, color: last ? C.ink : c });
        x += tw + 10;
        if (!last) {
          out.push({ t: 'line', x1: x, y1: h / 2 - 4, x2: x + 4, y2: h / 2, stroke: C.faint, sw: 1.4 });
          out.push({ t: 'line', x1: x + 4, y1: h / 2, x2: x, y2: h / 2 + 4, stroke: C.faint, sw: 1.4 });
          x += 16;
        }
      });
      return out;
    },
  });

  register({
    type: 'pagination',
    name: 'ページ送り',
    category: '表示',
    size: { w: 360, h: 32 },
    props: [
      { key: 'total', label: '総件数の表示', type: 'text', default: '全 128 件' },
      { key: 'pages', label: 'ページ数', type: 'number', default: 5, min: 1, max: 9 },
      { key: 'current', label: '現在のページ', type: 'number', default: 1, min: 1 },
      { key: 'color', label: '色', type: 'color', default: '' },
    ],
    draw(p, w, h, ctx) {
      const C = ctx.C;
      const c = ctx.color(p.color);
      const out = [];
      const s = Math.min(h, 32);
      const y = (h - s) / 2;
      const n = Math.max(1, Math.min(9, Number(p.pages) || 1));
      const labels = ['‹', ...Array.from({ length: n }, (_, i) => String(i + 1)), '›'];
      let x = w - labels.length * (s + 6) + 6;
      if (p.total) out.push({ t: 'text', x: 0, y: 0, w: Math.max(0, x - 12), h, text: p.total, size: 13, color: C.sub, fit: 'ellipsis' });
      labels.forEach((l) => {
        const on = l === String(p.current);
        out.push({ t: 'rect', x, y, w: s, h: s, r: 6, fill: on ? c : C.paper, stroke: on ? null : C.line });
        out.push({ t: 'text', x, y, w: s, h: s, text: l, size: 13, bold: on, color: on ? ctx.onColor(c) : C.ink, align: 'center' });
        x += s + 6;
      });
      return out;
    },
  });

  const TONES = {
    success: { label: '成功（緑）', fg: '#15803D', bg: '#DCFCE7', bd: '#86EFAC' },
    info: { label: '情報（青）', fg: '#1D4ED8', bg: '#DBEAFE', bd: '#93C5FD' },
    warning: { label: '注意（黄）', fg: '#B45309', bg: '#FEF3C7', bd: '#FCD34D' },
    danger: { label: 'エラー（赤）', fg: '#B91C1C', bg: '#FEE2E2', bd: '#FCA5A5' },
    neutral: { label: '中立（灰）', fg: '#475569', bg: '#F1F5F9', bd: '#CBD5E1' },
  };
  const TONE_OPTIONS = Object.keys(TONES).map((k) => [k, TONES[k].label]);

  register({
    type: 'badge',
    name: 'ステータス',
    category: '表示',
    size: { w: 80, h: 26 },
    props: [
      { key: 'text', label: '文字', type: 'text', default: '承認済' },
      { key: 'tone', label: '種類', type: 'select', default: 'success', options: TONE_OPTIONS },
    ],
    draw(p, w, h) {
      const t = TONES[p.tone] || TONES.neutral;
      return [{ t: 'rect', x: 0, y: 0, w, h, r: h / 2, fill: t.bg }, { t: 'text', x: 0, y: 0, w, h, text: p.text, size: 12, bold: true, color: t.fg, align: 'center', fit: 'ellipsis' }];
    },
  });

  register({
    type: 'alert',
    name: 'メッセージ',
    category: '表示',
    size: { w: 640, h: 48 },
    props: [
      { key: 'text', label: '文字', type: 'textarea', default: '顧客番号は7桁の数字で入力してください。' },
      { key: 'tone', label: '種類', type: 'select', default: 'danger', options: TONE_OPTIONS },
    ],
    draw(p, w, h) {
      const t = TONES[p.tone] || TONES.info;
      const mark = { success: '✓', info: 'i', warning: '!', danger: '!', neutral: 'i' }[p.tone] || 'i';
      return [
        { t: 'rect', x: 0, y: 0, w, h, r: 6, fill: t.bg, stroke: t.bd },
        { t: 'ellipse', x: 14, y: h / 2 - 10, w: 20, h: 20, fill: t.fg },
        { t: 'text', x: 14, y: h / 2 - 10, w: 20, h: 20, text: mark, size: 13, bold: true, color: '#FFFFFF', align: 'center' },
        { t: 'text', x: 46, y: 0, w: w - 60, h, text: p.text, size: 14, color: t.fg, fit: 'wrap' },
      ];
    },
  });

  register({
    type: 'stat',
    name: '数値カード',
    category: '表示',
    size: { w: 240, h: 104 },
    props: [
      { key: 'label', label: '項目名', type: 'text', default: '本日の受付件数' },
      { key: 'value', label: '数値', type: 'text', default: '1,284' },
      { key: 'unit', label: '単位', type: 'text', default: '件' },
      { key: 'note', label: '補足', type: 'text', default: '前日比 +12.4%' },
      { key: 'color', label: '色', type: 'color', default: '' },
    ],
    draw(p, w, h, ctx) {
      const C = ctx.C;
      const c = ctx.color(p.color);
      return [
        { t: 'rect', x: 0, y: 0, w, h, r: 8, fill: C.paper, stroke: C.line },
        { t: 'text', x: 18, y: 14, w: w - 36, h: 20, text: p.label, size: 13, color: C.sub, fit: 'ellipsis' },
        { t: 'text', x: 18, y: 36, w: w - 36, h: 40, runs: [
          { text: p.value, size: 30, bold: true, color: C.ink },
          { text: p.unit ? ' ' + p.unit : '', size: 14, color: C.sub },
        ] },
        { t: 'text', x: 18, y: h - 30, w: w - 36, h: 18, text: p.note, size: 12, bold: true, color: c, fit: 'ellipsis' },
      ];
    },
  });

  register({
    type: 'image',
    name: '画像（仮置き）',
    category: '表示',
    size: { w: 240, h: 160 },
    props: [{ key: 'label', label: '説明', type: 'text', default: '画像' }],
    draw(p, w, h, ctx) {
      const C = ctx.C;
      return [
        { t: 'rect', x: 0, y: 0, w, h, fill: C.soft, stroke: C.line },
        { t: 'line', x1: 0, y1: 0, x2: w, y2: h, stroke: C.line },
        { t: 'line', x1: w, y1: 0, x2: 0, y2: h, stroke: C.line },
        { t: 'rect', x: w / 2 - Math.min(w - 8, 96) / 2, y: h / 2 - 14, w: Math.min(w - 8, 96), h: 28, r: 4, fill: C.paper },
        { t: 'text', x: 0, y: 0, w, h, text: p.label, size: 13, color: C.sub, align: 'center', fit: 'ellipsis' },
      ];
    },
  });
})();
