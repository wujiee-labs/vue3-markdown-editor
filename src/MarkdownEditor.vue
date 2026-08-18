<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import WujieeIcon from './Icon.vue'
import { countWujieeMarkdownCharacters } from './characterCount'
import { wujieeEnUSLabels, wujieeZhCNLabels } from './labels'
import { wujieeInsertBlock, wujieeInsertTab, wujieePrefixLines, wujieeWrapSelection, type CommandResult } from './editorCommands'
import { convertWujieeHtmlToMarkdown } from './htmlToMarkdown'
import { renderWujieeMarkdown } from './markdown'
import {
  wujieeDefaultToolbar,
  type EditorLabels,
  type EditorMode,
  type EditorTheme,
  type EditorType,
  type ValueFormat,
  type EditorColorConfig,
  type ImageUploadHandler,
  type ImageUploadResult,
  type InsertPayload,
  type ToolbarConfig,
  type ToolbarItemName
} from './types'

const wujieeProps = withDefaults(defineProps<{
  modelValue?: string
  name?: string
  placeholder?: string
  height?: string | number
  minHeight?: string | number
  maxHeight?: string | number
  resizable?: boolean
  maxlength?: number
  required?: boolean
  disabled?: boolean
  readonly?: boolean
  autofocus?: boolean
  mode?: EditorMode
  editorType?: EditorType
  valueFormat?: ValueFormat
  theme?: EditorTheme
  bordered?: boolean
  locale?: 'zh-CN' | 'en-US'
  labels?: Partial<EditorLabels>
  toolbar?: ToolbarItemName[]
  toolbarConfig?: ToolbarConfig
  colors?: Partial<EditorColorConfig>
  showToolbar?: boolean
  showStatusbar?: boolean
  showModeSwitch?: boolean
  allowFullscreen?: boolean
  imageUpload?: ImageUploadHandler
  imageAccept?: string
  maxImageSize?: number
  ariaLabel?: string
}>(), {
  modelValue: '',
  name: undefined,
  placeholder: '',
  height: 320,
  minHeight: 200,
  maxHeight: undefined,
  resizable: true,
  maxlength: undefined,
  required: false,
  disabled: false,
  readonly: false,
  autofocus: false,
  mode: 'split',
  editorType: 'markdown',
  valueFormat: 'markdown',
  theme: 'auto',
  bordered: true,
  locale: 'zh-CN',
  labels: () => ({}),
  toolbar: () => [...wujieeDefaultToolbar],
  toolbarConfig: () => ({}),
  colors: () => ({}),
  showToolbar: true,
  showStatusbar: true,
  showModeSwitch: true,
  allowFullscreen: true,
  imageUpload: undefined,
  imageAccept: 'image/png,image/jpeg,image/webp,image/gif',
  maxImageSize: 10 * 1024 * 1024,
  ariaLabel: 'Markdown editor'
})

const wujieeEmit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
  'mode-change': [mode: EditorMode]
  'image-uploaded': [result: ImageUploadResult, file: File]
  'image-upload-error': [error: Error, file: File]
  resize: [height: number]
  limit: [maximum: number]
}>()

defineSlots()

const wujieeTextarea = ref<HTMLTextAreaElement>()
const wujieeRichEditor = ref<HTMLDivElement>()
const wujieeFileInput = ref<HTMLInputElement>()
const wujieeLinkUrlInput = ref<HTMLInputElement>()
const wujieeWorkspace = ref<HTMLDivElement>()
const wujieeCurrentMode = ref<EditorMode>(wujieeProps.mode)
const wujieeIsFullscreen = ref(false)
const wujieeIsUploadingImage = ref(false)
const wujieeTooltip = ref<{ text: string; left: number; top: number }>()
const wujieeLinkDialogOpen = ref(false)
const wujieeLinkUrl = ref('')
const wujieeLinkText = ref('')
const wujieeLinkError = ref('')
const wujieeDraggedHeight = ref<number>()
const wujieeActiveTableCell = ref<HTMLTableCellElement>()
const wujieeActiveToolbarItems = ref<Partial<Record<ToolbarItemName, boolean>>>({})
let wujieeSavedRichRange: Range | null = null
let wujieeSavedMarkdownSelection: { value: string; start: number; end: number } | null = null
let wujieeRichModelValueToPreserve: string | undefined
let wujieeResizeState: { startY: number; startHeight: number; min: number; max: number } | null = null
let wujieeColumnResizeState: {
  columns: HTMLTableColElement[]
  index: number
  startX: number
  tableWidth: number
  leftWidth: number
  rightWidth: number
} | null = null

watch(() => wujieeProps.mode, (mode) => {
  wujieeCurrentMode.value = mode
})

watch(() => wujieeProps.editorType, async (editorType) => {
  await nextTick()
  if (editorType === 'wysiwyg') wujieeSyncRichEditorFromModel()
})

watch(() => wujieeProps.height, () => {
  wujieeDraggedHeight.value = undefined
})

const wujieeResolvedLabels = computed<EditorLabels>(() => ({
  ...(wujieeProps.locale === 'en-US' ? wujieeEnUSLabels : wujieeZhCNLabels),
  ...wujieeProps.labels
}))
const wujieeMarkdownValue = computed(() => wujieeProps.valueFormat === 'html' ? convertWujieeHtmlToMarkdown(wujieeProps.modelValue) : wujieeProps.modelValue)
const wujieeRenderedHtml = computed(() => renderWujieeMarkdown(wujieeMarkdownValue.value))
const wujieeCharacterCount = computed(() => countWujieeMarkdownCharacters(wujieeMarkdownValue.value))
const wujieeVisibleToolbar = computed(() => wujieeProps.toolbar.filter(item => wujieeProps.toolbarConfig[item] !== false))
const wujieeVisibleViewModes = computed(() => (['edit', 'split', 'preview'] as EditorMode[])
  .filter(mode => wujieeProps.toolbarConfig[mode] !== false))

watch(wujieeRenderedHtml, () => {
  if (wujieeRichModelValueToPreserve !== undefined) {
    if (wujieeProps.modelValue === wujieeRichModelValueToPreserve) {
      wujieeRichModelValueToPreserve = undefined
      return
    }
    wujieeRichModelValueToPreserve = undefined
  }
  if (wujieeProps.editorType !== 'wysiwyg' || document.activeElement === wujieeRichEditor.value) return
  wujieeSyncRichEditorFromModel()
})

