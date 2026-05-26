export const DEFAULT_SETTINGS = {
    fontSize: 12,
    rowHeight: 45,
    minStaffing: { 'S': 15, 'D': 15 },
    
    teams: ['Trung tâm', 'Kíp A', 'Kíp B', 'Kíp C', 'Kíp D'],
    
    positions: [
        'Lãnh đạo Trung tâm',
        'Kíp trưởng', 
        'Kíp phó', 
        'Quản lý kíp (Giao quyền)', 
        'KSVKL', 
        'ON-CALL'
    ],
    
    qualifications: ['Kíp trưởng', 'Full năng định', 'APP/CTL', 'TWR/GCU'],
    rosterColumns: ['CTL', 'APP', 'HĐ CTL', 'HĐ APP', 'TWR', 'GCU', 'HĐ TWR', 'HĐ GCU', 'QS', 'WS T4', 'WS T5'],
    activityTypes: [
        { id: 'LEAVE', code: 'P', label: 'Nghỉ phép', color: 'text-red-600 bg-red-50 border-red-200' },
        { id: 'TRIP', code: 'CT', label: 'Công tác', color: 'text-purple-600 bg-purple-50 border-purple-200' },
        { id: 'STUDY', code: 'H', label: 'Đi học', color: 'text-blue-600 bg-blue-50 border-blue-200' },
        { id: 'COMP', code: 'NB', label: 'Nghỉ bù', color: 'text-orange-600 bg-orange-50 border-orange-200' },
        { id: 'SICK', code: 'Ô', label: 'Nghỉ ốm', color: 'text-teal-600 bg-teal-50 border-teal-200' },
        { id: 'CHANGE', code: 'Đ/C', label: 'Đổi ca / TC', color: 'text-gray-600 bg-gray-100 border-gray-300' }
    ],
    shiftTypes: [
        { code: 'S', label: 'Sáng', color: 'bg-blue-100 text-blue-700 border-blue-300', icon: 'Sun', startTime: '00:00', endTime: '11:00' },
        { code: 'D', label: 'Đêm', color: 'bg-indigo-100 text-indigo-700 border-indigo-300', icon: 'Moon', startTime: '11:00', endTime: '23:00' }
    ],
    autoFillRules: { 'S': 0, 'D': -1 },
    onCallRules: { smartMode: true, managerQty: 1, staffQty: 3, offsetS: 1, offsetD: 1 },
    highlightRules: { enabled: true, daysBefore: 1, daysAfter: 5 }
};

export const INITIAL_EMPLOYEES = [
    { id: 'LD', name: 'Giám đốc Trung tâm', isChief: true, team: 'Trung tâm', position: 'Lãnh đạo Trung tâm', qualification: 'Full năng định', isVip: false },
    { id: 'HA', name: 'Lưu Văn Hân', isChief: true, team: 'Kíp A', position: 'Kíp trưởng', qualification: 'Kíp trưởng', isVip: true },
    { id: 'NG', name: 'Ngô Văn G', isChief: false, team: 'Kíp A', position: 'KSVKL', qualification: 'Full năng định', isVip: false },
    { id: 'TU', name: 'Trần Tuấn Anh', isChief: false, team: 'Kíp A', position: 'KSVKL', qualification: 'APP/CTL', isVip: true },
    
    { id: 'DU', name: 'Nguyễn Tiến Duy', isChief: true, team: 'Kíp B', position: 'Kíp phó', qualification: 'Kíp trưởng', isVip: true },
    { id: 'HU', name: 'Hoàng Quang Huy', isChief: false, team: 'Kíp B', position: 'KSVKL', qualification: 'TWR/GCU', isVip: false },
    
    { id: 'MI', name: 'Trần Nhật Minh', isChief: true, team: 'Kíp C', position: 'Quản lý kíp (Giao quyền)', qualification: 'Full năng định', isVip: true },
    { id: 'QU', name: 'Lê Anh Quân', isChief: false, team: 'Kíp C', position: 'KSVKL', qualification: 'Full năng định', isVip: true },
    
    { id: 'DA', name: 'Nguyễn Thành Đạt', isChief: true, team: 'Kíp D', position: 'Kíp trưởng', qualification: 'Kíp trưởng', isVip: true },
    { id: 'SO', name: 'Trịnh Văn Sơn', isChief: false, team: 'Kíp D', position: 'KSVKL', qualification: 'APP/CTL', isVip: false }
];

export const MOCK_REQUESTS = [
    { id: 'req1', requesterId: 'HA', type: 'LEAVE', leaveType: 'SICK', startDate: '2026-03-10', endDate: '2026-03-11', status: 'PENDING', note: 'Sốt cao, xin nghỉ ốm 2 ngày' },
    { id: 'req2', requesterId: 'NG', type: 'CHANGE', targetShift: 'D', targetDate: '2026-03-12', status: 'PENDING', note: 'Đổi ca Sáng thành ca Đêm do việc gia đình' }
];

export const MOCK_ACTIVITIES = [
    { id: 'act1', empId: 'HA', type: 'SICK', startDate: '2026-03-08', endDate: '2026-03-08', note: 'Bệnh viện chỉ định' }
];