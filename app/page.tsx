"use client"

const safeBase64Encode = (str: string) =>
  btoa(unescape(encodeURIComponent(str)));

const safeBase64Decode = (str: string) =>
  decodeURIComponent(escape(atob(str)));

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import {
  Code2,
  Play,
  Download,
  Layout,
  FileText,
  Palette,
  Zap,
  Sun,
  Moon,
  Link as LinkIcon,
  Timer,
} from "lucide-react"
import { toast } from "sonner"




import JSZip from "jszip"
import dynamic from "next/dynamic"
import Link from "next/link"
import {
  EditorErrorBoundary,
  PreviewErrorBoundary,
  AppErrorBoundary,
} from "./components/error-boundary"

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
]

export default function CodeEditor() {
  const [code, setCode] = useState<CodeContent>(() => {
    if (typeof window === "undefined") return templates[0].content
    try {
      const urlParams = new URLSearchParams(window.location.search)
      const sharedCode = urlParams.get("code")
      if (sharedCode) return JSON.parse(safeBase64Decode(sharedCode)) as CodeContent
    } catch {
      // ignore invalid share URL
    }
    try {
      const saved = localStorage.getItem("webify_code")
      if (saved) return JSON.parse(saved) as CodeContent
    } catch {
      // ignore corrupted local storage
    }
    return templates[0].content
  })

  const [activeTab, setActiveTab] = useState<keyof CodeContent>("html")
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [autoRun, setAutoRun] = useState(true)
  const [splitRatio, setSplitRatio] = useState(50)
  const [isResizing, setIsResizing] = useState(false)

const containerRef = useRef<HTMLDivElement>(null)


  // Tracks which template is currently active

  const [isMobile, setIsMobile] = useState(false)
  const [consoleErrors, setConsoleErrors] = useState<Array<{message: string; line?: number; col?: number}>>([])
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
  const previewRef = useRef<HTMLIFrameElement>(null)

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

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("webify_code", JSON.stringify(code))
      } catch {
        // ignore storage quota errors
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [code])

  useEffect(() => {
    if (!previewRef.current) return
    const htmlValidation = validateHtmlSyntax(code.html)
    if (!htmlValidation.isValid) {
      previewRef.current.srcdoc = createPreviewErrorHtml(htmlValidation.message ?? "Invalid HTML syntax.")
      return
    }

    const combinedCode = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${code.css}</style></head><body>${code.html}<script>(function(){try{${code.javascript}}catch(e){var el=document.createElement('div');el.style.cssText='padding:12px;color:#b91c1c;font-family:monospace;';el.textContent='JS Error: '+e.message;document.body.appendChild(el)}})()<\/script></body></html>`
    previewRef.current.srcdoc = combinedCode
  }, [code])


  const handleCodeChange = (language: keyof CodeContent, value: string) => {
    setCode((prev) => ({ ...prev, [language]: value }))
  }

  const loadTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId)
    if (!template) return
    setCode(template.content)
    toast.success(`${template.name} loaded`)
  }

  const downloadCode = async () => {
    const zip = new JSZip()
    zip.file("index.html", code.html)
    zip.file("style.css", code.css)
    zip.file("script.js", code.javascript)
    const blob = await zip.generateAsync({ type: "blob" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "webify-project.zip"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const copyShareLink = async () => {
    try {
      const share = `${window.location.origin}?code=${safeBase64Encode(JSON.stringify(code))}`
      await navigator.clipboard.writeText(share)
      toast.success("Share link copied")
    } catch {
      toast.error("Could not copy share link")
    }
  }

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light"
    setTheme(next)
    if (next === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
    localStorage.setItem("theme", next)
  }

  return (
    <AppErrorBoundary>
      <div className="h-[100dvh] flex flex-col bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 flex items-center gap-2">
          <Link href="/" className="flex items-center gap-1.5 mr-2">
            <Code2 className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-gray-900 dark:text-white">Webify</span>
          </Link>
          <Select onValueChange={loadTemplate}>
            <SelectTrigger className="w-48 h-8 text-sm">
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

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
          <EditorErrorBoundary>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as keyof CodeContent)} className="flex-1 flex flex-col overflow-hidden">
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2">
                <TabsList>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                  <TabsTrigger value="css">CSS</TabsTrigger>
                  <TabsTrigger value="javascript">JS</TabsTrigger>
                </TabsList>
              </div>
              <div className="flex-1 overflow-hidden">
                <TabsContent value="html" className="h-full m-0">
                  <MonacoEditor language="html" value={code.html} onChange={(v) => handleCodeChange("html", v)} theme={theme} />
                </TabsContent>
                <TabsContent value="css" className="h-full m-0">
                  <MonacoEditor language="css" value={code.css} onChange={(v) => handleCodeChange("css", v)} theme={theme} />
                </TabsContent>
                <TabsContent value="javascript" className="h-full m-0">
                  <MonacoEditor language="javascript" value={code.javascript} onChange={(v) => handleCodeChange("javascript", v)} theme={theme} />
                </TabsContent>
              </div>
            </Tabs>
          </EditorErrorBoundary>

          <PreviewErrorBoundary>
            <div className="flex flex-col border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700">
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center gap-2">
                <Play className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Live Preview</span>
              </div>
              <iframe ref={previewRef} className="flex-1 w-full border-0 bg-white" title="Live Preview" sandbox="allow-scripts allow-forms allow-popups allow-modals" />
            </div>
          </PreviewErrorBoundary>
        </div>
      </div>
    </AppErrorBoundary>
  )
}