const wujieeEditorStyle = computed(() => ({
  '--wujiee-md-height': wujieeDraggedHeight.value !== undefined
    ? `${wujieeDraggedHeight.value}px`
    : typeof wujieeProps.height === 'number' ? `${wujieeProps.height}px` : wujieeProps.height,
  '--wujiee-md-min-height': typeof wujieeProps.minHeight === 'number' ? `${wujieeProps.minHeight}px` : wujieeProps.minHeight,
  '--wujiee-md-max-height': wujieeProps.maxHeight === undefined
    ? 'none'
    : typeof wujieeProps.maxHeight === 'number' ? `${wujieeProps.maxHeight}px` : wujieeProps.maxHeight,
  ...(wujieeProps.colors.background ? { '--wujiee-md-bg': wujieeProps.colors.background } : {}),
  ...(wujieeProps.colors.backgroundSoft ? { '--wujiee-md-bg-soft': wujieeProps.colors.backgroundSoft } : {}),
  ...(wujieeProps.colors.text ? { '--wujiee-md-color': wujieeProps.colors.text } : {}),
  ...(wujieeProps.colors.muted ? { '--wujiee-md-muted': wujieeProps.colors.muted } : {}),
  ...(wujieeProps.colors.border ? { '--wujiee-md-border': wujieeProps.colors.border } : {}),
  ...(wujieeProps.colors.primary ? { '--wujiee-md-primary': wujieeProps.colors.primary } : {}),
  ...(wujieeProps.colors.primaryContrast ? { '--wujiee-md-primary-contrast': wujieeProps.colors.primaryContrast } : {}),
  ...(wujieeProps.colors.codeBackground ? { '--wujiee-md-code-bg': wujieeProps.colors.codeBackground } : {}),
  ...(wujieeProps.colors.toolbarBackground ? { '--wujiee-md-toolbar-bg': wujieeProps.colors.toolbarBackground } : {}),
  ...(wujieeProps.colors.focusRing ? { '--wujiee-md-focus-ring': wujieeProps.colors.focusRing } : {})
}))
const wujieeRootClasses = computed(() => [
  `wujiee-md--${wujieeProps.editorType === 'wysiwyg' ? 'edit' : wujieeCurrentMode.value}`,
  `wujiee-md--${wujieeProps.editorType}`,
  {
    'wujiee-md--fullscreen': wujieeIsFullscreen.value,
    'wujiee-md--disabled': wujieeProps.disabled,
    'wujiee-md--borderless': !wujieeProps.bordered
  }
])
const wujieeToolbarLabelKeys: Record<ToolbarItemName, keyof EditorLabels> = {
  heading: 'heading',
  bold: 'bold',
  italic: 'italic',
  strike: 'strike',
  quote: 'quote',
  'unordered-list': 'unorderedList',
  'ordered-list': 'orderedList',
  'task-list': 'taskList',
  'inline-code': 'inlineCode',
  'code-block': 'codeBlock',
  link: 'link',
  image: 'uploadImage',
  table: 'table',
  'horizontal-rule': 'horizontalRule'
}

function wujieeEmitValue(value: string): boolean {
  if (wujieeProps.maxlength !== undefined && countWujieeMarkdownCharacters(value) > wujieeProps.maxlength) {
    wujieeEmit('limit', wujieeProps.maxlength)
    return false
  }
  const formatted = wujieeProps.valueFormat === 'html' ? renderWujieeMarkdown(value) : value
  wujieeEmit('update:modelValue', formatted)
  wujieeEmit('change', formatted)
  return true
}

function wujieeHandleInput(event: Event): void {
  const element = event.target as HTMLTextAreaElement
  if (!wujieeEmitValue(element.value)) {
    element.value = wujieeMarkdownValue.value
    nextTick(() => element.setSelectionRange(element.value.length, element.value.length))
  }
}

function wujieeSyncRichEditorFromModel(): void {
  if (wujieeRichEditor.value && wujieeRichEditor.value.innerHTML !== wujieeRenderedHtml.value) {
    wujieeActiveTableCell.value = undefined
    wujieeRichEditor.value.innerHTML = wujieeRenderedHtml.value
  }
}

function wujieeSyncRichValue(preserveRichDom = false): void {
  if (!wujieeRichEditor.value) return
  const markdown = convertWujieeHtmlToMarkdown(wujieeRichEditor.value.innerHTML)
  wujieeRichModelValueToPreserve = preserveRichDom
    ? wujieeProps.valueFormat === 'html' ? renderWujieeMarkdown(markdown) : markdown
    : undefined
  if (!wujieeEmitValue(markdown)) {
    wujieeRichModelValueToPreserve = undefined
    nextTick(wujieeSyncRichEditorFromModel)
  }
}

function wujieeHandleRichPaste(event: ClipboardEvent): void {
  event.preventDefault()
  document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') || '')
  wujieeSyncRichValue()
}

function wujieeTableFromCell(cell = wujieeActiveTableCell.value): HTMLTableElement | undefined {
  return cell?.closest('table') as HTMLTableElement | undefined
}

function wujieeRebuildEqualColumns(table: HTMLTableElement): HTMLTableColElement[] {
  const columnCount = table.rows[0]?.cells.length || 0
  let group = table.querySelector('colgroup')
  if (!group) {
    group = document.createElement('colgroup')
    table.insertBefore(group, table.firstChild)
  }
  group.replaceChildren()
  const width = columnCount ? 100 / columnCount : 100
  return Array.from({ length: columnCount }, () => {
    const column = document.createElement('col')
    column.style.width = `${width.toFixed(2)}%`
    group!.append(column)
    return column
  })
}

function wujieeEnsureTableColumns(table: HTMLTableElement): HTMLTableColElement[] {
  const expected = table.rows[0]?.cells.length || 0
  const existing = Array.from(table.querySelectorAll<HTMLTableColElement>('colgroup > col'))
  if (existing.length === expected && expected > 0) return existing
  return wujieeRebuildEqualColumns(table)
}

function wujieeHandleRichClick(event: MouseEvent): void {
  const target = event.target as Element
  const cell = target.closest('th, td') as HTMLTableCellElement | null
  wujieeActiveTableCell.value = cell && wujieeRichEditor.value?.contains(cell) ? cell : undefined
  if (wujieeActiveTableCell.value) wujieeEnsureTableColumns(wujieeTableFromCell()!)
}

function wujieeCellAtResizableEdge(event: PointerEvent): HTMLTableCellElement | undefined {
  const target = event.target as Element
  const cell = target.closest('th, td') as HTMLTableCellElement | null
  if (!cell || !wujieeRichEditor.value?.contains(cell) || cell.cellIndex >= cell.parentElement!.children.length - 1) return undefined
  return Math.abs(event.clientX - cell.getBoundingClientRect().right) <= 7 ? cell : undefined
}

function wujieeHandleRichPointerMove(event: PointerEvent): void {
  if (wujieeColumnResizeState || !wujieeRichEditor.value) return
  wujieeRichEditor.value.classList.toggle('wujiee-md-column-edge-hover', Boolean(wujieeCellAtResizableEdge(event)))
}

