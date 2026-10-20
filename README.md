# 市町村類型マップ

https://shoei05.github.io/japan-municipal-types/

総務省「類似団体別市町村財政指数表」の類型区分を、全国1,741市区町村について地図で表示する。

- 政令指定都市、特別区、中核市、施行時特例市（各1類型）
- 都市16類型（人口4区分×産業構造4区分、うち2類型は該当なし）
- 町村15類型（人口5区分×産業構造3区分）

色は団体の種類で3系統（都市＝青、町村＝橙、大都市制度＝青緑）に分け、系統内の濃淡で人口区分または産業構造を表す。凡例のマスを押すと、その類型の団体だけを色付きで表示し、団体一覧を出す。

## データ

| 内容 | 出典 | 時点 |
|---|---|---|
| 類型区分 | 総務省「類似団体別市町村財政指数表（令和6年度）」都道府県別団体名一覧表 https://www.soumu.go.jp/iken/ruiji/ruijiR06.html | 団体は令和7年3月31日現在、人口・産業構造は令和2年国勢調査 |
| 行政区域 | 国土数値情報「行政区域データ（N03）」国土交通省 https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2025.html | 2025年1月1日 |

`docs/data/ruiji_R06.csv` は原表を次の点だけ整えたもの。

- 産業構造の数字を半角に揃えた（原表は「都市Ⅱ－３」、本CSVは「都市Ⅱ－3」）。
- `kind`（種類）、`pop`（人口区分 1〜5）、`ind`（産業構造 0〜3）の列を加えた。
- `nonsel` は原表の「非選定」（※）。指数表の算出から外れた団体で、類型そのものは該当する。

地図では政令指定都市の区を市の単位にまとめた。北方領土の6村と所属未定地は類型が設定されていないため灰色で表示する。

## 利用条件

- 総務省の資料は、総務省ホームページの利用規約である「公共データ利用規約（第1.0版）」（https://www.digital.go.jp/resources/open_data/public_data_license_v1.0 ）に従う。同規約はCC BY 4.0と互換性がある。出典（URL付き）と、加工したこと及びその主体の記載を求めている。
- 国土数値情報（行政区域データ）の使用許諾条件は「オープンデータ（CC_BY_4.0）」（データのページに記載）。
- ページ下部に両データの出典とURLを、地図の右下に出典を表示し、加工者を「香田将英」と記載している。

## 構成

```
docs/            GitHub Pages で公開するフォルダ
  index.html
  app.js         地図と凡例（MapLibre GL JS 4.7.1）
  style.css
  data/          生成物（munis.geojson, prefs.geojson, ruiji_R06.csv）
scripts/build.py 類型一覧とN03を結合して docs/data/ を作る
data/raw/        総務省の原表（xlsx）と作成要領（pdf）
```

## 再生成

N03（約630MB）はリポジトリに含めない。

```sh
curl -LO https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2025/N03-20250101_GML.zip
unzip N03-20250101_GML.zip -d n03
uv run --no-project --with openpyxl python scripts/build.py data/raw/R06_団体名一覧表.xlsx n03/N03-20250101.shp
```

`mapshaper`（0.6.102）は `npx` で取得する。年度を更新するときは、新しい団体名一覧表と、その基準日に近いN03を使う。

## ローカルで見る

```sh
cd docs && python3 -m http.server 8790
```

`index.html` を直接開くとデータを読み込めないため、ローカルサーバー経由で開く。
