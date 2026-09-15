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