function wujieeHandleColumnResizeMove(event: PointerEvent): void {
  if (!wujieeColumnResizeState) return
  const delta = (event.clientX - wujieeColumnResizeState.startX) / wujieeColumnResizeState.tableWidth * 100
  const minimum = 6
  const lower = minimum - wujieeColumnResizeState.leftWidth
  const upper = wujieeColumnResizeState.rightWidth - minimum
  const adjusted = Math.max(lower, Math.min(upper, delta))
  wujieeColumnResizeState.columns[wujieeColumnResizeState.index].style.width = `${(wujieeColumnResizeState.leftWidth + adjusted).toFixed(2)}%`
  wujieeColumnResizeState.columns[wujieeColumnResizeState.index + 1].style.width = `${(wujieeColumnResizeState.rightWidth - adjusted).toFixed(2)}%`
}

function wujieeStopColumnResize(): void {
  if (!wujieeColumnResizeState) return
  wujieeColumnResizeState = null
  window.removeEventListener('pointermove', wujieeHandleColumnResizeMove)
  window.removeEventListener('pointerup', wujieeStopColumnResize)
  document.body.classList.remove('wujiee-md-body-column-resizing')
  wujieeRichEditor.value?.classList.remove('wujiee-md-column-edge-hover')
  wujieeSyncRichValue(true)
}

function wujieeHandleTablePointerDown(event: PointerEvent): void {
  const cell = wujieeCellAtResizableEdge(event)
  if (!cell) return
  const table = cell.closest('table') as HTMLTableElement
  const columns = wujieeEnsureTableColumns(table)
  const tableWidth = table.getBoundingClientRect().width
  if (!tableWidth || !columns[cell.cellIndex + 1]) return
  event.preventDefault()
  wujieeActiveTableCell.value = cell
  wujieeColumnResizeState = {
    columns,
    index: cell.cellIndex,
    startX: event.clientX,
    tableWidth,
    leftWidth: Number.parseFloat(columns[cell.cellIndex].style.width),
    rightWidth: Number.parseFloat(columns[cell.cellIndex + 1].style.width)
  }
  window.addEventListener('pointermove', wujieeHandleColumnResizeMove)
  window.addEventListener('pointerup', wujieeStopColumnResize)
  document.body.classList.add('wujiee-md-body-column-resizing')
}

function wujieeAddTableRow(): void {
  const cell = wujieeActiveTableCell.value
  const table = wujieeTableFromCell(cell)
  if (!cell || !table) return
  const body = table.tBodies[0] || table.createTBody()
  const currentRow = cell.parentElement as HTMLTableRowElement
  const nextIndex = currentRow.parentElement === body ? currentRow.sectionRowIndex + 1 : 0
  const row = body.insertRow(nextIndex)
  const columnCount = table.rows[0]?.cells.length || 1
  for (let index = 0; index < columnCount; index += 1) row.insertCell().innerHTML = '<br>'
  wujieeActiveTableCell.value = row.cells[Math.min(cell.cellIndex, row.cells.length - 1)]
  wujieeSyncRichValue(true)
}

function wujieeAddTableColumn(): void {
  const cell = wujieeActiveTableCell.value
  const table = wujieeTableFromCell(cell)
  if (!cell || !table) return
  const insertAt = cell.cellIndex + 1
  Array.from(table.rows).forEach(row => {
    const next = row.cells[insertAt] || null
    const newCell = document.createElement(row.parentElement?.tagName === 'THEAD' ? 'th' : 'td')
    newCell.innerHTML = '<br>'
    row.insertBefore(newCell, next)
  })
  wujieeRebuildEqualColumns(table)
  wujieeActiveTableCell.value = (cell.parentElement as HTMLTableRowElement).cells[insertAt]
  wujieeSyncRichValue(true)
}

function wujieeDeleteTableRow(): void {
  const cell = wujieeActiveTableCell.value
  const table = wujieeTableFromCell(cell)
  const row = cell?.parentElement as HTMLTableRowElement | undefined
  if (!cell || !table || !row || row.parentElement?.tagName === 'THEAD') return
  const nextRow = row.nextElementSibling as HTMLTableRowElement | null
  const previousRow = row.previousElementSibling as HTMLTableRowElement | null
  row.remove()
  const targetRow = nextRow || previousRow || table.tHead?.rows[0]
  wujieeActiveTableCell.value = targetRow?.cells[Math.min(cell.cellIndex, targetRow.cells.length - 1)]
  wujieeSyncRichValue(true)
}

function wujieeDeleteTableColumn(): void {
  const cell = wujieeActiveTableCell.value
  const table = wujieeTableFromCell(cell)
  if (!cell || !table || table.rows[0].cells.length <= 1) return
  const removeAt = cell.cellIndex
  Array.from(table.rows).forEach(row => row.cells[removeAt]?.remove())
  wujieeRebuildEqualColumns(table)
  wujieeActiveTableCell.value = table.rows[0].cells[Math.min(removeAt, table.rows[0].cells.length - 1)]
  wujieeSyncRichValue(true)
}

function wujieeApplyResult(result: CommandResult): void {
  if (wujieeProps.disabled || wujieeProps.readonly) return
  const nextValue = result.value
  if (!wujieeEmitValue(nextValue)) return

  nextTick(() => {
    if (!wujieeTextarea.value) return
    const end = Math.min(result.selectionEnd, nextValue.length)
    wujieeTextarea.value.focus()
    wujieeTextarea.value.setSelectionRange(Math.min(result.selectionStart, end), end)
  })
}

function wujieeSelection() {
  const element = wujieeTextarea.value
  return {
    value: wujieeMarkdownValue.value,
    start: element?.selectionStart ?? wujieeMarkdownValue.value.length,
    end: element?.selectionEnd ?? wujieeMarkdownValue.value.length
  }
}

function wujieeRunMarkdownCommand(command: Exclude<ToolbarItemName, 'image'>): void {
  const current = wujieeSelection()
  const labels = wujieeResolvedLabels.value
  let result: CommandResult

  switch (command) {
    case 'heading': result = wujieePrefixLines(current, '## ', labels.heading); break
    case 'bold': result = wujieeWrapSelection(current, '**', '**', labels.bold); break
    case 'italic': result = wujieeWrapSelection(current, '_', '_', labels.italic); break
    case 'strike': result = wujieeWrapSelection(current, '~~', '~~', labels.strike); break
    case 'quote': result = wujieePrefixLines(current, '> ', labels.quote); break
    case 'unordered-list': result = wujieePrefixLines(current, '- ', labels.unorderedList); break
    case 'ordered-list': result = wujieePrefixLines(current, (index) => `${index + 1}. `, labels.orderedList); break
    case 'task-list': result = wujieePrefixLines(current, '- [ ] ', labels.taskList); break
    case 'inline-code': result = wujieeWrapSelection(current, '`', '`', 'code'); break
    case 'code-block': {
      const selected = current.value.slice(current.start, current.end) || 'code'
      result = wujieeInsertBlock(current, `\`\`\`\n${selected}\n\`\`\``)
      break
    }
    case 'link': return wujieeOpenLinkDialog()
    case 'table': result = wujieeInsertBlock(current, '| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n| 内容 | 内容 | 内容 |'); break
    case 'horizontal-rule': result = wujieeInsertBlock(current, '---'); break
  }

  wujieeApplyResult(result)
}

