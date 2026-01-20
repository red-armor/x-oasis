/**
 * Vue SFC (Single File Component) 源码修改工具
 * 使用 @vue/compiler-sfc 和 @vue/compiler-dom 解析和修改 Vue 文件
 */

import { parse as parseSFC } from '@vue/compiler-sfc';
import {
  parse as parseTemplate,
  NodeTypes,
  ElementNode,
  AttributeNode,
  TextNode,
} from '@vue/compiler-dom';
import MagicString from 'magic-string';
import {
  SourcePosition,
  StyleUpdate,
  ModificationResult,
} from './sourceCodeModifier';

/**
 * 解析 Vue SFC 文件结构
 */
interface VueSFCStructure {
  template: {
    content: string;
    start: number;
    end: number;
  } | null;
  script: {
    content: string;
    start: number;
    end: number;
  } | null;
  style: Array<{
    content: string;
    start: number;
    end: number;
  }>;
  templateOffset: number; // template 在文件中的行号偏移
}

/**
 * 解析 Vue SFC 文件
 */
function parseVueSFC(sourceCode: string): VueSFCStructure {
  const result = parseSFC(sourceCode, {
    filename: 'component.vue',
  });

  const structure: VueSFCStructure = {
    template: null,
    script: null,
    style: [],
    templateOffset: 0,
  };

  // 计算 template 的行号偏移（template 内容开始前的行数）
  // 这与 vueDetector.ts 中的 getTemplateOffset 逻辑一致
  const templateStart = sourceCode.indexOf('<template');
  if (templateStart !== -1) {
    const templateTagClose = sourceCode.indexOf('>', templateStart);
    if (templateTagClose !== -1) {
      const prefix = sourceCode.slice(0, templateTagClose + 1);
      structure.templateOffset = prefix.split('\n').length - 1;
    }
  }

  if (result.descriptor.template) {
    const template = result.descriptor.template;
    // template.loc.start.offset 是 <template> 标签的开始位置
    // template.loc.end.offset 是 </template> 标签的结束位置
    // template.content 是 template 标签内的内容（不包括标签本身）

    // 找到 template 内容的实际开始位置（在 <template> 标签之后）
    const templateTagStart = sourceCode.indexOf('<template');
    const templateTagClose = sourceCode.indexOf('>', templateTagStart);
    const templateContentStart = templateTagClose + 1; // template 内容开始位置

    structure.template = {
      content: template.content,
      start: templateContentStart, // 使用实际的内容开始位置
      end: template.loc.end.offset,
    };
  }

  if (result.descriptor.script || result.descriptor.scriptSetup) {
    const script = result.descriptor.script || result.descriptor.scriptSetup!;
    structure.script = {
      content: script.content,
      start: script.loc.start.offset,
      end: script.loc.end.offset,
    };
  }

  result.descriptor.styles.forEach((style) => {
    structure.style.push({
      content: style.content,
      start: style.loc.start.offset,
      end: style.loc.end.offset,
    });
  });

  return structure;
}

/**
 * 获取 Vue 元素属性值
 */
function getVueAttributeValue(attr: AttributeNode): string | null {
  if (!attr.value) return null;

  if (attr.value.type === NodeTypes.TEXT) {
    return (attr.value as TextNode).content;
  }

  // 处理其他类型的属性值（如插值表达式等）
  return null;
}

/**
 * 获取或创建 class 属性（Vue 使用 class 而不是 className）
 */
function getOrCreateClassAttr(
  node: ElementNode,
  templateContent: string,
  templateStart: number
): {
  attr: AttributeNode | null;
  existingValue: string | null;
  insertPosition: number;
} {
  const existingAttr = node.props.find(
    (prop): prop is AttributeNode =>
      prop.type === NodeTypes.ATTRIBUTE && prop.name === 'class'
  );

  let existingValue: string | null = null;
  if (existingAttr) {
    existingValue = getVueAttributeValue(existingAttr);
  }

  // 计算插入位置（相对于 template 内容的字符偏移）
  // 注意：node.loc.start.offset 是相对于 template 内容的
  let insertPosition: number;
  if (existingAttr && existingAttr.loc) {
    // 现有属性的结束位置（相对于 template 内容）
    insertPosition = existingAttr.loc.end.offset;
  } else {
    // 在标签名后插入
    // 找到标签名的结束位置（第一个空格或 >）
    const nodeStartOffset = node.loc.start.offset; // 相对于 template 内容
    const nodeStartInContent = templateStart + nodeStartOffset; // 在整个文件中的位置

    // 在 template 内容中查找
    const tagNameEnd = templateContent.indexOf(' ', nodeStartOffset);
    const tagEnd = templateContent.indexOf('>', nodeStartOffset);

    if (tagNameEnd > 0 && (tagEnd < 0 || tagNameEnd < tagEnd)) {
      insertPosition = tagNameEnd;
    } else if (tagEnd > 0) {
      insertPosition = tagEnd;
    } else {
      // 如果找不到，使用节点结束位置
      insertPosition = node.loc.end.offset;
    }
  }

  return {
    attr: existingAttr || null,
    existingValue: existingValue || null,
    insertPosition,
  };
}

