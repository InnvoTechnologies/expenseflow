import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/drizzle";
import { user as userTable, session, account, verification, organization as organizationTable, invitation } from "@/db/schema";
import { sendEmail } from "@/lib/mailer";
import { ActionEmail } from "@/emails/ActionEmail";
import { MagicCodeEmail } from "@/emails/MagicCodeEmail";
import { captcha, Organization } from "better-auth/plugins"
import { organization as organizationPlugin } from "better-auth/plugins"
import { emailOTP } from "better-auth/plugins"
import { eq } from "drizzle-orm";

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  PK: "PKR",
  US: "USD",
  IN: "INR",
  GB: "GBP",
  AE: "AED",
  SA: "SAR",
  AT: "EUR", BE: "EUR", CY: "EUR", EE: "EUR", FI: "EUR", FR: "EUR", DE: "EUR", GR: "EUR",
  IE: "EUR", IT: "EUR", LV: "EUR", LT: "EUR", LU: "EUR", MT: "EUR", NL: "EUR", PT: "EUR",
  SK: "EUR", SI: "EUR", ES: "EUR", HR: "EUR",
  CA: "CAD",
  AU: "AUD",
  JP: "JPY",
  CN: "CNY",
  NZ: "NZD",
  SG: "SGD",
  HK: "HKD",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  TR: "TRY",
  BR: "BRL",
  RU: "RUB",
  ZA: "ZAR",
  MX: "MXN",
  MY: "MYR",
  ID: "IDR",
  TH: "THB",
  PH: "PHP",
  BD: "BDT",
};

function getIpFromHeaders(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map(ip => ip.trim());
    if (ips[0]) return ips[0];
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;
  return null;
}

async function detectRegionFromIp(ip: string): Promise<{ country: string; baseCurrency: string } | null> {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("172.")) {
    return null;
  }
  try {
    const res = await fetch(`https://freeipapi.com/api/json/${ip}`);
    if (!res.ok) return null;
    const data = await res.json();
    const country = data.countryCode || "US";
    const baseCurrency = COUNTRY_TO_CURRENCY[country] || "USD";
    return { country, baseCurrency };
  } catch (error) {
    console.error("Error detecting region from IP:", error);
    return null;
  }
}


export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: userTable,
      session: session,
      account: account,
      verification: verification,
      organization: organizationTable,
      // member: member,
      invitation: invitation,
    },
  }),
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(), // Use crypto.randomUUID for ID generation
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }, _req) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        react: ActionEmail({
          title: "Reset your password",
          description: "Click the button below to set a new password.",
          actionText: "Reset password",
          actionUrl: url,
          email: user.email,
        }),
      })
    },
  },
  emailOTP: {
    async sendVerificationOTP() {},
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }, _req) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email address",
        react: ActionEmail({
          title: "Verify your email",
          description: "Confirm your email address to complete your account setup.",
          actionText: "Verify email",
          actionUrl: url,
          email: user.email,
        }),
      })
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      // Don't specify redirectURI so it uses the default pattern
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 24 hours
    strategy: "jwt", // Use JWT for better security
    cookieName: "better_auth_session",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    }
  },
  cookies: {
    sessionToken: {
      name: "better_auth_session",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET || "your-secret-key-here",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  events: {
    user: {
      created: async ({ user: newUser, headers }: { user: any; headers: Headers }) => {
        try {
          const ip = getIpFromHeaders(headers);
          if (ip) {
            const region = await detectRegionFromIp(ip);
            if (region) {
              await db.update(userTable)
                .set({
                  baseCurrency: region.baseCurrency,
                  country: region.country,
                  updatedAt: new Date()
                })
                .where(eq(userTable.id, newUser.id));
              console.log(`[Auth Event] Set new user ${newUser.email} currency to ${region.baseCurrency} (${region.country}) based on IP ${ip}`);
            }
          }
        } catch (err) {
          console.error("Error in user.created event handler:", err);
        }
      }
    }
  },
  plugins: [ 
    // captcha({ 
    //     provider: "google-recaptcha", 
    //     secretKey: process.env.RECAPTCHA_SECRET_KEY!,
    //     minScore: 0.5, // reCAPTCHA v3 score threshold (0.0 to 1.0)
    // }),
    captcha({ 
            provider: "cloudflare-turnstile",
            secretKey: process.env.TURNSTILE_SECRET_KEY!, 
    }),
    organizationPlugin({
      // Auto-create organization when user registers
      organizationCreation: {
        disabled: false,
        afterCreate: async ({ organization: newOrg, member, user: authUser }: {organization: Organization, member: any, user: any}, request: any) => {
          console.log(`Organization "${newOrg.name}" created for user ${authUser.email}`);
          try {
            // Fetch the user's baseCurrency, country, and numberFormat
            const [freshUser] = await db
              .select({
                baseCurrency: userTable.baseCurrency,
                country: userTable.country,
                numberFormat: userTable.numberFormat,
              })
              .from(userTable)
              .where(eq(userTable.id, authUser.id))
              .limit(1);

            if (freshUser) {
              await db.update(organizationTable)
                .set({
                  baseCurrency: freshUser.baseCurrency,
                  country: freshUser.country,
                  numberFormat: freshUser.numberFormat,
                })
                .where(eq(organizationTable.id, newOrg.id));
              console.log(`[Org Hook] Set new organization "${newOrg.name}" currency settings to match user: ${freshUser.baseCurrency}`);
            }
          } catch (err) {
            console.error("Error setting organization currency in afterCreate hook:", err);
          }
        }
      },
      // Allow users to create organizations
      allowUserToCreateOrganization: true,
      // Set creator role to owner
      creatorRole: "owner",
      // Limit organizations per user (optional)
      organizationLimit: 5,
      // Limit members per organization (optional)
      membershipLimit: 100,
      // Send invitation emails (you can customize this)
      sendInvitationEmail: async (data) => {
        // You can implement custom invitation email logic here
        console.log("Sending invitation email:", data);
      },
      // Invitation expiration (48 hours)
      invitationExpiresIn: 48 * 60 * 60,
    }),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }, _req) {
        let subject = "Your verification code";
        let title = "Verification code";
        let description = "Use this code to complete your request.";
        
        if (type === "sign-in") {
          subject = "Your sign-in code";
          title = "Sign-in code";
          description = "Use this code to sign in to your account.";
        } else if (type === "email-verification") {
          subject = "Verify your email";
          title = "Email verification code";
          description = "Use this code to verify your email address.";
        } else if (type === "forget-password") {
          subject = "Reset your password";
          title = "Password reset code";
          description = "Use this code to reset your password.";
        } else if (type === "change-email") {
          subject = "Confirm your new email";
          title = "Email change code";
          description = "Use this code to confirm your new email address.";
        }
        
        await sendEmail({
          to: email,
          subject,
          react: MagicCodeEmail({ code: otp, email }),
        });
      },
    }),
  ],
});
export type Session = typeof auth.$Infer.Session & {
  session: {
    activeOrganizationId?: string | null;
  };
};
export type User = typeof auth.$Infer.Session.user;
