const fs = require('fs');
const path = require('path');
const outHtml = path.join(__dirname, 'out/index.html');
let content = fs.readFileSync(outHtml, 'utf-8');

// 提取head标签
const headTags = [];
const headTagRegex = /<(link|meta|title)[^>]*>(?:[^<]*<\/title>)?/g;
let match;
while ((match = headTagRegex.exec(content)) !== null) {
  const tag = match[0];
  if (tag.startsWith('<title>')) {
    if (!tag.includes('</title>')) {
      headTags.push('<title>LLM Debugger</title>');
    } else {
      headTags.push(tag);
    }
  } else {
    headTags.push(tag);
  }
}
const uniqueHeadTags = [...new Set(headTags)];

// 提取<body>和</body>之间的内容
const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/);
const bodyContent = bodyMatch ? bodyMatch[1].trim() : '';

const fixed = `<!DOCTYPE html>\n<html>\n  <head>\n    ${uniqueHeadTags.join('\n    ')}\n  </head>\n  <body>\n    ${bodyContent}\n  </body>\n</html>`;

fs.writeFileSync(outHtml, fixed);
console.log('HTML fixed!'); 