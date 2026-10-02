import pg from 'pg';
const email=`ui-platform-${Date.now()}@example.test`;
const response=await fetch('http://127.0.0.1:4317/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json','X-Gotek-Request':'1'},body:JSON.stringify({email,password:'Local-platform-test-2026',fullName:'Platform UI Test',business:'Platform UI Test',phone:'0900000000'})});
if(response.status!==202)throw new Error('Fixture signup failed');
const db=new pg.Client({host:'127.0.0.1',port:55432,user:'gotek_migrator',database:'gotek_chatbot'});await db.connect();await db.query('INSERT INTO platform_admins(user_id) SELECT id FROM users WHERE email=$1',[email]);await db.end();console.log(email);
