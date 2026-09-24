import * as React from 'react';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { getPublicStandings } from '@/lib/actions/playerScoreActions';
import { resolveTop4Podium } from '@/lib/tournament-podium';
import { buildFinalStandingsBuffer } from '@/lib/export-final-standings';
import { ImageResponse } from 'next/og';

export type ReportEmailTriggerReason =
  | 'QUALIFIER_END'
  | 'FINALS_END'
  | 'ORGANIZER_CLEAR'
  | 'MANUAL';

export interface SendFinalStandingsEmailOptions {
  editionId?: string;
  triggerReason: ReportEmailTriggerReason;
  dayNumber?: number;
  customJpegBuffer?: Buffer;
}

/**
 * Builds a high-resolution server-rendered Standings visual image using next/og (Satori).
 */
export async function generateFinalStandingsImageBuffer(payload: any): Promise<Buffer> {
  const data = payload || {};
  const edition = data.edition || {};
  const blocks = Array.isArray(data.blocks) ? data.blocks : [];

  const standingTeamsMap = new Map<string, { id: string; name: string; logo?: string | null; tag?: string | null }>();
  blocks.forEach((b: any) => {
    (b.groups || []).forEach((g: any) => {
      (g.rows || []).forEach((r: any) => {
        if (r.teamId) {
          standingTeamsMap.set(r.teamId, { id: r.teamId, name: r.teamName, logo: r.teamLogo, tag: r.teamTag });
        }
      });
    });
    (b.knockout || []).forEach((k: any) => {
      if (k.team1Id && !standingTeamsMap.has(k.team1Id)) {
        standingTeamsMap.set(k.team1Id, { id: k.team1Id, name: k.team1Name });
      }
      if (k.team2Id && !standingTeamsMap.has(k.team2Id)) {
        standingTeamsMap.set(k.team2Id, { id: k.team2Id, name: k.team2Name });
      }
    });
  });

  const podium = resolveTop4Podium(blocks, standingTeamsMap);
  const rrBlock = blocks.find((b: any) => b.kind === 'LEAGUE' || b.kind === 'ROUND_ROBIN') || blocks[0];
  const rrRows: any[] = rrBlock?.groups?.[0]?.rows || [];

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // Calculate dynamic canvas height based on number of rows
  const rowCount = Math.min(rrRows.length, 12);
  const calculatedHeight = Math.max(900, 480 + rowCount * 42);

  const element = React.createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '1200px',
        height: `${calculatedHeight}px`,
        backgroundColor: '#0d0d0d',
        color: '#f9fafb',
        padding: '24px 32px',
        fontFamily: 'sans-serif',
        boxSizing: 'border-box',
      },
    },
    [
      // Header Banner
      React.createElement(
        'div',
        {
          key: 'header',
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '16px',
            borderBottom: '2px solid rgba(251,191,36,0.4)',
            marginBottom: '20px',
          },
        },
        [
          React.createElement('div', { key: 'h-left', style: { display: 'flex', flexDirection: 'column' } }, [
            React.createElement(
              'span',
              { key: 'title', style: { fontSize: '24px', fontWeight: 900, color: '#f9fafb', letterSpacing: '-0.5px' } },
              edition.title || 'CBOT Tournament Final Standings',
            ),
            React.createElement(
              'span',
              {
                key: 'sub',
                style: { fontSize: '11px', fontWeight: 700, color: '#fbbf24', marginTop: '4px', letterSpacing: '0.8px', textTransform: 'uppercase' },
              },
              'CBOT · CARROM BALU ONLINE TOURNAMENT',
            ),
          ]),
          React.createElement(
            'div',
            {
              key: 'h-right',
              style: {
                display: 'flex',
                fontSize: '11px',
                fontWeight: 700,
                color: '#fbbf24',
                backgroundColor: 'rgba(251,191,36,0.1)',
                border: '1px solid rgba(251,191,36,0.3)',
                padding: '6px 14px',
                borderRadius: '20px',
              },
            },
            `Final Standings · ${dateStr}`,
          ),
        ],
      ),

      // Podium Grid (Top 4 Cards, 2x2 grid)
      React.createElement(
        'div',
        {
          key: 'podium-title',
          style: { display: 'flex', fontSize: '15px', fontWeight: 900, color: '#f9fafb', marginBottom: '10px' },
        },
        '🏆 Top 4 Tournament Standings',
      ),
      React.createElement(
        'div',
        {
          key: 'podium-grid',
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '24px',
          },
        },
        [
          // 1st Place
          React.createElement(
            'div',
            {
              key: 'podium-1',
              style: {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                width: '560px',
                padding: '14px 18px',
                borderRadius: '12px',
                border: '2px solid rgba(251,191,36,0.7)',
                backgroundColor: 'rgba(251,191,36,0.08)',
              },
            },
            [
              React.createElement('span', { key: 'p1-badge', style: { fontSize: '13px', fontWeight: 900, color: '#fbbf24', letterSpacing: '1px' } }, '🥇 1ST PLACE'),
              React.createElement('div', { key: 'p1-t', style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' } }, [
                React.createElement('span', { key: 'p1-name', style: { fontSize: '20px', fontWeight: 900, color: '#f9fafb' } }, podium.champion?.teamName || 'TBD'),
                podium.champion?.tag ? React.createElement('span', { key: 'p1-tag', style: { fontSize: '13px', fontWeight: 700, color: '#fbbf24' } }, `[${podium.champion.tag}]`) : null,
              ]),
              React.createElement('span', { key: 'p1-det', style: { fontSize: '11px', color: '#fcd34d' } }, podium.champion?.matchDetail || 'Grand Final Winner'),
            ],
          ),
          // 2nd Place
          React.createElement(
            'div',
            {
              key: 'podium-2',
              style: {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                width: '560px',
                padding: '14px 18px',
                borderRadius: '12px',
                border: '2px solid rgba(203,213,225,0.5)',
                backgroundColor: 'rgba(203,213,225,0.06)',
              },
            },
            [
              React.createElement('span', { key: 'p2-badge', style: { fontSize: '13px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1px' } }, '🥈 2ND PLACE'),
              React.createElement('div', { key: 'p2-t', style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' } }, [
                React.createElement('span', { key: 'p2-name', style: { fontSize: '20px', fontWeight: 900, color: '#f9fafb' } }, podium.runnerUp?.teamName || 'TBD'),
                podium.runnerUp?.tag ? React.createElement('span', { key: 'p2-tag', style: { fontSize: '13px', fontWeight: 700, color: '#cbd5e1' } }, `[${podium.runnerUp.tag}]`) : null,
              ]),
              React.createElement('span', { key: 'p2-det', style: { fontSize: '11px', color: '#cbd5e1' } }, podium.runnerUp?.matchDetail || 'Grand Final Finalist'),
            ],
          ),
          // 3rd Place
          React.createElement(
            'div',
            {
              key: 'podium-3',
              style: {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                width: '560px',
                padding: '14px 18px',
                borderRadius: '12px',
                border: '2px solid rgba(217,119,6,0.5)',
                backgroundColor: 'rgba(217,119,6,0.06)',
              },
            },
            [
              React.createElement('span', { key: 'p3-badge', style: { fontSize: '13px', fontWeight: 900, color: '#d97706', letterSpacing: '1px' } }, '🥉 3RD PLACE'),
              React.createElement('div', { key: 'p3-t', style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' } }, [
                React.createElement('span', { key: 'p3-name', style: { fontSize: '20px', fontWeight: 900, color: '#f9fafb' } }, podium.thirdPlace?.teamName || 'TBD'),
                podium.thirdPlace?.tag ? React.createElement('span', { key: 'p3-tag', style: { fontSize: '13px', fontWeight: 700, color: '#d97706' } }, `[${podium.thirdPlace.tag}]`) : null,
              ]),
              React.createElement('span', { key: 'p3-det', style: { fontSize: '11px', color: '#f59e0b' } }, podium.thirdPlace?.matchDetail || 'Qualifier 2 Loser'),
            ],
          ),
          // 4th Place
          React.createElement(
            'div',
            {
              key: 'podium-4',
              style: {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                width: '560px',
                padding: '14px 18px',
                borderRadius: '12px',
                border: '2px solid rgba(113,113,122,0.4)',
                backgroundColor: 'rgba(113,113,122,0.06)',
              },
            },
            [
              React.createElement('span', { key: 'p4-badge', style: { fontSize: '13px', fontWeight: 900, color: '#71717a', letterSpacing: '1px' } }, '4️⃣ 4TH PLACE'),
              React.createElement('div', { key: 'p4-t', style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' } }, [
                React.createElement('span', { key: 'p4-name', style: { fontSize: '20px', fontWeight: 900, color: '#f9fafb' } }, podium.fourthPlace?.teamName || 'TBD'),
                podium.fourthPlace?.tag ? React.createElement('span', { key: 'p4-tag', style: { fontSize: '13px', fontWeight: 700, color: '#71717a' } }, `[${podium.fourthPlace.tag}]`) : null,
              ]),
              React.createElement('span', { key: 'p4-det', style: { fontSize: '11px', color: '#a1a1aa' } }, podium.fourthPlace?.matchDetail || 'Eliminator Loser'),
            ],
          ),
        ],
      ),

      // Round Robin Table Header
      React.createElement(
        'div',
        {
          key: 'rr-header',
          style: { display: 'flex', fontSize: '14px', fontWeight: 900, color: '#f9fafb', marginBottom: '8px' },
        },
        `Stage 1: ${rrBlock?.name || 'Round Robin Standings'}`,
      ),

      // Table Header Row
      React.createElement(
        'div',
        {
          key: 'tbl-header',
          style: {
            display: 'flex',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            padding: '8px 12px',
            fontSize: '11px',
            fontWeight: 800,
            color: '#94a3b8',
            borderRadius: '6px 6px 0 0',
          },
        },
        [
          React.createElement('span', { key: 'col-rk', style: { width: '40px' } }, '#'),
          React.createElement('span', { key: 'col-tm', style: { flex: 1 } }, 'Team'),
          React.createElement('span', { key: 'col-tot', style: { width: '70px', textAlign: 'center' } }, 'Total Pts'),
          React.createElement('span', { key: 'col-pl', style: { width: '55px', textAlign: 'center' } }, 'Played'),
          React.createElement('span', { key: 'col-w', style: { width: '50px', textAlign: 'center' } }, 'Won'),
          React.createElement('span', { key: 'col-l', style: { width: '50px', textAlign: 'center' } }, 'Lost'),
          React.createElement('span', { key: 'col-sc', style: { width: '85px', textAlign: 'center' } }, 'Team Score'),
          React.createElement('span', { key: 'col-ev', style: { width: '60px', textAlign: 'center' } }, 'Event'),
          React.createElement('span', { key: 'col-sl', style: { width: '60px', textAlign: 'center' } }, 'Slams'),
          React.createElement('span', { key: 'col-tg', style: { width: '60px', textAlign: 'center' } }, 'Target+'),
        ],
      ),

      // Table Rows
      ...rrRows.slice(0, 10).map((r: any, idx: number) =>
        React.createElement(
          'div',
          {
            key: `row-${idx}`,
            style: {
              display: 'flex',
              alignItems: 'center',
              padding: '7px 12px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.035)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            },
          },
          [
            React.createElement('span', { key: 'val-rk', style: { width: '40px', color: '#fbbf24', fontWeight: 900 } }, `${r.rank}`),
            React.createElement('span', { key: 'val-tm', style: { flex: 1, color: '#f9fafb' } }, r.teamName),
            React.createElement('span', { key: 'val-tot', style: { width: '70px', textAlign: 'center', color: '#fbbf24', fontWeight: 900 } }, `${r.total ?? 0}`),
            React.createElement('span', { key: 'val-pl', style: { width: '55px', textAlign: 'center', color: '#94a3b8' } }, `${r.matchesPlayed ?? 0}`),
            React.createElement('span', { key: 'val-w', style: { width: '50px', textAlign: 'center', color: '#34d399' } }, `${r.matchesWon ?? 0}`),
            React.createElement('span', { key: 'val-l', style: { width: '50px', textAlign: 'center', color: '#f87171' } }, `${r.matchesLost ?? 0}`),
            React.createElement('span', { key: 'val-sc', style: { width: '85px', textAlign: 'center', color: '#f9fafb' } }, `${r.teamScore ?? 0}`),
            React.createElement('span', { key: 'val-ev', style: { width: '60px', textAlign: 'center', color: '#cbd5e1' } }, `${r.eventPts ?? 0}`),
            React.createElement('span', { key: 'val-sl', style: { width: '60px', textAlign: 'center', color: '#cbd5e1' } }, `${r.slamBonus ?? 0}`),
            React.createElement('span', { key: 'val-tg', style: { width: '60px', textAlign: 'center', color: '#cbd5e1' } }, `${r.avgBonus ?? 0}`),
          ],
        ),
      ),

      // Footer
      React.createElement(
        'div',
        {
          key: 'footer',
          style: {
            display: 'flex',
            justifyContent: 'center',
            marginTop: 'auto',
            paddingTop: '16px',
            fontSize: '10px',
            color: 'rgba(255,255,255,0.3)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          },
        },
        'cbotworld.com · Generated by CBOT Tournament System',
      ),
    ],
  );

  const res = new ImageResponse(element, {
    width: 1200,
    height: calculatedHeight,
  });

  return Buffer.from(await res.arrayBuffer());
}

