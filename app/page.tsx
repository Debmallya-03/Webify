"use client"

//(after "use client", before imports)
const safeBase64Encode = (str: string) =>
  btoa(unescape(encodeURIComponent(str)));

const safeBase64Decode = (str: string) =>
  decodeURIComponent(escape(atob(str)));


import type React from "react"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

import { CopyButton } from "@/components/ui/copy-button"
import { CommandPalette, type Command } from "@/components/ui/command-palette"

import {
  Code2,
  Play,
  Download,
  Upload,
  Layout,
  Maximize2,
  Minimize2,
  FileText,
  Palette,
  Zap,
  Sun,
  Moon,
  Search,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Timer,
} from "lucide-react"
import { toast } from 'sonner'


import JSZip from "jszip"
import dynamic from "next/dynamic"
import Link from "next/link"
// Monaco Editor must be loaded client-side only.
// It directly accesses browser APIs (window, Worker) that don't exist in Node.
// Removing `ssr: false` or moving this import to a Server Component will
// cause a hydration crash. Keep this dynamic import exactly as-is.
// Dynamically import Monaco Editor to avoid SSR issues
const MonacoEditor = dynamic(() => import("./components/monaco-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800">Loading editor...</div>
  ),
})

interface CodeContent {
  html: string
  css: string
  javascript: string
}

interface HtmlValidationResult {
  isValid: boolean
  message?: string
}

const voidHtmlTags = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
])

