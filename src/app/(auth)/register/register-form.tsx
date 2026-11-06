"use client";

import { useActionState } from "react";
import { registerAction, type FormState } from "@/app/actions/auth";
import { Alert, FieldError, Input, Label } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function RegisterForm() {
  const [state, action] = useActionState<FormState, FormData>(registerAction, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && <Alert>{state.error}</Alert>}
      <div>
        <Label htmlFor="name">Nama lengkap</Label>
        <Input id="name" name="name" autoComplete="name" defaultValue={state.values?.name} aria-invalid={!!fe.name} />
        <FieldError messages={fe.name} />
      </div>
      <div>
        <Label htmlFor="workspaceName">Nama bisnis / brand</Label>
        <Input
          id="workspaceName"
          name="workspaceName"
          placeholder="mis. Appasco"
          defaultValue={state.values?.workspaceName}
          aria-invalid={!!fe.workspaceName}
        />
        <FieldError messages={fe.workspaceName} />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.values?.email}
          aria-invalid={!!fe.email}
        />
        <FieldError messages={fe.email} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Minimal 8 karakter"
          aria-invalid={!!fe.password}
        />
        <FieldError messages={fe.password} />
      </div>
      <SubmitButton className="w-full">Buat akun</SubmitButton>
      <p className="text-center text-xs text-slate-500">
        Dengan mendaftar, Anda menyetujui Syarat Layanan dan Kebijakan Privasi DibantuDigital.
      </p>
    </form>
  );
}

