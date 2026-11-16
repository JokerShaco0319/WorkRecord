import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { stripFrontmatter } from '@shared/md/section'

interface Props {
  raw: string
  className?: string
}

export default function MarkdownPreview({ raw, className = '' }: Props) {
  const html = useMemo(() => {
    const parsed = marked.parse(stripFrontmatter(raw), { async: false })
    return DOMPurify.sanitize(parsed)
  }, [raw])

  return <div className={`md-preview ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}
