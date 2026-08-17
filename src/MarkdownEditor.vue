<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Icon from './Icon.vue'
import { countMarkdownCharacters } from './characterCount'
import { enUSLabels, zhCNLabels } from './labels'
import { insertBlock, insertTab, prefixLines, wrapSelection, type CommandResult } from './editorCommands'
import { htmlToMarkdown } from './htmlToMarkdown'
import { renderMarkdown } from './markdown'
import {
  defaultToolbar,
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

const props = withDefaults(defineProps<{
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
  toolbar: () => [...defaultToolbar],
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

const emit = defineEmits<{
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

const textarea = ref<HTMLTextAreaElement>()
const richEditor = ref<HTMLDivElement>()
const fileInput = ref<HTMLInputElement>()
const linkUrlInput = ref<HTMLInputElement>()
const workspace = ref<HTMLDivElement>()
const currentMode = ref<EditorMode>(props.mode)
const isFullscreen = ref(false)
const isUploadingImage = ref(false)
const tooltip = ref<{ text: string; left: number; top: number }>()
const linkDialogOpen = ref(false)
const linkUrl = ref('')
const linkText = ref('')
const linkError = ref('')
const draggedHeight = ref<number>()
const activeTableCell = ref<HTMLTableCellElement>()
let savedRichRange: Range | null = null
let savedMarkdownSelection: { value: string; start: number; end: number } | null = null
let richModelValueToPreserve: string | undefined
let resizeState: { startY: number; startHeight: number; min: number; max: number } | null = null
let columnResizeState: {
  columns: HTMLTableColElement[]
  index: number
  startX: number
  tableWidth: number
  leftWidth: number
  rightWidth: number
} | null = null

watch(() => props.mode, (mode) => {
  currentMode.value = mode
})

watch(() => props.editorType, async (editorType) => {
  await nextTick()
  if (editorType === 'wysiwyg') syncRichEditorFromModel()
})

watch(() => props.height, () => {
  draggedHeight.value = undefined
})

const resolvedLabels = computed<EditorLabels>(() => ({
  ...(props.locale === 'en-US' ? enUSLabels : zhCNLabels),
  ...props.labels
}))
const markdownValue = computed(() => props.valueFormat === 'html' ? htmlToMarkdown(props.modelValue) : props.modelValue)
const renderedHtml = computed(() => renderMarkdown(markdownValue.value))
const characterCount = computed(() => countMarkdownCharacters(markdownValue.value))
const visibleToolbar = computed(() => props.toolbar.filter(item => props.toolbarConfig[item] !== false))
const visibleViewModes = computed(() => (['edit', 'split', 'preview'] as EditorMode[])
  .filter(mode => props.toolbarConfig[mode] !== false))

watch(renderedHtml, () => {
  if (richModelValueToPreserve !== undefined) {
    if (props.modelValue === richModelValueToPreserve) {
      richModelValueToPreserve = undefined
      return
    }
    richModelValueToPreserve = undefined
  }
  if (props.editorType !== 'wysiwyg' || document.activeElement === richEditor.value) return
  syncRichEditorFromModel()
})

const editorStyle = computed(() => ({
  '--wmd-height': draggedHeight.value !== undefined
    ? `${draggedHeight.value}px`
    : typeof props.height === 'number' ? `${props.height}px` : props.height,
  '--wmd-min-height': typeof props.minHeight === 'number' ? `${props.minHeight}px` : props.minHeight,
  '--wmd-max-height': props.maxHeight === undefined
    ? 'none'
    : typeof props.maxHeight === 'number' ? `${props.maxHeight}px` : props.maxHeight,
  ...(props.colors.background ? { '--wmd-bg': props.colors.background } : {}),
  ...(props.colors.backgroundSoft ? { '--wmd-bg-soft': props.colors.backgroundSoft } : {}),
  ...(props.colors.text ? { '--wmd-color': props.colors.text } : {}),
  ...(props.colors.muted ? { '--wmd-muted': props.colors.muted } : {}),
  ...(props.colors.border ? { '--wmd-border': props.colors.border } : {}),
  ...(props.colors.primary ? { '--wmd-primary': props.colors.primary } : {}),
  ...(props.colors.primaryContrast ? { '--wmd-primary-contrast': props.colors.primaryContrast } : {}),
  ...(props.colors.codeBackground ? { '--wmd-code-bg': props.colors.codeBackground } : {}),
  ...(props.colors.toolbarBackground ? { '--wmd-toolbar-bg': props.colors.toolbarBackground } : {}),
  ...(props.colors.focusRing ? { '--wmd-focus-ring': props.colors.focusRing } : {})
}))
const rootClasses = computed(() => [
  `wmd--${props.editorType === 'wysiwyg' ? 'edit' : currentMode.value}`,
  `wmd--${props.editorType}`,
  {
    'wmd--fullscreen': isFullscreen.value,
    'wmd--disabled': props.disabled,
    'wmd--borderless': !props.bordered
  }
])
const toolbarLabelKeys: Record<ToolbarItemName, keyof EditorLabels> = {
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

function emitValue(value: string): boolean {
  if (props.maxlength !== undefined && countMarkdownCharacters(value) > props.maxlength) {
    emit('limit', props.maxlength)
    return false
  }
  const formatted = props.valueFormat === 'html' ? renderMarkdown(value) : value
  emit('update:modelValue', formatted)
  emit('change', formatted)
  return true
}

function handleInput(event: Event): void {
  const element = event.target as HTMLTextAreaElement
  if (!emitValue(element.value)) {
    element.value = markdownValue.value
    nextTick(() => element.setSelectionRange(element.value.length, element.value.length))
  }
}

function syncRichEditorFromModel(): void {
  if (richEditor.value && richEditor.value.innerHTML !== renderedHtml.value) {
    activeTableCell.value = undefined
    richEditor.value.innerHTML = renderedHtml.value
  }
}

function syncRichValue(preserveRichDom = false): void {
  if (!richEditor.value) return
  const markdown = htmlToMarkdown(richEditor.value.innerHTML)
  richModelValueToPreserve = preserveRichDom
    ? props.valueFormat === 'html' ? renderMarkdown(markdown) : markdown
    : undefined
  if (!emitValue(markdown)) {
    richModelValueToPreserve = undefined
    nextTick(syncRichEditorFromModel)
  }
}

function handleRichPaste(event: ClipboardEvent): void {
  event.preventDefault()
  document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') || '')
  syncRichValue()
}

function tableFromCell(cell = activeTableCell.value): HTMLTableElement | undefined {
  return cell?.closest('table') as HTMLTableElement | undefined
}

function rebuildEqualColumns(table: HTMLTableElement): HTMLTableColElement[] {
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

function ensureTableColumns(table: HTMLTableElement): HTMLTableColElement[] {
  const expected = table.rows[0]?.cells.length || 0
  const existing = Array.from(table.querySelectorAll<HTMLTableColElement>('colgroup > col'))
  if (existing.length === expected && expected > 0) return existing
  return rebuildEqualColumns(table)
}

function handleRichClick(event: MouseEvent): void {
  const target = event.target as Element
  const cell = target.closest('th, td') as HTMLTableCellElement | null
  activeTableCell.value = cell && richEditor.value?.contains(cell) ? cell : undefined
  if (activeTableCell.value) ensureTableColumns(tableFromCell()!)
}

function cellAtResizableEdge(event: PointerEvent): HTMLTableCellElement | undefined {
  const target = event.target as Element
  const cell = target.closest('th, td') as HTMLTableCellElement | null
  if (!cell || !richEditor.value?.contains(cell) || cell.cellIndex >= cell.parentElement!.children.length - 1) return undefined
  return Math.abs(event.clientX - cell.getBoundingClientRect().right) <= 7 ? cell : undefined
}

function handleRichPointerMove(event: PointerEvent): void {
  if (columnResizeState || !richEditor.value) return
  richEditor.value.classList.toggle('wmd-column-edge-hover', Boolean(cellAtResizableEdge(event)))
}

function handleColumnResizeMove(event: PointerEvent): void {
  if (!columnResizeState) return
  const delta = (event.clientX - columnResizeState.startX) / columnResizeState.tableWidth * 100
  const minimum = 6
  const lower = minimum - columnResizeState.leftWidth
  const upper = columnResizeState.rightWidth - minimum
  const adjusted = Math.max(lower, Math.min(upper, delta))
  columnResizeState.columns[columnResizeState.index].style.width = `${(columnResizeState.leftWidth + adjusted).toFixed(2)}%`
  columnResizeState.columns[columnResizeState.index + 1].style.width = `${(columnResizeState.rightWidth - adjusted).toFixed(2)}%`
}

function stopColumnResize(): void {
  if (!columnResizeState) return
  columnResizeState = null
  window.removeEventListener('pointermove', handleColumnResizeMove)
  window.removeEventListener('pointerup', stopColumnResize)
  document.body.classList.remove('wmd-body-column-resizing')
  richEditor.value?.classList.remove('wmd-column-edge-hover')
  syncRichValue(true)
}

function handleTablePointerDown(event: PointerEvent): void {
  const cell = cellAtResizableEdge(event)
  if (!cell) return
  const table = cell.closest('table') as HTMLTableElement
  const columns = ensureTableColumns(table)
  const tableWidth = table.getBoundingClientRect().width
  if (!tableWidth || !columns[cell.cellIndex + 1]) return
  event.preventDefault()
  activeTableCell.value = cell
  columnResizeState = {
    columns,
    index: cell.cellIndex,
    startX: event.clientX,
    tableWidth,
    leftWidth: Number.parseFloat(columns[cell.cellIndex].style.width),
    rightWidth: Number.parseFloat(columns[cell.cellIndex + 1].style.width)
  }
  window.addEventListener('pointermove', handleColumnResizeMove)
  window.addEventListener('pointerup', stopColumnResize)
  document.body.classList.add('wmd-body-column-resizing')
}

function addTableRow(): void {
  const cell = activeTableCell.value
  const table = tableFromCell(cell)
  if (!cell || !table) return
  const body = table.tBodies[0] || table.createTBody()
  const currentRow = cell.parentElement as HTMLTableRowElement
  const nextIndex = currentRow.parentElement === body ? currentRow.sectionRowIndex + 1 : 0
  const row = body.insertRow(nextIndex)
  const columnCount = table.rows[0]?.cells.length || 1
  for (let index = 0; index < columnCount; index += 1) row.insertCell().innerHTML = '<br>'
  activeTableCell.value = row.cells[Math.min(cell.cellIndex, row.cells.length - 1)]
  syncRichValue(true)
}

function addTableColumn(): void {
  const cell = activeTableCell.value
  const table = tableFromCell(cell)
  if (!cell || !table) return
  const insertAt = cell.cellIndex + 1
  Array.from(table.rows).forEach(row => {
    const next = row.cells[insertAt] || null
    const newCell = document.createElement(row.parentElement?.tagName === 'THEAD' ? 'th' : 'td')
    newCell.innerHTML = '<br>'
    row.insertBefore(newCell, next)
  })
  rebuildEqualColumns(table)
  activeTableCell.value = (cell.parentElement as HTMLTableRowElement).cells[insertAt]
  syncRichValue(true)
}

function deleteTableRow(): void {
  const cell = activeTableCell.value
  const table = tableFromCell(cell)
  const row = cell?.parentElement as HTMLTableRowElement | undefined
  if (!cell || !table || !row || row.parentElement?.tagName === 'THEAD') return
  const nextRow = row.nextElementSibling as HTMLTableRowElement | null
  const previousRow = row.previousElementSibling as HTMLTableRowElement | null
  row.remove()
  const targetRow = nextRow || previousRow || table.tHead?.rows[0]
  activeTableCell.value = targetRow?.cells[Math.min(cell.cellIndex, targetRow.cells.length - 1)]
  syncRichValue(true)
}

function deleteTableColumn(): void {
  const cell = activeTableCell.value
  const table = tableFromCell(cell)
  if (!cell || !table || table.rows[0].cells.length <= 1) return
  const removeAt = cell.cellIndex
  Array.from(table.rows).forEach(row => row.cells[removeAt]?.remove())
  rebuildEqualColumns(table)
  activeTableCell.value = table.rows[0].cells[Math.min(removeAt, table.rows[0].cells.length - 1)]
  syncRichValue(true)
}

function applyResult(result: CommandResult): void {
  if (props.disabled || props.readonly) return
  const nextValue = result.value
  if (!emitValue(nextValue)) return

  nextTick(() => {
    if (!textarea.value) return
    const end = Math.min(result.selectionEnd, nextValue.length)
    textarea.value.focus()
    textarea.value.setSelectionRange(Math.min(result.selectionStart, end), end)
  })
}

function selection() {
  const element = textarea.value
  return {
    value: markdownValue.value,
    start: element?.selectionStart ?? markdownValue.value.length,
    end: element?.selectionEnd ?? markdownValue.value.length
  }
}

function runMarkdownCommand(command: Exclude<ToolbarItemName, 'image'>): void {
  const current = selection()
  const labels = resolvedLabels.value
  let result: CommandResult

  switch (command) {
    case 'heading': result = prefixLines(current, '## ', labels.heading); break
    case 'bold': result = wrapSelection(current, '**', '**', labels.bold); break
    case 'italic': result = wrapSelection(current, '_', '_', labels.italic); break
    case 'strike': result = wrapSelection(current, '~~', '~~', labels.strike); break
    case 'quote': result = prefixLines(current, '> ', labels.quote); break
    case 'unordered-list': result = prefixLines(current, '- ', labels.unorderedList); break
    case 'ordered-list': result = prefixLines(current, (index) => `${index + 1}. `, labels.orderedList); break
    case 'task-list': result = prefixLines(current, '- [ ] ', labels.taskList); break
    case 'inline-code': result = wrapSelection(current, '`', '`', 'code'); break
    case 'code-block': {
      const selected = current.value.slice(current.start, current.end) || 'code'
      result = insertBlock(current, `\`\`\`\n${selected}\n\`\`\``)
      break
    }
    case 'link': return openLinkDialog()
    case 'table': result = insertBlock(current, '| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n| 内容 | 内容 | 内容 |'); break
    case 'horizontal-rule': result = insertBlock(current, '---'); break
  }

  applyResult(result)
}

function selectionBelongsToRichEditor(): boolean {
  const selected = window.getSelection()
  const range = selected?.rangeCount ? selected.getRangeAt(0) : undefined
  return Boolean(range && richEditor.value?.contains(range.commonAncestorContainer))
}

function saveRichSelection(): void {
  if (selectionBelongsToRichEditor()) savedRichRange = window.getSelection()!.getRangeAt(0).cloneRange()
}

function restoreRichSelection(): void {
  if (!savedRichRange) return
  const selected = window.getSelection()
  selected?.removeAllRanges()
  selected?.addRange(savedRichRange)
}

function escapeHtml(value: string): string {
  const element = document.createElement('span')
  element.textContent = value
  return element.innerHTML
}

function normalizedLink(value: string): string | undefined {
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

function openLinkDialog(): void {
  hideTooltip()
  linkError.value = ''
  linkUrl.value = 'https://'

  if (props.editorType === 'wysiwyg') {
    saveRichSelection()
    linkText.value = window.getSelection()?.toString().trim() || resolvedLabels.value.linkText
  } else {
    savedMarkdownSelection = selection()
    linkText.value = savedMarkdownSelection.value.slice(savedMarkdownSelection.start, savedMarkdownSelection.end) || resolvedLabels.value.linkText
  }

  linkDialogOpen.value = true
  nextTick(() => {
    linkUrlInput.value?.focus()
    linkUrlInput.value?.select()
  })
}

function closeLinkDialog(): void {
  linkDialogOpen.value = false
  linkError.value = ''
  nextTick(focus)
}

function confirmLink(): void {
  const url = normalizedLink(linkUrl.value)
  if (!url) {
    linkError.value = resolvedLabels.value.invalidLink
    linkUrlInput.value?.focus()
    return
  }

  const text = linkText.value.trim() || url
  linkDialogOpen.value = false
  linkError.value = ''

  if (props.editorType === 'wysiwyg') {
    richEditor.value?.focus()
    restoreRichSelection()
    document.execCommand('insertHTML', false, `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`)
    saveRichSelection()
    syncRichValue()
    return
  }

  const current = savedMarkdownSelection || selection()
  const replacement = `[${text}](${url})`
  applyResult({
    value: current.value.slice(0, current.start) + replacement + current.value.slice(current.end),
    selectionStart: current.start + 1,
    selectionEnd: current.start + 1 + text.length
  })
}

function wrapRichSelection(): void {
  const selected = window.getSelection()
  if (!selected?.rangeCount || !selectionBelongsToRichEditor()) return
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

function runRichCommand(command: Exclude<ToolbarItemName, 'image'>): void {
  if (!richEditor.value) return
  richEditor.value.focus()
  restoreRichSelection()

  switch (command) {
    case 'heading': document.execCommand('formatBlock', false, 'h2'); break
    case 'bold': document.execCommand('bold'); break
    case 'italic': document.execCommand('italic'); break
    case 'strike': document.execCommand('strikeThrough'); break
    case 'quote': document.execCommand('formatBlock', false, 'blockquote'); break
    case 'unordered-list': document.execCommand('insertUnorderedList'); break
    case 'ordered-list': document.execCommand('insertOrderedList'); break
    case 'task-list':
      document.execCommand('insertHTML', false, `<ul><li><input type="checkbox" disabled> ${escapeHtml(resolvedLabels.value.taskList)}</li></ul>`)
      break
    case 'inline-code': wrapRichSelection(); break
    case 'code-block': document.execCommand('formatBlock', false, 'pre'); break
    case 'link': return openLinkDialog()
    case 'table':
      document.execCommand('insertHTML', false, '<table data-wmd-resizable-table="true"><colgroup><col style="width:33.33%"><col style="width:33.33%"><col style="width:33.34%"></colgroup><thead><tr><th>列 1</th><th>列 2</th><th>列 3</th></tr></thead><tbody><tr><td>内容</td><td>内容</td><td>内容</td></tr><tr><td>内容</td><td>内容</td><td>内容</td></tr></tbody></table><p><br></p>')
      break
    case 'horizontal-rule': document.execCommand('insertHorizontalRule'); break
  }

  saveRichSelection()
  syncRichValue()
}

function runCommand(command: ToolbarItemName): void {
  if (props.disabled || props.readonly) return
  if (command === 'image') return triggerImagePicker()
  if (command === 'link') return openLinkDialog()
  if (props.editorType === 'wysiwyg') runRichCommand(command)
  else runMarkdownCommand(command)
}

function setMode(mode: EditorMode): void {
  currentMode.value = mode
  emit('mode-change', mode)
  if (mode !== 'preview') nextTick(() => textarea.value?.focus())
}

function toggleFullscreen(): void {
  if (!props.allowFullscreen) return
  isFullscreen.value = !isFullscreen.value
  document.body.classList.toggle('wmd-body-locked', isFullscreen.value)
}

function configuredPixels(value: string | number | undefined, fallback: number): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^\d+(?:\.\d+)?px$/.test(value.trim())) return Number.parseFloat(value)
  return fallback
}

function clampHeight(height: number): number {
  const currentWorkspace = workspace.value
  const computedMin = currentWorkspace ? Number.parseFloat(getComputedStyle(currentWorkspace).minHeight) : 200
  const min = configuredPixels(props.minHeight, Number.isFinite(computedMin) ? computedMin : 200)
  const max = configuredPixels(props.maxHeight, Number.POSITIVE_INFINITY)
  return Math.min(max, Math.max(min, Math.round(height)))
}

function handleResizeMove(event: PointerEvent): void {
  if (!resizeState) return
  draggedHeight.value = Math.min(
    resizeState.max,
    Math.max(resizeState.min, Math.round(resizeState.startHeight + event.clientY - resizeState.startY))
  )
}

function stopResize(): void {
  if (!resizeState) return
  resizeState = null
  window.removeEventListener('pointermove', handleResizeMove)
  window.removeEventListener('pointerup', stopResize)
  document.body.classList.remove('wmd-body-resizing')
  if (draggedHeight.value !== undefined) emit('resize', draggedHeight.value)
}

function startResize(event: PointerEvent): void {
  if (!props.resizable || !workspace.value) return
  const startHeight = workspace.value.getBoundingClientRect().height
  const computedMin = Number.parseFloat(getComputedStyle(workspace.value).minHeight)
  resizeState = {
    startY: event.clientY,
    startHeight,
    min: configuredPixels(props.minHeight, Number.isFinite(computedMin) ? computedMin : 200),
    max: configuredPixels(props.maxHeight, Number.POSITIVE_INFINITY)
  }
  window.addEventListener('pointermove', handleResizeMove)
  window.addEventListener('pointerup', stopResize)
  document.body.classList.add('wmd-body-resizing')
}

function handleResizeKeydown(event: KeyboardEvent): void {
  if (!['ArrowUp', 'ArrowDown', 'Home'].includes(event.key) || !workspace.value) return
  event.preventDefault()
  const current = workspace.value.getBoundingClientRect().height
  const next = event.key === 'Home'
    ? configuredPixels(props.minHeight, 200)
    : current + (event.key === 'ArrowUp' ? -16 : 16)
  draggedHeight.value = clampHeight(next)
  emit('resize', draggedHeight.value)
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && linkDialogOpen.value) {
    event.preventDefault()
    closeLinkDialog()
    return
  }
  if (event.key === 'Escape' && isFullscreen.value) {
    event.preventDefault()
    toggleFullscreen()
    return
  }
  if (event.key === 'Tab') {
    event.preventDefault()
    applyResult(insertTab(selection()))
    return
  }
  if (!(event.metaKey || event.ctrlKey)) return
  const key = event.key.toLowerCase()
  const shortcut = key === 'b' ? 'bold' : key === 'i' ? 'italic' : key === 'k' ? 'link' : undefined
  if (!shortcut) return
  event.preventDefault()
  runCommand(shortcut)
}

function handleRichKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && linkDialogOpen.value) {
    event.preventDefault()
    closeLinkDialog()
  } else if (event.key === 'Escape' && isFullscreen.value) {
    event.preventDefault()
    toggleFullscreen()
  } else if (event.key === 'Tab') {
    event.preventDefault()
    document.execCommand('insertText', false, '  ')
    syncRichValue()
  }
}

function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error || new Error('Unable to read image'))
    reader.readAsDataURL(file)
  })
}

