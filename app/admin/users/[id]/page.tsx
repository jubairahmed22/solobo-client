import * as React from "react";
import { UserDetailAdminClient } from "./UserDetailAdminClient";

export default function AdminUserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <UserDetailAdminClient id={params.id} />;
}
