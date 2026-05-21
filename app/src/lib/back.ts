/**
 * Smart back-link target based on ?from query.
 * Used by order detail / edit / new pages so the back button
 * returns to the page the user came from.
 */
export type BackOrigin = {
  from?: string;
  cid?: string;
};

export function backTarget(origin: BackOrigin, fallbackHref = "/orders") {
  if (origin.from === "calendar") {
    return { href: "/calendar", label: "回月曆排案" };
  }
  if (origin.from === "customer" && origin.cid) {
    return {
      href: `/customers/${origin.cid}`,
      label: "回顧客詳情",
    };
  }
  if (origin.from === "settlements") {
    return { href: "/payroll/settlements", label: "回師傅待回繳" };
  }
  if (origin.from === "payroll" && origin.cid) {
    return {
      href: `/payroll/${origin.cid}`,
      label: "回師傅薪資",
    };
  }
  return { href: fallbackHref, label: "回訂單列表" };
}

export function backQueryString(origin: BackOrigin) {
  const params = new URLSearchParams();
  if (origin.from) params.set("from", origin.from);
  if (origin.cid) params.set("cid", origin.cid);
  const s = params.toString();
  return s ? `?${s}` : "";
}
