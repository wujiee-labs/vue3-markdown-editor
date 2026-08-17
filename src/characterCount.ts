import { markdownToText } from './markdown'

type SegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity: 'grapheme' }
) => { segment(input: string): Iterable<unknown> }

const Segmenter = (Intl as typeof Intl & { Segmenter?: SegmenterConstructor }).Segmenter
const graphemeSegmenter = Segmenter ? new Segmenter(undefined, { granularity: 'grapheme' }) : undefined

export function countGraphemes(value: string): number {
  return graphemeSegmenter
    ? Array.from(graphemeSegmenter.segment(value)).length
    : Array.from(value).length
}

export function countMarkdownCharacters(markdown: string): number {
  return countGraphemes(markdownToText(markdown))
}
