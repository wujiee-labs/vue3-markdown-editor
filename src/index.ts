import type { App } from 'vue'
import MarkdownEditor from './MarkdownEditor.vue'
import './style.css'

export { MarkdownEditor }
export { renderMarkdown } from './markdown'
export { htmlToMarkdown } from './htmlToMarkdown'
export { countGraphemes, countMarkdownCharacters } from './characterCount'
export { defaultEditorColors, defaultToolbar, defaultToolbarConfig } from './types'
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
    app.component('WujieeMarkdownEditor', MarkdownEditor)
  }
}
