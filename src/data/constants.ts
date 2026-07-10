// Static demo data matching the HTML prototype
// Used for display throughout the app

export const NURSES = [
  {id:'n1',emp:'N-1042',name:'Rana Khalil',dept:'ICU',unit:'ICU-A',title:'Staff Nurse',sup:'Hala Mansour',hire:'2023-05-14',status:'Active',license:'RN-88231',specialty:'Critical Care',email:'r.khalil@hospital.org',phone:'+961 3 555 210',assigned:5,done:3,overdue:0,avg:88,time:'14h 20m',lastLogin:'2026-07-06 08:12',lastAct:'Watched: Hand Hygiene video'},
  {id:'n2',emp:'N-0977',name:'Jana Saab',dept:'ICU',unit:'ICU-A',title:'Staff Nurse',sup:'Hala Mansour',hire:'2022-02-01',status:'Active',license:'RN-77120',specialty:'Critical Care',email:'j.saab@hospital.org',phone:'+961 3 555 211',assigned:5,done:5,overdue:0,avg:94,time:'16h 05m',lastLogin:'2026-07-05 19:40',lastAct:'Completed: BLS Recertification quiz'},
  {id:'n3',emp:'N-1130',name:'Karim Awada',dept:'ICU',unit:'ICU-B',title:'Charge Nurse',sup:'Hala Mansour',hire:'2021-09-20',status:'Active',license:'RN-66019',specialty:'Critical Care',email:'k.awada@hospital.org',phone:'+961 3 555 212',assigned:5,done:2,overdue:1,avg:71,time:'8h 40m',lastLogin:'2026-07-02 14:03',lastAct:'Opened: Sepsis Bundle policy'},
  {id:'n4',emp:'N-1201',name:'Aya Merhi',dept:'ICU',unit:'ICU-B',title:'Staff Nurse',sup:'Hala Mansour',hire:'2024-11-03',status:'Active',license:'RN-91456',specialty:'Critical Care',email:'a.merhi@hospital.org',phone:'+961 3 555 213',assigned:6,done:1,overdue:2,avg:64,time:'5h 15m',lastLogin:'2026-06-28 10:55',lastAct:'Quiz attempt: Medication Safety (failed)'},
  {id:'n5',emp:'N-0844',name:'Sara Dib',dept:'ER',unit:'ER Triage',title:'Staff Nurse',sup:'Samer Itani',hire:'2020-06-15',status:'Active',license:'RN-55672',specialty:'Emergency',email:'s.dib@hospital.org',phone:'+961 3 555 214',assigned:4,done:4,overdue:0,avg:91,time:'12h 30m',lastLogin:'2026-07-06 07:30',lastAct:'Downloaded certificate: Triage Essentials'},
  {id:'n6',emp:'N-1055',name:'Hadi Kanso',dept:'ER',unit:'ER Observation',title:'Staff Nurse',sup:'Samer Itani',hire:'2023-01-10',status:'Active',license:'RN-83321',specialty:'Emergency',email:'h.kanso@hospital.org',phone:'+961 3 555 215',assigned:4,done:2,overdue:1,avg:76,time:'7h 55m',lastLogin:'2026-07-04 22:10',lastAct:'Watched 40% of ACLS Update video'},
  {id:'n7',emp:'N-0710',name:'Maya Fares',dept:'PED',unit:'NICU',title:'Senior Nurse',sup:'Dana Hoteit',hire:'2019-03-25',status:'Active',license:'RN-44510',specialty:'Neonatal',email:'m.fares@hospital.org',phone:'+961 3 555 216',assigned:5,done:5,overdue:0,avg:97,time:'15h 45m',lastLogin:'2026-07-05 16:20',lastAct:'Submitted course evaluation'},
  {id:'n8',emp:'N-1188',name:'Tarek Osman',dept:'OR',unit:'OR Main',title:'Scrub Nurse',sup:'Rima Saad',hire:'2024-04-08',status:'Active',license:'RN-90233',specialty:'Perioperative',email:'t.osman@hospital.org',phone:'+961 3 555 217',assigned:5,done:2,overdue:2,avg:69,time:'6h 10m',lastLogin:'2026-06-30 09:15',lastAct:'Acknowledged: Surgical Count policy'},
  {id:'n9',emp:'N-0933',name:'Nadine Chehab',dept:'MED',unit:'Med 3F',title:'Staff Nurse',sup:'Nour Fakih',hire:'2022-08-22',status:'On leave',license:'RN-72001',specialty:'Med-Surg',email:'n.chehab@hospital.org',phone:'+961 3 555 218',assigned:4,done:1,overdue:1,avg:80,time:'4h 05m',lastLogin:'2026-06-12 11:00',lastAct:'Read: Falls Prevention document'},
  {id:'n10',emp:'N-1215',name:'Zeina Hamdan',dept:'SUR',unit:'Surg 5F',title:'New Hire',sup:'Ali Zein',hire:'2026-06-01',status:'Active',license:'RN-95102',specialty:'Med-Surg',email:'z.hamdan@hospital.org',phone:'+961 3 555 219',assigned:6,done:1,overdue:0,avg:85,time:'3h 30m',lastLogin:'2026-07-06 09:02',lastAct:'Started: New Nurse Orientation'},
]

