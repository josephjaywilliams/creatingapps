// One Minute (oneminapp1) backend: a Google Apps Script web app bound to a Google Sheet.
// It stores sign-ups, sends a confirmation email, then emails one one-minute prompt a day
// in each person's chosen time window. Setup steps are in backend/README.md.

const PROPS = PropertiesService.getScriptProperties();
const SITE_URL = PROPS.getProperty('SITE_URL') || 'https://josephjaywilliams.github.io/creatingapps/oneminapp1/';
const PROGRAM_DAYS = Number(PROPS.getProperty('PROGRAM_DAYS') || 14);
const SENDER_NAME = PROPS.getProperty('SENDER_NAME') || 'One Minute';

// Start hour of each delivery window, in the subscriber's own time zone (from the paper's study).
const WINDOWS = { morning: 10, afternoon: 15, evening: 19 };
const WINDOW_LABELS = { morning: '10 AM–12 PM', afternoon: '3–6 PM', evening: '7–10 PM' };

const SUBSCRIBERS = ['id', 'created', 'name', 'email', 'areas', 'window', 'timezone',
  'order', 'status', 'day', 'lastSent', 'recent'];
const EVENTS = ['time', 'id', 'type', 'promptId', 'detail'];

// Run once from the editor: creates the sheets and the hourly sending trigger.
function setup() {
  sheet_('subscribers', SUBSCRIBERS);
  sheet_('events', EVENTS);
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendDue')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendDue').timeBased().everyHours(1).create();
}

// The web page posts JSON here as text/plain (so the browser needs no CORS preflight).
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return text_('bad request'); }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    switch (body.action) {
      case 'signup': return text_(signup_(body));
      case 'confirm': return text_(update_(body.s, r => {
        if (r.status !== 'pending') return false;
        r.status = 'active';
        return true;
      }, 'confirmed'));
      case 'done': return text_(exists_(body.s) ? log_(body.s, 'done', body.p, '') : 'not found');
      case 'rewrite': return text_(exists_(body.s) ?
        log_(body.s, 'rewrite', body.p, String(body.text || '').slice(0, 1000)) : 'not found');
      case 'unsub': return text_(update_(body.s, r => { r.status = 'unsubscribed'; return true; }, 'unsubscribed'));
      default: return text_('unknown action');
    }
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return text_('One Minute backend is running.');
}

