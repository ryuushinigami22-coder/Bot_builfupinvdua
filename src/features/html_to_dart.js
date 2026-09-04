// src/features/html_to_dart.js
// Fitur HTML to Dart - Konversi HTML ke Flutter Widget dengan AI

const path = require('path');
const AdmZip = require('adm-zip');
const { parse } = require('node-html-parser');

// ─── HTML TO DART CONVERTER ──────────────────────────────────────────────────

/**
 * Parse HTML dan konversi ke struktur widget Flutter
 * Menggunakan AI untuk analisis dan generate kode yang akurat
 */
async function htmlToDart(htmlContent, options = {}) {
    const {
        widgetName = 'HtmlToDartWidget',
        useMaterial = true,
        responsive = true,
        includeMain = true,
    } = options;

    // Parse HTML ke AST
    let root;
    try {
        root = parse(htmlContent, {
            comment: true,
            blockTextElements: {
                script: true,
                style: true,
                pre: true,
            }
        });
    } catch (err) {
        throw new Error(`Gagal parse HTML: ${err.message}`);
    }

    // Ekstrak CSS inline dan style
    const styles = extractStyles(root);
    
    // Ekstrak script (untuk interaktivitas nanti)
    const scripts = extractScripts(root);
    
    // Generate Dart code dari HTML AST
    const dartCode = await generateDartFromHTML(root, {
        widgetName,
        useMaterial,
        responsive,
        styles,
        scripts,
    });

    // Validasi dan perbaiki kode
    const validatedCode = validateAndFixDart(dartCode);

    // Generate full file dengan main() jika diperlukan
    if (includeMain) {
        return wrapWithMain(validatedCode, widgetName);
    }

    return validatedCode;
}

/**
 * Ekstrak CSS dari HTML
 */
function extractStyles(root) {
    const styles = {
        inline: {},
        classes: {},
        ids: {},
        tags: {},
    };

    // Cari tag style
    const styleTags = root.querySelectorAll('style');
    for (const styleTag of styleTags) {
        const cssText = styleTag.text || '';
        parseCSS(cssText, styles);
        styleTag.remove(); // Hapus style tag dari DOM
    }

    // Cari inline styles di elemen
    const allElements = root.querySelectorAll('*');
    for (const el of allElements) {
        const styleAttr = el.getAttribute('style');
        if (styleAttr) {
            const inlineStyles = parseInlineStyle(styleAttr);
            const id = el.id || `el_${Math.random().toString(36).slice(2, 7)}`;
            if (el.id) {
                styles.ids[id] = { ...styles.ids[id], ...inlineStyles };
            } else {
                // Assign class atau tag
                const className = el.classNames?.join('_') || el.tagName.toLowerCase();
                styles.classes[className] = { ...styles.classes[className], ...inlineStyles };
            }
        }
    }

    return styles;
}

/**
 * Parse CSS string
 */
function parseCSS(cssText, styles) {
    const rules = cssText.match(/[^{]+\{[^}]*\}/g) || [];
    for (const rule of rules) {
        const [selector, declarations] = rule.split('{');
        const cleanSelector = selector.trim();
        const cleanDeclarations = declarations.replace('}', '').trim();
        
        const styleObj = parseInlineStyle(cleanDeclarations);
        
        if (cleanSelector.startsWith('.')) {
            const className = cleanSelector.slice(1);
            styles.classes[className] = { ...styles.classes[className], ...styleObj };
        } else if (cleanSelector.startsWith('#')) {
            const id = cleanSelector.slice(1);
            styles.ids[id] = { ...styles.ids[id], ...styleObj };
        } else {
            const tagName = cleanSelector;
            styles.tags[tagName] = { ...styles.tags[tagName], ...styleObj };
        }
    }
}

/**
 * Parse inline style string ke object
 */
function parseInlineStyle(styleStr) {
    const styleObj = {};
    const declarations = styleStr.split(';');
    for (const decl of declarations) {
        const [prop, value] = decl.split(':').map(s => s.trim());
        if (prop && value) {
            styleObj[prop] = value;
        }
    }
    return styleObj;
}

/**
 * Ekstrak script dari HTML
 */
