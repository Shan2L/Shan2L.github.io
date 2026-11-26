<script setup>
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import { useRoute } from 'vue-router'
import { marked, Renderer, Slugger } from 'marked'
import hljs from 'highlight.js'
import { posts, formatDate } from '@/posts.js'

// 接收父组件传入的 fileName
const props = defineProps(['fileName'])
const route = useRoute()
const meta = computed(() => posts.find((p) => p.fileName === props.fileName))
const wide = window.matchMedia('(min-width: 1180px)').matches

// 响应式数据
const loading = ref(true)
const title = ref('')
const content = ref('')
const toc = ref([]) // 目录数据 [{ id: '', text: '', level: 1 }]
// 新增：防止loadMarkdownFile重复执行的锁
const loadingLock = ref(false)

/**
 * 深度转义：转义所有Markdown特殊字符，彻底防止解析穿透
 * @param {string} str 原始代码内容
 * @returns {string} 完全转义后的字符串
 */
function deepEscapeMarkdown(str) {
  if (!str) return ''
  let escaped = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
  escaped = escaped
    .replace(/#/g, '&#35;')    // 转义#（标题）
    .replace(/\*/g, '&#42;')   // 转义*（加粗/斜体）
    .replace(/\[/g, '&#91;')   // 转义[（链接）
    .replace(/\]/g, '&#93;')   // 转义]（链接）
    .replace(/\(/g, '&#40;')   // 转义(（链接）
    .replace(/\)/g, '&#41;')   // 转义)（链接）
    .replace(/`/g, '&#96;')    // 转义`（行内代码）
    .replace(/!/g, '&#33;')    // 转义!（图片）
    .replace(/-/g, '&#45;')    // 转义-（列表）
  return escaped
}

// 动态引入高亮样式
function loadHighlightStyle() {
  if (document.querySelector('link[href*="highlight.js/styles/github.min.css"]')) {
    return
  }
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css'
  document.head.appendChild(link)
}

// 代码高亮指令（仅处理纯文本，不解析Markdown）
const vHighlight = {
  mounted(el) {
    nextTick(() => {
      highlightCodeBlocks(el)
    })
  },
  updated(el) {
    const blocks = el.querySelectorAll('pre code')
    blocks.forEach(block => {
      const rawCode = block.textContent
        .replace(/&#35;/g, '#')
        .replace(/&#42;/g, '*')
        .replace(/&#91;/g, '[')
        .replace(/&#93;/g, ']')
        .replace(/&#40;/g, '(')
        .replace(/&#41;/g, ')')
        .replace(/&#96;/g, '`')
        .replace(/&#33;/g, '!')
        .replace(/&#45;/g, '-')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
      block.textContent = rawCode
    })
    highlightCodeBlocks(el)
  }
}

function highlightCodeBlocks(el) {
  const blocks = el.querySelectorAll('pre code')
  blocks.forEach((block) => {
    const codeText = block.textContent
    const langClass = Array.from(block.classList).find(cls => cls.startsWith('language-'))
    let language = langClass ? langClass.replace('language-', '') : null

    let highlightedCode = ''
    if (language && hljs.getLanguage(language)) {
      try {
        highlightedCode = hljs.highlight(codeText, { language }).value
      } catch (err) {
        console.warn(`高亮${language}代码失败`, err)
        highlightedCode = hljs.highlightAuto(codeText).value
      }
    } else {
      highlightedCode = hljs.highlightAuto(codeText).value
    }

    block.innerHTML = highlightedCode
    
    const parentPre = block.parentElement
    let languageText = 'Plain Text'
    if (langClass) {
      languageText = langClass.replace('language-', '').toUpperCase()
    }
    
    if (!parentPre.querySelector('.code-lang')) {
      const langLabel = document.createElement('div')
      langLabel.className = 'code-lang'
      langLabel.textContent = languageText
      parentPre.insertBefore(langLabel, block)
    }
  })
}

/**
 * 严格清理标题文本：移除HTML标签、转义字符、行内代码，仅保留纯文本
 * @param {string} text 原始标题文本
 * @returns {string} 清理后的纯文本标题
 */
function cleanTitleText(text) {
  if (!text) return ''
  return text
    .replace(/<[^>]*>/g, '') // 移除HTML标签
    .replace(/&#\d+;/g, '')  // 移除转义字符（如&#35;）
    .replace(/`[^`]+`/g, '') // 移除行内代码
    .replace(/\s+/g, ' ')    // 合并多余空格
    .trim()                  // 去除首尾空格
}

/**
 * 生成唯一的标题ID（避免重复）
 * @param {string} cleanText 清理后的标题文本
 * @param {number} level 标题层级
 * @param {Slugger} slugger slug生成器
 * @returns {string} 唯一ID
 */
function generateUniqueTitleId(cleanText, level, slugger) {
  const baseSlug = slugger.slug(cleanText)
  const textHash = cleanText.split('').reduce((hash, char) => {
    return ((hash << 5) - hash) + char.charCodeAt(0)
  }, 0).toString(36)
  // ✅ 添加 'h' 前缀，确保 ID 不以数字开头
  return `h-title-${level}-${textHash}-${baseSlug}`.replace(/[^a-zA-Z0-9_-]/g, '')
}

function handleTocClick(id, e) {
  e.preventDefault()
  e.stopPropagation()

  // ✅ 修改：直接查询目标元素，不限制在 contentEl 内
  const targetElement = document.querySelector(`[id="${id}"]`)
  if (!targetElement) return

  // ✅ 修改：使用窗口滚动而非容器滚动
  const offsetTop = 80 // 根据你的固定导航高度调整
  const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - offsetTop

  window.scrollTo({
    top: targetPosition,
    behavior: 'smooth'
  })

  // 高亮效果保持不变
  targetElement.classList.add('toc-active')
  setTimeout(() => {
    targetElement.classList.remove('toc-active')
  }, 2000)
}

// 处理MD内容（仅清理正文元信息）
function processMdContent(rawContent) {
  let processedContent = rawContent
  processedContent = processedContent.replace(/^---[\s\S]*?---\n?/m, '')
  const titleMatch = processedContent.match(/^#\s+(.*)$/m)
  let extractedTitle = ''
  if (titleMatch) {
    extractedTitle = cleanTitleText(titleMatch[1])
    processedContent = processedContent.replace(/^#\s+.*\n?/, '')
  }
  processedContent = processedContent.replace(/^\s*date:\s*.+\n?/m, '')
  processedContent = processedContent.replace(/^\s*\n/, '')
  return {
    title: extractedTitle,
    content: processedContent
  }
}

// 加载MD文件（重置toc，避免累积冗余）
async function loadMarkdownFile() {
  // 新增：加锁防止重复执行
  if (loadingLock.value) return
  loadingLock.value = true

  try {
    loading.value = true
    // 强制清空toc，彻底避免累积
    toc.value = [] 
    // 每次加载重新创建slugger，确保slug从0开始生成
    const slugger = new Slugger()

    // 修复：重写renderer，确保每次解析都是全新的renderer（避免复用导致重复）
    const customRenderer = new Renderer()

    customRenderer.heading = function (text, level, raw) {
      const cleanText = cleanTitleText(text)
      // 仅收集2-4级且非空的标题
      if (!cleanText || level < 2 || level > 4) {
        return `<h${level}>${text}</h${level}>`
      }
      // 生成绝对唯一的ID
      const id = generateUniqueTitleId(cleanText, level, slugger)
      // 严格去重：text+level+id任一重复都不添加
      const isDuplicate = toc.value.some(item => 
        item.text === cleanText && item.level === level || item.id === id
      )
      if (!isDuplicate) {
        toc.value.push({
          id,
          text: cleanText,
          level: level
        })
      }
      return `<h${level} id="${id}">${text}</h${level}>`
    }

    // 重写code方法：核心阻止代码块内Markdown解析
    customRenderer.code = function (code, lang, escaped) {
      const fullyEscapedCode = deepEscapeMarkdown(code)
      return `<pre class="markdown-code-block"><code class="language-${lang || 'plaintext'}">${fullyEscapedCode}</code></pre>`
    }

    // 重新配置marked（每次解析都用新的renderer）
    marked.setOptions({
      highlight: (code, lang) => code,
      breaks: true,
      gfm: true,
      tables: true,
      headerIds: false,
      mangle: false,
      renderer: customRenderer,
      html: false,
      looseLists: false,
      looseReferenceLinks: false
    })
    
    const fileName = props.fileName || route.params.fileName
    if (!fileName) {
      content.value = '<p>未指定要加载的 Markdown 文件</p>'
      loading.value = false
      loadingLock.value = false
      return
    }

    const mdModules = import.meta.glob('../posts/*.md', { query: '?raw' })
    const filePath = `../posts/${fileName.endsWith('.md') ? fileName : `${fileName}.md`}`

    if (!mdModules[filePath]) {
      content.value = `<p>未找到文件：${filePath.replace('../posts/', '')}</p>`
      loading.value = false
      loadingLock.value = false
      return
    }

    let rawContent = await mdModules[filePath]()
    if (typeof rawContent === 'object' && rawContent.default) {
      rawContent = rawContent.default
    }
    if (typeof rawContent !== 'string') {
      throw new Error(`MD 文件内容不是字符串：${typeof rawContent}`)
    }

    const { title: extractedTitle, content: processedContent } = processMdContent(rawContent)
    title.value = extractedTitle || fileName.replace('.md', '')
    content.value = marked.parse(processedContent)
    
    // 等待DOM完全渲染
    await nextTick()
    await nextTick()
  } catch (error) {
    console.error('加载 Markdown 文件失败：', error)
    content.value = `<p>加载文件失败：${error.message}</p>`
  } finally {
    loading.value = false
    // 释放锁
    loadingLock.value = false
  }
}

// 计算属性：最终渲染的目录（双重去重）
const filteredToc = computed(() => {
  // 第一步：按text+level去重（核心解决重复显示问题）
  const uniqueMap = new Map()
  toc.value.forEach(item => {
    // 用text+level作为唯一key，确保同文本同层级只保留一个
    const key = `${item.text}-${item.level}`
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item)
    }
  })
  // 第二步：过滤无效项，转为数组
  return Array.from(uniqueMap.values()).filter(item => 
    item.text.trim() && item.level >= 2 && item.level <= 4
  )
})

// 修复：优化watch，防抖+只监听有效变化
watch(
  [() => props.fileName, () => route.params.fileName],
  async ([newFileName, newRouteFileName]) => {
    // 防抖：短时间内重复触发则跳过
    await new Promise(resolve => setTimeout(resolve, 100))
    const finalFileName = newFileName || newRouteFileName
    if (finalFileName) {
      loadMarkdownFile()
    }
  },
  { 
    immediate: true, 
    deep: true,
    flush: 'post' // 确保DOM更新后再执行
  }
)

// 挂载执行
onMounted(() => {
  loadHighlightStyle()
  // 避免watch和onMounted重复触发
  setTimeout(() => loadMarkdownFile(), 100)
})
</script>

<template>
  <div v-if="loading" class="page loading">Loading…</div>
  <div v-else class="post-layout">
    <details v-if="filteredToc.length" class="toc-container" :open="wide">
      <summary class="section-label">Contents</summary>
      <ul class="toc-list">
        <li 
          v-for="item in filteredToc" 
          :key="item.id"
          :class="['toc-item', `toc-level-${item.level}`]">
          <a 
            :href="'#' + item.id" 
            class="toc-link"
            @click="handleTocClick(item.id, $event)"
          >
            {{ item.text }}
          </a>
        </li>
      </ul>
    </details>

    <article class="markdown-content">
      <header class="post-header">
        <time v-if="meta">{{ formatDate(meta.date) }}</time>
        <h1>{{ meta?.title || title }}</h1>
      </header>
      <div v-highlight v-html="content" class="markdown-body"></div>
      <router-link to="/item_list" class="back">&larr; All writing</router-link>
    </article>
  </div>
</template>

<style scoped>
.loading {
  color: var(--muted);
  font-size: 14px;
}

.post-layout {
  display: grid;
  grid-template-columns: minmax(0, var(--measure));
  justify-content: center;
  padding: 0 24px;
}

.markdown-content {
  min-width: 0;
}

.toc-container {
  margin-bottom: 40px;
  padding: 12px 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.toc-container summary {
  margin: 0;
  cursor: pointer;
}

.toc-container[open] summary {
  margin-bottom: 8px;
}

.toc-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.toc-item {
  margin: 6px 0;
  font-size: 13px;
  line-height: 1.45;
}

.toc-level-3 { padding-left: 12px; }
.toc-level-4 { padding-left: 24px; }

.toc-link {
  color: var(--muted);
  text-decoration: none;
  transition: color 200ms ease;
}

.toc-link:hover {
  color: var(--heading);
}

@media (min-width: 1180px) {
  .post-layout {
    grid-template-columns: 200px minmax(0, var(--measure)) 200px;
    column-gap: 56px;
  }
  .markdown-content {
    grid-column: 2;
    grid-row: 1;
  }
  .toc-container {
    grid-column: 3;
    grid-row: 1;
    position: sticky;
    top: 48px;
    align-self: start;
    max-height: calc(100vh - 96px);
    overflow-y: auto;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .toc-container summary {
    list-style: none;
    pointer-events: none;
  }
  .toc-container summary::-webkit-details-marker {
    display: none;
  }
}

:deep(.toc-active) {
  animation: tocHighlight 2s ease;
}

@keyframes tocHighlight {
  0% { background-color: #e1f3fe; }
  100% { background-color: transparent; }
}

.post-header {
  margin-bottom: 40px;
}

.post-header time {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--muted);
}

.post-header h1 {
  margin: 8px 0 0;
  font-family: var(--serif);
  font-size: clamp(30px, 5vw, 40px);
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--heading);
}

.markdown-body {
  overflow-wrap: break-word;
}

.markdown-body :deep(p) {
  margin: 0 0 20px;
}

.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  color: var(--heading);
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.markdown-body :deep(h2) {
  margin: 56px 0 16px;
  font-size: 24px;
}

.markdown-body :deep(h3) {
  margin: 40px 0 12px;
  font-size: 19px;
}

.markdown-body :deep(h4) {
  margin: 32px 0 8px;
  font-size: 16px;
}

.markdown-body :deep(a) {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-color: rgba(31, 108, 159, 0.3);
  text-underline-offset: 3px;
}

.markdown-body :deep(a:hover) {
  text-decoration-color: currentColor;
}

.markdown-body :deep(strong) {
  color: var(--heading);
  font-weight: 600;
}

.markdown-body :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 32px auto;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0 0 20px;
  padding-left: 1.4em;
}

.markdown-body :deep(li) {
  margin: 6px 0;
}

.markdown-body :deep(blockquote) {
  margin: 24px 0;
  padding: 2px 0 2px 20px;
  border-left: 2px solid var(--border);
  color: var(--muted);
}

.markdown-body :deep(hr) {
  margin: 48px 0;
  border: 0;
  border-top: 1px solid var(--border);
}

.markdown-body :deep(code) {
  font-family: var(--mono);
  font-size: 0.875em;
  padding: 0.15em 0.4em;
  border-radius: 4px;
  background: var(--surface);
  color: var(--heading);
}

.markdown-body :deep(.markdown-code-block) {
  position: relative;
  margin: 28px 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  overflow-x: auto;
  font-size: 13.5px;
  line-height: 1.6;
}

.markdown-body :deep(.markdown-code-block code) {
  display: block;
  padding: 36px 20px 18px;
  background: transparent;
  border-radius: 0;
  font-size: inherit;
  white-space: pre;
}

.markdown-body :deep(.code-lang) {
  position: absolute;
  top: 10px;
  right: 14px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.markdown-body :deep(table) {
  display: block;
  width: 100%;
  margin: 28px 0;
  overflow-x: auto;
  border-collapse: collapse;
  font-size: 14px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}

.markdown-body :deep(th) {
  color: var(--heading);
  font-weight: 600;
}

.back {
  display: inline-block;
  margin-top: 56px;
  font-size: 14px;
  color: var(--muted);
  text-decoration: none;
}

.back:hover {
  color: var(--heading);
}
</style>