function triggerImagePicker(): void {
  if (props.disabled || props.readonly || isUploadingImage.value) return
  if (props.editorType === 'wysiwyg') saveRichSelection()
  if (fileInput.value) {
    fileInput.value.value = ''
    fileInput.value.click()
  }
}

async function handleImageFile(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  try {
    if (!file.type.startsWith('image/')) throw new Error('Only image files are supported')
    if (file.size > props.maxImageSize) throw new Error(`Image must be smaller than ${Math.round(props.maxImageSize / 1024 / 1024)} MB`)
    isUploadingImage.value = true
    const uploaded = props.imageUpload ? await props.imageUpload(file) : await fileAsDataUrl(file)
    const result: ImageUploadResult = typeof uploaded === 'string' ? { url: uploaded, alt: file.name } : uploaded
    if (!result.url) throw new Error('The image upload handler did not return a URL')

    if (props.editorType === 'wysiwyg') {
      richEditor.value?.focus()
      restoreRichSelection()
      document.execCommand('insertImage', false, result.url)
      const images = richEditor.value?.querySelectorAll<HTMLImageElement>('img')
      const image = images?.[images.length - 1]
      if (image) image.alt = result.alt || file.name
      saveRichSelection()
      syncRichValue()
    } else {
      const insertion = wrapSelection(selection(), '![', `](${result.url})`, result.alt || file.name)
      if (props.maxlength !== undefined && countMarkdownCharacters(insertion.value) > props.maxlength) {
        throw new Error('The uploaded image URL exceeds the editor maximum length')
      }
      applyResult(insertion)
    }

    emit('image-uploaded', result, file)
  } catch (error) {
    emit('image-upload-error', error instanceof Error ? error : new Error(String(error)), file)
  } finally {
    isUploadingImage.value = false
  }
}

