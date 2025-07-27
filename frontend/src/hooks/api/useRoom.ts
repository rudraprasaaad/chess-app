import { useQuery } from "@tanstack/react-query";
import { roomAPI } from "../../services/api";
import { useEffect } from "react";
import { toast } from "sonner";

export function useRoomByInviteCode(
  inviteCode: string,
  enabled = !!inviteCode
) {
  const query = useQuery({
    queryKey: ["roomByInviteCode", inviteCode],
    queryFn: () => roomAPI.getRoomId(inviteCode),
    enabled: enabled,
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  useEffect(() => {
    if (query.isError) {
      toast.error("Failed to fetch room by invite code.");
    }
  }, [query.isError, query.data]);

  return query;
}
