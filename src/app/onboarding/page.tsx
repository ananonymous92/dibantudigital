"use client";

import { useActionState } from "react";
import { createWorkspaceAction, type FormState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { FieldError, Input, Label } from "@/components/ui";

export default function OnboardingPage() {
  const [state, action] = useActionState<FormState, FormData>(createWorkspaceAction, {});

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Buat Workspace Bisnis Anda</h1>
        <p className="mt-1 text-xs text-slate-500">
          Setiap workspace memiliki privasi data Meta Ads & laporan tersendiri.
        </p>
        <form action={action} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="workspaceName">Nama Bisnis / Brand</Label>
            <Input
              id="workspaceName"
              name="workspaceName"
              placeholder="mis. Appasco Indonesia"
              required
            />
            <FieldError messages={state.fieldErrors?.workspaceName} />
          </div>
          <SubmitButton className="w-full">Mulai Trial Gratis 7 Hari</SubmitButton>
        </form>
      </div>
    </div>
  );
}

