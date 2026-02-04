/**
 * 对两个 HTML 片段做 parse 级别的对比：解析出标签、class、文本等，并输出 class 增删与文本变更。
 * 用于消费 resolveGroupChangeFragments 得到的 originalFragment / finalFragment。
 */

import { parseFragment } from 'parse5';

/** 解析出的单个根元素信息（只关心第一个根元素） */
export interface ParsedFragmentElement {
  tagName: string;
  /** class 属性按空白切分后的列表 */
  classList: string[];
  /** 元素内直接+间接文本拼接（不含子标签的 tag，只取文本） */
  textContent: string;
  /** 除 class 外的其他属性（name -> value） */
  otherAttrs: Record<string, string>;
}

/** 两个 HTML 片段的对比结果 */
export interface HtmlFragmentDiff {
  /** 原始片段解析结果（若解析失败为 null） */
  original: ParsedFragmentElement | null;
  /** 最终片段解析结果（若解析失败为 null） */
  final: ParsedFragmentElement | null;
  /** class：最终相对原始新增的 class 列表 */
  classAdded: string[];
  /** class：最终相对原始删除的 class 列表 */
  classRemoved: string[];
  /** 文本：原始片段根元素文本 */
  textOriginal: string;
  /** 文本：最终片段根元素文本 */
  textFinal: string;
  /** 文本是否发生变更 */
  textChanged: boolean;
  /** 文本变更的简短描述（便于展示） */
  textSummary: string;
}

/**
 * 从 parse5 的节点中取属性值
 */
function getAttr(
  node: { attrs?: Array<{ name: string; value: string }> },
  name: string
): string | undefined {
  const attrs = node.attrs ?? [];
  const lower = name.toLowerCase();
  const a = attrs.find((x) => x.name?.toLowerCase() === lower);
  return a?.value;
}

/**
 * 递归收集元素的文本内容（不含标签名，只取文本节点）
 */
function getTextContent(node: any): string {
  if (!node) return '';
  if (node.nodeName === '#text') {
    return node.value ?? '';
  }
  const childNodes = node.childNodes ?? [];
  return childNodes.map((child: any) => getTextContent(child)).join('');
}

/**
 * 判断是否为元素节点（有 tagName）
 */
function isElementNode(node: any): node is {
  tagName: string;
  attrs: Array<{ name: string; value: string }>;
  childNodes?: any[];
} {
  return node && typeof (node as any).tagName === 'string';
}

/**
 * 将 class 属性字符串按空白切分为有序列表，去重保留顺序
 */
function splitClassList(classAttr: string | undefined): string[] {
  if (classAttr == null || classAttr === '') return [];
  const list = classAttr.trim().split(/\s+/).filter(Boolean);
  return [...new Set(list)];
}

/**
 * 从 HTML 片段中解析出第一个根元素的信息
 *
 * @param fragment 单段 HTML，如 `<h1 class="...">姓名</h1>`
 * @returns 第一个根元素的信息；若无元素或解析失败则返回 null
 */
export function parseFragmentToElement(
  fragment: string
): ParsedFragmentElement | null {
  if (!fragment || typeof fragment !== 'string') return null;

  const wrapped = fragment.trim();
  if (!wrapped) return null;

  let fragmentNode: any;
  try {
    fragmentNode = parseFragment(wrapped);
  } catch {
    return null;
  }

  const childNodes = fragmentNode?.childNodes ?? [];
  for (const child of childNodes) {
    if (isElementNode(child)) {
      const classAttr = getAttr(child, 'class');
      const classList = splitClassList(classAttr);
      const textContent = getTextContent(child).trim();
      const otherAttrs: Record<string, string> = {};
      for (const a of child.attrs ?? []) {
        if (a.name?.toLowerCase() !== 'class') {
          otherAttrs[a.name] = a.value ?? '';
        }
      }
      return {
        tagName: (child.tagName ?? '').toLowerCase(),
        classList,
        textContent,
        otherAttrs,
      };
    }
  }
  return null;
}

/**
 * 对比两个 HTML 片段：解析后比较 class 增删与根元素文本变更
 *
 * @param originalFragment 原始片段（如 resolveGroupChangeFragments 的 originalFragment）
 * @param finalFragment 最终片段（如 resolveGroupChangeFragments 的 finalFragment）
 * @returns 结构化对比结果，便于展示「class 多了啥、少了啥」和「text 变更了啥」
 */
export function compareHtmlFragments(
  originalFragment: string,
  finalFragment: string
): HtmlFragmentDiff {
  const original = parseFragmentToElement(originalFragment);
  const final = parseFragmentToElement(finalFragment);

  const originalClasses = new Set(original?.classList ?? []);
  const finalClasses = new Set(final?.classList ?? []);
  // 明确返回全新 string[]，避免被误用或序列化成 Set
  const classAdded: string[] = [
    ...(final?.classList ?? []).filter((c) => !originalClasses.has(c)),
  ];
  const classRemoved: string[] = [
    ...(original?.classList ?? []).filter((c) => !finalClasses.has(c)),
  ];

  const textOriginal = original?.textContent ?? '';
  const textFinal = final?.textContent ?? '';
  const textChanged = textOriginal !== textFinal;
  const textSummary = textChanged
    ? `「${textOriginal || '(空)'}」 → 「${textFinal || '(空)'}」`
    : '无变更';

  return {
    original,
    final,
    classAdded,
    classRemoved,
    textOriginal,
    textFinal,
    textChanged,
    textSummary,
  };
}

/**
 * 消费 resolveGroupChangeFragments 的返回值：在原有片段级 diff 基础上，再解析两个 HTML 片段，
 * 得到 class 增删与文本变更的结构化结果。
 *
 * @param result resolveGroupChangeMessage / resolveGroupChangeFragments 的返回值
 * @returns 原 result 与 HTML 解析对比结果；若 result 为 undefined 则返回 undefined
 */
export function consumeGroupChangeResult<
  T extends { originalFragment: string; finalFragment: string }
>(result: T | undefined): (T & { htmlDiff: HtmlFragmentDiff }) | undefined {
  if (result == null) return undefined;
  const htmlDiff = compareHtmlFragments(
    result.originalFragment,
    result.finalFragment
  );
  return { ...result, htmlDiff };
}
