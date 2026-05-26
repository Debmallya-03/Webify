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
    <link rel="stylesheet" href="style.css">
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
    <script src="script.js"></script>
</body>
</html>`,
      css: "", // CSS moved to global file
      javascript: `function handleCTA() {
    alert('Welcome! This is where you would redirect to signup or more info.');
}

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
});`,
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
    <link rel="stylesheet" href="style.css">
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
    <script src="script.js"></script>
</body>
</html>`,
      css: "",
      javascript: `function handleAction() {
    const card = document.getElementById('interactiveCard');
    card.style.animation = 'pulse 0.6s ease-in-out';
    setTimeout(() => {
        alert('Action completed successfully!');
        card.style.animation = '';
    }, 600);
}`,
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
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="app">
        <div class="container">
            <h1>Todo App</h1>
            <div class="input-section">
                <input type="text" id="todoInput" placeholder="Add a task..."/>
                <button onclick="addTodo()">Add</button>
            </div>
            <ul id="todoList" class="todo-list"></ul>
            <div class="stats">
                <span id="todoCount">0 remaining</span>
                <button onclick="clearCompleted()">Clear Done</button>
            </div>
        </div>
    </div>
    <script src="script.js"></script>
</body>
</html>`,
      css: "",
      javascript: `let todos=[{id:1,text:'Learn HTML & CSS',completed:true},{id:2,text:'Build a todo app',completed:false}];function addTodo(){const i=document.getElementById('todoInput');const t=i.value.trim();if(!t)return;todos.push({id:Date.now(),text:t,completed:false});i.value='';render()}function deleteTodo(id){todos=todos.filter(t=>t.id!==id);render()}function toggleTodo(id){const t=todos.find(t=>t.id===id);if(t)t.completed=!t.completed;render()}function clearCompleted(){todos=todos.filter(t=>!t.completed);render()}function render(){document.getElementById('todoList').innerHTML=todos.map(t=>\`<li class="todo-item \${t.completed?'completed':''}"><input type="checkbox" class="todo-checkbox" \${t.completed?'checked':''} onchange="toggleTodo(\${t.id})"/><span class="todo-text">\${t.text}</span><button class="delete-btn" onclick="deleteTodo(\${t.id})">Delete</button></li>\`).join('');document.getElementById('todoCount').textContent=\`\${todos.filter(t=>!t.completed).length} remaining\`}document.addEventListener('DOMContentLoaded',()=>{document.getElementById('todoInput').addEventListener('keypress',e=>{if(e.key==='Enter')addTodo()});render()})`,
    },
  },
  {
    id: "stopwatch",
    name: "Stopwatch",
    description: "Simple stopwatch",
    icon: <Timer className="w-4 h-4" />,
    content: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stopwatch</title>
    <link rel="stylesheet" href="style.css">
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
    <script src="script.js"></script>
</body>
</html>`,
      css: "",
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