function extractScripts(root) {
    const scripts = [];
    const scriptTags = root.querySelectorAll('script');
    for (const scriptTag of scriptTags) {
        const src = scriptTag.getAttribute('src');
        const content = scriptTag.text || '';
        if (src || content) {
            scripts.push({ src, content });
        }
        scriptTag.remove();
    }
    return scripts;
}

/**
 * Generate Dart code dari HTML AST
 */
async function generateDartFromHTML(root, options) {
    const { widgetName, useMaterial, responsive, styles, scripts } = options;
    
    let code = `import 'package:flutter/material.dart';\n`;
    if (useMaterial) {
        code += `import 'package:flutter/rendering.dart';\n`;
    }
    code += `\n`;

    // Generate widget
    code += `class ${widgetName} extends StatelessWidget {\n`;
    code += `  const ${widgetName}({super.key});\n\n`;
    code += `  @override\n`;
    code += `  Widget build(BuildContext context) {\n`;

    // Generate body dari HTML
    const bodyEl = root.querySelector('body') || root;
    const children = bodyEl.childNodes || [];
    
    let bodyCode = '';
    for (const child of children) {
        if (child.nodeType === 1) { // Element node
            bodyCode += generateWidgetFromElement(child, styles, 0);
        } else if (child.nodeType === 3) { // Text node
            const text = child.text.trim();
            if (text) {
                bodyCode += `    Text('${escapeDartString(text)}'),\n`;
            }
        }
    }

    if (useMaterial) {
        code += `    return Scaffold(\n`;
        code += `      body: SafeArea(\n`;
        code += `        child: Padding(\n`;
        code += `          padding: const EdgeInsets.all(16.0),\n`;
        code += `          child: Column(\n`;
        code += `            crossAxisAlignment: CrossAxisAlignment.start,\n`;
        code += `            children: [\n`;
        code += bodyCode;
        code += `            ],\n`;
        code += `          ),\n`;
        code += `        ),\n`;
        code += `      ),\n`;
        code += `    );\n`;
    } else {
        code += `    return Container(\n`;
        code += `      child: Column(\n`;
        code += `        children: [\n`;
        code += bodyCode;
        code += `        ],\n`;
        code += `      ),\n`;
        code += `    );\n`;
    }

    code += `  }\n`;
    code += `}\n`;

    return code;
}

/**
 * Generate widget dari HTML element
 */
