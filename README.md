# 画面イメージエディタ

Webシステムの画面イメージを、部品をドラッグ＆ドロップして作るツールです。
作った画面は PowerPoint（.pptx）や PNG に書き出せるほか、画像としてコピーして Excel にそのまま貼り付けられます。

- インストール不要。HTML ファイルをブラウザ（Edge / Chrome）で開くだけで動きます
- 外部との通信は一切ありません（フォントも Windows 標準のものを使います）
- PowerPoint 出力では、部品ごとに図形がグループ化され、表は PowerPoint の表になります。エディタで作ったグループも PowerPoint のグループになります（表だけは PowerPoint の仕様でグループに入れられないため、単独で置かれます）
- 枠に収まらない文字は自動で折り返し、それでも入らない分は「…」で省略します。省略が起きている部品には、エディタ上で右上に印が付きます

## 使い方

| やりたいこと | 操作 |
|---|---|
| 部品を置く | 左の部品を画面にドラッグ（クリックすると中央に追加） |
| 文字や色を変える | 部品を選ぶと右側に設定が出る |
| 複数選んで揃える | Shift+クリック、または空白をドラッグして範囲選択 → 右側の「整列」 |
| まとめて動かす | 複数選んで Ctrl+G でグループ化。中の1つを直すときはダブルクリック（Esc で戻る） |
| 画面を増やす | 下の「＋ ページ追加」。1ページ = PowerPoint の1スライド |
| Excel に貼る | 「画像をコピー」→ Excel で貼り付け |
| 続きを別の PC でやる | 「保存」で .json を作り、別の PC で「開く」 |

編集中の内容はブラウザに自動保存されます（同じ PC・同じブラウザなら、閉じても続きから再開できます）。

## テンプレート

`templates/業務画面テンプレート.json` を「開く」で読み込むと、業務システムでよく使う16画面が入った状態から始められます。
ログイン、ホーム、一覧・検索、詳細（照会）、登録（入力・確認・完了）、編集、入力エラー、削除確認、申請一覧、申請詳細（承認）、マスタ管理、帳票出力、ファイル取込、システムエラー。
パネルとその中身はグループ化してあるので、ブロック単位で移動・コピーできます。中身はすべて架空のデータです。

## フォルダ構成

```
dist/gamen-editor.html   … 配布用。これ1つで動く（src を1ファイルにまとめたもの）
src/
  index.html             … 開発用の入口（このファイルを開いても動く）
  styles.css
  core/
    registry.js          … 部品の登録の仕組み
    render.js            … 部品を SVG で描く・共通の色やヘルパー
    pptx.js              … PowerPoint 出力
    pptx-template.js     … PowerPoint のマスター・テーマ（自動生成）
    zip.js               … .pptx を作るための ZIP 作成
    editor.js            … 画面の操作全般
    sample.js            … 初回に表示されるサンプル
  components/            … 部品の定義（ここを増やしていく）
    _shared.js           … 入力欄の枠など、部品どうしで共通の描き方
    layout.js / input.js / display.js / annotation.js
templates/               … 画面テンプレート（「開く」で読み込む）
tools/build.py           … src を dist/gamen-editor.html にまとめる
tools/make_templates.py  … テンプレートを作り直すスクリプト
```

## 部品の増やし方

部品は **1つの定義** から、エディタ上の表示・PowerPoint 出力・パレットのサムネイル・設定欄がすべて作られます。
描き方は「四角」「線」「文字」などの基本図形（プリミティブ）の組み合わせで書きます。

例：「ステップ表示（1 → 2 → 3）」を追加する場合

1. `src/components/steps.js` を作る

```js
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
```

2. `src/index.html` の「部品」の並びに1行足す

```html
<script src="components/steps.js"></script>
```

3. 配布用ファイルを作り直す

```
python tools/build.py
```

### 使える基本図形

座標は部品の左上を (0, 0) とした px です。

| t | 主な項目 |
|---|---|
| `rect` 四角 | `x, y, w, h, fill, stroke, sw`(線の太さ), `r`(角丸), `dash`(破線) |
| `ellipse` 円 | `x, y, w, h, fill, stroke, sw, dash` |
| `line` 線 | `x1, y1, x2, y2, stroke, sw, dash, arrow`(終点に矢じり) |
| `tri` 三角 | `x, y, w, h, fill, dir`(`up` / `down` / `left` / `right`) |
| `text` 文字 | `x, y, w, h, text`(改行可), `size, color, bold, align, valign`, `fit`（`'wrap'` 折り返し / `'ellipsis'` 省略。指定なしははみ出す） ／ 1行で大きさを変えるときは `runs: [{ text, size, bold, color }]` |
| `table` 表 | `x, y, w, h, columns, rows, colRatios, size, headerFill, headerColor, stripe` |

### draw() で使えるヘルパー（ctx）

| 名前 | 内容 |
|---|---|
| `ctx.color(c)` | `c` が空ならテーマ色を返す |
| `ctx.tint(色, 0〜1)` / `ctx.shade(色, 0〜1)` | 色を明るく / 暗くする |
| `ctx.onColor(背景色)` | その背景で読みやすい文字色（白か濃い灰） |
| `ctx.measure(文字, サイズ, 太字)` | 文字の幅(px)。横に並べるときの位置計算に使う |
| `ctx.list(値)` / `ctx.lines(値)` | 「A,B,C」や複数行の文字を配列にする |
| `ctx.C` | 共通の色（`ink` 本文, `sub` 補足, `line` 枠線, `soft` 薄い背景 など） |

ラベル付きの入力欄を作るときは `window.GamenParts.field()` を使うと、既存の入力部品と見た目が揃います（`components/input.js` を参照）。

### 設定欄の種類（props の type）

`text`（1行）/ `textarea`（複数行）/ `number` / `bool`（チェック）/ `select`（`options: [['値', '表示名'], ...]`）/ `color`

古い保存ファイルを開いたときは、後から追加したプロパティに既定値が自動で入ります。
