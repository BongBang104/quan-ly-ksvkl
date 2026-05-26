import AsyncStorage from '@react-native-async-storage/async-storage';

export const DataService = {
  // Đọc thông số trực tiếp từ settings truyền vào (không dùng hằng số cố định nữa)
  getMode: (settings) => settings?.connectionMode || 'CLOUD',
  getLocalUrl: (settings) => settings?.localServerUrl || 'http://localhost:5000/api',

  // ==========================================
  // 1. TẢI DỮ LIỆU
  // ==========================================
  fetchData: async (settings, collectionName, documentId) => {
    const mode = DataService.getMode(settings);
    const localBackupKey = `@backup_${collectionName}_${documentId}`;
    
    if (mode === 'CLOUD') {
      try {
        // [MÔ PHỎNG CLOUD/ HOẶC KẾT NỐI FIRESTORE TƯƠNG LAI DỰA TRÊN settings.firebaseConfig]
        const key = `@cloud_${collectionName}_${documentId}`;
        const jsonValue = await AsyncStorage.getItem(key);
        
        await new Promise(resolve => setTimeout(resolve, 300));
        return jsonValue != null ? JSON.parse(jsonValue) : null;
      } catch (error) {
        console.error(`[Mock Cloud] Lỗi tải dữ liệu:`, error);
        return null;
      }
    } else {
      // [SERVER ĐỘNG THEO URL NGƯỜI DÙNG NHẬP]
      const serverUrl = DataService.getLocalUrl(settings);
      try {
        const response = await fetch(`${serverUrl}/get/${collectionName}/${documentId}`, {
            signal: AbortSignal.timeout(5000) 
        });
        
        if (!response.ok) throw new Error('Mất kết nối nội bộ');
        
        const serverData = await response.json();
        await AsyncStorage.setItem(localBackupKey, JSON.stringify(serverData));
        return serverData;

      } catch (error) {
        console.warn(`[Local Server] Mất kết nối tới ${serverUrl}. Chuyển sang Backup...`);
        const backupVal = await AsyncStorage.getItem(localBackupKey);
        if (backupVal) return JSON.parse(backupVal);
        return null;
      }
    }
  },

  // ==========================================
  // 2. LƯU DỮ LIỆU (CÓ CƠ CHẾ CHỐNG LƯU ĐÈ - CONCURRENCY CONTROL)
  // ==========================================
  // Thêm tham số forceOverride (Bỏ qua cảnh báo để lưu đè nếu thật sự cần thiết)
  saveData: async (settings, collectionName, documentId, data, forceOverride = false) => {
    const mode = DataService.getMode(settings);
    const localBackupKey = `@backup_${collectionName}_${documentId}`;

    // --- KIỂM TRA XUNG ĐỘT (CONCURRENCY CHECK) ---
    // Trước khi lưu, ta lấy bản mới nhất trên DB về kiểm tra xem có ai vừa sửa không
    if (!forceOverride && data._lastModified) {
        const currentDbData = await DataService.fetchData(settings, collectionName, documentId);
        if (currentDbData && currentDbData._lastModified && currentDbData._lastModified > data._lastModified) {
            throw new Error("CONFLICT_ERROR: Dữ liệu trên hệ thống đã được người khác cập nhật. Vui lòng tải lại trang (F5) để có dữ liệu mới nhất trước khi thao tác tiếp.");
        }
    }

    // Gắn Dấu ấn thời gian mới cho gói dữ liệu này
    const payload = { ...data, _lastModified: Date.now() };

    if (mode === 'CLOUD') {
      try {
        const key = `@cloud_${collectionName}_${documentId}`;
        const existingVal = await AsyncStorage.getItem(key);
        const parsedExisting = existingVal ? JSON.parse(existingVal) : {};
        const newData = { ...parsedExisting, ...payload };

        await AsyncStorage.setItem(key, JSON.stringify(newData));
        await new Promise(resolve => setTimeout(resolve, 300));
        return true;
      } catch (error) {
        console.error(`[Mock Cloud] Lỗi lưu trữ:`, error);
        throw error;
      }
    } else {
      const serverUrl = DataService.getLocalUrl(settings);
      try {
        const response = await fetch(`${serverUrl}/save/${collectionName}/${documentId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000)
        });
        
        if (!response.ok) throw new Error('Server từ chối kết nối');
        
        const existingBackup = await AsyncStorage.getItem(localBackupKey);
        const parsedBackup = existingBackup ? JSON.parse(existingBackup) : {};
        await AsyncStorage.setItem(localBackupKey, JSON.stringify({ ...parsedBackup, ...payload }));
        return true;

      } catch (error) {
        console.error(`[Local Server Error] Lỗi mạng khi lưu tới ${serverUrl}:`, error);
        
        // Vẫn ráng lưu Local để không mất công
        const existingBackup = await AsyncStorage.getItem(localBackupKey);
        const parsedBackup = existingBackup ? JSON.parse(existingBackup) : {};
        await AsyncStorage.setItem(localBackupKey, JSON.stringify({ ...parsedBackup, ...payload }));
        
        throw new Error('Lưu tạm cục bộ. Sẽ đồng bộ khi máy chủ phản hồi lại.');
      }
    }
  },

  // ==========================================
  // 3. HÀM MIGRATION: ĐỒNG BỘ TOÀN BỘ DỮ LIỆU ĐANG CÓ SANG SERVER MỚI
  // ==========================================
  syncAllDataToNewServer: async (newSettings) => {
      try {
          // Quét lấy toàn bộ dữ liệu đang lưu trong bộ nhớ máy (Backup/Cloud hiện tại)
          const keys = await AsyncStorage.getAllKeys();
          const localDataKeys = keys.filter(k => k.startsWith('@backup_') || k.startsWith('@cloud_'));
          
          for (let key of localDataKeys) {
              const rawData = await AsyncStorage.getItem(key);
              if (rawData) {
                  const parts = key.split('_');
                  if (parts.length >= 4) {
                      const collectionName = parts[1] + '_' + parts[2]; // atc_system
                      const documentId = parts[3]; // employees, tasks, settings...
                      
                      const parsedData = JSON.parse(rawData);
                      
                      // Ép gửi data này tới Server/Cloud MỚI (Dùng newSettings), bỏ qua check xung đột (forceOverride = true)
                      await DataService.saveData(newSettings, collectionName, documentId, parsedData, true);
                  }
              }
          }
          return true;
      } catch (error) {
          console.error("Lỗi đồng bộ dữ liệu:", error);
          throw new Error("Quá trình đẩy dữ liệu sang máy chủ mới bị gián đoạn.");
      }
  }
};