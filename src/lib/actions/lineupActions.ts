'use server';

import { prisma } from '@/lib/prisma';
import { MatchLineupSlot } from '@/types';
import { revalidatePath } from 'next/cache';
import { isCombiSubmissionLocked, combiCalendarDate } from '@/lib/combi-cutoff';
import { ensureOfficialDayDates } from '@/lib/edition-day-dates';
import { resolveCurrentEdition } from '@/lib/current-edition';
import { currentServerIstTimestamp } from '@/lib/ist-time';

export async function submitMatchLineup(data: {
  matchId: string;
  teamId: string;
  teamName: string;
  captainId: string;
  slots: MatchLineupSlot[];
}) {
  try {
    const existingLineup = await prisma.matchLineup.findUnique({
      where: { matchId_teamId: { matchId: data.matchId, teamId: data.teamId } }
    });

    let lineupId = '';

    if (existingLineup) {
      // Delete existing slots to fully replace them
      await prisma.matchLineupSlot.deleteMany({
        where: { lineupId: existingLineup.id }
      });
      await prisma.matchLineup.update({
        where: { id: existingLineup.id },
        data: { status: 'SUBMITTED', submittedAt: new Date() }
      });
      lineupId = existingLineup.id;
    } else {
      const newLineup = await prisma.matchLineup.create({
        data: {
          matchId: data.matchId,
          teamId: data.teamId,
          status: 'SUBMITTED',
          submittedAt: new Date(),
        }
      });
      lineupId = newLineup.id;
    }

    // Create slots and their players
    for (const slot of data.slots) {
      const createdSlot = await prisma.matchLineupSlot.create({
        data: {
          lineupId,
          formatType: slot.formatType,
          patternId: slot.patternId,
          patternName: slot.patternName,
        }
      });

      const playerPromises = slot.playerIds.map((pid: string) => 
        prisma.matchLineupSlotPlayer.create({
          data: {
            slotId: createdSlot.id,
            userId: pid,
          }
        })
      );

      await Promise.all(playerPromises);
    }

    revalidatePath('/dashboard/captain');
    revalidatePath('/fixtures');

    return { success: true, message: 'Lineup submitted successfully' };
  } catch (error) {
    console.error('Failed to submit lineup:', error);
    return { success: false, error: 'Failed to submit lineup' };
  }
}

export async function lockMatchLineup(lineupId: string) {
  try {
    const lineup = await prisma.matchLineup.update({
      where: { id: lineupId },
      data: { status: 'LOCKED', lockedAt: new Date() }
    });
    return { success: true, lineup };
  } catch (error) {
    return { success: false, error: 'Lineup not found or could not be locked' };
  }
}

export async function overrideMatchLineup(lineupId: string, updatedSlots: MatchLineupSlot[], notes: string) {
  try {
    // Delete existing slots
    await prisma.matchLineupSlot.deleteMany({
      where: { lineupId }
    });

    // Recreate slots
    for (const slot of updatedSlots) {
      const createdSlot = await prisma.matchLineupSlot.create({
        data: {
          lineupId,
          formatType: slot.formatType,
          patternId: slot.patternId,
          patternName: slot.patternName,
        }
      });

      const playerPromises = slot.playerIds.map((pid: string) => 
        prisma.matchLineupSlotPlayer.create({
          data: {
            slotId: createdSlot.id,
            userId: pid,
          }
        })
      );

      await Promise.all(playerPromises);
    }

    const lineup = await prisma.matchLineup.update({
      where: { id: lineupId },
      data: { status: 'OVERRIDDEN', overrideNotes: notes }
    });

    return { success: true, lineup };
  } catch (error) {
    return { success: false, error: 'Failed to override lineup' };
  }
}

