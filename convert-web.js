const fs = require('fs');
const path = require('path');
const root = __dirname;
const files = [
  'App.js',
  'src/components/AddActivityModal.js',
  'src/components/ConfirmModal.js',
  'src/components/DetailedRosterModal.js',
  'src/components/EmployeeFormModal.js',
  'src/components/EmployeeProfile.js',
  'src/components/ManualAddModal.js',
  'src/components/NotificationLogModal.js',
  'src/components/TaskFormModal.js',
  'src/components/RosterGrid.js',
  'src/components/NotificationPermissionBanner.js',
  'src/screens/AccountManagerScreen.js',
  'src/screens/DashboardScreen.js',
  'src/screens/LoginScreen.js',
  'src/screens/ManagerDataScreen.js',
  'src/screens/SchedulerScreen.js',
  'src/screens/SettingsScreen.js',
  'src/screens/StatsScreen.js',
  'src/screens/TasksScreen.js',
  'src/screens/TeamsScreen.js',
  'src/screens/TrainingScreen.js'
];

const relImport = (fromFile, target) => {
  const folder = path.dirname(fromFile);
  let rel = path.relative(folder, path.join(root, target));
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel.replace(/\\/g, '/');
};

files.forEach((file) => {
  const full = path.join(root, file);
  let content = fs.readFileSync(full, 'utf8');
  const original = content;

  // remove react-native import and expo icon import
  content = content.replace(/import\s+\{[^}]*\}\s+from\s+['\"]react-native['\"];/g, '');
  content = content.replace(/import\s+\{\s*Feather\s*\}\s+from\s+['\"]@expo\/vector-icons['\"];/g, '');

  if (/\bFeather\b/.test(content) || /<Feather\b/.test(content)) {
    const iconPath = relImport(file, './src/components/Icon.js');
    if (!content.includes(`import Icon from '${iconPath}'`)) {
      content = `import Icon from '${iconPath}';\n` + content;
    }
    content = content.replace(/\bFeather\b/g, 'Icon');
  }

  if (/\bModal\b/.test(content) && original.includes("react-native")) {
    const modalPath = relImport(file, './src/components/Modal.js');
    if (!content.includes(`import Modal from '${modalPath}'`)) {
      content = `import Modal from '${modalPath}';\n` + content;
    }
  }

  content = content.replace(/\n{2,}/g, '\n\n');
  content = content.replace(/<SafeAreaView/g, '<div');
  content = content.replace(/<\/SafeAreaView>/g, '</div>');
  content = content.replace(/<KeyboardAvoidingView/g, '<div');
  content = content.replace(/<\/KeyboardAvoidingView>/g, '</div>');
  content = content.replace(/<ScrollView/g, '<div');
  content = content.replace(/<\/ScrollView>/g, '</div>');
  content = content.replace(/<View/g, '<div');
  content = content.replace(/<\/View>/g, '</div>');
  content = content.replace(/<Text\s/g, '<span ');
  content = content.replace(/<Text>/g, '<span>');
  content = content.replace(/<\/Text>/g, '</span>');
  content = content.replace(/<TouchableOpacity/g, '<button');
  content = content.replace(/<\/TouchableOpacity>/g, '</button>');
  content = content.replace(/<Pressable/g, '<button');
  content = content.replace(/<\/Pressable>/g, '</button>');
  content = content.replace(/onPress=/g, 'onClick=');
  content = content.replace(/onChangeText=/g, 'onChange=');
  content = content.replace(/Platform\.OS === 'web'/g, 'true');
  content = content.replace(/Platform\.OS === 'ios' \? 'padding' : 'height'/g, `'height'`);
  content = content.replace(/StatusBar/g, '');
  content = content.replace(/ActivityIndicator/g, 'Spinner');
  content = content.replace(/TextInput/g, 'input');
  content = content.replace(/keyboardType=\{[^}]*\}/g, '');
  content = content.replace(/numberOfLines=\{[^}]*\}/g, '');
  content = content.replace(/textAlignVertical=['\"]top['\"]/g, '');
  content = content.replace(/multiline/g, '');
  content = content.replace(/<button(\s*)([^>]*?)>/g, '<button type="button"$1$2>');
  content = content.replace(/import React, \{([^}]*)\} from 'react';/g, 'import React, {$1} from "react";');

  if (content !== original) {
    fs.writeFileSync(full, content, 'utf8');
    console.log('patched', file);
  }
});
