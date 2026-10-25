"""業務システムでよく使う画面のテンプレート（templates/業務画面テンプレート.json）を作る。
中身はすべて架空のデータ。パネルの中の部品は、パネルごとにグループ化しておく。"""
import json, pathlib, itertools

_id = itertools.count(1)
def it(type_, x, y, w, h, **props):
    return {'id': f't{next(_id)}', 'type': type_, 'x': x, 'y': y, 'w': w, 'h': h, 'props': props}

MENU = 'ホーム\n顧客管理\n申請・承認\n帳票出力\nデータ取込\nマスタ管理\nシステム設定'
L, R = 276, 756            # 2列フォームの左列・右列の x
LW, RW = 452, 468          # 左列・右列の幅
LBL = 148                  # ラベル幅

def frame(active, crumbs):
    return [it('header', 0, 0, 1280, 56, title='顧客管理システム', user='営業第一部　山田 太郎'),
            it('sidemenu', 0, 56, 220, 664, items=MENU, active=active),
            it('breadcrumb', 252, 76, 640, 24, items=crumbs)]

def title(text, w=480):
    return it('heading', 252, 104, w, 40, text=text)

def kv_rows(x, y, lw, vw, rows, rh=36, line=True):
    """照会・確認画面の「項目名：値」の並び"""
    out = []
    for i, (k, v) in enumerate(rows):
        yy = y + i * rh
        out.append(it('text', x, yy, lw, rh, text=k, bold=True, size=14, color='#475569'))
        out.append(it('text', x + lw, yy, vw, rh, text=v, size=14))
        if line and i < len(rows) - 1:
            out.append(it('divider', x, yy + rh - 4, lw + vw, 8, color='#E2E8F0'))
    return out

def group_panels(items):
    """パネル（グループ枠）と、その中に収まる部品を1つのグループにする。共通の枠もグループにする。"""
    n = itertools.count(1)
    frame_ids = [i for i in items if i['type'] in ('header', 'sidemenu', 'breadcrumb')]
    if len(frame_ids) > 1:
        g = f'g{next(n)}'
        for i in frame_ids: i['group'] = g
    for p in [i for i in items if i['type'] == 'panel']:
        inside = [i for i in items if i is not p and 'group' not in i and i['x'] >= p['x'] and i['y'] >= p['y']
                  and i['x'] + i['w'] <= p['x'] + p['w'] and i['y'] + i['h'] <= p['y'] + p['h']]
        if inside and 'group' not in p:
            g = f'g{next(n)}'
            for i in [p, *inside]: i['group'] = g
    return items

pages = []
def page(name, items):
    pages.append({'name': name, 'items': group_panels(items)})

# 1 ログイン ---------------------------------------------------------------
page('ログイン', [
    it('panel', 0, 0, 1280, 720, title='', fill='#EEF2F6'),
    it('panel', 420, 120, 440, 470, title='', fill='#FFFFFF'),
    it('text', 460, 156, 360, 36, text='顧客管理システム', size=22, bold=True, align='center'),
    it('text', 460, 194, 360, 24, text='ユーザーIDとパスワードを入力してください', size=13, color='#64748B', align='center'),
    it('input', 460, 240, 360, 66, label='ユーザーID', labelPos='top', placeholder='例）U123456'),
    it('input', 460, 322, 360, 66, label='パスワード', labelPos='top', placeholder='8文字以上'),
    it('checkbox', 460, 400, 360, 28, options='ログイン状態を保持する', checked=''),
    it('button', 460, 444, 360, 44, label='ログイン', variant='primary'),
    it('button', 460, 500, 360, 32, label='パスワードをお忘れの方', variant='link'),
    it('text', 420, 540, 440, 28, text='初めて利用する方は、システム管理者に利用申請をしてください。', size=12, color='#64748B', align='center'),
    it('text', 0, 672, 1280, 24, text='© 2026 Sample Corporation', size=12, color='#94A3B8', align='center'),
])

# 2 ホーム ---------------------------------------------------------------
stats = [('未処理の申請', '8', '件', '本日期限 3 件'), ('承認待ち', '5', '件', 'うち至急 1 件'),
         ('今月の新規顧客', '42', '件', '前月比 +6 件'), ('お知らせ', '2', '件', '未読あり')]