function showTooltip(event: MouseEvent | FocusEvent, text: string): void {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  tooltip.value = {
    text,
    left: Math.max(48, Math.min(window.innerWidth - 48, rect.left + rect.width / 2)),
    top: rect.bottom + 8
  }
}

function hideTooltip(): void {
  tooltip.value = undefined
}

function insert(payload: InsertPayload): void {
  if (props.editorType === 'wysiwyg') {
    richEditor.value?.focus()
    restoreRichSelection()
    document.execCommand('insertText', false, `${payload.before || ''}${payload.placeholder || ''}${payload.after || ''}`)
    syncRichValue()
    return
  }
  const current = selection()
  if (payload.block) applyResult(insertBlock(current, payload.placeholder || payload.before || ''))
  else applyResult(wrapSelection(current, payload.before || '', payload.after || '', payload.placeholder || ''))
}

function focus(): void {
  if (props.editorType === 'wysiwyg') richEditor.value?.focus()
  else textarea.value?.focus()
}

function blur(): void {
  if (props.editorType === 'wysiwyg') richEditor.value?.blur()
  else textarea.value?.blur()
}

defineExpose({ focus, blur, insert, triggerImagePicker, textarea, richEditor })

onMounted(() => {
  if (props.editorType === 'wysiwyg') syncRichEditorFromModel()
  if (props.autofocus) focus()
})

