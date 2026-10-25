/*
 * 部品レジストリ
 * ------------------------------------------------------------
 * 部品は GamenUI.register({...}) で登録する。1つの定義から
 *   - エディタ上の表示（SVG）
 *   - PowerPoint 出力（図形・表）
 *   - パレットのサムネイル
 *   - プロパティ欄の入力項目
 * がすべて生成される。部品を増やすときは components/ にファイルを足し、
 * index.html に <script> を1行追加するだけでよい。
 *
 * 定義の形:
 * {
 *   type: 'button',            // 一意な識別子（英数字）
 *   name: 'ボタン',             // パレットに出る名前
 *   category: '入力',           // パレットの分類
 *   size: { w: 120, h: 40 },   // 配置したときの初期サイズ(px)
 *   props: [                   // プロパティ欄の項目
 *     { key: 'label', label: '表示文字', type: 'text', default: '登録' },
 *   ],
 *   draw(p, w, h, ctx) { return [ ...プリミティブ ]; }
 * }
 *
 * props の type: text / textarea / number / color / select / bool
 *   select は options: [['値','表示名'], ...]
 *   color は '' を「テーマ色」として扱う（ctx.color() で解決）
 *
 * プリミティブ（座標は部品の左上を原点とした px）:
 *   { t:'rect',    x,y,w,h, fill, stroke, sw, r, dash }
 *   { t:'ellipse', x,y,w,h, fill, stroke, sw, dash }
 *   { t:'line',    x1,y1,x2,y2, stroke, sw, dash }
 *   { t:'tri',     x,y,w,h, fill, dir:'up'|'down'|'left'|'right' }
 *   { t:'text',    x,y,w,h, text, size, color, bold, align:'left'|'center'|'right', valign:'top'|'middle'|'bottom' }
 *                  fit:'wrap'（折り返し＋収まらない分は…）|'ellipsis'（1行ごとに…）  … 省略時ははみ出す
 *   { t:'text',    x,y,w,h, runs:[{ text, size, bold, color }], align, valign }   … 1行の中で大きさや色を変える
 *   { t:'table',   x,y,w,h, columns:[...], rows:[[...]], colRatios, size,
 *                  headerFill, headerColor, border, stripe, align:[...] }
 */
(function () {
  'use strict';

  const defs = new Map();
  const order = [];

  const PROP_TYPES = ['text', 'textarea', 'number', 'color', 'select', 'bool'];

  function register(def) {
    const where = def && def.type ? `部品「${def.type}」` : '部品';
    if (!def || !/^[a-zA-Z][\w-]*$/.test(def.type || '')) throw new Error(`${where}: type は英数字で指定してください`);
    if (defs.has(def.type)) throw new Error(`${where}: 同じ type がすでに登録されています`);
    if (typeof def.draw !== 'function') throw new Error(`${where}: draw(p, w, h, ctx) が必要です`);
    def.name = def.name || def.type;
    def.category = def.category || 'その他';
    def.size = def.size || { w: 160, h: 40 };
    def.props = (def.props || []).map((p) => {
      if (!PROP_TYPES.includes(p.type)) throw new Error(`${where}: プロパティ「${p.key}」の type「${p.type}」は未対応です`);
      return { label: p.key, ...p };
    });
    defs.set(def.type, def);
    order.push(def.type);
  }

  function defaults(type) {
    const def = defs.get(type);
    const out = {};
    if (def) def.props.forEach((p) => { out[p.key] = p.default !== undefined ? p.default : ''; });
    return out;
  }

  function categories() {
    const seen = [];
    order.forEach((t) => { const c = defs.get(t).category; if (!seen.includes(c)) seen.push(c); });
    return seen;
  }

  window.GamenUI = {
    register,
    get: (type) => defs.get(type),
    all: () => order.map((t) => defs.get(t)),
    defaults,
    categories,
  };
})();