export const COURSES = [
  {id:'c1',code:'IC-101',title:'Hand Hygiene & Infection Control',category:'Infection Control',status:'active',mandatory:true,level:'Core',lang:'English / العربية',duration:'2h 30m',audience:'All nurses',instructor:'Dr. Lina Khoury',prerequisites:'None',thumbnail_color:'linear-gradient(135deg,#0B5D66,#1B8A8F)',thumbnail_icon:'🧼',deadline:'2026-07-20',pass_rule:'80%',
   objectives:['Apply WHO 5 Moments of hand hygiene','Select correct PPE per isolation type','Comply with hospital infection control policy IC-P-04'],
   completion_rules:['Watch required video (≥90%)','Read & acknowledge policy document','Pass quiz (≥80%)','Complete course evaluation']},
  {id:'c2',code:'ES-110',title:'Fire Safety & Emergency Codes',category:'Emergency Response',status:'active',mandatory:true,level:'Core',lang:'English',duration:'1h 45m',audience:'All nurses',instructor:'Safety Office',prerequisites:'None',thumbnail_color:'linear-gradient(135deg,#B3432B,#D9764A)',thumbnail_icon:'🚨',deadline:'2026-08-15',pass_rule:'80%',objectives:[],completion_rules:[]},
  {id:'c3',code:'MS-204',title:'High-Alert Medication Safety',category:'Medication Safety',status:'active',mandatory:true,level:'Intermediate',lang:'English',duration:'3h',audience:'All nurses',instructor:'Pharmacy / Dr. Khoury',prerequisites:'IC-101',thumbnail_color:'linear-gradient(135deg,#B97A25,#D9A34A)',thumbnail_icon:'💊',deadline:'2026-09-30',pass_rule:'80%',objectives:[],completion_rules:[]},
  {id:'c4',code:'NNO-100',title:'New Nurse Orientation — Hospital Systems',category:'Orientation',status:'active',mandatory:true,level:'Core',lang:'English / العربية',duration:'6h',audience:'New hires',instructor:'Nursing Education',prerequisites:'None',thumbnail_color:'linear-gradient(135deg,#2B5FA3,#4E86C9)',thumbnail_icon:'🏥',deadline:'30 days from hire',pass_rule:'80%',objectives:[],completion_rules:[]},
  {id:'c5',code:'ICU-310',title:'ICU: Sepsis Bundle & Early Recognition',category:'ICU Training',status:'active',mandatory:false,level:'Advanced',lang:'English',duration:'4h',audience:'ICU nurses',instructor:'Dr. Lina Khoury',prerequisites:'IC-101, MS-204',thumbnail_color:'linear-gradient(135deg,#4B2E83,#7E5BB5)',thumbnail_icon:'🫀',deadline:'2026-11-30',pass_rule:'85%',objectives:[],completion_rules:[]},
  {id:'c6',code:'PS-115',title:'Falls Prevention Update 2026',category:'Patient Safety',status:'draft',mandatory:true,level:'Core',lang:'English',duration:'1h',audience:'All nurses',instructor:'Quality Dept.',prerequisites:'None',thumbnail_color:'linear-gradient(135deg,#2E7D5B,#55A87F)',thumbnail_icon:'🛡️',deadline:'—',pass_rule:'80%',objectives:[],completion_rules:[]},
]

