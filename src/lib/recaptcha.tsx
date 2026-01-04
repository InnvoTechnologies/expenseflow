"use client";

import { forwardRef, useImperativeHandle } from "react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

export interface ReCaptchaRef {
  executeRecaptcha: (action?: string) => Promise<string | null>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ReCaptchaProps {} // No props needed for v3 - it's invisible and automatic

export const ReCaptcha = forwardRef<ReCaptchaRef, ReCaptchaProps>(
  (props, ref) => {
    const { executeRecaptcha } = useGoogleReCaptcha();

    useImperativeHandle(ref, () => ({
      executeRecaptcha: async (action: string = "submit"): Promise<string | null> => {
        if (!executeRecaptcha) {
          console.error("ReCAPTCHA v3 not available");
          return null;
        }

        try {
          const token = await executeRecaptcha(action);
          return token;
        } catch (error) {
          console.error("ReCAPTCHA v3 execution failed:", error);
          return null;
        }
      },
    }));

    // reCAPTCHA v3 is invisible, so we don't render anything
    return null;
  }
);

ReCaptcha.displayName = "ReCaptcha";
