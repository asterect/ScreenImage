/*
 * エディタ本体：配置・選択・移動・リサイズ・プロパティ編集・ページ管理・保存・出力
 *
 * データの形（保存ファイルもこの形の JSON）:
 * {
 *   title, size: { w, h }, theme: { primary },
 *   pages: [ { id, name, items: [ { id, type, x, y, w, h, props } ] } ]
 * }
 * items の並び順がそのまま重なり順（後ろほど前面）。
 */
(function () {
  'use strict';

  const UI = window.GamenUI;
  const R = window.GamenRender;
  const $ = (s, el) => (el || document).querySelector(s);

  const STORE_KEY = 'gamen-editor:v1';
  const GRID = 8;
  const SIZE_PRESETS = [
    [1280, 720, '1280 × 720（16:9）'],
    [1366, 768, '1366 × 768'],
    [1440, 900, '1440 × 900'],
    [1920, 1080, '1920 × 1080（フルHD）'],
    [1024, 768, '1024 × 768（4:3）'],
    [390, 844, '390 × 844（スマホ縦）'],
  ];
  const THEME_SWATCHES = ['#2457C5', '#1E3A8A', '#0F766E', '#15803D', '#7C3AED', '#B91C1C', '#C2410C', '#334155'];

  // inner: ダブルクリックで「中に入った」グループ。その間はグループ内の部品を1つずつ選べる
  const state = { doc: null, page: 0, sel: [], zoom: 1, snap: true, grid: true, clipboard: null, drag: null, inner: null };
  const hist = { stack: [], index: -1 };

  const el = {
    stage: $('#stage'), wrap: $('#screenWrap'), screen: $('#screen'), items: $('#items'), overlay: $('#overlay'),
    palette: $('#palette'), search: $('#paletteSearch'), inspector: $('#inspector'), pages: $('#pages'),
    status: $('#status'), toast: $('#toast'), title: $('#docTitle'), zoom: $('#btnZoomFit'),
  };

  // ---------------------------------------------------------------- ユーティリティ
  const uid = () => 'e' + Math.random().toString(36).slice(2, 10);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const page = () => state.doc.pages[state.page];
  const findItem = (id) => page().items.find((i) => i.id === id);
  const selItems = () => state.sel.map(findItem).filter(Boolean);
  const ctx = () => R.makeCtx(state.doc ? state.doc.theme : null);

  // ---------------------------------------------------------------- グループ
  // 部品の group に同じ ID を持たせたものが1グループ。クリックするとまとめて選ばれる。
  function withGroups(ids) {
    const groups = new Set(ids.map(findItem).filter((i) => i && i.group && i.group !== state.inner).map((i) => i.group));
    if (!groups.size) return ids;
    const extra = page().items.filter((i) => groups.has(i.group)).map((i) => i.id);
    return [...new Set([...ids, ...extra])];
  }
  // 選択がちょうど1つのグループ全体なら、そのグループ ID を返す
  function soleGroup() {
    const items = selItems();
    if (items.length < 2) return null;
    const g = items[0].group;
    if (!g || !items.every((i) => i.group === g)) return null;
    return page().items.filter((i) => i.group === g).length === items.length ? g : null;
  }
  // 1個だけになったグループは解除する
  function tidyGroups() {
    const count = {};
    page().items.forEach((i) => { if (i.group) count[i.group] = (count[i.group] || 0) + 1; });
    page().items.forEach((i) => { if (i.group && count[i.group] < 2) delete i.group; });
  }
  function groupSel() {
    const items = selItems();
    if (items.length < 2) return;
    const gid = 'g' + uid().slice(1);
    const ids = new Set(items.map((i) => i.id));
    items.forEach((i) => { i.group = gid; });
    // 重なり順を連続させる（一番前にある部品の位置にまとめる）
    const all = page().items;
    const top = Math.max(...all.map((i, idx) => (ids.has(i.id) ? idx : -1)));
    const before = all.slice(0, top + 1).filter((i) => !ids.has(i.id));
    const after = all.slice(top + 1);
    page().items = [...before, ...all.filter((i) => ids.has(i.id)), ...after];
    state.inner = null;
    tidyGroups();
    renderItems(); selectionChanged(); commit();
    toast(`${items.length} 個の部品をグループにしました`);
  }
  function ungroupSel() {
    const items = selItems().filter((i) => i.group);
    if (!items.length) return;
    const groups = new Set(items.map((i) => i.group));
    page().items.forEach((i) => { if (groups.has(i.group)) delete i.group; });
    state.inner = null;
    selectionChanged(); commit();
    toast('グループを解除しました');
  }
  const snapV = (v, on) => (on ? Math.round(v / GRID) * GRID : Math.round(v));
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let toastTimer = null;
  function toast(msg, isError) {
    el.toast.textContent = msg;
    el.toast.classList.toggle('error', !!isError);
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, isError ? 5000 : 2600);
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function fileBase() {
    const t = (state.doc.title || '画面イメージ').replace(/[\\/:*?"<>|]/g, '_').trim();
    return t || '画面イメージ';
  }

  // ---------------------------------------------------------------- データの整形
  // 保存ファイルを読み込んだとき、後から追加された部品プロパティにも既定値を補う
  function normalizeDoc(raw) {
    const d = raw && typeof raw === 'object' ? raw : {};
    const out = {
      title: String(d.title || '画面イメージ'),
      size: { w: Math.max(200, Number(d.size && d.size.w) || 1280), h: Math.max(200, Number(d.size && d.size.h) || 720) },
      theme: { primary: (d.theme && d.theme.primary) || '#2457C5' },
      pages: [],
    };
    const pages = Array.isArray(d.pages) && d.pages.length ? d.pages : [{ name: '画面1', items: [] }];
    out.pages = pages.map((p, pi) => ({
      id: p.id || uid(),
      name: String(p.name || `画面${pi + 1}`),
      items: (Array.isArray(p.items) ? p.items : []).map((i) => ({
        id: i.id || uid(),
        type: String(i.type || ''),
        x: Number(i.x) || 0, y: Number(i.y) || 0,
        w: Math.max(4, Number(i.w) || 40), h: Math.max(4, Number(i.h) || 20),
        props: { ...UI.defaults(i.type), ...(i.props || {}) },
        ...(i.group ? { group: String(i.group) } : {}),
      })),
    }));
    return out;
  }

  // ---------------------------------------------------------------- 履歴・保存
  function commit() {
    const snap = JSON.stringify(state.doc);
    if (hist.stack[hist.index] === snap) return;
    hist.stack = hist.stack.slice(0, hist.index + 1);
    hist.stack.push(snap);
    if (hist.stack.length > 200) hist.stack.shift();
    hist.index = hist.stack.length - 1;
    persist();
    updateToolbar();
  }
  function restore(snap) {
    state.doc = JSON.parse(snap);
    state.page = Math.min(state.page, state.doc.pages.length - 1);
    state.sel = state.sel.filter((id) => findItem(id));
    state.inner = null;
    renderAll();
    persist();
  }
  function undo() { if (hist.index > 0) { hist.index--; restore(hist.stack[hist.index]); } }
  function redo() { if (hist.index < hist.stack.length - 1) { hist.index++; restore(hist.stack[hist.index]); } }

  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ doc: state.doc, page: state.page })); } catch (e) { /* 保存できない環境では何もしない */ }
  }
  function loadStored() {
    try {
      const s = localStorage.getItem(STORE_KEY);
      if (!s) return null;
      const o = JSON.parse(s);
      return o && o.doc ? o : null;
    } catch (e) { return null; }
  }

  function setDoc(doc, pageIndex) {
    state.doc = normalizeDoc(doc);
    state.page = Math.max(0, Math.min(pageIndex || 0, state.doc.pages.length - 1));
    state.sel = [];
    hist.stack = [];
    hist.index = -1;
    commit();
    renderAll();
    zoomFit();
  }

  // ---------------------------------------------------------------- 部品パレット
  function renderPalette() {
    const q = el.search.value.trim().toLowerCase();
    const c = ctx();
    const html = UI.categories().map((cat) => {
      const defs = UI.all().filter((d) => d.category === cat && (!q || d.name.toLowerCase().includes(q) || d.type.includes(q)));
      if (!defs.length) return '';
      return `<section class="cat"><h3>${esc(cat)}</h3><div class="tiles">${defs.map((d) => {
        const w = d.size.w, h = d.size.h;
        // 横長の部品は一部だけを見せる（細くなりすぎないように）
        const vw = Math.min(w, Math.max(h * 3.2, 120));
        const vh = Math.min(h, vw * 0.9);
        const svg = R.itemSVG(d, UI.defaults(d.type), w, h, c);
        return `<div class="tile" draggable="true" data-type="${esc(d.type)}" title="${esc(d.name)}を追加">` +
          `<div class="thumb"><svg viewBox="-4 -4 ${vw + 8} ${vh + 8}" preserveAspectRatio="xMidYMid meet" style="font-family:${esc(R.FONT_STACK)}">${svg}</svg></div>` +
          `<span>${esc(d.name)}</span></div>`;
      }).join('')}</div></section>`;
    }).join('');
    el.palette.innerHTML = html || '<p class="hint" style="padding:12px 4px">該当する部品がありません。</p>';
  }

  // ---------------------------------------------------------------- 画面の描画
  function applyZoom() {
    const { w, h } = state.doc.size;
    el.screen.style.width = w + 'px';
    el.screen.style.height = h + 'px';
    el.screen.style.transform = `scale(${state.zoom})`;
    el.screen.style.setProperty('--z', state.zoom);
    el.wrap.style.width = w * state.zoom + 'px';
    el.wrap.style.height = h * state.zoom + 'px';
    el.zoom.textContent = Math.round(state.zoom * 100) + '%';
  }

  function itemHTML(item, c) {
    const def = UI.get(item.type);
    if (!def) return `<span>未登録の部品：${esc(item.type)}</span>`;
    return `<svg viewBox="0 0 ${item.w} ${item.h}" preserveAspectRatio="none">${R.itemSVG(def, item.props, item.w, item.h, c)}</svg>`;
  }

  function placeEl(node, item) {
    node.style.left = item.x + 'px';
    node.style.top = item.y + 'px';
    node.style.width = item.w + 'px';
    node.style.height = item.h + 'px';
  }

  function renderItems() {
    const c = ctx();
    el.items.innerHTML = '';
    page().items.forEach((item) => {
      const node = document.createElement('div');
      node.className = 'item' + (UI.get(item.type) ? '' : ' missing');
      node.dataset.id = item.id;
      placeEl(node, item);
      node.innerHTML = itemHTML(item, c);
      markOverflow(node);
      el.items.appendChild(node);
    });
  }

  function renderItem(item, redraw) {
    const node = el.items.querySelector(`[data-id="${item.id}"]`);
    if (!node) return;
    placeEl(node, item);
    if (redraw) { node.innerHTML = itemHTML(item, ctx()); markOverflow(node); }
  }

  // 文字が枠に収まらず省略されたときの目印（画面上だけ。出力には出ない）
  function markOverflow(node) {
    const over = !!R.itemSVG.overflow && !node.classList.contains('missing');
    node.classList.toggle('overflow', over);
    if (over) node.title = '文字が枠に収まっていません（大きさを広げると全部表示されます）';
    else node.removeAttribute('title');
    R.itemSVG.overflow = false;
  }

  function renderOverlay(extra) {
    const items = selItems();
    const bbox = (list) => {
      const x = Math.min(...list.map((i) => i.x)), y = Math.min(...list.map((i) => i.y));
      return { x, y, w: Math.max(...list.map((i) => i.x + i.w)) - x, h: Math.max(...list.map((i) => i.y + i.h)) - y };
    };
    const boxDiv = (cls, b) => `<div class="${cls}" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px"></div>`;
    let html = '';
    // 中に入っているグループの範囲（薄く）
    if (state.inner) {
      const members = page().items.filter((i) => i.group === state.inner);
      if (members.length) html += boxDiv('group-box inner', bbox(members));
    }
    // 選択中のグループは外枠で、個々の部品は細い枠で示す
    const groups = new Set(items.filter((i) => i.group && i.group !== state.inner).map((i) => i.group));
    groups.forEach((g) => { html += boxDiv('group-box', bbox(page().items.filter((i) => i.group === g))); });
    html += items.map((i) => boxDiv(i.group && i.group !== state.inner ? 'sel member' : 'sel', i)).join('');
    if (items.length === 1) {
      const i = items[0];
      const pts = { nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5] };
      html += Object.keys(pts).map((d) => `<div class="handle" data-dir="${d}" style="left:${i.x + i.w * pts[d][0]}px;top:${i.y + i.h * pts[d][1]}px"></div>`).join('');
      if (state.drag && (state.drag.mode === 'resize' || state.drag.mode === 'move')) {
        const label = state.drag.mode === 'resize' ? `${i.w} × ${i.h}` : `${i.x}, ${i.y}`;
        html += `<div class="size-tip" style="left:${i.x + i.w / 2}px;top:${i.y + i.h + 8 / state.zoom}px">${label}</div>`;
      }
    }
    if (extra) html += extra;
    el.overlay.innerHTML = html;
  }

  function renderPages() {
    el.pages.innerHTML = state.doc.pages.map((p, i) =>
      `<button class="page-tab" role="tab" aria-selected="${i === state.page}" data-index="${i}"><span class="num">${i + 1}</span>${esc(p.name)}</button>`).join('');
  }

  function updateToolbar() {
    $('#btnUndo').disabled = hist.index <= 0;
    $('#btnRedo').disabled = hist.index >= hist.stack.length - 1;
    if (state.doc) {
      el.status.textContent = `${state.doc.size.w} × ${state.doc.size.h} px ・ 部品 ${page().items.length} 個`;
      if (document.activeElement !== el.title) el.title.value = state.doc.title;
    }
  }

  function renderAll() {
    applyZoom();
    el.screen.classList.toggle('show-grid', state.grid);
    renderItems();
    renderOverlay();
    renderPages();
    renderInspector();
    updateToolbar();
  }

  function selectionChanged() {
    renderOverlay();
    renderInspector();
  }

  // ---------------------------------------------------------------- プロパティ欄
  function fieldHTML(p, value) {
    const id = `prop-${p.key}`;
    const v = value == null ? '' : value;
    switch (p.type) {
      case 'textarea':
        return `<label class="field"><span>${esc(p.label)}</span><textarea id="${id}" data-key="${p.key}" spellcheck="false" wrap="off">${esc(v)}</textarea></label>`;
      case 'number':
        return `<label class="field"><span>${esc(p.label)}</span><input type="number" id="${id}" data-key="${p.key}" value="${esc(v)}"` +
          `${p.min != null ? ` min="${p.min}"` : ''}${p.max != null ? ` max="${p.max}"` : ''}${p.step != null ? ` step="${p.step}"` : ''}></label>`;
      case 'bool':
        return `<label class="field bool"><input type="checkbox" id="${id}" data-key="${p.key}"${v ? ' checked' : ''}><span>${esc(p.label)}</span></label>`;
      case 'select':
        return `<label class="field"><span>${esc(p.label)}</span><select id="${id}" data-key="${p.key}">` +
          (p.options || []).map(([ov, ol]) => `<option value="${esc(ov)}"${String(ov) === String(v) ? ' selected' : ''}>${esc(ol)}</option>`).join('') + '</select></label>';
      case 'color': {
        const shown = v || state.doc.theme.primary;
        return `<div class="field"><span>${esc(p.label)}</span><div class="color-row">` +
          `<input type="color" id="${id}" data-key="${p.key}" data-color="1" value="${esc(toHex6(shown))}" aria-label="${esc(p.label)}">` +
          `<input type="text" id="${id}-hex" data-key="${p.key}" data-hex="1" value="${esc(v)}" placeholder="テーマ色" spellcheck="false" aria-label="${esc(p.label)}（16進）">` +
          `<button class="btn small outline" type="button" data-reset="${p.key}">既定</button></div></div>`;
      }
      default:
        return `<label class="field"><span>${esc(p.label)}</span><input type="text" id="${id}" data-key="${p.key}" value="${esc(v)}" spellcheck="false"></label>`;
    }
  }

  function toHex6(c) {
    let h = String(c || '').replace('#', '');
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    return /^[0-9a-fA-F]{6}$/.test(h) ? '#' + h.toLowerCase() : '#000000';
  }

  function geoHTML(i) {
    return `<div class="geo">${['x', 'y', 'w', 'h'].map((k) =>
      `<label>${{ x: 'X', y: 'Y', w: '幅', h: '高さ' }[k]}<input type="number" id="geo-${k}" data-geo="${k}" value="${i[k]}"></label>`).join('')}</div>`;
  }

  function renderInspector() {
    const items = selItems();
    let html = '';
    if (items.length === 1) {
      const i = items[0];
      const def = UI.get(i.type);
      const innerNote = i.group ? '<p class="hint">グループ内の部品を編集中です。Esc でグループに戻ります。</p>' : '';
      html += `<section class="insp-section"><div class="insp-kind">${esc(def ? def.category : '不明')}</div><h2>${esc(def ? def.name : i.type)}</h2>${innerNote}${geoHTML(i)}</section>`;
      if (def && def.props.length) {
        html += `<section class="insp-section" id="propFields"><h3>設定</h3>${def.props.map((p) => fieldHTML(p, i.props[p.key])).join('')}</section>`;
      }
      html += `<section class="insp-section"><h3>操作</h3><div class="actions">` +
        '<button class="btn small outline" data-act="duplicate">複製</button>' +
        '<button class="btn small outline" data-act="front">最前面へ</button>' +
        '<button class="btn small outline" data-act="back">最背面へ</button>' +
        '<button class="btn small outline danger" data-act="delete">削除</button></div></section>';
    } else if (items.length > 1) {
      const g = soleGroup();
      html += g
        ? `<section class="insp-section"><div class="insp-kind">グループ</div><h2>${items.length} 個の部品のグループ</h2>` +
          '<p class="hint">クリックでまとめて選択・移動できます。中の部品を1つだけ直すときはダブルクリックしてください。</p>' +
          '<div class="actions"><button class="btn small outline" data-act="ungroup">グループ解除（Ctrl+Shift+G）</button></div></section>'
        : `<section class="insp-section"><div class="insp-kind">複数選択</div><h2>${items.length} 個の部品</h2>` +
          '<div class="actions"><button class="btn small outline" data-act="group">グループ化（Ctrl+G）</button>' +
          (items.some((i) => i.group) ? '<button class="btn small outline" data-act="ungroup">グループ解除</button>' : '') + '</div></section>';
      html += '<section class="insp-section"><h3>整列</h3><div class="align-grid">' +
        [['left', '左'], ['hcenter', '左右中央'], ['right', '右'], ['hdist', '横に均等'], ['top', '上'], ['vcenter', '上下中央'], ['bottom', '下'], ['vdist', '縦に均等']]
          .map(([k, l]) => `<button class="btn small outline" data-align="${k}">${l}</button>`).join('') + '</div></section>';
      html += '<section class="insp-section"><h3>操作</h3><div class="actions">' +
        '<button class="btn small outline" data-act="duplicate">複製</button>' +
        '<button class="btn small outline" data-act="front">最前面へ</button>' +
        '<button class="btn small outline" data-act="back">最背面へ</button>' +
        '<button class="btn small outline danger" data-act="delete">削除</button></div></section>';
    } else {
      const d = state.doc;
      const preset = SIZE_PRESETS.find((s) => s[0] === d.size.w && s[1] === d.size.h);
      html += `<section class="insp-section"><div class="insp-kind">ページ ${state.page + 1} / ${d.pages.length}</div>` +
        `<label class="field"><span>ページ名（スライド名）</span><input type="text" id="pageName" value="${esc(page().name)}"></label>` +
        '<div class="actions"><button class="btn small outline" data-page="dup">ページを複製</button>' +
        `<button class="btn small outline danger" data-page="del"${d.pages.length < 2 ? ' disabled' : ''}>ページを削除</button></div></section>`;
      html += '<section class="insp-section"><h3>画面サイズ（全ページ共通）</h3>' +
        `<label class="field"><select id="sizePreset">${SIZE_PRESETS.map((s) => `<option value="${s[0]}x${s[1]}"${preset === s ? ' selected' : ''}>${s[2]}</option>`).join('')}` +
        `<option value="custom"${preset ? '' : ' selected'}>自由に指定</option></select></label>` +
        `<div class="geo" style="grid-template-columns:1fr 1fr"><label>幅<input type="number" id="sizeW" value="${d.size.w}" min="200"></label>` +
        `<label>高さ<input type="number" id="sizeH" value="${d.size.h}" min="200"></label></div></section>`;
      html += '<section class="insp-section"><h3>テーマ色</h3><div class="swatches">' +
        THEME_SWATCHES.map((c) => `<button class="swatch" style="background:${c}" data-theme-color="${c}" aria-label="${c}" aria-pressed="${c.toLowerCase() === d.theme.primary.toLowerCase()}"></button>`).join('') +
        `</div><div class="color-row" style="grid-template-columns:34px minmax(0,1fr)"><input type="color" id="themeColor" value="${toHex6(d.theme.primary)}" aria-label="テーマ色">` +
        `<input type="text" id="themeHex" value="${esc(d.theme.primary)}" spellcheck="false" aria-label="テーマ色（16進）" style="width:100%;border:1px solid var(--rule);border-radius:6px;padding:6px 8px;background:var(--panel)"></div>` +
        '<p class="hint">色を「既定」にした部品は、すべてこの色になります。</p></section>';
      html += '<section class="insp-section"><h3>操作のヒント</h3><dl class="keys">' +
        '<dt><kbd>Shift</kbd>+クリック</dt><dd>複数選択</dd>' +
        '<dt>空白をドラッグ</dt><dd>範囲で選択</dd>' +
        '<dt><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd></dt><dd>1px 移動（Shift で 8px）</dd>' +
        '<dt><kbd>Alt</kbd>+ドラッグ</dt><dd>吸着せずに動かす</dd>' +
        '<dt><kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>V</kbd></dt><dd>コピー / 貼り付け</dd>' +
        '<dt><kbd>Ctrl</kbd>+<kbd>D</kbd></dt><dd>複製</dd>' +
        '<dt><kbd>Ctrl</kbd>+<kbd>G</kbd></dt><dd>グループ化（Shift で解除）</dd>' +
        '<dt>ダブルクリック</dt><dd>グループ内の1つを選ぶ</dd>' +
        '<dt><kbd>Delete</kbd></dt><dd>削除</dd>' +
        '<dt><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Y</kbd></dt><dd>元に戻す / やり直す</dd>' +
        '<dt><kbd>Ctrl</kbd>+ホイール</dt><dd>拡大・縮小</dd></dl>' +
        '<p class="hint">編集内容はこのブラウザに自動で保存されます。別のPCに移すときは「保存」でファイルにしてください。</p></section>';
    }
    el.inspector.innerHTML = html;
  }

  function setProp(item, key, value) {
    const def = UI.get(item.type);
    const p = def && def.props.find((x) => x.key === key);
    if (p && p.type === 'number') {
      let n = Number(value);
      if (!Number.isFinite(n)) return;
      if (p.min != null) n = Math.max(p.min, n);
      if (p.max != null) n = Math.min(p.max, n);
      value = n;
    }
    item.props[key] = value;
    renderItem(item, true);
  }

  function onInspectorInput(e, final) {
    const t = e.target;
    const items = selItems();
    if (items.length === 1) {
      const item = items[0];
      if (t.dataset.geo) {
        const v = Math.round(Number(t.value));
        if (!Number.isFinite(v)) return;
        item[t.dataset.geo] = t.dataset.geo === 'w' || t.dataset.geo === 'h' ? Math.max(4, v) : v;
        renderItem(item, true);
        renderOverlay();
      } else if (t.dataset.key) {
        const key = t.dataset.key;
        let value;
        if (t.type === 'checkbox') value = t.checked;
        else if (t.dataset.color) { value = t.value.toUpperCase(); const hx = $(`#prop-${key}-hex`); if (hx) hx.value = value; }
        else if (t.dataset.hex) {
          value = t.value.trim();
          if (value && !/^#?[0-9a-fA-F]{6}$/.test(value)) return; // 入力途中は反映しない
          if (value && value[0] !== '#') value = '#' + value;
          const pick = $(`#prop-${key}`);
          if (pick) pick.value = toHex6(value || state.doc.theme.primary);
        } else value = t.value;
        setProp(item, key, value);
      }
      if (final) commit();
      return;
    }
    if (items.length) return;
    // ページ・資料の設定
    if (t.id === 'pageName') {
      page().name = t.value || `画面${state.page + 1}`;
      renderPages();
      if (final) commit();
    } else if (t.id === 'sizePreset' && final) {
      if (t.value !== 'custom') {
        const [w, h] = t.value.split('x').map(Number);
        state.doc.size = { w, h };
        commit(); applyZoom(); zoomFit(); renderInspector(); updateToolbar();
      }
    } else if ((t.id === 'sizeW' || t.id === 'sizeH') && final) {
      const w = Math.max(200, Math.min(4000, Number($('#sizeW').value) || 1280));
      const h = Math.max(200, Math.min(4000, Number($('#sizeH').value) || 720));
      state.doc.size = { w, h };
      commit(); applyZoom(); zoomFit(); renderInspector(); updateToolbar();
    } else if (t.id === 'themeColor' || (t.id === 'themeHex' && /^#?[0-9a-fA-F]{6}$/.test(t.value.trim()))) {
      let v = t.value.trim().toUpperCase();
      if (v[0] !== '#') v = '#' + v;
      setTheme(v, final);
    }
  }

  function setTheme(color, final) {
    state.doc.theme.primary = color;
    renderItems();
    renderPalette();
    if (final) { commit(); renderInspector(); }
    else {
      const hx = $('#themeHex'); if (hx && document.activeElement !== hx) hx.value = color;
      const pk = $('#themeColor'); if (pk && document.activeElement !== pk) pk.value = toHex6(color);
    }
  }

  // ---------------------------------------------------------------- 編集操作
  function addItem(type, x, y) {
    const def = UI.get(type);
    if (!def) return;
    const { w: sw, h: sh } = state.doc.size;
    const w = Math.min(def.size.w, sw), h = Math.min(def.size.h, sh);
    const item = {
      id: uid(), type,
      x: Math.max(0, Math.min(sw - w, snapV(x, state.snap))),
      y: Math.max(0, Math.min(sh - h, snapV(y, state.snap))),
      w, h, props: UI.defaults(type),
    };
    page().items.push(item);
    state.sel = [item.id];
    renderItems();
    selectionChanged();
    commit();
  }

  function visibleCenter() {
    const r = el.stage.getBoundingClientRect();
    const s = el.screen.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - s.left) / state.zoom, y: (r.top + r.height / 2 - s.top) / state.zoom };
  }

  function deleteSel() {
    if (!state.sel.length) return;
    page().items = page().items.filter((i) => !state.sel.includes(i.id));
    state.sel = [];
    tidyGroups();
    renderItems(); selectionChanged(); commit();
  }

  function pasteItems(src, offset) {
    const gmap = {};
    const copies = src.map((i) => {
      const c = { ...clone(i), id: uid(), x: i.x + offset, y: i.y + offset };
      if (c.group) c.group = gmap[c.group] || (gmap[c.group] = 'g' + uid().slice(1));
      return c;
    });
    state.inner = null;
    page().items.push(...copies);
    tidyGroups();
    state.sel = copies.map((c) => c.id);
    renderItems(); selectionChanged(); commit();
  }

  function reorder(toFront) {
    const items = page().items;
    const picked = items.filter((i) => state.sel.includes(i.id));
    const rest = items.filter((i) => !state.sel.includes(i.id));
    page().items = toFront ? [...rest, ...picked] : [...picked, ...rest];
    renderItems(); renderOverlay(); commit();
  }

  function align(kind) {
    const items = selItems();
    if (items.length < 2) return;
    const minX = Math.min(...items.map((i) => i.x)), maxX = Math.max(...items.map((i) => i.x + i.w));
    const minY = Math.min(...items.map((i) => i.y)), maxY = Math.max(...items.map((i) => i.y + i.h));
    const distribute = (axis) => {
      const pos = axis === 'x' ? 'x' : 'y', size = axis === 'x' ? 'w' : 'h';
      const sorted = items.slice().sort((a, b) => a[pos] - b[pos]);
      const total = sorted.reduce((a, i) => a + i[size], 0);
      const span = (axis === 'x' ? maxX - minX : maxY - minY) - total;
      const gap = span / (sorted.length - 1);
      let cur = axis === 'x' ? minX : minY;
      sorted.forEach((i) => { i[pos] = Math.round(cur); cur += i[size] + gap; });
    };
    items.forEach((i) => {
      if (kind === 'left') i.x = minX;
      if (kind === 'right') i.x = maxX - i.w;
      if (kind === 'hcenter') i.x = Math.round((minX + maxX) / 2 - i.w / 2);
      if (kind === 'top') i.y = minY;
      if (kind === 'bottom') i.y = maxY - i.h;
      if (kind === 'vcenter') i.y = Math.round((minY + maxY) / 2 - i.h / 2);
    });
    if (kind === 'hdist') distribute('x');
    if (kind === 'vdist') distribute('y');
    items.forEach((i) => renderItem(i, false));
    renderOverlay(); commit();
  }

  function nudge(dx, dy) {
    const items = selItems();
    if (!items.length) return;
    items.forEach((i) => { i.x += dx; i.y += dy; renderItem(i, false); });
    renderOverlay();
    if (items.length === 1) renderInspectorGeo(items[0]);
    clearTimeout(nudge.t);
    nudge.t = setTimeout(commit, 300);
  }

  function renderInspectorGeo(i) {
    ['x', 'y', 'w', 'h'].forEach((k) => { const inp = $(`#geo-${k}`); if (inp && document.activeElement !== inp) inp.value = i[k]; });
  }

  // ---------------------------------------------------------------- ページ
  function gotoPage(i) {
    state.page = Math.max(0, Math.min(i, state.doc.pages.length - 1));
    state.sel = [];
    state.inner = null;
    renderAll();
    persist();
  }
  function addPage(copyFrom) {
    const p = copyFrom
      ? { ...clone(copyFrom), id: uid(), name: copyFrom.name + '（コピー）', items: copyFrom.items.map((i) => ({ ...clone(i), id: uid() })) }
      : { id: uid(), name: `画面${state.doc.pages.length + 1}`, items: [] };
    state.doc.pages.splice(state.page + 1, 0, p);
    state.page += 1;
    state.sel = [];
    commit(); renderAll();
  }
  function deletePage() {
    if (state.doc.pages.length < 2) return;
    if (!window.confirm(`ページ「${page().name}」を削除しますか？`)) return;
    state.doc.pages.splice(state.page, 1);
    state.page = Math.min(state.page, state.doc.pages.length - 1);
    state.sel = [];
    commit(); renderAll();
  }

  // ---------------------------------------------------------------- ズーム
  function setZoom(z, anchor) {
    const old = state.zoom;
    const nz = Math.max(0.1, Math.min(4, z));
    if (Math.abs(nz - old) < 0.001) return;
    const st = el.stage;
    const r = st.getBoundingClientRect();
    const ax = anchor ? anchor.x - r.left : r.width / 2;
    const ay = anchor ? anchor.y - r.top : r.height / 2;
    const contentX = (st.scrollLeft + ax - el.wrap.offsetLeft) / old;
    const contentY = (st.scrollTop + ay - el.wrap.offsetTop) / old;
    state.zoom = nz;
    applyZoom();
    st.scrollLeft = contentX * nz + el.wrap.offsetLeft - ax;
    st.scrollTop = contentY * nz + el.wrap.offsetTop - ay;
  }
  function zoomFit() {
    const st = el.stage;
    const margin = window.innerWidth < 900 ? 32 : 80;
    const z = Math.min((st.clientWidth - margin) / state.doc.size.w, (st.clientHeight - margin) / state.doc.size.h);
    state.zoom = Math.max(0.1, Math.min(2, Math.floor(z * 100) / 100));
    applyZoom();
    st.scrollLeft = 0; st.scrollTop = 0;
  }

  // ---------------------------------------------------------------- 出力
  function pageSVG(p) {
    const c = ctx();
    const { w, h } = state.doc.size;
    const body = p.items.map((i) => {
      const def = UI.get(i.type);
      if (!def) return '';
      return `<svg x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}" viewBox="0 0 ${i.w} ${i.h}" overflow="visible">${R.itemSVG(def, i.props, i.w, i.h, c)}</svg>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<rect width="${w}" height="${h}" fill="#FFFFFF"/><g font-family="${esc(R.FONT_STACK)}">${body}</g></svg>`;
  }

  function pagePNG(scale) {
    return new Promise((resolve, reject) => {
      const { w, h } = state.doc.size;
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = Math.round(w * scale);
        cv.height = Math.round(h * scale);
        const g = cv.getContext('2d');
        g.scale(scale, scale);
        g.drawImage(img, 0, 0, w, h);
        cv.toBlob((b) => (b ? resolve(b) : reject(new Error('画像を作れませんでした'))), 'image/png');
      };
      img.onerror = () => reject(new Error('画像を作れませんでした'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pageSVG(page()));
    });
  }

  async function exportPNG() {
    try {
      const blob = await pagePNG(2);
      download(blob, `${fileBase()}_${page().name}.png`);
      toast('PNG を書き出しました');
    } catch (e) { toast(e.message, true); }
  }

  async function copyImage() {
    try {
      if (!navigator.clipboard || !window.ClipboardItem) throw new Error('このブラウザは画像のコピーに対応していません。PNG で書き出してください');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pagePNG(2) })]);
      toast(`「${page().name}」を画像としてコピーしました。Excel に貼り付けできます`);
    } catch (e) {
      toast(e && e.message && /対応/.test(e.message) ? e.message : '画像をコピーできませんでした。PNG で書き出してください', true);
    }
  }

  function exportPPTX() {
    try {
      const blob = window.GamenPptx.build(state.doc);
      download(blob, `${fileBase()}.pptx`);
      toast(`PowerPoint を書き出しました（${state.doc.pages.length} スライド）`);
    } catch (e) {
      console.error(e);
      toast('PowerPoint を書き出せませんでした：' + e.message, true);
    }
  }

  function saveJSON() {
    const blob = new Blob([JSON.stringify({ app: 'gamen-editor', version: 1, ...state.doc }, null, 2)], { type: 'application/json' });
    download(blob, `${fileBase()}.json`);
    toast('編集データを保存しました');
  }

  function openJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || !Array.isArray(data.pages)) throw new Error();
        setDoc(data, 0);
        toast(`「${state.doc.title}」を開きました`);
      } catch (e) {
        toast('このファイルは読み込めません。「保存」で作ったファイルを選んでください', true);
      }
    };
    reader.readAsText(file);
  }

  // ---------------------------------------------------------------- マウス操作
  function screenPoint(e) {
    const r = el.screen.getBoundingClientRect();
    return { x: (e.clientX - r.left) / state.zoom, y: (e.clientY - r.top) / state.zoom };
  }

  el.screen.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    // 入力中のプロパティ欄を確定させてから操作する
    if (document.activeElement && document.activeElement !== document.body && el.inspector.contains(document.activeElement)) document.activeElement.blur();
    const pt = screenPoint(e);
    const handle = e.target.closest('.handle');
    const node = e.target.closest('.item');
    if (handle) {
      const i = selItems()[0];
      state.drag = { mode: 'resize', dir: handle.dataset.dir, start: pt, orig: { x: i.x, y: i.y, w: i.w, h: i.h }, id: i.id, moved: false };
    } else if (node) {
      const id = node.dataset.id;
      const it = findItem(id);
      if (state.inner && (!it || it.group !== state.inner)) state.inner = null;
      const unit = withGroups([id]);
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        const had = unit.every((u) => state.sel.includes(u));
        state.sel = had ? state.sel.filter((s) => !unit.includes(s)) : [...new Set([...state.sel, ...unit])];
        selectionChanged();
        if (had) return;
      } else if (!state.sel.includes(id)) {
        state.sel = unit;
        selectionChanged();
      }
      state.drag = { mode: 'move', start: pt, orig: selItems().map((i) => ({ id: i.id, x: i.x, y: i.y })), moved: false };
    } else {
      if (!e.shiftKey) { state.sel = []; state.inner = null; selectionChanged(); }
      state.drag = { mode: 'marquee', start: pt, base: e.shiftKey ? state.sel.slice() : [], moved: false };
    }
    el.screen.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  el.screen.addEventListener('pointermove', (e) => {
    const d = state.drag;
    if (!d) return;
    const pt = screenPoint(e);
    const dx = pt.x - d.start.x, dy = pt.y - d.start.y;
    if (!d.moved && Math.abs(dx) < 2 / state.zoom && Math.abs(dy) < 2 / state.zoom) return;
    d.moved = true;
    const snap = state.snap && !e.altKey;
    if (d.mode === 'move') {
      const first = d.orig[0];
      const sdx = snapV(first.x + dx, snap) - first.x;
      const sdy = snapV(first.y + dy, snap) - first.y;
      d.orig.forEach((o) => { const i = findItem(o.id); i.x = o.x + sdx; i.y = o.y + sdy; renderItem(i, false); });
      renderOverlay();
      if (d.orig.length === 1) renderInspectorGeo(findItem(d.orig[0].id));
    } else if (d.mode === 'resize') {
      const i = findItem(d.id);
      const o = d.orig;
      let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
      if (d.dir.includes('w')) x1 = Math.min(snapV(o.x + dx, snap), x2 - 4);
      if (d.dir.includes('e')) x2 = Math.max(snapV(o.x + o.w + dx, snap), x1 + 4);
      if (d.dir.includes('n')) y1 = Math.min(snapV(o.y + dy, snap), y2 - 4);
      if (d.dir.includes('s')) y2 = Math.max(snapV(o.y + o.h + dy, snap), y1 + 4);
      Object.assign(i, { x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
      renderItem(i, true);
      renderOverlay();
      renderInspectorGeo(i);
    } else if (d.mode === 'marquee') {
      const x = Math.min(d.start.x, pt.x), y = Math.min(d.start.y, pt.y);
      const w = Math.abs(dx), h = Math.abs(dy);
      const hit = page().items.filter((i) => i.x < x + w && i.x + i.w > x && i.y < y + h && i.y + i.h > y).map((i) => i.id);
      state.sel = withGroups([...new Set([...d.base, ...hit])]);
      renderOverlay(`<div class="marquee" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
    }
  });

  function endDrag() {
    const d = state.drag;
    if (!d) return;
    state.drag = null;
    renderOverlay();
    if (d.mode === 'marquee') renderInspector();
    else if (d.moved) { commit(); renderInspector(); }
  }
  el.screen.addEventListener('pointerup', endDrag);
  // ダブルクリック：グループの中に入り、1つだけ選ぶ
  el.screen.addEventListener('dblclick', (e) => {
    // ドラッグ用にポインターを捕まえているので、イベントの対象ではなく座標から部品を探す
    const node = document.elementsFromPoint(e.clientX, e.clientY).find((n) => n.classList && n.classList.contains('item'));
    const it = node && findItem(node.dataset.id);
    if (!it || !it.group) return;
    state.inner = it.group;
    state.sel = [it.id];
    selectionChanged();
  });
  el.screen.addEventListener('pointercancel', endDrag);

  // パレットから配置
  el.palette.addEventListener('dragstart', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    e.dataTransfer.setData('text/plain', 'gamen:' + tile.dataset.type);
    e.dataTransfer.effectAllowed = 'copy';
    state.dragType = tile.dataset.type;
  });
  el.palette.addEventListener('dragend', () => { state.dragType = null; el.stage.classList.remove('drop-ok'); });
  el.palette.addEventListener('click', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    const def = UI.get(tile.dataset.type);
    const c = visibleCenter();
    addItem(def.type, c.x - def.size.w / 2, c.y - def.size.h / 2);
  });
  el.stage.addEventListener('dragover', (e) => {
    if (!state.dragType) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    el.stage.classList.add('drop-ok');
  });
  el.stage.addEventListener('dragleave', (e) => { if (e.target === el.stage) el.stage.classList.remove('drop-ok'); });
  el.stage.addEventListener('drop', (e) => {
    el.stage.classList.remove('drop-ok');
    const raw = e.dataTransfer.getData('text/plain') || '';
    const type = raw.startsWith('gamen:') ? raw.slice(6) : state.dragType;
    if (!type || !UI.get(type)) return;
    e.preventDefault();
    const def = UI.get(type);
    const pt = screenPoint(e);
    addItem(type, pt.x - Math.min(def.size.w, 200) / 2, pt.y - def.size.h / 2);
  });

  el.stage.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(state.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), { x: e.clientX, y: e.clientY });
  }, { passive: false });

  // ---------------------------------------------------------------- キーボード
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 's') { e.preventDefault(); saveJSON(); return; }
    if (typing) return;
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (mod && k === 'a') { e.preventDefault(); state.sel = page().items.map((i) => i.id); selectionChanged(); return; }
    if (mod && k === 'c' && state.sel.length) { state.clipboard = clone(selItems()); toast(`${state.clipboard.length} 個コピーしました`); return; }
    if (mod && k === 'x' && state.sel.length) { state.clipboard = clone(selItems()); deleteSel(); return; }
    if (mod && k === 'v' && state.clipboard) { e.preventDefault(); pasteItems(state.clipboard, GRID * 2); state.clipboard = clone(selItems()); return; }
    if (mod && k === 'd' && state.sel.length) { e.preventDefault(); pasteItems(selItems(), GRID * 2); return; }
    if ((k === 'delete' || k === 'backspace') && state.sel.length) { e.preventDefault(); deleteSel(); return; }
    if (mod && k === 'g') { e.preventDefault(); if (e.shiftKey) ungroupSel(); else groupSel(); return; }
    if (k === 'escape') {
      if (state.inner) { const g = state.inner; state.inner = null; state.sel = page().items.filter((i) => i.group === g).map((i) => i.id); }
      else state.sel = [];
      selectionChanged();
      return;
    }
    const step = e.shiftKey ? GRID : 1;
    const arrows = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] };
    if (arrows[k] && state.sel.length) { e.preventDefault(); nudge(...arrows[k]); }
  });

  // ---------------------------------------------------------------- ボタン類
  el.inspector.addEventListener('input', (e) => onInspectorInput(e, e.target.type === 'checkbox' || e.target.tagName === 'SELECT'));
  el.inspector.addEventListener('change', (e) => onInspectorInput(e, true));
  el.inspector.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'delete') deleteSel();
    if (b.dataset.act === 'duplicate') pasteItems(selItems(), GRID * 2);
    if (b.dataset.act === 'front') reorder(true);
    if (b.dataset.act === 'back') reorder(false);
    if (b.dataset.act === 'group') groupSel();
    if (b.dataset.act === 'ungroup') ungroupSel();
    if (b.dataset.align) align(b.dataset.align);
    if (b.dataset.page === 'dup') addPage(page());
    if (b.dataset.page === 'del') deletePage();
    if (b.dataset.themeColor) setTheme(b.dataset.themeColor, true);
    if (b.dataset.reset) {
      const i = selItems()[0];
      const def = i && UI.get(i.type);
      const p = def && def.props.find((x) => x.key === b.dataset.reset);
      if (p) { setProp(i, p.key, p.default || ''); commit(); renderInspector(); }
    }
  });

  el.pages.addEventListener('click', (e) => {
    const t = e.target.closest('.page-tab');
    if (t) gotoPage(Number(t.dataset.index));
  });
  $('#btnAddPage').addEventListener('click', () => addPage(null));
  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  $('#btnZoomIn').addEventListener('click', () => setZoom(state.zoom * 1.2));
  $('#btnZoomOut').addEventListener('click', () => setZoom(state.zoom / 1.2));
  $('#btnZoomFit').addEventListener('click', zoomFit);
  $('#optSnap').addEventListener('change', (e) => { state.snap = e.target.checked; });
  $('#optGrid').addEventListener('change', (e) => { state.grid = e.target.checked; el.screen.classList.toggle('show-grid', state.grid); });
  $('#btnNew').addEventListener('click', () => {
    if (!window.confirm('新しい資料を作ります。今の内容は消えます（必要なら先に「保存」してください）。')) return;
    setDoc({ title: '新しい画面イメージ', size: state.doc.size, theme: state.doc.theme, pages: [{ name: '画面1', items: [] }] }, 0);
  });
  $('#btnOpen').addEventListener('click', () => $('#fileOpen').click());
  $('#fileOpen').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) openJSON(f); e.target.value = ''; });
  $('#btnSave').addEventListener('click', saveJSON);
  $('#btnPng').addEventListener('click', exportPNG);
  $('#btnCopyImg').addEventListener('click', copyImage);
  $('#btnPptx').addEventListener('click', exportPPTX);
  el.search.addEventListener('input', renderPalette);
  el.title.addEventListener('input', () => { state.doc.title = el.title.value; });
  el.title.addEventListener('change', () => { state.doc.title = el.title.value.trim() || '画面イメージ'; commit(); });
  
  // ---------------------------------------------------------------- 起動
  const stored = loadStored();
  renderPalette();
  if (stored) setDoc(stored.doc, stored.page);
  else setDoc(window.GamenSample(), 0);

  // 拡張やテストから触れるように公開しておく
  window.GamenEditor = { state, setDoc, exportPPTX, pageSVG, addItem, gotoPage, buildPptx: () => window.GamenPptx.build(state.doc) };
})();
