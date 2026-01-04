type ActionEmailParams = {
  appName?: string
  logoText?: string
  title: string
  description: string
  actionText: string
  actionUrl: string
  footerNote?: string
}

export function buildActionEmailHTML(params: ActionEmailParams): string {
  const appName = params.appName || process.env.NEXT_PUBLIC_APP_NAME || "ExpenseFlow"
  const logoText = params.logoText || appName[0]?.toUpperCase() || "E"
  const footer = params.footerNote || `${appName} • Do not reply to this email.`

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(appName)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0b0b0c;font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#e5e7eb;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0b0b0c;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <div style="display:inline-flex;align-items:center;gap:10px;">
                  <div style="height:36px;width:36px;border-radius:8px;background:#ef4444;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;">${escapeHtml(logoText)}</div>
                  <div style="font-weight:600;font-size:18px;letter-spacing:.2px;color:#e5e7eb;">${escapeHtml(appName)}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#111214;border:1px solid #1f2937;border-radius:12px;padding:28px;">
                <h1 style="margin:0 0 12px 0;font-size:20px;line-height:28px;color:#f3f4f6;">${escapeHtml(params.title)}</h1>
                <p style="margin:0 0 20px 0;font-size:14px;line-height:22px;color:#cbd5e1;">${escapeHtml(params.description)}</p>
                <div style="padding:10px 0 22px 0;">
                  <a href="${escapeAttribute(params.actionUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:10px;">${escapeHtml(params.actionText)}</a>
                </div>
                <p style="margin:0 0 8px 0;font-size:12px;line-height:18px;color:#9ca3af;">Or paste this link into your browser:</p>
                <p style="margin:0;font-size:12px;line-height:18px;color:#9ca3af;word-break:break-all;"><a href="${escapeAttribute(params.actionUrl)}" style="color:#93c5fd;text-decoration:underline;">${escapeHtml(params.actionUrl)}</a></p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:16px 8px;color:#6b7280;font-size:12px;">${escapeHtml(footer)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function buildActionEmailText(params: ActionEmailParams): string {
  const appName = params.appName || process.env.NEXT_PUBLIC_APP_NAME || "ExpenseFlow"
  return `${appName}\n\n${params.title}\n\n${params.description}\n\nAction: ${params.actionText}\nLink: ${params.actionUrl}`
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function escapeAttribute(input: string): string {
  return escapeHtml(input)
}

type MagicCodeEmailParams = {
  appName?: string
  logoText?: string
  code: string
  footerNote?: string
}

export function buildMagicCodeEmailHTML(params: MagicCodeEmailParams): string {
  const appName = params.appName || process.env.NEXT_PUBLIC_APP_NAME || "ExpenseFlow"
  const logoText = params.logoText || appName[0]?.toUpperCase() || "S"
  const footer = params.footerNote || `${appName} • Do not reply to this email.`

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(appName)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0b0b0c;font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#e5e7eb;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0b0b0c;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <div style="display:inline-flex;align-items:center;gap:10px;">
                  <svg width="36" height="36" viewBox="0 0 603 126" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 53C0 50.239 2.239 48 5 48C7.761 48 10 50.239 10 53V73C10 75.761 7.761 78 5 78C2.239 78 0 75.761 0 73V53Z" fill="url(#paint0_linear_3349_28)"/>
                    <path d="M116 53C116 50.239 118.239 48 121 48C123.761 48 126 50.239 126 53V73C126 75.761 123.761 78 121 78C118.239 78 116 75.761 116 73V53Z" fill="url(#paint1_linear_3349_28)"/>
                    <path d="M19 44C19 41.239 21.239 39 24 39C26.761 39 29 41.239 29 44V82C29 84.761 26.761 87 24 87C21.239 87 19 84.761 19 82V44Z" fill="url(#paint2_linear_3349_28)"/>
                    <path d="M97 44C97 41.239 99.239 39 102 39C104.761 39 107 41.239 107 44V82C107 84.761 104.761 87 102 87C99.239 87 97 84.761 97 82V44Z" fill="url(#paint3_linear_3349_28)"/>
                    <path d="M48 110V31C48 28.239 45.761 26 43 26C40.239 26 38 28.239 38 31V111C38 119.284 44.716 126 53 126C61.284 126 68 119.284 68 111V14C68 11.239 70.239 9 73 9C75.761 9 78 11.239 78 14V92C78 94.761 80.239 97 83 97C85.761 97 88 94.761 88 92V15C88 6.716 81.284 0 73 0C64.716 0 58 6.716 58 15V110C58 112.761 55.761 115 53 115C50.239 115 48 112.761 48 110Z" fill="url(#paint4_linear_3349_28)"/>
                    <path d="M185.5 100.1C179.367 100.1 174.1 99.0674 169.7 97.0004C165.3 94.9334 161.867 92.0334 159.4 88.3004C156.933 84.5674 155.533 80.1674 155.2 75.1004L170.5 74.4004C170.9 77.2004 171.7 79.6004 172.9 81.6004C174.167 83.5334 175.833 85.0004 177.9 86.0004C180.033 87.0004 182.633 87.5004 185.7 87.5004C188.233 87.5004 190.367 87.2004 192.1 86.6004C193.9 86.0004 195.267 85.1004 196.2 83.9004C197.133 82.6334 197.6 81.1004 197.6 79.3004C197.6 77.6334 197.2 76.2004 196.4 75.0004C195.6 73.7334 194.067 72.6004 191.8 71.6004C189.533 70.5334 186.2 69.5004 181.8 68.5004C175.733 67.1004 170.833 65.5334 167.1 63.8004C163.433 62.0674 160.767 59.9004 159.1 57.3004C157.433 54.6334 156.6 51.3004 156.6 47.3004C156.6 43.0334 157.633 39.3004 159.7 36.1004C161.833 32.9004 164.9 30.4004 168.9 28.6004C172.9 26.8004 177.667 25.9004 183.2 25.9004C189.067 25.9004 194.033 26.9334 198.1 29.0004C202.167 31.0674 205.333 33.9004 207.6 37.5004C209.933 41.1004 211.333 45.2334 211.8 49.9004L196.6 50.7004C196.4 48.2334 195.733 46.1004 194.6 44.3004C193.467 42.4334 191.933 41.0004 190 40.0004C188.067 39.0004 185.733 38.5004 183 38.5004C179.533 38.5004 176.8 39.2674 174.8 40.8004C172.867 42.3334 171.9 44.3334 171.9 46.8004C171.9 48.5334 172.333 50.0004 173.2 51.2004C174.133 52.3334 175.633 53.3334 177.7 54.2004C179.833 55.0674 182.833 55.9004 186.7 56.7004C193.3 58.0334 198.5 59.7334 202.3 61.8004C206.167 63.8004 208.9 66.2004 210.5 69.0004C212.1 71.8004 212.9 75.0004 212.9 78.6004C212.9 83.0004 211.767 86.8334 209.5 90.1004C207.3 93.3004 204.133 95.7674 200 97.5004C195.933 99.2334 191.1 100.1 185.5 100.1ZM224.666 113.5V44.9004H239.066L239.366 56.2004L238.166 55.7004C239.5 51.8334 241.666 48.8674 244.666 46.8004C247.666 44.7334 251.166 43.7004 255.166 43.7004C260.166 43.7004 264.333 44.9334 267.666 47.4004C271 49.8674 273.5 53.2334 275.166 57.5004C276.9 61.7004 277.766 66.4334 277.766 71.7004C277.766 76.9004 276.9 81.6334 275.166 85.9004C273.5 90.1674 270.966 93.5334 267.566 96.0004C264.233 98.4674 260.066 99.7004 255.066 99.7004C252.466 99.7004 250.033 99.2334 247.766 98.3004C245.5 97.3004 243.533 95.9334 241.866 94.2004C240.266 92.4674 239.1 90.4004 238.366 88.0004L239.666 87.2004V113.5H224.666ZM250.966 88.2004C254.5 88.2004 257.266 86.7334 259.266 83.8004C261.333 80.8674 262.366 76.8334 262.366 71.7004C262.366 66.5674 261.333 62.5334 259.266 59.6004C257.266 56.6674 254.5 55.2004 250.966 55.2004C248.633 55.2004 246.6 55.8334 244.866 57.1004C243.2 58.3004 241.9 60.1334 240.966 62.6004C240.1 65.0674 239.666 68.1004 239.666 71.7004C239.666 75.3004 240.1 78.3334 240.966 80.8004C241.9 83.2674 243.2 85.1334 244.866 86.4004C246.6 87.6004 248.633 88.2004 250.966 88.2004ZM287.069 98.5004V27.5004H302.069V66.9004L321.969 44.9004H339.969L319.169 67.0004L340.569 98.5004H324.169L309.469 75.5004L302.069 83.4004V98.5004H287.069ZM368.986 99.7004C363.519 99.7004 358.753 98.5674 354.686 96.3004C350.619 93.9674 347.453 90.7004 345.186 86.5004C342.919 82.3004 341.786 77.3674 341.786 71.7004C341.786 66.0334 342.919 61.1334 345.186 57.0004C347.453 52.8004 350.619 49.5334 354.686 47.2004C358.753 44.8674 363.519 43.7004 368.986 43.7004C374.453 43.7004 379.219 44.8674 383.286 47.2004C387.353 49.5334 390.519 52.8004 392.786 57.0004C395.053 61.1334 396.186 66.0334 396.186 71.7004C396.186 77.3674 395.053 82.3004 392.786 86.5004C390.519 90.7004 387.353 93.9674 383.286 96.3004C379.219 98.5674 374.453 99.7004 368.986 99.7004ZM368.986 88.2004C372.719 88.2004 375.619 86.7674 377.686 83.9004C379.753 80.9674 380.786 76.9004 380.786 71.7004C380.786 66.5004 379.753 62.4674 377.686 59.6004C375.619 56.6674 372.719 55.2004 368.986 55.2004C365.253 55.2004 362.353 56.6674 360.286 59.6004C358.219 62.6334 357.186 66.5004 357.186 71.7004C357.186 76.9004 358.219 80.9674 360.286 83.9004C362.353 86.7674 365.253 88.2004 368.986 88.2004ZM403.602 98.5004V83.2004H419.902V98.5004H403.602ZM449.235 99.7004C444.702 99.7004 440.768 98.5674 437.435 96.3004C434.168 93.9674 431.635 90.7334 429.835 86.6004C428.102 82.4004 427.235 77.4334 427.235 71.7004C427.235 65.9674 428.135 61.0334 429.935 56.9004C431.735 52.7004 434.268 49.4674 437.535 47.2004C440.868 44.8674 444.768 43.7004 449.235 43.7004C453.035 43.7004 456.302 44.5004 459.035 46.1004C461.835 47.6334 463.935 49.7674 465.335 52.5004V27.5004H480.335V98.5004H466.035L465.735 90.6004C464.268 93.4674 462.068 95.7004 459.135 97.3004C456.268 98.9004 452.968 99.7004 449.235 99.7004ZM454.135 88.2004C456.535 88.2004 458.568 87.5674 460.235 86.3004C461.902 85.0334 463.168 83.2004 464.035 80.8004C464.902 78.3334 465.335 75.3004 465.335 71.7004C465.335 68.0334 464.902 65.0004 464.035 62.6004C463.168 60.1334 461.902 58.3004 460.235 57.1004C458.568 55.8334 456.535 55.2004 454.135 55.2004C450.602 55.2004 447.802 56.7004 445.735 59.7004C443.668 62.6334 442.635 66.6334 442.635 71.7004C442.635 76.7004 443.668 80.7004 445.735 83.7004C447.868 86.7004 450.668 88.2004 454.135 88.2004ZM516.638 99.7004C511.171 99.7004 506.404 98.5674 502.338 96.3004C498.338 93.9674 495.204 90.7004 492.938 86.5004C490.738 82.3004 489.638 77.3674 489.638 71.7004C489.638 66.0334 490.738 61.1334 492.938 57.0004C495.204 52.8004 498.338 49.5334 502.338 47.2004C506.338 44.8674 511.071 43.7004 516.538 43.7004C521.871 43.7004 526.504 44.8674 530.438 47.2004C534.371 49.5334 537.404 52.8674 539.538 57.2004C541.738 61.5334 542.838 66.7004 542.838 72.7004V75.7004H505.138C505.338 79.9674 506.471 83.1334 508.538 85.2004C510.671 87.2674 513.471 88.3004 516.938 88.3004C519.471 88.3004 521.571 87.7674 523.238 86.7004C524.971 85.6334 526.204 84.0004 526.938 81.8004L542.038 82.7004C540.638 88.0334 537.671 92.2004 533.138 95.2004C528.604 98.2004 523.104 99.7004 516.638 99.7004ZM505.138 66.5004H527.438C527.238 62.5674 526.138 59.6334 524.138 57.7004C522.204 55.7674 519.671 54.8004 516.538 54.8004C513.404 54.8004 510.804 55.8334 508.738 57.9004C506.738 59.9004 505.538 62.7674 505.138 66.5004ZM565.255 98.5004L545.655 44.9004H561.355L574.055 83.4004L586.655 44.9004H602.355L582.655 98.5004H565.255Z" fill="white"/>
                    <defs>
                      <linearGradient id="paint0_linear_3349_28" x1="-1.87755e-06" y1="1.12653e-06" x2="126" y2="126" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#7F53FF"/>
                        <stop offset="1" stop-color="#C646FF"/>
                      </linearGradient>
                      <linearGradient id="paint1_linear_3349_28" x1="1.50204e-06" y1="-2.62856e-06" x2="126" y2="126" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#7F53FF"/>
                        <stop offset="1" stop-color="#C646FF"/>
                      </linearGradient>
                      <linearGradient id="paint2_linear_3349_28" x1="-9.38773e-08" y1="1.17347e-06" x2="126" y2="126" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#7F53FF"/>
                        <stop offset="1" stop-color="#C646FF"/>
                      </linearGradient>
                      <linearGradient id="paint3_linear_3349_28" x1="1.59591e-06" y1="-4.45917e-06" x2="126" y2="126" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#7F53FF"/>
                        <stop offset="1" stop-color="#C646FF"/>
                      </linearGradient>
                      <linearGradient id="paint4_linear_3349_28" x1="9.76324e-07" y1="-1.87755e-06" x2="126" y2="126" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#7F53FF"/>
                        <stop offset="1" stop-color="#C646FF"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#111214;border:1px solid #1f2937;border-radius:12px;padding:28px;">
                <h1 style="margin:0 0 12px 0;font-size:20px;line-height:28px;color:#f3f4f6;">Your Magic Code</h1>
                <p style="margin:0 0 20px 0;font-size:14px;line-height:22px;color:#cbd5e1;">Use this code to sign in to your account. The code will expire in 10 minutes.</p>
                <div style="text-align:center;padding:20px;background:#1f2937;border-radius:8px;margin:20px 0;">
                  <div style="font-size:32px;font-weight:700;color:#f3f4f6;letter-spacing:8px;font-family:monospace;">${escapeHtml(params.code)}</div>
                </div>
                <p style="margin:0;font-size:12px;line-height:18px;color:#9ca3af;text-align:center;">Enter this code on the login page to complete your sign-in.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:16px 8px;color:#6b7280;font-size:12px;">${escapeHtml(footer)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function buildMagicCodeEmailText(params: MagicCodeEmailParams): string {
  const appName = params.appName || process.env.NEXT_PUBLIC_APP_NAME || "ExpenseFlow"
  return `${appName}\n\nYour Magic Code\n\nUse this code to sign in to your account. The code will expire in 10 minutes.\n\nCode: ${params.code}\n\nEnter this code on the login page to complete your sign-in.`
}


