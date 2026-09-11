import type { PageContent } from "../page-document.ts";

export default {
  related: ["/time", "/config", "/curl"],
  howItWorks: [
    "Type an expression into the box or build it a field at a time in the row beneath; the two are the same string, so editing either rewrites the other. The page describes the schedule in a sentence and lists the next six runs, in UTC by default or in your own time zone.",
    "Three flavours are covered. Unix is the five fields of a crontab line. The seconds flavour puts a seconds field in front, as Spring's `@Scheduled` does. Quartz takes six or seven fields, counts Sunday as 1, and adds `?`, `L`, `W` and `#` for schedules a crontab cannot express, such as the last weekday of the month.",
    {
      table: [
        ["Field", "Values", "Notes"],
        ["Minute", "0–59", ""],
        ["Hour", "0–23", ""],
        ["Day of month", "1–31", "Quartz also takes `L`, `LW`, `L-3` and `15W`"],
        ["Month", "1–12 or `JAN`–`DEC`", ""],
        ["Day of week", "0–7 or `SUN`–`SAT`", "0 and 7 are both Sunday; Quartz counts 1–7 from Sunday"],
      ],
    },
    "Each field takes `*`, a value, a list such as `1,15`, a range such as `9-17`, or a step such as `*/15` or `5/10`. The shorthands `@hourly`, `@daily`, `@weekly`, `@monthly` and `@yearly` expand to the fields they stand for; `@reboot` has no clock, so it has no next runs.",
  ],
  examples: [
    {
      title: "Every quarter of an hour in working hours",
      blocks: [
        { code: "*/15 9-17 * * 1-5" },
        "Described as “Every 15 minutes past hours 9 through 17 on Monday through Friday”. From Thursday 10 September 2026 at 12:00 UTC the next runs are 12:15, 12:30, 12:45 and 13:00. The day's last run is 17:45, not 17:00, because the hour field matches all of hour 17.",
      ],
    },
    {
      title: "Both day fields set",
      blocks: [
        { code: "0 0 1,15 * 5" },
        "Described as “At 00:00 on day-of-month 1 and 15 or Friday”. From the same Thursday the runs are Friday 11, Tuesday 15, Friday 18 and Friday 25 September. Tuesday is there for being the 15th.",
      ],
    },
    {
      title: "The last weekday of every month, in Quartz",
      blocks: [
        { code: "0 0 18 LW * ?" },
        "Described as “At 18:00 on the last weekday of the month”: Wednesday 30 September, Friday 30 October, Monday 30 November and Thursday 31 December 2026. 31 October is a Saturday, so that month's run moves back to the Friday.",
      ],
    },
  ],
  problems: [
    {
      title: "The job runs on days you did not ask for",
      blocks: [
        "When both day fields are restricted, cron runs on days matching either one: `0 0 13 * 5` fires every Friday and every 13th, not only on Friday the 13th. When either field starts with `*` they combine the other way, so `0 0 */2 * 1` fires only on Mondays with an odd date. That is Vixie cron's rule, and the sentence under the expression says “or” or “and” to show which applies.",
      ],
    },
    {
      title: "`*/2` in the day of month is not every other day",
      blocks: [
        "A step counts from the start of its field and restarts each month, so `0 0 */2 * *` fires on odd dates: 29 August, 31 August, 1 September, 3 September. After a 31-day month that is two days running.",
      ],
    },
    {
      title: "A step larger than its field",
      blocks: [
        "A step never carries into the next field. `*/90 * * * *` matches minute 0 alone and runs hourly, so it is described as “At minute 0”, exactly as `0 * * * *` is. Every 90 minutes takes two lines, `0 0-21/3 * * *` and `30 1-22/3 * * *`, which together fire at 00:00, 01:30, 03:00, 04:30 and so on.",
      ],
    },
    {
      title: "Quartz rejects a crontab line",
      blocks: [
        "Quartz wants a seconds field first and `?` in the unused day field, so `0 9 * * MON-FRI` becomes `0 0 9 ? * MON-FRI`. Numbered weekdays shift too: `1-5` in Quartz is Sunday through Thursday. Switching flavour on the page rewrites weekdays as names, which mean the same days in both.",
      ],
    },
    {
      title: "A 02:30 job and daylight saving",
      blocks: [
        "In Europe/Berlin the clock jumps from 02:00 to 03:00 on 29 March 2026, so `30 2 * * *` has nothing to match that day and the runs go from 28 March to 30 March. On 25 October 02:30 happens twice and is listed once. Daemons differ: cronie and Debian's cron run a skipped job just after the jump and avoid running one twice when the clock goes back.",
      ],
    },
  ],
  faq: [
    {
      question: "Which time zone does cron use?",
      answer:
        "The machine's, or whatever the daemon is configured with, and never the zone of whoever wrote the line, which is why the page opens in UTC. Some crons read a `CRON_TZ` variable from the crontab, and Kubernetes CronJobs take a `timeZone` field.",
    },
    {
      question: "Is Sunday 0 or 7?",
      answer:
        "Both, in a crontab. Quartz counts 1 for Sunday through 7 for Saturday, so there a 7 means Saturday. Writing `SUN` avoids the question in both.",
    },
    {
      question: "What is the question mark for in Quartz?",
      answer:
        "Quartz does not support restricting the day of month and the day of week at once, so one of them must be `?`, meaning no specific value. A crontab has no such rule and uses `*`.",
    },
  ],
  references: [
    { title: "crontab(5), Linux manual page", url: "https://man7.org/linux/man-pages/man5/crontab.5.html" },
    { title: "cron(8), Linux manual page", url: "https://man7.org/linux/man-pages/man8/cron.8.html" },
    {
      title: "crontab, POSIX.1-2024",
      url: "https://pubs.opengroup.org/onlinepubs/9799919799/utilities/crontab.html",
    },
    {
      title: "Quartz CronTrigger tutorial",
      url: "https://www.quartz-scheduler.org/documentation/quartz-2.3.0/tutorials/crontrigger.html",
    },
    {
      title: "Kubernetes CronJob time zones",
      url: "https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/#time-zones",
    },
  ],
} satisfies PageContent;
