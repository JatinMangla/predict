"use client";

import { AppShell } from "@/components/AppShell";
import { BirthDetailsForm } from "@/components/forms/BirthDetailsForm";

export default function NewProfilePage() {
  return (
    <AppShell>
      <BirthDetailsForm />
    </AppShell>
  );
}
