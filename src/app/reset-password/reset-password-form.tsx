"use client";

import { useActionState } from "react";
import { resetPasswordAction, type FormState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Alert, FieldError, Input, Label } from "@/components/ui";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(resetPasswordAction, {});

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.error && <Alert>{state.error}</Alert>}
      <div>
        <Label htmlFor="password">Password Baru</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Minimal 8 karakter"
          aria-invalid={!!state.fieldErrors?.password}
          required
        />
        <FieldError messages={state.fieldErrors?.password} />
      </div>
      <div>
        <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Ulangi password baru"
          aria-invalid={!!state.fieldErrors?.confirmPassword}
          required
        />
        <FieldError messages={state.fieldErrors?.confirmPassword} />
      </div>
      <SubmitButton className="w-full">Simpan Password Baru</SubmitButton>
    </form>
  );
}