export async function sendLineupEmailAction(data: {
  teamName: string;
  captainName: string;
  captainEmail?: string;
  dayNumber: number;
  rounds: Array<{ name: string; players: string[] }>;
}) {
  try {
    const nodemailer = require('nodemailer');
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || 'noreply@cbotworld.com';

    let transporter;

    if (smtpHost && smtpUser && smtpPass) {
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      console.log(`[SMTP] Sending lineup email using production host: ${smtpHost}`);
    } else {
      console.log('[SMTP] SMTP variables not set. Creating test SMTP account via Ethereal...');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    const roundListHtml = data.rounds
      .map(
        (r) => `
      <div style="padding: 10px; margin-bottom: 8px; border-radius: 8px; background-color: #f8fafc; border: 1px solid #e2e8f0;">
        <span style="font-weight: bold; color: #d97706; font-size: 14px;">${r.name}</span>
        <div style="margin-top: 4px; color: #334155; font-size: 13px;">
          <strong>Lineup:</strong> ${r.players.join(', ') || 'No players selected'}
        </div>
      </div>`
      )
      .join('');

    const recipients: string[] = [];
    if (data.captainEmail && data.captainEmail.trim()) {
      recipients.push(data.captainEmail.trim());
    }

    if (recipients.length === 0) {
      console.log('[SMTP] No captain email provided for individual receipt. Skipping pre-cutoff email.');
      return { success: true, skipped: true };
    }

    const mailOptions = {
      from: `"CBOT Tournament" <${smtpFrom}>`,
      to: recipients.join(', '),
      subject: `🏆 Combi Submission Update: Day ${data.dayNumber} - ${data.teamName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
          <div style="background-color: #d97706; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800;">🏆 CBOT Combi Confirmation</h1>
            <p style="margin: 5px 0 0; font-size: 12px; opacity: 0.9;">Day ${data.dayNumber} Match Combi Update</p>
          </div>
          <div style="padding: 24px; color: #1e293b;">
            <p style="margin-top: 0; font-size: 15px;">A combi submission was recorded for <strong>Day ${data.dayNumber}</strong> before the 9:30 PM IST deadline.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: bold; width: 35%;">Team Name</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: bold;">${data.teamName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: bold;">Submitted By</td>
                <td style="padding: 8px 0; color: #0f172a;">${data.captainName} (Team Captain)</td>
              </tr>
              ${data.captainEmail ? `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: bold;">Captain Email</td>
                <td style="padding: 8px 0; color: #0f172a;">${data.captainEmail}</td>
              </tr>
              ` : ''}
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: bold;">Submission Time</td>
                <td style="padding: 8px 0; color: #0f172a; font-family: monospace;">${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })} IST</td>
              </tr>
            </table>

            <h3 style="color: #0f172a; font-size: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 24px;">Combi Configuration</h3>
            ${roundListHtml}
            
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 15px;">
              This is an official CBOT automated combi receipt. Captains can modify their daily match combis anytime up until 9:30 PM IST.
            </p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    
    if (!smtpHost) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[SMTP Test] Combi update email sent to Ethereal! Preview URL: ${previewUrl}`);
      return { success: true, previewUrl };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[SMTP] Failed to send combi email:', error);
    return { success: false, error: error?.message || 'SMTP delivery failed' };
  }
}

export async function saveTeamDailyLineup(
  teamId: string,
  dayNumber: number,
  rounds: any[],
  submittedAtInput?: string,
  clientTimeZone?: string,
) {
  try {
    const editionRef = await resolveCurrentEdition();
    const activeEdition = editionRef
      ? await prisma.edition.findUnique({
          where: { id: editionRef.id },
          select: { id: true, status: true, dayDates: true, totalDays: true },
        })
      : null;

    const scheduledEdition = await ensureOfficialDayDates(activeEdition);
    const editionDayDates = scheduledEdition?.dayDates ?? null;

    if (isCombiSubmissionLocked(dayNumber, editionDayDates)) {
      const dateStr = combiCalendarDate(dayNumber, editionDayDates);
      return {
        success: false,
        error: `Submissions for Day ${dayNumber} closed at 9:30 PM IST on ${dateStr}. This combi is locked.`,
      };
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        spocMembers: { select: { userId: true } },
      },
    });

    if (!team) {
      return { success: false, error: 'Team not found.' };
    }

    if (team.teamType === 'SPOC_EXHIBITION') {
      const allowed = new Set((team.spocMembers || []).map((m) => m.userId));
      if (team.captainId) allowed.add(team.captainId);
      const invalid = rounds.flatMap((r: any) => (r.playerIds || []).filter(Boolean)).find((pid: string) => !allowed.has(pid));
      if (invalid) {
        return { success: false, error: 'Spoc combi can only include players from your Spoc exhibition roster.' };
      }
    }

    let lineupsObj: any = {};
    if (team?.savedLineups) {
      try {
        lineupsObj = JSON.parse(team.savedLineups);
      } catch (e) {
        console.error('[saveTeamDailyLineup] Failed to parse existing savedLineups JSON:', e);
      }
    }

    // Always compute official server IST timestamp
    const { formattedIst, isoString } = currentServerIstTimestamp();
    const submittedAt = submittedAtInput && submittedAtInput.includes('IST') && /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(submittedAtInput)
      ? submittedAtInput
      : formattedIst;

    // Merge or update the lineup for the specified day
    lineupsObj[dayNumber] = {
      rounds,
      submittedAt,
      submittedAtIso: isoString,
      clientTimeZone: clientTimeZone || 'Asia/Kolkata',
    };

    await prisma.team.update({
      where: { id: teamId },
      data: {
        savedLineups: JSON.stringify(lineupsObj)
      }
    });

    revalidatePath('/dashboard/captain');
    revalidatePath('/combis');
    revalidatePath('/editions/200th-combis');
    return { success: true, submittedAt, submittedAtIso: isoString };
  } catch (error: any) {
    console.error('[saveTeamDailyLineup] Error:', error);
    return { success: false, error: error?.message || 'Failed to save lineup to database' };
  }
}

