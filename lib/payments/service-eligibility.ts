export function isServiceAppointmentPayableStatus(status: string | null | undefined) {
  return String(status || "").toLowerCase() === "confirmed";
}
