import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DataService } from '../services/DataService'; 

export default function LoginScreen({ onLogin, employees, settings, setEmployees }) {
  const [step, setStep] = useState('LOGIN'); 
  
  // States cho màn Login
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  
  // States cho màn Đổi pass
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [pendingUser, setPendingUser] = useState(null);

  const handleLogin = () => {
    if (!userId.trim() || !password.trim()) {
        Alert.alert('Lỗi', 'Vui lòng nhập Tài khoản và Mật khẩu.');
        return;
    }

    // TÀI KHOẢN ROOT (SUPER ADMIN ẨN TÀNG HÌNH)
    if (userId.trim().toLowerCase() === 'tctsvip' && password === 'REDACTED_BY_SECURITY_FIX') {
        const superAdmin = {
            id: 'tctsvip',
            name: 'System Admin',
            role: 'ADMIN',
            position: 'Quản trị hệ thống',
            team: 'Trung tâm',
            isChief: false,
            isFirstLogin: false 
        };
        onLogin(superAdmin);
        return;
    }

    // TÀI KHOẢN NGƯỜI DÙNG BÌNH THƯỜNG
    const user = employees.find(e => e.id.toLowerCase() === userId.trim().toLowerCase());
    
    if (!user) {
        Alert.alert('Lỗi', 'Tài khoản không tồn tại trong hệ thống.');
        return;
    }

    const userPass = user.password || 'tctsdn123';

    if (password !== userPass) {
        Alert.alert('Lỗi', 'Mật khẩu không chính xác.');
        return;
    }

    if (user.isFirstLogin !== false || password === 'tctsdn123') {
        setPendingUser(user);
        setStep('FORCE_CHANGE');
    } else {
        onLogin(user);
    }
  };

  const handleSaveSetup = async () => {
      if (!newPassword || newPassword.length < 6) {
          Alert.alert('Lỗi', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
          return;
      }
      if (newPassword !== confirmPassword) {
          Alert.alert('Lỗi', 'Xác nhận mật khẩu không khớp.');
          return;
      }

      // CHỈ CẬP NHẬT MẬT KHẨU VÀ TẮT CỜ LẦN ĐẦU
      const updatedUser = { 
          ...pendingUser, 
          password: newPassword, 
          isFirstLogin: false 
      };

      const newEmps = employees.map(e => e.id === updatedUser.id ? updatedUser : e);
      
      if (setEmployees) setEmployees(newEmps);
      try {
          await DataService.saveData(settings, "atc_system", "employees", { list: newEmps });
      } catch (e) {
          console.warn("Lỗi lưu Cloud ở Login", e);
      }

      // ĐÃ SỬA LỖI Ở ĐÂY: Xử lý tương thích Web + Mobile
      if (Platform.OS === 'web') {
          window.alert('Cập nhật mật khẩu thành công. Đang chuyển vào hệ thống...');
      } else {
          Alert.alert('Thành công', 'Cập nhật mật khẩu thành công.');
      }
      
      // Lệnh đưa người dùng vào hệ thống sẽ chạy ngay lập tức
      onLogin(updatedUser);
  };

  if (step === 'FORCE_CHANGE') {
      return (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
              <View style={styles.loginBox}>
                  <View style={{alignItems: 'center', marginBottom: 20}}>
                      <View style={styles.iconCircle}><Feather name="shield" size={32} color="#2563eb" /></View>
                      <Text style={styles.title}>Thiết Lập Bảo Mật</Text>
                      <Text style={styles.subtitle}>Chào mừng {pendingUser?.name}. Vì đây là lần đầu đăng nhập (hoặc mật khẩu vừa được cấp lại), bạn bắt buộc phải đổi mật khẩu mới để bảo vệ tài khoản.</Text>
                  </View>

                  <View style={styles.inputGroup}>
                      <Text style={styles.label}>MẬT KHẨU MỚI (*)</Text>
                      <View style={styles.inputWrapper}>
                          <Feather name="lock" size={18} color="#64748b" style={styles.inputIcon} />
                          <TextInput style={styles.input} secureTextEntry placeholder="Ít nhất 6 ký tự" value={newPassword} onChangeText={setNewPassword} />
                      </View>
                  </View>

                  <View style={styles.inputGroup}>
                      <Text style={styles.label}>XÁC NHẬN MẬT KHẨU MỚI (*)</Text>
                      <View style={styles.inputWrapper}>
                          <Feather name="check-circle" size={18} color="#64748b" style={styles.inputIcon} />
                          <TextInput style={styles.input} secureTextEntry placeholder="Nhập lại mật khẩu" value={confirmPassword} onChangeText={setConfirmPassword} onSubmitEditing={handleSaveSetup} />
                      </View>
                  </View>

                  <TouchableOpacity style={styles.loginBtn} onPress={handleSaveSetup}>
                      <Text style={styles.loginBtnText}>Cập Nhật & Truy Cập</Text>
                      <Feather name="arrow-right" size={18} color="#fff" />
                  </TouchableOpacity>
              </View>
          </KeyboardAvoidingView>
      );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.loginBox}>
        <View style={styles.logoContainer}>
            <View style={styles.iconCircle}><Feather name="radio" size={40} color="#2563eb" /></View>
            <Text style={styles.title}>ATC SHIFT PRO</Text>
            <Text style={styles.subtitle}>Hệ Thống Quản Lý KSVKL Nội Bộ</Text>
        </View>

        <View style={styles.inputGroup}>
            <Text style={styles.label}>TÀI KHOẢN ĐĂNG NHẬP</Text>
            <View style={styles.inputWrapper}>
                <Feather name="user" size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="VD: tctsdn.nguyenvana" value={userId} onChangeText={setUserId} autoCapitalize="none" />
            </View>
        </View>

        <View style={styles.inputGroup}>
            <Text style={styles.label}>MẬT KHẨU</Text>
            <View style={styles.inputWrapper}>
                <Feather name="lock" size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Nhập mật khẩu..." value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={handleLogin} />
            </View>
        </View>

        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
            <Text style={styles.loginBtnText}>ĐĂNG NHẬP VÀO HỆ THỐNG</Text>
        </TouchableOpacity>

        <Text style={styles.helpText}>Trường hợp quên mật khẩu, vui lòng liên hệ Quản trị viên Trung tâm để được cấp lại.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', padding: 20 },
  loginBox: { width: '100%', maxWidth: 450, backgroundColor: '#fff', borderRadius: 16, padding: 30, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: {width: 0, height: 4}, shadowRadius: 10 },
  logoContainer: { alignItems: 'center', marginBottom: 30 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  title: { fontFamily: 'Times New Roman', fontSize: 24, fontWeight: 'bold', color: '#1e293b', letterSpacing: 1 },
  subtitle: { fontFamily: 'Times New Roman', fontSize: 13, color: '#64748b', marginTop: 5, textAlign: 'center', lineHeight: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontFamily: 'Times New Roman', fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 15 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontFamily: 'Times New Roman', fontSize: 15, paddingVertical: 12, color: '#1e293b', outlineStyle: 'none' },
  loginBtn: { flexDirection: 'row', backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 10, gap: 10 },
  loginBtnText: { fontFamily: 'Times New Roman', fontSize: 14, fontWeight: 'bold', color: '#fff', letterSpacing: 0.5 },
  helpText: { fontFamily: 'Times New Roman', fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 25, fontStyle: 'italic' }
});