function createPreviewErrorHtml(message: string) {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>HTML Syntax Error</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            font-family: Arial, sans-serif;
            background: #fef2f2;
            color: #991b1b;
          }
          .panel {
            max-width: 640px;
            padding: 24px;
            margin: 24px;
            border: 1px solid #fecaca;
            border-radius: 16px;
            background: white;
            box-shadow: 0 12px 40px rgba(153, 27, 27, 0.12);
          }
          h1 {
            margin: 0 0 12px;
            font-size: 20px;
          }
          p {
            margin: 0;
            line-height: 1.6;
            white-space: pre-wrap;
          }
        </style>
      </head>
      <body>
        <div class="panel">
          <h1>HTML syntax error</h1>
          <p>${message}</p>
        </div>
      </body>
    </html>
  `
}

function validateHtmlSyntax(html: string): HtmlValidationResult {
  let sanitizedHtml = html.replace(/<!--[\s\S]*?-->/g, "")

  sanitizedHtml = sanitizedHtml.replace(
    /<(script|style|textarea|title)\b([^>]*)>[\s\S]*?<\/\1>/gi,
    (_match, tagName, attributes) => `<${tagName}${attributes}></${tagName}>`
  )

  const tagPattern = /<\/?([a-zA-Z][\w:-]*)([^>]*)>/g
  const openTags: string[] = []
  let match: RegExpExecArray | null

  while ((match = tagPattern.exec(sanitizedHtml))) {
    const [fullTag, rawTagName] = match
    const tagName = rawTagName.toLowerCase()
    const isClosingTag = fullTag.startsWith("</")
    const isSelfClosingTag = fullTag.endsWith("/>") || voidHtmlTags.has(tagName)

    if (isClosingTag) {
      const lastOpenTag = openTags.pop()
      if (!lastOpenTag) {
        return { isValid: false, message: `Unexpected closing tag </${tagName}>.` }
      }

      if (lastOpenTag !== tagName) {
        return {
          isValid: false,
          message: `Expected </${lastOpenTag}> before </${tagName}>.`,
        }
      }

      continue
    }

    if (!isSelfClosingTag) {
      openTags.push(tagName)
    }
  }

  if (openTags.length > 0) {
    const lastOpenTag = openTags[openTags.length - 1]
    return {
      isValid: false,
      message: `Unclosed <${lastOpenTag}> tag.`,
    }
  }

  return { isValid: true }
}

interface Template {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  content: CodeContent
}

const templates: Template[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Start with empty files",
    icon: <FileText className="w-4 h-4" />,
    content: {
      html: '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>My Project</title>\n</head>\n<body>\n    <h1>Hello World!</h1>\n</body>\n</html>',
      css: "/* Add your styles here */\nbody {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n    background-color: #f5f5f5;\n}\n\nh1 {\n    color: #333;\n    text-align: center;\n}",
      javascript: '// Add your JavaScript here\nconsole.log("Hello World!");',
    },
  },
  {
    id: "landing-page",
    name: "Landing Page",
    description: "Modern landing page template",
    icon: <Layout className="w-4 h-4" />,
    content: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Modern Landing Page</title>
</head>
<body>
    <header class="header">
        <nav class="nav">
            <div class="logo">Brand</div>
            <ul class="nav-links">
                <li><a href="#home">Home</a></li>
                <li><a href="#features">Features</a></li>
                <li><a href="#about">About</a></li>
                <li><a href="#testimonials">Testimonials</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
        </nav>
    </header>
    
    <main class="hero" id="home">
        <div class="hero-content">
            <h1 class="hero-title">Welcome to the Future</h1>
            <p class="hero-subtitle">Build amazing things with our platform</p>
            <button class="cta-button" onclick="handleCTA()">Get Started</button>
        </div>
    </main>

    <section id="features" class="section features">
        <div class="container">
            <h2 class="section-title">Amazing Features</h2>
            <p class="section-subtitle">Everything you need to build high-performance applications with ease</p>
            <div class="features-grid">
                <div class="feature-card">
                    <div class="feature-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                    </div>
                    <h3>Lightning Fast</h3>
                    <p>Experience blazing-fast render times and optimized resource delivery for peak performance.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    </div>
                    <h3>Secure by Design</h3>
                    <p>Your data is protected with end-to-end encryption, strict compliance, and active threat monitoring.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                    </div>
                    <h3>Advanced Analytics</h3>
                    <p>Gain deeper insights into user engagement, system health, and growth metrics in real-time.</p>
                </div>
            </div>
        </div>
    </section>

    <section id="about" class="section about">
        <div class="container about-container">
            <div class="about-content">
                <h2 class="section-title text-center">About Our Platform</h2>
                <p>We are dedicated to building a platform that empowers developers and creators. By focusing on cutting-edge technologies, we eliminate complex configurations so you can focus purely on what matters: your code.</p>
                <p>Our platform handles scaling, global CDN edge caching, and automated builds, allowing you to deploy dynamic, beautiful web applications with just one click.</p>
                <div class="about-points">
                    <div class="about-point">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <span>Collaborative developer workflows</span>
                    </div>
                    <div class="about-point">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <span>Automatic scaling & edge routing</span>
                    </div>
                    <div class="about-point">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <span>Integrated analytics and logging</span>
                    </div>
                </div>
            </div>
            
        </div>
    </section>

    <section id="testimonials" class="section testimonials">
        <div class="container">
            <h2 class="section-title">What Our Users Say</h2>
            <p class="section-subtitle">Join thousands of developers and teams already building the future on our platform</p>
            <div class="testimonials-grid">
                <div class="testimonial-card">
                    <div class="stars">★★★★★</div>
                    <p class="testimonial-text">"Brand has completely transformed our workflow. The setup was instant, and the interface is incredibly smooth. Deploying landing pages takes seconds now!"</p>
                    <div class="user-info">
                        <div class="avatar">SC</div>
                        <div>
                            <h4>Sarah Connor</h4>
                            <span>Lead Architect, TechCorp</span>
                        </div>
                    </div>
                </div>
                <div class="testimonial-card">
                    <div class="stars">★★★★★</div>
                    <p class="testimonial-text">"The performance boost we saw after migrating to this platform was unbelievable. Plus, the built-in analytics are actually useful rather than bloated."</p>
                    <div class="user-info">
                        <div class="avatar">DM</div>
                        <div>
                            <h4>David Miller</h4>
                            <span>Product Manager, Innovate</span>
                        </div>
                    </div>
                </div>
                <div class="testimonial-card">
                    <div class="stars">★★★★★</div>
                    <p class="testimonial-text">"Support is responsive, the documentation is clear, and the developer experience is unmatched. I can't recommend this platform enough."</p>
                    <div class="user-info">
                        <div class="avatar">ER</div>
                        <div>
                            <h4>Elena Rostova</h4>
                            <span>CTO, FutureFlow</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <footer id="contact" class="footer">
        <div class="container footer-container">
            <div class="footer-brand">
                <div class="logo">Brand</div>
                <p>Building the future of web apps, one pixel at a time. Empowering developer teams globally.</p>
                <div class="social-icons">
                    <a href="#" class="social-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg>
                    </a>
                    <a href="#" class="social-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                    </a>
                    <a href="#" class="social-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
                    </a>
                </div>
            </div>
            <div class="footer-links">
                <h4>Navigation</h4>
                <ul>
                    <li><a href="#home">Home</a></li>
                    <li><a href="#features">Features</a></li>
                    <li><a href="#about">About</a></li>
                    <li><a href="#testimonials">Testimonials</a></li>
                </ul>
            </div>
            <div class="footer-links">
                <h4>Support</h4>
                <ul>
                    <li><a href="#">Documentation</a></li>
                    <li><a href="#">Community Forum</a></li>
                    <li><a href="#">System Status</a></li>
                    <li><a href="#">Privacy Policy</a></li>
                </ul>
            </div>
            <div class="footer-links">
                <h4>Contact</h4>
                <ul>
                    <li>Email: [EMAIL_ADDRESS]</li>
                    <li>Phone: +91 [PHONE]</li>
                    <li>Location: India</li>
                </ul>
            </div>
        </div>
        <div class="footer-bottom">
            <div class="container footer-bottom-container">
                <p>&copy; 2026 Brand Inc. All rights reserved.</p>
                <div class="footer-legal">
                    <a href="#">Privacy Policy</a>
                    <span>&middot;</span>
                    <a href="#">Terms of Service</a>
                </div>
            </div>
        </div>
    </footer>
</body>
</html>`,
      css: `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
}

.header {
    color: white;
    background: #130a2e;
    padding: 1rem 0;
    position: fixed;
    width: 100%;
    top: 0;
    z-index: 1000;
}

.nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
}

.logo {
    font-size: 1.5rem;
    font-weight: bold;
}

.nav-links {
    display: flex;
    list-style: none;
    gap: 2rem;
}

.nav-links a {
    color: white;
    text-decoration: none;
    transition: opacity 0.3s;
}

.nav-links a:hover {
    opacity: 0.8;
}

.hero {
    height: 100vh;
    background-color: #130a2e;
    background-image: 
        radial-gradient(circle at 15% 50%, rgba(102, 126, 234, 0.15), transparent 25%),
        radial-gradient(circle at 85% 30%, rgba(118, 75, 162, 0.15), transparent 25%);
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: white;
    position: relative;
    overflow: hidden;
}

.hero-content {
    max-width: 600px;
    padding: 2rem;
    position: relative;
    z-index: 1;
}

.hero-title {
    font-size: 4rem;
    font-weight: 800;
    margin-bottom: 1.25rem;
    background: linear-gradient(to right, #ffffff, #c5bedb);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: fadeInUp 1s ease-out;
}

.hero-subtitle {
    font-size: 1.25rem;
    color: #c5bedb;
    margin-bottom: 2.5rem;
    animation: fadeInUp 1s ease-out 0.2s both;
}

.cta-button {
    color: #130a2e;
    font-weight: 700;
    border: none;
    padding: 1rem 2.5rem;
    font-size: 1.1rem;
    border-radius: 50px;
    cursor: pointer;
    transition: all 0.3s ease;
    animation: fadeInUp 1s ease-out 0.4s both;
}

.cta-button:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 15px 25px -5px rgba(102, 126, 234, 0.6);
}

.section {
    padding: 6rem 2rem;
    background: #130a2e;
    color: #ffffff;
    display: flex;
    justify-content: center;
    align-items: center;
    scroll-margin-top: 70px;
}

.container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
}

.section-title {
    font-size: 2.5rem;
    text-align: center;
    margin-bottom: 0.5rem;
    color: #ffffff;
    font-weight: 800;
}

.section-title.text-left {
    text-align: left;
}

.section-subtitle {
    font-size: 1.1rem;
    text-align: center;
    color: #c5bedb;
    margin-bottom: 3.5rem;
    max-width: 700px;
    margin-left: auto;
    margin-right: auto;
}

.features {
    background: #130a2e;
}

.features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2.5rem;
}

.feature-card {
    background: #21134a;
    border: 1px solid #3c257d;
    border-radius: 20px;
    padding: 2.5rem 2rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.feature-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 15px 35px -10px rgba(102, 126, 234, 0.3);
    border-color: #667eea;
}

.feature-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 50px;
    height: 50px;
    border-radius: 12px;
    background: rgba(102, 126, 234, 0.15);
    color: #00f2fe;
    margin-bottom: 1.5rem;
    transition: all 0.3s ease;
}

.feature-card:hover .feature-icon {
    background: linear-gradient(135deg, #00f2fe 0%, #667eea 100%);
    color: #130a2e;
}

.feature-card h3 {
    font-size: 1.35rem;
    margin-bottom: 0.75rem;
    color: #ffffff;
    font-weight: 700;
}

.feature-card p {
    color: #c5bedb;
    font-size: 0.95rem;
    line-height: 1.6;
}

.about {
    background: #170d37;
}

.about-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 800px;
    margin: 0 auto;
}

.about-content h2 {
    margin-bottom: 1.5rem;
}

.about-content p {
    color: #c5bedb;
    font-size: 1.05rem;
    line-height: 1.7;
    margin-bottom: 1.5rem;
}

.about-points {
    margin-top: 2rem;
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
}

.about-point {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.check-icon {
    color: #00f2fe;
    flex-shrink: 0;
}

.about-point span {
    font-size: 0.95rem;
    font-weight: 600;
    color: #ffffff;
}

/* Cleaned up removed SVG wrapper classes */

.testimonials {
    background: #130a2e;
}

.testimonials-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 2.5rem;
}

.testimonial-card {
    background: #21134a;
    border: 1px solid #3c257d;
    border-radius: 20px;
    padding: 2.5rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: all 0.3s ease;
}

.testimonial-card:hover {
    box-shadow: 0 15px 35px -10px rgba(102, 126, 234, 0.3);
    border-color: #667eea;
}

.stars {
    color: #f59e0b;
    font-size: 1.1rem;
    margin-bottom: 1rem;
}

.testimonial-text {
    font-size: 1rem;
    color: #c5bedb;
    font-style: italic;
    line-height: 1.6;
    margin-bottom: 2rem;
}

.user-info {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.9rem;
}

.user-info h4 {
    font-size: 0.95rem;
    color: #ffffff;
    margin-bottom: 0.15rem;
}

.user-info span {
    font-size: 0.8rem;
    color: #c5bedb;
}

.footer {
    background: #0b061d;
    color: #a59ec0;
    padding: 5rem 2rem 2rem;
    border-top: 1px solid #21134a;
}

.footer-container {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1.2fr;
    gap: 4rem;
    margin-bottom: 4rem;
}

.footer-brand {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

.footer-brand .logo {
    color: white;
}

.footer-brand p {
    font-size: 0.95rem;
    line-height: 1.6;
    max-width: 320px;
}

.social-icons {
    display: flex;
    gap: 1rem;
}

.social-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #21134a;
    color: #a59ec0;
    transition: all 0.3s ease;
}

.social-icon:hover {
    background: linear-gradient(135deg, #00f2fe 0%, #667eea 100%);
    color: #130a2e;
    transform: translateY(-3px);
}

.footer-links h4 {
    color: white;
    font-size: 1.05rem;
    font-weight: 600;
    margin-bottom: 1.5rem;
}

.footer-links ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.footer-links a {
    color: #a59ec0;
    text-decoration: none;
    font-size: 0.95rem;
    transition: color 0.3s ease;
}

.footer-links a:hover {
    color: white;
}

.footer-links li {
    font-size: 0.95rem;
    line-height: 1.5;
}

.footer-bottom {
    border-top: 1px solid #21134a;
    padding-top: 2rem;
}

.footer-bottom-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.875rem;
}

.footer-legal {
    display: flex;
    gap: 1rem;
    align-items: center;
}

.footer-legal a {
    color: #a59ec0;
    text-decoration: none;
    transition: color 0.3s ease;
}

.footer-legal a:hover {
    color: white;
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@media (max-width: 968px) {
    .footer-container {
        grid-template-columns: 1fr 1fr;
        gap: 3rem;
    }
}

@media (max-width: 768px) {
/* About section media queries removed as it is now centered by default */
    .section {
        padding: 4rem 1.5rem;
    }
    .footer-container {
        grid-template-columns: 1fr;
        gap: 2.5rem;
    }
    .footer-bottom-container {
        flex-direction: column;
        text-align: center;
    }
}
`,
      javascript: `function handleCTA() {
    alert('Welcome! This is where you would redirect to signup or more info.');
}

// Add smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});

/* Interactive effects script removed */`,
    },
  },
  {
    id: "interactive-card",
    name: "Interactive Card",
    description: "Animated card component",
    icon: <Palette className="w-4 h-4" />,
    content: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive Card</title>
</head>
<body>
    <div class="container">
        <div class="card" id="interactiveCard">
            <div class="card-header">
                <h2>Interactive Card</h2>
                <span class="status">Active</span>
            </div>
            <div class="card-content">
                <p>Hover over me to see the magic happen!</p>
                <div class="stats">
                    <div class="stat">
                        <span class="stat-number">42</span>
                        <span class="stat-label">Projects</span>
                    </div>
                    <div class="stat">
                        <span class="stat-number">1.2k</span>
                        <span class="stat-label">Users</span>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <button class="btn-primary" onclick="handleAction()">Take Action</button>
                <button class="btn-secondary">Learn More</button>
            </div>
        </div>
    </div>
</body>
</html>`,
      css: `body {
    margin: 0;
    padding: 0;
    min-height: 100vh;
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
}

.container {
    perspective: 1000px;
}

.card {
    width: 350px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 20px;
    padding: 2rem;
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
    cursor: pointer;
    position: relative;
    overflow: hidden;
}

.card::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    transition: left 0.5s;
}

