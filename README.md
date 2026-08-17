# @wujiee/vue3-markdown-editor

一个面向 Vue 3 表单的轻量 Markdown 编辑器。不绑定 Ant Design Vue、Nuxt UI、Tailwind 或其他 UI 框架，个人和商业项目均可免费使用，但必须保留组件右下角的 WUJIEE 链接。

## 功能

- 标题、粗体、斜体、删除线、引用、列表、任务列表、代码、链接、图片、表格、分割线
- Markdown 源码与所见即所得两种编辑方式
- 编辑、分栏预览、纯预览和全屏模式
- 图片选择、上传状态、大小校验和自定义业务上传函数
- 即时图标悬浮提示、描边与无边框外观
- 默认可上下拖动高度，也支持固定高度和最小/最大高度
- JSON 工具栏开关、JSON 配色和逐按钮插槽
- 按 Unicode 字素统计与限制字符数，组合表情也只算一个字
- `v-model`、`name`、`required`、`maxlength`、`disabled`、`readonly`
- PC 双栏、移动端上下布局
- 中文与英文文案，可覆盖任意按钮文案
- CSS 变量换肤，自动跟随系统或宿主项目的主题变量
- 默认关闭 Markdown 内的原始 HTML，并过滤危险链接
- 完整 TypeScript 类型，兼容 Nuxt 3 / Nuxt 4

## 安装

```bash
pnpm add @wujiee/vue3-markdown-editor
```

## Vue 3 使用

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { MarkdownEditor } from '@wujiee/vue3-markdown-editor'
import '@wujiee/vue3-markdown-editor/style.css'

const content = ref('')

async function uploadImage(file: File) {
  const body = new FormData()
  body.append('file', file)
  const result = await fetch('/api/upload', { method: 'POST', body }).then(res => res.json())
  return { url: result.url, alt: file.name }
}
</script>

<template>
  <form @submit.prevent="save">
    <MarkdownEditor
      v-model="content"
      name="content"
      editor-type="wysiwyg"
      placeholder="请输入项目详情"
      :maxlength="5000"
      :image-upload="uploadImage"
      required
    />
  </form>
</template>
```

也可以全局注册：

```ts
import { createApp } from 'vue'
import WujieeMarkdownEditor from '@wujiee/vue3-markdown-editor'
import '@wujiee/vue3-markdown-editor/style.css'

createApp(App).use(WujieeMarkdownEditor).mount('#app')
```

## Nuxt 使用

在组件中直接导入即可；编辑器没有访问服务端 DOM 的顶层代码，可以 SSR：

```vue
<script setup lang="ts">
import { MarkdownEditor } from '@wujiee/vue3-markdown-editor'
import '@wujiee/vue3-markdown-editor/style.css'
</script>
```

若希望全局注册，可创建 `plugins/markdown-editor.ts`：

```ts
import WujieeMarkdownEditor from '@wujiee/vue3-markdown-editor'
import '@wujiee/vue3-markdown-editor/style.css'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(WujieeMarkdownEditor)
})
```

## 两种编辑方式

业务表单使用所见即所得模式。用户点工具栏后直接看到标题、粗体、列表等最终效果。默认 `v-model` 保存 Markdown：

```vue
<MarkdownEditor
  v-model="form.content"
  editor-type="wysiwyg"
  :bordered="false"
/>
```

## 保存为 Markdown 或 HTML

`valueFormat` 控制 `v-model` 和表单字段最终保存的数据格式，默认值为 `markdown`，因此现有项目升级后不需要迁移数据。

保存 Markdown：

```vue
<MarkdownEditor
  v-model="form.content"
  editor-type="wysiwyg"
  value-format="markdown"
/>
```

如果业务详情页直接使用 HTML 渲染，可以保存为 HTML：

```vue
<MarkdownEditor
  v-model="form.content_html"
  editor-type="wysiwyg"
  value-format="html"
/>
```

此时 `form.content_html` 得到的是 `<h2>...</h2><p>...</p>` 等 HTML，而不是 Markdown。传入已有 HTML 时也可以正常回显；组件会把 HTML 按自身支持的标题、列表、链接、图片、表格等能力重新规范化，不会直接执行外部传入的脚本或事件属性。

`editorType` 决定用户看到的是源码编辑还是所见即所得，`valueFormat` 决定接口保存 Markdown 还是 HTML，两者可以独立配置。在源码编辑模式下，即使选择 HTML 存储，编辑区仍使用更适合编写的 Markdown，组件会在更新 `v-model` 时转换成 HTML。

需要让熟悉 Markdown 的用户编辑源码时：

```vue
<MarkdownEditor
  v-model="form.content"
  editor-type="markdown"
  mode="split"
/>
```

只读展示也可以完全由参数控制，不向用户显示切换按钮：

```vue
<MarkdownEditor
  v-model="detail.content"
  editor-type="markdown"
  mode="preview"
  readonly
  :show-toolbar="false"
  :show-mode-switch="false"
  :show-statusbar="false"
  :bordered="false"
