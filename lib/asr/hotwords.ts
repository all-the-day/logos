/**
 * 圣经场景的轻量热词表。
 * 腾讯云临时热词格式：`词|权重`，英文逗号分隔，单次最多 128 个；单个人名/书名都很短。
 * 只放书卷名、关键神学词与常用专名，不把整节经文塞进去，避免抑制真实错误。
 */

const CORE_HOTWORDS = [
  "耶和华",
  "耶稣基督",
  "耶稣",
  "基督",
  "圣灵",
  "使徒",
  "福音",
  "恩典",
  "信心",
  "称义",
  "荣耀",
  "赎罪",
  "复活",
  "十字架",
  "罗马书",
  "哥林多前书",
  "哥林多后书",
  "加拉太书",
  "以弗所书",
  "腓立比书",
  "歌罗西书",
  "约翰一书",
  "亚伯拉罕",
  "以撒",
  "雅各",
  "摩西",
  "大卫",
  "保罗",
  "彼得",
  "约翰",
  "祂",
  "祢",
];

/** 生成热词数组（保持书卷名在首位） */
export function buildHotwordWords(bookName?: string): string[] {
  const words: string[] = [];
  const seen = new Set<string>();
  const add = (value: string | undefined) => {
    const text = value?.trim();
    if (!text || text.length > 10 || seen.has(text)) return;
    seen.add(text);
    words.push(text);
  };

  add(bookName);
  for (const word of CORE_HOTWORDS) add(word);
  return words;
}

/** 腾讯云临时热词格式：`词|权重`，英文逗号分隔 */
export function formatTencentHotwords(words: string[], firstWeight = 5): string {
  return words.map((word, index) => `${word}|${index === 0 ? firstWeight : 5}`).join(",");
}

export function buildHotwordList(bookName?: string): string {
  return formatTencentHotwords(buildHotwordWords(bookName), bookName ? 10 : 5);
}