function wujieeSelectionBelongsToRichEditor(): boolean {
  const selected = window.getSelection()
  const range = selected?.rangeCount ? selected.getRangeAt(0) : undefined
  return Boolean(range && wujieeRichEditor.value?.contains(range.commonAncestorContainer))
}

function wujieeRichSelectionElement(): Element | undefined {
  const wujieeSelected = window.getSelection()
  const wujieeNode = wujieeSelected?.focusNode
  const wujieeElement = wujieeNode instanceof Element ? wujieeNode : wujieeNode?.parentElement
  return wujieeElement && wujieeRichEditor.value?.contains(wujieeElement) ? wujieeElement : undefined
}

function wujieeQueryCommandState(command: string): boolean {
  try {
    return document.queryCommandState(command)
  } catch {
    return false
  }
}

function wujieeUpdateRichToolbarState(): void {
  if (wujieeProps.editorType !== 'wysiwyg' || !wujieeSelectionBelongsToRichEditor()) return
  const wujieeElement = wujieeRichSelectionElement()
  const wujieeCode = wujieeElement?.closest('code')
  const wujieeTaskListItem = wujieeElement?.closest('li')?.querySelector('input[type="checkbox"]')

  wujieeActiveToolbarItems.value = {
    heading: Boolean(wujieeElement?.closest('h1, h2, h3, h4, h5, h6')),
    bold: wujieeQueryCommandState('bold') || Boolean(wujieeElement?.closest('strong, b')),
    italic: wujieeQueryCommandState('italic') || Boolean(wujieeElement?.closest('em, i')),
    strike: wujieeQueryCommandState('strikeThrough') || Boolean(wujieeElement?.closest('s, strike, del')),
    quote: Boolean(wujieeElement?.closest('blockquote')),
    'unordered-list': !wujieeTaskListItem && (wujieeQueryCommandState('insertUnorderedList') || Boolean(wujieeElement?.closest('ul'))),
    'ordered-list': wujieeQueryCommandState('insertOrderedList') || Boolean(wujieeElement?.closest('ol')),
    'task-list': Boolean(wujieeTaskListItem),
    'inline-code': Boolean(wujieeCode && !wujieeCode.closest('pre')),
    'code-block': Boolean(wujieeElement?.closest('pre')),
    link: Boolean(wujieeElement?.closest('a'))
  }
}

function wujieeIsToolbarItemActive(item: ToolbarItemName): boolean {
  return wujieeProps.editorType === 'wysiwyg' && Boolean(wujieeActiveToolbarItems.value[item])
}

function wujieeSaveRichSelection(): void {
  if (!wujieeSelectionBelongsToRichEditor()) return
  wujieeSavedRichRange = window.getSelection()!.getRangeAt(0).cloneRange()
  wujieeUpdateRichToolbarState()
}

function wujieeRestoreRichSelection(): void {
  if (!wujieeSavedRichRange) return
  const selected = window.getSelection()
  selected?.removeAllRanges()
  selected?.addRange(wujieeSavedRichRange)
}

function wujieeEscapeHtml(value: string): string {
  const element = document.createElement('span')
  element.textContent = value
  return element.innerHTML
}