.card:hover::before {
    left: 100%;
}

.card:hover {
    transform: translateY(-10px) rotateX(5deg);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}

.card-header h2 {
    margin: 0;
    font-size: 1.5rem;
}

.status {
    background: #4ade80;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 600;
}

.card-content p {
    margin-bottom: 1.5rem;
    opacity: 0.9;
    line-height: 1.6;
}

.stats {
    display: flex;
    gap: 2rem;
    margin-bottom: 1.5rem;
}

.stat {
    text-align: center;
}

.stat-number {
    display: block;
    font-size: 2rem;
    font-weight: bold;
    color: #4ade80;
}

.stat-label {
    font-size: 0.9rem;
    opacity: 0.8;
}

.card-footer {
    display: flex;
    gap: 1rem;
}

.btn-primary, .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s ease;
    flex: 1;
}

.btn-primary {
    background: #4ade80;
    color: #1f2937;
}

.btn-primary:hover {
    background: #22c55e;
    transform: translateY(-2px);
}

.btn-secondary {
    background: transparent;
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
}

.btn-secondary:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
}`,
      javascript: `function handleAction() {
    const card = document.getElementById('interactiveCard');
    
    // Add a pulse effect
    card.style.animation = 'pulse 0.6s ease-in-out';
    
    // Show success message
    setTimeout(() => {
        alert('Action completed successfully!');
        card.style.animation = '';
    }, 600);
}

