"use client"

const safeBase64Encode = (str: string) =>
  btoa(unescape(encodeURIComponent(str)));

const safeBase64Decode = (str: string) =>
  decodeURIComponent(escape(atob(str)));

import type React from "react"
import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { CopyButton } from "@/components/ui/copy-button"
import { CommandPalette, type Command } from "@/components/ui/command-palette"
import {
  Code2, Play, Download, Upload, Layout, Maximize2, Minimize2,
  FileText, Palette, Zap, Sun, Moon, Search, Link as LinkIcon,
  Undo2, Redo2, Timer, MoreHorizontal, X, LogIn, UserPlus,
} from "lucide-react"
import { toast } from "sonner"
import * as prettier from 'prettier'
import parserHtml from 'prettier/plugins/html'
import parserCss from 'prettier/plugins/postcss'
import parserBabel from 'prettier/plugins/babel'
import parserEstree from 'prettier/plugins/estree'
import JSZip from "jszip"
import dynamic from "next/dynamic"
import Link from "next/link"
import {
  EditorErrorBoundary,
  PreviewErrorBoundary,
  AppErrorBoundary,
} from "./components/error-boundary"
import AIAssistant from "./components/AIAssistant"

const MonacoEditor = dynamic(() => import("./components/monaco-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800 text-sm text-gray-500">
      Loading editor...
    </div>
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
  "area","base","br","col","embed","hr","img","input","link","meta",
  "param","source","track","wbr",
])