function wujieeNormalizedLink(value: string): string | undefined {
  const input = value.trim()
  if (!input) return undefined
  if (/^(?:\/|#|\.\/|\.\.\/)/.test(input)) return input
  if (/^(?:mailto:|tel:)/i.test(input)) return input.split(':', 2)[1] ? input : undefined
  const candidate = /^https?:/i.test(input) ? input : `https://${input}`
  try {
    const parsed = new URL(candidate)
    return parsed.hostname ? candidate : undefined
  } catch {
    return undefined
  }
}

function wujieeOpenLinkDialog(): void {
  wujieeHideTooltip()
  wujieeLinkError.value = ''
  wujieeLinkUrl.value = 'https://'

  if (wujieeProps.editorType === 'wysiwyg') {
    wujieeSaveRichSelection()
    wujieeLinkText.value = window.getSelection()?.toString().trim() || wujieeResolvedLabels.value.linkText
  } else {
    wujieeSavedMarkdownSelection = wujieeSelection()
    wujieeLinkText.value = wujieeSavedMarkdownSelection.value.slice(wujieeSavedMarkdownSelection.start, wujieeSavedMarkdownSelection.end) || wujieeResolvedLabels.value.linkText
  }

  wujieeLinkDialogOpen.value = true
  nextTick(() => {
    wujieeLinkUrlInput.value?.focus()
    wujieeLinkUrlInput.value?.select()
  })
}

function wujieeCloseLinkDialog(): void {
  wujieeLinkDialogOpen.value = false
  wujieeLinkError.value = ''
  nextTick(wujieeFocus)
}

function wujieeConfirmLink(): void {
  const url = wujieeNormalizedLink(wujieeLinkUrl.value)
  if (!url) {
    wujieeLinkError.value = wujieeResolvedLabels.value.invalidLink
    wujieeLinkUrlInput.value?.focus()
    return
  }

  const text = wujieeLinkText.value.trim() || url
  wujieeLinkDialogOpen.value = false
  wujieeLinkError.value = ''

  if (wujieeProps.editorType === 'wysiwyg') {
    wujieeRichEditor.value?.focus()
    wujieeRestoreRichSelection()
    document.execCommand('insertHTML', false, `<a href="${wujieeEscapeHtml(url)}" target="_blank" rel="noopener noreferrer">${wujieeEscapeHtml(text)}</a>`)
    wujieeSaveRichSelection()
    wujieeSyncRichValue()
    return
  }

  const current = wujieeSavedMarkdownSelection || wujieeSelection()
  const replacement = `[${text}](${url})`
  wujieeApplyResult({
    value: current.value.slice(0, current.start) + replacement + current.value.slice(current.end),
    selectionStart: current.start + 1,
    selectionEnd: current.start + 1 + text.length
  })
}

function wujieeWrapRichSelection(): void {
  const selected = window.getSelection()
  if (!selected?.rangeCount || !wujieeSelectionBelongsToRichEditor()) return
  const range = selected.getRangeAt(0)
  const element = document.createElement('code')

  if (range.collapsed) {
    element.textContent = 'code'
    range.insertNode(element)
  } else {
    element.append(range.extractContents())
    range.insertNode(element)
  }

  range.selectNodeContents(element)
  selected.removeAllRanges()
  selected.addRange(range)
}

function wujieeUnwrapRichElement(element: Element): void {
  const wujieeChildren = Array.from(element.childNodes)
  const wujieeFirst = wujieeChildren[0]
  const wujieeLast = wujieeChildren[wujieeChildren.length - 1]
  if (!wujieeFirst || !wujieeLast) return

  element.replaceWith(...wujieeChildren)
  const wujieeRange = document.createRange()
  wujieeRange.setStartBefore(wujieeFirst)
  wujieeRange.setEndAfter(wujieeLast)
  const wujieeSelected = window.getSelection()
  wujieeSelected?.removeAllRanges()
  wujieeSelected?.addRange(wujieeRange)
}

function wujieeToggleRichInlineCode(): void {
  const wujieeCode = wujieeRichSelectionElement()?.closest('code')
  if (wujieeCode && !wujieeCode.closest('pre')) wujieeUnwrapRichElement(wujieeCode)
  else wujieeWrapRichSelection()
}

function wujieeToggleRichTaskList(active: boolean): void {
  if (!active) {
    document.execCommand('insertHTML', false, `<ul><li class="wujiee-md-task-list-item"><input class="wujiee-md-task-list-checkbox" type="checkbox" disabled> ${wujieeEscapeHtml(wujieeResolvedLabels.value.taskList)}</li></ul>`)
    return
  }

  const wujieeItem = wujieeRichSelectionElement()?.closest('li')
  const wujieeCheckbox = wujieeItem?.querySelector('input[type="checkbox"]')
  if (!wujieeItem || !wujieeCheckbox) return
  wujieeCheckbox.remove()
  wujieeItem.classList.remove('wujiee-md-task-list-item')
  if (wujieeItem.firstChild?.nodeType === Node.TEXT_NODE) {
    wujieeItem.firstChild.textContent = wujieeItem.firstChild.textContent?.replace(/^\s+/, '') || ''
  }
  document.execCommand('insertUnorderedList')
}

function wujieeRunRichCommand(command: Exclude<ToolbarItemName, 'image'>): void {
  if (!wujieeRichEditor.value) return
  wujieeRichEditor.value.focus()
  wujieeRestoreRichSelection()

  wujieeUpdateRichToolbarState()
  const wujieeWasActive = Boolean(wujieeActiveToolbarItems.value[command])

  switch (command) {
    case 'heading': document.execCommand('formatBlock', false, wujieeWasActive ? 'p' : 'h2'); break
    case 'bold': document.execCommand('bold'); break
    case 'italic': document.execCommand('italic'); break
    case 'strike': document.execCommand('strikeThrough'); break
    case 'quote': document.execCommand('formatBlock', false, wujieeWasActive ? 'p' : 'blockquote'); break
    case 'unordered-list': document.execCommand('insertUnorderedList'); break
    case 'ordered-list': document.execCommand('insertOrderedList'); break
    case 'task-list': wujieeToggleRichTaskList(wujieeWasActive); break
    case 'inline-code': wujieeToggleRichInlineCode(); break
    case 'code-block': document.execCommand('formatBlock', false, wujieeWasActive ? 'p' : 'pre'); break
    case 'link': {
      const wujieeLink = wujieeRichSelectionElement()?.closest('a')
      if (wujieeWasActive && wujieeLink) wujieeUnwrapRichElement(wujieeLink)
      else return wujieeOpenLinkDialog()
      break
    }
    case 'table':
      document.execCommand('insertHTML', false, '<table data-wujiee-md-resizable-table="true"><colgroup><col style="width:33.33%"><col style="width:33.33%"><col style="width:33.34%"></colgroup><thead><tr><th>列 1</th><th>列 2</th><th>列 3</th></tr></thead><tbody><tr><td>内容</td><td>内容</td><td>内容</td></tr><tr><td>内容</td><td>内容</td><td>内容</td></tr></tbody></table><p><br></p>')
      break
    case 'horizontal-rule': document.execCommand('insertHorizontalRule'); break
  }

  wujieeSaveRichSelection()
  wujieeSyncRichValue()
}

function wujieeRunCommand(command: ToolbarItemName): void {
  if (wujieeProps.disabled || wujieeProps.readonly) return
  if (command === 'image') return wujieeTriggerImagePicker()
  if (wujieeProps.editorType === 'wysiwyg') wujieeRunRichCommand(command)
  else if (command === 'link') wujieeOpenLinkDialog()
  else wujieeRunMarkdownCommand(command)
}

function wujieeSetMode(mode: EditorMode): void {
  wujieeCurrentMode.value = mode
  wujieeEmit('mode-change', mode)
  if (mode !== 'preview') nextTick(() => wujieeTextarea.value?.focus())
}

function wujieeToggleFullscreen(): void {
  if (!wujieeProps.allowFullscreen) return
  wujieeIsFullscreen.value = !wujieeIsFullscreen.value
  document.body.classList.toggle('wujiee-md-body-locked', wujieeIsFullscreen.value)
}

function wujieeConfiguredPixels(value: string | number | undefined, fallback: number): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^\d+(?:\.\d+)?px$/.test(value.trim())) return Number.parseFloat(value)
  return fallback
}

function wujieeClampHeight(height: number): number {
  const currentWorkspace = wujieeWorkspace.value
  const computedMin = currentWorkspace ? Number.parseFloat(getComputedStyle(currentWorkspace).minHeight) : 200
  const min = wujieeConfiguredPixels(wujieeProps.minHeight, Number.isFinite(computedMin) ? computedMin : 200)
  const max = wujieeConfiguredPixels(wujieeProps.maxHeight, Number.POSITIVE_INFINITY)
  return Math.min(max, Math.max(min, Math.round(height)))
}

function wujieeHandleResizeMove(event: PointerEvent): void {
  if (!wujieeResizeState) return
  wujieeDraggedHeight.value = Math.min(
    wujieeResizeState.max,
    Math.max(wujieeResizeState.min, Math.round(wujieeResizeState.startHeight + event.clientY - wujieeResizeState.startY))
  )
}

function wujieeStopResize(): void {
  if (!wujieeResizeState) return
  wujieeResizeState = null
  window.removeEventListener('pointermove', wujieeHandleResizeMove)
  window.removeEventListener('pointerup', wujieeStopResize)
  document.body.classList.remove('wujiee-md-body-resizing')
  if (wujieeDraggedHeight.value !== undefined) wujieeEmit('resize', wujieeDraggedHeight.value)
}

function wujieeStartResize(event: PointerEvent): void {
  if (!wujieeProps.resizable || !wujieeWorkspace.value) return
  const startHeight = wujieeWorkspace.value.getBoundingClientRect().height
  const computedMin = Number.parseFloat(getComputedStyle(wujieeWorkspace.value).minHeight)
  wujieeResizeState = {
    startY: event.clientY,
    startHeight,
    min: wujieeConfiguredPixels(wujieeProps.minHeight, Number.isFinite(computedMin) ? computedMin : 200),
    max: wujieeConfiguredPixels(wujieeProps.maxHeight, Number.POSITIVE_INFINITY)
  }
  window.addEventListener('pointermove', wujieeHandleResizeMove)
  window.addEventListener('pointerup', wujieeStopResize)
  document.body.classList.add('wujiee-md-body-resizing')
}

