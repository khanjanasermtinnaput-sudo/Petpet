import { NextResponse } from "next/server";
import { DEVICE_ID } from "@/lib/device";
import {
  deviceStatusFromHealth,
  unavailableDeviceStatus,
  type DeviceHealthRpcResult,
} from "@/lib/device-status";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

/** Database-backed liveness for the canonical feeder. */
export async function GET(request: Request) {
  const requestedDeviceId = new URL(request.url).searchParams.get("deviceId") ?? DEVICE_ID;
  if (requestedDeviceId !== DEVICE_ID) {
    console.warn("[device/status] rejected non-canonical device request", { requestedDeviceId });
    return NextResponse.json(unavailableDeviceStatus(DEVICE_ID, "unauthorized"), {
      status: 403,
      headers: NO_STORE_HEADERS,
    });
  }

  try {
    const supabase = createAdminClient();
    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .select("device_id")
      .eq("device_id", DEVICE_ID)
      .maybeSingle();

    if (deviceError) throw deviceError;
    if (!device) {
      return NextResponse.json(
        deviceStatusFromHealth(DEVICE_ID, { exists: false, server_time: new Date().toISOString() }),
        { headers: NO_STORE_HEADERS },
      );
    }

    const { data, error } = await supabase.rpc("device_health", {
      p_device_id: DEVICE_ID,
    });
    if (error) throw error;

    return NextResponse.json(
      deviceStatusFromHealth(DEVICE_ID, {
        ...((data ?? {}) as DeviceHealthRpcResult),
        exists: true,
      }),
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[device/status] database check failed", {
      device_id: DEVICE_ID,
      message: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.json(unavailableDeviceStatus(DEVICE_ID, "database_error"), {
      status: 503,
      headers: NO_STORE_HEADERS,
    });
  }
}