function signup_(b) {
  if (b.website) return 'ok'; // honeypot field filled in: a bot
  const email = String(b.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return 'bad email';
  if (!b.consent) return 'no consent';
  const name = String(b.name || '').trim().slice(0, 80);
  const areas = (Array.isArray(b.areas) ? b.areas : []).filter(a => DOMAINS[a]);
  const win = WINDOWS[b.window] !== undefined ? b.window : 'morning';
  let tz = String(b.timezone || '');
  try { Utilities.formatDate(new Date(), tz, 'H'); } catch (err) { tz = Session.getScriptTimeZone(); }

  // At most one confirmation email per address every 10 minutes.
  const cache = CacheService.getScriptCache();
  if (cache.get('signup:' + email)) return 'ok';
  cache.put('signup:' + email, '1', 600);

  const sh = sheet_('subscribers', SUBSCRIBERS);
  const rows = sh.getDataRange().getValues();
  const col = SUBSCRIBERS.indexOf('email');
  const existing = rows.findIndex((r, i) => i > 0 && r[col] === email);
  let sub;
  if (existing > 0) {
    sub = rowObj_(rows[existing]);
    if (sub.status === 'active') return 'ok';
    Object.assign(sub, { name, areas: areas.join(','), window: win, timezone: tz, status: 'pending', day: 0, lastSent: '' });
    sh.getRange(existing + 1, 1, 1, SUBSCRIBERS.length).setValues([objRow_(sub)]);
  } else {
    sub = {
      id: Utilities.getUuid(), created: new Date().toISOString(), name, email,
      areas: areas.join(','), window: win, timezone: tz,
      order: Math.random() < 0.5 ? 'action-first' : 'reflect-first',
      status: 'pending', day: 0, lastSent: '', recent: '',
    };
    sh.appendRow(objRow_(sub));
  }
  sendConfirm_(sub);
  log_(sub.id, 'signup', '', areas.join(',') + ' ' + win);
  return 'ok';
}

// Hourly trigger: send today's prompt to everyone whose window starts this hour.
function sendDue() {
  const sh = sheet_('subscribers', SUBSCRIBERS);
  const rows = sh.getDataRange().getValues();
  const now = new Date();
  for (let i = 1; i < rows.length; i++) {
    const r = rowObj_(rows[i]);
    if (r.status !== 'active') continue;
    const hour = Number(Utilities.formatDate(now, r.timezone, 'H'));
    const today = Utilities.formatDate(now, r.timezone, 'yyyy-MM-dd');
    if (hour !== WINDOWS[r.window] || r.lastSent === today) continue;
    if (MailApp.getRemainingDailyQuota() < 1) {
      log_('', 'error', '', 'daily email quota used up');
      return;
    }
    const prompt = pickPrompt_(r);
    const flow = flowFor_(r);
    try {
      sendPrompt_(r, prompt, flow);
    } catch (err) {
      log_(r.id, 'error', prompt.id, String(err));
      continue;
    }
    r.day = Number(r.day) + 1;
    r.lastSent = today;
    r.recent = [prompt.id].concat(String(r.recent || '').split(',').filter(Boolean)).slice(0, 6).join(',');
    if (r.day >= PROGRAM_DAYS) r.status = 'completed';
    sh.getRange(i + 1, 1, 1, SUBSCRIBERS.length).setValues([objRow_(r)]);
    log_(r.id, 'sent', prompt.id, flow + ' day ' + r.day);
  }
}

// Rotate through the person's chosen areas and avoid their last few prompts.
function pickPrompt_(r) {
  const areas = String(r.areas || '').split(',').filter(a => DOMAINS[a]);
  const pool = areas.length ? areas : Object.keys(DOMAINS);
  const domain = pool[Number(r.day) % pool.length];
  const recent = String(r.recent || '').split(',');
  const fresh = ACTIVITIES.filter(a => a.domain === domain && recent.indexOf(a.id) < 0);
  const options = fresh.length ? fresh : ACTIVITIES.filter(a => a.domain === domain);
  return options[Math.floor(Math.random() * options.length)];
}

// Like the paper's study: one week of immediate-action prompts and one of
// reflection-first prompts, in a randomly assigned order.
function flowFor_(r) {
  const firstWeek = Number(r.day) < 7;
  const actionFirst = r.order !== 'reflect-first';
  return firstWeek === actionFirst ? 'action' : 'reflect';
}

function sendConfirm_(sub) {
  const link = SITE_URL + 'act.html?a=confirm&s=' + sub.id;
  const hi = sub.name ? 'Hi ' + esc_(sub.name) + ',' : 'Hi,';
  MailApp.sendEmail({
    to: sub.email,
    name: SENDER_NAME,
    subject: 'Confirm your One Minute sign-up',
    body: (sub.name ? 'Hi ' + sub.name + ',' : 'Hi,') + '\n\nConfirm your sign-up to get one one-minute action a day for ' +
      PROGRAM_DAYS + ' days:\n' + link + '\n\nIf you didn\'t sign up, ignore this email.',
    htmlBody: card_(
      '<p>' + hi + '</p><p>Confirm your sign-up to get one one-minute action a day for ' + PROGRAM_DAYS +
      ' days, around ' + WINDOW_LABELS[sub.window] + '.</p>' + button_(link, 'Confirm my sign-up') +
      '<p style="color:#6b6b66;font-size:13px">If you didn\'t sign up, ignore this email.</p>'),
  });
}

function sendPrompt_(r, p, flow) {
  const done = SITE_URL + 'act.html?a=done&s=' + r.id + '&p=' + p.id;
  const rewrite = SITE_URL + 'act.html?a=rewrite&s=' + r.id + '&p=' + p.id;
  const unsub = SITE_URL + 'act.html?a=unsub&s=' + r.id;
  const lead = flow === 'reflect' ? p.reflect : p.action;
  const day = Number(r.day) + 1;
  const steps = p.steps.map(s => '<li>' + esc_(s) + '</li>').join('');
  MailApp.sendEmail({
    to: r.email,
    name: SENDER_NAME,
    subject: 'Your one minute: ' + p.title,
    body: lead + '\n\n' + p.steps.map((s, i) => (i + 1) + '. ' + s).join('\n') + '\n\n' + p.benefit +
      '\n\nDid it? Tap: ' + done + '\nRewrite this prompt in your own words: ' + rewrite +
      '\n\nDay ' + day + ' of ' + PROGRAM_DAYS + '. Stop these emails: ' + unsub,
    htmlBody: card_(
      '<p style="font-size:13px;color:#d9572b;margin:0 0 8px">' + esc_(DOMAINS[p.domain].long) + ' · day ' + day + ' of ' + PROGRAM_DAYS + '</p>' +
      '<h2 style="margin:0 0 12px;font-size:22px">' + esc_(p.title) + '</h2>' +
      '<p style="font-size:17px">' + esc_(lead) + '</p>' +
      '<ol style="padding-left:20px">' + steps + '</ol>' +
      '<p style="color:#6b6b66">' + esc_(p.benefit) + '</p>' +
      button_(done, 'I did it ✓') +
      '<p style="font-size:13px"><a href="' + rewrite + '" style="color:#d9572b">Rewrite this prompt in your own words</a></p>' +
      '<p style="font-size:12px;color:#6b6b66;margin-top:24px"><a href="' + unsub + '" style="color:#6b6b66">Stop these emails</a></p>'),
  });
}

function card_(inner) {
  return '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1d1d1b;line-height:1.5">' + inner + '</div>';
}

function button_(href, label) {
  return '<p style="margin:24px 0"><a href="' + href + '" style="background:#d9572b;color:#fff;padding:12px 24px;' +
    'border-radius:999px;text-decoration:none;font-weight:600">' + label + '</a></p>';
}

function update_(id, change, eventType) {
  const sh = sheet_('subscribers', SUBSCRIBERS);
  const rows = sh.getDataRange().getValues();
  const i = rows.findIndex((r, n) => n > 0 && r[0] === id);
  if (i < 1) return 'not found';
  const r = rowObj_(rows[i]);
  if (change(r)) {
    sh.getRange(i + 1, 1, 1, SUBSCRIBERS.length).setValues([objRow_(r)]);
    log_(id, eventType, '', '');
  }
  return 'ok';
}

function exists_(id) {
  return !!id && sheet_('subscribers', SUBSCRIBERS).getRange('A:A').getValues().some(r => r[0] === id);
}

function log_(id, type, promptId, detail) {
  sheet_('events', EVENTS).appendRow([new Date().toISOString(), String(id || '').slice(0, 40),
    type, String(promptId || '').slice(0, 40), detail]);
  return 'ok';
}

function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange('A:Z').setNumberFormat('@'); // keep dates and numbers as plain text
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

function rowObj_(row) {
  const o = {};
  SUBSCRIBERS.forEach((k, i) => { o[k] = row[i] === undefined ? '' : String(row[i]); });
  return o;
}

function objRow_(o) {
  return SUBSCRIBERS.map(k => (o[k] === undefined ? '' : String(o[k])));
}

function esc_(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function text_(s) {
  return ContentService.createTextOutput(s);
}