function wujieeHandleResizeKeydown(event: KeyboardEvent): void {
  if (!['ArrowUp', 'ArrowDown', 'Home'].includes(event.key) || !wujieeWorkspace.value) return
  event.preventDefault()
  const current = wujieeWorkspace.value.getBoundingClientRect().height
  const next = event.key === 'Home'
    ? wujieeConfiguredPixels(wujieeProps.minHeight, 200)
    : current + (event.key === 'ArrowUp' ? -16 : 16)
  wujieeDraggedHeight.value = wujieeClampHeight(next)
  wujieeEmit('resize', wujieeDraggedHeight.value)
}

function wujieeHandleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && wujieeLinkDialogOpen.value) {
    event.preventDefault()
    wujieeCloseLinkDialog()
    return
  }
  if (event.key === 'Escape' && wujieeIsFullscreen.value) {
    event.preventDefault()
    wujieeToggleFullscreen()
    return
  }
  if (event.key === 'Tab') {
    event.preventDefault()
    wujieeApplyResult(wujieeInsertTab(wujieeSelection()))
    return
  }
  if (!(event.metaKey || event.ctrlKey)) return
  const key = event.key.toLowerCase()
  const shortcut = key === 'b' ? 'bold' : key === 'i' ? 'italic' : key === 'k' ? 'link' : undefined
  if (!shortcut) return
  event.preventDefault()
  wujieeRunCommand(shortcut)
}

function wujieeExitRichCodeBlock(): boolean {
  const wujieeSelected = window.getSelection()
  if (!wujieeSelected?.rangeCount) return false
  const wujieeRange = wujieeSelected.getRangeAt(0)
  const wujieePre = wujieeRichSelectionElement()?.closest('pre')
  if (!wujieePre || !wujieeRange.collapsed) return false

  const wujieeAfterRange = document.createRange()
  wujieeAfterRange.selectNodeContents(wujieePre)
  wujieeAfterRange.setStart(wujieeRange.startContainer, wujieeRange.startOffset)
  const wujieeAfterFragment = wujieeAfterRange.cloneContents()
  if (wujieeAfterFragment.textContent || wujieeAfterFragment.querySelector('br')) return false

  const wujieeBeforeRange = document.createRange()
  wujieeBeforeRange.selectNodeContents(wujieePre)
  wujieeBeforeRange.setEnd(wujieeRange.startContainer, wujieeRange.startOffset)
  const wujieeBeforeFragment = wujieeBeforeRange.cloneContents()
  const wujieeBeforeContainer = document.createElement('div')
  wujieeBeforeContainer.append(wujieeBeforeFragment)
  const wujieeHasEmptyLastLine = wujieeBeforeRange.toString().endsWith('\n')
    || /<br\s*\/?>\s*$/i.test(wujieeBeforeContainer.innerHTML)
  if (!wujieeHasEmptyLastLine) return false

  const wujieeParagraph = document.createElement('p')
  wujieeParagraph.append(document.createElement('br'))
  wujieePre.after(wujieeParagraph)
  const wujieeExitRange = document.createRange()
  wujieeExitRange.setStart(wujieeParagraph, 0)
  wujieeExitRange.collapse(true)
  wujieeSelected.removeAllRanges()
  wujieeSelected.addRange(wujieeExitRange)
  return true
}

function wujieeHandleRichKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && wujieeLinkDialogOpen.value) {
    event.preventDefault()
    wujieeCloseLinkDialog()
  } else if (event.key === 'Escape' && wujieeIsFullscreen.value) {
    event.preventDefault()
    wujieeToggleFullscreen()
  } else if (event.key === 'Enter' && !event.shiftKey && wujieeExitRichCodeBlock()) {
    event.preventDefault()
    wujieeSaveRichSelection()
    wujieeSyncRichValue()
  } else if (event.key === 'Tab') {
    event.preventDefault()
    document.execCommand('insertText', false, '  ')
    wujieeSyncRichValue()
  }
}

function wujieeFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error || new Error('Unable to read image'))
    reader.readAsDataURL(file)
  })
}

function wujieeTriggerImagePicker(): void {
  if (wujieeProps.disabled || wujieeProps.readonly || wujieeIsUploadingImage.value) return
  if (wujieeProps.editorType === 'wysiwyg') wujieeSaveRichSelection()
  if (wujieeFileInput.value) {
    wujieeFileInput.value.value = ''
    wujieeFileInput.value.click()
  }
}

async function wujieeHandleImageFile(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  try {
    if (!file.type.startsWith('image/')) throw new Error('Only image files are supported')
    if (file.size > wujieeProps.maxImageSize) throw new Error(`Image must be smaller than ${Math.round(wujieeProps.maxImageSize / 1024 / 1024)} MB`)
    wujieeIsUploadingImage.value = true
    const uploaded = wujieeProps.imageUpload ? await wujieeProps.imageUpload(file) : await wujieeFileAsDataUrl(file)
    const result: ImageUploadResult = typeof uploaded === 'string' ? { url: uploaded, alt: file.name } : uploaded
    if (!result.url) throw new Error('The image upload handler did not return a URL')

    if (wujieeProps.editorType === 'wysiwyg') {
      wujieeRichEditor.value?.focus()
      wujieeRestoreRichSelection()
      document.execCommand('insertImage', false, result.url)
      const images = wujieeRichEditor.value?.querySelectorAll<HTMLImageElement>('img')
      const image = images?.[images.length - 1]
      if (image) image.alt = result.alt || file.name
      wujieeSaveRichSelection()
      wujieeSyncRichValue()
    } else {
      const insertion = wujieeWrapSelection(wujieeSelection(), '![', `](${result.url})`, result.alt || file.name)
      if (wujieeProps.maxlength !== undefined && countWujieeMarkdownCharacters(insertion.value) > wujieeProps.maxlength) {
        throw new Error('The uploaded image URL exceeds the editor maximum length')
      }
      wujieeApplyResult(insertion)
    }

    wujieeEmit('image-uploaded', result, file)
  } catch (error) {
    wujieeEmit('image-upload-error', error instanceof Error ? error : new Error(String(error)), file)
  } finally {
    wujieeIsUploadingImage.value = false
  }
}

function wujieeShowTooltip(event: MouseEvent | FocusEvent, text: string): void {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  wujieeTooltip.value = {
    text,
    left: Math.max(48, Math.min(window.innerWidth - 48, rect.left + rect.width / 2)),
    top: rect.bottom + 8
  }
}

function wujieeHideTooltip(): void {
  wujieeTooltip.value = undefined
}

