// src/utils/helpers.js

export const toYMD = (d) => {
    if (!d) return '';
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(dateObj.getTime())) return '';
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
};

export const toStorageKeyDate = (d) => {
    if (!d) return '';
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    return `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;
};

export const formatDateDisplay = (dateStr) => {
    if(!dateStr) return '';
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) ? `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}` : '';
};

export const isDateInRange = (checkDate, startDateStr, endDateStr) => {
    const checkYMD = toYMD(checkDate);
    return checkYMD >= startDateStr && checkYMD <= endDateStr;
};

export const getShortRoleName = (role) => {
    if (!role) return '';
    const lower = role.toLowerCase();
    if (lower.includes('quản lý') || lower.includes('trưởng')) return 'QL';
    if (lower.includes('ksv') || lower.includes('nhân viên')) return 'KSV';
    if (lower.includes('on-call') || lower.includes('dự bị')) return 'OC';
    return role;
};

export const generateShortNames = (employees, overrides = {}) => {
    const map = {};
    employees.forEach(emp => {
        if (overrides[emp.id] && overrides[emp.id].trim() !== "") {
            map[emp.id] = overrides[emp.id]; return;
        }
        map[emp.id] = emp.id; 
    });
    return map;
};