// Add CSS animation dynamically
const style = document.createElement('style');
style.textContent = \`
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
\`;
document.head.appendChild(style);

// Add particle effect on hover
document.addEventListener('DOMContentLoaded', function() {
    const card = document.getElementById('interactiveCard');
    
    card.addEventListener('mouseenter', function() {
        createParticles();
    });
});

function createParticles() {
    const container = document.querySelector('.container');
    
    for (let i = 0; i < 6; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = \`
            position: absolute;
            width: 4px;
            height: 4px;
            background: #4ade80;
            border-radius: 50%;
            pointer-events: none;
            animation: float 2s ease-out forwards;
            left: \${Math.random() * 100}%;
            top: \${Math.random() * 100}%;
        \`;
        
        container.appendChild(particle);
        
        setTimeout(() => {
            particle.remove();
        }, 2000);
    }
}

// Add float animation
const floatStyle = document.createElement('style');
floatStyle.textContent = \`
    @keyframes float {
        0% {
            opacity: 1;
            transform: translateY(0px);
        }
        100% {
            opacity: 0;
            transform: translateY(-50px);
        }
    }
\`;
document.head.appendChild(floatStyle);`,
    },
  },
  {
    id: "todo-app",
    name: "Todo App",
    description: "Interactive todo application",
    icon: <Zap className="w-4 h-4" />,
    content: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Todo App</title>
</head>
<body>
    <div class="app">
        <div class="container">
            <h1>My Todo App</h1>
            <div class="input-section">
                <input type="text" id="todoInput" placeholder="Add a new task..." />
                <button onclick="addTodo()">Add</button>
            </div>
            <div class="filters">
                <button class="filter-btn active" onclick="filterTodos('all')">All</button>
                <button class="filter-btn" onclick="filterTodos('active')">Active</button>
                <button class="filter-btn" onclick="filterTodos('completed')">Completed</button>
            </div>
            <ul id="todoList" class="todo-list"></ul>
            <div class="stats">
                <span id="todoCount">0 tasks remaining</span>
                <button onclick="clearCompleted()">Clear Completed</button>
            </div>
        </div>
    </div>
</body>
</html>`,
      css: `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    padding: 2rem;
}

.app {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    min-height: 100vh;
}

.container {
    background: white;
    border-radius: 15px;
    padding: 2rem;
    width: 100%;
    max-width: 500px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
}

h1 {
    text-align: center;
    color: #333;
    margin-bottom: 2rem;
    font-size: 2rem;
}

.input-section {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
}

#todoInput {
    flex: 1;
    padding: 1rem;
    border: 2px solid #e1e5e9;
    border-radius: 10px;
    font-size: 1rem;
    outline: none;
    transition: border-color 0.3s;
}

#todoInput:focus {
    border-color: #667eea;
}

.input-section button {
    padding: 1rem 1.5rem;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.3s;
}

.input-section button:hover {
    background: #5a67d8;
}

.filters {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    justify-content: center;
}

.filter-btn {
    padding: 0.5rem 1rem;
    border: 2px solid #e1e5e9;
    background: white;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.3s;
}

.filter-btn.active,
.filter-btn:hover {
    background: #667eea;
    color: white;
    border-color: #667eea;
}

.todo-list {
    list-style: none;
    margin-bottom: 1.5rem;
}

.todo-item {
    display: flex;
    align-items: center;
    padding: 1rem;
    border: 1px solid #e1e5e9;
    border-radius: 10px;
    margin-bottom: 0.5rem;
    transition: all 0.3s;
    animation: slideIn 0.3s ease-out;
}

.todo-item:hover {
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.todo-item.completed {
    opacity: 0.6;
    text-decoration: line-through;
}

.todo-checkbox {
    margin-right: 1rem;
    width: 20px;
    height: 20px;
    cursor: pointer;
}

.todo-text {
    flex: 1;
    font-size: 1rem;
}

.delete-btn {
    background: #ef4444;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.3s;
}

.delete-btn:hover {
    background: #dc2626;
}

.stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 1rem;
    border-top: 1px solid #e1e5e9;
    color: #666;
}

.stats button {
    background: transparent;
    border: 1px solid #e1e5e9;
    padding: 0.5rem 1rem;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.3s;
}

