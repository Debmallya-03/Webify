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
  Undo2, Redo2, Timer, MoreHorizontal, X,
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
      html: `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Landing Page</title>\n</head>\n<body>\n    <header class="header"><nav class="nav"><div class="logo">Brand</div></nav></header>\n    <main class="hero"><div class="hero-content"><h1>Welcome to the Future</h1><p>Build amazing things</p><button onclick="alert('Hello!')">Get Started</button></div></main>\n</body>\n</html>`,
      css: `body{margin:0;font-family:'Segoe UI',sans-serif}.header{background:#130a2e;padding:1rem 2rem;position:fixed;width:100%;top:0;z-index:1000}.nav{display:flex;justify-content:space-between;align-items:center}.logo{color:white;font-size:1.5rem;font-weight:bold}.hero{height:100vh;background:#130a2e;display:flex;align-items:center;justify-content:center;text-align:center;color:white}.hero-content h1{font-size:4rem;margin-bottom:1rem}.hero-content p{color:#c5bedb;margin-bottom:2rem}.hero-content button{padding:1rem 2.5rem;border:none;border-radius:50px;cursor:pointer;font-weight:700;font-size:1.1rem}`,
      javascript: `console.log('Landing page loaded!')`,
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
    id: "calculator",
    name: "Calculator",
    description: "Basic calculator app",
    icon: <Zap className="w-4 h-4" />,
    content: {
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Calculator</title></head><body><div class="calculator"><div class="display" id="display">0</div><div class="buttons"><button onclick="clearDisplay()">C</button><button onclick="appendToDisplay('/')">/</button><button onclick="appendToDisplay('*')">*</button><button onclick="deleteLast()">⌫</button><button onclick="appendToDisplay('7')">7</button><button onclick="appendToDisplay('8')">8</button><button onclick="appendToDisplay('9')">9</button><button onclick="appendToDisplay('-')">-</button><button onclick="appendToDisplay('4')">4</button><button onclick="appendToDisplay('5')">5</button><button onclick="appendToDisplay('6')">6</button><button onclick="appendToDisplay('+')">+</button><button onclick="appendToDisplay('1')">1</button><button onclick="appendToDisplay('2')">2</button><button onclick="appendToDisplay('3')">3</button><button class="equals" onclick="calculate()">=</button><button class="zero" onclick="appendToDisplay('0')">0</button><button onclick="appendToDisplay('.')">.</button></div></div></body></html>`,
      css: `body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a2e;font-family:Arial,sans-serif}.calculator{background:#16213e;border-radius:20px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,0.5)}.display{background:#0f3460;color:white;padding:20px;border-radius:10px;text-align:right;font-size:2rem;margin-bottom:15px;min-height:60px;word-break:break-all}.buttons{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}button{padding:15px;border:none;border-radius:10px;font-size:1.1rem;cursor:pointer;background:#e94560;color:white;transition:all 0.2s}button:hover{opacity:0.8;transform:scale(0.95)}.equals{background:#0f3460;grid-row:span 2}.zero{grid-column:span 2}`,
      javascript: `let display=document.getElementById('display');let currentVal='';function appendToDisplay(val){if(currentVal==='0'&&val!=='.')currentVal='';currentVal+=val;display.textContent=currentVal}function clearDisplay(){currentVal='';display.textContent='0'}function deleteLast(){currentVal=currentVal.slice(0,-1);display.textContent=currentVal||'0'}function calculate(){try{currentVal=String(eval(currentVal));display.textContent=currentVal}catch{display.textContent='Error';currentVal=''}}`,
    },
  },
  {
    id: "color-picker",
    name: "Color Picker",
    description: "Interactive color picker tool",
    icon: <Palette className="w-4 h-4" />,
    content: {
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Color Picker</title></head><body><div class="container"><h1>Color Picker</h1><div class="picker-wrap"><input type="color" id="colorPicker" value="#4f46e5"/></div><div class="preview" id="preview"></div><div class="values"><div class="value-box"><span>HEX</span><p id="hexVal">#4f46e5</p></div><div class="value-box"><span>RGB</span><p id="rgbVal"></p></div><div class="value-box"><span>HSL</span><p id="hslVal"></p></div></div><button onclick="copyHex()">Copy HEX</button></div></body></html>`,
      css: `body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-family:'Segoe UI',sans-serif}.container{background:white;border-radius:20px;padding:2rem;box-shadow:0 10px 40px rgba(0,0,0,0.1);text-align:center;width:320px}h1{margin:0 0 1.5rem;color:#1e293b}.picker-wrap{margin-bottom:1rem}#colorPicker{width:80px;height:80px;border:none;border-radius:50%;cursor:pointer;padding:0}.preview{height:120px;border-radius:12px;margin:1rem 0;transition:background 0.3s;background:#4f46e5}.values{display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;margin-bottom:1rem}.value-box{background:#f1f5f9;border-radius:8px;padding:0.5rem}.value-box span{font-size:0.7rem;color:#64748b;font-weight:600}.value-box p{margin:0.25rem 0 0;font-weight:700;font-size:0.85rem;color:#1e293b}button{background:#4f46e5;color:white;border:none;padding:0.75rem 2rem;border-radius:10px;cursor:pointer;font-weight:600;width:100%}`,
      javascript: `const picker=document.getElementById('colorPicker')...picker.addEventListener('input',update);update()`,
    },
  },
  {
    id: "quiz-app",
    name: "Quiz App",
    description: "Interactive quiz application",
    icon: <Zap className="w-4 h-4" />,
    content: {
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Quiz App</title></head><body><div class="container"><div id="quiz"><h2 id="question"></h2><div id="options"></div><div id="result"></div><button id="nextBtn" onclick="nextQuestion()" style="display:none">Next</button></div><div id="score" style="display:none"><h2>Your Score: <span id="scoreVal"></span></h2><button onclick="restart()">Restart</button></div></div></body></html>`,
      css: `body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea,#764ba2);font-family:'Segoe UI',sans-serif}.container{background:white;border-radius:20px;padding:2rem;max-width:500px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2)}h2{color:#1e293b;margin-bottom:1.5rem}.option{display:block;width:100%;padding:1rem;margin:0.5rem 0;border:2px solid #e2e8f0;border-radius:10px;background:white;cursor:pointer;font-size:1rem;text-align:left;transition:all 0.2s}.option:hover{border-color:#667eea;background:#f0f0ff}.correct{border-color:#22c55e;background:#f0fdf4}.wrong{border-color:#ef4444;background:#fef2f2}#result{margin:1rem 0;font-weight:600;font-size:1.1rem}#nextBtn{padding:0.75rem 2rem;background:#667eea;color:white;border:none;border-radius:10px;cursor:pointer;font-size:1rem}#score{text-align:center}#score button{padding:0.75rem 2rem;background:#667eea;color:white;border:none;border-radius:10px;cursor:pointer}`,
      javascript: `const questions=[{q:'What does HTML stand for?',options:['Hyper Text Markup Language','High Tech Modern Language','Hyper Transfer Mode Link','None'],answer:0},{q:'Which CSS property controls text size?',options:['font-weight','text-size','font-size','text-style'],answer:2},{q:'What does JS stand for?',options:['Java Style','JavaScript','Just Script','Java System'],answer:1},{q:'Which tag is used for links in HTML?',options:['<link>','<a>','<href>','<url>'],answer:1}];let current=0,score=0;function load(){const q=questions[current];document.getElementById('question').textContent=q.q;document.getElementById('options').innerHTML=q.options.map((o,i)=>\`<button class="option" onclick="check(\${i})">\${o}</button>\`).join('');document.getElementById('result').textContent='';document.getElementById('nextBtn').style.display='none'}function check(i){const q=questions[current];const btns=document.querySelectorAll('.option');btns.forEach(b=>b.disabled=true);if(i===q.answer){btns[i].classList.add('correct');document.getElementById('result').textContent='✅ Correct!';score++}else{btns[i].classList.add('wrong');btns[q.answer].classList.add('correct');document.getElementById('result').textContent='❌ Wrong!'}document.getElementById('nextBtn').style.display='block'}function nextQuestion(){current++;if(current<questions.length){load()}else{document.getElementById('quiz').style.display='none';document.getElementById('score').style.display='block';document.getElementById('scoreVal').textContent=score+'/'+questions.length}}function restart(){current=0;score=0;document.getElementById('quiz').style.display='block';document.getElementById('score').style.display='none';load()}load()`,
    },
  },
  {
    id: "portfolio",
    name: "Portfolio Page",
    description: "Personal portfolio template",
    icon: <Layout className="w-4 h-4" />,
    content: {
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Portfolio</title></head><body><nav class="nav"><div class="logo">MyPortfolio</div><div class="links"><a href="#about">About</a><a href="#projects">Projects</a><a href="#contact">Contact</a></div></nav><section class="hero"><h1>Hi, I'm <span>Alex</span></h1><p>Full Stack Developer & Designer</p><button>View My Work</button></section><section id="projects" class="projects"><h2>Projects</h2><div class="grid"><div class="card"><h3>Project One</h3><p>A cool web application</p></div><div class="card"><h3>Project Two</h3><p>Mobile-first design</p></div><div class="card"><h3>Project Three</h3><p>Open source tool</p></div></div></section></body></html>`,
      css: `*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;background:#0f172a;color:white}.nav{display:flex;justify-content:space-between;align-items:center;padding:1.5rem 3rem;position:fixed;width:100%;background:rgba(15,23,42,0.9);backdrop-filter:blur(10px);z-index:100}.logo{font-size:1.5rem;font-weight:bold;color:#7c3aed}.links a{color:#94a3b8;text-decoration:none;margin-left:2rem;transition:color 0.2s}.links a:hover{color:white}.hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2rem}.hero h1{font-size:4rem;margin-bottom:1rem}.hero span{color:#7c3aed}.hero p{color:#94a3b8;font-size:1.25rem;margin-bottom:2rem}.hero button{padding:1rem 2.5rem;background:#7c3aed;color:white;border:none;border-radius:50px;cursor:pointer;font-size:1rem}.projects{padding:5rem 3rem;text-align:center}.projects h2{font-size:2.5rem;margin-bottom:3rem}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem}.card{background:#1e293b;border-radius:15px;padding:2rem;border:1px solid #334155}.card h3{color:#7c3aed;margin-bottom:1rem}.card p{color:#94a3b8}`,
      javascript: `console.log('Portfolio loaded!')`,
    },
  },
  {
    id: "weather-card",
    name: "Weather Card UI",
    description: "Beautiful weather card UI",
    icon: <FileText className="w-4 h-4" />,
    content: {
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Weather Card</title></head><body><div class="container"><div class="card"><div class="top"><h2 class="city">New York</h2><p class="date">Monday, May 25</p></div><div class="middle"><div class="temp">24°C</div><div class="icon">⛅</div></div><p class="desc">Partly Cloudy</p><div class="details"><div class="detail"><span>💧</span><p>Humidity</p><p>65%</p></div><div class="detail"><span>💨</span><p>Wind</p><p>12 km/h</p></div><div class="detail"><span>👁️</span><p>Visibility</p><p>10 km</p></div></div></div></div></body></html>`,
      css: `body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a1a2e,#16213e);font-family:'Segoe UI',sans-serif}.card{background:linear-gradient(135deg,#667eea,#764ba2);border-radius:25px;padding:2rem;width:320px;color:white;box-shadow:0 20px 60px rgba(0,0,0,0.4)}.top{margin-bottom:1.5rem}.city{font-size:1.8rem;margin:0}.date{opacity:0.8;margin:0.25rem 0 0}.middle{display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem}.temp{font-size:4rem;font-weight:bold}.icon{font-size:4rem}.desc{opacity:0.8;margin-bottom:1.5rem}.details{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;background:rgba(255,255,255,0.15);border-radius:15px;padding:1rem;text-align:center}.detail span{font-size:1.5rem}.detail p{margin:0.25rem 0 0;font-size:0.85rem;opacity:0.9}.detail p:last-child{font-weight:bold;font-size:1rem}`,
      javascript: `console.log('Weather card loaded!')`,
    },
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


  // use effect for handling full screen mode
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleFullscreenToggle = async () => {
    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        return;
      }

      if (isFullscreen) {
        setIsFullscreen(false);
        return;
      }

      if (containerRef.current?.requestFullscreen) {
        await containerRef.current.requestFullscreen();
        return;
      }

      setIsFullscreen(true);
    } catch (err) {
      console.error("Error attempting to toggle fullscreen:", err);
      setIsFullscreen((prev) => !prev);
    }
  };


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
    if (!htmlValidation.isValid) {
      previewRef.current.srcdoc = createPreviewErrorHtml(htmlValidation.message ?? "Invalid HTML syntax.")
      return
    }
    const debounceTimer = setTimeout(() => {
      if (!previewRef.current) return
      const combinedCode = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Live Preview</title><style>${code.css}</style></head><body>${code.html}<script>(function(){window.onerror=function(msg,src,line,col){window.parent.postMessage({type:'WEBIFY_ERROR',message:String(msg),line:line,col:col},'*');return true};var k=setTimeout(function(){window.parent.postMessage({type:'WEBIFY_ERROR',message:'Script timed out after 5 seconds'},'*');document.body.innerHTML='<div style="padding:20px;color:red;font-family:monospace;">Script timed out.</div>'},5000);try{${code.javascript}}catch(e){clearTimeout(k);window.parent.postMessage({type:'WEBIFY_ERROR',message:e.message},'*');var el=document.createElement('div');el.style.cssText='padding:20px;color:red;font-family:monospace;';el.textContent='JS Error: '+e.message;document.body.appendChild(el);return}clearTimeout(k)})()\<\/script></body></html>`
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
    if (!htmlValidation.isValid) {
      previewRef.current.srcdoc = createPreviewErrorHtml(htmlValidation.message ?? "Invalid HTML syntax.")
      return
    }
    const combinedCode = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Live Preview</title><style>${code.css}</style></head><body>${code.html}<script>(function(){window.onerror=function(msg,src,line,col){window.parent.postMessage({type:'WEBIFY_ERROR',message:String(msg),line:line,col:col},'*');return true};var k=setTimeout(function(){document.body.innerHTML='<div style="padding:20px;color:red;font-family:monospace;">Script timed out.</div>'},5000);try{${code.javascript}}catch(e){clearTimeout(k);var el=document.createElement('div');el.style.cssText='padding:20px;color:red;font-family:monospace;';el.textContent='JS Error: '+e.message;document.body.appendChild(el);return}clearTimeout(k)})()\<\/script></body></html>`
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
      <>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />

        {/* More sheet (mobile) */}
        {moreSheetOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMoreSheetOpen(false)} />
            <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl px-4 pt-4 pb-8">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">More actions</span>
                <button onClick={() => setMoreSheetOpen(false)} className="p-1 rounded-md text-gray-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Import file", icon: <Upload className="w-5 h-5" />, action: importCode },
                  { label: "Share link", icon: <LinkIcon className="w-5 h-5" />, action: copyShareLink },
                  { label: "Open in tab", icon: <Maximize2 className="w-5 h-5" />, action: () => { if (previewRef.current?.src) window.open(previewRef.current.src, "_blank") } },
                  { label: isFullscreen ? "Exit fullscreen" : "Fullscreen", icon: isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />, action: () => { setIsFullscreen(v => !v); setMoreSheetOpen(false) } },
                  { label: "Command palette", icon: <Search className="w-5 h-5" />, action: () => { setMoreSheetOpen(false); setPaletteOpen(true) } },
                  { label: theme === "light" ? "Dark mode" : "Light mode", icon: theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />, action: () => { toggleTheme(); setMoreSheetOpen(false) } },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => { item.action(); setMoreSheetOpen(false) }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 active:scale-95 transition-transform"
                  >
                    <span className="text-gray-500 dark:text-gray-400">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className={`h-[100dvh] flex flex-col bg-gray-50 dark:bg-gray-900 ${isFullscreen ? "fixed inset-0 z-50" : ""}`}>

          {/* HEADER */}
          <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div className="flex items-center justify-between gap-2 px-3 md:px-4 py-2 md:py-3">
              <div className="flex items-center gap-2 min-w-0">
                <Link href="/" className="flex items-center gap-1.5 shrink-0">
                  <Code2 className="w-5 h-5 text-blue-600" />
                  <span className="text-lg font-bold text-gray-900 dark:text-white hidden sm:block">Webify</span>
                </Link>
                <Select onValueChange={(value) => loadTemplate(templates.find((t) => t.id === value)!)}>
                  <SelectTrigger className="w-36 sm:w-44 md:w-52 h-8 text-xs md:text-sm">
                    <SelectValue placeholder="Template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          {template.icon}
                          <div>
                            <div className="font-medium text-sm">{template.name}</div>
                            <div className="text-xs text-gray-500 hidden sm:block">{template.description}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              <div className="flex md:hidden items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={toggleTheme}>
                  {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />}
                </Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setPaletteOpen(true)}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
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