export async function sendFinalDailyLineupSummaryAction(dayNumber: number): Promise<{ success: boolean; previewUrl?: string | null; error?: string; message?: string }> {
  // Email sending is disabled per user request
  return { success: true, message: 'Email sending is disabled.' };

  /*
  try {
    const activeEdition = await prisma.edition.findFirst({
      orderBy: { number: 'desc' },
      select: { id: true, title: true, dayDates: true }
    });

    if (!activeEdition) return { success: false, error: 'No active edition found' };

    const teams = await prisma.team.findMany({
      where: { editionId: activeEdition.id },
      include: { captain: true }
    });

    let teamSummariesHtml = '';
    const recipientEmails: string[] = ['cbotworld@gmail.com'];

    for (const team of teams) {
      if (team.captain?.email) {
        const cleanEmail = team.captain.email.trim().toLowerCase();
        if (cleanEmail && !recipientEmails.includes(cleanEmail)) {
          recipientEmails.push(cleanEmail);
        }
      }

      let roundsHtml = '<p style="color: #94a3b8; font-style: italic;">No combi submitted before 9:30 PM IST cutoff.</p>';
      if (team.savedLineups) {
        try {
          const parsed = JSON.parse(team.savedLineups);
          const dayData = parsed[dayNumber];
          if (dayData && dayData.rounds) {
            roundsHtml = dayData.rounds.map((r: any) => `
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 6px;">
                <strong style="color: #d97706; font-size: 12px;">${r.name}:</strong>
                <span style="color: #334155; font-size: 12px;">${r.players?.join(', ') || 'N/A'}</span>
              </div>
            `).join('');
          }
        } catch (e) {}
      }

      teamSummariesHtml += `
        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px 0; color: #0f172a; font-size: 16px;">
            🏆 Team: ${team.name} (${team.tag}) — <span style="font-size: 13px; color: #475569;">Captain: ${team.captain?.name || 'Assigned Captain'}</span>
          </h3>
          ${roundsHtml}
        </div>
      `;
    }

    const nodemailer = require('nodemailer');
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || 'noreply@cbotworld.com';

    let transporter;
    if (smtpHost && smtpUser && smtpPass) {
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
    }

    const mailOptions = {
      from: `"CBOT Official" <${smtpFrom}>`,
      to: recipientEmails.join(', '),
      subject: `🔒 Official Day ${dayNumber} Locked Combis Summary — ${activeEdition.title} (9:45 PM IST Receipt)`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #f8fafc;">
          <div style="background: #0f172a; color: #ffffff; padding: 20px; text-align: center;">
            <h2 style="margin: 0; color: #f59e0b; font-size: 20px;">🔒 Official Day ${dayNumber} Locked Combis Summary</h2>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #94a3b8;">9:45 PM IST Final Confirmation Receipt · ${activeEdition.title}</p>
          </div>
          <div style="padding: 24px;">
            <p style="font-size: 13px; color: #334155; margin-bottom: 20px;">
              Submissions for <strong>Day ${dayNumber}</strong> closed at <strong>9:30 PM IST</strong>. Below is the final locked combi summary for all teams in ${activeEdition.title}:
            </p>
            ${teamSummariesHtml}
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
              This is an official automated 9:45 PM IST receipt generated by CBOT. All Day ${dayNumber} combis are locked and cannot be edited.
            </p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    if (!smtpHost) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      return { success: true, previewUrl };
    }
    return { success: true };
  } catch (error: any) {
    console.error('[sendFinalDailyLineupSummaryAction] Error:', error);
    return { success: false, error: error?.message || 'Failed to send 9:45 PM IST summary email' };
  }
  */
}
