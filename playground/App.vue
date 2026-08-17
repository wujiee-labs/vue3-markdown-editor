<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  defaultEditorColors,
  defaultToolbarConfig,
  htmlToMarkdown,
  MarkdownEditor,
  renderMarkdown
} from '../src'

const dark = ref(false)
const editorType = ref<'markdown' | 'wysiwyg'>('wysiwyg')
const valueFormat = ref<'markdown' | 'html'>('markdown')
const bordered = ref(true)
const content = ref(`# WUJIEE Markdown Editor

这是一个轻量、开源、可换肤的 **Vue 3 Markdown 编辑器**。

- 支持表单里的 \`v-model\`
- 支持编辑、分栏和预览
- 支持浅色与深色主题

> 原始 HTML 默认不会被执行，预览更安全。

| 能力 | 状态 |
| --- | --- |
| Vue 3 | ✅ |
| Nuxt 3 / 4 | ✅ |
| TypeScript | ✅ |
`)

const installCode = 'pnpm add @wujiee/vue3-markdown-editor'
const usageCode = `<script setup lang="ts">
import { ref } from 'vue'
import { MarkdownEditor } from '@wujiee/vue3-markdown-editor'
import '@wujiee/vue3-markdown-editor/style.css'

const form = ref({ content: '' })

async function uploadImage(file: File) {
  const body = new FormData()
  body.append('file', file)
  const result = await fetch('/api/upload', { method: 'POST', body }).then(res => res.json())
  return { url: result.url, alt: file.name }
}
<\/script>

<template>
  <MarkdownEditor
    v-model="form.content"
    name="content"
    editor-type="wysiwyg"
    value-format="markdown"
    :maxlength="5000"
    :image-upload="uploadImage"
    required
  />
</template>`

const typeCode = `type ValueFormat = 'markdown' | 'html'
type EditorType = 'markdown' | 'wysiwyg'
type EditorMode = 'edit' | 'split' | 'preview'

interface ImageUploadResult {
  url: string
  alt?: string
}

interface EditorColorConfig {
  background: string
  backgroundSoft: string
  text: string
  muted: string
  border: string
  primary: string
  primaryContrast: string
  codeBackground: string
  toolbarBackground: string
  focusRing: string
}`

const toolbarConfigCode = JSON.stringify(defaultToolbarConfig, null, 2)
const colorsCode = JSON.stringify(defaultEditorColors, null, 2)

const livePayload = computed(() => JSON.stringify({
  field: 'content',
  editorType: editorType.value,
  valueFormat: valueFormat.value,
  value: content.value
}, null, 2))

const propRows = [
  ['v-model', 'string', "''", '编辑器内容；格式由 valueFormat 决定'],
  ['editorType', "'markdown' | 'wysiwyg'", "'markdown'", '源码编辑或所见即所得'],
  ['valueFormat', "'markdown' | 'html'", "'markdown'", '接口保存的数据格式'],
  ['name', 'string', '-', '原生表单字段名'],
  ['maxlength', 'number', '-', '最大可见字符数'],
  ['height / minHeight', 'string | number', '320 / 200', '高度及最小高度'],
  ['resizable', 'boolean', 'true', '允许从底部拖动高度'],
  ['bordered', 'boolean', 'true', '显示或隐藏全部边框'],
  ['toolbarConfig', 'Record<string, boolean>', '{}', '控制各工具按钮显示'],
  ['colors', 'Partial<EditorColorConfig>', '{}', 'JSON 化主题配色'],
  ['imageUpload', '(file: File) => Promise<...>', 'Base64', '业务图片上传函数']
]

function submit() {
  window.alert(`已提交 ${content.value.length} 个字符`)
}

function toggleValueFormat() {
  if (valueFormat.value === 'markdown') {
    content.value = renderMarkdown(content.value)
    valueFormat.value = 'html'
  } else {
    content.value = htmlToMarkdown(content.value)
    valueFormat.value = 'markdown'
  }
}
</script>