function wujieeInsert(payload: InsertPayload): void {
  if (wujieeProps.editorType === 'wysiwyg') {
    wujieeRichEditor.value?.focus()
    wujieeRestoreRichSelection()
    document.execCommand('insertText', false, `${payload.before || ''}${payload.placeholder || ''}${payload.after || ''}`)
    wujieeSyncRichValue()
    return
  }
  const current = wujieeSelection()
  if (payload.block) wujieeApplyResult(wujieeInsertBlock(current, payload.placeholder || payload.before || ''))
  else wujieeApplyResult(wujieeWrapSelection(current, payload.before || '', payload.after || '', payload.placeholder || ''))
}

function wujieeFocus(): void {
  if (wujieeProps.editorType === 'wysiwyg') wujieeRichEditor.value?.focus()
  else wujieeTextarea.value?.focus()
}

function wujieeBlur(): void {
  if (wujieeProps.editorType === 'wysiwyg') wujieeRichEditor.value?.blur()
  else wujieeTextarea.value?.blur()
}

defineExpose({
  focus: wujieeFocus,
  blur: wujieeBlur,
  insert: wujieeInsert,
  triggerImagePicker: wujieeTriggerImagePicker,
  wujieeFocus,
  wujieeBlur,
  wujieeInsert,
  wujieeTriggerImagePicker,
  textarea: wujieeTextarea,
  richEditor: wujieeRichEditor,
  wujieeTextarea,
  wujieeRichEditor
})

onMounted(() => {
  if (wujieeProps.editorType === 'wysiwyg') wujieeSyncRichEditorFromModel()
  if (wujieeProps.autofocus) wujieeFocus()
  document.addEventListener('selectionchange', wujieeSaveRichSelection)
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', wujieeSaveRichSelection)
  if (wujieeIsFullscreen.value) document.body.classList.remove('wujiee-md-body-locked')
  wujieeStopColumnResize()
  wujieeStopResize()
})
</script>