export const PROGRAMS = [
  {id:'p1',title:'Mandatory Annual Training 2026',code:'MAT-2026',category:'Mandatory Annual Training',mandatory:true,status:'active',start_date:'2026-01-01',end_date:'2026-12-31',deadline:'2026-09-30',duration:'12h',audience:'All nurses',dept_scope:'All departments',assigned_educators:'Dr. Lina Khoury',assigned_supervisors:'All head nurses',pass_requirements:'80% on all quizzes',certificate_enabled:true,objectives:'Ensure all nursing staff complete hospital-mandated annual competencies.',outcomes:'Compliance with accreditation standards; validated core competencies.'},
  {id:'p2',title:'New Nurse Orientation',code:'NNO-01',category:'New Nurse Orientation',mandatory:true,status:'active',start_date:'2026-01-01',end_date:'2026-12-31',deadline:'30 days from hire',duration:'20h',audience:'New hires',dept_scope:'All departments',assigned_educators:'Dr. Lina Khoury',assigned_supervisors:'Unit head nurses',pass_requirements:'Pass all module quizzes',certificate_enabled:true,objectives:'Onboard newly hired nurses to hospital policies, systems and safety culture.',outcomes:'New hires ready for independent supervised practice.'},
  {id:'p3',title:'ICU Clinical Competency Track',code:'ICU-CT-3',category:'ICU Training',mandatory:false,status:'active',start_date:'2026-03-01',end_date:'2026-11-30',deadline:'2026-11-30',duration:'16h',audience:'ICU nurses',dept_scope:'ICU',assigned_educators:'Dr. Lina Khoury',assigned_supervisors:'Hala Mansour',pass_requirements:'85% + supervisor approval',certificate_enabled:true,objectives:'Advance ICU nurses through ventilator, sepsis and hemodynamics competencies.',outcomes:'Validated ICU clinical competency level 3.'},
  {id:'p4',title:'Medication Safety Update Q3',code:'MSU-Q3',category:'Medication Safety',mandatory:true,status:'draft',start_date:'2026-08-01',end_date:'2026-10-31',deadline:'2026-10-15',duration:'3h',audience:'All nurses',dept_scope:'All departments',assigned_educators:'Dr. Lina Khoury',assigned_supervisors:'All head nurses',pass_requirements:'80%',certificate_enabled:false,objectives:'Communicate Q3 high-alert medication policy updates.',outcomes:'Reduced medication administration errors.'},
  {id:'p5',title:'Leadership Foundations for Charge Nurses',code:'LEAD-1',category:'Nursing Leadership',mandatory:false,status:'draft',start_date:'2026-09-01',end_date:'2026-12-15',deadline:'2026-12-15',duration:'10h',audience:'Charge nurses',dept_scope:'All departments',assigned_educators:'Mona Arnaout',assigned_supervisors:'—',pass_requirements:'Completion',certificate_enabled:true,objectives:'Build core leadership and delegation skills.',outcomes:'Pipeline of unit leadership candidates.'},
]

export const MATERIALS = [
  {id:'mt1',title:'WHO 5 Moments of Hand Hygiene (Video)',type:'Video',course_id:'c1',size_text:'184 MB · 12:30',latest_version:'v3',uploaded_by:'Dr. L. Khoury',upload_date:'2026-05-02',mandatory:true,downloadable:false,tracking_rule:'Watch % required (90%)',views:412,avg_time:'11:40',completion_pct:88},
  {id:'mt2',title:'Policy IC-P-04: Hand Hygiene & PPE',type:'PDF',course_id:'c1',size_text:'1.2 MB · 8 pages',latest_version:'v5',uploaded_by:'Infection Control',upload_date:'2026-04-18',mandatory:true,downloadable:true,tracking_rule:'Read all pages + acknowledgment',views:389,avg_time:'9m 20s',completion_pct:83},
  {id:'mt3',title:'High-Alert Medications — LASA List',type:'PDF',course_id:'c3',size_text:'860 KB · 5 pages',latest_version:'v2',uploaded_by:'Pharmacy',upload_date:'2026-06-01',mandatory:true,downloadable:true,tracking_rule:'Open + acknowledgment',views:210,avg_time:'6m 05s',completion_pct:71},
  {id:'mt4',title:'Code Red Response — Slide Deck',type:'PPT',course_id:'c2',size_text:'14 MB · 28 slides',latest_version:'v1',uploaded_by:'Safety Office',upload_date:'2026-02-11',mandatory:true,downloadable:false,tracking_rule:'Open tracking',views:301,avg_time:'12m',completion_pct:79},
  {id:'mt5',title:'Sepsis Hour-1 Bundle Checklist',type:'Checklist',course_id:'c5',size_text:'240 KB',latest_version:'v2',uploaded_by:'Dr. L. Khoury',upload_date:'2026-03-30',mandatory:false,downloadable:true,tracking_rule:'Download tracking',views:96,avg_time:'—',completion_pct:64},
  {id:'mt6',title:'NG Tube Insertion — Skills Demo (Video)',type:'Video',course_id:'c4',size_text:'96 MB · 8:15',latest_version:'v1',uploaded_by:'Media Team',upload_date:'2026-01-20',mandatory:true,downloadable:false,tracking_rule:'Watch % required (100%)',views:44,avg_time:'8:02',completion_pct:91},
  {id:'mt7',title:'Hospital Orientation Handbook',type:'PDF',course_id:'c4',size_text:'3.4 MB · 42 pages',latest_version:'v6',uploaded_by:'HR / Nursing Ed.',upload_date:'2026-01-05',mandatory:true,downloadable:true,tracking_rule:'Open + reading time',views:52,avg_time:'31m',completion_pct:76},
  {id:'mt8',title:'External link: WHO Hand Hygiene Portal',type:'Link/URL',course_id:'c1',size_text:'—',latest_version:'—',uploaded_by:'Dr. L. Khoury',upload_date:'2026-05-02',mandatory:false,downloadable:false,tracking_rule:'Click tracking',views:120,avg_time:undefined,completion_pct:0},
  {id:'mt9',title:'Ventilator Alarms — SCORM Package',type:'Protocol',course_id:'c5',size_text:'52 MB',latest_version:'v1',uploaded_by:'Vendor',upload_date:'2026-04-12',mandatory:false,downloadable:false,tracking_rule:'SCORM completion',views:38,avg_time:'22m',completion_pct:58},
  {id:'mt10',title:'Falls Risk Audio Briefing (5 min)',type:'PDF',course_id:'c6',size_text:'6 MB · 5:10',latest_version:'v1',uploaded_by:'Quality Dept.',upload_date:'2026-06-20',mandatory:false,downloadable:false,tracking_rule:'Listen % tracking',views:12,avg_time:'4:50',completion_pct:80},
]