/**
 * Sends the automated email with the 5-sheet Excel and Standings JPEG/PNG image to cbotworld@gmail.com
 */
export async function sendFinalStandingsEmail({
  editionId,
  triggerReason,
  dayNumber,
  customJpegBuffer,
}: SendFinalStandingsEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // 1. Resolve Edition
    let targetEditionId = editionId;
    if (!targetEditionId) {
      const active = await prisma.edition.findFirst({
        where: { status: { in: ['IN_PROGRESS', 'COMPLETED'] } },
        orderBy: { number: 'desc' },
        select: { id: true },
      });
      targetEditionId = active?.id;
    }

    if (!targetEditionId) {
      return { success: false, error: 'No active edition found.' };
    }

    // 2. Fetch public standings payload
    const payload = await getPublicStandings(targetEditionId);
    if (!payload?.edition) {
      return { success: false, error: 'Could not load tournament standings data.' };
    }

    const editionTitle = payload.edition.title || `Edition ${payload.edition.number || ''}`;
    const editionSlug = editionTitle.replace(/\s+/g, '-').toLowerCase();

    // 3. Generate 5-sheet Excel workbook buffer
    const standingTeamsMap = new Map<string, { id: string; name: string; logo?: string | null; tag?: string | null }>();
    (payload.blocks || []).forEach((b: any) => {
      (b.groups || []).forEach((g: any) => {
        (g.rows || []).forEach((r: any) => {
          if (r.teamId) {
            standingTeamsMap.set(r.teamId, { id: r.teamId, name: r.teamName, logo: r.teamLogo, tag: r.teamTag });
          }
        });
      });
      (b.knockout || []).forEach((k: any) => {
        if (k.team1Id && !standingTeamsMap.has(k.team1Id)) {
          standingTeamsMap.set(k.team1Id, { id: k.team1Id, name: k.team1Name });
        }
        if (k.team2Id && !standingTeamsMap.has(k.team2Id)) {
          standingTeamsMap.set(k.team2Id, { id: k.team2Id, name: k.team2Name });
        }
      });
    });

    const excelBuffer = buildFinalStandingsBuffer({
      edition: payload.edition,
      blocks: payload.blocks || [],
      players: payload.players || [],
      standingTeamsMap,
    });

    // 4. Generate or use Standings Image buffer
    let imageBuffer: Buffer;
    if (customJpegBuffer && customJpegBuffer.length > 0) {
      imageBuffer = customJpegBuffer;
    } else {
      imageBuffer = await generateFinalStandingsImageBuffer(payload);
    }

    // 5. Setup Nodemailer Transporter
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER || 'cbotworld@gmail.com';
    const smtpPass = process.env.SMTP_PASS || 'zpfh eyiz eiqb gotm';
    const smtpFrom = process.env.SMTP_FROM || 'cbotworld@gmail.com';

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    // 6. Build Subject and HTML according to trigger reason
    let subject = '';
    let reasonDescription = '';

    switch (triggerReason) {
      case 'QUALIFIER_END':
        subject = `CBOT · End of Qualifier Match Day ${dayNumber ?? ''} Report (${editionTitle})`;
        reasonDescription = `End of Qualifier Match Day ${dayNumber ?? ''} results concluded and recorded.`;
        break;
      case 'FINALS_END':
        subject = `🏆 CBOT · Tournament Final Match & Championship Report (${editionTitle})`;
        reasonDescription = `Final match concluded! Official Top 4 championship podium and standings finalized.`;
        break;
      case 'ORGANIZER_CLEAR':
        subject = `⚠️ [BACKUP ARCHIVE] CBOT · Tournament Standings & Report Before Clear (${editionTitle})`;
        reasonDescription = `Automated backup archive generated prior to clearing tournament data in Organizer Dashboard.`;
        break;
      case 'MANUAL':
      default:
        subject = `CBOT · Final Standings & Tournament Report (${editionTitle})`;
        reasonDescription = `Official tournament standings report and image export.`;
        break;
    }

    const todayDateStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 28px; border-radius: 14px; max-width: 620px; margin: 0 auto; border: 1px solid #334155;">
        <div style="border-bottom: 2px solid #f59e0b; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #f59e0b; margin: 0; font-size: 22px;">CBOT · Carrom Balu Online Tournament</h2>
          <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px;">${editionTitle} — Official Tournament Archive</p>
        </div>

        <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 13px; color: #fde68a; font-weight: bold;">${reasonDescription}</p>
          <p style="margin: 4px 0 0; font-size: 11px; color: #cbd5e1;">Generated on: ${todayDateStr} IST</p>
        </div>

        <p style="font-size: 14px; color: #cbd5e1; margin-bottom: 12px;">Attached to this email are the official tournament documents:</p>
        <ul style="color: #94a3b8; font-size: 13px; line-height: 22px; padding-left: 20px;">
          <li><strong style="color: #f8fafc;">${editionSlug}-standings.jpg</strong> — Visual banner with CBOT logo, Top 4 podium, and Stage standings.</li>
          <li><strong style="color: #f8fafc;">${editionSlug}-report.xlsx</strong> — Complete 5-sheet workbook (Round Robin, Qualifiers, Finals, Player Rankings, Daily Scores).</li>
        </ul>

        <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0 16px;" />
        <p style="font-size: 11px; color: #64748b; margin: 0; text-align: center;">
          Sent automatically to cbotworld@gmail.com · CBOT Tournament System
        </p>
      </div>
    `;

    console.log(`[sendFinalStandingsEmail] Dispatching report email (${triggerReason}) to cbotworld@gmail.com...`);

    const info = await transporter.sendMail({
      from: `"CBOT Tournament System" <${smtpFrom}>`,
      to: 'cbotworld@gmail.com',
      subject,
      text: `${reasonDescription}\n\nPlease find attached the final standings visual banner and the complete 5-sheet tournament Excel report for ${editionTitle}.`,
      html: htmlBody,
      attachments: [
        {
          filename: `${editionSlug}-standings.jpg`,
          content: imageBuffer,
          contentType: 'image/jpeg',
        },
        {
          filename: `${editionSlug}-report.xlsx`,
          content: excelBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    });

    console.log(`[sendFinalStandingsEmail] Email successfully sent! MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('[sendFinalStandingsEmail] Failed to send report email:', error);
    return { success: false, error: error?.message || 'Failed to dispatch report email' };
  }
}
