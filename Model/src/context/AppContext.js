import React, { createContext, useState, useEffect } from 'react';
import { DataService } from '../services/DataService';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);

    const [settings, setSettings] = useState({
        teams: ['Kíp A', 'Kíp B', 'Kíp C', 'Kíp D', 'Hành chính'],
        shiftTypes: [
            { code: 'S', label: 'Sáng', startTime: '07:00', endTime: '19:00' },
            { code: 'D', label: 'Đêm', startTime: '19:00', endTime: '07:00' }
        ],
        activityTypes: [
            { id: 'LEAVE', code: 'P', label: 'Nghỉ phép' },
            { id: 'SICK', code: 'O', label: 'Nghỉ ốm' },
            { id: 'TRIP', code: 'CT', label: 'Công tác' },
            { id: 'STUDY', code: 'H', label: 'Đi học' }
        ],
        qualifications: ['Full', 'TWR', 'APP', 'TWR/APP', 'GND', 'Học viên'],
        connectionMode: 'CLOUD'
    });

    const [employees, setEmployees] = useState([]);
    const [activities, setActivities] = useState([]);
    const [requests, setRequests] = useState([]);
    const [scheduleData, setScheduleData] = useState({});
    const [extraAssignments, setExtraAssignments] = useState({});
    const [isPublished, setIsPublished] = useState(false);

    // 🌟 STATE THÔNG BÁO TOÀN CẦU MỚI
    const [notifications, setNotifications] = useState([]);
    const [isNotifOpen, setIsNotifOpen] = useState(false);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const setRes = await DataService.fetchData(settings, "atc_system", "settings");
                if (setRes && setRes.config) setSettings(setRes.config);

                const empRes = await DataService.fetchData(settings, "atc_system", "employees");
                if (empRes && empRes.list) setEmployees(empRes.list);
            } catch (error) {
                console.error("Lỗi tải dữ liệu khởi tạo:", error);
            } finally {
                setIsLoading(false);
            }
        };
        
        loadInitialData();
    }, []);

    // 🌟 HÀM TẠO THÔNG BÁO HOÀN CHỈNH
    const addNotification = (title, message, type = 'info') => {
        const newNotif = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            title: title,
            body: message,
            type: type === 'urgent' || type === 'error' ? 'URGENT_UPDATE' : 'NORMAL',
            createdAt: new Date().toISOString(),
            targetAudiences: ['Toàn hệ thống'] 
        };
        setNotifications(prev => [newNotif, ...prev]);
        console.log(`[NOTIFY - ${type.toUpperCase()}] ${title}: ${message}`);
    };

    const handleUpdateEmployeeId = (oldId, newId) => {
        console.log(`Đồng bộ đổi ID: ${oldId} -> ${newId}`);
    };

    const handleLogout = () => {
        setCurrentUser(null);
    };

    const contextValue = {
        isLoading, setIsLoading,
        currentUser, setCurrentUser, handleLogout,
        settings, setSettings,
        employees, setEmployees, handleUpdateEmployeeId,
        activities, setActivities,
        requests, setRequests,
        scheduleData, setScheduleData,
        extraAssignments, setExtraAssignments,
        isPublished, setIsPublished,
        addNotification,
        notifications, setNotifications, isNotifOpen, setIsNotifOpen // Export thông báo
    };

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};