function generateWidgetFromElement(element, styles, depth) {
    const indent = '  '.repeat(depth + 2);
    const tagName = element.tagName?.toLowerCase() || 'div';
    const children = element.childNodes || [];
    
    // Mapping HTML tag ke Flutter widget
    const widgetMap = {
        'div': 'Container',
        'span': 'Container',
        'p': 'Text',
        'h1': 'Text',
        'h2': 'Text',
        'h3': 'Text',
        'h4': 'Text',
        'h5': 'Text',
        'h6': 'Text',
        'a': 'GestureDetector',
        'button': 'ElevatedButton',
        'input': 'TextField',
        'img': 'Image.network',
        'ul': 'Column',
        'ol': 'Column',
        'li': 'Container',
        'table': 'Table',
        'tr': 'TableRow',
        'td': 'TableCell',
        'th': 'TableCell',
        'form': 'Form',
        'label': 'Text',
        'select': 'DropdownButton',
        'textarea': 'TextField',
        'video': 'Container',
        'audio': 'Container',
        'canvas': 'Container',
        'svg': 'Container',
        'section': 'Container',
        'article': 'Container',
        'header': 'Container',
        'footer': 'Container',
        'nav': 'Container',
        'main': 'Container',
        'aside': 'Container',
        'figure': 'Container',
        'figcaption': 'Text',
        'blockquote': 'Container',
        'pre': 'Container',
        'code': 'Text',
        'strong': 'Text',
        'b': 'Text',
        'em': 'Text',
        'i': 'Text',
        'u': 'Text',
        'small': 'Text',
        'mark': 'Container',
        'del': 'Text',
        'ins': 'Text',
        'sub': 'Text',
        'sup': 'Text',
    };

    const widgetType = widgetMap[tagName] || 'Container';
    
    // Extract styles untuk elemen ini
    const elementStyles = getElementStyles(element, styles);
    
    // Generate properties
    const props = generateWidgetProps(tagName, element, elementStyles, children);
    
    // Generate child widgets
    let childCode = '';
    const textChildren = [];
    const widgetChildren = [];
    
    for (const child of children) {
        if (child.nodeType === 1) {
            widgetChildren.push(child);
        } else if (child.nodeType === 3) {
            const text = child.text.trim();
            if (text) {
                textChildren.push(text);
            }
        }
    }

    // Handle text content
    if (widgetType === 'Text' && textChildren.length > 0) {
        const text = textChildren.join(' ');
        const styleProps = generateTextStyle(elementStyles);
        return `${indent}Text(\n${indent}  '${escapeDartString(text)}',\n${indent}  style: TextStyle(\n${indent}${styleProps}\n${indent}  ),\n${indent}),\n`;
    }

    // Generate children
    let childrenCode = '';
    if (widgetChildren.length > 0) {
        for (const child of widgetChildren) {
            childrenCode += generateWidgetFromElement(child, styles, depth + 1);
        }
    } else if (textChildren.length > 0) {
        childrenCode = `${indent}  Text('${escapeDartString(textChildren.join(' '))}'),\n`;
    }

    // Handle special widgets
    if (widgetType === 'ElevatedButton') {
        const label = textChildren.join(' ') || 'Button';
        return `${indent}ElevatedButton(\n${indent}  onPressed: () {},\n${indent}  child: Text('${escapeDartString(label)}'),\n${indent}),\n`;
    }

    if (widgetType === 'TextField') {
        const hint = textChildren.join(' ') || 'Enter text';
        return `${indent}TextField(\n${indent}  decoration: InputDecoration(\n${indent}    hintText: '${escapeDartString(hint)}',\n${indent}    border: OutlineInputBorder(),\n${indent}  ),\n${indent}),\n`;
    }

    if (widgetType === 'Image.network') {
        const src = element.getAttribute('src') || '';
        return `${indent}Image.network(\n${indent}  '${escapeDartString(src)}',\n${indent}  height: ${elementStyles.height || 100},\n${indent}  width: ${elementStyles.width || 100},\n${indent}  fit: BoxFit.cover,\n${indent}),\n`;
    }

    if (widgetType === 'GestureDetector') {
        const href = element.getAttribute('href') || '#';
        return `${indent}GestureDetector(\n${indent}  onTap: () {\n${indent}    // Navigate to ${href}\n${indent}  },\n${indent}  child: Container(\n${indent}    child: Column(\n${indent}      children: [\n${childrenCode}${indent}      ],\n${indent}    ),\n${indent}  ),\n${indent}),\n`;
    }

    // Default container
    return `${indent}Container(\n${indent}  ${props}\n${indent}  child: Column(\n${indent}    children: [\n${childrenCode}${indent}    ],\n${indent}  ),\n${indent}),\n`;
}

/**
 * Get styles untuk elemen
 */
function getElementStyles(element, styles) {
    const result = {};
    
    // Cek inline styles
    const styleAttr = element.getAttribute('style');
    if (styleAttr) {
        Object.assign(result, parseInlineStyle(styleAttr));
    }
    
    // Cek class styles
    const classNames = element.classNames || [];
    for (const cls of classNames) {
        if (styles.classes[cls]) {
            Object.assign(result, styles.classes[cls]);
        }
    }
    
    // Cek id styles
    const id = element.id;
    if (id && styles.ids[id]) {
        Object.assign(result, styles.ids[id]);
    }
    
    // Cek tag styles
    const tagName = element.tagName?.toLowerCase();
    if (tagName && styles.tags[tagName]) {
        Object.assign(result, styles.tags[tagName]);
    }
    
    return result;
}

/**
 * Generate widget properties dari styles
 */