/>
```

## 图片上传

点击图片按钮会打开文件选择器。生产项目通过 `imageUpload` 传入自己的上传函数，函数可以返回 URL 字符串，也可以返回 `{ url, alt }`：

```ts
import type { ImageUploadHandler } from '@wujiee/vue3-markdown-editor'

const uploadImage: ImageUploadHandler = async (file) => {
  const body = new FormData()
  body.append('file', file)
  const result = await $fetch<{ url: string }>('/api/v1/upload/image', {
    method: 'POST',
    body
  })
  return { url: result.url, alt: file.name }
}
```

```vue
<MarkdownEditor
  v-model="form.content"
  editor-type="wysiwyg"
  :image-upload="uploadImage"
  image-accept="image/png,image/jpeg,image/webp"
  :max-image-size="5 * 1024 * 1024"
  @image-upload-error="handleUploadError"
/>
```

未传 `imageUpload` 时会使用 Base64 作为本地兜底，适合演示或小图片；生产环境建议上传到对象存储后返回 HTTPS URL。

## 表格编辑

在所见即所得模式中，点击工具栏的“表格”即可插入一张表。点击任意单元格后，表格上方会出现“增加行、增加列、删除行、删除列”四个操作：

- “增加行”会在当前行下方插入一行。
- “增加列”会在当前列右侧插入一列。
- 表头不能删除；表格至少保留一列。
- 把鼠标移到单元格右边界，光标变成左右拖动样式后即可修改列宽。

列宽会随 `v-model` 一起保存为 `<!-- wujiee-table-widths: ... -->` 元数据，重新加载内容时自动恢复，业务接口不需要增加字段。在 Markdown 源码模式中，也可以继续用 `|` 语法手动增加行列。

## 主题

`theme` 支持 `auto`（默认）、`light` 和 `dark`。`auto` 会优先继承宿主项目变量，同时支持系统深色模式。

编辑器会优先继承以下常见的宿主项目 CSS 变量：

- `--color-surface` / `--color-surface-container-lowest`
- `--color-surface-soft` / `--color-surface-container-low`
- `--color-text` / `--color-on-background`
- `--color-muted` / `--color-on-surface-variant`
- `--color-cta` / `--color-primary`
- `--color-outline-variant`
- `--radius-md`

任何项目都可以直接覆盖组件变量：

```css
.my-form .wmd {
  --wmd-bg: var(--panel-bg);
  --wmd-bg-soft: var(--panel-muted-bg);
  --wmd-color: var(--text-color);
  --wmd-muted: var(--muted-color);
  --wmd-border: var(--border-color);
  --wmd-primary: var(--brand-color);
  --wmd-radius: 12px;
  --wmd-height: 420px;
  --wmd-font-size: 15px;
}
```

也可以完全通过 JSON 传入颜色，不需要额外写 CSS：

```ts
const editorColors = {
  background: '#ffffff',
  backgroundSoft: '#f6f7f9',
  text: '#1f2937',
  muted: '#6b7280',
  border: '#d9dde5',
  primary: '#ef8d6f',
  primaryContrast: '#ffffff',
  codeBackground: '#f3f4f6',
  toolbarBackground: '#f6f7f9',
  focusRing: 'rgb(239 141 111 / 0.24)'
}
```

```vue
<MarkdownEditor v-model="content" :colors="editorColors" />
```

包同时导出了 `defaultEditorColors`，可以在默认方案上只覆盖部分颜色。

## 工具栏 JSON 配置

`toolbarConfig` 中任何一项设为 `false` 就不会渲染。未填写的项目默认显示：

```ts
const toolbarConfig = {
  heading: true,
  bold: true,
  italic: true,
  strike: true,
  quote: true,
  'unordered-list': true,
  'ordered-list': true,
  'task-list': true,
  'inline-code': true,
  'code-block': true,
  link: true,
  image: true,
  table: true,
  'horizontal-rule': true,
  edit: true,
  split: true,
  preview: true,
  fullscreen: true
}
```

```vue
<MarkdownEditor v-model="content" :toolbar-config="toolbarConfig" />
```

`toolbar` 数组仍可用于控制按钮顺序；`toolbarConfig` 用于控制是否显示。

## 工具栏插槽

每个按钮都有独立插槽：`toolbar-heading`、`toolbar-bold`、`toolbar-image`、`toolbar-table`、`toolbar-edit`、`toolbar-fullscreen` 等。插槽会收到 `item`、`label`、`disabled`、`active` 和 `action`：

```vue
<MarkdownEditor v-model="content">
  <template #toolbar-table="{ action, disabled }">
    <button type="button" :disabled="disabled" @click="action">
      我的表格按钮
    </button>
  </template>
</MarkdownEditor>
```

也可以使用 `toolbar-item` 一个插槽统一替换所有默认按钮。

## 高度与拖动

默认 `height=320`、`minHeight=200`、`resizable=true`。组件最底部整条区域都可以拖动，不单独占一行、没有边框，鼠标移入时才显示中间提示；在底部任意位置向上或向下拖动即可改变高度：

```vue
<MarkdownEditor
  v-model="content"
  :height="360"
  :min-height="220"
  :max-height="720"
  resizable
  @resize="saveEditorHeight"
