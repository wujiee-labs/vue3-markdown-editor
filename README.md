# @wujiee/vue3-markdown-editor

一个轻量、可定制的 Vue 3 Markdown 编辑器，适合直接放入业务表单。

- 支持 Markdown 源码与所见即所得编辑
- 支持图片上传、表格、预览、全屏和字符限制
- 支持亮色、暗色、无边框及 JSON 配色
- 支持自定义工具栏、按钮插槽和编辑器高度
- 支持将内容保存为 Markdown 或 HTML

<img src="https://wujiee.com/logo.svg" width="20" height="20" alt="WUJIEE云工作" align="absmiddle"> [WUJIEE云工作](https://wujiee.com) 是专注于远程工作与远程项目自由合作的垂直远程协助平台，为企业和人才提供远程招聘、自由职业接单与在线协作服务。

GitHub：[wujiee-labs/vue3-markdown-editor](https://github.com/wujiee-labs/vue3-markdown-editor)

## 安装

```bash
pnpm add @wujiee/vue3-markdown-editor
```

也可以使用 npm：

```bash
npm install @wujiee/vue3-markdown-editor
```

## 快速开始

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { MarkdownEditor } from '@wujiee/vue3-markdown-editor'
import '@wujiee/vue3-markdown-editor/style.css'

const content = ref('')
</script>

<template>
  <MarkdownEditor
    v-model="content"
    editor-type="wysiwyg"
    placeholder="请输入内容"
  />
</template>
```

全局注册：

```ts
import { createApp } from 'vue'
import WujieeMarkdownEditor from '@wujiee/vue3-markdown-editor'
import '@wujiee/vue3-markdown-editor/style.css'

createApp(App).use(WujieeMarkdownEditor).mount('#app')
```

## 图片上传

通过 `imageUpload` 接入自己的上传服务。未传入时，图片会以 Base64 写入内容，仅建议用于本地测试。

```vue
<script setup lang="ts">
async function uploadImage(file: File) {
  const body = new FormData()
  body.append('file', file)

  const result = await fetch('/api/upload', {
    method: 'POST',
    body
  }).then(response => response.json())

  return { url: result.url, alt: file.name }
}
</script>

<template>
  <MarkdownEditor
    v-model="content"
    editor-type="wysiwyg"
    :image-upload="uploadImage"
  />
</template>
```

## 常用配置

```vue
<MarkdownEditor
  v-model="content"
  editor-type="wysiwyg"
  value-format="html"
  theme="auto"
  :bordered="false"
  :height="360"
  :min-height="200"
  :maxlength="5000"
  :toolbar-config="toolbarConfig"
  :colors="colors"
/>
```

```ts
const toolbarConfig = {
  heading: true,
  bold: true,
  italic: true,
  link: true,
  image: true,
  table: true,
  preview: false,
  fullscreen: true
}

const colors = {
  background: '#ffffff',
  backgroundSoft: '#f6f7f9',
  text: '#1f2937',
  muted: '#6b7280',
  border: '#d9dde5',
  primary: '#ef8d6f'
}
```

`toolbarConfig` 中未填写的按钮默认显示。所有工具栏按钮也可以通过 `toolbar-*` 插槽替换，例如：

```vue
<MarkdownEditor v-model="content">
  <template #toolbar-image="{ action, disabled }">
    <button type="button" :disabled="disabled" @click="action">
      上传图片
    </button>
  </template>
</MarkdownEditor>
```

## 主要属性

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `editorType` | `markdown` | `markdown` 或 `wysiwyg` |
| `valueFormat` | `markdown` | `v-model` 保存为 `markdown` 或 `html` |
| `mode` | `split` | `edit`、`split` 或 `preview` |
| `theme` | `auto` | `auto`、`light` 或 `dark` |
| `bordered` | `true` | 是否显示边框 |
| `height` | `320` | 编辑器高度 |
| `minHeight` | `200` | 可拖动的最小高度 |
| `maxHeight` | - | 可拖动的最大高度 |
| `resizable` | `true` | 是否允许从底部拖动高度 |
| `maxlength` | - | 最大可见字符数，中文、字母及组合表情均按一个字符统计 |
| `toolbarConfig` | 全部显示 | 使用 JSON 控制按钮是否显示 |
| `colors` | 默认配色 | 使用 JSON 覆盖主题颜色 |
| `imageUpload` | Base64 | 自定义图片上传函数 |
| `readonly` | `false` | 只读模式 |
| `disabled` | `false` | 禁用编辑器 |

完整类型定义可直接从包内导入，编辑器事件包括 `change`、`focus`、`blur`、`resize`、`limit`、`image-uploaded` 和 `image-upload-error`。

## 本地开发

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

## License

本项目采用 [WUJIEE Attribution License 1.0](./LICENSE)：允许个人及商业使用、修改和分发，但必须保留编辑器右下角可见且可点击的 [WUJIEE](https://wujiee.com) 链接。移除署名需要另行取得 WUJIEE 的书面授权。