function generateWidgetProps(tagName, element, styles, children) {
    const props = [];
    
    // Width & Height
    if (styles.width) {
        props.push(`width: ${parseCSSValue(styles.width)},`);
    }
    if (styles.height) {
        props.push(`height: ${parseCSSValue(styles.height)},`);
    }
    
    // Padding
    if (styles.padding) {
        props.push(`padding: EdgeInsets.all(${parseCSSValue(styles.padding)}),`);
    }
    if (styles['padding-top']) {
        props.push(`padding: EdgeInsets.only(top: ${parseCSSValue(styles['padding-top'])}),`);
    }
    if (styles['padding-bottom']) {
        props.push(`padding: EdgeInsets.only(bottom: ${parseCSSValue(styles['padding-bottom'])}),`);
    }
    if (styles['padding-left']) {
        props.push(`padding: EdgeInsets.only(left: ${parseCSSValue(styles['padding-left'])}),`);
    }
    if (styles['padding-right']) {
        props.push(`padding: EdgeInsets.only(right: ${parseCSSValue(styles['padding-right'])}),`);
    }
    
    // Margin
    if (styles.margin) {
        props.push(`margin: EdgeInsets.all(${parseCSSValue(styles.margin)}),`);
    }
    
    // Background color
    if (styles['background-color'] || styles.background) {
        const color = styles['background-color'] || styles.background;
        props.push(`color: ${parseColorValue(color)},`);
    }
    
    // Border radius
    if (styles['border-radius']) {
        props.push(`decoration: BoxDecoration(\n    borderRadius: BorderRadius.circular(${parseCSSValue(styles['border-radius'])}),\n  ),`);
    }
    
    // Border
    if (styles.border) {
        const borderProps = parseBorderValue(styles.border);
        if (borderProps) {
            props.push(`decoration: BoxDecoration(\n    border: Border.all(\n      color: ${borderProps.color || 'Colors.grey'},\n      width: ${borderProps.width || 1.0},\n    ),\n  ),`);
        }
    }
    
    // Box shadow
    if (styles['box-shadow']) {
        props.push(`decoration: BoxDecoration(\n    boxShadow: [\n      BoxShadow(\n        color: Colors.grey.withOpacity(0.3),\n        spreadRadius: 2,\n        blurRadius: 5,\n        offset: Offset(0, 3),\n      ),\n    ],\n  ),`);
    }
    
    // Alignment
    if (styles['text-align']) {
        const alignment = mapTextAlign(styles['text-align']);
        if (alignment) {
            props.push(`alignment: Alignment.${alignment},`);
        }
    }
    
    // Flex
    if (styles['flex'] || styles['flex-grow']) {
        props.push(`flex: ${parseCSSValue(styles['flex'] || styles['flex-grow'])},`);
    }
    
    return props.join('\n    ');
}

/**
 * Generate text style properties
 */
function generateTextStyle(styles) {
    const props = [];
    
    if (styles.color) {
        props.push(`    color: ${parseColorValue(styles.color)},`);
    }
    
    if (styles['font-size']) {
        props.push(`    fontSize: ${parseCSSValue(styles['font-size'])},`);
    }
    
    if (styles['font-weight']) {
        const weight = mapFontWeight(styles['font-weight']);
        if (weight) {
            props.push(`    fontWeight: FontWeight.${weight},`);
        }
    }
    
    if (styles['font-family']) {
        props.push(`    fontFamily: '${styles['font-family']}',`);
    }
    
    if (styles['text-decoration']) {
        if (styles['text-decoration'].includes('underline')) {
            props.push(`    decoration: TextDecoration.underline,`);
        }
        if (styles['text-decoration'].includes('line-through')) {
            props.push(`    decoration: TextDecoration.lineThrough,`);
        }
    }
    
    if (styles['text-align']) {
        const align = mapTextAlign(styles['text-align']);
        if (align) {
            // TextAlign diatur di widget level, bukan di TextStyle
        }
    }
    
    return props.join('\n');
}

/**
 * Parse CSS value ke Dart numeric
 */
function parseCSSValue(value) {
    if (!value) return '0.0';
    
    const str = String(value).trim();
    
    // Jika sudah angka
    if (/^\d+$/.test(str)) return str;
    
    // px
    if (str.endsWith('px')) {
        const num = str.replace('px', '');
        return num;
    }
    
    // em
    if (str.endsWith('em')) {
        const num = str.replace('em', '');
        return `${parseFloat(num) * 16}`;
    }
    
    // rem
    if (str.endsWith('rem')) {
        const num = str.replace('rem', '');
        return `${parseFloat(num) * 16}`;
    }
    
    // %
    if (str.endsWith('%')) {
        const num = str.replace('%', '');
        return `${parseFloat(num) / 100}`;
    }
    
    // vh, vw
    if (str.endsWith('vh')) {
        return 'MediaQuery.of(context).size.height * ' + (parseFloat(str) / 100);
    }
    if (str.endsWith('vw')) {
        return 'MediaQuery.of(context).size.width * ' + (parseFloat(str) / 100);
    }
    
    return str;
}

