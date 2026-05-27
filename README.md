# Webify - Online Code Editor for Web Development with Live Preview

## 🚀 Overview

A sleek and powerful browser-based IDE for HTML, CSS, and JavaScript development. This project uses **Next.js**, **Monaco Editor**, and **iframes** to provide an instant live preview of your code as you type.

## 🎯 Objective

Create a responsive, user-friendly platform where users can:

* Write HTML, CSS, and JS in separate editors
* Instantly see the output in a live preview window
* Share code instantly via a shareable URL 
* Optionally save and manage snippets with cloud storage


## 🛠️ Tech Stack

* **Framework**: Next.js 15 (App Router)
* **Language**: TypeScript 5
* **Code Editor**: Monaco Editor 0.52
* **Styling**: Tailwind CSS 4
* **UI Components**: shadcn/ui + Radix UI
* **Icons**: Lucide React
* **Toasts**: Sonner
* **File Bundling**: JSZip
* **Preview Engine**: HTML `<iframe>`



## 📚 Features

* 🔹 Real-time Live Preview (HTML/CSS/JS)
* 🔹 Monaco Editor Integration (syntax highlighting, autocompletion)
* 🔹 Responsive Layout (Side-by-side & full preview modes)
* 🔹 Template Support (start with boilerplates)
* 🔹 URL-based Code Sharing (base64-encoded, no login needed)


## 🧩 Folder Structure

This project uses the **Next.js App Router** (not Pages Router or Create React App).

```
app/
├── layout.tsx              # Root layout, fonts, metadata, Toaster
├── page.tsx                # Main editor page (all state lives here)
├── globals.css             # Tailwind base styles + CSS variables
└── components/
    └── monaco-editor.tsx   # Monaco wrapper — client-only (ssr: false)

components/
└── ui/                     # shadcn/ui components
    ├── button.tsx
    ├── badge.tsx
    ├── tabs.tsx
    ├── select.tsx
    ├── separator.tsx
    ├── sonner.tsx          # Toaster (theme-aware)
    └── copy-button.tsx

lib/
└── utils.ts                # tailwind-merge utility (cn)

public/                     # Static assets
components.json             # shadcn/ui config
next.config.ts
tsconfig.json

```

## 🚧 Future Enhancements

* ⏳ User Authentication
* 🌩 Cloud-based snippet management
* 🌐 Collaborative coding support
* 🧠 AI-based code suggestions


## 📦 Installation

> Requires **Node.js 18.18 or later**. Check your version with `node -v`.

```bash
git clone https://github.com/Debmallya-03/Webify.git
cd Webify
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 💖 Contributors

Thanks to all the amazing people who contribute to **Webify** 🚀

<p align="center">
  <a href="https://github.com/Debmallya-03/Webify/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=Debmallya-03/Webify" alt="Contributors"/>
  </a>
</p>

<br>

## ⭐ Project Support

<p align="center">
  <a href="https://github.com/Debmallya-03/Webify/stargazers">
    <img src="https://img.shields.io/github/stars/Debmallya-03/Webify?style=social" alt="Stars">
  </a>
  &nbsp;&nbsp;
  <a href="https://github.com/Debmallya-03/Webify/network/members">
    <img src="https://img.shields.io/github/forks/Debmallya-03/Webify?style=social" alt="Forks">
  </a>
</p>

---

> Created with ❤️ by [Debmallya Bhandari](https://github.com/Debmallya-03)