function createPreviewErrorHtml(message: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Arial,sans-serif;background:#fef2f2;color:#991b1b}.panel{max-width:640px;padding:24px;margin:24px;border:1px solid #fecaca;border-radius:16px;background:white;box-shadow:0 12px 40px rgba(153,27,27,0.12)}h1{margin:0 0 12px;font-size:20px}p{margin:0;line-height:1.6;white-space:pre-wrap}</style></head><body><div class="panel"><h1>HTML syntax error</h1><p>${message}</p></div></body></html>`
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
      if (!lastOpenTag) return { isValid: false, message: `Unexpected closing tag </${tagName}>.` }
      if (lastOpenTag !== tagName) return { isValid: false, message: `Expected </${lastOpenTag}> before </${tagName}>.` }
      continue
    }
    if (!isSelfClosingTag) openTags.push(tagName)
  }
  if (openTags.length > 0) return { isValid: false, message: `Unclosed <${openTags[openTags.length - 1]}> tag.` }
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
        id: "interactive-card-2",
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
    id: "interactive-card",
    name: "Interactive Card",
    description: "Animated card component",
    icon: <Palette className="w-4 h-4" />,
    content: {
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Card</title></head><body><div class="container"><div class="card" id="card"><div class="card-header"><h2>Interactive Card</h2><span class="status">Active</span></div><div class="card-content"><p>Hover over me!</p><div class="stats"><div class="stat"><span class="stat-number">42</span><span class="stat-label">Projects</span></div><div class="stat"><span class="stat-number">1.2k</span><span class="stat-label">Users</span></div></div></div><div class="card-footer"><button onclick="handleAction()">Take Action</button></div></div></div></body></html>`,
      css: `body{margin:0;min-height:100vh;background:linear-gradient(135deg,#1e3c72,#2a5298);font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center}.card{width:350px;background:rgba(255,255,255,0.1);backdrop-filter:blur(10px);border-radius:20px;padding:2rem;color:white;border:1px solid rgba(255,255,255,0.2);transition:all 0.3s ease;cursor:pointer}.card:hover{transform:translateY(-10px);box-shadow:0 20px 40px rgba(0,0,0,0.3)}.card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem}.status{background:#4ade80;padding:.25rem .75rem;border-radius:20px;font-size:.8rem}.stats{display:flex;gap:2rem;margin-bottom:1.5rem}.stat-number{display:block;font-size:2rem;font-weight:bold;color:#4ade80}.card-footer button{width:100%;padding:.75rem;background:#4ade80;color:#1f2937;border:none;border-radius:10px;cursor:pointer;font-weight:600}`,
      javascript: `function handleAction(){const card=document.getElementById('card');card.style.animation='pulse 0.6s';setTimeout(()=>{alert('Action!');card.style.animation=''},600)}const s=document.createElement('style');s.textContent='@keyframes pulse{0%{transform:scale(1)}50%{transform:scale(1.05)}100%{transform:scale(1)}}';document.head.appendChild(s)`,
    },
  },
  {
    id: "todo-app",
    name: "Todo App",
    description: "Interactive todo application",
    icon: <Zap className="w-4 h-4" />,
    content: {
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Todo</title></head><body><div class="app"><div class="container"><h1>Todo App</h1><div class="input-section"><input type="text" id="todoInput" placeholder="Add a task..."/><button onclick="addTodo()">Add</button></div><ul id="todoList" class="todo-list"></ul><div class="stats"><span id="todoCount">0 remaining</span><button onclick="clearCompleted()">Clear Done</button></div></div></div></body></html>`,
      css: `*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;padding:2rem}.container{background:white;border-radius:15px;padding:2rem;max-width:500px;margin:0 auto}h1{text-align:center;color:#333;margin-bottom:2rem}.input-section{display:flex;gap:.5rem;margin-bottom:1.5rem}#todoInput{flex:1;padding:1rem;border:2px solid #e1e5e9;border-radius:10px;font-size:1rem;outline:none}.input-section button{padding:1rem 1.5rem;background:#667eea;color:white;border:none;border-radius:10px;cursor:pointer}.todo-item{display:flex;align-items:center;padding:1rem;border:1px solid #e1e5e9;border-radius:10px;margin-bottom:.5rem}.todo-checkbox{margin-right:1rem;width:20px;height:20px}.todo-text{flex:1}.delete-btn{background:#ef4444;color:white;border:none;padding:.5rem 1rem;border-radius:5px;cursor:pointer}.completed{opacity:.6;text-decoration:line-through}.stats{display:flex;justify-content:space-between;padding-top:1rem;border-top:1px solid #e1e5e9}.stats button{background:transparent;border:1px solid #e1e5e9;padding:.5rem 1rem;border-radius:5px;cursor:pointer}`,
      javascript: `let todos=[{id:1,text:'Learn HTML & CSS',completed:true},{id:2,text:'Build a todo app',completed:false}];function addTodo(){const i=document.getElementById('todoInput');const t=i.value.trim();if(!t)return;todos.push({id:Date.now(),text:t,completed:false});i.value='';render()}function deleteTodo(id){todos=todos.filter(t=>t.id!==id);render()}function toggleTodo(id){const t=todos.find(t=>t.id===id);if(t)t.completed=!t.completed;render()}function clearCompleted(){todos=todos.filter(t=>!t.completed);render()}function render(){document.getElementById('todoList').innerHTML=todos.map(t=>\`<li class="todo-item \${t.completed?'completed':''}"><input type="checkbox" class="todo-checkbox" \${t.completed?'checked':''} onchange="toggleTodo(\${t.id})"/><span class="todo-text">\${t.text}</span><button class="delete-btn" onclick="deleteTodo(\${t.id})">Delete</button></li>\`).join('');document.getElementById('todoCount').textContent=\`\${todos.filter(t=>!t.completed).length} remaining\`}document.addEventListener('DOMContentLoaded',()=>{document.getElementById('todoInput').addEventListener('keypress',e=>{if(e.key==='Enter')addTodo()});render()})`,
    },
  },
  {
    id: "stopwatch",
    name: "Stopwatch",
    description: "Simple stopwatch",
    icon: <Timer className="w-4 h-4" />,
    content: {
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Stopwatch</title></head><body><div class="container"><h1>Stopwatch</h1><div class="display" id="display">00:00:00</div><div class="buttons"><button onclick="startStop()" id="startBtn">Start</button><button onclick="reset()">Reset</button></div></div></body></html>`,
      css: `body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a1a2e,#16213e);font-family:'Segoe UI',sans-serif}.container{text-align:center;color:white}h1{font-size:2rem;margin-bottom:1rem;letter-spacing:4px;text-transform:uppercase}.display{font-size:5rem;font-weight:bold;margin:2rem 0;color:#00d4ff;letter-spacing:4px}.buttons{display:flex;gap:1rem;justify-content:center}button{padding:1rem 2.5rem;font-size:1rem;border:none;border-radius:50px;cursor:pointer;font-weight:600;background:#00d4ff;color:#1a1a2e;transition:all 0.3s}button:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(0,212,255,0.3)}`,
      javascript: `let timer=null,seconds=0,running=false;function startStop(){const b=document.getElementById('startBtn');if(running){clearInterval(timer);b.textContent='Start';running=false}else{timer=setInterval(()=>{seconds++;update()},1000);b.textContent='Stop';running=true}}function reset(){clearInterval(timer);seconds=0;running=false;document.getElementById('startBtn').textContent='Start';update()}function update(){const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60;document.getElementById('display').textContent=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}`,
    },
  },
  {
    id: "login-form",
    name: "Login Form",
    description: "Animated glassmorphism login",
    icon: <LogIn className="w-4 h-4" />,
    content: {
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Login</title></head><body><div class="blobs"><div class="blob blob-1"></div><div class="blob blob-2"></div><div class="blob blob-3"></div></div><div class="container"><form class="login-form" id="loginForm"><div class="logo">✦</div><h2>Welcome Back</h2><p class="subtitle">Sign in to continue</p><div class="input-group"><input type="text" id="email" required><label for="email">Email address</label></div><div class="input-group"><input type="password" id="password" required><label for="password">Password</label><button type="button" class="toggle-pwd" id="togglePwd">👁</button></div><div class="actions"><label class="remember"><input type="checkbox"><span>Remember me</span></label><a href="#" class="forgot">Forgot password?</a></div><button type="submit" class="submit-btn">Sign In</button><div class="social-login"><button type="button" class="social-btn">Google</button><button type="button" class="social-btn">GitHub</button></div></form></div></body></html>`,
      css: `body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#130a2e,#2d1b5a);font-family:'Segoe UI',system-ui,sans-serif;overflow:hidden;color:#fff}.blobs{position:absolute;inset:0;overflow:hidden;z-index:0}.blob{position:absolute;filter:blur(60px);border-radius:50%;opacity:0.6;animation:float 10s infinite ease-in-out alternate}.blob-1{width:300px;height:300px;background:#8b5cf6;top:-100px;left:-100px}.blob-2{width:400px;height:400px;background:#3b82f6;bottom:-150px;right:-100px;animation-delay:-5s}.blob-3{width:200px;height:200px;background:#ec4899;top:50%;left:50%;transform:translate(-50%,-50%);animation-delay:-2s}@keyframes float{0%{transform:translateY(0) scale(1)}100%{transform:translateY(30px) scale(1.1)}}.container{position:relative;z-index:1;width:100%;max-width:400px;padding:2rem}.login-form{background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);padding:2.5rem;border-radius:24px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);animation:slideUp 0.6s cubic-bezier(0.16,1,0.3,1)}@keyframes slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}.logo{font-size:3rem;text-align:center;color:#a855f7;animation:spin 10s linear infinite}h2{text-align:center;margin:1rem 0 0.5rem;font-size:1.75rem}.subtitle{text-align:center;color:#94a3b8;margin-bottom:2rem;font-size:0.9rem}.input-group{position:relative;margin-bottom:1.5rem}.input-group input{width:100%;padding:1rem;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:#fff;font-size:1rem;outline:none;transition:all 0.3s;box-sizing:border-box}.input-group input:focus,.input-group input:valid{border-color:#a855f7;background:rgba(0,0,0,0.3)}.input-group label{position:absolute;left:1rem;top:1rem;color:#94a3b8;transition:all 0.3s;pointer-events:none;font-size:1rem}.input-group input:focus~label,.input-group input:valid~label{top:-0.5rem;left:0.8rem;font-size:0.75rem;background:#2d1b5a;padding:0 0.4rem;color:#a855f7;border-radius:4px}.toggle-pwd{position:absolute;right:1rem;top:50%;transform:translateY(-50%);background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1.2rem}.actions{display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem;font-size:0.875rem}.remember{display:flex;align-items:center;gap:0.5rem;color:#94a3b8;cursor:pointer}.forgot{color:#a855f7;text-decoration:none;transition:color 0.3s}.forgot:hover{color:#d8b4fe}.submit-btn{width:100%;padding:1rem;background:linear-gradient(135deg,#a855f7,#3b82f6);border:none;border-radius:12px;color:#fff;font-size:1rem;font-weight:600;cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;position:relative;overflow:hidden}.submit-btn:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(168,85,247,0.3)}.social-login{margin-top:1.5rem;display:flex;gap:1rem}.social-btn{flex:1;padding:0.75rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:#fff;cursor:pointer;transition:background 0.3s}.social-btn:hover{background:rgba(255,255,255,0.1)}`,
      javascript: `const togglePwd=document.getElementById('togglePwd');const pwdInput=document.getElementById('password');togglePwd.addEventListener('click',()=>{const type=pwdInput.getAttribute('type')==='password'?'text':'password';pwdInput.setAttribute('type',type);togglePwd.textContent=type==='password'?'👁':'🙈'});document.getElementById('loginForm').addEventListener('submit',(e)=>{e.preventDefault();const btn=document.querySelector('.submit-btn');const originalText=btn.textContent;btn.innerHTML='<span style="display:inline-block;animation:spin 1s linear infinite">↻</span>';setTimeout(()=>{btn.textContent='Success!';btn.style.background='#22c55e';setTimeout(()=>{btn.textContent=originalText;btn.style.background='linear-gradient(135deg, #a855f7, #3b82f6)';e.target.reset()},2000)},1500)});`,
    }
  },
  {
    id: "signup-form",
    name: "Sign Up Form",
    description: "Interactive animated registration",
    icon: <UserPlus className="w-4 h-4" />,
    content: {
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Sign Up</title></head><body><div class="container"><form class="signup-form" id="signupForm"><div class="rocket">🚀</div><h2>Create Account</h2><p class="subtitle">Join our community today</p><div class="name-grid"><div class="input-group"><input type="text" id="fname" required><label for="fname">First Name</label></div><div class="input-group"><input type="text" id="lname" required><label for="lname">Last Name</label></div></div><div class="input-group"><input type="email" id="email" required><label for="email">Email Address</label><span class="validation-icon" id="emailIcon"></span></div><div class="input-group"><input type="password" id="password" required><label for="password">Password</label><div class="strength-meter"><div class="strength-bar" id="strengthBar"></div></div><p class="strength-text" id="strengthText"></p></div><div class="input-group"><input type="password" id="confirm" required><label for="confirm">Confirm Password</label></div><label class="terms"><input type="checkbox" required><span>I agree to the <a href="#">Terms</a> & <a href="#">Privacy</a></span></label><button type="submit" class="submit-btn">Create Account</button></form></div></body></html>`,
      css: `body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f172a,#1e1b4b);font-family:'Segoe UI',system-ui,sans-serif;color:#fff}.container{width:100%;max-width:480px;padding:2rem;box-sizing:border-box}.signup-form{background:rgba(255,255,255,0.03);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.08);padding:2.5rem;border-radius:24px;box-shadow:0 30px 60px -15px rgba(0,0,0,0.6);animation:scaleIn 0.5s ease-out}@keyframes scaleIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}.rocket{font-size:3.5rem;text-align:center;animation:bounce 2s infinite ease-in-out}@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-15px)}}h2{text-align:center;margin:0.5rem 0;font-size:2rem;background:linear-gradient(to right,#2dd4bf,#a855f7);-webkit-background-clip:text;color:transparent}.subtitle{text-align:center;color:#94a3b8;margin-bottom:2rem}.name-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}.input-group{position:relative;margin-bottom:1.5rem}.input-group input{width:100%;padding:1rem;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:#fff;font-size:1rem;outline:none;transition:all 0.3s;box-sizing:border-box}.input-group input:focus{border-color:#2dd4bf;box-shadow:0 0 0 4px rgba(45,212,191,0.1)}.input-group label{position:absolute;left:1rem;top:1rem;color:#94a3b8;transition:all 0.3s;pointer-events:none}.input-group input:focus~label,.input-group input:valid~label{top:-0.6rem;left:0.8rem;font-size:0.75rem;background:#1e1b4b;padding:0 0.4rem;color:#2dd4bf;border-radius:4px}.validation-icon{position:absolute;right:1rem;top:1rem}.strength-meter{height:4px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:0.5rem;overflow:hidden}.strength-bar{height:100%;width:0;transition:all 0.3s}.strength-text{font-size:0.75rem;margin-top:0.25rem;text-align:right}.terms{display:flex;align-items:center;gap:0.5rem;color:#94a3b8;font-size:0.875rem;margin-bottom:1.5rem}.terms a{color:#2dd4bf;text-decoration:none}.submit-btn{width:100%;padding:1rem;background:linear-gradient(135deg,#2dd4bf,#3b82f6);border:none;border-radius:12px;color:#fff;font-size:1.1rem;font-weight:600;cursor:pointer;transition:all 0.3s}.submit-btn:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(45,212,191,0.3)}`,
      javascript: `const pwd=document.getElementById('password');const bar=document.getElementById('strengthBar');const txt=document.getElementById('strengthText');const email=document.getElementById('email');const emailIcon=document.getElementById('emailIcon');pwd.addEventListener('input',(e)=>{const val=e.target.value;let strength=0;if(val.length>=8)strength++;if(val.match(/[A-Z]/))strength++;if(val.match(/[0-9]/))strength++;if(val.match(/[^A-Za-z0-9]/))strength++;let color,width,text;switch(strength){case 0:width='0';text='';break;case 1:width='25%';color='#ef4444';text='Weak';break;case 2:width='50%';color='#f97316';text='Fair';break;case 3:width='75%';color='#eab308';text='Good';break;case 4:width='100%';color='#22c55e';text='Strong 💪';break;}bar.style.width=width;bar.style.backgroundColor=color;txt.textContent=text;txt.style.color=color});email.addEventListener('blur',(e)=>{const val=e.target.value;if(val){const isValid=/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(val);emailIcon.textContent=isValid?'✅':'❌'}else{emailIcon.textContent=''}});document.getElementById('signupForm').addEventListener('submit',(e)=>{e.preventDefault();if(document.getElementById('password').value!==document.getElementById('confirm').value){alert('Passwords do not match!');return}const btn=document.querySelector('.submit-btn');btn.textContent='Creating...';setTimeout(()=>{btn.textContent='Account Created!';btn.style.background='#22c55e'},1500)});`,
    }
  },
]

