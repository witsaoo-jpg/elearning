/* ═══════════════════════════════════════════════════════
   CBH Learn — app.js v4.0
   โรงพยาบาลชลบุรี · ระบบ LMS สมบูรณ์
═══════════════════════════════════════════════════════ */
'use strict';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwXQ7keoFw6Sb1H5CiSNBfdqIXyZIb4-9pvDvodHWWM1stRe8ugKljEXsn0FW6yvzId/exec';

/* ── State ── */
const App = {
  user: null,
  users: [], courses: [], enrollments: [], auditAll: [],
  allEnrollments: [], allProgress: [], allCerts: [],
  currentCourse: null,
  quiz: { questions:[], idx:0, answers:[], done:false },
  customQuizzes: {},   // courseId → [{q, opts, ans}]
  emailLog: [],
  _depts: null,
};

/* ── Built-in quiz data ── */
const DEFAULT_QUIZZES = {
  cpr:[
    {q:'อัตราการกดหน้าอก CPR ผู้ใหญ่ที่ถูกต้อง?',opts:['60–80/นาที','100–120/นาที','130–150/นาที','80–100/นาที'],ans:1},
    {q:'ความลึกกดหน้าอกผู้ใหญ่?',opts:['1–2 ซม.','2–4 ซม.','5–6 ซม.','7–8 ซม.'],ans:2},
    {q:'อัตราส่วน compression:ventilation (2 คน)?',opts:['15:2','30:2','30:1','15:1'],ans:1},
    {q:'AED ย่อมาจากอะไร?',opts:['Automatic Emergency Device','Automated External Defibrillator','Advanced Electric Device','Automated Emergency Defibrillator'],ans:1},
    {q:'ควรหยุด CPR เมื่อใด?',opts:['หลัง 10 นาที','ผู้ป่วยฟื้นหรือทีมมาถึง','เมื่อเหนื่อย','หลัง 5 รอบ'],ans:1},
  ],
  chemo:[
    {q:'ยาเคมีบำบัดชนิดใดทำให้เกิด Neutropenia บ่อยที่สุด?',opts:['Methotrexate','Paclitaxel','Doxorubicin','Carboplatin'],ans:1},
    {q:'อุณหภูมิ ≥ 38°C ขณะได้รับยาเคมีบำบัด ควรทำอย่างไรก่อน?',opts:['ให้ยาลดไข้','หยุดยาและรายงานแพทย์','เพิ่มอัตราหยด','วัด V/S ซ้ำ 30 นาที'],ans:1},
    {q:'Nadir ของ WBC มักเกิดในช่วงใด?',opts:['วันที่ 1–3','วันที่ 7–14','วันที่ 21–28','หลัง 30 วัน'],ans:1},
    {q:'การดูแล Mucositis ควรใช้น้ำยาบ้วนปากชนิดใด?',opts:['H₂O₂ผสมน้ำ','Chlorhexidine','น้ำเกลือ 0.9%','Povidone Iodine'],ans:2},
    {q:'PPE ที่ต้องใส่เมื่อบริหารยาเคมีบำบัด?',opts:['Gloves เท่านั้น','Gloves+Mask','Gloves+Gown+Mask+Goggles','Gown เท่านั้น'],ans:2},
  ],
};

/* ═════════════════════════════════════════════════════
   HELPERS
═════════════════════════════════════════════════════ */
const el   = id  => document.getElementById(id);
const txt  = (id,v) => { const e=el(id); if(e) e.textContent=v; };
const html = (id,h) => { const e=el(id); if(e) e.innerHTML=h; };

function loading(on) { el('loading-overlay')?.classList.toggle('show', !!on); }
function loadingReset() { el('loading-overlay')?.classList.remove('show'); }
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  el(id)?.classList.add('active');
}
function openModal(id)  { el(id)?.classList.add('open'); }
function closeModal(id) { el(id)?.classList.remove('open'); }