export const QUIZ = {
  id:'q1',title:'Infection Control Competency Quiz',course_id:'c1',description:'Validates core hand hygiene and PPE knowledge.',pass_score:80,time_limit_min:10,max_attempts:3,randomize_questions:true,randomize_answers:true,result_display_mode:'Full answer review',feedback_timing:'After quiz completion',certificate_eligible:true,mandatory:true,
  questions:[
    {id:'qq1',quiz_id:'q1',type:'mcq',question:'According to the WHO 5 Moments, when must hand hygiene be performed?',options:['Only before touching a patient','Before touching a patient, before aseptic tasks, after body fluid exposure, after touching a patient, and after touching patient surroundings','Only after removing gloves','Once at the start of each shift'],correct_answer:1,accept_values:[],explanation:'All five WHO moments apply — gloves never replace hand hygiene.',points:10,difficulty:'Easy',order_index:1},
    {id:'qq2',quiz_id:'q1',type:'tf',question:'Wearing gloves eliminates the need for hand hygiene.',options:['True','False'],correct_answer:1,accept_values:[],explanation:'Gloves reduce but do not eliminate contamination; hygiene is required before and after glove use.',points:10,difficulty:'Easy',order_index:2},
    {id:'qq3',quiz_id:'q1',type:'mcq',question:'The minimum duration for alcohol-based hand rub is:',options:['5–10 seconds','20–30 seconds','60 seconds','2 minutes'],correct_answer:1,accept_values:[],explanation:'WHO recommends 20–30 seconds for alcohol-based rub.',points:10,difficulty:'Medium',order_index:3},
    {id:'qq4',quiz_id:'q1',type:'multi',question:'Select ALL items that are part of contact-isolation PPE for MDRO patients:',options:['Gown','Gloves','N95 respirator (routine)','Eye protection when splashing is expected'],correct_answer:[0,1,3],accept_values:[],explanation:'N95 is for airborne precautions, not routine contact isolation.',points:10,difficulty:'Medium',order_index:4},
    {id:'qq5',quiz_id:'q1',type:'fill',question:'Per policy IC-P-04, visibly soiled hands must be washed with soap and water for at least ____ seconds.',options:[],correct_answer:'40',accept_values:['40','40-60','forty'],explanation:'Soap-and-water wash: 40–60 seconds when hands are visibly soiled.',points:10,difficulty:'Medium',order_index:5},
    {id:'qq6',quiz_id:'q1',type:'mcq',question:'Scenario: You finish emptying a urinary catheter bag, remove your gloves, and are immediately called to an adjacent bed to silence a pump alarm. What do you do first?',options:['Silence the alarm first — it is urgent','Perform hand hygiene, then attend the alarm','Put on new gloves and attend the alarm','Ask a colleague to disinfect your hands later'],correct_answer:1,accept_values:[],explanation:'Moment 3 (after body-fluid exposure risk) requires hygiene before any other patient contact.',points:10,difficulty:'Hard',order_index:6},
  ]
}

