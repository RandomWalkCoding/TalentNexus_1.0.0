import { storageStatusSchema } from "@hr-console/contracts";

export function getStorageStatus(signal?: AbortSignal) {
  return fetch("/api/v1/storage/status", signal ? { signal } : {}).then(async (response) => {
    if (!response.ok) throw new Error("云端存储状态暂不可用");
    return storageStatusSchema.parse(await response.json());
  });
}
