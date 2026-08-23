"use client";

import * as React from "react";
import { Loader2, MapPin, PackageCheck, RefreshCw, Send, Sparkles } from "lucide-react";
import { Select } from "@/components/composed";
import { useUIStore } from "@/store/uiStore";
import {
  useCourierAreas,
  useCourierCities,
  useCourierZones,
  useDispatchCourierOrder,
  useMatchCourierLocation,
  usePatchAdminOrderCustomer,
  useRefreshCourierOrder,
} from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import type { AdminOrderDetail } from "@/types/admin";

const fieldLabel = "flex flex-col gap-[6px] text-[13px] font-medium text-gray-500";

/**
 * Inline city -> zone -> area picker, shown only while the order's shipping
 * address is missing the ids dispatchOrder requires. City is best-effort
 * auto-matched from the shipping address's free-text district/city (see
 * useMatchCourierLocation) so the admin isn't starting from blank - but
 * zone/area are never guessed (courier.service.ts's resolveLocationByName
 * docs: a wrong zone/area guess would ship to the wrong place), so those
 * always stay an explicit pick. Saves through the same customer-edit
 * endpoint the address form above uses; picking a city resets zone/area,
 * picking a zone resets area.
 */
function LocationPicker({ order }: { order: AdminOrderDetail }) {
  const toast = useUIStore((s) => s.toast);
  const patch = usePatchAdminOrderCustomer(order._id);
  const cities = useCourierCities();

  const [cityId, setCityId] = React.useState<number | undefined>(
    order.shippingAddress?.pathaoCityId,
  );
  const [zoneId, setZoneId] = React.useState<number | undefined>(
    order.shippingAddress?.pathaoZoneId,
  );
  const [areaId, setAreaId] = React.useState<number | undefined>(
    order.shippingAddress?.pathaoAreaId,
  );
  const [cityAutoFilled, setCityAutoFilled] = React.useState(false);

  const zones = useCourierZones(cityId);
  const areas = useCourierAreas(zoneId);

  // Best-effort city auto-match from the shipping address's free-text
  // district/city, so the admin isn't starting from a blank picker for the
  // common case. Zone/area are never guessed - see resolveLocationByName's
  // docs in courier.service.ts, a wrong zone/area would ship to the wrong
  // place, so those always stay an explicit pick.
  const match = useMatchCourierLocation(
    { district: order.shippingAddress?.district, city: order.shippingAddress?.city },
    cityId === undefined,
  );
  React.useEffect(() => {
    if (cityId === undefined && match.data) {
      setCityId(match.data.cityId);
      setCityAutoFilled(true);
    }
  }, [cityId, match.data]);

  const onSave = async () => {
    if (!cityId || !zoneId) {
      toast({ title: "Pick a city and zone first", tone: "error" });
      return;
    }
    const city = cities.data?.find((c) => c.cityId === cityId);
    const zone = zones.data?.find((z) => z.zoneId === zoneId);
    const area = areas.data?.find((a) => a.areaId === areaId);
    try {
      await patch.mutateAsync({
        shippingAddress: {
          pathaoCityId: cityId,
          pathaoCityName: city?.cityName,
          pathaoZoneId: zoneId,
          pathaoZoneName: zone?.zoneName,
          pathaoAreaId: areaId,
          pathaoAreaName: area?.areaName,
        },
      });
      toast({ title: "Delivery area saved", tone: "success" });
    } catch (err) {
      toast({
        title: err instanceof AdminError ? err.message : "Couldn't save delivery area",
        tone: "error",
      });
    }
  };

  return (
    <div className="rounded-[8px] border border-dashed border-gray-300 p-[12px]">
      <div className="mb-[10px] flex items-center gap-[6px] text-[13px] font-medium text-gray-900">
        <MapPin className="h-[14px] w-[14px] shrink-0 text-gray-400" aria-hidden />
        Pathao delivery area
      </div>
      {/* Always stacked - this panel lives in a fixed 320px sidebar column,
          so a viewport-width breakpoint (sm:) would switch to 3 columns on
          any normal desktop screen even though the column itself never gets
          wider, squeezing each <select> to ~80px and truncating its text. */}
      <div className="flex flex-col gap-[10px]">
        <label className={fieldLabel}>
          <span className="flex items-center gap-[6px]">
            City
            {cityAutoFilled ? (
              <span
                className="inline-flex items-center gap-[3px] rounded-full bg-blue-50 px-[6px] py-[1px] text-[11px] font-medium text-blue-700"
                title="Matched from the order's shipping address - double-check before saving"
              >
                <Sparkles className="h-[10px] w-[10px]" aria-hidden />
                Auto-detected
              </span>
            ) : null}
          </span>
          <Select
            value={cityId ? String(cityId) : ""}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : undefined;
              setCityId(v);
              setZoneId(undefined);
              setAreaId(undefined);
              setCityAutoFilled(false);
            }}
            options={[
              {
                value: "",
                label: cities.isLoading || match.isLoading ? "Loading…" : "Select city",
              },
              ...(cities.data ?? []).map((c) => ({ value: String(c.cityId), label: c.cityName })),
            ]}
          />
        </label>
        <label className={fieldLabel}>
          Zone
          <Select
            value={zoneId ? String(zoneId) : ""}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : undefined;
              setZoneId(v);
              setAreaId(undefined);
            }}
            disabled={!cityId}
            options={[
              { value: "", label: zones.isLoading ? "Loading…" : "Select zone" },
              ...(zones.data ?? []).map((z) => ({ value: String(z.zoneId), label: z.zoneName })),
            ]}
          />
        </label>
        <label className={fieldLabel}>
          Area (optional)
          <Select
            value={areaId ? String(areaId) : ""}
            onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : undefined)}
            disabled={!zoneId}
            options={[
              { value: "", label: areas.isLoading ? "Loading…" : "Select area" },
              ...(areas.data ?? []).map((a) => ({ value: String(a.areaId), label: a.areaName })),
            ]}
          />
        </label>
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={!cityId || !zoneId || patch.isPending}
        className="mt-[12px] inline-flex h-[36px] items-center gap-[8px] rounded-[8px] border border-gray-300 bg-white px-[14px] text-[13px] font-medium text-gray-900 transition duration-75 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {patch.isPending ? (
          <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden />
        ) : (
          <MapPin className="h-[14px] w-[14px]" aria-hidden />
        )}
        Save delivery area
      </button>
    </div>
  );
}

