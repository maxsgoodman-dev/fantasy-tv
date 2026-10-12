export function welcomeEmail(displayName: string) {
  return {
    subject: `Welcome to Fantasy TV, ${displayName}!`,
    text: `Hey ${displayName}, your Fantasy TV account is ready. Ask your league's admin for a join code to get started, or create your own leagues if you're an admin.`,
  }
}

export function resultsPostedEmail(leagueName: string, episodeNumber: number) {
  return {
    subject: `${leagueName}: Episode ${episodeNumber} results are in!`,
    text: `This week's results for ${leagueName} have been posted. Check your score and the standings now.`,
  }
}

export function lockReminderEmail(leagueName: string, questionText: string) {
  return {
    subject: `${leagueName}: picks lock soon`,
    text: `Don't forget to lock in your pick for "${questionText}" in ${leagueName} — picks lock within the next day.`,
  }
}

export function wikiChangesEmail(showName: string, eventCount: number) {
  return {
    subject: `${showName}: wiki update found ${eventCount} new event${eventCount === 1 ? '' : 's'}`,
    text: `The show wiki changed and ${eventCount} suggested scoring event${eventCount === 1 ? '' : 's'} ${eventCount === 1 ? 'is' : 'are'} waiting for review at /admin/wiki-sources.`,
  }
}

export function leagueInviteEmail(opts: { inviterName: string; leagueName: string; showName: string; link: string; code: string }) {
  return {
    subject: `${opts.inviterName} invited you to ${opts.leagueName} on Fantasy TV`,
    text: `${opts.inviterName} invited you to join "${opts.leagueName}" (${opts.showName}) on Fantasy TV.\n\nJoin here: ${opts.link}\n\nYou'll create a quick account with a username, email and password. Your league join code is ${opts.code} if you're asked for it.`,
  }
}
