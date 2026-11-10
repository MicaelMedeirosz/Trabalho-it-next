const success = { text: "text-green-700", badge: "bg-green-100 text-green-700" };
const pending = { text: "text-amber-700", badge: "bg-amber-100 text-amber-700" };
const error = { text: "text-red-700", badge: "bg-red-100 text-red-700" };
const neutral = { text: "text-slate-500", badge: "bg-slate-100 text-slate-500" };

export function statusColors(status: string | null | undefined) {
  switch (status) {
    case "SUCCESS":
    case "APPROVED":
    case "DONE":
      return success;
    case "PENDING":
    case "PENDING_APPROVAL":
    case "RECEIVED":
    case "PROCESSING":
    case "RUNNING":
    case "QUEUED":
    case "UPLOADING":
      return pending;
    case "FAILED":
    case "ERROR":
    case "REJECTED":
      return error;
    default:
      return neutral;
  }
}

export function validationStatus(passed: boolean | null | undefined) {
  return passed === true ? "SUCCESS" : passed === false ? "FAILED" : "PENDING";
}