export function OrderCourierPanel({ order }: { order: AdminOrderDetail }) {
  const toast = useUIStore((s) => s.toast);
  const dispatch = useDispatchCourierOrder(order._id);
  const refresh = useRefreshCourierOrder(order._id);

  const courier = order.courier;
  const hasLocation = Boolean(
    order.shippingAddress?.pathaoCityId && order.shippingAddress?.pathaoZoneId,
  );

  const onDispatch = async () => {
    try {
      const result = await dispatch.mutateAsync();
      toast({
        title: result.reason === "Already dispatched" ? "Already sent to Pathao" : "Sent to Pathao",
        tone: "success",
      });
    } catch (err) {
      toast({
        title: err instanceof AdminError ? err.message : "Couldn't send to Pathao",
        tone: "error",
      });
    }
  };

  const onRefresh = async () => {
    try {
      await refresh.mutateAsync();
      toast({ title: "Status refreshed", tone: "success" });
    } catch (err) {
      toast({
        title: err instanceof AdminError ? err.message : "Couldn't refresh status",
        tone: "error",
      });
    }
  };

  return (
    <section className="rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
      <h2 className="mb-[16px] flex items-center gap-[8px] text-[16px] font-semibold text-gray-900">
        <PackageCheck className="h-[16px] w-[16px] text-gray-400" aria-hidden /> Pathao courier
      </h2>

      {courier?.consignmentId ? (
        <div className="mb-[16px] divide-y divide-gray-100 rounded-[8px] border border-gray-100 text-[14px] text-gray-600">
          <div className="flex items-center justify-between px-[12px] py-[8px]">
            <span className="text-gray-500">Consignment ID</span>
            <span className="font-mono font-medium text-gray-900">{courier.consignmentId}</span>
          </div>
          <div className="flex items-center justify-between px-[12px] py-[8px]">
            <span className="text-gray-500">Status</span>
            <span className="font-medium text-gray-900">{courier.orderStatus ?? "-"}</span>
          </div>
        </div>
      ) : null}

      {courier?.dispatchError ? (
        <p className="mb-[16px] rounded-[8px] border border-red-200 bg-red-50 px-[12px] py-[8px] text-[13px] text-red-700">
          {courier.dispatchError}
        </p>
      ) : null}

      {!hasLocation ? <LocationPicker order={order} /> : null}

      <div className="mt-[16px] flex flex-wrap gap-[8px]">
        {/* Flowbite primary button */}
        <button
          type="button"
          onClick={onDispatch}
          disabled={dispatch.isPending || !hasLocation}
          className="inline-flex h-[36px] items-center gap-[8px] rounded-[8px] bg-[#1A56DB] px-[14px] text-[13px] font-medium text-white transition duration-75 hover:bg-[#1E429F] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {dispatch.isPending ? (
            <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden />
          ) : (
            <Send className="h-[14px] w-[14px]" aria-hidden />
          )}
          {courier?.consignmentId ? "Re-send to Pathao" : "Send to Pathao"}
        </button>
        {courier?.consignmentId ? (
          /* Flowbite alternative button */
          <button
            type="button"
            onClick={onRefresh}
            disabled={refresh.isPending}
            className="inline-flex h-[36px] items-center gap-[8px] rounded-[8px] border border-gray-300 bg-white px-[14px] text-[13px] font-medium text-gray-900 transition duration-75 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refresh.isPending ? (
              <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-[14px] w-[14px]" aria-hidden />
            )}
            Refresh status
          </button>
        ) : null}
      </div>
    </section>
  );
}
