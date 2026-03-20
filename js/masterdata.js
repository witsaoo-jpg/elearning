/* ═══════════════════════════════════════════════════════
   CBH Learn — Master Data
   กลุ่มงานและหน่วยงาน โรงพยาบาลชลบุรี
   นำเข้าจากไฟล์: รายชื่อกลุ่มงานและหน่วยงาน.xlsx
   ข้อมูล: 16 กลุ่มงาน, 74 หน่วยงาน
═══════════════════════════════════════════════════════ */

'use strict';

/* ────────────────────────────────────────────────────
   DEPT GROUPS & UNITS  (จาก Excel ทุก row)
──────────────────────────────────────────────────── */
const DEPT_GROUPS = [
  { id: 'g01', name: 'กลุ่มงานการพยาบาลผู้ป่วยอายุรกรรม',
    units: [
      { id: 13,  name: 'หอผู้ป่วย สก.3' },
      { id: 14,  name: 'หอผู้ป่วย สก.4' },
      { id: 15,  name: 'หอผู้ป่วย สก.5' },
      { id: 16,  name: 'หอผู้ป่วย สก.6' },
      { id: 90,  name: 'หอผู้ป่วยสงฆ์อาพาธ' },
      { id: 91,  name: 'หอผู้ป่วยสงฆ์พิเศษ 2+3' },
      { id: 11,  name: 'หอผู้ป่วยสามัญติดเชื้อ ธารน้ำใจ 1' },
      { id: 18,  name: 'หอผู้ป่วยสามัญติดเชื้อ ธารน้ำใจ 2' },
      { id: 40,  name: 'หอผู้ป่วยพิเศษอายุรกรรมชลาทรล่าง' },
      { id: 17,  name: 'หอผู้ป่วยพิเศษอายุรกรรมชลาทรบน' },
      { id: 29,  name: 'หอผู้ป่วย Low Immune ธนจ.4' }
    ]
  },
  { id: 'g02', name: 'กลุ่มงานการพยาบาลผู้ป่วยศัลยกรรม',
    units: [
      { id: 22,  name: 'หอผู้ป่วยชลาทิศ 1' },
      { id: 24,  name: 'หอผู้ป่วยชลาทิศ 2' },
      { id: 39,  name: 'หอผู้ป่วยชลาทิศ 3' },
      { id: 25,  name: 'หอผู้ป่วยชลาทิศ 4' },
      { id: 27,  name: 'หอผู้ป่วยพิเศษศัลยกรรม ฉ.7' },
      { id: 28,  name: 'หอผู้ป่วยพิเศษศัลยกรรม ฉ.8' },
      { id: 94,  name: 'หอผู้ป่วยพิเศษศัลยกรรม Ex.9' },
      { id: 23,  name: 'หอผู้ป่วยแผลไหม้' },
      { id: 34,  name: 'หอผู้ป่วยเคมีบำบัด' }
    ]
  },
  { id: 'g03', name: 'กลุ่มงานการพยาบาลผู้ป่วยสูติ-นรีเวช',
    units: [
      { id: 30,  name: 'หอผู้ป่วยหลังคลอด' },
      { id: 41,  name: 'หอผู้ป่วยนรีเวช ชลารักษ์4' },
      { id: 42,  name: 'หอผู้ป่วยพิเศษนรีเวช ชลารักษ์4' }
    ]
  },
  { id: 'g04', name: 'กลุ่มงานการพยาบาลผู้ป่วยออร์โธปิดิกส์',
    units: [
      { id: 81,  name: 'หอผู้ป่วยกระดูกชาย' },
      { id: 82,  name: 'หอผู้ป่วยศัลยกรรมอุบัติเหตุและกระดูกหญิง' },
      { id: 44,  name: 'หอผู้ป่วยพิเศษศัลยกรรม Ex.8' }
    ]
  },
  { id: 'g05', name: 'กลุ่มงานการพยาบาลผู้ป่วย โสต ศอ นาสิก จักษุ',
    units: [
      { id: 61,  name: 'หอผู้ป่วยสามัญ EENT และศัลยกรรมเด็ก ชว.3' },
      { id: 10,  name: 'หอผู้ป่วยพิเศษ EENT' }
    ]
  },
  { id: 'g06', name: 'กลุ่มงานการพยาบาลผู้ป่วยจิตเวช',
    units: [
      { id: 92,  name: 'จิตเวช (ชลาธาร 2) ชาย' },
      { id: 72,  name: 'จิตเวช (ชลาธาร 3) หญิง' }
    ]
  },
  { id: 'g07', name: 'กลุ่มงานการพยาบาลผู้ป่วยหนัก',
    units: [
      { id: 20,   name: 'หอผู้ป่วยหนักศัลยกรรม (SICU)' },
      { id: 12,   name: 'หอผู้ป่วยหนักอายุรกรรม (MICU 1)' },
      { id: 53,   name: 'หอผู้ป่วยหนักกุมารเวชกรรม (PICU)' },
      { id: 58,   name: 'หอผู้ป่วยหนักทารกแรกเกิด (NICU 1)' },
      { id: 59,   name: 'หอผู้ป่วยหนักทารกแรกเกิด (NICU 2)' },
      { id: 33,   name: 'หอผู้ป่วยหนักโรคหัวใจ (CCU)' },
      { id: 21,   name: 'หอผู้ป่วยหนักโรคหลอดเลือดสมอง (ชลาธาร 4)' },
      { id: 67,   name: 'หอผู้ป่วยหนักโรคติดเชื้อ (IICU ธารน้ำใจ 3)' },
      { id: 37,   name: 'หอผู้ป่วยหนักอุบัติเหตุหลายระบบ (ICU Trauma)' },
      { id: '21n', name: 'หอผู้ป่วยหนักระบบประสาท (ICU Neuro)' },
      { id: 38,   name: 'หอผู้ป่วยหนัก CVT' },
      { id: 75,   name: 'หอผู้ป่วยหนัก CICU (สวนหัวใจ)' },
      { id: 36,   name: 'หอผู้ป่วยโรคหลอดเลือดสมอง (ชลาธาร4)' }
    ]
  },
  { id: 'g08', name: 'กลุ่มงานการพยาบาลผู้ป่วยนอก',
    units: [
      { id: 'g081', name: 'OPD อายุรกรรม' },
      { id: 'g082', name: 'OPD ศัลยกรรม' },
      { id: 'g083', name: 'OPD สูติ-นรีเวช' },
      { id: 'g084', name: 'Clinic NCD' },
      { id: 'g085', name: 'OPD จิตเวช' },
      { id: 'g086', name: 'OPD กระดูก' },
      { id: 'g087', name: 'OPD ผิวหนัง' },
      { id: 'g088', name: 'OPD GP' },
      { id: 'g089', name: 'ห้อง EEG & EKG' }
    ]
  },
  { id: 'g09', name: 'กลุ่มงานการพยาบาลผู้ป่วยอุบัติเหตุ และฉุกเฉิน',
    units: [
      { id: 'g091', name: 'EMS' },
      { id: 'g092', name: 'ER & Extended ER' },
      { id: 'g093', name: 'ห้องสังเกตอาการ' },
      { id: 'g094', name: 'การพยาบาลส่งต่อ' }
    ]
  },
  { id: 'g10', name: 'กลุ่มงานการพยาบาลผู้คลอด',
    units: [
      { id: 30,  name: 'ห้องคลอด' }
    ]
  },
  { id: 'g11', name: 'กลุ่มงานการพยาบาลผู้ป่วยห้องผ่าตัด',
    units: [
      { id: 'g111', name: 'ผ่าตัดใหญ่ความเสี่ยงสูง' },
      { id: 'g112', name: 'ผ่าตัดเฉพาะทาง' }
    ]
  },
  { id: 'g12', name: 'กลุ่มงานการพยาบาลวิสัญญี',
    units: [
      { id: 'g121', name: 'วิสัญญีผู้ป่วยความเสี่ยงสูง' },
      { id: 'g122', name: 'วิสัญญีเฉพาะทาง' },
      { id: 'g123', name: 'Recovery Room' }
    ]
  },
  { id: 'g13', name: 'กลุ่มงานการพยาบาลผู้ป่วยกุมารเวชกรรม',
    units: [
      { id: 52,  name: 'หอผู้ป่วยกุมารเวชกรรม 1' },
      { id: 51,  name: 'หอผู้ป่วยกุมารเวชกรรม 4' },
      { id: 56,  name: 'หอผู้ป่วยกุมาร 5' },
      { id: 64,  name: 'หอผู้ป่วยกุมาร 6' },
      { id: 55,  name: 'หอผู้ป่วย SNB 1' },
      { id: 57,  name: 'หอผู้ป่วย SNB 2' }
    ]
  },
  { id: 'g14', name: 'กลุ่มงานการพยาบาลด้านการควบคุมและป้องกันการติดเชื้อ',
    units: [
      { id: 'g141', name: 'Infection Control' }
    ]
  },
  { id: 'g15', name: 'กลุ่มงานการพยาบาลตรวจรักษาพิเศษ',
    units: [
      { id: 'g151', name: 'ศูนย์โรคหัวใจ' },
      { id: 'g152', name: 'งานห้องตรวจพิเศษ' },
      { id: 'g153', name: 'หน่วยไตเทียม' },
      { id: 'g154', name: 'ODS' }
    ]
  },
  { id: 'g16', name: 'กลุ่มงานวิจัยและพัฒนาการพยาบาล',
    units: [
      { id: 'g161', name: 'งานวิจัยและพัฒนาการพยาบาล' }
    ]
  }
];

