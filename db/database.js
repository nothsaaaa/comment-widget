import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const db = new sqlite3.Database('./comments.db');

export const dbRun = promisify(db.run.bind(db));
export const dbAll = promisify(db.all.bind(db));
export const dbGet = promisify(db.get.bind(db));

export default db;