export const ATTEMPTS = [
  {nurse:'Jana Saab',course:'IC-101',quiz:'Infection Control Competency',att:1,start:'2026-06-14 10:02',end:'2026-06-14 10:09',time:'7m 12s',score:'55/60',pct:92,pass:true},
  {nurse:'Rana Khalil',course:'IC-101',quiz:'Infection Control Competency',att:1,start:'2026-06-20 13:31',end:'2026-06-20 13:40',time:'8m 44s',score:'50/60',pct:83,pass:true},
  {nurse:'Aya Merhi',course:'MS-204',quiz:'High-Alert Medications',att:2,start:'2026-06-28 09:10',end:'2026-06-28 09:22',time:'11m 30s',score:'38/60',pct:63,pass:false},
  {nurse:'Karim Awada',course:'IC-101',quiz:'Infection Control Competency',att:1,start:'2026-05-30 15:44',end:'2026-05-30 15:53',time:'9m 02s',score:'42/60',pct:70,pass:false},
  {nurse:'Karim Awada',course:'IC-101',quiz:'Infection Control Competency',att:2,start:'2026-06-02 08:15',end:'2026-06-02 08:23',time:'8m 10s',score:'51/60',pct:85,pass:true},
  {nurse:'Maya Fares',course:'ES-110',quiz:'Emergency Codes Quiz',att:1,start:'2026-06-11 12:00',end:'2026-06-11 12:06',time:'6m 20s',score:'58/60',pct:97,pass:true},
]

export const NOTIFS = [
  {id:'no1',profile_id:'',recipient_name:'Rana Khalil',type:'deadline',message:'"Hand Hygiene & Infection Control" is due on 20 Jul 2026 — 13 days left.',channels:'Email + In-system',sent_at:'2026-07-07 08:00',read:false},
  {id:'no2',profile_id:'',recipient_name:'Rana Khalil',type:'system',message:'A new version of Policy IC-P-04 (v5) was published in your assigned course.',channels:'In-system',sent_at:'2026-07-05 14:20',read:false},
  {id:'no3',profile_id:'',recipient_name:'Rana Khalil',type:'completion',message:'You passed "Emergency Codes Quiz" with 88%. Certificate available.',channels:'Email + In-system',sent_at:'2026-06-30 11:12',read:true},
  {id:'no4',profile_id:'',recipient_name:'Hala Mansour',type:'system',message:'2 nurses in ICU have overdue mandatory training: Aya Merhi (2), Karim Awada (1).',channels:'Email + Dashboard alert',sent_at:'2026-07-07 07:00',read:false},
  {id:'no5',profile_id:'',recipient_name:'Farah Nassar',type:'system',message:'Course "High-Alert Medication Safety" completion is 32% — below the 50% mid-period target.',channels:'Email',sent_at:'2026-07-06 07:00',read:true},
  {id:'no6',profile_id:'',recipient_name:'Aya Merhi',type:'reminder',message:'"High-Alert Medication Safety" was due 30 Jun 2026. Your supervisor has been notified.',channels:'Email + In-system',sent_at:'2026-07-01 09:00',read:false},
]

export const EMAIL_TEMPLATES = [
  {id:'et1',name:'New assignment',subject:'New training assigned: {{course_name}}',trigger_event:'On course assignment',body:'Dear {{nurse_name}}, you have been assigned {{course_name}} due {{due_date}}.',dynamic_fields:'{{nurse_name}}, {{course_name}}, {{due_date}}, {{login_link}}',active:true},
  {id:'et2',name:'Deadline reminder',subject:'Reminder: {{course_name}} due {{due_date}}',trigger_event:'7 / 3 / 1 days before deadline',body:'Dear {{nurse_name}}, {{course_name}} is due on {{due_date}}.',dynamic_fields:'{{nurse_name}}, {{course_name}}, {{due_date}}, {{completion_percentage}}',active:true},
  {id:'et3',name:'Overdue notice',subject:'Overdue: {{course_name}}',trigger_event:'Day after deadline, then weekly',body:'Dear {{nurse_name}}, {{course_name}} is now overdue.',dynamic_fields:'{{nurse_name}}, {{course_name}}, {{supervisor_name}}, {{department}}',active:true},
  {id:'et4',name:'Quiz result',subject:'Your result for {{course_name}}: {{quiz_score}}',trigger_event:'On quiz submission',body:'Dear {{nurse_name}}, your score was {{quiz_score}}.',dynamic_fields:'{{nurse_name}}, {{quiz_score}}, {{login_link}}',active:true},
  {id:'et5',name:'Certificate issued',subject:'Certificate: {{course_name}}',trigger_event:'On course completion',body:'Dear {{nurse_name}}, your certificate for {{course_name}} is ready.',dynamic_fields:'{{nurse_name}}, {{course_name}}, {{hospital_name}}',active:true},
  {id:'et6',name:'Supervisor overdue alert',subject:'{{department}}: nurses with overdue training',trigger_event:'Weekly (Mon 07:00)',body:'Dear {{supervisor_name}}, the following nurses have overdue training.',dynamic_fields:'{{supervisor_name}}, {{department}}, overdue list',active:true},
  {id:'et7',name:'Admin low-completion alert',subject:'Low completion alert: {{course_name}}',trigger_event:'When completion drops below target',body:'Alert: {{course_name}} completion is {{completion_percentage}}.',dynamic_fields:'{{course_name}}, {{completion_percentage}}',active:true},
]