page('ホーム', [
    *frame(1, 'ホーム'),
    title('ホーム'),
    it('text', 252, 148, 996, 28, text='おはようございます、山田さん。　前回のログイン：2026/10/25 18:42', size=13, color='#64748B'),
    *[it('stat', 252 + i * 253, 188, 237, 104, label=a, value=b, unit=c, note=d) for i, (a, b, c, d) in enumerate(stats)],
    it('panel', 252, 312, 600, 376, title='お知らせ'),
    it('table', 268, 368, 568, 216, columns='日付,区分,件名', widths='1.3,1,4', size=13, stripe=False,
       rows='2026/10/24\t重要\t11月の定期メンテナンスのお知らせ\n2026/10/20\t連絡\t帳票レイアウトを一部変更しました\n2026/10/15\t連絡\t操作マニュアル（第3版）を公開しました\n2026/10/01\t重要\tパスワードの定期変更のお願い\n2026/09/28\t連絡\t問い合わせ窓口の受付時間変更'),
    it('button', 268, 600, 120, 36, label='すべて見る', variant='link'),
    it('panel', 868, 312, 380, 376, title='よく使う機能'),
    *[it('button', 884, 368 + i * 56, 348, 44, label=l, variant='outline') for i, l in
      enumerate(['顧客を検索する', '新規顧客を登録する', '申請を承認する', '帳票を出力する', 'データを取り込む'])],
])

# 3 一覧・検索 ---------------------------------------------------------------
page('一覧・検索', [
    *frame(2, 'ホーム,顧客管理,顧客一覧'),
    title('顧客一覧'),
    it('panel', 252, 156, 996, 216, title='検索条件'),
    it('input', L, 208, LW, 40, label='顧客番号', labelWidth=LBL, placeholder='前方一致'),
    it('input', R, 208, RW, 40, label='氏名（カナ）', labelWidth=LBL, placeholder='例）ヤマダ タロウ'),
    it('select', L, 260, LW, 40, label='担当店舗', labelWidth=LBL, placeholder='すべて'),
    it('date', R, 260, 296, 40, label='登録日', labelWidth=LBL),
    it('text', R + 296, 260, 32, 40, text='〜', align='center'),
    it('date', R + 328, 260, 140, 40, label='', labelWidth=0),
    it('button', 1000, 316, 104, 40, label='クリア', variant='secondary'),
    it('button', 1116, 316, 108, 40, label='検索', variant='primary'),
    it('text', 252, 388, 300, 36, text='検索結果　128 件', size=15, bold=True),
    it('button', 1004, 388, 112, 36, label='CSV出力', variant='secondary'),
    it('button', 1128, 388, 120, 36, label='新規登録', variant='primary'),
    it('table', 252, 436, 996, 216, columns='顧客番号,氏名,氏名（カナ）,区分,担当者,登録日,状態', widths='1.2,1.4,1.6,0.8,1.2,1.2,0.8',
       rows='C-0012345\t山田 太郎\tヤマダ タロウ\t個人\t佐藤 花子\t2024/04/01\t有効\n'
            'C-0012388\t株式会社サンプル商事\tカ）サンプルショウジ\t法人\t佐藤 花子\t2024/05/12\t有効\n'
            'C-0013021\t鈴木 一郎\tスズキ イチロウ\t個人\t高橋 健\t2024/08/30\t休止\n'
            'C-0013457\t高橋 美咲\tタカハシ ミサキ\t個人\t高橋 健\t2025/01/15\t有効\n'
            'C-0014002\t有限会社テスト工業\tユ）テストコウギョウ\t法人\t伊藤 由美\t2025/06/03\t有効'),
    it('pagination', 868, 664, 380, 32, total='1〜5 件を表示', pages=5, current=1),
])

# 4 詳細（照会） ---------------------------------------------------------------
basic = [('顧客番号', 'C-0012345'), ('氏名', '山田 太郎'), ('氏名（カナ）', 'ヤマダ タロウ'), ('生年月日', '1985/04/12'),
         ('電話番号', '090-1234-5678'), ('メールアドレス', 'taro.yamada@example.com'), ('住所', '東京都千代田区丸の内1-1-1')]
