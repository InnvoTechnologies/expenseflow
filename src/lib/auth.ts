import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/drizzle";
import { user, session, account, verification, organization, invitation } from "@/db/schema";
import { sendEmail } from "@/lib/mailer";
import { buildActionEmailHTML, buildActionEmailText, buildMagicCodeEmailHTML, buildMagicCodeEmailText } from "@/lib/email-template";
import { captcha } from "better-auth/plugins"
import { organization as organizationPlugin } from "better-auth/plugins"
import { emailOTP } from "better-auth/plugins"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: user,
      session: session,
      account: account,
      verification: verification,
      organization: organization,
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
      const html = buildActionEmailHTML({
        title: "Reset your password",
        description: "Click the button below to set a new password.",
        actionText: "Reset password",
        actionUrl: url,
      })
      const text = buildActionEmailText({
        title: "Reset your password",
        description: "Click the link below to set a new password.",
        actionText: "Reset password",
        actionUrl: url,
      })
      await sendEmail({ to: user.email, subject: "Reset your password", html, text })
    },
  },
  emailOTP: {
    async sendVerificationOTP() {},
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }, _req) => {
      const html = buildActionEmailHTML({
        title: "Verify your email",
        description: "Confirm your email address to complete your account setup.",
        actionText: "Verify email",
        actionUrl: url,
      })
      const text = buildActionEmailText({
        title: "Verify your email",
        description: "Confirm your email address to complete your account setup.",
        actionText: "Verify email",
        actionUrl: url,
      })
      await sendEmail({ to: user.email, subject: "Verify your email address", html, text })
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
        afterCreate: async ({ organization, member, user }, request) => {
          // You can add custom logic here like creating default resources
          console.log(`Organization "${organization.name}" created for user ${user.email}`);
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
      async sendVerificationOTP({ email, otp, type }: { email: string; otp: string; type: "sign-in" | "email-verification" | "forget-password" }, _req: any) {
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
        }
        
        const html = buildMagicCodeEmailHTML({
          code: otp,
        })
        const text = buildMagicCodeEmailText({
          code: otp,
        })
        
        await sendEmail({ to: email, subject, html, text })
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