export const REMINDER_RULES = [
  {id:'rr1',rule_name:'On assignment',schedule_detail:'Immediately when a course is assigned',channels:'Email + in-system',enabled:true},
  {id:'rr2',rule_name:'Before deadline',schedule_detail:'7, 3 and 1 days before due date',channels:'Email + in-system',enabled:true},
  {id:'rr3',rule_name:'On deadline date',schedule_detail:'Morning of the due date (08:00)',channels:'Email',enabled:true},
  {id:'rr4',rule_name:'After deadline',schedule_detail:'Next day, then weekly until completed',channels:'Email + in-system',enabled:true},
  {id:'rr5',rule_name:'Weekly incomplete digest',schedule_detail:'Every Monday for nurses with incomplete mandatory training',channels:'Email',enabled:true},
  {id:'rr6',rule_name:'Supervisor overdue alert',schedule_detail:'Weekly summary of overdue nurses per unit',channels:'Email + dashboard alert',enabled:true},
  {id:'rr7',rule_name:'Admin low-completion alert',schedule_detail:'When a mandatory course drops below its completion target',channels:'Email',enabled:true},
]

export const ANNOUNCEMENTS = [
  {id:'a1',title:'New PPE donning stations installed in ICU & ER',body:'New PPE donning and doffing stations have been installed in all ICU and ER entry points. Please review the updated donning sequence posted at each station.',audience_type:'ICU, ER',priority:'high',start_date:'2026-07-01',end_date:'2026-07-31',send_email:true,require_confirmation:true,sent_count:78,created_by:'Safety Office',attachment_name:'Station map (PDF)'},
  {id:'a2',title:'Q3 Medication Safety Update goes live 1 Aug',body:'The Q3 Medication Safety course (MS-204 Update) will be available from 1 August 2026. All nurses must complete it before 15 October.',audience_type:'All nurses',priority:'normal',start_date:'2026-07-05',end_date:'2026-08-05',send_email:true,require_confirmation:false,sent_count:248,created_by:'Farah Nassar',attachment_name:undefined},
  {id:'a3',title:'JCI mock survey week — 14–18 Sep',body:'Joint Commission International mock survey will take place 14–18 September. All staff must be prepared. Review the readiness checklist attached.',audience_type:'All departments',priority:'high',start_date:'2026-06-20',end_date:'2026-09-18',send_email:false,require_confirmation:true,sent_count:248,created_by:'Sami Haddad',attachment_name:'Readiness checklist'},
]

export const CERTS = [
  {id:'cert1',cert_no:'CERT-2026-0412',profile_id:'',course_name:'Hand Hygiene & Infection Control',issued_at:'2026-06-14',score_pct:'92%',expiry_date:'2027-06-14',status:'valid',verify_code:'VF-8821',issued_by:'Dr. Lina Khoury'},
  {id:'cert2',cert_no:'CERT-2026-0398',profile_id:'',course_name:'Fire Safety & Emergency Codes',issued_at:'2026-06-11',score_pct:'97%',expiry_date:'2027-06-11',status:'valid',verify_code:'VF-8790',issued_by:'Safety Office'},
  {id:'cert3',cert_no:'CERT-2026-0377',profile_id:'',course_name:'Triage Essentials',issued_at:'2026-05-28',score_pct:'91%',expiry_date:'2027-05-28',status:'valid',verify_code:'VF-8712',issued_by:'Dr. Lina Khoury'},
  {id:'cert4',cert_no:'CERT-2025-0290',profile_id:'',course_name:'BLS Recertification',issued_at:'2025-08-02',score_pct:'88%',expiry_date:'2026-08-02',status:'expired',verify_code:'VF-7011',issued_by:'CPR Trainer'},
  {id:'cert5',cert_no:'CERT-2024-0141',profile_id:'',course_name:'Falls Prevention 2024',issued_at:'2024-10-12',score_pct:'84%',expiry_date:'2025-10-12',status:'expired',verify_code:'VF-5520',issued_by:'Quality Dept.'},
]