.stats button:hover {
    background: #f3f4f6;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateX(-20px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}`,
      javascript: `let todos = [];
let currentFilter = 'all';

function addTodo() {
    const input = document.getElementById('todoInput');
    const text = input.value.trim();
    
    if (text === '') return;
    
    const todo = {
        id: Date.now(),
        text: text,
        completed: false
    };
    
    todos.push(todo);
    input.value = '';
    renderTodos();
    updateStats();
}

function deleteTodo(id) {
    todos = todos.filter(todo => todo.id !== id);
    renderTodos();
    updateStats();
}

function toggleTodo(id) {
    const todo = todos.find(todo => todo.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        renderTodos();
        updateStats();
    }
}

function filterTodos(filter) {
    currentFilter = filter;
    
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderTodos();
}

function clearCompleted() {
    todos = todos.filter(todo => !todo.completed);
    renderTodos();
    updateStats();
}

function renderTodos() {
    const todoList = document.getElementById('todoList');
    let filteredTodos = todos;
    
    if (currentFilter === 'active') {
        filteredTodos = todos.filter(todo => !todo.completed);
    } else if (currentFilter === 'completed') {
        filteredTodos = todos.filter(todo => todo.completed);
    }
    
    todoList.innerHTML = filteredTodos.map(todo => \`
        <li class="todo-item \${todo.completed ? 'completed' : ''}">
            <input 
                type="checkbox" 
                class="todo-checkbox" 
                \${todo.completed ? 'checked' : ''}
                onchange="toggleTodo(\${todo.id})"
            />
            <span class="todo-text">\${todo.text}</span>
            <button class="delete-btn" onclick="deleteTodo(\${todo.id})">Delete</button>
        </li>
    \`).join('');
}

function updateStats() {
    const activeTodos = todos.filter(todo => !todo.completed).length;
    const todoCount = document.getElementById('todoCount');
    todoCount.textContent = \`\${activeTodos} task\${activeTodos !== 1 ? 's' : ''} remaining\`;
}

// Add enter key support
document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('todoInput');
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addTodo();
        }
    });
    
    // Add some sample todos
    todos = [
        { id: 1, text: 'Learn HTML, CSS, and JavaScript', completed: true },
        { id: 2, text: 'Build an awesome todo app', completed: false },
        { id: 3, text: 'Share your creation with friends', completed: false }
    ];
    
    renderTodos();
    updateStats();
});`,
    },
  },
  {
    id: "stopwatch",
    name: "Stopwatch",
    description: "Simple stopwatch with start, stop and reset",
    icon: <Timer className="w-4 h-4" />,
    content: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stopwatch</title>
</head>
<body>
    <div class="container">
        <h1>Stopwatch</h1>
        <div class="display" id="display">00:00:00</div>
        <div class="buttons">
            <button onclick="startStop()" id="startBtn">Start</button>
            <button onclick="reset()">Reset</button>
        </div>
    </div>
</body>
</html>`,
      css: `body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1a1a2e, #16213e);
    font-family: 'Segoe UI', sans-serif;
}
.container { text-align: center; color: white; }
h1 { font-size: 2rem; margin-bottom: 1rem; letter-spacing: 4px; text-transform: uppercase; }
.display { font-size: 5rem; font-weight: bold; margin: 2rem 0; color: #00d4ff; letter-spacing: 4px; }
.buttons { display: flex; gap: 1rem; justify-content: center; }
button { padding: 1rem 2.5rem; font-size: 1rem; border: none; border-radius: 50px; cursor: pointer; font-weight: 600; transition: all 0.3s; background: #00d4ff; color: #1a1a2e; }
button:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,212,255,0.3); }`,
      javascript: `let timer = null;
