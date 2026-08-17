export interface TextSelection {
  value: string
  start: number
  end: number
}

export interface CommandResult {
  value: string
  selectionStart: number
  selectionEnd: number
}

function replaceRange(selection: TextSelection, replacement: string, selectFrom: number, selectTo: number): CommandResult {
  return {
    value: selection.value.slice(0, selection.start) + replacement + selection.value.slice(selection.end),
    selectionStart: selection.start + selectFrom,
    selectionEnd: selection.start + selectTo
  }
}

export function wrapSelection(selection: TextSelection, before: string, after: string, placeholder: string): CommandResult {
  const selected = selection.value.slice(selection.start, selection.end)
  const content = selected || placeholder
  const replacement = `${before}${content}${after}`
  return replaceRange(selection, replacement, before.length, before.length + content.length)
}

export function prefixLines(selection: TextSelection, prefix: string | ((index: number) => string), placeholder = ''): CommandResult {
  const lineStart = selection.value.lastIndexOf('\n', Math.max(0, selection.start - 1)) + 1
  const nextBreak = selection.value.indexOf('\n', selection.end)
  const lineEnd = nextBreak === -1 ? selection.value.length : nextBreak
  const selected = selection.value.slice(lineStart, lineEnd) || placeholder
  const lines = selected.split('\n')
  const transformed = lines.map((line, index) => `${typeof prefix === 'function' ? prefix(index) : prefix}${line}`).join('\n')

  return {
    value: selection.value.slice(0, lineStart) + transformed + selection.value.slice(lineEnd),
    selectionStart: lineStart,
    selectionEnd: lineStart + transformed.length
  }
}

export function insertBlock(selection: TextSelection, content: string): CommandResult {
  const needsLeadingBreak = selection.start > 0 && selection.value[selection.start - 1] !== '\n'
  const needsTrailingBreak = selection.end < selection.value.length && selection.value[selection.end] !== '\n'
  const before = needsLeadingBreak ? '\n' : ''
  const after = needsTrailingBreak ? '\n' : ''
  const replacement = `${before}${content}${after}`

  return replaceRange(selection, replacement, before.length, before.length + content.length)
}

export function insertTab(selection: TextSelection): CommandResult {
  return replaceRange(selection, '  ', 2, 2)
}