page('詳細（照会）', [
    *frame(2, 'ホーム,顧客管理,顧客一覧,顧客詳細'),
    title('山田 太郎 様', 220),
    it('badge', 420, 111, 64, 26, text='有効', tone='success'),
    it('button', 1004, 106, 112, 36, label='削除', variant='outline', color='#DC2626'),
    it('button', 1128, 106, 120, 36, label='編集', variant='primary'),
    it('tabs', 252, 156, 996, 44, tabs='基本情報,取引情報,対応履歴,添付書類', active=1),
    it('panel', 252, 216, 640, 304, title='基本情報'),
    *kv_rows(276, 262, 144, 448, basic),
    it('panel', 908, 216, 340, 304, title='管理情報'),
    *kv_rows(924, 262, 104, 204, [('担当者', '佐藤 花子'), ('担当部署', '営業第一部'), ('登録日', '2024/04/01'),
                                  ('最終更新', '2026/10/20 14:32'), ('更新者', '鈴木 一郎')]),
    it('panel', 252, 536, 996, 160, title='直近の対応'),
    it('table', 268, 584, 964, 96, columns='日時,区分,内容,担当者', widths='1.4,0.8,5,1', size=12, stripe=False,
       rows='2026/10/20 14:32\t変更\t電話番号を変更（本人より電話で申出）\t鈴木 一郎\n2026/09/02 10:15\t相談\t住所変更の手続きについて問い合わせ\t佐藤 花子\n2026/07/18 16:40\t訪問\t定期訪問。ご家族の状況をヒアリング\t佐藤 花子'),
])

# 5 登録（入力） ---------------------------------------------------------------
def entry_form(values=None, top=164):
    v = values or {}
    y1, y2, y3 = top + 52, top + 104, top + 156
    return [
        it('panel', 252, top, 996, 208, title='基本情報'),
        it('input', L, y1, LW, 40, label='氏名', labelWidth=LBL, required=True, placeholder='例）山田 太郎', value=v.get('name', '')),
        it('input', R, y1, RW, 40, label='氏名（カナ）', labelWidth=LBL, required=True, placeholder='例）ヤマダ タロウ', value=v.get('kana', '')),
        it('date', L, y2, 340, 40, label='生年月日', labelWidth=LBL, value=v.get('birth', '')),
        it('text', R, y2 + 4, LBL, 32, text='性別', bold=True),
        it('radio', R + LBL, y2 + 4, 340, 32, options='男性,女性,回答しない', selected=v.get('sex', 0)),
        it('input', L, y3, LW, 40, label='電話番号', labelWidth=LBL, required=True, placeholder='例）090-1234-5678', value=v.get('tel', '')),
        it('input', R, y3, RW, 40, label='メールアドレス', labelWidth=LBL, placeholder='例）taro@example.com', value=v.get('mail', '')),
    ]

page('登録（入力）', [
    *frame(2, 'ホーム,顧客管理,顧客登録'),
    title('顧客登録'),
    it('steps', 768, 96, 480, 56, steps='入力,確認,完了', current=1),
    *entry_form(),
    it('panel', 252, 388, 996, 248, title='住所・その他'),
    it('input', L, 440, 300, 40, label='郵便番号', labelWidth=LBL, placeholder='例）100-0005'),
    it('button', L + 312, 440, 108, 40, label='住所を検索', variant='secondary'),
    it('input', L, 492, 948, 40, label='住所', labelWidth=LBL, placeholder='都道府県・市区町村・番地・建物名'),
    it('textarea', L, 544, 948, 72, label='備考', labelWidth=LBL, placeholder='自由に入力できます（500文字まで）'),
    it('button', 252, 656, 120, 40, label='キャンセル', variant='secondary'),
    it('button', 1104, 656, 144, 40, label='確認へ進む', variant='primary'),
])