type LayoutType = "split" | "preview" | "code"

export default function CodeEditor() {
  const [code, setCode] = useState<CodeContent>(() => {
    if (typeof window === "undefined") return templates[0].content
    try {
      const urlParams = new URLSearchParams(window.location.search)
      const sharedCode = urlParams.get("code")
      if (sharedCode) return JSON.parse(safeBase64Decode(sharedCode)) as CodeContent
    } catch {
      // invalid share URL — fall through
    }
    try {
      const saved = localStorage.getItem("webify_code")
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
  const [isResizing, setIsResizing] = useState(false)






  const [isMobile, setIsMobile] = useState(false)
  const [consoleErrors, setConsoleErrors] = useState<Array<{message: string; line?: number; col?: number}>>([])
  const [runtimeError, setRuntimeError] = useState<{
    message: string;
    line: number | null;
    column: number | null;
  } | null>(null)
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)

  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null)
  const [templateSnapshots, setTemplateSnapshots] = useState<Record<string, CodeContent>>(() => {
    if (typeof window === "undefined") return {}
    try {
      const saved = localStorage.getItem("webify_template_snapshots")
      if (saved) return JSON.parse(saved) as Record<string, CodeContent>
    } catch {
      // corrupted storage — fall through
    }
    return {}
  })

  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLIFrameElement>(null)
  const activeEditorRef = useRef<import("monaco-editor").editor.IStandaloneCodeEditor | null>(null)
  const codeRef = useRef<CodeContent>(code)

  const htmlValidation = useMemo(() => validateHtmlSyntax(code.html), [code.html])

  useEffect(() => { codeRef.current = code }, [code])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "WEBIFY_ERROR") {
        setRuntimeError({
          message: event.data.message,
          line: event.data.line ?? null,
          column: event.data.column ?? event.data.col ?? null,
        })
        setConsoleErrors((prev) => [...prev, {
          message: event.data.message,
          line: event.data.line,
          col: event.data.col,
        }])
        setConsoleOpen(true)
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      try { localStorage.setItem('webify_code', JSON.stringify(code)) } catch {}
    }, 500)
    return () => clearTimeout(timer)
  }, [code])

  useEffect(() => {
    const timer = setTimeout(() => {
      try { localStorage.setItem('webify_template_snapshots', JSON.stringify(templateSnapshots)) } catch {}
    }, 500)
    return () => clearTimeout(timer)
  }, [templateSnapshots])

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

  const handleDragStart = useCallback(() => {
    isDragging.current = true
    setIsResizing(true)
    document.body.style.userSelect = "none"
  }, [])

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    let newRatio: number
    if (isMobile) {
      newRatio = ((clientY - rect.top) / rect.height) * 100
    } else {
      newRatio = ((clientX - rect.left) / rect.width) * 100
    }
    setSplitRatio(Math.max(20, Math.min(80, newRatio)))
  }, [isMobile])

  const handleDragEnd = useCallback(() => {
    isDragging.current = false
    setIsResizing(false)
    document.body.style.userSelect = "auto"
    document.body.style.cursor = "default"
  }, [])

  const handleMouseMove = useCallback((e: globalThis.MouseEvent) => handleDragMove(e.clientX, e.clientY), [handleDragMove])
  const handleTouchMove = useCallback((e: globalThis.TouchEvent) => {
    if (isDragging.current) {
      e.preventDefault()
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY)
    }
  }, [handleDragMove])

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleDragEnd)
    window.addEventListener("touchmove", handleTouchMove, { passive: false })
    window.addEventListener("touchend", handleDragEnd)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleDragEnd)
      window.removeEventListener("touchmove", handleTouchMove)
      window.removeEventListener("touchend", handleDragEnd)
    }
  }, [handleMouseMove, handleTouchMove, handleDragEnd])

  useEffect(() => {
    if (!previewRef.current || !autoRun) return
    // clear runtime error on each recompile; timeout errors are caught by the iframe's own watchdog
    setRuntimeError(null)
    if (!htmlValidation.isValid) {
      previewRef.current.srcdoc = createPreviewErrorHtml(htmlValidation.message ?? "Invalid HTML syntax.")
      return
    }
    const debounceTimer = setTimeout(() => {
      if (!previewRef.current) return
      const combinedCode = `<!DOCTYPE html><html lang="en"><head><script>(function(){window.onerror=function(msg,src,line,col){window.parent.postMessage({type:'WEBIFY_ERROR',message:String(msg),line:line ?? null,column:col ?? null},'*');return true};window.addEventListener('unhandledrejection',function(event){var reason=event.reason instanceof Error?event.reason.message:String(event.reason);window.parent.postMessage({type:'WEBIFY_ERROR',message:reason,line:null,column:null},'*')})})()</script><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Live Preview</title><style>${code.css}</style></head><body>${code.html}<script>(function(){var k=setTimeout(function(){window.parent.postMessage({type:'WEBIFY_ERROR',message:'Script timed out after 5 seconds'},'*');document.body.innerHTML='<div style="padding:20px;color:red;font-family:monospace;">Script timed out.</div>'},5000);try{${code.javascript}}catch(e){clearTimeout(k);window.parent.postMessage({type:'WEBIFY_ERROR',message:e.message},'*');var el=document.createElement('div');el.style.cssText='padding:20px;color:red;font-family:monospace;';el.textContent='JS Error: '+e.message;document.body.appendChild(el);return}clearTimeout(k)})()\<\/script></body></html>`
      setConsoleErrors([])
      const blob = new Blob([combinedCode], { type: "text/html" })
      const url = URL.createObjectURL(blob)
      previewRef.current.src = url
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 400)
    return () => clearTimeout(debounceTimer)
  }, [code, htmlValidation, autoRun])

  const runCodeManually = () => {
    if (!previewRef.current) return
    // clear runtime error on each recompile; timeout errors are caught by the iframe's own watchdog
    setRuntimeError(null)
    if (!htmlValidation.isValid) {
      previewRef.current.srcdoc = createPreviewErrorHtml(htmlValidation.message ?? "Invalid HTML syntax.")
      return
    }
    const combinedCode = `<!DOCTYPE html><html lang="en"><head><script>(function(){window.onerror=function(msg,src,line,col){window.parent.postMessage({type:'WEBIFY_ERROR',message:String(msg),line:line ?? null,column:col ?? null},'*');return true};window.addEventListener('unhandledrejection',function(event){var reason=event.reason instanceof Error?event.reason.message:String(event.reason);window.parent.postMessage({type:'WEBIFY_ERROR',message:reason,line:null,column:null},'*')})})()</script><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Live Preview</title><style>${code.css}</style></head><body>${code.html}<script>(function(){var k=setTimeout(function(){document.body.innerHTML='<div style="padding:20px;color:red;font-family:monospace;">Script timed out.</div>'},5000);try{${code.javascript}}catch(e){clearTimeout(k);var el=document.createElement('div');el.style.cssText='padding:20px;color:red;font-family:monospace;';el.textContent='JS Error: '+e.message;document.body.appendChild(el);return}clearTimeout(k)})()\<\/script></body></html>`
    setConsoleErrors([])
    const blob = new Blob([combinedCode], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    previewRef.current.src = url
  }

  const formatCode = useCallback(async () => {
    try {
      let formatted: string
      const current = code[activeTab]
      if (activeTab === 'html') {
        formatted = await prettier.format(current, { parser: 'html', plugins: [parserHtml] })
      } else if (activeTab === 'css') {
        formatted = await prettier.format(current, { parser: 'css', plugins: [parserCss] })
      } else {
        formatted = await prettier.format(current, { parser: 'babel', plugins: [parserBabel, parserEstree] })
      }
      setCode((prev) => ({ ...prev, [activeTab]: formatted }))
      toast.success(`${activeTab.toUpperCase()} formatted successfully`)
    } catch {
      toast.error('Could not format code — check for syntax errors')
    }
  }, [activeTab, code])

  const handleCodeChange = (language: keyof CodeContent, value: string) => {
    setCode((prev) => ({ ...prev, [language]: value }))
  }

  const loadTemplate = (template: Template) => {
    if (currentTemplateId) {
      setTemplateSnapshots((prev) => ({ ...prev, [currentTemplateId]: code }))
    }
    const savedSnapshot = templateSnapshots[template.id]
    setCode(savedSnapshot ?? template.content)
    setCurrentTemplateId(template.id)
    toast("Template loaded", { description: `${template.name} template loaded.` })
  }

  const downloadCode = async () => {
    const zip = new JSZip()
    zip.file("index.html", `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>My Project</title>\n    <link rel="stylesheet" href="style.css">\n</head>\n<body>\n${code.html}\n    <script src="script.js"></script>\n</body>\n</html>`)
    zip.file("style.css", code.css)
    zip.file("script.js", code.javascript)
    const blob = await zip.generateAsync({ type: "blob" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "webify-project.zip"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast("Download started", { description: "Saved as webify-project.zip" })
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
          const htmlMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
          const cssMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
          const jsMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
          setCode({
            html: htmlMatch ? htmlMatch[1].trim() : "",
            css: cssMatch ? cssMatch[1].trim() : "",
            javascript: jsMatch ? jsMatch[1].trim() : "",
          })
          toast("File imported", { description: "HTML file imported." })
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const copyShareLink = async () => {
    if (typeof window === "undefined") return
    try {
      const url = `${window.location.origin}?code=${safeBase64Encode(JSON.stringify({ html: code.html, css: code.css, javascript: code.javascript }))}`
      await navigator.clipboard.writeText(url)
      toast("Link copied", { description: "Shareable link copied to clipboard." })
    } catch {
      toast.error("Copy failed", { description: "Could not copy the share link." })
    }
  }

  const handleAIGenerate = (generated: { html: string; css: string; javascript: string }) => {
    setCode({
      html: generated.html,
      css: generated.css,
      javascript: generated.javascript,
    })
    setActiveTab("html")
if (layout === "preview") setLayout("split")
  }

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const sharedCode = urlParams.get("code")
    if (sharedCode) {
      try {
        const decoded = JSON.parse(safeBase64Decode(sharedCode))
        setCode(decoded)
        toast("Shared code loaded", { description: "Shared code loaded." })
      } catch {
        toast.error("Invalid share link", { description: "Could not load shared code." })
      }
    }
  }, [])

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}?code=${safeBase64Encode(JSON.stringify({ html: code.html, css: code.css, javascript: code.javascript }))}`
    : ""

  const commands = useMemo<Command[]>(() => {
    const layoutCmd = (id: string, label: string, value: LayoutType, icon: React.ReactNode): Command => ({
      id, label, group: "Layout", icon,
      keywords: "view layout panel",
      description: layout === value ? "Active" : undefined,
      perform: () => setLayout(value),
    })
    const tabCmd = (id: string, label: string, value: keyof CodeContent, icon: React.ReactNode): Command => ({
      id, label, group: "Editor", icon,
      keywords: "tab file language",
      description: activeTab === value ? "Active" : undefined,
      perform: () => { setActiveTab(value); if (layout === "preview") setLayout("split") },
    })
    return [
      layoutCmd("layout-code", "Code only", "code", <Code2 className="w-4 h-4" />),
      layoutCmd("layout-split", "Split view", "split", <Layout className="w-4 h-4" />),
      layoutCmd("layout-preview", "Preview only", "preview", <Play className="w-4 h-4" />),
      tabCmd("tab-html", "Go to HTML", "html", <FileText className="w-4 h-4" />),
      tabCmd("tab-css", "Go to CSS", "css", <Palette className="w-4 h-4" />),
      tabCmd("tab-js", "Go to JavaScript", "javascript", <Zap className="w-4 h-4" />),
      {
        id: "editor-undo", label: "Undo", group: "Editor", icon: <Undo2 className="w-4 h-4" />,
        keywords: "ctrl z revert history undo",
        perform: () => { const ed = activeEditorRef.current; if (ed) { ed.focus(); ed.trigger("palette", "undo", null) } },
      },
      {
        id: "editor-redo", label: "Redo", group: "Editor", icon: <Redo2 className="w-4 h-4" />,
        keywords: "ctrl y ctrl shift z history redo",
        perform: () => { const ed = activeEditorRef.current; if (ed) { ed.focus(); ed.trigger("palette", "redo", null) } },
      },
      { id: "action-format", label: "Format code", group: "Actions", icon: <Zap className="w-4 h-4" />, keywords: "prettier format beautify", perform: formatCode },
      { id: "action-import", label: "Import HTML file", group: "Actions", icon: <Upload className="w-4 h-4" />, keywords: "open upload load", perform: importCode },
      { id: "action-download", label: "Download project", group: "Actions", icon: <Download className="w-4 h-4" />, keywords: "export save html", perform: downloadCode },
      { id: "action-share", label: "Copy shareable link", group: "Actions", icon: <LinkIcon className="w-4 h-4" />, keywords: "url clipboard share", perform: copyShareLink },
      {
        id: "action-fullscreen", label: isFullscreen ? "Exit fullscreen" : "Enter fullscreen", group: "Actions",
        icon: isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />,
        keywords: "expand maximize zoom",
        perform: () => setIsFullscreen((v) => !v),
      },
      {
        id: "action-theme", label: theme === "light" ? "Switch to dark mode" : "Switch to light mode", group: "Actions",
        icon: theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />,
        keywords: "appearance dark light color",
        perform: toggleTheme,
      },
      ...templates.map<Command>((t) => ({
        id: `template-${t.id}`, label: t.name, description: t.description, group: "Templates", icon: t.icon,
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

  const bottomNavItems = [
    { label: "Code", icon: <Code2 className="w-5 h-5" />, action: () => setLayout("code"), active: layout === "code" },
    { label: "Split", icon: <Layout className="w-5 h-5" />, action: () => setLayout("split"), active: layout === "split" },
    { label: "Preview", icon: <Play className="w-5 h-5" />, action: () => setLayout("preview"), active: layout === "preview" },
    { label: "Save", icon: <Download className="w-5 h-5" />, action: downloadCode, active: false },
    { label: "More", icon: <MoreHorizontal className="w-5 h-5" />, action: () => setMoreSheetOpen(true), active: moreSheetOpen },
  ]

  return (
    <AppErrorBoundary>
      <div className="h-[100dvh] flex flex-col bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 flex items-center gap-2 min-w-0">
          <Link href="/" className="flex items-center gap-1.5 mr-2">
            <Code2 className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-gray-900 dark:text-white">Webify</span>
          </Link>
          <Select onValueChange={loadTemplate}>
                    <SelectTrigger className="w-48 max-w-full h-8 text-sm">
                            <SelectValue placeholder="Choose template" />
                        </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyShareLink}><LinkIcon className="w-4 h-4 mr-1" />Share</Button>
            <Button variant="outline" size="sm" onClick={downloadCode}><Download className="w-4 h-4 mr-1" />Download</Button>
            <Button variant="outline" size="sm" onClick={toggleTheme}>{theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}</Button>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden min-w-0">
          <EditorErrorBoundary>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as keyof CodeContent)} className="flex-1 flex flex-col overflow-hidden min-w-0">
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2">
                <TabsList>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                  <TabsTrigger value="css">CSS</TabsTrigger>
                  <TabsTrigger value="javascript">JS</TabsTrigger>
                </TabsList>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaletteOpen(true)}
                className="hidden md:flex flex-1 max-w-xs justify-start text-gray-500 dark:text-gray-400 h-8 text-xs"
              >
                <Search className="w-3.5 h-3.5 mr-2" />
                Search commands…
                <kbd className="ml-auto rounded border border-gray-200 px-1.5 py-0.5 text-[10px] dark:border-gray-600">⌘K</kbd>
              </Button>

              <div className="hidden md:flex items-center gap-1.5">
                <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                  <Button variant={layout === "code" ? "default" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => setLayout("code")} title="Code only"><Code2 className="w-4 h-4" /></Button>
                  <Button variant={layout === "split" ? "default" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => setLayout("split")} title="Split view"><Layout className="w-4 h-4" /></Button>
                  <Button variant={layout === "preview" ? "default" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => setLayout("preview")} title="Preview only"><Play className="w-4 h-4" /></Button>
                </div>
                <div className="w-px h-5 bg-gray-200 dark:bg-gray-600" />
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={formatCode}><Zap className="w-3.5 h-3.5 mr-1.5" />Format</Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={importCode}><Upload className="w-3.5 h-3.5 mr-1.5" />Import</Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={downloadCode}><Download className="w-3.5 h-3.5 mr-1.5" />Download</Button>
                <CopyButton text={shareUrl} />
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setIsFullscreen(!isFullscreen)}>
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={toggleTheme}>
                  {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />}
                </Button>
              </div>

          <PreviewErrorBoundary>
            <div className="flex flex-col border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 min-w-0">
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center gap-2">
                <Play className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Live Preview</span>
              </div>
              <iframe ref={previewRef} className="flex-1 w-full border-0 bg-white min-h-0 min-w-0" title="Live Preview" sandbox="allow-scripts allow-forms allow-popups allow-modals" />
            </div>
          </header>

          {/* MAIN WORKSPACE */}
          <div
            ref={containerRef}
            className={`flex-1 overflow-hidden flex ${isMobile ? "flex-col" : "flex-row"}`}
            style={isMobile ? { paddingBottom: "56px" } : {}}
          >
            {/* Code panel */}
            {(layout === "code" || layout === "split") && (
              <EditorErrorBoundary>
                <div
                  style={
                    layout === "split"
                      ? isMobile
                        ? { height: `${splitRatio}%` }
                        : { width: `${splitRatio}%` }
                      : { flex: 1 }
                  }
                  className="flex flex-col overflow-hidden shrink-0 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700"
                >
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as keyof CodeContent)} className="flex-1 flex flex-col">
                    <div className="bg-white dark:bg-gray-800 border-b px-4 overflow-x-auto scrollbar-hide shrink-0">
                      <TabsList className="flex w-full min-w-max">
                        <TabsTrigger value="html" className="flex-1">HTML</TabsTrigger>
                        <TabsTrigger value="css" className="flex-1">CSS</TabsTrigger>
                        <TabsTrigger value="javascript" className="flex-1">JS</TabsTrigger>
                      </TabsList>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <TabsContent value="html" className="h-full m-0">
                        <MonacoEditor language="html" value={code.html} onChange={(v) => handleCodeChange("html", v)} theme={theme} onEditorReady={(ed) => (activeEditorRef.current = ed)} />
                      </TabsContent>
                      <TabsContent value="css" className="h-full m-0">
                        <MonacoEditor language="css" value={code.css} onChange={(v) => handleCodeChange("css", v)} theme={theme} onEditorReady={(ed) => (activeEditorRef.current = ed)} />
                      </TabsContent>
                      <TabsContent value="javascript" className="h-full m-0">
                        <MonacoEditor language="javascript" value={code.javascript} onChange={(v) => handleCodeChange("javascript", v)} theme={theme} onEditorReady={(ed) => (activeEditorRef.current = ed)} />
                      </TabsContent>
                    </div>
                  </Tabs>
                </div>
              </EditorErrorBoundary>
            )}

            {/* Resizer */}
            {layout === "split" && (
              <div
                onMouseDown={() => { handleDragStart(); document.body.style.cursor = isMobile ? "row-resize" : "col-resize" }}
                onTouchStart={handleDragStart}
                onDragStart={(e) => e.preventDefault()}
                className={`shrink-0 z-10 transition-colors ${
                  isMobile
                    ? "h-2 w-full cursor-row-resize bg-gray-300 dark:bg-gray-600 hover:bg-blue-500 active:bg-blue-600"
                    : "w-2 h-full cursor-col-resize bg-gray-300 dark:bg-gray-600 hover:bg-blue-500 active:bg-blue-600"
                }`}
              />
            )}

            {/* Preview panel */}
            {(layout === "preview" || layout === "split") && (
              <PreviewErrorBoundary>
                <div
                  style={
                    layout === "split"
                      ? isMobile
                        ? { height: `${100 - splitRatio}%` }
                        : { width: `${100 - splitRatio}%` }
                      : { flex: 1 }
                  }
                  className="flex flex-col overflow-hidden shrink-0"
                >
                  <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2 sm:p-3 flex flex-wrap items-center gap-2 shrink-0">
                    <Play className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="font-medium text-gray-900 dark:text-white">Live Preview</span>
                    <Badge variant="secondary" className="text-xs shrink-0">{autoRun ? "Auto-refresh" : "Manual"}</Badge>
                    <Button variant="outline" size="sm" onClick={() => setAutoRun(!autoRun)} className="shrink-0">
                      {autoRun ? "Pause" : "Resume"}
                    </Button>
                    {!autoRun && (
                      <Button size="sm" onClick={runCodeManually} className="shrink-0">Run</Button>
                    )}
                  </div>
                  <div className={`flex-1 bg-white dark:bg-gray-900 relative ${isResizing ? "pointer-events-none" : ""}`}>
                    <iframe
                      ref={previewRef}
                      className="absolute inset-0 w-full h-full border-0"
                      title="Live Preview"
                      sandbox="allow-scripts allow-forms allow-popups allow-modals"
                    />
                    {runtimeError && (
                      <div style={{
                        padding: '8px 12px',
                        background: '#FFF5F5',
                        borderTop: '1px solid #FEB2B2',
                        color: '#C53030',
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span></span>
                        <span>
                          {runtimeError.message}
                          {runtimeError.line ? ` (Line ${runtimeError.line}${runtimeError.column ? `:${runtimeError.column}` : ''})` : ''}
                          {runtimeError.message === "Script error." && runtimeError.line === 0 && (
                            <span style={{ fontSize: '11px', color: '#9B2C2C', marginTop: '2px', display: 'block' }}>
                              Tip: External script error - check your CDN links or add crossorigin="anonymous"
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => setRuntimeError(null)}
                          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#C53030', fontSize: '13px' }}
                        >
                          
                        </button>
                      </div>
                    )}
                    {isResizing && <div className="absolute inset-0 z-20 cursor-row-resize md:cursor-col-resize" />}
                  </div>
                  {/* Console Panel */}
                  <div className={`border-t border-gray-200 dark:border-gray-700 bg-gray-950 transition-all ${consoleOpen ? "h-36" : "h-8"}`}>
                    <div className="flex items-center justify-between px-3 h-8 cursor-pointer select-none" onClick={() => setConsoleOpen((o) => !o)}>
                      <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                        <span>Console</span>
                        {consoleErrors.length > 0 && (
                          <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{consoleErrors.length}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {consoleErrors.length > 0 && (
                          <button onClick={(e) => { e.stopPropagation(); setConsoleErrors([]) }} className="text-[10px] text-gray-500 hover:text-gray-300">Clear</button>
                        )}
                        <span className="text-gray-500 text-xs">{consoleOpen ? "▼" : "▲"}</span>
                      </div>
                    </div>
                    {consoleOpen && (
                      <div className="overflow-y-auto h-28 px-3 py-1 space-y-1">
                        {consoleErrors.length === 0 ? (
                          <p className="text-xs text-gray-500 font-mono">No errors</p>
                        ) : (
                          consoleErrors.map((err, i) => (
                            <div key={i} className="text-xs font-mono text-red-400">
                              {err.line ? `[${err.line}:${err.col}] ` : ""}{err.message}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </PreviewErrorBoundary>
            )}
          </div>

          {/* Mobile bottom nav */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-stretch h-14">
              {bottomNavItems.map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors active:scale-95 ${
                    item.active ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
        </div>

        <AIAssistant onGenerate={handleAIGenerate} theme={theme} />
      </>
    </AppErrorBoundary>
  )
}
