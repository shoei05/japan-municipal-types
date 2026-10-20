"""類型一覧（総務省）と行政区域（国土数値情報N03）を結合し、地図用GeoJSONを作る。

使い方:
  uv run --no-project --with openpyxl python scripts/build.py <団体名一覧表.xlsx> <N03.shp>

出力:
  docs/data/ruiji_R06.csv   類型一覧（団体コード6桁）
  docs/data/munis.geojson   市区町村ポリゴン（政令市は区を市にまとめる）
  docs/data/prefs.geojson   都道府県境界線
"""
import csv
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "data"
ROMAN = {"Ⅰ": 1, "Ⅱ": 2, "Ⅲ": 3, "Ⅳ": 4, "Ⅴ": 5}


def read_ruiji(xlsx):
    ws = openpyxl.load_workbook(xlsx, data_only=True).active
    rows = []
    for r in ws.iter_rows(min_row=4, values_only=True):
        v = [(str(x).strip() if x is not None else "") for x in r]
        i = next((k for k, x in enumerate(v) if re.fullmatch(r"\d{6}", x)), None)
        if i is None:
            continue
        code, pref, name, nonsel, kubun = (v[i:i + 5] + [""] * 5)[:5]
        m = re.fullmatch(r"(都市|町村)([ⅠⅡⅢⅣⅤ])－(\d)", kubun)
        if m:
            # 原表の産業構造の数字は全角（例: 都市Ⅱ－３）。照合しやすいよう半角に揃える
            kubun = f"{m.group(1)}{m.group(2)}－{int(m.group(3))}"
        rows.append({
            "code": code, "pref": pref, "name": name, "kubun": kubun,
            "kind": m.group(1) if m else kubun,
            "pop": ROMAN[m.group(2)] if m else "",
            "ind": int(m.group(3)) if m else "",
            "nonsel": "1" if nonsel else "",
        })
    return rows


def main(xlsx, shp):
    OUT.mkdir(parents=True, exist_ok=True)
    rows = read_ruiji(xlsx)
    with open(OUT / "ruiji_R06.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["code", "pref", "name", "kubun", "kind", "pop", "ind", "nonsel"])
        w.writeheader()
        w.writerows(rows)

    # 政令市は区単位のポリゴンなので「都道府県名+市名」で、それ以外は5桁コードで結合する
    seirei = {(r["pref"], r["name"]) for r in rows if r["kind"] == "政令指定都市"}
    tmp = Path(tempfile.mkdtemp())
    lookup = tmp / "lookup.csv"
    with open(lookup, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["jk", "code", "pref", "name", "kubun", "kind", "pop", "ind", "nonsel"])
        for r in rows:
            jk = r["pref"] + r["name"] if (r["pref"], r["name"]) in seirei else r["code"][:5]
            w.writerow([jk, r["code"], r["pref"], r["name"], r["kubun"], r["kind"], r["pop"], r["ind"], r["nonsel"]])

    munis = OUT / "munis.geojson"
    prefs = OUT / "prefs.geojson"
    mapshaper = ["npx", "--yes", "mapshaper@0.6.102"]
    subprocess.run(mapshaper + [
        "-i", shp, "encoding=utf8",
        "-each", "jk = N03_005 ? N03_001 + N03_004 : N03_007",
        "-filter", "jk != null && jk != ''",
        "-simplify", "1.2%", "keep-shapes", "planar",
        "-dissolve", "jk", "copy-fields=N03_001,N03_004",
        "-join", str(lookup), "keys=jk,jk", "string-fields=jk,code,pop,ind",
        "-each", "if (!code) { name = N03_004; pref = N03_001; kubun = ''; kind = '' }",
        "-filter-fields", "code,pref,name,kubun,kind,pop,ind,nonsel",
        "-o", str(munis), "format=geojson", "precision=0.001",
        "-dissolve", "pref",
        "-innerlines",
        "-o", str(prefs), "format=geojson", "precision=0.001",
    ], check=True, env={**__import__("os").environ, "NODE_OPTIONS": "--max-old-space-size=8192"})

    gj = json.loads(munis.read_text(encoding="utf-8"))
    have = {f["properties"].get("code") for f in gj["features"]}
    missing = [r for r in rows if r["code"] not in have]
    nokubun = sorted({(f["properties"]["pref"], f["properties"]["name"]) for f in gj["features"] if not f["properties"].get("code")})
    print(f"features={len(gj['features'])} ruiji={len(rows)} 地図に無い団体={len(missing)}")
    for r in missing:
        print("  missing:", r["code"], r["pref"], r["name"])
    print("類型の無いポリゴン:", nokubun)
    print(f"munis.geojson {munis.stat().st_size/1e6:.1f}MB, prefs.geojson {prefs.stat().st_size/1e6:.1f}MB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
