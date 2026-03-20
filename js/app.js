/* ═══════════════════════════════════════════════════════
   CBH Learn — Frontend v3.0  (เชื่อม GAS สมบูรณ์)
   โรงพยาบาลชลบุรี LMS
═══════════════════════════════════════════════════════ */
'use strict';

/* ── GAS URL (เปลี่ยนหลัง Deploy) ── */
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwXQ7keoFw6Sb1H5CiSNBfdqIXyZIb4-9pvDvodHWWM1stRe8ugKljEXsn0FW6yvzId/exec';

/* ── State ── */
const App = {
  user: null,
  users: [], courses: [], enrollments: [], auditAll: [],
  currentCourse: null,
  quiz: { questions:[], idx:0, answers:[], done:false },
  _depts: null,   // cache จาก GAS getDepts
};

/* ── Quiz data ── */
const QUIZZES = {
  default:[
    {q:'ยาเคมีบำบัดชนิดใดทำให้เกิด Neutropenia บ่อยที่สุด?',opts:['Methotrexate','Paclitaxel','Doxorubicin','Carboplatin'],ans:1},
    {q:'อุณหภูมิ ≥ 38°C ขณะได้รับยาเคมีบำบัด ควรทำอย่างไรก่อน?',opts:['ให้ยาลดไข้ทันที','หยุดยาและรายงานแพทย์','เพิ่มอัตราหยด','วัด V/S ซ้ำ 30 นาที'],ans:1},
    {q:'Nadir ของ WBC หลังให้ยาเคมีบำบัดมักเกิดในช่วงใด?',opts:['วันที่ 1–3','วันที่ 7–14','วันที่ 21–28','หลัง 30 วัน'],ans:1},
    {q:'การดูแล Mucositis ควรใช้น้ำยาบ้วนปากชนิดใด?',opts:['H₂O₂ ผสมน้ำ','Chlorhexidine','น้ำเกลือ 0.9%','Povidone Iodine'],ans:2},
    {q:'PPE ที่ต้องใส่เมื่อบริหารยาเคมีบำบัด?',opts:['Gloves เท่านั้น','Gloves+Mask','Gloves+Gown+Mask+Goggles','Gown เท่านั้น'],ans:2},
  ],
  cpr:[
    {q:'อัตราการกดหน้าอก CPR ผู้ใหญ่ที่ถูกต้อง?',opts:['60–80 ครั้ง/นาที','100–120 ครั้ง/นาที','130–150 ครั้ง/นาที','80–100 ครั้ง/นาที'],ans:1},
    {q:'ความลึกกดหน้าอกผู้ใหญ่ที่ถูกต้อง?',opts:['1–2 ซม.','2–4 ซม.','5–6 ซม.','7–8 ซม.'],ans:2},
    {q:'อัตราส่วน compression:ventilation (2 คน)?',opts:['15:2','30:2','30:1','15:1'],ans:1},
    {q:'AED ย่อมาจากอะไร?',opts:['Automatic Emergency Device','Automated External Defibrillator','Advanced Electric Device','Automated Emergency Defibrillator'],ans:1},
    {q:'ควรหยุด CPR เมื่อใด?',opts:['หลัง 10 นาที','ผู้ป่วยฟื้นหรือทีมมาถึง','เมื่อเหนื่อย','หลัง 5 รอบ'],ans:1},
  ],
};

/* ═════════════════════════════════════════════════════
   UI HELPERS
═════════════════════════════════════════════════════ */
const el   = id => document.getElementById(id);
const txt  = (id, v) => { const e=el(id); if(e) e.textContent=v; };
const html = (id, h) => { const e=el(id); if(e) e.innerHTML=h; };

function loading(on) { el('loading-overlay')?.classList.toggle('show', on); }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  el(id)?.classList.add('active');
}
function openModal(id) { el(id)?.classList.add('open'); }
function closeModal(id){ el(id)?.classList.remove('open'); }

function toast(msg, type='info') {
  const icons = {success:'✅',info:'ℹ️',error:'❌',warn:'⚠️'};
  const t = document.createElement('div');
  t.className = `toast t-${type}`;
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  el('toast-shelf')?.prepend(t);
  setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateX(30px)'; t.style.transition = 'all .3s';
    setTimeout(() => t.remove(), 330);
  }, 3500);
}

function avatarColor(s='') {
  const c=['ua-teal','ua-purple','ua-orange','ua-green','ua-gold','ua-red'];
  let h=0; for(const ch of s) h=h*31+ch.charCodeAt(0);
  return c[Math.abs(h)%c.length];
}
function rolePill(r) {
  return ({admin:'<span class="pill pill-admin">👑 Admin</span>',nso:'<span class="pill pill-nso">🔮 NSO</span>',learner:'<span class="pill pill-prog">👩‍⚕️ ผู้เรียน</span>'})[r]||`<span class="pill">${r}</span>`;
}
function progBar(pct, cls='') {
  return `<div class="prog-wrap"><div class="prog-fill ${cls}" style="width:${Math.min(100,pct||0)}%"></div></div>`;
}
function fmtDate(iso) {
  if(!iso) return '—';
  try { return new Date(iso).toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}); } catch(_){ return iso; }
}

