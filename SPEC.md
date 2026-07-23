# 小書樓（The So Word）靜態網站技術規格書

**版本：** v2.1 | **日期：** 2026-07-23 | **作者：** Jasper（勒索沃德）

---

## 0. 目前正式架構（取代舊 AWS 章節）

自 2026-07 起，公開靜態網站已由 AWS S3／CloudFront 遷移至 GitHub Pages。本文後方原有 AWS 建置內容僅保留為歷史參考，不是目前正式維運方式。

目前系統分工：

- `thesowordcom`：Astro 靜態網站與 Markdown 內容，推送 `main` 後由 GitHub Actions 建置並部署至 GitHub Pages。
- `soword-admin`：Node.js 後台與會員 API，運行於 GCP Compute Engine。
- PostgreSQL：保存登入身分、角色、公開作者檔案、作品／章節目錄、管理權限、標籤關聯、收藏、進度與留言。
- GitHub：保存公開內容及部署歷史；公開作者頁、作品頁與標籤頁不依賴 GCP 即時渲染。
- Google Cloud：後台 API、PostgreSQL、備份、Email Alert 與自動部署。

Phase 8 起，作者、作品、章節與標籤使用 UUID 關聯；Markdown 中的 slug 仍作為公開網址與相容欄位。資料欄位與操作方式以 `小書樓操作說明.md` 及後端 `docs/Phase 8 關聯式內容目錄與權限模型計畫書.md` 為準。

---

## 目錄

