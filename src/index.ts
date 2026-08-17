import type { App, DefineComponent } from 'vue'
import WujieeMarkdownEditorComponent from './MarkdownEditor.vue'
import type { WujieeMarkdownEditorExposed, WujieeMarkdownEditorProps } from './types'
import './style.css'

const wujieeMarkdownEditorComponent = WujieeMarkdownEditorComponent as unknown as DefineComponent<WujieeMarkdownEditorProps, WujieeMarkdownEditorExposed>

export const WujieeMarkdownEditor = wujieeMarkdownEditorComponent
export const MarkdownEditor = wujieeMarkdownEditorComponent
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
  WujieeMarkdownEditorExposed,
  WujieeMarkdownEditorProps,
  ToolbarConfig,
  ToolbarControlName,
  ToolbarItemName
} from './types'

export default {
  install(app: App) {
    app.component('WujieeMarkdownEditor', WujieeMarkdownEditor)
  }
}