/* ────────────────────────────────────────────────────
   HELPERS — lookup functions
──────────────────────────────────────────────────── */
function getDeptById(id) {
  return DEPT_GROUPS.find(g => g.id === id) || null;
}

function getUnitsByDept(deptId) {
  const g = getDeptById(deptId);
  return g ? g.units : [];
}

function getAllUnits() {
  return DEPT_GROUPS.flatMap(g => g.units.map(u => ({
    ...u, deptId: g.id, deptName: g.name
  })));
}

function findUnitName(unitId) {
  for (const g of DEPT_GROUPS) {
    const u = g.units.find(u => String(u.id) === String(unitId));
    if (u) return u.name;
  }
  return String(unitId);
}

/* ────────────────────────────────────────────────────
   RENDER HELPERS — for dropdowns
──────────────────────────────────────────────────── */
function buildDeptOptions(selected = '') {
  return `<option value="">-- ทุกกลุ่มงาน --</option>` +
    DEPT_GROUPS.map(g =>
      `<option value="${g.id}" ${selected === g.id ? 'selected' : ''}>${g.name}</option>`
    ).join('');
}

function buildUnitOptions(deptId = '', selected = '') {
  const units = deptId ? getUnitsByDept(deptId) : getAllUnits();
  return `<option value="">-- ทุกหน่วยงาน --</option>` +
    units.map(u =>
      `<option value="${u.id}" ${String(selected) === String(u.id) ? 'selected' : ''}>${u.name}</option>`
    ).join('');
}

