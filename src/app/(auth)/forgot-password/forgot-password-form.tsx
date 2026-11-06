"use client";

import { useActionState } from "react";
import { forgotPasswordAction, type FormState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Alert, FieldError, Input, Label } from "@/components/ui";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(forgotPasswordAction, {});

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && <Alert>{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div>
        <Label htmlFor="email">Alamat Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nama@perusahaan.com"
          defaultValue={state.values?.email}
          aria-invalid={!!state.fieldErrors?.email}
          required
        />
        <FieldError messages={state.fieldErrors?.email} />
      </div>
      <SubmitButton className="w-full">Kirim Link Reset Password</SubmitButton>
    </form>
  );
}
