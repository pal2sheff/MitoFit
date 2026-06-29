/* FemFit Diary — app.js (основная логика, вынесена из app.html единым модулем-IIFE).
   Подключается относительным путём; область видимости не менялась.
   TODO: при переходе на сборщик/ES-модули разнести на app/i18n/data/storage/recommendation/progress/safety/pwa.js. */
(function(){
const STORAGE_KEY='femfit_diary_360_v13';
/* =====================================================================
   DATA LAYER (StorageService + модели данных + роли) — port-ready
   Единый слой доступа к данным. Сейчас работает через localStorage,
   готов к замене на API без изменения вызывающего кода.
   TODO: заменить StorageService на API-синхронизацию после подключения backend.
   TODO: добавить авторизацию и защищённые аккаунты после подключения backend.
   TODO: перед облачной версией провести юридическую и privacy-проверку модели хранения данных.
   TODO: при переходе на React Native / Flutter переиспользовать модели данных,
         тексты, алгоритмы подбора тренировки и расчёта прогресса.
   ===================================================================== */
const ROLES={PARTICIPANT:'participant',SPECIALIST:'specialist',CLINIC_ADMIN:'clinic_admin'}; /* clinic_admin — будущая роль */
const StorageService={
  /* --- сырой слой: единственное место, где приложение трогает localStorage --- */
  _read(){ try{const raw=localStorage.getItem(STORAGE_KEY); return raw?JSON.parse(raw):null;}catch(e){return null;} },
  _load(){ const raw=this._read(); return raw?merge(defaultState(),raw):defaultState(); },
  _save(st){ try{localStorage.setItem(STORAGE_KEY,JSON.stringify(st));}catch(e){} },
  _clear(){ try{localStorage.removeItem(STORAGE_KEY);}catch(e){} },
  setLangPref(l){ try{localStorage.setItem('femfit_lang',l);}catch(e){} },
  getLangPref(){ try{return localStorage.getItem('femfit_lang');}catch(e){return null;} },
  /* --- доменный API (работает с активной участницей) --- */
  getUserProfile(){ const c=client()||{}; return createUserProfile({id:c.id,name:c.name,language:(state.language||'ru'),ageRange:c.ageRange,cycleMode:c.mode,trainingLevel:c.level,trainingGoal:c.goal,equipment:c.equipment,limitations:c.limitations,selectedPlanId:c.activeProgramId}); },
  saveUserProfile(p){ const c=client(); if(!c||!p)return; if(p.name!=null)c.name=p.name; if(p.cycleMode)c.mode=p.cycleMode; if(p.trainingLevel)c.level=p.trainingLevel; if(p.equipment)c.equipment=p.equipment; if(p.limitations!=null)c.limitations=p.limitations; if(p.selectedPlanId!==undefined)c.activeProgramId=p.selectedPlanId; save(); },
  getReadinessHistory(){ return (client()||{}).checkins||[]; },
  saveReadiness(entry){ const c=client(); if(!c)return; (c.checkins=c.checkins||[]).unshift(entry); save(); },
  getWorkoutHistory(){ return (client()||{}).workouts||[]; },
  saveWorkoutSession(session){ const c=client(); if(!c)return; (c.workouts=c.workouts||[]).unshift(session); save(); },
  getCycleHistory(){ return (client()||{}).cycleEntries||[]; },
  saveCycleEntry(entry){ const c=client(); if(!c)return; (c.cycleEntries=c.cycleEntries||[]).unshift(entry); save(); },
  getSelectedPlan(){ return (typeof activeProgram==='function')?activeProgram(client()):null; },
  saveSelectedPlan(planId){ const c=client(); if(!c)return; c.activeProgramId=planId; save(); },
  exportData(){ return window.exportData(); },
  importData(ev){ return window.importData(ev); }
};
/* currentUser / роли — заготовка под аккаунты (НЕ «Клиентка») */
function currentUser(){ const c=client()||{}; return {id:c.id||null, role:(state.role==='pro'?ROLES.SPECIALIST:ROLES.PARTICIPANT), name:c.name||'', language:(state.language||'ru'), trainingMode:c.mode||'cycle', cycleMode:c.mode||'cycle', selectedPlanId:c.activeProgramId||null, createdAt:c.createdAt||null}; }
function getParticipants(){ return (state.clients||[]).map(c=>({ id:c.id, name:c.name, ageRange:c.ageRange||'', cycleMode:c.mode, selectedPlan:((c.programs||[]).find(p=>p.id===c.activeProgramId)||{}).name||null, lastReadiness:(typeof readinessScore==='function'?readinessScore(c):null), lastWorkout:((c.workouts||[])[0]||{}).date||null, weeklyProgress:(typeof calculateWeeklyProgress==='function'?calculateWeeklyProgress(c).planCompletion:null), safetySignals:((((typeof latestCheckin==='function')?latestCheckin(c):null)||{}).pain>=6) })); }
/* ---- модели данных (фабрики: одна форма для текущего кода и будущего backend/RN/Flutter) ---- */
function createUserProfile(o={}){return {id:o.id||(typeof uid==='function'?uid():String(Date.now())),name:o.name||'',language:o.language||'ru',ageRange:o.ageRange||'',cycleMode:o.cycleMode||'cycle',trainingLevel:o.trainingLevel||'start',trainingGoal:o.trainingGoal||'',equipment:o.equipment||[],limitations:o.limitations||'',selectedPlanId:o.selectedPlanId||null};}
function createReadinessEntry(o={}){return {id:o.id||uid(),date:o.date||todayISO(),sleep:o.sleep??null,energy:o.energy??null,stress:o.stress??null,soreness:o.soreness??null,pain:o.pain??null,mood:o.mood??null,readinessScore:o.readinessScore??null,readinessZone:o.readinessZone||'',notes:o.notes||''};}
function createCycleEntry(o={}){return {id:o.id||uid(),date:o.date||todayISO(),cycleDay:o.cycleDay??null,phase:o.phase||'',symptoms:o.symptoms||[],bleeding:o.bleeding||'',discomfort:o.discomfort||'',notes:o.notes||'',menopauseStatus:o.menopauseStatus||''};}
function createTrainingPlan(o={}){return {id:o.id||uid(),title:o.title||'',durationWeeks:o.durationWeeks||12,level:o.level||'start',cycleMode:o.cycleMode||'cycle',weeklyStructure:o.weeklyStructure||[],workouts:o.workouts||[],progressionRules:o.progressionRules||'',deloadWeeks:o.deloadWeeks||[4,8]};}
function createWorkoutTemplate(o={}){return {id:o.id||uid(),title:o.title||'',type:o.type||'strength',duration:o.duration||30,level:o.level||'start',equipment:o.equipment||[],targetRPE:o.targetRPE||'',exercises:o.exercises||[],safetyNotes:o.safetyNotes||''};}
function createWorkoutSession(o={}){return {id:o.id||uid(),date:o.date||todayISO(),templateId:o.templateId||null,status:o.status||'',duration:o.duration||null,averageRPE:o.averageRPE??null,painBefore:o.painBefore??null,painAfter:o.painAfter??null,strengthSets:o.strengthSets||[],cardioData:o.cardioData||null,mobilityData:o.mobilityData||null,notes:o.notes||''};}
function createExercise(o={}){return {id:o.id||uid(),title:o.title||'',category:o.category||'',movementPattern:o.movementPattern||'',level:o.level||'',equipment:o.equipment||[],shortCue:o.shortCue||'',fullMethodology:o.fullMethodology||'',commonMistakes:o.commonMistakes||[],regressions:o.regressions||[],progressions:o.progressions||[],limitations:o.limitations||'',imageUrl:o.imageUrl||'',videoUrl:o.videoUrl||''};}
function createProgressSummary(o={}){return {weekNumber:o.weekNumber||1,planCompletion:o.planCompletion||0,strengthCompleted:o.strengthCompleted||0,cardioCompleted:o.cardioCompleted||0,mobilityCompleted:o.mobilityCompleted||0,recoveryCompleted:o.recoveryCompleted||0,averageReadiness:o.averageReadiness||0,averageRPE:o.averageRPE||0,averagePain:o.averagePain||0,recommendation:o.recommendation||''};}
/* Публичный API слоя данных (для будущих модулей / переноса). */
window.StorageService=StorageService; window.ROLES=ROLES; window.currentUser=currentUser; window.getParticipants=getParticipants;
window.createUserProfile=createUserProfile; window.createReadinessEntry=createReadinessEntry; window.createCycleEntry=createCycleEntry; window.createTrainingPlan=createTrainingPlan; window.createWorkoutTemplate=createWorkoutTemplate; window.createWorkoutSession=createWorkoutSession; window.createExercise=createExercise; window.createProgressSummary=createProgressSummary;

const $=id=>document.getElementById(id);
const todayISO=()=>new Date().toISOString().slice(0,10);
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmt=(n,d=0)=>Number(n||0).toLocaleString('ru-RU',{maximumFractionDigits:d,minimumFractionDigits:d});
const modes={cycle:'Цикл',peri:'Перименопауза',post:'Постменопауза'};
const levels=['Новичок','Средний','Продвинутый'];
const patterns=['Коленно-доминантный','Тазово-доминантный','Горизонтальный жим','Горизонтальная тяга','Вертикальный жим','Вертикальная тяга','Кор','ВПН/лопатка','Переноски','Баланс','Кардио'];
const equipment=['Тренажёр','Блок','Свободные веса','Собственный вес','Резинки','Функциональное','Кардио'];
const clientNav=[['today','Сегодня','◷'],['library','Тренировки','lib'],['progress','Прогресс','chart'],['female','Цикл','♀'],['more','Ещё','…']];
const proNav=[['pro','Мои участницы','clients'],['report','Отчёт','report'],['dashboard','Дашборд участницы','dash'],['progress','Прогресс','chart'],['library','Тренировки','lib'],['more','Ещё','…']];
const baseExercises=[
{id:'leg_press',name:'Жим ногами',pattern:'Коленно-доминантный',equipment:'Тренажёр',level:'Новичок',muscles:'квадрицепсы, ягодичные',tech:'Таз прижат, колени по линии стоп, контролируемая амплитуда.',errors:'Отрыв таза, замыкание коленей, слишком глубокая амплитуда при боли.',reg:'Уменьшить амплитуду/вес',prog:'Увеличить вес или амплитуду',caution:'Боль в колене/пояснице.'},
{id:'goblet_squat',name:'Гоблет-присед',pattern:'Коленно-доминантный',equipment:'Свободные веса',level:'Новичок',muscles:'квадрицепсы, ягодичные, кор',tech:'Гантель у груди, колени по стопам, корпус устойчив.',errors:'Завал коленей, потеря пятки, округление спины.',reg:'Присед на ящик',prog:'Фронтальный присед',caution:'Боль в колене/ТБС.'},
{id:'box_squat',name:'Присед на ящик',pattern:'Коленно-доминантный',equipment:'Собственный вес',level:'Новичок',muscles:'квадрицепсы, ягодичные',tech:'Касание ящика без падения, контроль коленей.',errors:'Падение на опору, потеря корпуса.',reg:'Более высокий ящик',prog:'Гоблет-присед',caution:'Острая боль в колене.'},
{id:'split_squat',name:'Сплит-присед',pattern:'Коленно-доминантный',equipment:'Свободные веса',level:'Средний',muscles:'квадрицепсы, ягодичные, средняя ягодичная',tech:'Таз ровный, колено по стопе, медленный темп.',errors:'Потеря баланса, завал таза.',reg:'С опорой рукой',prog:'Болгарский сплит-присед',caution:'Колено/ТБС.'},
{id:'step_up',name:'Степ-ап',pattern:'Коленно-доминантный',equipment:'Собственный вес',level:'Средний',muscles:'ягодичные, квадрицепсы',tech:'Толчок верхней ногой, корпус стабилен.',errors:'Отталкивание нижней ногой, завал колена.',reg:'Низкая платформа',prog:'Гантели',caution:'Боль в колене.'},
{id:'rdl_db',name:'Румынская тяга с гантелями',pattern:'Тазово-доминантный',equipment:'Свободные веса',level:'Средний',muscles:'задняя поверхность бедра, ягодичные, разгибатели спины',tech:'Таз назад, нейтральная спина, гантели близко.',errors:'Округление спины, превращение в присед.',reg:'Хиндж с палкой',prog:'Румынская тяга со штангой',caution:'Боль в пояснице.'},
{id:'hip_thrust',name:'Хип-траст',pattern:'Тазово-доминантный',equipment:'Свободные веса',level:'Средний',muscles:'ягодичные, задняя поверхность бедра',tech:'Рёбра вниз, таз подкручен, пауза сверху.',errors:'Переразгибание поясницы.',reg:'Ягодичный мост',prog:'Штанга/тренажёр',caution:'Поясничный дискомфорт.'},
{id:'glute_bridge',name:'Ягодичный мост',pattern:'Тазово-доминантный',equipment:'Собственный вес',level:'Новичок',muscles:'ягодичные',tech:'Подъём таза без прогиба поясницы.',errors:'Толчок поясницей, отсутствие паузы.',reg:'Меньшая амплитуда',prog:'Хип-траст',caution:'Боль в пояснице.'},
{id:'back_extension',name:'Гиперэкстензия',pattern:'Тазово-доминантный',equipment:'Тренажёр',level:'Новичок',muscles:'ягодичные, разгибатели спины',tech:'Движение из таза, без переразгибания.',errors:'Рывки, чрезмерный прогиб.',reg:'Малая амплитуда',prog:'С диском',caution:'Поясница.'},
{id:'leg_curl',name:'Сгибание ног',pattern:'Тазово-доминантный',equipment:'Тренажёр',level:'Новичок',muscles:'задняя поверхность бедра',tech:'Таз стабилен, медленный возврат.',errors:'Рывок, отрыв таза.',reg:'Меньший вес',prog:'Пауза в сокращении',caution:'Судороги/сухожилия.'},
{id:'chest_press',name:'Жим от груди в тренажёре',pattern:'Горизонтальный жим',equipment:'Тренажёр',level:'Новичок',muscles:'грудные, трицепс, передняя дельта',tech:'Лопатки стабильны, локти не слишком высоко.',errors:'Плечи вперёд, резкий возврат.',reg:'Лёгкий вес',prog:'Жим гантелей',caution:'Боль в плече.'},
{id:'db_bench',name:'Жим гантелей лёжа',pattern:'Горизонтальный жим',equipment:'Свободные веса',level:'Средний',muscles:'грудные, трицепс',tech:'Контроль амплитуды, нейтральная лопатка.',errors:'Избыточное разведение локтей.',reg:'Тренажёр',prog:'Штанга',caution:'Плечо.'},
{id:'pushup',name:'Отжимания от опоры',pattern:'Горизонтальный жим',equipment:'Собственный вес',level:'Новичок',muscles:'грудные, трицепс, кор',tech:'Тело одной линией, локти контролируемо.',errors:'Провисание таза.',reg:'Выше опора',prog:'От пола',caution:'Запястье/плечо.'},
{id:'shoulder_press_machine',name:'Жим плеч в тренажёре',pattern:'Вертикальный жим',equipment:'Тренажёр',level:'Новичок',muscles:'дельтовидные, трицепс',tech:'Корпус стабилен, движение без боли.',errors:'Плечи к ушам, прогиб.',reg:'Меньше амплитуда',prog:'Гантели',caution:'Плечо.'},
{id:'landmine_press',name:'Landmine press',pattern:'Вертикальный жим',equipment:'Функциональное',level:'Средний',muscles:'передняя дельта, верх груди, трицепс',tech:'Диагональный жим вперёд-вверх, корпус стабилен.',errors:'Ротация корпуса, прогиб.',reg:'Двумя руками',prog:'Одной рукой',caution:'Плечо.'},
{id:'seated_row',name:'Горизонтальная тяга блока',pattern:'Горизонтальная тяга',equipment:'Блок',level:'Новичок',muscles:'широчайшие, ромбовидные, задняя дельта',tech:'Тянуть локтями, грудь раскрыта.',errors:'Сутулость, рывок корпусом.',reg:'Лёгкий блок',prog:'Пауза в сведении',caution:'Плечо/локоть.'},
{id:'chest_supported_row',name:'Тяга с опорой грудью',pattern:'Горизонтальная тяга',equipment:'Тренажёр',level:'Средний',muscles:'середина спины, широчайшие',tech:'Грудь на опоре, плечи вниз.',errors:'Рывки, подъём плеч.',reg:'Блок',prog:'Гантели',caution:'Плечо.'},
{id:'one_arm_cable_row',name:'Тяга одной рукой в блоке',pattern:'Горизонтальная тяга',equipment:'Блок',level:'Средний',muscles:'широчайшие, ромбовидные, кор',tech:'Корпус не вращается, локоть назад.',errors:'Поворот корпуса.',reg:'Двумя руками',prog:'Больше вес',caution:'Слабый кор.'},
{id:'lat_pulldown',name:'Тяга верхнего блока',pattern:'Вертикальная тяга',equipment:'Блок',level:'Новичок',muscles:'широчайшие, бицепс, нижняя трапеция',tech:'Тяга к верхней груди, не за голову.',errors:'Тяга за голову, рывки.',reg:'Меньше вес',prog:'Подтягивания',caution:'Плечо.'},
{id:'assisted_pullup',name:'Подтягивания с ассистом',pattern:'Вертикальная тяга',equipment:'Тренажёр',level:'Средний',muscles:'широчайшие, бицепс',tech:'Старт с депрессии лопаток, контроль.',errors:'Рывки, неполная амплитуда.',reg:'Верхний блок',prog:'Подтягивания',caution:'Плечо/локоть.'},
{id:'dead_bug',name:'Dead bug',pattern:'Кор',equipment:'Собственный вес',level:'Новичок',muscles:'поперечная мышца живота, стабилизаторы таза',tech:'Поясница стабильна, медленный темп.',errors:'Прогиб поясницы.',reg:'Только ноги',prog:'Руки+ноги',caution:'Острая боль в пояснице.'},
{id:'pallof',name:'Pallof press',pattern:'Кор',equipment:'Блок',level:'Новичок',muscles:'косые, поперечная мышца живота',tech:'Таз неподвижен, корпус не вращается.',errors:'Разворот корпуса.',reg:'Ближе к блоку',prog:'Дальше от блока',caution:'Боль в плече.'},
{id:'side_plank',name:'Боковая планка',pattern:'Кор',equipment:'Собственный вес',level:'Новичок',muscles:'косые, квадратная мышца поясницы',tech:'Тело в линию, шея нейтрально.',errors:'Провисание таза.',reg:'С коленей',prog:'Полная планка',caution:'Плечо.'},
{id:'farmers_walk',name:'Farmer’s walk',pattern:'Переноски',equipment:'Свободные веса',level:'Средний',muscles:'кор, трапеции, хват, ягодичные',tech:'Корпус высокий, шаг ровный.',errors:'Наклон, задержка дыхания.',reg:'Лёгкие гантели',prog:'Больше вес/дистанция',caution:'Поясница/хват.'},
{id:'external_rotation',name:'Наружная ротация плеча',pattern:'ВПН/лопатка',equipment:'Резинки',level:'Новичок',muscles:'подостная, малая круглая',tech:'Локоть 90°, плечо опущено, без рывка.',errors:'Увод локтя, движение корпусом.',reg:'Изометрия',prog:'Кроссовер',caution:'Боль/нестабильность плеча.'},
{id:'face_pull',name:'Face pull',pattern:'ВПН/лопатка',equipment:'Блок',level:'Средний',muscles:'задняя дельта, трапеция, наружные ротаторы',tech:'Тянуть к лицу, лопатки вниз-назад.',errors:'Прогиб, шея напряжена.',reg:'Резинка',prog:'С наружной ротацией',caution:'Плечо.'},
{id:'wall_slide',name:'Serratus wall slide',pattern:'ВПН/лопатка',equipment:'Резинки',level:'Новичок',muscles:'передняя зубчатая, нижняя трапеция',tech:'Скользить вверх без подъёма плеч.',errors:'Зажим шеи.',reg:'Без резинки',prog:'С резинкой',caution:'Боль в плече.'},
{id:'balance_tandem',name:'Тандем-стойка',pattern:'Баланс',equipment:'Собственный вес',level:'Новичок',muscles:'стопа, голень, стабилизаторы таза',tech:'Ровная стойка, взгляд вперёд.',errors:'Потеря осанки.',reg:'С опорой',prog:'Глаза закрыты/подушка',caution:'Риск падения.'},
{id:'incline_walk',name:'Ходьба на дорожке под наклоном',pattern:'Кардио',equipment:'Кардио',level:'Новичок',muscles:'сердечно-сосудистая система, ягодичные, голень',tech:'Умеренный темп, без держания за поручни при возможности.',errors:'Слишком высокая интенсивность.',reg:'Ровная ходьба',prog:'Интервалы',caution:'Одышка/АД/боль.'}
];
function seedClients(){
 const d=todayISO();
 return [
  {id:uid(),name:'Айгуль',age:34,mode:'cycle',level:'Новичок',goal:'сила, тонус, стабильный режим',equipment:'зал, тренажёры, гантели',height:168,weight:67,lastPeriod:'2026-06-01',cycleLength:28,menstruationLength:5,injuries:'нет значимых',notes:'Демо-участница с регулярным циклом.',onboardingDone:true,programs:[],activeProgramId:null,completedSessionIds:[],workouts:[],checkins:[],customExercises:[],selectedExerciseId:''},
  {id:uid(),name:'Марина',age:49,mode:'peri',level:'Средний',goal:'мышечная масса, сон, композиция тела',equipment:'зал',height:164,weight:72,lastPeriod:'2026-05-18',cycleLength:35,menstruationLength:5,injuries:'периодическая боль в колене',notes:'Демо-участница в перименопаузе.',onboardingDone:true,programs:[],activeProgramId:null,completedSessionIds:[],workouts:[],checkins:[],customExercises:[],selectedExerciseId:''},
  {id:uid(),name:'Елена',age:58,mode:'post',level:'Новичок',goal:'сила, баланс, костная плотность',equipment:'тренажёры, резинки',height:162,weight:69,lastPeriod:'',cycleLength:28,menstruationLength:5,injuries:'остеоартроз колена 1–2 ст.',notes:'Демо-участница в постменопаузе.',onboardingDone:true,programs:[],activeProgramId:null,completedSessionIds:[],workouts:[],checkins:[],customExercises:[],selectedExerciseId:''}
 ];
}
function defaultState(){return {role:'client',language:'ru',currentSection:'',activeClientId:null,clients:seedClients(),pro:{selectedClientId:null,reportText:''}}}
let state=load();
if(!state.activeClientId) state.activeClientId=state.clients[0]?.id;
if(!state.pro.selectedClientId) state.pro.selectedClientId=state.activeClientId;
ensureDemoData();
function load(){return StorageService._load();}
function merge(a,b){ if(Array.isArray(a))return Array.isArray(b)?b:a; if(a&&typeof a==='object'){const o={...a}; if(b&&typeof b==='object')Object.keys(b).forEach(k=>o[k]=merge(a[k],b[k])); return o;} return b===undefined?a:b; }
function save(){StorageService._save(state);}
function client(){return state.clients.find(c=>c.id===state.activeClientId)||state.clients[0];}
function selectedClient(){return state.clients.find(c=>c.id===state.pro.selectedClientId)||client();}
function setActiveClient(id){state.activeClientId=id; state.pro.selectedClientId=id; save(); renderAll();}
window.setActiveClient=setActiveClient;
function allExercises(c=client()){return [...baseExercises,...(c.customExercises||[])];}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function top(id,title,subtitle,actions=''){ if(typeof SCREEN_I18N!=='undefined' && lang()!=='ru' && SCREEN_I18N[id]){ const _m=SCREEN_I18N[id]; if(_m.title&&_m.title[lang()])title=_m.title[lang()]; if(_m.subtitle&&_m.subtitle[lang()])subtitle=_m.subtitle[lang()]; } const back=(id==='today'||id==='onboarding')?'':`<button class="backbtn" type="button" aria-label="Вернуться назад" onclick="goBack()">← Назад</button>`;return `<div class="topbar"><div>${back}<div class="kicker">FemFit Diary • ${esc(id)}</div><h1 class="page-title">${esc(title)}</h1><p class="page-subtitle">${subtitle}</p></div><div class="toolbar">${actions}</div></div>`}
function stat(label,value,note=''){return `<div class="metric"><div class="label">${esc(label)}</div><div class="value">${value}</div><div class="note">${note}</div></div>`}
function zoneClass(z){return z==='Зелёная'?'green':z==='Жёлтая'?'yellow':z==='Оранжевая'?'orange':z==='Красная'?'red':'blue'}
const navHistory=[];
function show(id,isBack){if(!isBack && state.currentSection && state.currentSection!==id){navHistory.push(state.currentSection); if(navHistory.length>40)navHistory.shift();}document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));$(id)?.classList.add('active');state.currentSection=id;save();renderSection(id);applyI18n($(id));document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.id===id));buildTabbar();closeDrawer();try{window.scrollTo(0,0)}catch(e){}}
window.show=show;
function setRole(role){state.role=role; if(role==='pro' && !['pro','report'].includes(state.currentSection)) state.currentSection='pro'; if(role==='client' && ['pro','report'].includes(state.currentSection)) state.currentSection='dashboard'; save(); initNav(); show(state.currentSection);}
window.setRole=setRole;

