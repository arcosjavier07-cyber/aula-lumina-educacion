require('dotenv').config();
const path=require('node:path');
const fs=require('node:fs');
const Database=require('better-sqlite3');
const {Pool}=require('pg');

async function main(){
 if(!process.env.DATABASE_URL)throw new Error('Configura DATABASE_URL con la URL de tu base Neon antes de migrar.');
 const dataDir=process.env.DATA_DIR||path.join(__dirname,'..','data');
 const sourcePath=path.join(dataDir,'aula-lumina.sqlite');
 if(!fs.existsSync(sourcePath))throw new Error(`No encontré la base SQLite de origen en ${sourcePath}. No se modificó ningún dato.`);
 const sqlite=new Database(sourcePath,{readonly:true,fileMustExist:true});
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:10000});
 const client=await pool.connect();
 try{
  await client.query(`CREATE TABLE IF NOT EXISTS users (
   id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
   password_hash TEXT NOT NULL, salt TEXT NOT NULL, profile TEXT NOT NULL,
   details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS student_profiles (
   user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, matricula TEXT NOT NULL UNIQUE
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS classes (
   id BIGSERIAL PRIMARY KEY, teacher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   name TEXT NOT NULL, academic_level TEXT NOT NULL, subject TEXT NOT NULL,
   class_type TEXT NOT NULL, class_code TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS class_roster (
   id BIGSERIAL PRIMARY KEY, class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
   student_id BIGINT REFERENCES users(id) ON DELETE SET NULL, matricula TEXT NOT NULL,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(class_id,matricula)
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS assignments (
   id BIGSERIAL PRIMARY KEY, class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
   title TEXT NOT NULL, instructions TEXT NOT NULL, due_at TIMESTAMPTZ NOT NULL,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS assignment_submissions (
   id BIGSERIAL PRIMARY KEY, assignment_id BIGINT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
   student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   body TEXT NOT NULL, submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   grade INTEGER CHECK (grade BETWEEN 0 AND 100), feedback TEXT NOT NULL DEFAULT '',
   graded_at TIMESTAMPTZ, UNIQUE(assignment_id,student_id)
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS sessions (
   token_hash TEXT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   expires_at TIMESTAMPTZ NOT NULL
  )`);
  await client.query('CREATE INDEX IF NOT EXISTS class_roster_student_idx ON class_roster(student_id)');
  const targetCounts=await client.query('SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM classes) AS classes');
  if(Number(targetCounts.rows[0].users)||Number(targetCounts.rows[0].classes))throw new Error('La base Neon ya contiene cuentas o clases. Para evitar sobrescribir datos, esta migración solo acepta una base vacía.');
  const users=sqlite.prepare('SELECT id,name,email,password_hash,salt,profile,details,created_at FROM users ORDER BY id').all();
  const hasTable=name=>Boolean(sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
  const classes=hasTable('classes')?sqlite.prepare('SELECT id,teacher_id,name,academic_level,subject,class_type,class_code,created_at FROM classes ORDER BY id').all():[];
  const roster=hasTable('class_roster')?sqlite.prepare('SELECT id,class_id,student_id,matricula,created_at FROM class_roster ORDER BY id').all():[];
  const assignments=hasTable('assignments')?sqlite.prepare('SELECT id,class_id,title,instructions,due_at,created_at FROM assignments ORDER BY id').all():[];
  const submissions=hasTable('assignment_submissions')?sqlite.prepare('SELECT id,assignment_id,student_id,body,submitted_at,grade,feedback,graded_at FROM assignment_submissions ORDER BY id').all():[];
  const sessions=hasTable('sessions')?sqlite.prepare('SELECT token_hash,user_id,expires_at FROM sessions').all():[];
  await client.query('BEGIN');
  for(const user of users){
   const details=JSON.parse(user.details||'{}');
   await client.query('INSERT INTO users (id,name,email,password_hash,salt,profile,details,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,COALESCE($8::timestamptz,NOW()))',[user.id,user.name,user.email,user.password_hash,user.salt,user.profile,JSON.stringify(details),user.created_at||null]);
   const matricula=String(details.studentId||'').trim().toUpperCase();
   if(user.profile==='alumno'&&matricula)await client.query('INSERT INTO student_profiles (user_id,matricula) VALUES ($1,$2) ON CONFLICT DO NOTHING',[user.id,matricula]);
  }
  for(const klass of classes)await client.query('INSERT INTO classes (id,teacher_id,name,academic_level,subject,class_type,class_code,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz,NOW()))',[klass.id,klass.teacher_id,klass.name,klass.academic_level,klass.subject,klass.class_type,klass.class_code,klass.created_at||null]);
  for(const entry of roster)await client.query('INSERT INTO class_roster (id,class_id,student_id,matricula,created_at) VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz,NOW())) ON CONFLICT(class_id,matricula) DO NOTHING',[entry.id,entry.class_id,entry.student_id,entry.matricula,entry.created_at||null]);
  for(const assignment of assignments)await client.query('INSERT INTO assignments (id,class_id,title,instructions,due_at,created_at) VALUES ($1,$2,$3,$4,$5::timestamptz,COALESCE($6::timestamptz,NOW()))',[assignment.id,assignment.class_id,assignment.title,assignment.instructions,assignment.due_at,assignment.created_at||null]);
  for(const submission of submissions)await client.query('INSERT INTO assignment_submissions (id,assignment_id,student_id,body,submitted_at,grade,feedback,graded_at) VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz,NOW()),$6,$7,$8::timestamptz) ON CONFLICT(assignment_id,student_id) DO NOTHING',[submission.id,submission.assignment_id,submission.student_id,submission.body,submission.submitted_at||null,submission.grade,submission.feedback||'',submission.graded_at||null]);
  for(const session of sessions)await client.query('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3::timestamptz) ON CONFLICT DO NOTHING',[session.token_hash,session.user_id,session.expires_at]);
  await client.query("SELECT setval(pg_get_serial_sequence('users','id'),COALESCE((SELECT MAX(id) FROM users),1),EXISTS(SELECT 1 FROM users))");
  await client.query("SELECT setval(pg_get_serial_sequence('classes','id'),COALESCE((SELECT MAX(id) FROM classes),1),EXISTS(SELECT 1 FROM classes))");
  await client.query("SELECT setval(pg_get_serial_sequence('class_roster','id'),COALESCE((SELECT MAX(id) FROM class_roster),1),EXISTS(SELECT 1 FROM class_roster))");
  await client.query("SELECT setval(pg_get_serial_sequence('assignments','id'),COALESCE((SELECT MAX(id) FROM assignments),1),EXISTS(SELECT 1 FROM assignments))");
  await client.query("SELECT setval(pg_get_serial_sequence('assignment_submissions','id'),COALESCE((SELECT MAX(id) FROM assignment_submissions),1),EXISTS(SELECT 1 FROM assignment_submissions))");
  await client.query('COMMIT');
  console.log(`Migración completada: ${users.length} cuentas, ${classes.length} clases, ${roster.length} vínculos, ${assignments.length} tareas, ${submissions.length} entregas y ${sessions.length} sesiones. La base SQLite original sigue intacta.`);
 }catch(error){
  try{await client.query('ROLLBACK')}catch{}
  throw error;
 }finally{
  sqlite.close();client.release();await pool.end();
 }
}

main().catch(error=>{console.error('No se completó la migración:',error.message);process.exitCode=1});
