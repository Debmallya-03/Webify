"use client"

import type React from "react"

import { useState, useEffect, useMemo, useRef } from "react"
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
                <li><a href="#about">About</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
        </nav>
    </header>
    
    <main class="hero">
        <div class="hero-content">
            <h1 class="hero-title">Welcome to the Future</h1>
            <p class="hero-subtitle">Build amazing things with our platform</p>
            <button class="cta-button" onclick="handleCTA()">Get Started</button>
        </div>
    </main>
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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: white;
}

.hero-content {
    max-width: 600px;
    padding: 2rem;
}

.hero-title {
    font-size: 3rem;
    margin-bottom: 1rem;
    animation: fadeInUp 1s ease-out;
}

.hero-subtitle {
    font-size: 1.2rem;
    margin-bottom: 2rem;
    opacity: 0.9;
    animation: fadeInUp 1s ease-out 0.2s both;
}

.cta-button {
    background: white;
    color: #667eea;
    border: none;
    padding: 1rem 2rem;
    font-size: 1.1rem;
    border-radius: 50px;
    cursor: pointer;
    transition: transform 0.3s, box-shadow 0.3s;
    animation: fadeInUp 1s ease-out 0.4s both;
}

.cta-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(0,0,0,0.2);
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
}`,
      javascript: `function handleCTA() {
    alert('Welcome! This is where you would redirect to signup or more info.');
}

// Add smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
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

// Add some interactive effects
document.addEventListener('mousemove', function(e) {
    const hero = document.querySelector('.hero');
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    
    hero.style.background = \`linear-gradient(\${135 + x * 10}deg, #667eea 0%, #764ba2 100%)\`;
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

.container {
    text-align: center;
    color: white;
}

h1 {
    font-size: 2rem;
    margin-bottom: 1rem;
    letter-spacing: 4px;
    text-transform: uppercase;
}

.display {
    font-size: 5rem;
    font-weight: bold;
    margin: 2rem 0;
    color: #00d4ff;
    letter-spacing: 4px;
}

.buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
}

button {
    padding: 1rem 2.5rem;
    font-size: 1rem;
    border: none;
    border-radius: 50px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s;
    background: #00d4ff;
    color: #1a1a2e;
}

button:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(0, 212, 255, 0.3);
}`,
      javascript: `let timer = null;
let seconds = 0;
let running = false;

function startStop() {
    const btn = document.getElementById('startBtn');
    if (running) {
        clearInterval(timer);
        btn.textContent = 'Start';
        running = false;
    } else {
        timer = setInterval(() => {
            seconds++;
            updateDisplay();
        }, 1000);
        btn.textContent = 'Stop';
        running = true;
    }
}

function reset() {
    clearInterval(timer);
    seconds = 0;
    running = false;
    document.getElementById('startBtn').textContent = 'Start';
    updateDisplay();
}

function updateDisplay() {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    document.getElementById('display').textContent =
        String(hrs).padStart(2, '0') + ':' +
        String(mins).padStart(2, '0') + ':' +
        String(secs).padStart(2, '0');
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
      if (sharedCode) return JSON.parse(atob(sharedCode)) as CodeContent
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
  const previewRef = useRef<HTMLIFrameElement>(null)
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
        <script>${code.javascript}</script>
      </body>
      </html>
    `

    const blob = new Blob([combinedCode], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    previewRef.current.src = url

    return () => URL.revokeObjectURL(url)
  }, [code, htmlValidation])

  const handleCodeChange = (language: keyof CodeContent, value: string) => {
    setCode((prev) => ({ ...prev, [language]: value }))
  }

  const loadTemplate = (template: Template) => {
    setCode(template.content)
    toast("Template loaded", {
      description: `${template.name} template has been loaded successfully.`,
    });

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

  // Load shared code from URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const sharedCode = urlParams.get("code")

    if (sharedCode) {
      try {
        const decoded = JSON.parse(atob(sharedCode))
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
      const url = `${window.location.origin}?code=${btoa(
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
        perform: () => setIsFullscreen((v) => !v),
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

  return (
    <>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />
      <div className={`h-screen flex flex-col bg-gray-50 dark:bg-gray-900 ${isFullscreen ? "fixed inset-0 z-50" : ""}`}>
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Code2 className="w-6 h-6 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Webify</h1>
              </div>

              <Select onValueChange={(value) => loadTemplate(templates.find((t) => t.id === value)!)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Choose template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        {template.icon}
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-xs text-gray-500">{template.description}</div>
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
                className="w-72 justify-start text-gray-500 dark:text-gray-400"
              >
                <Search className="w-4 h-4 mr-2" />
                Search commands...
                <kbd className="ml-auto hidden rounded border border-gray-200 px-1.5 py-0.5 text-[10px] sm:inline-block dark:border-gray-600">
                  ⌘K
                </kbd>
              </Button>
            </div>

            <div className="flex items-center gap-2">
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
                    ? `${window.location.origin}?code=${btoa(
                      JSON.stringify({
                        html: code.html,
                        css: code.css,
                        javascript: code.javascript,
                      })
                    )}`
                    : ""
                }
              />

              <Button variant="outline" size="sm" onClick={() => setIsFullscreen(!isFullscreen)}>
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>

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

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Code Editor */}
          {(layout === "code" || layout === "split") && (
            <div
              className={`${layout === "split" ? "w-1/2" : "w-full"} flex flex-col border-r border-gray-200 dark:border-gray-700`}
            >
              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as keyof CodeContent)}
                className="flex-1 flex flex-col"
              >
                <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="html" className="flex items-center gap-2 cursor-pointer">
                      <FileText className="w-4 h-4" />
                      HTML
                    </TabsTrigger>
                    <TabsTrigger value="css" className="flex items-center gap-2 cursor-pointer">
                      <Palette className="w-4 h-4" />
                      CSS
                    </TabsTrigger>
                    <TabsTrigger value="javascript" className="flex items-center gap-2 cursor-pointer">
                      <Zap className="w-4 h-4" />
                      JS
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1">
                  <TabsContent value="html" className="h-full m-0">
                    <MonacoEditor
                      language="html"
                      value={code.html}
                      onChange={(value) => handleCodeChange("html", value)}
                      theme={theme}
                      onEditorReady={(ed) => {
                        activeEditorRef.current = ed
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="css" className="h-full m-0">
                    <MonacoEditor
                      language="css"
                      value={code.css}
                      onChange={(value) => handleCodeChange("css", value)}
                      theme={theme}
                      onEditorReady={(ed) => {
                        activeEditorRef.current = ed
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="javascript" className="h-full m-0">
                    <MonacoEditor
                      language="javascript"
                      value={code.javascript}
                      onChange={(value) => handleCodeChange("javascript", value)}
                      theme={theme}
                      onEditorReady={(ed) => {
                        activeEditorRef.current = ed
                      }}
                    />
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          )}

          {/* Preview */}
          {(layout === "preview" || layout === "split") && (
            <div className={`${layout === "split" ? "w-1/2" : "w-full"} flex flex-col`}>
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-gray-900 dark:text-white">Live Preview</span>
                  {htmlValidation.isValid ? (
                    <Badge variant="secondary" className="text-xs">
                      Auto-refresh
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">
                      HTML syntax error
                    </Badge>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => window.open(previewRef.current?.src, "_blank")}>
                  <Maximize2 className="w-4 h-4 mr-2" />
                  Open in new tab
                </Button>
              </div>
              <div className="flex-1 bg-white">
                <iframe
                  ref={previewRef}
                  className="w-full h-full border-0"
                  title="Live Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
