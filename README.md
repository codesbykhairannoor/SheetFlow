# SheetFlow ⚡ — Live Google Sheets & CSV Data Sync for Canva

> **Real-time automated data synchronization and batch design workflow built natively for the Canva Apps SDK.**

---

## 🚀 Overview

**SheetFlow** solves the single biggest bottleneck for e-commerce sellers, restaurant owners, marketing agencies, and creators on Canva: **stale, manual design updates**.

Instead of exporting static CSV files and re-uploading them every time prices or data points change, **SheetFlow** connects directly to live Google Sheets and spreadsheets. With a single click (`Sync`), all mapped text fields, prices, discount badges, and dynamic image frames across your Canva designs update instantly.

---

## ✨ Key Features

1. **Zero-Config Google Sheets Live Sync:**
   - Paste any Google Sheets sharing link (`docs.google.com/spreadsheets/d/...`).
   - Automatically converts to live CSV streams with zero Google Cloud console or OAuth setup required.
2. **Instant Pre-loaded Presets (1-Click Demos):**
   - **E-Commerce Flash Sale:** Products, prices, discount badges, stock statuses, and product image links.
   - **Restaurant Menu & Daily Specials:** Dishes, categories, prices, calories, and allergen alerts.
   - **Real Estate Listings:** Property titles, neighborhoods, bedrooms, prices, and agent contacts.
   - **Social Media Daily Quotes:** Quotes, authors, topics, and hashtags for batch carousel generation.
3. **Interactive Canvas Field Mapper:**
   - Detects all column headers and data types (`text`, `number`, `currency`, `image_url`, `date`).
   - Click any column chip to inject a dynamic mustache tag `{{ColumnName}}` onto the canvas.
   - Or select an existing text box on the canvas and click a column to instantly bind it.
4. **1-Click Multi-Element Card Builder:**
   - Places a complete, pre-styled product or listing card (Title, Price, Image) onto the canvas with a single button press.
5. **Dynamic Asset Upload & Insertion:**
   - Automatically uploads image URLs from your spreadsheet directly into Canva's media library using `@canva/asset` and injects them into your layout.
6. **Live Data Memory Cache & Table Preview:**
   - Interactive compact data table with active row pointer navigation (`Row #1 of N`).
7. **Production Monetization Hooks:**
   - Built-in Pro upgrade flow ready for Stripe / Lemon Squeezy integration (`@canva/platform.requestOpenExternalUrl`).

---

## 🛠️ Architecture & Tech Stack

* **Framework:** React 19, TypeScript
* **Canva SDK Libraries:**
  * `@canva/apps-sdk` (v2.15.0)
  * `@canva/app-ui-kit` (Native Canva Design Tokens & UI Components)
  * `@canva/design` (`addElementAtPoint`, `addElementAtCursor`, `useSelection`)
  * `@canva/asset` (Media upload pipeline)
  * `@canva/app-hooks` (`useFeatureSupport`, `useSelection`)
  * `@canva/platform` (`requestOpenExternalUrl`)
* **Parsing Engine:** `papaparse` (MIT License) with custom Google Sheets URL transformer
* **Bundler:** `@rspack/core` via `@canva/app-scripts`

---

## 🏁 Quickstart: Running in Canva Development Mode

### 1. Start the Local Development Server
```bash
npm start
```
The local development server will start and serve your app at `http://localhost:8080`.

### 2. Connect to Canva Developer Portal
1. Open the [Canva Developer Portal](https://www.canva.dev/).
2. Click **Your Apps** -> Select or Create your app.
3. Under **App Source**, select **Development URL** and enter:
   ```
   http://localhost:8080
   ```
4. Click **Preview** to open any Canva design.
5. SheetSync Live will appear in the left-hand sidebar under the **Apps** panel!

---

## 🧪 Testing & Building

* **Run Unit Tests:**
  ```bash
  npm run test
  ```
* **Type-check TypeScript:**
  ```bash
  npm run lint:types
  ```
* **Build Production Bundle:**
  ```bash
  npm run build
  ```

---

## 📄 License

Licensed under the **Canva Platform License** and **MIT License** for third-party libraries.
