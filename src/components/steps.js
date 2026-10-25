/* ステップ表示（README の「部品の増やし方」の例と同じもの） */
(function () {
  'use strict';
  window.GamenUI.register({
    type: 'steps',                 // 英数字の識別子（他と重ならないもの）
    name: 'ステップ表示',           // パレットに出る名前
    category: '表示',               // パレットの分類（新しい名前にすると分類が増える）
    size: { w: 480, h: 56 },        // 置いたときの大きさ
    props: [                        // 右側の設定欄
      { key: 'steps', label: 'ステップ（カンマ区切り）', type: 'text', default: '入力,確認,完了' },
      { key: 'current', label: '現在の番号', type: 'number', default: 1, min: 1 },
      { key: 'color', label: '色', type: 'color', default: '' },   // '' はテーマ色
    ],
    draw(p, w, h, ctx) {            // 基本図形の配列を返す
      const c = ctx.color(p.color);
      const steps = ctx.list(p.steps);
      const step = w / steps.length;
      const out = [];
      steps.forEach((s, i) => {
        const done = i + 1 <= Number(p.current);
        const cx = step * i + step / 2;
        if (i > 0) out.push({ t: 'line', x1: cx - step + 16, y1: 14, x2: cx - 16, y2: 14, stroke: ctx.C.line, sw: 2 });
        out.push({ t: 'ellipse', x: cx - 14, y: 0, w: 28, h: 28, fill: done ? c : ctx.C.paper, stroke: done ? null : ctx.C.line });
        out.push({ t: 'text', x: cx - 14, y: 0, w: 28, h: 28, text: String(i + 1), size: 13, bold: true, color: done ? '#FFFFFF' : ctx.C.sub, align: 'center' });
        out.push({ t: 'text', x: cx - step / 2, y: 32, w: step, h: 24, text: s, size: 13, color: ctx.C.ink, align: 'center' });
      });
      return out;
    },
  });
})();