export const FEEDBACK_DATA = [
  {id:'fb1',course_name:'Hand Hygiene & Infection Control',course_rating:4.6,instructor_rating:4.8,materials_rating:4.5,relevance_rating:4.9,difficulty:'Appropriate',suggestions:'Video with Arabic captions was very helpful. Please add a printable pocket card.'},
  {id:'fb2',course_name:'High-Alert Medication Safety',course_rating:4.1,instructor_rating:4.4,materials_rating:3.8,relevance_rating:4.7,difficulty:'Slightly hard',suggestions:'LASA list should be searchable. More case examples for insulin please.'},
  {id:'fb3',course_name:'Fire Safety & Emergency Codes',course_rating:4.4,instructor_rating:4.3,materials_rating:4.4,relevance_rating:4.6,difficulty:'Appropriate',suggestions:'Slide deck is clear. Add a floor-plan walkthrough video.'},
]

export const AUDIT_LOGS = [
  {id:'al1',timestamp:'2026-07-07 08:41',user_name:'Farah Nassar (Administrator)',action:'EXPORT',affected_record:'Compliance report — Excel',ip_address:'10.20.4.18',before_value:undefined,after_value:undefined},
  {id:'al2',timestamp:'2026-07-07 08:12',user_name:'Rana Khalil (Nurse)',action:'LOGIN',affected_record:'Nurse portal',ip_address:'10.20.7.102',before_value:undefined,after_value:undefined},
  {id:'al3',timestamp:'2026-07-06 16:30',user_name:'Dr. Lina Khoury (Educator)',action:'UPDATE',affected_record:'Policy IC-P-04',ip_address:'10.20.4.31',before_value:'v4',after_value:'v5 (glove reuse clause removed)'},
  {id:'al4',timestamp:'2026-07-06 15:58',user_name:'Farah Nassar (Administrator)',action:'UPDATE',affected_record:'High-Alert Medication Safety (MS-204)',ip_address:'10.20.4.18',before_value:'Pending review',after_value:'Published'},
  {id:'al5',timestamp:'2026-07-06 15:41',user_name:'Sami Haddad (Super Admin)',action:'UPDATE',affected_record:'Karim Awada — role',ip_address:'10.20.1.5',before_value:'Nurse',after_value:'Nurse + Charge Nurse'},
  {id:'al6',timestamp:'2026-07-05 11:20',user_name:'System',action:'CREATE',affected_record:'Notification sent ×61 (MAT-2026)',ip_address:'—',before_value:undefined,after_value:undefined},
  {id:'al7',timestamp:'2026-07-05 09:03',user_name:'Unknown (u: k.awada)',action:'LOGIN',affected_record:'3rd failure → account locked 15 min',ip_address:'10.20.7.140',before_value:undefined,after_value:undefined},
  {id:'al8',timestamp:'2026-07-04 14:12',user_name:'Omar Sleiman (IT)',action:'UPDATE',affected_record:'Session timeout',ip_address:'10.20.2.9',before_value:'30 min',after_value:'20 min'},
  {id:'al9',timestamp:'2026-07-04 10:44',user_name:'Farah Nassar (Administrator)',action:'CREATE',affected_record:'CERT-2026-0412 — Jana Saab',ip_address:'10.20.4.18',before_value:undefined,after_value:undefined},
  {id:'al10',timestamp:'2026-07-03 09:30',user_name:'Dr. Lina Khoury (Educator)',action:'UPDATE',affected_record:'Infection Control Competency Quiz',ip_address:'10.20.4.31',before_value:'5 questions',after_value:'6 questions (added scenario)'},
]

export const DEPTS = [
  {id:'ICU',name:'Intensive Care Unit',units:['ICU-A','ICU-B'],supervisor:'Hala Mansour',active:true},
  {id:'ER',name:'Emergency Room',units:['ER Triage','ER Observation'],supervisor:'Samer Itani',active:true},
  {id:'PED',name:'Pediatrics',units:['Peds Ward','NICU'],supervisor:'Dana Hoteit',active:true},
  {id:'OR',name:'Operating Room',units:['OR Main','Recovery'],supervisor:'Rima Saad',active:true},
  {id:'MED',name:'Medical Ward',units:['Med 3F','Med 4F'],supervisor:'Nour Fakih',active:true},
  {id:'SUR',name:'Surgical Ward',units:['Surg 5F'],supervisor:'Ali Zein',active:true},
  {id:'OPD',name:'Outpatient Department',units:['OPD Clinics'],supervisor:'Maya Chami',active:true},
  {id:'IC',name:'Infection Control',units:['IC Office'],supervisor:'Dr. Lina Khoury',active:true},
]