/**
 * 获取或创建 style 属性
 */
function getOrCreateStyleAttr(
  node: ElementNode,
  templateContent: string,
  templateStart: number
): {
  attr: AttributeNode | null;
  existingValue: Record<string, string> | null;
  insertPosition: number;
} {
  const existingAttr = node.props.find(
    (prop): prop is AttributeNode =>
      prop.type === NodeTypes.ATTRIBUTE && prop.name === 'style'
  );

  let existingValue: Record<string, string> | null = null;
  if (existingAttr) {
    const value = getVueAttributeValue(existingAttr);
    if (value) {
      // 简单解析 style 字符串（如 "color: red; font-size: 14px"）
      existingValue = {};
      value.split(';').forEach((decl) => {
        const [key, val] = decl.split(':').map((s) => s.trim());
        if (key && val) {
          existingValue![key] = val;
        }
      });
    }
  }

  let insertPosition: number;
  if (existingAttr && existingAttr.loc) {
    // 现有属性的结束位置（相对于 template 内容）
    insertPosition = existingAttr.loc.end.offset;
  } else {
    // 在标签名后插入
    const nodeStartOffset = node.loc.start.offset; // 相对于 template 内容
    const tagNameEnd = templateContent.indexOf(' ', nodeStartOffset);
    const tagEnd = templateContent.indexOf('>', nodeStartOffset);

    if (tagNameEnd > 0 && (tagEnd < 0 || tagNameEnd < tagEnd)) {
      insertPosition = tagNameEnd;
    } else if (tagEnd > 0) {
      insertPosition = tagEnd;
    } else {
      insertPosition = node.loc.end.offset;
    }
  }

  return {
    attr: existingAttr || null,
    existingValue: existingValue || null,
    insertPosition,
  };
}

/**
 * 根据行号和列号找到对应的 Vue 元素节点
 * 简化逻辑：直接找到在目标行号上的元素，选择起始位置最接近的
 */
function findVueElementByPosition(
  ast: any,
  line: number,
  column: number,
  templateOffset: number
): ElementNode | null {
  // 调整行号（减去 template 偏移）
  // position.line 是文件中的绝对行号（已经包含了 templateOffset）
  // el.loc.start.line 是 template 内容中的相对行号（从1开始）
  const adjustedLine = line - templateOffset;

  // 注意：worker 端使用了 Math.max(0, rawCol - 1)，所以这里也需要调整
  // 但 column 已经是调整后的值，所以直接使用

  // 收集所有在目标行号上的元素节点
  const candidatesOnLine: Array<{
    node: ElementNode;
    startCol: number;
    endCol: number;
  }> = [];

  function traverse(node: any) {
    if (node.type === NodeTypes.ELEMENT) {
      const el = node as ElementNode;
      if (el.loc) {
        const start = el.loc.start;
        const end = el.loc.end;

        // 检查是否在目标行号上
        // 如果元素的起始行或结束行等于目标行，或者目标行在元素范围内
        if (
          start.line === adjustedLine ||
          end.line === adjustedLine ||
          (start.line < adjustedLine && end.line > adjustedLine)
        ) {
          candidatesOnLine.push({
            node: el,
            startCol: start.column,
            endCol: end.column,
          });
        }
      }
    }

    if (node.children) {
      node.children.forEach(traverse);
    }
  }

  traverse(ast);

  // debugger
  if (candidatesOnLine.length === 0) {
    return null;
  }

  // 选择策略：
  // 1. 优先选择起始行等于目标行的元素（元素在这一行开始）
  // 2. 如果有多个，选择起始列最接近目标列的元素
  let targetNode: ElementNode | null = null;
  let closestDistance = Infinity;

  // 先找起始行等于目标行的
  for (const candidate of candidatesOnLine) {
    const start = candidate.node.loc!.start;
    if (start.line === adjustedLine) {
      const distance = Math.abs(start.column - column);
      if (distance < closestDistance) {
        closestDistance = distance;
        targetNode = candidate.node;
      }
    }
  }

  // 如果没找到起始行等于目标行的，找包含目标行的元素
  if (!targetNode) {
    for (const candidate of candidatesOnLine) {
      const start = candidate.node.loc!.start;
      const end = candidate.node.loc!.end;
      if (start.line < adjustedLine && end.line > adjustedLine) {
        // 元素跨越多行，包含目标行
        const distance = Math.abs(start.column - column);
        if (distance < closestDistance) {
          closestDistance = distance;
          targetNode = candidate.node;
        }
      }
    }
  }

  // 如果还是没找到，选择结束行等于目标行的
  if (!targetNode) {
    for (const candidate of candidatesOnLine) {
      const end = candidate.node.loc!.end;
      if (end.line === adjustedLine) {
        const distance = Math.abs(end.column - column);
        if (distance < closestDistance) {
          closestDistance = distance;
          targetNode = candidate.node;
        }
      }
    }
  }

  // 如果还是没找到，选择第一个
  if (!targetNode && candidatesOnLine.length > 0) {
    targetNode = candidatesOnLine[0].node;
  }

  return targetNode;
}

