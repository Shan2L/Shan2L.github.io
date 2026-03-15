<script setup>
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import { useRoute } from 'vue-router'
import { marked, Renderer, Slugger } from 'marked'
import hljs from 'highlight.js'

// 接收父组件传入的 fileName
const props = defineProps(['fileName'])
const route = useRoute()

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
  <div v-if="loading" class="loading">loading...</div>
  <div v-else class="markdown-container">
    <!-- 目录区域 -->
    <div v-if="filteredToc.length" class="toc-container">
      <div class="toc-title">Content</div>
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
    </div>
    
    <!-- 内容区域 -->
    <div class="markdown-content">
      <div v-highlight v-html="content" class="markdown-body"></div>
      <hr/>
      <div id="pagefoot">Welcome to sylvan's blog site!</div>
    </div>

  </div>
</template>

<style scoped>
/* 全局基础样式 - 楷体 + 加粗 */


.loading {
  padding: 20px;
  text-align: center;
  color: #666;
  font-size: 14px;
  font-weight: 600 !important;
  width: 95%;
  margin: 0 auto;
}

/* 整体容器：百分比布局 */
.markdown-container {
  width: 95%;
  max-width: 98%;
  margin: 0 auto 0 1%;
  padding: 24px 0; 
  display: flex;
  justify-content: flex-start;
  gap: 2%;
  overflow: visible;
}

/* 目录容器 */
.toc-container {
  width: 20%;
  min-width: 180px;
  max-width: 220px;
  position: sticky;
  top: 24px;
  align-self: flex-start;
  height: fit-content;
  padding: 16px;
  border-radius: 8px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  flex-shrink: 0;
}

.toc-title {
  font-size: 16px;
  font-weight: 600 !important;
  color: #212529;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e9ecef;
}

.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc-item {
  margin: 8px 0;
}

.toc-level-2 { padding-left: 0; }
.toc-level-3 { padding-left: 12px; }
.toc-level-4 { padding-left: 24px; }

.toc-link {
  color: #0d6efd;
  text-decoration: none;
  font-size: 14px;
  line-height: 1.5;
  font-weight: 500 !important;
}

.toc-link:hover {
  text-decoration: underline;
  color: #0a58ca;
  font-weight: 600 !important;
}

/* 锚点激活样式 */
:deep(.toc-active) {
  animation: tocHighlight 2s ease;
  background-color: #f0f8ff; /* 增加背景高亮，更易识别 */
  padding: 2px 8px;
  border-radius: 4px;
}

@keyframes tocHighlight {
  0% { background-color: #e7f5ff; }
  100% { background-color: transparent; }
}

/* 内容区域 - 修复滚动样式 */
.markdown-content {
  width: 78%;
  line-height: 1.8;
  font-size: 15px;
  color: #333;
  background-color: #fff;
  padding: 0 1% 0 0;
  overflow-wrap: break-word;
  word-wrap: break-word;
  /* overflow-x: hidden; */
  /* overflow-y: auto; */
  max-height: calc(100vh - 48px);
  /* scrollbar-width: thin; */
}

/* 代码块样式 */
.markdown-content :deep(.markdown-code-block) {
  position: relative;
  padding: 0;
  border-radius: 8px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  overflow-x: auto;
  margin: 20px 0;
  font-size: 14px;
  white-space: pre;
  word-wrap: normal;
  width: 100%;
}

/* 代码块内文字 */
.markdown-content :deep(.markdown-code-block code),
.markdown-content :deep(code),
.markdown-content :deep(.code-lang) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
  font-weight: 400 !important;
}

/* 表格样式 */
.markdown-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
  font-size: 14px;
  display: block;
  overflow-x: auto;
}

.markdown-content :deep(th) {
  padding: 12px 16px;
  border: 1px solid #e9ecef;
  text-align: left;
  background-color: #f8f9fa;
  font-weight: 600 !important;
  color: #212529;
}

.markdown-content :deep(td) {
  padding: 12px 16px;
  border: 1px solid #e9ecef;
  text-align: left;
  font-weight: 500 !important;
}

.markdown-content :deep(tr:nth-child(even)) {
  background-color: #fafbfc;
}

/* 代码块语言标签 */
.markdown-content :deep(.code-lang) {
  position: absolute;
  top: 0;
  right: 0;
  padding: 4px 12px;
  font-size: 12px;
  color: #666;
  background-color: #e9ecef;
  border-bottom-left-radius: 6px;
}

.markdown-content :deep(.markdown-code-block code) {
  display: block;
  padding: 20px 16px 16px;
  background: transparent;
  color: #212529;
  line-height: 1.6;
  width: 100%;
}

/* 行内代码 */
.markdown-content :deep(code) {
  padding: 2px 6px;
  border-radius: 4px;
  background: #f8f9fa;
  color: #d73a4a;
  font-size: 14px;
}

/* 引用块 */
.markdown-content :deep(blockquote) {
  margin: 20px 0;
  padding: 12px 16px;
  border-left: 3px solid #dee2e6;
  background-color: #f8f9fa;
  color: #6c757d;
  font-size: 14px;
  font-weight: 500 !important;
  width: 100%;
}

/* 标题样式 */
.markdown-content :deep(h1) {
  font-size: 28px;
  color: #212529;
  margin: 0 0 24px;
  font-weight: 700 !important;
  width: 100%;
}
.markdown-content :deep(h2) {
  font-size: 22px;
  color: #212529;
  margin: 32px 0 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e9ecef;
  font-weight: 600 !important;
}
.markdown-content :deep(h3) {
  font-size: 18px;
  color: #212529;
  margin: 24px 0 12px;
  font-weight: 600 !important;
}
.markdown-content :deep(h4) {
  font-size: 16px;
  color: #212529;
  margin: 20px 0 10px;
  font-weight: 500 !important;
}

/* 列表缩进减少一半 */
.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 16px 0;
  padding-left: 2.5%; /* 核心修改：缩进减少一半 */
}
.markdown-content :deep(li) {
  margin: 8px 0;
  font-weight: 500 !important;
  overflow-wrap: break-word;
}

/* 段落、链接 */
.markdown-content :deep(p) {
  margin: 16px 0;
  font-weight: 500 !important;
  overflow-wrap: break-word;
}
.markdown-content :deep(a) {
  color: #0d6efd;
  text-decoration: none;
  font-weight: 500 !important;
}
.markdown-content :deep(a:hover) {
  text-decoration: underline;
  color: #0a58ca;
  font-weight: 600 !important;
}

#pagefoot {
  text-align: center;
  color:  #d3d3d3;
  padding-bottom: 10%;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .markdown-container {
    flex-direction: column;
    width: 98%;
    margin: 0 1%;
    padding: 24px 0;
    gap: 3%;
  }
  .toc-container {
    width: 100%;
    max-width: 100%;
    position: static;
    margin-bottom: 16px;
  }
  .markdown-content {
    width: 100%;
    padding: 0 1%;
    max-height: calc(100vh - 120px);
  }
  /* 移动端列表缩进：从8%改为4%（减少一半） */
  .markdown-content :deep(ul),
  .markdown-content :deep(ol) {
    padding-left: 4%; /* 核心修改：移动端缩进也减少一半 */
  }

}
</style>