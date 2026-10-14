import { Capacitor } from "@capacitor/core";
import { Download, Smartphone } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "./ui";

const APK_URL = "/downloads/workout-coach-android.apk";

export function AndroidInstallCard({ installReady, installApp }) {
  if (Capacitor.isNativePlatform()) return null;

  return (
    <Card className="border-4 border-black rounded-3xl shadow-none today-panel">
      <CardHeader className="card-block-header">
        <div className="eyebrow">Install</div>
        <CardTitle className="text-2xl font-black">Workout Coach on Android</CardTitle>
      </CardHeader>
      <CardContent className="card-block-body space-y-3">
        <p className="text-sm font-semibold">
          Compatible with Android 7.0 or newer (API 24), across brands including Samsung, Google Pixel, Xiaomi and others.
        </p>
        <p className="text-xs font-semibold">
          Version 1.0.0 device-test build, about 4.4 MB. Compatibility has not been verified on every model.
        </p>

        <a
          href={APK_URL}
          download="Workout-Coach-1.0.0.apk"
          className="w-full min-h-14 px-4 py-3 text-lg font-black border-4 border-black rounded-2xl today-accent flex items-center justify-center gap-2 text-center"
        >
          <Smartphone className="h-5 w-5" />
          Download Android APK
        </a>

        <div className="border-4 border-black rounded-2xl p-3 bg-white text-black text-sm font-semibold">
          On your Android phone, open the downloaded APK. If prompted, allow installation from your browser or Files app.
        </div>
        <p className="text-xs font-semibold">
          Xiaomi/HyperOS troubleshooting: If installation is blocked, check the “Install unknown apps” permission for the app opening the APK. Settings may differ by device.
        </p>

        <p className="text-xs font-semibold">
          If Android refuses to install over an older test copy, uninstall the old Workout Coach first. Test APKs use temporary signing until the Play release is configured.
        </p>

        {installReady && (
          <Button
            className="w-full h-14 text-base font-black border-4 border-black rounded-2xl bg-white text-black"
            onClick={installApp}
          >
            <Download className="mr-2 h-5 w-5" />
            Install web app instead
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
