"""Tách bản local từ HTML đã thu hồi; không thay đổi logic game."""

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
source = ROOT / "evidence/game-page.html"
html = source.read_text()
game = html.split("<!-- /frame-runtime -->", 1)[1]
style = re.search(r"<style>(.*?)</style>", game, re.S)
script = re.search(r"<script>(.*?)</script>", game, re.S)
assert style and script, "HTML game đã đổi cấu trúc"
assert script.group(1) == (ROOT / "evidence/game.bundle.js").read_text()

(ROOT / "styles.css").write_text(style.group(1))
(ROOT / "game.js").write_text(script.group(1))
game = game.replace(style.group(0), '<link rel="stylesheet" href="./styles.css">', 1)
game = game.replace(script.group(0), '<script src="./game.js"></script>', 1)
head, body = game.split('<div id="app">', 1)
index = (
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
    + head + '\n</head>\n<body>\n<div id="app">' + body + '\n</body>\n</html>\n'
)
(ROOT / "index.html").write_text(index)
files = ["evidence/game-page.html", "evidence/game.bundle.js", "game.js", "styles.css", "index.html"]
manifest = {
    "source_url": "https://claude.ai/artifact/BGY1SztrAYcJQHSsnHHGmp",
    "frame_url": "https://5326a6ff-d95f-4e59-9b2e-b3f3bcb780e3.frame.claudeusercontent.com/_f/1794242702-61c7/?__frame_v=manifest.50700ebc68dce463.json",
    "recovered_on": "2026-11-10",
    "transformation": "Remove Claude frame runtime; externalize unchanged game script and CSS; add standalone HTML document and viewport.",
    "files": {name: {"bytes": (ROOT / name).stat().st_size, "sha256": hashlib.sha256((ROOT / name).read_bytes()).hexdigest()} for name in files},
}
(ROOT / "evidence/recovery-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print("PASS: game.js khớp từng byte với bundle thu hồi; đã tạo index.html/styles.css và manifest.")
