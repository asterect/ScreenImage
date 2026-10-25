"""src/ を1つの HTML ファイル（dist/gamen-editor.html）にまとめる。外部への通信は一切しない。"""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'src'
html = (src / 'index.html').read_text(encoding='utf-8')

def css(m):
    return '<style>\n' + (src / m.group(1)).read_text(encoding='utf-8') + '\n</style>'
def js(m):
    code = (src / m.group(1)).read_text(encoding='utf-8')
    assert '</script' not in code.lower(), m.group(1)
    return f'<script>/* {m.group(1)} */\n' + code + '\n</script>'

html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, html)
html = re.sub(r'<script src="([^"]+)"></script>', js, html)
assert 'src="' not in html and 'href="http' not in html
out = root / 'dist' / 'gamen-editor.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print(out, f'{out.stat().st_size/1024:.0f} KB')
