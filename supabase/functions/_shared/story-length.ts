const CJK_CHARACTER_PATTERN = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/gu;
const NON_CJK_WORD_PATTERN = /[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu;

/** 中文、日文、韩文按文字个数统计；其余语言按单词统计。 */
export function storyBodyLengthUnits(body: string) {
  const normalized = body.trim();
  const cjkCharacters = normalized.match(CJK_CHARACTER_PATTERN)?.length ?? 0;
  const nonCjkText = normalized.replace(CJK_CHARACTER_PATTERN, " ");
  const nonCjkWords = nonCjkText.match(NON_CJK_WORD_PATTERN)?.length ?? 0;
  return cjkCharacters + nonCjkWords;
}
