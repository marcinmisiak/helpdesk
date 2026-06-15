#!/usr/bin/env node
'use strict';

const readline = require('readline');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function askHidden(question) {
  return new Promise(resolve => {
    process.stdout.write(question);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    function onData(ch) {
      if (ch === '\n' || ch === '\r' || ch === '') {
        stdin.removeListener('data', onData);
        if (stdin.setRawMode) stdin.setRawMode(!!wasRaw);
        process.stdout.write('\n');
        resolve(value);
      } else if (ch === '' || ch === '\b') {
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(question + '*'.repeat(value.length));
        }
      } else {
        value += ch;
        process.stdout.write('*');
      }
    }
    stdin.on('data', onData);
  });
}

async function main() {
  console.log('\n=== Tworzenie konta administratora ===\n');

  const email = (await ask('E-mail:         ')).trim();
  if (!email || !email.includes('@')) {
    console.error('Nieprawidłowy adres e-mail.');
    process.exit(1);
  }

  const imie    = (await ask('Imię:           ')).trim();
  const nazwisko = (await ask('Nazwisko:       ')).trim();
  if (!imie || !nazwisko) {
    console.error('Imię i nazwisko są wymagane.');
    process.exit(1);
  }

  const pass1 = await askHidden('Hasło:          ');
  const pass2 = await askHidden('Powtórz hasło:  ');
  rl.close();

  if (!pass1 || pass1.length < 8) {
    console.error('Hasło musi mieć co najmniej 8 znaków.');
    process.exit(1);
  }
  if (pass1 !== pass2) {
    console.error('Hasła nie są zgodne.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(pass1, 13);
  const now = Math.floor(Date.now() / 1000);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[existing]] = await conn.query('SELECT id FROM user WHERE email = ?', [email]);
    if (existing) {
      console.error(`Użytkownik z adresem ${email} już istnieje.`);
      process.exit(1);
    }

    const [result] = await conn.query(
      `INSERT INTO user (email, password, imie, nazwisko, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 10, ?, ?)`,
      [email, hash, imie, nazwisko, now, now]
    );
    const userId = result.insertId;

    await conn.query(
      'INSERT INTO auth_assignment (item_name, user_id, created_at) VALUES (?, ?, ?)',
      ['admin', userId, now]
    );

    await conn.commit();
    console.log(`\nKonto administratora utworzone pomyślnie.`);
    console.log(`  E-mail:   ${email}`);
    console.log(`  ID:       ${userId}`);
    console.log(`  Rola:     admin\n`);
  } catch (err) {
    await conn.rollback();
    console.error('Błąd bazy danych:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
