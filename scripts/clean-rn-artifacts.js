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

function normalizeContent(content) {
  let result = content;
  result = result.replace(/const styles = StyleSheet\.create\(\s*\{/g, 'const styles = {');
  result = result.replace(/StyleSheet\.create\(\s*\{/g, '{');
  result = result.replace(/StyleSheet\.create\(/g, '(');
  result = result.replace(/paddingHorizontal\s*:\s*([^,}]+)(,?)/g, 'paddingLeft: $1,$2 paddingRight: $1,$2');
  result = result.replace(/paddingVertical\s*:\s*([^,}]+)(,?)/g, 'paddingTop: $1,$2 paddingBottom: $1,$2');
  result = result.replace(/marginHorizontal\s*:\s*([^,}]+)(,?)/g, 'marginLeft: $1,$2 marginRight: $1,$2');
  result = result.replace(/marginVertical\s*:\s*([^,}]+)(,?)/g, 'marginTop: $1,$2 marginBottom: $1,$2');
  result = result.replace(/elevation\s*:\s*[^,}]+(,?)/g, 'boxShadow: "0 4px 6px rgba(0,0,0,0.08)"$1');
  result = result.replace(/style=\[\s*([^\]]*?)\s*\]/g, 'style={Object.assign({}, $1)}');
  return result;
}

const files = walk(root);
for (const full of files) {
  const content = fs.readFileSync(full, 'utf8');
  const normalized = normalizeContent(content);
  if (normalized.includes('<Spinner') && !normalized.includes('import Spinner')) {
    const relPath = path.relative(path.dirname(full), path.join(root, 'src', 'components', 'Spinner.js'));
    const rel = relPath.startsWith('..') ? relPath : './' + relPath;
    const replacement = `import Spinner from "${rel.replace(/\\/g, '/')}";\n`;
    const withImport = replacement + normalized;
    if (withImport !== content) {
      fs.writeFileSync(full, withImport, 'utf8');
      console.log(path.relative(root, full));
    }
  } else if (normalized !== content) {
    fs.writeFileSync(full, normalized, 'utf8');
    console.log(path.relative(root, full));
  }
}