onBeforeUnmount(() => {
  if (isFullscreen.value) document.body.classList.remove('wmd-body-locked')
  stopColumnResize()
  stopResize()
})
</script>

<template>
  <div class="wmd" :class="rootClasses" :data-theme="theme === 'auto' ? undefined : theme" :style="editorStyle">
    <input ref="fileInput" class="wmd-file-input" type="file" :accept="imageAccept" tabindex="-1" @change="handleImageFile">

    <div v-if="showToolbar" class="wmd-toolbar" role="toolbar" :aria-label="ariaLabel">
      <div class="wmd-toolbar__formatting">
        <slot name="toolbar-before" />
        <template v-for="item in visibleToolbar" :key="item">
          <slot
            :name="`toolbar-${item}`"
            :item="item"
            :label="resolvedLabels[toolbarLabelKeys[item]]"
            :disabled="disabled || readonly"
            :action="() => runCommand(item)"
          >
            <slot
              name="toolbar-item"
              :item="item"
              :label="resolvedLabels[toolbarLabelKeys[item]]"
              :disabled="disabled || readonly"
              :action="() => runCommand(item)"
            >
              <button
                class="wmd-tool"
                type="button"
                :aria-label="item === 'image' && isUploadingImage ? resolvedLabels.uploadingImage : resolvedLabels[toolbarLabelKeys[item]]"
                :disabled="disabled || readonly || (item === 'image' && isUploadingImage)"
                @mousedown.prevent="editorType === 'wysiwyg' && saveRichSelection()"
                @mouseenter="showTooltip($event, item === 'image' && isUploadingImage ? resolvedLabels.uploadingImage : resolvedLabels[toolbarLabelKeys[item]])"
                @mouseleave="hideTooltip"
                @focus="showTooltip($event, item === 'image' && isUploadingImage ? resolvedLabels.uploadingImage : resolvedLabels[toolbarLabelKeys[item]])"
                @blur="hideTooltip"
                @click="runCommand(item)"
              >
                <span v-if="item === 'image' && isUploadingImage" class="wmd-spinner" aria-hidden="true" />
                <Icon v-else :name="item" />
              </button>
            </slot>
          </slot>
        </template>
        <slot name="toolbar-after" />
      </div>

      <div class="wmd-toolbar__view">
        <template v-if="showModeSwitch && editorType === 'markdown'">
          <template v-for="view in visibleViewModes" :key="view">
            <slot :name="`toolbar-${view}`" :item="view" :label="resolvedLabels[view]" :active="currentMode === view" :action="() => setMode(view)">
              <slot name="toolbar-item" :item="view" :label="resolvedLabels[view]" :active="currentMode === view" :action="() => setMode(view)">
                <button
                  class="wmd-tool wmd-tool--view"
                  :class="{ 'is-active': currentMode === view }"
                  type="button"
                  :aria-label="resolvedLabels[view]"
                  :aria-pressed="currentMode === view"
                  @mouseenter="showTooltip($event, resolvedLabels[view])"
                  @mouseleave="hideTooltip"
                  @focus="showTooltip($event, resolvedLabels[view])"
                  @blur="hideTooltip"
                  @click="setMode(view)"
                ><Icon :name="view" /></button>
              </slot>
            </slot>
          </template>
        </template>
        <slot
          v-if="allowFullscreen && toolbarConfig.fullscreen !== false"
          name="toolbar-fullscreen"
          item="fullscreen"
          :label="isFullscreen ? resolvedLabels.exitFullscreen : resolvedLabels.fullscreen"
          :active="isFullscreen"
          :action="toggleFullscreen"
        >
          <slot name="toolbar-item" item="fullscreen" :label="isFullscreen ? resolvedLabels.exitFullscreen : resolvedLabels.fullscreen" :active="isFullscreen" :action="toggleFullscreen">
            <button
              class="wmd-tool wmd-tool--view"
              type="button"
              :aria-label="isFullscreen ? resolvedLabels.exitFullscreen : resolvedLabels.fullscreen"
              :aria-pressed="isFullscreen"
              @mouseenter="showTooltip($event, isFullscreen ? resolvedLabels.exitFullscreen : resolvedLabels.fullscreen)"
              @mouseleave="hideTooltip"
              @focus="showTooltip($event, isFullscreen ? resolvedLabels.exitFullscreen : resolvedLabels.fullscreen)"
              @blur="hideTooltip"
              @click="toggleFullscreen"
            ><Icon :name="isFullscreen ? 'exit-fullscreen' : 'fullscreen'" /></button>
          </slot>
        </slot>
      </div>
    </div>

    <div v-if="editorType === 'wysiwyg' && activeTableCell" class="wmd-table-tools" @mousedown.prevent>
      <button type="button" @click="addTableRow">＋ {{ resolvedLabels.addRow }}</button>
      <button type="button" @click="addTableColumn">＋ {{ resolvedLabels.addColumn }}</button>
      <button type="button" :disabled="activeTableCell.parentElement?.parentElement?.tagName === 'THEAD'" @click="deleteTableRow">− {{ resolvedLabels.deleteRow }}</button>
      <button type="button" :disabled="(tableFromCell()?.rows[0]?.cells.length || 0) <= 1" @click="deleteTableColumn">− {{ resolvedLabels.deleteColumn }}</button>
    </div>

    <div ref="workspace" class="wmd-workspace">
      <template v-if="editorType === 'wysiwyg'">
        <textarea
          v-if="name || required"
          class="wmd-rich-validation"
          :name="name"
          :value="modelValue"
          :required="required"
          :disabled="disabled"
          tabindex="-1"
          aria-hidden="true"
          @invalid.prevent="focus"
        />
        <div
          ref="richEditor"
          class="wmd-rich-editor wmd-preview"
          role="textbox"
          :contenteditable="disabled || readonly ? 'false' : 'true'"
          :data-placeholder="placeholder"
          :aria-label="ariaLabel"
          :aria-required="required"
          :aria-disabled="disabled"
          :aria-readonly="readonly"
          aria-multiline="true"
          spellcheck="true"
          @input="syncRichValue()"
          @paste="handleRichPaste"
          @keydown="handleRichKeydown"
          @click="handleRichClick"
          @pointermove="handleRichPointerMove"
          @pointerleave="richEditor?.classList.remove('wmd-column-edge-hover')"
          @pointerdown="handleTablePointerDown"
          @mouseup="saveRichSelection"
          @keyup="saveRichSelection"
          @focus="emit('focus', $event)"
          @blur="emit('blur', $event); syncRichValue()"
        />
      </template>

      <template v-else>
        <div v-show="currentMode !== 'preview'" class="wmd-editor-pane">
          <textarea
            ref="textarea"
            class="wmd-textarea"
            :value="markdownValue"
            :name="name"
            :placeholder="placeholder"
            :required="required"
            :disabled="disabled"
            :readonly="readonly"
            :aria-label="ariaLabel"
            spellcheck="true"
            @input="handleInput"
            @keydown="handleKeydown"
            @focus="emit('focus', $event)"
            @blur="emit('blur', $event)"
          />
        </div>
        <div v-show="currentMode !== 'edit'" class="wmd-preview-pane">
          <div v-if="renderedHtml" class="wmd-preview" v-html="renderedHtml" />
          <div v-else class="wmd-preview-empty">{{ resolvedLabels.emptyPreview }}</div>
        </div>
      </template>
    </div>

    <div
      v-if="resizable"
      class="wmd-resize-handle"
      role="separator"
      aria-orientation="horizontal"
      aria-label="调整编辑器高度"
      tabindex="0"
      @pointerdown.prevent="startResize"
      @keydown="handleResizeKeydown"
    ><span /></div>

    <div class="wmd-statusbar" :class="{ 'wmd-statusbar--brand-only': !showStatusbar }">
      <span v-if="showStatusbar">{{ characterCount }}<template v-if="maxlength"> / {{ maxlength }}</template> {{ resolvedLabels.characters }}</span>
      <a class="wmd-statusbar__brand" href="https://wujiee.com" target="_blank" rel="noopener noreferrer">WUJIEE</a>
    </div>

    <div v-if="linkDialogOpen" class="wmd-dialog-backdrop" @mousedown.self="closeLinkDialog">
      <form class="wmd-link-dialog" role="dialog" aria-modal="true" :aria-label="resolvedLabels.link" @submit.prevent="confirmLink">
        <div class="wmd-link-dialog__header">
          <strong>{{ resolvedLabels.link }}</strong>
          <button type="button" class="wmd-link-dialog__close" :aria-label="resolvedLabels.cancel" @click="closeLinkDialog">×</button>
        </div>
        <label class="wmd-link-field">
          <span>{{ resolvedLabels.linkTextLabel }}</span>
          <input v-model="linkText" type="text" autocomplete="off">
        </label>
        <label class="wmd-link-field">
          <span>{{ resolvedLabels.linkAddress }}</span>
          <input ref="linkUrlInput" v-model="linkUrl" type="text" inputmode="url" autocomplete="off" @input="linkError = ''">
        </label>
        <p v-if="linkError" class="wmd-link-error" role="alert">{{ linkError }}</p>
        <div class="wmd-link-dialog__actions">
          <button type="button" class="wmd-link-button wmd-link-button--secondary" @click="closeLinkDialog">{{ resolvedLabels.cancel }}</button>
          <button type="submit" class="wmd-link-button wmd-link-button--primary">{{ resolvedLabels.confirm }}</button>
        </div>
      </form>
    </div>

    <Teleport to="body">
      <div v-if="tooltip" class="wmd-tooltip" role="tooltip" :style="{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }">
        {{ tooltip.text }}
      </div>
    </Teleport>
  </div>
</template>