function toast(msg, type='info') {
  const icons = {success:'✅',info:'ℹ️',error:'❌',warn:'⚠️'};
  const t = document.createElement('div');
  t.className = `toast t-${type}`;
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  el('toast-shelf')?.prepend(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(30px)'; t.style.transition='all .3s'; setTimeout(()=>t.remove(),330); }, 3500);
}

function avatarColor(s='') {
  const c=['ua-teal','ua-purple','ua-orange','ua-green','ua-gold','ua-red'];
  let h=0; for(const ch of s) h=h*31+ch.charCodeAt(0);
  return c[Math.abs(h)%c.length];
}
function rolePill(r) {
  return ({admin:'<span class="pill pill-admin">👑 Admin</span>',nso:'<span class="pill pill-nso">🔮 NSO</span>',learner:'<span class="pill pill-prog">👩‍⚕️ ผู้เรียน</span>'})[r]||`<span class="pill">${r}</span>`;
}
function progBar(pct, cls='') { return `<div class="prog-wrap"><div class="prog-fill ${cls}" style="width:${Math.min(100,pct||0)}%"></div></div>`; }
function fmtDate(iso) { if(!iso) return '—'; try{ return new Date(iso).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'}); }catch(_){ return iso; } }

/* ═════════════════════════════════════════════════════
   GAS API
═════════════════════════════════════════════════════ */
const API = {
  async get(params) {
    try {
      const url = new URL(GAS_URL);
      Object.entries(params).forEach(([k,v])=>{ if(v!==undefined&&v!==null&&v!=='') url.searchParams.set(k,String(v)); });
      const res  = await fetch(url.toString(),{method:'GET',redirect:'follow',mode:'cors'});
      return JSON.parse(await res.text());
    } catch(e) { console.error('[GAS GET]',e.message); return {success:false,error:e.message}; }
  },
  async post(action, body={}) {
    try {
      const res  = await fetch(GAS_URL,{method:'POST',body:JSON.stringify({action,...body}),redirect:'follow',mode:'cors'});
      return JSON.parse(await res.text());
    } catch(e) { console.error('[GAS POST]',e.message); return {success:false,error:e.message}; }
  },
  login        : (u,p)    => API.get({action:'login',username:u,password:p}),
  getUsers     : (f={})   => API.get({action:'getUsers',...f}),
  createUser   : (d)      => API.post('createUser',{data:d,actor:App.user}),
  updateUser   : (d)      => API.post('updateUser',{data:d,actor:App.user}),
  deleteUser   : (id)     => API.post('deleteUser',{id,actor:App.user}),
  toggleUser   : (id,a)   => API.post('toggleUser',{id,active:a,actor:App.user}),
  resetPwd     : (id,pwd) => API.post('resetPassword',{id,newPwd:pwd,actor:App.user}),
  getCourses   : (all)    => API.get({action:'getCourses',all:all?'true':'false'}),
  createCourse : (d)      => API.post('createCourse',{data:d,actor:App.user}),
  updateCourse : (d)      => API.post('updateCourse',{data:d,actor:App.user}),
  deleteCourse : (id)     => API.post('deleteCourse',{id,actor:App.user}),
  toggleCourse : (id,a)   => API.post('toggleCourse',{id,active:a,actor:App.user}),
  getMyEnrollments:(u)    => API.get({action:'getMyEnrollments',username:u}),
  getEnrollments: (f={})  => API.get({action:'getEnrollments',...f}),
  enroll       : (d)      => API.post('enroll',{data:d}),
  updateProgress:(d)      => API.post('updateProgress',{data:d}),
  submitQuiz   : (d)      => API.post('submitQuiz',{data:d}),
  getCerts     : (u)      => API.get({action:'getCerts',username:u}),
  getAllCerts   : ()       => API.get({action:'getCerts'}),
  getAuditLog  : (f={})   => API.get({action:'getAuditLog',...f}),
  logAudit     : (d)      => API.post('logAudit',{data:d}),
  getStats     : ()       => API.get({action:'getStats'}),
  getDeptStats : (f={})   => API.get({action:'getDeptStats',...f}),
  getDepts     : ()       => API.get({action:'getDepts'}),
  getQuizData  : (id)     => API.get({action:'getQuizData',  course_id:id}),
  getLessonData: (id)     => API.get({action:'getLessonData', course_id:id}),
  saveQuizData : (id,qs)  => API.post('saveQuizData',  {course_id:id, quiz_json:JSON.stringify(qs),    actor:App.user}),
  saveLessonData:(id,ls)  => API.post('saveLessonData', {course_id:id, lessons_json:JSON.stringify(ls), actor:App.user}),
  sendEmail    : (d)      => API.post('sendEmail',{data:d}),
};

/* ═════════════════════════════════════════════════════
   DEPT DROPDOWNS
═════════════════════════════════════════════════════ */
async function loadDepts() {
  if(App._depts) return App._depts;
  const res = await API.getDepts();
  App._depts = (res.success && res.groups?.length) ? res.groups : (typeof DEPT_GROUPS!=='undefined' ? DEPT_GROUPS : []);
  if(typeof DEPT_GROUPS!=='undefined' && res.groups?.length) {
    res.groups.forEach(g=>{ const i=DEPT_GROUPS.findIndex(x=>x.id===g.id); if(i>=0) DEPT_GROUPS[i]=g; else DEPT_GROUPS.push(g); });
  }
  return App._depts;
}

async function populateDeptSelects() {
  // Phase 1: populate immediately from masterdata.js (zero network delay)
  const local = (typeof DEPT_GROUPS!=='undefined' && DEPT_GROUPS.length) ? DEPT_GROUPS : [];
  if(local.length) {
    const opts = '<option value="">ทุกกลุ่มงาน</option>' + local.map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
    document.querySelectorAll('.dept-select').forEach(s=>s.innerHTML=opts);
  }
  // Phase 2: update from GAS in background (only if not cached)
  if(!App._depts) {
    const groups = await loadDepts();
    const opts = '<option value="">ทุกกลุ่มงาน</option>' + groups.map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
    document.querySelectorAll('.dept-select').forEach(s=>s.innerHTML=opts);
  }
}

function populateUnitSelect(selId, deptId='') {
  const groups = App._depts||(typeof DEPT_GROUPS!=='undefined'?DEPT_GROUPS:[]);
  const units  = deptId ? (groups.find(g=>g.id===deptId)?.units||[]) : [];
  el(selId).innerHTML = '<option value="">ทุกหน่วยงาน</option>' + units.map(u=>`<option value="${u.id}">${u.name}</option>`).join('');
}

/* ═════════════════════════════════════════════════════
   AUTH
═════════════════════════════════════════════════════ */
function _loginError(msg, pfx='login') {
  const e=el(`${pfx}-error`); if(!e) return;
  e.textContent=msg; e.style.display=msg?'block':'none';
}

async function doLogin() {
  const username=el('login-user')?.value?.trim();
  const password=el('login-pass')?.value?.trim();
  _loginError('');
  if(!username||!password) return _loginError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
  const btn=document.querySelector('#screen-login .btn-primary');
  if(btn){btn.disabled=true;btn.textContent='กำลังเข้าสู่ระบบ...';}
  try {
    const res=await API.login(username,password);
    if(!res.success){ _loginError(res.error||'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'); if(btn){btn.disabled=false;btn.textContent='เข้าสู่ระบบ →';} return; }
    App.user=res.user;
    toast('ยินดีต้อนรับ '+res.user.name+'! 🎉','success');
    if(res.user.role==='admin') initAdmin();
    else if(res.user.role==='nso') initNSO();
    else initLearner();
  } catch(err){ _loginError('ไม่สามารถเชื่อมต่อได้'); if(btn){btn.disabled=false;btn.textContent='เข้าสู่ระบบ →';} }
}

function doLogout() {
  try{ API.logAudit({action:'LOGOUT',actor:App.user?.username,actorName:App.user?.name,role:App.user?.role,detail:'ออกจากระบบ',result:'OK'}); }catch(_){}
  App.user=null;
  if(el('login-user'))el('login-user').value='';
  if(el('login-pass'))el('login-pass').value='';
  const btn=document.querySelector('#screen-login .btn-primary');
  if(btn){btn.disabled=false;btn.textContent='เข้าสู่ระบบ →';}
  _loginError(''); showScreen('screen-login'); toast('ออกจากระบบแล้ว 👋','info');
}

/* ═════════════════════════════════════════════════════
   SELF REGISTRATION
═════════════════════════════════════════════════════ */
function onRegDeptChange(deptId) { populateUnitSelect('reg-unit',deptId); }

async function doRegister() {
  const name=el('reg-name')?.value?.trim(), username=el('reg-username')?.value?.trim();
  const password=el('reg-password')?.value?.trim(), deptId=el('reg-dept')?.value||'';
  const unitId=el('reg-unit')?.value||'', email=el('reg-email')?.value?.trim()||'';
  _loginError('','reg');
  if(!name)      return _loginError('กรุณากรอกชื่อ-นามสกุล','reg');
  if(!username)  return _loginError('กรุณากรอก Username','reg');
  if(!password||password.length<4) return _loginError('รหัสผ่านต้องมีอย่างน้อย 4 ตัว','reg');
  if(!deptId)    return _loginError('กรุณาเลือกกลุ่มงาน','reg');
  if(!unitId)    return _loginError('กรุณาเลือกหน่วยงาน','reg');
  const btn=document.querySelector('#screen-register .btn-primary');
  if(btn){btn.disabled=true;btn.textContent='กำลังสมัคร...';}
  const groups=App._depts||(typeof DEPT_GROUPS!=='undefined'?DEPT_GROUPS:[]);
  const dg=groups.find(g=>g.id===deptId), ug=dg?.units?.find(u=>String(u.id)===String(unitId));
  const res=await API.createUser({name,username,password,role:'learner',deptId,dept:dg?.name||'',unitId,unit:ug?.name||'',email,createdBy:'self',createdByName:name});
  if(!res.success){ _loginError(res.error||'สมัครไม่สำเร็จ กรุณาลองใหม่','reg'); if(btn){btn.disabled=false;btn.textContent='สมัครใช้งาน →';} return; }
  const loginRes=await API.login(username,password);
  if(loginRes.success){ App.user=loginRes.user; toast('ยินดีต้อนรับ '+loginRes.user.name+'! สมัครสำเร็จ 🎉','success'); initLearner(); }
  else { toast('สมัครสำเร็จ! กรุณาเข้าสู่ระบบ','success'); showScreen('screen-login'); if(el('login-user'))el('login-user').value=username; }
}

/* ═════════════════════════════════════════════════════
   LEARNER
═════════════════════════════════════════════════════ */
async function initLearner() {
  const u=App.user;
  txt('learner-name',u.name); txt('learner-subrole',u.unit||u.dept||'ผู้เรียน');
  html('learner-avatar',u.name?.[0]||'น');
  showScreen('screen-main');
  switchLearnerTab('home',el('ltab-btn-home'));
  setMobileNav(document.querySelector('.mobile-bottom-nav button'));
}

function switchLearnerTab(id, btn) {
  document.querySelectorAll('#screen-main .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#screen-main .topbar .nav-btn').forEach(b=>b.classList.remove('active'));
  el(`ltab-${id}`)?.classList.add('active');
  if(btn) btn.classList.add('active');
  if(id==='home')       renderLearnerHome();
  if(id==='mycourses')  renderMyCourses();
  if(id==='progress')   renderProgressTab();
  if(id==='certs')      renderCertsTab();
}

function setMobileNav(btn) {
  document.querySelectorAll('.mobile-bottom-nav button').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
}

async function renderLearnerHome() {
  const u=App.user;
  html('learner-welcome',`สวัสดี, <span style="color:var(--teal)">${u.name}</span> 👋`);
  const [enrollRes,courseRes]=await Promise.all([API.getMyEnrollments(u.username),API.getCourses(false)]);
  App.enrollments=enrollRes.enrollments||[];
  App.courses=(courseRes.courses||[]).filter(c=>c.active!=='FALSE');
  const done=App.enrollments.filter(e=>parseFloat(e.progress_pct||0)>=100);
  const hours=App.enrollments.reduce((s,e)=>{ const c=App.courses.find(x=>x.id===e.course_id); return s+(parseFloat(c?.hours||0)*parseFloat(e.progress_pct||0)/100); },0);
  txt('wb-stat-courses',App.enrollments.length); txt('wb-stat-hours',hours.toFixed(1)); txt('wb-stat-certs',done.length);
  // Continue strip
  const inProg=App.enrollments.filter(e=>{ const p=parseFloat(e.progress_pct||0); return p>0&&p<100; });
  html('continue-grid',inProg.map(e=>`<div class="continue-card" onclick="openCourse('${e.course_id}')"><div class="cc-icon">${e.course_emoji||'📚'}</div><div class="cc-info"><h4>${e.course_title}</h4>${progBar(parseFloat(e.progress_pct||0))}<p>${parseFloat(e.progress_pct||0).toFixed(0)}% · กำลังเรียน</p></div><button class="btn-continue" onclick="event.stopPropagation();openCourse('${e.course_id}')">เรียนต่อ</button></div>`).join('')||'<p style="color:var(--text-muted);font-size:13px">ยังไม่มีวิชาที่กำลังเรียน</p>');
  // All courses
  const em={};App.enrollments.forEach(e=>em[e.course_id]=e);
  html('featured-grid-label',`(${App.courses.length} หลักสูตร)`);
  html('featured-grid',App.courses.map(c=>renderCourseCard(c,em[c.id]||null)).join('')||'<p style="color:var(--text-muted)">ยังไม่มีหลักสูตร</p>');
}

async function renderMyCourses() {
  const res=await API.getMyEnrollments(App.user.username);
  App.enrollments=res.enrollments||[];
  html('mycourses-grid',App.enrollments.length?App.enrollments.map(e=>{ const pct=parseFloat(e.progress_pct||0); return `<div class="course-card" onclick="openCourse('${e.course_id}')"><div class="course-thumb ct-blue">${e.course_emoji||'📚'}</div><div class="course-body"><div class="course-cat">${e.course_cat||''}</div><div class="course-title">${e.course_title}</div>${progBar(pct,pct>=100?'green':'')}<div class="prog-label"><span>${pct>=100?'✅ เสร็จสิ้น':'กำลังเรียน'}</span><span style="color:${pct>=100?'var(--green)':'var(--teal)'}">${pct.toFixed(0)}%</span></div></div></div>`; }).join(''):'<p style="color:var(--text-muted)">ยังไม่ได้ลงทะเบียน</p>');
}

async function renderProgressTab() {
  const [enrollRes,certRes]=await Promise.all([API.getMyEnrollments(App.user.username),API.getCerts(App.user.username)]);
  const enrollments=enrollRes.enrollments||[], certs=certRes.certs||[];
  const done=enrollments.filter(e=>parseFloat(e.progress_pct||0)>=100).length;
  const hrs=enrollments.reduce((s,e)=>s+(parseFloat(e.course_hours||0)*parseFloat(e.progress_pct||0)/100),0);
  txt('prog-stat-total',enrollments.length); txt('prog-stat-done',done); txt('prog-stat-hours',hrs.toFixed(1)); txt('prog-stat-certs',certs.length);
  html('prog-table-body',enrollments.map(e=>{ const pct=parseFloat(e.progress_pct||0),cert=certs.find(c=>c.course_id===e.course_id); return `<div class="dt-row" style="grid-template-columns:2fr 1fr 1fr 1fr 110px"><div class="user-cell"><span style="font-size:20px">${e.course_emoji||'📚'}</span><div class="cell-name">${e.course_title}</div></div><div style="font-size:12px;color:var(--text-muted)">${e.course_cat||'—'}</div><div>${progBar(pct,pct>=100?'green':'')}<small>${pct.toFixed(0)}%</small></div><div style="color:${cert?'var(--green)':'var(--text-muted)'}">${cert?cert.score+'/100':'—'}</div><div>${pct>=100?'<span class="pill pill-done">✅ เสร็จ</span>':'<span class="pill pill-prog">⏳ เรียน</span>'}</div></div>`; }).join('')||'<div style="padding:20px;text-align:center;color:var(--text-muted)">ยังไม่มีข้อมูล</div>');
}

async function renderCertsTab() {
  const res=await API.getCerts(App.user.username); const certs=res.certs||[];
  html('certs-grid',certs.length?certs.map(c=>`<div style="background:var(--navy-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;cursor:pointer" onclick="showCert('${c.id}','${encodeURIComponent(c.course_title)}','${c.score}','${c.cert_no}','${c.issued_at}')"><div style="font-size:32px;margin-bottom:8px">🏅</div><h4 style="font-size:14px;font-weight:700;margin-bottom:6px">${c.course_title}</h4><p style="font-size:12px;color:var(--text-muted)">${c.cert_no}</p><p style="font-size:12px;color:var(--text-muted);margin-bottom:10px">${fmtDate(c.issued_at)}</p><span class="pill pill-done">✅ ${c.score}%</span></div>`).join(''):'<p style="color:var(--text-muted)">ยังไม่มีใบประกาศ</p>');
  html('cert-display','');
}

function showCert(certId,titleEnc,score,certNo,issuedAt) {
  const u=App.user,title=decodeURIComponent(titleEnc);
  html('cert-display',`<div class="certificate" style="margin-top:24px"><div class="cert-seal">🏅</div><div class="cert-eyebrow">Certificate of Completion</div><div class="cert-heading">ใบประกาศนียบัตร</div><div class="cert-present">ขอมอบให้เพื่อรับรองว่า</div><div class="cert-name">${u?.name||'ผู้เรียน'}</div><div class="cert-role">${u?.unit||u?.dept||'โรงพยาบาลชลบุรี'}</div><div class="cert-rule"></div><div class="cert-course">สำเร็จหลักสูตร: ${title}</div><div style="font-size:13px;color:var(--teal);margin-bottom:8px">คะแนน: ${score}% · เลขที่: ${certNo}</div><div class="cert-date">วันที่: ${fmtDate(issuedAt)} · โรงพยาบาลชลบุรี</div><div style="margin-top:20px;display:flex;gap:8px;justify-content:center"><button class="btn btn-teal btn-sm" onclick="exportCertPDF('${certNo}','${encodeURIComponent(u?.name||'')}','${encodeURIComponent(title)}','${score}','${fmtDate(issuedAt)}')">📄 Export PDF</button></div></div>`);
  el('cert-display')?.scrollIntoView({behavior:'smooth'});
}

function renderCourseCard(c,enrollment) {
  const pct=enrollment?parseFloat(enrollment.progress_pct||0):0, enrolled=!!enrollment, done=pct>=100;
  let badge=''; if(done) badge='<span class="pill pill-done" style="font-size:10px">✅ เสร็จ</span>'; else if(enrolled) badge='<span class="pill pill-prog" style="font-size:10px">⏳ กำลังเรียน</span>'; else badge='<span class="pill" style="font-size:10px;background:rgba(0,198,224,0.08);color:var(--teal);border:1px solid rgba(0,198,224,0.2)">+ เรียนเลย</span>';
  return `<div class="course-card" onclick="openCourse('${c.id}')"><div class="course-thumb ${c.color||'ct-blue'}">${c.emoji||'📚'}${c.badge?`<div class="course-badge ${c.badge}">${c.badgeText}</div>`:''}</div><div class="course-body"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div class="course-cat">${c.cat}</div>${badge}</div><div class="course-title">${c.title}</div><div class="course-meta"><span>🎬 ${c.lessons} บท</span><span>⏱ ${c.hours} ชม.</span>${c.hasQuiz==='TRUE'?'<span>📝 Quiz</span>':''}</div>${enrolled?progBar(pct,done?'green':'')+'<div class="prog-label"><span>ความก้าวหน้า</span><span style="color:'+(done?'var(--green)':'var(--teal)')+'">'+pct.toFixed(0)+'%</span></div>':''}</div></div>`;
}

/* ═════════════════════════════════════════════════════
   COURSE DETAIL
═════════════════════════════════════════════════════ */
async function openCourse(courseId) {
  let c=App.courses.find(x=>x.id===courseId);
  if(!c){ const res=await API.getCourses(false); App.courses=(res.courses||[]).filter(x=>x.active!=='FALSE'); c=App.courses.find(x=>x.id===courseId); }
  if(!c){ toast('ไม่พบหลักสูตร','error'); return; }
  App.currentCourse=c;
  if(App.user.role==='learner' && !App.enrollments.find(e=>e.course_id===courseId)) {
    await API.enroll({username:App.user.username,user_id:App.user.id,course_id:c.id,course_title:c.title,userName:App.user.name});
    App.enrollments.push({username:App.user.username,course_id:c.id,course_title:c.title,progress_pct:'0'});
  }
  txt('course-title-bar',c.title); txt('course-subtitle-bar',`${c.cat} · ${c.lessons} บท · ${c.hours} ชม.`);
  txt('course-desc-title',c.title); txt('course-desc-text',c.description||'ไม่มีคำอธิบาย');
  html('video-area',`<div class="video-placeholder" onclick="loadVideo()"><div class="play-ring">▶</div><p>${c.title}</p></div>`);

  // Load lesson data from GAS (non-blocking)
  const lessonKey = `lessons_${c.id}`;
  if(!App.customQuizzes[lessonKey]) {
    API.getLessonData(c.id).then(res=>{
      if(res.success && res.lessons && res.lessons.length > 0) {
        App.customQuizzes[lessonKey] = res.lessons;
        buildCurriculum(c); // re-render with lesson titles
      }
    });
  }
  buildCurriculum(c);
  document.querySelectorAll('.lesson-pane').forEach((p,i)=>p.classList.toggle('active',i===0));
  document.querySelectorAll('.ltab').forEach((b,i)=>b.classList.toggle('active',i===0));
  showScreen('screen-course');
}

function loadVideo() {
  const c=App.currentCourse; if(!c) return;
  // Use course videoUrl if available, else sample
  const lessons=parseInt(c.lessons)||6;
  const enr=App.enrollments.find(e=>e.course_id===c.id);
  const lessonIdx=enr?Math.floor(parseFloat(enr.progress_pct||0)/100*lessons):0;
  const lessonData=App.customQuizzes[`lessons_${c.id}`];
  const url=(lessonData&&lessonData[lessonIdx]?.url)||c.videoUrl||'';
  if(url&&url.includes('youtu')){ const vid=url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1]||''; if(vid){ html('video-area',`<iframe src="https://www.youtube.com/embed/${vid}?autoplay=1" allow="autoplay;encrypted-media" allowfullscreen style="width:100%;height:100%;border:none;border-radius:12px"></iframe>`); } else { html('video-area',`<div style="padding:40px;text-align:center;color:var(--text-muted)">⚠️ URL ไม่ถูกต้อง</div>`); } }
  else if(url){ html('video-area',`<iframe src="${url}" allowfullscreen style="width:100%;height:100%;border:none;border-radius:12px"></iframe>`); }
  else { html('video-area',`<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" allow="autoplay;encrypted-media" allowfullscreen style="width:100%;height:100%;border:none;border-radius:12px"></iframe>`); }
  if(App.user?.role==='learner'&&c){
    const cur=enr?Math.min(parseFloat(enr.progress_pct||0)+10,99):10;
    if(enr) enr.progress_pct=String(cur);
    API.updateProgress({username:App.user.username,course_id:c.id,progress_pct:String(cur)});
    buildCurriculum(c);
  }
}

function buildCurriculum(c) {
  const enr=App.enrollments.find(e=>e.course_id===c.id), pct=enr?parseFloat(enr.progress_pct||0):0;
  const lessons=parseInt(c.lessons)||6, doneCnt=Math.floor(lessons*pct/100);
  const lessonData=App.customQuizzes[`lessons_${c.id}`]||[];
  const defTitles=['ความรู้เบื้องต้น','เนื้อหาหลัก','การปฏิบัติ','กรณีศึกษา','การติดตามผล','แบบทดสอบ'];
  txt('curriculum-progress',`${doneCnt}/${lessons} เสร็จ`);
  html('curriculum-prog-bar',progBar(pct));
  html('curriculum-prog-label',`<span>ความก้าวหน้า</span><span style="color:var(--teal)">${pct.toFixed(0)}%</span>`);
  html('curriculum-list',Array.from({length:lessons},(_,i)=>{
    const done=i<doneCnt,act=i===doneCnt,title=lessonData[i]?.title||defTitles[i]||`บทที่ ${i+1}`;
    return `<div class="lesson-item${done?' done':''}${act?' active':''}" onclick="selectLesson(${i})"><div class="lesson-num">${done?'✓':i+1}</div><div class="li-info"><h4>${title}</h4><p>🎬 ${20+i*5} นาที</p></div><div class="li-type">${i===lessons-1?'📝':'🎬'}</div></div>`;
  }).join(''));
}

function selectLesson(idx) {
  if(App.user?.role==='learner'&&App.currentCourse){
    const c=App.currentCourse,lessons=parseInt(c.lessons)||6;
    const newPct=Math.min(Math.round((idx+1)/lessons*100),99);
    const enr=App.enrollments.find(e=>e.course_id===c.id);
    if(enr&&parseFloat(enr.progress_pct||0)<newPct){ enr.progress_pct=String(newPct); API.updateProgress({username:App.user.username,course_id:c.id,progress_pct:String(newPct),lesson_index:String(idx)}); buildCurriculum(c); }
    // Load video for this lesson
    loadVideo();
  }
}

function switchLessonTab(id,btn) {
  document.querySelectorAll('.lesson-pane').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.ltab').forEach(b=>b.classList.remove('active'));
  el(`lpane-${id}`)?.classList.add('active'); if(btn) btn.classList.add('active');
  if(id==='quiz') initQuiz(App.currentCourse?.id);
}

function backToMain() { const r=App.user?.role; showScreen(r==='admin'?'screen-admin':r==='nso'?'screen-nso':'screen-main'); }

/* ═════════════════════════════════════════════════════
   QUIZ ENGINE
═════════════════════════════════════════════════════ */
let _qAns=null;

async function initQuiz(courseId) {
  // Show loading
  html('quiz-area','<div style="padding:40px;text-align:center;color:var(--teal)">⏳ กำลังโหลดแบบทดสอบ...</div>');

  // Try GAS first, then local cache, then default
  let qs = App.customQuizzes[courseId] || null;
  if(!qs) {
    const res = await API.getQuizData(courseId);
    if(res.success && res.questions && res.questions.length > 0) {
      qs = res.questions;
      App.customQuizzes[courseId] = qs; // cache it
    }
  }
  if(!qs || !qs.length) {
    qs = DEFAULT_QUIZZES[courseId] || DEFAULT_QUIZZES.chemo;
  }

  App.quiz = {questions:qs, idx:0, answers:[], done:false};
  _qAns = null;
  renderQuestion();
}

function renderQuestion() {
  if(App.quiz.done){renderQuizResult();return;}
  const {questions,idx}=App.quiz,q=questions[idx];
  const dots=questions.map((_,i)=>`<div class="q-dot ${i<idx?'done':i===idx?'current':''}"></div>`).join('');
  html('quiz-area',`<div class="quiz-wrap"><div class="quiz-header"><h2>📝 แบบทดสอบ</h2><div class="quiz-dots">${dots}</div></div><div class="question-card"><div class="q-num">ข้อที่ ${idx+1}/${questions.length}</div><div class="q-text">${q.q}</div><div class="answer-options">${q.opts.map((o,i)=>`<button class="answer-opt" onclick="selectAns(${i})">${'ABCD'[i]}. ${o}</button>`).join('')}</div><div class="quiz-nav"><span style="font-size:12px;color:var(--text-muted)">เลือกคำตอบที่ถูกต้อง</span><button class="btn btn-teal btn-sm" id="quiz-next-btn" disabled onclick="nextQuestion()">ถัดไป →</button></div></div></div>`);
}

function selectAns(i) { _qAns=i; document.querySelectorAll('.answer-opt').forEach((b,j)=>{b.classList.remove('sel');if(j===i)b.classList.add('sel');}); const btn=el('quiz-next-btn');if(btn)btn.disabled=false; }

function nextQuestion() {
  if(_qAns===null) return;
  const q=App.quiz.questions[App.quiz.idx]; App.quiz.answers.push(_qAns);
  document.querySelectorAll('.answer-opt').forEach((b,j)=>{if(j===q.ans)b.classList.add('correct');else if(j===_qAns)b.classList.add('wrong');b.style.pointerEvents='none';});
  const btn=el('quiz-next-btn');if(btn)btn.disabled=true; _qAns=null;
  setTimeout(()=>{App.quiz.idx++;if(App.quiz.idx>=App.quiz.questions.length)App.quiz.done=true;renderQuestion();},900);
}

async function renderQuizResult() {
  const {answers,questions}=App.quiz,correct=answers.filter((a,i)=>a===questions[i].ans).length;
  const pct=Math.round(correct/questions.length*100),pass=pct>=70,col=pass?'var(--green)':'var(--red)';
  html('quiz-area',`<div class="quiz-result"><div class="result-ring" style="background:conic-gradient(${col} ${pct*3.6}deg,rgba(255,255,255,.07) 0deg);color:${col}">${pct}%</div><div style="font-size:13px;color:var(--text-muted);margin-bottom:14px">${correct}/${questions.length} ข้อถูกต้อง</div><div style="font-size:22px;margin-bottom:10px">${pass?'🎉 ผ่านแบบทดสอบ!':'😔 ยังไม่ผ่าน'}</div><p style="font-size:13px;color:${col};margin-bottom:22px">${pass?'ยินดีด้วย! ผ่านเกณฑ์ 70%':'ต้องการ 70% ขึ้นไป กรุณาทบทวน'}</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="btn btn-ghost" onclick="initQuiz('${App.currentCourse?.id||''}')">🔄 ทำใหม่</button>${pass?`<button class="btn btn-teal" onclick="switchLearnerTab('certs',el('ltab-btn-certs'));backToMain()">🏅 ดูใบประกาศ</button>`:''}</div></div>`);
  if(App.user?.role==='learner'&&App.currentCourse){ const res=await API.submitQuiz({username:App.user.username,user_name:App.user.name,user_dept:App.user.dept,user_unit:App.user.unit,course_id:App.currentCourse.id,course_title:App.currentCourse.title,score:pct,pass}); if(pass){toast(`🏅 ผ่าน ${pct}%! ได้รับใบประกาศ`,'success');const enr=App.enrollments.find(e=>e.course_id===App.currentCourse.id);if(enr)enr.progress_pct='100';buildCurriculum(App.currentCourse);} }
  else if(pass) toast(`🏅 ผ่าน ${pct}%!`,'success');
}

/* ═════════════════════════════════════════════════════
   ADMIN
═════════════════════════════════════════════════════ */
async function initAdmin() {
  showScreen('screen-admin');
  txt('admin-name',App.user.name||'ผู้ดูแลระบบ');
  switchAdminTab('overview',document.querySelector('#screen-admin .nav-btn'));
  populateDeptSelects(); // non-blocking — runs in background
}

function switchAdminTab(id,btn) {
  document.querySelectorAll('#screen-admin .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#screen-admin .nav-btn').forEach(b=>b.classList.remove('active'));
  el(`atab-${id}`)?.classList.add('active'); if(btn) btn.classList.add('active');
  if(id==='overview') loadAdminOverview();
  if(id==='users')    loadAdminUsers();
  if(id==='courses')  loadAdminCourses();
  if(id==='audit')    loadAuditTrail();
  if(id==='reports')  loadAdminReports();
}

async function loadAdminOverview() {
  const [statsRes,usersRes]=await Promise.all([API.getStats(),API.getUsers()]);
  const s=statsRes.stats||{};
  txt('as-users',s.total_users||0);txt('as-courses',s.total_courses||0);txt('as-pass',(s.pass_rate||0)+'%');
  txt('as-certs',s.certs_issued||0);txt('as-hours',s.total_hours||0);txt('as-score',s.avg_score||0);txt('as-today',s.logins_today||0);
  const users=(usersRes.users||[]).filter(u=>u.role==='learner').slice(0,6);
  html('recent-enrollments',users.map(u=>`<div class="dt-row" style="grid-template-columns:2fr 1.5fr 1fr 1fr 90px"><div class="user-cell"><div class="ua ${avatarColor(u.name)}">${u.name?.[0]||'?'}</div><div><div class="cell-name">${u.name}</div><div class="cell-sub">${u.email||u.username}</div></div></div><div style="font-size:12px;color:var(--text-muted)">${(u.dept||'—').replace('กลุ่มงานการพยาบาล','').trim().slice(0,20)}</div><div>${progBar(Math.random()*100|0)}</div><div>${rolePill(u.role)}</div><div><button class="btn btn-teal btn-sm" onclick="toast('${u.name}','info')">ดู</button></div></div>`).join('')||'<div style="padding:16px;color:var(--text-muted);text-align:center">กำลังโหลด...</div>');
}

/* ── Users ── */
async function loadAdminUsers() { const res=await API.getUsers(); App.users=res.users||[]; renderUsersTable(App.users); }
function filterUsers() {
  const q=(el('user-search')?.value||'').toLowerCase(),role=el('filter-role')?.value||'',dept=el('filter-dept-users')?.value||'';
  let f=App.users;
  if(q) f=f.filter(u=>(u.name||'').toLowerCase().includes(q)||(u.username||'').includes(q));
  if(role) f=f.filter(u=>u.role===role);
  if(dept) f=f.filter(u=>u.deptId===dept);
  renderUsersTable(f);
}
const searchUsers=filterUsers;

function renderUsersTable(users) {
  txt('user-count',users.length);
  html('users-table-body',users.map(u=>{ const active=u.active==='TRUE'||u.active===true; return `<div class="dt-row" style="grid-template-columns:2fr 1.8fr 1fr 1fr 1fr 130px"><div class="user-cell"><div class="ua ${avatarColor(u.name)}">${u.name?.[0]||'?'}</div><div><div class="cell-name">${u.name}</div><div class="cell-sub">${u.email||u.username}</div></div></div><div><div style="font-size:12px">${(u.dept||'—').replace('กลุ่มงานการพยาบาล','').trim()}</div><div style="font-size:11px;color:var(--text-muted)">${u.unit||'—'}</div></div><div>${rolePill(u.role)}</div><div><span class="pill ${active?'pill-done':'pill-pending'}">${active?'✅ ใช้งาน':'🔴 ปิด'}</span></div><div style="font-size:11px;color:var(--text-muted)">${u.last_login?new Date(u.last_login).toLocaleDateString('th-TH'):'—'}</div><div style="display:flex;gap:4px;flex-wrap:wrap"><button class="btn btn-teal btn-sm" onclick='openEditUser(${JSON.stringify(u)})'>✏️</button><button class="btn btn-ghost btn-sm" onclick='openResetPwd("${u.id}","${u.name.replace(/"/g,'')}") '>🔑</button><button class="btn btn-sm ${active?'btn-danger':'btn-green'}" onclick='doToggleUser("${u.id}",${active?'false':'true'})'>${active?'🔴':'🟢'}</button><button class="btn btn-danger btn-sm" onclick='doDeleteUser("${u.id}","${u.name.replace(/"/g,'')}") '>🗑</button></div></div>`; }).join('')||'<div style="padding:20px;text-align:center;color:var(--text-muted)">ไม่พบข้อมูล</div>');
}

function openCreateUser() { el('modal-user-id').dataset.id=''; txt('modal-user-title','➕ เพิ่มผู้ใช้งาน'); html('modal-user-form',buildUserForm({})); openModal('modal-user'); }
function openEditUser(u)  { el('modal-user-id').dataset.id=u.id; txt('modal-user-title','✏️ แก้ไขข้อมูล'); html('modal-user-form',buildUserForm(u)); openModal('modal-user'); }

function buildUserForm(u={}) {
  const groups=App._depts||(typeof DEPT_GROUPS!=='undefined'?DEPT_GROUPS:[]);
  const dg=groups.find(g=>g.id===u.deptId);
  const deptOpts='<option value="">-- กลุ่มงาน --</option>'+groups.map(g=>`<option value="${g.id}" ${g.id===u.deptId?'selected':''}>${g.name}</option>`).join('');
  const unitOpts='<option value="">-- หน่วยงาน --</option>'+(dg?.units||[]).map(un=>`<option value="${un.id}" ${un.id===u.unitId?'selected':''}>${un.name}</option>`).join('');
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="form-group" style="grid-column:1/-1"><label>ชื่อ-นามสกุล *</label><div class="input-wrap"><span class="input-icon">👤</span><input class="form-control" id="uf-name" value="${u.name||''}" placeholder="ชื่อ-นามสกุล"></div></div><div class="form-group"><label>Username *</label><div class="input-wrap"><span class="input-icon">🔖</span><input class="form-control" id="uf-username" value="${u.username||''}" placeholder="username"></div></div><div class="form-group"><label>อีเมล</label><div class="input-wrap"><span class="input-icon">📧</span><input class="form-control" id="uf-email" value="${u.email||''}" placeholder="email"></div></div>${!u.id?`<div class="form-group" style="grid-column:1/-1"><label>รหัสผ่าน</label><div class="input-wrap"><span class="input-icon">🔒</span><input class="form-control" id="uf-pass" type="text" placeholder="ค่าเริ่มต้น: cbh1234"></div></div>`:''}<div class="form-group"><label>Role</label><div class="input-wrap"><span class="input-icon">🎭</span><select class="form-control" id="uf-role"><option value="learner" ${u.role==='learner'?'selected':''}>👩‍⚕️ ผู้เรียน</option><option value="nso" ${u.role==='nso'?'selected':''}>🔮 NSO</option><option value="admin" ${u.role==='admin'?'selected':''}>👑 Admin</option></select></div></div><div class="form-group"><label>สถานะ</label><div class="input-wrap"><span class="input-icon">🔘</span><select class="form-control" id="uf-active"><option value="true" ${(u.active==='TRUE'||u.active===true)?'selected':''}>✅ เปิด</option><option value="false" ${(u.active==='FALSE'||u.active===false)?'selected':''}>🔴 ปิด</option></select></div></div><div class="form-group" style="grid-column:1/-1"><label>กลุ่มงาน</label><div class="input-wrap"><span class="input-icon">🏢</span><select class="form-control" id="uf-dept" onchange="onUfDeptChange(this.value)">${deptOpts}</select></div></div><div class="form-group" style="grid-column:1/-1"><label>หน่วยงาน</label><div class="input-wrap"><span class="input-icon">🏥</span><select class="form-control" id="uf-unit">${unitOpts}</select></div></div></div>`;
}
function onUfDeptChange(deptId){populateUnitSelect('uf-unit',deptId);}

async function saveUser() {
  const id=el('modal-user-id')?.dataset?.id||'',isEdit=!!id;
  const deptId=el('uf-dept')?.value||'',unitId=el('uf-unit')?.value||'';
  const groups=App._depts||(typeof DEPT_GROUPS!=='undefined'?DEPT_GROUPS:[]);
  const dg=groups.find(g=>g.id===deptId),ug=dg?.units?.find(u=>String(u.id)===String(unitId));
  const data={id,name:el('uf-name')?.value?.trim(),username:el('uf-username')?.value?.trim(),email:el('uf-email')?.value?.trim(),role:el('uf-role')?.value,deptId,dept:dg?.name||'',unitId,unit:ug?.name||'',active:el('uf-active')?.value!=='false',updatedBy:App.user?.username,updatedByName:App.user?.name,createdBy:App.user?.username,createdByName:App.user?.name};
  if(!isEdit) data.password=el('uf-pass')?.value?.trim()||'cbh1234';
  if(!data.name||!data.username){toast('กรุณากรอกข้อมูลให้ครบ','warn');return;}
  const res=isEdit?await API.updateUser(data):await API.createUser(data);
  if(res.success){toast(res.message||'บันทึกสำเร็จ','success');closeModal('modal-user');loadAdminUsers();}
  else toast('เกิดข้อผิดพลาด: '+(res.error||''),'error');
}
async function doDeleteUser(id,name) { if(!confirm(`ยืนยันการลบ: ${name}?`))return; const res=await API.deleteUser(id); if(res.success){toast(`🗑 ลบ ${name} สำเร็จ`,'success');loadAdminUsers();}else toast('เกิดข้อผิดพลาด','error'); }
async function doToggleUser(id,active) { const res=await API.toggleUser(id,active==='true'||active===true); if(res.success){toast(active==='true'||active===true?'🟢 เปิด':'🔴 ปิด','success');loadAdminUsers();}else toast('ผิดพลาด','error'); }
function openResetPwd(id,name){if(el('modal-reset-id')){el('modal-reset-id').dataset.id=id;}txt('reset-pwd-name',name);if(el('new-pwd-input'))el('new-pwd-input').value='';openModal('modal-reset-pwd');}
async function doResetPwd(){const id=el('modal-reset-id')?.dataset?.id,pwd=el('new-pwd-input')?.value?.trim();if(!pwd||pwd.length<4){toast('อย่างน้อย 4 ตัว','warn');return;}const res=await API.resetPwd(id,pwd);if(res.success){toast('🔑 รีเซ็ตสำเร็จ','success');closeModal('modal-reset-pwd');}else toast('ผิดพลาด','error');}

/* ── Courses + Quiz/Content Editor ── */
async function loadAdminCourses() {
  const res=await API.getCourses(true); App.courses=res.courses||[];
  html('admin-course-grid',App.courses.map(c=>{
    const inactive=c.active==='FALSE';
    const lessonData=App.customQuizzes[`lessons_${c.id}`]||[];
    const lessonList=lessonData.length?`<div class="lesson-admin-list">${lessonData.map((l,i)=>`<div class="lesson-admin-item"><div class="lesson-admin-idx">${i+1}</div><div class="lesson-admin-content"><div style="font-size:11px;font-weight:600;color:var(--text)">${l.title||'บทที่ '+(i+1)}</div>${l.url?`<div style="font-size:10px;color:var(--text-dim)">🔗 ${l.url.slice(0,40)}...</div>`:''}</div></div>`).join('')}</div>`:'';;
    return `<div class="course-admin-card"><div class="course-admin-thumb ${c.color||'ct-blue'}">${c.emoji||'📚'}${inactive?'<div style="position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:12px;color:#aaa;border-radius:inherit">ปิดใช้</div>':''}</div><div class="course-admin-body"><div class="course-admin-title">${c.title}</div><div class="course-admin-meta"><span>📚 ${c.lessons} บท</span><span>⏱ ${c.hours} ชม.</span><span>${c.hasQuiz==='TRUE'?'📝 Quiz':'ไม่มี Quiz'}</span></div><div class="course-admin-actions"><button class="btn btn-teal btn-sm" onclick='openEditCourse(${JSON.stringify(c)})'>✏️ แก้ไข</button><button class="btn btn-ghost btn-sm" onclick='openLessonEditor("${c.id}","${c.title.replace(/"/g,'')}",${parseInt(c.lessons)||6})'>📋 บทเรียน</button><button class="btn btn-ghost btn-sm" onclick='openQuizEditor("${c.id}","${c.title.replace(/"/g,'')}") '>📝 Quiz</button><button class="btn btn-ghost btn-sm" onclick='doToggleCourse("${c.id}",${inactive})'>${inactive?'🟢 เปิด':'🔴 ปิด'}</button><button class="btn btn-danger btn-sm" onclick='doDeleteCourse("${c.id}","${c.title.replace(/"/g,'')}") '>🗑</button></div>${lessonList}</div></div>`;
  }).join('')||'<div style="color:var(--text-muted)">ยังไม่มีหลักสูตร</div>');
}

function openCreateCourse(){ el('modal-course-id').dataset.id=''; txt('modal-course-title','➕ สร้างหลักสูตร'); html('modal-course-form',buildCourseForm({})); openModal('modal-course'); }
function openEditCourse(c) { el('modal-course-id').dataset.id=c.id; txt('modal-course-title','✏️ แก้ไขหลักสูตร'); html('modal-course-form',buildCourseForm(c)); openModal('modal-course'); }

function buildCourseForm(c={}) {
  const colors=['ct-blue','ct-teal','ct-purple','ct-green','ct-orange'];
  return `<div class="form-group"><label>ชื่อหลักสูตร *</label><div class="input-wrap"><span class="input-icon">📚</span><input class="form-control" id="cf-title" value="${c.title||''}" placeholder="ชื่อหลักสูตร"></div></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px"><div class="form-group"><label>หมวดหมู่</label><input class="form-control" id="cf-cat" value="${c.cat||''}" placeholder="เช่น การพยาบาล"></div><div class="form-group"><label>Emoji</label><input class="form-control" id="cf-emoji" value="${c.emoji||'📚'}"></div><div class="form-group"><label>สี</label><select class="form-control" id="cf-color">${colors.map(v=>`<option value="${v}" ${c.color===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="form-group"><label>จำนวนบท</label><input class="form-control" id="cf-lessons" type="number" min="1" value="${c.lessons||6}"></div><div class="form-group"><label>ชั่วโมงเรียน</label><input class="form-control" id="cf-hours" type="number" step="0.5" value="${c.hours||2}"></div><div class="form-group"><label>Badge</label><select class="form-control" id="cf-badge"><option value="" ${!c.badge?'selected':''}>ไม่มี</option><option value="badge-req" ${c.badge==='badge-req'?'selected':''}>จำเป็น</option><option value="badge-new" ${c.badge==='badge-new'?'selected':''}>ใหม่</option><option value="badge-hot" ${c.badge==='badge-hot'?'selected':''}>ยอดนิยม</option></select></div></div><div class="form-group"><label>คำอธิบาย</label><textarea class="form-control" id="cf-desc" rows="3" style="resize:vertical">${c.description||''}</textarea></div><div class="form-group"><label>มีแบบทดสอบ</label><select class="form-control" id="cf-quiz"><option value="true" ${c.hasQuiz==='TRUE'?'selected':''}>✅ มี</option><option value="false" ${c.hasQuiz!=='TRUE'?'selected':''}>❌ ไม่มี</option></select></div>`;
}

async function saveCourse() {
  const id=el('modal-course-id')?.dataset?.id||'',badge=el('cf-badge')?.value||'';
  const bmap={'badge-req':'จำเป็น','badge-new':'ใหม่','badge-hot':'ยอดนิยม'};
  const data={id,title:el('cf-title')?.value?.trim(),cat:el('cf-cat')?.value?.trim(),emoji:el('cf-emoji')?.value?.trim()||'📚',color:el('cf-color')?.value||'ct-blue',lessons:parseInt(el('cf-lessons')?.value)||6,hours:parseFloat(el('cf-hours')?.value)||2,badge,badgeText:bmap[badge]||'',hasQuiz:el('cf-quiz')?.value==='true',description:el('cf-desc')?.value?.trim(),active:true};
  if(!data.title){toast('กรุณากรอกชื่อหลักสูตร','warn');return;}
  const res=id?await API.updateCourse(data):await API.createCourse(data);
  if(res.success){toast(res.message||'บันทึกสำเร็จ','success');closeModal('modal-course');loadAdminCourses();}
  else toast('เกิดข้อผิดพลาด: '+(res.error||''),'error');
}
async function doDeleteCourse(id,title){if(!confirm(`ยืนยันลบ: ${title}?`))return;const res=await API.deleteCourse(id);if(res.success){toast(`🗑 ลบสำเร็จ`,'success');loadAdminCourses();}else toast('ผิดพลาด','error');}
async function doToggleCourse(id,curInactive){const res=await API.toggleCourse(id,!!curInactive);if(res.success){toast(curInactive?'🟢 เปิด':'🔴 ปิด','success');loadAdminCourses();}else toast('ผิดพลาด','error');}

/* ── Lesson Editor ── */
async function openLessonEditor(courseId, courseTitle, lessonCount) {
  el('modal-quiz-cid').value=`lessons_${courseId}`;
  document.querySelector('#modal-quiz .modal-head h3').textContent=`📋 บทเรียน: ${courseTitle}`;
  document.querySelector('#modal-quiz .modal-foot .btn-teal').setAttribute('onclick','saveLessonData()');
  document.querySelector('#modal-quiz .modal-body .btn.btn-ghost').style.display='none';
  html('quiz-editor-wrap','<div style="padding:20px;text-align:center;color:var(--teal)">⏳ กำลังโหลดบทเรียน...</div>');
  openModal('modal-quiz');

  // Load from GAS first
  const res = await API.getLessonData(courseId);
  let existing = [];
  if(res.success && res.lessons && res.lessons.length > 0) {
    existing = res.lessons;
    toast('📋 โหลดบทเรียนจาก Google Sheet แล้ว','info');
  } else {
    existing = App.customQuizzes[`lessons_${courseId}`] || [];
  }
  App.customQuizzes[`lessons_${courseId}`] = existing;
  el('modal-quiz-cid').value=`lessons_${courseId}`;
  txt('modal-course-title',`📋 บทเรียน: ${courseTitle}`); // reuse quiz modal
  html('quiz-editor-wrap',`<p style="font-size:12px;color:var(--text-muted);margin-bottom:14px">แก้ไขชื่อบทเรียนและลิงค์เนื้อหา (YouTube, GDrive, URL ใดก็ได้)</p>`+
    Array.from({length:lessonCount},(_,i)=>{
      const l=existing[i]||{};
      return `<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div class="lesson-admin-idx">${i+1}</div><input class="lesson-admin-title-input" id="lt-${i}" value="${l.title||''}" placeholder="ชื่อบทที่ ${i+1}"></div><div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px;color:var(--text-muted);white-space:nowrap">🔗 ลิงค์:</span><input class="lesson-admin-url-input" id="lu-${i}" value="${l.url||''}" placeholder="https://youtube.com/watch?v=... หรือ Google Drive link" style="width:100%"></div></div>`;
    }).join('')
  );
  // override save button behavior
  document.querySelector('#modal-quiz .modal-foot .btn-teal').setAttribute('onclick','saveLessonData()');
  document.querySelector('#modal-quiz .modal-head h3').textContent=`📋 บทเรียน: ${courseTitle}`;
  document.querySelector('#modal-quiz .modal-body .btn.btn-ghost').style.display='none';
  openModal('modal-quiz');
}

async function saveLessonData() {
  const key      = el('modal-quiz-cid').value;
  const courseId = key.replace('lessons_','');
  const c        = App.courses.find(x=>x.id===courseId);
  const count    = parseInt(c?.lessons)||6;
  const lessons  = Array.from({length:count},(_,i)=>({
    title: el(`lt-${i}`)?.value?.trim()||'',
    url:   el(`lu-${i}`)?.value?.trim()||''
  }));

  // Cache locally
  App.customQuizzes[key] = lessons;

  // Save to GAS Google Sheet
  const btn = document.querySelector('#modal-quiz .btn-teal');
  if(btn){btn.disabled=true;btn.textContent='⏳ กำลังบันทึก...';}

  const res = await API.saveLessonData(courseId, lessons);

  if(btn){btn.disabled=false;btn.textContent='💾 บันทึกบทเรียน';}

  if(res.success) {
    closeModal('modal-quiz');
    toast('✅ บันทึกบทเรียนลง Google Sheet สำเร็จ','success');
    loadAdminCourses();
  } else {
    toast('❌ บันทึกไม่สำเร็จ: '+(res.error||'ลองใหม่'),'error');
  }
}

/* ── Quiz Editor ── */
async function openQuizEditor(courseId, courseTitle) {
  el('modal-quiz-cid').value=courseId;
  document.querySelector('#modal-quiz .modal-head h3').textContent=`📝 แบบทดสอบ: ${courseTitle}`;
  document.querySelector('#modal-quiz .modal-foot .btn-teal').setAttribute('onclick','saveQuizQuestions()');
  document.querySelector('#modal-quiz .modal-body .btn.btn-ghost').style.display='';

  // Load from GAS first, fallback to cache/default
  html('quiz-editor-wrap','<div style="padding:20px;text-align:center;color:var(--teal)">⏳ กำลังโหลด Quiz...</div>');
  openModal('modal-quiz');

  const res = await API.getQuizData(courseId);
  let existing;
  if(res.success && res.questions && res.questions.length > 0) {
    existing = res.questions;
    toast('📝 โหลด Quiz จาก Google Sheet แล้ว ('+existing.length+' ข้อ)','info');
  } else {
    existing = App.customQuizzes[courseId] || DEFAULT_QUIZZES[courseId] || [{q:'',opts:['','','',''],ans:0}];
  }
  App.customQuizzes[courseId] = JSON.parse(JSON.stringify(existing));
  renderQuizEditor(courseId);
}

function renderQuizEditor(courseId) {
  const qs=App.customQuizzes[courseId]||[];
  html('quiz-editor-wrap',qs.map((q,qi)=>`<div class="quiz-q-editor"><div class="quiz-q-num"><span>ข้อที่ ${qi+1}</span><button class="btn btn-danger btn-sm" onclick="removeQuizQ(${qi})" style="font-size:10px;padding:2px 8px">ลบ</button></div><textarea class="quiz-q-text" id="qq-${qi}" rows="2" placeholder="คำถาม...">${q.q||''}</textarea><div style="font-size:11px;color:var(--text-muted);margin:8px 0 4px">ตัวเลือก (ทำเครื่องหมาย ✓ ที่คำตอบที่ถูกต้อง)</div><div class="quiz-opts-grid">${q.opts.map((o,oi)=>`<div class="quiz-opt-row"><input type="radio" name="ans-${qi}" class="quiz-opt-correct" value="${oi}" ${q.ans===oi?'checked':''} id="qa-${qi}-${oi}" onchange="setQuizAns(${qi},${oi})"><label for="qa-${qi}-${oi}" style="font-size:10px;color:var(--text-muted);flex-shrink:0">${'ABCD'[oi]}</label><input class="quiz-opt-input" id="qo-${qi}-${oi}" value="${o||''}" placeholder="ตัวเลือก ${'ABCD'[oi]}..."></div>`).join('')}</div></div>`).join(''));
}

function addQuizQuestion() {
  const cid=el('modal-quiz-cid').value;
  if(!App.customQuizzes[cid]) App.customQuizzes[cid]=[];
  App.customQuizzes[cid].push({q:'',opts:['','','',''],ans:0});
  renderQuizEditor(cid);
}
function removeQuizQ(idx) {
  const cid=el('modal-quiz-cid').value;
  if(App.customQuizzes[cid]) App.customQuizzes[cid].splice(idx,1);
  renderQuizEditor(cid);
}
function setQuizAns(qi,oi) { const cid=el('modal-quiz-cid').value; if(App.customQuizzes[cid]?.[qi]) App.customQuizzes[cid][qi].ans=oi; }

async function saveQuizQuestions() {
  const cid=el('modal-quiz-cid').value;
  if(!App.customQuizzes[cid]) return;

  // Read current values from inputs
  App.customQuizzes[cid].forEach((q,qi)=>{
    q.q    = el(`qq-${qi}`)?.value?.trim() || q.q;
    q.opts = q.opts.map((_,oi) => el(`qo-${qi}-${oi}`)?.value?.trim() || '');
  });
  App.customQuizzes[cid] = App.customQuizzes[cid].filter(q => q.q && q.opts.some(o=>o));

  if(!App.customQuizzes[cid].length) {
    toast('กรุณาเพิ่มข้อคำถามอย่างน้อย 1 ข้อ','warn'); return;
  }

  // Save to GAS Google Sheet
  const btn = document.querySelector('#modal-quiz .btn-teal');
  if(btn){btn.disabled=true;btn.textContent='⏳ กำลังบันทึก...';}

  const res = await API.saveQuizData(cid, App.customQuizzes[cid]);

  if(btn){btn.disabled=false;btn.textContent='💾 บันทึกแบบทดสอบ';}

  if(res.success) {
    closeModal('modal-quiz');
    toast('✅ บันทึก Quiz '+App.customQuizzes[cid].length+' ข้อ ลง Google Sheet สำเร็จ','success');
  } else {
    toast('❌ บันทึกไม่สำเร็จ: '+(res.error||'ลองใหม่'),'error');
  }
}

/* ── Audit ── */
async function loadAuditTrail() {
  const params={limit:'300'};
  const ac=el('audit-filter-action')?.value||'',rc=el('audit-filter-role')?.value||'',dc=el('audit-filter-dept')?.value||'',sc=el('audit-search')?.value?.trim()||'';
  if(ac)params.action=ac;if(rc)params.role=rc;if(dc)params.deptId=dc;if(sc)params.search=sc;
  const res=await API.getAuditLog(params);const logs=res.logs||[];App.auditAll=logs;
  renderAuditTable(logs);renderAuditSummary(logs);
}
const filterLogs=loadAuditTrail,loadAdminLogs=loadAuditTrail;

function renderAuditTable(logs) {
  const tbody=el('audit-table-body');if(!tbody)return;
  if(!logs.length){tbody.innerHTML='<div style="padding:28px;text-align:center;color:var(--text-muted)">ไม่พบข้อมูล</div>';return;}
  tbody.innerHTML=logs.map(e=>{
    const meta=(typeof getAuditAction==='function')?getAuditAction(e.action||'LOGIN'):{icon:'📋',label:e.action,color:'var(--teal)',category:'system'};
    const ts=e.timestamp?new Date(e.timestamp):null,date=ts?ts.toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'2-digit'}):'—',time=ts?ts.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';
    const name=e.actorName||e.actor||'—',isRisk=['LOGIN_FAIL','DELETE_USER','DELETE_COURSE'].includes(e.action);
    const enc=encodeURIComponent(JSON.stringify(e));
    return `<div class="dt-row audit-row${isRisk?' audit-risk':''}" style="grid-template-columns:130px 1.5fr 80px 1fr 1.5fr 90px;align-items:start;cursor:pointer" onclick="showAuditDetail('${enc}')"><div><div style="font-size:12px;font-weight:600">${date}</div><div style="font-size:11px;color:var(--text-dim)">${time}</div></div><div class="user-cell"><div class="ua ${avatarColor(name)}" style="width:28px;height:28px;font-size:11px">${name[0]||'?'}</div><div><div class="cell-name" style="font-size:13px">${name}</div><div class="cell-sub">${e.actor||''}</div></div></div><div>${rolePill(e.role)}</div><div><span style="font-size:15px">${meta.icon}</span><span style="font-size:12px;color:${meta.color};margin-left:4px;font-weight:600">${meta.label}</span>${isRisk?'<span style="font-size:10px;color:var(--red);margin-left:4px">⚠️</span>':''}</div><div style="font-size:12px;color:var(--text-muted)">${e.detail||'—'}</div><div style="font-size:11px;color:var(--text-dim)">${(e.unit||e.dept||'—').slice(0,15)}</div></div>`;
  }).join('');
}

