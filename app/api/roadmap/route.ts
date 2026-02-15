import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [로드맵 CSV 파서 API] (legacy_ref/roadmap 이전)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * GET : CSV 설계도 파일을 파싱하여 에피소드 목록 반환
 * POST: 특정 회차의 설계도 데이터 업데이트
 * 
 * CSV 파서는 외부 라이브러리 없이 직접 구현 (BOM, 따옴표, 쉼표 처리)
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CSV 파서 (외부 라이브러리 없이)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function parseCsvToRows(csvText: string): string[][] {
  // BOM 제거
  const text = csvText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') { field += '"'; i++; } // 따옴표 이스케이프
        else { inQuotes = false; }
      } else { field += ch; }
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (ch === '\r') { continue; } // Windows CRLF
    field += ch;
  }

  // 마지막 필드/행
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function parseCsvToTable(csvText: string): { headers: string[]; records: Record<string, string>[] } {
  const rows = parseCsvToRows(csvText);
  if (rows.length === 0) return { headers: [], records: [] };

  const headers = rows[0].map(h => (h || '').trim());
  const records: Record<string, string>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (!cols || cols.length === 0) continue;
    const record: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      record[headers[c] || `col_${c}`] = (cols[c] ?? '').toString();
    }
    records.push(record);
  }
  return { headers, records };
}

function escapeCsvField(value: string): string {
  const v = (value ?? '').toString();
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET: 로드맵 읽기
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('file') || '';
    const fallbackCount = 300; // 기본 화수

    // CSV 파일 찾기
    let csvPath = '';
    if (filename) {
      // 보안: 파일명만 허용
      if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
        return NextResponse.json({ error: '잘못된 파일명입니다.' }, { status: 400 });
      }
      csvPath = path.join(process.cwd(), filename);
    } else {
      // 프로젝트 루트에서 CSV 설계도 자동 탐색
      const candidates = [
        '300화_설계도.csv',
        '신작_500화_설계도.csv',
        '독고천마_200화_설계도.csv',
      ];
      for (const c of candidates) {
        const p = path.join(process.cwd(), c);
        if (fs.existsSync(p)) { csvPath = p; break; }
      }
    }

    // CSV 파싱
    let records: Record<string, string>[] = [];
    let headers: string[] = [];
    if (csvPath && fs.existsSync(csvPath)) {
      const csvText = fs.readFileSync(csvPath, 'utf-8');
      const parsed = parseCsvToTable(csvText);
      records = parsed.records;
      headers = parsed.headers;
    }

    // 회차 데이터 생성
    let maxEpisode = 0;
    const epKey = headers.find(h => h.includes('회차')) || '회차';

    for (const r of records) {
      const n = parseInt(String(r[epKey] || '').replace(/[^0-9]/g, ''));
      if (Number.isFinite(n)) maxEpisode = Math.max(maxEpisode, n);
    }

    const totalEpisodes = Math.max(fallbackCount, maxEpisode);
    const mergedData = [];

    for (let i = 1; i <= totalEpisodes; i++) {
      const record = records.find(r => {
        const k = Object.keys(r).find(key => key.includes('회차'));
        return k && parseInt(r[k].replace(/[^0-9]/g, '')) === i;
      });

      let title = `제${i}화`;
      let plotSummary = '';
      let isCompleted = false;

      if (record) {
        const titleKey = Object.keys(record).find(k => k.includes('소제목')) || '소제목';
        const plotKey = Object.keys(record).find(k => k.includes('줄거리')) || '핵심 줄거리';
        const noteKey = Object.keys(record).find(k => k.includes('노트') || k.includes('영상')) || '';

        const titleVal = String(record[titleKey] ?? '').trim();
        const plotVal = String(record[plotKey] ?? '').trim();
        const noteVal = noteKey ? String(record[noteKey] ?? '').trim() : '';

        if (titleVal || plotVal) {
          title = titleVal || `제${i}화`;
          plotSummary = plotVal;
          if (noteVal) plotSummary += `\n\n[노트] ${noteVal}`;
          isCompleted = true;
        }
      }

      mergedData.push({
        episode_number: i,
        title,
        plot_summary: plotSummary || '미작성',
        is_completed: isCompleted,
      });
    }

    return NextResponse.json({
      success: true,
      csvFile: csvPath ? path.basename(csvPath) : null,
      headers,
      totalEpisodes,
      completed: mergedData.filter(d => d.is_completed).length,
      episodes: mergedData,
    });

  } catch (error: any) {
    console.error('로드맵 로딩 오류:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST: 특정 회차 설계도 업데이트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const episode = Number(body?.episode);
    const csvFile = body?.csvFile;

    if (!Number.isFinite(episode) || episode < 1) {
      return NextResponse.json({ ok: false, error: 'episode 값이 올바르지 않습니다.' }, { status: 400 });
    }

    if (!csvFile) {
      return NextResponse.json({ ok: false, error: 'csvFile을 지정해주세요.' }, { status: 400 });
    }

    // 보안 검증
    if (csvFile.includes('/') || csvFile.includes('\\') || csvFile.includes('..')) {
      return NextResponse.json({ ok: false, error: '잘못된 파일명입니다.' }, { status: 400 });
    }

    const csvPath = path.join(process.cwd(), csvFile);
    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ ok: false, error: 'CSV 파일이 없습니다.' }, { status: 404 });
    }

    const csvText = fs.readFileSync(csvPath, 'utf-8');
    const { headers, records } = parseCsvToTable(csvText);

    if (!headers.length) {
      return NextResponse.json({ ok: false, error: 'CSV 헤더를 읽지 못했습니다.' }, { status: 500 });
    }

    const epKey = headers.find(h => h.includes('회차')) || '회차';
    const titleKey = headers.find(h => h.includes('소제목')) || '소제목';
    const plotKey = headers.find(h => h.includes('줄거리')) || '핵심 줄거리';

    const idx = records.findIndex(r => {
      const n = parseInt(String(r?.[epKey] ?? '').replace(/[^0-9]/g, ''));
      return n === episode;
    });

    if (idx === -1) {
      return NextResponse.json({ ok: false, error: `CSV에서 ${episode}화를 찾지 못했습니다.` }, { status: 404 });
    }

    // 업데이트
    const nextRecord = { ...records[idx] };
    if (body.subtitle) nextRecord[titleKey] = body.subtitle;
    if (body.plot) nextRecord[plotKey] = body.plot;

    const nextRecords = [...records];
    nextRecords[idx] = nextRecord;

    // CSV 재직렬화
    const lines: string[] = [];
    lines.push(headers.map(escapeCsvField).join(','));
    for (const r of nextRecords) {
      const cols = headers.map(h => escapeCsvField(String(r?.[h] ?? '')));
      lines.push(cols.join(','));
    }

    // 안전한 파일 쓰기 (임시 → 교체)
    const tmpPath = `${csvPath}.tmp`;
    fs.writeFileSync(tmpPath, lines.join('\n'), 'utf-8');
    fs.renameSync(tmpPath, csvPath);

    return NextResponse.json({ ok: true, episode, message: `${episode}화 설계도가 업데이트되었습니다.` });
  } catch (error: any) {
    console.error('설계도 저장 오류:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