# 6 登録確認 ---------------------------------------------------------------
confirm = [('氏名', '山田 太郎'), ('氏名（カナ）', 'ヤマダ タロウ'), ('生年月日', '1985/04/12'), ('性別', '男性'),
           ('電話番号', '090-1234-5678'), ('メールアドレス', 'taro.yamada@example.com'), ('郵便番号', '100-0005'),
           ('住所', '東京都千代田区丸の内1-1-1'), ('備考', '（なし）')]
page('登録確認', [
    *frame(2, 'ホーム,顧客管理,顧客登録'),
    title('顧客登録'),
    it('steps', 768, 96, 480, 56, steps='入力,確認,完了', current=2),
    it('alert', 252, 164, 996, 44, text='入力内容を確認し、よろしければ「登録する」を押してください。', tone='info'),
    it('panel', 252, 224, 996, 384, title='入力内容の確認'),
    *kv_rows(276, 270, 180, 768, confirm),
    it('button', 252, 640, 160, 40, label='入力画面に戻る', variant='secondary'),
    it('button', 1104, 640, 144, 40, label='登録する', variant='primary'),
])

# 7 登録完了 ---------------------------------------------------------------
page('登録完了', [
    *frame(2, 'ホーム,顧客管理,顧客登録'),
    title('顧客登録'),
    it('steps', 768, 96, 480, 56, steps='入力,確認,完了', current=3),
    it('marker', 714, 224, 72, 72, number='✓', color='#16A34A'),
    it('text', 252, 316, 996, 40, text='登録が完了しました', size=22, bold=True, align='center'),
    it('text', 252, 360, 996, 28, text='顧客番号「C-0012399」で登録しました。', size=14, color='#475569', align='center'),
    it('button', 582, 420, 160, 40, label='続けて登録する', variant='secondary'),
    it('button', 758, 420, 160, 40, label='詳細を表示する', variant='primary'),
    it('button', 670, 476, 160, 32, label='一覧に戻る', variant='link'),
])

# 8 編集 ---------------------------------------------------------------
page('編集', [
    *frame(2, 'ホーム,顧客管理,顧客一覧,顧客詳細,編集'),
    title('顧客情報の編集'),
    it('text', 848, 108, 400, 32, text='最終更新：2026/10/20 14:32　鈴木 一郎', size=13, color='#64748B', align='right'),
    it('panel', 252, 164, 996, 208, title='基本情報'),
    it('input', L, 216, LW, 40, label='顧客番号', labelWidth=LBL, value='C-0012345', disabled=True),
    it('select', R, 216, 300, 40, label='状態', labelWidth=LBL, value='有効'),
    it('input', L, 268, LW, 40, label='氏名', labelWidth=LBL, required=True, value='山田 太郎'),
    it('input', R, 268, RW, 40, label='氏名（カナ）', labelWidth=LBL, required=True, value='ヤマダ タロウ'),
    it('date', L, 320, 340, 40, label='生年月日', labelWidth=LBL, value='1985/04/12'),
    it('input', R, 320, RW, 40, label='電話番号', labelWidth=LBL, required=True, value='090-1234-5678'),
    it('panel', 252, 388, 996, 248, title='連絡先・変更理由'),
    it('input', L, 440, LW, 40, label='メールアドレス', labelWidth=LBL, value='taro.yamada@example.com'),
    it('input', L, 492, 948, 40, label='住所', labelWidth=LBL, value='東京都千代田区丸の内1-1-1'),
    it('textarea', L, 544, 948, 72, label='変更理由', labelWidth=LBL, required=True, placeholder='例）本人より電話番号変更の申出'),
    it('button', 252, 656, 120, 40, label='キャンセル', variant='secondary'),
    it('button', 1104, 656, 144, 40, label='更新する', variant='primary'),
])

# 9 入力エラー ---------------------------------------------------------------
def err_field(x, y, w, msg):
    return [it('focus', x - 2, y - 2, w + 4, 44, color='#DC2626', width=2, dash=False),
            it('text', x, y + 44, w, 18, text=msg, size=12, color='#DC2626', fit='ellipsis')]