<template>
  <main class="demo" :data-theme="dark ? 'dark' : 'light'">
    <section class="demo__card">
      <header class="demo__header">
        <div>
          <p class="demo__eyebrow">@wujiee/vue3-markdown-editor</p>
          <h1>Markdown 在线编辑器</h1>
          <p>不绑定 UI 框架，适合直接放入业务表单。</p>
        </div>
        <div class="demo__actions">
          <button type="button" class="demo__theme" @click="editorType = editorType === 'wysiwyg' ? 'markdown' : 'wysiwyg'">
            {{ editorType === 'wysiwyg' ? '切换 Markdown 源码' : '切换所见即所得' }}
          </button>
          <button type="button" class="demo__theme" @click="bordered = !bordered">
            {{ bordered ? '切换无边框' : '显示边框' }}
          </button>
          <button type="button" class="demo__theme" @click="toggleValueFormat">
            当前保存：{{ valueFormat === 'markdown' ? 'Markdown' : 'HTML' }}
          </button>
          <button type="button" class="demo__theme" @click="dark = !dark">
            {{ dark ? '切换浅色' : '切换深色' }}
          </button>
        </div>
      </header>

      <form @submit.prevent="submit">
        <label class="demo__label" for="content">项目详情</label>
        <MarkdownEditor
          v-model="content"
          name="content"
          placeholder="请输入 Markdown 内容"
          :editor-type="editorType"
          :value-format="valueFormat"
          :bordered="bordered"
          :show-mode-switch="editorType === 'markdown'"
          :theme="dark ? 'dark' : 'light'"
          required
        />
        <button class="demo__submit" type="submit">提交表单</button>
      </form>

      <section class="docs" aria-labelledby="integration-title">
        <header class="docs__header">
          <p class="demo__eyebrow">INTEGRATION</p>
          <h2 id="integration-title">组件对接文档</h2>
          <p>编辑方式和保存格式相互独立。业务表单一般使用所见即所得，再根据接口字段选择保存 Markdown 或 HTML。</p>
        </header>

        <div class="docs__grid">
          <article class="docs__panel">
            <h3>安装</h3>
            <pre><code>{{ installCode }}</code></pre>
          </article>
          <article class="docs__panel">
            <h3>当前表单数据</h3>
            <p>上方编辑器变化时，这里的数据会实时更新。</p>
            <pre class="docs__live"><code>{{ livePayload }}</code></pre>
          </article>
        </div>

        <article class="docs__panel docs__panel--wide">
          <h3>Vue 3 / Nuxt 接入示例</h3>
          <pre><code>{{ usageCode }}</code></pre>
        </article>

        <article class="docs__panel docs__panel--wide">
          <h3>主要参数</h3>
          <div class="docs__table-wrap">
            <table class="docs__table">
              <thead><tr><th>参数</th><th>类型</th><th>默认值</th><th>说明</th></tr></thead>
              <tbody>
                <tr v-for="row in propRows" :key="row[0]">
                  <td><code>{{ row[0] }}</code></td><td><code>{{ row[1] }}</code></td><td><code>{{ row[2] }}</code></td><td>{{ row[3] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <div class="docs__grid">
          <article class="docs__panel">
            <h3>toolbarConfig 完整配置</h3>
            <p>值为 <code>true</code> 时显示，值为 <code>false</code> 时隐藏；没有传入的字段按 <code>true</code> 处理。</p>
            <pre><code>const toolbarConfig = {{ toolbarConfigCode }}</code></pre>
            <ul class="docs__key-list">
              <li><code>heading</code> 标题</li><li><code>bold</code> 粗体</li>
              <li><code>italic</code> 斜体</li><li><code>strike</code> 删除线</li>
              <li><code>quote</code> 引用</li><li><code>unordered-list</code> 无序列表</li>
              <li><code>ordered-list</code> 有序列表</li><li><code>task-list</code> 任务列表</li>
              <li><code>inline-code</code> 行内代码</li><li><code>code-block</code> 代码块</li>
              <li><code>link</code> 链接</li><li><code>image</code> 图片上传</li>
              <li><code>table</code> 表格</li><li><code>horizontal-rule</code> 分割线</li>
              <li><code>edit</code> 编辑视图</li><li><code>split</code> 分栏视图</li>
              <li><code>preview</code> 预览视图</li><li><code>fullscreen</code> 全屏</li>
            </ul>
          </article>

          <article class="docs__panel">
            <h3>colors 完整默认值</h3>
            <p>只传需要覆盖的字段即可，其余字段继续使用默认值或宿主项目 CSS 变量。</p>
            <pre><code>const colors = {{ colorsCode }}</code></pre>
            <ul class="docs__key-list">
              <li><code>background</code> 主背景</li><li><code>backgroundSoft</code> 次级背景</li>
              <li><code>text</code> 正文</li><li><code>muted</code> 次要文字</li>
              <li><code>border</code> 边框</li><li><code>primary</code> 品牌/选中颜色</li>
              <li><code>primaryContrast</code> 品牌色上的文字</li><li><code>codeBackground</code> 代码背景</li>
              <li><code>toolbarBackground</code> 工具栏背景</li><li><code>focusRing</code> 聚焦光圈</li>
            </ul>
          </article>
        </div>

        <div class="docs__grid">
          <article class="docs__panel">
            <h3>TypeScript 数据结构</h3>
            <pre><code>{{ typeCode }}</code></pre>
          </article>
          <article class="docs__panel">
            <h3>事件</h3>
            <ul class="docs__list">
              <li><code>update:modelValue(value)</code>：更新表单值</li>
              <li><code>change(value)</code>：内容变化</li>
              <li><code>limit(maximum)</code>：达到字符上限</li>
              <li><code>resize(height)</code>：拖动高度结束</li>
              <li><code>image-uploaded(result, file)</code>：图片上传完成</li>
              <li><code>image-upload-error(error, file)</code>：图片上传失败</li>
              <li><code>focus / blur / mode-change</code>：编辑器状态事件</li>
            </ul>
            <h3>HTML 展示</h3>
            <p><code>value-format="html"</code> 时接口值可直接用于详情页 HTML 展示；Markdown 格式则使用组件预览或 Markdown 解析器渲染。</p>
          </article>
        </div>
      </section>
    </section>
  </main>
</template>