<template>
  <div class="wujiee-md" :class="wujieeRootClasses" :data-theme="theme === 'auto' ? undefined : theme" :style="wujieeEditorStyle">
    <input ref="wujieeFileInput" class="wujiee-md-file-input" type="file" :accept="imageAccept" tabindex="-1" @change="wujieeHandleImageFile">

    <div v-if="showToolbar" class="wujiee-md-toolbar" role="toolbar" :aria-label="ariaLabel">
      <div class="wujiee-md-toolbar__formatting">
        <slot name="toolbar-before" />
        <template v-for="item in wujieeVisibleToolbar" :key="item">
          <slot
            :name="`toolbar-${item}`"
            :item="item"
            :label="wujieeResolvedLabels[wujieeToolbarLabelKeys[item]]"
            :disabled="disabled || readonly"
            :active="wujieeIsToolbarItemActive(item)"
            :action="() => wujieeRunCommand(item)"
          >
            <slot
              name="toolbar-item"
              :item="item"
              :label="wujieeResolvedLabels[wujieeToolbarLabelKeys[item]]"
              :disabled="disabled || readonly"
              :active="wujieeIsToolbarItemActive(item)"
              :action="() => wujieeRunCommand(item)"
            >
              <button
                class="wujiee-md-tool"
                :class="{ 'wujiee-md-is-active': wujieeIsToolbarItemActive(item) }"
                type="button"
                :aria-label="item === 'image' && wujieeIsUploadingImage ? wujieeResolvedLabels.uploadingImage : wujieeResolvedLabels[wujieeToolbarLabelKeys[item]]"
                :disabled="disabled || readonly || (item === 'image' && wujieeIsUploadingImage)"
                :aria-pressed="wujieeIsToolbarItemActive(item)"
                @mousedown.prevent="editorType === 'wysiwyg' && wujieeSaveRichSelection()"
                @mouseenter="wujieeShowTooltip($event, item === 'image' && wujieeIsUploadingImage ? wujieeResolvedLabels.uploadingImage : wujieeResolvedLabels[wujieeToolbarLabelKeys[item]])"
                @mouseleave="wujieeHideTooltip"
                @focus="wujieeShowTooltip($event, item === 'image' && wujieeIsUploadingImage ? wujieeResolvedLabels.uploadingImage : wujieeResolvedLabels[wujieeToolbarLabelKeys[item]])"
                @blur="wujieeHideTooltip"
                @click="wujieeRunCommand(item)"
              >
                <span v-if="item === 'image' && wujieeIsUploadingImage" class="wujiee-md-spinner" aria-hidden="true" />
                <WujieeIcon v-else :name="item" />
              </button>
            </slot>
          </slot>
        </template>
        <slot name="toolbar-after" />
      </div>

      <div class="wujiee-md-toolbar__view">
        <template v-if="showModeSwitch && editorType === 'markdown'">
          <template v-for="view in wujieeVisibleViewModes" :key="view">
            <slot :name="`toolbar-${view}`" :item="view" :label="wujieeResolvedLabels[view]" :active="wujieeCurrentMode === view" :action="() => wujieeSetMode(view)">
              <slot name="toolbar-item" :item="view" :label="wujieeResolvedLabels[view]" :active="wujieeCurrentMode === view" :action="() => wujieeSetMode(view)">
                <button
                  class="wujiee-md-tool wujiee-md-tool--view"
                  :class="{ 'wujiee-md-is-active': wujieeCurrentMode === view }"
                  type="button"
                  :aria-label="wujieeResolvedLabels[view]"
                  :aria-pressed="wujieeCurrentMode === view"
                  @mouseenter="wujieeShowTooltip($event, wujieeResolvedLabels[view])"
                  @mouseleave="wujieeHideTooltip"
                  @focus="wujieeShowTooltip($event, wujieeResolvedLabels[view])"
                  @blur="wujieeHideTooltip"
                  @click="wujieeSetMode(view)"
                ><WujieeIcon :name="view" /></button>
              </slot>
            </slot>
          </template>
        </template>
        <slot
          v-if="allowFullscreen && toolbarConfig.fullscreen !== false"
          name="toolbar-fullscreen"
          item="fullscreen"
          :label="wujieeIsFullscreen ? wujieeResolvedLabels.exitFullscreen : wujieeResolvedLabels.fullscreen"
          :active="wujieeIsFullscreen"
          :action="wujieeToggleFullscreen"
        >
          <slot name="toolbar-item" item="fullscreen" :label="wujieeIsFullscreen ? wujieeResolvedLabels.exitFullscreen : wujieeResolvedLabels.fullscreen" :active="wujieeIsFullscreen" :action="wujieeToggleFullscreen">
            <button
              class="wujiee-md-tool wujiee-md-tool--view"
              type="button"
              :aria-label="wujieeIsFullscreen ? wujieeResolvedLabels.exitFullscreen : wujieeResolvedLabels.fullscreen"
              :aria-pressed="wujieeIsFullscreen"
              @mouseenter="wujieeShowTooltip($event, wujieeIsFullscreen ? wujieeResolvedLabels.exitFullscreen : wujieeResolvedLabels.fullscreen)"
              @mouseleave="wujieeHideTooltip"
              @focus="wujieeShowTooltip($event, wujieeIsFullscreen ? wujieeResolvedLabels.exitFullscreen : wujieeResolvedLabels.fullscreen)"
              @blur="wujieeHideTooltip"
              @click="wujieeToggleFullscreen"
            ><WujieeIcon :name="wujieeIsFullscreen ? 'exit-fullscreen' : 'fullscreen'" /></button>
          </slot>
        </slot>
      </div>
    </div>

    <div v-if="editorType === 'wysiwyg' && wujieeActiveTableCell" class="wujiee-md-table-tools" @mousedown.prevent>
      <button type="button" @click="wujieeAddTableRow">＋ {{ wujieeResolvedLabels.addRow }}</button>
      <button type="button" @click="wujieeAddTableColumn">＋ {{ wujieeResolvedLabels.addColumn }}</button>
      <button type="button" :disabled="wujieeActiveTableCell.parentElement?.parentElement?.tagName === 'THEAD'" @click="wujieeDeleteTableRow">− {{ wujieeResolvedLabels.deleteRow }}</button>
      <button type="button" :disabled="(wujieeTableFromCell()?.rows[0]?.cells.length || 0) <= 1" @click="wujieeDeleteTableColumn">− {{ wujieeResolvedLabels.deleteColumn }}</button>
    </div>

    <div ref="wujieeWorkspace" class="wujiee-md-workspace">
      <template v-if="editorType === 'wysiwyg'">
        <textarea
          v-if="name || required"
          class="wujiee-md-rich-validation"
          :name="name"
          :value="modelValue"
          :required="required"
          :disabled="disabled"
          tabindex="-1"
          aria-hidden="true"
          @invalid.prevent="wujieeFocus"
        />
        <div
          ref="wujieeRichEditor"
          class="wujiee-md-rich-editor wujiee-md-preview"
          role="textbox"
          :contenteditable="disabled || readonly ? 'false' : 'true'"
          :data-placeholder="placeholder"
          :aria-label="ariaLabel"
          :aria-required="required"
          :aria-disabled="disabled"
          :aria-readonly="readonly"
          aria-multiline="true"
          spellcheck="true"
          @input="wujieeSyncRichValue()"
          @paste="wujieeHandleRichPaste"
          @keydown="wujieeHandleRichKeydown"
          @click="wujieeHandleRichClick"
          @pointermove="wujieeHandleRichPointerMove"
          @pointerleave="wujieeRichEditor?.classList.remove('wujiee-md-column-edge-hover')"
          @pointerdown="wujieeHandleTablePointerDown"
          @mouseup="wujieeSaveRichSelection"
          @keyup="wujieeSaveRichSelection"
          @focus="wujieeEmit('focus', $event)"
          @blur="wujieeEmit('blur', $event); wujieeSyncRichValue()"
        />
      </template>

      <template v-else>
        <div v-show="wujieeCurrentMode !== 'preview'" class="wujiee-md-editor-pane">
          <textarea
            ref="wujieeTextarea"
            class="wujiee-md-textarea"
            :value="wujieeMarkdownValue"
            :name="name"
            :placeholder="placeholder"
            :required="required"
            :disabled="disabled"
            :readonly="readonly"
            :aria-label="ariaLabel"
            spellcheck="true"
            @input="wujieeHandleInput"
            @keydown="wujieeHandleKeydown"
            @focus="wujieeEmit('focus', $event)"
            @blur="wujieeEmit('blur', $event)"
          />
        </div>
        <div v-show="wujieeCurrentMode !== 'edit'" class="wujiee-md-preview-pane">
          <div v-if="wujieeRenderedHtml" class="wujiee-md-preview" v-html="wujieeRenderedHtml" />
          <div v-else class="wujiee-md-preview-empty">{{ wujieeResolvedLabels.emptyPreview }}</div>
        </div>
      </template>
    </div>

    <div
      v-if="resizable"
      class="wujiee-md-resize-handle"
      role="separator"
      aria-orientation="horizontal"
      aria-label="调整编辑器高度"
      tabindex="0"
      @pointerdown.prevent="wujieeStartResize"
      @keydown="wujieeHandleResizeKeydown"
    ><span /></div>

    <div class="wujiee-md-statusbar" :class="{ 'wujiee-md-statusbar--brand-only': !showStatusbar }">
      <span v-if="showStatusbar">{{ wujieeCharacterCount }}<template v-if="maxlength"> / {{ maxlength }}</template> {{ wujieeResolvedLabels.characters }}</span>
      <a class="wujiee-md-statusbar__brand" href="https://wujiee.com" target="_blank" rel="noopener noreferrer">WUJIEE</a>
    </div>

    <div v-if="wujieeLinkDialogOpen" class="wujiee-md-dialog-backdrop" @mousedown.self="wujieeCloseLinkDialog">
      <form class="wujiee-md-link-dialog" role="dialog" aria-modal="true" :aria-label="wujieeResolvedLabels.link" @submit.prevent="wujieeConfirmLink">
        <div class="wujiee-md-link-dialog__header">
          <strong>{{ wujieeResolvedLabels.link }}</strong>
          <button type="button" class="wujiee-md-link-dialog__close" :aria-label="wujieeResolvedLabels.cancel" @click="wujieeCloseLinkDialog">×</button>
        </div>
        <label class="wujiee-md-link-field">
          <span>{{ wujieeResolvedLabels.linkTextLabel }}</span>
          <input v-model="wujieeLinkText" type="text" autocomplete="off">
        </label>
        <label class="wujiee-md-link-field">
          <span>{{ wujieeResolvedLabels.linkAddress }}</span>
          <input ref="wujieeLinkUrlInput" v-model="wujieeLinkUrl" type="text" inputmode="url" autocomplete="off" @input="wujieeLinkError = ''">
        </label>
        <p v-if="wujieeLinkError" class="wujiee-md-link-error" role="alert">{{ wujieeLinkError }}</p>
        <div class="wujiee-md-link-dialog__actions">
          <button type="button" class="wujiee-md-link-button wujiee-md-link-button--secondary" @click="wujieeCloseLinkDialog">{{ wujieeResolvedLabels.cancel }}</button>
          <button type="submit" class="wujiee-md-link-button wujiee-md-link-button--primary">{{ wujieeResolvedLabels.confirm }}</button>
        </div>
      </form>
    </div>

    <Teleport to="body">
      <div v-if="wujieeTooltip" class="wujiee-md-tooltip" role="tooltip" :style="{ left: `${wujieeTooltip.left}px`, top: `${wujieeTooltip.top}px` }">
        {{ wujieeTooltip.text }}
      </div>
    </Teleport>
  </div>
</template>