/* ===== i18n scaffold v2.2 (RU / KZ / EN) =====
   TODO: провести профессиональную редактуру казахской и английской версии интерфейса.
   TODO: расширить покрытие строк интерфейса (под-шаг 2): заголовки экранов, кнопки, подсказки. */
const translations={
  ru:{nav_today:'Сегодня',nav_workouts:'Тренировки',nav_progress:'Прогресс',nav_cycle:'Цикл',nav_more:'Ещё',nav_participants:'Мои участницы',nav_report:'Отчёт',nav_dashboard:'Дашборд участницы',role_participant:'Личный дневник',role_specialist:'Специалист',lang_label:'Язык'},
  kk:{nav_today:'Бүгін',nav_workouts:'Жаттығулар',nav_progress:'Прогресс',nav_cycle:'Цикл',nav_more:'Тағы',nav_participants:'Қатысушыларым',nav_report:'Есеп',nav_dashboard:'Қатысушы панелі',role_participant:'Жеке күнделік',role_specialist:'Маман',lang_label:'Тіл'},
  en:{nav_today:'Today',nav_workouts:'Workouts',nav_progress:'Progress',nav_cycle:'Cycle',nav_more:'More',nav_participants:'My participants',nav_report:'Report',nav_dashboard:'Participant dashboard',role_participant:'Personal diary',role_specialist:'Specialist',lang_label:'Language'}
};
const SCREEN_I18N={
  today:{title:{kk:'Бүгін',en:'Today'},subtitle:{kk:'Бүгінгі басты ақпарат: дайындық, бүгінгі жаттығу және цикл.',en:'Today at a glance: readiness, today’s workout and cycle.'}},
  readiness:{title:{kk:'Дайындық',en:'Readiness'},subtitle:{kk:'Жаттығу алдындағы қысқа тексеру. Осыдан дайындық деңгейі есептеледі.',en:'A short pre-workout check-in that calculates your readiness.'}},
  programs:{title:{kk:'12 апталық бағдарламалар',en:'12-week programs'},subtitle:{kk:'Режим, деңгей және форматқа сай бағдарламаны таңдаңыз.',en:'Choose a program by mode, level and format.'}},
  female:{title:{kk:'Цикл және күй',en:'Cycle and state'},subtitle:{kk:'Цикл, перименопауза немесе постменопауза. Жүктеме күйге қарай бейімделеді.',en:'Cycle, perimenopause or postmenopause. Load adapts to how you feel.'}},
  plan:{title:{kk:'Менің жоспарым',en:'My plan'},subtitle:{kk:'Бағдарламаңыз, ағымдағы апта және жақын жаттығу.',en:'Your program, current week and next workout.'}},
  progress:{title:{kk:'Прогресс',en:'Progress'},subtitle:{kk:'Төрт сұраққа қарапайым жауап: жоспар, прогресс, қалпына келу және әрі қарай не істеу.',en:'A simple answer to four questions: plan, progress, recovery and what’s next.'}},
  library:{title:{kk:'Жаттығулар кітапханасы',en:'Workout library'},subtitle:{kk:'Дайын жаттығулар: күш және сплиттер, кардио, мобилити және қалпына келу.',en:'Ready-made workouts: strength and splits, cardio, mobility and recovery.'}},
  redflags:{title:{kk:'Қауіпсіздік сигналдары',en:'Safety signals'},subtitle:{kk:'Жүктемені тоқтатып, маманға жүгіну қажет жағдайлар.',en:'Conditions where you should stop training and consult a specialist.'}},
  data:{title:{kk:'Деректер',en:'Data'},subtitle:{kk:'Жергілікті базаны экспорттау, импорттау және тазалау. Деректер құрылғыда сақталады.',en:'Export, import and reset the local database. Data stays on your device.'}},
  more:{title:{kk:'Тағы',en:'More'},subtitle:{kk:'Профиль, бағдарламалар, күнделік, деректер және құжаттар — бір жерде.',en:'Profile, programs, diary, data and documents — all in one place.'}},
  learn:{title:{kk:'Оқу',en:'Learning'},subtitle:{kk:'Техника, жүктеме және қауіпсіздік бойынша қысқа материалдар.',en:'Short materials on technique, load and safety.'}},
  profile:{title:{kk:'Профиль',en:'Profile'}},
  pro:{title:{kk:'Қатысушыларым',en:'My participants'}},
  report:{title:{kk:'Есеп',en:'Report'}}
};
/* TODO: расширить i18n на кнопки и подсказки внутри экранов (под-шаг 3) и профессионально отредактировать KZ/EN. */
function lang(){ return (typeof state!=='undefined' && state && state.language) || 'ru'; }
function t(key){ const L=translations[lang()]||translations.ru; return (L&&L[key])||translations.ru[key]||key; }
const NAVKEY={today:'nav_today',library:'nav_workouts',progress:'nav_progress',female:'nav_cycle',more:'nav_more',pro:'nav_participants',report:'nav_report',dashboard:'nav_dashboard'};
function navLabel(id,fallback){ return NAVKEY[id]?t(NAVKEY[id]):fallback; }
window.setLang=function(l){ if(!translations[l])return; state.language=l; StorageService.setLangPref(l); save(); initNav(); renderAll(); show(state.currentSection||'more', true); };
function renderLangSwitch(){ const html=['ru','kk','en'].map(l=>`<button type="button" class="${lang()===l?'active':''}" onclick="setLang('${l}')" data-event="language_change" aria-label="${l==='kk'?'Қазақша':l==='en'?'English':'Русский'}">${l==='kk'?'KZ':l.toUpperCase()}</button>`).join(''); const a=document.getElementById('langSwitch'); if(a)a.innerHTML=html; const b=document.getElementById('langSwitchMb'); if(b)b.innerHTML=html; }
window.t=t; window.lang=lang; window.translations=translations; window.renderLangSwitch=renderLangSwitch;
const UI_PHRASES={
  'Подобрать тренировку':{kk:'Жаттығу таңдау',en:'Pick a workout'},
  'Начать тренировку':{kk:'Жаттығуды бастау',en:'Start workout'},
  'Начать по плану':{kk:'Жоспармен бастау',en:'Start by plan'},
  'Подобрать вместо этого':{kk:'Орнына таңдау',en:'Pick instead'},
  'Завершить':{kk:'Аяқтау',en:'Finish'},
  'Завершить тренировку':{kk:'Жаттығуды аяқтау',en:'Finish workout'},
  'Оценить готовность':{kk:'Дайындықты бағалау',en:'Assess readiness'},
  'Мой план':{kk:'Менің жоспарым',en:'My plan'},
  'Выбрать программу':{kk:'Бағдарлама таңдау',en:'Choose a program'},
  'Сделать проще':{kk:'Жеңілдету',en:'Make it easier'},
  'Заменить на кардио':{kk:'Кардиоға ауыстыру',en:'Switch to cardio'},
  'Заменить на восстановление':{kk:'Қалпына келуге ауыстыру',en:'Switch to recovery'},
  'Выбрать другой':{kk:'Басқасын таңдау',en:'Choose another'},
  'Показать тренировку':{kk:'Жаттығуды көрсету',en:'Show workout'},
  'Далее':{kk:'Әрі қарай',en:'Next'},
  'Назад':{kk:'Артқа',en:'Back'},
  '← Назад':{kk:'← Артқа',en:'← Back'},
  'Отмена':{kk:'Бас тарту',en:'Cancel'},
  'Сохранить':{kk:'Сақтау',en:'Save'},
  'Начать':{kk:'Бастау',en:'Start'},
  'Сохранить и закрыть':{kk:'Сақтап жабу',en:'Save and close'},
  'Добавить':{kk:'Қосу',en:'Add'},
  'Открыть дневник':{kk:'Күнделікті ашу',en:'Open diary'},
  'Записаться в пилот':{kk:'Пилотқа жазылу',en:'Join the pilot'},
  'Экспорт':{kk:'Экспорт',en:'Export'},
  'Импорт':{kk:'Импорт',en:'Import'},
  'Сбросить':{kk:'Тазалау',en:'Reset'},
  'Подобрать':{kk:'Таңдау',en:'Pick'}
};
/* applyI18n: переводит подписи кнопок после отрисовки (только листовые кнопки, по точному совпадению).
   RU не меняется (ранний выход). TODO: расширить на подсказки и профессионально отредактировать KZ/EN. */
function applyI18n(root){ if(!root || lang()==='ru')return; const L=lang(); root.querySelectorAll('button, .btn, a.btn, .qs-btn').forEach(el=>{ if(el.childElementCount!==0)return; const txt=(el.textContent||'').trim(); const tr=UI_PHRASES[txt]; if(tr&&tr[L])el.textContent=tr[L]; }); }
window.applyI18n=applyI18n; window.UI_PHRASES=UI_PHRASES;


