const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

function walk(dir) {
  let files = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(js|jsx)$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

function replaceAll(content) {
  let updated = content;

  // Convert Alert.alert(title, message) to window.alert with new line.
  updated = updated.replace(/Alert\.alert\(\s*(['\"])([^'\"]+)\1\s*,\s*(['\"])([^'\"]+)\3\s*\)/g, "window.alert('$2\\n$4)");

  // Convert onChange={setX} to event target value.
  updated = updated.replace(/onChange=\{\s*(set[A-Z][A-Za-z0-9_]*)\s*\}/g, 'onChange={(e) => $1(e.target.value)}');

  // Convert onChange={param => ...} patterns.
  updated = updated.replace(/onChange=\{\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*=>\s*([^}]+)\}/g, (match, param, body) => {
    if (/\b${param}\b/.test(body) || body.includes(param)) {
      const newBody = body.replace(new RegExp('\\b' + param + '\\b', 'g'), 'e.target.value');
      return `onChange={(e) => ${newBody}}`;
    }
    return match;
  });

  // Replace style arrays with Object.assign
  updated = updated.replace(/style=\[\s*([^\]]*?)\s*\]/gs, 'style={Object.assign({}, $1)}');

  // Remove invalid React Native props from DOM inputs.
  updated = updated.replace(/\s+secureTextEntry\b(?:=\{[^}]+\})?/g, '');
  updated = updated.replace(/\s+onSubmitEditing=\{[^}]+\}/g, '');
  updated = updated.replace(/\s+autoCapitalize=\{[^}]+\}/g, '');
  updated = updated.replace(/\s+autoCapitalize=\"[^\"]*\"/g, '');
  updated = updated.replace(/\s+keyboardType=\{[^}]+\}/g, '');
  updated = updated.replace(/\s+keyboardType=\"[^\"]*\"/g, '');
  updated = updated.replace(/\s+textAlignVertical:\s*'[^']*'\s*,?/g, '');
  updated = updated.replace(/\s+textAlignVertical:\s*"[^"]*"\s*,?/g, '');
  updated = updated.replace(/\s+horizontal\b/g, '');
  updated = updated.replace(/\s+showsHorizontalScrollIndicator=\{[^}]+\}/g, '');
  updated = updated.replace(/\s+showsVerticalScrollIndicator=\{[^}]+\}/g, '');
  updated = updated.replace(/\s+contentContainerStyle=\{[^}]+\}/g, '');
  updated = updated.replace(/\s+behavior=\{[^}]+\}/g, '');
  updated = updated.replace(/\s+behavior=\"[^\"]*\"/g, '');
  updated = updated.replace(/\s+editable=\{\s*([^}]+)\s*\}/g, (match, expr) => {
    if (expr === '!isSaving') return ' disabled={isSaving}';
    if (expr === '!editingEmp') return ' disabled={editingEmp}';
    return '';
  });

  // Remove unsupported custom tag operations.
  updated = updated.replace(/<\s*barStyle[^>]*>\s*/g, '');
  updated = updated.replace(/<\s*\/\s*barStyle\s*>/g, '');

  // Clean duplicate commas in style objects.
  updated = updated.replace(/,\s*,/g, ',');
  updated = updated.replace(/\{\s*,/g, '{');
  updated = updated.replace(/,\s*\}/g, '}');

  // Remove any remaining inline invalid props from JSX
  updated = updated.replace(/\s+contentContainerStyle=\{[^}]+\}/g, '');

  return updated;
}

const files = walk(root);
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const updated = replaceAll(content);
  if (updated !== content) {
    fs.writeFileSync(file, updated, 'utf8');
    console.log(`updated ${path.relative(root, file)}`);
  }
}