page('入力エラー', [
    *frame(2, 'ホーム,顧客管理,顧客登録'),
    title('顧客登録'),
    it('steps', 768, 96, 480, 56, steps='入力,確認,完了', current=1),
    it('alert', 252, 164, 996, 44, text='入力内容に誤りが 3 件あります。赤枠の項目を確認してください。', tone='danger'),
    it('panel', 252, 224, 996, 236, title='基本情報'),
    it('input', L, 276, LW, 40, label='氏名', labelWidth=LBL, required=True, value='山田 太郎'),
    it('input', R, 276, RW, 40, label='氏名（カナ）', labelWidth=LBL, required=True, placeholder='例）ヤマダ タロウ'),
    *err_field(R + LBL, 276, RW - LBL, '氏名（カナ）を入力してください。'),
    it('date', L, 340, 340, 40, label='生年月日', labelWidth=LBL, value='1985/13/40'),
    *err_field(L + LBL, 340, 340 - LBL, '正しい日付を入力してください。'),
    it('text', R, 344, LBL, 32, text='性別', bold=True),
    it('radio', R + LBL, 344, 340, 32, options='男性,女性,回答しない', selected=1),
    it('input', L, 404, LW, 40, label='電話番号', labelWidth=LBL, required=True, value='090-1234'),
    *err_field(L + LBL, 404, LW - LBL, '電話番号の桁数が足りません。'),
    it('input', R, 404, RW, 40, label='メールアドレス', labelWidth=LBL, value='taro.yamada@example.com'),
    it('button', 252, 484, 120, 40, label='キャンセル', variant='secondary'),
    it('button', 1104, 484, 144, 40, label='確認へ進む', variant='primary'),
    it('sticky', 252, 556, 360, 120, title='入力チェックの表示ルール',
       text='・エラーの項目は赤枠で囲み、すぐ下に理由を表示する\n・画面上部にエラーの件数を表示する\n・最初のエラー項目にカーソルを移す'),
])

# 10 削除確認 ---------------------------------------------------------------
page('削除確認（ダイアログ）', [
    it('panel', 0, 0, 1280, 720, title='', fill='#64748B'),
    it('dialog', 400, 220, 480, 240, title='顧客の削除', buttons='キャンセル,削除する', color='#DC2626',
       message='顧客「山田 太郎（C-0012345）」を削除します。\n削除すると元に戻せません。よろしいですか？'),
    it('sticky', 920, 220, 280, 112, title='補足', text='詳細画面の「削除」から開く。\n背景の画面は操作できない状態にする。'),
])

# 11 申請一覧 ---------------------------------------------------------------
page('申請一覧（承認待ち）', [
    *frame(3, 'ホーム,申請・承認,申請一覧'),
    title('申請一覧'),
    it('tabs', 252, 156, 996, 44, tabs='承認待ち（5）,承認済み,差戻し,すべて', active=1),
    it('search', 928, 216, 320, 36, placeholder='申請番号・申請者で検索'),
    it('text', 252, 216, 400, 36, text='承認が必要な申請が 5 件あります', size=14, color='#475569'),
    it('table', 252, 268, 996, 216, columns='申請番号,申請日,申請種別,申請者,金額,期限,状態', widths='1.2,1.1,1.6,1.1,1.1,1.1,0.9',
       rows='R-2026-0142\t2026/10/24\t経費精算\t高橋 健\t48,200\t10/28\t至急\n'
            'R-2026-0139\t2026/10/23\t出張申請\t伊藤 由美\t126,000\t10/30\t承認待ち\n'
            'R-2026-0137\t2026/10/22\t備品購入\t佐藤 花子\t23,800\t11/05\t承認待ち\n'
            'R-2026-0135\t2026/10/21\t経費精算\t田中 健\t9,640\t11/05\t承認待ち\n'
            'R-2026-0131\t2026/10/20\t休暇申請\t鈴木 一郎\t—\t10/27\t承認待ち'),
    it('pagination', 868, 500, 380, 32, total='全 5 件', pages=1, current=1),
    it('alert', 252, 556, 996, 44, text='期限を過ぎた申請は、自動的に上長の上長へ回送されます。', tone='neutral'),
])