function initNav(){const nav=$('nav'); const items=state.role==='pro'?proNav:clientNav; nav.innerHTML=items.map(([id,label,b])=>`<button data-id="${id}" onclick="show('${id}')"><span>${navLabel(id,label)}</span><span class="badge">${b}</span></button>`).join(''); $('roleClient').classList.toggle('active',state.role==='client'); $('rolePro').classList.toggle('active',state.role==='pro'); const rc=$('roleClient'); if(rc)rc.textContent=t('role_participant'); const rp=$('rolePro'); if(rp)rp.textContent=t('role_specialist'); const mb=$('mbRole'); if(mb)mb.textContent=state.role==='pro'?t('role_specialist'):t('role_participant'); renderLangSwitch(); buildTabbar();}
function updateSide(){const c=client(); const ci=cycleInfo(todayISO(),c); const score=readinessScore(c); const z=readinessZone(score); $('sideClient').innerHTML=`<b>${esc(c.name)}</b><br>${modes[c.mode]} • ${esc(c.level)}<br><span class="small muted">${c.mode==='cycle'?ci.note:'Симптомы и восстановление'}</span>`; $('sideMetrics').innerHTML=`<span><b>Готовность</b><em>${score}%</em></span><span><b>Зона</b><em>${z}</em></span><span><b>Тренировок</b><em>${c.workouts.length}</em></span>`;}
function parseDate(v){ if(!v)return null; const s=String(v).trim(); if(/^\d{4}-\d{2}-\d{2}$/.test(s))return new Date(s+'T00:00:00'); const m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); if(m)return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T00:00:00`); const d=new Date(s); return isNaN(d)?null:d;}
function dayDiff(a,b){return Math.floor((parseDate(a)-parseDate(b))/(1000*60*60*24));}
function cycleInfo(date=todayISO(),c=client()){ if(c.mode!=='cycle') return {day:'—',phase:modes[c.mode],note:modes[c.mode]}; const lp=parseDate(c.lastPeriod); const len=Number(c.cycleLength||28); const men=Number(c.menstruationLength||5); if(!lp||!len)return {day:'—',phase:'Не рассчитано',note:'Введите дату 1-го дня цикла'}; const diff=dayDiff(date,c.lastPeriod); const day=((diff%len)+len)%len+1; let phase=day<=men?'Менструальная':day<=12?'Фолликулярная':day<=16?'Овуляторное окно':'Лютеиновая'; return {day,phase,note:`${day} день • ${phase}`};}
function latestCheckin(c=client()){return (c.checkins||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0]||null;}
function readinessScore(c=client()){ const ch=latestCheckin(c); if(!ch)return 76; const sleep=Number(ch.sleep||3), energy=Number(ch.energy||3), mood=Number(ch.mood||3), motivation=Number(ch.motivation||3); const stress=Number(ch.stress||3), soreness=Number(ch.soreness||2); const pain=Number(ch.pain||0), fem=Number(ch.femaleSymptoms||0); const positive=((sleep+energy+mood+motivation)/20)*55; const recovery=((6-stress)+(6-soreness))/10*25; const symptomPenalty=Math.min(25,pain*2.2+fem*1.4); return Math.max(0,Math.min(100,Math.round(positive+recovery+25-symptomPenalty)));}
function readinessZone(score=readinessScore()){return score>=75?'Зелёная':score>=55?'Жёлтая':score>=35?'Оранжевая':'Красная'}
function readinessAdvice(c=client()){ const score=readinessScore(c), z=readinessZone(score), ch=latestCheckin(c); const pain=Number(ch?.pain||0), fem=Number(ch?.femaleSymptoms||0); if(pain>=6) return 'Боль ≥6/10: тренировку не проводить, нужна очная оценка/коррекция плана.'; if(z==='Зелёная') return 'Тренировка по плану. При RPE ниже целевого можно прогрессировать на 2,5–5%.'; if(z==='Жёлтая') return 'Снизить вес на 5–10% или убрать 1 подход в базовых упражнениях. HIIT не усиливать.'; if(z==='Оранжевая') return 'Лёгкая тренировка: техника, мобилизация, ходьба, кор без провокации боли. Объём снизить на 20–40%.'; return 'Восстановительный день. При красных флагах, боли или кровотечении — медицинская оценка.';}
function e1rm(weight,reps){weight=Number(weight||0);reps=Number(reps||0); if(!weight||!reps)return 0; return weight*(1+reps/30)}
function tonnage(w){return (w.exercises||[]).flatMap(e=>e.sets||[]).reduce((s,x)=>s+Number(x.weight||0)*Number(x.reps||0),0)}
function avgWorkoutRPE(w){const sets=(w.exercises||[]).flatMap(e=>e.sets||[]).filter(s=>s.rpe); if(!sets.length)return 0; return sets.reduce((a,b)=>a+Number(b.rpe||0),0)/sets.length}
function avgRPE(c=client()){const arr=c.workouts||[]; const sets=arr.flatMap(w=>(w.exercises||[]).flatMap(e=>e.sets||[])).filter(s=>s.rpe); if(!sets.length)return 0; return sets.reduce((a,b)=>a+Number(b.rpe||0),0)/sets.length}
function activeProgram(c=client()){return (c.programs||[]).find(p=>p.id===c.activeProgramId)||c.programs?.[0]||null;}
function nextSession(c=client()){const p=activeProgram(c); if(!p)return null; return p.sessions.find(s=>!c.completedSessionIds.includes(s.id))||p.sessions[p.sessions.length-1];}
function setClientField(k,v){const c=client(); c[k]=isNaN(v)||v===''?v:Number(v); save(); renderAll();}
window.setClientField=setClientField;
function ensureDemoData(){ state.clients.forEach(c=>{ if(!c.checkins.length){c.checkins.push({id:uid(),date:todayISO(),sleep:4,energy:4,stress:2,mood:4,soreness:2,pain:c.mode==='peri'?3:1,femaleSymptoms:c.mode==='cycle'?3:(c.mode==='peri'?5:2),motivation:4});} if(!c.programs.length){generateProgramForClient(c,false);} if(!c.workouts.length){const s=nextSession(c); if(s){ createWorkoutFromSessionForClient(c,s,false); const w=c.workouts[0]; w.date=new Date(Date.now()-86400000*3).toISOString().slice(0,10); (w.exercises||[]).forEach((e,ei)=>e.sets.forEach((set,si)=>{ set.reps=ei===4?10:8+si; set.weight=ei===4?0:(ei+1)*10+si*2.5; set.rpe=ei===4?6:7; set.rir=3; set.pain=c.mode==='peri'&&ei===0?3:1;})); }} }); save();}
function programTemplates(mode,level){
 const beginner={A:['leg_press','glute_bridge','chest_press','seated_row','dead_bug'],B:['goblet_squat','back_extension','landmine_press','lat_pulldown','pallof'],C:['step_up','leg_curl','pushup','external_rotation','side_plank'],D:['box_squat','hip_thrust','shoulder_press_machine','chest_supported_row','farmers_walk']};
 const medium={A:['goblet_squat','rdl_db','db_bench','seated_row','pallof'],B:['split_squat','hip_thrust','landmine_press','lat_pulldown','side_plank'],C:['step_up','leg_curl','chest_press','one_arm_cable_row','farmers_walk'],D:['leg_press','back_extension','shoulder_press_machine','assisted_pullup','dead_bug']};
 const advanced={A:['goblet_squat','rdl_db','db_bench','chest_supported_row','pallof'],B:['split_squat','hip_thrust','landmine_press','assisted_pullup','farmers_walk'],C:['step_up','leg_curl','pushup','one_arm_cable_row','side_plank'],D:['leg_press','back_extension','shoulder_press_machine','lat_pulldown','external_rotation']};
 let tpl=level==='Продвинутый'?advanced:(level==='Средний'?medium:beginner);
 if(mode==='post') tpl={A:['leg_press','glute_bridge','chest_press','seated_row','dead_bug'],B:['box_squat','back_extension','landmine_press','lat_pulldown','balance_tandem'],C:['step_up','leg_curl','chest_supported_row','external_rotation','farmers_walk'],D:['incline_walk','hip_thrust','shoulder_press_machine','seated_row','side_plank']};
 if(mode==='peri'&&level==='Новичок') tpl={A:['leg_press','rdl_db','chest_press','seated_row','pallof'],B:['split_squat','glute_bridge','landmine_press','lat_pulldown','side_plank'],C:['goblet_squat','back_extension','chest_supported_row','external_rotation','incline_walk']};
 return tpl;
}
function blockForWeek(w){ if([4,8].includes(w)) return {name:'Deload',sets:2,reps:'10–12',rpe:'5–6',rir:'4–5'}; if(w<=3)return {name:'Адаптация',sets:3,reps:'8–12',rpe:'6–7',rir:'3–4'}; if(w<=7)return {name:'Накопление',sets:4,reps:'8–10',rpe:'7–8',rir:'2–3'}; if(w<=11)return {name:'Интенсификация',sets:4,reps:'6–8',rpe:'7–8',rir:'1–3'}; return {name:'Закрепление',sets:3,reps:'8–10',rpe:'6–7',rir:'3–4'};}
function addDays(date,n){const d=parseDate(date); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10)}

/* ===== training engine v1.6: program catalog, onboarding match, day substitution ===== */
const SB={
 FB_A:{label:'Фуллбоди A',ids:['leg_press','glute_bridge','chest_press','seated_row','dead_bug']},
 FB_B:{label:'Фуллбоди B',ids:['goblet_squat','back_extension','landmine_press','lat_pulldown','pallof']},
 FB_C:{label:'Фуллбоди C',ids:['step_up','leg_curl','pushup','external_rotation','side_plank']},
 UP_A:{label:'Верх A',ids:['db_bench','seated_row','landmine_press','lat_pulldown','external_rotation']},
 UP_B:{label:'Верх B',ids:['chest_press','one_arm_cable_row','shoulder_press_machine','assisted_pullup','side_plank']},
 LO_A:{label:'Низ A',ids:['goblet_squat','rdl_db','leg_press','leg_curl','pallof']},
 LO_B:{label:'Низ B',ids:['split_squat','hip_thrust','box_squat','back_extension','dead_bug']},
 GL:{label:'Ягодицы и ноги',ids:['hip_thrust','glute_bridge','split_squat','back_extension','side_plank']},
 LO_STR:{label:'Низ: сила',ids:['box_squat','rdl_db','leg_press','leg_curl','pallof']},
 UP_STR:{label:'Верх: сила',ids:['db_bench','chest_supported_row','shoulder_press_machine','lat_pulldown','external_rotation']},
 UP_HYP:{label:'Верх: гипертрофия',ids:['chest_press','seated_row','landmine_press','one_arm_cable_row','side_plank']},
 LO_AX:{label:'Низ + осевая',ids:['box_squat','hip_thrust','step_up','back_extension','balance_tandem']}
};
const PROGRAM_CATALOG=[
 {id:'p_omc_beg',mode:'cycle',level:'Новичок',format:'Фуллбоди',name:'Цикл · Новичок · Fullbody 3×',focus:'Техника, базовые паттерны, привычка к дневнику',week:[{t:'s',k:'FB_A'},{t:'c',l:'tl_tread2'},{t:'s',k:'FB_B'},{t:'m',l:'tl_mobhip'},{t:'s',k:'FB_C'}]},
 {id:'p_omc_mid_fb',mode:'cycle',level:'Средний',format:'Фуллбоди + кардио',name:'Цикл · Средний · Fullbody + Cardio',focus:'Прогрессия, силовая выносливость, кардио Zone 2',week:[{t:'s',k:'FB_A'},{t:'c',l:'tl_tread2'},{t:'s',k:'FB_B'},{t:'c',l:'tl_walk'},{t:'s',k:'FB_C'},{t:'m',l:'tl_recafter'}]},
 {id:'p_omc_mid_ul',mode:'cycle',level:'Средний',format:'Upper/Lower',name:'Цикл · Средний · Upper/Lower 4×',focus:'Гипертрофия и разнообразие паттернов',week:[{t:'s',k:'UP_A'},{t:'s',k:'LO_A'},{t:'c',l:'tl_ellip2'},{t:'s',k:'UP_B'},{t:'s',k:'LO_B'},{t:'m',l:'tl_mobtspine'}]},
 {id:'p_omc_adv',mode:'cycle',level:'Продвинутый',format:'Push/Pull/Legs',name:'Цикл · Продвинутый · Strength + Hypertrophy',focus:'Силовые блоки и гипертрофия, контроль объёма',week:[{t:'s',k:'LO_STR'},{t:'s',k:'UP_STR'},{t:'c',l:'tl_bike2'},{t:'s',k:'GL'},{t:'s',k:'UP_HYP'},{t:'m',l:'tl_recafter'}]},
 {id:'p_peri_beg',mode:'peri',level:'Новичок',format:'Силовая + кардио',name:'Перименопауза · Новичок · Strength Base + Walking',focus:'Силовая база и ходьба, мягкий старт',week:[{t:'s',k:'FB_A'},{t:'c',l:'tl_walk'},{t:'s',k:'FB_B'},{t:'m',l:'tl_mobhip'},{t:'c',l:'tl_walk'}]},
 {id:'p_peri_mid',mode:'peri',level:'Средний',format:'Upper/Lower',name:'Перименопауза · Средний · Upper/Lower + Zone 2',focus:'Сила и умеренное кардио, контроль восстановления',week:[{t:'s',k:'UP_A'},{t:'s',k:'LO_A'},{t:'c',l:'tl_ellip2'},{t:'s',k:'UP_B'},{t:'c',l:'tl_tread2'},{t:'m',l:'tl_mobtspine'}]},
 {id:'p_peri_adv',mode:'peri',level:'Продвинутый',format:'Силовая + восстановление',name:'Перименопауза · Продвинутый · Strength + Recovery',focus:'Сила с акцентом на восстановление',week:[{t:'s',k:'LO_STR'},{t:'s',k:'UP_STR'},{t:'c',l:'tl_bike2'},{t:'s',k:'GL'},{t:'m',l:'tl_recafter'},{t:'r',l:'tl_recday'}]},
 {id:'p_post_beg',mode:'post',level:'Новичок',format:'Сила + баланс',name:'Постменопауза · Новичок · Strength + Balance + Walking',focus:'Сила, баланс, ходьба, профилактика падений',week:[{t:'s',k:'FB_A'},{t:'b',l:'tl_balance'},{t:'c',l:'tl_walk'},{t:'s',k:'FB_B'},{t:'m',l:'tl_mobhip'}]},
 {id:'p_post_mid',mode:'post',level:'Средний',format:'Сила + кости',name:'Постменопауза · Средний · Strength + Bone Health',focus:'Сила с осевой нагрузкой и баланс',week:[{t:'s',k:'LO_AX'},{t:'s',k:'UP_A'},{t:'b',l:'tl_balance'},{t:'s',k:'LO_B'},{t:'c',l:'tl_tread2'},{t:'m',l:'tl_mobhip'}]},
 {id:'p_post_adv',mode:'post',level:'Продвинутый',format:'Сила + баланс',name:'Постменопауза · Продвинутый · Strength + Power + Balance',focus:'Сила, аккуратная мощность и баланс',week:[{t:'s',k:'LO_STR'},{t:'s',k:'UP_STR'},{t:'b',l:'tl_balance'},{t:'s',k:'GL'},{t:'c',l:'tl_ellip2'},{t:'m',l:'tl_recafter'}]}
];
function dayKind(t){return t==='s'?'strength':t==='c'?'cardio':t==='m'?'mobility':t==='st'?'stretch':t==='b'?'balance':t==='r'?'recovery':'strength'}
function progDayOffsets(n){return n<=2?[0,3]:n===3?[0,2,4]:n===4?[0,1,3,5]:n===5?[0,1,3,4,6]:[0,1,2,4,5,6]}
function buildCatalogProgram(c,entryId){
  const e=PROGRAM_CATALOG.find(x=>x.id===entryId); if(!e)return null;
  const start=todayISO(); const off=progDayOffsets(e.week.length); const arr=[];
  for(let week=1;week<=12;week++){ const b=blockForWeek(week);
    e.week.forEach((spec,i)=>{
      const kind=dayKind(spec.t); let name='', plan='', exercises=[];
      if(spec.t==='s'){ const bp=SB[spec.k]||SB.FB_A; name=bp.label;
        exercises=bp.ids.map((id,order)=>{const ex=baseExercises.find(x=>x.id===id)||allExercises(c).find(x=>x.id===id); const isAcc=(ex&&(ex.pattern==='Кор'||ex.pattern==='Баланс')); return {exerciseId:id,name:(ex&&ex.name)||id,pattern:(ex&&ex.pattern)||'',sets:order>=4?Math.max(2,b.sets-1):b.sets,reps:order>=4?(isAcc?'30–45 сек':'12–15'):b.reps,rpe:b.rpe,rir:b.rir};});
      } else { const li=trainingLibrary.find(x=>x.id===spec.l)||{name:kindLabel(kind),dur:25,intensity:'лёгкая',rpe:'3',goal:''}; name=li.name; plan=`${kindLabel(kind)} · ${li.dur} мин · ${li.intensity} · RPE ${li.rpe}. ${li.goal}`; }
      arr.push({id:uid(),week,date:addDays(start,(week-1)*7+(off[i]||0)),name:`Нед ${week} • ${name}`,kind,block:kind==='strength'?b.name:'—',plan,mode:c.mode,level:e.level,exercises});
    });
  }
  const p={id:uid(),createdAt:new Date().toISOString(),name:e.name,catalogId:e.id,mode:c.mode,level:e.level,format:e.format,sessionsPerWeek:e.week.length,startDate:start,sessions:arr};
  c.programs.unshift(p); c.activeProgramId=p.id; c.completedSessionIds=[]; c.onboardingDone=true; save(); return p;
}
window.chooseProgram=function(id){const c=client(); if(buildCatalogProgram(c,id)){toast('Программа выбрана'); renderAll(); show('programs');}};
function suggestProgram(c){ const inMode=PROGRAM_CATALOG.filter(e=>e.mode===c.mode); let pool=inMode.filter(e=>e.level===(c.level||'Новичок')); if(!pool.length)pool=inMode; const f=(c.format||'').toLowerCase(); let pick=f?pool.find(e=>e.format.toLowerCase().includes(f)||f.includes(e.format.toLowerCase().split(' ')[0])):null; return pick||pool[0]; }
window.suggestAndCreate=function(){const c=client(); const e=suggestProgram(c); if(e&&buildCatalogProgram(c,e.id)){toast('Подобрана программа: '+e.name); renderAll(); show('programs');}};
function programPicker(c){
  const list=PROGRAM_CATALOG.filter(e=>e.mode===c.mode); const active=activeProgram(c);
  return `<div class="card"><h2>Выбор программы — ${modes[c.mode]}</h2><p class="muted small" style="margin-top:-4px">Программы под ваш режим. Уровни и форматы реально отличаются структурой недели: состав силовых дней, количество кардио, мобилити и восстановления. Недели 4 и 8 — разгрузочные.</p><div class="grid cols-3" style="margin-top:14px">${list.map(e=>{const act=active&&active.catalogId===e.id; return `<div class="lib-card" style="${act?'border-color:var(--plum);box-shadow:0 12px 28px rgba(157,94,120,.15)':''}"><h4>${esc(e.name)}</h4><div class="tagline"><span class="tag">${esc(e.level)}</span><span class="tag">${esc(e.format)}</span><span class="tag">${e.week.length} дн/нед</span></div><p class="small muted">${esc(e.focus)}</p><div class="tagline">${e.week.map(d=>`<span class="tag" style="background:${kindColor(dayKind(d.t))};color:#fff;border-color:transparent">${esc(kindLabel(dayKind(d.t)))}</span>`).join('')}</div><button class="btn ${act?'':'primary'} smallbtn" style="margin-top:8px" onclick="chooseProgram('${e.id}')" data-event="program_select">${act?'Пересоздать':'Выбрать'}</button></div>`;}).join('')}</div></div>`;
}
function todaySubCard(c){
  const z=readinessZone(readinessScore(c)); if(z!=='Оранжевая'&&z!=='Красная')return '';
  const red=z==='Красная';
  return `<div class="card" style="margin-top:18px;border-color:${red?'#eccacd':'#f0d9c4'}"><h3>Замена на сегодня · ${z} зона</h3><p class="small muted">${red?'Силовая сегодня не рекомендуется. Лучше восстановление или прогулка. При красных флагах — к специалисту.':'Тяжёлую силовую можно заменить на технику, мобилити или лёгкое кардио Zone 2.'}</p><div class="row-actions" style="justify-content:flex-start;margin-top:8px">${red?`<button class="btn smallbtn" onclick="startLibWorkout('tl_recday')">Восстановительный день</button><button class="btn smallbtn" onclick="startLibWorkout('tl_walk')">Лёгкая ходьба</button>`:`<button class="btn smallbtn" onclick="startLibWorkout('tl_mobhip')">Мобилити</button><button class="btn smallbtn" onclick="startLibWorkout('tl_tread2')">Zone 2 кардио</button>`}</div></div>`;
}

function generateProgramForClient(c=client(),notify=true){ const sessions=Number(c.sessionsPerWeek||3); const tpl=programTemplates(c.mode,c.level); const keys=Object.keys(tpl).slice(0,sessions); const start=todayISO(); const days=sessions===4?[0,2,4,6]:sessions===2?[0,3]:[0,2,4]; const arr=[]; for(let week=1;week<=12;week++){const b=blockForWeek(week);keys.forEach((k,i)=>{ const exs=tpl[k].map((id,order)=>{const ex=baseExercises.find(e=>e.id===id)||allExercises(c).find(e=>e.id===id); return {exerciseId:id,name:ex?.name||id,pattern:ex?.pattern||'',sets:order===4?Math.max(2,b.sets-1):b.sets,reps:order===4?((ex?.pattern==='Кор'||ex?.pattern==='Баланс')?'30–45 сек / 10–12':'12–15'):b.reps,rpe:b.rpe,rir:b.rir};}); arr.push({id:uid(),week,date:addDays(start,(week-1)*7+(days[i]||0)),name:`Неделя ${week} • Тренировка ${k}`,sessionKey:k,block:b.name,mode:c.mode,level:c.level,exercises:exs});});}
 const p={id:uid(),createdAt:new Date().toISOString(),name:`${modes[c.mode]} • ${c.level} • 12 недель`,mode:c.mode,level:c.level,sessionsPerWeek:sessions,startDate:start,sessions:arr}; c.programs.unshift(p); c.activeProgramId=p.id; c.onboardingDone=true; if(notify){save();toast('12-недельная программа создана');renderAll();show('programs');} }
window.generateProgram=function(){generateProgramForClient(client(),true)};
function createWorkoutFromSessionForClient(c,s,notify=true){ if(!s)return; const w={id:uid(),date:todayISO(),title:s.name,sessionId:s.id,kind:s.kind||'strength',mode:c.mode,cycle:cycleInfo(todayISO(),c),readiness:{score:readinessScore(c),zone:readinessZone(readinessScore(c))},summary:{status:'',feelAfter:'',painAfter:'',fatigueAfter:'',comment:''},notes:s.plan||'Создано из 12-недельной программы.',exercises:s.exercises.map(e=>({id:uid(),exerciseId:e.exerciseId,name:e.name,pattern:e.pattern,target:`${e.sets}×${e.reps}, RPE ${e.rpe}, RIR ${e.rir}`,sets:Array.from({length:Number(e.sets)||3},(_,i)=>({id:uid(),set:i+1,reps:'',weight:'',rpe:'',rir:'',pain:'',comment:''}))}))}; c.workouts.unshift(w); if(!c.completedSessionIds.includes(s.id)) c.completedSessionIds.push(s.id); if(notify){save();toast('Тренировка добавлена');show('log');renderAll();} }
window.createWorkoutFromSession=function(sessionId){const c=client(); const p=activeProgram(c); const s=p?.sessions.find(x=>x.id===sessionId)||nextSession(c); createWorkoutFromSessionForClient(c,s,true)};

/* ===== onboarding wizard v1.7 ===== */
window.obStep=window.obStep||1;
window.obPick=function(field,val){const c=client(); if(field==='modePref'){c.modePref=val;c.mode=(val==='skip'?'cycle':val);}else{c[field]=val;} save(); window.obNext();};
window.obToggleEquip=function(e){const c=client(); if(!Array.isArray(c.equipment))c.equipment=c.equipment?[String(c.equipment)]:[]; const i=c.equipment.indexOf(e); if(i>=0)c.equipment.splice(i,1); else c.equipment.push(e); save(); renderOnboarding();};
window.obNext=function(){window.obStep=Math.min(4,(window.obStep||1)+1); renderOnboarding();};
window.obBack=function(){window.obStep=Math.max(1,(window.obStep||1)-1); renderOnboarding();};
window.obFinish=function(){const c=client(); if(!c.mode)c.mode='cycle'; if(!c.level)c.level='Новичок'; const e=suggestProgram(c); if(e)buildCatalogProgram(c,e.id); c.onboardingDone=true; save(); window.obStep=1; toast('Ваш дневник готов'); renderAll(); show('today');};

function renderOnboarding(){const c=client(); const step=window.obStep||1; if(!Array.isArray(c.equipment))c.equipment=c.equipment?[String(c.equipment)]:[];
 const dots=[1,2,3,4].map(n=>`<span style="width:${n===step?'26px':'9px'};height:9px;border-radius:999px;background:${n<=step?'var(--plum)':'var(--line)'};display:inline-block;transition:.2s"></span>`).join(' ');
 const opt=(field,val,title,sub,activeVal)=>`<div class="choice ${activeVal===val?'active':''}" tabindex="0" role="button" onclick="obPick('${field}','${val}')" onkeydown="if(event.key==='Enter')obPick('${field}','${val}')"><h3>${title}</h3>${sub?`<p>${sub}</p>`:''}</div>`;
 let body='';
 if(step===1){body=`<h2>Ваш режим</h2><p class="muted small" style="margin-top:-4px">С чем будем работать. Это можно изменить позже.</p><div class="choice-grid" style="margin-top:14px">
   ${opt('modePref','cycle','Регулярный цикл','Цикл, ПМС, фаза как контекст',c.modePref)}
   ${opt('modePref','peri','Перименопауза','Нерегулярный цикл, приливы, сон',c.modePref)}
   ${opt('modePref','post','Постменопауза','Сила, баланс, костная плотность',c.modePref)}
   ${opt('modePref','skip','Не хочу указывать','Возьмём нейтральный режим',c.modePref)}</div>`;}
 else if(step===2){body=`<h2>Ваш уровень</h2><p class="muted small" style="margin-top:-4px">Честно, без давления — подберём нагрузку под вас.</p><div class="choice-grid" style="margin-top:14px">
   ${opt('level','Новичок','Начинаю','Техника, регулярность, базовые паттерны',c.level)}
   ${opt('level','Средний','Тренируюсь регулярно','Прогрессия, разнообразие, умеренный сплит',c.level)}
   ${opt('level','Продвинутый','Опытная','Силовые блоки, гипертрофия, контроль объёма',c.level)}</div>`;}
 else if(step===3){body=`<h2>Ваш формат</h2><p class="muted small" style="margin-top:-4px">Чего хочется в ближайшие недели.</p><div class="choice-grid" style="margin-top:14px">
   ${opt('format','Фуллбоди','Сила','Базовая силовая на всё тело',c.format)}
   ${opt('format','Силовая + кардио','Сила + кардио','Силовая и Zone 2',c.format)}
   ${opt('format','Мягкий старт','Мягкий старт','Лёгкое, бережное начало',c.format)}
   ${opt('format','Восстановительный режим','Восстановление','Мобилити и лёгкая активность',c.format)}
   ${opt('format','','Выбрать позже','Подберём базовую программу',c.format===''?'':c.format)}</div>`;}
 else {const eq=['зал','дом','гантели','резинки','дорожка','эллипс','велосипед','без оборудования']; body=`<h2>Доступное оборудование</h2><p class="muted small" style="margin-top:-4px">Можно выбрать несколько.</p><div class="choice-grid" style="margin-top:14px">${eq.map(e=>`<div class="choice ${c.equipment.includes(e)?'active':''}" tabindex="0" role="button" onclick="obToggleEquip('${e}')" onkeydown="if(event.key==='Enter')obToggleEquip('${e}')"><h3 style="font-size:16px;margin:0">${e}</h3></div>`).join('')}</div>`;}
 const nav=`<div class="toolbar" style="justify-content:space-between;margin-top:18px"><button class="btn ghost" ${step===1?'disabled':''} onclick="obBack()">Назад</button>${step<4?`<button class="btn primary" onclick="obNext()">Далее</button>`:`<button class="btn primary" onclick="obFinish()">Готово · перейти к сегодняшнему дню</button>`}</div>`;
 $('onboarding').innerHTML=top('onboarding','Настройка дневника','Четыре коротких шага — и дневник готов.',`<button class="btn ghost" onclick="obFinish()">Пропустить</button>`)+`<div class="card" style="max-width:780px"><div style="display:flex;gap:7px;align-items:center;margin-bottom:16px">${dots}<span class="muted small" style="margin-left:auto">Шаг ${step} из 4</span></div>${body}${nav}</div>`+(step===4?`<div class="card soft" style="margin-top:14px;max-width:780px"><h3 style="font-size:15px;margin-bottom:4px">Ваш дневник почти готов</h3><p class="small">После «Готово» подберём программу под ваш режим и уровень. Начните день с оценки готовности. Дневник не ставит диагнозы и не заменяет консультацию специалиста.</p></div>`:'');}
function renderDashboard(){const c=client(); const ci=cycleInfo(todayISO(),c); const score=readinessScore(c); const z=readinessZone(score); const totalT=c.workouts.reduce((s,w)=>s+tonnage(w),0); const p=activeProgram(c); const comp=p?Math.round(c.completedSessionIds.length/p.sessions.length*100):0; const right=c.mode==='cycle'?`<h2>Цикл сегодня</h2><div class="ringwrap" style="justify-content:center">${cycleRing(c)}</div>${cycleLegend()}<p class="small muted" style="margin-top:10px">Фаза — это контекст самочувствия, а не команда менять нагрузку. Решение принимает индекс готовности.</p>`:`<h2>Женский статус</h2><p>${modes[c.mode]}. ${c.mode==='peri'?'Цикл нерегулярный — опора на сон, приливы, боль и восстановление.':'Приоритет — сила, мышечная масса, костная плотность и баланс.'}</p><div class="divider"></div><p class="small"><b>Симптомы сегодня:</b> ${Number(latestCheckin(c)?.femaleSymptoms||0)}/10</p>`; $('dashboard').innerHTML=top('dashboard','Главная','Готовность ведёт, женский статус объясняет. Короткая сводка дня: восстановление, план, нагрузка и сигналы безопасности.',`<button class="btn primary" onclick="show('today')" data-event="start_today_click">Тренировка дня</button><button class="btn" onclick="show('readiness')">Обновить готовность</button>`)+`
<div class="grid cols-2" style="align-items:stretch"><div class="card hero"><div class="ringwrap">${readinessRing(score,z)}<div style="flex:1;min-width:190px"><div class="kicker">Сегодня</div><h2 style="margin:2px 0 8px">${esc(c.name||'Участница')}</h2><p>${readinessAdvice(c)}</p></div></div></div><div class="card">${right}</div></div>
<div class="grid cols-4" style="margin-top:18px">${stat('Выполнение плана',comp+'%',`${c.completedSessionIds.length} из ${p?p.sessions.length:0} сессий`)}${stat('Тоннаж',fmt(totalT,0)+' кг','вес × повторы за всё время')}${stat('Средний RPE '+'',fmt(avgRPE(c),1),'усилие 0–10')}${stat('Тренировок',c.workouts.length,'в дневнике')}</div>
<div class="grid cols-2" style="margin-top:18px"><div class="card"><h2>Выполнение 12-недельного плана</h2>${renderWeeklyBars(c)}</div><div class="card"><h2>Последняя тренировка</h2>${c.workouts[0]?`<p style="margin-top:0"><b>${esc(c.workouts[0].title)}</b> • ${esc(c.workouts[0].date)}</p><p class="small">${summaryBadge(c.workouts[0])} · тоннаж ${fmt(tonnage(c.workouts[0]),0)} кг</p><div class="toolbar" style="justify-content:flex-start;margin-top:8px"><button class="btn smallbtn" onclick="show('log')">Открыть дневник</button><button class="btn smallbtn" onclick="openSummary('${c.workouts[0].id}')">Записать итог</button></div>`:'<p>Пока нет тренировок. Создайте программу и начните с тренировки дня.</p>'}</div></div>
${balancePanel(c)}
<div class="grid cols-2" style="margin-top:18px"><div class="card"><h2>Динамика тоннажа</h2>${lineChart(workoutSeries(c,'tonnage'))}</div><div class="card"><h2>Динамика RPE</h2>${lineChart(workoutSeries(c,'rpe'),10)}</div></div>`;}
function renderWeeklyBars(c=client()){const p=activeProgram(c); if(!p)return '<div class="empty">Создайте программу.</div>'; let out='<div class="barlist">'; for(let w=1;w<=12;w++){const ss=p.sessions.filter(s=>s.week===w); const done=ss.filter(s=>c.completedSessionIds.includes(s.id)).length; const pct=ss.length?Math.round(done/ss.length*100):0; out+=`<div class="barrow"><span>Неделя ${w}</span><div class="bar"><span style="width:${pct}%"></span></div><b>${pct}%</b></div>`;} return out+'</div>';}
function workoutSeries(c,kind){return (c.workouts||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(-12).map(w=>({label:w.date.slice(5),value:kind==='tonnage'?tonnage(w):avgWorkoutRPE(w)}));}
function lineChart(data,maxGiven){if(!data.length)return '<div class="empty">Пока нет данных.</div>'; const w=620,h=190,p=22; const max=maxGiven||Math.max(...data.map(d=>d.value),1); const pts=data.map((d,i)=>{const x=p+i*(w-2*p)/(Math.max(data.length-1,1)); const y=h-p-(d.value/(max||1))*(h-2*p); return [x,y,d]}); const path=pts.map((pt,i)=>(i?'L':'M')+pt[0].toFixed(1)+' '+pt[1].toFixed(1)).join(' '); return `<div class="chart"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}" stroke="#eadbd2"/><line x1="${p}" y1="${p}" x2="${p}" y2="${h-p}" stroke="#eadbd2"/><path d="${path}" fill="none" stroke="#b77c72" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${pts.map(pt=>`<circle cx="${pt[0]}" cy="${pt[1]}" r="5" fill="#6f8f83"/>`).join('')}${pts.map(pt=>`<text x="${pt[0]}" y="${h-4}" text-anchor="middle" font-size="11" fill="#766c66">${pt[2].label}</text>`).join('')}</svg></div>`;}
function renderProfile(){const c=client(); $('profile').innerHTML=top('profile','Профиль участницы','Базовые данные, цели, оборудование, ограничения, травмы и комментарии специалиста.')+`<div class="card"><div class="input-grid"><div class="field"><label>Имя</label><input value="${esc(c.name)}" onchange="setClientField('name',this.value)"></div><div class="field"><label>Возраст</label><input type="number" value="${esc(c.age)}" onchange="setClientField('age',this.value)"></div><div class="field"><label>Рост, см</label><input type="number" value="${esc(c.height)}" onchange="setClientField('height',this.value)"></div><div class="field"><label>Вес, кг</label><input type="number" value="${esc(c.weight)}" onchange="setClientField('weight',this.value)"></div><div class="field"><label>Режим</label><select onchange="setClientField('mode',this.value)">${Object.entries(modes).map(([k,v])=>`<option value="${k}" ${c.mode===k?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Уровень</label><select onchange="setClientField('level',this.value)">${levels.map(x=>`<option ${c.level===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Тренировок/нед.</label><select onchange="setClientField('sessionsPerWeek',this.value)"><option ${c.sessionsPerWeek==2?'selected':''}>2</option><option ${!c.sessionsPerWeek||c.sessionsPerWeek==3?'selected':''}>3</option><option ${c.sessionsPerWeek==4?'selected':''}>4</option></select></div><div class="field"><label>Оборудование</label><input value="${esc(c.equipment)}" onchange="setClientField('equipment',this.value)"></div><div class="field" style="grid-column:1/-1"><label>Цель</label><input value="${esc(c.goal)}" onchange="setClientField('goal',this.value)"></div><div class="field" style="grid-column:1/-1"><label>Травмы / операции / ограничения</label><textarea onchange="setClientField('injuries',this.value)">${esc(c.injuries)}</textarea></div><div class="field" style="grid-column:1/-1"><label>Комментарий специалиста</label><textarea onchange="setClientField('notes',this.value)">${esc(c.notes)}</textarea></div></div></div>`;}

/* ===== cycle education v1.9 ===== */
/* TODO: добавить интерактивный график цикла с условными кривыми эстрогенов, прогестерона, энергии, симптомов и тренировок. */
function phaseImpact(phase){
 if(/Менстру/.test(phase))return 'Самочувствие индивидуально: есть силы — тренируйтесь, при боли и усталости снизьте объём. Готовность важнее календаря.';
 if(/Фоллик/.test(phase))return 'Часто больше энергии — удобно для прогрессии. Но ориентируйтесь на готовность, а не только на фазу.';
 if(/Овулятор/.test(phase))return 'Энергия обычно высокая. Следите за техникой; данные о влиянии фазы на травматизм неоднозначны.';
 if(/Лютеин/.test(phase))return 'Возможны ПМС, отёки, тяга к сладкому, усталость. Допустимо снизить интенсивность по самочувствию.';
 return 'Фаза — контекст самочувствия, решение принимает готовность.';
}
function cycleChart(c){
 const len=Math.max(20,Number(c.cycleLength||28)); const men=Math.max(2,Number(c.menstruationLength||5));
 const ci=cycleInfo(todayISO(),c); const today=typeof ci.day==='number'?ci.day:1;
 const W=560,H=180,padL=16,padR=16,padT=16,padB=26;
 const X=d=>padL+(d-1)/(len-1)*(W-padL-padR); const Y=v=>padT+(1-Math.max(0,Math.min(1,v)))*(H-padT-padB);
 const ov=Math.min(len-2,Math.round(len*0.5));
 const g=(d,mu,sd,amp)=>amp*Math.exp(-((d-mu)*(d-mu))/(2*sd*sd));
 const est=d=>0.12 + g(d,ov-1,Math.max(2,len*0.11),0.85) + g(d,ov+(len-ov)*0.55,Math.max(2,len*0.13),0.32);
 const prog=d=>0.06 + g(d,ov+(len-ov)*0.45,Math.max(2,len*0.13),0.9);
 const path=f=>{let p='';for(let d=1;d<=len;d++){p+=(d===1?'M':'L')+X(d).toFixed(1)+' '+Y(f(d)).toFixed(1)+' ';}return p.trim();};
 const tx=X(today);
 return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block" role="img" aria-label="Образовательный график условной динамики эстрогена и прогестерона по дням цикла">
   <rect x="${padL}" y="${padT}" width="${(X(Math.min(men,len))-padL).toFixed(1)}" height="${H-padT-padB}" fill="#fbe2e3" opacity="0.55"/>
   <line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="var(--line)"/>
   <path d="${path(est)}" fill="none" stroke="var(--plum)" stroke-width="2.5"/>
   <path d="${path(prog)}" fill="none" stroke="var(--sage)" stroke-width="2.5"/>
   <line x1="${tx.toFixed(1)}" y1="${padT}" x2="${tx.toFixed(1)}" y2="${H-padB}" stroke="var(--ink)" stroke-dasharray="3 3" opacity="0.55"/>
   <circle cx="${tx.toFixed(1)}" cy="${Y(est(today)).toFixed(1)}" r="4" fill="var(--plum)"/>
   <circle cx="${tx.toFixed(1)}" cy="${Y(prog(today)).toFixed(1)}" r="4" fill="var(--sage)"/>
   <text x="${padL}" y="${H-8}" font-size="10" fill="var(--muted)">день 1</text>
   <text x="${(W-padR-34).toFixed(1)}" y="${H-8}" font-size="10" fill="var(--muted)">день ${len}</text>
   <text x="${Math.max(padL,Math.min(W-padR-70,tx+5)).toFixed(1)}" y="${padT+11}" font-size="10" fill="var(--ink)">сегодня · день ${today}</text>
 </svg>`;
}
function cycleChartCard(c){
 return `<div class="card" style="margin-top:18px"><h2>График цикла</h2><p class="small muted" style="margin-top:-4px">Образовательная визуализация: как ориентировочно меняются эстроген и прогестерон по дням цикла.</p>
 <div style="margin-top:10px">${cycleChart(c)}</div>
 <div class="cyclegend" style="margin-top:8px"><span><i style="background:var(--plum)"></i>эстроген (условно)</span><span><i style="background:var(--sage)"></i>прогестерон (условно)</span><span><i style="background:#fbe2e3;border:1px solid #eccacd"></i>менструация</span></div>
 <div class="card soft" style="margin-top:12px"><p class="small">График показывает ориентировочную физиологию цикла и помогает связать тренировки с самочувствием. Он не предназначен для диагностики гормонального статуса.</p></div></div>`;
}

function renderFemale(){const c=client(); const ci=cycleInfo(todayISO(),c); const center=c.mode==='cycle'?`<div class="card"><h2>Условная фаза цикла</h2><div class="ringwrap" style="justify-content:center">${cycleRing(c)}</div>${cycleLegend()}<p class="small muted" style="margin-top:10px">Расчёт ориентировочный: длина и день овуляции у всех разные. Фаза подсказывает, почему меняется самочувствие, но нагрузку определяет готовность и симптомы.</p><div class="divider"></div><p class="small"><b>Влияние на тренировку:</b> ${phaseImpact(ci.phase)}</p></div>`:menoPanel(c); $('female').innerHTML=top('female','Цикл и самочувствие','цикл, перименопауза или постменопауза. Нагрузка корректируется не по календарному дню, а по совокупности: симптомы, сон, боль, RPE/RIR и фактическая работоспособность.')+`
<div class="card"><h2>Режим дневника</h2><div class="choice-grid">${Object.entries(modes).map(([k,v])=>`<div class="choice ${c.mode===k?'active':''}" onclick="setClientField('mode','${k}'); renderFemale()"><h3>${v}</h3><p>${k==='cycle'?'Расчёт дня и условной фазы цикла, ПМС-симптомы.':k==='peri'?'Нерегулярный цикл, приливы, сон, восстановление.':'Сила, мышечная масса, костная плотность, баланс.'}</p></div>`).join('')}</div></div>
<div class="grid cols-2" style="margin-top:18px">${center}<div class="card"><h2>Решение по нагрузке сегодня</h2><div class="ringwrap" style="gap:16px"><div style="flex:1;min-width:160px"><span class="zone ${zoneClass(readinessZone(readinessScore(c)))}">${readinessZone(readinessScore(c))}</span><p style="margin-top:12px">${readinessAdvice(c)}</p></div></div><div class="divider"></div><p class="small muted">Это ориентир дневника, а не предписание. При красных флагах — раздел «Флаги» и очная оценка.</p></div></div>${c.mode==='cycle'?cycleChartCard(c):''}
${c.mode==='cycle'?`<div class="card" style="margin-top:18px"><h2>Параметры цикла</h2><div class="input-grid"><div class="field"><label>1-й день последней менструации ${hint('Дата начала последней менструации. От неё считается условный день цикла.')}</label><input type="date" value="${esc(c.lastPeriod)}" onchange="setClientField('lastPeriod',this.value)"></div><div class="field"><label>Средняя длина цикла, дней</label><input type="number" value="${esc(c.cycleLength||28)}" onchange="setClientField('cycleLength',this.value)"></div><div class="field"><label>Длительность менструации, дней</label><input type="number" value="${esc(c.menstruationLength||5)}" onchange="setClientField('menstruationLength',this.value)"></div><div class="field"><label>Примечание</label><input value="${esc(c.femaleNote||'')}" onchange="setClientField('femaleNote',this.value)"></div></div></div>`:''}`;}
function renderReadiness(){const c=client(); const last=latestCheckin(c)||{}; const score=readinessScore(c); const z=readinessZone(score); const hints={sleep:'Качество сна прошлой ночью: 1 — очень плохо, 5 — отлично.',energy:'Общий уровень энергии сейчас: 1 — истощение, 5 — бодрость.',stress:'Уровень стресса: 1 — спокойно, 5 — сильный стресс. Высокий стресс снижает готовность.',mood:'Настроение: 1 — подавленное, 5 — приподнятое.',soreness:'Мышечная болезненность после прошлых тренировок: 1 — нет, 5 — выраженная.',pain:'Боль (сустав/спина и т.п.) 0–10. Боль ≥6 — тренировку не проводим, нужна оценка.',femaleSymptoms:(c.mode==='cycle'?'Выраженность цикл/ПМС-симптомов 0–10: отёки, тяга к сладкому, усталость, головная боль.':'Выраженность приливов/ночной потливости и связанных симптомов 0–10.'),motivation:'Желание тренироваться: 1 — нет, 5 — большое.'}; const fields=[['sleep','Сон',1,5],['energy','Энергия',1,5],['stress','Стресс',1,5],['mood','Настроение',1,5],['soreness','Мышечная болезненность',1,5],['pain','Боль',0,10],['femaleSymptoms',c.mode==='cycle'?'симптомы цикла/ПМС':'Приливы/симптомы',0,10],['motivation','Желание тренироваться',1,5]]; $('readiness').innerHTML=top('readiness','Готовность к тренировке','Короткий чек-ин перед тренировкой. Из него считается индекс готовности и зона, которые подсказывают, как скорректировать нагрузку.')+`
<div class="grid cols-2" style="align-items:stretch"><div class="card hero"><div class="ringwrap">${readinessRing(score,z)}<div style="flex:1;min-width:180px"><div class="kicker">Текущее решение</div><h2 style="margin:2px 0 8px">${z} зона</h2><p>${readinessAdvice(c)}</p></div></div></div><div class="card soft"><h3>Как читать зоны</h3><p class="small"><b style="color:#3f6f53">Зелёная</b> — тренировка по плану.<br><b style="color:#856221">Жёлтая</b> — снизить вес 5–10% или убрать 1 подход.<br><b style="color:#9a5a31">Оранжевая</b> — лёгкая техническая сессия, −20–40% объёма.<br><b style="color:#9c3f47">Красная</b> — восстановление; при боли/флагах — к специалисту.</p></div></div>
<div class="card" style="margin-top:18px"><h2>Чек-ин на ${esc(todayISO())}</h2><div class="input-grid">${fields.map(f=>`<div class="field"><label>${f[1]} (${f[2]}–${f[3]}) ${hint(hints[f[0]]||'')}</label><input id="chk_${f[0]}" type="number" min="${f[2]}" max="${f[3]}" value="${last[f[0]]??(f[2]===0?0:3)}"></div>`).join('')}<div class="field"><label>Дата</label><input id="chk_date" type="date" value="${todayISO()}"></div></div><div class="toolbar" style="justify-content:flex-start;margin-top:16px"><button class="btn primary" onclick="saveCheckin()">Сохранить готовность</button></div></div>`;}
window.saveCheckin=function(){const c=client(); const ids=['sleep','energy','stress','mood','soreness','pain','femaleSymptoms','motivation']; const chk={id:uid(),date:$('chk_date').value||todayISO()}; ids.forEach(k=>chk[k]=Number($('chk_'+k).value||0)); c.checkins.unshift(chk); save(); toast('Готовность сохранена'); renderAll();};
function renderPrograms(){const c=client(); const p=activeProgram(c); $('programs').innerHTML=top('programs','12-недельные программы','Выберите программу под режим, уровень и формат. Дни недели чередуют силу, кардио, мобилити и восстановление. Недели 4 и 8 — разгрузочные.',`<button class="btn" onclick="suggestAndCreate()">Подобрать автоматически</button>`)+programPicker(c)+(p?`<div class="card" style="margin-top:18px"><h2>Активная программа: ${esc(p.name)}</h2><p>Старт: ${esc(p.startDate)} • ${p.sessionsPerWeek} сессий/нед • всего: ${p.sessions.length}</p>${renderProgramTable(c,p)}</div>`:'<div class="empty" style="margin-top:18px">Программа ещё не выбрана. Выберите карточку выше или нажмите «Подобрать автоматически».</div>');}
function renderProgramTable(c,p){return `<div class="table-wrap"><table><thead><tr><th>Неделя</th><th>Дата</th><th>Тренировка</th><th>Блок</th><th>Упражнения</th><th>Статус</th><th></th></tr></thead><tbody>${p.sessions.slice(0,48).map(s=>`<tr><td class="num">${s.week}</td><td class="nowrap">${s.date}</td><td>${esc(s.name)}</td><td>${esc(s.block)}</td><td>${s.kind&&s.kind!=='strength'?`<span class="tag" style="background:${kindColor(s.kind)};color:#fff;border-color:transparent">${kindLabel(s.kind)}</span> ${esc((s.plan||'').split('.')[0])}`:s.exercises.map(e=>esc(e.name)).join('<br>')}</td><td class="num">${c.completedSessionIds.includes(s.id)?'✓':'—'}</td><td class="num"><button class="btn smallbtn" onclick="createWorkoutFromSession('${s.id}')">В дневник</button></td></tr>`).join('')}</tbody></table></div>`;}
function renderToday(){const c=client(); const s=nextSession(c); const score=readinessScore(c); const z=readinessZone(score); const last=c.workouts[0]; const b=weekBalance(c); const ci=cycleInfo(todayISO(),c); const kind=s?(s.kind||'strength'):'strength'; const planDur=(s&&s.plan&&(s.plan.match(/(\d+(?:[–-]\d+)?)\s*мин/)||[])[1])||(kind==='strength'?'40–50':''); const planRpe=(s&&s.plan&&(s.plan.match(/RPE\s*([0-9–-]+)/)||[])[1])||''; $('today').innerHTML=top('today','Сегодня','Главное на сегодня: готовность, тренировка дня, цикл и прогресс. Начните с оценки готовности.')+`
<div class="grid cols-2" style="align-items:stretch">
  <div class="card hero"><div class="ringwrap">${readinessRing(score,z)}<div style="flex:1;min-width:168px"><div class="kicker">Готовность</div><h2 style="margin:2px 0 6px">${z} зона</h2><p class="small">${readinessAdvice(c)}</p><button class="btn primary" style="margin-top:10px" onclick="show('readiness')" data-event="readiness_start">Оценить готовность</button></div></div></div>
  <div class="card"><div class="kicker">Тренировка дня</div>${s?`<h2 style="margin:2px 0 6px">${esc(s.name.replace(/^Нед \d+ • /,''))}</h2><div class="tagline"><span class="tag" style="background:${kindColor(kind)};color:#fff;border-color:transparent">${kindLabel(kind)}</span>${planDur?`<span class="tag">${planDur} мин</span>`:''}${planRpe?`<span class="tag">RPE ${planRpe}</span>`:''}</div><div class="row-actions" style="justify-content:flex-start;margin-top:12px"><button class="btn primary" onclick="openTrainingPicker()" data-event="workout_start">Подобрать тренировку</button><button class="btn" onclick="createWorkoutFromSession('${s.id}')">Начать по плану</button>${last?`<button class="btn" onclick="openSummary('${last.id}')" data-event="workout_finish">Завершить</button>`:''}</div>`:`<p class="muted">Программа ещё не выбрана.</p><div class="row-actions" style="justify-content:flex-start;margin-top:8px"><button class="btn primary" onclick="openTrainingPicker()" data-event="workout_start">Подобрать тренировку</button><button class="btn" onclick="show('programs')" data-event="program_select">Выбрать программу</button></div>`}</div>
  <div class="card"><div class="kicker">Цикл и самочувствие</div>${c.mode==='cycle'?`<h2 style="margin:2px 0 6px">День ${typeof ci.day==='number'?ci.day:'—'} · ${esc(ci.phase)}</h2><p class="small muted">${esc(ci.note||'Фаза — контекст самочувствия, решение принимает готовность.')}</p>`:`<h2 style="margin:2px 0 6px">${modes[c.mode]}</h2><p class="small muted">Опора на сон, приливы, боль и восстановление.</p>`}<p class="small"><b>Симптомы:</b> ${Number(latestCheckin(c)?.femaleSymptoms||0)}/10</p><button class="btn" style="margin-top:6px" onclick="show('female')" data-event="cycle_open">Открыть цикл</button></div>
  <div class="card"><div class="kicker">Прогресс недели</div><div style="margin-top:6px">${balRow('Сила',b.strength,3,'var(--plum)')}${balRow('Кардио',b.cardio,2,'var(--sage)')}${balRow('Мобилити',b.mobility,2,'#6f89a7')}${balRow('Восстановление',b.recovery,1,'#7da498')}</div><button class="btn" style="margin-top:6px" onclick="show('progress')" data-event="progress_open">Посмотреть прогресс</button></div>
</div>
${todaySubCard(c)}`;}
function renderLog(){const c=client(); $('log').innerHTML=top('log','Дневник тренировок','Создание и редактирование тренировок, упражнений и подходов.',`<button class="btn primary" onclick="newWorkout()">+ Тренировка</button>`)+(c.workouts.length?`<div class="grid">${c.workouts.map(w=>renderWorkoutCard(w)).join('')}</div>`:'<div class="empty">Пока нет тренировок.</div>');}
function renderWorkoutCard(w){const m=editorMode(w.kind||'strength'); const kindTag=`<span class="tag" style="background:${kindColor(w.kind||'strength')};color:#fff;border-color:transparent">${kindLabel(w.kind||'strength')}</span>`; let metric='', bodyHTML='';
 if(m==='cardio'){const cd=w.cardio||{}; metric=`${cd.minutes?cd.minutes+' мин':'—'}${cd.rpe?' • RPE '+cd.rpe:''}`; bodyHTML=`<div class="table-wrap" style="margin-top:14px"><table><tbody><tr><td>Тип</td><td>${esc(cd.type||'—')}</td></tr><tr><td>Длительность</td><td>${esc(cd.minutes||'—')} мин</td></tr><tr><td>RPE</td><td>${esc(cd.rpe||'—')}</td></tr><tr><td>Дистанция</td><td>${cd.distance?esc(cd.distance)+' км':'—'}</td></tr><tr><td>Пульс</td><td>${esc(cd.hr||'—')}</td></tr><tr><td>Самочувствие</td><td>${cd.feel?esc(cd.feel)+'/5':'—'}</td></tr></tbody></table></div>`;}
 else if(m==='mobility'){const mo=w.mobility||{}; metric=`${mo.minutes?mo.minutes+' мин':'—'}`; bodyHTML=`<div class="table-wrap" style="margin-top:14px"><table><tbody><tr><td>Длительность</td><td>${esc(mo.minutes||'—')} мин</td></tr><tr><td>Зона</td><td>${esc(mo.zone||'—')}</td></tr><tr><td>Ощущение</td><td>${esc(mo.sensation||'—')}</td></tr><tr><td>Боль</td><td>${mo.pain!==''&&mo.pain!=null?esc(mo.pain)+'/10':'—'}</td></tr><tr><td>Комментарий</td><td>${esc(mo.comment||'—')}</td></tr></tbody></table></div>`;}
 else {metric=`тоннаж ${fmt(tonnage(w),0)} кг`; bodyHTML=`<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Упражнение</th><th>Паттерн</th><th>Цель</th><th>Подходы (вес × повт)</th></tr></thead><tbody>${w.exercises.map(e=>`<tr><td>${esc(e.name)}</td><td>${esc(e.pattern)}</td><td>${esc(e.target||'')}</td><td>${(e.sets||[]).map(s=>`${s.set}: ${s.weight||0}×${s.reps||0}, RPE ${s.rpe||'—'}, боль ${s.pain||'—'}`).join('<br>')||'—'}</td></tr>`).join('')}</tbody></table></div>`;}
 return `<div class="card"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><h2 style="margin-bottom:6px">${esc(w.title)}</h2><p style="margin:0">${esc(w.date)} • ${kindTag} • готовность ${w.readiness?.score||'—'}% • ${metric}</p><div style="margin-top:8px">${summaryBadge(w)}</div></div><div class="row-actions"><button class="btn smallbtn" onclick="openSummary('${w.id}')">Итог</button><button class="btn smallbtn" onclick="editWorkout('${w.id}')">Редактировать</button><button class="btn danger smallbtn" onclick="deleteWorkout('${w.id}')">Удалить</button></div></div>${bodyHTML}</div>`;}
window.newWorkout=function(){const c=client(); const w={id:uid(),date:todayISO(),title:'Свободная тренировка',kind:'strength',mode:c.mode,cycle:cycleInfo(todayISO(),c),readiness:{score:readinessScore(c),zone:readinessZone(readinessScore(c))},summary:{status:'',feelAfter:'',painAfter:'',fatigueAfter:'',comment:''},notes:'',exercises:[]}; c.workouts.unshift(w); save(); editWorkout(w.id);};
window.deleteWorkout=function(id){const c=client(); if(!confirm('Удалить тренировку?'))return; c.workouts=c.workouts.filter(w=>w.id!==id); save(); renderAll();};
window.editWorkout=function(id){const c=client(); const w=c.workouts.find(x=>x.id===id); if(!w)return; showModal(workoutEditor(w));};

/* ===== typed workout logging v1.8 ===== */
function editorMode(k){if(k==='cardio'||k==='hiit'||k==='recovery')return 'cardio'; if(k==='mobility'||k==='stretch'||k==='balance')return 'mobility'; return 'strength';}
function cardioForm(w){const cd=w.cardio||{}; const types=['дорожка','эллипс','велотренажёр','гребной','степпер','ходьба','бег','другое']; return `<h3 style="margin:0 0 4px">Кардио</h3><p class="small muted" style="margin:0 0 12px">${esc(w.notes||'')}</p><div class="input-grid" style="grid-template-columns:1fr 1fr 1fr"><div class="field"><label>Тип</label><select onchange="updateCardio('${w.id}','type',this.value)">${types.map(t=>`<option ${cd.type===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="field"><label>Длительность, мин</label><input inputmode="numeric" value="${esc(cd.minutes)}" onchange="updateCardio('${w.id}','minutes',this.value)"></div><div class="field"><label>RPE ${hint('Усилие 0–10. Zone 2 ≈ RPE 5–6, разговорный темп.')}</label><input inputmode="decimal" value="${esc(cd.rpe)}" onchange="updateCardio('${w.id}','rpe',this.value)"></div><div class="field"><label>Дистанция, км <span class="muted">(необязательно)</span></label><input inputmode="decimal" value="${esc(cd.distance)}" onchange="updateCardio('${w.id}','distance',this.value)"></div><div class="field"><label>Пульс, уд/мин <span class="muted">(необязательно)</span></label><input inputmode="numeric" value="${esc(cd.hr)}" onchange="updateCardio('${w.id}','hr',this.value)"></div><div class="field"><label>Самочувствие (1–5)</label><input inputmode="numeric" value="${esc(cd.feel)}" onchange="updateCardio('${w.id}','feel',this.value)"></div></div>`;}
function mobilityForm(w){const m=w.mobility||{}; const sens=['лёгкое натяжение','комфортно','скованность','напряжение']; return `<h3 style="margin:0 0 4px">Стретчинг и мобилити</h3><p class="small muted" style="margin:0 0 12px">${esc(w.notes||'')}</p><div class="input-grid" style="grid-template-columns:1fr 1fr"><div class="field"><label>Длительность, мин</label><input inputmode="numeric" value="${esc(m.minutes)}" onchange="updateMobility('${w.id}','minutes',this.value)"></div><div class="field"><label>Зона тела</label><input value="${esc(m.zone)}" placeholder="напр. тазобедренные, грудной отдел" onchange="updateMobility('${w.id}','zone',this.value)"></div><div class="field"><label>Ощущение</label><select onchange="updateMobility('${w.id}','sensation',this.value)"><option value="">—</option>${sens.map(x=>`<option ${m.sensation===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Боль (0–10) ${hint('Стретчинг и мобилити выполняются мягко, без боли. Боль — сигнал остановиться, а не «продавливать» амплитуду.')}</label><input inputmode="numeric" value="${esc(m.pain)}" onchange="updateMobility('${w.id}','pain',this.value)"></div><div class="field" style="grid-column:1/-1"><label>Комментарий</label><textarea onchange="updateMobility('${w.id}','comment',this.value)">${esc(m.comment||'')}</textarea></div></div><div class="card soft" style="margin-top:12px"><p class="small">Стретчинг и мобилити выполняются мягко, без боли и без попытки «продавить» амплитуду.</p></div>`;}
function workoutKindBody(w,exOptions){const m=editorMode(w.kind||'strength'); if(m==='cardio')return cardioForm(w); if(m==='mobility')return mobilityForm(w); return `<div class="toolbar" style="justify-content:flex-start"><select id="addExSelect">${exOptions}</select><button class="btn primary" onclick="addExerciseToWorkout('${w.id}')">Добавить упражнение</button></div><div class="divider"></div><div id="workoutEditorBody">${workoutEditorBody(w)}</div>`;}
window.updateCardio=function(id,k,v){const w=client().workouts.find(x=>x.id===id);if(!w)return;if(!w.cardio)w.cardio={};w.cardio[k]=(k==='type')?v:(v===''?'':(isNaN(v)?v:Number(v)));save();};
window.updateMobility=function(id,k,v){const w=client().workouts.find(x=>x.id===id);if(!w)return;if(!w.mobility)w.mobility={};w.mobility[k]=(k==='minutes'||k==='pain')?(v===''?'':Number(v)):v;save();};

function workoutEditor(w){const exOptions=allExercises().map(e=>`<option value="${e.id}">${esc(e.name)} • ${esc(e.pattern)}</option>`).join(''); return `<h2>Редактирование тренировки</h2><div class="input-grid"><div class="field"><label>Дата</label><input type="date" value="${esc(w.date)}" onchange="updateWorkout('${w.id}','date',this.value)"></div><div class="field"><label>Название</label><input value="${esc(w.title)}" onchange="updateWorkout('${w.id}','title',this.value)"></div><div class="field" style="grid-column:1/-1"><label>Комментарий</label><textarea onchange="updateWorkout('${w.id}','notes',this.value)">${esc(w.notes)}</textarea></div></div><div class="divider"></div>${workoutKindBody(w,exOptions)}<div class="toolbar" style="justify-content:flex-start;margin-top:16px"><button class="btn green" onclick="closeModal()">Готово</button></div>`;}
function workoutEditorBody(w){return (w.exercises||[]).map(e=>`<div class="card soft" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><h3 style="margin:0">${esc(e.name)}</h3><button class="btn danger smallbtn" onclick="removeExerciseFromWorkout('${w.id}','${e.id}')">Удалить</button></div><p class="small muted" style="margin:6px 0 12px">${esc(e.pattern)} • ${esc(e.target||'')}</p><div class="seteditor">${e.sets.map(s=>`<div class="setrow"><div class="sn">${s.set}</div><div class="minif"><label>Повт.</label><input inputmode="numeric" value="${esc(s.reps)}" onchange="updateSet('${w.id}','${e.id}','${s.id}','reps',this.value)"></div><div class="minif"><label>Вес, кг</label><input inputmode="decimal" value="${esc(s.weight)}" onchange="updateSet('${w.id}','${e.id}','${s.id}','weight',this.value)"></div><div class="minif"><label>RPE</label><input inputmode="decimal" value="${esc(s.rpe)}" onchange="updateSet('${w.id}','${e.id}','${s.id}','rpe',this.value)"></div><div class="minif"><label>RIR</label><input inputmode="numeric" value="${esc(s.rir)}" onchange="updateSet('${w.id}','${e.id}','${s.id}','rir',this.value)"></div><div class="minif"><label>Боль</label><input inputmode="numeric" value="${esc(s.pain)}" onchange="updateSet('${w.id}','${e.id}','${s.id}','pain',this.value)"></div><div class="e1">e1RM<b>${fmt(e1rm(s.weight,s.reps),1)}</b></div></div>`).join('')}</div><button class="btn smallbtn" style="margin-top:10px" onclick="addSet('${w.id}','${e.id}')">+ Подход</button></div>`).join('')||'<div class="empty">Добавьте упражнение из списка выше.</div>'}
window.updateWorkout=function(id,k,v){const w=client().workouts.find(x=>x.id===id); if(w){w[k]=v;save();}};
window.addExerciseToWorkout=function(wid){const c=client(); const w=c.workouts.find(x=>x.id===wid); const ex=allExercises().find(e=>e.id===$('addExSelect').value); if(!w||!ex)return; w.exercises.push({id:uid(),exerciseId:ex.id,name:ex.name,pattern:ex.pattern,target:'3×8–12, RPE 6–8',sets:[1,2,3].map(i=>({id:uid(),set:i,reps:'',weight:'',rpe:'',rir:'',pain:'',comment:''}))}); save(); $('workoutEditorBody').innerHTML=workoutEditorBody(w);};
window.removeExerciseFromWorkout=function(wid,eid){const w=client().workouts.find(x=>x.id===wid); if(!w)return; w.exercises=w.exercises.filter(e=>e.id!==eid); save(); $('workoutEditorBody').innerHTML=workoutEditorBody(w);};
window.addSet=function(wid,eid){const w=client().workouts.find(x=>x.id===wid); const e=w?.exercises.find(x=>x.id===eid); if(!e)return; e.sets.push({id:uid(),set:e.sets.length+1,reps:'',weight:'',rpe:'',rir:'',pain:'',comment:''}); save(); $('workoutEditorBody').innerHTML=workoutEditorBody(w);};
window.updateSet=function(wid,eid,sid,k,v){const w=client().workouts.find(x=>x.id===wid); const e=w?.exercises.find(x=>x.id===eid); const s=e?.sets.find(x=>x.id===sid); if(!s)return; s[k]=v; save();};
function renderSets(){const c=client(); const rows=c.workouts.flatMap(w=>(w.exercises||[]).flatMap(e=>(e.sets||[]).map(s=>({w,e,s})))); $('sets').innerHTML=top('sets','Журнал подходов','Сводная таблица фактических подходов: повторы, вес, RPE/RIR, боль, тоннаж и e1RM.')+(rows.length?`<div class="table-wrap"><table><thead><tr><th>Дата</th><th>Тренировка</th><th>Упражнение</th><th>Паттерн</th><th>Повт.</th><th>Вес</th><th>RPE</th><th>RIR</th><th>Боль</th><th>Тоннаж</th><th>e1RM</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="nowrap">${esc(r.w.date)}</td><td>${esc(r.w.title)}</td><td>${esc(r.e.name)}</td><td>${esc(r.e.pattern)}</td><td class="num">${esc(r.s.reps)}</td><td class="num">${esc(r.s.weight)}</td><td class="num">${esc(r.s.rpe)}</td><td class="num">${esc(r.s.rir)}</td><td class="num">${esc(r.s.pain)}</td><td class="num">${fmt(Number(r.s.reps||0)*Number(r.s.weight||0),0)}</td><td class="num">${fmt(e1rm(r.s.weight,r.s.reps),1)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Нет подходов.</div>');}

/* ===== progress & plan modules v2.1 (pure, port-ready) ===== */
/* TODO: при переходе на backend/RN — переиспользовать calculateWeeklyProgress() и weeklyTargets() без изменений (чистые функции, без DOM). */
function scoreCheckin(ch){ if(!ch)return 76; const sleep=Number(ch.sleep||3),energy=Number(ch.energy||3),mood=Number(ch.mood||3),motivation=Number(ch.motivation||3),stress=Number(ch.stress||3),soreness=Number(ch.soreness||2),pain=Number(ch.pain||0),fem=Number(ch.femaleSymptoms||0); const positive=((sleep+energy+mood+motivation)/20)*55; const recovery=((6-stress)+(6-soreness))/10*25; const symptomPenalty=Math.min(25,pain*2.2+fem*1.4); return Math.max(0,Math.min(100,Math.round(positive+recovery+25-symptomPenalty))); }
function weeklyTargets(c){ const p=activeProgram(c); let t={strength:3,cardio:2,mobility:1,recovery:1}; if(p&&p.catalogId){const e=PROGRAM_CATALOG.find(x=>x.id===p.catalogId); if(e){t={strength:0,cardio:0,mobility:0,recovery:0}; e.week.forEach(d=>{const k=dayKind(d.t); if(k==='strength')t.strength++; else if(k==='cardio')t.cardio++; else if(k==='mobility'||k==='stretch')t.mobility++; else t.recovery++;});}} return t; }
function programWeek(c){ const p=activeProgram(c); if(!p||!p.startDate)return 1; const ms=Date.now()-new Date(p.startDate).getTime(); return Math.min(12,Math.max(1,Math.floor(ms/(7*86400000))+1)); }
function weekWorkouts(c){ const now=Date.now(); return (c.workouts||[]).filter(w=>{const d=new Date(w.date).getTime(); return !isNaN(d)&&now-d<=7*86400000&&d-now<=86400000;}); }
function weeklyRPE(c){ const vals=[]; weekWorkouts(c).forEach(w=>{ (w.exercises||[]).forEach(e=>(e.sets||[]).forEach(x=>{if(x.rpe)vals.push(Number(x.rpe));})); if(w.cardio&&w.cardio.rpe)vals.push(Number(w.cardio.rpe)); }); return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0; }
function weeklyPain(c){ const now=Date.now(); const ch=(c.checkins||[]).filter(x=>{const d=new Date(x.date).getTime();return !isNaN(d)&&now-d<=7*86400000;}); if(!ch.length){const l=latestCheckin(c);return l?Number(l.pain||0):0;} return ch.reduce((a,x)=>a+Number(x.pain||0),0)/ch.length; }
function weeklyReadiness(c){ const now=Date.now(); const ch=(c.checkins||[]).filter(x=>{const d=new Date(x.date).getTime();return !isNaN(d)&&now-d<=7*86400000;}); if(!ch.length)return readinessScore(c); return Math.round(ch.reduce((a,x)=>a+scoreCheckin(x),0)/ch.length); }
function tonnageTrend(c){ const now=Date.now(); let tw=0,pw=0; (c.workouts||[]).forEach(w=>{const d=new Date(w.date).getTime(); if(isNaN(d))return; const age=now-d; const t=tonnage(w); if(age<=7*86400000)tw+=t; else if(age<=14*86400000)pw+=t;}); return {tw,pw}; }
function calculateWeeklyProgress(c){
  const t=weeklyTargets(c); const b=weekBalance(c);
  const plannedTotal=t.strength+t.cardio+t.mobility+t.recovery;
  const doneTotal=b.strength+b.cardio+b.mobility+b.recovery;
  const planCompletion=plannedTotal?Math.round(Math.min(100, doneTotal/plannedTotal*100)):0;
  const avgReadiness=weeklyReadiness(c), avgRPE=weeklyRPE(c), avgPain=weeklyPain(c);
  let status='Идёте по плану';
  if(b.strength<t.strength && b.cardio>=t.cardio) status='Не хватает силовых';
  else if(b.cardio<t.cardio && b.strength>=t.strength) status='Не хватает кардио';
  if(avgRPE>=8.5 || (b.hiit||0)>=2) status='Слишком много интенсивности';
  if(avgPain>=4 || avgReadiness<45) status='Нужна мягкая неделя';
  else if(avgReadiness<60 && b.recovery<t.recovery) status='Нужно больше восстановления';
  if(planCompletion>=90 && avgPain<4 && avgReadiness>=45) status='Идёте по плану';
  const tr=tonnageTrend(c);
  const ans={
    plan: planCompletion>=90?`Да, план недели почти выполнен (${planCompletion}%).`:`Выполнено ${planCompletion}% плана недели. Осталось: ${Math.max(0,t.strength-b.strength)} силовых и ${Math.max(0,t.cardio-b.cardio)} кардио.`,
    stronger: (tr.tw>tr.pw&&tr.pw>0)?'Силовой объём растёт по сравнению с прошлой неделей.':(tr.tw>0?'Силовой объём держится на уровне — это нормально.':'Силовых данных пока мало для вывода.'),
    recovery: (avgPain<3&&avgReadiness>=60)?'Восстановление в норме: готовность держится, боль низкая.':'Стоит добавить восстановления — готовность или боль на грани.',
    next:''
  };
  let recommendation;
  if(status==='Нужна мягкая неделя')recommendation='Сделайте мягкую неделю: мобилити, Zone 2 и сон. Прогрессию пока не форсируйте.';
  else if(status==='Слишком много интенсивности')recommendation='Снизьте интенсивность: меньше HIIT, добавьте Zone 2 и восстановление.';
  else if(status==='Не хватает силовых')recommendation='Добавьте силовую тренировку через «Подобрать тренировку».';
  else if(status==='Не хватает кардио')recommendation='Добавьте кардио Zone 2 на 20–30 минут.';
  else if(status==='Нужно больше восстановления')recommendation='Добавьте восстановительный день или мягкую мобилити.';
  else recommendation=`Двигайтесь по плану. Осталось выполнить ${Math.max(0,t.strength-b.strength)} силовых и ${Math.max(0,t.cardio-b.cardio)} кардио.`;
  ans.next=recommendation;
  return {planCompletion,strength:b.strength,cardio:b.cardio,mobility:b.mobility,recovery:b.recovery,targets:t,avgReadiness,avgRPE,avgPain,status,recommendation,answers:ans};
}
function statusColor(st){ if(st==='Идёте по плану')return '#7da498'; if(/интенсивност|перегруз/.test(st))return '#c98a3a'; if(/мягк/.test(st))return '#c2607a'; return '#6f89a7'; }
function statusPill(st){return `<span class="tag" style="background:${statusColor(st)};color:#fff;border-color:transparent">${esc(st)}</span>`;}
function qCard(q,a){return `<div class="card"><div class="kicker">${esc(q)}</div><p class="small" style="margin-top:6px">${esc(a)}</p></div>`;}
function workoutOutcome(w){ const m=editorMode(w.kind||'strength'); const s=w.summary||{};
  if(m==='cardio'){const cd=w.cardio||{}; const rec=(Number(cd.rpe||0)<=6?'Можно сохранить длительность или +5 минут при хорошей готовности.':'Держите спокойный темп, длительность пока не увеличивайте.'); return `<h3 style="font-size:15px;margin:0 0 4px">Итог: кардио</h3><p class="small" style="margin:0">${cd.minutes||'—'} мин · RPE ${cd.rpe||'—'}${cd.distance?' · '+cd.distance+' км':''}${cd.hr?' · пульс '+cd.hr:''} · самочувствие ${cd.feel||'—'}/5</p><p class="small" style="margin:6px 0 0"><b>В следующий раз:</b> ${rec}</p>`; }
  if(m==='mobility'){const mo=w.mobility||{}; const rec=(Number(mo.pain||0)>0?'Работайте мягче, без боли.':'Можно добавить ещё одну зону при отсутствии боли.'); return `<h3 style="font-size:15px;margin:0 0 4px">Итог: мобилити</h3><p class="small" style="margin:0">${mo.minutes||'—'} мин · зона ${esc(mo.zone||'—')} · ощущение ${esc(mo.sensation||'—')} · боль ${mo.pain!==''&&mo.pain!=null?mo.pain+'/10':'—'}</p><p class="small" style="margin:6px 0 0"><b>В следующий раз:</b> ${rec}</p>`; }
  const ex=(w.exercises||[]).length; const ton=tonnage(w); const sets=(w.exercises||[]).flatMap(e=>e.sets||[]).filter(x=>x.rpe); const arpe=sets.length?(sets.reduce((a,b)=>a+Number(b.rpe||0),0)/sets.length):0; const pa=s.painAfter; const rec=((arpe&&arpe<=7&&Number(s.painAfter||0)<3)?'Можно оставить тот же вес или добавить 1–2 повтора в первом упражнении.':'Сохраните вес и технику; прогрессию отложите до снижения RPE и боли.'); return `<h3 style="font-size:15px;margin:0 0 4px">Итог: силовая</h3><p class="small" style="margin:0">${ex} упражнений · тоннаж ${fmt(ton,0)} кг · средний RPE ${arpe?fmt(arpe,1):'—'} · боль после ${pa!==''&&pa!=null?pa+'/10':'—'}</p><p class="small" style="margin:6px 0 0"><b>В следующий раз:</b> ${rec}</p>`;
}
function renderPlan(){ const c=client(); const p=activeProgram(c);
  if(!p){ $('plan').innerHTML=top('plan','Мой план','Выберите программу, чтобы видеть недельный план и прогресс.')+`<div class="empty">Программа ещё не выбрана.</div><div class="row-actions" style="justify-content:flex-start;margin-top:12px"><button class="btn primary" onclick="show('programs')" data-event="program_select">Выбрать программу</button><button class="btn" onclick="openTrainingPicker()">Подобрать тренировку</button></div>`; return; }
  const wk=programWeek(c), t=weeklyTargets(c), b=weekBalance(c), ns=nextSession(c), wp=calculateWeeklyProgress(c);
  const doneOverall=(c.completedSessionIds||[]).length, totalOverall=p.sessions.length;
  $('plan').innerHTML=top('plan','Мой план','Ваша программа, текущая неделя и ближайшая тренировка.')+`
  <div class="card"><div class="kicker">Программа</div><h2 style="margin:2px 0 6px">${esc(p.name)}</h2><p class="small muted">${p.format?esc(p.format)+' · ':''}12 недель</p>
    <div class="grid cols-3" style="margin-top:12px">${stat('Неделя',wk+' из 12')}${stat('Выполнено',doneOverall+' из '+totalOverall)}${stat('План недели',wp.planCompletion+'%')}</div></div>
  <div class="card" style="margin-top:18px"><div class="kicker">На этой неделе</div>${balRow('Сила',b.strength,t.strength,'var(--plum)')}${balRow('Кардио',b.cardio,t.cardio,'var(--sage)')}${balRow('Мобилити',b.mobility,t.mobility,'#6f89a7')}${balRow('Восстановление',b.recovery,t.recovery,'#7da498')}</div>
  <div class="card" style="margin-top:18px"><div class="kicker">Следующая тренировка</div>${ns?`<h3 style="margin:4px 0 8px">${esc(ns.name.replace(/^Нед \d+ • /,''))}</h3><div class="tagline"><span class="tag" style="background:${kindColor(ns.kind||'strength')};color:#fff;border-color:transparent">${kindLabel(ns.kind||'strength')}</span></div><div class="row-actions" style="justify-content:flex-start;margin-top:10px"><button class="btn primary" onclick="createWorkoutFromSession('${ns.id}')" data-event="workout_start">Начать по плану</button><button class="btn" onclick="openTrainingPicker()">Подобрать вместо этого</button></div>`:'<p class="muted">Все сессии программы выполнены.</p>'}</div>
  <div class="card soft" style="margin-top:18px"><p class="small"><b>Что дальше:</b> ${esc(wp.recommendation)}</p></div>`;
}

function renderProgress(){const c=client(); const wp=calculateWeeklyProgress(c); const names=[...new Set(c.workouts.flatMap(w=>(w.exercises||[]).map(e=>e.name)))]; const selected=c.selectedExerciseId||names[0]||''; const data=c.workouts.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(w=>{let best=0;(w.exercises||[]).filter(e=>e.name===selected).forEach(e=>(e.sets||[]).forEach(s=>best=Math.max(best,e1rm(s.weight,s.reps))));return {label:w.date.slice(5),value:best};}).filter(x=>x.value>0);
 $('progress').innerHTML=top('progress','Прогресс','Простой ответ на четыре вопроса: план, прогресс, восстановление и что дальше.')+`
 <div class="card"><div class="kicker">Прогресс недели</div><h2 style="margin:2px 0 10px">${wp.planCompletion}% плана · ${statusPill(wp.status)}</h2>
   ${balRow('Сила',wp.strength,wp.targets.strength,'var(--plum)')}${balRow('Кардио',wp.cardio,wp.targets.cardio,'var(--sage)')}${balRow('Мобилити',wp.mobility,wp.targets.mobility,'#6f89a7')}${balRow('Восстановление',wp.recovery,wp.targets.recovery,'#7da498')}
   <div class="grid cols-3" style="margin-top:12px">${stat('Средняя готовность',wp.avgReadiness)}${stat('Средний RPE',fmt(wp.avgRPE,1))}${stat('Боль',fmt(wp.avgPain,1)+'/10')}</div>
   <div class="card soft" style="margin-top:12px"><p class="small"><b>Итог недели:</b> ${esc(wp.recommendation)}</p></div></div>
 <div class="grid cols-2" style="margin-top:18px">${qCard('Я выполняю план?',wp.answers.plan)}${qCard('Становлюсь сильнее или выносливее?',wp.answers.stronger)}${qCard('Восстанавливаюсь нормально?',wp.answers.recovery)}${qCard('Что делать дальше?',wp.answers.next)}</div>
 <div class="row-actions" style="justify-content:flex-start;margin-top:18px"><button class="btn primary" onclick="show('plan')">Мой план</button><button class="btn" onclick="openTrainingPicker()" data-event="workout_start">Подобрать тренировку</button></div>
 <details class="whybox" style="margin-top:18px"><summary>Подробная динамика (e1RM по упражнению)</summary><div class="field" style="max-width:420px;margin-top:12px"><label>Упражнение</label><select onchange="client().selectedExerciseId=this.value; save(); renderProgress()">${names.map(x=>`<option ${selected===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>${selected&&data.length?lineChart(data):'<div class="empty">Пока нет силовых данных для графика.</div>'}<div class="grid cols-3" style="margin-top:14px">${stat('Тренировок всего',c.workouts.length)}${stat('Средний RPE (всё время)',fmt(avgRPE(c),1))}${stat('Тоннаж (всё время)',fmt(c.workouts.reduce((s,w)=>s+tonnage(w),0),0)+' кг')}</div></details>`;}
window.client=client; window.save=save; window.renderProgress=renderProgress;

/* ===== training engine v1.5: variety, library, balance ===== */
const KIND_META={
  strength:{l:'Сила',c:'#9d5e78',b:'str'},
  functional:{l:'Функциональная',c:'#9d5e78',b:'str'},
  cardio:{l:'Кардио',c:'#6f938a',b:'cardio'},
  hiit:{l:'HIIT',c:'#c47c4e',b:'cardio'},
  mobility:{l:'Мобилити',c:'#6f89a7',b:'mob'},
  stretch:{l:'Стретчинг',c:'#6f89a7',b:'mob'},
  balance:{l:'Баланс',c:'#c2a36b',b:'rec'},
  recovery:{l:'Восстановление',c:'#7da498',b:'rec'}
};
function kindLabel(k){return (KIND_META[k]||KIND_META.strength).l}
function kindColor(k){return (KIND_META[k]||KIND_META.strength).c}

const trainingLibrary=[
  // strength
  {id:'tl_fbA',name:'Фуллбоди A',kind:'strength',level:'новичок',format:'фуллбоди',equip:'зал',dur:45,intensity:'умеренная',rpe:'6–7',goal:'Базовые паттерны и техника всего тела',suits:'Старт с нуля, возврат после паузы',caution:'Боль в суставах — снизить амплитуду',omc:'Подходит в любой фазе; в менструацию — мягче',meno:'Основа в пери/постменопаузе'},
  {id:'tl_fbB',name:'Фуллбоди B',kind:'strength',level:'новичок',format:'фуллбоди',equip:'зал',dur:45,intensity:'умеренная',rpe:'6–7',goal:'Второй фуллбоди-день с акцентом на тягах',suits:'Новички 2–3 раза в неделю',caution:'Контроль поясницы в наклонах',omc:'Любая фаза',meno:'Подходит'},
  {id:'tl_upper',name:'Верх тела (Upper)',kind:'strength',level:'средний',format:'сплит',equip:'зал',dur:50,intensity:'умеренная',rpe:'7–8',goal:'Жимы и тяги верха, гипертрофия',suits:'Сплит upper/lower 4×/нед',caution:'Плечо — следить за техникой',omc:'Любая фаза',meno:'Подходит'},
  {id:'tl_lower',name:'Низ тела (Lower)',kind:'strength',level:'средний',format:'сплит',equip:'зал',dur:50,intensity:'высокая',rpe:'7–8',goal:'Колено- и таз-доминантные, сила ног',suits:'Сплит upper/lower',caution:'Боль в колене — уменьшить объём',omc:'Любая фаза; в ПМС — по готовности',meno:'Подходит'},
  {id:'tl_glutes',name:'Ягодицы + ноги',kind:'strength',level:'средний',format:'glutes',equip:'зал',dur:45,intensity:'умеренная',rpe:'7',goal:'Акцент на ягодичные и заднюю цепь',suits:'Любители нижней части',caution:'Поясница — нейтраль',omc:'Любая фаза',meno:'Подходит'},
  {id:'tl_core',name:'Кор + стабилизация',kind:'strength',level:'новичок',format:'core',equip:'коврик',dur:25,intensity:'лёгкая',rpe:'5–6',goal:'Глубокие мышцы кора, антиразгибание/ротация',suits:'Дополнение к силовой',caution:'Диастаз/таз — мягкие варианты',omc:'Любая фаза',meno:'Подходит, полезно для осанки'},
  {id:'tl_pull',name:'Тяни (Pull)',kind:'strength',level:'продвинутый',format:'ppl',equip:'зал',dur:55,intensity:'высокая',rpe:'7–9',goal:'Спина и бицепс, тяговый день PPL',suits:'Продвинутые, 6-дневный сплит',caution:'Объём дозировать, deload',omc:'Любая фаза',meno:'С контролем восстановления'},
  {id:'tl_legsHyp',name:'Ноги: гипертрофия',kind:'strength',level:'продвинутый',format:'ppl',equip:'зал',dur:60,intensity:'высокая',rpe:'7–9',goal:'Объёмная работа ног',suits:'Продвинутые',caution:'Высокий объём — следить за коленом и сном',omc:'По готовности',meno:'Осторожно с объёмом'},
  {id:'tl_func',name:'Функциональная тренировка',kind:'functional',level:'средний',format:'фуллбоди',equip:'свой вес',dur:35,intensity:'умеренная',rpe:'6–7',goal:'Перенос, локомоция, координация',suits:'Разнообразие и тонус',caution:'Техника важнее темпа',omc:'Любая фаза',meno:'Подходит'},
  {id:'tl_metcon',name:'Метаболическая круговая',kind:'hiit',level:'средний',format:'круг',equip:'свой вес',dur:25,intensity:'высокая',rpe:'7–8',goal:'Круговая с короткими паузами',suits:'При хорошем восстановлении',caution:'Не на фоне плохого сна/приливов',omc:'Не в дни выраженного ПМС',meno:'Осторожно при приливах'},
  // cardio
  {id:'tl_walk',name:'LISS — ходьба',kind:'cardio',level:'любой',format:'кардио',equip:'ходьба',dur:40,intensity:'лёгкая',rpe:'3–4',goal:'Низкоинтенсивное восстановительное кардио',suits:'Любой уровень, любой день',caution:'Практически без ограничений',omc:'Любая фаза, удобно в менструацию',meno:'Базовая активность в пери/пост'},
  {id:'tl_tread2',name:'Zone 2 — дорожка',kind:'cardio',level:'любой',format:'кардио',equip:'дорожка',dur:30,intensity:'умеренная',rpe:'5–6',goal:'Метаболическое здоровье, разговорный темп',suits:'Можно говорить короткими фразами',caution:'Боль в колене/голеностопе — выбрать эллипс или велосипед',omc:'Любая фаза',meno:'Хорошо переносится'},
  {id:'tl_ellip2',name:'Zone 2 — эллипс',kind:'cardio',level:'любой',format:'кардио',equip:'эллипс',dur:30,intensity:'умеренная',rpe:'5–6',goal:'Умеренное кардио без ударной нагрузки',suits:'Берегущий суставы вариант',caution:'Подходит при чувствительных коленях',omc:'Любая фаза',meno:'Удобно при суставном дискомфорте'},
  {id:'tl_bike2',name:'Zone 2 — велотренажёр',kind:'cardio',level:'любой',format:'кардио',equip:'велотренажёр',dur:35,intensity:'умеренная',rpe:'5–6',goal:'Кардио с минимальной нагрузкой на стопы',suits:'Низкая ударность',caution:'Настроить посадку под колено',omc:'Любая фаза',meno:'Подходит'},
  {id:'tl_intwalk',name:'Интервальная ходьба',kind:'cardio',level:'любой',format:'кардио',equip:'дорожка',dur:30,intensity:'умеренная',rpe:'5–7',goal:'2 мин быстрее / 2 мин спокойно',suits:'Мягкий шаг к интервалам',caution:'Снизить темп при головокружении',omc:'Любая фаза',meno:'Хорошая альтернатива HIIT'},
  {id:'tl_row',name:'Гребной тренажёр — интервалы',kind:'cardio',level:'средний',format:'кардио',equip:'гребной',dur:25,intensity:'умеренная',rpe:'6–7',goal:'Кардио всего тела, спина и ноги',suits:'Любящие гребок',caution:'Нейтральная поясница в тяге',omc:'Любая фаза',meno:'Подходит при хорошей технике'},
  {id:'tl_step',name:'Степпер',kind:'cardio',level:'средний',format:'кардио',equip:'степпер',dur:25,intensity:'умеренная',rpe:'6',goal:'Кардио с акцентом на ноги/ягодицы',suits:'Разнообразие кардио',caution:'Колено — без боли',omc:'Любая фаза',meno:'По переносимости'},
  {id:'tl_hiit',name:'HIIT (для подготовленных)',kind:'hiit',level:'продвинутый',format:'кардио',equip:'свой вес',dur:20,intensity:'высокая',rpe:'8–9',goal:'Короткие интенсивные интервалы',suits:'Только при хорошей готовности и допуске',caution:'Не обязателен. Исключить при сердечно-сосудистом риске, плохом сне, выраженных приливах',omc:'Не в дни выраженного ПМС/боли',meno:'В постменопаузе — осторожно, по допуску'},
  {id:'tl_reccardio',name:'Восстановительное кардио',kind:'recovery',level:'любой',format:'кардио',equip:'велотренажёр',dur:20,intensity:'лёгкая',rpe:'2–3',goal:'Лёгкое движение для восстановления',suits:'После тяжёлых дней',caution:'Без усилия и одышки',omc:'Любая фаза',meno:'Подходит'},
  // mobility / stretch
  {id:'tl_mobhip',name:'Мобилити тазобедренных',kind:'mobility',level:'любой',format:'мобилити',equip:'коврик',dur:15,intensity:'лёгкая',rpe:'2–3',goal:'Подвижность таза перед/после ног',suits:'Все уровни',caution:'Через боль не работать',omc:'Любая фаза',meno:'Полезно при скованности'},
  {id:'tl_mobtspine',name:'Мобилити грудного отдела',kind:'mobility',level:'любой',format:'мобилити',equip:'коврик',dur:12,intensity:'лёгкая',rpe:'2',goal:'Ротация и разгибание грудного отдела',suits:'Сидячая работа',caution:'Плавно, без рывков',omc:'Любая фаза',meno:'Полезно для осанки'},
  {id:'tl_mobshoulder',name:'Мобилити плечевого пояса',kind:'mobility',level:'любой',format:'мобилити',equip:'резинки',dur:12,intensity:'лёгкая',rpe:'2',goal:'Подготовка плеча к жимам/тягам',suits:'Перед верхом тела',caution:'Без боли в плече',omc:'Любая фаза',meno:'Подходит'},
  {id:'tl_mobankle',name:'Мобилити голеностопа',kind:'mobility',level:'любой',format:'мобилити',equip:'свой вес',dur:10,intensity:'лёгкая',rpe:'2',goal:'Амплитуда голеностопа для приседа',suits:'Перед ногами',caution:'Аккуратно при недавней травме',omc:'Любая фаза',meno:'Подходит'},
  {id:'tl_strhams',name:'Стретчинг задней поверхности бедра',kind:'stretch',level:'любой',format:'стретчинг',equip:'коврик',dur:12,intensity:'лёгкая',rpe:'2',goal:'Мягкое растяжение задней цепи',suits:'После силовой',caution:'Лёгкое натяжение, не боль',omc:'Любая фаза',meno:'Подходит'},
  {id:'tl_strhipflex',name:'Стретчинг сгибателей бедра',kind:'stretch',level:'любой',format:'стретчинг',equip:'коврик',dur:10,intensity:'лёгкая',rpe:'2',goal:'Расслабление передней поверхности таза',suits:'Сидячий образ жизни',caution:'Без переразгибания поясницы',omc:'Любая фаза',meno:'Подходит'},
  {id:'tl_strchest',name:'Стретчинг грудных мышц',kind:'stretch',level:'любой',format:'стретчинг',equip:'свой вес',dur:8,intensity:'лёгкая',rpe:'2',goal:'Раскрытие грудного отдела и плеч',suits:'После жимов',caution:'Плечо — без боли',omc:'Любая фаза',meno:'Подходит'},
  {id:'tl_breath',name:'Дыхание + расслабление',kind:'stretch',level:'любой',format:'дыхание',equip:'коврик',dur:10,intensity:'лёгкая',rpe:'1–2',goal:'Снижение тонуса, восстановление',suits:'Вечер, стресс',caution:'Комфортный темп дыхания',omc:'Любая фаза',meno:'Полезно при нарушении сна'},
  {id:'tl_recafter',name:'Восстановительный комплекс после силовой',kind:'stretch',level:'любой',format:'стретчинг',equip:'коврик',dur:12,intensity:'лёгкая',rpe:'2',goal:'Мягкий блок после тренировки',suits:'Завершение силовой',caution:'Может использоваться как мягкий восстановительный блок при отсутствии противопоказаний',omc:'Любая фаза',meno:'Подходит'},
  {id:'tl_ammorning',name:'Утренняя мягкая мобилизация',kind:'mobility',level:'любой',format:'мобилити',equip:'свой вес',dur:8,intensity:'лёгкая',rpe:'1–2',goal:'Разбудить тело без нагрузки',suits:'Утро',caution:'Плавно',omc:'Любая фаза',meno:'Подходит'},
  {id:'tl_pmevening',name:'Вечерний расслабляющий комплекс',kind:'stretch',level:'любой',format:'стретчинг',equip:'коврик',dur:12,intensity:'лёгкая',rpe:'1–2',goal:'Снять напряжение перед сном',suits:'Вечер',caution:'Без интенсивного растяжения',omc:'Любая фаза',meno:'Полезно при бессоннице'},
  // balance / recovery
  {id:'tl_balance',name:'Баланс и профилактика падений',kind:'balance',level:'любой',format:'баланс',equip:'свой вес',dur:20,intensity:'лёгкая',rpe:'3–4',goal:'Устойчивость, координация, контроль',suits:'Особенно постменопауза',caution:'Опора рядом для безопасности',omc:'Любая фаза',meno:'Приоритет в постменопаузе'},
  {id:'tl_recday',name:'Восстановительный день',kind:'recovery',level:'любой',format:'восстановление',equip:'ходьба',dur:25,intensity:'лёгкая',rpe:'2',goal:'Прогулка и лёгкая подвижность',suits:'Красная зона готовности, усталость',caution:'При красных флагах — к специалисту',omc:'Любая фаза',meno:'Подходит'}
];

window.tlType=window.tlType||'Все'; window.tlLevel=window.tlLevel||'Все'; window.tlEquip=window.tlEquip||'Все'; window.tlInt=window.tlInt||'Все';
function durBucket(d){return d<=20?'≤20 мин':d<=35?'21–35 мин':d<=50?'36–50 мин':'50+ мин'}
function tlEquipList(){return Array.from(new Set(trainingLibrary.map(x=>x.equip)))}
function trainingFilters(){
  const typeOpts=['Все','strength','functional','cardio','hiit','mobility','stretch','balance','recovery'];
  const t=(window.tlType),lv=(window.tlLevel),eq=(window.tlEquip),it=(window.tlInt);
  return `<div class="card"><div class="input-grid" style="grid-template-columns:repeat(4,1fr)">
    <div class="field"><label>Тип</label><select onchange="window.tlType=this.value;renderLibrary()">${typeOpts.map(o=>`<option value="${o}" ${t===o?'selected':''}>${o==='Все'?'Все':kindLabel(o)}</option>`).join('')}</select></div>
    <div class="field"><label>Уровень</label><select onchange="window.tlLevel=this.value;renderLibrary()">${['Все','новичок','средний','продвинутый','любой'].map(o=>`<option ${lv===o?'selected':''}>${o}</option>`).join('')}</select></div>
    <div class="field"><label>Оборудование</label><select onchange="window.tlEquip=this.value;renderLibrary()">${['Все'].concat(tlEquipList()).map(o=>`<option ${eq===o?'selected':''}>${o}</option>`).join('')}</select></div>
    <div class="field"><label>Интенсивность</label><select onchange="window.tlInt=this.value;renderLibrary()">${['Все','лёгкая','умеренная','высокая'].map(o=>`<option ${it===o?'selected':''}>${o}</option>`).join('')}</select></div>
  </div></div>`;
}
function trainingCards(){
  const t=window.tlType,lv=window.tlLevel,eq=window.tlEquip,it=window.tlInt;
  const list=trainingLibrary.filter(x=>(t==='Все'||x.kind===t)&&(lv==='Все'||x.level===lv)&&(eq==='Все'||x.equip===eq)&&(it==='Все'||x.intensity===it));
  if(!list.length)return '<div class="empty">Под выбранные фильтры тренировок не нашлось. Сбросьте часть фильтров.</div>';
  return `<div class="grid cols-3" style="margin-top:18px">${list.map(w=>`<div class="lib-card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h4>${esc(w.name)}</h4><span class="tag" style="background:${kindColor(w.kind)};color:#fff;border-color:transparent">${kindLabel(w.kind)}</span></div>
    <div class="tagline"><span class="tag">${esc(w.level)}</span><span class="tag">${w.dur} мин</span><span class="tag">${esc(w.equip)}</span><span class="tag">${esc(w.intensity)}</span><span class="tag">RPE ${esc(w.rpe)}</span></div>
    <p class="small"><b>Цель:</b> ${esc(w.goal)}</p>
    <p class="small muted"><b>Кому:</b> ${esc(w.suits)}</p>
    <p class="small muted"><b>Осторожно:</b> ${esc(w.caution)}</p>
    <p class="small muted"><b>цикл:</b> ${esc(w.omc)} · <b>Менопауза:</b> ${esc(w.meno)}</p>
    <div class="row-actions" style="margin-top:6px"><button class="btn smallbtn" onclick="addLibToPlan('${w.id}')">Добавить в план</button><button class="btn primary smallbtn" onclick="startLibWorkout('${w.id}')" data-event="workout_start">Начать</button></div></div>`).join('')}</div>`;
}
function libItem(id){return trainingLibrary.find(x=>x.id===id)}
function makeLibWorkout(c,w){
  const plan=`Тип: ${kindLabel(w.kind)} · ${w.dur} мин · интенсивность: ${w.intensity} · RPE ${w.rpe}. Цель: ${w.goal}.`;
  let exercises=[];
  if(w.kind==='strength'||w.kind==='functional'){
    const picks=allExercises(c).slice(0,5);
    exercises=picks.map(e=>({id:uid(),exerciseId:e.id,name:e.name,pattern:e.pattern,target:'3×8–10',sets:Array.from({length:3},(_,i)=>({id:uid(),set:i+1,reps:'',weight:'',rpe:'',rir:'',pain:'',comment:''}))}));
  }
  return {id:uid(),date:todayISO(),title:w.name,kind:w.kind,mode:c.mode,cycle:cycleInfo(todayISO(),c),readiness:{score:readinessScore(c),zone:readinessZone(readinessScore(c))},summary:{status:'',feelAfter:'',painAfter:'',fatigueAfter:'',comment:''},notes:plan,exercises};
}
window.addLibToPlan=function(id){const w=libItem(id);if(!w)return;const c=client();c.workouts.unshift(makeLibWorkout(c,w));save();toast('Добавлено в дневник: '+w.name);};
window.startLibWorkout=function(id){const w=libItem(id);if(!w)return;const c=client();const nw=makeLibWorkout(c,w);c.workouts.unshift(nw);save();if(nw.exercises.length){show('log');editWorkout(nw.id);}else{show('log');toast('Тренировка добавлена — запишите итог после выполнения');}};

/* ---- week balance ---- */
function weekBalance(c){
  const now=Date.now(); const out={strength:0,cardio:0,mobility:0,recovery:0,hiit:0,total:0};
  (c.workouts||[]).forEach(w=>{
    const d=new Date(w.date).getTime(); if(isNaN(d)||now-d>7*86400000||d-now>86400000)return;
    const b=(KIND_META[w.kind||'strength']||KIND_META.strength).b;
    if(w.kind==='hiit')out.hiit++;
    if(b==='str')out.strength++; else if(b==='cardio')out.cardio++; else if(b==='mob')out.mobility++; else if(b==='rec')out.recovery++;
    out.total++;
  });
  return out;
}
function balanceAdvice(b){
  const t=[];
  if(b.mobility===0&&b.total>0)t.push('Добавьте 15–20 минут мобилити или стретчинга после силовой.');
  if(b.cardio===0&&b.strength>0)t.push('Добавьте 1–2 кардио Zone 2 (дорожка, эллипс или велотренажёр).');
  if(b.strength===0&&(b.cardio+b.mobility)>0)t.push('Не хватает силовой нагрузки — добавьте фуллбоди или сплит.');
  if(b.hiit>2)t.push('Много HIIT за неделю — часть замените на Zone 2 или эллипс/ходьбу.');
  if(b.recovery===0&&b.total>=4)t.push('Добавьте восстановительный день или лёгкую прогулку.');
  if(!t.length)t.push('Баланс выглядит ровным. Так держать.');
  return t;
}
function balRow(label,n,target,col){
  const pct=Math.min(100,Math.round(n/target*100));
  return `<div style="margin:9px 0"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><span>${label}</span><span class="muted">${n}/${target}</span></div><div class="progressbar"><span style="width:${pct}%;background:${col}"></span></div></div>`;
}
function balancePanel(c){
  const b=weekBalance(c);
  return `<div class="grid cols-2" style="margin-top:18px"><div class="card"><h2>Баланс недели</h2><p class="small muted" style="margin-top:-4px">Тренировки за последние 7 дней по типам нагрузки</p>
    ${balRow('Сила',b.strength,3,'var(--plum)')}
    ${balRow('Кардио',b.cardio,2,'var(--sage)')}
    ${balRow('Мобилити и стретчинг',b.mobility,2,'#6f89a7')}
    ${balRow('Восстановление',b.recovery,1,'#7da498')}
  </div><div class="card soft"><h3>Рекомендации недели</h3><ul style="margin:8px 0 0;padding-left:18px">${balanceAdvice(b).map(x=>`<li style="margin:6px 0">${esc(x)}</li>`).join('')}</ul>
    <div class="divider"></div><p class="small muted">Цели (3 силы / 2 кардио / 2 мобилити / 1 восстановление) — ориентир, а не норматив. Подстраивайте под уровень, готовность и план специалиста.</p></div></div>`;
}
function varietyPanel(c){
  const b=weekBalance(c);
  return `<div class="divider"></div><h3 style="margin-bottom:8px">Разнообразие нагрузки (7 дней)</h3>
  <div class="grid cols-4">${stat('Сила',b.strength)}${stat('Кардио',b.cardio)}${stat('Мобилити',b.mobility)}${stat('Восстановление',b.recovery)}</div>
  <ul style="margin:12px 0 0;padding-left:18px">${balanceAdvice(b).map(x=>`<li style="margin:5px 0">${esc(x)}</li>`).join('')}</ul>`;
}

function renderLibrary(){const c=client(); const pattern=window.libPattern||'Все'; const q=(window.libQ||'').toLowerCase(); const list=allExercises(c).filter(e=>(pattern==='Все'||e.pattern===pattern)&&(!q||[e.name,e.pattern,e.equipment,e.muscles].join(' ').toLowerCase().includes(q))); $('library').innerHTML=top('library','Библиотека тренировок','Готовые тренировки: сила и сплиты, кардио (дорожка, эллипс, велотренажёр, гребля, ходьба), HIIT, стретчинг, мобилити, баланс и восстановление. Фильтруйте по типу, уровню, оборудованию и интенсивности.',`<button class="btn" onclick="show('programs')">12-недельные программы</button>`)+trainingFilters()+trainingCards()+`<div class="divider" style="margin:26px 0"></div><h2 style="margin:0 0 6px">Упражнения</h2><p class="muted small" style="margin:0 0 14px">База упражнений по паттернам, технике, ошибкам, регрессиям и ограничениям.</p><div class="card"><div class="input-grid" style="grid-template-columns:2fr 1fr 1fr"><div class="field"><label>Поиск</label><input value="${esc(window.libQ||'')}" oninput="window.libQ=this.value; renderLibrary()"></div><div class="field"><label>Паттерн</label><select onchange="window.libPattern=this.value; renderLibrary()"><option>Все</option>${patterns.map(x=>`<option ${pattern===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field" style="align-self:end"><button class="btn" onclick="showAddExercise()">+ Своё упражнение</button></div></div></div><div class="grid cols-3" style="margin-top:18px">${list.map(e=>`<div class="lib-card"><h4>${esc(e.name)}</h4><div class="tagline"><span class="tag">${esc(e.pattern)}</span><span class="tag">${esc(e.equipment)}</span><span class="tag">${esc(e.level)}</span></div><p class="small"><b>Мышцы:</b> ${esc(e.muscles)}</p><p class="small"><b>Техника:</b> ${esc(e.tech)}</p><p class="small muted"><b>Ошибки:</b> ${esc(e.errors)}</p><p class="small muted"><b>Регрессия:</b> ${esc(e.reg)} · <b>Прогрессия:</b> ${esc(e.prog)}</p><p class="small muted"><b>Осторожно:</b> ${esc(e.caution)}</p></div>`).join('')}</div>`;}
window.renderLibrary=renderLibrary;
window.showAddExercise=function(){showModal(`<h2>Добавить упражнение</h2><div class="input-grid" style="grid-template-columns:1fr 1fr"><div class="field"><label>Название</label><input id="ce_name"></div><div class="field"><label>Паттерн</label><select id="ce_pattern">${patterns.map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Оборудование</label><select id="ce_equipment">${equipment.map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Уровень</label><select id="ce_level">${levels.map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field" style="grid-column:1/-1"><label>Мышцы</label><input id="ce_muscles"></div><div class="field" style="grid-column:1/-1"><label>Техника</label><textarea id="ce_tech"></textarea></div></div><div class="toolbar" style="justify-content:flex-start;margin-top:16px"><button class="btn primary" onclick="addCustomExercise()">Добавить</button><button class="btn" onclick="closeModal()">Закрыть</button></div>`)};
window.addCustomExercise=function(){const c=client(); c.customExercises.push({id:'custom_'+uid(),name:$('ce_name').value||'Новое упражнение',pattern:$('ce_pattern').value,equipment:$('ce_equipment').value,level:$('ce_level').value,muscles:$('ce_muscles').value,tech:$('ce_tech').value,errors:'Заполнить тренеру',reg:'Упростить',prog:'Усложнить',caution:'Оценить индивидуально'}); save(); closeModal(); toast('Упражнение добавлено');};
function redFlagCount(c){let count=0; const ch=latestCheckin(c); if(Number(ch?.pain||0)>=6)count++; if(c.mode==='post' && /кров/i.test(c.notes||''))count++; const highPainSets=c.workouts.flatMap(w=>(w.exercises||[]).flatMap(e=>e.sets||[])).filter(s=>Number(s.pain||0)>=6).length; return count+highPainSets;}
function clientSummary(c){const score=readinessScore(c), z=readinessZone(score), p=activeProgram(c); const comp=p?Math.round(c.completedSessionIds.length/p.sessions.length*100):0; return {score,z,comp,workouts:c.workouts.length,tonnage:c.workouts.reduce((s,w)=>s+tonnage(w),0),avgRPE:avgRPE(c),flags:redFlagCount(c)};}
function renderPro(){const sc=selectedClient(); $('pro').innerHTML=top('pro','Кабинет тренера / врача','Мои участницы, быстрый статус, выполнение плана, готовность, боль, RPE и переход к карточке.',`<button class="btn primary" onclick="showAddClient()">+ Участница</button><button class="btn" onclick="generateReport()">Сформировать отчёт</button>`)+`<div class="client-list">${state.clients.map(c=>{const s=clientSummary(c); return `<div class="client-row ${sc.id===c.id?'active':''}" onclick="selectProClient('${c.id}')"><div><b>${esc(c.name)}</b><br><span class="small muted">${modes[c.mode]} • ${esc(c.level)} • ${esc(c.goal)}</span></div><div><span class="zone ${zoneClass(s.z)}">${s.z}</span><br><span class="small muted">${s.score}%</span></div><div><b>${s.comp}%</b><br><span class="small muted">план</span></div><div><b>${fmt(s.avgRPE,1)}</b><br><span class="small muted">ср. RPE</span></div><div class="row-actions"><button class="btn smallbtn" onclick="event.stopPropagation(); selectProClient('${c.id}'); show('report')">Отчёт</button><button class="btn smallbtn" onclick="event.stopPropagation(); setActiveClient('${c.id}'); setRole('client')">Открыть</button></div></div>`}).join('')}</div><div class="grid cols-2" style="margin-top:18px"><div class="card"><h2>Профиль участницы</h2>${clientCard(sc)}</div><div class="card"><h2>Рекомендации по коррекции</h2>${recommendationList(sc).map(x=>`<p>• ${esc(x)}</p>`).join('')}</div></div>`;}
window.selectProClient=function(id){state.pro.selectedClientId=id; state.activeClientId=id; save(); renderPro(); updateSide();};
function clientCard(c){const s=clientSummary(c); const ci=cycleInfo(todayISO(),c); return `<div class="grid cols-2">${stat('Статус',modes[c.mode],c.mode==='cycle'?ci.note:'восстановление/симптомы')}${stat('Готовность',s.score+'%',`<span class="zone ${zoneClass(s.z)}">${s.z}</span>`)}${stat('Тренировок',s.workouts)}${stat('Тоннаж',fmt(s.tonnage,0)+' кг')}${stat('Средний RPE',fmt(s.avgRPE,1))}${stat('Красные сигналы',s.flags)}</div><div class="divider"></div><p><b>Цель:</b> ${esc(c.goal)}</p><p><b>Ограничения:</b> ${esc(c.injuries||'не указаны')}</p><p><b>Заметки:</b> ${esc(c.notes||'—')}</p>${varietyPanel(c)}`;}
function recommendationList(c){const s=clientSummary(c), ch=latestCheckin(c); const rec=[]; if(s.flags>0||Number(ch?.pain||0)>=6) rec.push('При боли ≥6/10 или красных флагах — остановить нагрузку и направить на медицинскую оценку.'); if(s.z==='Зелёная') rec.push('Оставить план без изменений; при RPE ≤7 и технике без ошибок можно увеличить вес на 2,5–5%.'); if(s.z==='Жёлтая') rec.push('Снизить вес на 5–10% или убрать 1 подход в базовых упражнениях; HIIT не усиливать.'); if(s.z==='Оранжевая') rec.push('Перевести сессию в лёгкий технический формат: −20–40% объёма, больше отдыха, без отказа.'); if(s.z==='Красная') rec.push('Восстановительный день: ходьба, дыхание, мобилизация без боли; оценить сон, стресс и симптомы.'); if(s.avgRPE>=8.5) rec.push('Средний RPE высокий: проверить восстановление и рассмотреть deload 5–7 дней.'); if(c.mode==='cycle' && Number(ch?.femaleSymptoms||0)>=6) rec.push('Выраженные симптомы цикла/ПМС: временно убрать HIIT, снизить объём нижней части тела, оставить технику и умеренную силовую.'); if(c.mode!=='cycle' && Number(ch?.femaleSymptoms||0)>=6) rec.push('Выраженные приливы/симптомы: не усиливать интервальную нагрузку, сделать акцент на силовую умеренной интенсивности и сон.'); if(s.comp<50) rec.push('Низкое выполнение плана: упростить программу, уменьшить частоту или длительность сессий.'); if(!rec.length) rec.push('Данных недостаточно; продолжить сбор дневника 2–3 недели и оценить тренд.'); return rec;}
function generateReportText(c=selectedClient()){const s=clientSummary(c), ch=latestCheckin(c), ci=cycleInfo(todayISO(),c); const rec=recommendationList(c); const last=c.workouts[0]; return `FemFit Diary v1.3 — отчёт по участнице\n\nУчастница: ${c.name}\nВозраст: ${c.age || '—'}\nРежим: ${modes[c.mode]}\nУровень: ${c.level}\nЦель: ${c.goal || '—'}\nОграничения: ${c.injuries || 'не указаны'}\n\n1. Текущий статус\nГотовность: ${s.score}% (${s.z})\nЖенский модуль: ${c.mode==='cycle'?ci.note:modes[c.mode]}\nПоследний чек-ин: ${ch?ch.date:'нет данных'}\nБоль по последнему чек-ину: ${ch?.pain ?? '—'}/10\nСимптомы цикла/менопаузы: ${ch?.femaleSymptoms ?? '—'}/10\n\n2. Тренировочная нагрузка\nКоличество тренировок: ${s.workouts}\nВыполнение 12-недельного плана: ${s.comp}%\nОбщий тоннаж: ${fmt(s.tonnage,0)} кг\nСредний RPE: ${fmt(s.avgRPE,1)}\nПоследняя тренировка: ${last?last.date+' • '+last.title:'нет данных'}\n\n3. Риски и ограничения\nКрасные/болевые сигналы: ${s.flags}\n${s.flags>0?'Есть сигналы, требующие ограничения нагрузки и очной оценки при сохранении симптомов.':'Критических сигналов по введённым данным не выявлено.'}\n\n4. Рекомендации по коррекции нагрузки\n${rec.map((x,i)=>(i+1)+'. '+x).join('\n')}\n\n5. Комментарий\nДанные дневника не являются диагнозом и не заменяют врачебную оценку. Решение по нагрузке строится по совокупности: симптомы, сон, боль, RPE/RIR, техника и динамика выполнения плана.`;}
window.generateReport=function(){state.pro.reportText=generateReportText(selectedClient()); save(); show('report');};
function renderReport(){const c=selectedClient(); if(!state.pro.reportText) state.pro.reportText=generateReportText(c); $('report').innerHTML=top('report','Автоматический отчёт','Отчёт для тренера/врача: нагрузка, выполнение плана, симптомы, боль, RPE и рекомендации по коррекции.',`<button class="btn primary" onclick="generateReport()">Обновить отчёт</button><button class="btn" onclick="copyReport()">Копировать</button><button class="btn" onclick="downloadReport()">Скачать TXT</button>`)+`<div class="grid cols-3">${stat('Участница',esc(c.name),modes[c.mode]+' • '+c.level)}${stat('Готовность',readinessScore(c)+'%',`<span class="zone ${zoneClass(readinessZone(readinessScore(c)))}">${readinessZone(readinessScore(c))}</span>`)}${stat('Средний RPE',fmt(avgRPE(c),1))}</div><div class="card" style="margin-top:18px"><div class="report-box" id="reportText">${esc(state.pro.reportText)}</div></div>`;}
window.copyReport=function(){navigator.clipboard?.writeText(state.pro.reportText);toast('Отчёт скопирован');};
window.downloadReport=function(){const blob=new Blob([state.pro.reportText],{type:'text/plain;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='FemFit_report_'+selectedClient().name+'_'+todayISO()+'.txt'; a.click(); URL.revokeObjectURL(a.href);};
window.showAddClient=function(){showModal(`<h2>Новая участница</h2><div class="input-grid"><div class="field"><label>Имя</label><input id="nc_name"></div><div class="field"><label>Возраст</label><input id="nc_age" type="number"></div><div class="field"><label>Режим</label><select id="nc_mode">${Object.entries(modes).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div><div class="field"><label>Уровень</label><select id="nc_level">${levels.map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field" style="grid-column:1/-1"><label>Цель</label><input id="nc_goal"></div></div><div class="toolbar" style="justify-content:flex-start;margin-top:16px"><button class="btn primary" onclick="addClient()">Добавить</button><button class="btn" onclick="closeModal()">Закрыть</button></div>`)};
window.addClient=function(){const c={id:uid(),name:$('nc_name').value||'Новая участница',age:Number($('nc_age').value||0),mode:$('nc_mode').value,level:$('nc_level').value,goal:$('nc_goal').value,equipment:'',height:'',weight:'',lastPeriod:'',cycleLength:28,menstruationLength:5,injuries:'',notes:'',onboardingDone:false,programs:[],activeProgramId:null,completedSessionIds:[],workouts:[],checkins:[],customExercises:[],selectedExerciseId:''}; state.clients.push(c); state.activeClientId=c.id; state.pro.selectedClientId=c.id; generateProgramForClient(c,false); save(); closeModal(); toast('Участница добавлена'); renderAll();};
function renderRedflags(){const flags=['Боль в груди, давящая боль, выраженная нехватка воздуха','Обморок, предобморочное состояние, внезапная слабость','Неврологические симптомы: нарушение речи, онемение, слабость конечности','Боль в суставе или спине ≥6/10 либо нарастающая боль от тренировки к тренировке','Отёк сустава, острая травма, подозрение на перелом или стрессовый перелом','Кровотечение после менопаузы','Очень обильная менструация, выраженное головокружение или слабость','Неконтролируемое артериальное давление','Послеоперационный период без допуска врача','Лихорадка, инфекция, выраженное ухудшение общего состояния']; $('redflags').innerHTML=top('redflags','Красные флаги','Состояния, при которых нагрузку нужно остановить и направить участницу на медицинскую оценку.')+`<div class="warning-list">${flags.map(f=>`<div class="warning"><div class="wm">!</div><div><h4>Остановить нагрузку</h4><p>${esc(f)}</p></div></div>`).join('')}</div><div class="card" style="margin-top:18px"><h2>Дисклеймер</h2><p>FemFit Diary — дневник тренировок и самонаблюдения. Он не ставит диагнозы, не назначает лечение и не заменяет врача, физиотерапевта или очную оценку тренера.</p></div>`;}
function renderData(){ $('data').innerHTML=top('data','Данные','Экспорт, импорт и сброс локальной базы. Данные хранятся только в этом браузере.',`<button class="btn primary" onclick="exportData()">Экспорт JSON</button><button class="btn" onclick="document.getElementById('importFile').click()">Импорт JSON</button><button class="btn danger" onclick="resetData()">Сброс</button>`)+`<input id="importFile" type="file" accept="application/json" style="display:none" onchange="importData(event)"><div class="card"><h2>Локальное хранение</h2><p>Файл работает автономно. При очистке браузера данные могут исчезнуть. Экспортируйте JSON после важных изменений.</p><div class="grid cols-3">${stat('Клиенток',state.clients.length)}${stat('Тренировок',state.clients.reduce((s,c)=>s+c.workouts.length,0))}${stat('Упражнений',baseExercises.length)}</div></div>`;}
window.exportData=function(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='FemFit_Diary_backup_'+todayISO()+'.json'; a.click(); URL.revokeObjectURL(a.href);};
window.importData=function(ev){const f=ev.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{try{state=merge(defaultState(),JSON.parse(r.result)); save(); initNav(); renderAll(); show(state.currentSection||'today'); toast('Импортировано');}catch(e){alert('Не удалось импортировать JSON')}}; r.readAsText(f);};
window.resetData=function(){if(!confirm('Сбросить все локальные данные?'))return; StorageService._clear(); state=defaultState(); ensureDemoData(); initNav(); show('onboarding');};
window.goBack=function(){var prev=navHistory.pop(); show(prev||'today', true);};
function showModal(html){$('modalCard').innerHTML='<button class="backbtn modal-back" type="button" aria-label="Вернуться назад" onclick="closeModal()">← Назад</button>'+html; applyI18n($('modalCard'));$('modal').classList.add('show');}
window.closeModal=function(){$('modal').classList.remove('show'); renderAll();};
$('modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});

/* ===== v1.4 additions ===== */
function zoneHex(z){return z==='Зелёная'?'#5f9072':z==='Жёлтая'?'#bb8f3f':z==='Оранжевая'?'#c47c4e':z==='Красная'?'#c25e66':'#6f89a7'}
function hint(t){return `<span class="hint" tabindex="0" role="img" data-tip="${esc(t)}" aria-label="${esc(t)}">?</span>`}
function readinessRing(score,zone){const r=82,c=2*Math.PI*r,s=Math.max(0,Math.min(100,Number(score)||0)),off=c*(1-s/100);return `<div class="ring"><svg viewBox="0 0 200 200"><circle class="ring-track" cx="100" cy="100" r="${r}"/><circle class="ring-arc" cx="100" cy="100" r="${r}" stroke="${zoneHex(zone)}" stroke-dasharray="${c.toFixed(1)}" style="--circ:${c.toFixed(1)};--off:${off.toFixed(1)}"/></svg><div class="ring-center"><span class="ring-num">${s}</span><span class="ring-unit">индекс готовности</span><span class="zone ${zoneClass(zone)}">${zone}</span></div></div>`}
function cycleRing(c){const len=Math.max(20,Number(c.cycleLength||28)),men=Math.max(2,Number(c.menstruationLength||5));const ci=cycleInfo(todayISO(),c);const day=typeof ci.day==='number'?ci.day:1;const R=82,C=2*Math.PI*R;const ov0=Math.min(len-2,12),ov1=Math.min(len-1,16);const segs=[[0,Math.min(men,len),'#c25e66'],[men,ov0,'#6f938a'],[ov0,ov1,'#c2a36b'],[ov1,len,'#9d5e78']];const arcs=segs.filter(s=>s[1]>s[0]).map(([a,b,col])=>{const st=a/len,f=(b-a)/len;return `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${col}" stroke-width="15" stroke-dasharray="${(f*C).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-st*C).toFixed(1)}"/>`}).join('');const ang=(day/len)*2*Math.PI-Math.PI/2,mx=100+R*Math.cos(ang),my=100+R*Math.sin(ang);return `<div class="ring cycle-ring"><svg viewBox="0 0 200 200"><g transform="rotate(-90 100 100)">${arcs}</g><circle class="cycle-marker" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="9"/></svg><div class="ring-center"><span class="ring-num">${day}</span><span class="ring-unit">день цикла</span><span class="phase-tag">${esc(ci.phase)}</span></div></div>`}
function cycleLegend(){return `<div class="cyclegend"><span><i style="background:#c25e66"></i>менструальная</span><span><i style="background:#6f938a"></i>фолликулярная</span><span><i style="background:#c2a36b"></i>овуляторное окно</span><span><i style="background:#9d5e78"></i>лютеиновая</span></div>`}
function menoPanel(c){const last=latestCheckin(c)||{};const fem=Number(last.femaleSymptoms||0);const note=c.mode==='peri'?'Цикл нерегулярный — фаза не рассчитывается. Решение по нагрузке опирается на сон, приливы, боль и восстановление.':'Менструальный цикл завершён. Приоритет — сила, мышечная масса, костная плотность, баланс и метаболическое здоровье.';return `<div class="card hero"><div class="ringwrap">${readinessRing(readinessScore(c),readinessZone(readinessScore(c)))}<div style="flex:1;min-width:200px"><h2 style="margin-bottom:6px">${modes[c.mode]}</h2><p>${note}</p><div class="divider"></div><p class="small"><b>Симптомы сегодня:</b> ${fem}/10 ${fem>=6?'— выраженные, не усиливать интервальную нагрузку':fem>=3?'— умеренные':'— лёгкие'}</p></div></div></div>`}

/* --- session summary (Итог тренировки) --- */
function summaryMeta(st){return st==='done'?['done','Выполнено']:st==='partial'?['partial','Частично']:st==='skipped'?['skipped','Пропущено']:['none','Итог не внесён']}
function summaryBadge(w){const m=summaryMeta(w.summary&&w.summary.status);return `<span class="summary-badge ${m[0]}">${m[1]}</span>`}
window.openSummary=function(id){const w=client().workouts.find(x=>x.id===id);if(!w)return;if(!w.summary)w.summary={status:'',feelAfter:'',painAfter:'',fatigueAfter:'',comment:''};showModal(summaryEditor(w))};
function summaryEditor(w){const s=w.summary||{};const opt=(v,l)=>`<option value="${v}" ${s.status===v?'selected':''}>${l}</option>`;return `<h2>Итог тренировки</h2><p class="muted small">${esc(w.title)} • ${esc(w.date)}</p><div class="input-grid" style="grid-template-columns:1fr 1fr;margin-top:14px"><div class="field"><label>Как прошла</label><select onchange="updateSummary('${w.id}','status',this.value)"><option value="">—</option>${opt('done','Выполнено')}${opt('partial','Частично')}${opt('skipped','Пропущено')}</select></div><div class="field"><label>Самочувствие после (1–5)</label><input type="number" min="1" max="5" value="${esc(s.feelAfter)}" onchange="updateSummary('${w.id}','feelAfter',this.value)"></div><div class="field"><label>Боль после (0–10) ${hint('0 — боли нет, 10 — максимально переносимая. Боль ≥6 — повод остановиться и оценить очно.')}</label><input type="number" min="0" max="10" value="${esc(s.painAfter)}" onchange="updateSummary('${w.id}','painAfter',this.value)"></div><div class="field"><label>Итоговая усталость (1–5)</label><input type="number" min="1" max="5" value="${esc(s.fatigueAfter)}" onchange="updateSummary('${w.id}','fatigueAfter',this.value)"></div><div class="field" style="grid-column:1/-1"><label>Комментарий</label><textarea onchange="updateSummary('${w.id}','comment',this.value)">${esc(s.comment||'')}</textarea></div></div><div class="card soft" style="margin-top:16px">${workoutOutcome(w)}</div><div class="toolbar" style="justify-content:flex-start;margin-top:16px"><button class="btn green" onclick="closeModal()">Сохранить итог</button></div>`}
window.updateSummary=function(id,k,v){const w=client().workouts.find(x=>x.id===id);if(!w)return;if(!w.summary)w.summary={};w.summary[k]=v;save()};

/* --- drawer + tabbar --- */
window.toggleDrawer=function(){document.getElementById('app').classList.toggle('drawer-open')};
window.closeDrawer=function(){document.getElementById('app').classList.remove('drawer-open')};
const tabIcons={today:'◷',readiness:'◔',dashboard:'❤',log:'✎',progress:'📈',pro:'❤',report:'✦',library:'🗂',female:'♀',more:'…'};
function buildTabbar(){const tb=$('tabbar');if(!tb)return;const items=state.role==='pro'?[['pro','Участницы'],['report','Отчёт'],['progress','Прогресс'],['library','Тренировки']]:[['today','Сегодня'],['library','Тренировки'],['progress','Прогресс'],['female','Цикл']];const cur=state.currentSection;tb.innerHTML=items.map(([id,label])=>`<button class="${cur===id?'active':''}" onclick="show('${id}')"><span class="ic">${tabIcons[id]||'•'}</span>${navLabel(id,label)}</button>`).join('')+`<button class="${cur==='more'?'active':''}" onclick="show('more')"><span class="ic">…</span>${t('nav_more')}</button>`}
function syncTabbar(){const tb=$('tabbar');if(!tb)return;tb.querySelectorAll('button').forEach(b=>b.classList.remove('active'));}

function renderMore(){const c=client(); const item=(label,sub,act,ev)=>`<div class="lib-card" style="cursor:pointer" tabindex="0" role="button" ${ev?`data-event="${ev}"`:''} onclick="${act}" onkeydown="if(event.key==='Enter'){${act}}"><h4>${label}</h4><p class="small muted" style="margin:4px 0 0">${sub}</p></div>`; $('more').innerHTML=top('more','Ещё','Профиль, программы, дневник, данные и документы — всё второстепенное в одном месте.')+`<div class="grid cols-3">
 ${item('Профиль участницы','Имя, цель, уровень, ограничения',"show('profile')")}
 ${item('Программы','12-недельные программы под режим',"show('programs')",'program_select')}
 ${item('Мой план','Неделя, план и следующая тренировка',"show('plan')")}
 ${item('Готовность','Чек-ин перед тренировкой',"show('readiness')",'readiness_start')}
 ${item('Дневник тренировок','История и фиксация подходов',"show('log')")}
 ${item('Библиотека тренировок','Каталог и упражнения',"show('library')",'workout_library_open')}
 ${item('Флаги безопасности','Когда остановиться и к врачу',"show('redflags')")}
 ${item('Данные','Экспорт, импорт и сброс',"show('data')")}
 ${item('Обучение','Техника, RPE, цикл, безопасность',"show('learn')")}
 ${item('Инструкции ↗','Как пользоваться дневником',"window.open('guide.html','_blank')",'guide_click')}
 ${item('Документы ↗','Приватность и дисклеймер',"window.open('legal.html','_blank')",'legal_click')}
</div><div class="card" style="margin-top:18px"><div class="kicker">${t('lang_label')} · RU / KZ / EN</div><div class="row-actions" style="justify-content:flex-start;margin-top:10px"><button class="btn ${lang()==='ru'?'primary':''} smallbtn" onclick="setLang('ru')" data-event="language_change">RU</button><button class="btn ${lang()==='kk'?'primary':''} smallbtn" onclick="setLang('kk')" data-event="language_change">KZ</button><button class="btn ${lang()==='en'?'primary':''} smallbtn" onclick="setLang('en')" data-event="language_change">EN</button></div><p class="small muted" style="margin-top:8px">Каркас перевода интерфейса. Казахская и английская версии будут профессионально отредактированы.</p></div><div class="card soft" style="margin-top:18px"><h3 style="font-size:16px">Режим</h3><p class="small">Переключение «Участница / Специалист» — вверху слева. Специалисту доступны кабинет участниц и отчёты.</p></div>`;}
function learnCard(icon,title,desc,media,link){return `<div class="card"><div style="display:flex;gap:12px;align-items:flex-start"><div style="width:40px;height:40px;border-radius:11px;display:grid;place-items:center;background:var(--plum-soft);color:var(--plum);font-size:18px;flex:none">${icon}</div><div><h3 style="margin:0 0 4px;font-size:17px">${title}</h3><p class="small muted" style="margin:0">${desc}</p></div></div><div role="img" aria-label="${esc(title)}: обучающее изображение или видео появится позже" data-img="${media}" style="margin-top:12px;height:118px;border:1px dashed var(--line);border-radius:14px;background:var(--panel2);display:grid;place-items:center;color:var(--muted);font-size:13px;text-align:center;padding:10px;line-height:1.4">Изображение или видео<br>появится позже</div>${link?`<div class="row-actions" style="justify-content:flex-start;margin-top:10px">${link}</div>`:''}</div>`;}

/* ===== exercise methodology library — СТРУКТУРА (контент пишет отдельный эксперт) =====
   exerciseLibrary строится из baseExercises: короткая техника/ошибки/регрессия/прогрессия переносятся,
   а fullMethodology и медиа остаются пустыми под наполнение.
   TODO: подключить методические карточки упражнений FemFit Diary (fullMethodology).
   TODO: подключить изображения упражнений (imageUrl).
   TODO: подключить обучающие видео (videoUrl) и mediaLibrary. */
const exerciseLibrary=baseExercises.map(e=>({ id:e.id, title:e.name, category:'', movementPattern:e.pattern||'', level:e.level||'', equipment:e.equipment||'', shortCue:e.tech||'', fullMethodology:'', commonMistakes:e.errors||'', regressions:e.reg||'', progressions:e.prog||'', limitations:e.caution||'', imageUrl:'', videoUrl:'' }));
const mediaLibrary=[]; /* {id,type:'image'|'video',title,description,url,thumbnail,relatedExerciseId,language,duration,safetyNote} */
window.exerciseLibrary=exerciseLibrary; window.mediaLibrary=mediaLibrary;

function exerciseReferenceHTML(){
  const groups={}; exerciseLibrary.forEach(e=>{(groups[e.movementPattern||'Другое']=groups[e.movementPattern||'Другое']||[]).push(e);});
  const order=['Коленно-доминантный','Тазово-доминантный','Горизонтальный жим','Горизонтальная тяга','Вертикальный жим','Вертикальная тяга','Кор','ВПН/лопатка','Переноски','Баланс','Кардио'];
  const keys=Object.keys(groups).sort((a,b)=>{const ia=order.indexOf(a),ib=order.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib);});
  return `<div class="card" style="margin-top:18px"><div class="kicker">Справочник упражнений</div><p class="small muted" style="margin:4px 0 10px">Краткая техника, частые ошибки, регрессия и прогрессия по двигательным паттернам.</p>${keys.map(k=>`<details class="exgroup"><summary>${esc(k)} <span class="muted">(${groups[k].length})</span></summary><div class="exlist">${groups[k].map(e=>`<button type="button" class="exitem" onclick="openExerciseInfo('${e.id}')">${esc(e.title)}</button>`).join('')}</div></details>`).join('')}</div>`;
}
window.openExerciseInfo=function(id){ const e=exerciseLibrary.find(x=>x.id===id); if(!e)return;
  const tags=`<span class="tag">${esc(e.movementPattern||'')}</span>${e.level?`<span class="tag">${esc(e.level)}</span>`:''}${e.equipment?`<span class="tag">${esc(e.equipment)}</span>`:''}`;
  const media=`<div class="ex-media"><div class="ex-slot" role="img" aria-label="Изображение упражнения">${e.imageUrl?`<img src="${e.imageUrl}" alt="${esc(e.title)}">`:'<span class="ex-slot-ic" aria-hidden="true">▦</span>'}</div><div class="ex-slot" aria-label="Видео упражнения">${e.videoUrl?`<video src="${e.videoUrl}" controls></video>`:'<span class="ex-slot-ic" aria-hidden="true">►</span>'}</div></div>`;
  const sect=(label,val)=> val?`<div class="ex-sect"><h4>${label}</h4><p class="small">${esc(val)}</p></div>`:'';
  const body=`<h2 style="margin-bottom:6px">${esc(e.title)}</h2><div class="tagline">${tags}</div>${media}${sect('Техника — коротко',e.shortCue)}${sect('Полная методика',e.fullMethodology)}${sect('Частые ошибки',e.commonMistakes)}${sect('Регрессия',e.regressions)}${sect('Прогрессия',e.progressions)}${sect('Кому с осторожностью',e.limitations)}`;
  showModal(body);
};

function renderLearn(){
 /* TODO: подключить библиотеку изображений упражнений. */
 /* TODO: подключить обучающие видео по технике упражнений. */
 /* TODO: добавить видеоинструкции по RPE/RIR, циклу, кардио, стретчингу и мобилити. */
 $('learn').innerHTML=top('learn','Обучение','Короткие материалы по технике, нагрузке и безопасности. Изображения и видео добавим позже — без обещаний лечения и «идеального тела».')+`<div class="grid cols-2">
 ${learnCard('▦','Техника упражнений','Как выполнять базовые движения безопасно и эффективно.','/assets/img/technique.webp',`<button class="btn smallbtn" onclick="show('library')" data-event="workout_library_open">Библиотека</button>`)}
 ${learnCard('◔','Как оценивать RPE и RIR','Усилие подхода и запас повторов — чтобы дозировать нагрузку без отказа.','/assets/img/rpe-rir.webp',`<a class="btn smallbtn" href="guide.html" target="_blank" rel="noopener" data-event="guide_click">Инструкция ↗</a>`)}
 ${learnCard('✎','Как вести дневник','Готовность → тренировка → фиксация → итог → прогресс.','/assets/img/diary.webp',`<button class="btn smallbtn" onclick="show('today')" data-event="start_today_click">К сегодняшнему дню</button>`)}
 ${learnCard('♀','Как читать цикл','Фаза — контекст самочувствия, решение принимает готовность.','/assets/img/cycle-strength.webp',`<button class="btn smallbtn" onclick="show('female')" data-event="cycle_open">Раздел «Цикл»</button>`)}
 ${learnCard('❤','Кардио Zone 2','Умеренный разговорный темп, RPE 5–6, для метаболического здоровья.','/assets/img/treadmill-zone2.webp',`<button class="btn smallbtn" onclick="show('library')">Кардио в библиотеке</button>`)}
 ${learnCard('≈','Мобилити и стретчинг','Мягко, без боли, без попытки «продавить» амплитуду.','/assets/img/mobility.webp',`<button class="btn smallbtn" onclick="show('library')">Комплексы</button>`)}
 ${learnCard('☾','Тренировки в перименопаузе','Силовая основа, умеренное кардио, контроль восстановления.','/assets/img/perimenopause-strength.webp','')}
 ${learnCard('☀','Тренировки в постменопаузе','Сила, баланс и профилактика падений, осевая нагрузка с осторожностью.','/assets/img/postmenopause-balance.webp','')}
 ${learnCard('!','Сигналы безопасности','Когда остановить тренировку и обратиться к специалисту.','/assets/img/safety.webp',`<button class="btn smallbtn" onclick="show('redflags')">Красные флаги</button>`)}
 </div>${exerciseReferenceHTML()}<div class="card soft" style="margin-top:18px"><p class="small">Материалы носят образовательный характер и не заменяют консультацию врача, физиотерапевта, реабилитолога или очную оценку тренера. Без обещаний лечения, похудения или «идеального тела».</p></div>`;
}

/* ===== training picker wizard v2.0 ===== */
window.pickStep=1; window.pickFeel=null; window.pickPainZone=null; window.pickType='auto'; window.pickTime=30; window.pickRec=null;
const FEELS=[['good','Хорошо, готова тренироваться'],['medium','Средне, хочу умеренную нагрузку'],['tired','Устала, нужен мягкий вариант'],['pain','Есть боль или дискомфорт']];
const PAINZONES=['колено','поясница','плечо','тазобедренный','голеностоп','другое'];
const WANTS=[['auto','Подберите за меня'],['силовая','Силовая'],['кардио','Кардио'],['мобилити','Мобилити'],['стретчинг','Стретчинг'],['восстановление','Восстановление']];
const TIMES=[15,30,45,60];

window.openTrainingPicker=function(){window.pickStep=1;window.pickFeel=null;window.pickPainZone=null;window.pickType='auto';window.pickTime=30;window.pickRec=null;showModal(pickerHTML());};
window.pickSet=function(field,val){window[field]=val; if(field==='pickFeel'&&val!=='pain')window.pickPainZone=null; showModal(pickerHTML());};
window.pickNav=function(step){window.pickStep=step; showModal(pickerHTML());};
window.pickToResult=function(){window.pickRec=buildRec(client()); window.pickStep=4; showModal(pickerHTML());};

function optBtn(field,val,label,active){return `<button type="button" class="choice ${active?'active':''}" style="text-align:left" onclick="pickSet('${field}','${val}')"><h3 style="font-size:15px;margin:0">${label}</h3></button>`;}

function pickerHTML(){
 const step=window.pickStep;
 if(step===4)return resultHTML();
 let body='',navHTML='';
 if(step===1){
   body=`<h2>Как вы сегодня себя чувствуете?</h2><div class="choice-grid" style="margin-top:14px">${FEELS.map(([v,l])=>optBtn('pickFeel',v,l,window.pickFeel===v)).join('')}</div>`;
   if(window.pickFeel==='pain'){ body+=`<div class="divider"></div><h3 style="font-size:16px">Где дискомфорт?</h3><div class="choice-grid" style="margin-top:10px">${PAINZONES.map(z=>`<button type="button" class="choice ${window.pickPainZone===z?'active':''}" style="text-align:left" onclick="pickSet('pickPainZone','${z}')"><h3 style="font-size:15px;margin:0">${z}</h3></button>`).join('')}</div><div class="card soft" style="margin-top:12px"><p class="small">При выраженной боли лучше выбрать восстановление и обратиться к специалисту. Дневник не ставит диагнозы.</p></div>`; }
   navHTML=`<button class="btn" onclick="closeModal()">Отмена</button><button class="btn primary" ${window.pickFeel?'':'disabled'} onclick="pickNav(2)">Далее</button>`;
 } else if(step===2){
   body=`<h2>Что вы хотите сегодня?</h2><p class="muted small" style="margin-top:-2px">По умолчанию подберём за вас.</p><div class="choice-grid" style="margin-top:14px">${WANTS.map(([v,l])=>optBtn('pickType',v,l,window.pickType===v)).join('')}</div>`;
   navHTML=`<button class="btn" onclick="pickNav(1)">Назад</button><button class="btn primary" onclick="pickNav(3)">Далее</button>`;
 } else {
   body=`<h2>Сколько времени есть?</h2><div class="choice-grid" style="margin-top:14px">${TIMES.map(t=>`<button type="button" class="choice ${window.pickTime===t?'active':''}" style="text-align:left" onclick="pickSet('pickTime',${t})"><h3 style="font-size:15px;margin:0">${t} минут</h3></button>`).join('')}</div>`;
   navHTML=`<button class="btn" onclick="pickNav(2)">Назад</button><button class="btn primary" onclick="pickToResult()">Показать тренировку</button>`;
 }
 const dots=[1,2,3].map(n=>`<span style="width:${n===step?'24px':'8px'};height:8px;border-radius:999px;background:${n<=step?'var(--plum)':'var(--line)'};display:inline-block"></span>`).join(' ');
 return `<h2 style="margin-bottom:4px">Подобрать тренировку</h2><div style="display:flex;gap:6px;align-items:center;margin-bottom:16px">${dots}<span class="muted small" style="margin-left:auto">Шаг ${step} из 3</span></div>${body}<div class="toolbar" style="justify-content:space-between;margin-top:18px">${navHTML}</div>`;
}

function recExercises(c,count){
 const ses=nextSession(c);
 let base;
 if(ses&&(ses.kind||'strength')==='strength'&&ses.exercises&&ses.exercises.length){ base=ses.exercises.map(e=>({exerciseId:e.exerciseId,name:e.name,pattern:e.pattern})); }
 else { base=SB.FB_A.ids.map(id=>{const ex=baseExercises.find(x=>x.id===id);return {exerciseId:id,name:ex?ex.name:id,pattern:ex?ex.pattern:''};}); }
 return base.slice(0,count);
}
function effZone(c){const rank={'Зелёная':0,'Жёлтая':1,'Оранжевая':2,'Красная':3};const rz=readinessZone(readinessScore(c));const fz={good:'Зелёная',medium:'Жёлтая',tired:'Оранжевая',pain:'Оранжевая'}[window.pickFeel||'good'];return (rank[rz]>=rank[fz])?rz:fz;}
function autoKind(c,zone){const b=weekBalance(c); if(zone==='Зелёная'||zone==='Жёлтая'){ if(b.strength<3)return 'strength'; if(b.cardio<2)return 'cardio'; if(b.mobility<2)return 'mobility'; return 'strength';} return 'mobility';}
function wantKind(w){return {'силовая':'strength','кардио':'cardio','мобилити':'mobility','стретчинг':'stretch','восстановление':'recovery'}[w]||'strength';}
function libByKind(kind){const map={cardio:'tl_tread2',mobility:'tl_mobhip',stretch:'tl_strhams',recovery:'tl_recday',balance:'tl_balance'};return trainingLibrary.find(x=>x.id===map[kind])||trainingLibrary.find(x=>x.kind===kind);}
function buildRec(c){
 const zone=effZone(c); const minutes=Number(window.pickTime||30); const count=minutes<=15?3:minutes<=30?4:5;
 let kind; const want=window.pickType||'auto';
 if(zone==='Красная')kind='recovery';
 else if(zone==='Оранжевая')kind=(want==='кардио'?'cardio':'mobility');
 else kind=(want==='auto'?autoKind(c,zone):wantKind(want));
 const rec={kind,minutes,level:c.level||'Новичок',zone,reasons:[]};
 if(kind==='strength'){ rec.title='Силовая Fullbody'; rec.rpe=(zone==='Жёлтая'?'6':'7'); rec.sets=(zone==='Жёлтая'?2:3); rec.exercises=recExercises(c,count); rec.track=['вес','повторы','RPE','боль']; }
 else { const li=libByKind(kind)||{name:kindLabel(kind),rpe:'3',goal:''}; rec.title=li.name; rec.rpe=li.rpe||'3'; rec.goal=li.goal||''; rec.track=(kind==='cardio'?['минуты','RPE','самочувствие']:(kind==='recovery'?['минуты','самочувствие']:['минуты','зона','ощущение'])); }
 const b=weekBalance(c);
 rec.reasons.push('Готовность: '+String(zone).toLowerCase()+' зона');
 if(b.strength<3&&kind==='strength')rec.reasons.push('На этой неделе не хватает силовой нагрузки');
 if(b.cardio<2&&kind==='cardio')rec.reasons.push('На этой неделе мало кардио');
 if(window.pickFeel==='pain')rec.reasons.push('Вы отметили дискомфорт'+(window.pickPainZone?' ('+window.pickPainZone+')':'')+' — нагрузка мягче');
 if(zone==='Зелёная')rec.reasons.push('Признаков перегрузки не отмечено');
 if(zone==='Красная')rec.reasons.push('Сегодня лучше восстановиться; при сигналах безопасности — к специалисту');
 return rec;
}

function resultHTML(){const r=window.pickRec; if(!r)return '<p>Не удалось подобрать. Попробуйте ещё раз.</p><div class="toolbar"><button class="btn" onclick="pickNav(1)">Заново</button></div>';
 const tags=`<span class="tag" style="background:${kindColor(r.kind)};color:#fff;border-color:transparent">${kindLabel(r.kind)}</span><span class="tag">${r.minutes} мин</span><span class="tag">${esc(r.level)}</span><span class="tag">RPE ${esc(r.rpe)}</span>`;
 let plan = (r.kind==='strength') ? `<ul class="reclist">${r.exercises.map(e=>`<li>${esc(e.name)} — ${r.sets}×8–10</li>`).join('')}</ul>` : `<p class="small muted" style="margin-top:6px">${esc(r.goal||(kindLabel(r.kind)+' '+r.minutes+' минут в спокойном темпе.'))}</p>`;
 const track=`<p class="small" style="margin-top:8px"><b>Что отслеживать:</b> ${r.track.join(', ')}</p>`;
 const why=`<details class="whybox"><summary>Почему эта тренировка?</summary><ul class="reclist">${r.reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`;
 return `<h2 style="margin-bottom:4px">Ваша тренировка на сегодня</h2><div class="card soft" style="margin-top:10px"><h3 style="font-size:19px;margin:0 0 8px">${esc(r.title)} · ${r.minutes} минут</h3><div class="tagline">${tags}</div>${plan}${track}</div>
 <div class="row-actions" style="justify-content:flex-start;margin-top:14px"><button class="btn primary" onclick="startRec()" data-event="workout_start">Начать тренировку</button><button class="btn" onclick="simplerRec()">Сделать проще</button></div>
 <div class="row-actions" style="justify-content:flex-start;margin-top:8px"><button class="btn ghost smallbtn" onclick="swapRec('кардио')">Заменить на кардио</button><button class="btn ghost smallbtn" onclick="swapRec('восстановление')">Заменить на восстановление</button><button class="btn ghost smallbtn" onclick="pickNav(2)">Выбрать другой</button></div>
 <div style="margin-top:12px">${why}</div>`;
}
function recToWorkout(c,r){ let exercises=[]; if(r.kind==='strength'){ exercises=r.exercises.map(e=>({exerciseId:e.exerciseId,name:e.name,pattern:e.pattern,target:r.sets+'×8–10',sets:Array.from({length:r.sets},(_,i)=>({id:uid(),set:i+1,reps:'',weight:'',rpe:'',rir:'',pain:'',comment:''}))})); } const plan=(r.kind!=='strength')?`${kindLabel(r.kind)} · ${r.minutes} мин · RPE ${r.rpe}. ${r.goal||''}`:''; return {id:uid(),date:todayISO(),title:r.title,kind:r.kind,mode:c.mode,cycle:cycleInfo(todayISO(),c),readiness:{score:readinessScore(c),zone:readinessZone(readinessScore(c))},summary:{status:'',feelAfter:'',painAfter:'',fatigueAfter:'',comment:''},notes:plan||('Подобрано мастером. Отслеживать: '+r.track.join(', ')),exercises};}
window.startRec=function(){const c=client(); const r=window.pickRec; if(!r)return; const w=recToWorkout(c,r); c.workouts.unshift(w); save(); closeModal(); if(w.exercises.length){show('log'); editWorkout(w.id);} else {show('log'); toast('Тренировка добавлена — запишите итог после выполнения');}};
window.simplerRec=function(){const r=window.pickRec; if(!r)return; if(r.kind==='strength'){ r.exercises=r.exercises.slice(0,3); r.sets=Math.max(2,(r.sets||3)-1); r.rpe='6'; if(!/^Мягкая/.test(r.title))r.title='Мягкая '+r.title; r.reasons.push('Упрощено: меньше упражнений и подходов, ниже RPE'); } else { r.minutes=Math.max(10,(r.minutes||20)-5); r.reasons.push('Упрощено: короче по времени'); } showModal(resultHTML());};
window.swapRec=function(want){const c=client(); window.pickType=want; window.pickRec=buildRec(c); showModal(resultHTML());};

function renderSection(id){const map={onboarding:renderOnboarding,dashboard:renderDashboard,profile:renderProfile,female:renderFemale,readiness:renderReadiness,programs:renderPrograms,today:renderToday,log:renderLog,sets:renderSets,progress:renderProgress,library:renderLibrary,pro:renderPro,report:renderReport,redflags:renderRedflags,data:renderData,more:renderMore,learn:renderLearn,plan:renderPlan}; if(map[id])map[id](); updateSide();}
function renderAll(){const active=document.querySelector('.section.active')?.id||state.currentSection; if(active){renderSection(active);applyI18n($(active));} updateSide();}
try{var _fl=StorageService.getLangPref(); if(_fl&&translations[_fl])state.language=_fl;}catch(e){}
initNav(); updateSide(); show(state.currentSection || (client().onboardingDone?'today':'onboarding'));
})();
