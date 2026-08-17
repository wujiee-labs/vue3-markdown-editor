import type { App } from 'vue'
import WujieeMarkdownEditorComponent from './MarkdownEditor.vue'
import './style.css'

export const WujieeMarkdownEditor = WujieeMarkdownEditorComponent
export const MarkdownEditor = WujieeMarkdownEditorComponent
export { renderMarkdown, renderWujieeMarkdown } from './markdown'
export { htmlToMarkdown, convertWujieeHtmlToMarkdown } from './htmlToMarkdown'
export {
  countGraphemes,
  countWujieeGraphemes,
  countMarkdownCharacters,
  countWujieeMarkdownCharacters
} from './characterCount'
export {
  defaultEditorColors,
  defaultToolbar,
  defaultToolbarConfig,
  wujieeDefaultEditorColors,
  wujieeDefaultToolbar,
  wujieeDefaultToolbarConfig
} from './types'
export type {
  EditorColorConfig,
  EditorLabels,
  EditorMode,
  EditorTheme,
  EditorType,
  ValueFormat,
  ImageUploadHandler,
  ImageUploadResult,
  InsertPayload,
  ToolbarConfig,
  ToolbarControlName,
  ToolbarItemName
} from './types'

export default {
  install(app: App) {
    app.component('WujieeMarkdownEditor', WujieeMarkdownEditor)
  }
}
