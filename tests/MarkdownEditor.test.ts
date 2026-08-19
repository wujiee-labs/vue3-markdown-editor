import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MarkdownEditor from '../src/MarkdownEditor.vue'

describe('MarkdownEditor', () => {
  it('works as a native form control', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: 'hello',
        name: 'description',
        required: true,
        maxlength: 20,
        mode: 'edit'
      }
    })
    const field = wrapper.get('textarea')

    expect(field.element.value).toBe('hello')
    expect(field.attributes('name')).toBe('description')
    expect(field.attributes()).toHaveProperty('required')
    // maxlength is enforced by Unicode grapheme counting instead of the browser's UTF-16 rule.
    expect(field.attributes('maxlength')).toBeUndefined()

    await field.setValue('updated')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['updated'])
    expect(wrapper.emitted('change')?.at(-1)).toEqual(['updated'])
  })

  it('inserts formatting around the current selection', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: 'hello',
        mode: 'edit' as const,
        'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value })
      }
    })
    const field = wrapper.get('textarea').element
    field.setSelectionRange(0, 5)

    await wrapper.get('button[aria-label="粗体"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['**hello**'])
  })

  it('shows escaped raw HTML in preview mode', () => {
    const wrapper = mount(MarkdownEditor, {
      props: { modelValue: '<img src=x onerror=alert(1)>', mode: 'preview' }
    })

    expect(wrapper.find('.wujiee-md-preview').html()).not.toContain('<img')
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  })

  it('supports borderless appearance and immediate toolbar labels', async () => {
    const wrapper = mount(MarkdownEditor, { props: { bordered: false } })
    expect(wrapper.classes()).toContain('wujiee-md--borderless')

    await wrapper.get('button[aria-label="粗体"]').trigger('mouseenter')
    expect(document.body.querySelector('.wujiee-md-tooltip')?.textContent?.trim()).toBe('粗体')
    wrapper.unmount()
  })

  it('uses the component link dialog instead of a browser prompt', async () => {
    const promptSpy = vi.spyOn(window, 'prompt')
    const wrapper = mount(MarkdownEditor, {
      props: { modelValue: 'hello', mode: 'edit' }
    })
    const field = wrapper.get('textarea').element
    field.setSelectionRange(0, 5)

    await wrapper.get('button[aria-label="链接"]').trigger('click')
    expect(wrapper.find('.wujiee-md-link-dialog').exists()).toBe(true)
    expect(promptSpy).not.toHaveBeenCalled()

    await wrapper.get('input[inputmode="url"]').setValue('example.com')
    await wrapper.get('.wujiee-md-link-dialog').trigger('submit')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['[hello](https://example.com)'])
    promptSpy.mockRestore()
  })

  it('edits formatted content without exposing Markdown syntax in wysiwyg mode', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: { modelValue: '**bold**', editorType: 'wysiwyg' }
    })
    const editor = wrapper.get('.wujiee-md-rich-editor')

    expect(editor.find('strong').text()).toBe('bold')
    expect(wrapper.find('button[aria-label="编辑"]').exists()).toBe(false)
    expect(wrapper.get('.wujiee-md-statusbar__brand').text()).toBe('WUJIEE')
    expect(wrapper.get('.wujiee-md-statusbar__brand').attributes('href')).toBe('https://wujiee.com')

    editor.element.innerHTML = '<p><strong>updated</strong></p>'
    await editor.trigger('input')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['**updated**'])
  })

  it('stores normalized HTML when valueFormat is html', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: '<p><strong>bold</strong></p>',
        editorType: 'wysiwyg',
        valueFormat: 'html'
      }
    })
    const editor = wrapper.get('.wujiee-md-rich-editor')

    expect(editor.find('strong').text()).toBe('bold')
    editor.element.innerHTML = '<h2>标题</h2><p><strong>内容</strong></p>'
    await editor.trigger('input')

    const emitted = String(wrapper.emitted('update:modelValue')?.at(-1)?.[0])
    expect(emitted).toContain('<h2>标题</h2>')
    expect(emitted).toContain('<strong>内容</strong>')
    expect(emitted).not.toContain('**')
  })

  it('reflects the selected heading state and toggles it back to a paragraph', async () => {
    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })
    const wrapper = mount(MarkdownEditor, {
      attachTo: document.body,
      props: { modelValue: '## 标题', editorType: 'wysiwyg' }
    })
    const editor = wrapper.get('.wujiee-md-rich-editor')
    const headingText = editor.get('h2').element.firstChild!
    const range = document.createRange()
    range.selectNodeContents(headingText)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    await editor.trigger('mouseup')

    const headingButton = wrapper.get('button[aria-label="标题"]')
    expect(headingButton.classes()).toContain('wujiee-md-is-active')
    expect(headingButton.attributes('aria-pressed')).toBe('true')

    await headingButton.trigger('mousedown')
    await headingButton.trigger('click')
    expect(execCommand).toHaveBeenCalledWith('formatBlock', false, 'p')

    wrapper.unmount()
    Reflect.deleteProperty(document, 'execCommand')
  })

  it('exits a code block after Enter on its empty last line', async () => {
    const wrapper = mount(MarkdownEditor, {
      attachTo: document.body,
      props: { modelValue: '', editorType: 'wysiwyg', valueFormat: 'html' }
    })
    const editor = wrapper.get('.wujiee-md-rich-editor')
    editor.element.innerHTML = '<pre>const value = 1\n</pre>'
    const codeText = editor.get('pre').element.firstChild!
    const range = document.createRange()
    range.setStart(codeText, codeText.textContent!.length)
    range.collapse(true)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    await editor.trigger('mouseup')
    await editor.trigger('keydown', { key: 'Enter' })

    expect(editor.get('pre').element.nextElementSibling?.tagName).toBe('P')
    expect(editor.get('pre').element.nextElementSibling?.querySelector('br')).not.toBeNull()

    wrapper.unmount()
  })

  it('toggles task-list, inline-code and link formatting from the active selection', async () => {
    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })
    const wrapper = mount(MarkdownEditor, {
      attachTo: document.body,
      props: { modelValue: '', editorType: 'wysiwyg', valueFormat: 'html' }
    })
    const editor = wrapper.get('.wujiee-md-rich-editor')
    editor.element.innerHTML = '<ul><li class="wujiee-md-task-list-item"><input type="checkbox" disabled> 任务</li></ul><p><code>代码</code>和<a href="https://wujiee.com">链接</a></p>'

    const selectNode = async (node: Node) => {
      const range = document.createRange()
      range.selectNodeContents(node)
      window.getSelection()!.removeAllRanges()
      window.getSelection()!.addRange(range)
      await editor.trigger('mouseup')
    }

    await selectNode(editor.get('li').element.lastChild!)
    const taskButton = wrapper.get('button[aria-label="任务列表"]')
    expect(taskButton.classes()).toContain('wujiee-md-is-active')
    await taskButton.trigger('mousedown')
    await taskButton.trigger('click')
    expect(editor.find('input[type="checkbox"]').exists()).toBe(false)
    expect(execCommand).toHaveBeenCalledWith('insertUnorderedList')

    await selectNode(editor.get('code').element.firstChild!)
    const codeButton = wrapper.get('button[aria-label="行内代码"]')
    expect(codeButton.classes()).toContain('wujiee-md-is-active')
    await codeButton.trigger('mousedown')
    await codeButton.trigger('click')
    expect(editor.find('code').exists()).toBe(false)

    await selectNode(editor.get('a').element.firstChild!)
    const linkButton = wrapper.get('button[aria-label="链接"]')
    expect(linkButton.classes()).toContain('wujiee-md-is-active')
    await linkButton.trigger('mousedown')
    await linkButton.trigger('click')
    expect(editor.find('a').exists()).toBe(false)
    expect(editor.text()).toContain('链接')

    wrapper.unmount()
    Reflect.deleteProperty(document, 'execCommand')
  })

  it('allows checking task items while editing and persists the checked state', async () => {
    const wrapper = mount(MarkdownEditor, {
      attachTo: document.body,
      props: { modelValue: '- [ ] 任务', editorType: 'wysiwyg' }
    })
    const checkbox = wrapper.get('.wujiee-md-task-list-checkbox').element as HTMLInputElement
    expect(checkbox.disabled).toBe(false)

    checkbox.click()
    await flushPromises()
    expect(checkbox.checked).toBe(true)
    expect(String(wrapper.emitted('update:modelValue')?.at(-1)?.[0])).toContain('- [x] 任务')
    wrapper.unmount()
  })

  it('edits Markdown source while emitting HTML storage format', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: '<p><strong>初始内容</strong></p>',
        mode: 'edit',
        valueFormat: 'html'
      }
    })
    const field = wrapper.get('.wujiee-md-textarea')

    expect((field.element as HTMLTextAreaElement).value).toContain('**初始内容**')
    await field.setValue('## 新标题')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['<h2>新标题</h2>\n'])
  })

  it('normalizes unsafe stored HTML before previewing it', () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: '<img src="x" onerror="alert(1)"><script>alert(2)</script>',
        mode: 'preview',
        valueFormat: 'html'
      }
    })

    const preview = wrapper.get('.wujiee-md-preview').html()
    expect(preview).not.toContain('onerror')
    expect(preview).not.toContain('<script')
  })

  it('keeps native required validation in wysiwyg forms', async () => {
    const wrapper = mount(MarkdownEditor, {
      attachTo: document.body,
      props: { modelValue: '', editorType: 'wysiwyg', name: 'content', required: true }
    })
    const validationField = wrapper.get('.wujiee-md-rich-validation').element as HTMLTextAreaElement
    expect(validationField.checkValidity()).toBe(false)

    await wrapper.setProps({ modelValue: 'content' })
    expect(validationField.checkValidity()).toBe(true)
    wrapper.unmount()
  })

  it('uploads an image with the provided business handler', async () => {
    const imageUpload = vi.fn().mockResolvedValue({ url: 'https://cdn.example.com/demo.png', alt: 'demo' })
    const wrapper = mount(MarkdownEditor, {
      props: { modelValue: '', mode: 'edit', imageUpload }
    })
    const file = new File(['image'], 'demo.png', { type: 'image/png' })
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })

    await input.trigger('change')
    await flushPromises()

    expect(imageUpload).toHaveBeenCalledWith(file)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['![demo](https://cdn.example.com/demo.png)'])
    expect(wrapper.emitted('image-uploaded')?.length).toBe(1)
  })

  it('does not render a file input when image support is disabled', () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: '',
        toolbarConfig: { image: false }
      }
    })

    expect(wrapper.find('button[aria-label="上传图片"]').exists()).toBe(false)
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
  })

  it('adds a Markdown table from the table toolbar button', async () => {
    const wrapper = mount(MarkdownEditor, { props: { modelValue: '', mode: 'edit' } })
    await wrapper.get('button[aria-label="表格"]').trigger('click')
    expect(String(wrapper.emitted('update:modelValue')?.at(-1)?.[0])).toContain('| 列 1 | 列 2 | 列 3 |')
  })

  it('adds and removes table rows and columns in wysiwyg mode', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        editorType: 'wysiwyg',
        modelValue: '| A | B |\n| --- | --- |\n| 1 | 2 |'
      }
    })
    await wrapper.get('.wujiee-md-rich-editor td').trigger('click')
    expect(wrapper.find('.wujiee-md-table-tools').exists()).toBe(true)
    expect(wrapper.find('.wujiee-md-table-tools span').exists()).toBe(false)

    await wrapper.get('.wujiee-md-table-tools button:nth-of-type(1)').trigger('click')
    expect(wrapper.findAll('.wujiee-md-rich-editor tr')).toHaveLength(3)

    await wrapper.get('.wujiee-md-table-tools button:nth-of-type(2)').trigger('click')
    expect(wrapper.findAll('.wujiee-md-rich-editor thead th')).toHaveLength(3)
    expect(String(wrapper.emitted('update:modelValue')?.at(-1)?.[0])).toContain('wujiee-table-widths')
  })

  it('configures toolbar visibility and colors with JSON props', () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        toolbarConfig: { bold: false, table: false, fullscreen: false },
        colors: { primary: '#ff0000', background: '#fafafa' }
      }
    })
    expect(wrapper.find('button[aria-label="粗体"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="表格"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="全屏"]').exists()).toBe(false)
    expect(wrapper.attributes('style')).toContain('--wujiee-md-primary: #ff0000')
    expect(wrapper.attributes('style')).toContain('--wujiee-md-bg: #fafafa')
  })

  it('supports replacing individual toolbar buttons with named slots', () => {
    const wrapper = mount(MarkdownEditor, {
      slots: { 'toolbar-bold': '<button class="wujiee-custom-bold">自定义粗体</button>' }
    })
    expect(wrapper.get('.wujiee-custom-bold').text()).toBe('自定义粗体')
    expect(wrapper.find('button[aria-label="粗体"]').exists()).toBe(false)
  })

  it('keeps the WUJIEE attribution when the character status is hidden', () => {
    const wrapper = mount(MarkdownEditor, { props: { showStatusbar: false } })
    expect(wrapper.find('.wujiee-md-statusbar > span').exists()).toBe(false)
    expect(wrapper.get('.wujiee-md-statusbar__brand').attributes('href')).toBe('https://wujiee.com')
  })

  it('supports a keyboard-resizable height and a fixed-height mode', async () => {
    const wrapper = mount(MarkdownEditor, { props: { minHeight: 240, height: 320 } })
    await wrapper.get('.wujiee-md-resize-handle').trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.emitted('resize')?.at(-1)).toEqual([240])

    await wrapper.setProps({ resizable: false, height: 360 })
    expect(wrapper.find('.wujiee-md-resize-handle').exists()).toBe(false)
    expect(wrapper.attributes('style')).toContain('--wujiee-md-height: 360px')
  })

  it('counts and limits visible Unicode characters instead of UTF-16 units', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: { modelValue: '**中A😀**', maxlength: 3, mode: 'edit' }
    })
    expect(wrapper.get('.wujiee-md-statusbar > span').text()).toBe('3 / 3')

    await wrapper.get('textarea').setValue('中A😀B')
    expect(wrapper.emitted('limit')?.at(-1)).toEqual([3])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
