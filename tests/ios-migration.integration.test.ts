import { describe,it,expect } from 'vitest';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import journal from '../migrations/meta/_journal.json';
const suite=process.env.CHATBOT_TEST_DATABASE_URL?describe:describe.skip;
suite('iOS migration backfill',()=>{
 it('upgrades existing records without inventing an amount or losing reminder status',async()=>{
  const source=new URL(process.env.CHATBOT_TEST_DATABASE_URL!);if(!source.pathname.includes('test'))throw new Error('Isolated test database required');
  const admin=new Pool({connectionString:source.toString()});const db='ios_upgrade_test_'+crypto.randomUUID().replaceAll('-','');let target:Pool|undefined;
  try {
   await admin.query(`CREATE DATABASE "${db}"`);source.pathname='/'+db;target=new Pool({connectionString:source.toString()});
   for(const entry of journal.entries.filter(e=>e.idx<11))await target.query(await readFile(`migrations/${entry.tag}.sql`,'utf8'));
   const user=crypto.randomUUID();await target.query('INSERT INTO "user"(id,email,base_currency) VALUES($1,$2,$3)',[user,'legacy@example.test','PKR']);
   await target.query("INSERT INTO category(name,type,user_id) VALUES('Salary','INCOME',$1)",[user]);
   await target.query("INSERT INTO reminder(title,due_date,status,user_id) VALUES('Legacy bill',now(),'COMPLETED',$1)",[user]);
   await target.query('BEGIN');await target.query(await readFile('migrations/0011_ios_field_gaps.sql','utf8'));await target.query('COMMIT');
   const reminder=(await target.query('SELECT * FROM reminder')).rows[0];expect(reminder).toMatchObject({amount:null,currency:'PKR',frequency:'ONCE',status:'COMPLETED',is_enabled:true,account_id:null});
   expect((await target.query('SELECT icon_name,monthly_budget FROM category')).rows[0]).toEqual({icon_name:'briefcase.fill',monthly_budget:null});
  } finally {await target?.end();await admin.query(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`);await admin.end();}
 });
});