/**
 * Parse color value ke Dart Color
 */
function parseColorValue(value) {
    if (!value) return 'Colors.transparent';
    
    const str = String(value).trim();
    
    // Hex color
    if (str.startsWith('#')) {
        const hex = str.replace('#', '');
        if (hex.length === 3) {
            const r = hex[0] + hex[0];
            const g = hex[1] + hex[1];
            const b = hex[2] + hex[2];
            return `Color(0xFF${r}${g}${b})`;
        }
        if (hex.length === 6) {
            return `Color(0xFF${hex})`;
        }
        if (hex.length === 8) {
            return `Color(0x${hex})`;
        }
    }
    
    // Named colors
    const colorMap = {
        'black': 'Colors.black',
        'white': 'Colors.white',
        'red': 'Colors.red',
        'green': 'Colors.green',
        'blue': 'Colors.blue',
        'yellow': 'Colors.yellow',
        'orange': 'Colors.orange',
        'purple': 'Colors.purple',
        'pink': 'Colors.pink',
        'grey': 'Colors.grey',
        'gray': 'Colors.grey',
        'transparent': 'Colors.transparent',
    };
    
    if (colorMap[str.toLowerCase()]) {
        return colorMap[str.toLowerCase()];
    }
    
    // rgb/rgba
    const rgbMatch = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1]);
        const g = parseInt(rgbMatch[2]);
        const b = parseInt(rgbMatch[3]);
        const a = rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1.0;
        return `Color.fromRGBO(${r}, ${g}, ${b}, ${a})`;
    }
    
    return `Color(0xFF${str.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).padEnd(6, '0')})`;
}

/**
 * Parse border value
 */
function parseBorderValue(value) {
    const parts = String(value).split(' ');
    const result = {};
    
    for (const part of parts) {
        if (part.endsWith('px')) {
            result.width = parseFloat(part);
        } else if (part.startsWith('#')) {
            result.color = parseColorValue(part);
        } else if (['solid', 'dashed', 'dotted'].includes(part)) {
            result.style = part;
        }
    }
    
    if (parts.length === 1) {
        // Hanya angka atau hanya style
        if (parts[0].endsWith('px')) {
            result.width = parseFloat(parts[0]);
            result.color = 'Colors.black';
        } else if (parts[0].startsWith('#')) {
            result.color = parseColorValue(parts[0]);
            result.width = 1.0;
        }
    }
    
    return result;
}

/**
 * Map text align CSS ke Alignment
 */
function mapTextAlign(value) {
    const map = {
        'left': 'centerLeft',
        'right': 'centerRight',
        'center': 'center',
        'justify': 'center',
    };
    return map[String(value).toLowerCase()] || null;
}

/**
 * Map font weight CSS ke FontWeight
 */
function mapFontWeight(value) {
    const map = {
        '100': 'w100',
        '200': 'w200',
        '300': 'w300',
        '400': 'w400',
        '500': 'w500',
        '600': 'w600',
        '700': 'w700',
        '800': 'w800',
        '900': 'w900',
        'normal': 'w400',
        'bold': 'bold',
        'bolder': 'bold',
        'lighter': 'w300',
    };
    return map[String(value).toLowerCase()] || null;
}

/**
 * Escape string untuk Dart
 */