# 12 申請詳細（承認） ---------------------------------------------------------------
page('申請詳細（承認）', [
    *frame(3, 'ホーム,申請・承認,申請一覧,申請詳細'),
    title('経費精算　R-2026-0142', 360),
    it('badge', 620, 111, 64, 26, text='至急', tone='danger'),
    it('panel', 252, 156, 640, 340, title='申請内容'),
    *kv_rows(276, 202, 144, 448, [('申請者', '高橋 健（営業第二部）'), ('申請日', '2026/10/24'), ('件名', '顧客訪問の交通費・会議費'),
                                  ('金額', '48,200 円'), ('支払先', '本人口座'), ('添付書類', '領収書 3 件（PDF）'),
                                  ('申請理由', '10月の顧客訪問（3社）に伴う交通費と会議費')], rh=40),
    it('panel', 908, 156, 340, 340, title='承認の流れ'),
    *kv_rows(924, 202, 108, 200, [('申請', '高橋 健　10/24'), ('課長', '山田 太郎　未承認'), ('部長', '—'), ('経理', '—')], rh=40),
    it('textarea', 252, 512, 996, 104, label='コメント', labelPos='top', placeholder='差し戻す場合は理由を入力してください'),
    it('button', 252, 640, 120, 40, label='一覧に戻る', variant='secondary'),
    it('button', 980, 640, 120, 40, label='差し戻す', variant='outline', color='#DC2626'),
    it('button', 1112, 640, 136, 40, label='承認する', variant='primary'),
])

# 13 マスタ管理 ---------------------------------------------------------------
page('マスタ管理', [
    *frame(6, 'ホーム,マスタ管理,店舗マスタ'),
    title('店舗マスタ'),
    it('search', 252, 156, 320, 36, placeholder='コード・名称で検索'),
    it('button', 732, 156, 120, 36, label='＋ 新規追加', variant='outline'),
    it('table', 252, 208, 600, 432, columns='コード,店舗名,表示順,状態', widths='1,2.6,1,1',
       rows='001\t本店\t1\t有効\n002\t駅前支店\t2\t有効\n003\t北町支店\t3\t有効\n004\t南町支店\t4\t有効\n005\t東口出張所\t5\t停止\n'
            '006\t西が丘支店\t6\t有効\n007\t港支店\t7\t有効\n008\t中央通り支店\t8\t有効\n009\t旧本店（統合済）\t99\t停止\n010\t新町支店\t10\t有効\n011\t桜台支店\t11\t有効'),
    it('pagination', 472, 656, 380, 32, total='全 24 件', pages=3, current=1),
    it('panel', 868, 156, 380, 532, title='店舗情報の編集'),
    it('input', 892, 212, 332, 66, label='コード', labelPos='top', value='002', disabled=True),
    it('input', 892, 294, 332, 66, label='店舗名', labelPos='top', required=True, value='駅前支店'),
    it('input', 892, 376, 160, 66, label='表示順', labelPos='top', value='2'),
    it('input', 892, 458, 332, 66, label='電話番号', labelPos='top', value='03-1234-5678'),
    it('toggle', 892, 544, 332, 32, label='この店舗を有効にする', on=True),
    it('button', 892, 624, 156, 40, label='キャンセル', variant='secondary'),
    it('button', 1068, 624, 156, 40, label='保存', variant='primary'),
])

# 14 帳票出力 ---------------------------------------------------------------
page('帳票出力', [
    *frame(4, 'ホーム,帳票出力'),
    title('帳票出力'),
    it('panel', 252, 156, 996, 268, title='出力条件'),
    it('select', L, 208, LW, 40, label='帳票の種類', labelWidth=LBL, required=True, value='顧客別取引明細'),
    it('select', R, 208, RW, 40, label='店舗', labelWidth=LBL, placeholder='すべて'),
    it('date', L, 260, 296, 40, label='対象期間', labelWidth=LBL, value='2026/10/01'),
    it('text', L + 296, 260, 32, 40, text='〜', align='center'),
    it('date', L + 328, 260, 140, 40, label='', labelWidth=0, value='2026/10/31'),
    it('text', L, 316, LBL, 32, text='出力形式', bold=True),
    it('radio', L + LBL, 316, 320, 32, options='PDF,Excel,CSV', selected=1),
    it('checkbox', R, 316, RW, 32, options='0件の項目も出力する', checked=''),
    it('button', 1104, 368, 120, 40, label='出力する', variant='primary'),
    it('panel', 252, 440, 996, 248, title='出力履歴（直近7日間）'),
    it('table', 268, 488, 964, 180, columns='出力日時,帳票名,条件,形式,状態', widths='1.3,1.6,2.6,0.7,1',
       rows='2026/10/25 18:20\t顧客別取引明細\t2026/10/01〜10/24・全店舗\tPDF\t完了\n'
            '2026/10/25 09:05\t新規顧客一覧\t2026/10 月分・本店\tExcel\t完了\n'
            '2026/10/23 17:48\t担当者別実績表\t2026/09 月分・全店舗\tPDF\t期限切れ\n'
            '2026/10/22 11:30\t顧客別取引明細\t2026/09/01〜09/30・駅前支店\tCSV\t作成中…'),
])

