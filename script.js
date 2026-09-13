const API='/api/index.js';
const GRACE=5, FINAL_WINDOW=5, MATCH_THRESHOLD=0.52;
const DEFAULT_TIMETABLE=[['1','Data Structures','09:00','10:00'],['2','Operating Systems','10:00','11:00'],['3','DBMS','11:15','12:15'],['4','Computer Networks','12:15','13:15'],['5','Python','14:00','15:00'],['6','AI & ML','15:00','16:00'],['7','Web Technology','16:00','17:00'],['8','Project','17:00','18:00']];
const AUTO_HOLIDAYS={'2026-01-26':'Republic Day','2026-03-04':'Holi','2026-03-21':'Id-ul-Fitr','2026-03-26':'Ram Navami','2026-03-31':'Mahavir Jayanti','2026-04-03':'Good Friday','2026-05-01':'Buddha Purnima','2026-05-27':'Id-ul-Zuha (Bakrid)','2026-06-26':'Muharram','2026-08-15':'Independence Day','2026-08-26':'Milad-un-Nabi / Id-e-Milad','2026-09-04':'Janmashtami','2026-10-02':'Mahatma Gandhi Jayanti','2026-10-20':'Dussehra (Vijay Dashami)','2026-11-08':'Diwali (Deepavali)','2026-11-24':"Guru Nanak's Birthday",'2026-12-25':'Christmas Day'};
let state={user:null,token:null,students:[],timetable:[],attendance:[],movement:[],holidays:[],notifications:[],audit:[],stream:null,regStream:null,descriptorsLoaded:false,pendingDescriptor:null,scanBusy:false,currentPage:'dashboard'};
const $=id=>document.getElementById(id), today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}), nowTime=()=>new Date().toLocaleTimeString('en-GB',{hour12:false,timeZone:'Asia/Kolkata'}), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(resource,opts={}){const h={'Content-Type':'application/json',...(opts.headers||{})};if(state.token)h.Authorization='Bearer '+state.token;const url=API+'?resource='+encodeURIComponent(resource)+(opts.query||'');let r;try{r=await fetch(url,{...opts,headers:h})}catch(e){throw Error('Server connection failed. Check that Vercel deployment and DATABASE_URL are configured.')}let j={};try{j=await r.json()}catch{}if(!r.ok)throw Error(j.error||('API error '+r.status));return j}
function localFallback(){state.students=JSON.parse(localStorage.getItem('sa_students')||'[]');state.attendance=JSON.parse(localStorage.getItem('sa_attendance')||'[]');state.movement=JSON.parse(localStorage.getItem('sa_movement')||'[]');state.holidays=JSON.parse(localStorage.getItem('sa_holidays')||'[]');state.notifications=JSON.parse(localStorage.getItem('sa_notifications')||'[]');state.timetable=JSON.parse(localStorage.getItem('sa_timetable')||'[]');if(!state.timetable.length)state.timetable=DEFAULT_TIMETABLE.map(x=>({lecture_no:+x[0],subject:x[1],start_time:x[2],end_time:x[3]}))}
function persist(){localStorage.setItem('sa_students',JSON.stringify(state.students));localStorage.setItem('sa_attendance',JSON.stringify(state.attendance));localStorage.setItem('sa_movement',JSON.stringify(state.movement));localStorage.setItem('sa_holidays',JSON.stringify(state.holidays));localStorage.setItem('sa_notifications',JSON.stringify(state.notifications));localStorage.setItem('sa_timetable',JSON.stringify(state.timetable))}
async function login(){const u=$('username').value.trim(),p=$('password').value;if(!u)return msg('Enter username');try{const j=await api('login',{method:'POST',body:JSON.stringify({username:u,password:p})});state.user={username:j.username,role:j.role};state.token=j.token;localStorage.setItem('sa_session',JSON.stringify({user:state.user,token:state.token}));await openApp()}catch(e){msg(e.message)}}
async function viewerLogin(){$('username').value='viewer';$('password').value='';await login()}
function msg(t){$('loginMsg').textContent=t}
async function openApp(){
  $('login').classList.add('hidden'); $('login').classList.remove('show'); $('login').setAttribute('aria-hidden','true');
  $('app').classList.remove('hidden');
  $('roleBadge').textContent=state.user.role+' • '+state.user.username;
  document.body.classList.toggle('viewer',state.user.role==='Viewer');
  $('staffLoginBtn').classList.toggle('hidden',state.user.role!=='Viewer');
  buildNav(); applyPermissions();
  if(!state.currentPage)state.currentPage='dashboard';
  showPage(state.currentPage);
  await load();
  showPage(state.currentPage||'dashboard');
}
function openStaffLogin(){
  $('login').classList.remove('hidden'); $('login').classList.add('show'); $('login').setAttribute('aria-hidden','false');
  $('username').value=''; $('password').value=''; $('loginMsg').textContent='';
  setTimeout(()=>$('username').focus(),50);
}
function closeStaffLogin(){
  $('login').classList.add('hidden'); $('login').classList.remove('show'); $('login').setAttribute('aria-hidden','true');
}

