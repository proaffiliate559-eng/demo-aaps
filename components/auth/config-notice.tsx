import { Alert } from "@/components/ui/alert";

export function ConfigNotice() {
  return (
    <Alert variant="info" className="mb-6">
      Authentication isn&apos;t configured on this deployment yet. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
      <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable sign-in.
    </Alert>
  );
}