/* ────────────────────────────────────────────────────
   AUDIT TRAIL ACTIONS CATALOG
──────────────────────────────────────────────────── */
const AUDIT_ACTIONS = {
  // Auth
  LOGIN:           { label: 'เข้าสู่ระบบ',          icon: '🟢', color: 'var(--green)',  category: 'auth' },
  LOGOUT:          { label: 'ออกจากระบบ',             icon: '⚪', color: 'var(--text-muted)', category: 'auth' },
  LOGIN_FAIL:      { label: 'เข้าสู่ระบบล้มเหลว',    icon: '🔴', color: 'var(--red)',    category: 'auth' },
  // Users
  CREATE_USER:     { label: 'สร้างผู้ใช้ใหม่',        icon: '👤', color: 'var(--teal)',   category: 'user' },
  EDIT_USER:       { label: 'แก้ไขข้อมูลผู้ใช้',      icon: '✏️', color: 'var(--gold)',   category: 'user' },
  DELETE_USER:     { label: 'ลบผู้ใช้',               icon: '🗑',  color: 'var(--red)',    category: 'user' },
  RESET_PWD:       { label: 'รีเซ็ตรหัสผ่าน',         icon: '🔑', color: 'var(--purple)', category: 'user' },
  TOGGLE_USER:     { label: 'เปิด/ปิดบัญชีผู้ใช้',    icon: '🔄', color: 'var(--gold)',   category: 'user' },
  // Courses
  CREATE_COURSE:   { label: 'สร้างหลักสูตรใหม่',      icon: '📚', color: 'var(--teal)',   category: 'course' },
  EDIT_COURSE:     { label: 'แก้ไขหลักสูตร',           icon: '✏️', color: 'var(--gold)',   category: 'course' },
  DELETE_COURSE:   { label: 'ลบหลักสูตร',              icon: '🗑',  color: 'var(--red)',    category: 'course' },
  // Learning
  OPEN_COURSE:     { label: 'เปิดหลักสูตร',            icon: '🎬', color: 'var(--teal)',   category: 'learn' },
  QUIZ_PASS:       { label: 'ผ่านแบบทดสอบ',            icon: '🏅', color: 'var(--green)',  category: 'learn' },
  QUIZ_FAIL:       { label: 'ไม่ผ่านแบบทดสอบ',         icon: '❌', color: 'var(--red)',    category: 'learn' },
  CERT_ISSUED:     { label: 'รับใบประกาศนียบัตร',       icon: '🎖', color: 'var(--purple)', category: 'learn' },
  // System
  EXPORT_REPORT:   { label: 'Export รายงาน',           icon: '📥', color: 'var(--gold)',   category: 'system' },
  VIEW_REPORT:     { label: 'ดูรายงาน',                icon: '📊', color: 'var(--teal)',   category: 'system' },
  CHANGE_SETTINGS: { label: 'เปลี่ยนแปลงการตั้งค่า',  icon: '⚙️', color: 'var(--text-muted)', category: 'system' },
};