function logout(){localStorage.removeItem('sa_session');location.reload()}
async function load(){try{const j=await api('bootstrap');Object.assign(state,j)}catch(e){localFallback()}renderAll()}
function buildNav(){const items=[['dashboard','Dashboard'],['attendance','Start Attendance'],['students','Students'],['timetable','Timetable'],['reports','Reports'],['calendar','Holidays'],['notifications','Notifications'],['advanced','Advanced'],['settings','Settings']];$('nav').innerHTML=items.map(([id,t])=>`<button class="${state.currentPage===id?'active':''}" onclick="showPage('${id}')">${t}</button>`).join('')}
function applyPermissions(){const role=state.user.role;document.querySelectorAll('.admin-only').forEach(x=>x.style.display=role==='Admin'?'':'none');document.querySelectorAll('.teacher-admin').forEach(x=>x.style.display=['Admin','Teacher'].includes(role)?'':'none')}
function showPage(id){if(!$(id))return;state.currentPage=id;document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));$(id).classList.remove('hidden');document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.getAttribute('onclick')===`showPage('${id}')`));renderAll()}
function minutes(t){const [h,m]=String(t).split(':').map(Number);return h*60+m}function currentLecture(){const n=new Date(),cur=n.getHours()*60+n.getMinutes()+n.getSeconds()/60;return state.timetable.find(l=>cur>=minutes(l.start_time)&&cur<minutes(l.end_time))}
function timing(l){if(!l)return'NO ACTIVE LECTURE';const n=new Date(),cur=n.getHours()*60+n.getMinutes()+n.getSeconds()/60,s=minutes(l.start_time),e=minutes(l.end_time);if(cur>=s&&cur<s+GRACE)return'PRESENT WINDOW';if(cur>=s+GRACE&&cur<e-FINAL_WINDOW)return'LATE WINDOW';if(cur>=e-FINAL_WINDOW&&cur<e)return'FINAL OUT WINDOW';if(cur>=e)return'ENDED';return'WAITING'}
function holidayStatus(d=today()){const dt=new Date(d+'T00:00:00'),sun=dt.getDay()===0;if(sun)return[true,'Sunday','Automatic'];const c=state.holidays.find(h=>String(h.holiday_date||h.date).slice(0,10)===d&&h.holiday_type==='College Custom');if(c)return[true,c.name,c.holiday_type];if(AUTO_HOLIDAYS[d])return[true,AUTO_HOLIDAYS[d],'Official/Gazetted'];return[false,'','']}
function renderAll(){clock();renderDashboard();renderStudents();renderTimetable();renderReports();renderCalendar();renderNotifications();fillLectureSelect();renderEvents()}
let clockTimer=null;function clock(){const n=new Date();$('dateNow').textContent=n.toLocaleDateString(undefined,{weekday:'short',day:'2-digit',month:'short',year:'numeric'});$('clock').textContent=n.toLocaleTimeString();const l=currentLecture();$('liveLecture').innerHTML=l?`<b>LECTURE ${l.lecture_no}</b> — ${esc(l.subject)} — ${l.start_time} to ${l.end_time}<br><span class="badge">${timing(l)}</span>`:'NO ACTIVE LECTURE';const h=holidayStatus();$('holidayBanner').innerHTML=h[0]?`<strong>🏖 ${esc(h[1])}</strong> — Attendance disabled`:'';if(!clockTimer)clockTimer=setInterval(()=>{clock();finalizeFinishedClient()},1000)}
async function finalizeFinishedClient(){if(!state.user)return;const l=state.timetable.find(x=>{const n=new Date(),cur=n.getHours()*60+n.getMinutes()+n.getSeconds()/60;return cur>=minutes(x.end_time)});if(l){try{await api('attendance',{method:'POST',body:JSON.stringify({action:'finalize_lecture',lecture_no:l.lecture_no,lecture_end:l.end_time,attendance_date:today()})});const j=await api('bootstrap');Object.assign(state,j);renderDashboard();renderReports()}catch{}}}
function table(el,heads,rows){$(el).innerHTML='<thead><tr>'+heads.map(h=>`<th>${esc(h)}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(v=>`<td>${esc(v)}</td>`).join('')+'</tr>').join('')+'</tbody>'}
function renderDashboard(){const td=state.attendance.filter(a=>String(a.attendance_date).slice(0,10)===today());$('statStudents').textContent=state.students.length;$('statPresent').textContent=td.filter(a=>a.status==='Present').length;$('statLate').textContent=td.filter(a=>a.status==='Late').length;$('statOut').textContent=state.movement.filter(m=>String(m.attendance_date).slice(0,10)===today()&&m.movement_type==='OUT').length;table('dashTable',['Date','Lecture','Student','Status','IN','OUT'],td.map(a=>[a.attendance_date,a.lecture_no,a.name||a.student_id,a.status,a.in_time,a.out_time]))}
function renderStudents(){table('studentTable',['ID','Name','Roll','Course','Sem','Section','Parent Mobile','Parent Email','Face'],state.students.map(s=>[s.student_id,s.name,s.roll_no,s.course,s.semester,s.section,s.parent_mobile,s.parent_email,(s.face_descriptor||s.faceDescriptor)?'Registered':'—']));$('notifStudent').innerHTML=state.students.map(s=>`<option value="${esc(s.student_id)}">${esc(s.student_id)} — ${esc(s.name)}</option>`).join('')}
function fillLectureSelect(){$('lectureSelect').innerHTML=state.timetable.map(l=>`<option value="${l.lecture_no}">Lecture ${l.lecture_no} — ${esc(l.subject)} (${l.start_time}-${l.end_time})</option>`).join('')}
function renderTimetable(){table('timeTable',['Lecture','Subject','Start','End','Current State'],state.timetable.map(l=>[l.lecture_no,l.subject,l.start_time,l.end_time,timing(l)]))}
function renderReports(){const q=($('searchReport')?.value||'').toLowerCase(),f=$('statusFilter')?.value||'All';const rows=state.attendance.filter(a=>(f==='All'||a.status===f)&&JSON.stringify(a).toLowerCase().includes(q));table('reportTable',['Date','Lecture','Student ID','Name','Status','IN','OUT'],rows.map(a=>[a.attendance_date,a.lecture_no,a.student_id,a.name||'',a.status,a.in_time,a.out_time]))}
function renderCalendar(){const rows=[];for(let m=1;m<=12;m++){const days=new Date(2026,m,0).getDate();for(let d=1;d<=days;d++){const ds=`2026-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`,h=holidayStatus(ds);if(h[0])rows.push([ds,new Date(ds+'T00:00:00').toLocaleDateString(undefined,{weekday:'long'}),h[1],h[2],h[2]==='College Custom'?'Admin can remove':'Automatic'])}}state.holidays.filter(h=>!String(h.holiday_date).startsWith('2026-')).forEach(h=>rows.push([h.holiday_date,new Date(h.holiday_date+'T00:00:00').toLocaleDateString(undefined,{weekday:'long'}),h.name,h.holiday_type,'Custom']));table('holidayTable',['Date','Day','Holiday','Type','Control'],rows.sort((a,b)=>a[0].localeCompare(b[0]))); if(state.user?.role==='Admin'){document.querySelectorAll('#holidayTable tbody tr').forEach(tr=>{const type=tr.children[3]?.textContent;const date=tr.children[0]?.textContent;if(type==='College Custom'){const b=document.createElement('button');b.className='danger small-btn';b.textContent='DELETE';b.onclick=()=>deleteHoliday(date);tr.lastElementChild.replaceChildren(b)}})}}
function renderNotifications(){table('notifTable',['Time','Student','Channel','Recipient','Subject','Status','Message'],state.notifications.map(n=>[n.sent_at||'',n.student_name,n.channel,n.recipient,n.subject,n.status,n.message]))}
function renderEvents(){table('eventTable',['Time','Student','Lecture','Event','Reason'],state.movement.slice(-100).reverse().map(m=>[m.event_time,m.student_id,m.lecture_no,m.movement_type,m.reason]))}
function can(role){return state.user&&(['Admin'].includes(role)?state.user.role==='Admin':role.includes(state.user.role))}
let toastTimer=0;
function toast(message,type='success',duration=3200){
  const root=$('toastRoot'); if(!root)return;
  const item=document.createElement('div'); item.className='toast '+type;
  const icon=type==='error'?'!':type==='warning'?'⚠':'✓';
  item.innerHTML=`<span class="toast-icon">${icon}</span><span>${esc(message)}</span><button type="button" aria-label="Close" onclick="this.parentElement.remove()">×</button>`;
  root.appendChild(item); requestAnimationFrame(()=>item.classList.add('show'));
  clearTimeout(item._timer); item._timer=setTimeout(()=>{item.classList.remove('show');setTimeout(()=>item.remove(),220)},duration);
}
function setActionBusy(btn,busy=true){if(!btn)return;btn.disabled=busy;btn.classList.toggle('is-busy',busy);if(busy)btn.dataset.busy='1';else delete btn.dataset.busy}
function buttonOf(label){return [...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label)}
function dialogClose(result=null){const d=$('actionDialog');if(!d)return;d.classList.add('hidden');d.setAttribute('aria-hidden','true');if(window._dialogResolve){const r=window._dialogResolve;window._dialogResolve=null;r(result)}}
function askDialog({title,message='',fields=[],confirmText='OK',danger=false}){
  const d=$('actionDialog');if(!d)return Promise.resolve(null);
  $('dialogTitle').textContent=title;$('dialogMessage').textContent=message;
  const box=$('dialogFields');box.innerHTML='';
  for(const f of fields){const wrap=document.createElement('label');wrap.className='dialog-field';wrap.innerHTML=`<span>${esc(f.label)}</span>`;let el;
    if(f.type==='select'){el=document.createElement('select');for(const o of f.options||[]){const op=document.createElement('option');op.value=o;op.textContent=o;el.appendChild(op)}}
    else {el=document.createElement('input');el.type=f.type||'text';el.placeholder=f.placeholder||'';el.autocomplete='off'}
    el.id='dialog_'+f.name;if(f.value!=null)el.value=f.value;wrap.appendChild(el);box.appendChild(wrap)}
  const ok=$('dialogConfirm');ok.textContent=confirmText;ok.classList.toggle('danger',danger);ok.onclick=()=>{const out={};for(const f of fields){const el=$('dialog_'+f.name);out[f.name]=el?el.value:''}dialogClose(out)};
  d.classList.remove('hidden');d.setAttribute('aria-hidden','false');setTimeout(()=>box.querySelector('input,select')?.focus(),30);
  return new Promise(resolve=>{window._dialogResolve=resolve})
}

async function saveStudent(){
  if(state.user.role!=='Admin')return toast('Only Admin can register or update students.','error');
  const s={student_id:$('sid').value.trim(),name:$('sname').value.trim(),roll_no:$('roll').value,course:$('course').value,semester:$('semester').value,section:$('section').value,parent_mobile:$('pmobile').value,parent_email:$('pemail').value,face_descriptor:state.pendingDescriptor};
  if(!s.student_id||!s.name)return toast('Student ID and Name are required.','warning');
  const btn=buttonOf('SAVE / UPDATE');setActionBusy(btn,true);
  try{await api('students',{method:'POST',body:JSON.stringify(s)});state.pendingDescriptor=null;const j=await api('bootstrap');Object.assign(state,j);renderAll();toast('Student saved successfully.')}catch(e){toast(e.message,'error')}finally{setActionBusy(btn,false)}
}
async function deleteStudent(){
  if(state.user.role!=='Admin')return toast('Only Admin can delete registered students.','error');
  const id=$('sid').value.trim();if(!id)return toast('Enter Student ID first.','warning');
  const c=await askDialog({title:'Delete Registered Student',message:`Delete ${id} and all linked attendance/movement records?`,confirmText:'DELETE',danger:true});if(!c)return;
  try{await api('students',{method:'DELETE',query:'&id='+encodeURIComponent(id)});const j=await api('bootstrap');Object.assign(state,j);renderAll();toast('Student and linked records deleted.')}catch(e){toast(e.message,'error')}
}
async function loadModels(){if(state.descriptorsLoaded)return;$('regStatus').textContent='Loading face models…';const base='https://justadudewhohacks.github.io/face-api.js/models';await faceapi.nets.tinyFaceDetector.loadFromUri(base);await faceapi.nets.faceLandmark68Net.loadFromUri(base);await faceapi.nets.faceRecognitionNet.loadFromUri(base);state.descriptorsLoaded=true}
async function camera(id){const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});$(id).srcObject=s;return s}
async function captureFaceForStudent(){if(state.user.role!=='Admin')return toast('Only Admin can capture student faces.','error');try{await loadModels();if(!state.regStream)state.regStream=await camera('regVideo');const d=await faceapi.detectSingleFace($('regVideo'),new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();if(!d)return $('regStatus').textContent='No clear face detected';state.pendingDescriptor=Array.from(d.descriptor);$('regStatus').textContent='Face captured successfully';toast('Face captured successfully.')}catch(e){$('regStatus').textContent='Camera/model error: '+e.message;toast(e.message,'error')}}
async function startCamera(){
  if(!['Admin','Teacher'].includes(state.user.role))return toast('Teacher or Admin access is required for attendance.','error');
  const h=holidayStatus();if(h[0])return toast(`Today is ${h[1]}. Attendance is disabled.`,'warning');
  if(!state.students.some(s=>s.face_descriptor||s.faceDescriptor))return toast('No registered face descriptors. Admin must register students first.','warning');
  const btn=buttonOf('START CAMERA');setActionBusy(btn,true);
  try{await loadModels();state.stream=await camera('video');$('cameraStatus').textContent='Camera running — scanning faces';scanLoop();toast('Attendance camera started.')}catch(e){$('cameraStatus').textContent=e.message;toast(e.message,'error')}finally{setTimeout(()=>setActionBusy(btn,false),700)}
}
function stopCamera(){if(state.stream){state.stream.getTracks().forEach(t=>t.stop());state.stream=null}$('cameraStatus').textContent='Camera stopped';toast('Camera stopped.','warning')}
let lastSeen={};async function scanLoop(){if(!state.stream||state.scanBusy)return;state.scanBusy=true;try{const v=$('video'),results=await faceapi.detectAllFaces(v,new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();const cur=new Set();for(const d of results){let best=null,dist=99;for(const s of state.students){const desc=s.face_descriptor||s.faceDescriptor;if(!desc)continue;const dd=faceapi.euclideanDistance(d.descriptor,new Float32Array(desc));if(dd<dist){dist=dd;best=s}}if(best&&dist<MATCH_THRESHOLD){cur.add(best.student_id);if(!lastSeen[best.student_id]){lastSeen[best.student_id]=true;await markIn(best)}}}for(const id of Object.keys(lastSeen))if(!cur.has(id))delete lastSeen[id]}catch(e){$('cameraStatus').textContent='Scan error: '+e.message}finally{state.scanBusy=false}if(state.stream)setTimeout(scanLoop,500)}
async function markIn(s){const l=state.timetable.find(x=>String(x.lecture_no)==String($('lectureSelect').value))||currentLecture();if(!l)return toast('Select or enter an active lecture.','warning');const h=holidayStatus();if(h[0])return;if(timing(l)==='ENDED'||timing(l)==='WAITING'||timing(l)==='NO ACTIVE LECTURE')return;const status=timing(l)==='PRESENT WINDOW'?'Present':'Late';try{await api('attendance',{method:'POST',body:JSON.stringify({action:'in',student_id:s.student_id,lecture_no:l.lecture_no,lecture_start:l.start_time,lecture_end:l.end_time,in_time:nowTime(),status,attendance_date:today()})});const j=await api('bootstrap');Object.assign(state,j);renderAll();toast(`${s.name||s.student_id} marked ${status}.`)}catch(e){$('cameraStatus').textContent=e.message;toast(e.message,'error')}}
async function tempOutRequest(){
  if(!['Admin','Teacher'].includes(state.user.role))return toast('Teacher or Admin access is required.','error');
  const first=await askDialog({title:'Temporary OUT / IN',message:'Enter the registered Student ID.',fields:[{name:'studentId',label:'Student ID',placeholder:'e.g. STU001'}],confirmText:'CONTINUE'});if(!first?.studentId)return;
  const sid=first.studentId.trim(),s=state.students.find(x=>String(x.student_id)===sid);if(!s)return toast('Student not found.','error');
  const l=currentLecture()||state.timetable.find(x=>String(x.lecture_no)==String($('lectureSelect').value));if(!l)return toast('No lecture selected.','warning');
  const existing=state.movement.filter(m=>m.student_id===s.student_id&&String(m.attendance_date).slice(0,10)===today()&&String(m.lecture_no)===String(l.lecture_no)).at(-1);const type=existing?.movement_type==='OUT'?'IN':'OUT';
  let reason='Returned';if(type==='OUT'){const r=await askDialog({title:'Temporary OUT Reason',message:'Select the reason.',fields:[{name:'reason',label:'Reason',type:'select',options:['Toilet','Water']}],confirmText:'RECORD OUT'});if(!r)return;reason=r.reason}
  try{await api('movement',{method:'POST',body:JSON.stringify({student_id:s.student_id,lecture_no:l.lecture_no,movement_type:type,event_time:nowTime(),reason,attendance_date:today()})});const j=await api('bootstrap');Object.assign(state,j);renderEvents();toast(`${type} recorded for ${s.name||sid}.`)}catch(e){toast(e.message,'error')}
}
async function finalOutVisible(){
  if(!['Admin','Teacher'].includes(state.user.role))return toast('Teacher or Admin access is required.','error');
  const q=await askDialog({title:'Final OUT',message:'Enter the registered Student ID.',fields:[{name:'studentId',label:'Student ID',placeholder:'e.g. STU001'}],confirmText:'PROCESS OUT'});if(!q?.studentId)return;
  const sid=q.studentId.trim(),l=currentLecture()||state.timetable.find(x=>String(x.lecture_no)==String($('lectureSelect').value));if(!l)return toast('No lecture selected.','warning');
  try{await api('attendance',{method:'POST',body:JSON.stringify({action:'final_out',student_id:sid,lecture_no:l.lecture_no,lecture_end:l.end_time,attendance_date:today()})});const j=await api('bootstrap');Object.assign(state,j);renderAll();toast('Final OUT processed at lecture end time.')}catch(e){toast(e.message,'error')}
}
async function addHoliday(){
  if(state.user?.role!=='Admin')return toast('Only Admin can add college holidays.','error');
  const date=$('hdate').value,name=$('hname').value.trim();if(!date)return toast('Please select a holiday date.','warning');if(!name)return toast('Please enter the holiday name.','warning');
  const btn=buttonOf('ADD HOLIDAY');setActionBusy(btn,true);
  try{const j=await api('holiday',{method:'POST',body:JSON.stringify({holiday_date:date,name,holiday_type:'College Custom'})});if(!j.ok)throw Error(j.error||'Unable to add holiday');const fresh=await api('bootstrap');Object.assign(state,fresh);$('hdate').value='';$('hname').value='';$('htype').value='College Custom';renderCalendar();toast('Holiday added successfully.')}catch(e){toast(e.message,'error')}finally{setActionBusy(btn,false)}
}
async function saveTimetable(){if(state.user.role!=='Admin')return toast('Only Admin can change the timetable.','error');const t={lecture_no:+$('tn').value,subject:$('tsub').value.trim(),start_time:$('tstart').value,end_time:$('tend').value};if(!t.lecture_no||t.lecture_no<1||t.lecture_no>8||!t.subject||!t.start_time||!t.end_time)return toast('Lecture 1–8, subject, start and end are required.','warning');if(minutes(t.end_time)<=minutes(t.start_time))return toast('End time must be after start time.','warning');const btn=buttonOf('SAVE TIMETABLE');setActionBusy(btn,true);try{await api('timetable',{method:'POST',body:JSON.stringify(t)});const j=await api('bootstrap');Object.assign(state,j);renderAll();toast('Timetable saved successfully.')}catch(e){toast(e.message,'error')}finally{setActionBusy(btn,false)}}
async function queueNotification(){if(!['Admin','Teacher'].includes(state.user.role))return toast('Teacher or Admin access is required.','error');const id=$('notifStudent').value,s=state.students.find(x=>x.student_id===id);if(!s)return toast('Select a student first.','warning');const n={student_id:id,student_name:s.name,channel:$('notifChannel').value,recipient:$('notifChannel').value==='Email'?s.parent_email:s.parent_mobile,subject:$('notifSubject').value,message:$('notifMessage').value,status:'Queued'};if(!n.message.trim())return toast('Enter a notification message.','warning');const btn=buttonOf('QUEUE NOTIFICATION');setActionBusy(btn,true);try{await api('notifications',{method:'POST',body:JSON.stringify(n)});const j=await api('bootstrap');Object.assign(state,j);renderNotifications();toast('Notification queued successfully.')}catch(e){toast(e.message,'error')}finally{setActionBusy(btn,false)}}
function exportCSV(){const rows=state.attendance.map(a=>[a.attendance_date,a.lecture_no,a.student_id,a.name,a.status,a.in_time,a.out_time]);const csv=[['Date','Lecture','Student ID','Name','Status','IN','OUT'],...rows].map(r=>r.map(x=>'"'+String(x??'').replaceAll('"','""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='attendance_report.csv';a.click();toast('Attendance CSV exported.')}
function showPerformance(){const total=state.students.length;const rows=state.students.map(s=>{const a=state.attendance.filter(x=>x.student_id===s.student_id);const good=a.filter(x=>['Present','Late'].includes(x.status)).length;return`${s.student_id} — ${s.name}: ${a.length?((good/a.length)*100).toFixed(1):'0.0'}%`});$('advancedOutput').innerHTML='<h3>Performance</h3><p>Registered students: '+total+'</p><pre>'+esc(rows.join('\n'))+'</pre>'}
function showLowAlerts(){const rows=state.students.map(s=>{const a=state.attendance.filter(x=>x.student_id===s.student_id),g=a.filter(x=>['Present','Late'].includes(x.status)).length,p=a.length?g/a.length*100:0;return p<75?`${s.student_id} — ${s.name}: ${p.toFixed(1)}%`:null}).filter(Boolean);$('advancedOutput').innerHTML='<h3>Low Attendance</h3><pre>'+esc(rows.length?rows.join('\n'):'No students below 75%.')+'</pre>'}
async function showProfile(){const q=await askDialog({title:'Student Profile',message:'Enter the registered Student ID.',fields:[{name:'studentId',label:'Student ID',placeholder:'e.g. STU001'}],confirmText:'VIEW PROFILE'});if(!q?.studentId)return;const s=state.students.find(x=>x.student_id===q.studentId.trim());$('advancedOutput').innerHTML=s?'<h3>Student Profile</h3><pre>'+esc(JSON.stringify(s,null,2))+'</pre>':'Student not found'}
async function showAudit(){if(state.user.role!=='Admin')return toast('Only Admin can view the audit log.','error');try{const j=await api('audit');state.audit=j.rows||[];$('advancedOutput').innerHTML='<h3>Audit Log</h3><div class="table-scroll"><table id="auditTable"></table></div>';table('auditTable',['Time','User','Role','Action','Details'],state.audit.map(a=>[a.event_time,a.username,a.role,a.action,a.details]))}catch(e){toast(e.message,'error')}}
function systemHealth(){$('advancedOutput').innerHTML='<h3>System Health</h3><p>🟢 Web UI loaded</p><p>🟢 Face API available after model load</p><p>🟢 Role separation enabled server-side</p><p>🟢 PostgreSQL persistence: '+(state.token?'connected or authenticated':'fallback')+'</p>'}
function tamperInfo(){$('advancedOutput').innerHTML='<h3>Tamper Protection</h3><p>Attendance writes, student changes, holidays, timetable and notifications are protected by server-side role checks. Login and privileged actions are audited.</p>'}
function qrInfo(){if(state.user.role!=='Admin')return toast('Only Admin can access Student QR.','error');$('advancedOutput').innerHTML='<h3>Student QR</h3><p>QR module placeholder: student IDs can be used as QR payloads for future scanner integration.</p>'}
function backupInfo(){if(state.user.role!=='Admin')return toast('Only Admin can access Backup / Restore.','error');$('advancedOutput').innerHTML='<h3>Backup / Restore</h3><p>Database backup is managed from Neon/Vercel. Do not expose database credentials in the browser.</p>'}
function faceQuality(){if(state.user.role!=='Admin')return toast('Only Admin can access Face Quality.','error');$('advancedOutput').innerHTML='<h3>Face Quality</h3><p>Use good lighting, one face at a time and a clear frontal view during Admin registration.</p>'}
function duplicateInfo(){$('advancedOutput').innerHTML='<h3>Duplicate Protection</h3><p>One attendance row per Student + Date + Lecture is enforced by the database primary key.</p>'}

async function deleteHoliday(date){if(state.user.role!=='Admin')return toast('Only Admin can remove college holidays.','error');const c=await askDialog({title:'Remove College Holiday',message:`Remove the custom holiday on ${date}?`,confirmText:'DELETE',danger:true});if(!c)return;try{await api('holiday',{method:'DELETE',query:'&date='+encodeURIComponent(date)});const j=await api('bootstrap');Object.assign(state,j);renderCalendar();toast('Holiday deleted.')}catch(e){toast(e.message,'error')}}
async function changePassword(){if(!['Admin','Teacher'].includes(state.user.role))return toast('Only Admin and Teacher can change passwords.','error');const oldp=$('oldPassword').value,newp=$('newPassword').value,conf=$('confirmPassword').value;if(!oldp||!newp)return $('passwordMsg').textContent='Current and new password are required.';if(newp!==conf)return $('passwordMsg').textContent='New passwords do not match.';if(newp.length<4)return $('passwordMsg').textContent='New password must be at least 4 characters.';const btn=buttonOf('CHANGE PASSWORD');setActionBusy(btn,true);try{await api('password',{method:'POST',body:JSON.stringify({old_password:oldp,new_password:newp})});$('oldPassword').value=$('newPassword').value=$('confirmPassword').value='';$('passwordMsg').textContent='Password changed successfully.';toast('Password changed successfully.')}catch(e){$('passwordMsg').textContent=e.message;toast(e.message,'error')}finally{setActionBusy(btn,false)}}

function startWelcome() {
  const splash = document.getElementById("splash");
  const canvas = document.getElementById("welcomeCanvas");

  if (!splash || !canvas) return;

  const ctx = canvas.getContext("2d");
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const DURATION = 10000; // EXACTLY 10 seconds
  const BLUE = "#159cff";
  const GOLD = "#ffc45c";

  let W = 0, H = 0;
  let startTime = performance.now();
  let raf;

  const particles = [];
  const PARTICLE_COUNT = 2200;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;

    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  resize();
  window.addEventListener("resize", resize);

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function ease(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }

  /*
   * PARTICLES
   * Blue particles come from left.
   * Gold particles come from right.
   */
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const left = i % 2 === 0;

    particles.push({
      side: left ? -1 : 1,

      x: left
        ? rand(-W * 0.35, W * 0.05)
        : rand(W * 0.95, W * 1.35),

      y: rand(H * 0.20, H * 0.80),

      size: rand(0.6, 2.5),
      speed: rand(0.35, 1.1),
      phase: rand(0, Math.PI * 2),
      curve: rand(-1, 1),
      depth: rand(0.35, 1),

      color: left ? BLUE : GOLD
    });
  }

  /*
   * FLOWING PARTICLE STREAM
   */
  function drawStream(time, side, color) {
    const centerX = W / 2;
    const centerY = H / 2;

    ctx.save();

    for (let s = 0; s < 7; s++) {
      ctx.beginPath();

      for (let i = 0; i <= 100; i++) {
        const p = i / 100;

        const startX =
          side < 0
            ? -W * 0.12
            : W * 1.12;

        const endX = centerX;

        const x =
          startX +
          (endX - startX) * p;

        const wave =
          Math.sin(
            p * Math.PI * 3 +
            time * 0.002 +
            s
          ) * (25 + s * 4);

        const y =
          centerY +
          wave +
          Math.sin(p * Math.PI * 2) *
          side * 30;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.strokeStyle =
        color === BLUE
          ? "rgba(21,156,255,0.18)"
          : "rgba(255,196,92,0.18)";

      ctx.lineWidth = 1.5 + s * 0.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = color;

      ctx.stroke();
    }

    ctx.restore();
  }

  /*
   * LOTUS / FLOWER SHAPE
   */
  function drawFlower(time, progress) {
    const cx = W / 2;
    const cy = H * 0.48;

    const bloom = ease(progress);

    ctx.save();
    ctx.translate(cx, cy);

    const rotation = time * 0.00025;

    ctx.rotate(rotation);

    const petals = 10;

    for (let i = 0; i < petals; i++) {
      const a =
        (Math.PI * 2 / petals) * i;

      ctx.save();
      ctx.rotate(a);

      const length =
        90 +
        Math.sin(i * 1.7) * 18;

      const width = 42;

      const gradient =
        ctx.createLinearGradient(
          0,
          -length,
          0,
          length
        );

      gradient.addColorStop(
        0,
        "rgba(70,170,255,0.10)"
      );

      gradient.addColorStop(
        0.55,
        "rgba(50,145,255,0.65)"
      );

      gradient.addColorStop(
        1,
        "rgba(255,195,85,0.82)"
      );

      ctx.beginPath();

      ctx.moveTo(0, 0);

      ctx.bezierCurveTo(
        -width,
        -length * 0.35,
        -width * 0.7,
        -length,
        0,
        -length
      );

      ctx.bezierCurveTo(
        width * 0.7,
        -length,
        width,
        -length * 0.35,
        0,
        0
      );

      ctx.fillStyle = gradient;
      ctx.globalAlpha = bloom;
      ctx.shadowBlur = 25;
      ctx.shadowColor = BLUE;

      ctx.fill();

      ctx.strokeStyle =
        "rgba(255,210,120,0.75)";

      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.restore();
    }

    /*
     * CENTER LIGHT
     */
    const glow =
      ctx.createRadialGradient(
        0,
        0,
        2,
        0,
        0,
        100
      );

    glow.addColorStop(
      0,
      "rgba(255,240,180,0.95)"
    );

    glow.addColorStop(
      0.35,
      "rgba(40,160,255,0.45)"
    );

    glow.addColorStop(
      1,
      "rgba(0,80,255,0)"
    );

    ctx.globalAlpha = bloom;
    ctx.fillStyle = glow;

    ctx.beginPath();
    ctx.arc(0, 0, 110, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /*
   * TITLE
   */
  function drawTitle(time, progress) {
    const cx = W / 2;

    let alpha = 0;

    if (progress < 0.72) {
      alpha = 0;
    } else {
      alpha = ease((progress - 0.72) / 0.16);
    }

    /*
     * Small camera zoom
     */
    const zoom =
      1 +
      Math.min(
        0.045,
        Math.max(0, progress - 0.72) * 0.15
      );

    ctx.save();

    ctx.translate(cx, H * 0.47);
    ctx.scale(zoom, zoom);

    /*
     * WELCOME
     */
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font =
      "900 clamp(54px, 8vw, 112px) Arial";

    ctx.shadowBlur = 25;
    ctx.shadowColor = BLUE;

    const welcomeGradient =
      ctx.createLinearGradient(
        0,
        -55,
        0,
        55
      );

    welcomeGradient.addColorStop(
      0,
      "#ffffff"
    );

    welcomeGradient.addColorStop(
      0.45,
      "#a9e8ff"
    );

    welcomeGradient.addColorStop(
      1,
      "#4da9ff"
    );

    ctx.globalAlpha = alpha;
    ctx.fillStyle = welcomeGradient;

    ctx.fillText(
      "WELCOME",
      0,
      0
    );

    /*
     * SUBTITLE
     */
    ctx.font =
      "800 clamp(20px, 3vw, 44px) Arial";

    ctx.shadowBlur = 16;
    ctx.shadowColor = GOLD;

    ctx.fillStyle = GOLD;

    ctx.fillText(
      "SMART ATTENDENCE SYSTEM",
      0,
      65
    );

    /*
     * GOLD LINES
     */
    ctx.strokeStyle =
      "rgba(255,196,92,0.9)";

    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(-230, 92);
    ctx.lineTo(-110, 92);
    ctx.moveTo(110, 92);
    ctx.lineTo(230, 92);
    ctx.stroke();

    ctx.restore();
  }

  /*
   * BOTTOM BLUE LIGHT / FLOOR
   */
  function drawFloor(time, progress) {
    if (progress < 0.55) return;

    const alpha =
      ease((progress - 0.55) / 0.25);

    const cx = W / 2;
    const cy = H * 0.84;

    ctx.save();

    const g =
      ctx.createRadialGradient(
        cx,
        cy,
        0,
        cx,
        cy,
        W * 0.35
      );

    g.addColorStop(
      0,
      `rgba(0,170,255,${0.35 * alpha})`
    );

    g.addColorStop(
      1,
      "rgba(0,60,180,0)"
    );

    ctx.fillStyle = g;

    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy,
      W * 0.32,
      H * 0.08,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.strokeStyle =
      `rgba(30,170,255,${0.7 * alpha})`;

    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy,
      W * 0.20,
      H * 0.035,
      0,
      0,
      Math.PI * 2
    );

    ctx.stroke();

    ctx.restore();
  }

  /*
   * MAIN ANIMATION LOOP
   */
  function animate(now) {
    const elapsed =
      now - startTime;

    const progress =
      Math.min(
        elapsed / DURATION,
        1
      );

    /*
     * Deep cinematic background
     */
    const bg =
      ctx.createRadialGradient(
        W / 2,
        H / 2,
        0,
        W / 2,
        H / 2,
        Math.max(W, H)
      );

    bg.addColorStop(
      0,
      "#071a38"
    );

    bg.addColorStop(
      0.45,
      "#020b1d"
    );

    bg.addColorStop(
      1,
      "#00030a"
    );

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /*
     * Camera-style slow zoom
     */
    const camera =
      1 +
      0.025 *
      Math.sin(
        progress * Math.PI
      );

    ctx.save();

    ctx.translate(
      W / 2,
      H / 2
    );

    ctx.scale(
      camera,
      camera
    );

    ctx.translate(
      -W / 2,
      -H / 2
    );

    /*
     * Side particle streams
     */
    drawStream(
      elapsed,
      -1,
      BLUE
    );

    drawStream(
      elapsed,
      1,
      GOLD
    );

    /*
     * Individual particles
     */
    for (const p of particles) {
      let x = p.x;
      let y = p.y;

      const distance =
        Math.abs(
          W / 2 - x
        );

      const flow =
        Math.sin(
          elapsed * 0.002 * p.speed +
          p.phase
        );

      y +=
        flow *
        22 *
        p.depth;

      /*
       * Pull particles into flower
       */
      if (progress >= 0.18) {
        const pull =
          ease(
            Math.min(
              1,
              (progress - 0.18) /
              0.30
            )
          );

        const targetX =
          W / 2 +
          Math.cos(
            p.phase +
            elapsed * 0.0004
          ) *
          180 *
          p.depth;

        const targetY =
          H * 0.48 +
          Math.sin(
            p.phase * 2
          ) *
          100 *
          p.depth;

        x +=
          (targetX - x) *
          pull *
          0.55;

        y +=
          (targetY - y) *
          pull *
          0.55;
      }

      /*
       * Continue orbiting after flower forms
       */
      if (progress > 0.48) {
        const orbit =
          (progress - 0.48) *
          Math.PI *
          1.8;

        const ox =
          Math.cos(
            p.phase + orbit
          ) *
          160 *
          p.depth;

        const oy =
          Math.sin(
            p.phase + orbit
          ) *
          75 *
          p.depth;

        x =
          W / 2 +
          (x - W / 2) * 0.45 +
          ox * 0.55;

        y =
          H * 0.48 +
          (y - H * 0.48) * 0.45 +
          oy * 0.55;
      }

      const glow =
        p.color === BLUE
          ? "rgba(40,170,255,0.85)"
          : "rgba(255,200,100,0.9)";

      ctx.fillStyle = glow;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        p.size * p.depth,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }

    /*
     * Flower appears from 2–7 seconds
     */
    const flowerProgress =
      Math.min(
        1,
        Math.max(
          0,
          (progress - 0.22) /
          0.42
        )
      );

    drawFlower(
      elapsed,
      flowerProgress
    );

    drawFloor(
      elapsed,
      progress
    );

    drawTitle(
      elapsed,
      progress
    );

    ctx.restore();

    /*
     * End smoothly at exactly 10 sec
     */
    if (progress < 1) {
      raf =
        requestAnimationFrame(
          animate
        );
    } else {
      /*
       * Keep final frame visible briefly,
       * then transition to dashboard.
       */
      setTimeout(() => {
        splash.style.transition =
          "opacity .55s ease";

        splash.style.opacity = "0";

        setTimeout(() => {
          cancelAnimationFrame(raf);

          window.removeEventListener(
            "resize",
            resize
          );

          splash.remove();
        }, 600);
      }, 250);
    }
  }

  requestAnimationFrame(animate);
}
  function flowerPoint(a,r,t){const pet=1+.48*Math.cos(6*a+t*.8);return{x:Math.cos(a)*r*pet,y:Math.sin(a)*r*pet*.62}}
  function glowCircle(x,y,r,color,alpha){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color.replace('ALPHA',alpha));g.addColorStop(1,color.replace('ALPHA','0'));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill()}
  function textReveal(text,y,progress,fontSize,fill){ctx.font=`900 ${fontSize}px Segoe UI,Arial,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';const total=ctx.measureText(text).width;const startX=w/2-total/2;ctx.save();ctx.beginPath();ctx.rect(startX-30,y-fontSize*1.2,total*progress+60,fontSize*2.4);ctx.clip();ctx.fillStyle=fill;ctx.shadowColor=fill;ctx.shadowBlur=28;ctx.fillText(text,w/2,y);ctx.restore();}
  function draw(){
    const t=frame/(FPS*DURATION); // 0..1
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#01050d';ctx.fillRect(0,0,w,h);
    const bg=ctx.createRadialGradient(w*.5,h*.48,0,w*.5,h*.48,Math.max(w,h)*.72);bg.addColorStop(0,'#071d38');bg.addColorStop(.42,'#020b1c');bg.addColorStop(1,'#000208');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    // cinematic side glows
    glowCircle(w*.08,h*.48,w*.32,'rgba(15,126,255,ALPHA)',.18);glowCircle(w*.92,h*.52,w*.32,'rgba(255,184,58,ALPHA)',.12);glowCircle(w*.5,h*.53,w*.25,'rgba(25,150,255,ALPHA)',.13);
    // star field
    for(let i=0;i<180;i++){const x=(i*83.17)%w,y=(i*47.91)%h,a=.15+.18*Math.sin(i+t*TAU*2);ctx.fillStyle=`rgba(180,220,255,${Math.max(0,a)})`;ctx.fillRect(x,y,1,1)}
    // flowing ribbons from both sides into the center
    const streamP=Math.min(1,ease(Math.max(0,(t-.02)/.52)));
    for(const s of streams){const fromX=s.side==='left'?-w*.08:w*1.08;const dir=s.side==='left'?1:-1;for(let j=0;j<5;j++){ctx.beginPath();for(let k=0;k<=90;k++){const q=k/90;const x=fromX+dir*(q*w*1.06);const centerPull=Math.pow(q,1.7);const baseY=h*s.y;const wave=Math.sin(q*8+s.phase+t*9+j)*h*.018*(1-q);const y=baseY+wave+(h*.5-baseY)*centerPull*streamP;const yy=y; if(k===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy)}ctx.strokeStyle=s.side==='left'?`rgba(40,170,255,${.14-j*.018})`:`rgba(255,194,72,${.11-j*.014})`;ctx.lineWidth=1.2+j*.45;ctx.shadowColor=s.side==='left'?'#168bff':'#ffc44a';ctx.shadowBlur=8;ctx.stroke()}}
    ctx.shadowBlur=0;
    // central flower particles
    const bloom=Math.min(1,ease(Math.max(0,(t-.18)/.42)));const settle=t>.72?1-ease(Math.min(1,(t-.72)/.28))*.08:1;const zoom=1+Math.max(0,(t-.55)/.45)*.08;
    for(const p of particles){let a=p.a+t*1.7+p.phase*.003;let r=p.r*(.16+.84*bloom)*settle;const pt=flowerPoint(a,r,t*TAU);let x=w/2+pt.x*zoom*p.z,y=h*.50+pt.y*zoom*p.z;if(t<.18){const g=ease(t/.18);x=w/2+(x-w/2)*g;y=h*.5+(y-h*.5)*g}const alpha=.25+.65*p.z;ctx.fillStyle=p.gold?`rgba(255,216,140,${alpha})`:`rgba(82,190,255,${alpha})`;ctx.shadowColor=p.gold?'#ffc85c':'#49baff';ctx.shadowBlur=p.size>1.2?7:3;ctx.beginPath();ctx.arc(x,y,p.size*(.6+.7*bloom),0,TAU);ctx.fill()}
    ctx.shadowBlur=0;
    // luminous flower core and subtle floor reflection
    glowCircle(w/2,h*.52,Math.min(w,h)*.12,'rgba(75,190,255,ALPHA)',.22);glowCircle(w/2,h*.52,Math.min(w,h)*.055,'rgba(255,214,128,ALPHA)',.18);
    ctx.strokeStyle='rgba(74,191,255,.30)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(w/2,h*.82,w*.22,h*.035,0,0,TAU);ctx.stroke();
    // title reveal after bloom
    if(t>.62){const q=ease(Math.min(1,(t-.62)/.22));textReveal(title,h*.43,q,Math.max(42,Math.min(108,w*.085)),'#eaf7ff');}
    if(t>.69){const q=ease(Math.min(1,(t-.69)/.20));textReveal(sub,h*.57,q,Math.max(20,Math.min(46,w*.034)),'#ffd47a');}
    if(t>.78){const q=ease(Math.min(1,(t-.78)/.18));ctx.strokeStyle=`rgba(66,190,255,${q*.8})`;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w*.28,h*.64);ctx.lineTo(w*.72,h*.64);ctx.stroke();}
    frame++;if(frame<=TOTAL_FRAMES)raf=requestAnimationFrame(draw);else{cancelAnimationFrame(raf);splash.classList.add('finished');setTimeout(()=>splash.remove(),900)}
  }
  const FPS=30,DURATION=10,TOTAL_FRAMES=FPS*DURATION;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(resize,80)});resize();draw();
}



document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled||b.closest('#nav'))return;if(b.dataset.busy==='1')return;b.classList.add('pressing');setTimeout(()=>b.classList.remove('pressing'),160)});

window.addEventListener('load',async()=>{
  startWelcome();
  const saved=JSON.parse(localStorage.getItem('sa_session')||'null');
  if(saved?.token){state.token=saved.token;state.user=saved.user;try{await openApp();return}catch{localStorage.removeItem('sa_session')}}
  try{
    const j=await api('login',{method:'POST',body:JSON.stringify({username:'viewer',password:''})});
    state.user={username:j.username,role:j.role}; state.token=j.token;
    localStorage.setItem('sa_session',JSON.stringify({user:state.user,token:state.token}));
    await openApp();
  }catch(e){console.error(e);openStaffLogin();}
});