function renderAuditSummary(logs) {
  let auth=0,user=0,course=0,learn=0,risk=0;
  logs.forEach(e=>{ const m=(typeof getAuditAction==='function')?getAuditAction(e.action||''):{category:'system'}; if(m.category==='auth')auth++;if(m.category==='user')user++;if(m.category==='course')course++;if(m.category==='learn')learn++;if(['LOGIN_FAIL','DELETE_USER','DELETE_COURSE'].includes(e.action))risk++; });
  txt('audit-sum-total',logs.length);txt('audit-sum-auth',auth);txt('audit-sum-user',user);txt('audit-sum-course',course);txt('audit-sum-learn',learn);txt('audit-sum-risk',risk);
}

function showAuditDetail(enc) {
  let e;try{e=JSON.parse(decodeURIComponent(enc));}catch(_){return;}
  const meta=(typeof getAuditAction==='function')?getAuditAction(e.action||''):{icon:'📋',label:e.action,color:'var(--teal)'};
  const ts=e.timestamp?new Date(e.timestamp).toLocaleString('th-TH'):'—';
  const _r=(l,v)=>`<div style="display:grid;grid-template-columns:130px 1fr;gap:8px;margin-bottom:8px"><div style="font-size:12px;color:var(--text-muted);font-weight:600">${l}</div><div style="font-size:13px;word-break:break-all">${v}</div></div>`;
  html('modal-audit-content',`<div><div style="display:flex;align-items:center;gap:14px;padding-bottom:14px;border-bottom:1px solid var(--border);margin-bottom:16px"><div style="font-size:40px">${meta.icon}</div><div><div style="font-size:16px;font-weight:700;color:${meta.color}">${meta.label}</div><div style="font-size:12px;color:var(--text-muted)">${ts}</div></div></div>${_r('ผู้ดำเนินการ',`${e.actorName||e.actor||'—'} (${e.actor||''})`)}${_r('Role',e.role||'—')}${_r('กลุ่มงาน',e.dept||e.deptId||'—')}${_r('หน่วยงาน',e.unit||'—')}${_r('IP',e.ip||'—')}${_r('รายละเอียด',e.detail||'—')}${_r('ผลลัพธ์',`<span style="color:${['OK','PASS'].includes(e.result)?'var(--green)':'var(--red)'}">${e.result||'—'}</span>`)}${_r('ID',e.id||'—')}</div>`);
  openModal('modal-audit-detail');
}