/>
```

需要固定高度时关闭拖动：

```vue
<MarkdownEditor v-model="content" :height="400" :resizable="false" />
```

## 字符统计与限制

`maxlength` 限制的是最终可见文字的 Unicode 字素数，而不是 JavaScript 的 UTF-16 长度：

- 一个中文算 1 个字符
- 一个英文字母算 1 个字符
- `😀` 算 1 个字符
- `👨‍👩‍👧‍👦` 这样的组合表情也算 1 个字符
- Markdown 的 `**`、`##`、链接地址等格式语法不计入可见文字

达到限制后组件会阻止继续更新，并触发 `limit` 事件。

## Props

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `modelValue` | `string` | `''` | Markdown 或 HTML 内容，使用 `v-model` |
| `name` | `string` | - | 原生表单字段名 |
| `placeholder` | `string` | `''` | 输入提示 |
| `height` | `string \| number` | `320` | 编辑区高度 |
| `minHeight` | `string \| number` | `200` | 最小高度 |
| `maxlength` | `number` | - | 最大可见 Unicode 字符数 |
| `required` | `boolean` | `false` | 原生必填校验 |
| `disabled` | `boolean` | `false` | 禁用 |
| `readonly` | `boolean` | `false` | 只读 |
| `autofocus` | `boolean` | `false` | 挂载后聚焦 |
| `mode` | `'edit' \| 'split' \| 'preview'` | `'split'` | 当前视图；外部变化时会同步 |
| `editorType` | `'markdown' \| 'wysiwyg'` | `'markdown'` | Markdown 源码或所见即所得编辑 |
| `valueFormat` | `'markdown' \| 'html'` | `'markdown'` | `v-model` 和表单提交值的保存格式 |
| `theme` | `'auto' \| 'light' \| 'dark'` | `'auto'` | 主题模式 |
| `bordered` | `boolean` | `true` | 是否显示组件外边框 |
| `resizable` | `boolean` | `true` | 是否允许上下拖动高度 |
| `maxHeight` | `string \| number` | - | 拖动最大高度 |
| `locale` | `'zh-CN' \| 'en-US'` | `'zh-CN'` | 内置语言 |
| `labels` | `Partial<EditorLabels>` | `{}` | 覆盖文案 |
| `toolbar` | `ToolbarItemName[]` | 全部 | 工具栏项目及顺序 |
| `toolbarConfig` | `ToolbarConfig` | 全部显示 | JSON 控制每个按钮是否显示 |
| `colors` | `Partial<EditorColorConfig>` | 默认配色 | JSON 覆盖组件颜色 |
| `showToolbar` | `boolean` | `true` | 显示工具栏 |
| `showStatusbar` | `boolean` | `true` | 显示字符统计；WUJIEE 署名始终保留 |
| `showModeSwitch` | `boolean` | `true` | 显示视图切换 |
| `allowFullscreen` | `boolean` | `true` | 允许全屏 |
| `imageUpload` | `(file) => Promise<string \| { url, alt? }>` | Base64 | 业务图片上传函数 |
| `imageAccept` | `string` | 常见图片类型 | 文件选择器的 `accept` |
| `maxImageSize` | `number` | `10485760` | 单张图片最大字节数 |

事件包括 `update:modelValue`、`change`、`focus`、`blur`、`mode-change`、`resize`、`limit`、`image-uploaded` 和 `image-upload-error`。

## 实例方法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { MarkdownEditor } from '@wujiee/vue3-markdown-editor'

const editor = ref<InstanceType<typeof MarkdownEditor>>()

function insertMention() {
  editor.value?.insert({ before: '@', placeholder: '用户名' })
}
</script>
```

组件暴露 `focus()`、`blur()`、`insert(payload)`、`triggerImagePicker()`、`textarea` 和 `richEditor`。

## 快捷键

- `Ctrl/Cmd + B`：粗体
- `Ctrl/Cmd + I`：斜体
- `Ctrl/Cmd + K`：链接
- `Tab`：插入两个空格
- 全屏时 `Esc`：退出全屏

## 本地开发与发布

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

发布前确认 npm 组织中存在 `@wujiee` scope，然后：

```bash
npm login
npm publish --access public
```

如 scope 名称不同，只需修改 `package.json` 的 `name`。

## License

本项目使用 [WUJIEE Attribution License 1.0](./LICENSE)：

- 允许个人使用和商业使用
- 允许复制、修改和分发
- 必须保留组件右下角可见、可点击的 [WUJIEE](https://wujiee.com) 链接
- 不允许隐藏、移除、改名、禁用或重定向该链接
- 如需移除署名，必须另行取得 WUJIEE 的书面授权

该许可证包含额外的界面署名条件，因此不是 MIT，也不属于 OSI 认可的标准开源许可证；发布时应准确称为“源码可用的署名许可证”。
