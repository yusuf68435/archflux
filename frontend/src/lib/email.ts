import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.EMAIL_FROM || "ArchFlux <noreply@archflux.app>";

export async function sendJobCompletedEmail({
  to,
  name,
  jobId,
  locale = "tr",
}: {
  to: string;
  name: string | null;
  jobId: string;
  locale?: string;
}) {
  if (!resend) return;

  const isTr = locale === "tr";
  const subject = isTr ? "DXF Dosyanız Hazır — ArchFlux" : "Your DXF File is Ready — ArchFlux";
  const greeting = isTr
    ? `Merhaba${name ? ` ${name}` : ""},`
    : `Hello${name ? ` ${name}` : ""},`;
  const body = isTr
    ? "Dönüşümünüz tamamlandı. DXF dosyanızı aşağıdaki linkten indirebilirsiniz."
    : "Your conversion is complete. You can download your DXF file from the link below.";
  const btnLabel = isTr ? "DXF'i Görüntüle" : "View DXF";
  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  await resend.emails.send({
    from: FROM,
    to,
    subject,
    html: buildHtml({ greeting, body, btnLabel, btnHref: `${appUrl}/history`, jobId }),
  });
}

export async function sendJobFailedEmail({
  to,
  name,
  locale = "tr",
}: {
  to: string;
  name: string | null;
  locale?: string;
}) {
  if (!resend) return;

  const isTr = locale === "tr";
  const subject = isTr ? "Dönüşüm Başarısız — ArchFlux" : "Conversion Failed — ArchFlux";
  const greeting = isTr
    ? `Merhaba${name ? ` ${name}` : ""},`
    : `Hello${name ? ` ${name}` : ""},`;
  const body = isTr
    ? "Dönüşümünüz sırasında bir hata oluştu. Kredileriniz iade edildi. Tekrar denemek isterseniz uygulamaya gidebilirsiniz."
    : "An error occurred during your conversion. Your credits have been refunded. You can go to the app to try again.";
  const btnLabel = isTr ? "Uygulamaya Git" : "Go to App";
  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  await resend.emails.send({
    from: FROM,
    to,
    subject,
    html: buildHtml({ greeting, body, btnLabel, btnHref: `${appUrl}/app` }),
  });
}

function buildHtml({
  greeting,
  body,
  btnLabel,
  btnHref,
  jobId,
}: {
  greeting: string;
  body: string;
  btnLabel: string;
  btnHref: string;
  jobId?: string;
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <tr>
          <td style="background:#000;padding:20px 32px;text-align:left">
            <span style="color:#fff;font-size:20px;font-weight:700">⬛ ArchFlux</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 12px;font-size:15px;color:#374151">${greeting}</p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6">${body}</p>
            ${jobId ? `<p style="margin:0 0 20px;font-size:13px;color:#9ca3af">Job ID: ${jobId}</p>` : ""}
            <a href="${btnHref}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">${btnLabel}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center">
            <p style="margin:0;font-size:12px;color:#9ca3af">© ${new Date().getFullYear()} ArchFlux. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