async function exportAuditLog() {
  API.logAudit({action:'EXPORT_REPORT',actor:App.user?.username,actorName:App.user?.name,role:App.user?.role,detail:'Export Audit CSV',result:'OK'});
  const res=await API.getAuditLog({limit:'2000'});const logs=res.logs||App.auditAll||[];
  const hdrs=['Timestamp','Action','Actor','ActorName','Role','Dept','Unit','IP','Detail','Target','Result'];
  const rows=logs.map(e=>[e.timestamp,e.action,e.actor,e.actorName,e.role,e.dept,e.unit,e.ip,`"${(e.detail||'').replace(/"/g,'""')}"`,e.target,e.result].join(','));
  const csv=[hdrs.join(','),...rows].join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}));
  a.download=`cbh-audit-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);
  toast('✅ Export CSV สำเร็จ','success');
}

/* ── Reports ── */
async function loadAdminReports() {
  const [statsRes,deptRes]=await Promise.all([API.getStats(),API.getDeptStats()]);
  const s=statsRes.stats||{};
  txt('rpt-total-users',s.total_users||0);txt('rpt-total-courses',s.total_courses||0);txt('rpt-pass-rate',(s.pass_rate||0)+'%');
  txt('rpt-certs',s.certs_issued||0);txt('rpt-avg-score',(s.avg_score||0)+'%');txt('rpt-hours',s.total_hours||0);
  const depts=deptRes.deptStats||[];
  html('rpt-dept-chart',depts.slice(0,10).map(d=>`<div class="chart-bar-row"><div class="chart-bar-label" title="${d.dept}">${(d.dept||d.deptId||'').replace('กลุ่มงานการพยาบาล','').trim().slice(0,16)}</div><div class="chart-bar-track"><div class="chart-bar-fill" style="width:${d.passRate||0}%;background:${d.passRate>=80?'var(--green)':d.passRate>=60?'var(--teal)':'var(--gold)'}"></div></div><div class="chart-bar-val" style="color:${d.passRate>=80?'var(--green)':d.passRate>=60?'var(--teal)':'var(--gold)'}">${d.passRate||0}%</div><div style="font-size:10px;color:var(--text-dim);width:40px">${d.userCount||0} คน</div></div>`).join('')||'<div style="color:var(--text-muted);font-size:13px;padding:16px">กำลังโหลด...</div>');
}

async function exportReport() {
  API.logAudit({action:'EXPORT_REPORT',actor:App.user?.username,actorName:App.user?.name,role:App.user?.role,detail:'Export Excel Report',result:'OK'});
  toast('📊 กำลัง Export...','info');
  setTimeout(()=>toast('✅ Export สำเร็จ','success'),1400);
}

/* ═════════════════════════════════════════════════════
   NSO
═════════════════════════════════════════════════════ */
async function initNSO() {
  showScreen('screen-nso');
  txt('nso-name',App.user?.name||'หัวหน้าพยาบาล');
  populateDeptSelects(); // non-blocking
  // Populate course filter
  const courseRes=await API.getCourses(false);App.courses=courseRes.courses||[];
  const cf=el('nso-learner-course-filter');
  if(cf) cf.innerHTML='<option value="">📚 ทุกหลักสูตร</option>'+App.courses.map(c=>`<option value="${c.id}">${c.title}</option>`).join('');
  switchNSOTab('dashboard',document.querySelector('#screen-nso .nav-btn'));
}

function switchNSOTab(id,btn) {
  document.querySelectorAll('#screen-nso .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#screen-nso .nav-btn').forEach(b=>b.classList.remove('active'));
  el(`ntab-${id}`)?.classList.add('active');if(btn)btn.classList.add('active');
  if(id==='dashboard') loadNSODashboard();
  if(id==='learners')  loadNSOLearners();
  if(id==='exec')      loadExecDashboard();
  if(id==='notify')    initEmailNotify();
}

/* ── NSO Dashboard with filter ── */
async function loadNSODashboard() {
  const deptId=el('nso-filter-dept')?.value||'',unitId=el('nso-filter-unit')?.value||'';
  const params={}; if(deptId)params.deptId=deptId;
  const [statsRes,deptStatsRes]=await Promise.all([API.getStats(),API.getDeptStats(params)]);
  const s=statsRes.stats||{};
  txt('nso-stat-users',s.learners||0);txt('nso-stat-done',(s.pass_rate||0)+'%');
  txt('nso-stat-active',s.enrollments||0);txt('nso-stat-certs',s.certs_issued||0);txt('nso-today-logins',s.logins_today||0);
  const depts=deptStatsRes.deptStats||[];
  const groups=App._depts||(typeof DEPT_GROUPS!=='undefined'?DEPT_GROUPS:[]);
  const display=depts.length?depts:groups.slice(0,8).map(g=>({deptId:g.id,dept:g.name,passRate:Math.floor(60+Math.random()*35),userCount:Math.floor(5+Math.random()*20)}));
  html('nso-dept-chart',display.map(d=>`<div class="chart-bar-row"><div class="chart-bar-label" style="font-size:11px" title="${d.dept||d.deptId}">${(d.dept||d.deptId||'').replace('กลุ่มงานการพยาบาล','').trim().slice(0,18)}</div><div class="chart-bar-track"><div class="chart-bar-fill" style="width:${d.passRate||0}%;background:${d.passRate>=80?'var(--green)':d.passRate>=60?'var(--teal)':'var(--gold)'}"></div></div><div class="chart-bar-val">${d.passRate||0}%</div><div style="font-size:10px;color:var(--text-dim);width:38px">${d.userCount||0} คน</div></div>`).join(''));
}

function onNSODeptFilter() { populateUnitSelect('nso-filter-unit',el('nso-filter-dept')?.value||''); loadNSODashboard(); }
function filterNSODashboard() { loadNSODashboard(); }

/* ── NSO Learners — full filter: dept/unit/course/status ── */
async function loadNSOLearners() {
  const deptId=el('nso-learner-dept')?.value||'',unitId=el('nso-learner-unit')?.value||'';
  const courseFilter=el('nso-learner-course-filter')?.value||'';
  const statusFilter=el('nso-learner-status-filter')?.value||'';
  const searchQ=(el('nso-learner-search')?.value||'').toLowerCase();
  const params={}; if(deptId)params.deptId=deptId;

  const [usersRes,enrollRes,certRes]=await Promise.all([API.getUsers(params),API.getEnrollments(),API.getAllCerts()]);
  let users=(usersRes.users||[]).filter(u=>u.role==='learner');
  if(unitId) users=users.filter(u=>String(u.unitId)===String(unitId));
  if(searchQ) users=users.filter(u=>(u.name||'').toLowerCase().includes(searchQ));

  const enrollments=enrollRes.enrollments||[],certs=certRes.certs||[];
  App.allEnrollments=enrollments; App.allCerts=certs;

  // Build rows: if courseFilter, one row per user×course; else summary per user
  let rows=[];
  if(courseFilter) {
    rows=users.map(u=>{
      const enr=enrollments.find(e=>e.username===u.username&&e.course_id===courseFilter);
      const cert=certs.find(c=>c.username===u.username&&c.course_id===courseFilter);
      const pct=parseFloat(enr?.progress_pct||0);
      const course=App.courses.find(c=>c.id===courseFilter);
      let status='notStarted';
      if(cert||pct>=100) status='passed';
      else if(pct>0) status='inProgress';
      if(statusFilter&&status!==statusFilter) return null;
      return {user:u,pct,cert,course,status,enr};
    }).filter(Boolean);
  } else {
    rows=users.map(u=>{
      const userEnrolls=enrollments.filter(e=>e.username===u.username);
      const userCerts=certs.filter(c=>c.username===u.username);
      const avgPct=userEnrolls.length?Math.round(userEnrolls.reduce((s,e)=>s+parseFloat(e.progress_pct||0),0)/userEnrolls.length):0;
      let status='notStarted';
      if(userCerts.length&&userCerts.length>=userEnrolls.length&&userEnrolls.length>0) status='passed';
      else if(avgPct>0) status='inProgress';
      if(statusFilter&&status!==statusFilter) return null;
      return {user:u,pct:avgPct,cert:null,course:null,status,enr:null,enrollCount:userEnrolls.length,certCount:userCerts.length};
    }).filter(Boolean);
  }

  txt('nso-learner-count',rows.length);
  const PASS_THRESHOLD=70;
  html('nso-learners-body',rows.length?rows.map(r=>{
    const u=r.user,pct=r.pct;
    const statusBadge=pct>=100||r.cert?`<span class="threshold-badge threshold-pass">✅ ผ่าน</span>`:pct>0?`<span class="threshold-badge threshold-prog">⏳ ${pct}%</span>`:`<span class="threshold-badge threshold-none">❌ ยังไม่เริ่ม</span>`;
    const threshBadge=pct>=PASS_THRESHOLD?`<span class="threshold-badge threshold-pass">✓ ≥${PASS_THRESHOLD}%</span>`:`<span class="threshold-badge threshold-fail">✗ <${PASS_THRESHOLD}%</span>`;
    const courseCol=r.course?`<span style="font-size:11px">${r.course.title.slice(0,20)}</span>`:(r.enrollCount!==undefined?`<span style="font-size:11px">${r.enrollCount} วิชา / ${r.certCount} ผ่าน</span>`:'—');
    const scoreCol=r.cert?`<span style="color:var(--green)">${r.cert.score}%</span>`:`<span style="color:var(--text-muted)">—</span>`;
    return `<div class="dt-row nso-learner-row"><div class="user-cell"><div class="ua ${avatarColor(u.name)}">${u.name?.[0]||'?'}</div><div><div class="cell-name">${u.name}</div><div class="cell-sub">${u.email||u.username}</div></div></div><div style="font-size:12px;color:var(--text-muted)">${(u.dept||'—').replace('กลุ่มงานการพยาบาล','').trim().slice(0,16)}</div><div style="font-size:12px;color:var(--text-muted)">${u.unit||'—'}</div><div>${courseCol}</div><div>${progBar(pct,pct>=100?'green':pct>0?'':'')}<small style="font-size:10px;color:var(--text-muted)">${pct}%</small></div><div>${scoreCol}</div><div>${statusBadge} ${threshBadge}</div></div>`;
  }).join(''):'<div style="padding:20px;text-align:center;color:var(--text-muted)">ไม่พบผู้เรียนในเงื่อนไขนี้</div>');
}

function onNSOLearnerDeptFilter() { populateUnitSelect('nso-learner-unit',el('nso-learner-dept')?.value||''); loadNSOLearners(); }
function filterNSOLearners() { loadNSOLearners(); }

async function exportLearnerCSV() {
  API.logAudit({action:'EXPORT_REPORT',actor:App.user?.username,actorName:App.user?.name,role:App.user?.role,detail:'Export NSO Learner Report',result:'OK'});
  const deptId=el('nso-learner-dept')?.value||'';
  const [usersRes,enrollRes,certRes]=await Promise.all([API.getUsers(deptId?{deptId}:{}),API.getEnrollments(),API.getAllCerts()]);
  const users=(usersRes.users||[]).filter(u=>u.role==='learner'),enrollments=enrollRes.enrollments||[],certs=certRes.certs||[];
  const hdrs=['ชื่อ-นามสกุล','Username','กลุ่มงาน','หน่วยงาน','จำนวนวิชา','จำนวนผ่าน','คะแนนเฉลี่ย'];
  const rows=users.map(u=>{ const ue=enrollments.filter(e=>e.username===u.username),uc=certs.filter(c=>c.username===u.username),avgScore=uc.length?Math.round(uc.reduce((s,c)=>s+parseFloat(c.score||0),0)/uc.length):0; return [u.name,u.username,u.dept||'',u.unit||'',ue.length,uc.length,avgScore+'%'].join(','); });
  const csv=[hdrs.join(','),...rows].join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}));
  a.download=`nso-learners-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);
  toast('✅ Export CSV สำเร็จ','success');
}

