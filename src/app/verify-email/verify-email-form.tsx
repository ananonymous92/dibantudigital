"use client";

import { useActionState } from "react";
import {
  resendVerificationEmailAction,
  verifyEmailCodeAction,
  type FormState,
} from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Input, Label } from "@/components/ui";

export function VerifyEmailForm() {
  const [verifyState, verifyAction] = useActionState<FormState, FormData>(verifyEmailCodeAction, {});
  const [resendState, resendAction] = useActionState<FormState, FormData>(
    resendVerificationEmailAction,
    {},
  );

  return (
    <div className="space-y-4">
      <form action={verifyAction} className="space-y-4" noValidate>
        {verifyState.error && <Alert>{verifyState.error}</Alert>}
        {resendState.error && <Alert>{resendState.error}</Alert>}
        {resendState.success && <Alert tone="success">{resendState.success}</Alert>}

        <div>
          <Label htmlFor="code">Kode Verifikasi (6 Digit)</Label>
          <Input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="123456"
            className="text-center text-xl font-bold tracking-[0.4em]"
            required
          />
        </div>
        <SubmitButton className="w-full">Verifikasi Email</SubmitButton>
      </form>

      <form action={resendAction}>
        <SubmitButton variant="secondary" className="w-full">
          Kirim Ulang Kode Verifikasi
        </SubmitButton>
      </form>
    </div>
  );
}