function getAuditAction(actionKey) {
  return AUDIT_ACTIONS[actionKey] || { label: actionKey, icon: '📋', color: 'var(--text-muted)', category: 'system' };
}

/* ────────────────────────────────────────────────────
   SAMPLE AUDIT TRAIL DATA (realistic CBH scenario)
──────────────────────────────────────────────────── */
function generateAuditSamples() {
  const now = Date.now();
  const min = 60000;
  const hr  = 3600000;

  return [
    { id:'AT001', timestamp: new Date(now - 2*min).toISOString(),  action:'LOGIN',         actor:'admin',   actorName:'ผู้ดูแลระบบ',       role:'admin',   ip:'192.168.1.100', detail:'เข้าสู่ระบบสำเร็จ', dept:'IT', unit:'' },
    { id:'AT002', timestamp: new Date(now - 5*min).toISOString(),  action:'CREATE_USER',   actor:'admin',   actorName:'ผู้ดูแลระบบ',       role:'admin',   ip:'192.168.1.100', detail:'สร้างผู้ใช้: นางสาวมาลัย สกุลดี (Ward 5)', dept:'IT', unit:'' },
    { id:'AT003', timestamp: new Date(now - 8*min).toISOString(),  action:'RESET_PWD',     actor:'admin',   actorName:'ผู้ดูแลระบบ',       role:'admin',   ip:'192.168.1.100', detail:'รีเซ็ตรหัสผ่าน: nurse03', dept:'IT', unit:'' },
    { id:'AT004', timestamp: new Date(now - 15*min).toISOString(), action:'LOGIN',         actor:'nso01',   actorName:'นางสมหมาย ใจดี',    role:'nso',     ip:'192.168.1.55',  detail:'เข้าสู่ระบบสำเร็จ', dept:'งานการพยาบาล', unit:'' },
    { id:'AT005', timestamp: new Date(now - 18*min).toISOString(), action:'VIEW_REPORT',   actor:'nso01',   actorName:'นางสมหมาย ใจดี',    role:'nso',     ip:'192.168.1.55',  detail:'ดูรายงาน: กลุ่มงานผู้ป่วยหนัก', dept:'งานการพยาบาล', unit:'' },
    { id:'AT006', timestamp: new Date(now - 22*min).toISOString(), action:'QUIZ_PASS',     actor:'nurse01', actorName:'นางสาวนิภา สุขใส',  role:'learner', ip:'192.168.1.42',  detail:'ผ่านแบบทดสอบ CPR ขั้นพื้นฐาน — 90%', dept:'g02', unit:'หอผู้ป่วยเคมีบำบัด' },
    { id:'AT007', timestamp: new Date(now - 30*min).toISOString(), action:'CERT_ISSUED',   actor:'nurse01', actorName:'นางสาวนิภา สุขใส',  role:'learner', ip:'192.168.1.42',  detail:'รับใบประกาศ: CPR ขั้นพื้นฐาน', dept:'g02', unit:'หอผู้ป่วยเคมีบำบัด' },
    { id:'AT008', timestamp: new Date(now - 45*min).toISOString(), action:'EDIT_USER',     actor:'admin',   actorName:'ผู้ดูแลระบบ',       role:'admin',   ip:'192.168.1.100', detail:'แก้ไข role: nurse02 → NSO', dept:'IT', unit:'' },
    { id:'AT009', timestamp: new Date(now - 1*hr).toISOString(),   action:'CREATE_COURSE', actor:'admin',   actorName:'ผู้ดูแลระบบ',       role:'admin',   ip:'192.168.1.100', detail:'สร้างหลักสูตร: Patient Safety & การป้องกันความเสี่ยง', dept:'IT', unit:'' },
    { id:'AT010', timestamp: new Date(now - 1.2*hr).toISOString(), action:'LOGIN',         actor:'nurse02', actorName:'นายวีระ ชัยศิริ',   role:'learner', ip:'192.168.2.10',  detail:'เข้าสู่ระบบสำเร็จ', dept:'g07', unit:'หอผู้ป่วยหนักอายุรกรรม (MICU 1)' },
    { id:'AT011', timestamp: new Date(now - 1.5*hr).toISOString(), action:'OPEN_COURSE',   actor:'nurse02', actorName:'นายวีระ ชัยศิริ',   role:'learner', ip:'192.168.2.10',  detail:'เปิดหลักสูตร: การดูแลผู้ป่วยเคมีบำบัด', dept:'g07', unit:'หอผู้ป่วยหนักอายุรกรรม (MICU 1)' },
    { id:'AT012', timestamp: new Date(now - 2*hr).toISOString(),   action:'LOGIN_FAIL',    actor:'unknown', actorName:'Unknown',           role:'-',       ip:'10.0.0.55',     detail:'เข้าสู่ระบบล้มเหลว: username ไม่พบ', dept:'-', unit:'' },
    { id:'AT013', timestamp: new Date(now - 2.5*hr).toISOString(), action:'EXPORT_REPORT', actor:'admin',   actorName:'ผู้ดูแลระบบ',       role:'admin',   ip:'192.168.1.100', detail:'Export Excel: รายงานการเรียน เดือน มีนาคม 2568', dept:'IT', unit:'' },
    { id:'AT014', timestamp: new Date(now - 3*hr).toISOString(),   action:'DELETE_USER',   actor:'admin',   actorName:'ผู้ดูแลระบบ',       role:'admin',   ip:'192.168.1.100', detail:'ลบบัญชีผู้ใช้: test_account (ทดสอบ)', dept:'IT', unit:'' },
    { id:'AT015', timestamp: new Date(now - 4*hr).toISOString(),   action:'QUIZ_FAIL',     actor:'nurse03', actorName:'นางกมลวรรณ พิทักษ์',role:'learner', ip:'192.168.3.22',  detail:'ไม่ผ่านแบบทดสอบ: การดูแลผู้ป่วยเคมีบำบัด — 60%', dept:'g09', unit:'ER & Extended ER' },
    { id:'AT016', timestamp: new Date(now - 5*hr).toISOString(),   action:'LOGOUT',        actor:'nso01',   actorName:'นางสมหมาย ใจดี',    role:'nso',     ip:'192.168.1.55',  detail:'ออกจากระบบ', dept:'งานการพยาบาล', unit:'' },
    { id:'AT017', timestamp: new Date(now - 6*hr).toISOString(),   action:'EDIT_COURSE',   actor:'admin',   actorName:'ผู้ดูแลระบบ',       role:'admin',   ip:'192.168.1.100', detail:'แก้ไขหลักสูตร: เพิ่มบทเรียน CPR — บทที่ 6', dept:'IT', unit:'' },
    { id:'AT018', timestamp: new Date(now - 8*hr).toISOString(),   action:'LOGIN',         actor:'admin',   actorName:'ผู้ดูแลระบบ',       role:'admin',   ip:'192.168.1.100', detail:'เข้าสู่ระบบสำเร็จ (เซสชันเช้า)', dept:'IT', unit:'' },
    { id:'AT019', timestamp: new Date(now - 1*24*hr).toISOString(),action:'CREATE_USER',   actor:'admin',   actorName:'ผู้ดูแลระบบ',       role:'admin',   ip:'192.168.1.100', detail:'สร้างผู้ใช้ชุดใหม่ 5 คน: หอ ICU Neuro', dept:'IT', unit:'' },
    { id:'AT020', timestamp: new Date(now - 2*24*hr).toISOString(),action:'CHANGE_SETTINGS',actor:'admin',  actorName:'ผู้ดูแลระบบ',       role:'admin',   ip:'192.168.1.100', detail:'เปลี่ยน Session Timeout: 60 → 120 นาที', dept:'IT', unit:'' },
  ];
}

/* export to global */
window.DEPT_GROUPS    = DEPT_GROUPS;
window.getDeptById    = getDeptById;
window.getUnitsByDept = getUnitsByDept;
window.getAllUnits     = getAllUnits;
window.findUnitName   = findUnitName;
window.buildDeptOptions = buildDeptOptions;
window.buildUnitOptions = buildUnitOptions;
window.AUDIT_ACTIONS    = AUDIT_ACTIONS;
window.getAuditAction   = getAuditAction;
window.generateAuditSamples = generateAuditSamples;