export const ROLES_DEF = [
  {id:'superadmin',name:'superadmin',desc:'Full system control',color:'#dc2626',count:1},
  {id:'admin',name:'admin',desc:'Daily program operations',color:'#d97706',count:2},
  {id:'educator',name:'educator',desc:'Creates courses & content',color:'#059669',count:3},
  {id:'supervisor',name:'supervisor',desc:'Monitors unit nurses',color:'#2563eb',count:8},
  {id:'nurse',name:'nurse',desc:'Completes assigned training',color:'#7c3aed',count:142},
  {id:'director',name:'director',desc:'Executive compliance view',color:'#0891b2',count:1},
  {id:'it',name:'it',desc:'System health & access support',color:'#64748b',count:2},
]

export const USERS = [
  {id:'u1',email:'s.haddad@hospital.org',name:'Sami Haddad',role:'superadmin'},
  {id:'u2',email:'f.nassar@hospital.org',name:'Farah Nassar',role:'admin'},
  {id:'u3',email:'l.khoury@hospital.org',name:'Dr. Lina Khoury',role:'educator'},
  {id:'u4',email:'h.mansour@hospital.org',name:'Hala Mansour',role:'supervisor'},
  {id:'u5',email:'r.khalil@hospital.org',name:'Rana Khalil',role:'nurse'},
  {id:'u6',email:'m.arnaout@hospital.org',name:'Mona Arnaout',role:'director'},
  {id:'u7',email:'o.sleiman@hospital.org',name:'Omar Sleiman',role:'it'},
]

export const PROGRAM_CATS = [
  'New nurse orientation','Mandatory annual training','Infection control','Patient safety',
  'Medication safety','Emergency response','Clinical competency','ICU training','ER training',
  'Pediatric nursing','Nursing leadership','Quality and accreditation','Continuing education',
  'Policy updates','Department-specific training'
]

export const MATERIAL_TYPES = [
  'Video','PDF','Word document','PowerPoint','Image','Audio','External link',
  'Embedded web content','Policy / procedure','Form / Checklist','Clinical guideline','SCORM','Downloadable resource'
]

export const QTYPES = [
  'Multiple choice','Multiple selection','True / False','Short answer','Matching',
  'Fill in the blank','Ordering / sequencing','Scenario-based','Case study','Image-based','Document-based'
]

export const NOTIF_TYPES = [
  'New course assignment','New program assignment','Upcoming deadline','Overdue course reminder',
  'Quiz available','Quiz completed','Quiz failed','Course completed','Certificate issued',
  'New announcement','New material added','Supervisor alert','Administrator alert',
  'Password reset','Account activation','Course feedback request'
]

export const DOC_PAGES = [
  {title:'1 · Purpose',body:'This policy defines mandatory hand hygiene and personal protective equipment (PPE) practice for all clinical staff, in line with WHO guidelines and hospital accreditation standards.'},
  {title:'2 · Scope',body:'Applies to all nurses, physicians, allied health staff, students and contractors in all clinical areas, including outpatient clinics and diagnostic units.'},
  {title:'3 · The 5 Moments',body:'Hand hygiene is required: (1) before touching a patient, (2) before clean/aseptic procedures, (3) after body fluid exposure risk, (4) after touching a patient, (5) after touching patient surroundings.'},
  {title:'4 · Technique & duration',body:'Alcohol-based hand rub: 20–30 seconds covering all surfaces. Soap and water: 40–60 seconds, mandatory when hands are visibly soiled or after caring for C. difficile patients.'},
  {title:'5 · Gloves & PPE',body:'Gloves do not replace hand hygiene. Contact precautions require gown and gloves; eye protection is added when splashing is anticipated. Airborne precautions require N95 respirators.'},
  {title:'6 · Skin care',body:'Approved hospital moisturizers must be used to maintain skin integrity. Artificial nails are prohibited in clinical areas; natural nails must be kept short.'},
  {title:'7 · Monitoring & audit',body:'Compliance is monitored through direct observation audits and the Staff Development Program tracking system. Unit results are reported monthly to Infection Control.'},
  {title:'8 · Acknowledgment',body:'By acknowledging this document you confirm that you have read, understood and will comply with Policy IC-P-04 (v5, April 2026). Non-compliance is managed per HR policy.'},
]