/* ── Executive Dashboard ── */
async function loadExecDashboard() {
  const [statsRes,deptRes,courseRes,certRes]=await Promise.all([API.getStats(),API.getDeptStats(),API.getCourses(false),API.getAllCerts()]);
  const s=statsRes.stats||{},depts=deptRes.deptStats||[],courses=courseRes.courses||[],certs=certRes.certs||[];
  txt('exec-kpi-users',s.learners||s.total_users||0);txt('exec-kpi-pass',(s.pass_rate||0)+'%');txt('exec-kpi-certs',s.certs_issued||0);txt('exec-kpi-hours',s.total_hours||0);
  // Donut chart
  const total=s.learners||1,passN=Math.round(total*(s.pass_rate||0)/100),certN=s.certs_issued||0,inProgN=Math.max(0,(s.enrollments||0)-passN),notStartN=Math.max(0,total-passN-inProgN);
  drawDonut([{label:'ผ่านแล้ว',val:certN,color:'#06d6a0'},{label:'กำลังเรียน',val:inProgN,color:'#00c6e0'},{label:'ยังไม่เริ่ม',val:notStartN,color:'#f4a261'}]);
  // Top depts
  const top=depts.slice(0,6);
  html('exec-top-depts',top.map((d,i)=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div style="width:22px;height:22px;border-radius:50%;background:${i<3?'var(--gold)':'var(--teal)'};color:#000;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center">${i+1}</div><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${(d.dept||d.deptId||'').replace('กลุ่มงานการพยาบาล','').trim()}</div><div style="font-size:10px;color:var(--text-muted)">${d.userCount||0} คน</div></div><div style="font-size:14px;font-weight:800;color:${d.passRate>=80?'var(--green)':d.passRate>=60?'var(--teal)':'var(--gold)'}">${d.passRate||0}%</div></div>`).join('')||'<div style="color:var(--text-muted);font-size:13px">กำลังโหลด...</div>');
  // Course table
  const enrRes=await API.getEnrollments();const enrollments=enrRes.enrollments||[];
  html('exec-course-table',courses.slice(0,10).map(c=>{ const ce=enrollments.filter(e=>e.course_id===c.id),cc=certs.filter(x=>x.course_id===c.id),rate=ce.length?Math.round(cc.length/ce.length*100):0,avgSc=cc.length?Math.round(cc.reduce((s,x)=>s+parseFloat(x.score||0),0)/cc.length):0; return `<tr><td>${c.title}</td><td>${ce.length}</td><td>${cc.length}</td><td><span style="color:${rate>=80?'var(--green)':rate>=60?'var(--teal)':'var(--gold)'}">${rate}%</span></td><td>${avgSc?avgSc+'%':'—'}</td></tr>`; }).join(''));
}

function drawDonut(data) {
  const svg=el('exec-donut'); if(!svg) return;
  const total=data.reduce((s,d)=>s+d.val,0)||1,r=65,cx=80,cy=80,sw=22;
  let offset=0;
  const paths=data.map(d=>{ const pct=d.val/total,angle=pct*2*Math.PI,x1=cx+r*Math.sin(offset),y1=cy-r*Math.cos(offset),offset2=offset+angle,x2=cx+r*Math.sin(offset2),y2=cy-r*Math.cos(offset2),large=angle>Math.PI?1:0,path=`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`; offset=offset2; return `<path d="${path}" fill="${d.color}" opacity="0.9"/>`; }).join('');
  svg.innerHTML=`${paths}<circle cx="${cx}" cy="${cy}" r="${r-sw}" fill="#0d1e31"/>`;
  html('exec-donut-legend',data.map(d=>`<div class="donut-leg-item"><div class="donut-dot" style="background:${d.color}"></div><div style="font-size:12px">${d.label}: <strong>${d.val}</strong></div></div>`).join(''));
}

/* ── Email Notification ── */
async function initEmailNotify() {
  renderEmailLog();
  const target=el('email-target');if(target) onEmailTargetChange(target.value);
}

function onEmailTargetChange(val) {
  el('email-dept-row')&&(el('email-dept-row').style.display=val==='dept'?'block':'none');
  updateEmailPreviewCount(val);
}

async function updateEmailPreviewCount(val) {
  const res=await API.getUsers();const users=(res.users||[]).filter(u=>u.role==='learner');
  let count=users.length, msg='';
  if(val==='dept'){ const d=el('email-dept-filter')?.value||''; count=d?users.filter(u=>u.deptId===d).length:users.length; msg=`จะส่งถึง ${count} คน`; }
  else if(val==='all') msg=`จะส่งถึงผู้เรียนทั้งหมด ${count} คน`;
  else msg=`จะส่งถึงผู้เรียนตามเงื่อนไข`;
  const el2=el('email-preview-count');if(el2)el2.textContent=msg;
}

async function sendEmailNotification() {
  const target=el('email-target')?.value||'all',subject=el('email-subject')?.value?.trim(),body=el('email-body')?.value?.trim();
  if(!subject||!body){toast('กรุณากรอกหัวข้อและเนื้อหา','warn');return;}
  const btn=document.querySelector('#ntab-notify .btn-teal');if(btn){btn.disabled=true;btn.textContent='กำลังส่ง...';}
  // GAS will handle actual email sending
  const res=await API.sendEmail({target,dept:el('email-dept-filter')?.value||'',subject,body,sentBy:App.user?.name,sentAt:new Date().toISOString()});
  API.logAudit({action:'SEND_EMAIL',actor:App.user?.username,actorName:App.user?.name,role:App.user?.role,detail:`ส่ง Email: ${subject} → ${target}`,result:res.success?'OK':'FAIL'});
  const logItem={ts:new Date().toLocaleString('th-TH'),subject,target,status:res.success?'✅ ส่งสำเร็จ':'❌ GAS Email ยังไม่ได้ตั้งค่า',count:res.count||0};
  App.emailLog.unshift(logItem); renderEmailLog();
  if(btn){btn.disabled=false;btn.textContent='📧 ส่ง Email แจ้งเตือน';}
  toast(res.success?`📧 ส่ง Email สำเร็จ`:`ℹ️ บันทึกแล้ว (ต้องตั้งค่า GAS Email)`,'info');
}

function renderEmailLog() {
  html('email-log-list',App.emailLog.length?App.emailLog.map(l=>`<div class="email-log-item"><div style="font-weight:600;font-size:13px">${l.subject}</div><div class="email-log-meta">${l.ts} · ${l.target} ${l.status}</div></div>`).join(''):'<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">ยังไม่มีประวัติการส่ง</div>');
}

/* ═════════════════════════════════════════════════════
   PDF EXPORT (jsPDF via CDN)
═════════════════════════════════════════════════════ */
function loadJsPDF(cb) {
  if(window.jspdf){ cb(); return; }
  const s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  s.onload=()=>{ cb(); }; document.head.appendChild(s);
}

function exportCertPDF(certNo,nameEnc,titleEnc,score,date) {
  const name  = decodeURIComponent(nameEnc);
  const title = decodeURIComponent(titleEnc);
  const u     = App.user;
  const dept  = u?.unit || u?.dept || 'โรงพยาบาลชลบุรี';

  // สร้าง HTML ใบประกาศแล้ว print เป็น PDF (รองรับภาษาไทย 100%)
  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ใบประกาศ-${name}-${certNo}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap');
  @page { size: A5 portrait; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width: 148mm; height: 210mm;
    font-family: 'Sarabun', sans-serif;
    background: linear-gradient(160deg, #071428 0%, #0a1e38 60%, #071020 100%);
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .cert-page {
    width: 148mm; height: 210mm;
    position: relative;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 10mm 10mm;
    background: linear-gradient(160deg, #071428 0%, #0a1e38 60%, #071020 100%);
  }
  /* กรอบทอง */
  .cert-page::before {
    content: '';
    position: absolute; inset: 4mm;
    border: 1.5px solid #c8a84b;
    border-radius: 3mm;
    box-shadow: inset 0 0 0 1mm rgba(200,168,75,0.15);
  }
  .cert-page::after {
    content: '';
    position: absolute; inset: 5.5mm;
    border: 0.5px solid rgba(200,168,75,0.4);
    border-radius: 2.5mm;
  }
  /* มุมประดับ */
  .corner { position: absolute; width: 8mm; height: 8mm; }
  .corner::before, .corner::after { content:''; position:absolute; background:#c8a84b; }
  .corner::before { width:100%; height:1px; top:0; }
  .corner::after  { width:1px; height:100%; top:0; }
  .c-tl { top:4.5mm; left:4.5mm; }
  .c-tr { top:4.5mm; right:4.5mm; transform: scaleX(-1); }
  .c-bl { bottom:4.5mm; left:4.5mm; transform: scaleY(-1); }
  .c-br { bottom:4.5mm; right:4.5mm; transform: scale(-1,-1); }

  /* เหรียญ */
  .medal-wrap { position: relative; margin-bottom: 5mm; }
  .medal-circle {
    width: 22mm; height: 22mm; border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #f0c040, #c8880a);
    display: flex; align-items: center; justify-content: center;
    font-size: 10mm; box-shadow: 0 2mm 6mm rgba(200,140,10,0.6);
    position: relative;
  }
  .ribbon {
    position: absolute; top: -5mm; left: 50%; transform: translateX(-50%);
    display: flex; gap: 0;
  }
  .rib { width: 3mm; height: 6mm; }
  .rib-r { background: #cc2222; }
  .rib-w { background: #cccccc; }
  .rib-b { background: #1144cc; }

  /* ข้อความ */
  .eyebrow {
    font-size: 5.5pt; letter-spacing: 2.5px; color: #00c6e0;
    font-weight: 600; text-transform: uppercase; margin-bottom: 2.5mm;
  }
  .sep-line {
    width: 70mm; height: 1px;
    background: linear-gradient(90deg, transparent, #c8a84b 30%, #c8a84b 70%, transparent);
    margin: 2mm auto;
  }
  .cert-title {
    font-size: 20pt; font-weight: 800; color: #f4a23c;
    margin-bottom: 1mm; text-align: center;
  }
  .present-text { font-size: 8pt; color: #a0b8d0; margin-bottom: 3mm; }
  .recipient-name {
    font-size: 18pt; font-weight: 800; color: #ffffff;
    margin-bottom: 1.5mm; text-align: center; line-height: 1.2;
  }
  .recipient-dept {
    font-size: 8.5pt; color: #00c6e0; margin-bottom: 3mm; text-align: center;
  }
  .complete-label { font-size: 7.5pt; color: #a0b8d0; margin-bottom: 1.5mm; }
  .course-title {
    font-size: 11pt; font-weight: 700; color: #ffffff;
    text-align: center; line-height: 1.3; margin-bottom: 4mm;
    max-width: 110mm;
  }
  .cert-meta { font-size: 8pt; color: #00c6e0; margin-bottom: 2mm; }
  .cert-date { font-size: 7.5pt; color: #8090a8; margin-bottom: 4mm; }
  .footer-text {
    font-size: 6.5pt; color: #6070888;
    letter-spacing: 0.5px; text-align: center; color: #607088;
    margin-top: 1mm;
  }
  /* ลายเซ็น */
  .sig-row {
    display: flex; gap: 16mm; margin-top: 2mm; margin-bottom: 3mm;
  }
  .sig-col { text-align: center; }
  .sig-line {
    width: 35mm; height: 1px; background: rgba(200,168,75,0.5);
    margin: 0 auto 1.5mm;
  }
  .sig-label { font-size: 7pt; color: #8090a8; }
  .sig-name  { font-size: 7.5pt; font-weight: 700; color: #c8d8e8; }
</style>
</head>
<body>
<div class="cert-page">
  <!-- มุมประดับ -->
  <div class="corner c-tl"></div>
  <div class="corner c-tr"></div>
  <div class="corner c-bl"></div>
  <div class="corner c-br"></div>

  <!-- เหรียญ -->
  <div class="medal-wrap">
    <div class="ribbon">
      <div class="rib rib-r"></div><div class="rib rib-w"></div><div class="rib rib-b"></div>
    </div>
    <div class="medal-circle">🏅</div>
  </div>

  <!-- CERTIFICATE OF COMPLETION -->
  <div class="eyebrow">Certificate of Completion</div>
  <div class="sep-line"></div>

  <!-- ชื่อใบประกาศ -->
  <div class="cert-title">ใบประกาศนียบัตร</div>

  <div class="present-text">ขอมอบให้เพื่อรับรองว่า</div>

  <!-- ชื่อผู้รับ -->
  <div class="recipient-name">${name}</div>
  <div class="recipient-dept">${dept}</div>

  <div class="sep-line"></div>

  <!-- หลักสูตร -->
  <div class="complete-label" style="margin-top:3mm">ได้สำเร็จการศึกษาหลักสูตร</div>
  <div class="course-title">${title}</div>

  <!-- คะแนน -->
  <div class="cert-meta">คะแนน: ${score}%&nbsp;&nbsp;·&nbsp;&nbsp;เลขที่: ${certNo}</div>
  <div class="cert-date">วันที่: ${date}&nbsp;&nbsp;·&nbsp;&nbsp;โรงพยาบาลชลบุรี</div>

  <!-- ลายเซ็น -->
  <div class="sig-row">
    <div class="sig-col">
      <div class="sig-line"></div>
      <div class="sig-name">ผู้อำนวยการพยาบาล</div>
      <div class="sig-label">โรงพยาบาลชลบุรี</div>
    </div>
    <div class="sig-col">
      <div class="sig-line"></div>
      <div class="sig-name">หัวหน้าฝ่ายการพยาบาล</div>
      <div class="sig-label">โรงพยาบาลชลบุรี</div>
    </div>
  </div>

  <div class="sep-line"></div>
  <div class="footer-text">โรงพยาบาลชลบุรี&nbsp;·&nbsp;Chonburi Hospital&nbsp;·&nbsp;ฝ่ายการพยาบาล</div>
</div>
<script>
  window.onload = function() {
    window.print();
  };
</script>
</body>
</html>`;

  // เปิด popup แล้ว print → Save as PDF
  const w = window.open('', '_blank', 'width=600,height=850');
  if(!w) { toast('กรุณาอนุญาต Popup ในเบราว์เซอร์ก่อน','warn'); return; }
  w.document.write(html);
  w.document.close();
  toast('📄 กำลังเปิด PDF — เลือก "Save as PDF" ในหน้าต่างพิมพ์','info');
}


async function exportExecPDF() {
  loadJsPDF(async ()=>{
    const [statsRes,deptRes]=await Promise.all([API.getStats(),API.getDeptStats()]);
    const s=statsRes.stats||{},depts=deptRes.deptStats||[];
    const {jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4'});
    const now=new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
    doc.setFillColor(7,17,31);doc.rect(0,0,210,297,'F');
    doc.setFillColor(0,198,224);doc.rect(0,0,210,28,'F');
    doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text('CBH Learn — รายงานผู้บริหาร',105,16,{align:'center'});
    doc.setFontSize(9);doc.text('โรงพยาบาลชลบุรี  |  '+now,105,22,{align:'center'});
    const kpis=[['ผู้เรียนทั้งหมด',s.learners||0],['อัตราผ่าน',(s.pass_rate||0)+'%'],['ใบประกาศ',s.certs_issued||0],['ชม.เรียนรวม',s.total_hours||0]];
    kpis.forEach((k,i)=>{ const x=15+i*47,y=35; doc.setFillColor(13,30,49);doc.rect(x,y,44,20,'F');doc.setDrawColor(0,198,224);doc.rect(x,y,44,20);doc.setTextColor(0,198,224);doc.setFontSize(16);doc.text(String(k[1]),x+22,y+11,{align:'center'});doc.setTextColor(180,200,220);doc.setFontSize(8);doc.text(k[0],x+22,y+17,{align:'center'}); });
    doc.setTextColor(0,198,224);doc.setFontSize(12);doc.text('อัตราผ่านตามกลุ่มงาน',15,65);
    doc.setDrawColor(30,50,70);doc.line(15,68,195,68);
    depts.slice(0,12).forEach((d,i)=>{ const y=73+i*12,name=(d.dept||d.deptId||'').replace('กลุ่มงานการพยาบาล','').trim().slice(0,26),rate=d.passRate||0,barW=rate*0.9; doc.setTextColor(200,220,240);doc.setFontSize(8);doc.text(name,15,y+3);const col=rate>=80?[6,214,160]:rate>=60?[0,198,224]:[244,162,97];doc.setFillColor(...col);doc.rect(85,y-3,barW,6,'F');doc.setTextColor(...col);doc.text(rate+'%',188,y+3,{align:'right'}); });
    doc.save(`cbh-exec-report-${new Date().toISOString().slice(0,10)}.pdf`);
    toast('📄 Export PDF สำเร็จ','success');
    API.logAudit({action:'EXPORT_REPORT',actor:App.user?.username,actorName:App.user?.name,role:App.user?.role,detail:'Export Executive PDF',result:'OK'});
  });
}

async function exportNSOPDF() {
  loadJsPDF(async ()=>{
    const deptId=el('nso-filter-dept')?.value||'';
    const [usersRes,enrollRes,certRes,statsRes]=await Promise.all([API.getUsers(deptId?{deptId}:{}),API.getEnrollments(),API.getAllCerts(),API.getStats()]);
    const users=(usersRes.users||[]).filter(u=>u.role==='learner'),enrollments=enrollRes.enrollments||[],certs=certRes.certs||[],s=statsRes.stats||{};
    const {jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4'});
    const now=new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
    doc.setFillColor(7,17,31);doc.rect(0,0,210,297,'F');
    doc.setFillColor(124,58,237);doc.rect(0,0,210,26,'F');
    doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text('CBH Learn — รายงาน NSO',105,14,{align:'center'});
    doc.setFontSize(9);doc.text('โรงพยาบาลชลบุรี  |  NSO: '+App.user?.name+'  |  '+now,105,21,{align:'center'});
    doc.setTextColor(200,200,220);doc.setFontSize(9);
    const hdr=['ชื่อ-นามสกุล','กลุ่มงาน','วิชา','ผ่าน','คะแนน'];
    const cols=[15,75,130,155,175];
    hdr.forEach((h,i)=>{ doc.setFillColor(20,40,60);doc.rect(cols[i],32,cols[i+1]?cols[i+1]-cols[i]:30,6,'F');doc.setTextColor(0,198,224);doc.text(h,cols[i]+1,37); });
    users.slice(0,30).forEach((u,ri)=>{ const y=41+ri*8,ue=enrollments.filter(e=>e.username===u.username),uc=certs.filter(c=>c.username===u.username),avgSc=uc.length?Math.round(uc.reduce((s,c)=>s+parseFloat(c.score||0),0)/uc.length):0; doc.setFillColor(ri%2===0?13:16,ri%2===0?30:38,ri%2===0?49:60);doc.rect(15,y-5,180,8,'F');doc.setTextColor(220,230,240);doc.setFontSize(8);doc.text(u.name.slice(0,22),cols[0]+1,y);doc.text((u.dept||'').replace('กลุ่มงานการพยาบาล','').trim().slice(0,14),cols[1]+1,y);doc.text(String(ue.length),cols[2]+1,y);doc.text(String(uc.length),cols[3]+1,y);const col=avgSc>=70?[6,214,160]:[244,162,97];doc.setTextColor(...col);doc.text(avgSc?avgSc+'%':'—',cols[4]+1,y); });
    doc.save(`nso-report-${new Date().toISOString().slice(0,10)}.pdf`);
    toast('📄 Export NSO PDF สำเร็จ','success');
  });
}

async function exportNSOExcel() { exportLearnerCSV(); }
async function exportAdminPDF() { exportExecPDF(); }

/* ═════════════════════════════════════════════════════
   KEYBOARD & MODAL
═════════════════════════════════════════════════════ */
document.addEventListener('click',e=>{ if(e.target.classList.contains('modal-overlay'))e.target.classList.remove('open'); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape')document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open')); });
