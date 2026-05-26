const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

function walk(dir) {
  let results = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results.push(...walk(full));
    } else if (/\.(js|jsx)$/.test(name)) {
      results.push(full);
    }
  }
  return results;
}

function cleanContent(content) {
  let updated = content;
  updated = updated.replace(/Alert\.alert\(/g, 'window.alert(');
  updated = updated.replace(/,{2,}/g, ',');
  updated = updated.replace(/\s+secureTextEntry\b(?:=\{[^}]+\})?/g, '');
  updated = updated.replace(/\s+onSubmitEditing=\{[^}]+\}/g, '');
  updated = updated.replace(/\s+autoCapitalize=\{[^}]+\}/g, '');
  updated = updated.replace(/\s+autoCapitalize="[^"]*"/g, '');
  updated = updated.replace(/\s+keyboardType=\{[^}]+\}/g, '');
  updated = updated.replace(/\s+keyboardType="[^"]*"/g, '');
  updated = updated.replace(/\s+textAlignVertical:\s*'[^']*'\s*,?/g, '');
  updated = updated.replace(/\s+textAlignVertical:\s*"[^"]*"\s*,?/g, '');
  updated = updated.replace(/\s+horizontal\b/g, '');
  updated = updated.replace(/\s+showsHorizontalScrollIndicator=\{[^}]+\}/g, '');
  updated = updated.replace(/\s+showsVerticalScrollIndicator=\{[^}]+\}/g, '');
  updated = updated.replace(/\s+contentContainerStyle=\{[^}]+\}/g, '');
  updated = updated.replace(/\s+contentContainerStyle=\"[^\"]*\"/g, '');
  updated = updated.replace(/\s+behavior=\{[^}]+\}/g, '');
  updated = updated.replace(/\s+behavior=\"[^\"]*\"/g, '');
  updated = updated.replace(/\s+editable=\{\s*false\s*\}/g, ' disabled={true}');
  updated = updated.replace(/\s+editable=\{\s*true\s*\}/g, '');
  updated = updated.replace(/\s+editable=\{\s*!([^)]+?)\s*\}/g, ' disabled={$1}');
  updated = updated.replace(/\s+editable=\{[^}]+\}/g, '');
  updated = updated.replace(/style=\[\s*([^\]]+?)\s*\]/gs, 'style={Object.assign({}, $1)}');
  updated = updated.replace(/onChange=\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}/g, 'onChange={(e) => $1(e.target.value)}');
  updated = updated.replace(/onChange=\{\s*t\s*=>\s*/g, 'onChange={(e) => ');
  updated = updated.replace(/<\s*barStyle[^>]*>\s*/g, '');
  updated = updated.replace(/<\s*\/\s*barStyle\s*>/g, '');
  return updated;
}

const files = walk(root);
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const updated = cleanContent(content);
  if (updated !== content) {
    fs.writeFileSync(file, updated, 'utf8');
    console.log(`updated ${path.relative(root, file)}`);
  }
}
