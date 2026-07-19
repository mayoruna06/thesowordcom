# 小書樓（The So Word）現行技術規格書

> 版本：v2.0
> 最後更新：2026-07-19
> 狀態：正式站已上線，本文件以實際程式與部署架構為準

## 1. 架構

| 層級 | 技術與位置 | 職責 |
|---|---|---|
| 讀者前台 | Astro 5、AWS S3、CloudFront | 靜態頁面、作品與章節閱讀介面 |
| 前台 CI/CD | GitHub Actions | 型別檢查、建置、S3 同步、CloudFront invalidation |
| 後台與讀者 API | GCP Compute Engine、Caddy、Node.js／Express | 內容管理、會員、進度、收藏、搜尋與留言 |
| 資料 | Markdown／Git + PostgreSQL 16 | 內容版本、會員資料、內容快照與稽核 |

正式網址：

- 小書樓：`https://thesoword.com/soword/`
- 管理後台與 API：`https://admin.thesoword.com`
- GitHub：`mayoruna06/thesowordcom`（前台）與私有 `mayoruna06/soword-admin`（後台）

前台即使後台短暫離線仍可閱讀既有靜態內容；登入、收藏、搜尋及留言等動態功能會暫時不可用。

## 2. 分支與工作區

- 正式分支：`main`
- GCP 開發分支：`dev/gcp`
- GCP 開發工作區：`/home/jasper/workspace/dev/thesowordcom`
- GCP `main` 備援工作區：`/home/jasper/workspace/thesowordcom`

正式網站不是由 GCP 工作區直接提供，而是由 GitHub Actions 將 `main` 建置後部署到 AWS。GCP 的 `main` 工作區供內容後台發佈與故障排查使用，因此與 GitHub 的最新純 CI／文件提交短暫不同步不代表網站部署失敗。

## 3. 專案結構

```text
thesowordcom/
├─ index.html                         個人首頁
├─ 履歷編輯器.HTML                    獨立工具
├─ .github/workflows/
│  ├─ deploy.yml                     小書樓建置與部署
│  ├─ deploy-root.yml                根目錄靜態檔部署
│  └─ preview.yml                    Pull Request 建置檢查
├─ soword/
│  ├─ astro.config.mjs               base=/soword/，純靜態輸出
│  ├─ package.json / pnpm-lock.yaml
│  ├─ public/                        robots、圖片等靜態資源
│  └─ src/
│     ├─ content/
│     │  ├─ works/{slug}/index.md
│     │  ├─ chapters/{slug}.md
│     │  └─ announcements/{slug}.md
│     ├─ layouts/                    作品與章節版型
│     ├─ components/                 導覽、側欄、卡片等
│     ├─ pages/                      首頁、作品、章節、搜尋、帳號、公告
│     └─ site.config.ts              後台/API 正式網址
└─ SPEC.md / 小書樓操作說明.md
```

Decap CMS 已移除；`soword/public/admin/` 不應重新建立。內容管理使用 `admin.thesoword.com`。

## 4. 內容資料模型

### 4.1 作品 `works`

路徑：`soword/src/content/works/{slug}/index.md`

必填欄位：`title`、`genre`、`status`、`summary`、`publishedAt`。其他欄位包括 `author`、`cover`、`tags`、`featured`、`contentWarning`、`updatedAt`。

`genre`：`romance`、`fantasy`、`sci-fi`、`thriller`、`slice-of-life`、`other`。

`status`：`ongoing`、`completed`、`hiatus`、`draft`；`draft` 不對讀者公開。

### 4.2 章節 `chapters`

路徑：`soword/src/content/chapters/{slug}.md`

必填欄位：`title`、`work`、`chapter`、`publishedAt`；選填 `wordCount`、`updatedAt`。`work` 必須與作品 slug 一致，`chapter` 為正整數。

### 4.3 公告 `announcements`

路徑：`soword/src/content/announcements/{slug}.md`

欄位：`title`、`publishedAt`，以及選填的 `pinned`。

## 5. 讀者功能與 API 整合

`soword/src/site.config.ts` 集中設定 `ADMIN_URL`。瀏覽器以 HTTPS 並攜帶 HttpOnly cookie 呼叫 `https://admin.thesoword.com/api/reader/*`。

- `/account/`：Email 註冊、驗證、登入、登出、忘記密碼、閱讀進度與收藏。
- `/search/`：搜尋後台 SQL 內容快照；最多回傳 30 筆。
- 作品頁：收藏作品與繼續閱讀。
- 章節頁：同步閱讀進度、將收藏更新到目前章節、顯示已核准留言及送出待審留言。
- RSS feed 端點仍保留在 `/soword/rss.xml` 供機器探索，但小書樓介面不顯示 RSS 按鈕。
- 小書樓頁面不顯示 GitHub 連結；GitHub 只出現在維運文件中。

讀者帳號只支援 Email／密碼；不使用 Google 一鍵登入或其他 OAuth 社群登入。

## 6. 建置與部署

本地或 GCP 開發工作區：

```bash
cd /home/jasper/workspace/dev/thesowordcom/soword
pnpm install --frozen-lockfile
pnpm run check
pnpm run build
pnpm run dev
```

預覽網址通常為 `http://localhost:4321/soword/`。

推送到 `main` 且變更 `soword/**` 或部署 workflow 時，`Deploy 小書樓` 會：

1. 使用 Node.js 22 與 pnpm 9 安裝鎖定相依。
2. 執行 `pnpm run check` 與 `pnpm run build`。
3. 上傳短期保留的建置 artifact。
4. 將 HTML、靜態資源與其他檔案分別設定快取後同步到 S3。
5. 清除 CloudFront 的 `/soword/*` 與 `/soword/` 快取。

根目錄首頁及其他獨立靜態檔由 `deploy-root.yml` 分開部署，不應因小書樓修改而被覆蓋。

## 7. 安全與營運原則

- AWS 與 GitHub 憑證不得寫進 Repository。
- 後台 CORS 只允許正式前台與管理後台來源。
- 讀者 session cookie 使用 `HttpOnly`、`Secure`、`SameSite=Lax`。
- 留言內容以 DOM `textContent` 顯示，並需人工審核後才公開。
- 前台內容在 Git；發佈後另存 PostgreSQL 快照，資料庫也有每日異地備份。
- 正式後台固定使用 GCP `us-west1-b`、`e2-micro`、30 GB `pd-standard` 的成本基線。

## 8. 驗收清單

每次前台功能變更至少確認：

```bash
pnpm run check
pnpm run build
```

上線後確認：

- `https://thesoword.com/soword/` 回應 200。
- 作品、章節、搜尋與帳號頁可載入。
- `https://admin.thesoword.com/api/health` 回應 200。
- GitHub Actions 最新部署成功。
- 正式頁面沒有 RSS 按鈕或 GitHub 連結。

## 9. 文件維護

- 日常發文、留言審核與排錯：`小書樓操作說明.md`。
- 後台主機、資料庫、CI/CD、備份與復原：私有後台庫的 `docs/` 與 `ops/`。
- 架構或操作方式變更時，程式與文件應在同一批提交更新。
