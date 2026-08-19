#!/usr/bin/env python3
"""pre-commitフック(.githooks/pre-commit)から呼ばれ、ステージ済みの
notes/src/*.md にYAML frontmatterで作成日・更新日を刻印する。

- frontmatterが無い新規ノート → created/updated を追加
- frontmatterがある既存ノート → updated だけ現在時刻に更新 (createdは保持)

ファイルのmtimeには依存しない (clone直後やCIではmtimeが壊れるため)。
"""

import datetime
import re
import sys
from pathlib import Path

now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

for name in sys.argv[1:]:
    path = Path(name)
    if not path.is_file():
        continue
    content = path.read_text(encoding="utf-8")
    m = re.match(r"\A---\n(.*?)\n---\n", content, re.S)
    if m:
        fm = m.group(1)
        if re.search(r"^updated:\s*.+$", fm, re.M):
            fm = re.sub(r"^updated:\s*.+$", "updated: %s" % now, fm, flags=re.M)
        else:
            fm += "\nupdated: %s" % now
        content = "---\n%s\n---\n%s" % (fm, content[m.end():])
    else:
        content = "---\ncreated: %s\nupdated: %s\n---\n%s" % (now, now, content)
    path.write_text(content, encoding="utf-8")
    print("Stamped %s" % path)
