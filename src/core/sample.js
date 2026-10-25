/* 初回起動時に表示するサンプル（顧客検索・顧客詳細の2画面）。中身はすべて架空のデータ。 */
(function () {
  'use strict';

  const it = (type, x, y, w, h, props) => ({ type, x, y, w, h, props: props || {} });
  const frame = (active, crumbs) => [
    it('header', 0, 0, 1280, 56),
    it('sidemenu', 0, 56, 220, 664, { active }),
    it('breadcrumb', 252, 76, 600, 24, { items: crumbs }),
  ];

  window.GamenSample = function () {
    return {
      title: '顧客管理システム 画面イメージ（サンプル）',
      size: { w: 1280, h: 720 },
      theme: { primary: '#2457C5' },
      pages: [
        {
          name: '顧客検索',
          items: [
            ...frame(2, 'ホーム,顧客管理,顧客検索'),
            it('heading', 252, 104, 480, 40, { text: '顧客検索' }),
            it('panel', 252, 156, 996, 216, { title: '検索条件' }),
            it('input', 276, 208, 440, 40, { label: '顧客番号', labelWidth: 112, placeholder: '7桁の数字' }),
            it('input', 756, 208, 468, 40, { label: '氏名（カナ）', labelWidth: 112, placeholder: '例）ヤマダ タロウ' }),
            it('select', 276, 260, 440, 40, { label: '店舗', labelWidth: 112, placeholder: 'すべての店舗' }),
            it('text', 756, 264, 112, 32, { text: '顧客区分', bold: true }),
            it('radio', 868, 264, 300, 32, { options: 'すべて,個人,法人', selected: 1 }),
            it('button', 1000, 316, 104, 40, { label: 'クリア', variant: 'secondary' }),
            it('button', 1116, 316, 108, 40, { label: '検索', variant: 'primary' }),
            it('text', 252, 390, 300, 28, { text: '検索結果', size: 16, bold: true }),
            it('pagination', 868, 388, 380, 32, { total: '全 128 件', pages: 5, current: 1 }),
            it('table', 252, 428, 996, 252),
            it('marker', 240, 144, 28, 28, { number: '1' }),
            it('marker', 1210, 304, 28, 28, { number: '2' }),
            it('marker', 240, 416, 28, 28, { number: '3' }),
          ],
        },
        {
          name: '顧客詳細',
          items: [
            ...frame(2, 'ホーム,顧客管理,顧客検索,顧客詳細'),
            it('heading', 252, 104, 220, 40, { text: '山田 太郎 様' }),
            it('badge', 420, 111, 72, 26, { text: '取引中', tone: 'success' }),
            it('tabs', 252, 156, 996, 44, { active: 1 }),
            it('panel', 252, 220, 640, 300, { title: '基本情報' }),
            it('input', 276, 270, 592, 40, { label: '顧客番号', labelWidth: 140, value: '0012345', disabled: true }),
            it('input', 276, 318, 592, 40, { label: '氏名', labelWidth: 140, value: '山田 太郎' }),
            it('input', 276, 366, 592, 40, { label: '氏名（カナ）', labelWidth: 140, value: 'ヤマダ タロウ' }),
            it('date', 276, 414, 400, 40, { label: '生年月日', labelWidth: 140, value: '1985/04/12', placeholder: 'YYYY/MM/DD' }),
            it('input', 276, 462, 592, 40, { label: '電話番号', labelWidth: 140, value: '090-1234-5678' }),
            it('stat', 912, 220, 336, 104, { label: '預金残高（合計）', value: '3,250,000', unit: '円', note: '普通預金・定期預金の合計' }),
            it('stat', 912, 340, 336, 104, { label: '今月の取引', value: '12', unit: '件', note: '前月比 +3 件' }),
            it('alert', 912, 460, 336, 60, { text: '住所変更の届出が未処理です。', tone: 'warning' }),
            it('button', 252, 548, 120, 40, { label: '一覧に戻る', variant: 'secondary' }),
            it('button', 1128, 548, 120, 40, { label: '編集する', variant: 'primary' }),
            it('focus', 268, 262, 608, 56, { color: '#E11D48' }),
            it('marker', 256, 250, 28, 28, { number: '1' }),
            it('sticky', 912, 588, 200, 112, { title: '① 顧客番号', text: '変更できないため\n灰色で表示する。\n編集は「編集する」から。' }),
          ],
        },
      ],
    };
  };
})();
