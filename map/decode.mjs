import fs from 'fs';
const A="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const s=[0,1,2,3].map(i=>fs.readFileSync(`p${i}.txt`,'utf8').replace(/\n$/,'')).join('');
function dec(code){const nums=[];let v=0,sh=0;for(const ch of code){const b=A.indexOf(ch);if(b<0)throw new Error('bad '+ch);v|=(b&31)<<sh;if(b&32){sh+=5}else{nums.push((v&1)?~(v>>>1):(v>>>1));v=0;sh=0}}
 const pts=[];let la=0,lo=0;for(let i=0;i+1<nums.length;i+=2){la+=nums[i];lo+=nums[i+1];pts.push([+(lo*1e-5).toFixed(5),+(la*1e-5).toFixed(5)])}return pts}
const recs=s.split('~').map(r=>{const [t,n,c]=r.split('|');return t==='P'?{t,n,p:c.split(',').map(Number)}:{t,n,p:dec(c)}});
const cnt={};recs.forEach(r=>cnt[r.t]=(cnt[r.t]||0)+1);console.log(cnt);
recs.filter(r=>'LBM'.includes(r.t)).forEach(r=>console.log(r.t,r.n,r.p.length,JSON.stringify(r.p[0]),JSON.stringify(r.p.at(-1))));
fs.writeFileSync('decoded.json',JSON.stringify(recs));
