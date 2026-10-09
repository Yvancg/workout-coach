import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "./ui";

export function DeleteAccountPage({
  authConfigured,
  authEmail,
  authUserEmail,
  authStatus,
  deletionStatus,
  deleting,
  setAuthEmail,
  signInWithGoogle,
  signInWithMagicLink,
  deleteAccount,
}) {
  const signedIn = Boolean(authUserEmail);

  return (
    <main id="main-content" className="app-shell today-theme min-h-screen bg-white text-black p-3 sm:p-6">
      <div className="app-stack max-w-md mx-auto space-y-4 pb-10">
        <Card className="border-4 border-black rounded-3xl shadow-none today-panel">
          <CardHeader className="card-block-header">
            <div className="eyebrow">Privacy and account</div>
            <CardTitle className="text-2xl font-black">Delete Workout Coach account</CardTitle>
          </CardHeader>
          <CardContent className="card-block-body space-y-3">
            <p className="text-sm font-semibold">
              Deleting your account permanently removes your synced workout logs, session history, account-linked security records, and Supabase login account. This cannot be undone.
            </p>
            <p className="text-sm font-semibold">
              Local workout data on the device used to complete deletion is also cleared. Local copies on another device remain only on that device until its app data is cleared.
            </p>

            {!authConfigured && (
              <div className="border-4 border-black rounded-2xl p-3 bg-white text-black font-bold">
                Account deletion is temporarily unavailable because login is not configured.
              </div>
            )}

            {authConfigured && !signedIn && (
              <>
                <div className="text-sm font-bold">Sign in to the account you want to delete.</div>
                <Input
                  className="border-4 border-black rounded-2xl p-3 text-sm font-semibold"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button className="h-14 text-base font-black border-4 border-black rounded-2xl bg-white text-black" onClick={signInWithGoogle}>
                    Google
                  </Button>
                  <Button className="h-14 text-base font-black border-4 border-black rounded-2xl today-accent" onClick={signInWithMagicLink}>
                    Email Link
                  </Button>
                </div>
              </>
            )}

            {authConfigured && signedIn && (
              <>
                <div className="border-4 border-black rounded-2xl p-3 bg-white text-black">
                  <div className="text-sm font-black">Signed in account</div>
                  <div className="text-sm font-semibold">{authUserEmail}</div>
                </div>
                <Button
                  className="w-full h-14 text-base font-black border-4 border-black rounded-2xl account-delete-button"
                  onClick={deleteAccount}
                  disabled={deleting}
                >
                  {deleting ? "Deleting account..." : "Permanently delete account and data"}
                </Button>
              </>
            )}

            {(authStatus || deletionStatus) && (
              <div className="text-sm font-semibold" role="status" aria-live="polite">
                {deletionStatus || authStatus}
              </div>
            )}

            <div className="policy-link-row">
              <a className="policy-link" href="/privacy.html">Privacy policy</a>
              <a className="policy-link" href="/">Back to Workout Coach</a>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