1. [系統架構概覽](#1-系統架構概覽)
2. [專案結構](#2-專案結構)
3. [內容格式規範](#3-內容格式規範)
4. [本地開發環境設定](#4-本地開發環境設定)
5. [GitHub Actions CI/CD Pipeline](#5-github-actions-cicd-pipeline)
6. [AWS 設定](#6-aws-設定)
7. [發布文章 SOP](#7-發布文章-sop)
8. [版本控制策略](#8-版本控制策略)
9. [未來擴充建議](#9-未來擴充建議)
10. [附錄 A：快速排錯指南](#附錄-a快速排錯指南)
11. [附錄 B：初次建站 Checklist](#附錄-b初次建站-checklist)
12. [附錄 C：Decap CMS 設定](#附錄-cdecap-cms-設定選配)
13. [附錄 D：RSS Feed 實作範例](#附錄-drss-feed-實作範例)

---

## 1. 系統架構概覽

```
┌─────────────────────────────────────────────────────────────┐
│                        內容來源                              │
│   VS Code (本地)  ←→  GitHub Repo  ←→  Decap CMS (選配)    │
└─────────────────────────┬───────────────────────────────────┘
                          │ git push / PR merge
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  GitHub Actions                              │
│   1. checkout  2. pnpm install  3. astro build              │
│   4. aws s3 sync  5. cloudfront invalidation                │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌─────────────────┐             ┌──────────────────┐
│   AWS S3 Bucket │             │  AWS CloudFront  │
│  thesoword.com  │◄────────────│  Distribution    │
│  (static files) │             │  + ACM TLS cert  │
└─────────────────┘             └──────────────────┘
                                        │
                                        ▼
                               https://thesoword.com
```

**技術棧總覽：**

| 層次 | 技術 | 用途 |
|------|------|------|
| 內容 | Markdown + YAML frontmatter | 文章撰寫格式 |
| 建置 | Astro 5.x | 靜態網站生成器 |
| 套件管理 | pnpm 9.x | 相依套件管理 |
| CI/CD | GitHub Actions | 自動建置與部署 |
| 儲存 | AWS S3 | 靜態檔案託管 |
| CDN | AWS CloudFront | 全球加速 + HTTPS |
| DNS | （現有設定維持不變） | 網域解析 |
| 選配 CMS | Decap CMS | 網頁視覺化編輯介面（見附錄 C） |

---

## 2. 專案結構

### 2.1 Repository 配置

本專案採用**單一 Repository 管理兩個網站**策略：
- `main` 分支根目錄：主幹 `index.html`（現有）
- `soword/` 子目錄：小書樓 Astro 專案

```
thesowordcom/                          ← GitHub Repository 根目錄
├── index.html                         ← 主幹入口（現有，保持不動）
├── resume-editor/                     ← 履歷編輯器（現有，保持不動）
│   └── ...
├── soword/                            ← 小書樓 Astro 專案根目錄
│   ├── astro.config.mjs               ← Astro 設定檔
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── tsconfig.json
│   ├── .gitignore
│   │
│   ├── public/                        ← 不經處理直接複製的靜態資源
│   │   ├── favicon.ico
│   │   ├── robots.txt                 ← 見 Section 2.3
│   │   ├── images/
│   │   │   ├── covers/                ← 書封圖片
│   │   │   │   └── {work-slug}.jpg
│   │   │   └── og/                    ← Open Graph 社群預覽圖
│   │   │       └── {work-slug}.jpg
│   │   └── admin/                     ← Decap CMS（選配，見附錄 C）
│   │       ├── index.html
│   │       └── config.yml
│   │
│   ├── src/
│   │   ├── content/                   ← 所有 Markdown 內容
│   │   │   ├── config.ts              ← Astro Content Collections 型別定義
│   │   │   │
│   │   │   ├── works/                 ← 作品介紹頁（每部作品一個資料夾）
│   │   │   │   ├── silent-echo/
│   │   │   │   │   └── index.md       ← 作品介紹頁
│   │   │   │   └── another-work/
│   │   │   │       └── index.md
│   │   │   │
│   │   │   ├── chapters/              ← 所有作品的章節（獨立 Collection）
│   │   │   │   ├── silent-echo-ch001.md
│   │   │   │   ├── silent-echo-ch002.md
│   │   │   │   └── another-work-ch001.md
│   │   │   │
│   │   │   └── announcements/         ← 公告（選配）
│   │   │       └── 2026-06-01-hello.md
│   │   │
│   │   ├── layouts/
│   │   │   ├── BaseLayout.astro       ← 所有頁面共用的 HTML 骨架（含 SEO meta）
│   │   │   ├── WorkLayout.astro       ← 作品介紹頁版型
│   │   │   └── ChapterLayout.astro    ← 章節閱讀頁版型
│   │   │
│   │   ├── components/
│   │   │   ├── Header.astro           ← 全站頁頭
│   │   │   ├── Footer.astro           ← 全站頁尾
│   │   │   ├── WorkCard.astro         ← 作品列表卡片元件
│   │   │   ├── ChapterNav.astro       ← 章節上／下頁導覽
│   │   │   ├── TableOfContents.astro  ← 章節目錄
│   │   │   └── Breadcrumb.astro       ← 麵包屑導覽
│   │   │
│   │   ├── pages/
│   │   │   ├── index.astro            ← 小書樓首頁（作品列表）
│   │   │   ├── works/
│   │   │   │   └── [work]/
│   │   │   │       ├── index.astro    ← 作品介紹頁（動態路由）
│   │   │   │       └── [chapter].astro ← 章節閱讀頁（動態路由）
│   │   │   ├── rss.xml.js             ← RSS Feed（見附錄 D）
│   │   │   └── 404.astro              ← 404 頁面
│   │   │
│   │   └── styles/
│   │       ├── global.css             ← 全站基礎樣式
│   │       ├── typography.css         ← 閱讀排版樣式
│   │       └── variables.css          ← CSS 自訂變數（色票、字體等）
│   │
│   └── .github/                       ← GitHub 相關設定
│       └── workflows/
│           └── deploy.yml             ← CI/CD 部署 workflow
│
└── .github/
    └── workflows/
        └── deploy-root.yml            ← 主幹 index.html 部署 workflow
```

### 2.2 核心設定檔內容

**`soword/astro.config.mjs`**

```javascript
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // 若小書樓部署在子路徑（例如 thesoword.com/soword/），改為 '/soword/'
  // 若部署在獨立網域，維持 '/'
  base: '/',
  outDir: '../dist/soword',   // 建置輸出目錄（相對於 soword/）
  output: 'static',           // 純靜態輸出，不需要伺服器

  site: 'https://thesoword.com',

  integrations: [
    sitemap(),  // 自動生成 sitemap.xml（對搜尋引擎收錄不可缺少）
  ],

  build: {
    // 讓每個頁面輸出為 /path/index.html 格式（利於 S3 靜態託管）
    format: 'directory',
  },

  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
  },

  // 日後可加入的最佳化選項（見 Section 9.4）
  // image: { service: { entrypoint: 'astro/assets/services/sharp' } },
  // prefetch: { defaultStrategy: 'viewport' },
});
```

> 安裝 sitemap 套件：`pnpm add @astrojs/sitemap`

**`soword/tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@components/*": ["src/components/*"],
      "@layouts/*":    ["src/layouts/*"],
      "@styles/*":     ["src/styles/*"],
      "@content/*":    ["src/content/*"]
    }
  }
}
```

**`soword/package.json`**

```json
{
  "name": "soword-site",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev":     "astro dev",
    "build":   "astro build",
    "preview": "astro preview",
    "check":   "astro check",
    "sync":    "astro sync"
  },
  "dependencies": {
    "astro":           "^5.0.0",
    "@astrojs/sitemap": "^3.0.0",
    "@astrojs/rss":    "^4.0.0"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.0",
    "typescript":     "^5.6.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

### 2.3 robots.txt

**`soword/public/robots.txt`**

```
User-agent: *
Allow: /
Sitemap: https://thesoword.com/sitemap-index.xml
```

### 2.4 SEO Meta 模板

所有頁面透過 `BaseLayout.astro` 統一輸出 SEO 標籤。以下為 `<head>` 區段的最小模板：

```astro
---
// src/layouts/BaseLayout.astro
interface Props {
  title: string;
  description?: string;
  ogImage?: string;
  canonicalURL?: string;
}

const {
  title,
  description = '小書樓 — 勒索沃德的創作基地',
  ogImage = '/images/og/default.jpg',
  canonicalURL = Astro.url.href,
} = Astro.props;

const siteName = '小書樓';
const fullTitle = title === siteName ? siteName : `${title} | ${siteName}`;
---

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <!-- 基本 SEO -->
  <title>{fullTitle}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonicalURL} />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={siteName} />
  <meta property="og:title" content={fullTitle} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={new URL(ogImage, Astro.site)} />
  <meta property="og:url" content={canonicalURL} />

  <!-- RSS -->
  <link rel="alternate" type="application/rss+xml"
        title={siteName} href="/rss.xml" />

  <slot name="head" />
</head>
```

---

## 3. 內容格式規範

### 3.1 Content Collections 型別定義

`works`（作品介紹）與 `chapters`（章節）拆分為兩個獨立 Collection，確保各自的必填欄位受到型別系統完整保護，並讓 `getCollection()` 查詢更直覺。

**`soword/src/content/config.ts`**

```typescript
import { defineCollection, z } from 'astro:content';

// ── 作品介紹（works）Collection ──────────────────────────────
// 對應：src/content/works/{slug}/index.md
const worksCollection = defineCollection({
  type: 'content',
  schema: z.object({

    // ── 必填欄位 ──────────────────────────────
    title: z.string(),
    // 作品類型
    genre: z.enum([
      'romance',       // 言情
      'fantasy',       // 奇幻
      'sci-fi',        // 科幻
      'thriller',      // 懸疑
      'slice-of-life', // 日常
      'other',         // 其他
    ]),
    // 連載狀態
    // draft：草稿，不對外顯示。
    // 注意：必須在 getStaticPaths 中主動 filter，見下方說明。
    status: z.enum([
      'ongoing',    // 連載中
      'completed',  // 已完結
      'hiatus',     // 暫停更新
      'draft',      // 草稿（不對外顯示）
    ]),
    // 作品介紹（簡短，顯示在列表卡片）
    summary: z.string().max(200),

    // ── 選填欄位 ──────────────────────────────
    // 封面圖（相對於 public/images/covers/）
    cover: z.string().optional(),
    // 標籤
    tags: z.array(z.string()).default([]),
    // 是否在首頁精選展示
    featured: z.boolean().default(false),
    // 成人內容警示
    contentWarning: z.array(z.string()).default([]),

    // ── 時間戳記 ──────────────────────────────
    // 首次發布日期（ISO 8601）
    publishedAt: z.coerce.date(),
    // 最後更新日期（選填，省略時等同 publishedAt）
    updatedAt: z.coerce.date().optional(),
  }),
});

// ── 章節（chapters）Collection ───────────────────────────────
// 對應：src/content/chapters/{work-slug}-ch{NNN}.md
const chaptersCollection = defineCollection({
  type: 'content',
  schema: z.object({

    // ── 必填欄位 ──────────────────────────────
    // 顯示用章節標題（例如「第一章 潮聲」）
    title: z.string(),
    // 所屬作品 slug（對應 works collection 的資料夾名稱）
    work: z.string(),
    // 章節序號（數字，用於排序）
    // 建議使用間隔編號（10, 20, 30...），保留日後插入新章節的彈性
    chapter: z.number().int().positive(),
    // 字數（手動填寫，或由 CI 自動計算）
    wordCount: z.number().int().nonnegative().optional(),

    // ── 時間戳記 ──────────────────────────────
    publishedAt: z.coerce.date(),
    updatedAt:   z.coerce.date().optional(),
  }),
});

// ── 公告（announcements）Collection ─────────────────────────
const announcementsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title:       z.string(),
    publishedAt: z.coerce.date(),
    pinned:      z.boolean().default(false),
  }),
});

export const collections = {
  works:         worksCollection,
  chapters:      chaptersCollection,
  announcements: announcementsCollection,
};
```

**排除 `draft` 作品的必要 filter：**

`status: "draft"` 本身不會自動阻止頁面被建置，必須在每個使用 `getCollection` 的地方主動過濾：

```typescript
// pages/index.astro 或 pages/works/[work]/index.astro
const works = await getCollection('works', ({ data }) =>
  data.status !== 'draft'
);
```

若忘記加此 filter，草稿作品會被正常建置並上線。

### 3.2 Frontmatter 欄位速查表

#### 作品介紹頁（`works/{slug}/index.md`）

| 欄位 | 型別 | 必填 | 範例值 | 說明 |
|------|------|:----:|--------|------|
| `title` | string | ✓ | `"沉默的回聲"` | 作品標題 |
| `genre` | enum | ✓ | `"romance"` | 作品類型 |
| `status` | enum | ✓ | `"ongoing"` | 連載狀態 |
| `summary` | string | ✓ | `"一段發生在..."` | 200字以內的簡介 |
| `cover` | string | | `"silent-echo.jpg"` | 封面檔名 |
| `tags` | string[] | | `["BL", "現代"]` | 標籤陣列 |
| `featured` | boolean | | `true` | 是否在首頁精選 |
| `contentWarning` | string[] | | `["暴力描寫"]` | 內容警示 |
| `publishedAt` | date | ✓ | `2026-06-01` | 首次發布日期 |
| `updatedAt` | date | | `2026-06-02` | 最後更新日期 |

#### 章節檔案（`chapters/{work-slug}-ch001.md`）

| 欄位 | 型別 | 必填 | 範例值 | 說明 |
|------|------|:----:|--------|------|
| `title` | string | ✓ | `"第一章 初遇"` | 顯示用章節標題 |
| `work` | string | ✓ | `"silent-echo"` | 所屬作品 slug |
| `chapter` | number | ✓ | `10` | 章節序號（排序用，建議間隔 10） |
| `wordCount` | number | | `3500` | 本章字數 |
| `publishedAt` | date | ✓ | `2026-06-01` | 發布日期 |
| `updatedAt` | date | | `2026-06-02` | 更新日期 |

### 3.3 完整 Markdown 範例

**作品介紹頁** `soword/src/content/works/silent-echo/index.md`

```markdown
---
title: "沉默的回聲"
genre: "romance"
status: "ongoing"
summary: "退役偵探林硯試圖在海邊小城重建平靜生活，卻在某個失眠的夜晚接到陌生人的來電——對方只說了一句話便掛斷，而那個聲音，像極了三年前失蹤的搭檔。"
cover: "silent-echo.jpg"
tags:
  - "BL"
  - "現代"
  - "懸疑"
  - "慢熱"
contentWarning:
  - "輕微暴力描寫"
featured: true
publishedAt: 2026-05-01
updatedAt: 2026-06-02
---

## 關於這部作品

這是一個關於記憶、失去與重新找回自己的故事。
靈感源自某個雨夜一通打錯的電話。

## 更新時間

每週日晚上十點更新，目標每章 3000–4000 字。
```

**章節檔案** `soword/src/content/chapters/silent-echo-ch010.md`

```markdown
---
title: "第一章 潮聲"
work: "silent-echo"
chapter: 10
wordCount: 3842
publishedAt: 2026-05-01
---

林硯把最後一個紙箱放上木地板，站起身，聽見窗外的海。

距離退役剛好九十天。

他在北京住了十二年，耳朵裡裝的永遠是車聲、人聲、警報聲。現在這片持續的、均勻的浪聲讓他有點不知所措，像是有人把世界的音量調小了一格，卻忘了告訴他新的操作說明。

<!-- 正文繼續... -->
```

### 3.4 檔案命名規則

```
作品 slug：   全小寫英文、數字，以連字號（-）分隔
              ✓ silent-echo
              ✓ my-first-novel-2026
              ✗ SilentEcho（不可大寫）
              ✗ silent_echo（不可底線）

章節檔名：    {work-slug}-ch + 三位數字補零
              ✓ silent-echo-ch010.md
              ✓ silent-echo-ch020.md
              三位數補零最多支援到 ch999（即 999 個檔名序號）
              若連載超過 999 章，需升為四位數並重新命名舊檔

chapter 欄位：建議使用間隔 10 的整數（10, 20, 30...）
              原因：若日後需在第一章與第二章之間插入新章節，
              可用 15 而不必重新編排所有後續章節
              ✗ 從 1 開始連續編號（日後插入章節時維護成本高）

日期格式：    YYYY-MM-DD（ISO 8601）
              ✓ 2026-06-01
              ✗ 2026/6/1
```

---

## 4. 本地開發環境設定

### 4.1 前置需求

| 工具 | 最低版本 | 安裝指令 / 備註 |
|------|----------|-----------------|
| Node.js | 20.0.0 | 建議用 [nvm](https://github.com/nvm-sh/nvm) 管理版本 |
| pnpm | 9.0.0 | `npm install -g pnpm` |
| Git | 2.40.0 | 系統內建或官網下載 |
| VS Code | 最新版 | 建議安裝以下擴充功能 |

**建議 VS Code 擴充功能：**

```jsonc
// .vscode/extensions.json（放在 repo 根目錄）
{
  "recommendations": [
    "astro-build.astro-vscode",               // Astro 語法支援
    "bradlc.vscode-tailwindcss",              // 若日後採用 Tailwind
    "davidanson.vscode-markdownlint",         // Markdown 格式檢查
    "streetsidesoftware.code-spell-checker",
    "eamodio.gitlens"
  ]
}
```

### 4.2 初始化步驟

```bash
# 1. Clone repository
git clone https://github.com/jasper-tw/thesowordcom.git
cd thesowordcom

# 2. 進入 Astro 專案目錄
cd soword

# 3. 安裝相依套件
pnpm install

# 4. 同步 Content Collections 型別（首次必須執行）
pnpm run sync

# 5. 啟動本地開發伺服器
pnpm run dev
# → 開啟 http://localhost:4321
```

### 4.3 常用開發指令

```bash
# 在 soword/ 目錄下執行

# 啟動開發伺服器（含熱重載）
pnpm run dev

# 建置靜態檔案（輸出至 ../dist/soword/）
pnpm run build

# 預覽建置結果（模擬正式環境）
pnpm run preview

# TypeScript 型別檢查（提交前建議執行）
pnpm run check

# 重新產生 Content Collections 型別
pnpm run sync
```

### 4.4 環境變數設定

```bash
# soword/.env.local（本地開發用，不提交至 git）
# 此檔已加入 .gitignore

# Decap CMS 本地測試用（選配）
PUBLIC_DECAP_BACKEND=test-repo
```

**`soword/.gitignore`**

```gitignore
# 建置輸出
dist/
.astro/

# 環境變數（絕對不提交）
.env
.env.local
.env.*.local

# 套件
node_modules/

# 編輯器
.vscode/settings.json
.idea/

# OS
.DS_Store
Thumbs.db
```

---

## 5. GitHub Actions CI/CD Pipeline

### 5.1 Repository Secrets 設定

前往 GitHub Repository → Settings → Secrets and variables → Actions，新增以下 Secrets：

| Secret 名稱 | 說明 | 範例格式 |
|-------------|------|----------|
| `AWS_ACCESS_KEY_ID` | IAM 使用者 Access Key ID | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | IAM 使用者 Secret Access Key | `wJalrXUtnFEMI/K7MDENG/...` |
| `AWS_REGION` | S3 Bucket 所在 AWS 區域 | `ap-northeast-1` |
| `S3_BUCKET_NAME` | S3 Bucket 名稱 | `thesoword-com` |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront Distribution ID | `E1PA6795UKMFR9` |

### 5.2 IAM Policy（最小權限原則）

在 AWS IAM 建立一個**專用的 Deployment 使用者**（不要用 root 帳號），並附加以下 Policy：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3SowordDeploy",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": [
        "arn:aws:s3:::thesoword-com",
        "arn:aws:s3:::thesoword-com/*"
      ]
    },
    {
      "Sid": "CloudFrontInvalidation",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
        "cloudfront:ListInvalidations"
      ],
      "Resource": "arn:aws:cloudfront::YOUR_ACCOUNT_ID:distribution/YOUR_DISTRIBUTION_ID"
    }
  ]
}
```

> 將 `YOUR_ACCOUNT_ID` 與 `YOUR_DISTRIBUTION_ID` 替換為實際值。

### 5.3 完整 GitHub Actions Workflow

**`soword/.github/workflows/deploy.yml`**

```yaml
name: Deploy 小書樓

# ── 觸發條件 ────────────────────────────────────────────────
on:
  push:
    branches:
      - main
    paths:
      # 只有以下路徑有變更時才觸發，避免修改主幹時重建小書樓
      - 'soword/**'
      - '.github/workflows/deploy.yml'

  # 允許從 GitHub Actions 頁面手動觸發（Debug 用）
  workflow_dispatch:
    inputs:
      invalidate_all:
        description: '是否清除 CloudFront 全站快取（通常不需要）'
        required: false
        default: 'false'
        type: boolean

# ── 並發控制：同時只允許一個 deploy，新的會取消舊的 ─────────
concurrency:
  group: deploy-soword-${{ github.ref }}
  cancel-in-progress: true

# ── 最小 Workflow 權限 ───────────────────────────────────────
permissions:
  contents: read

jobs:
  # ── Job 1: 建置 ──────────────────────────────────────────
  build:
    name: Build Astro Site
    runs-on: ubuntu-24.04
    timeout-minutes: 10

    outputs:
      artifact-name: soword-dist-${{ github.sha }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9
          run_install: false

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          cache-dependency-path: soword/pnpm-lock.yaml

      - name: Install dependencies
        working-directory: soword
        run: pnpm install --frozen-lockfile

      - name: Type check
        working-directory: soword
        run: pnpm run check

      - name: Build site
        working-directory: soword
        run: pnpm run build
        env:
          SITE: 'https://thesoword.com'

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: soword-dist-${{ github.sha }}
          path: dist/soword/
          retention-days: 7
          if-no-files-found: error

  # ── Job 2: 部署 ──────────────────────────────────────────
  deploy:
    name: Deploy to S3 + CloudFront
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    needs: build
    if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'

    environment:
      name: production
      url: https://thesoword.com

    steps:
      - name: Download build artifact
        uses: actions/download-artifact@v4
        with:
          name: ${{ needs.build.outputs.artifact-name }}
          path: dist/

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id:     ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region:            ${{ secrets.AWS_REGION }}

      # 分類型同步，讓瀏覽器與 CDN 對不同資源採用不同快取策略
      - name: Sync HTML files (no-cache)
        run: |
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET_NAME }}/ \
            --exclude "*" \
            --include "*.html" \
            --cache-control "public, max-age=0, must-revalidate" \
            --content-type "text/html; charset=utf-8" \
            --delete

      - name: Sync CSS and JS (long cache with content hash)
        run: |
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET_NAME }}/ \
            --exclude "*" \
            --include "*.css" \
            --include "*.js" \
            --include "*.mjs" \
            --cache-control "public, max-age=31536000, immutable" \
            --delete

      - name: Sync images and fonts
        # 封面圖使用固定檔名（非 content hash），若替換封面圖，
        # 快取 1 天後讀者即可看到新版本。
        # 若圖片改為透過 src/assets/ 走 Astro image 最佳化，
        # 可將 max-age 提升回 2592000（30天）。
        run: |
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET_NAME }}/ \
            --exclude "*" \
            --include "*.jpg" \
            --include "*.jpeg" \
            --include "*.png" \
            --include "*.webp" \
            --include "*.avif" \
            --include "*.svg" \
            --include "*.ico" \
            --include "*.woff" \
            --include "*.woff2" \
            --cache-control "public, max-age=86400" \
            --delete

      - name: Sync remaining files
        run: |
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET_NAME }}/ \
            --exclude "*.html" \
            --exclude "*.css" \
            --exclude "*.js" \
            --exclude "*.mjs" \
            --exclude "*.jpg" \
            --exclude "*.jpeg" \
            --exclude "*.png" \
            --exclude "*.webp" \
            --exclude "*.avif" \
            --exclude "*.svg" \
            --exclude "*.ico" \
            --exclude "*.woff" \
            --exclude "*.woff2" \
            --cache-control "public, max-age=3600" \
            --delete

      # HTML 快取 TTL 為 0（must-revalidate），CloudFront invalidation
      # 確保 CDN 邊緣節點也立即拿到最新版本
      - name: Invalidate CloudFront HTML cache
        run: |
          PATHS="/*.html /works/* /"
          if [ "${{ github.event.inputs.invalidate_all }}" = "true" ]; then
            PATHS="/*"
          fi
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths $PATHS

      - name: Deployment summary
        run: |
          echo "## 部署完成" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- **Commit:** \`${{ github.sha }}\`" >> $GITHUB_STEP_SUMMARY
          echo "- **觸發者:** ${{ github.actor }}" >> $GITHUB_STEP_SUMMARY
          echo "- **時間:** $(date -u '+%Y-%m-%d %H:%M:%S UTC')" >> $GITHUB_STEP_SUMMARY
          echo "- **網址:** [https://thesoword.com](https://thesoword.com)" >> $GITHUB_STEP_SUMMARY
```

### 5.4 PR Preview（選配）

**`soword/.github/workflows/preview.yml`**

```yaml
name: PR Preview Check

on:
  pull_request:
    branches: [main]
    paths:
      - 'soword/**'

jobs:
  build-check:
    name: Build Check (PR)
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          cache-dependency-path: soword/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
        working-directory: soword
      - run: pnpm run build
        working-directory: soword
```

---

## 6. AWS 設定

### 6.1 S3 Bucket 設定

#### 建立 Bucket

```bash
aws s3api create-bucket \
  --bucket thesoword-com \
  --region ap-northeast-1 \
  --create-bucket-configuration LocationConstraint=ap-northeast-1
```

#### Bucket 公開存取封鎖設定

本方案使用 **Origin Access Control（OAC）** 模式：S3 Bucket 不對公網開放，只允許特定 CloudFront Distribution 透過 Bucket Policy 讀取。CloudFront Service Principal 的存取不屬於「公開存取」，因此以下設定是正確的：

```bash
aws s3api put-public-access-block \
  --bucket thesoword-com \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

| 參數 | 值 | 說明 |
|------|-----|------|
| `BlockPublicAcls` | `true` | 禁止透過 ACL 公開存取（OAC 不需要 ACL） |
| `IgnorePublicAcls` | `true` | 忽略既有 ACL 設定 |
| `BlockPublicPolicy` | `false` | 允許 Bucket Policy 存在（CloudFront allow 需要這個） |
| `RestrictPublicBuckets` | `false` | 允許 Bucket Policy 中的非公開授權生效 |

> 若 `BlockPublicPolicy=true`，Bucket Policy 本身會被封鎖，導致 CloudFront 無法存取（403 錯誤）。

```bash
# 啟用版本控制（誤刪後可復原）
aws s3api put-bucket-versioning \
  --bucket thesoword-com \
  --versioning-configuration Status=Enabled

# 設定生命週期：舊版本保留 30 天後自動刪除
aws s3api put-bucket-lifecycle-configuration \
  --bucket thesoword-com \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "expire-old-versions",
      "Status": "Enabled",
      "Filter": {"Prefix": ""},
      "NoncurrentVersionExpiration": {
        "NoncurrentDays": 30
      }
    }]
  }'
```

#### S3 Bucket Policy（OAC 模式）

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::thesoword-com/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::YOUR_ACCOUNT_ID:distribution/YOUR_DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

> 將 `YOUR_ACCOUNT_ID` 與 `YOUR_DISTRIBUTION_ID` 替換為實際值。

### 6.2 CloudFront Distribution 設定

#### 建立 Origin Access Control

```bash
aws cloudfront create-origin-access-control \
  --origin-access-control-config '{
    "Name": "thesoword-oac",
    "Description": "OAC for thesoword.com S3 bucket",
    "SigningProtocol": "sigv4",
    "SigningBehavior": "always",
    "OriginAccessControlOriginType": "s3"
  }'
```

#### CloudFront Distribution 設定（完整 JSON）

```json
{
  "DistributionConfig": {
    "CallerReference": "thesoword-2026-06-01",
    "Comment": "thesoword.com 小書樓",
    "DefaultRootObject": "index.html",
    "Enabled": true,
    "HttpVersion": "http2and3",
    "IsIPV6Enabled": true,
    "PriceClass": "PriceClass_200",

    "Aliases": {
      "Quantity": 2,
      "Items": [
        "thesoword.com",
        "www.thesoword.com"
      ]
    },

    "ViewerCertificate": {
      "ACMCertificateArn": "arn:aws:acm:us-east-1:YOUR_ACCOUNT_ID:certificate/YOUR_CERT_ID",
      "SSLSupportMethod": "sni-only",
      "MinimumProtocolVersion": "TLSv1.2_2021",
      "CertificateSource": "acm"
    },

    "Origins": {
      "Quantity": 1,
      "Items": [
        {
          "Id": "S3-thesoword-com",
          "DomainName": "thesoword-com.s3.ap-northeast-1.amazonaws.com",
          "S3OriginConfig": {
            "OriginAccessIdentity": ""
          },
          "OriginAccessControlId": "YOUR_OAC_ID"
        }
      ]
    },

    "DefaultCacheBehavior": {
      "TargetOriginId": "S3-thesoword-com",
      "ViewerProtocolPolicy": "redirect-to-https",
      "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
      "Compress": true,
      "AllowedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"],
        "CachedMethods": {
          "Quantity": 2,
          "Items": ["GET", "HEAD"]
        }
      }
    },

    "CustomErrorResponses": {
      "Quantity": 2,
      "Items": [
        {
          "ErrorCode": 403,
          "ResponsePagePath": "/404.html",
          "ResponseCode": "404",
          "ErrorCachingMinTTL": 10
        },
        {
          "ErrorCode": 404,
          "ResponsePagePath": "/404.html",
          "ResponseCode": "404",
          "ErrorCachingMinTTL": 10
        }
      ]
    }
  }
}
```

> **PriceClass 說明：**
> - `PriceClass_200`：北美、歐洲、亞洲節點，對台灣讀者速度良好（預設建議）
> - `PriceClass_100`：僅北美+歐洲，費用較低但亞洲速度較慢
> - `PriceClass_All`：全球所有節點，速度最快但費用最高

### 6.3 ACM 憑證申請

```bash
# 憑證必須建立在 us-east-1（CloudFront 要求）
aws acm request-certificate \
  --region us-east-1 \
  --domain-name "thesoword.com" \
  --subject-alternative-names "www.thesoword.com" \
  --validation-method DNS
```

申請後在 ACM Console 取得 CNAME 驗證記錄，新增至 DNS 設定，等待憑證狀態變為 `ISSUED`。

### 6.4 DNS 設定（CNAME / Alias）

| 類型 | 名稱 | 值 |
|------|------|-----|
| CNAME 或 ALIAS | `thesoword.com` | `d1234abcdef.cloudfront.net` |
| CNAME | `www.thesoword.com` | `d1234abcdef.cloudfront.net` |

> 若 DNS 提供商支援 ALIAS / ANAME（如 Route 53），根網域建議用 ALIAS 而非 CNAME。

---

## 7. 發布文章 SOP

### 方法 A：透過 VS Code（本地）

**適用情境：** 文章較長、需要預覽排版效果

---

**步驟 1：更新本地 Repository**

```bash
cd /path/to/thesowordcom
git pull origin main
```

---

**步驟 2：建立章節檔案**

在 `soword/src/content/chapters/` 資料夾內，新增一個 `.md` 檔案。

檔名規則：`{work-slug}-ch{三位數}.md`，例如 `silent-echo-ch050.md`

---

**步驟 3：填寫 Frontmatter**

```markdown
---
title: "第五章 雨後"
work: "silent-echo"
chapter: 50
wordCount: 3200
publishedAt: 2026-06-02
---

在這裡開始寫正文...
```

---

**步驟 4：本地預覽（建議執行）**

```bash
cd soword
pnpm run dev
```

開啟 `http://localhost:4321`，確認排版正確。

---

**步驟 5：確認型別無誤**

```bash
pnpm run check
```

若顯示 `Found 0 errors.` 即可繼續。

---

**步驟 6：提交並推送**

```bash
cd ..  # 回到 repo 根目錄

git add soword/src/content/chapters/silent-echo-ch050.md

# 如有新增封面圖等資源，一並加入
# git add soword/public/images/covers/

git commit -m "feat(content): 新增《沉默的回聲》第五章「雨後」"

git push origin main  # 自動觸發 GitHub Actions
```

---

**步驟 7：確認部署狀態**

1. 前往 `https://github.com/你的帳號/thesowordcom/actions`
2. 確認最新的 workflow 執行成功（綠色勾勾）
3. 約 3–5 分鐘後，前往 `https://thesoword.com` 確認新章節出現

---

### 方法 B：透過 GitHub 網頁介面

**適用情境：** 臨時在外、手邊沒有本地環境

---

**步驟 1：開啟正確路徑**

前往：`https://github.com/你的帳號/thesowordcom/tree/main/soword/src/content/chapters/`

---

**步驟 2：新增檔案**

點擊右上角 **「Add file」→「Create new file」**

---

**步驟 3：填入檔名與內容**

- **Name your file：** 輸入 `silent-echo-ch050.md`（或對應章節）
- **正文區：** 貼入完整 Markdown 內容（含 frontmatter）

---

**步驟 4：提交**

滾動到下方 Commit changes 區塊：
- **Commit message：** `feat(content): 新增第五章「雨後」`
- **選擇：** Commit directly to the `main` branch
- 點擊 **Commit changes**

---

**步驟 5：確認部署狀態**

與方法 A 步驟 7 相同：前往 GitHub Actions 頁面確認執行成功，約 3–5 分鐘後在正式網址確認新章節出現。

---

### 方法 C：修改已發布章節

**適用情境：** 修正錯字、補充情節、調整語氣

---

**步驟 1：開啟並修改檔案**

用 VS Code 或 GitHub 網頁介面開啟對應的 `.md` 檔案並修改內容。

---

**步驟 2：更新 `updatedAt` 欄位**

手動將 frontmatter 中的 `updatedAt` 改為今日日期：

```markdown
---
title: "第五章 雨後"
work: "silent-echo"
chapter: 50
wordCount: 3250
publishedAt: 2026-06-02
updatedAt: 2026-06-10   ← 手動更新為修改日期
---
```

---

**步驟 3：提交推送**

```bash
git add soword/src/content/chapters/silent-echo-ch050.md
git commit -m "fix(content): 修正《沉默的回聲》第五章第三段錯字"
git push origin main
```

---

**快取說明：** HTML 檔案設定 `max-age=0, must-revalidate`，讀者下次開啟頁面時瀏覽器即會重新驗證，CloudFront invalidation 也會在部署後立即清除 CDN 快取。一般情況下，部署完成後讀者重新整理頁面即可看到最新版本。

---

### 新增整部新作品 SOP

```
1. 在 soword/src/content/works/ 下新增資料夾（使用作品 slug 命名）
2. 在資料夾內建立 index.md（填寫作品介紹 frontmatter，status 設為 "ongoing"）
3. 在 soword/src/content/chapters/ 建立第一章檔案
4. 若有封面圖，放入 soword/public/images/covers/
5. git add + git commit + git push
6. 等待部署完成（約 3–5 分鐘）
```

---

## 8. 版本控制策略

### 8.1 分支模型

```
main ─────────────────────────────────────────────────────►
  │                                                    (部署到正式站)
  │
  ├── feature/new-work-aurora     ← 開始新作品
  │   └── (PR → merge to main)
  │
  ├── fix/chapter-typo            ← 修正錯字
  │   └── (PR → merge to main)
  │
  └── chore/redesign-homepage     ← 大型改版
      └── (PR → merge to main)
```

**規則：**
- `main` 分支永遠是可部署狀態
- 一般新增或修改章節：**直接 push 到 main**（只是內容，風險極低）
- 改動 Astro 程式碼、版型、樣式：**開 feature branch + PR**，建置成功後再 merge

### 8.2 Commit Message 規範與 Tag 策略

採用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <description>

type 可用值：
  feat     - 新功能、新章節
  fix      - 修正錯誤（錯字、排版、bug）
  style    - 純樣式調整（不影響功能）
  refactor - 程式碼重構（功能不變）
  chore    - 維護性工作（更新套件等）
  docs     - 文件更新

scope（選填）：
  content  - 內容相關
  works    - 特定作品（可用作品名）
  layout   - 版型相關
  ci       - CI/CD 設定
  aws      - AWS 設定
```

**一部作品從開始到完結的 commit 與 tag 範例：**

```bash
# 開始連載
git commit -m "feat(works): 新增《沉默的回聲》作品介紹頁"
git commit -m "feat(content): 新增《沉默的回聲》第一章「潮聲」"

# 日常更新
git commit -m "feat(content): 新增《沉默的回聲》第五章「雨後」"
git commit -m "fix(content): 修正《沉默的回聲》第三章第二段排版錯誤"

# 樣式調整
git commit -m "style(layout): 調整閱讀頁行距為 1.8"

# 套件更新
git commit -m "chore: 升級 Astro 至 5.1.0"

# 作品完結：打 tag 留存里程碑
git tag -a "silent-echo-completed" -m "《沉默的回聲》完結，共 42 章"
git push origin silent-echo-completed

# 重大改版：打版本號
git tag -a "v2.0.0" -m "全站改版：新版型上線"
git push origin v2.0.0
```

---

## 9. 未來擴充建議

### 9.1 短期（3 個月內）

| 項目 | 優先度 | 預估工時 | 說明 |
|------|:------:|:--------:|------|
| RSS Feed | 高 | 2h | 使用 `@astrojs/rss`，讓讀者可用閱讀器訂閱（見附錄 D） |
| OG Image 自動生成 | 中 | 4h | 使用 Satori，每篇章節自動生成社群預覽圖 |
| 閱讀進度記憶 | 中 | 3h | 使用 `localStorage` 記錄上次閱讀位置，純前端不需後端 |
| 字數統計自動化 | 低 | 2h | 在 GitHub Actions 加入腳本自動計算並回填 `wordCount` |

### 9.2 中期（6 個月內）

| 項目 | 說明 |
|------|------|
| **Pagefind 全站搜尋** | 純靜態搜尋引擎，建置時自動建立索引，無需後端。`pnpm add @pagefind/default-ui`；`package.json` 的 build script 改為 `astro build && pagefind --site ../dist/soword` |
| **夜間模式** | CSS custom properties + `localStorage` 存偏好，零後端 |
| **閱讀字體切換** | 提供 2–3 種字體選項（明體/黑體），存入 `localStorage` |
| **章節評論** | 嵌入 [giscus](https://giscus.app/)（基於 GitHub Discussions），無需資料庫 |

### 9.3 長期（1 年以上）

| 項目 | 說明 | 技術選型建議 |
|------|------|-------------|
| **多語言版本** | 繁中 / 簡中 / 英文 | Astro i18n routing |
| **Podcast 配音版** | 有聲小說附加內容 | S3 存音檔 + 自訂 `<audio>` 播放器元件 |
| **讀者訂閱通知** | 新章節 Email 通知 | Buttondown 或 Mailchimp（免費方案） |
| **獨立 CMS 後台** | 若 Decap CMS 不夠用 | Keystatic（基於 git，無需資料庫） |
| **付費章節** | 若有商業化需求 | Lemon Squeezy + Edge Function 驗證 |

### 9.4 效能最佳化備忘

```javascript
// astro.config.mjs 可日後加入的最佳化選項
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  integrations: [sitemap()],
  image: {
    // 啟用圖片最佳化（自動轉 WebP/AVIF，並產生 content hash 檔名）
    // 注意：圖片需從 public/ 移至 src/assets/ 才能套用此最佳化
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
  prefetch: {
    // 預先載入連結，讓章節切換感覺瞬間
    defaultStrategy: 'viewport',
  },
  vite: {
    build: {
      chunkSizeWarningLimit: 1000,
    },
  },
});
```

### 9.5 費用估算參考

以每月 10 萬 PV、平均頁面大小 50KB 計算：

| 服務 | 預估月費 | 備註 |
|------|:--------:|------|
| S3 儲存（5GB） | ~$0.12 | 文字網站非常省 |
| S3 請求費 | ~$0.05 | CloudFront 快取後 Origin 請求極少 |
| CloudFront 流量（5GB）| ~$0.43 | 前 1TB 有免費額度 |
| ACM 憑證 | $0 | 完全免費 |
| GitHub Actions | $0 | Public repo 或免費方案的額度足夠 |
| **月費合計** | **~$0.60** | 流量極大時才需考慮費用 |

---

## 附錄 A：快速排錯指南

| 問題 | 可能原因 | 解決方法 |
|------|----------|----------|
| GitHub Actions 失敗 | `pnpm-lock.yaml` 不同步 | 本地執行 `pnpm install`，提交更新的 lock file |
| 部署後舊內容未更新（CDN） | CloudFront 快取 | 手動觸發 workflow 並勾選 `invalidate_all` |
| 部署後舊內容未更新（本地瀏覽器） | 瀏覽器本身的快取 | 強制重新整理：Windows 用 `Ctrl+Shift+R`，Mac 用 `Cmd+Shift+R` |
| 本地 `astro check` 報錯 | frontmatter 型別不符 | 對照 Section 3.1 的型別定義修正欄位 |
| S3 403 Forbidden | Bucket Policy 未更新 OAC ID | 重新套用 Section 6.1 的 Bucket Policy，確認 OAC ID 正確 |
| 章節順序錯亂 | `chapter` 欄位值重複 | 檢查同一作品下各章節的 `chapter` 值是否唯一 |
| 新作品不顯示 | `status: "draft"` | 改為 `status: "ongoing"` 或 `"completed"` |
| 草稿作品出現在正式站 | `getStaticPaths` 缺少 filter | 在所有 `getCollection('works', ...)` 呼叫加入 `data.status !== 'draft'` |

---

## 附錄 B：初次建站 Checklist

建議分兩個階段完成，避免一次面對過多設定而中途卡關。

### Phase 1：最小可行版本（先讓網站上線）

- [ ] 在 GitHub 建立 Repository
- [ ] 在 `soword/` 目錄初始化 Astro 專案（`pnpm create astro`）
- [ ] 複製 `astro.config.mjs`、`tsconfig.json` 設定
- [ ] 建立 `src/content/config.ts`（Content Collections 定義）
- [ ] 建立 `src/layouts/` 與 `src/pages/` 基本頁面（含 SEO meta）
- [ ] 建立 `.github/workflows/deploy.yml`
- [ ] 在 AWS 建立 S3 Bucket 並設定公開存取封鎖
- [ ] 申請 ACM 憑證（us-east-1）並驗證
- [ ] 建立 CloudFront Distribution 與 OAC
- [ ] 設定 S3 Bucket Policy（填入正確的 OAC ID 與 Account ID）
- [ ] 更新 DNS CNAME/ALIAS 記錄，等待生效

### Phase 2：完整設定（網站上線後補完）

- [ ] 在 GitHub Secrets 填入 5 個必要的 Secrets
- [ ] 建立 IAM 使用者並附加最小權限 Policy
- [ ] Push 第一個 commit，確認 Actions 成功執行
- [ ] 前往正式網址確認網站上線
- [ ] 確認 `sitemap.xml` 與 `robots.txt` 可正常存取
- [ ] 確認 RSS Feed 可正常存取（`/rss.xml`）

---

## 附錄 C：Decap CMS 設定（選配）

> **前置評估：** Decap CMS 的 OAuth 設定是整個方案中最複雜的一環（需要 Netlify Identity 帳號或自架 OAuth proxy），首次設定可能耗費數小時。若只是偶爾在外面更新，方法 B（GitHub 網頁介面）已完全足夠，不需要設定 Decap CMS。

### 前置設定（只需做一次）

1. 在 GitHub → Settings → Developer settings → OAuth Apps 新增一個 App
2. 在 Netlify 建立帳號，設定 Identity 服務作為 OAuth proxy
3. 完成以下 `config.yml`

**`soword/public/admin/config.yml`**

```yaml
backend:
  name: github
  repo: 你的帳號/thesowordcom
  branch: main
  base_url: https://api.netlify.com
  # 或自架 OAuth proxy

media_folder: soword/public/images/covers
public_folder: /images/covers

collections:
  - name: chapters
    label: "章節"
    label_singular: "章節"
    folder: soword/src/content/chapters
    create: true
    slug: "{{fields.work}}-ch{{fields.chapter}}"
    fields:
      - { label: "標題", name: title, widget: string }
      - { label: "所屬作品 slug", name: work, widget: string }
      - { label: "章節序號", name: chapter, widget: number, value_type: int }
      - { label: "字數", name: wordCount, widget: number, required: false }
      - { label: "發布日期", name: publishedAt, widget: datetime, format: "YYYY-MM-DD" }
      - { label: "正文", name: body, widget: markdown }
```

### 使用 Decap CMS 發文

1. 前往 `https://thesoword.com/admin/`
2. 登入 GitHub 帳號授權
3. 選擇「章節」→「New 章節」
4. 填寫各欄位
5. 點擊 **Publish** → 自動提交至 GitHub → 觸發部署

---

## 附錄 D：RSS Feed 實作範例

安裝套件（已包含在 `package.json` 中）：

```bash
pnpm add @astrojs/rss
```

**`soword/src/pages/rss.xml.js`**

```javascript
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const chapters = await getCollection('chapters');

  return rss({
    title: '小書樓',
    description: '勒索沃德的創作基地',
    site: context.site,
    items: chapters
      .sort((a, b) => b.data.publishedAt - a.data.publishedAt)
      .slice(0, 20)
      .map((chapter) => ({
        title: chapter.data.title,
        pubDate: chapter.data.publishedAt,
        link: `/works/${chapter.data.work}/${chapter.slug}/`,
      })),
    customData: '<language>zh-TW</language>',
  });
}
```

RSS Feed 網址：`https://thesoword.com/rss.xml`

讀者可將此網址加入任何 RSS 閱讀器（如 Feedly、NetNewsWire）以訂閱更新通知。
