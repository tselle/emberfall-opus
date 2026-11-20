#!/usr/bin/env python3
"""Builds the browser test pages from index.html.
   Each page is the real game (index.html) with a test-only animation shim and one test script (tools/tests/*.js).
   Run:  python3 tools/make_tests.py   — then open or headless-run tools/run-*.html."""
import os, re
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
index = open(os.path.join(root, 'index.html')).read()
SHIM = """  <script>
    // Test-only shim: headless virtual time does not run requestAnimationFrame.
    window.requestAnimationFrame = function (cb) { return setTimeout(function () { cb(performance.now()); }, 16); };
  </script>
"""
PAGES = {
    'playtest': ('tests/playtest.js', 'domready'),
    'combat': ('tests/combat.js', 'domready'),
    'phase3': ('tests/phase3.js', 'none'),
    'phase4to7': ('tests/phase4to7.js', 'domready'),
}
for name, (path, wrap) in PAGES.items():
    body = open(os.path.join(root, 'tools', path)).read()
    body = body.replace('EM.UI.init();', '')
    if wrap == 'domready':
        body = "document.addEventListener('DOMContentLoaded', function () {\n" + body + "\n});"
    html = index.replace('  <script src="rules.js"></script>', SHIM + '  <script src="../rules.js"></script>', 1)
    # every game script is relative to the project root; the test pages sit one level down
    html = re.sub(r'<script src="(?!\.\./)([a-z0-9\-]+\.js)"></script>', r'<script src="../\1"></script>', html)
    html = html.replace('href="style.css"', 'href="../style.css"')
    html = html.replace('</body>', '  <pre id="out" style="color:#fff;background:#000;white-space:pre-wrap"></pre>\n  <script>\n' + body + '\n  </script>\n</body>')
    out = os.path.join(root, 'tools', 'run-%s.html' % name)
    open(out, 'w').write(html)
    print('wrote', out)
