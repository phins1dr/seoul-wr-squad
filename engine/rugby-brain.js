/* 럭비 두뇌 (RugbyBrain) — 휠체어럭비 AI·물리·규정 엔진
   화면(DOM·캔버스)과 상관없이 돌아가요. 랩·아카데미·게임이 같이 써요.
   좌표: x 0→28 (공격 방향, 골라인 x=28), y 0→15 (사이드), 단위 m.
   사용법:
     const b = RugbyBrain.create({ cfg, msg, log, event, end, input, control, aim, beforeNew });
     b.newGame(); 매 프레임 b.tick(dt); 화면은 b.G 를 읽어서 그려요.
     b.req.pass = true 처럼 버튼 요청을 넣으면 다음 tick에서 처리해요.
   경기(4피리어드·점수·공수교대)는 RugbyBrain.match(...) 를 써요. */
(function(root){
'use strict';
const VERSION='1.0.0';
function speedOf(cls){const c=parseFloat(cls);return {max:2.3+0.9*c,acc:1.6+1.1*c,turn:2.0+0.9*c,pass:6+3.2*c};} // 로우는 출발·방향전환이 더 느림
function create(opts){opts=opts||{};
const noop=()=>{};
const hooks={msg:opts.msg||noop,log:opts.log||noop,event:opts.event||noop,end:opts.end||noop,input:opts.input||(()=>({x:0,y:0})),control:opts.control||(()=>null),aim:opts.aim||null,beforeNew:opts.beforeNew||noop};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hyp=Math.hypot;
const KEY={d:1.75,w:8}; // 실제 규격 (판정용)
const KEYDRAW={d:2.3,w:9.6,r:2.2};
const R=0.62; // 휠체어 충돌 반지름(m)
const NEED={40:5,30:7,20:10,10:13.5}; // 인바운드 거리별 필요한 패스 거리(m)
let G=null,passSel=null,flash=0;
const req={pass:false,bounce:false,pick:false,rev:false};
const ctl=id=>hooks.control(id);
function inputVec(){const v=hooks.input()||{x:0,y:0};let x=+v.x||0,y=+v.y||0;const m=hyp(x,y);if(m>1){x/=m;y/=m;}return {x,y};}
let cfg=Object.assign({lineA:['3.0','2.0','1.5','0.5'],lineD:['3.0','2.0','1.5','0.5'],me:1,dist:40,low:1,ctl:'keyhold',sens:1,autoBounce:false},opts.cfg||{});
if(!cfg.mode)cfg.mode='watch';if(!cfg.others)cfg.others='ai';cfg.ibAfter='auto';if(!cfg.form)cfg.form='2x2';if(!cfg.inPos)cfg.inPos='11';if(!cfg.press)cfg.press='auto';if(!cfg.ib11)cfg.ib11='auto';if(!cfg.after)cfg.after='delay';if(!cfg.keyDef||cfg.keyDef==='none')cfg.keyDef='onehead';cfg.trapPass='keep';if(!cfg.frontDef)cfg.frontDef='contain';if(!cfg.backPick)cfg.backPick='none';if(!cfg.p1)cfg.p1='key';if(!cfg.p2)cfg.p2='top';if(!cfg.p2s)cfg.p2s='diag';cfg.ctl='keyhold';cfg.sens=1;if(cfg.mode==='watch'){cfg.me=0;cfg.pick='auto';cfg.autoBounce=false;}if(!cfg.transDef)cfg.transDef='man';if(cfg.ibCheck===undefined)cfg.ibCheck=true;if(!cfg.def)cfg.def='man';if(!cfg.ibBy)cfg.ibBy=4;if(!cfg.noIb)cfg.noIb='center';if(!cfg.cAfter)cfg.cAfter='mine';if(!cfg.trapPass)cfg.trapPass='chase';if(cfg.trans===undefined)cfg.trans=true;if(!cfg.pick)cfg.pick='button';
if(!Array.isArray(cfg.lineA))cfg.lineA=['3.0','2.0','1.5','0.5'];if(!Array.isArray(cfg.lineD))cfg.lineD=['3.0','2.0','1.5','0.5'];
const MOVE_AUTO=c=>parseFloat(c)>=1?'check':'delay'; // 0.5는 인바체크 어려움
function resolveDef(){const c=cfg;if(c.def==='diamond'||c.def==='key')return;if(c.def==='man')c.def='manline';
  if(c.inPos==='center')c.inPos='press';if(c.inPos==='press'){c.ibCheck=false;c.noIb='center';return;}
  if(c.inPos==='11'){const mv=(c.ib11==='auto'||c.ib11==='center'||(c.ib11==='check'&&parseFloat(c.lineD[(c.ibBy||4)-1])<1))?MOVE_AUTO(c.lineD[(c.ibBy||4)-1]):c.ib11;c.mv=mv;
    if(mv==='check')c.ibCheck=true;else if(mv==='center'){c.ibCheck=false;c.noIb='center';}
    else{c.ibCheck=false;c.noIb='delay';c.form='2x1x1';c.trap=[1,2].sort((a,b)=>parseFloat(c.lineA[b-1])-parseFloat(c.lineA[a-1]))[0];}} // 딜레이: 인바운드 전엔 센 선수(1·2번 중)에게 같이 붙어 약한 선수에게 가게, 인바운드 후 인바운더에게
  else{c.ibCheck=false;c.form=c.inPos;c.noIb=c.after==='keep'?'trap':'delay';}}
function newGame(){hooks.beforeNew();resolveDef();
  const L=cfg.lineA,D=cfg.lineD;const PX={key:3.5,low:6,high:9,top:16};const dx=PX[cfg.p1]||3.5;
  const x2=PX[cfg.p2]||12.2;let y2=cfg.p2s==='same'?4.2:11.2;if(cfg.p2s==='same'&&Math.abs(x2-dx)<2.2)y2=1.8; // 같은 라인·같은 높이면 바깥쪽으로
  const A=[ // 공격 시작 위치 (x: 베이스라인→위, y: 사이드)
    {num:1,x:dx,y:4.2},{num:2,x:x2,y:y2},{num:3,x:-0.8,y:7.5},{num:4,...({1:{x:dx+0.2,y:5.6},2:{x:x2+0.2,y:y2+(y2>7.5?-1.4:1.4)},3:{x:1.2,y:6.2},4:{x:dx+2.5,y:6.5}})[cfg.low]}];
  const ps=[];
  A.forEach((a,i)=>{const cls=L[i];ps.push({id:'A'+a.num,team:'A',num:a.num,cls,chair:parseFloat(cls)<=1.5?'D':'A',x:a.x,y:a.y,a:a.num===3?0:Math.PI/2*0+0,v:0,...speedOf(cls)});});
  // 수비: 번호끼리, 마크보다 위(롱자리). 4번은 인바운더 체크
  D.forEach((cls,i)=>{const n=i+1;const mp=markMap(cfg)[n];const m=mp?ps.find(p=>p.team==='A'&&p.num===mp):null;let x=m?m.x+1.4:12.6,y=m?m.y:7.5;if(mp===4&&!cfg.ibCheck&&(cfg.form==='2x2'||cfg.form==='3x1')&&cfg.noIb!=='center'){const t=ps.find(q=>q.team==='A'&&q.num===(cfg.form==='3x1'?cfg.trap:1));x=t.x-1.4;y=t.y;}
    if(mp===3){if(cfg.ibCheck){x=1.6;y=7.5;}else if(cfg.noIb==='center'){x=12.6;y=7.5;}else{const t=ps.find(q=>q.team==='A'&&q.num===(cfg.form==='2x2'?2:cfg.trap));x=t.x-1.4;y=t.y;}}
    if(cfg.def==='diamond'){const dp=({4:{x:1.45,y:7.5},2:{x:4.5,y:2.3},3:{x:4.5,y:12.7},1:{x:12,y:7.5}})[n];x=dp.x;y=dp.y;}
    ps.push({id:'D'+n,team:'D',num:n,cls,chair:parseFloat(cls)<=1.5?'D':'A',x,y,a:Math.PI,v:0,...speedOf(cls)});});
  // 홈(얼라이먼트) 위치 저장
  for(const p of ps)p.home={x:p.x,y:p.y};
  const rnd=(a,b)=>a+Math.random()*(b-a);
  if(cfg.trans){ // 상대가 우리 골라인(아래)에서 득점한 직후: 다들 아래쪽에 흩어져 있음
    // 사이드라인에서 시작: 공격은 오른쪽(y=15 바깥), 수비는 왼쪽(y=0 바깥). 백코트 쪽에 흩어져 있음
    const slots=[2.5,5.5,8.5,11.5].sort(()=>Math.random()-0.5),slotsD=[2.5,5.5,8.5,11.5].sort(()=>Math.random()-0.5);let ia=0,id=0;
    for(const p of ps){if(p.team==='A'){p.x=slots[ia++]+rnd(-0.8,0.8);p.y=15.9;p.a=-Math.PI/2;}else{p.x=slotsD[id++]+rnd(-0.8,0.8);p.y=-0.9;p.a=Math.PI/2;}}
    for(const p of ps)if(p.team==='D'){const c=parseFloat(p.cls);p.ready=Math.random()<clamp(0.2+0.2*c,0.25,0.85);} // 등급이 높을수록 미리 길목을 막을 확률↑
  }
  G={ps,ball:{holder:'A3',x:0,y:0,fly:null},t:0,phase:cfg.trans?'trans':'ready',transT:cfg.trans?rnd(5,8):0,inboundT:0,backT:0,shotT:0,holdT:0,keyT:{},crossed:false,inbounded:false,
     events:[],samples:[],frames:[],rt:0,keepId:null,stuck:{},result:null,sw:{},pick:null,pickCool:0,cfg:{...cfg,lineupA:L.join('-'),lineupD:D.join('-')}};
  if(cfg.mode==='ctrl')cfg.me=3;passSel=null;if(cfg.trans)msg('트랜지션 · 데드타임이에요. 휘슬 전에 내 자리로!',2600);else msg('휘슬을 기다려요',0);hooks.event('newGame',{});
}
const P=id=>G.ps.find(p=>p.id===id);
const me=()=>G&&P('A'+cfg.me);
const msg=(t,ms=1600)=>hooks.msg(t,ms);
const log=(t,cls)=>hooks.log(t,cls);
function ev(type,extra){G.events.push({t:+G.t.toFixed(2),type,...extra});hooks.event(type,extra||{});if(cfg.mode==='ctrl'&&(type==='catch'||type==='pickup')&&extra.who&&extra.who[0]==='A')cfg.me=+extra.who.slice(1);}


/* ---------- 컴퓨터 판단 ---------- */
const MARK_IB={1:1,2:2,3:4,4:3},MARK_NO={1:1,2:2,3:3,4:0}; // 인바체크: 교환 / 안 함: 번호대로, 4번은 지역
function markMap(c){if(c.def==='diamond'||c.def==='key')return {1:1,2:2,3:3,4:4};if(c.ibCheck===false){return c.ibBy===3?{1:1,2:2,3:3,4:4}:{1:1,2:2,3:4,4:3};}return c.ibBy===3?{1:1,2:2,3:3,4:4}:MARK_IB;}
const MARKS=()=>markMap(G?G.cfg:cfg);
const GOAL={x:28,y:7.5};
let curP=null;
function steerTo(p,tx,ty,slow){
  const dx=tx-p.x,dy=ty-p.y,d=hyp(dx,dy);if(d<(curP===p&&p.team==='A'&&G.ball.holder!==p.id?0.5:0.25)) /* 공격 오프볼은 0.5m 안이면 멈춤(파닥거림 방지) */return {x:0,y:0,dist:d};const m=slow?Math.min(1,d/1.6):Math.min(1,d/0.8);return {x:dx/d*m,y:dy/d*m,dist:d};}
function chaser(team){const b=G.ball;let best=null,bd=1e9;for(const q of G.ps){if(q.team!==team||(q.id==='A3'&&!G.inbounded))continue;const d=hyp(q.x-b.x,q.y-b.y);if(d<bd){bd=d;best=q;}}return best;}
function attackAI(p){
  const b=G.ball,holder=b.holder&&P(b.holder);const D=G.ps.filter(q=>q.team==='D');
  if(b.roll&&chaser('A')===p)return steerTo(p,b.x,b.y,false);
  if(b.fly&&b.fly.to===p.id)return steerTo(p,b.fly.tx,b.fly.ty,false); // 패스가 오면 공 오는 곳으로
  if(p.id==='A3'&&!G.inbounded){ // 인바운더: 밖에서 대기, 1.2초 뒤 가장 열린 선수에게
    if(b.holder==='A3'&&G.inboundT>1.2){const t=bestTarget(p);if(t&&(t.score>0.8||G.inboundT>6))doPass(p,t);else if(!t&&G.inboundT>5.5){let n=null,nd=1e9;for(const q of G.ps){if(q.team!=='A'||q===p)continue;const d=hyp(q.x-p.x,q.y-p.y);if(d<nd){nd=d;n=q;}}if(n)doPass(p,n);}}
    return {x:0,y:0};}
  if(b.holder===p.id){ // 볼맨: 골 쪽으로, 앞을 막는 수비 피하기
    let v={x:1,y:(GOAL.y-p.y)*0.08};
    for(const d of D){const dx=d.x-p.x,dy=d.y-p.y,dist=hyp(dx,dy);if(dx>-0.5&&dist<3.2){v.y-=Math.sign(dy||1)*(3.2-dist)*0.7;v.x-=(3.2-dist)*0.15;}}
    if(p.y<2.2)v.y+=(2.2-p.y)*1.2;if(p.y>12.8)v.y-=(p.y-12.8)*1.2; // 볼맨은 사이드라인을 피함
    const st=G.stuck[p.id]||0;
    // 012 작전 — 수비가 2면 패스 (0.5는 제외, 아주 좋은 찬스는 예외, 가까운 거리는 안 함)
    const myC=defCount(p);
    if(myC>=2&&G.holdT>0.25){let r=null,rs=-9;for(const t of G.ps){if(t.team!=='A'||t===p||(t.id==='A3'&&!G.inbounded))continue;const d=hyp(t.x-p.x,t.y-p.y);if(d>p.pass||d<3)continue;const c=defCount(t);const great=c===0&&t.x>p.x+6;if(parseFloat(t.cls)<=0.5&&!great)continue;const sc=(c===0?2:c===1?0:-3)+Math.min(openness(t),3)*0.4+(t.x-p.x)*0.05;if(sc>rs){rs=sc;r=t;}}
      if(r&&rs>0.5){doPass(p,r);return {x:0,y:0};}}
    // 수비가 1이고 막히면 바꾸기 (픽앤롤로 수비를 바꾼다)
    if(myC===1&&(G.stuck[p.id]||0)>0.6&&!G.pick&&G.inbounded)startPick();
    // 로우포인터가 공을 잡으면 옆의 하이·미들에게 리턴 패스
    if(parseFloat(p.cls)<=1.5&&G.holdT>0.35){let r=null,rs=-9;for(const t of G.ps){if(t.team!=='A'||t===p||parseFloat(t.cls)<2||(t.id==='A3'&&!G.inbounded))continue;const d=hyp(t.x-p.x,t.y-p.y);if(d>p.pass)continue;const o=openness(t);if(o<1.0||defCount(t)>=2)continue;{let ln=9;for(const q of G.ps)if(q.team==='D')ln=Math.min(ln,segDist(q,p,t));if(ln<0.9)continue;}const sc=o-d*0.15+(t.x-p.x)*0.05;if(sc>rs){rs=sc;r=t;}}if(r){doPass(p,r);return {x:0,y:0};}}
    // 12초가 급하면 앞쪽 열린 선수에게
    if(!G.crossed&&G.backT>7.5&&G.holdT>0.3){const t=bestTarget(p);if(t&&t.x>p.x+1.5&&t.score>0){doPass(p,t);return {x:0,y:0};}}
    if(st>1.1||G.holdT>6.2&&!cfg.autoBounce){const t=bestTarget(p);if(t&&(t.score>0.4||st>2)){doPass(p,t);}else if(!cfg.autoBounce)bounce(p);}
    return steerTo(p,p.x+v.x*3,p.y+v.y*3);}
  if(!G.inbounded&&p.num!==3&&G.inboundT>0.8){const r=freeUp(p);if(r)return r;} // 휘슬 뒤: 막혀 있으면 떼고 나오기
  const lowAct=G.cfg.low;
  // 012 작전 — 내 수비가 0이면 공간으로 달리기 (볼맨 패스 거리 안에서, 볼맨보다 위로). 셋팅 중인 4번은 제외
  if(holder&&holder.team==='A'&&G.inbounded&&!(p.id==='A3'&&!G.inbounded)){const settingNow=p.num===4&&lowAct!==4&&P('A'+lowAct)===holder;
    if(!settingNow&&defCount(p)===0&&!(p.num===3&&G.cfg.ibAfter!=='space')){const sp=openSpot(p,holder);return steerTo(p,sp.x,sp.y,false);}}
  if(p.num===4){ // 갈고리
    if(lowAct===4){const crossed=holder&&holder.x>14;if(!crossed)return steerTo(p,17.5,p.y<7.5?3.5:11.5,true);
      return steerTo(p,holder.x+1.5,holder.y+(holder.y<7.5?0.9:-0.9),false);} // 볼맨 스크린
    const mate=P('A'+lowAct); // 1셋·2셋·3셋: 그 선수 앞에서 범퍼 지키기(트레일러)
    if(lowAct===3&&!G.inbounded){const ib=P('A3');return steerTo(p,ib.x+1.9,ib.y+(p.y<7.5?-1.1:1.1),false);} // 인바운드 헬프: 인바체크 옆에서 길 열기
    return steerTo(p,mate.x+2.0,mate.y+(mate.y<7.5?0.4:-0.4),false);}
  if((p.num===1||p.num===2)&&!G.inbounded)return steerTo(p,p.home.x,p.home.y,true); // 인바운드 전: 정한 위치
  if(p.num===2){const bx=holder?holder.x:b.x;if(bx<12)return steerTo(p,12.4,p.y>7.5?12:3,true);
    return steerTo(p,Math.min(26.8,bx+5),p.y>7.5?11.5:3.5,false);}
  if(p.num===1){const bx=holder?holder.x:b.x;return steerTo(p,Math.min(26.6,bx+3.5),p.y<7.5?4:11,true);}
  if(p.num===3&&G.inbounded&&holder&&holder.team==='A'&&holder!==p){const r=ibAfter(p,holder);if(r)return r;}
  // 3번(인바운드 후): 볼맨이 압박받으면 도와주러(리턴 패스 받을 자리), 아니면 열린 공간으로
  if(holder&&holder.team==='A'&&holder!==p){
    const press=G.ps.filter(d=>d.team==='D'&&hyp(d.x-holder.x,d.y-holder.y)<2.3).length;
    if((press>=1&&((G.stuck[holder.id]||0)>0.3||parseFloat(holder.cls)<=1.5||press>=2))&&hyp(p.x-holder.x,p.y-holder.y)<10){
      const sides=[-1,1].map(sd=>({sd,o:openness({x:holder.x-0.8,y:clamp(holder.y+sd*3,1,14)})}));const sd=sides[0].o>sides[1].o?sides[0].sd:sides[1].sd;
      return steerTo(p,Math.max(0.8,holder.x-0.8),clamp(holder.y+sd*3,1,14),false);}}
  const sp=openSpot(p);return steerTo(p,sp.x,sp.y,false);
}
function helpBall(p,holder){const sides=[-1,1].map(sd=>({sd,o:openness({x:holder.x-0.8,y:clamp(holder.y+sd*3,1,14)})}));const sd=sides[0].o>sides[1].o?sides[0].sd:sides[1].sd;return steerTo(p,Math.max(0.8,holder.x-0.8),clamp(holder.y+sd*3,1,14),false);}
// 인바운더가 살아나온 뒤 (012): 내 수비 0 → 공간으로(볼맨이 패스해줌). 내 수비 1↑ + 볼맨 수비 1 → 볼맨 돕기(픽). 그 외 → 수비 떼고 받으러 공간으로
function ibAfter(p,holder){const mine=defCount(p),hc=defCount(holder);
  if(mine>=1&&hc===1){const d=defOf(holder)||G.ps.filter(q=>q.team==='D').sort((a,b)=>hyp(a.x-holder.x,a.y-holder.y)-hyp(b.x-holder.x,b.y-holder.y))[0];
    if(d){const gx=holder.x-d.x,gy=holder.y-d.y,g=hyp(gx,gy)||1;return steerTo(p,d.x-gx/g*0.9,d.y-gy/g*0.9,false);}} // 볼맨 수비를 픽
  const sp=openSpot(p,holder);return steerTo(p,sp.x,sp.y,false);}
// 인바운드 전, 패스길이 막혔거나 수비가 붙었으면 인바운더 패스거리 안에서 길이 열리는 곳으로
function freeUp(p){const ib=P('A3');const lane=pt=>{let m=9;for(const d of G.ps)if(d.team==='D')m=Math.min(m,segDist(d,{x:ib.x+0.6,y:ib.y},pt));return m;};
  const blocked=lane(p)<0.9||openness(p)<1.3;if(!blocked&&!p.fu)return null;
  if(p.fu&&G.t-p.fuT<0.6)return steerTo(p,p.fu.x,p.fu.y,false);
  let best=null,bs=-1e9;for(const dx of [-3,-1.5,0,1.5,3])for(const dy of [-3,-1.5,0,1.5,3]){const pt={x:clamp(p.x+dx,0.6,20),y:clamp(p.y+dy,0.8,14.2)};if(hyp(pt.x-ib.x,pt.y-ib.y)>ib.pass*0.9)continue;
    let mate=9;for(const a of G.ps)if(a.team==='A'&&a!==p&&a!==ib)mate=Math.min(mate,hyp(a.x-pt.x,a.y-pt.y));
    const sc=Math.min(lane(pt),2)+Math.min(openness(pt),3)*0.6-0.12*hyp(dx,dy)-(mate<2.2?1.5:0);if(sc>bs){bs=sc;best=pt;}}
  if(!best)return null;p.fu=best;p.fuT=G.t;return steerTo(p,best.x,best.y,false);}
// 트랩 성공: 1.45m 안에 수비 2명이 서로 다른 쪽(90° 이상 벌어짐)에 붙어 있으면 범퍼와 뒤가 막힌 것 → 못 움직임
function trapped(a){const ds=G.ps.filter(d=>d.team==='D'&&hyp(d.x-a.x,d.y-a.y)<1.45);if(ds.length<2)return false;
  for(let i=0;i<ds.length;i++)for(let j=i+1;j<ds.length;j++){const u=Math.atan2(ds[i].y-a.y,ds[i].x-a.x),w=Math.atan2(ds[j].y-a.y,ds[j].x-a.x);let d=Math.abs(u-w);if(d>Math.PI)d=2*Math.PI-d;if(d>Math.PI/2)return true;}return false;}
function defCount(a){return G.ps.filter(d=>d.team==='D'&&hyp(d.x-a.x,d.y-a.y)<2.0).length;}
function openSpot(p,from){ // 볼보다 앞쪽에서 수비가 가장 먼 곳 (0.8초마다 다시 고름)
  if(p.spot&&G.t-p.spotT<0.8)return p.spot;const b=G.ball;const bx=b.holder?P(b.holder).x:b.x;let best=null,bs=-1e9;
  for(const dx of [2,4,6,8,10])for(const y of [2,4.5,7.5,10.5,13]){const x=Math.min(26.3,bx+dx);if(from&&(hyp(x-from.x,y-from.y)>from.pass*0.85||x<from.x+1.5))continue; /* 볼맨 패스 거리 안, 볼맨보다 위 */const o=Math.min(openness({x,y}),4);let mate=9;for(const a of G.ps)if(a.team==='A'&&a!==p)mate=Math.min(mate,hyp(a.x-x,a.y-y));
    const sc=o-0.12*hyp(x-p.x,y-p.y)+0.08*dx-(mate<2.5?2:0);if(sc>bs){bs=sc;best={x,y};}}
  if(!best)best={x:Math.min(26.3,bx+3),y:p.y};p.spot=best;p.spotT=G.t;return best;}
function openness(t){let m=9;for(const d of G.ps)if(d.team==='D')m=Math.min(m,hyp(d.x-t.x,d.y-t.y));return m;}
function bestTarget(from){let best=null;
  for(const t of G.ps){if(t.team!=='A'||t===from)continue;if(t.id==='A3'&&!G.inbounded)continue;const dist=hyp(t.x-from.x,t.y-from.y);if(dist>from.pass)continue;
    // 패스길에 수비가 있으면 감점
    const h=holdPos(from);const high=hyp(t.x-h.x,t.y-h.y)>4;const a0=high?{x:h.x+(t.x-h.x)*0.7,y:h.y+(t.y-h.y)*0.7}:{x:h.x+(t.x-h.x)*0.25,y:h.y+(t.y-h.y)*0.25}; // 가로채기 판정과 같은 구간
    let lane=9;for(const d of G.ps){if(d.team!=='D')continue;lane=Math.min(lane,segDist(d,a0,t));}
    const blocked=lane<0.8;const dc2=defCount(t)>=2;const s=-(dc2?2.5:0)+Math.min(openness(t),3)*0.5+Math.min(lane,2)*0.6+(t.x-from.x)*0.06-(dist>from.pass*0.8?0.6:0)-(blocked?3:0)-(openness(t)<1.1?1.6:0);
    if(!best||s>best.score)best={p:t,score:s};}
  return best&&{...best.p,score:best.score,id:best.p.id};}
function segDist(c,a,b){const vx=b.x-a.x,vy=b.y-a.y,L=vx*vx+vy*vy||1;let u=((c.x-a.x)*vx+(c.y-a.y)*vy)/L;u=clamp(u,0,1);return hyp(a.x+vx*u-c.x,a.y+vy*u-c.y);}
// 인바체크 안 할 때, 인바운더 담당 수비의 위치 (센터라인 / 트랩 / 딜레이)
function freeIbTarget(p){const c=G.cfg;if(c.ibCheck!==false)return null;
  const trapOn=c.noIb==='trap'||G.keepId===p.id||(c.noIb==='delay'&&(!G.inbounded||(c.form==='2x2'&&c.after==='delay1'))); // 1번 쪽만 풀면 2번 쪽(이 수비)은 계속 트랩
  if(trapOn){const t=P('A'+(c.form==='2x2'?2:c.trap));if(!t)return null;const b=G.ball;const bh=b.holder?P(b.holder):b;const ib=P('A3');const src=!G.inbounded?ib:bh;
    if(bh===t){return {x:t.x+0.9,y:t.y+(p.y<t.y?-1.2:1.2),kind:'trap'};} // 묶은 선수가 공을 잡으면 같이 압박
    if(c.noIb==='trap'&&c.trapPass==='chase'&&G.inbounded&&bh&&bh.team==='A'&&bh.x>Math.min(t.x,p.x)+0.5)return {x:bh.x+1.1,y:bh.y+(GOAL.y-bh.y)*0.08,kind:'chase'}; // 볼맨이 트랩 라인을 넘으면 추격
    const dx=src.x-t.x,dy=src.y-t.y,d=hyp(dx,dy)||1;return {x:t.x+dx/d*1.5,y:t.y+dy/d*1.5,kind:'trap'};} // 패스 길 쪽에 붙어서 묶기
  if(c.noIb==='center'&&!G.inbounded)return {x:12.6,y:7.5,kind:'center'};
  if(c.noIb==='center'&&c.cAfter==='ball'){const h=G.ball.holder&&P(G.ball.holder);if(h&&h.team==='A'&&h.id!=='A3')return {x:h.x+1.1,y:h.y+(p.y<h.y?-0.9:0.9),kind:'chase'};}
  return null;}
function rawDef(p){
  const b=G.ball,holder=b.holder&&P(b.holder);const c=G.cfg;
  if(c.ibCheck===false&&c.noIb==='delay'&&c.form==='3x1'&&c.after==='one'&&G.inbounded&&!G.dDone){G.dDone=1;const mm=MARKS();const d3=G.ps.find(q=>q.team==='D'&&mm[q.num]===3),d4=G.ps.find(q=>q.team==='D'&&mm[q.num]===4),a3=P('A3');
    if(hyp(d4.x-a3.x,d4.y-a3.y)<hyp(d3.x-a3.x,d3.y-a3.y)){G.sw[d4.id]='A3';G.keepId=d3.id;}else G.keepId=d4.id;} // 트리플원: 인바운더에 가까운 1명만 풀림
  if(c.ibCheck===false&&c.noIb==='delay'&&c.form==='2x2'&&c.after==='delay1'&&G.inbounded&&!G.dDone){G.dDone=1;const d4=G.ps.find(q=>q.team==='D'&&MARKS()[q.num]===4);if(d4)G.sw[d4.id]='A3';}
  if(c.ibCheck===false&&c.noIb==='delay'&&c.form!=='2x1x1'&&!(c.form==='2x2'&&c.after!=='delay')&&!(c.form==='3x1'&&c.after==='one')&&G.inbounded&&!G.dDone){G.dDone=1;const mm=MARKS();const d3=G.ps.find(q=>q.team==='D'&&mm[q.num]===3),d4=G.ps.find(q=>q.team==='D'&&mm[q.num]===4),a3=P('A3');if(hyp(d4.x-a3.x,d4.y-a3.y)<hyp(d3.x-a3.x,d3.y-a3.y)){G.sw[d4.id]='A3';G.sw[d3.id]='A4';}}
  if(MARKS()[p.num]===4&&!G.sw[p.id]&&c.ibCheck===false&&(c.form==='2x2'||c.form==='3x1')&&(c.noIb==='trap'||G.keepId===p.id||(c.noIb==='delay'&&(!G.inbounded||(c.form==='2x2'&&c.after==='delay2'))))){const t=P(c.form==='3x1'?'A'+c.trap:'A1'),ib=P('A3');const bh=b.holder?P(b.holder):b;const src=!G.inbounded?ib:bh;
    if(bh===t)return {x:t.x+0.9,y:t.y+(p.y<t.y?-1.2:1.2),slow:false,kind:'trap'};const dx=src.x-t.x,dy=src.y-t.y,d=hyp(dx,dy)||1;if(c.form==='3x1'){const an=Math.atan2(dy,dx)+(t.y<7.5?1.3:-1.3);return {x:t.x+Math.cos(an)*1.5,y:t.y+Math.sin(an)*1.5,slow:false,kind:'trap'};}return {x:t.x+dx/d*1.5,y:t.y+dy/d*1.5,slow:false,kind:'trap'};}
  if(b.roll&&chaser('D')===p)return {x:b.x,y:b.y,slow:false,kind:'ball'};
  const mk=G.sw[p.id]||(MARKS()[p.num]?'A'+MARKS()[p.num]:null);const m=mk?P(mk):null;
  const ib=P('A3');
  if(m&&m.id==='A3'&&!G.sw[p.id]){const f=freeIbTarget(p);if(f)return {...f,slow:false};}
  if(m&&m.id==='A3'&&!G.inbounded)return {x:ib.x+2.4,y:ib.y,slow:true,kind:'ib'}; // 인바운더 담당: 1m 밖
  if(m&&m.id==='A3'&&G.inbounded&&ib.x<0.4)return {x:ib.x+1.75,y:ib.y+(p.y<ib.y?-0.35:0.35),slow:true,kind:'ib'}; // 메인휠은 들어오게
  if(!m){const bx=G.ball.x;return {x:Math.max(5,Math.min(bx+4.5,16)),y:7.5,slow:false,kind:'zone'};}
  let tx,ty,kind='man';
  if(!G.inbounded&&m.id!=='A3'&&(hyp(m.x-ib.x,m.y-ib.y)>ib.pass||p.max-m.max>=0.8)){const ih=ib.home||ib;tx=m.x*0.65+ih.x*0.35+0.4;ty=m.y*0.65+ih.y*0.35;return {x:tx,y:ty,slow:false,kind:'deny',m};}
  if(holder&&holder.id===m.id&&hyp(m.x-p.x,m.y-p.y)<4){tx=m.x+1.1;ty=m.y+(GOAL.y-m.y)*0.08;kind='press';}
  else if(G.crossed&&G.press&&holder&&holder.team==='A'&&holder!==m&&hyp(m.x-holder.x,m.y-holder.y)<=holder.pass){ // 볼맨 어택일 때 나머지: 패스라인 선수 디나이
    const hx=holder.x-m.x,hy=holder.y-m.y,hd=hyp(hx,hy)||1;tx=m.x+hx/hd*1.2;ty=m.y+hy/hd*1.2;kind='short';}
  else if(!G.crossed&&holder&&holder.team==='A'&&holder!==m&&G.inbounded&&hyp(m.x-holder.x,m.y-holder.y)>holder.pass){ // 볼맨 패스거리 밖 → 숏자리 (볼 쪽으로 못 오게)
    const hx=holder.x-m.x,hy=holder.y-m.y,hd=hyp(hx,hy)||1;tx=m.x+hx/hd*1.3;ty=m.y+hy/hd*1.3;kind='short';}
  else{const gx=GOAL.x-m.x,gy=GOAL.y-m.y,gd=hyp(gx,gy)||1;tx=m.x+gx/gd*1.45;ty=m.y+gy/gd*1.45+(m.y<7.5?-0.45:0.45);} // 패스거리 안 → 롱자리 (사이드 쪽으로 쉐이드: 범퍼를 막아야 하는 쪽으로 살짝)
  const inKey=(x,y)=>x>28-KEY.d&&Math.abs(y-7.5)<KEY.w/2;
  if(inKey(tx,ty)&&!inKey(p.x,p.y)){const others=G.ps.filter(q=>q.team==='D'&&q!==p&&inKey(q.x,q.y)).length;if(others>=3)tx=28-KEY.d-0.5;}
  return {x:Math.min(tx,27.6),y:ty,slow:false,kind,m};}
// 맨라인: 같은 라인에 선 수비끼리 라인을 만든다 (틈은 휠체어가 못 지나갈 만큼)
const GAP=2.25; // 휠체어 중심 사이 거리 — 이 정도면 사이로 못 지나감
function lineSlots(){if(lineSlots.t===G.t&&lineSlots.g===G)return lineSlots.v;const out={};
  const rows=G.ps.filter(q=>q.team==='D').map(q=>({q,r:rawDef(q)})).filter(o=>o.r.kind==='man').sort((a,b)=>a.r.x-b.r.x);
  let i=0;while(i<rows.length){const x0=rows[i].r.x;const th=x0<14?2.6:1.5;let j=i;while(j+1<rows.length&&rows[j+1].r.x-x0<=th)j++;
    const grp=rows.slice(i,j+1);
    if(grp.length>=2){const lx=Math.min(27.6,Math.max(...grp.map(o=>o.r.x)));grp.sort((a,b)=>a.r.y-b.r.y);
      const n=grp.length,my=grp.reduce((a,o)=>a+o.r.y,0)/n;
      // 마크들이 넓게 퍼지면 라인도 조금 넓힘. 단 틈은 GAP*1.15를 넘지 않게
      const spread=(grp[n-1].r.y-grp[0].r.y)/Math.max(1,n-1);const gap=clamp(spread,GAP*0.85,GAP*1.15);
      let y0=my-gap*(n-1)/2;y0=clamp(y0,1,14-gap*(n-1));
      grp.forEach((o,k)=>{const sx=lx,sy=y0+gap*k;if(hyp(sx-o.r.x,sy-o.r.y)<=2.5)out[o.q.id]={x:sx,y:sy,line:n};});}
    i=j+1;}
  lineSlots.t=G.t;lineSlots.g=G;lineSlots.v=out;return out;}
// 맨라인: 상대 하이가 우리 로우 쪽 사이드로 방향을 잡으면(로우가 못 따라갈 게 뻔하면) 우리 하이가 넘어가서 막기
// (상대 하이가 우리 로우한테 걸리면 그건 수비 성공 — 건드리지 않음)
// 공격시간 20초 이상 남았는데 4초쯤 공격을 안 하면(앞으로 못 나가면) 볼맨 어택+디나이. 볼맨이 키 근처로 오면 다시 라인·키 수비
function pressCheck(dt){const h=G.ball.holder&&P(G.ball.holder);if(!G.crossed||!h||h.team!=='A'){G.idle=0;G.bestX=null;G.press=false;return;}
  const kd=hyp(28-h.x,7.5-h.y);if(G.bestX==null||kd<G.bestX-0.5){G.bestX=kd;G.idle=0;}else G.idle+=dt; // 키까지 거리가 안 줄면(뱅뱅 돌거나 제자리) 시간 끄는 중
  if(!G.press&&G.idle>4&&40-G.shotT>=20&&h.x<24.5){G.press=true;ev('press',{});}
  if(G.press&&h.x>=24.5){G.press=false;G.idle=0;G.bestX=kd;}}
function ballAttack(dt){G.baCool=(G.baCool||0)-dt;if(G.baCool>0||!G.crossed)return;const h=G.ball.holder&&P(G.ball.holder);if(!h||h.team!=='A')return;
  let n=null,nd=4;for(const q of G.ps){if(q.team!=='D')continue;const k=hyp(q.x-h.x,q.y-h.y);if(k<nd){nd=k;n=q;}}const x=defOf(h);
  if(n&&x&&n!==x){const nm=markOf(n);G.sw[n.id]=h.id;G.sw[x.id]=nm;G.baCool=1.2;ev('switch',{a:n.id,b:x.id,why:'ballattack'});}}
function highSwitch(dt){G.hsCool=(G.hsCool||0)-dt;if(G.cut&&G.t>G.cut.until)G.cut=null;if(G.hsCool>0||!G.inbounded)return;
  const Ds=G.ps.filter(q=>q.team==='D');
  for(const a of G.ps){if(a.team!=='A'||parseFloat(a.cls)<2.5||a.v<1.0)continue;
    const hx=Math.cos(a.a),hy=Math.sin(a.a);const px=a.x+hx*a.v*1.0,py=a.y+hy*a.v*1.0; // 1초 뒤 예상 위치
    let d=null,dd=2.6;for(const q of Ds){const k=hyp(q.x-px,q.y-py);if(k<dd){dd=k;d=q;}}
    if(!d||parseFloat(d.cls)>1.5)continue;if((d.x-a.x)*hx+(d.y-a.y)*hy<=0)continue; // 로우 쪽으로 가는 중일 때만
    if(hyp(d.x-a.x,d.y-a.y)<1.6)continue; // 이미 로우한테 걸림 = 수비 성공
    let e=null,ed=5.5;for(const q of Ds){if(q===d||parseFloat(q.cls)<2)continue;const k0=rawDef(q).kind;if(k0==='trap'||k0==='ib'||k0==='chase')continue;if(G.ball.holder&&markOf(q)===G.ball.holder&&q!==defOf(a))continue;const k=hyp(q.x-px,q.y-py);if(k<ed){ed=k;e=q;}}
    if(!e)continue;const x=defOf(a);if(x&&x!==e){const em=markOf(e);G.sw[e.id]=a.id;G.sw[x.id]=em;}
    G.cut={id:e.id,a:a.id,until:G.t+1.3};G.hsCool=1.5;ev('switch',{a:e.id,b:x?x.id:'',why:'high'});return;}}
// 키 수비 (원헤드 ㅗ): 키 안 3명(코너 2 + 센터 1) + 밖에서 볼맨 따라다니는 헤드 1명
// 라인프레스 (인바운드 전): T = 3명 라인 + 인바운더 맡은 수비 센터라인 뒤 / Y = 2명 라인 + 삼각형 + 뒤 / 리버스 Y = 로우 2명 베이스라인 앞, 하이 게이트, 세이프티
function pressType(c){if(c.press!=='auto')return c.press;const L=c.lineD.map(Number).sort((a,b)=>b-a).slice(1);const mn=Math.min(...L),mx=Math.max(...L);return (mn>=1.5&&mx-mn<=1.0)?'T':'Y';}
// 라인프레스 역할 (매 순간 계산)
// - 세이프티(3차): 로우는 안 됨. T는 가장 강한 선수. Y는 보통 두 번째로 강한 선수, 공격이 다 내려가 있으면(제로탑) 가장 강한 선수
// - 2차라인(Y): 가장 빠르고 강한 선수(제로탑이면 두 번째)
// - 1차라인: 나머지. 각자 리시버 위(롱자리)에 서서 라인을 만듦(직선이 아니라 대각선이어도 됨)
// - 프레스 조건: 공격이 라인 아래에 있어야 함(탑으로 가는 1명 빼고). 아니면 프레스가 안 되니 맨투맨 라인수비로
function pressRoles(){const c=G.cfg;const lk=G.t+'/'+G.transT;if(G.pr&&G.pr.k===lk)return G.pr.v;let v=null;
  if(c.def==='manline'&&c.inPos==='press'&&!G.crossed){const PT=pressType(c);
    const D=G.ps.filter(q=>q.team==='D').sort((a,b)=>parseFloat(b.cls)-parseFloat(a.cls));
    const A=G.ps.filter(q=>q.team==='A'&&!(q.id==='A3'&&!G.inbounded));const top=A.filter(a=>a.x>=13&&a.id!==G.ball.holder);const zeroTop=top.length===0;
    if(PT==='RY'){v={PT,ry:true};}
    else{let S,L2=null,C=null;const DN=n=>P('D'+n);
      // 감독 기준: Y = 수비 2번 탑(세이프티), 1번 2차라인 / T = 2번 탑, 1번 라인 센터 (모의실험용으로 바꿀 수 있음)
      if(PT==='T'){S=DN(c.tSafe||2);C=DN(c.tCenter||1);}else{S=DN(c.ySafe||2);L2=DN(c.yL2||1);}
      if(parseFloat(S.cls)<1.5){const alt=D.find(q=>q!==L2&&q!==C&&parseFloat(q.cls)>=1.5);if(alt)S=alt;} // 세이프티에 로우는 안 됨
      const L1=D.filter(q=>q!==S&&q!==L2);
      const rcv=A.filter(a=>!top.includes(a));const used=new Set();const slots={};
      for(const q of L1.slice().sort((a,b)=>a.y-b.y)){let best=null,bd=1e9;for(const r of rcv){if(used.has(r))continue;const k=hyp(r.x-q.x,r.y-q.y);if(k<bd){bd=k;best=r;}}
        if(best){used.add(best);const gx=GOAL.x-best.x,gy=GOAL.y-best.y,g=hyp(gx,gy)||1;slots[q.id]={x:best.x+gx/g*1.45,y:best.y+gy/g*1.45+(best.y<7.5?-0.45:0.45),r:best.id};}}
      {const ss=L1.map(q=>slots[q.id]).filter(Boolean).sort((a,b)=>a.y-b.y);for(let i=1;i<ss.length;i++)if(ss[i].y-ss[i-1].y<2.4){const mid=(ss[i].y+ss[i-1].y)/2;ss[i-1].y=mid-1.2;ss[i].y=mid+1.2;}} // 1차라인끼리 너무 붙지 않게
      const sl=Object.values(slots);const lx=sl.length?Math.max(...sl.map(o=>o.x)):8;const my=sl.length?sl.reduce((s2,o)=>s2+o.y,0)/sl.length:7.5;
      for(const q of L1)if(!slots[q.id])slots[q.id]={x:lx,y:clamp(my+(q.y<my?-2.3:2.3),1,14)}; // 리시버가 모자라면 라인 채우기
      if(C&&L1.includes(C)&&L1.length===3){const ord=L1.map(q=>slots[q.id]).sort((a,b)=>a.y-b.y);const others=L1.filter(q=>q!==C).sort((a,b)=>slots[a.id].y-slots[b.id].y);
        slots[C.id]=ord[1];slots[others[0].id]=ord[0];slots[others[1].id]=ord[2];} // T: 센터 자리
      const above=A.filter(a=>a.x>lx+0.5);let valid=above.length<=1||!G.inbounded; /* 인바운드 전엔 무조건 프레스 위치 (예상이 틀리면 라인이 깨지는 리스크) */
      if(valid){G.prBad=0;G.prOn=true;}else{G.prBad=(G.prBad||0)+1;if(G.prBad<45&&G.prOn)valid=true;else G.prOn=false;} // 잠깐 흔들려도 바로 맨투맨으로 안 바꿈
      v={PT,S:S.id,L2:L2&&L2.id,L1:L1.map(q=>q.id),slots,lx,my,top:top.map(a=>a.id),zeroTop,valid};}}
  G.pr={k:lk,v};return v;}
function linePressTarget(p){const R=pressRoles();if(!R)return null;const c=G.cfg;
  if(R.ry){if(G.inbounded)return null;const D=G.ps.filter(q=>q.team==='D').sort((a,b)=>parseFloat(a.cls)-parseFloat(b.cls));const m={[D[0].id]:{x:1.7,y:6.0},[D[1].id]:{x:1.7,y:9.0},[D[3].id]:{x:6.5,y:7.5},[D[2].id]:{x:12.5,y:7.5}};return m[p.id]||null;}
  if(!R.valid)return null; // 라인 위에 공격이 2명 이상 → 프레스 불가, 맨투맨 라인수비
  const b0=G.ball;let h=b0.holder&&P(b0.holder);if((!h||h.team!=='A')&&b0.fly&&b0.fly.to)h=P(b0.fly.to); // 패스 중이면 받을 선수를 볼맨으로 봄
  if(!h||h.team!=='A')h={x:b0.x,y:b0.y,team:'A',id:'ball'};const live=G.inbounded;
  if(live&&R.PT==='T')return null; // T는 인바운드 후 맨투맨 라인수비로
  // 세이프티(3차): 볼맨 어택 안 함. 탑으로 빠지는 선수를 보고, 볼맨이 튀어나오는 걸 지켜봄
  if(p.id===R.S){const fw=G.ps.filter(a=>a.team==='A'&&a.id!==G.ball.holder&&!(a.id==='A3'&&!G.inbounded)).sort((a,b)=>b.x-a.x)[0];
    if(fw&&fw.x>R.lx+1)return {x:Math.min(fw.x+1.3,27),y:fw.y+(fw.y<7.5?-0.45:0.45)}; // 최전방 공격수
    const bx=live?h.x:R.lx,by=live?h.y:7.5;return {x:clamp(Math.max(R.lx+3.5,bx+3.5),7,14),y:clamp(by*0.4+7.5*0.6,2,13)};}
  if(!live){ // 인바운드 전·트랜지션
    if(R.slots[p.id])return R.slots[p.id];
    if(p.id===R.L2)return {x:Math.min(R.lx+(R.zeroTop?1.8:2.6),13),y:R.my};return null;}
  if(R.PT==='T')return null; // T는 인바운드 후 맨투맨 라인수비로
  // Y 로테이션
  const l1=R.L1.map(P);const bs=l1.slice().sort((a,b)=>Math.abs(a.y-h.y)-Math.abs(b.y-h.y))[0],opp=l1.find(q=>q!==bs);
  const A=G.ps.filter(a=>a.team==='A');
  if(p===bs){const tr=A.find(a=>a!==h&&a.x>h.x&&hyp(a.x-h.x,a.y-h.y)<2.4&&Math.abs(a.y-h.y)<1.6);
    if(tr)return {x:tr.x+0.9,y:clamp(tr.y+(tr.y<7.5?-0.9:0.9),0.7,14.3)};return {x:h.x+1.1,y:h.y+(h.y<7.5?-0.3:0.3)};}
  const oy=opp?R.slots[opp.id].y:7.5;const oppSide=A.filter(a=>a!==h&&a.x>R.lx-1.5&&Math.abs(a.y-oy)<3&&!R.top.includes(a.id));const follow=oppSide.length===1?oppSide[0]:null;
  if(p===opp){if(follow)return {x:follow.x+1.3,y:follow.y};if(oppSide.length>=2)return {x:R.lx,y:clamp(oy+Math.sign(oy-7.5||1)*1.5,0.8,14.2)};return R.slots[p.id];}
  if(p.id===R.L2){const inside=bs&&Math.abs(h.y-7.5)<Math.abs(bs.y-7.5)-0.3&&hyp(h.x-bs.x,h.y-bs.y)>1.6;
    if(h.x>R.lx-0.8||inside)return {x:h.x+1.1,y:h.y+(7.5-h.y)*0.1};
    if(!follow){let t=null,td=1e9;for(const a of A){if(a===h||a.x<R.lx-0.5||R.top.includes(a.id))continue;const k=hyp(a.x-p.x,a.y-p.y);if(k<td){td=k;t=a;}}if(t)return {x:t.x+1.3,y:t.y};}
    return {x:Math.min(R.lx+(R.zeroTop?1.8:2.6),13),y:clamp(h.y+(h.y<7.5?-1.5:1.5),1,14)};} // 볼맨이 라인을 돌아 나올 바깥쪽을 예측
  return null;}
function keyRoles(){const b=G.ball,h=b.holder&&P(b.holder);const bx=h?h.x:b.x;
  if(G.cfg.def==='key'){if(!G.km){const D=G.ps.filter(q=>q.team==='D').sort((a,b)=>parseFloat(b.cls)-parseFloat(a.cls));const head=D[1],center=D[0];const cs=[D[2],D[3]].sort((a,b)=>a.y-b.y);G.km={head:head.id,center:center.id,cL:cs[0].id,cR:cs[1].id};}return G.km;}
  if(G.cfg.keyDef==='none'||!G.crossed){G.km=null;return null;}
  if(!G.km&&h&&h.team==='A'&&bx>19&&G.ps.filter(q=>q.team==='D'&&q.x>21).length===4){const D=G.ps.filter(q=>q.team==='D');let head=defOf(h),hd=1e9;if(!head)for(const q of D){const k=hyp(q.x-h.x,q.y-h.y)+(parseFloat(q.cls)<=1?3:0);if(k<hd){hd=k;head=q;}}
    const rest=D.filter(q=>q!==head).sort((a,b)=>parseFloat(b.cls)-parseFloat(a.cls));const center=rest[0];const cs=rest.slice(1).sort((a,b)=>a.y-b.y);
    G.km={head:head.id,center:center.id,cL:cs[0].id,cR:cs[1].id};ev('keydef',{head:head.id});}
  if(G.km&&bx<13)G.km=null;return G.km;}
function keyDefTarget(p){const km=keyRoles();if(!km||G.press)return null;const b=G.ball,h=b.holder&&P(b.holder);const by=h?h.y:b.y;const sh=clamp((by-7.5)*0.15,-0.8,0.8);
  if(p.id===km.head){if(!G.inbounded)return {x:16,y:7.5};if(!h||h.team!=='A')return {x:b.x,y:b.y};return {x:Math.min(h.x+1.1,28-KEY.d-0.4),y:h.y+(GOAL.y-h.y)*0.1};}
  if(G.cfg.keyDef==='twohead'){ // 투헤드: 센터 자리 선수도 밖으로 나와 볼맨 다음 패스길을 막음, 키 안은 코너 2명
    if(p.id===km.center){let n=null,nd=1e9;for(const a of G.ps){if(a.team!=='A'||a===h)continue;const k=hyp(a.x-(h?h.x:b.x),a.y-by);if(k<nd){nd=k;n=a;}}
      if(n&&h)return {x:Math.min((h.x+n.x)/2+0.6,28-KEY.d-0.4),y:(h.y+n.y)/2};return {x:25.6,y:by};}
    if(p.id===km.cL)return {x:27.0,y:clamp(by-2.0,4.15,7.0)};if(p.id===km.cR)return {x:27.0,y:clamp(by+2.0,8.0,10.85)};}
  if(p.id===km.center)return {x:26.5,y:clamp(by,5.6,9.4)};
  if(p.id===km.cL)return {x:27.0,y:Math.max(4.15,4.15+sh)};
  if(p.id===km.cR)return {x:27.0,y:Math.min(10.85,10.85+sh)};return null;}
// 다이아몬드 프레스: 4번 베이스라인 1m 중앙, 2·3번 베이스라인 4.5m·사이드 2m, 1번 딥 센터 → 코너로 인바운드 허용 후 4번+볼 쪽 윙이 트랩
function diamondTarget(p){if(G.cfg.def!=='diamond'||G.crossed)return null;const b=G.ball,h=b.holder?P(b.holder):null;
  const A=G.ps.filter(q=>q.team==='A'&&q.id!=='A3');const far=Math.max(...A.map(q=>q.x));
  if(!G.inbounded||!h||h.team!=='A'){return ({4:{x:1.45,y:7.5},2:{x:4.5,y:2.3},3:{x:4.5,y:12.7},1:{x:clamp(far+1.5,9,16),y:7.5}})[p.num];}
  const side=h.y<7.5?2:3;
  if(p.num===4)return {x:h.x-1.2,y:h.y+(h.y<7.5?0.4:-0.4)}; // 볼맨과 베이스라인 사이 막기
  if(p.num===side)return {x:h.x+1.1,y:h.y+(7.5-h.y)*0.15}; // 볼 쪽 윙: 위에서 트랩
  if(p.num===1)return {x:clamp(far+1.5,9,17),y:clamp(h.y*0.3+7.5*0.7,3,12)}; // 롱패스 막기
  let n=null,nd=1e9;for(const a of A){if(a===h)continue;const k=hyp(a.x-h.x,a.y-h.y);if(k<nd){nd=k;n=a;}} // 반대쪽 윙: 다음 패스길
  return n?{x:(h.x+n.x)/2+0.5,y:(h.y+n.y)/2}:{x:8,y:7.5};}
function defenseAI(p){if(G.ball.roll&&chaser('D')===p)return steerTo(p,G.ball.x,G.ball.y,false);
  {const t=keyDefTarget(p)||diamondTarget(p)||linePressTarget(p);if(t)return steerTo(p,t.x,t.y,false);}
  const r=rawDef(p);
  if(G.cut&&G.cut.id===p.id){const a=P(G.cut.a);return steerTo(p,a.x+Math.cos(a.a)*a.v*0.9,a.y+Math.sin(a.a)*a.v*0.9,false);} // 넘어가서 길 끊기
  if(G.cfg.def==='manline'&&r.kind==='man'){const sl=lineSlots()[p.id];if(sl)return steerTo(p,sl.x,sl.y,false);}
  return steerTo(p,r.x,r.y,r.slow);}

/* ---------- 픽앤롤 ---------- */
function markOf(d){return G.sw[d.id]||(MARKS()[d.num]?'A'+MARKS()[d.num]:'');}
function defOf(a){return G.ps.find(q=>q.team==='D'&&markOf(q)===a.id);}
// 픽앤롤: 위쪽 동료가 볼맨의 수비를 픽 → 스위치 → 스위치된 수비가 볼맨을 따라감 → 픽한 선수가 넓은 공간에서 받음
function startPick(){if(!G||G.phase!=='live'||G.pick||G.pickCool>0)return false;const h=G.ball.holder&&P(G.ball.holder);if(!h||h.team!=='A')return false;
  const bd=defOf(h)||G.ps.filter(q=>q.team==='D').sort((a,b)=>hyp(a.x-h.x,a.y-h.y)-hyp(b.x-h.x,b.y-h.y))[0];if(!bd)return false;
  let pk=null,ps=-1e9;for(const a of G.ps){if(a.team!=='A'||a===h||a.id==='A'+cfg.me||(a.id==='A3'&&!G.inbounded))continue;const sc=(a.x-h.x)*0.8-hyp(a.x-bd.x,a.y-bd.y);if(sc>ps){ps=sc;pk=a;}} // 위쪽, 가까운 동료
  if(!pk)return false;const side=(pk.y>bd.y)?1:-1;G.pick={type:'pnr',picker:pk.id,def:bd.id,holder:h.id,phase:'go',t:0,side};msg(`${pk.num}번이 픽 갑니다`,1200);ev('pick',{kind:'pnr',picker:pk.id,def:bd.id,holder:h.id});return true;}
// 리버스 픽앤롤: 위에 있는 볼맨이 아래쪽 동료의 수비를 픽 → 동료가 넓은 공간으로 → 볼맨 수비가 선택 (볼맨을 따라오면 패스, 동료에게 가면 몰고 감)
function startReverse(){if(!G||G.phase!=='live'||G.pick||G.pickCool>0)return false;const h=G.ball.holder&&P(G.ball.holder);if(!h||h.team!=='A')return false;
  let mt=null,ms=1e9;for(const a of G.ps){if(a.team!=='A'||a===h||(a.id==='A3'&&!G.inbounded))continue;if(a.x>h.x-0.3)continue;const d=defOf(a);if(!d)continue;const k=hyp(d.x-h.x,d.y-h.y);if(k<ms&&k<7){ms=k;mt=a;}}
  if(!mt){msg('아래쪽에 픽 걸어줄 동료가 없어요',1200);return false;}const md=defOf(mt);
  G.pick={type:'rev',picker:h.id,def:md.id,mate:mt.id,holder:h.id,phase:'go',t:0,side:(h.y>md.y)?1:-1};msg(`리버스: ${mt.num}번 수비를 픽하세요`,1400);ev('pick',{kind:'rev',picker:h.id,def:md.id,mate:mt.id});return true;}
function pickAI(p){const k=G.pick;if(!k)return null;const d=P(k.def);const h=P(k.holder);
  if(k.type==='rev'){
    if(p.id===k.mate){if(k.phase==='roll'||k.phase==='set')return steerTo(p,Math.min(27.3,p.x+6),clamp(p.y-k.side*1.6,1,14),false);return {x:0,y:0};} // 픽 기다렸다가 넓은 공간으로
    if(p.id===k.picker&&p.id!=='A'+cfg.me){if(k.phase==='go')return steerTo(p,d.x+0.1,d.y+k.side*1.15,false);if(k.phase==='set')return {x:(d.x-p.x)*0.2,y:(d.y-p.y)*0.2};}
    return null;}
  if(k.picker!==p.id)return null;
  if(k.phase==='go'){const tx=d.x+0.15,ty=d.y+k.side*1.2;return steerTo(p,tx,ty,false);}
  if(k.phase==='set'){return {x:(d.x-p.x)*0.2,y:(d.y-p.y)*0.2};}
  if(k.phase==='roll'){if(h&&G.ball.holder===h.id&&h.id==='A'+cfg.me)passSel=p.id;return steerTo(p,Math.min(27.3,p.x+6),clamp(p.y+k.side*1.2,1,14),false);}
  return null;}
function stepPick(dt){const k=G.pick;if(!k)return;k.t+=dt;const d=P(k.def),pk=P(k.picker);
  if(k.phase==='go'&&hyp(d.x-pk.x,d.y-pk.y)<1.4){k.phase='set';k.t=0;
    if(k.type==='pnr'){const dPick=defOf(pk);if(dPick&&dPick!==d){G.sw[dPick.id]=k.holder;G.sw[d.id]=pk.id;ev('switch',{a:dPick.id,b:d.id});}}
    else{const h=P(k.holder),dH=defOf(h),mt=P(k.mate);if(dH){k.choice=Math.random()<0.5?'stay':'switch';if(k.choice==='switch'){G.sw[dH.id]=mt.id;G.sw[d.id]=h.id;}ev('reverse',{choice:k.choice});
      if(h.id==='A'+cfg.me)msg(k.choice==='stay'?`수비가 나를 따라와요 → ${mt.num}번에게 패스!`:'수비가 동료에게 갔어요 → 그대로 몰고 가세요!',1800);
      else if(k.choice==='stay')k.passLater=0.5;}}}
  if(k.phase==='set'&&k.t>0.7){k.phase='roll';k.t=0;if(k.type==='pnr')msg('롤!',800);else if(P(k.holder).id==='A'+cfg.me&&k.choice==='stay')passSel=k.mate;}
  if(k.type==='rev'&&k.phase==='roll'&&k.passLater!==undefined){k.passLater-=dt;if(k.passLater<=0&&G.ball.holder===k.holder){doPass(P(k.holder),P(k.mate));k.passLater=undefined;}}
  if(k.phase==='go'&&k.t>(k.type==='rev'&&k.picker==='A'+cfg.me?5:3.5)||k.phase==='roll'&&k.t>3){G.pick=null;G.pickCool=3;return;}
  if(G.ball.holder!==k.holder&&k.phase!=='roll'){G.pick=null;G.pickCool=2;}}

/* ---------- 물리 ---------- */
function stepChair(p,v,dt){
  const want=hyp(v.x,v.y);
  if(want>0.05){const ta=Math.atan2(v.y,v.x);let d=((ta-p.a+Math.PI*3)%(Math.PI*2))-Math.PI;
    // 뒤로 가는 경우: 반대로 돌기보다 후진(느리게)
    if(Math.abs(d)>2.4&&p.team==='D'&&(v.dist??9)<2.2){d=((ta+Math.PI-p.a+Math.PI*3)%(Math.PI*2))-Math.PI;p.a+=clamp(d,-p.turn*dt,p.turn*dt);p.v=Math.max(p.v-p.acc*dt,-p.max*0.45*want);}
    else{p.a+=clamp(d,-p.turn*dt,p.turn*dt);const align=Math.max(0,Math.cos(d));p.v=Math.min(p.v+p.acc*dt*align,p.max*want*Math.max(0.35,align));}
  }else{p.v*=Math.pow(0.18,dt);if(Math.abs(p.v)<0.05)p.v=0;}
  p.x+=Math.cos(p.a)*p.v*dt;p.y+=Math.sin(p.a)*p.v*dt;
}
// 갈고리(수비형 체어) 묶임 확률: 묶이는 선수 등급 × 갈고리 선수 등급. 정지해 있으면 1초마다 +10%(최대 +30%)
function hookProb(vc,hc){vc=parseFloat(vc);hc=parseFloat(hc);const col=hc<=0.5?0:hc<=1.0?1:2;
  if(vc>=3.0)return [0.05,0.15,0.30][col];if(vc>=2.0)return [0.10,0.20,0.35][col];
  if(vc>=1.5)return [0.30,0.55,0.80][col];if(vc>=1.0)return [0.55,0.80,0.80][col];return 0.80;}
function hookStep(dt){if(G.phase==='trans')return;G.contact=G.contact||{};const now={};
  for(const v of G.ps){v.still=Math.abs(v.v)<0.3?(v.still||0)+dt:0;
    if(v.hook){v.hook.t+=dt;const k=P(v.hook.by);if(!k||hyp(k.x-v.x,k.y-v.y)>2.6||v.hook.t>v.hook.dur){v.hook=null;ev('unhook',{who:v.id});}}}
  for(const k of G.ps){if(k.chair!=='D')continue;for(const v of G.ps){if(v.team===k.team||v.hook||v.id===G.ball.holder&&false)continue;const d=hyp(k.x-v.x,k.y-v.y);if(d>2*R+0.08)continue;
    const key=k.id+v.id;now[key]=1;if(G.contact[key])continue; // 새로 부딪힌 순간만
    const pr=Math.min(0.95,hookProb(v.cls,k.cls)+Math.min(0.3,(v.still||0)*0.1));
    if(Math.random()<pr){const diff=parseFloat(v.cls)-parseFloat(k.cls); // 등급 차이가 작을수록 오래 묶임 (차이 0.5 이하면 이번 공격 내내)
      const dur=diff<=0.5?40:diff<=1.0?4+Math.random()*4:diff<=2.0?1.5+Math.random()*2:0.8+Math.random();v.hook={by:k.id,t:0,dur};ev('hook',{who:v.id,by:k.id});}}}
  G.contact=now;}
function collide(){const ps=G.ps;
  for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const a=ps[i],b=ps[j];const dx=b.x-a.x,dy=b.y-a.y,d=hyp(dx,dy);if(d<2*R&&d>1e-4){const o=(2*R-d),ux=dx/d,uy=dy/d;
    // 버티기: 멈춰서 자리 잡은 휠체어는 잘 안 밀림 (블로킹·범퍼싸움 기초)
    // 버티는 휠체어: 바퀴(옆)로 받으면 안 밀림(판으로 수비), 범퍼(앞·뒤)로 받으면 미는 쪽 힘(등급)에 따라 조금 밀림
    const resist=(q,o2,nx,ny)=>{if(Math.abs(q.v)>=0.6)return 1;const side=Math.abs(Math.cos(q.a)*ny-Math.sin(q.a)*nx);if(side>0.7)return 40;return clamp(2.5*(1+(parseFloat(q.cls)-parseFloat(o2.cls))*0.35),0.8,5);};
    let ra=resist(a,b,ux,uy),rb=resist(b,a,-ux,-uy);
    if(a.team!==b.team&&G.phase!=='trans'){const fa=(Math.cos(a.a)*ux+Math.sin(a.a)*uy),fb=-(Math.cos(b.a)*ux+Math.sin(b.a)*uy);
      if(fa>0.5&&rb>=40)a.v=0; if(fb>0.5&&ra>=40)b.v=0;}
    const ka=rb/(ra+rb),kb=ra/(ra+rb);
    a.x-=ux*o*ka;a.y-=uy*o*ka;b.x+=ux*o*kb;b.y+=uy*o*kb;
    // 앞(범퍼)이 막히면 속도 감소
    if(a.team!==b.team&&G.phase!=='trans')for(const [p,s] of [[a,1],[b,-1]]){const fx=Math.cos(p.a),fy=Math.sin(p.a);const facing=(fx*ux+fy*uy)*s;if(facing>0.5)p.v*=0.55;}}}
  const live=G.phase!=='trans';for(const p of ps){const inb=p.id==='A3'&&!G.inbounded;p.x=clamp(p.x,(inb||p.id==='A3')?-1.6:(live?0.25:-0.5),28.6);p.y=live&&!inb?clamp(p.y,0.3,14.7):clamp(p.y,-1.2,16.2);}
}

/* ---------- 공 ---------- */
function holdPos(q){const a=q.a||0;return {x:q.x+Math.cos(a)*0.5-Math.sin(a)*0.55,y:q.y+Math.sin(a)*0.5+Math.cos(a)*0.55};}
function doPass(from,to){const s=holdPos(from);const t=P(to.id||to);const dist=hyp(t.x-s.x,t.y-s.y);
  // 받는 사람이 움직이는 방향으로 약간 앞
  const lead=Math.min(1.5,dist*0.12);const tx=t.x+Math.cos(t.a)*t.v*lead*0.6,ty=t.y+Math.sin(t.a)*t.v*lead*0.6;
  const far=hyp(tx-s.x,ty-s.y),maxd=from.pass;const k=far>maxd?maxd/far:1;
  G.ball={holder:null,x:s.x,y:s.y,fly:{sx:s.x,sy:s.y,tx:s.x+(tx-s.x)*k,ty:s.y+(ty-s.y)*k,t:0,dur:Math.max(0.35,far*k/9),from:from.id,to:t.id}};
  G.holdT=0;if(from.id==='A'+cfg.me)passSel=null;ev('pass',{from:from.id,to:t.id,d:+dist.toFixed(1),over:dist>from.pass});
  if(from.id==='A3'&&!G.inbounded){G.inbounded=true;ev('inbound',{to:t.id});}
}
function bounce(p){if(G.ball.holder!==p.id)return;G.holdT=0;ev('bounce',{who:p.id});flash=0.25;}

function stepBall(dt){const b=G.ball;
  if(b.fly){const f=b.fly;f.t+=dt;const u=Math.min(1,f.t/f.dur);b.x=f.sx+(f.tx-f.sx)*u;b.y=f.sy+(f.ty-f.sy)*u;
    // 가로채기
    const high=hyp(f.tx-f.sx,f.ty-f.sy)>4;if(u>(high?0.7:0.25)&&u<0.92)for(const d of G.ps){if(d.team!=='D')continue;if(hyp(d.x-b.x,d.y-b.y)<0.5){end('turnover','가로채기 당했어요',{by:d.id});return;}}
    // 잡기
    for(const a of G.ps){if(a.team!=='A'||a.id===f.from)continue;if(u>0.3&&hyp(a.x-b.x,a.y-b.y)<0.95){b.holder=a.id;b.fly=null;G.holdT=0;ev('catch',{who:a.id});return;}}
    if(u>=1){ // 아무도 못 잡으면 굴러감
      const dx=f.tx-f.sx,dy=f.ty-f.sy,d=hyp(dx,dy)||1;b.fly=null;b.roll={vx:dx/d*3.2,vy:dy/d*3.2};ev('loose',{x:+b.x.toFixed(1),y:+b.y.toFixed(1)});
      if(!G.inbounded){G.inbounded=true;}}
  }else if(b.roll){const r=b.roll;b.x+=r.vx*dt;b.y+=r.vy*dt;const sp=hyp(r.vx,r.vy);const ns=Math.max(0,sp-2.6*dt);if(sp>0){r.vx*=ns/sp;r.vy*=ns/sp;}
    if(b.x<0||b.x>28||b.y<0||b.y>15){end('turnover','공이 굴러서 코트 밖으로 나갔어요');return;}
    let best=null,bd=0.85;for(const q of G.ps){const d=hyp(q.x-b.x,q.y-b.y);if(d<bd){bd=d;best=q;}}
    if(best){if(best.team==='D'){end('turnover','굴러간 공을 뺏겼어요',{by:best.id});return;}b.holder=best.id;b.roll=null;G.holdT=0;ev('pickup',{who:best.id});}
  }else if(b.holder){const q=P(b.holder);const h=holdPos(q);b.x=h.x;b.y=h.y;}
}

/* ---------- 규칙·판정 ---------- */
function whistle(){if(!G||G.phase!=='ready')return;G.phase='live';msg('휘슬! 8초 안에 인바운드',1500);ev('whistle',{});}
function end(kind,text,extra){if(G.phase==='over')return;G.phase='over';G.result=kind;ev(kind,{text,...extra});
  const good=kind==='try'||kind==='foul';log(`${good?'득점':'실패'} · ${text} (${G.t.toFixed(1)}초)`,good?'good':'bad');
  stats.n++;if(good)stats.s++;
  hooks.end({kind,text,good,t:G.t});
}
const stats={n:0,s:0};
function rules(dt){
  const b=G.ball,holder=b.holder&&P(b.holder);
  const ib=P('A3');
  if(!G.inbounded){G.inboundT+=dt;
    for(const d of G.ps)if(d.team==='D'&&hyp(d.x-ib.x,d.y-ib.y)<1.85){end('foul','수비 1m 규정 위반 (테크니컬 파울)',{by:d.id});return;}
    if(G.inboundT>8){end('violation','8초 인바운드 바이올레이션');return;}return;}
  if(ib.x<0){const blocker=G.ps.find(d=>d.team==='D'&&d.x>ib.x&&Math.abs(d.y-ib.y)<0.9&&hyp(d.x-ib.x,d.y-ib.y)<1.3&&(Math.cos(d.a)*d.v*(ib.x-d.x)+Math.sin(d.a)*d.v*(ib.y-d.y))>0.05);if(blocker){end('foul','인바운더 메인휠 진입 방해 (테크니컬 파울)',{by:blocker.id});return;}}
  if(holder&&holder.team==='A'&&G.inbounded&&(holder.y<0.32||holder.y>14.68)){end('violation','볼맨이 사이드라인 밖으로 나감');return;}
  G.shotT+=dt;if(G.shotT>40){end('violation','40초 바이올레이션');return;}
  if(!G.crossed){G.backT+=dt;const bx=holder?holder.x:b.x;if(holder&&holder.x>=14&&!b.fly){G.crossed=true;ev('cross',{t:+G.backT.toFixed(1)});msg(`센터라인 통과 ${G.backT.toFixed(1)}초`,1200);}
    if(G.backT>12){end('violation','12초 바이올레이션');return;}}
  else if(holder&&holder.team==='A'&&holder.x<13.6){end('violation','백코트 바이올레이션 (프론트코트에서 다시 넘어감)');return;}
  if(holder){G.holdT+=dt;if(cfg.autoBounce&&G.holdT>5.5)bounce(holder);
    if(holder.team==='A'&&holder.id===('A'+cfg.me)&&req.bounce)bounce(holder);
    if(G.holdT>8){end('violation','8초 드리블 바이올레이션');return;}
    // 득점: 볼맨이 골라인을 넘으면 (포스트 사이)
    const front=holdPos(holder);if(holder.x>27.7&&Math.abs(holder.y-7.5)<KEY.w/2){end('try','골라인 통과');return;}}
  // 키 8초 (공격)
  for(const a of G.ps){if(a.team!=='A')continue;const ink=a.x>28-KEY.d&&Math.abs(a.y-7.5)<KEY.w/2;G.keyT[a.id]=ink?(G.keyT[a.id]||0)+dt:0;if(G.keyT[a.id]>8){end('violation',`${a.num}번 키 8초 바이올레이션`);return;}}
}
function sample(){const r=[+G.t.toFixed(2)];for(const p of G.ps)r.push(+p.x.toFixed(2),+p.y.toFixed(2));r.push(G.ball.holder||'',+G.ball.x.toFixed(2),+G.ball.y.toFixed(2));G.samples.push(r);}
function bestTargetForMe(){const q=me();const mates=G.ps.filter(p=>p.team==='A'&&p!==q&&!(p.id==='A3'&&!G.inbounded));if(!mates.length)return null;
  const sel=passSel&&mates.find(m=>m.id===passSel);if(sel)return sel;
  const aim=hooks.aim?hooks.aim():null;
  if(aim){let best=null,bd=1e9;for(const m of mates){const d=hyp(m.x-aim.x,m.y-aim.y);if(d<bd){bd=d;best=m;}}return best;}
  // 자동: 가장 가까운 동료
  let best=null,bd=1e9;for(const m of mates){const d=hyp(m.x-q.x,m.y-q.y);if(d<bd){bd=d;best=m;}}return best;}
/* ---------- 루프 ---------- */
let sampT=0;
// 데드타임엔 접촉 = 파울 → 앞에 사람이 있으면 옆으로 돌아서 감
function avoid(p,v){const m=hyp(v.x,v.y);if(m<0.05)return v;const ux=v.x/m,uy=v.y/m;let ax=0,ay=0;
  for(const q of G.ps){if(q===p)continue;const dx=q.x-p.x,dy=q.y-p.y,d=hyp(dx,dy);if(d>2.6||d<1e-3)continue;const ahead=(dx*ux+dy*uy)/d;if(ahead<-0.2)continue;
    const w=(2.6-d)/2.6*(0.6+ahead);const side=(dx*uy-dy*ux)>0?1:-1; // 오른쪽에 있으면 왼쪽으로
    ax+=(-dx/d)*w*0.6+(-uy*side)*w;ay+=(-dy/d)*w*0.6+(ux*side)*w;}
  let nx=v.x+ax,ny=v.y+ay;const n=hyp(nx,ny)||1;return {x:nx/n*m,y:ny/n*m,dist:v.dist};}
function transStep(dt){G.transT-=dt;const ib=P('A3');const mine=me();
  for(const p of G.ps){let v;
    if(p.id!=='A3'&&ctl(p.id))v=ctl(p.id);else if(p===mine&&p.id!=='A3')v=inputVec();
    else if(p.team==='A'&&G.cfg.backPick===String(p.num)){const vic=G.ps.filter(q=>q.team==='D').sort((a,b)=>parseFloat(a.cls)-parseFloat(b.cls))[0];const r=diamondTarget(vic)||rawDef(vic);const dx=r.x-vic.x,dy=r.y-vic.y,d=hyp(dx,dy)||1;
      v=(d>1.5&&vic.x<12.5)?steerTo(p,vic.x+dx/d*1.5,vic.y+dy/d*1.5,false):steerTo(p,p.home.x,p.home.y,true);} // 센터라인 넘어서까지는 안 따라감 // 백픽: 상대가 가려는 길 앞에 서기
    else if(p.team==='A')v=steerTo(p,p.home.x,p.home.y,true);
    else{curP=p;v=defenseAI(p);curP=null;} // 맨수비(맨투맨·맨라인): 마크보다 위(골 쪽)에서 진출을 눌러줌
    if(p.id==='A3'){v=steerTo(p,p.home.x,p.home.y,false);}
    v=avoid(p,v);{const st=(G.stuck[p.id]||0);if(st>0.8&&hyp(v.x,v.y)>0.2){const an=(p.num%2?1:-1)*1.2,c=Math.cos(an),sn=Math.sin(an);v={x:v.x*c-v.y*sn,y:v.x*sn+v.y*c};}}
    stepChair(p,v,dt);if(Math.abs(p.v)<0.3&&hyp(v.x,v.y)>0.3)G.stuck[p.id]=(G.stuck[p.id]||0)+dt;else G.stuck[p.id]=0;}
  collide();const h=holdPos(ib);G.ball.x=h.x;G.ball.y=h.y;
  if(G.transT<=0&&(hyp(ib.x-ib.home.x,ib.y-ib.home.y)<0.6||G.transT<-1.5)){ib.x=ib.home.x;ib.y=ib.home.y;ib.a=0;ib.v=0;for(const d of G.ps){if(d.team!=='D')continue;const dx=d.x-ib.x,dy=d.y-ib.y,k=hyp(dx,dy)||1;if(k<2.1){d.x=ib.x+dx/k*2.1;d.y=ib.y+dy/k*2.1;}}G.phase='live';msg('휘슬! 8초 안에 인바운드',1500);ev('whistle',{trans:true});}}
function rec(dt){G.rt=(G.rt||0)+dt;if(G.frames.length&&G.rt-G.frames[G.frames.length-1].rt<0.05)return;
  G.frames.push({rt:G.rt,t:G.t,ib:G.inbounded,ph:G.phase,ps:G.ps.map(p=>[p.x,p.y,p.a]),b:[G.ball.x,G.ball.y,G.ball.holder]});}
function tick(dt){
  if(G&&(G.phase==='trans'||G.phase==='live'))rec(dt);
  if(G&&G.phase==='ready'&&!me()&&cfg.autoWhistle!==false){G.readyT=(G.readyT||0)+dt;if(G.readyT>1)whistle();}
  if(G&&G.phase==='over'&&cfg.autoNext){G.nextT=(G.nextT==null?3:G.nextT)-dt;if(G.nextT<=0)newGame();}
  if(G&&G.phase==='trans'){transStep(dt);}
  if(G&&G.phase==='live'){G.t+=dt;if(G.cfg.def==='manline'&&!G.km)highSwitch(dt);pressCheck(dt);if(G.press)ballAttack(dt);flash=Math.max(0,flash-dt);
    const mine=me();
    for(const p of G.ps){let v;
      if(ctl(p.id))v=ctl(p.id);
      else if(p===mine)v=inputVec();
      else if(p.team==='A'&&cfg.mode==='ctrl'&&cfg.others==='stay'&&!(G.ball.roll&&chaser('A')===p))v={x:0,y:0};
      else if(p.team==='A'){curP=p;v=pickAI(p)||attackAI(p);curP=null;if((G.stuck[p.id]||0)>0.5&&hyp(v.x,v.y)>0.2){ // 막히면 옆으로 돌아가기
          let nd=null,dd=2.5;for(const d of G.ps){if(d.team!=='D')continue;const k=hyp(d.x-p.x,d.y-p.y);if(k<dd){dd=k;nd=d;}}
          if(nd){const side=((nd.y-p.y)*v.x-(nd.x-p.x)*v.y)>0?-1:1;const ang=side*1.25,c=Math.cos(ang),sn=Math.sin(ang);v={x:v.x*c-v.y*sn,y:v.x*sn+v.y*c,dist:v.dist};}}}
      else{curP=p;v=defenseAI(p);curP=null;}
      if(G.phase!=='live')break;
      if(p.id==='A3'&&!G.inbounded){p.v=0;continue;}
      if(p.team==='A'&&trapped(p)){v={x:v.x*0.08,y:v.y*0.08};}
      if(p.hook||G.ps.some(q=>q.hook&&q.hook.by===p.id)){v={x:v.x*0.05,y:v.y*0.05};} // 갈고리에 묶임 (묶은 쪽도 같이)
      stepChair(p,v,dt);
      if(Math.abs(p.v)<0.5&&hyp(v.x,v.y)>0.3)G.stuck[p.id]=(G.stuck[p.id]||0)+dt;else G.stuck[p.id]=0;}
    if(G.phase==='live'){
      // 내가 공을 가졌을 때 패스 (인바운더면 인바운드)
      if(req.pass&&me()){const q=me();const holderIsMe=G.ball.holder===q.id;if(holderIsMe){const t=bestTargetForMe();if(t)doPass(q,t);}}
      G.pickCool=Math.max(0,G.pickCool-dt);
      if(req.pick)startPick();else if(req.rev)startReverse();
      else if(cfg.pick==='auto'&&!G.pick&&G.ball.holder&&!ctl(G.ball.holder)){const h=P(G.ball.holder);if(h.team==='A'&&(G.stuck[h.id]||0)>0.8&&G.inbounded)startPick();}
      stepPick(dt);
      hookStep(dt);collide();stepBall(dt);if(G.phase==='live')rules(dt);
      sampT+=dt;if(sampT>=0.2){sampT=0;sample();}}
    }
  req.pass=false;req.bounce=false;req.pick=false;req.rev=false;}return {
  get G(){return G},get cfg(){return cfg},set cfg(v){cfg=v},stats,req,
  get passSel(){return passSel},set passSel(v){passSel=v},get flash(){return flash},
  newGame,tick,whistle,doPass,bounce,startPick,startReverse,P,me,defCount,bestTargetForMe,holdPos,
  KEY,KEYDRAW,R,speedOf};
}

/* ---------- 경기: 4피리어드 · 점수 · 공수 교대 · 사람 조종 ----------
   팀은 'B'(파랑)·'R'(빨강). 공격팀 선수는 엔진 안에서 A1~A4, 수비팀은 D1~D4.
   opts: { lines:{B:[..4],R:[..4]}, plen:초, names:{B,R}, human:{team:'B',num:1}|null,
           cfg:{엔진 설정}, msg, event, input, aim } */
function match(opts){opts=opts||{};
  const names=opts.names||{B:'A팀',R:'B팀'};
  const M={att:'B',per:1,gc:opts.plen||480,plen:opts.plen||480,score:{B:0,R:0},poss:0,fin:false,overT:0,scored:false,flip:false,human:opts.human||null,lines:opts.lines||{B:['3.0','2.0','1.5','0.5'],R:['3.0','2.0','1.5','0.5']}};
  const say=(t,ms)=>(opts.msg||(()=>{}))(t,ms);
  const sc=()=>`${names.B} ${M.score.B} : ${M.score.R} ${names.R}`;
  const other=t=>t==='B'?'R':'B';
  M.eid=(team,num)=>(team===M.att?'A':'D')+num;           // 팀·번호 → 엔진 id
  M.team=id=>id[0]==='A'?M.att:other(M.att);               // 엔진 id → 팀
  M.humanId=()=>M.human?M.eid(M.human.team,M.human.num):null;
  let lastEnd=null;
  const b=create(Object.assign({},opts,{
    cfg:Object.assign({mode:'watch',me:0,trans:true,autoBounce:true,pick:'auto',autoNext:false},opts.cfg||{}),
    control:id=>id===M.humanId()?b.inputVec():null,
    end:e=>{lastEnd=e;},
    beforeNew:()=>{const c=b.cfg;c.lineA=M.lines[M.att].slice();c.lineD=M.lines[other(M.att)].slice();if(opts.beforeNew)opts.beforeNew(M);}
  }));
  b.inputVec=()=>{const v=(opts.input||(()=>({x:0,y:0})))()||{x:0,y:0};const f=M.flip?-1:1;let x=(+v.x||0)*f,y=(+v.y||0)*f;const m=Math.hypot(x,y);if(m>1){x/=m;y/=m;}return {x,y};}; // 화면 기준 입력 → 엔진 좌표
  const flipCalc=()=>{const blueRight=M.per<=2;M.flip=!((M.att==='B')===blueRight);};
  function next(){M.poss++;M.att=other(M.att);M.overT=0;M.scored=false;lastEnd=null;flipCalc();b.newGame();say(`${names[M.att]} 공격`,1500);}
  M.start=()=>{M.att='B';M.per=1;M.gc=M.plen;M.score={B:0,R:0};M.poss=0;M.fin=false;M.overT=0;M.scored=false;lastEnd=null;flipCalc();b.newGame();say(`1피리어드 시작! ${names.B} 공격부터`,2600);};
  M.step=dt=>{const G=b.G;if(!G)return;
    b.tick(dt);
    if(M.fin)return;
    if(G.phase==='live'){M.gc-=dt;if(M.gc<=0){M.gc=0;G.phase='over';G.result='period';M.scored=true;M.overT=0;say(M.per<4?`${M.per}피리어드 끝 · ${sc()}`:`경기 끝! ${sc()}`,3400);}}
    if(G.phase==='over'){
      if(!M.scored){M.scored=true;const good=G.result==='try'||G.result==='foul';if(good)M.score[M.att]++;
        say(`${good?names[M.att]+' 득점!':names[M.att]+' 공격 끝'} ${lastEnd?lastEnd.text:''}`,3200);(opts.event||(()=>{}))('possEnd',{att:M.att,good,text:lastEnd&&lastEnd.text});}
      M.overT+=dt;
      if(M.overT>3.6){if(M.gc<=0){if(M.per>=4){M.fin=true;say(`경기 끝! ${sc()}`,0);(opts.event||(()=>{}))('final',{score:{...M.score}});return;}M.per++;M.gc=M.plen;if(M.per===3)say('후반전! 코트를 바꿔요',2600);}next();}}};
  // 사람 행동: 패스(방향 dir: 화면 기준, 없으면 앞쪽) / 드리블
  function target(q,inp){const G=b.G;const ms=G.ps.filter(t=>t.team==='A'&&t!==q&&!(t.id==='A3'&&!G.inbounded));if(!ms.length)return null;const m=Math.hypot(inp.x||0,inp.y||0);let best=null,bs=-1e9;
    for(const t of ms){const dx=t.x-q.x,dy=t.y-q.y,d=Math.hypot(dx,dy)||1;let s=-d*0.25;if(m>0.3)s+=((dx*inp.x+dy*inp.y)/(d*m))*5;else s+=dx>0?1:0;if(d>q.pass+2)s-=3;if(s>bs){bs=s;best=t;}}return best;}
  M.pass=(toId)=>{const G=b.G;if(!G||G.phase!=='live')return false;const id=M.humanId();const q=id&&b.P(id);if(!q||G.ball.holder!==id)return false;
    const t=toId?b.P(toId):target(q,b.inputVec());if(!t||t===q||(t.id==='A3'&&!G.inbounded))return false;b.doPass(q,t);return true;};
  M.aimTarget=()=>{const G=b.G;if(!G||G.phase!=='live')return null;const id=M.humanId();const q=id&&b.P(id);if(!q||G.ball.holder!==id)return null;return target(q,b.inputVec());};
  M.bounce=()=>{const G=b.G;if(!G||G.phase!=='live')return;const id=M.humanId();const q=id&&b.P(id);if(q&&G.ball.holder===id)b.bounce(q);};
  M.setHuman=h=>{M.human=h;};
  M.brain=b;M.names=names;
  return M;}

const API={VERSION,create,match,speedOf};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
root.RugbyBrain=API;
})(typeof window!=='undefined'?window:globalThis);