# 15 ファイル取込 ---------------------------------------------------------------
page('ファイル取込', [
    *frame(5, 'ホーム,データ取込'),
    title('データ取込（顧客情報）'),
    it('steps', 768, 96, 480, 56, steps='ファイル選択,内容の確認,取込', current=2),
    it('panel', 252, 164, 996, 196, title='取り込むファイル'),
    it('focus', 276, 212, 948, 92, color='#94A3B8', width=1.5, dash=True),
    it('text', 276, 220, 948, 28, text='ここに CSV ファイルをドラッグ＆ドロップ、または', size=14, color='#475569', align='center'),
    it('button', 690, 254, 120, 36, label='ファイルを選択', variant='secondary'),
    it('text', 276, 312, 600, 32, text='選択中：customer_20261025.csv（120 件・48 KB）', size=13, bold=True),
    it('text', 824, 312, 400, 32, text='文字コード UTF-8、1ファイル 10 MB まで', size=12, color='#64748B', align='right'),
    it('alert', 252, 376, 996, 44, text='120 件中 3 件にエラーがあります。エラーの行は取り込まれません。', tone='warning'),
    it('table', 252, 436, 996, 180, columns='行,顧客番号,氏名,電話番号,判定,内容', widths='0.5,1.2,1.4,1.4,0.8,3',
       rows='12\tC-0015001\t青木 誠\t090-1111-2222\tエラー\t電話番号の形式が正しくありません\n'
            '45\tC-0015034\t\t03-5555-6666\tエラー\t氏名が入力されていません\n'
            '87\tC-0012345\t山田 太郎\t090-1234-5678\tエラー\t同じ顧客番号がすでに登録されています\n'
            '1\tC-0015000\t石井 和子\t080-3333-4444\tOK\t'),
    it('button', 252, 648, 160, 40, label='ファイルを選び直す', variant='secondary'),
    it('button', 1072, 648, 176, 40, label='117 件を取り込む', variant='primary'),
])

# 16 システムエラー ---------------------------------------------------------------
page('システムエラー', [
    it('header', 0, 0, 1280, 56, title='顧客管理システム', user='', logout=False),
    it('marker', 604, 176, 72, 72, number='!', color='#D97706'),
    it('text', 240, 272, 800, 40, text='処理中にエラーが発生しました', size=22, bold=True, align='center'),
    it('text', 240, 320, 800, 52, size=14, color='#475569', align='center',
       text='しばらく時間をおいてから、もう一度お試しください。\n解決しない場合は、下のエラー番号を添えてシステム管理者にお問い合わせください。'),
    it('panel', 440, 396, 400, 56, title='', fill='#F8FAFC'),
    it('text', 440, 396, 400, 56, text='エラー番号：E500-20261026-0142', size=14, bold=True, align='center'),
    it('button', 560, 480, 160, 40, label='ホームに戻る', variant='primary'),
])

doc = {'app': 'gamen-editor', 'version': 1, 'title': '業務システム画面テンプレート',
       'size': {'w': 1280, 'h': 720}, 'theme': {'primary': '#2457C5'}, 'pages': pages}
out = pathlib.Path(__file__).resolve().parent.parent / 'templates' / '業務画面テンプレート.json'
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding='utf-8')
print(out, len(pages), 'pages', sum(len(p['items']) for p in pages), 'items')
