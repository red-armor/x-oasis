/**
 * 基于 AST 的源码修改工具（前端版本）
 * 支持 JSX/TSX 和 Vue SFC 文件
 */

import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import { JSXOpeningElement, JSXAttribute } from '@babel/types';
import MagicString from 'magic-string';
import { modifyVueSFC } from './vueSfcModifier';

export interface SourcePosition {
  line: number;
  column: number;
}

export interface StyleUpdate {
  className?: string | string[]; // 要添加的 className（字符串或数组）
  style?: Record<string, string>; // 要添加/修改的 style 属性
  content?: string;
}

export interface ModificationResult {
  success: boolean;
  textStart?: number;
  textEnd?: number;
  newText?: string;
  error?: string;
}

/**
 * 获取 JSX 属性值（字符串字面量）
 */
function getStringAttributeValue(attr: JSXAttribute): string | null {
  if (!attr.value) return null;

  if (attr.value.type === 'StringLiteral') {
    return attr.value.value;
  }

  if (attr.value.type === 'JSXExpressionContainer') {
    const expr = attr.value.expression;
    if (expr.type === 'StringLiteral') {
      return expr.value;
    }
  }

  return null;
}

/**
 * 获取或创建 className 属性
 */
function getOrCreateClassNameAttr(
  node: JSXOpeningElement,
  s: MagicString
): {
  attr: JSXAttribute | null;
  existingValue: string | null;
  insertPosition: number;
} {
  const existingAttr = node.attributes.find(
    (attr): attr is JSXAttribute =>
      attr.type === 'JSXAttribute' &&
      (attr.name.name === 'className' || attr.name.name === 'class')
  ) as JSXAttribute | undefined;

  let existingValue: string | null = null;
  if (existingAttr) {
    existingValue = getStringAttributeValue(existingAttr);
  }

  let insertPosition: number;
  if (existingAttr && existingAttr.end != null) {
    insertPosition = existingAttr.end;
  } else {
    insertPosition = node.name.end || node.start || 0;
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
  node: JSXOpeningElement,
  s: MagicString
): {
  attr: JSXAttribute | null;
  existingValue: Record<string, string> | null;
  insertPosition: number;
} {
  const existingAttr = node.attributes.find(
    (attr): attr is JSXAttribute =>
      attr.type === 'JSXAttribute' && attr.name.name === 'style'
  ) as JSXAttribute | undefined;

  let existingValue: Record<string, string> | null = null;
  if (existingAttr && existingAttr.value) {
    if (existingAttr.value.type === 'JSXExpressionContainer') {
      const expr = existingAttr.value.expression;
      if (expr.type === 'ObjectExpression') {
        existingValue = {};
        expr.properties.forEach((prop) => {
          if (
            prop.type === 'ObjectProperty' &&
            prop.key.type === 'Identifier'
          ) {
            const key = prop.key.name;
            let value: string | null = null;

            if (prop.value.type === 'StringLiteral') {
              value = prop.value.value;
            } else if (prop.value.type === 'NumericLiteral') {
              value = String(prop.value.value);
            }

            if (value !== null) {
              existingValue![key] = value;
            }
          }
        });
      }
    }
  }

  let insertPosition: number;
  if (existingAttr && existingAttr.end != null) {
    insertPosition = existingAttr.end;
  } else {
    insertPosition = node.name.end || node.start || 0;
  }

  return {
    attr: existingAttr || null,
    existingValue: existingValue || null,
    insertPosition,
  };
}

/**
 * 根据行号和列号找到对应的 JSX 元素节点
 */
function findJSXElementByPosition(
  ast: any,
  line: number,
  column: number
): NodePath<JSXOpeningElement> | null {
  let targetPath: NodePath<JSXOpeningElement> | null = null;
  let closestDistance = Infinity;

  traverse(ast, {
    JSXOpeningElement(path: NodePath<JSXOpeningElement>) {
      const node = path.node;
      if (!node.loc) return;

      const start = node.loc.start;
      const end = node.loc.end;

      if (
        (start.line < line ||
          (start.line === line && start.column <= column)) &&
        (end.line > line || (end.line === line && end.column >= column))
      ) {
        const distance =
          Math.abs(start.line - line) + Math.abs(start.column - column);
        if (distance < closestDistance) {
          closestDistance = distance;
          targetPath = path;
        }
      }
    },
  });

  return targetPath;
}

/**
 * 修改源码：添加或更新 className/class 和 style
 * 自动检测文件类型（JSX/TSX 或 Vue SFC）
 */
export function modifySourceCode(
  sourceCode: string,
  position: SourcePosition,
  updates: StyleUpdate,
  filePath?: string
): ModificationResult {
  // 检测是否是 Vue 文件
  const isVueFile =
    filePath?.endsWith('.vue') ||
    sourceCode.includes('<template>') ||
    sourceCode.includes('<script setup>');

  if (isVueFile) {
    return modifyVueSFC(sourceCode, position, updates);
  }

  // 否则使用 JSX 解析
  return modifyJSXSourceCode(sourceCode, position, updates);
}

/**
 * 修改 JSX 源码：添加或更新 className 和 style
 */
export function modifyJSXSourceCode(
  sourceCode: string,
  position: SourcePosition,
  updates: StyleUpdate
): ModificationResult {
  try {
    // 解析 AST
    let ast;
    try {
      ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy'],
      });
    } catch (parseError: any) {
      // 检查是否是 Vue 文件导致的解析错误
      if (
        parseError.message &&
        (parseError.message.includes('Unexpected token') ||
          sourceCode.includes('<template>') ||
          sourceCode.includes('<script setup>'))
      ) {
        // 尝试使用 Vue SFC 解析
        return modifyVueSFC(sourceCode, position, updates);
      }
      // 其他解析错误，直接抛出
      throw parseError;
    }

    // 找到对应的 JSX 元素
    const elementPath = findJSXElementByPosition(
      ast,
      position.line,
      position.column
    );
    if (!elementPath) {
      return {
        success: false,
        error: `无法找到位置 (${position.line}:${position.column}) 对应的 JSX 元素`,
      };
    }

    const node = elementPath.node;
    const s = new MagicString(sourceCode);
    let hasChanges = false;

    // 处理 className
    if (updates.className !== undefined) {
      const { attr, existingValue, insertPosition } = getOrCreateClassNameAttr(
        node,
        s
      );
      const classNames = Array.isArray(updates.className)
        ? updates.className
        : [updates.className];
      const existingClasses = existingValue ? existingValue.split(/\s+/) : [];
      const newClasses = [...existingClasses];

      classNames.forEach((cls) => {
        if (cls && !newClasses.includes(cls)) {
          newClasses.push(cls);
        }
      });

      const newClassNameValue = newClasses.filter(Boolean).join(' ');

      if (attr) {
        if (attr.value && attr.value.start != null && attr.value.end != null) {
          s.overwrite(
            attr.value.start,
            attr.value.end,
            `"${newClassNameValue}"`
          );
          hasChanges = true;
        }
      } else {
        s.appendLeft(insertPosition, ` className="${newClassNameValue}"`);
        hasChanges = true;
      }
    }

    // 处理 style
    if (updates.style !== undefined) {
      const { attr, existingValue, insertPosition } = getOrCreateStyleAttr(
        node,
        s
      );
      const mergedStyle = { ...(existingValue || {}), ...updates.style };

      const styleEntries = Object.entries(mergedStyle)
        .map(([key, value]) => {
          const camelKey = key.replace(/-([a-z])/g, (_, letter) =>
            letter.toUpperCase()
          );
          const valueStr = isNaN(Number(value)) ? `"${value}"` : value;
          return `${camelKey}: ${valueStr}`;
        })
        .join(', ');
      const styleValue = `{ ${styleEntries} }`;

      if (attr) {
        if (attr.value && attr.value.start != null && attr.value.end != null) {
          s.overwrite(attr.value.start, attr.value.end, styleValue);
          hasChanges = true;
        }
      } else {
        s.appendLeft(insertPosition, ` style={${styleValue}}`);
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
      error: error.message || '解析或修改源码时出错',
    };
  }
}

/**
 * 简化版：只添加 className
 */
export function addClassNameToJSX(
  sourceCode: string,
  position: SourcePosition,
  className: string
): ModificationResult {
  return modifyJSXSourceCode(sourceCode, position, { className });
}

/**
 * 简化版：只更新 style
 */
export function updateStyleInJSX(
  sourceCode: string,
  position: SourcePosition,
  style: Record<string, string>
): ModificationResult {
  return modifyJSXSourceCode(sourceCode, position, { style });
}
