#!/usr/bin/env node
'use strict';
/**
 * Quyết định đang chờ xác nhận — đọc decisions.json, làm 2 việc:
 *
 *   node tools/decisions              liệt kê mục chưa xác nhận
 *   node tools/decisions render       sinh lại DECISIONS.md từ JSON
 *   node tools/decisions --json       xuất JSON đã chuẩn hoá (cho dashboard)
 *   node tools/decisions --strict     exit 1 nếu còn mục `blocking` chưa trả lời
 *
 * Vì sao JSON là nguồn sự thật chứ không phải Markdown: dashboard đọc và GHI NGƯỢC
 * phần `answer` qua resourceRoutes (nó validate JSON.parse trước khi lưu). Parse ngược
 * Markdown do người sửa tay là cách chắc chắn nhất để hỏng dữ liệu.
 *
 * Zero dependency, giống tools/qa và tools/boundary.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA = path.join(ROOT, 'decisions.json');
const OUT = path.join(ROOT, 'DECISIONS.md');

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (COLOR ? `[${code}m${s}[0m` : s);
const red = (s) => c('31', s);
const yellow = (s) => c('33', s);
const green = (s) => c('32', s);
const dim = (s) => c('2', s);
const bold = (s) => c('1', s);

const SEVERITY_LABEL = { blocking: 'Chặn', urgent: 'Gấp', soon: 'Nên sớm' };
const SEVERITY_RANK = { blocking: 3, urgent: 2, soon: 1 };

function load() {
  if (!fs.existsSync(DATA)) {
    console.error(red(`Không thấy ${path.relative(ROOT, DATA)}`));
    process.exit(2);
  }
  try {
    return JSON.parse(fs.readFileSync(DATA, 'utf8').replace(/^﻿/, ''));
  } catch (err) {
    console.error(red(`decisions.json không phải JSON hợp lệ: ${err.message}`));
    process.exit(2);
  }
}

/** Một quyết định coi là đã xác nhận khi có optionId VÀ có người ký tên. */
function isAnswered(d) {
  const a = d.answer || {};
  return Boolean(a.optionId && String(a.confirmedBy || '').trim());
}

function optionLabel(d, id) {
  const opt = (d.options || []).find((o) => o.id === id);
  return opt ? opt.label : id;
}