/**
 * 修改 Vue SFC 源码：添加或更新 class 和 style
 */
export function modifyVueSFC(
  sourceCode: string,
  position: SourcePosition,
  updates: StyleUpdate
): ModificationResult {
  try {
    // 解析 Vue SFC
    const sfcStructure = parseVueSFC(sourceCode);

    if (!sfcStructure.template) {
      return {
        success: false,
        error: 'Vue 文件没有 <template> 部分',
      };
    }

    // 解析 template
    const templateAST = parseTemplate(sfcStructure.template.content, {
      onError: (err) => {
        throw new Error(`解析 Vue template 失败: ${err.message}`);
      },
    });

    // 找到对应的元素
    const element = findVueElementByPosition(
      templateAST,
      position.line,
      position.column,
      sfcStructure.templateOffset
    );

    if (!element) {
      return {
        success: false,
        error: `无法找到位置 (${position.line}:${position.column}) 对应的 Vue 元素`,
      };
    }

    // debugger

    // 使用 MagicString 修改 template 内容
    const templateStart = sfcStructure.template.start;
    const templateContent = sfcStructure.template.content;
    const s = new MagicString(sourceCode);
    let hasChanges = false;

    // 处理 class（Vue 使用 class 而不是 className）
    if (updates.className !== undefined) {
      const { attr, existingValue, insertPosition } = getOrCreateClassAttr(
        element,
        templateContent,
        templateStart
      );

      console.log('getOrCreateClassAttr ', attr, templateStart);

      const classNames = Array.isArray(updates.className)
        ? updates.className
        : [updates.className];
      // const existingClasses = existingValue ? existingValue.split(/\s+/) : [];
      // const newClasses = [...existingClasses];

      // classNames.forEach((cls) => {
      //   if (cls && !newClasses.includes(cls)) {
      //     newClasses.push(cls);
      //   }
      // });

      // const newClassValue = newClasses.filter(Boolean).join(' ');
      const newClassValue = classNames.filter(Boolean).join(' ');

      if (attr && attr.loc) {
        // 更新现有的 class 属性值
        // 注意：parseTemplate 返回的 loc.offset 是相对于 template 内容的
        if (attr.value && attr.value.loc) {
          const valueStart = templateStart + attr.value.loc.start.offset;
          const valueEnd = templateStart + attr.value.loc.end.offset;

          console.log('overwrite ', valueStart, valueEnd, `"${newClassValue}"`);

          s.overwrite(valueStart, valueEnd, `"${newClassValue}"`);
        } else {
          // 如果没有值，在属性名后添加值
          const attrEnd = templateStart + attr.loc.end.offset;
          s.appendLeft(attrEnd, `="${newClassValue}"`);
        }
        hasChanges = true;
      } else {
        // 添加新的 class 属性
        const insertPos = templateStart + insertPosition;
        s.appendLeft(insertPos, ` class="${newClassValue}"`);
        hasChanges = true;
      }
    }

    // 处理 style
    if (updates.style !== undefined) {
      const { attr, existingValue, insertPosition } = getOrCreateStyleAttr(
        element,
        templateContent,
        templateStart
      );
      const mergedStyle = { ...(existingValue || {}), ...updates.style };

      // 生成 style 字符串（Vue 使用字符串格式，如 "color: red; font-size: 14px"）
      const styleEntries = Object.entries(mergedStyle)
        .map(([key, value]) => {
          // Vue template 中 style 使用 kebab-case 或原样
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          return `${cssKey}: ${value}`;
        })
        .join('; ');
      const styleValue = `"${styleEntries}"`;

      if (attr && attr.loc) {
        // 更新现有的 style 属性值
        if (attr.value && attr.value.loc) {
          const valueStart = templateStart + attr.value.loc.start.offset;
          const valueEnd = templateStart + attr.value.loc.end.offset;
          s.overwrite(valueStart, valueEnd, styleValue);
        } else {
          // 如果没有值，在属性名后添加值
          const attrEnd = templateStart + attr.loc.end.offset;
          s.appendLeft(attrEnd, `=${styleValue}`);
        }
        hasChanges = true;
      } else {
        // 添加新的 style 属性
        const insertPos = templateStart + insertPosition;
        s.appendLeft(insertPos, ` style=${styleValue}`);
        hasChanges = true;
      }
    }

    if (!hasChanges) {
      return {
        success: false,
        error: '没有需要修改的内容',
      };
    }

    const modifiedCode = s.toString();
    const originalLength = sourceCode.length;

    return {
      success: true,
      textStart: 0,
      textEnd: originalLength,
      newText: modifiedCode,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || '解析或修改 Vue 文件时出错',
    };
  }
}