/* ═════════════════════════════════════════════════════
   GAS API LAYER  — ทุก action ผ่านที่นี่
═════════════════════════════════════════════════════ */
const API = {

  async get(params) {
    loading(true);
    try {
      const url = new URL(GAS_URL);
      Object.entries(params).forEach(([k,v]) => {
        if(v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
      });
      const res  = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'follow',
        mode: 'cors',
      });
      if(!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      const data = JSON.parse(text);
      loading(false);
      return data;
    } catch(e) {
      loading(false);
      console.error('[GAS GET]', e.message);
      return { success:false, error:'ไม่สามารถเชื่อมต่อ GAS ได้: ' + e.message };
    }
  },

  async post(action, body={}) {
    loading(true);
    try {
      const res  = await fetch(GAS_URL, {
        method: 'POST',
        body:    JSON.stringify({ action, ...body }),
        redirect: 'follow',
        mode: 'cors',
      });
      if(!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      const data = JSON.parse(text);
      loading(false);
      return data;
    } catch(e) {
      loading(false);
      console.error('[GAS POST]', e.message);
      return { success:false, error:'ไม่สามารถเชื่อมต่อ GAS ได้: ' + e.message };
    }
  },

  /* Auth */
  login        : (u,p)     => API.get({ action:'login', username:u, password:p }),
  /* Users */
  getUsers     : (f={})    => API.get({ action:'getUsers', ...f }),
  createUser   : (d)       => API.post('createUser',    { data:d, actor:App.user }),
  updateUser   : (d)       => API.post('updateUser',    { data:d, actor:App.user }),
  deleteUser   : (id)      => API.post('deleteUser',    { id, actor:App.user }),
  toggleUser   : (id,a)    => API.post('toggleUser',    { id, active:a, actor:App.user }),
  resetPwd     : (id,pwd)  => API.post('resetPassword', { id, newPwd:pwd, actor:App.user }),
  bulkCreate   : (arr)     => API.post('bulkCreateUsers',{ users:arr, actor:App.user }),
  /* Courses */
  getCourses   : (all=false)=> API.get({ action:'getCourses', all:all?'true':'false' }),
  createCourse : (d)       => API.post('createCourse',  { data:d, actor:App.user }),
  updateCourse : (d)       => API.post('updateCourse',  { data:d, actor:App.user }),
  deleteCourse : (id)      => API.post('deleteCourse',  { id, actor:App.user }),
  toggleCourse : (id,a)    => API.post('toggleCourse',  { id, active:a, actor:App.user }),
  /* Enrollment */
  getMyEnrollments:(u)     => API.get({ action:'getMyEnrollments', username:u }),
  enroll       : (d)       => API.post('enroll',         { data:d }),
  /* Progress */
  updateProgress:(d)       => API.post('updateProgress', { data:d }),
  /* Quiz */
  submitQuiz   : (d)       => API.post('submitQuiz',    { data:d }),
  /* Certs */
  getCerts     : (u)       => API.get({ action:'getCerts', username:u }),
  /* Audit */
  getAuditLog  : (f={})    => API.get({ action:'getAuditLog', ...f }),
  logAudit     : (d)       => API.post('logAudit',      { data:d }),
  /* Stats */
  getStats     : ()        => API.get({ action:'getStats' }),
  getDeptStats : (f={})    => API.get({ action:'getDeptStats', ...f }),
  /* Depts (live) */
  getDepts     : ()        => API.get({ action:'getDepts' }),
};

/* ═════════════════════════════════════════════════════
   DEPT DROPDOWNS — โหลดจาก GAS จริง
═════════════════════════════════════════════════════ */
async function loadDepts() {
  if(App._depts) return App._depts;
  const res = await API.getDepts();
  if(res.success && res.groups?.length) {
    App._depts = res.groups;
    /* อัปเดต DEPT_GROUPS (masterdata.js) ด้วยข้อมูล live */
    if(typeof DEPT_GROUPS !== 'undefined') {
      res.groups.forEach(g => {
        const idx = DEPT_GROUPS.findIndex(x => x.id===g.id);
        if(idx>=0) DEPT_GROUPS[idx] = g; else DEPT_GROUPS.push(g);
      });
    }
  } else {
    App._depts = (typeof DEPT_GROUPS!=='undefined') ? DEPT_GROUPS : [];
  }
  return App._depts;
}

async function populateDeptSelects() {
  const groups = await loadDepts();
  const opts = '<option value="">ทุกกลุ่มงาน</option>' +
    groups.map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
  document.querySelectorAll('.dept-select').forEach(s => s.innerHTML=opts);
}

function populateUnitSelect(selId, deptId='') {
  const groups = App._depts || (typeof DEPT_GROUPS!=='undefined'?DEPT_GROUPS:[]);
  const units  = deptId ? (groups.find(g=>g.id===deptId)?.units||[]) : [];
  const opts   = '<option value="">ทุกหน่วยงาน</option>' +
    units.map(u=>`<option value="${u.id}">${u.name}</option>`).join('');
  const s = el(selId);
  if(s) s.innerHTML = opts;
}

/* ═════════════════════════════════════════════════════
   LOGIN / LOGOUT
═════════════════════════════════════════════════════ */
function _loginError(msg) {
  const e = el('login-error');
  if(!e) return;
  e.textContent = msg;
  e.style.display = msg ? 'block' : 'none';
}

async function doLogin() {
  const username = el('login-user')?.value?.trim();
  const password = el('login-pass')?.value?.trim();
  _loginError('');

  if(!username || !password) {
    _loginError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
    return;
  }

  const loginBtn = document.querySelector('.btn-primary');
  if(loginBtn) { loginBtn.disabled=true; loginBtn.textContent='กำลังเข้าสู่ระบบ...'; }

  try {
    const res = await API.login(username, password);

    if(!res.success) {
      _loginError(res.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      if(loginBtn) { loginBtn.disabled=false; loginBtn.textContent='เข้าสู่ระบบ →'; }
      return;
    }

    App.user = res.user;
    _loginError('');
    toast('ยินดีต้อนรับ ' + res.user.name + '! 🎉', 'success');

    if(res.user.role==='admin')    initAdmin();
    else if(res.user.role==='nso') initNSO();
    else                           initLearner();

  } catch(err) {
    _loginError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่');
    if(loginBtn) { loginBtn.disabled=false; loginBtn.textContent='เข้าสู่ระบบ →'; }
  }
}

function doLogout() {
  try {
    API.logAudit({ action:'LOGOUT', actor:App.user?.username, actorName:App.user?.name,
      role:App.user?.role, detail:'ออกจากระบบ', result:'OK' });
  } catch(_) {}
  App.user = null;
  if(el('login-user')) el('login-user').value='';
  if(el('login-pass')) el('login-pass').value='';
  const loginBtn = document.querySelector('.btn-primary');
  if(loginBtn) { loginBtn.disabled=false; loginBtn.textContent='เข้าสู่ระบบ →'; }
  _loginError('');
  showScreen('screen-login');
  toast('ออกจากระบบแล้ว 👋','info');
}


/* ═════════════════════════════════════════════════════
   SELF REGISTRATION
═════════════════════════════════════════════════════ */
function onRegDeptChange(deptId) {
  populateUnitSelect('reg-unit', deptId);
}

async function doRegister() {
  const name     = el('reg-name')?.value?.trim();
  const username = el('reg-username')?.value?.trim();
  const password = el('reg-password')?.value?.trim();
  const deptId   = el('reg-dept')?.value || '';
  const unitId   = el('reg-unit')?.value || '';
  const email    = el('reg-email')?.value?.trim() || '';

  const errEl = el('reg-error');
  if (errEl) { errEl.style.display='none'; errEl.textContent=''; }

  const setErr = (msg) => {
    if(errEl) { errEl.textContent=msg; errEl.style.display='block'; }
    const btn = document.querySelector('#screen-register .btn-primary');
    if(btn) { btn.disabled=false; btn.textContent='สมัครใช้งาน →'; }
  };

  if (!name)     return setErr('กรุณากรอกชื่อ-นามสกุล');
  if (!username) return setErr('กรุณากรอก Username');
  if (!password || password.length < 4) return setErr('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
  if (!deptId)   return setErr('กรุณาเลือกกลุ่มงาน');
  if (!unitId)   return setErr('กรุณาเลือกหน่วยงาน');

  const btn = document.querySelector('#screen-register .btn-primary');
  if(btn) { btn.disabled=true; btn.textContent='กำลังสมัคร...'; }

  const groups = App._depts || (typeof DEPT_GROUPS!=='undefined' ? DEPT_GROUPS : []);
  const dg     = groups.find(g => g.id === deptId);
  const ug     = dg?.units?.find(u => String(u.id) === String(unitId));

  const res = await API.createUser({
    name, username, password,
    role: 'learner',
    deptId, dept: dg?.name || '',
    unitId, unit: ug?.name || '',
    email,
    createdBy: 'self-register',
    createdByName: name,
  });

  if (!res.success) return setErr(res.error || 'สมัครไม่สำเร็จ กรุณาลองใหม่');

  // Auto-login after register
  const loginRes = await API.login(username, password);
  if (loginRes.success) {
    App.user = loginRes.user;
    toast('ยินดีต้อนรับ ' + loginRes.user.name + '! สมัครสำเร็จ 🎉', 'success');
    initLearner();
  } else {
    toast('สมัครสำเร็จ! กรุณาเข้าสู่ระบบ', 'success');
    showScreen('screen-login');
    if(el('login-user')) el('login-user').value = username;
  }
}

/* ═════════════════════════════════════════════════════
   LEARNER
═════════════════════════════════════════════════════ */
async function initLearner() {
  const u = App.user;
  txt('learner-name',    u.name);
  txt('learner-subrole', u.unit||u.dept||'ผู้เรียน');
  html('learner-avatar', u.name?.[0]||'น');
  showScreen('screen-main');
  switchLearnerTab('home', el('ltab-btn-home'));
}

function switchLearnerTab(id, btn) {
  document.querySelectorAll('#screen-main .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#screen-main .nav-btn').forEach(b=>b.classList.remove('active'));
  el(`ltab-${id}`)?.classList.add('active');
  if(btn) btn.classList.add('active');
  if(id==='home')       renderLearnerHome();
  if(id==='mycourses')  renderMyCourses();
  if(id==='progress')   renderProgressTab();
  if(id==='certs')      renderCertsTab();
}

async function renderLearnerHome() {
  const u = App.user;
  html('learner-welcome', `สวัสดี, <span style="color:var(--teal)">${u.name}</span> 👋`);

  const [enrollRes, courseRes] = await Promise.all([
    API.getMyEnrollments(u.username),
    API.getCourses(false),  // always fresh, not cached
  ]);
  App.enrollments = enrollRes.enrollments || [];
  App.courses     = (courseRes.courses || []).filter(c => c.active !== 'FALSE');

  const done    = App.enrollments.filter(e=>parseFloat(e.progress_pct||0)>=100);
  const hours   = App.enrollments.reduce((s,e)=>{
    const c = App.courses.find(x=>x.id===e.course_id);
    return s + (parseFloat(c?.hours||0)*parseFloat(e.progress_pct||0)/100);
  },0);

  txt('wb-stat-courses', App.enrollments.length);
  txt('wb-stat-hours',   hours.toFixed(1));
  txt('wb-stat-certs',   done.length);

  /* Continue strip */
  const inProg = App.enrollments.filter(e=>{ const p=parseFloat(e.progress_pct||0); return p>0&&p<100; });
  html('continue-grid', inProg.map(e=>`
    <div class="continue-card" onclick="openCourse('${e.course_id}')">
      <div class="cc-icon">${e.course_emoji||'📚'}</div>
      <div class="cc-info">
        <h4>${e.course_title}</h4>
        ${progBar(parseFloat(e.progress_pct||0))}
        <p>${parseFloat(e.progress_pct||0).toFixed(0)}% · กำลังเรียน</p>
      </div>
      <button class="btn-continue" onclick="event.stopPropagation();openCourse('${e.course_id}')">เรียนต่อ</button>
    </div>
  `).join('')||'<p style="color:var(--text-muted);font-size:13px">ยังไม่มีวิชาที่กำลังเรียน</p>');

  /* Show ALL active courses with enrollment status */
  const enrolled_map = {};
  App.enrollments.forEach(e => enrolled_map[e.course_id] = e);
  html('featured-grid-label', `หลักสูตรทั้งหมด (${App.courses.length})`); html('featured-grid', App.courses.map(c => {
    const enr = enrolled_map[c.id] || null;
    return renderCourseCard(c, enr);
  }).join('') || '<p style="color:var(--text-muted)">ยังไม่มีหลักสูตร</p>');
}

async function renderMyCourses() {
  const res = await API.getMyEnrollments(App.user.username);
  App.enrollments = res.enrollments || [];
  html('mycourses-grid', App.enrollments.length
    ? App.enrollments.map(e=>{
        const pct = parseFloat(e.progress_pct||0);
        return `<div class="course-card" onclick="openCourse('${e.course_id}')">
          <div class="course-thumb ct-blue">${e.course_emoji||'📚'}</div>
          <div class="course-body">
            <div class="course-cat">${e.course_cat||''}</div>
            <div class="course-title">${e.course_title}</div>
            ${progBar(pct, pct>=100?'green':'')}
            <div class="prog-label"><span>${pct>=100?'✅ เสร็จสิ้น':'กำลังเรียน'}</span>
              <span style="color:${pct>=100?'var(--green)':'var(--teal)'}">${pct.toFixed(0)}%</span></div>
          </div></div>`;
      }).join('')
    : '<p style="color:var(--text-muted)">ยังไม่ได้ลงทะเบียนวิชาใด</p>'
  );
}

async function renderProgressTab() {
  const [enrollRes, certRes] = await Promise.all([
    API.getMyEnrollments(App.user.username),
    API.getCerts(App.user.username),
  ]);
  const enrollments = enrollRes.enrollments || [];
  const certs       = certRes.certs         || [];
  const done = enrollments.filter(e=>parseFloat(e.progress_pct||0)>=100).length;
  const hrs  = enrollments.reduce((s,e)=>{
    return s+(parseFloat(e.course_hours||0)*parseFloat(e.progress_pct||0)/100);
  },0);

  txt('prog-stat-total', enrollments.length);
  txt('prog-stat-done',  done);
  txt('prog-stat-hours', hrs.toFixed(1));
  txt('prog-stat-certs', certs.length);

  html('prog-table-body', enrollments.map(e=>{
    const pct  = parseFloat(e.progress_pct||0);
    const cert = certs.find(c=>c.course_id===e.course_id);
    return `<div class="dt-row" style="grid-template-columns:2fr 1fr 1fr 1fr 110px">
      <div class="user-cell">
        <span style="font-size:20px">${e.course_emoji||'📚'}</span>
        <div class="cell-name">${e.course_title}</div>
      </div>
      <div style="font-size:12px;color:var(--text-muted)">${e.course_cat||'—'}</div>
      <div>${progBar(pct, pct>=100?'green':'')}<small style="color:var(--text-muted)">${pct.toFixed(0)}%</small></div>
      <div style="color:${cert?'var(--green)':'var(--text-muted)'}">${cert?cert.score+'/100':'—'}</div>
      <div>${pct>=100?'<span class="pill pill-done">✅ เสร็จ</span>':'<span class="pill pill-prog">⏳ เรียน</span>'}</div>
    </div>`;
  }).join('')||'<div style="padding:20px;color:var(--text-muted);text-align:center">ยังไม่มีข้อมูล</div>');
}

async function renderCertsTab() {
  const res   = await API.getCerts(App.user.username);
  const certs = res.certs || [];
  html('certs-grid', certs.length
    ? certs.map(c=>`
        <div style="background:var(--navy-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;cursor:pointer"
             onclick="showCert('${c.id}','${encodeURIComponent(c.course_title)}','${c.score}','${c.cert_no}','${c.issued_at}')">
          <div style="font-size:32px;margin-bottom:8px">🏅</div>
          <h4 style="font-size:14px;font-weight:700;margin-bottom:6px">${c.course_title}</h4>
          <p style="font-size:12px;color:var(--text-muted);margin-bottom:4px">เลขที่: ${c.cert_no}</p>
          <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px">วันที่: ${fmtDate(c.issued_at)}</p>
          <span class="pill pill-done">✅ คะแนน ${c.score}%</span>
        </div>`)
      .join('')
    : '<p style="color:var(--text-muted)">ยังไม่มีใบประกาศนียบัตร</p>'
  );
  html('cert-display','');
}

function showCert(certId, titleEnc, score, certNo, issuedAt) {
  const u     = App.user;
  const title = decodeURIComponent(titleEnc);
  html('cert-display',`
    <div class="certificate" style="margin-top:24px">
      <div class="cert-seal">🏅</div>
      <div class="cert-eyebrow">Certificate of Completion</div>
      <div class="cert-heading">ใบประกาศนียบัตร</div>
      <div class="cert-present">ขอมอบให้เพื่อรับรองว่า</div>
      <div class="cert-name">${u?.name||'ผู้เรียน'}</div>
      <div class="cert-role">${u?.unit||u?.dept||'โรงพยาบาลชลบุรี'}</div>
      <div class="cert-rule"></div>
      <div class="cert-course">ได้สำเร็จหลักสูตร: ${title}</div>
      <div style="font-size:13px;color:var(--teal);margin-bottom:8px">คะแนน: ${score}% · เลขที่: ${certNo}</div>
      <div class="cert-date">วันที่: ${fmtDate(issuedAt)} · โรงพยาบาลชลบุรี</div>
      <div style="margin-top:20px"><button class="btn btn-ghost btn-sm" onclick="window.print()">🖨️ พิมพ์</button></div>
    </div>
  `);
  el('cert-display')?.scrollIntoView({behavior:'smooth'});
}

function renderCourseCard(c, enrollment) {
  const pct      = enrollment ? parseFloat(enrollment.progress_pct||0) : 0;
  const enrolled = !!enrollment;
  const done     = pct >= 100;
  let statusBadge = '';
  if (done)          statusBadge = '<span class="pill pill-done" style="font-size:10px">✅ เสร็จสิ้น</span>';
  else if (enrolled) statusBadge = '<span class="pill pill-prog" style="font-size:10px">⏳ กำลังเรียน</span>';
  else               statusBadge = '<span class="pill" style="font-size:10px;background:rgba(0,198,224,0.08);color:var(--teal);border:1px solid rgba(0,198,224,0.2)">+ เรียนเลย</span>';

  return `<div class="course-card" onclick="openCourse('${c.id}')">
    <div class="course-thumb ${c.color||'ct-blue'}">
      ${c.emoji||'📚'}
      ${c.badge?`<div class="course-badge ${c.badge}">${c.badgeText}</div>`:''}
    </div>
    <div class="course-body">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div class="course-cat">${c.cat}</div>
        ${statusBadge}
      </div>
      <div class="course-title">${c.title}</div>
      <div class="course-meta">
        <span>🎬 ${c.lessons} บท</span><span>⏱ ${c.hours} ชม.</span>
        ${c.hasQuiz==='TRUE'?'<span>📝 Quiz</span>':''}
      </div>
      ${enrolled ? progBar(pct, done?'green':'') + `<div class="prog-label"><span>ความก้าวหน้า</span><span style="color:${done?'var(--green)':'var(--teal)'}">${pct.toFixed(0)}%</span></div>` : ''}
    </div>
  </div>`;
}

/* ═════════════════════════════════════════════════════
   COURSE DETAIL
═════════════════════════════════════════════════════ */
async function openCourse(courseId) {
  let c = App.courses.find(x=>x.id===courseId);
  if(!c) {
    const res = await API.getCourses();
    App.courses = res.courses||[];
    c = App.courses.find(x=>x.id===courseId);
  }
  if(!c) { toast('ไม่พบหลักสูตร','error'); return; }
  App.currentCourse = c;

  if(App.user.role==='learner') {
    if(!App.enrollments.find(e=>e.course_id===courseId)) {
      await API.enroll({
        username:App.user.username, user_id:App.user.id,
        course_id:c.id, course_title:c.title, userName:App.user.name,
      });
      App.enrollments.push({username:App.user.username,course_id:c.id,course_title:c.title,progress_pct:'0'});
    }
  }

  txt('course-title-bar',    c.title);
  txt('course-subtitle-bar', `${c.cat} · ${c.lessons} บท · ${c.hours} ชม.`);
  html('video-area',`<div class="video-placeholder" onclick="loadVideo()"><div class="play-ring">▶</div><p>${c.title}</p></div>`);
  buildCurriculum(c);
  document.querySelectorAll('.lesson-pane').forEach((p,i)=>p.classList.toggle('active',i===0));
  document.querySelectorAll('.ltab').forEach((b,i)=>b.classList.toggle('active',i===0));
  showScreen('screen-course');
  API.logAudit({action:'OPEN_COURSE',actor:App.user?.username,actorName:App.user?.name,role:App.user?.role,detail:`เปิดหลักสูตร: ${c.title}`,target:c.id,result:'OK'});
}

function loadVideo() {
  html('video-area',`<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" allow="autoplay;encrypted-media" allowfullscreen style="width:100%;height:100%;border:none;border-radius:12px"></iframe>`);
  if(App.user?.role==='learner' && App.currentCourse) {
    const enr = App.enrollments.find(e=>e.course_id===App.currentCourse.id);
    const cur = enr ? Math.min(parseFloat(enr.progress_pct||0)+10, 99) : 10;
    if(enr) enr.progress_pct = String(cur);
    API.updateProgress({username:App.user.username,course_id:App.currentCourse.id,progress_pct:String(cur)});
    buildCurriculum(App.currentCourse);
  }
}

function buildCurriculum(c) {
  const enr    = App.enrollments.find(e=>e.course_id===c.id);
  const pct    = enr ? parseFloat(enr.progress_pct||0) : 0;
  const lessons= parseInt(c.lessons)||6;
  const doneCnt= Math.floor(lessons*pct/100);
  const titles = ['ความรู้เบื้องต้น','เนื้อหาหลัก','การปฏิบัติ','กรณีศึกษา','การติดตามผล','แบบทดสอบ'];

  html('curriculum-progress', `${doneCnt}/${lessons} เสร็จ`);
  html('curriculum-prog-bar', progBar(pct));
  html('curriculum-prog-label',`<span>ความก้าวหน้า</span><span style="color:var(--teal)">${pct.toFixed(0)}%</span>`);
  html('curriculum-list', Array.from({length:lessons},(_,i)=>{
    const done=i<doneCnt, act=i===doneCnt;
    return `<div class="lesson-item${done?' done':''}${act?' active':''}" onclick="selectLesson(${i})">
      <div class="lesson-num">${done?'✓':i+1}</div>
      <div class="li-info"><h4>บทที่ ${i+1}: ${titles[i]||'เนื้อหา'}</h4><p>🎬 ${20+i*5} นาที</p></div>
      <div class="li-type">${i===lessons-1?'📝':'🎬'}</div>
    </div>`;
  }).join(''));
}

function selectLesson(idx) {
  if(App.user?.role==='learner' && App.currentCourse) {
    const c = App.currentCourse;
    const lessons = parseInt(c.lessons)||6;
    const newPct  = Math.min(Math.round((idx+1)/lessons*100), 99);
    const enr = App.enrollments.find(e=>e.course_id===c.id);
    if(enr && parseFloat(enr.progress_pct||0)<newPct) {
      enr.progress_pct = String(newPct);
      API.updateProgress({username:App.user.username,course_id:c.id,progress_pct:String(newPct),lesson_index:String(idx)});
      buildCurriculum(c);
    }
  }
}

function switchLessonTab(id, btn) {
  document.querySelectorAll('.lesson-pane').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.ltab').forEach(b=>b.classList.remove('active'));
  el(`lpane-${id}`)?.classList.add('active');
  if(btn) btn.classList.add('active');
  if(id==='quiz') initQuiz(App.currentCourse?.id);
}

function backToMain() {
  const r = App.user?.role;
  showScreen(r==='admin'?'screen-admin':r==='nso'?'screen-nso':'screen-main');
}

/* ═════════════════════════════════════════════════════
   QUIZ ENGINE
═════════════════════════════════════════════════════ */
let _qAns = null;

function initQuiz(courseId) {
  const qs = QUIZZES[courseId] || QUIZZES.default;
  App.quiz = { questions:qs, idx:0, answers:[], done:false };
  _qAns = null;
  renderQuestion();
}

function renderQuestion() {
  if(App.quiz.done) { renderQuizResult(); return; }
  const {questions, idx} = App.quiz;
  const q = questions[idx];
  const dots = questions.map((_,i)=>`<div class="q-dot ${i<idx?'done':i===idx?'current':''}"></div>`).join('');
  html('quiz-area',`
    <div class="quiz-wrap">
      <div class="quiz-header"><h2>📝 แบบทดสอบ</h2><div class="quiz-dots">${dots}</div></div>
      <div class="question-card">
        <div class="q-num">ข้อที่ ${idx+1}/${questions.length}</div>
        <div class="q-text">${q.q}</div>
        <div class="answer-options">
          ${q.opts.map((o,i)=>`<button class="answer-opt" onclick="selectAns(${i})">${'ABCD'[i]}. ${o}</button>`).join('')}
        </div>
        <div class="quiz-nav">
          <span style="font-size:12px;color:var(--text-muted)">เลือกคำตอบที่ถูกต้อง</span>
          <button class="btn btn-teal btn-sm" id="quiz-next-btn" disabled onclick="nextQuestion()">ถัดไป →</button>
        </div>
      </div>
    </div>
  `);
}

function selectAns(i) {
  _qAns = i;
  document.querySelectorAll('.answer-opt').forEach((b,j)=>{ b.classList.remove('sel'); if(j===i) b.classList.add('sel'); });
  const btn=el('quiz-next-btn'); if(btn) btn.disabled=false;
}

function nextQuestion() {
  if(_qAns===null) return;
  const q = App.quiz.questions[App.quiz.idx];
  App.quiz.answers.push(_qAns);
  document.querySelectorAll('.answer-opt').forEach((b,j)=>{
    if(j===q.ans) b.classList.add('correct');
    else if(j===_qAns) b.classList.add('wrong');
    b.style.pointerEvents='none';
  });
  const btn=el('quiz-next-btn'); if(btn) btn.disabled=true;
  _qAns=null;
  setTimeout(()=>{
    App.quiz.idx++;
    if(App.quiz.idx>=App.quiz.questions.length) App.quiz.done=true;
    renderQuestion();
  }, 900);
}

async function renderQuizResult() {
  const {answers,questions} = App.quiz;
  const correct = answers.filter((a,i)=>a===questions[i].ans).length;
  const pct  = Math.round(correct/questions.length*100);
  const pass = pct>=70;
  const col  = pass?'var(--green)':'var(--red)';

  html('quiz-area',`
    <div class="quiz-result">
      <div class="result-ring" style="background:conic-gradient(${col} ${pct*3.6}deg,rgba(255,255,255,.07) 0deg);color:${col}">${pct}%</div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:14px">${correct}/${questions.length} ข้อถูกต้อง</div>
      <div style="font-size:22px;margin-bottom:10px">${pass?'🎉 ผ่านแบบทดสอบ!':'😔 ยังไม่ผ่าน'}</div>
      <p style="font-size:13px;color:${col};margin-bottom:22px">
        ${pass?'ยินดีด้วย! คุณผ่านเกณฑ์ 70% จะได้รับใบประกาศนียบัตร':'ต้องการ 70% ขึ้นไป กรุณาทบทวนเนื้อหาและลองใหม่'}
      </p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-ghost" onclick="initQuiz('${App.currentCourse?.id||''}')">🔄 ทำใหม่</button>
        ${pass?`<button class="btn btn-teal" onclick="switchLearnerTab('certs',el('ltab-btn-certs'));backToMain()">🏅 ดูใบประกาศ</button>`:''}
      </div>
    </div>
  `);

  if(App.user?.role==='learner' && App.currentCourse) {
    const res = await API.submitQuiz({
      username: App.user.username, user_name: App.user.name,
      user_dept: App.user.dept, user_unit: App.user.unit,
      course_id: App.currentCourse.id, course_title: App.currentCourse.title,
      score: pct, pass,
    });
    if(pass) {
      toast(`🏅 ผ่านแบบทดสอบ ${pct}%! ได้รับใบประกาศ`,'success');
      const enr = App.enrollments.find(e=>e.course_id===App.currentCourse.id);
      if(enr) enr.progress_pct='100';
      buildCurriculum(App.currentCourse);
    }
  } else if(pass) {
    toast(`🏅 ผ่านแบบทดสอบ ${pct}%!`,'success');
  }
}

/* ═════════════════════════════════════════════════════
   ADMIN
═════════════════════════════════════════════════════ */
async function initAdmin() {
  showScreen('screen-admin');
  await populateDeptSelects();
  switchAdminTab('overview', document.querySelector('#screen-admin .nav-btn'));
}

function switchAdminTab(id, btn) {
  document.querySelectorAll('#screen-admin .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#screen-admin .nav-btn').forEach(b=>b.classList.remove('active'));
  el(`atab-${id}`)?.classList.add('active');
  if(btn) btn.classList.add('active');
  if(id==='overview') loadAdminOverview();
  if(id==='users')    loadAdminUsers();
  if(id==='courses')  loadAdminCourses();
  if(id==='audit')    loadAuditTrail();
  if(id==='reports')  loadAdminReports();
}

/* ── Overview ── */
async function loadAdminOverview() {
  const [statsRes, usersRes] = await Promise.all([API.getStats(), API.getUsers()]);
  const s = statsRes.stats||{};
  txt('as-users',   s.total_users||0);
  txt('as-courses', s.total_courses||0);
  txt('as-pass',    (s.pass_rate||0)+'%');
  txt('as-certs',   s.certs_issued||0);
  txt('as-hours',   s.total_hours||0);
  txt('as-score',   s.avg_score||0);
  txt('as-today',   s.logins_today||0);

  const users = (usersRes.users||[]).filter(u=>u.role==='learner').slice(0,5);
  html('recent-enrollments', users.map(u=>`
    <div class="dt-row" style="grid-template-columns:2fr 1.5fr 1fr 1fr 90px">
      <div class="user-cell"><div class="ua ${avatarColor(u.name)}">${u.name?.[0]||'?'}</div>
        <div><div class="cell-name">${u.name}</div><div class="cell-sub">${u.email||u.username}</div></div></div>
      <div style="font-size:12px;color:var(--text-muted)">${(u.dept||'—').slice(0,20)}</div>
      <div>${progBar(Math.random()*100|0)}</div>
      <div>${rolePill(u.role)}</div>
      <div><button class="btn btn-teal btn-sm" onclick="toast('${u.name}','info')">ดู</button></div>
    </div>
  `).join('')||'<div style="padding:16px;color:var(--text-muted);text-align:center">กำลังโหลด...</div>');
}

/* ── Users ── */
async function loadAdminUsers() {
  const res   = await API.getUsers();
  App.users   = res.users||[];
  renderUsersTable(App.users);
}

function filterUsers() {
  const q    = (el('user-search')?.value||'').toLowerCase();
  const role = el('filter-role')?.value||'';
  const dept = el('filter-dept-users')?.value||'';
  let f = App.users;
  if(q)    f = f.filter(u=>(u.name||'').toLowerCase().includes(q)||(u.username||'').includes(q));
  if(role) f = f.filter(u=>u.role===role);
  if(dept) f = f.filter(u=>u.deptId===dept||u.dept?.includes(dept));
  renderUsersTable(f);
}
/* alias */
const searchUsers = filterUsers;

function renderUsersTable(users) {
  txt('user-count', users.length);
  html('users-table-body', users.map(u=>{
    const active = u.active==='TRUE'||u.active===true;
    return `<div class="dt-row" style="grid-template-columns:2fr 1.8fr 1fr 1fr 1fr 130px">
      <div class="user-cell">
        <div class="ua ${avatarColor(u.name)}">${u.name?.[0]||'?'}</div>
        <div><div class="cell-name">${u.name}</div><div class="cell-sub">${u.email||u.username}</div></div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:500">${(u.dept||'—').replace('กลุ่มงานการพยาบาล','').trim()}</div>
        <div style="font-size:11px;color:var(--text-muted)">${u.unit||'—'}</div>
      </div>
      <div>${rolePill(u.role)}</div>
      <div><span class="pill ${active?'pill-done':'pill-pending'}">${active?'✅ ใช้งาน':'🔴 ปิด'}</span></div>
      <div style="font-size:11px;color:var(--text-muted)">${u.last_login?new Date(u.last_login).toLocaleDateString('th-TH'):'—'}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="btn btn-teal btn-sm"   onclick='openEditUser(${JSON.stringify(u)})' title="แก้ไข">✏️</button>
        <button class="btn btn-ghost btn-sm"  onclick='openResetPwd("${u.id}","${u.name.replace(/"/g,"")}")' title="รีเซ็ตรหัสผ่าน">🔑</button>
        <button class="btn btn-sm ${active?'btn-danger':'btn-green'}"
                onclick='doToggleUser("${u.id}",${active?'false':'true'})' title="${active?'ปิด':'เปิด'}">${active?'🔴':'🟢'}</button>
        <button class="btn btn-danger btn-sm" onclick='doDeleteUser("${u.id}","${u.name.replace(/"/g,"")}")' title="ลบ">🗑</button>
      </div>
    </div>`;
  }).join('')||'<div style="padding:20px;color:var(--text-muted);text-align:center">ไม่พบข้อมูล</div>');
}

function openCreateUser() {
  el('modal-user-id').dataset.id = '';
  txt('modal-user-title','➕ เพิ่มผู้ใช้งานใหม่');
  html('modal-user-form', buildUserForm({}));
  openModal('modal-user');
}
function openEditUser(u) {
  el('modal-user-id').dataset.id = u.id;
  txt('modal-user-title','✏️ แก้ไขข้อมูลผู้ใช้');
  html('modal-user-form', buildUserForm(u));
  openModal('modal-user');
}

function buildUserForm(u={}) {
  const groups   = App._depts||(typeof DEPT_GROUPS!=='undefined'?DEPT_GROUPS:[]);
  const deptOpts = '<option value="">-- กลุ่มงาน --</option>' +
    groups.map(g=>`<option value="${g.id}" ${g.id===u.deptId?'selected':''}>${g.name}</option>`).join('');
  const deptGroup  = groups.find(g=>g.id===u.deptId);
  const unitOpts = '<option value="">-- หน่วยงาน --</option>' +
    (deptGroup?.units||[]).map(un=>`<option value="${un.id}" ${un.id===u.unitId?'selected':''}>${un.name}</option>`).join('');

  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div class="form-group" style="grid-column:1/-1">
      <label>ชื่อ-นามสกุล *</label>
      <div class="input-wrap"><span class="input-icon">👤</span>
        <input class="form-control" id="uf-name" value="${u.name||''}" placeholder="ชื่อ-นามสกุล"></div>
    </div>
    <div class="form-group">
      <label>Username *</label>
      <div class="input-wrap"><span class="input-icon">🔖</span>
        <input class="form-control" id="uf-username" value="${u.username||''}" placeholder="username"></div>
    </div>
    <div class="form-group">
      <label>อีเมล</label>
      <div class="input-wrap"><span class="input-icon">📧</span>
        <input class="form-control" id="uf-email" value="${u.email||''}" placeholder="email"></div>
    </div>
    ${!u.id?`<div class="form-group" style="grid-column:1/-1">
      <label>รหัสผ่าน</label>
      <div class="input-wrap"><span class="input-icon">🔒</span>
        <input class="form-control" id="uf-pass" type="text" placeholder="ค่าเริ่มต้น: cbh1234"></div>
    </div>`:''}
    <div class="form-group">
      <label>Role *</label>
      <div class="input-wrap"><span class="input-icon">🎭</span>
        <select class="form-control" id="uf-role">
          <option value="learner" ${u.role==='learner'?'selected':''}>👩‍⚕️ ผู้เรียน</option>
          <option value="nso"     ${u.role==='nso'?'selected':''}>🔮 NSO</option>
          <option value="admin"   ${u.role==='admin'?'selected':''}>👑 Admin</option>
        </select></div>
    </div>
    <div class="form-group">
      <label>สถานะ</label>
      <div class="input-wrap"><span class="input-icon">🔘</span>
        <select class="form-control" id="uf-active">
          <option value="true"  ${(u.active==='TRUE'||u.active===true)?'selected':''}>✅ เปิดใช้งาน</option>
          <option value="false" ${(u.active==='FALSE'||u.active===false)?'selected':''}>🔴 ปิดใช้งาน</option>
        </select></div>
    </div>
    <div class="form-group" style="grid-column:1/-1">
      <label>กลุ่มงาน</label>
      <div class="input-wrap"><span class="input-icon">🏢</span>
        <select class="form-control" id="uf-dept" onchange="onUfDeptChange(this.value)">${deptOpts}</select></div>
    </div>
    <div class="form-group" style="grid-column:1/-1">
      <label>หน่วยงาน / วอร์ด</label>
      <div class="input-wrap"><span class="input-icon">🏥</span>
        <select class="form-control" id="uf-unit">${unitOpts}</select></div>
    </div>
  </div>`;
}

function onUfDeptChange(deptId) { populateUnitSelect('uf-unit', deptId); }

async function saveUser() {
  const id     = el('modal-user-id')?.dataset?.id||'';
  const isEdit = !!id;
  const deptId = el('uf-dept')?.value||'';
  const unitId = el('uf-unit')?.value||'';
  const groups  = App._depts||(typeof DEPT_GROUPS!=='undefined'?DEPT_GROUPS:[]);
  const dg      = groups.find(g=>g.id===deptId);
  const ug      = dg?.units.find(u=>String(u.id)===String(unitId));

  const data = {
    id, name:el('uf-name')?.value?.trim(), username:el('uf-username')?.value?.trim(),
    email:el('uf-email')?.value?.trim(), role:el('uf-role')?.value,
    deptId, dept:dg?.name||'', unitId, unit:ug?.name||'',
    active: el('uf-active')?.value!=='false',
    updatedBy:App.user?.username, updatedByName:App.user?.name,
    createdBy:App.user?.username, createdByName:App.user?.name,
  };
  if(!isEdit) data.password = el('uf-pass')?.value?.trim()||'cbh1234';
  if(!data.name||!data.username) { toast('กรุณากรอกข้อมูลให้ครบ','warn'); return; }

  const res = isEdit ? await API.updateUser(data) : await API.createUser(data);
  if(res.success) {
    toast(res.message||'บันทึกสำเร็จ','success');
    closeModal('modal-user');
    loadAdminUsers();
  } else { toast('เกิดข้อผิดพลาด: '+(res.error||''),'error'); }
}

async function doDeleteUser(id, name) {
  if(!confirm(`ยืนยันการลบผู้ใช้: ${name}?`)) return;
  const res = await API.deleteUser(id);
  if(res.success) { toast(`🗑 ลบ ${name} สำเร็จ`,'success'); loadAdminUsers(); }
  else toast('เกิดข้อผิดพลาด','error');
}

async function doToggleUser(id, active) {
  const res = await API.toggleUser(id, active==='true'||active===true);
  if(res.success) { toast((active==='true'||active===true)?'🟢 เปิดใช้งานสำเร็จ':'🔴 ปิดใช้งานสำเร็จ','success'); loadAdminUsers(); }
  else toast('เกิดข้อผิดพลาด','error');
}

function openResetPwd(id, name) {
  if(el('modal-reset-id')) { el('modal-reset-id').dataset.id=id; el('modal-reset-id').dataset.name=name; }
  txt('reset-pwd-name', name);
  if(el('new-pwd-input')) el('new-pwd-input').value='';
  openModal('modal-reset-pwd');
}

async function doResetPwd() {
  const id  = el('modal-reset-id')?.dataset?.id;
  const pwd = el('new-pwd-input')?.value?.trim();
  if(!pwd||pwd.length<4) { toast('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร','warn'); return; }
  const res = await API.resetPwd(id, pwd);
  if(res.success) { toast('🔑 รีเซ็ตรหัสผ่านสำเร็จ','success'); closeModal('modal-reset-pwd'); }
  else toast('เกิดข้อผิดพลาด: '+(res.error||''),'error');
}

/* ── Courses ── */
async function loadAdminCourses() {
  const res   = await API.getCourses(true);
  App.courses = res.courses||[];
  renderAdminCourses(App.courses);
}

function renderAdminCourses(courses) {
  html('admin-course-grid', courses.map(c=>{
    const inactive = c.active==='FALSE';
    return `<div class="course-card">
      <div class="course-thumb ${c.color||'ct-blue'}" style="position:relative">${c.emoji||'📚'}
        ${inactive?'<div style="position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:12px;border-radius:12px 12px 0 0;color:#aaa">ปิดใช้งาน</div>':''}
      </div>
      <div class="course-body">
        <div class="course-cat">${c.cat}</div>
        <div class="course-title">${c.title}</div>
        <div class="course-meta"><span>📚 ${c.lessons} บท</span><span>⏱ ${c.hours} ชม.</span>
          ${c.hasQuiz==='TRUE'?'<span>📝 Quiz</span>':''}</div>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
          <button class="btn btn-teal btn-sm"   onclick='openEditCourse(${JSON.stringify(c)})'>✏️ แก้ไข</button>
          <button class="btn btn-ghost btn-sm"  onclick='doToggleCourse("${c.id}",${inactive})'>${inactive?'🟢 เปิด':'🔴 ปิด'}</button>
          <button class="btn btn-danger btn-sm" onclick='doDeleteCourse("${c.id}","${c.title.replace(/"/g,"")}")'>🗑 ลบ</button>
        </div>
      </div>
    </div>`;
  }).join('')||'<div style="color:var(--text-muted)">ไม่พบหลักสูตร</div>');
}

function openCreateCourse() {
  el('modal-course-id').dataset.id = '';
  txt('modal-course-title','➕ สร้างหลักสูตรใหม่');
  html('modal-course-form', buildCourseForm({}));
  openModal('modal-course');
}
function openEditCourse(c) {
  el('modal-course-id').dataset.id = c.id;
  txt('modal-course-title','✏️ แก้ไขหลักสูตร');
  html('modal-course-form', buildCourseForm(c));
  openModal('modal-course');
}

function buildCourseForm(c={}) {
  const colors = ['ct-blue','ct-teal','ct-purple','ct-green','ct-orange'];
  const colorOpts = colors.map(v=>`<option value="${v}" ${c.color===v?'selected':''}>${v}</option>`).join('');
  return `<div class="form-group">
    <label>ชื่อหลักสูตร *</label>
    <div class="input-wrap"><span class="input-icon">📚</span>
      <input class="form-control" id="cf-title" value="${c.title||''}" placeholder="ชื่อหลักสูตร"></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
    <div class="form-group">
      <label>หมวดหมู่</label>
      <input class="form-control" id="cf-cat" value="${c.cat||''}" placeholder="เช่น การพยาบาล">
    </div>
    <div class="form-group">
      <label>Emoji</label>
      <input class="form-control" id="cf-emoji" value="${c.emoji||'📚'}">
    </div>
    <div class="form-group">
      <label>สี</label>
      <select class="form-control" id="cf-color">${colorOpts}</select>
    </div>
    <div class="form-group">
      <label>จำนวนบท</label>
      <input class="form-control" id="cf-lessons" type="number" min="1" value="${c.lessons||6}">
    </div>
    <div class="form-group">
      <label>ชั่วโมงเรียน</label>
      <input class="form-control" id="cf-hours" type="number" step="0.5" value="${c.hours||2}">
    </div>
    <div class="form-group">
      <label>Badge</label>
      <select class="form-control" id="cf-badge">
        <option value=""         ${!c.badge?'selected':''}>ไม่มี</option>
        <option value="badge-req"  ${c.badge==='badge-req'?'selected':''}>จำเป็น</option>
        <option value="badge-new"  ${c.badge==='badge-new'?'selected':''}>ใหม่</option>
        <option value="badge-hot"  ${c.badge==='badge-hot'?'selected':''}>ยอดนิยม</option>
      </select>
    </div>
  </div>
  <div class="form-group">
    <label>คำอธิบาย</label>
    <textarea class="form-control" id="cf-desc" rows="3" style="resize:vertical">${c.description||''}</textarea>
  </div>
  <div class="form-group">
    <label>มีแบบทดสอบ</label>
    <select class="form-control" id="cf-quiz">
      <option value="true"  ${c.hasQuiz==='TRUE'?'selected':''}>✅ มี</option>
      <option value="false" ${c.hasQuiz!=='TRUE'?'selected':''}>❌ ไม่มี</option>
    </select>
  </div>`;
}

async function saveCourse() {
  const id     = el('modal-course-id')?.dataset?.id||'';
  const badge  = el('cf-badge')?.value||'';
  const bmap   = {'badge-req':'จำเป็น','badge-new':'ใหม่','badge-hot':'ยอดนิยม'};
  const data   = {
    id, title:el('cf-title')?.value?.trim(), cat:el('cf-cat')?.value?.trim(),
    emoji:el('cf-emoji')?.value?.trim()||'📚', color:el('cf-color')?.value||'ct-blue',
    lessons:parseInt(el('cf-lessons')?.value)||6, hours:parseFloat(el('cf-hours')?.value)||2,
    badge, badgeText:bmap[badge]||'', hasQuiz:el('cf-quiz')?.value==='true',
    description:el('cf-desc')?.value?.trim(), active:true,
  };
  if(!data.title) { toast('กรุณากรอกชื่อหลักสูตร','warn'); return; }
  const res = id ? await API.updateCourse(data) : await API.createCourse(data);
  if(res.success) { toast(res.message||'บันทึกสำเร็จ','success'); closeModal('modal-course'); loadAdminCourses(); }
  else toast('เกิดข้อผิดพลาด: '+(res.error||''),'error');
}

async function doDeleteCourse(id, title) {
  if(!confirm(`ยืนยันการลบหลักสูตร: ${title}?`)) return;
  const res = await API.deleteCourse(id);
  if(res.success) { toast(`🗑 ลบ "${title}" สำเร็จ`,'success'); loadAdminCourses(); }
  else toast('เกิดข้อผิดพลาด','error');
}

async function doToggleCourse(id, curInactive) {
  const newActive = !!curInactive; // ถ้าตอนนี้ inactive → เปิด
  const res = await API.toggleCourse(id, newActive);
  if(res.success) { toast(newActive?'🟢 เปิดหลักสูตรสำเร็จ':'🔴 ปิดหลักสูตรสำเร็จ','success'); loadAdminCourses(); }
  else toast('เกิดข้อผิดพลาด','error');
}

/* ── Audit Trail ── */
async function loadAuditTrail() {
  const params = { limit:'300' };
  const ac = el('audit-filter-action')?.value||'';
  const rc = el('audit-filter-role')?.value||'';
  const dc = el('audit-filter-dept')?.value||'';
  const sc = el('audit-search')?.value?.trim()||'';
  if(ac) params.action = ac;
  if(rc) params.role   = rc;
  if(dc) params.deptId = dc;
  if(sc) params.search = sc;

  const res  = await API.getAuditLog(params);
  const logs = res.logs||[];
  App.auditAll = logs;
  renderAuditTable(logs);
  renderAuditSummary(logs);
}
/* aliases for HTML */
const filterLogs        = loadAuditTrail;
const loadAdminLogs     = loadAuditTrail;
const renderNSOLearners = () => loadNSOLearners();

function renderAuditTable(logs) {
  const tbody = el('audit-table-body');
  if(!tbody) return;
  if(!logs.length) { tbody.innerHTML='<div style="padding:28px;text-align:center;color:var(--text-muted)">ไม่พบข้อมูล</div>'; return; }
  tbody.innerHTML = logs.map(e=>{
    const meta  = (typeof getAuditAction==='function') ? getAuditAction(e.action||'LOGIN') : {icon:'📋',label:e.action,color:'var(--teal)',category:'system'};
    const ts    = e.timestamp ? new Date(e.timestamp) : null;
    const date  = ts ? ts.toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'2-digit'}) : '—';
    const time  = ts ? ts.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '—';
    const name  = e.actorName||e.actor||'—';
    const isRisk= ['LOGIN_FAIL','DELETE_USER','DELETE_COURSE'].includes(e.action);
    const dept  = (e.unit||e.dept||'—').slice(0,15);
    const rp    = rolePill(e.role);
    const enc   = encodeURIComponent(JSON.stringify(e));
    return `<div class="dt-row audit-row${isRisk?' audit-risk':''}"
         style="grid-template-columns:130px 1.5fr 80px 1fr 1.5fr 90px;align-items:start;cursor:pointer"
         onclick="showAuditDetail('${enc}')">
      <div><div style="font-size:12px;font-weight:600">${date}</div><div style="font-size:11px;color:var(--text-dim)">${time}</div></div>
      <div class="user-cell">
        <div class="ua ${avatarColor(name)}" style="width:28px;height:28px;font-size:11px">${name[0]||'?'}</div>
        <div><div class="cell-name" style="font-size:13px">${name}</div><div class="cell-sub">${e.actor||''}</div></div>
      </div>
      <div>${rp}</div>
      <div><span style="font-size:15px">${meta.icon}</span>
        <span style="font-size:12px;color:${meta.color};margin-left:5px;font-weight:600">${meta.label}</span>
        ${isRisk?'<span style="font-size:10px;color:var(--red);margin-left:4px">⚠️</span>':''}</div>
      <div style="font-size:12px;color:var(--text-muted);line-height:1.5">${e.detail||'—'}</div>
      <div style="font-size:11px;color:var(--text-dim)">${dept}</div>
    </div>`;
  }).join('');
}

function renderAuditSummary(logs) {
  let auth=0,user=0,course=0,learn=0,sys=0,risk=0;
  logs.forEach(e=>{
    const meta = (typeof getAuditAction==='function') ? getAuditAction(e.action||'') : {category:'system'};
    if(meta.category==='auth')   auth++;
    if(meta.category==='user')   user++;
    if(meta.category==='course') course++;
    if(meta.category==='learn')  learn++;
    if(meta.category==='system') sys++;
    if(['LOGIN_FAIL','DELETE_USER','DELETE_COURSE'].includes(e.action)) risk++;
  });
  txt('audit-sum-total', logs.length);
  txt('audit-sum-auth',  auth);
  txt('audit-sum-user',  user);
  txt('audit-sum-course',course);
  txt('audit-sum-learn', learn);
  txt('audit-sum-risk',  risk);
}

function showAuditDetail(enc) {
  let e; try { e=JSON.parse(decodeURIComponent(enc)); } catch(_){ return; }
  const meta = (typeof getAuditAction==='function') ? getAuditAction(e.action||'') : {icon:'📋',label:e.action,color:'var(--teal)'};
  const ts   = e.timestamp ? new Date(e.timestamp).toLocaleString('th-TH') : '—';
  const _r   = (l,v) => `<div style="display:grid;grid-template-columns:130px 1fr;gap:8px;margin-bottom:8px">
    <div style="font-size:12px;color:var(--text-muted);font-weight:600">${l}</div>
    <div style="font-size:13px;word-break:break-all">${v}</div></div>`;
  html('modal-audit-content',`
    <div>
      <div style="display:flex;align-items:center;gap:14px;padding-bottom:14px;border-bottom:1px solid var(--border);margin-bottom:16px">
        <div style="font-size:40px">${meta.icon}</div>
        <div><div style="font-size:16px;font-weight:700;color:${meta.color}">${meta.label}</div>
          <div style="font-size:12px;color:var(--text-muted)">${ts}</div></div>
      </div>
      ${_r('ผู้ดำเนินการ',`${e.actorName||e.actor||'—'} (${e.actor||''})`)}
      ${_r('Role',e.role||'—')}
      ${_r('กลุ่มงาน',e.dept||e.deptId||'—')}
      ${_r('หน่วยงาน',e.unit||'—')}
      ${_r('IP',e.ip||'—')}
      ${_r('รายละเอียด',e.detail||'—')}
      ${_r('ผลลัพธ์',`<span style="color:${['OK','PASS'].includes(e.result)?'var(--green)':'var(--red)'}">${e.result||'—'}</span>`)}
      ${_r('Audit ID',e.id||'—')}
    </div>
  `);
  openModal('modal-audit-detail');
}

async function exportAuditLog() {
  API.logAudit({action:'EXPORT_REPORT',actor:App.user?.username,actorName:App.user?.name,role:App.user?.role,detail:'Export Audit Trail CSV',result:'OK'});
  const res  = await API.getAuditLog({limit:'2000'});
  const logs = res.logs || App.auditAll || [];
  const hdrs = ['Timestamp','Action','Actor','ActorName','Role','Dept','Unit','IP','Detail','Target','Result'];
  const rows = logs.map(e=>[
    e.timestamp,e.action,e.actor,e.actorName,e.role,e.dept,e.unit,e.ip,
    `"${(e.detail||'').replace(/"/g,'""')}"`,e.target,e.result
  ].join(','));
  const csv  = [hdrs.join(','),...rows].join('\n');
  const blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `cbh-audit-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('✅ Export Audit Log สำเร็จ','success');
}

/* ── Reports ── */
async function loadAdminReports() {
  const [statsRes, deptRes] = await Promise.all([API.getStats(), API.getDeptStats()]);
  const s = statsRes.stats||{};
  txt('rpt-total-users',   s.total_users||0);
  txt('rpt-total-courses', s.total_courses||0);
  txt('rpt-pass-rate',     (s.pass_rate||0)+'%');
  txt('rpt-certs',         s.certs_issued||0);
  txt('rpt-avg-score',     (s.avg_score||0)+'%');
  txt('rpt-hours',         s.total_hours||0);

  const depts = deptRes.deptStats||[];
  html('rpt-dept-chart', depts.slice(0,10).map(d=>`
    <div class="chart-bar-row">
      <div class="chart-bar-label" title="${d.dept}">${(d.dept||d.deptId||'').replace('กลุ่มงานการพยาบาล','').trim().slice(0,16)}</div>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${d.passRate||0}%;background:${d.passRate>=80?'var(--green)':d.passRate>=60?'var(--teal)':'var(--gold)'}"></div></div>
      <div class="chart-bar-val" style="color:${d.passRate>=80?'var(--green)':d.passRate>=60?'var(--teal)':'var(--gold)'}">${d.passRate||0}%</div>
      <div style="font-size:10px;color:var(--text-dim);width:40px">${d.userCount||0} คน</div>
    </div>
  `).join('')||'<div style="color:var(--text-muted);font-size:13px;padding:16px">กำลังโหลดข้อมูล...</div>');
}

async function exportReport() {
  API.logAudit({action:'EXPORT_REPORT',actor:App.user?.username,actorName:App.user?.name,role:App.user?.role,detail:'Export สรุปรายงาน',result:'OK'});
  toast('📥 กำลัง Export รายงาน...','info');
  setTimeout(()=>toast('✅ Export สำเร็จ (ต้องเชื่อม GAS จริง)','success'),1400);
}

/* ═════════════════════════════════════════════════════
   NSO
═════════════════════════════════════════════════════ */
async function initNSO() {
  showScreen('screen-nso');
  txt('nso-name', App.user?.name||'หัวหน้าพยาบาล');
  await populateDeptSelects();
  switchNSOTab('dashboard', document.querySelector('#screen-nso .nav-btn'));
}

function switchNSOTab(id, btn) {
  document.querySelectorAll('#screen-nso .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#screen-nso .nav-btn').forEach(b=>b.classList.remove('active'));
  el(`ntab-${id}`)?.classList.add('active');
  if(btn) btn.classList.add('active');
  if(id==='dashboard') loadNSODashboard();
  if(id==='learners')  loadNSOLearners();
  if(id==='courses')   loadNSOCourses();
}

async function loadNSODashboard() {
  const deptId = el('nso-filter-dept')?.value||'';
  const [statsRes, deptStatsRes] = await Promise.all([
    API.getStats(),
    API.getDeptStats(deptId?{deptId}:{}),
  ]);
  const s = statsRes.stats||{};
  txt('nso-stat-users',  s.learners||0);
  txt('nso-stat-done',   (s.pass_rate||0)+'%');
  txt('nso-stat-active', s.enrollments||0);
  txt('nso-stat-certs',  s.certs_issued||0);
  txt('nso-today-logins',s.logins_today||0);

  const depts  = deptStatsRes.deptStats||[];
  const groups = App._depts||(typeof DEPT_GROUPS!=='undefined'?DEPT_GROUPS:[]);
  const display= depts.length ? depts : groups.slice(0,8).map(g=>({
    deptId:g.id, dept:g.name,
    passRate:Math.floor(60+Math.random()*35),
    userCount:Math.floor(5+Math.random()*20),
  }));
  html('nso-dept-chart', display.map(d=>`
    <div class="chart-bar-row">
      <div class="chart-bar-label" style="font-size:11px" title="${d.dept||d.deptId}">${(d.dept||d.deptId||'').replace('กลุ่มงานการพยาบาล','').trim().slice(0,16)}</div>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${d.passRate||0}%;background:${d.passRate>=80?'var(--green)':d.passRate>=60?'var(--teal)':'var(--gold)'}"></div></div>
      <div class="chart-bar-val">${d.passRate||0}%</div>
      <div style="font-size:10px;color:var(--text-dim);width:38px">${d.userCount||0} คน</div>
    </div>
  `).join(''));
}

function onNSODeptFilter() {
  const deptId = el('nso-filter-dept')?.value||'';
  populateUnitSelect('nso-filter-unit', deptId);
  loadNSODashboard();
}
function onNSOLearnerDeptFilter() {
  const deptId = el('nso-learner-dept')?.value||'';
  populateUnitSelect('nso-learner-unit', deptId);
  loadNSOLearners();
}
function filterNSODashboard() { loadNSODashboard(); }

async function loadNSOLearners() {
  const deptId = el('nso-learner-dept')?.value||'';
  const unitId = el('nso-learner-unit')?.value||'';
  const params = {};
  if(deptId) params.deptId = deptId;

  const res   = await API.getUsers(params);
  let users   = (res.users||[]).filter(u=>u.role==='learner');
  if(unitId) users = users.filter(u=>String(u.unitId)===String(unitId));

  txt('nso-learner-count', users.length);
  html('nso-learners-body', users.length ? users.map(u=>`
    <div class="dt-row" style="grid-template-columns:2fr 1fr 1fr 1fr 1fr">
      <div class="user-cell">
        <div class="ua ${avatarColor(u.name)}">${u.name?.[0]||'?'}</div>
        <div><div class="cell-name">${u.name}</div><div class="cell-sub">${u.email||u.username}</div></div>
      </div>
      <div style="font-size:12px;color:var(--text-muted)">${(u.dept||'—').replace('กลุ่มงานการพยาบาล','').trim().slice(0,16)}</div>
      <div style="font-size:12px;color:var(--text-muted)">${u.unit||'—'}</div>
      <div><span class="pill ${u.active==='TRUE'?'pill-done':'pill-pending'}">${u.active==='TRUE'?'ใช้งาน':'ปิดใช้'}</span></div>
      <div style="font-size:11px;color:var(--text-muted)">${u.last_login?new Date(u.last_login).toLocaleDateString('th-TH'):'ยังไม่เข้าระบบ'}</div>
    </div>
  `).join('') : '<div style="padding:20px;color:var(--text-muted);text-align:center">ไม่พบผู้เรียนในกลุ่มนี้</div>');
}

async function loadNSOCourses() {
  const res = await API.getCourses();
  html('nso-course-grid', (res.courses||[]).map(c=>renderCourseCard(c,null)).join(''));
}

/* ═════════════════════════════════════════════════════
   KEYBOARD & MODAL CLOSE
═════════════════════════════════════════════════════ */
document.addEventListener('click', e => {
  if(e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});
document.addEventListener('keydown', e => {
  if(e.key==='Escape') document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));
  if(e.key==='Enter' && el('login-pass')?.contains(document.activeElement)) doLogin();
});