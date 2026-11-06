"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Alert, FieldError, Input, Label } from "@/components/ui";

export function LoginForm() {
  const [state, action] = useActionState<FormState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && <Alert>{state.error}</Alert>}
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.values?.email}
          aria-invalid={!!state.fieldErrors?.email}
          required
        />
        <FieldError messages={state.fieldErrors?.email} />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <Label htmlFor="password" className="mb-0">
            Password
          </Label>
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-brand-600 hover:underline"
          >
            Lupa password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!state.fieldErrors?.password}
          required
        />
        <FieldError messages={state.fieldErrors?.password} />
      </div>
      <SubmitButton className="w-full">Masuk</SubmitButton>
    </form>
  );
}