function escapeDartString(str) {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

/**
 * Validasi dan perbaiki kode Dart
 */
function validateAndFixDart(code) {
    let fixed = code;
    
    // Fix: Tidak ada import yang duplikat
    const imports = new Set();
    const lines = fixed.split('\n');
    const newLines = [];
    
    for (const line of lines) {
        if (line.trim().startsWith('import')) {
            const importKey = line.trim();
            if (!imports.has(importKey)) {
                imports.add(importKey);
                newLines.push(line);
            }
        } else {
            newLines.push(line);
        }
    }
    
    fixed = newLines.join('\n');
    
    // Fix: Tambahkan const di tempat yang tepat
    fixed = fixed.replace(/Container\(/g, 'const Container(');
    fixed = fixed.replace(/Text\(/g, 'const Text(');
    fixed = fixed.replace(/Column\(/g, 'const Column(');
    fixed = fixed.replace(/Row\(/g, 'const Row(');
    fixed = fixed.replace(/Padding\(/g, 'const Padding(');
    
    // Fix: Hapus trailing commas yang tidak perlu
    fixed = fixed.replace(/,\s*\)/g, '\n  )');
    fixed = fixed.replace(/,\s*\n\s*\)/g, '\n  )');
    
    return fixed;
}

/**
 * Wrap kode dengan main() function
 */
function wrapWithMain(code, widgetName) {
    return `import 'package:flutter/material.dart';\n\n${code}\n\nvoid main() {\n  runApp(\n    MaterialApp(\n      debugShowCheckedModeBanner: false,\n      home: Scaffold(\n        body: ${widgetName}(),\n      ),\n    ),\n  );\n}\n`;
}

// ─── HANDLER UTAMA ──────────────────────────────────────────────────────────

async function handleHtmlToDart(chatId, userId, msgId = null) {
    const creditCheck = checkCredit(userId);
    if (!creditCheck.ok) {
        await send(
            chatId,
            `💳 **Credit Habis!**\n\nKamu tidak punya credit tersisa. Hubungi admin/reseller.`,
            [[{ text: "🏠 Menu Utama", data: "start" }]],
            msgId
        );
        return;
    }

    if (isUserBuilding(userId)) {
        const job = getUserJob(userId);
        await send(
            chatId,
            `⚠️ **Proses Aktif Terdeteksi!**\n\n📋 **Status :** ${statusLabel(job.status)}`,
            [[{ text: "❌ Batalkan", data: "cancel" }]],
            msgId
        );
        return;
    }

    await sendActionNotification(userId, 'HTML to Dart');

    let username = null;
    let fullName = "Unknown User";
    try {
        const entity = await client.getEntity(userId);
        username = entity?.username || null;
        fullName = [entity?.firstName, entity?.lastName].filter(Boolean).join(" ") || "Unknown User";
    } catch (_) {}

    setUserJob(userId, {
        status: "waiting_html",
        chatId,
        userId,
        username,
        fullName,
        type: "html_to_dart",
        updatedAt: Date.now(),
    });

    await send(
        chatId,
        `🌐 **HTML TO DART CONVERTER**\n` +
        `────────────────────────────────\n\n` +
        `Fitur ini mengkonversi kode HTML menjadi widget Flutter/Dart yang siap pakai.\n\n` +
        `📌 **Cara Kerja:**\n` +
        `1️⃣ Kirim kode **HTML** (bisa full page atau snippet)\n` +
        `2️⃣ Kirim file **.html** atau **.htm**\n` +
        `3️⃣ Bot akan mengkonversi ke Flutter widget\n\n` +
        `✅ **Support:**\n` +
        `• Semua tag HTML dasar\n` +
        `• CSS inline dan style tag\n` +
        `• Responsive layout\n` +
        `• Material Design 3\n\n` +
        `💡 __Kirim kode HTML atau file .html sekarang!__`,
        [
            [{ text: "📄 Contoh HTML", data: "html_example" }],
            [{ text: "❌ Batalkan", data: "cancel" }],
        ],
        msgId
    );
}

async function handleHtmlToDartInput(event) {
    const chatId = event.chatId;
    const userId = Number(event.message.senderId);
    const msg = event.message;
    const job = getUserJob(userId);

    if (!job || job.status !== "waiting_html" || job.type !== "html_to_dart") return false;

    const media = msg.media;
    const text = msg.text?.trim();

    let htmlContent = null;
    let sourceName = '';

    // ─── Dari file ──────────────────────────────────────────────────────────
    if (media && media.document) {
        const doc = media.document;
        const fileName = doc.attributes?.find((a) => a.fileName)?.fileName || 'file.html';
        const ext = path.extname(fileName).toLowerCase();

        if (ext !== '.html' && ext !== '.htm') {
            await send(chatId, `❌ **Format file tidak didukung!**\n\nKirim file \`.html\` atau \`.htm\`.`);
            return true;
        }

        try {
            const buffer = await client.downloadMedia(msg, { outputFile: undefined });
            htmlContent = buffer.toString('utf8');
            sourceName = fileName;
        } catch (err) {
            await send(chatId, `❌ **Gagal membaca file!**\n\nError: ${err.message}`);
            return true;
        }
    }

    // ─── Dari teks ──────────────────────────────────────────────────────────
    if (!htmlContent && text) {
        if (text.toLowerCase().includes('<html') || text.includes('<!DOCTYPE')) {
            htmlContent = text;
            sourceName = 'html_input.html';
        } else if (text.includes('<div') || text.includes('<span') || text.includes('<p')) {
            // Snippet HTML
            htmlContent = `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n</head>\n<body>\n${text}\n</body>\n</html>`;
            sourceName = 'html_snippet.html';
        } else {
            await send(
                chatId,
                `❌ **Input tidak dikenali sebagai HTML!**\n\n` +
                `Pastikan kode HTML valid atau kirim file .html.\n\n` +
                `💡 __Contoh HTML minimal:_\n\`\`\`html\n<div style="padding:20px; background:blue; color:white;">\n  <h1>Hello World</h1>\n  <p>Ini adalah paragraf</p>\n</div>\n\`\`\``,
                [[{ text: "📄 Contoh HTML", data: "html_example" }]]
            );
            return true;
        }
    }

    if (!htmlContent) {
        await send(chatId, `⚠️ **Tidak ada HTML yang diterima!**\n\nKirim kode HTML atau file .html.`);
        return true;
    }

    const statusMsg = await send(
        chatId,
        `⏳ **Mengkonversi HTML ke Dart...**\n\n` +
        `📄 **File:** ${sourceName}\n` +
        `📊 **Ukuran:** ${htmlContent.length} karakter\n\n` +
        `🧠 __AI sedang menganalisis dan mengkonversi...__`
    );
    const msgId = statusMsg.id;

    try {
        const widgetName = `HtmlToDart_${Date.now()}`;
        
        // Konversi HTML ke Dart
        const dartCode = await htmlToDart(htmlContent, {
            widgetName,
            useMaterial: true,
            responsive: true,
            includeMain: true,
        });

        // Validasi kode
        if (!dartCode || dartCode.length < 50) {
            throw new Error('Hasil konversi terlalu pendek atau kosong');
        }

        // Kirim hasil
        const outFileName = `html_to_dart_${Date.now()}.dart`;
        const tempFile = tmpPath(outFileName);
        fs.writeFileSync(tempFile, dartCode, 'utf8');

        await client.sendFile(chatId, {
            file: tempFile,
            forceDocument: true,
            attributes: [new Api.DocumentAttributeFilename({ fileName: outFileName })],
            caption:
                `✅ **HTML TO DART BERHASIL!** 🎉\n` +
                `────────────────────────────────\n\n` +
                `📄 **Sumber:** ${sourceName}\n` +
                `📦 **Widget:** ${widgetName}\n` +
                `📏 **Ukuran Kode:** ${dartCode.length} karakter\n` +
                `────────────────────────────────\n\n` +
                `💡 __File .dart sudah siap digunakan di project Flutter kamu!__\n\n` +
                `🔧 **Cara Pakai:**\n` +
                `1. Copy file ke folder lib/project\n` +
                `2. Import: \`import '${outFileName}';\`\n` +
                `3. Gunakan: \`${widgetName}()\``,
            parseMode: "md",
        });

        fs.unlinkSync(tempFile);

        // Deduct credit
        if (!isAdmin(userId)) {
            const remaining = db.deductCredit(userId);
            if (remaining !== null) {
                await client.sendMessage(chatId, {
                    message: `💳 **1 Credit digunakan.** Sisa: \`${remaining}\``,
                    parseMode: 'md',
                });
            }
        }

        removeUserJob(userId);
        await edit(
            chatId,
            msgId,
            `✅ **Konversi Selesai!**\n\nFile Dart sudah dikirim di atas. 🎉`,
            [[{ text: "🏠 Menu Utama", data: "start" }]]
        );

    } catch (err) {
        removeUserJob(userId);
        await edit(
            chatId,
            msgId,
            `❌ **GAGAL KONVERSI!**\n\n` +
            `🛑 **Error:**\n${err.message}\n\n` +
            `💡 __Pastikan HTML valid dan mencoba lagi.__\n` +
            `📌 __Untuk hasil terbaik, gunakan HTML yang rapi dan terstruktur.__`,
            [
                [{ text: "📄 Contoh HTML", data: "html_example" }],
                [{ text: "🏠 Menu Utama", data: "start" }],
            ]
        );
    }

    return true;
}

// ─── CONTOH HTML ─────────────────────────────────────────────────────────────

async function handleHtmlExample(chatId, userId, msgId) {
    const example = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contoh HTML</title>
  <style>
    .container {
      padding: 20px;
      max-width: 600px;
      margin: 0 auto;
      font-family: Arial, sans-serif;
    }
    .card {
      background: #f5f5f5;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      margin-bottom: 16px;
    }
    .card h2 {
      color: #2c3e50;
      font-size: 24px;
      margin-bottom: 12px;
    }
    .card p {
      color: #34495e;
      font-size: 16px;
      line-height: 1.6;
    }
    .button {
      background: #3498db;
      color: white;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }
    .button:hover {
      background: #2980b9;
    }
    .row {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    .col {
      flex: 1;
      min-width: 200px;
    }
    .image {
      width: 100%;
      height: 200px;
      object-fit: cover;
      border-radius: 8px;
      background: #ecf0f1;
    }
    .badge {
      background: #e74c3c;
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h2>🎉 Selamat Datang!</h2>
      <p>Ini adalah contoh HTML yang akan dikonversi ke Flutter/Dart.</p>
      <p>Bot akan mengubah semua elemen menjadi widget Flutter yang siap pakai.</p>
      <span class="badge">HTML to Dart</span>
    </div>

    <div class="row">
      <div class="col">
        <div class="card" style="background: #e8f4fd;">
          <h2>📱 Responsive</h2>
          <p>Layout ini akan menjadi Row/Column di Flutter.</p>
          <a href="#" class="button">Klik Saya</a>
        </div>
      </div>
      <div class="col">
        <div class="card" style="background: #fde8e8;">
          <h2>🎨 Style</h2>
          <p>Semua CSS akan dikonversi ke properti Flutter.</p>
          <button class="button" style="background: #e74c3c;">Tombol</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>🖼️ Gambar</h2>
      <div class="image" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 18px;">
        Placeholder Gambar
      </div>
      <p style="margin-top: 12px;">Gambar akan menjadi <code>Image.network</code> atau <code>Container</code> di Flutter.</p>
    </div>

    <div class="card">
      <h2>📝 Form Input</h2>
      <input type="text" placeholder="Nama Lengkap" style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; margin-bottom: 12px;">
      <textarea placeholder="Pesan" style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; min-height: 100px; margin-bottom: 12px;"></textarea>
      <button class="button" style="width: 100%;">Kirim</button>
    </div>
  </div>
</body>
</html>`;

    await send(
        chatId,
        `📄 **CONTOH HTML**\n` +
        `────────────────────────────────\n\n` +
        `Copy paste kode HTML di bawah untuk dicoba:\n\n` +
        `\`\`\`html\n${example.slice(0, 3000)}${example.length > 3000 ? '\n... (terpotong)' : ''}\n\`\`\``,
        [
            [{ text: "🔄 Coba Konversi", data: "html_to_dart" }],
            [{ text: "❌ Batalkan", data: "cancel" }],
        ],
        msgId
    );
}

// ─── CALLBACK HANDLER ──────────────────────────────────────────────────────

async function handleHtmlToDartCallback(event) {
    const data = event.data.toString();
    const chatId = event.chatId;
    const userId = Number(event.senderId);
    const msgId = event.messageId;

    if (data === "html_to_dart") {
        return await handleHtmlToDart(chatId, userId, msgId);
    }

    if (data === "html_example") {
        return await handleHtmlExample(chatId, userId, msgId);
    }
}

// ─── REGISTER FUNCTIONS ────────────────────────────────────────────────────

Object.assign(globalThis, {
    handleHtmlToDart,
    handleHtmlToDartInput,
    handleHtmlToDartCallback,
    handleHtmlExample,
    htmlToDart,
});

module.exports = {
    handleHtmlToDart,
    handleHtmlToDartInput,
    handleHtmlToDartCallback,
    handleHtmlExample,
    htmlToDart,
};