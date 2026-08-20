const CJK_CHARACTER_PATTERN = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/gu;
const NON_CJK_WORD_PATTERN = /[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu;

/**
 * 中文、日文、韩文按文字个数统计；其余语言按单词统计。
 * 混合文本会把两部分相加，避免英文因字符数更长而被误判。
 */
export function storyBodyLengthUnits(body: string) {
  const normalized = body.trim();
  const cjkCharacters = normalized.match(CJK_CHARACTER_PATTERN)?.length ?? 0;
  const nonCjkText = normalized.replace(CJK_CHARACTER_PATTERN, " ");
  const nonCjkWords = nonCjkText.match(NON_CJK_WORD_PATTERN)?.length ?? 0;
  return cjkCharacters + nonCjkWords;
}
