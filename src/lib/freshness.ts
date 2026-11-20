/**
 * The app's earnings calendar is rebuilt by the dataset workflow at 23:00 UTC,
 * Monday to Friday, and takes a few minutes to publish. The newest copy a
 * healthy deployment can have is therefore the most recent weekday build that
 * has had time to finish.
 */
const BUILD_HOUR_UTC = 23;
const BUILD_GRACE_MINUTES = 30;

export function latestExpectedEarningsDate(now: Date): string {
  const isWeekday = (date: Date): boolean => {
    const day = date.getUTCDay();
    return day >= 1 && day <= 5;
  };
  const buildFinished = (date: Date): boolean =>
    now.getTime() >=
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      BUILD_HOUR_UTC,
      BUILD_GRACE_MINUTES,
    );

  const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!isWeekday(candidate) || !buildFinished(candidate)) {
    candidate.setUTCDate(candidate.getUTCDate() - 1);
  }
  while (!isWeekday(candidate)) candidate.setUTCDate(candidate.getUTCDate() - 1);
  return candidate.toISOString().slice(0, 10);
}
