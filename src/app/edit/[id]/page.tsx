"use client";

// Edit an existing profile — correcting a birth time or place previously
// meant deleting the profile and losing its Q&A history.

import { use } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AppShell } from "@/components/AppShell";
import { BirthDetailsForm } from "@/components/forms/BirthDetailsForm";
import { db } from "@/lib/db";
import { useI18n } from "@/lib/i18n";

export default function EditProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  // null = not found (useLiveQuery's undefined means "still loading")
  const profile = useLiveQuery(async () => (await db.profiles.get(Number(id))) ?? null, [id]);

  return (
    <AppShell>
      {profile === undefined ? (
        <p className="p-8 text-center text-(--color-ink-soft)">{t("loading")}</p>
      ) : profile === null ? (
        <p className="p-8 text-center text-red-300">{t("error")}</p>
      ) : (
        <BirthDetailsForm existing={profile} />
      )}
    </AppShell>
  );
}