function renderMarkdown(data) {
  const L = [];
  const decisions = [...data.decisions].sort(
    (a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0),
  );

  L.push('# Quyết định đang chờ xác nhận');
  L.push('');
  L.push('> File này được SINH RA từ `decisions.json` bằng `npm run decisions:render`.');
  L.push('> Đừng sửa tay — sửa `decisions.json`, hoặc xác nhận qua dashboard.');
  L.push('');
  L.push(`Lập ngày ${data.createdAt}. Nguồn: ${data.source}`);
  L.push('');
  L.push('| # | Quyết định | Đang chặn | Mức | Trạng thái |');
  L.push('|---|---|---|---|---|');
  for (const d of decisions) {
    const st = isAnswered(d)
      ? `✅ ${optionLabel(d, d.answer.optionId)}`
      : '⬜ chờ xác nhận';
    L.push(`| ${d.id} | ${d.title} | ${d.blocks} | ${SEVERITY_LABEL[d.severity] || d.severity} | ${st} |`);
  }
  L.push('');
  L.push('---');
  L.push('');

  for (const d of decisions) {
    L.push(`## ${d.id}. ${d.title}`);
    L.push('');
    L.push(`- Mức: **${SEVERITY_LABEL[d.severity] || d.severity}** · Đang chặn: ${d.blocks}`);
    L.push(`- Repo liên quan: ${(d.repos || []).map((r) => `\`${r}\``).join(' · ')}`);
    L.push('');
    L.push('**Bối cảnh.** ' + d.context);
    L.push('');

    if (d.table) {
      L.push('| ' + d.table.columns.join(' | ') + ' |');
      L.push('|' + d.table.columns.map(() => '---').join('|') + '|');
      for (const row of d.table.rows) L.push('| ' + row.join(' | ') + ' |');
      L.push('');
    }

    if ((d.evidence || []).length) {
      L.push('**Bằng chứng.**');
      L.push('');
      for (const e of d.evidence) L.push(`- ${e.claim} — \`${e.source}\``);
      L.push('');
    }

    L.push('**Lựa chọn.**');
    L.push('');
    for (const o of d.options || []) {
      const mark = d.recommended === o.id ? ' _(đề xuất)_' : '';
      L.push(`- **${o.label}**${mark} — ${o.consequence}`);
    }
    L.push('');

    if (d.recommended) {
      L.push(`**Đề xuất:** ${optionLabel(d, d.recommended)}. ${d.recommendationReason || ''}`.trim());
    } else {
      L.push(`**Không đề xuất.** ${d.recommendationReason || 'Cần người quyết.'}`);
    }
    L.push('');

    if (isAnswered(d)) {
      L.push('```');
      L.push(`ĐÃ XÁC NHẬN: ${optionLabel(d, d.answer.optionId)}`);
      L.push(`Người xác nhận: ${d.answer.confirmedBy}    Ngày: ${d.answer.confirmedAt || '-'}`);
      if (d.answer.note) L.push(`Ghi chú: ${d.answer.note}`);
      L.push('```');
    } else {
      L.push('```');
      L.push('Chờ xác nhận. Chọn một:');
      for (const o of d.options || []) L.push(`  [ ] ${o.id} — ${o.label}`);
      if (d.answer && d.answer.note) L.push(`Cần điền thêm: ${d.answer.note}`);
      L.push('Người xác nhận:            Ngày:');
      L.push('```');
    }
    L.push('');
    L.push('---');
    L.push('');
  }

  if ((data.orderingNotes || []).length) {
    L.push('## Thứ tự bắt buộc');
    L.push('');
    for (const n of data.orderingNotes) L.push(`- ${n}`);
    L.push('');
  }

  return L.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const strict = args.includes('--strict');
  const command = args.find((a) => !a.startsWith('-')) || 'list';

  const data = load();
  const pending = data.decisions.filter((d) => !isAnswered(d));
  const blockingPending = pending.filter((d) => d.severity === 'blocking' || d.severity === 'urgent');

  if (command === 'render') {
    fs.writeFileSync(OUT, renderMarkdown(data) + '\n', 'utf8');
    console.log(`${green('OK')} Đã sinh ${path.relative(ROOT, OUT)} từ decisions.json`);
    console.log(dim(`   ${data.decisions.length} quyết định · ${pending.length} chờ xác nhận`));
    return;
  }

  if (command !== 'list') {
    console.error(`Lệnh không hợp lệ: ${command}. Dùng: list | render`);
    process.exitCode = 2;
    return;
  }

  if (asJson) {
    console.log(JSON.stringify({ total: data.decisions.length, pending: pending.map((d) => d.id), decisions: data.decisions }, null, 2));
  } else if (pending.length === 0) {
    console.log(`\n${green('OK')} Tất cả ${data.decisions.length} quyết định đã được xác nhận.\n`);
  } else {
    console.log(bold(`\nQuyết định chờ xác nhận — ${pending.length}/${data.decisions.length}\n`));
    for (const d of [...pending].sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0))) {
      const tag = d.severity === 'blocking' ? red('CHẶN  ') : d.severity === 'urgent' ? yellow('GẤP   ') : dim('SỚM   ');
      console.log(`${tag} ${bold(d.id)} ${d.title}`);
      console.log(`        ${dim('đang chặn: ' + d.blocks)}`);
      if (d.recommended) console.log(`        ${dim('-> đề xuất: ' + optionLabel(d, d.recommended))}`);
      console.log('');
    }
    console.log(dim(`Xác nhận qua dashboard, hoặc điền answer.optionId + answer.confirmedBy trong decisions.json`));
  }

  if (strict && blockingPending.length > 0) process.exitCode = 1;
}

main();