let seconds = 0;
let running = false;
function startStop() {
    const btn = document.getElementById('startBtn');
    if (running) { clearInterval(timer); btn.textContent = 'Start'; running = false; }
    else { timer = setInterval(() => { seconds++; updateDisplay(); }, 1000); btn.textContent = 'Stop'; running = true; }
}
function reset() {
    clearInterval(timer); seconds = 0; running = false;
    document.getElementById('startBtn').textContent = 'Start';
    updateDisplay();
}
function updateDisplay() {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    document.getElementById('display').textContent =
        String(hrs).padStart(2,'0')+':'+String(mins).padStart(2,'0')+':'+String(secs).padStart(2,'0');
}`,
    },
  },
]

type LayoutType = "split" | "preview" | "code"

export default function CodeEditor() {
  const [code, setCode] = useState<CodeContent>(() => {
    if (typeof window === 'undefined') return templates[0].content
    try {
      const urlParams = new URLSearchParams(window.location.search)
      const sharedCode = urlParams.get('code')
      if (sharedCode) return JSON.parse(safeBase64Decode(sharedCode)) as CodeContent
    } catch {
      // invalid share URL — fall through
    }
    try {
      const saved = localStorage.getItem('webify_code')
      if (saved) return JSON.parse(saved) as CodeContent
    } catch {
      // corrupted storage — fall through
    }
    return templates[0].content
  })

  const [layout, setLayout] = useState<LayoutType>("split")
  const [activeTab, setActiveTab] = useState<keyof CodeContent>("html")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [autoRun, setAutoRun] = useState(true)

  const [splitRatio, setSplitRatio] = useState(50)
  const isDragging = useRef(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const [fontSize, setFontSize] = useState<number>(14)

  // use effect for handling full screen mode
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleFullscreenToggle = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.error("Error attempting to toggle fullscreen:", err);
      setIsFullscreen((prev) => !prev);
    }
  };

const containerRef = useRef<HTMLDivElement>(null)
const previewRef = useRef<HTMLIFrameElement>(null)
const handleDragStart = () => {
  isDragging.current = true;
  setIsResizing(true);
  document.body.style.userSelect = "none";
};

const handleDragMove = useCallback((clientX: number, clientY: number) => {
  if (!isDragging.current || !containerRef.current) return;

  const rect = containerRef.current.getBoundingClientRect();
  const isMobile = window.innerWidth < 768; // Tailwind 'md' breakpoint

  let newRatio;
  if (isMobile) {
    newRatio = ((clientY - rect.top) / rect.height) * 100;
  } else {
    newRatio = ((clientX - rect.left) / rect.width) * 100;
  }

  const clampedRatio = Math.max(20, Math.min(80, newRatio));
  setSplitRatio(clampedRatio);
}, []);

const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
  handleDragMove(e.clientX, e.clientY);
}, [handleDragMove]);

const handleTouchMove = useCallback((e: globalThis.TouchEvent) => {
  if (isDragging.current) {
    handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
  }
}, [handleDragMove]);

const handleDragEnd = useCallback(() => {
  isDragging.current = false;
  setIsResizing(false);
  document.body.style.userSelect = "auto";
  document.body.style.cursor = "default";
}, []);

  // Tracks which template is currently active
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null)

  // Per-template memory: stores the user's last-edited code for each template
  const [templateSnapshots, setTemplateSnapshots] = useState<Record<string, CodeContent>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const saved = localStorage.getItem('webify_template_snapshots')
      if (saved) return JSON.parse(saved) as Record<string, CodeContent>
    } catch {
      // corrupted storage — fall through
    }
    return {}
  })


  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleDragEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [handleMouseMove, handleTouchMove, handleDragEnd]);

  const activeEditorRef = useRef<{
    focus: () => void
    trigger: (source: string, handlerId: string, payload?: unknown) => void
  } | null>(null)

  const codeRef = useRef<CodeContent>(code)
  const htmlValidation = useMemo(() => validateHtmlSyntax(code.html), [code.html])
  // Keep codeRef in sync so beforeunload always has the latest values
  useEffect(() => {
    codeRef.current = code
  }, [code])


  // Auto-save code to localStorage, debounced 500ms
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('webify_code', JSON.stringify(code))
      } catch (err) {
        // QuotaExceededError — localStorage full, fail silently
        console.warn('Webify: auto-save failed', err)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [code])

useEffect(() => {
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleDragEnd);
  window.addEventListener("touchmove", handleTouchMove, { passive: false });
  window.addEventListener("touchend", handleDragEnd);

  return () => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleDragEnd);
    window.removeEventListener("touchmove", handleTouchMove);
    window.removeEventListener("touchend", handleDragEnd);
  };
}, [handleMouseMove, handleTouchMove, handleDragEnd]);

  // Column resizer: start dragging handler for desktop resizer
  const handleMouseDown = () => {
    handleDragStart()
    document.body.style.cursor = "col-resize"
  }


  // Auto-save per-template snapshots to localStorage, debounced 500ms
useEffect(() => {
  const timer = setTimeout(() => {
    try {
      localStorage.setItem('webify_template_snapshots', JSON.stringify(templateSnapshots))
    } catch (err) {
      console.warn('Webify: template snapshot save failed', err)
    }
  }, 500)
  return () => clearTimeout(timer)
}, [templateSnapshots])

  // empty deps — registers once, codeRef keeps values fresh
  // Initialize theme from storage/preferences on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches

    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      setTheme("dark")
      document.documentElement.classList.add("dark")
    } else {
      setTheme("light")
      document.documentElement.classList.remove("dark")
    }
  }, [])

  const toggleTheme = () => {
    if (theme === "light") {
      setTheme("dark")
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      setTheme("light")
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }

  useEffect(() => {
    if (!previewRef.current) return
    if (!autoRun) return

    if (!htmlValidation.isValid) {
      previewRef.current.srcdoc = createPreviewErrorHtml(htmlValidation.message ?? "Invalid HTML syntax.")
      return
    }

    const combinedCode = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Live Preview</title>
        <style>${code.css}</style>
      </head>
      <body>
        ${code.html}
        <script>
          (function() {
            var _killTimer = setTimeout(function() {
              document.body.innerHTML = '<div style="padding:20px;color:red;font-family:monospace;font-size:14px;">⚠️ Script timed out after 5 seconds — possible infinite loop.</div>';
            }, 5000);
            try {
              ${code.javascript}
            } catch(e) {
              clearTimeout(_killTimer);
              var el = document.createElement('div');
              el.style.cssText = 'padding:20px;color:red;font-family:monospace;font-size:14px;';
              el.textContent = '⚠️ JS Error: ' + e.message;
              document.body.appendChild(el);
              return;
            }
            clearTimeout(_killTimer);
          })();
        <\/script>
      </body>
      </html>
    `
        
    
    const blob = new Blob([combinedCode], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    previewRef.current.src = url

    return () => URL.revokeObjectURL(url)
  }, [code, htmlValidation, autoRun])

  const runCodeManually = () => {
    if (!previewRef.current) return

    if (!htmlValidation.isValid) {
      previewRef.current.srcdoc = createPreviewErrorHtml(
        htmlValidation.message ?? "Invalid HTML syntax."
      )
      return
    }

    const combinedCode = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Live Preview</title>
      <style>${code.css}</style>
    </head>
    <body>
      ${code.html}
      <script>
        (function() {
          var _killTimer = setTimeout(function() {
            document.body.innerHTML = '<div style="padding:20px;color:red;font-family:monospace;font-size:14px;">⚠️ Script timed out after 5 seconds — possible infinite loop.</div>';
          }, 5000);
          try {
            ${code.javascript}
          } catch(e) {
            clearTimeout(_killTimer);
            var el = document.createElement('div');
            el.style.cssText = 'padding:20px;color:red;font-family:monospace;font-size:14px;';
            el.textContent = '⚠️ JS Error: ' + e.message;
            document.body.appendChild(el);
            return;
          }
          clearTimeout(_killTimer);
        })();
      <\/script>
    </body>
    </html>
  `

    const blob = new Blob([combinedCode], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    previewRef.current.src = url
  }

  const handleCodeChange = (language: keyof CodeContent, value: string) => {
    setCode((prev) => ({ ...prev, [language]: value }))
  }

  // AFTER
const loadTemplate = (template: Template) => {
  // Save the current template's edits before switching away
  if (currentTemplateId) {
    setTemplateSnapshots(prev => ({ ...prev, [currentTemplateId]: code }))
  }

  // Restore the user's last edits for this template, or fall back to its default content
  const savedSnapshot = templateSnapshots[template.id]
  setCode(savedSnapshot ?? template.content)
  setCurrentTemplateId(template.id)

  toast("Template loaded", {
    description: `${template.name} template has been loaded successfully.`,
  })
}


  const downloadCode = async () => {
    const zip = new JSZip();

    zip.file("index.html", `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Project</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
${code.html}
    <script src="script.js"></script>
</body>
</html>`);

    zip.file("style.css", code.css);
    zip.file("script.js", code.javascript);

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "webify-project.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast("Download started", {
      description: "Your project has been downloaded as webify-project.zip",
    });
  }

  const importCode = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".html"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const content = e.target?.result as string
          // Basic parsing - in a real app, you'd want more sophisticated parsing
          const htmlMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
          const cssMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
          const jsMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/i)

          setCode({
            html: htmlMatch ? htmlMatch[1].trim() : "",
            css: cssMatch ? cssMatch[1].trim() : "",
            javascript: jsMatch ? jsMatch[1].trim() : "",
          })

          toast("File imported", {
            description: "HTML file has been imported successfully.",
          });

        }
        reader.readAsText(file)
      }
    }
    input.click()
  }
  const resetCode = () => {
    if (window.confirm("Reset all editors to empty? This cannot be undone.")) {
      setCode({ html: "", css: "", javascript: "" })
      setCurrentTemplateId(null)
      setTemplateSnapshots({})
      localStorage.removeItem("webify_code")
      localStorage.removeItem("webify_template_snapshots")
      toast("Reset successful", {
        description: "All editors have been cleared.",
      })
    }
  }

  // Load shared code from URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const sharedCode = urlParams.get("code")

    if (sharedCode) {
      try {
        const decoded = JSON.parse(safeBase64Decode(sharedCode))
        setCode(decoded)
        toast("Shared code loaded", {
          description: "The shared code has been loaded successfully.",
        });

      } catch (err) {
        console.error("Clipboard copy failed:", err);
        toast.error("Invalid share link", {
          description: "Could not load shared code.",
        });

      }
    }
  }, [])

  const copyShareLink = async () => {
    if (typeof window === "undefined") return
    try {
      const url = `${window.location.origin}?code=${safeBase64Encode(
        JSON.stringify({ html: code.html, css: code.css, javascript: code.javascript }),
      )}`
      await navigator.clipboard.writeText(url)
      toast("Link copied", { description: "Shareable link copied to clipboard." })
    } catch (err) {
      console.error("Clipboard copy failed:", err)
      toast.error("Copy failed", { description: "Could not copy the share link." })
    }
  }

  const commands = useMemo<Command[]>(() => {
    const layoutCmd = (
      id: string,
      label: string,
      value: LayoutType,
      icon: React.ReactNode,
    ): Command => ({
      id,
      label,
      group: "Layout",
      icon,
      keywords: "view layout panel",
      description: layout === value ? "Active" : undefined,
      perform: () => setLayout(value),
    })

    const tabCmd = (
      id: string,
      label: string,
      value: keyof CodeContent,
      icon: React.ReactNode,
    ): Command => ({
      id,
      label,
      group: "Editor",
      icon,
      keywords: "tab file language",
      description: activeTab === value ? "Active" : undefined,
      perform: () => {
        setActiveTab(value)
        if (layout === "preview") setLayout("split")
      },
    })

    return [
      layoutCmd("layout-code", "Code only", "code", <Code2 className="w-4 h-4" />),
      layoutCmd("layout-split", "Split view", "split", <Layout className="w-4 h-4" />),
      layoutCmd("layout-preview", "Preview only", "preview", <Play className="w-4 h-4" />),

      tabCmd("tab-html", "Go to HTML", "html", <FileText className="w-4 h-4" />),
      tabCmd("tab-css", "Go to CSS", "css", <Palette className="w-4 h-4" />),
      tabCmd("tab-js", "Go to JavaScript", "javascript", <Zap className="w-4 h-4" />),

      {
        id: "editor-undo",
        label: "Undo",
        group: "Editor",
        icon: <Undo2 className="w-4 h-4" />,
        keywords: "ctrl z revert history undo",
        perform: () => {
          const ed = activeEditorRef.current
          if (ed) {
            ed.focus()
            ed.trigger("palette", "undo", null)
          } else if (layout === "preview") {
            setLayout("split")
          }
        },
      },
      {
        id: "editor-redo",
        label: "Redo",
        group: "Editor",
        icon: <Redo2 className="w-4 h-4" />,
        keywords: "ctrl y ctrl shift z history redo",
        perform: () => {
          const ed = activeEditorRef.current
          if (ed) {
            ed.focus()
            ed.trigger("palette", "redo", null)
          } else if (layout === "preview") {
            setLayout("split")
          }
        },
      },

      {
        id: "action-import",
        label: "Import HTML file",
        group: "Actions",
        icon: <Upload className="w-4 h-4" />,
        keywords: "open upload load",
        perform: importCode,
      },
      {
        id: "action-download",
        label: "Download project",
        group: "Actions",
        icon: <Download className="w-4 h-4" />,
        keywords: "export save html",
        perform: downloadCode,
      },
      {
        id: "action-share",
        label: "Copy shareable link",
        group: "Actions",
        icon: <LinkIcon className="w-4 h-4" />,
        keywords: "url clipboard share",
        perform: copyShareLink,
      },
      {
        id: "action-open-tab",
        label: "Open preview in new tab",
        group: "Actions",
        icon: <Maximize2 className="w-4 h-4" />,
        keywords: "window external browser",
        perform: () => {
          if (previewRef.current?.src) window.open(previewRef.current.src, "_blank")
        },
      },
      {
        id: "action-fullscreen",
        label: isFullscreen ? "Exit fullscreen" : "Enter fullscreen",
        group: "Actions",
        icon: isFullscreen ? (
          <Minimize2 className="w-4 h-4" />
        ) : (
          <Maximize2 className="w-4 h-4" />
        ),
        keywords: "expand maximize zoom",
        perform: handleFullscreenToggle,
      },
      {
        id: "action-theme",
        label: theme === "light" ? "Switch to dark mode" : "Switch to light mode",
        group: "Actions",
        icon: theme === "light" ? (
          <Moon className="w-4 h-4" />
        ) : (
          <Sun className="w-4 h-4" />
        ),
        keywords: "appearance dark light color",
        perform: toggleTheme,
      },

      ...templates.map<Command>((t) => ({
        id: `template-${t.id}`,
        label: t.name,
        description: t.description,
        group: "Templates",
        icon: t.icon,
        keywords: `template starter ${t.name}`,
        perform: () => loadTemplate(t),
      })),
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, activeTab, theme, isFullscreen, code])


  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        e.stopPropagation()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem("webify-font-size")
    if (saved) setFontSize(Number(saved))
  }, [])

  return (
    <>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />
      <div className={`h-screen flex flex-col bg-gray-50 dark:bg-gray-900 ${isFullscreen ? "fixed inset-0 z-50" : ""}`}>
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
         <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 w-full">
           <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <Link href="/" className="flex items-center gap-2 cursor-pointer">
                <Code2 className="w-6 h-6 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Webify</h1>
              </Link>

              <Select onValueChange={(value) => loadTemplate(templates.find((t) => t.id === value)!)}>
           <SelectTrigger className="w-[200px] sm:w-[210px] md:w-[240px] max-w-full min-w-0 overflow-hidden">
 <div className="flex items-center overflow-hidden min-w-0 w-full">
  <span className="truncate block w-full">
    <SelectValue placeholder="Choose template" />
  </span>
</div>
</SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <span className="shrink-0">{template.icon}</span>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{template.name}</div>
                          <div className="text-xs text-gray-500 truncate">{template.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaletteOpen(true)}
                title="Command palette (Ctrl/Cmd + K)"
                className="hidden sm:flex w-72 justify-start text-gray-500 dark:text-gray-400"
              >
                <Search className="w-4 h-4 mr-2" />
                Search commands...
                <kbd className="ml-auto hidden rounded border border-gray-200 px-1.5 py-0.5 text-[10px] sm:inline-block dark:border-gray-600">
                  ⌘K
                </kbd>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Layout Controls */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <Button variant={layout === "code" ? "default" : "ghost"} size="sm" onClick={() => setLayout("code")}>
                  <Code2 className="w-4 h-4" />
                </Button>
                <Button variant={layout === "split" ? "default" : "ghost"} size="sm" onClick={() => setLayout("split")}>
                  <Layout className="w-4 h-4" />
                </Button>
                <Button
                  variant={layout === "preview" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setLayout("preview")}
                >
                  <Play className="w-4 h-4" />
                </Button>
              </div>

              <Separator orientation="vertical" className="h-6" />
              
              {/* Action Buttons */}
              <Button variant="outline" size="sm" onClick={resetCode}>
                <Undo2 className="w-4 h-4 mr-2" />
                Reset
              </Button>
              
              {/* Action Buttons */}
              <Button variant="outline" size="sm" onClick={importCode}>
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>

              <Button variant="outline" size="sm" onClick={downloadCode}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>

              <CopyButton
                text={
                  typeof window !== "undefined"
                    ? `${window.location.origin}?code=${safeBase64Encode(
                      JSON.stringify({
                        html: code.html,
                        css: code.css,
                        javascript: code.javascript,
                      })
                    )}`
                    : ""
                }
              />

              <Button variant="outline" size="sm" onClick={handleFullscreenToggle}>
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              
              {/* Font Size Control */}
              <div className="flex items-center gap-1 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1">
                <button
                  onClick={() => {
                    const newSize = Math.max(10, fontSize - 1)
                    setFontSize(newSize)
                    localStorage.setItem("webify-font-size", String(newSize))
                  }}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-mono text-sm w-4 text-center"
                  title="Decrease font size"
                >
                  −
                </button>
                <span className="text-xs text-gray-600 dark:text-gray-400 font-mono w-6 text-center">{fontSize}</span>
                <button
                  onClick={() => {
                    const newSize = Math.min(24, fontSize + 1)
                    setFontSize(newSize)
                    localStorage.setItem("webify-font-size", String(newSize))
                  }}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-mono text-sm w-4 text-center"
                  title="Increase font size"
                >
                  +
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={toggleTheme}
                title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
              >
                {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />}
              </Button>
            </div>
          </div>
        </header>

        
        {/* Main Container - Code Editor + Preview */}
        <div
          ref={containerRef}
          className="flex-1 flex overflow-hidden"
        >
          {/* CODE EDITOR */}
          {(layout === "code" || layout === "split") && (
  <div
  style={
    layout === "split"
      ? { 
        width: isMobile ? "100%" : `${splitRatio}%`,
        height: isMobile ? `${splitRatio}%` : "100%",
        }
      : { height: "100%", width: "100%" }
  }
  className="flex flex-col border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 shrink-0 transition-none"
  >
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as keyof CodeContent)}
      className="flex-1 flex flex-col"
    >
      {/* Tabs Header */}
      <div className="bg-white dark:bg-gray-800 border-b px-4 overflow-x-auto scrollbar-hide">
        <TabsList className="flex w-full min-w-max">
        <TabsTrigger value="html" className="flex-1">HTML</TabsTrigger>
        <TabsTrigger value="css" className="flex-1">CSS</TabsTrigger>
          <TabsTrigger value="javascript" className="flex-1">JS</TabsTrigger>
                  
        </TabsList>
      </div>

      {/* Tabs Content */}
      <div className="flex-1 overflow-hidden">
        <TabsContent value="html" className="h-full m-0">
          <MonacoEditor
            language="html"
            value={code.html}
            onChange={(value) => handleCodeChange("html", value)}
            theme={theme}
            fontSize={fontSize}
            onEditorReady={(ed) => (activeEditorRef.current = ed)}
          />
        </TabsContent>

        <TabsContent value="css" className="h-full m-0">
          <MonacoEditor
            language="css"
            value={code.css}
            onChange={(value) => handleCodeChange("css", value)}
            theme={theme}
            fontSize={fontSize}
            onEditorReady={(ed) => (activeEditorRef.current = ed)}
          />
        </TabsContent>

        <TabsContent value="javascript" className="h-full m-0">
          <MonacoEditor
            language="javascript"
            value={code.javascript}
            onChange={(value) => handleCodeChange("javascript", value)}
            theme={theme}
            fontSize={fontSize}
            onEditorReady={(ed) => (activeEditorRef.current = ed)}
          />
        </TabsContent>
      </div>
    </Tabs>
  </div>
)}

          {/* RESIZER - DESKTOP ONLY */}
          {layout === "split" && !isMobile && (
            <div
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              onDragStart={(e) => e.preventDefault()}
              className="w-1 cursor-col-resize bg-gray-300 dark:bg-gray-600 hover:bg-blue-500 active:bg-blue-600 transition shrink-0 z-10"
            />
          )}

          {/* PREVIEW PANEL */}
          {(layout === "preview" || layout === "split") && (
            <div
              style={
                layout === "split" && !isMobile
                  ? { width: `${100 - splitRatio}%` }
                  : layout === "split" && isMobile
                    ? { height: `${100 - splitRatio}%` }
                    : { height: "100%", width: "100%" }
              }
              className="flex flex-col shrink-0 relative transition-none"
            >
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2 sm:p-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Play className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="font-medium text-gray-900 dark:text-white">Live Preview</span>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {autoRun ? "Auto-refresh" : "Manual"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAutoRun(!autoRun)}
                    className="shrink-0"
                  >
                    {autoRun ? "Pause" : "Resume"}
                  </Button>
                  {!autoRun && (
                    <Button size="sm" onClick={runCodeManually} className="shrink-0">
                      Run
                    </Button>
                  )}
                </div>
              </div>

              <div
                className={`flex-1 bg-white dark:bg-gray-900 relative ${
                  isResizing ? "pointer-events-none" : ""
                }`}
              >
                <iframe
                  ref={previewRef}
                  className="absolute inset-0 w-full h-full border-0"
                  title="Live Preview"
                  sandbox="allow-scripts allow-forms allow-popups allow-modals"
                />
                {isResizing && (
                  <div className="absolute inset-0 z-20 cursor-row-resize md:cursor-col-resize" />
                )}
              </div>
            </div>
          )}
        </div>


      </div>
    </>
  )
}
