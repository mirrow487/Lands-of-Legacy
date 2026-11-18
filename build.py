#!/usr/bin/env python3
"""Bundle index.html + css + js into a single self-contained file: LandsOfLegacy.html"""
import re
from pathlib import Path

root = Path(__file__).parent
html = (root / 'index.html').read_text(encoding='utf-8')

def inline_css(m):
    css = (root / m.group(1)).read_text(encoding='utf-8')
    return '<style>\n' + css + '\n</style>'

def inline_js(m):
    js = (root / m.group(1)).read_text(encoding='utf-8').replace('</script', '<\\/script')
    return '<script>\n' + js + '\n</script>'

html = re.sub(r'<link rel="stylesheet" href="(?!https?:)([^"]+)">', inline_css, html)
html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)
(root / 'LandsOfLegacy.html').write_text(html, encoding='utf-8')
print('LandsOfLegacy.html', len(html) // 1024, 'KB')
