import { parseAppointmentIso } from "./appointment-datetime";

export interface EmailSchedulingInput {
  recipient: string;
  specialistName: string;
  clientName: string;
  productLabel: string;
  appointmentDatetime: string;
  timeZone: string;
}

function truncate(value: string, limit: number): string {
  return Array.from(value).slice(0, limit).join("");
}

export function buildEmailSchedulingLinks(input: EmailSchedulingInput): {
  mailtoHref: string;
  gmailHref: string;
  subject: string;
  body: string;
} {
  const date = parseAppointmentIso(input.appointmentDatetime);
  if (!input.timeZone.trim()) throw new Error("Selecione um fuso horário válido");
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: input.timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  const when = `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")} (${input.timeZone})`;
  const recipient = input.recipient.replace(/[\r\n]/g, "").trim();
  const subject = truncate(`Interesse no produto: ${input.productLabel}`.replace(/[\r\n]/g, ""), 160);
  // Cap variable fields first so a large name/product cannot remove the proposed instant.
  const body = truncate(
    `Olá, ${truncate(input.specialistName, 120)}!\n\nMeu nome é ${truncate(input.clientName, 120)} e tenho interesse no produto ${truncate(input.productLabel, 1000)}.\n\nGostaria de solicitar uma reunião para ${when}.\n\nPodemos confirmar esse horário?\n\nObrigado(a)!`,
    1800,
  );
  const to = encodeURIComponent(recipient);
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  return {
    mailtoHref: `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`,
    gmailHref: `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${encodedSubject}&body=${encodedBody}`,
    subject,
    body,
  };
}
